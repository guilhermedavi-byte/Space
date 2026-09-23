begin;
set local lock_timeout='5s';
create table if not exists public.attendance_contact_avatars (
 contact_identity_id uuid primary key,
 contact_id uuid not null references public.contacts(contact_id) on delete cascade,
 foreign key(contact_identity_id,contact_id) references public.contact_identities(contact_identity_id,contact_id) on delete cascade,
 source text not null default 'whatsapp_profile' check(source='whatsapp_profile'),
 source_url text, storage_path text,
 fetched_at timestamptz, expires_at timestamptz,
 fetch_status text not null default 'pending' check(fetch_status in ('pending','fetching','ready','absent','failed')),
 error_code text, fetch_token uuid, fetch_started_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(fetch_status<>'ready' or storage_path is not null)
);
create index if not exists attendance_contact_avatars_contact_idx on public.attendance_contact_avatars(contact_id);
alter table public.attendance_contact_avatars enable row level security;
revoke all on public.attendance_contact_avatars from public,anon,authenticated,service_role;

-- Trusted server only: resolve the exact existing identity, never create or relink contacts.
create or replace function public.attendance_update_contact_avatar_by_identity(
 p_connection_id uuid,p_identifier_type text,p_external_identifier text,p_asset jsonb default '{}'::jsonb
) returns jsonb language plpgsql security definer set search_path=public as $$
declare i public.contact_identities; a public.attendance_contact_avatars; co public.connections;
 token uuid; status text; op text:=p_asset->>'op';
begin
 select * into i from public.contact_identities where connection_id=p_connection_id and identifier_type=p_identifier_type and external_identifier=p_external_identifier;
 if not found then raise exception using errcode='22023',message='avatar_identity_missing'; end if;
 select * into co from public.connections where connection_id=i.connection_id and provider='evolution_whatsapp';
 if not found then raise exception using errcode='22023',message='avatar_provider_unsupported'; end if;
 if op='read' then
  select * into a from public.attendance_contact_avatars where contact_identity_id=i.contact_identity_id;
  return jsonb_build_object('identity',to_jsonb(i),'connection',jsonb_build_object('instance_name',co.external_account_id),'asset',coalesce(to_jsonb(a),'{}'::jsonb));
 end if;
 if op not in ('claim','finish') or op is null then raise exception using errcode='22023',message='avatar_invalid_operation'; end if;
 token:=nullif(p_asset->>'fetch_token','')::uuid;
 if token is null then raise exception using errcode='22023',message='avatar_lease_required'; end if;
 insert into public.attendance_contact_avatars(contact_identity_id,contact_id) values(i.contact_identity_id,i.contact_id) on conflict do nothing;
 select * into a from public.attendance_contact_avatars where contact_identity_id=i.contact_identity_id for update;
 if op='claim' then
  if a.expires_at>now() or (a.fetch_status='fetching' and a.fetch_started_at>now()-interval '90 seconds') then
   return jsonb_build_object('claimed',false,'asset',to_jsonb(a));
  end if;
  update public.attendance_contact_avatars set fetch_status='fetching',fetch_token=token,fetch_started_at=now(),updated_at=now()
   where contact_identity_id=i.contact_identity_id returning * into a;
  return jsonb_build_object('claimed',true,'asset',to_jsonb(a));
 end if;
 if a.fetch_token is distinct from token then raise exception using errcode='40001',message='avatar_lease_lost'; end if;
 status:=p_asset->>'fetch_status';
 if status not in ('ready','absent','failed') or status is null then raise exception using errcode='22023',message='avatar_invalid_status'; end if;
 if status='ready' and (p_asset->>'storage_path' is distinct from 'profiles/'||i.contact_identity_id::text||'.jpg'
   or coalesce(p_asset->>'source_url','') !~ '^https://[^[:space:]]{1,2040}$') then
  raise exception using errcode='22023',message='avatar_invalid_asset';
 end if;
 update public.attendance_contact_avatars set fetch_status=status,
  storage_path=case when status='ready' then p_asset->>'storage_path' when status='absent' then null else storage_path end,
  source_url=case when status='ready' then p_asset->>'source_url' when status='absent' then null else source_url end,
  fetched_at=case when status in ('ready','absent') then now() else fetched_at end,
  expires_at=now()+case when status='failed' then interval '15 minutes' else interval '24 hours' end,
  error_code=case when status='ready' then null else left(p_asset->>'error_code',80) end,
  fetch_started_at=null,fetch_token=null,updated_at=now()
 where contact_identity_id=i.contact_identity_id returning * into a;
 return jsonb_build_object('asset',to_jsonb(a));
end $$;

create or replace function public.attendance_get_contact_avatar(p_actor_uid text,p_role text,p_contact_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare i public.contact_identities; result jsonb; links jsonb;
begin
 if nullif(btrim(p_actor_uid),'') is null or coalesce(p_role,'') not in ('admin','growth') or not exists(
  select 1 from public.conversations c where c.contact_id=p_contact_id and (p_role='admin' or public.attendance_has_access(p_actor_uid,c.team_id,c.channel_id))
 ) then raise exception using errcode='42501',message='attendance_forbidden'; end if;
 select ci.* into i from public.contact_identities ci join public.connections co using(connection_id)
 where ci.contact_id=p_contact_id and co.provider='evolution_whatsapp'
 and exists(select 1 from public.conversations c join public.channels ch using(channel_id) where c.contact_id=ci.contact_id and ch.connection_id=ci.connection_id and (p_role='admin' or public.attendance_has_access(p_actor_uid,c.team_id,c.channel_id)))
 order by ci.created_at,ci.contact_identity_id limit 1;
 if found then result:=public.attendance_update_contact_avatar_by_identity(i.connection_id,i.identifier_type,i.external_identifier,'{"op":"read"}');
 else result:='{}'; end if;
 select coalesce(jsonb_agg(to_jsonb(cp)),'[]') into links from public.conversation_participants cp join public.conversations c using(conversation_id)
 where cp.contact_id=p_contact_id and cp.resolution_state='linked' and (p_role='admin' or public.attendance_has_access(p_actor_uid,c.team_id,c.channel_id));
 return result||jsonb_build_object('contact',jsonb_build_object('contact_id',p_contact_id),'participants',links);
end $$;

create or replace function public.attendance_avatar_backfill_candidates(p_after uuid default null,p_limit integer default 5)
returns jsonb language sql security definer set search_path=public as $$
 select coalesce(jsonb_agg(to_jsonb(q)),'[]') from (
 select ci.contact_identity_id,ci.contact_id,ci.connection_id,ci.identifier_type,ci.external_identifier
 from public.contact_identities ci join public.connections co using(connection_id)
 where co.provider='evolution_whatsapp' and (p_after is null or ci.contact_identity_id>p_after)
 order by ci.contact_identity_id limit least(greatest(coalesce(p_limit,5),1),5)
 ) q;
$$;
revoke all on function public.attendance_update_contact_avatar_by_identity(uuid,text,text,jsonb) from public,anon,authenticated;
revoke all on function public.attendance_get_contact_avatar(text,text,uuid) from public,anon,authenticated;
revoke all on function public.attendance_avatar_backfill_candidates(uuid,integer) from public,anon,authenticated;
grant execute on function public.attendance_update_contact_avatar_by_identity(uuid,text,text,jsonb) to service_role;
grant execute on function public.attendance_get_contact_avatar(text,text,uuid) to service_role;
grant execute on function public.attendance_avatar_backfill_candidates(uuid,integer) to service_role;
-- Explicit deny for user-facing roles, even if another bucket has permissive policies.
drop policy if exists attendance_avatars_server_only on storage.objects;
create policy attendance_avatars_server_only on storage.objects as restrictive for all to anon,authenticated
 using(bucket_id<>'attendance-avatars') with check(bucket_id<>'attendance-avatars');
notify pgrst,'reload schema';
commit;
