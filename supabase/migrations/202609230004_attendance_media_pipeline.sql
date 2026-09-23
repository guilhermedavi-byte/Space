begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';
-- Media-only follow-up; deliberately does not apply unrelated identity/Inbox changes.
create table if not exists public.attendance_media_assets (
  message_id uuid primary key references public.messages(message_id) on delete cascade,
  media_type text not null check(media_type in ('image','audio','video','document','sticker')),
  mime_type text, filename text, size_bytes bigint check(size_bytes between 0 and 25165824),
  duration_seconds numeric check(duration_seconds between 0 and 86400), storage_path text,
  provider_media_id text, external_message_id text,
  fetch_status text not null default 'pending' check(fetch_status in ('pending','fetching','ready','failed')),
  error_code text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check(fetch_status <> 'ready' or (storage_path is not null and mime_type is not null))
);
alter table public.attendance_media_assets add column if not exists fetch_token uuid;
alter table public.attendance_media_assets add column if not exists fetch_started_at timestamptz;
alter table public.attendance_media_assets enable row level security;
revoke all on public.attendance_media_assets from public, anon, authenticated, service_role;

create or replace function public.attendance_get_media_asset(p_actor_uid text, p_role text, p_message_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v record;
begin
  if nullif(btrim(p_actor_uid),'') is null or p_role not in ('admin','growth') then
    raise exception using errcode='42501', message='attendance_forbidden';
  end if;
  select m.*, co.connection_id, co.provider, co.external_account_id into v
  from public.messages m join public.conversations c using(conversation_id)
  join public.channels ch on ch.channel_id=m.channel_id
  join public.connections co on co.connection_id=ch.connection_id
  where m.message_id=p_message_id and (p_role='admin' or public.attendance_has_access(p_actor_uid,c.team_id,c.channel_id));
  if not found then raise exception using errcode='42501', message='attendance_forbidden'; end if;
  return jsonb_build_object(
    'message',jsonb_build_object('message_id',v.message_id,'conversation_id',v.conversation_id,'kind',v.kind,
      'content',v.content,'metadata',jsonb_build_object('media',v.metadata->'media','evolution_message',v.metadata->'evolution_message'),
      'external_message_id',v.external_message_id),
    'connection',jsonb_build_object('connection_id',v.connection_id,'provider',v.provider,'instance_name',v.external_account_id),
    'asset',coalesce((select to_jsonb(a) from public.attendance_media_assets a where a.message_id=p_message_id),'{}'::jsonb));
end $$;

create or replace function public.attendance_upsert_media_asset(p_message_id uuid,p_asset jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare a public.attendance_media_assets; k text; status text; token uuid;
begin
  select kind into k from public.messages where message_id=p_message_id;
  if k is null or k not in ('image','audio','video','document','sticker') then
    raise exception using errcode='22023',message='media_not_found';
  end if;
  if jsonb_typeof(p_asset) <> 'object' then raise exception using errcode='22023',message='invalid_media_asset'; end if;
  status := coalesce(nullif(p_asset->>'fetch_status',''),'pending');
  token := nullif(p_asset->>'fetch_token','')::uuid;
  insert into public.attendance_media_assets(message_id,media_type) values(p_message_id,k) on conflict(message_id) do nothing;
  select * into a from public.attendance_media_assets where message_id=p_message_id for update;
  if status='fetching' then
    if token is null then raise exception using errcode='22023',message='media_lease_required'; end if;
    if (a.fetch_status='ready' and coalesce(p_asset->>'retry_ready','false') <> 'true')
      or (a.fetch_status='fetching' and a.fetch_started_at > clock_timestamp()-interval '90 seconds') then
      return jsonb_build_object('claimed',false,'asset',to_jsonb(a));
    end if;
    update public.attendance_media_assets set fetch_status='fetching',storage_path=null,mime_type=null,
      fetch_token=token,fetch_started_at=clock_timestamp(),updated_at=clock_timestamp(),error_code=null
      where message_id=p_message_id returning * into a;
    return jsonb_build_object('claimed',true,'asset',to_jsonb(a));
  end if;
  -- Only the owner of the current lease may finish; a stale worker cannot overwrite a newer result.
  if a.fetch_token is not null and (token is null or token <> a.fetch_token) then
    raise exception using errcode='40001',message='media_lease_lost';
  end if;
  if p_asset ? 'storage_path' and nullif(p_asset->>'storage_path','') is not null
    and p_asset->>'storage_path' !~ ('^attendance/'||substr(p_message_id::text,1,2)||'/'||p_message_id::text||'\.[a-z0-9]+$') then
    raise exception using errcode='22023',message='invalid_media_path';
  end if;
  update public.attendance_media_assets set
    fetch_status=status,media_type=k,
    mime_type=case when p_asset ? 'mime_type' then left(p_asset->>'mime_type',120) else mime_type end,
    filename=case when p_asset ? 'filename' then left(p_asset->>'filename',240) else filename end,
    size_bytes=case when p_asset ? 'size_bytes' then (p_asset->>'size_bytes')::bigint else size_bytes end,
    duration_seconds=case when p_asset ? 'duration_seconds' then (p_asset->>'duration_seconds')::numeric else duration_seconds end,
    storage_path=case when status <> 'ready' then null when p_asset ? 'storage_path' then p_asset->>'storage_path' else storage_path end,
    provider_media_id=case when p_asset ? 'provider_media_id' then left(p_asset->>'provider_media_id',256) else provider_media_id end,
    external_message_id=case when p_asset ? 'external_message_id' then left(p_asset->>'external_message_id',256) else external_message_id end,
    error_code=left(p_asset->>'error_code',80),updated_at=clock_timestamp(),fetch_started_at=null
    where message_id=p_message_id returning * into a;
  return jsonb_build_object('asset',to_jsonb(a));
end $$;
revoke all on function public.attendance_get_media_asset(text,text,uuid) from public,anon,authenticated;
revoke all on function public.attendance_upsert_media_asset(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.attendance_get_media_asset(text,text,uuid) to service_role;
grant execute on function public.attendance_upsert_media_asset(uuid,jsonb) to service_role;
-- No direct client access, even when another bucket has a broad permissive policy.
drop policy if exists attendance_media_server_only on storage.objects;
create policy attendance_media_server_only on storage.objects as restrictive for all to anon,authenticated
  using(bucket_id <> 'attendance-media') with check(bucket_id <> 'attendance-media');
notify pgrst,'reload schema';
commit;
