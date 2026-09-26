-- Atomic administration of the existing source of truth; no replacement table.
create or replace function public.space_growth_control_write(p_id bigint,p_patch jsonb,p_expected_updated_at timestamptz,p_actor_uid text)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare old_row n8n_professores_space; new_row n8n_professores_space; target_email text; before_value jsonb; after_value jsonb; actions text[]:='{}'; event text;
begin
 if nullif(p_actor_uid,'') is null or jsonb_typeof(p_patch)<>'object' or p_patch='{}'::jsonb or exists(select from jsonb_object_keys(p_patch) k where k not in ('professor_nome','email','status','bot_enabled','audit_enabled','aliases')) then raise exception 'invalid_fields'; end if;
 if p_patch?'status' and p_patch->>'status' not in ('ativo','inativo') then raise exception 'invalid_fields'; end if;
 perform pg_advisory_xact_lock(591253120);
 if p_id is not null then
  select * into old_row from n8n_professores_space where id=p_id for update;
  if old_row.id is null then raise exception 'teacher_not_found'; end if;
  if old_row.updated_at is distinct from p_expected_updated_at then raise exception 'edit_conflict'; end if;
 end if;
 target_email:=case when p_patch?'email' then lower(trim(p_patch->>'email')) else lower(trim(old_row.email)) end;
 if p_id is null and (nullif(trim(p_patch->>'professor_nome'),'') is null or nullif(target_email,'') is null) then raise exception 'required_fields'; end if;
 if nullif(target_email,'') is not null and exists(select from n8n_professores_space where lower(trim(email))=target_email and (p_id is null or id<>p_id)) then raise exception 'duplicate_email'; end if;
 if p_id is null then
  insert into n8n_professores_space(professor_nome,email,status,bot_enabled,audit_enabled,aliases)
  values(trim(p_patch->>'professor_nome'),target_email,coalesce(p_patch->>'status','ativo'),coalesce((p_patch->>'bot_enabled')::boolean,false),coalesce((p_patch->>'audit_enabled')::boolean,false),array(select jsonb_array_elements_text(coalesce(p_patch->'aliases','[]')))) returning * into new_row;
  actions:=array['PROFESSOR_CREATED'];
 else
  update n8n_professores_space set
   professor_nome=case when p_patch?'professor_nome' then trim(p_patch->>'professor_nome') else professor_nome end,
   email=case when p_patch?'email' then target_email else email end,
   status=case when p_patch?'status' then p_patch->>'status' else status end,
   bot_enabled=case when p_patch?'bot_enabled' then (p_patch->>'bot_enabled')::boolean else bot_enabled end,
   audit_enabled=case when p_patch?'audit_enabled' then (p_patch->>'audit_enabled')::boolean else audit_enabled end,
   aliases=case when p_patch?'aliases' then array(select jsonb_array_elements_text(p_patch->'aliases')) else aliases end,
   updated_at=clock_timestamp() where id=p_id returning * into new_row;
  actions:=array['PROFESSOR_UPDATED'];
  if old_row.status is distinct from new_row.status and new_row.status='inativo' then actions:=actions||'PROFESSOR_DISABLED'::text; end if;
  if old_row.bot_enabled is distinct from new_row.bot_enabled then actions:=actions||(case when new_row.bot_enabled then 'BOT_ENABLED' else 'BOT_DISABLED' end);end if;
  if old_row.audit_enabled is distinct from new_row.audit_enabled then actions:=actions||(case when new_row.audit_enabled then 'AUDIT_ENABLED' else 'AUDIT_DISABLED' end);end if;
 end if;
 select jsonb_object_agg(key,value) into before_value from jsonb_each(to_jsonb(old_row)) where key in ('id','professor_nome','email','status','bot_enabled','audit_enabled','aliases','created_at','updated_at');
 select jsonb_object_agg(key,value) into after_value from jsonb_each(to_jsonb(new_row)) where key in ('id','professor_nome','email','status','bot_enabled','audit_enabled','aliases','created_at','updated_at');
 foreach event in array actions loop
  insert into audit_logs(entity_type,action,actor_uid,actor_role,payload) values('n8n_professores_space',event,p_actor_uid,'admin',jsonb_build_object('teacherId',new_row.id,'before',before_value,'after',after_value));
 end loop;
 return after_value;
end $$;
revoke all on function public.space_growth_control_write(bigint,jsonb,timestamptz,text) from public,anon,authenticated;
grant execute on function public.space_growth_control_write(bigint,jsonb,timestamptz,text) to service_role;
