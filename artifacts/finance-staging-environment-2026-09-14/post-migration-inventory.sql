-- Read-only schema/privilege inventory; execute ONLY in the independently proven staging project.
begin read only;
with tables as (
  select c.oid,c.relname,c.relrowsecurity from pg_class c
  join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r'
), funcs as (
  select p.* from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'
)
select 'table.'||relname as item, jsonb_build_object(
  'rls',relrowsecurity,
  'columns',(select count(*) from pg_attribute where attrelid=t.oid and attnum>0 and not attisdropped),
  'constraints',(select count(*) from pg_constraint where conrelid=t.oid),
  'indexes',(select count(*) from pg_index where indrelid=t.oid),
  'anon_select',has_table_privilege('anon',t.oid,'SELECT'),
  'authenticated_select',has_table_privilege('authenticated',t.oid,'SELECT'),
  'service_select',has_table_privilege('service_role',t.oid,'SELECT'),
  'service_write',has_table_privilege('service_role',t.oid,'INSERT,UPDATE,DELETE'))::text as result from tables t
union all select 'function.'||proname,jsonb_build_object(
  'security_definer',prosecdef,'config',proconfig,
  'anon_execute',has_function_privilege('anon',oid,'EXECUTE'),
  'authenticated_execute',has_function_privilege('authenticated',oid,'EXECUTE'),
  'service_execute',has_function_privilege('service_role',oid,'EXECUTE'),
  'source_normalized_md5',md5(regexp_replace(regexp_replace(prosrc,E'--[^\n]*','','g'),'\s','','g')))::text from funcs
union all select 'summary',jsonb_build_object(
  'tables',(select count(*) from tables),'rls_tables',(select count(*) from tables where relrowsecurity),
  'constraints',(select count(*) from pg_constraint where connamespace='public'::regnamespace),
  'indexes',(select count(*) from pg_indexes where schemaname='public'),'functions',(select count(*) from funcs),
  'immutable_trigger',(select count(*) from pg_trigger where tgname='finance_audit_immutable' and not tgisinternal),
  'financial_connections',(select count(*) from public.finance_connection_state),
  'receivables',(select count(*) from public.finance_receivables))::text
order by item;
commit;
