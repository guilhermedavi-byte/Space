begin;
do $$
declare r jsonb; old_stamp timestamptz; tid bigint; duplicate_blocked boolean:=false; conflict_blocked boolean:=false;
begin
 r:=space_growth_control_write(null,'{"professor_nome":"QA rollback","email":" QA-GC@example.test ","status":"inativo","bot_enabled":false,"audit_enabled":false,"aliases":["qa"]}',null,'fixture-admin');
 tid:=(r->>'id')::bigint;old_stamp:=(r->>'updated_at')::timestamptz;
 assert r->>'email'='qa-gc@example.test','Email normalized';
 update n8n_professores_space set observacoes='preservar',telefone='controle' where id=tid;
 r:=space_growth_control_write(tid,'{"bot_enabled":true}',old_stamp,'fixture-admin');
 assert (r->>'bot_enabled')::boolean,'Bot enabled';
 r:=space_growth_control_write(tid,'{"bot_enabled":false,"audit_enabled":true}',(r->>'updated_at')::timestamptz,'fixture-admin');
 assert not (r->>'bot_enabled')::boolean and (r->>'audit_enabled')::boolean,'Independent toggles';
 r:=space_growth_control_write(tid,'{"status":"inativo","audit_enabled":false}',(r->>'updated_at')::timestamptz,'fixture-admin');
 assert exists(select from n8n_professores_space where id=tid and observacoes='preservar' and telefone='controle'),'Other fields and record preserved';
 begin perform space_growth_control_write(null,'{"professor_nome":"Duplicate","email":"QA-GC@EXAMPLE.TEST"}',null,'fixture-admin');exception when others then if sqlerrm='duplicate_email' then duplicate_blocked:=true;else raise;end if;end;
 assert duplicate_blocked,'Duplicate blocked';
 begin perform space_growth_control_write(tid,'{"bot_enabled":true}',old_stamp-interval '1 second','fixture-admin');exception when others then if sqlerrm='edit_conflict' then conflict_blocked:=true;else raise;end if;end;
 assert conflict_blocked,'Stale edit blocked';
 assert exists(select from audit_logs where entity_type='n8n_professores_space' and payload->>'teacherId'=tid::text and action='BOT_DISABLED' and actor_uid='fixture-admin'),'Canonical audit persisted';
 assert not has_function_privilege('anon','public.space_growth_control_write(bigint,jsonb,timestamptz,text)','execute'),'Anon denied';
 assert not has_function_privilege('authenticated','public.space_growth_control_write(bigint,jsonb,timestamptz,text)','execute'),'Authenticated denied';
end $$;
select '9 SQL assertions PASS, rollback' as result;
rollback;
