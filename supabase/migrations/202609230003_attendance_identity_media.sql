begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

alter table public.contact_identities
  add column if not exists avatar_url text,
  add column if not exists avatar_source text,
  add column if not exists avatar_updated_at timestamptz,
  add column if not exists avatar_expires_at timestamptz,
  add constraint contact_identities_avatar_source_chk
    check (avatar_source is null or avatar_source in ('crm','space_profile','whatsapp_profile','initials'));

create table if not exists public.attendance_media_assets (
  message_id uuid primary key references public.messages(message_id) on delete cascade,
  media_type text not null check (media_type in ('audio','image','video','document','sticker')),
  mime_type text,
  filename text,
  size_bytes bigint check (size_bytes is null or size_bytes between 0 and 104857600),
  duration_seconds integer check (duration_seconds is null or duration_seconds between 0 and 86400),
  storage_path text,
  provider_media_id text,
  external_message_id text,
  fetch_status text not null default 'pending' check (fetch_status in ('pending','fetching','ready','failed')),
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((fetch_status = 'ready') = (storage_path is not null and mime_type is not null))
);

alter table public.attendance_media_assets enable row level security;
revoke all on table public.attendance_media_assets from public, anon, authenticated, service_role;

create or replace function public.attendance_update_contact_avatar_by_identity(
  p_connection_id uuid,
  p_identifier_type text,
  p_external_identifier text,
  p_avatar_url text,
  p_avatar_source text default 'whatsapp_profile',
  p_avatar_expires_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path=public as $$
declare updated_id uuid;
begin
  if p_avatar_url is null or p_avatar_url !~* '^https://.{8,2048}$' then
    raise exception using errcode='22023', message='attendance_invalid_avatar';
  end if;
  update public.contact_identities
     set avatar_url = left(p_avatar_url, 2048),
         avatar_source = coalesce(nullif(p_avatar_source, ''), 'whatsapp_profile'),
         avatar_updated_at = clock_timestamp(),
         avatar_expires_at = p_avatar_expires_at
   where connection_id = p_connection_id
     and identifier_type = p_identifier_type
     and external_identifier = p_external_identifier
     and coalesce(avatar_source, 'whatsapp_profile') not in ('crm','space_profile')
   returning contact_identity_id into updated_id;
  return jsonb_build_object('updated', updated_id is not null, 'contact_identity_id', updated_id);
end $$;

create or replace function public.attendance_upsert_media_asset(p_message_id uuid, p_asset jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public as $$
declare row public.attendance_media_assets;
begin
  if not exists(select 1 from public.messages where message_id = p_message_id and kind in ('audio','image','video','document','sticker')) then
    raise exception using errcode='22023', message='attendance_media_not_found';
  end if;
  insert into public.attendance_media_assets(
    message_id, media_type, mime_type, filename, size_bytes, duration_seconds, storage_path,
    provider_media_id, external_message_id, fetch_status, error_code, updated_at
  )
  values(
    p_message_id,
    coalesce(nullif(p_asset->>'media_type',''), (select kind from public.messages where message_id = p_message_id)),
    nullif(p_asset->>'mime_type',''),
    nullif(left(coalesce(p_asset->>'filename',''), 240),''),
    nullif(p_asset->>'size_bytes','')::bigint,
    nullif(p_asset->>'duration_seconds','')::integer,
    nullif(left(coalesce(p_asset->>'storage_path',''), 512),''),
    nullif(left(coalesce(p_asset->>'provider_media_id',''), 256),''),
    nullif(left(coalesce(p_asset->>'external_message_id',''), 256),''),
    coalesce(nullif(p_asset->>'fetch_status',''), 'pending'),
    nullif(left(coalesce(p_asset->>'error_code',''), 120),''),
    clock_timestamp()
  )
  on conflict(message_id) do update set
    media_type = excluded.media_type,
    mime_type = coalesce(excluded.mime_type, public.attendance_media_assets.mime_type),
    filename = coalesce(excluded.filename, public.attendance_media_assets.filename),
    size_bytes = coalesce(excluded.size_bytes, public.attendance_media_assets.size_bytes),
    duration_seconds = coalesce(excluded.duration_seconds, public.attendance_media_assets.duration_seconds),
    storage_path = coalesce(excluded.storage_path, public.attendance_media_assets.storage_path),
    provider_media_id = coalesce(excluded.provider_media_id, public.attendance_media_assets.provider_media_id),
    external_message_id = coalesce(excluded.external_message_id, public.attendance_media_assets.external_message_id),
    fetch_status = excluded.fetch_status,
    error_code = excluded.error_code,
    updated_at = clock_timestamp()
  returning * into row;
  return to_jsonb(row);
end $$;

create or replace function public.attendance_get_media_asset(
  p_actor_uid text,
  p_role text,
  p_message_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=public as $$
declare
  v_is_admin boolean := lower(coalesce(p_role, '')) = 'admin';
  v record;
begin
  select m.*, co.connection_id, co.provider, co.external_account_id, co.display_name as connection_name
    into v
  from public.messages m
  join public.conversations c on c.conversation_id = m.conversation_id
  join public.channels ch on ch.channel_id = m.channel_id
  join public.connections co on co.connection_id = ch.connection_id
  where m.message_id = p_message_id
    and (v_is_admin or public.attendance_has_access(p_actor_uid, c.team_id, c.channel_id));
  if not found then
    raise exception using errcode='42501', message='attendance_forbidden';
  end if;
  return jsonb_build_object(
    'message', jsonb_build_object(
      'message_id', v.message_id,
      'conversation_id', v.conversation_id,
      'channel_id', v.channel_id,
      'kind', v.kind,
      'content', v.content,
      'metadata', v.metadata,
      'external_message_id', v.external_message_id
    ),
    'connection', jsonb_build_object(
      'connection_id', v.connection_id,
      'provider', v.provider,
      'instance_name', v.external_account_id,
      'name', v.connection_name
    ),
    'asset', coalesce((select to_jsonb(a) from public.attendance_media_assets a where a.message_id = p_message_id), '{}'::jsonb)
  );
end $$;

create or replace function public.attendance_inbox_list(
  p_actor_uid text,
  p_role text,
  p_filters jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=public as $$
declare
  v_is_admin boolean := lower(coalesce(p_role, '')) = 'admin';
  v_limit integer := least(greatest(coalesce(nullif(p_filters->>'limit', '')::integer, 50), 1), 50);
  v_q text := nullif(btrim(coalesce(p_filters->>'q', '')), '');
  v_filter text := coalesce(nullif(p_filters->>'filter', ''), 'all');
  v_team_id uuid := nullif(p_filters->>'team_id', '')::uuid;
  v_rows jsonb;
  v_teams jsonb;
begin
  if not v_is_admin and not exists (
    select 1 from public.attendance_members am where am.user_uid = p_actor_uid and am.enabled is true
  ) then
    raise exception using errcode='42501', message='attendance_forbidden';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('team_id', q.team_id, 'name', q.name) order by q.name), '[]'::jsonb)
    into v_teams
  from (
    select t.team_id, t.name
    from public.teams t
    where t.active is true
      and (v_is_admin or exists (
        select 1 from public.team_members tm
        where tm.team_id = t.team_id and tm.user_uid = p_actor_uid and tm.active is true
      ))
  ) q;

  select coalesce(jsonb_agg(q.row_data), '[]'::jsonb)
    into v_rows
  from (
    select jsonb_build_object(
      'conversation_id', c.conversation_id,
      'status', c.status,
      'priority', c.priority,
      'assigned_user_uid', c.assigned_user_uid,
      'team', jsonb_build_object('team_id', t.team_id, 'name', t.name),
      'channel', jsonb_build_object('channel_id', ch.channel_id, 'name', ch.display_name, 'status', ch.status),
      'connection', jsonb_build_object('connection_id', co.connection_id, 'name', co.display_name, 'provider', co.provider, 'status', co.status, 'setup_pending', coalesce(co.metadata->>'setup_pending', 'false') = 'true'),
      'contact', jsonb_build_object('contact_id', ct.contact_id, 'name', ct.display_name, 'phone', coalesce(ci.normalized_phone, ci.phone_raw, ci.external_identifier),
        'avatar', jsonb_build_object('url', ci.avatar_url, 'source', ci.avatar_source, 'updated_at', ci.avatar_updated_at)),
      'last_message', case when m.message_id is null then null else jsonb_build_object(
        'message_id', m.message_id,
        'direction', m.direction,
        'kind', m.kind,
        'content', m.content,
        'text', left(coalesce(m.content->>'text', m.content->>'body', ''), 180),
        'transport_status', m.transport_status,
        'received_at', m.received_at,
        'provider_timestamp', m.provider_timestamp
      ) end,
      'last_message_at', c.last_message_at,
      'last_inbound_at', c.last_inbound_at,
      'created_at', c.created_at,
      'updated_at', c.updated_at,
      'unread_count', (
        select count(*)::integer
        from public.messages mi
        where mi.conversation_id = c.conversation_id
          and mi.direction = 'inbound'
          and mi.sequence > coalesce((select cr.last_read_sequence from public.conversation_reads cr where cr.conversation_id = c.conversation_id and cr.user_uid = p_actor_uid), 0)
      )
    ) as row_data
    from public.conversations c
    join public.teams t on t.team_id = c.team_id
    join public.channels ch on ch.channel_id = c.channel_id
    join public.connections co on co.connection_id = ch.connection_id
    join public.contacts ct on ct.contact_id = c.contact_id
    left join public.messages m on m.message_id = c.last_message_id
    left join lateral (
      select ci.normalized_phone, ci.phone_raw, ci.external_identifier, ci.avatar_url, ci.avatar_source, ci.avatar_updated_at
      from public.contact_identities ci
      where ci.contact_id = ct.contact_id and ci.connection_id = co.connection_id
      order by case when ci.avatar_source in ('crm','space_profile') then 0 when ci.avatar_url is not null then 1 else 2 end, ci.created_at desc
      limit 1
    ) ci on true
    where (v_is_admin or public.attendance_has_access(p_actor_uid, c.team_id, c.channel_id))
      and (v_team_id is null or c.team_id = v_team_id)
      and (v_filter <> 'mine' or c.assigned_user_uid = p_actor_uid)
      and (v_filter <> 'unassigned' or c.assigned_user_uid is null)
      and (v_filter <> 'unread' or exists (
        select 1 from public.messages mi
        where mi.conversation_id = c.conversation_id
          and mi.direction = 'inbound'
          and mi.sequence > coalesce((select cr.last_read_sequence from public.conversation_reads cr where cr.conversation_id = c.conversation_id and cr.user_uid = p_actor_uid), 0)
      ))
      and (v_q is null or ct.display_name ilike '%' || v_q || '%' or ci.normalized_phone ilike '%' || v_q || '%' or ci.phone_raw ilike '%' || v_q || '%' or ci.external_identifier ilike '%' || v_q || '%')
    order by c.last_message_at desc nulls last, c.updated_at desc nulls last, c.conversation_id desc
    limit v_limit
  ) q;

  return jsonb_build_object('rows', v_rows, 'teams', v_teams, 'limit', v_limit);
end $$;

create or replace function public.attendance_inbox_detail(
  p_actor_uid text,
  p_role text,
  p_conversation_id uuid,
  p_after bigint default 0,
  p_limit integer default 50
)
returns jsonb
language plpgsql
security definer
set search_path=public as $$
declare
  v_is_admin boolean := lower(coalesce(p_role, '')) = 'admin';
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
  v_conv record;
  v_messages jsonb;
  v_participants jsonb;
begin
  select c.*, t.name as team_name, ch.display_name as channel_name, ch.status as channel_status,
         co.connection_id, co.display_name as connection_name, co.provider, co.status as connection_status, co.metadata as connection_metadata,
         ct.display_name as contact_name, ct.created_at as contact_created_at,
         ci.normalized_phone, ci.phone_raw, ci.external_identifier, ci.avatar_url, ci.avatar_source, ci.avatar_updated_at
    into v_conv
  from public.conversations c
  join public.teams t on t.team_id = c.team_id
  join public.channels ch on ch.channel_id = c.channel_id
  join public.connections co on co.connection_id = ch.connection_id
  join public.contacts ct on ct.contact_id = c.contact_id
  left join lateral (
    select ci.normalized_phone, ci.phone_raw, ci.external_identifier, ci.avatar_url, ci.avatar_source, ci.avatar_updated_at
    from public.contact_identities ci
    where ci.contact_id = ct.contact_id and ci.connection_id = co.connection_id
    order by case when ci.avatar_source in ('crm','space_profile') then 0 when ci.avatar_url is not null then 1 else 2 end, ci.created_at desc
    limit 1
  ) ci on true
  where c.conversation_id = p_conversation_id
    and (v_is_admin or public.attendance_has_access(p_actor_uid, c.team_id, c.channel_id));

  if not found then
    raise exception using errcode='42501', message='attendance_forbidden';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
      'message_id', q.message_id,
      'sequence', q.sequence,
      'direction', q.direction,
      'kind', q.kind,
      'content', q.content,
      'media', q.media,
      'transport_status', q.transport_status,
      'author_uid', q.author_uid,
      'received_at', q.received_at,
      'provider_timestamp', q.provider_timestamp,
      'reply_to_message_id', q.reply_to_message_id,
      'external_reply_to_id', q.external_reply_to_id,
      'quoted', case when r.message_id is null then null else jsonb_build_object('message_id', r.message_id, 'direction', r.direction, 'kind', r.kind, 'text', left(coalesce(r.content->>'text', r.content->>'body', ''), 140)) end
    ) order by q.sequence), '[]'::jsonb)
    into v_messages
  from (
    select m.message_id, m.sequence, m.direction, m.kind, m.content, m.transport_status, m.author_uid, m.received_at, m.provider_timestamp, m.reply_to_message_id, m.external_reply_to_id,
      coalesce((select to_jsonb(a) from public.attendance_media_assets a where a.message_id = m.message_id), m.content->'media', m.metadata->'media') as media
    from public.messages m
    where m.conversation_id = p_conversation_id and m.sequence > coalesce(p_after, 0)
    order by m.sequence asc
    limit v_limit
  ) q
  left join public.messages r on r.conversation_id = p_conversation_id and (r.message_id = q.reply_to_message_id or r.external_message_id = q.external_reply_to_id);

  select coalesce(jsonb_agg(jsonb_build_object(
      'participant_role', p.participant_role,
      'contact_id', p.contact_id,
      'user_uid', p.user_uid,
      'internal_source', p.internal_source,
      'internal_person_type', p.internal_person_type,
      'internal_person_id', p.internal_person_id,
      'resolution_state', p.resolution_state,
      'resolution_confidence', p.resolution_confidence,
      'created_at', p.created_at
    ) order by p.created_at), '[]'::jsonb)
    into v_participants
  from public.conversation_participants p
  where p.conversation_id = p_conversation_id;

  return jsonb_build_object(
    'conversation', jsonb_build_object(
      'conversation_id', v_conv.conversation_id,
      'status', v_conv.status,
      'priority', v_conv.priority,
      'assigned_user_uid', v_conv.assigned_user_uid,
      'last_message_at', v_conv.last_message_at,
      'last_inbound_at', v_conv.last_inbound_at,
      'created_at', v_conv.created_at,
      'updated_at', v_conv.updated_at,
      'team', jsonb_build_object('team_id', v_conv.team_id, 'name', v_conv.team_name),
      'channel', jsonb_build_object('channel_id', v_conv.channel_id, 'name', v_conv.channel_name, 'status', v_conv.channel_status),
      'connection', jsonb_build_object('connection_id', v_conv.connection_id, 'name', v_conv.connection_name, 'provider', v_conv.provider, 'status', v_conv.connection_status, 'setup_pending', coalesce(v_conv.connection_metadata->>'setup_pending', 'false') = 'true')
    ),
    'contact', jsonb_build_object(
      'contact_id', v_conv.contact_id,
      'name', v_conv.contact_name,
      'phone', coalesce(v_conv.normalized_phone, v_conv.phone_raw, v_conv.external_identifier),
      'avatar', jsonb_build_object('url', v_conv.avatar_url, 'source', v_conv.avatar_source, 'updated_at', v_conv.avatar_updated_at),
      'created_at', v_conv.contact_created_at
    ),
    'participants', v_participants,
    'messages', v_messages,
    'composer', jsonb_build_object('enabled', false, 'reason', 'Envio será habilitado após concluir a conexão com a Meta.')
  );
end $$;

revoke all on function public.attendance_update_contact_avatar_by_identity(uuid, text, text, text, text, timestamptz) from public, anon, authenticated;
revoke all on function public.attendance_upsert_media_asset(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.attendance_get_media_asset(text, text, uuid) from public, anon, authenticated;
grant execute on function public.attendance_update_contact_avatar_by_identity(uuid, text, text, text, text, timestamptz) to service_role;
grant execute on function public.attendance_upsert_media_asset(uuid, jsonb) to service_role;
grant execute on function public.attendance_get_media_asset(text, text, uuid) to service_role;
grant execute on function public.attendance_inbox_list(text, text, jsonb) to service_role;
grant execute on function public.attendance_inbox_detail(text, text, uuid, bigint, integer) to service_role;

notify pgrst, 'reload schema';
commit;
