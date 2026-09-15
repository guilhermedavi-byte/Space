-- Metadata only. The runner MUST verify the staging target before opening a connection.
begin read only;
set local statement_timeout = '10s';
select jsonb_build_object(
 'server_version',current_setting('server_version'),
 'database',current_database(),
 'schemas',(select jsonb_agg(jsonb_build_object('name',nspname,'owner',pg_get_userbyid(nspowner),'acl',nspacl) order by nspname)
   from pg_namespace where nspname='public'),
 'roles',(select jsonb_agg(jsonb_build_object('name',rolname,'super',rolsuper,'inherit',rolinherit,'bypassrls',rolbypassrls) order by rolname)
   from pg_roles where rolname in ('anon','authenticated','service_role','postgres','authenticator')),
 'role_memberships',(select jsonb_agg(jsonb_build_object('role',r.rolname,'member',m.rolname,'admin',am.admin_option) order by r.rolname,m.rolname)
   from pg_auth_members am join pg_roles r on r.oid=am.roleid join pg_roles m on m.oid=am.member),
 'extensions',(select jsonb_agg(jsonb_build_object('name',extname,'version',extversion) order by extname) from pg_extension),
 'relations',(select jsonb_agg(jsonb_build_object('name',c.relname,'kind',c.relkind,'owner',pg_get_userbyid(c.relowner),
   'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity,'acl',c.relacl) order by c.relname)
   from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p','v','m','S')),
 'columns',(select jsonb_agg(jsonb_build_object('table',c.relname,'column',a.attname,'type',format_type(a.atttypid,a.atttypmod),
   'not_null',a.attnotnull,'default_hash',md5(pg_get_expr(d.adbin,d.adrelid))) order by c.relname,a.attnum)
   from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace
   left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
   where n.nspname='public' and c.relkind in ('r','p') and a.attnum>0 and not a.attisdropped),
 'constraints',(select jsonb_agg(jsonb_build_object('table',c.relname,'name',k.conname,'definition',pg_get_constraintdef(k.oid),
   'validated',k.convalidated) order by c.relname,k.conname)
   from pg_constraint k join pg_class c on c.oid=k.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public'),
 'indexes',(select jsonb_agg(jsonb_build_object('table',t.relname,'name',i.relname,'definition',pg_get_indexdef(i.oid),
   'valid',x.indisvalid) order by t.relname,i.relname)
   from pg_index x join pg_class i on i.oid=x.indexrelid join pg_class t on t.oid=x.indrelid
   join pg_namespace n on n.oid=t.relnamespace where n.nspname='public'),
 'functions',(select jsonb_agg(jsonb_build_object('name',p.proname,'signature',pg_get_function_identity_arguments(p.oid),
   'result',pg_get_function_result(p.oid),'owner',pg_get_userbyid(p.proowner),'definer',p.prosecdef,'config',p.proconfig,
   'acl',p.proacl,'body_hash',md5(p.prosrc)) order by p.proname,pg_get_function_identity_arguments(p.oid))
   from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'),
 'triggers',(select jsonb_agg(jsonb_build_object('table',c.relname,'name',t.tgname,'enabled',t.tgenabled,
   'definition_hash',md5(pg_get_triggerdef(t.oid))) order by c.relname,t.tgname)
   from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='public' and not t.tgisinternal),
 'policies',(select jsonb_agg(jsonb_build_object('table',tablename,'name',policyname,'roles',roles,'command',cmd,
   'qual_hash',md5(qual),'check_hash',md5(with_check)) order by tablename,policyname) from pg_policies where schemaname='public'),
 'default_acl',(select jsonb_agg(jsonb_build_object('owner',pg_get_userbyid(d.defaclrole),'namespace',d.defaclnamespace,
   'type',d.defaclobjtype,'acl',d.defaclacl) order by d.defaclrole,d.defaclnamespace,d.defaclobjtype) from pg_default_acl d),
 'publications',(select jsonb_agg(jsonb_build_object('publication',pubname,'table',tablename) order by pubname,tablename)
   from pg_publication_tables where schemaname='public')
);
rollback;
