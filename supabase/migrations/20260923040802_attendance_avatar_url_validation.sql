begin;
set local lock_timeout='5s';
-- PostgreSQL bounded regex repetition is limited; validate URL length separately.
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
   or coalesce(p_asset->>'source_url','') !~ '^https://[^[:space:]]+$' or length(p_asset->>'source_url')>2048) then
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

notify pgrst,'reload schema';
commit;
