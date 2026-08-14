create table if not exists public.datacrazy_sync_runs (
  id bigserial primary key,
  sync_name text not null,
  mode text not null,
  status text not null default 'running',
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  duration_ms bigint,
  pages integer not null default 0,
  records_received integer not null default 0,
  inserted_count integer not null default 0,
  updated_count integer not null default 0,
  unchanged_count integer not null default 0,
  deleted_count integer not null default 0,
  cursor_from timestamptz,
  cursor_to timestamptz,
  watermark_at timestamptz,
  error_summary text,
  notes jsonb
);

create table if not exists public.datacrazy_sync_state (
  sync_name text primary key,
  cursor timestamptz,
  status text not null default 'idle',
  last_successful_sync_at timestamptz,
  last_started_at timestamptz,
  last_finished_at timestamptz,
  last_watermark_at timestamptz,
  last_error text,
  lock_token text,
  lock_owner text,
  lock_acquired_at timestamptz,
  lock_expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.datacrazy_businesses (
  id bigserial primary key,
  external_id text not null unique,
  payload jsonb not null,
  source_hash text not null,
  status text,
  pipeline_name text,
  pipeline_key text,
  stage_name text,
  stage_key text,
  attendant_id text,
  attendant_name text,
  lead_name text,
  plan_name text,
  total_amount numeric(14,2) not null default 0,
  created_at timestamptz,
  last_moved_at timestamptz,
  status_changed_at timestamptz,
  status_changed_field text,
  synced_at timestamptz not null default now(),
  deleted_at timestamptz,
  last_sync_run_id bigint,
  last_reconciled_run_id bigint,
  inserted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_datacrazy_businesses_last_moved_at
  on public.datacrazy_businesses (last_moved_at desc);

create index if not exists idx_datacrazy_businesses_status
  on public.datacrazy_businesses (status);

create index if not exists idx_datacrazy_businesses_stage_key
  on public.datacrazy_businesses (stage_key);

create index if not exists idx_datacrazy_businesses_pipeline_key
  on public.datacrazy_businesses (pipeline_key);

create index if not exists idx_datacrazy_businesses_attendant_id
  on public.datacrazy_businesses (attendant_id);

create index if not exists idx_datacrazy_businesses_attendant_name
  on public.datacrazy_businesses (attendant_name);

create index if not exists idx_datacrazy_businesses_status_deleted
  on public.datacrazy_businesses (status, deleted_at);

create index if not exists idx_datacrazy_businesses_sync_run
  on public.datacrazy_businesses (last_sync_run_id, last_reconciled_run_id);

create index if not exists idx_datacrazy_sync_runs_sync_name_started_at
  on public.datacrazy_sync_runs (sync_name, started_at desc);

create or replace function public.set_datacrazy_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_datacrazy_businesses_updated_at on public.datacrazy_businesses;
create trigger trg_datacrazy_businesses_updated_at
before update on public.datacrazy_businesses
for each row
execute function public.set_datacrazy_updated_at();

create or replace function public.datacrazy_acquire_lock(
  p_sync_name text,
  p_lock_token text,
  p_lock_owner text,
  p_ttl_seconds integer default 900
)
returns jsonb
language plpgsql
as $$
declare
  current_row public.datacrazy_sync_state%rowtype;
  now_ts timestamptz := now();
  ttl interval := make_interval(secs => greatest(30, coalesce(p_ttl_seconds, 900)));
begin
  insert into public.datacrazy_sync_state (sync_name, status)
  values (p_sync_name, 'idle')
  on conflict (sync_name) do nothing;

  select * into current_row
  from public.datacrazy_sync_state
  where sync_name = p_sync_name
  for update;

  if current_row.lock_token is not null and current_row.lock_expires_at is not null and current_row.lock_expires_at > now_ts and current_row.lock_token <> p_lock_token then
    return jsonb_build_object(
      'ok', false,
      'sync_name', p_sync_name,
      'lock_owner', current_row.lock_owner,
      'lock_expires_at', current_row.lock_expires_at
    );
  end if;

  update public.datacrazy_sync_state
     set status = 'running',
         lock_token = p_lock_token,
         lock_owner = p_lock_owner,
         lock_acquired_at = now_ts,
         lock_expires_at = now_ts + ttl,
         last_started_at = now_ts
   where sync_name = p_sync_name;

  return jsonb_build_object(
    'ok', true,
    'sync_name', p_sync_name,
    'lock_token', p_lock_token,
    'lock_owner', p_lock_owner,
    'lock_expires_at', now_ts + ttl
  );
end;
$$;

create or replace function public.datacrazy_release_lock(
  p_sync_name text,
  p_lock_token text,
  p_status text default null,
  p_error text default null
)
returns jsonb
language plpgsql
as $$
declare
  current_row public.datacrazy_sync_state%rowtype;
  next_status text := coalesce(nullif(p_status, ''), 'idle');
begin
  select * into current_row
  from public.datacrazy_sync_state
  where sync_name = p_sync_name
  for update;

  if current_row.lock_token is distinct from p_lock_token then
    return jsonb_build_object('ok', false, 'error', 'lock_token_mismatch');
  end if;

  update public.datacrazy_sync_state
     set status = next_status,
         lock_token = null,
         lock_owner = null,
         lock_acquired_at = null,
         lock_expires_at = null,
         last_finished_at = now(),
         last_error = nullif(p_error, '')
   where sync_name = p_sync_name;

  return jsonb_build_object('ok', true, 'sync_name', p_sync_name, 'status', next_status);
end;
$$;
