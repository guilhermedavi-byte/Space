begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
create table if not exists public.attendance_outbound_uploads (
 upload_id uuid primary key, conversation_id uuid not null references public.conversations,
 actor_uid text not null, spec jsonb not null, message_id uuid references public.messages,
 state text not null default 'prepared' check(state in ('prepared','sending','sent','failed','unknown')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.attendance_outbound_uploads enable row level security;
revoke all on public.attendance_outbound_uploads from public,anon,authenticated,service_role;
create table if not exists public.attendance_quick_replies (
 id uuid primary key default gen_random_uuid(), title text not null check(length(title) between 1 and 100),
 body text not null check(length(body) between 1 and 4000), team_id uuid references public.teams,
 created_by text not null, active boolean not null default true,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
alter table public.attendance_quick_replies enable row level security;
revoke all on public.attendance_quick_replies from public,anon,authenticated,service_role;
create or replace function public.attendance_composer(p_actor_uid text,p_role text,p_conversation_id uuid,p_action text,p_input jsonb default '{}')
returns jsonb language plpgsql security definer set search_path=public as $$
declare
 conv public.conversations; u public.attendance_outbound_uploads; result jsonb; mid uuid;
 spec jsonb; upload uuid; qr public.attendance_quick_replies;
begin
 if nullif(p_actor_uid,'') is null or p_role is null or p_role not in ('admin','growth') then raise exception using errcode='42501',message='attendance_forbidden';end if;
 select * into conv from public.conversations where conversation_id=p_conversation_id for update;
 if not found or (p_role<>'admin' and not public.attendance_has_access(p_actor_uid,conv.team_id,conv.channel_id)) then
   raise exception using errcode='42501',message='attendance_forbidden';end if;
 if p_action='ai_context' then
   return jsonb_build_object('messages',coalesce((select jsonb_agg(x.row order by x.sequence) from (
     select m.sequence,jsonb_build_object('role',case when m.direction='inbound' then 'user' else 'assistant' end,'content',left(m.content->>'text',1000)) row
     from public.messages m where m.conversation_id=p_conversation_id and m.direction in ('inbound','outbound') and length(coalesce(m.content->>'text',''))>0
     order by m.sequence desc limit 12) x),'[]'::jsonb));
 elsif p_action='replies' then
   return jsonb_build_object('items',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'title',r.title,'body',r.body,'team_id',r.team_id)) from public.attendance_quick_replies r where r.active and (r.team_id is null or r.team_id=conv.team_id)),'[]'::jsonb),'can_manage',p_role='admin');
 elsif p_action='save_reply' then
   if p_role<>'admin' then raise exception using errcode='42501',message='attendance_forbidden';end if;
   if p_input->>'team_id' is not null and (p_input->>'team_id')::uuid<>conv.team_id then raise exception using errcode='42501',message='attendance_forbidden';end if;
   if p_input->>'id' is not null then
     select * into qr from public.attendance_quick_replies where id=(p_input->>'id')::uuid;
     if not found or (qr.team_id is not null and qr.team_id<>conv.team_id) then raise exception using errcode='42501',message='attendance_forbidden';end if;
     update public.attendance_quick_replies set title=p_input->>'title',body=p_input->>'body',active=coalesce((p_input->>'active')::boolean,true),updated_at=now() where id=qr.id returning * into qr;
   else
     insert into public.attendance_quick_replies(title,body,team_id,created_by) values(p_input->>'title',p_input->>'body',(p_input->>'team_id')::uuid,p_actor_uid) returning * into qr;
   end if;
   return jsonb_build_object('id',qr.id);
 end if;
 upload:=(p_input->>'upload_id')::uuid;
 if upload is null then raise exception using errcode='22023',message='upload_invalid';end if;
 select * into u from public.attendance_outbound_uploads where upload_id=upload for update;
 if p_action='prepare' and u.upload_id is null then
   if conv.status='resolved' or not exists(select 1 from public.channels ch join public.connections c using(connection_id) where ch.channel_id=conv.channel_id and ch.status='active' and c.status='active' and c.provider='evolution_whatsapp') then raise exception using errcode='22023',message='attendance_channel_disabled';end if;
   spec:=p_input->'spec';
   if (spec->>'size')::bigint not between 1 and 25165824 or spec->>'kind' not in ('image','audio','video','document') then raise exception using errcode='22023',message='upload_invalid';end if;
   insert into public.attendance_outbound_uploads(upload_id,conversation_id,actor_uid,spec) values(upload,p_conversation_id,p_actor_uid,spec) returning * into u;
 end if;
 if u.upload_id is null or u.actor_uid<>p_actor_uid or u.conversation_id<>p_conversation_id then raise exception using errcode='42501',message='attendance_forbidden';end if;
 if p_action='prepare' and u.spec<>p_input->'spec' then raise exception using errcode='23505',message='upload_conflict';end if;
 if p_action in ('prepare','get') then return to_jsonb(u);end if;
 if p_action='claim' then
   if u.state in ('sending','unknown','sent') then return to_jsonb(u)||jsonb_build_object('claimed',false);end if;
   if p_role='admin' then perform public.attendance_ensure_admin_member(p_actor_uid,p_role,conv.team_id);end if;
   if u.message_id is null then
     result:=public.attendance_append_message(p_actor_uid,p_conversation_id,jsonb_build_object('direction','outbound','kind',u.spec->>'kind',
       'content',jsonb_build_object('text',left(coalesce(p_input->>'caption',''),4000),'media',jsonb_build_object('filename',u.spec->>'filename','mime_type',u.spec->>'mime','duration',u.spec->'duration')),
       'client_request_id','media:'||upload,'metadata',jsonb_build_object('provider','evolution_whatsapp','voice_note',coalesce((u.spec->>'voice_note')::boolean,false))));
     mid:=(result->>'message_id')::uuid;
   else mid:=u.message_id;
     if conv.status='resolved' or not exists(select 1 from public.channels ch join public.connections c using(connection_id) where ch.channel_id=conv.channel_id and ch.status='active' and c.status='active') then raise exception using errcode='22023',message='attendance_channel_disabled';end if;
   end if;
   update public.attendance_outbound_uploads set state='sending',message_id=mid,updated_at=now() where upload_id=upload returning * into u;
   return to_jsonb(u)||jsonb_build_object('claimed',true);
 elsif p_action='finish' then
   if u.state<>'sending' or p_input->>'state' not in ('sent','failed','unknown') then raise exception using errcode='22023',message='upload_invalid_state';end if;
   -- Never regress delivered/read if a webhook beat this HTTP completion.
   if not exists(select 1 from public.messages where message_id=u.message_id and transport_status in ('delivered','read')) then
     perform public.attendance_set_message_transport(u.message_id,p_input->>'state',p_input->>'external_id',jsonb_build_object('provider','evolution_whatsapp'));
   else update public.messages set external_message_id=coalesce(external_message_id,p_input->>'external_id') where message_id=u.message_id;
   end if;
   update public.attendance_outbound_uploads set state=p_input->>'state',updated_at=now() where upload_id=upload returning * into u;
   return to_jsonb(u);
 end if;
 raise exception using errcode='22023',message='composer_invalid_action';
end $$;
revoke all on function public.attendance_composer(text,text,uuid,text,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.attendance_composer(text,text,uuid,text,jsonb) to service_role;
notify pgrst,'reload schema';
commit;
