-- Read-only catalog evidence. Contains definitions hashes and privileges, no payloads or credentials.
begin read only;
select jsonb_build_object('timestamp',clock_timestamp(),'postgres',current_setting('server_version'),
 'meta_tables',(select coalesce(jsonb_agg(c.relname order by c.relname),'[]') from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in('attendance_provider_events','attendance_provider_event_items')),
 'foundation_functions',(select jsonb_object_agg(p.proname,md5(pg_get_functiondef(p.oid))) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname ~ '^attendance_' and p.proname !~ '^attendance_meta_'),
 'meta_functions',(select coalesce(jsonb_agg(jsonb_build_object('name',p.proname,'definition_md5',md5(pg_get_functiondef(p.oid)),'security_definer',p.prosecdef,'owner',pg_get_userbyid(p.proowner),'search_path',p.proconfig,'acl',p.proacl::text) order by p.proname),'[]') from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname ~ '^attendance_meta_'),
 'configured_meta_connections',(select count(*) from public.connections where provider='meta_whatsapp' and external_account_type='waba' and status='active'),
 'configured_meta_channels',(select count(*) from public.channels ch join public.connections c using(connection_id) where c.provider='meta_whatsapp' and c.status='active' and ch.status='active'),
 'public_tables',(select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r'),
 'rls',(select coalesce(jsonb_object_agg(c.relname,c.relrowsecurity),'{}') from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in('attendance_provider_events','attendance_provider_event_items'))
) as meta_inventory;
rollback;
