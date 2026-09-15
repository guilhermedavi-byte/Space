-- Additive financial projection. No legacy writes, data deletion or automatic remote execution.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- Shared connection contract; compatible with the independently developed Attendance migration.
create table if not exists public.connections (
  connection_id uuid primary key default gen_random_uuid(), provider text not null,
  external_account_id text not null, external_account_type text not null default 'account',
  display_name text not null, status text not null default 'pending' check(status in ('pending','active','disabled')),
  metadata jsonb not null default '{}', created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(), unique(provider,external_account_type,external_account_id)
);
create table if not exists public.finance_connection_state (
  connection_id uuid primary key references public.connections(connection_id),
  environment text not null check(environment in ('sandbox','production')),
  last_successful_api_call timestamptz, last_health_check timestamptz,
  connection_health jsonb not null default '{}', last_reconciliation timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.finance_webhook_events (
  id uuid primary key default gen_random_uuid(), connection_id uuid not null references public.finance_connection_state,
  provider text not null default 'asaas' check(provider='asaas'), provider_event_id text,
  dedupe_key text not null, event_type text not null, resource text not null,
  external_object_id text, payload jsonb not null, payload_hash text not null check(payload_hash ~ '^[a-f0-9]{64}$'),
  provider_created_at text, received_at timestamptz not null default now(), processed_at timestamptz,
  processing_status text not null default 'pending' check(processing_status in ('pending','processing','processed','failed','ignored')),
  attempt_count integer not null default 0 check(attempt_count between 0 and 5),
  retryable boolean not null default true, available_at timestamptz not null default now(),
  lease_token uuid, lease_until timestamptz, last_error text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(connection_id,dedupe_key)
);
create unique index if not exists finance_webhook_provider_event_uidx
  on public.finance_webhook_events(connection_id,provider_event_id) where provider_event_id is not null;
create index if not exists finance_webhook_pending_idx on public.finance_webhook_events(connection_id,processing_status,available_at);
create table if not exists public.finance_object_leases (
  connection_id uuid not null references public.finance_connection_state,
  resource text not null check(resource in ('payments','customers','subscriptions')),
  external_object_id text not null, token uuid not null, expires_at timestamptz not null,
  primary key(connection_id,resource,external_object_id)
);
create table if not exists public.finance_provider_objects (
  id uuid primary key default gen_random_uuid(), connection_id uuid not null references public.finance_connection_state,
  resource text not null check(resource in ('customers','subscriptions')), external_object_id text not null,
  snapshot jsonb not null, last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(connection_id,resource,external_object_id)
);
create table if not exists public.finance_customer_student_links (
  connection_id uuid not null references public.finance_connection_state,
  asaas_customer_id text not null, firestore_doc_id text not null check(length(firestore_doc_id) between 1 and 128),
  verified_by text not null, verified_at timestamptz not null default now(),
  primary key(connection_id,asaas_customer_id,firestore_doc_id)
);
create table if not exists public.finance_receivables (
  id uuid primary key default gen_random_uuid(), connection_id uuid not null references public.finance_connection_state,
  asaas_payment_id text not null, asaas_customer_id text, asaas_subscription_id text,
  status text not null, provider_status text not null, value numeric(18,2), due_date date,
  billing_type text, deleted boolean not null default false,
  snapshot jsonb not null, last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(connection_id,asaas_payment_id), unique(id,connection_id,asaas_payment_id), check(value is null or value>=0)
);
create index if not exists finance_receivables_customer_idx on public.finance_receivables(connection_id,asaas_customer_id);
create index if not exists finance_receivables_due_idx on public.finance_receivables(connection_id,status,due_date);
-- One settlement projection for one Asaas payment, NOT one revenue row per webhook.
create table if not exists public.finance_payments (
  id uuid primary key default gen_random_uuid(), receivable_id uuid not null unique,
  connection_id uuid not null, asaas_payment_id text not null, status text not null,
  value numeric(18,2), payment_date date, confirmed_date date, billing_type text,
  refund_value numeric(18,2), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(connection_id,asaas_payment_id),
  foreign key(receivable_id,connection_id,asaas_payment_id) references public.finance_receivables(id,connection_id,asaas_payment_id)
);
create table if not exists public.finance_audit_events (
  id uuid primary key default gen_random_uuid(), connection_id uuid not null references public.finance_connection_state,
  source text not null check(source in ('ASAAS_WEBHOOK','ASAAS_BACKFILL','ASAAS_RECONCILIATION','ASAAS_REPAIR','SYSTEM','ADMIN_USER')),
  actor text not null, object_type text not null, external_object_id text,
  action text not null, state_before jsonb, state_after jsonb, correlation_id text,
  created_at timestamptz not null default now()
);
create index if not exists finance_audit_object_idx on public.finance_audit_events(connection_id,object_type,external_object_id,created_at);
create table if not exists public.finance_sync_runs (
  id uuid primary key default gen_random_uuid(), connection_id uuid not null references public.finance_connection_state,
  source text not null, resource text not null, dry_run boolean not null, filters jsonb not null default '{}',
  status text not null default 'running' check(status in ('running','completed','failed')),
  next_offset integer not null default 0, report jsonb not null default '{}', last_error text,
  started_at timestamptz not null default now(), finished_at timestamptz
);
create or replace function public.finance_audit_immutable() returns trigger
language plpgsql set search_path=pg_catalog,public as $$ begin raise exception 'finance_audit_immutable'; end $$;
do $$ begin
  if not exists(select 1 from pg_trigger where tgrelid='public.finance_audit_events'::regclass and tgname='finance_audit_immutable') then
    create trigger finance_audit_immutable before update or delete on public.finance_audit_events
      for each row execute function public.finance_audit_immutable();
  end if;
end $$;

-- Single privileged boundary: all projection+settlement+audit+inbox changes commit together.
create or replace function public.finance_rpc(p_action text, p_args jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare
  c uuid := nullif(p_args->>'connection_id','')::uuid;
  e public.finance_webhook_events%rowtype; r public.finance_receivables%rowtype;
  l public.finance_object_leases%rowtype; cs record; obj jsonb; previous jsonb; after_state jsonb;
  result jsonb; eid uuid; tok uuid; rid uuid; changed boolean; attempt integer;
  ext text := p_args->>'external_object_id'; resource_name text := p_args->>'resource';
  source_name text := coalesce(p_args->>'source','SYSTEM'); actor_name text := coalesce(p_args->>'actor','system');
begin
  if p_action='configure' then
    if p_args->>'environment' not in ('sandbox','production') or p_args->>'account_reference' !~ '^[0-9:-]{3,80}$' then
      raise exception 'finance_config_invalid';
    end if;
    insert into public.connections(provider,external_account_type,external_account_id,display_name,status)
      values('asaas','asaas:'||(p_args->>'environment'),p_args->>'account_reference','Asaas','active')
      on conflict(provider,external_account_type,external_account_id) do update set updated_at=now()
      returning connection_id into c;
    insert into public.finance_connection_state(connection_id,environment) values(c,p_args->>'environment') on conflict do nothing;
    insert into public.finance_audit_events(connection_id,source,actor,object_type,action,state_after)
      values(c,'ADMIN_USER',actor_name,'connection','configured',jsonb_build_object('environment',p_args->>'environment'));
    return jsonb_build_object('connection_id',c);
  end if;
  select con.*, f.environment into cs from public.connections con join public.finance_connection_state f using(connection_id)
    where con.connection_id=c and con.provider='asaas';
  if not found or cs.status<>'active' then raise exception 'finance_connection_inactive'; end if;
  if p_args ? 'environment' and p_args->>'environment'<>cs.environment then raise exception 'finance_environment_mismatch'; end if;

  if p_action='health' then
    if p_args ? 'health' then
      obj:=p_args->'health';
      if (obj->>'account_reference' is distinct from cs.external_account_id or obj->>'environment' is distinct from cs.environment) and obj->'error'='null'::jsonb then
        raise exception 'finance_account_mismatch';
      end if;
      update public.finance_connection_state set last_health_check=now(), connection_health=obj-'account_reference',
        last_successful_api_call=case when obj->'error'='null'::jsonb then now() else last_successful_api_call end, updated_at=now() where connection_id=c;
    end if;
    return (select to_jsonb(s)||jsonb_build_object(
      'last_webhook_received',(select max(received_at) from public.finance_webhook_events where connection_id=c),
      'last_webhook_processed',(select max(processed_at) from public.finance_webhook_events where connection_id=c and processing_status='processed'),
      'pending_events',(select count(*) from public.finance_webhook_events where connection_id=c and processing_status in ('pending','processing')),
      'failed_events',(select count(*) from public.finance_webhook_events where connection_id=c and processing_status='failed')
    ) from public.finance_connection_state s where connection_id=c);
  elsif p_action='connection' then
    return jsonb_build_object('connection_id',c,'environment',cs.environment,'account_reference',cs.external_account_id);
  elsif p_action='ingest' then
    -- Advisory lock covers the absent-row race; conflict retains the original envelope.
    perform pg_advisory_xact_lock(hashtextextended(c::text||':event:'||(p_args->>'dedupe_key'),0));
    select * into e from public.finance_webhook_events where connection_id=c and dedupe_key=p_args->>'dedupe_key';
    if found then
      if e.payload_hash<>p_args->>'payload_hash' then
        insert into public.finance_audit_events(connection_id,source,actor,object_type,external_object_id,action,correlation_id)
          values(c,'ASAAS_WEBHOOK','asaas','event',e.external_object_id,'idempotency_conflict',e.id::text);
        return jsonb_build_object('conflict',true,'event_id',e.id);
      end if;
      return jsonb_build_object('event_id',e.id,'duplicate',true,'processing_status',e.processing_status);
    end if;
    insert into public.finance_webhook_events(connection_id,provider_event_id,dedupe_key,event_type,resource,external_object_id,payload,payload_hash,provider_created_at)
      values(c,p_args->>'provider_event_id',p_args->>'dedupe_key',p_args->>'event_type',resource_name,ext,p_args->'payload',p_args->>'payload_hash',p_args->>'provider_created_at') returning id into eid;
    return jsonb_build_object('event_id',eid,'duplicate',false,'processing_status','pending');
  elsif p_action='event' then
    return (select to_jsonb(v) from public.finance_webhook_events v where connection_id=c and id=(p_args->>'event_id')::uuid);
  elsif p_action='pending' then
    -- A crash on the final attempt must eventually become visibly failed, not processing forever.
    with exhausted as (
      update public.finance_webhook_events set processing_status='failed',retryable=false,last_error='finance_attempts_exhausted',
        lease_token=null,lease_until=null,updated_at=now()
      where connection_id=c and processing_status='processing' and lease_until<=now() and attempt_count>=5 returning id,external_object_id
    ) insert into public.finance_audit_events(connection_id,source,actor,object_type,external_object_id,action,correlation_id)
      select c,'SYSTEM','worker','event',external_object_id,'attempts_exhausted',id::text from exhausted;
    return coalesce((select jsonb_agg(id) from (select id from public.finance_webhook_events where connection_id=c and attempt_count<5 and retryable
      and ((processing_status in ('pending','failed') and available_at<=now()) or (processing_status='processing' and lease_until<now()))
      order by received_at,id limit least(100,greatest(1,coalesce((p_args->>'limit')::integer,20)))) q),'[]'::jsonb);
  elsif p_action='ignore' then
    update public.finance_webhook_events set processing_status='ignored',processed_at=now(),last_error='unsupported_event',updated_at=now()
      where connection_id=c and id=(p_args->>'event_id')::uuid and processing_status='pending' returning id into eid;
    if eid is not null then
      insert into public.finance_audit_events(connection_id,source,actor,object_type,action,correlation_id)
        values(c,'ASAAS_WEBHOOK','asaas','event','unsupported_event',eid::text);
    end if;
    return jsonb_build_object('ignored',eid is not null);
  elsif p_action='acquire' then
    if resource_name not in ('payments','customers','subscriptions') or ext is null or length(ext)>256 then raise exception 'finance_object_invalid'; end if;
    perform pg_advisory_xact_lock(hashtextextended(c::text||':'||resource_name||':'||ext,0));
    if p_args ? 'event_id' then
      select * into e from public.finance_webhook_events where id=(p_args->>'event_id')::uuid and connection_id=c for update;
      if not found then raise exception 'finance_event_not_found'; end if;
      if e.external_object_id<>ext or e.resource<>resource_name then raise exception 'finance_event_object_mismatch'; end if;
      if e.processing_status in ('processed','ignored') then return jsonb_build_object('done',true); end if;
      if e.attempt_count>=5 or not e.retryable then return jsonb_build_object('exhausted',true); end if;
      if e.available_at>now() or (e.processing_status='processing' and e.lease_until>now()) then return jsonb_build_object('busy',true); end if;
    end if;
    select * into l from public.finance_object_leases where connection_id=c and resource=resource_name and external_object_id=ext for update;
    if found and l.expires_at>now() then return jsonb_build_object('busy',true); end if;
    tok:=gen_random_uuid();
    insert into public.finance_object_leases values(c,resource_name,ext,tok,now()+interval '60 seconds')
      on conflict(connection_id,resource,external_object_id) do update set token=excluded.token,expires_at=excluded.expires_at;
    if e.id is not null then
      update public.finance_webhook_events set processing_status='processing',attempt_count=attempt_count+1,
        lease_token=tok,lease_until=now()+interval '60 seconds',updated_at=now() where id=e.id returning attempt_count into attempt;
      if attempt>1 then insert into public.finance_audit_events(connection_id,source,actor,object_type,external_object_id,action,correlation_id)
        values(c,'SYSTEM',actor_name,'event',ext,'retry_started',e.id::text); end if;
    end if;
    return jsonb_build_object('token',tok,'attempt_count',attempt);
  elsif p_action in ('commit','release') then
    select * into l from public.finance_object_leases where connection_id=c and resource=resource_name and external_object_id=ext for update;
    if not found or l.token<>(p_args->>'token')::uuid or l.expires_at<=now() then raise exception 'finance_lease_lost'; end if;
    if p_args ? 'event_id' then
      select * into e from public.finance_webhook_events where connection_id=c and id=(p_args->>'event_id')::uuid for update;
      if not found or e.lease_token<>l.token or e.processing_status<>'processing' then raise exception 'finance_lease_lost'; end if;
    end if;
    if p_action='release' then
      if e.id is not null then
        update public.finance_webhook_events set processing_status='failed',retryable=coalesce((p_args->>'retryable')::boolean,false),
          last_error=left(p_args->>'error_code',80),available_at=now()+make_interval(secs=>least(3600,30*power(2,attempt_count-1)::integer)),
          lease_until=null,lease_token=null,updated_at=now() where id=e.id;
        insert into public.finance_audit_events(connection_id,source,actor,object_type,external_object_id,action,state_after,correlation_id)
          values(c,'SYSTEM',actor_name,'event',ext,'processing_failed',jsonb_build_object('error',left(p_args->>'error_code',80)),e.id::text);
      end if;
      delete from public.finance_object_leases where connection_id=c and resource=resource_name and external_object_id=ext;
      return jsonb_build_object('released',true);
    end if;
    obj:=p_args->'snapshot';
    if obj->>'id' is distinct from ext then raise exception 'finance_snapshot_id_mismatch'; end if;
    if resource_name='payments' then
      select * into r from public.finance_receivables where connection_id=c and asaas_payment_id=ext for update;
      previous:=case when r.id is null then null else r.snapshot||jsonb_build_object('status',r.status,'provider_status',r.provider_status,
        'value',case when r.value is null then null else r.value::text end,'due_date',r.due_date,'customer',r.asaas_customer_id,
        'subscription',r.asaas_subscription_id,'billing_type',r.billing_type,'deleted',r.deleted) end;
      insert into public.finance_receivables(connection_id,asaas_payment_id,asaas_customer_id,asaas_subscription_id,status,provider_status,value,due_date,billing_type,deleted,snapshot)
        values(c,ext,obj->>'customer',obj->>'subscription',obj->>'status',obj->>'provider_status',(obj->>'value')::numeric,
          (obj->>'due_date')::date,obj->>'billing_type',(obj->>'deleted')::boolean,obj)
        on conflict(connection_id,asaas_payment_id) do update set asaas_customer_id=excluded.asaas_customer_id,
          asaas_subscription_id=excluded.asaas_subscription_id,status=excluded.status,provider_status=excluded.provider_status,value=excluded.value,
          due_date=excluded.due_date,billing_type=excluded.billing_type,deleted=excluded.deleted,snapshot=excluded.snapshot,
          last_synced_at=now(),updated_at=case when finance_receivables.snapshot is distinct from excluded.snapshot then now() else finance_receivables.updated_at end
        returning id into rid;
      if (obj->>'has_settlement')::boolean or exists(select 1 from public.finance_payments where receivable_id=rid) then
        select to_jsonb(p)-'created_at'-'updated_at'-'id' into result from public.finance_payments p where receivable_id=rid;
        insert into public.finance_payments(receivable_id,connection_id,asaas_payment_id,status,value,payment_date,confirmed_date,billing_type,refund_value)
          values(rid,c,ext,obj->>'status',(obj->>'value')::numeric,(obj->>'payment_date')::date,(obj->>'confirmed_date')::date,obj->>'billing_type',(obj->>'refund_value')::numeric)
          on conflict(receivable_id) do update set status=excluded.status,value=excluded.value,payment_date=excluded.payment_date,
            confirmed_date=excluded.confirmed_date,billing_type=excluded.billing_type,refund_value=excluded.refund_value,updated_at=now();
        select to_jsonb(p)-'created_at'-'updated_at'-'id' into after_state from public.finance_payments p where receivable_id=rid;
        if result is distinct from after_state then
          insert into public.finance_audit_events(connection_id,source,actor,object_type,external_object_id,action,state_before,state_after,correlation_id)
            values(c,source_name,actor_name,'settlement',ext,'projected',result,after_state,p_args->>'correlation_id');
        end if;
      end if;
    else
      select snapshot into previous from public.finance_provider_objects where connection_id=c and resource=resource_name and external_object_id=ext for update;
      insert into public.finance_provider_objects(connection_id,resource,external_object_id,snapshot) values(c,resource_name,ext,obj)
        on conflict(connection_id,resource,external_object_id) do update set snapshot=excluded.snapshot,last_synced_at=now(),
          updated_at=case when finance_provider_objects.snapshot is distinct from excluded.snapshot then now() else finance_provider_objects.updated_at end;
    end if;
    changed:=previous is distinct from obj;
    if changed then
      insert into public.finance_audit_events(connection_id,source,actor,object_type,external_object_id,action,state_before,state_after,correlation_id)
        values(c,source_name,actor_name,resource_name,ext,case when previous is null then 'created' else 'updated' end,
          previous-'name'-'email'-'invoice_url'-'bank_slip_url',obj-'name'-'email'-'invoice_url'-'bank_slip_url',p_args->>'correlation_id');
    end if;
    if e.id is not null then
      update public.finance_webhook_events set processing_status='processed',processed_at=now(),last_error=null,
        lease_token=null,lease_until=null,updated_at=now() where id=e.id;
    end if;
    update public.finance_connection_state set last_successful_api_call=now(),updated_at=now() where connection_id=c;
    delete from public.finance_object_leases where connection_id=c and resource=resource_name and external_object_id=ext;
    return jsonb_build_object('changed',changed,'external_object_id',ext,'receivable_id',rid,'processed',true);
  elsif p_action='get' then
    if resource_name='payments' then
      select * into r from public.finance_receivables where connection_id=c and asaas_payment_id=ext;
      if not found then return null; end if;
      return to_jsonb(r)||jsonb_build_object('student_refs',coalesce((select jsonb_agg(firestore_doc_id order by firestore_doc_id)
        from public.finance_customer_student_links where connection_id=c and asaas_customer_id=r.asaas_customer_id),'[]'::jsonb));
    end if;
    return (select to_jsonb(o) from public.finance_provider_objects o where connection_id=c and resource=resource_name and external_object_id=ext);
  elsif p_action='identity' then
    return coalesce((select jsonb_agg(firestore_doc_id order by firestore_doc_id) from public.finance_customer_student_links
      where connection_id=c and asaas_customer_id=p_args->>'customer_id'),'[]'::jsonb);
  elsif p_action='link' then
    if coalesce(p_args->>'verified_by','')='' or coalesce(p_args->>'firestore_doc_id','')='' then raise exception 'finance_identity_unverified'; end if;
    insert into public.finance_customer_student_links(connection_id,asaas_customer_id,firestore_doc_id,verified_by)
      values(c,p_args->>'customer_id',p_args->>'firestore_doc_id',p_args->>'verified_by') on conflict do nothing;
    if found then insert into public.finance_audit_events(connection_id,source,actor,object_type,external_object_id,action,state_after)
      values(c,'ADMIN_USER',p_args->>'verified_by','customer_link',p_args->>'customer_id','linked',jsonb_build_object('firestore_doc_id',p_args->>'firestore_doc_id')); end if;
    return jsonb_build_object('linked',true);
  elsif p_action='run_start' then
    insert into public.finance_sync_runs(connection_id,source,resource,dry_run,filters,next_offset)
      values(c,source_name,resource_name,(p_args->>'dry_run')::boolean,coalesce(p_args->'filters','{}'),coalesce((p_args->>'offset')::integer,0)) returning id into rid;
    return jsonb_build_object('run_id',rid);
  elsif p_action='run_update' then
    update public.finance_sync_runs set next_offset=coalesce((p_args->>'next_offset')::integer,next_offset),report=p_args->'report',
      status=coalesce(p_args->>'status','running'),last_error=p_args->>'error_code',
      finished_at=case when p_args->>'status' in ('completed','failed') then now() else null end
      where connection_id=c and id=(p_args->>'run_id')::uuid returning id into rid;
    if rid is null then raise exception 'finance_run_not_found'; end if;
    update public.finance_connection_state set last_reconciliation=now() where connection_id=c and p_args->>'status'='completed'
      and exists(select 1 from public.finance_sync_runs where id=rid and source='ASAAS_RECONCILIATION' and not dry_run);
    return jsonb_build_object('updated',true);
  end if;
  raise exception 'finance_action_invalid';
end $$;

-- No browser/table mutation path: only the service-role RPC may change the projection.
do $$ declare t text; role_name text; begin
  foreach t in array array['finance_connection_state','finance_webhook_events','finance_object_leases','finance_provider_objects',
    'finance_customer_student_links','finance_receivables','finance_payments','finance_audit_events','finance_sync_runs'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from public',t);
    foreach role_name in array array['anon','authenticated','service_role'] loop
      if exists(select 1 from pg_roles where rolname=role_name) then execute format('revoke all on public.%I from %I',t,role_name); end if;
    end loop;
    if exists(select 1 from pg_roles where rolname='service_role') then execute format('grant select on public.%I to service_role',t); end if;
  end loop;
end $$;
revoke all on function public.finance_rpc(text,jsonb) from public;
revoke all on function public.finance_audit_immutable() from public;
do $$ declare r text; begin
  foreach r in array array['anon','authenticated'] loop
    if exists(select 1 from pg_roles where rolname=r) then execute format('revoke all on function public.finance_rpc(text,jsonb) from %I',r); end if;
  end loop;
  if exists(select 1 from pg_roles where rolname='service_role') then grant execute on function public.finance_rpc(text,jsonb) to service_role; end if;
end $$;
commit;
