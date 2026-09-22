begin;
-- Reuses the Attendance foundation; no new domain tables or credentials in metadata.
create or replace function public.attendance_evolution_connection(
  p_actor_uid text, p_admin boolean, p_action text, p_id uuid, p_input jsonb default '{}'::jsonb
) returns public.connections
language plpgsql security definer set search_path=public as $$
declare
  c public.connections;
  v_team uuid;
  v_channel uuid;
  v_state text;
  v_metadata jsonb;
  v_manage boolean := p_action <> 'sync';
begin
  if coalesce(p_actor_uid,'') = '' or p_admin is null then
    raise exception using errcode='42501',message='attendance_forbidden';
  end if;
  -- Serialize reservations even before the row exists.
  perform pg_advisory_xact_lock(hashtextextended(p_id::text,0));
  select * into c from public.connections where connection_id=p_id for update;
  if p_action='adopt' then
    if not p_admin or coalesce(p_input->>'instance_name','') !~ '^[a-zA-Z0-9_-]{1,100}$' then
      raise exception using errcode='42501',message='attendance_forbidden';
    end if;
    select * into c from public.connections where provider='evolution_whatsapp' and external_account_type='instance'
      and external_account_id=p_input->>'instance_name' for update;
    if c.connection_id is not null then return c; end if;
  end if;
  if p_action in ('reserve','adopt') and c.connection_id is null then
    v_team := (p_input->>'team_id')::uuid;
    if length(btrim(coalesce(p_input->>'name',''))) not between 1 and 100
      or not exists(select 1 from public.teams where team_id=v_team and active) then
      raise exception using errcode='22023',message='attendance_invalid_request';
    end if;
    if not p_admin and not exists (
      select 1 from public.team_members m join public.attendance_members a using(user_uid)
      where m.user_uid=p_actor_uid and m.team_id=v_team and m.active and a.enabled and m.member_role='supervisor'
    ) then raise exception using errcode='42501',message='attendance_forbidden'; end if;
    insert into public.connections(connection_id,provider,external_account_type,external_account_id,display_name,status,metadata)
      values(p_id,'evolution_whatsapp','instance',case when p_action='adopt' then p_input->>'instance_name' else 'space-'||p_id end,btrim(p_input->>'name'),'pending',
        jsonb_build_object('setup_pending',true,'space_created',p_action='reserve','default_team_id',v_team,'connection_state','pending','qr_available',false)) returning * into c;
    v_channel := gen_random_uuid();
    insert into public.channels(channel_id,connection_id,external_channel_id,display_name,status,default_team_id)
      values(v_channel,p_id,c.external_account_id,c.display_name,'pending',v_team);
    insert into public.channel_teams(channel_id,team_id) values(v_channel,v_team);
  end if;
  if c.connection_id is null or c.provider <> 'evolution_whatsapp' or c.metadata ? 'validation_run_id' then
    raise exception using errcode='42501',message='attendance_forbidden';
  end if;
  -- Recheck scope within the transaction, including every affected channel for management.
  if not p_admin then
    if not exists(select 1 from public.attendance_members where user_uid=p_actor_uid and enabled)
      or not exists(select 1 from public.channels ch join public.channel_teams g using(channel_id)
        join public.team_members m on m.team_id=g.team_id join public.teams t on t.team_id=m.team_id
        where ch.connection_id=p_id and m.user_uid=p_actor_uid and m.active and t.active
          and (not v_manage or m.member_role='supervisor'))
      or (v_manage and exists(select 1 from public.channels ch where ch.connection_id=p_id and not exists(
        select 1 from public.channel_teams g join public.team_members m using(team_id) join public.teams t using(team_id)
        where g.channel_id=ch.channel_id and m.user_uid=p_actor_uid and m.active and t.active and m.member_role='supervisor'
      ))) then raise exception using errcode='42501',message='attendance_forbidden'; end if;
  end if;
  if p_action in ('reserve','adopt') then return c; end if;
  v_metadata := c.metadata;
  if p_action='acquire' then
    if coalesce((v_metadata->>'busy_until')::timestamptz,'epoch') > now() then
      raise exception using errcode='55P03',message='attendance_connection_busy';
    end if;
    v_metadata := v_metadata || jsonb_build_object('operation_id',p_input->>'lease','busy_until',now()+interval '90 seconds');
  elsif p_action in ('release','finish') then
    if v_metadata->>'operation_id' is distinct from p_input->>'lease' then
      raise exception using errcode='55P03',message='attendance_connection_busy';
    end if;
    v_metadata := v_metadata - 'operation_id' - 'busy_until';
    if p_action='release' and coalesce((p_input->>'failed')::boolean,false) and c.status='pending' then
      v_metadata := v_metadata || jsonb_build_object('connection_state','failed','qr_available',false);
    end if;
  elsif p_action='sync' then
    if coalesce((v_metadata->>'busy_until')::timestamptz,'epoch') > now() then return c; end if;
  elsif p_action in ('edit','disable') then
    if coalesce((v_metadata->>'busy_until')::timestamptz,'epoch') > now() then
      raise exception using errcode='55P03',message='attendance_connection_busy';
    end if;
    if p_action='disable' then
      c.status := 'disabled';
    else
      if p_input ? 'name' then
        if length(btrim(coalesce(p_input->>'name',''))) not between 1 and 100 then raise exception 'attendance_invalid_name'; end if;
        c.display_name := btrim(p_input->>'name');
      end if;
      if p_input ? 'operational_note' then
        if length(p_input->>'operational_note')>500 then raise exception 'attendance_invalid_note'; end if;
        v_metadata := v_metadata || jsonb_build_object('operational_note',p_input->>'operational_note');
      end if;
      if p_input ? 'team_id' then
        v_team := (p_input->>'team_id')::uuid;
        if not exists(select 1 from public.teams where team_id=v_team and active)
          or exists(select 1 from public.channels ch where ch.connection_id=p_id and not exists(
            select 1 from public.channel_teams g where g.channel_id=ch.channel_id and g.team_id=v_team))
          or (not p_admin and not exists(select 1 from public.team_members where team_id=v_team and user_uid=p_actor_uid and active and member_role='supervisor'))
        then raise exception using errcode='42501',message='attendance_forbidden'; end if;
        update public.channels set default_team_id=v_team,updated_at=now() where connection_id=p_id;
        v_metadata := v_metadata || jsonb_build_object('default_team_id',v_team);
      end if;
    end if;
  else raise exception 'attendance_invalid_action';
  end if;
  if p_action in ('sync','finish') then
    v_state := p_input->>'connection_state';
    if v_state not in ('pending','connecting','open','disconnected','failed') or v_state is null then raise exception 'attendance_invalid_state'; end if;
    if p_input->>'phone' is not null and p_input->>'phone' !~ '^\+[0-9]{7,16}$' then raise exception 'attendance_invalid_phone'; end if;
    v_metadata := v_metadata || jsonb_build_object('connection_state',v_state,'setup_pending',v_state<>'open',
      'qr_available',case when v_state='open' then false else coalesce((p_input->>'qr_available')::boolean,(v_metadata->>'qr_available')::boolean,false) end,
      'phone',coalesce(p_input->>'phone',v_metadata->>'phone'),'last_seen',now());
    if c.status <> 'disabled' or coalesce((p_input->>'enable')::boolean,false) then
      c.status := case when v_state='open' then 'active' else 'pending' end;
    end if;
  end if;
  update public.connections set display_name=c.display_name,status=c.status,metadata=v_metadata,updated_at=now()
    where connection_id=p_id returning * into c;
  update public.channels set status=c.status,display_name=c.display_name,updated_at=now() where connection_id=p_id;
  return c;
end $$;
revoke all on function public.attendance_evolution_connection(text,boolean,text,uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.attendance_evolution_connection(text,boolean,text,uuid,jsonb) to service_role;
notify pgrst,'reload schema';
commit;
