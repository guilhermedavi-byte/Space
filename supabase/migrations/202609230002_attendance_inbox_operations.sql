begin;

create or replace function public.attendance_ensure_admin_member(
  p_actor_uid text,
  p_role text,
  p_team_id uuid
) returns jsonb
language plpgsql
security definer
set search_path=public as $$
begin
  if lower(coalesce(p_role, '')) <> 'admin' or coalesce(p_actor_uid, '') = '' then
    raise exception using errcode='42501', message='attendance_forbidden';
  end if;
  if not exists (select 1 from public.teams where team_id = p_team_id and active is true) then
    raise exception using errcode='22023', message='attendance_invalid_request';
  end if;

  insert into public.attendance_members(user_uid, enabled)
  values(p_actor_uid, true)
  on conflict(user_uid) do update set enabled = true;

  insert into public.team_members(team_id, user_uid, member_role, active)
  values(p_team_id, p_actor_uid, 'supervisor', true)
  on conflict(team_id, user_uid) do update set member_role = 'supervisor', active = true;

  return jsonb_build_object('ok', true);
end $$;

create or replace function public.attendance_evolution_instance_for_connection(
  p_connection_id uuid
) returns text
language plpgsql
security definer
set search_path=public as $$
declare
  v_instance text;
begin
  select external_account_id into v_instance
  from public.connections
  where connection_id = p_connection_id
    and provider = 'evolution_whatsapp'
    and status = 'active'
    and coalesce(metadata->>'setup_pending', 'false') <> 'true';

  if v_instance is null or v_instance !~ '^[a-zA-Z0-9_-]{1,100}$' then
    raise exception using errcode='22023', message='attendance_channel_disabled';
  end if;
  return v_instance;
end $$;

create or replace function public.attendance_set_message_transport(
  p_message_id uuid,
  p_status text,
  p_external_message_id text default null,
  p_metadata jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path=public as $$
declare
  v_msg public.messages;
  v_changed boolean;
begin
  if p_status not in ('pending','sent','delivered','read','failed','unknown','accepted','sending') then
    raise exception using errcode='22023', message='attendance_invalid_transport_status';
  end if;
  if p_external_message_id is not null and length(p_external_message_id) > 256 then
    raise exception using errcode='22023', message='attendance_invalid_transport_status';
  end if;
  if not public.attendance_metadata_safe(coalesce(p_metadata, '{}'::jsonb)) then
    raise exception using errcode='22023', message='attendance_invalid_metadata';
  end if;

  select * into v_msg from public.messages where message_id = p_message_id for update;
  if not found or v_msg.direction <> 'outbound' then
    raise exception using errcode='22023', message='attendance_invalid_request';
  end if;

  v_changed := v_msg.transport_status is distinct from p_status
    or (p_external_message_id is not null and v_msg.external_message_id is distinct from p_external_message_id);

  update public.messages
     set transport_status = p_status,
         external_message_id = coalesce(nullif(p_external_message_id, ''), external_message_id),
         metadata = metadata || coalesce(p_metadata, '{}'::jsonb)
   where message_id = p_message_id
   returning * into v_msg;

  if v_changed then
    perform public.attendance_record_event(v_msg.conversation_id, 'message.status.changed', null, 'provider',
      jsonb_build_object('message_id', v_msg.message_id, 'transport_status', p_status));
    perform public.attendance_enqueue_outbox(v_msg.conversation_id, 'attendance.message', v_msg.message_id,
      'attendance.message.status.changed', jsonb_build_object('message_id', v_msg.message_id, 'conversation_id', v_msg.conversation_id));
  end if;

  return jsonb_build_object('message_id', v_msg.message_id, 'conversation_id', v_msg.conversation_id, 'status', v_msg.transport_status);
end $$;

create or replace function public.attendance_update_conversation(p_actor_uid text,p_conversation_id uuid,p_command jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare conv public.conversations; saved public.conversation_events; fp text; cmd text:=p_command->>'action';
  action_id text:=nullif(p_command->>'client_action_id',''); target_team uuid; target_uid text; result jsonb; delta jsonb; event_name text;
begin
  select * into conv from public.conversations where conversation_id=p_conversation_id for update;
  if not found or not public.attendance_has_access(p_actor_uid,conv.team_id,conv.channel_id) then
    raise exception using errcode='42501',message='attendance_forbidden'; end if;
  if action_id is null or length(action_id)>128 or cmd is null then raise exception using errcode='22023',message='attendance_invalid_command'; end if;
  fp:=encode(sha256(convert_to(p_command::text,'UTF8')),'hex');
  select * into saved from public.conversation_events where conversation_id=p_conversation_id and actor_uid=p_actor_uid and client_action_id=action_id;
  if found then
    if saved.fingerprint<>fp then raise exception using errcode='23505',message='attendance_idempotency_conflict'; end if;
    return saved.result||jsonb_build_object('duplicate',true);
  end if;
  if (p_command->>'expected_version')::bigint is distinct from conv.version then
    raise exception using errcode='PT409',message='attendance_version_conflict'; end if;
  if cmd='assignment' then
    target_team:=coalesce((p_command->>'team_id')::uuid,conv.team_id); target_uid:=nullif(p_command->>'assigned_user_uid','');
    if not public.attendance_has_access(p_actor_uid,conv.team_id,conv.channel_id,true)
       or not public.attendance_has_access(p_actor_uid,target_team,conv.channel_id,true)
       or (target_uid is not null and not public.attendance_has_access(target_uid,target_team,conv.channel_id)) then
      raise exception using errcode='42501',message='attendance_forbidden'; end if;
    update public.conversations set team_id=target_team,assigned_user_uid=target_uid where conversation_id=p_conversation_id;
    delta:=jsonb_build_object('previous_team_id',conv.team_id,'team_id',target_team,'previous_assignee',conv.assigned_user_uid,'assignee',target_uid);
    event_name:='assignment.changed';
  elsif cmd='status' then
    if p_command->>'status' not in ('open','pending','resolved') then
      raise exception using errcode='22023',message='attendance_invalid_command'; end if;
    if conv.status='resolved' and p_command->>'status'<>'resolved' and exists (
      select 1 from public.conversations c
      where c.channel_id=conv.channel_id and c.contact_id=conv.contact_id and c.status<>'resolved' and c.conversation_id<>p_conversation_id
    ) then
      raise exception using errcode='23505',message='attendance_reopen_conflict'; end if;
    update public.conversations set status=p_command->>'status',
      resolved_at=case when p_command->>'status'='resolved' then coalesce(resolved_at,clock_timestamp()) else null end
      where conversation_id=p_conversation_id;
    delta:=jsonb_build_object('previous_status',conv.status,'status',p_command->>'status'); event_name:='status.changed';
  elsif cmd='metadata' then
    if not public.attendance_metadata_safe(p_command->'metadata') then raise exception using errcode='22023',message='attendance_invalid_metadata'; end if;
    update public.conversations set metadata=metadata||(p_command->'metadata') where conversation_id=p_conversation_id;
    delta:=jsonb_build_object('previous',conv.metadata,'patch',p_command->'metadata'); event_name:='metadata.changed';
  elsif cmd='identity' then
    if not public.attendance_has_access(p_actor_uid,conv.team_id,conv.channel_id,true) then
      raise exception using errcode='42501',message='attendance_forbidden'; end if;
    if p_command->>'resolution_state' not in ('linked','unidentified','ambiguous') or p_command->>'resolution_state' is null then
      raise exception using errcode='22023',message='attendance_invalid_identity'; end if;
    select jsonb_build_object('state',resolution_state,'source',internal_source,'type',internal_person_type,'id',internal_person_id)
      into delta from public.conversation_participants where conversation_id=p_conversation_id and participant_role='external';
    update public.conversation_participants set resolution_state=p_command->>'resolution_state',
      internal_source=case when p_command->>'resolution_state'='linked' then nullif(p_command->>'internal_source','') end,
      internal_person_type=case when p_command->>'resolution_state'='linked' then p_command->>'internal_person_type' end,
      internal_person_id=case when p_command->>'resolution_state'='linked' then p_command->>'internal_person_id' end,
      resolution_confidence=case when p_command->>'resolution_state'='linked' then 'manual' else 'unknown' end,
      resolution_origin=case when p_command->>'resolution_state'='linked' then nullif(p_command->>'resolution_origin','') end,
      linked_by_uid=case when p_command->>'resolution_state'='linked' then p_actor_uid end,
      linked_at=case when p_command->>'resolution_state'='linked' then clock_timestamp() end
      where conversation_id=p_conversation_id and participant_role='external';
    delta:=jsonb_build_object('previous',delta,'state',p_command->>'resolution_state','source',p_command->>'internal_source',
      'type',p_command->>'internal_person_type','id',p_command->>'internal_person_id'); event_name:='identity.changed';
  else raise exception using errcode='22023',message='attendance_invalid_command'; end if;
  update public.conversations set version=version+1,updated_at=clock_timestamp() where conversation_id=p_conversation_id returning * into conv;
  result:=jsonb_build_object('conversation_id',p_conversation_id,'version',conv.version,'status',conv.status,'assigned_user_uid',conv.assigned_user_uid,'team_id',conv.team_id,'duplicate',false);
  perform public.attendance_record_event(p_conversation_id,event_name,p_actor_uid,'space',delta,action_id,fp,result);
  perform public.attendance_enqueue_outbox(p_conversation_id,'attendance.conversation',p_conversation_id,'attendance.conversation.changed',jsonb_build_object('conversation_id',p_conversation_id,'version',conv.version));
  return result;
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
      'version', c.version,
      'message_sequence', c.message_sequence,
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
  v_unread integer;
  v_message_count integer;
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

  select count(*)::integer into v_unread
  from public.messages mi
  where mi.conversation_id = p_conversation_id
    and mi.direction = 'inbound'
    and mi.sequence > coalesce((select cr.last_read_sequence from public.conversation_reads cr where cr.conversation_id = p_conversation_id and cr.user_uid = p_actor_uid), 0);

  select count(*)::integer into v_message_count
  from public.messages m
  where m.conversation_id = p_conversation_id;

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
      'version', v_conv.version,
      'message_sequence', v_conv.message_sequence,
      'assigned_user_uid', v_conv.assigned_user_uid,
      'last_message_at', v_conv.last_message_at,
      'last_inbound_at', v_conv.last_inbound_at,
      'created_at', v_conv.created_at,
      'updated_at', v_conv.updated_at,
      'resolved_at', v_conv.resolved_at,
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
    'stats', jsonb_build_object('message_count', v_message_count, 'unread_count', v_unread),
    'composer', jsonb_build_object('enabled', false, 'reason', 'Envio será habilitado após concluir a conexão com a Meta.')
  );
end $$;

revoke all on function public.attendance_ensure_admin_member(text, text, uuid) from public, anon, authenticated;
revoke all on function public.attendance_evolution_instance_for_connection(uuid) from public, anon, authenticated;
revoke all on function public.attendance_set_message_transport(uuid, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.attendance_inbox_list(text, text, jsonb) from public, anon, authenticated;
revoke all on function public.attendance_inbox_detail(text, text, uuid, bigint, integer) from public, anon, authenticated;
grant execute on function public.attendance_ensure_admin_member(text, text, uuid) to service_role;
grant execute on function public.attendance_evolution_instance_for_connection(uuid) to service_role;
grant execute on function public.attendance_set_message_transport(uuid, text, text, jsonb) to service_role;
grant execute on function public.attendance_inbox_list(text, text, jsonb) to service_role;
grant execute on function public.attendance_inbox_detail(text, text, uuid, bigint, integer) to service_role;

notify pgrst, 'reload schema';
commit;
