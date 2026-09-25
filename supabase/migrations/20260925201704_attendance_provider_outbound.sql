begin;
set local lock_timeout='5s';
-- A transport echo may arrive before the send response. This journal is not a second timeline.
create table if not exists public.attendance_provider_receipts (
 channel_id uuid not null references public.channels, external_message_id text not null check(length(external_message_id) between 1 and 256),
 event jsonb, transport_status text, message_id uuid references public.messages,
 created_at timestamptz not null default now(),processed_at timestamptz,last_error_code text,
 primary key(channel_id,external_message_id)
);
alter table public.attendance_provider_receipts enable row level security;
revoke all on public.attendance_provider_receipts from public,anon,authenticated,service_role;
create index if not exists attendance_provider_receipts_pending_idx on public.attendance_provider_receipts(channel_id,created_at) where event is not null;
alter table public.messages alter column sender_participant_id drop not null;
alter table public.messages drop constraint if exists messages_check;
alter table public.messages add constraint messages_check check(
 (direction='inbound' and author_uid is null and sender_participant_id is not null and external_message_id is not null and transport_status='received' and client_request_id is null)
 or (direction='outbound' and transport_status not in ('received','internal') and
   ((author_uid is not null and sender_participant_id is not null and client_request_id is not null)
    or (author_uid is null and sender_participant_id is null and client_request_id is null and external_message_id is not null and coalesce(metadata->>'origin','')='external_device')))
 or (direction='internal' and author_uid is not null and sender_participant_id is not null and client_request_id is not null and transport_status='internal' and external_message_id is null)
);
create or replace function public.attendance_check_sender()
returns trigger language plpgsql set search_path=pg_catalog,public as $$
declare sender public.conversation_participants;
begin
  if new.direction='outbound' and new.author_uid is null and new.sender_participant_id is null and new.external_message_id is not null and new.metadata->>'origin'='external_device' then return new; end if;
  select * into sender from public.conversation_participants where participant_id=new.sender_participant_id;
  if not found or sender.conversation_id<>new.conversation_id
    or (new.direction='inbound' and sender.participant_role<>'external')
    or (new.direction<>'inbound' and (sender.participant_role<>'agent' or sender.user_uid is distinct from new.author_uid)) then
    raise exception using errcode='23514',message='attendance_invalid_sender';
  end if;
  return new;
end $$;

create or replace function public.attendance_transport_merge(p_old text,p_new text) returns text language sql immutable as $$
 select case when p_new is null then coalesce(p_old,'sent')
 when p_old='read' or p_new='read' then 'read'
 when p_old='delivered' or p_new='delivered' then 'delivered'
 when p_old='failed' or p_new='failed' then 'failed'
 when p_old='sent' or p_new='sent' then 'sent'
 when p_old='accepted' or p_new='accepted' then 'accepted'
 else coalesce(p_new,p_old,'sent') end;
$$;
create or replace function public.attendance_refresh_activity(p_conversation_id uuid) returns void
language plpgsql security definer set search_path=pg_catalog,public as $$
declare m public.messages;
begin
 select * into m from public.messages where conversation_id=p_conversation_id order by coalesce(provider_timestamp,received_at) desc,sequence desc limit 1;
 update public.conversations set last_message_id=m.message_id,last_message_at=coalesce(m.provider_timestamp,m.received_at),
 updated_at=greatest(updated_at,coalesce(m.provider_timestamp,m.received_at)) where conversation_id=p_conversation_id;
end $$;
create or replace function public.attendance_ingest_provider_message(p_event jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare
  ch public.channels; conn public.connections; conv public.conversations; existing public.messages;
  identity_row public.contact_identities; contact_uuid uuid; participant_uuid uuid; message_uuid uuid;
  event_id text:=nullif(p_event->>'external_event_id',''); msg_id text:=nullif(p_event->>'external_message_id','');
  ext_contact text:=nullif(p_event->>'external_contact_id',''); identity_type text:=coalesce(nullif(p_event->>'identifier_type',''),'provider_user');
  kind text:=coalesce(p_event->>'kind','text'); body jsonb:=p_event->'content';
  meta jsonb:=coalesce(p_event->'metadata','{}'); phone jsonb; stamp timestamptz; current_stamp timestamptz;
  fp text; result jsonb; receipt public.attendance_provider_receipts; alias_value text; candidates uuid[];
  direction_value text:=coalesce(p_event->>'direction','inbound'); state_value text;
begin
  if direction_value not in ('inbound','outbound') or msg_id is null or ext_contact is null or body is null then
    raise exception using errcode='22023',message='attendance_invalid_message'; end if;
  select * into ch from public.channels where channel_id=(p_event->>'channel_id')::uuid for share;
  if not found then raise exception using errcode='23503',message='attendance_channel_not_found'; end if;
  select * into conn from public.connections where connection_id=ch.connection_id for share;
  if conn.provider is distinct from p_event->>'provider' or conn.connection_id is distinct from (p_event->>'connection_id')::uuid then
    raise exception using errcode='22023',message='attendance_connection_mismatch'; end if;
  perform pg_advisory_xact_lock(hashtextextended('attendance:provider-channel:'||ch.channel_id,0));
  stamp:=(p_event->>'provider_timestamp')::timestamptz;
  if direction_value='outbound' then
    meta:=meta||jsonb_build_object('origin','external_device');
    insert into public.attendance_provider_receipts(channel_id,external_message_id,event)
      values(ch.channel_id,msg_id,p_event) on conflict(channel_id,external_message_id) do update set event=excluded.event;
    select * into receipt from public.attendance_provider_receipts where channel_id=ch.channel_id and external_message_id=msg_id;
  end if;
  fp:=encode(sha256(convert_to(jsonb_build_object('contact',ext_contact,'type',identity_type,'kind',kind,'content',body,
    'provider_timestamp',stamp,'reply',p_event->>'external_reply_to_id')::text,'UTF8')),'hex');
  perform pg_advisory_xact_lock(hashtextextended('attendance:message:'||ch.channel_id||':'||msg_id,0));
  select * into existing from public.messages where channel_id=ch.channel_id and external_message_id=msg_id;
  if found then
    if existing.direction<>direction_value then raise exception using errcode='23505',message='attendance_direction_conflict'; end if;
    if direction_value='outbound' then
      update public.messages set metadata=(metadata||meta)||jsonb_build_object('origin',case when author_uid is null then 'external_device' else 'space_inbox' end),
        provider_timestamp=coalesce(stamp,provider_timestamp),
        external_reply_to_id=coalesce(p_event->>'external_reply_to_id',external_reply_to_id),
        transport_status=public.attendance_transport_merge(transport_status,coalesce(receipt.transport_status,p_event->>'transport_status','sent'))
      where message_id=existing.message_id;
      update public.attendance_provider_receipts set message_id=existing.message_id,event=null,processed_at=now()
        where channel_id=ch.channel_id and external_message_id=msg_id;
      perform public.attendance_refresh_activity(existing.conversation_id);
    end if;
    return jsonb_build_object('conversation_id',existing.conversation_id,'message_id',existing.message_id,'sequence',existing.sequence,'duplicate',true,
      'outcome',case when existing.author_uid is null then 'duplicate' else 'reconciled' end);
  end if;
  if ch.status<>'active' or conn.status<>'active' then raise exception using errcode='22023',message='attendance_channel_disabled'; end if;
  if not exists(select 1 from public.teams where team_id=ch.default_team_id and active) then
    raise exception using errcode='42501',message='attendance_team_disabled'; end if;
  -- Serialize external identity creation even across two channels of the same connection.
  perform pg_advisory_xact_lock(hashtextextended('attendance:contact:'||ch.connection_id||':'||identity_type||':'||ext_contact,0));
  -- Alias evidence comes only from the provider's same-event remoteJid/remoteJidAlt.
  phone:=public.attendance_normalize_phone(p_event->>'phone_raw',p_event->>'country_calling_code');
  select array_agg(distinct contact_id) into candidates from public.contact_identities
    where connection_id=ch.connection_id and identifier_type=identity_type and
      (external_identifier=ext_contact or external_identifier in (select jsonb_array_elements_text(coalesce(p_event->'identity_aliases','[]')))
        or (phone->>'normalized' is not null and normalized_phone=phone->>'normalized'));
  if cardinality(candidates)>1 then raise exception using errcode='22023',message='attendance_identity_ambiguous'; end if;
  contact_uuid:=candidates[1];
  if contact_uuid is null then
    insert into public.contacts(display_name) values(left(p_event->>'display_name',200)) returning contact_id into contact_uuid;
  end if;
  for alias_value in select distinct value from jsonb_array_elements_text(jsonb_build_array(ext_contact)||coalesce(p_event->'identity_aliases','[]')) loop
    insert into public.contact_identities(contact_id,connection_id,identifier_type,external_identifier,phone_raw,normalized_phone,phone_normalization_state)
      values(contact_uuid,ch.connection_id,identity_type,alias_value,phone->>'raw',phone->>'normalized',phone->>'state') on conflict(connection_id,identifier_type,external_identifier) do nothing;
  end loop;
  select * into identity_row from public.contact_identities where connection_id=ch.connection_id and identifier_type=identity_type and external_identifier=ext_contact;
  -- Keep the echo durable until the Space send response binds its exact provider ID.
  -- Text only narrows the temporary hold; binding always requires the exact provider ID.
  -- An uncertain matching send stays held and observable, never guessed or discarded.
  if direction_value='outbound' and exists(select 1 from public.messages m join public.conversations c using(conversation_id)
    where m.channel_id=ch.channel_id and c.contact_id=contact_uuid and m.direction='outbound' and m.author_uid is not null
      and m.kind=coalesce(p_event->>'kind','text') and (coalesce(p_event->>'kind','text')<>'text' or btrim(coalesce(m.content->>'text',''))=btrim(coalesce(body->>'text','')))
      and m.external_message_id is null and m.transport_status in ('pending','sending','accepted','unknown') and m.metadata->>'origin'='space_inbox') then
    return jsonb_build_object('deferred',true,'outcome','deferred');
  end if;
  select * into conv from public.conversations where channel_id=ch.channel_id and contact_id=identity_row.contact_id and status<>'resolved' for update;
  if not found then
    insert into public.conversations(channel_id,contact_id,team_id,external_conversation_id)
      values(ch.channel_id,identity_row.contact_id,ch.default_team_id,p_event->>'external_conversation_id') returning * into conv;
    perform public.attendance_record_event(conv.conversation_id,'conversation.created',null,'provider',jsonb_build_object('team_id',conv.team_id));
  end if;
  if not exists(select 1 from public.teams where team_id=conv.team_id and active) then
    raise exception using errcode='42501',message='attendance_team_disabled'; end if;
  insert into public.conversation_participants(conversation_id,contact_id,participant_role)
    values(conv.conversation_id,conv.contact_id,'external') on conflict(conversation_id,contact_id) do nothing;
  select participant_id into participant_uuid from public.conversation_participants where conversation_id=conv.conversation_id and contact_id=conv.contact_id;
  current_stamp:=clock_timestamp();
  insert into public.messages(conversation_id,channel_id,sequence,sender_participant_id,direction,kind,content,transport_status,
    external_message_id,external_event_id,fingerprint,external_reply_to_id,provider_timestamp,received_at,metadata,reply_to_message_id)
    values(conv.conversation_id,ch.channel_id,conv.message_sequence+1,case when direction_value='inbound' then participant_uuid else null end,direction_value,kind,body,case when direction_value='inbound' then 'received' else public.attendance_transport_merge(coalesce(receipt.transport_status,'sent'),p_event->>'transport_status') end,msg_id,event_id,fp,
      p_event->>'external_reply_to_id',stamp,current_stamp,meta,(select message_id from public.messages where conversation_id=conv.conversation_id and channel_id=ch.channel_id and external_message_id=p_event->>'external_reply_to_id')) returning message_id into message_uuid;
  update public.conversations set message_sequence=message_sequence+1,
    last_inbound_at=case when direction_value='inbound' then greatest(last_inbound_at,coalesce(stamp,current_stamp)) else last_inbound_at end,version=version+1
    where conversation_id=conv.conversation_id;
  perform public.attendance_refresh_activity(conv.conversation_id);
  if direction_value='inbound' then
    insert into public.channel_contact_state(channel_id,contact_id,last_customer_message_at)
      values(ch.channel_id,conv.contact_id,coalesce(stamp,current_stamp)) on conflict(channel_id,contact_id) do update
      set last_customer_message_at=greatest(channel_contact_state.last_customer_message_at,excluded.last_customer_message_at);
  else
    update public.attendance_provider_receipts set message_id=message_uuid,event=null,processed_at=now()
      where channel_id=ch.channel_id and external_message_id=msg_id;
  end if;
  perform public.attendance_record_event(conv.conversation_id,'message.created',null,'provider',jsonb_build_object('message_id',message_uuid,'sequence',conv.message_sequence+1));
  perform public.attendance_enqueue_outbox(conv.conversation_id,'attendance.message',message_uuid,'attendance.message.created',jsonb_build_object('message_id',message_uuid,'conversation_id',conv.conversation_id));
  result:=jsonb_build_object('conversation_id',conv.conversation_id,'message_id',message_uuid,'sequence',conv.message_sequence+1,'duplicate',false,'outcome','inserted');
  return result;
end $$;

create or replace function public.attendance_set_message_transport(p_message_id uuid,p_status text,p_external_message_id text default null,p_metadata jsonb default '{}')
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare m public.messages; ch uuid; r public.attendance_provider_receipts; bound text;
begin
 if p_status not in ('pending','sending','accepted','sent','delivered','read','failed','unknown') or not public.attendance_metadata_safe(coalesce(p_metadata,'{}')) then
 raise exception using errcode='22023',message='attendance_invalid_transport_status'; end if;
 select channel_id into ch from public.messages where message_id=p_message_id;
 perform pg_advisory_xact_lock(hashtextextended('attendance:provider-channel:'||ch,0));
 select * into m from public.messages where message_id=p_message_id and direction='outbound' for update;
 if not found then raise exception using errcode='23503',message='attendance_message_not_found'; end if;
 bound:=coalesce(nullif(p_external_message_id,''),m.external_message_id);
 if m.external_message_id is not null and bound<>m.external_message_id then raise exception using errcode='23505',message='attendance_provider_id_conflict'; end if;
 if bound is not null then
  insert into public.attendance_provider_receipts(channel_id,external_message_id,message_id) values(ch,bound,m.message_id)
   on conflict(channel_id,external_message_id) do nothing;
  select * into r from public.attendance_provider_receipts where channel_id=ch and external_message_id=bound;
  if r.message_id is not null and r.message_id<>m.message_id then raise exception using errcode='23505',message='attendance_provider_id_conflict'; end if;
 end if;
 update public.messages set transport_status=public.attendance_transport_merge(public.attendance_transport_merge(transport_status,p_status),r.transport_status),
  external_message_id=bound, metadata=metadata||coalesce(p_metadata,'{}') where message_id=p_message_id returning * into m;
 if bound is not null then
  update public.attendance_provider_receipts set message_id=m.message_id where channel_id=ch and external_message_id=bound;
  if r.event is not null then
   begin perform public.attendance_ingest_provider_message(r.event);
   exception when others then update public.attendance_provider_receipts set last_error_code=SQLSTATE where channel_id=ch and external_message_id=bound; end;
  end if;
 end if;
 -- Exact ID is now bound (or sending definitely failed): release any companion events held during this send.
 for r in select * from public.attendance_provider_receipts where channel_id=ch and event is not null order by created_at loop
  begin perform public.attendance_ingest_provider_message(r.event);
  exception when others then update public.attendance_provider_receipts set last_error_code=SQLSTATE where channel_id=ch and external_message_id=r.external_message_id; end;
 end loop;
 select * into m from public.messages where message_id=p_message_id;
 return jsonb_build_object('message_id',m.message_id,'conversation_id',m.conversation_id,'status',m.transport_status,'external_message_id',m.external_message_id);
end $$;

create or replace function public.attendance_set_transport_by_external(p_channel_id uuid,p_external_message_id text,p_status text)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare m public.messages;
begin
 if p_status not in ('accepted','sent','delivered','read','failed','unknown') then raise exception using errcode='22023',message='attendance_invalid_transport_status'; end if;
 perform pg_advisory_xact_lock(hashtextextended('attendance:provider-channel:'||p_channel_id,0));
 insert into public.attendance_provider_receipts(channel_id,external_message_id,transport_status) values(p_channel_id,p_external_message_id,p_status)
 on conflict(channel_id,external_message_id) do update set transport_status=public.attendance_transport_merge(attendance_provider_receipts.transport_status,excluded.transport_status);
 update public.messages set transport_status=public.attendance_transport_merge(transport_status,p_status)
 where channel_id=p_channel_id and external_message_id=p_external_message_id and direction='outbound' returning * into m;
 return jsonb_build_object('updated',m.message_id is not null,'message_id',m.message_id,'conversation_id',m.conversation_id,'status',m.transport_status);
end $$;
revoke all on function public.attendance_ingest_provider_message(jsonb) from public,anon,authenticated;
revoke all on function public.attendance_refresh_activity(uuid) from public,anon,authenticated;
revoke all on function public.attendance_transport_merge(text,text) from public,anon,authenticated;
revoke all on function public.attendance_set_message_transport(uuid,text,text,jsonb) from public,anon,authenticated;
revoke all on function public.attendance_set_transport_by_external(uuid,text,text) from public,anon,authenticated;
grant execute on function public.attendance_ingest_provider_message(jsonb) to service_role;
grant execute on function public.attendance_set_message_transport(uuid,text,text,jsonb) to service_role;
grant execute on function public.attendance_set_transport_by_external(uuid,text,text) to service_role;
notify pgrst,'reload schema';
commit;
