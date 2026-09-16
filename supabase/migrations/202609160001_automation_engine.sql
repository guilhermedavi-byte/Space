-- Automation Engine foundation. Canonical domain_events are separated from operational outbox_events.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

create table if not exists public.automations (
  id uuid primary key default gen_random_uuid(),
  scope_id text not null default 'space-main',
  name text not null check (length(trim(name)) between 1 and 160),
  description text not null default '',
  status text not null default 'DRAFT' check (status in ('DRAFT','ACTIVE','PAUSED','ARCHIVED')),
  trigger_type text not null check (trigger_type ~ '^[a-z][a-z0-9_.-]{1,127}$'),
  active_version_id uuid,
  draft_version_id uuid,
  created_by_uid text,
  updated_by_uid text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create table if not exists public.automation_versions (
  id uuid primary key default gen_random_uuid(),
  automation_id uuid not null references public.automations(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  status text not null default 'DRAFT' check (status in ('DRAFT','ACTIVE','PAUSED','ARCHIVED')),
  graph jsonb not null check (jsonb_typeof(graph) = 'object' and octet_length(graph::text) <= 65536),
  trigger jsonb not null check (jsonb_typeof(trigger) = 'object' and octet_length(trigger::text) <= 8192),
  created_by_uid text,
  created_at timestamptz not null default now(),
  published_by_uid text,
  published_at timestamptz,
  unique (automation_id, version_number)
);

alter table public.automations
  drop constraint if exists automations_active_version_fk,
  add constraint automations_active_version_fk foreign key (active_version_id) references public.automation_versions(id) on delete set null;
alter table public.automations
  drop constraint if exists automations_draft_version_fk,
  add constraint automations_draft_version_fk foreign key (draft_version_id) references public.automation_versions(id) on delete set null;

create table if not exists public.domain_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (event_type ~ '^[a-z][a-z0-9_.-]{1,127}$'),
  schema_version integer not null default 1 check (schema_version > 0),
  scope_id text not null default 'space-main',
  source text not null check (source ~ '^[a-z][a-z0-9_-]{1,63}$'),
  source_event_id text not null,
  aggregate_type text not null,
  aggregate_id text,
  occurred_at timestamptz not null,
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object' and octet_length(payload::text) <= 65536),
  correlation_id text,
  causation_id text,
  root_event_id text not null,
  depth integer not null default 0 check (depth between 0 and 8),
  processing_status text not null default 'pending' check (processing_status in ('pending','processing','processed','retryable_failed','failed','ignored')),
  available_at timestamptz not null default now(),
  attempts integer not null default 0 check (attempts between 0 and 12),
  lease_id uuid,
  lease_until timestamptz,
  last_error text,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (source, source_event_id),
  check ((processing_status = 'processing') = (lease_id is not null and lease_until is not null))
);
create index if not exists idx_domain_events_claim on public.domain_events(processing_status, available_at, occurred_at)
  where processing_status in ('pending','retryable_failed','processing');
create index if not exists idx_domain_events_type on public.domain_events(event_type, occurred_at desc);

create table if not exists public.automation_runs (
  id uuid primary key default gen_random_uuid(),
  automation_id uuid not null references public.automations(id) on delete cascade,
  automation_version_id uuid not null references public.automation_versions(id) on delete restrict,
  event_id uuid not null references public.domain_events(id) on delete restrict,
  event_type text not null,
  status text not null default 'PENDING' check (status in ('PENDING','RUNNING','SUCCESS','FAILED','CANCELLED')),
  current_node_id text,
  retry_count integer not null default 0 check (retry_count >= 0),
  started_at timestamptz,
  finished_at timestamptz,
  duration_ms integer,
  error jsonb,
  created_at timestamptz not null default now(),
  unique (automation_id, automation_version_id, event_id)
);
create index if not exists idx_automation_runs_automation on public.automation_runs(automation_id, created_at desc);

create table if not exists public.automation_run_steps (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.automation_runs(id) on delete cascade,
  node_id text not null,
  node_type text not null,
  action_type text,
  status text not null default 'PENDING' check (status in ('PENDING','RUNNING','SUCCESS','FAILED','SKIPPED')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  input jsonb not null default '{}'::jsonb,
  output jsonb not null default '{}'::jsonb,
  error jsonb,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  unique (run_id, node_id)
);
create index if not exists idx_automation_run_steps_run on public.automation_run_steps(run_id, created_at asc);

create table if not exists public.automation_idempotency (
  key text primary key,
  automation_id uuid not null references public.automations(id) on delete cascade,
  automation_version_id uuid not null references public.automation_versions(id) on delete restrict,
  run_id uuid references public.automation_runs(id) on delete set null,
  node_id text not null,
  action_type text not null,
  request_fingerprint text not null,
  status text not null check (status in ('STARTED','SUCCEEDED','FAILED')),
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.automation_prevent_published_version_mutation()
returns trigger language plpgsql set search_path=pg_catalog,public as $$
begin
  if old.status = 'ACTIVE' and (new.graph is distinct from old.graph or new.trigger is distinct from old.trigger or new.version_number is distinct from old.version_number) then
    raise exception using errcode='23514', message='automation_published_version_immutable';
  end if;
  return new;
end $$;
drop trigger if exists trg_automation_versions_immutable on public.automation_versions;
create trigger trg_automation_versions_immutable before update on public.automation_versions
  for each row execute function public.automation_prevent_published_version_mutation();

create or replace function public.automation_set_updated_at()
returns trigger language plpgsql set search_path=pg_catalog,public as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists trg_automations_updated_at on public.automations;
create trigger trg_automations_updated_at before update on public.automations
  for each row execute function public.automation_set_updated_at();
drop trigger if exists trg_automation_idempotency_updated_at on public.automation_idempotency;
create trigger trg_automation_idempotency_updated_at before update on public.automation_idempotency
  for each row execute function public.automation_set_updated_at();

create or replace function public.automation_import_attendance_outbox(p_limit integer default 100)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare inserted_count integer := 0;
begin
  with source_rows as (
    select id, aggregate_type, aggregate_id, event_type, payload, created_at
    from public.outbox_events
    where event_type = 'attendance.message.created'
    order by created_at asc
    limit greatest(1, least(coalesce(p_limit, 100), 1000))
  ), inserted as (
    insert into public.domain_events (
      event_type, schema_version, scope_id, source, source_event_id, aggregate_type, aggregate_id,
      occurred_at, payload, correlation_id, causation_id, root_event_id, depth
    )
    select
      event_type,
      1,
      'space-main',
      'attendance',
      id::text,
      'message',
      aggregate_id::text,
      created_at,
      payload || jsonb_build_object('outbox_event_id', id),
      id::text,
      null,
      id::text,
      0
    from source_rows
    on conflict (source, source_event_id) do nothing
    returning id
  )
  select count(*) into inserted_count from inserted;
  return jsonb_build_object('inserted', inserted_count);
end $$;

create or replace function public.automation_claim_domain_event(p_worker_id uuid default gen_random_uuid())
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare e public.domain_events; lease uuid := coalesce(p_worker_id, gen_random_uuid());
begin
  update public.domain_events
    set processing_status = case when attempts >= 8 then 'failed' else 'retryable_failed' end,
        lease_id = null, lease_until = null,
        last_error = coalesce(last_error, 'lease_expired')
  where processing_status = 'processing' and lease_until <= now();

  select * into e from public.domain_events
  where attempts < 8
    and ((processing_status in ('pending','retryable_failed') and available_at <= now())
      or (processing_status = 'processing' and lease_until <= now()))
  order by occurred_at asc, created_at asc
  for update skip locked
  limit 1;
  if not found then return jsonb_build_object('state','not_claimed'); end if;
  update public.domain_events
    set processing_status='processing', attempts=attempts+1, lease_id=lease, lease_until=now()+interval '90 seconds', last_error=null
    where id=e.id returning * into e;
  return jsonb_build_object('state','claimed','lease_id',lease,'event',to_jsonb(e));
end $$;

create or replace function public.automation_complete_domain_event(p_event_id uuid,p_lease_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare e public.domain_events;
begin
  select * into e from public.domain_events where id=p_event_id for update;
  if not found or e.processing_status <> 'processing' or e.lease_id is distinct from p_lease_id or e.lease_until <= now() then
    return jsonb_build_object('state','lease_lost');
  end if;
  update public.domain_events set processing_status='processed', processed_at=clock_timestamp(), lease_id=null, lease_until=null
    where id=p_event_id returning * into e;
  return jsonb_build_object('state','processed');
end $$;

create or replace function public.automation_fail_domain_event(p_event_id uuid,p_lease_id uuid,p_error text,p_retryable boolean default true)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare e public.domain_events;
begin
  select * into e from public.domain_events where id=p_event_id for update;
  if not found or e.processing_status <> 'processing' or e.lease_id is distinct from p_lease_id or e.lease_until <= now() then
    return jsonb_build_object('state','lease_lost');
  end if;
  update public.domain_events
    set processing_status = case when p_retryable and attempts < 8 then 'retryable_failed' else 'failed' end,
        available_at = now()+make_interval(secs=>least(900, power(2, attempts)::integer)),
        last_error = left(coalesce(p_error,'automation_failed'), 256),
        lease_id = null,
        lease_until = null
    where id=p_event_id returning * into e;
  return jsonb_build_object('state',e.processing_status);
end $$;

alter table public.automations enable row level security;
alter table public.automation_versions enable row level security;
alter table public.automation_runs enable row level security;
alter table public.automation_run_steps enable row level security;
alter table public.automation_idempotency enable row level security;
alter table public.domain_events enable row level security;

revoke all on public.automations, public.automation_versions, public.automation_runs, public.automation_run_steps,
  public.automation_idempotency, public.domain_events from public, anon, authenticated;
grant select, insert, update on public.automations, public.automation_versions, public.automation_runs, public.automation_run_steps,
  public.automation_idempotency, public.domain_events to service_role;
revoke execute on function public.automation_import_attendance_outbox(integer), public.automation_claim_domain_event(uuid),
  public.automation_complete_domain_event(uuid,uuid), public.automation_fail_domain_event(uuid,uuid,text,boolean) from public, anon, authenticated;
grant execute on function public.automation_import_attendance_outbox(integer), public.automation_claim_domain_event(uuid),
  public.automation_complete_domain_event(uuid,uuid), public.automation_fail_domain_event(uuid,uuid,text,boolean) to service_role;

notify pgrst, 'reload schema';
commit;
