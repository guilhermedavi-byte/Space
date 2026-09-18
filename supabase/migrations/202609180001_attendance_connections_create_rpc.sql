begin;
create or replace function public.attendance_create_pending_connection(p_name text,p_team_id uuid)
returns table(connection_id uuid,provider text,external_account_id text,external_account_type text,display_name text,status text,metadata jsonb,created_at timestamptz,updated_at timestamptz)
language plpgsql security definer set search_path=public as $$
declare v_name text:=btrim(coalesce(p_name,''));
begin
  if length(v_name) < 1 or length(v_name) > 100 then
    raise exception using errcode='22023',message='attendance_invalid_name';
  end if;
  if not exists(select 1 from public.teams where team_id=p_team_id and active) then
    raise exception using errcode='42501',message='attendance_team_forbidden';
  end if;
  return query
  insert into public.connections(provider,external_account_type,external_account_id,display_name,status,metadata)
  values('meta_whatsapp','waba','pending:'||gen_random_uuid()::text,v_name,'pending',jsonb_build_object('setup_pending',true,'default_team_id',p_team_id))
  returning connections.connection_id,connections.provider,connections.external_account_id,connections.external_account_type,connections.display_name,connections.status,connections.metadata,connections.created_at,connections.updated_at;
end $$;
revoke all on function public.attendance_create_pending_connection(text,uuid) from public,anon,authenticated,service_role;
grant execute on function public.attendance_create_pending_connection(text,uuid) to service_role;
notify pgrst,'reload schema';
commit;
