create or replace function public.attendance_complete_meta_embedded_signup(
  p_connection_id uuid,
  p_waba_id text,
  p_phone_number_id text,
  p_display_phone text default null,
  p_verified_name text default null,
  p_actor_uid text default null,
  p_role text default null
)
returns jsonb
language plpgsql security definer set search_path=public as $$
declare
  v_connection public.connections%rowtype;
  v_team_id uuid;
  v_channel_id uuid;
  v_display text := nullif(btrim(coalesce(p_display_phone, p_verified_name, p_phone_number_id)), '');
  v_is_admin boolean := lower(coalesce(p_role, '')) = 'admin';
begin
  if p_waba_id is null or btrim(p_waba_id) = '' or length(p_waba_id) > 128 then
    raise exception using errcode='22023', message='attendance_invalid_waba';
  end if;
  if p_phone_number_id is null or btrim(p_phone_number_id) = '' or length(p_phone_number_id) > 128 then
    raise exception using errcode='22023', message='attendance_invalid_phone_number';
  end if;

  select * into v_connection
  from public.connections
  where connection_id = p_connection_id
    and provider = 'meta_whatsapp'
  for update;

  if not found then
    raise exception using errcode='42501', message='attendance_connection_forbidden';
  end if;

  if coalesce(v_connection.metadata->>'setup_pending', 'false') <> 'true' and v_connection.status <> 'pending' then
    raise exception using errcode='22023', message='attendance_connection_not_pending';
  end if;

  select ch.default_team_id into v_team_id
  from public.channels ch
  where ch.connection_id = p_connection_id
  order by ch.created_at asc
  limit 1;

  v_team_id := coalesce(v_team_id, nullif(v_connection.metadata->>'default_team_id', '')::uuid);

  if v_team_id is null or not exists(select 1 from public.teams t where t.team_id = v_team_id and t.active is true) then
    raise exception using errcode='42501', message='attendance_team_forbidden';
  end if;

  if not v_is_admin then
    if p_actor_uid is null or btrim(p_actor_uid) = '' then
      raise exception using errcode='42501', message='attendance_actor_forbidden';
    end if;
    if not exists(select 1 from public.attendance_members am where am.user_uid = p_actor_uid and am.enabled is true) then
      raise exception using errcode='42501', message='attendance_actor_forbidden';
    end if;
    if not exists(select 1 from public.team_members tm where tm.user_uid = p_actor_uid and tm.team_id = v_team_id and tm.active is true and tm.member_role = 'supervisor') then
      raise exception using errcode='42501', message='attendance_team_forbidden';
    end if;
  end if;

  update public.connections
  set external_account_type = 'waba',
      external_account_id = btrim(p_waba_id),
      status = 'active',
      metadata = (coalesce(metadata, '{}'::jsonb) - 'setup_pending' - 'disabled_previous_status') || jsonb_build_object(
        'phone_number_id', btrim(p_phone_number_id),
        'display_phone_number', v_display,
        'verified_name', nullif(btrim(coalesce(p_verified_name, '')), ''),
        'default_team_id', v_team_id,
        'embedded_signup_config_id', '3735710229912086',
        'coexistence', 'preserved',
        'meta_connected_at', now()
      ),
      updated_at = now()
  where connection_id = p_connection_id;

  insert into public.channels(connection_id, external_channel_id, display_name, status, default_team_id, metadata)
  values(p_connection_id, btrim(p_phone_number_id), coalesce(v_display, 'WhatsApp'), 'active', v_team_id, jsonb_build_object('provider', 'meta_whatsapp'))
  on conflict (connection_id, external_channel_id) do update
    set display_name = excluded.display_name,
        status = 'active',
        default_team_id = excluded.default_team_id,
        updated_at = now()
  returning channel_id into v_channel_id;

  insert into public.channel_teams(channel_id, team_id)
  values(v_channel_id, v_team_id)
  on conflict do nothing;

  return jsonb_build_object(
    'connection_id', p_connection_id,
    'channel_id', v_channel_id,
    'waba_id', btrim(p_waba_id),
    'phone_number_id', btrim(p_phone_number_id),
    'display_phone_number', v_display,
    'team_id', v_team_id
  );
end $$;

revoke all on function public.attendance_complete_meta_embedded_signup(uuid,text,text,text,text,text) from public,anon,authenticated,service_role;
revoke all on function public.attendance_complete_meta_embedded_signup(uuid,text,text,text,text,text,text) from public,anon,authenticated,service_role;
grant execute on function public.attendance_complete_meta_embedded_signup(uuid,text,text,text,text,text,text) to service_role;
notify pgrst,'reload schema';
