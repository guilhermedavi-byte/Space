-- Read-only inbox API for Attendance. The browser calls Vercel; Vercel calls these RPCs with the authenticated actor.

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
      'contact', jsonb_build_object('contact_id', ct.contact_id, 'name', ct.display_name, 'phone', coalesce(ci.normalized_phone, ci.phone_raw, ci.external_identifier)),
      'last_message', case when m.message_id is null then null else jsonb_build_object(
        'message_id', m.message_id,
        'direction', m.direction,
        'kind', m.kind,
        'text', left(coalesce(m.content->>'text', m.content->>'body', '[' || m.kind || ']'), 180),
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
      select ci.normalized_phone, ci.phone_raw, ci.external_identifier
      from public.contact_identities ci
      where ci.contact_id = ct.contact_id and ci.connection_id = co.connection_id
      order by ci.created_at desc
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
         ci.normalized_phone, ci.phone_raw, ci.external_identifier
    into v_conv
  from public.conversations c
  join public.teams t on t.team_id = c.team_id
  join public.channels ch on ch.channel_id = c.channel_id
  join public.connections co on co.connection_id = ch.connection_id
  join public.contacts ct on ct.contact_id = c.contact_id
  left join lateral (
    select ci.normalized_phone, ci.phone_raw, ci.external_identifier
    from public.contact_identities ci
    where ci.contact_id = ct.contact_id and ci.connection_id = co.connection_id
    order by ci.created_at desc
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
      'transport_status', q.transport_status,
      'author_uid', q.author_uid,
      'received_at', q.received_at,
      'provider_timestamp', q.provider_timestamp,
      'reply_to_message_id', q.reply_to_message_id
    ) order by q.sequence), '[]'::jsonb)
    into v_messages
  from (
    select m.message_id, m.sequence, m.direction, m.kind, m.content, m.transport_status, m.author_uid, m.received_at, m.provider_timestamp, m.reply_to_message_id
    from public.messages m
    where m.conversation_id = p_conversation_id and m.sequence > coalesce(p_after, 0)
    order by m.sequence asc
    limit v_limit
  ) q;

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
      'created_at', v_conv.contact_created_at
    ),
    'participants', v_participants,
    'messages', v_messages,
    'composer', jsonb_build_object('enabled', false, 'reason', 'Envio será habilitado após concluir a conexão com a Meta.')
  );
end $$;

revoke all on function public.attendance_inbox_list(text, text, jsonb) from public, anon, authenticated;
revoke all on function public.attendance_inbox_detail(text, text, uuid, bigint, integer) from public, anon, authenticated;
grant execute on function public.attendance_inbox_list(text, text, jsonb) to service_role;
grant execute on function public.attendance_inbox_detail(text, text, uuid, bigint, integer) to service_role;
