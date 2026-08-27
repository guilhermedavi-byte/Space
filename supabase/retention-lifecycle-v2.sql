create extension if not exists pgcrypto;

create or replace function public.retention_set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.retention_prevent_history_mutation()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  raise exception 'append_only_relation';
end;
$$;

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  firestore_student_id text not null unique,
  full_name text not null,
  email text,
  phone text,
  lifecycle_status text not null default 'active' check (lifecycle_status in ('active', 'cancellation_scheduled', 'churned')),
  pause_status text not null default 'none' check (pause_status in ('none', 'paused_billable', 'paused_non_billable')),
  source_system text not null default 'firestore',
  legacy_source jsonb not null default '{}'::jsonb,
  legacy_confidence text not null default 'high' check (legacy_confidence in ('high', 'medium', 'low', 'unknown')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1 check (version > 0)
);

create table if not exists public.billing_accounts (
  id uuid primary key default gen_random_uuid(),
  external_key text unique,
  display_name text not null,
  email text,
  phone text,
  source_system text not null default 'legacy_import',
  legacy_source jsonb not null default '{}'::jsonb,
  legacy_confidence text not null default 'unknown' check (legacy_confidence in ('high', 'medium', 'low', 'unknown')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1 check (version > 0)
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete restrict,
  billing_account_id uuid references public.billing_accounts(id) on delete set null,
  external_subscription_key text,
  plan_name text,
  billing_cycle text not null default 'monthly' check (billing_cycle in ('weekly', 'monthly', 'quarterly', 'semiannual', 'annual', 'custom')),
  lifecycle_status text not null default 'active' check (lifecycle_status in ('active', 'cancellation_scheduled', 'churned')),
  pause_status text not null default 'none' check (pause_status in ('none', 'paused_billable', 'paused_non_billable')),
  financial_status text not null default 'unknown' check (financial_status in ('unknown', 'current', 'delinquent', 'paused', 'cancelled')),
  started_at timestamptz,
  scheduled_service_end_at timestamptz,
  ended_at timestamptz,
  mrr_brl numeric(14,2),
  original_mrr_value numeric(14,2),
  original_currency text check (original_currency in ('BRL', 'USD') or original_currency is null),
  fx_rate numeric(14,6),
  fx_rate_source text,
  fx_rate_date date,
  source_system text not null default 'legacy_import',
  legacy_source jsonb not null default '{}'::jsonb,
  legacy_confidence text not null default 'unknown' check (legacy_confidence in ('high', 'medium', 'low', 'unknown')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1 check (version > 0),
  unique (student_id, external_subscription_key),
  check (mrr_brl is null or mrr_brl >= 0),
  check (original_mrr_value is null or original_mrr_value >= 0),
  check (fx_rate is null or fx_rate > 0),
  check ((fx_rate is null and fx_rate_source is null and fx_rate_date is null) or (fx_rate is not null and fx_rate_source is not null and fx_rate_date is not null)),
  check (ended_at is null or started_at is null or ended_at >= started_at)
);

create index if not exists idx_subscriptions_student_id on public.subscriptions(student_id);
create index if not exists idx_subscriptions_billing_account_id on public.subscriptions(billing_account_id);
create index if not exists idx_subscriptions_lifecycle_status on public.subscriptions(lifecycle_status);
create index if not exists idx_subscriptions_pause_status on public.subscriptions(pause_status);
create index if not exists idx_subscriptions_financial_status on public.subscriptions(financial_status);

create table if not exists public.service_periods (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  source_system text not null default 'legacy_import',
  legacy_source jsonb not null default '{}'::jsonb,
  legacy_confidence text not null default 'unknown' check (legacy_confidence in ('high', 'medium', 'low', 'unknown')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1 check (version > 0),
  check (period_end >= period_start),
  unique (subscription_id, period_start, period_end)
);

create index if not exists idx_service_periods_subscription_id on public.service_periods(subscription_id);
create index if not exists idx_service_periods_period_start on public.service_periods(period_start desc);

create table if not exists public.retention_cases (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete restrict,
  subscription_id uuid not null references public.subscriptions(id) on delete restrict,
  case_kind text not null check (case_kind in ('risk', 'preventive', 'formal', 'legacy_import')),
  stage text not null check (stage in ('open', 'awaiting_customer', 'scheduled', 'saved', 'cancelled', 'lost')),
  risk_level text check (risk_level in ('low', 'medium', 'high', 'critical') or risk_level is null),
  lifecycle_status text not null default 'active' check (lifecycle_status in ('active', 'cancellation_scheduled', 'churned')),
  pause_status text not null default 'none' check (pause_status in ('none', 'paused_billable', 'paused_non_billable')),
  financial_status text not null default 'unknown' check (financial_status in ('unknown', 'current', 'delinquent', 'paused', 'cancelled')),
  owner_uid text,
  owner_name text,
  latest_event_id uuid,
  source_ref text,
  scheduled_service_end_at timestamptz,
  first_contact_at timestamptz,
  last_contact_at timestamptz,
  awaiting_customer_since timestamptz,
  saved_at timestamptz,
  churned_at timestamptz,
  closed_at timestamptz,
  close_reason text,
  source_system text not null default 'system',
  legacy_source jsonb not null default '{}'::jsonb,
  legacy_confidence text not null default 'unknown' check (legacy_confidence in ('high', 'medium', 'low', 'unknown')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1 check (version > 0),
  unique (source_system, source_ref),
  check ((stage = 'lost') = (lifecycle_status = 'churned')),
  check (closed_at is null or closed_at >= created_at)
);

create index if not exists idx_retention_cases_subscription_id on public.retention_cases(subscription_id);
create index if not exists idx_retention_cases_student_id on public.retention_cases(student_id);
create index if not exists idx_retention_cases_stage on public.retention_cases(stage);
create index if not exists idx_retention_cases_owner_uid on public.retention_cases(owner_uid);
create index if not exists idx_retention_cases_scheduled_service_end_at on public.retention_cases(scheduled_service_end_at asc);
create unique index if not exists idx_retention_cases_formal_open_unique
  on public.retention_cases(subscription_id)
  where case_kind = 'formal' and closed_at is null and stage in ('open', 'awaiting_customer', 'scheduled');

create table if not exists public.retention_events (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.retention_cases(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete restrict,
  subscription_id uuid not null references public.subscriptions(id) on delete restrict,
  event_type text not null,
  occurred_at timestamptz not null default now(),
  actor_uid text,
  actor_name text,
  actor_role text,
  client_action_id text not null,
  idempotency_key text not null unique,
  command_fingerprint text not null,
  state_before jsonb,
  state_after jsonb,
  payload jsonb not null default '{}'::jsonb,
  source_system text not null default 'system',
  source_confidence text not null default 'high' check (source_confidence in ('high', 'medium', 'low', 'unknown')),
  created_at timestamptz not null default now()
);

create index if not exists idx_retention_events_case_id on public.retention_events(case_id, occurred_at desc);
create index if not exists idx_retention_events_subscription_id on public.retention_events(subscription_id, occurred_at desc);
create index if not exists idx_retention_events_client_action_id on public.retention_events(client_action_id);

create table if not exists public.subscription_status_history (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions(id) on delete cascade,
  from_status text,
  to_status text not null,
  reason text,
  retention_event_id uuid references public.retention_events(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.pause_status_history (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions(id) on delete cascade,
  from_status text,
  to_status text not null,
  reason text,
  retention_event_id uuid references public.retention_events(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.financial_status_history (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions(id) on delete cascade,
  from_status text,
  to_status text not null,
  reason text,
  retention_event_id uuid references public.retention_events(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.charges (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid references public.subscriptions(id) on delete set null,
  billing_account_id uuid references public.billing_accounts(id) on delete set null,
  external_charge_id text unique,
  charge_status text not null default 'unknown' check (charge_status in ('unknown', 'pending', 'paid', 'overdue', 'cancelled')),
  due_at timestamptz,
  service_period_start date,
  service_period_end date,
  amount_brl numeric(14,2),
  original_amount numeric(14,2),
  original_currency text check (original_currency in ('BRL', 'USD') or original_currency is null),
  source_system text not null default 'unavailable',
  source_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1 check (version > 0),
  check (service_period_end is null or service_period_start is null or service_period_end >= service_period_start),
  check (amount_brl is null or amount_brl >= 0),
  check (original_amount is null or original_amount >= 0)
);

create index if not exists idx_charges_subscription_id on public.charges(subscription_id);
create index if not exists idx_charges_charge_status on public.charges(charge_status);
create index if not exists idx_charges_due_at on public.charges(due_at asc);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  charge_id uuid references public.charges(id) on delete set null,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  external_payment_id text unique,
  payment_status text not null default 'unknown' check (payment_status in ('unknown', 'paid', 'refunded', 'chargeback', 'cancelled')),
  paid_at timestamptz,
  service_period_start date,
  service_period_end date,
  amount_brl numeric(14,2),
  original_amount numeric(14,2),
  original_currency text check (original_currency in ('BRL', 'USD') or original_currency is null),
  source_system text not null default 'unavailable',
  source_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1 check (version > 0),
  check (service_period_end is null or service_period_start is null or service_period_end >= service_period_start),
  check (amount_brl is null or amount_brl >= 0),
  check (original_amount is null or original_amount >= 0)
);

create index if not exists idx_payments_subscription_id on public.payments(subscription_id);
create index if not exists idx_payments_paid_at on public.payments(paid_at desc);

create table if not exists public.monthly_base_snapshots (
  id uuid primary key default gen_random_uuid(),
  month_key text not null check (month_key ~ '^\d{4}-\d{2}$'),
  snapshot_kind text not null,
  snapshot_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (month_key, snapshot_kind, created_at)
);

create table if not exists public.kpi_formula_versions (
  id uuid primary key default gen_random_uuid(),
  formula_key text not null unique,
  version_label text not null,
  formula_notes text,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.kpi_monthly_snapshots (
  id uuid primary key default gen_random_uuid(),
  month_key text not null check (month_key ~ '^\d{4}-\d{2}$'),
  formula_version_id uuid references public.kpi_formula_versions(id) on delete set null,
  metrics jsonb not null default '{}'::jsonb,
  data_quality_status text not null default 'draft' check (data_quality_status in ('draft', 'partial', 'validated')),
  created_at timestamptz not null default now(),
  unique (month_key, formula_version_id)
);

create table if not exists public.data_quality_snapshots (
  id uuid primary key default gen_random_uuid(),
  scope_key text not null,
  quality_status text not null check (quality_status in ('ok', 'warning', 'critical')),
  quality_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid,
  action text not null,
  actor_uid text,
  actor_name text,
  actor_role text,
  justification text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_logs_entity on public.audit_logs(entity_type, entity_id, created_at desc);

create table if not exists public.outbox_events (
  id uuid primary key default gen_random_uuid(),
  aggregate_type text not null,
  aggregate_id uuid,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  delivery_status text not null default 'pending' check (delivery_status in ('pending', 'processing', 'delivered', 'failed')),
  available_at timestamptz not null default now(),
  attempts integer not null default 0 check (attempts >= 0),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_outbox_events_delivery_status on public.outbox_events(delivery_status, available_at asc);

drop trigger if exists trg_students_updated_at on public.students;
create trigger trg_students_updated_at before update on public.students for each row execute function public.retention_set_updated_at();
drop trigger if exists trg_billing_accounts_updated_at on public.billing_accounts;
create trigger trg_billing_accounts_updated_at before update on public.billing_accounts for each row execute function public.retention_set_updated_at();
drop trigger if exists trg_subscriptions_updated_at on public.subscriptions;
create trigger trg_subscriptions_updated_at before update on public.subscriptions for each row execute function public.retention_set_updated_at();
drop trigger if exists trg_service_periods_updated_at on public.service_periods;
create trigger trg_service_periods_updated_at before update on public.service_periods for each row execute function public.retention_set_updated_at();
drop trigger if exists trg_retention_cases_updated_at on public.retention_cases;
create trigger trg_retention_cases_updated_at before update on public.retention_cases for each row execute function public.retention_set_updated_at();
drop trigger if exists trg_charges_updated_at on public.charges;
create trigger trg_charges_updated_at before update on public.charges for each row execute function public.retention_set_updated_at();
drop trigger if exists trg_payments_updated_at on public.payments;
create trigger trg_payments_updated_at before update on public.payments for each row execute function public.retention_set_updated_at();
drop trigger if exists trg_outbox_events_updated_at on public.outbox_events;
create trigger trg_outbox_events_updated_at before update on public.outbox_events for each row execute function public.retention_set_updated_at();

drop trigger if exists trg_retention_events_immutable_update on public.retention_events;
create trigger trg_retention_events_immutable_update before update or delete on public.retention_events
for each row execute function public.retention_prevent_history_mutation();
drop trigger if exists trg_subscription_status_history_immutable_update on public.subscription_status_history;
create trigger trg_subscription_status_history_immutable_update before update or delete on public.subscription_status_history
for each row execute function public.retention_prevent_history_mutation();
drop trigger if exists trg_pause_status_history_immutable_update on public.pause_status_history;
create trigger trg_pause_status_history_immutable_update before update or delete on public.pause_status_history
for each row execute function public.retention_prevent_history_mutation();
drop trigger if exists trg_financial_status_history_immutable_update on public.financial_status_history;
create trigger trg_financial_status_history_immutable_update before update or delete on public.financial_status_history
for each row execute function public.retention_prevent_history_mutation();

alter table public.students enable row level security;
alter table public.billing_accounts enable row level security;
alter table public.subscriptions enable row level security;
alter table public.service_periods enable row level security;
alter table public.retention_cases enable row level security;
alter table public.retention_events enable row level security;
alter table public.subscription_status_history enable row level security;
alter table public.pause_status_history enable row level security;
alter table public.financial_status_history enable row level security;
alter table public.charges enable row level security;
alter table public.payments enable row level security;
alter table public.monthly_base_snapshots enable row level security;
alter table public.kpi_formula_versions enable row level security;
alter table public.kpi_monthly_snapshots enable row level security;
alter table public.data_quality_snapshots enable row level security;
alter table public.audit_logs enable row level security;
alter table public.outbox_events enable row level security;

create or replace function public.retention_compute_scheduled_end_at(
  p_requested_at timestamptz,
  p_first_lesson_at timestamptz default null
)
returns timestamptz
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  safe_requested timestamptz := coalesce(p_requested_at, now());
  diff interval;
begin
  if p_first_lesson_at is not null then
    diff := safe_requested - p_first_lesson_at;
    if diff >= interval '0 second' and diff <= interval '7 days' then
      return p_first_lesson_at + interval '1 month';
    end if;
  end if;
  return safe_requested + interval '2 months';
end;
$$;

create or replace function public.retention_case_snapshot(p_case_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'case',
    jsonb_build_object(
      'id', rc.id,
      'case_kind', rc.case_kind,
      'stage', rc.stage,
      'risk_level', rc.risk_level,
      'lifecycle_status', rc.lifecycle_status,
      'pause_status', rc.pause_status,
      'financial_status', rc.financial_status,
      'owner_uid', rc.owner_uid,
      'owner_name', rc.owner_name,
      'scheduled_service_end_at', rc.scheduled_service_end_at,
      'first_contact_at', rc.first_contact_at,
      'last_contact_at', rc.last_contact_at,
      'awaiting_customer_since', rc.awaiting_customer_since,
      'saved_at', rc.saved_at,
      'churned_at', rc.churned_at,
      'closed_at', rc.closed_at,
      'close_reason', rc.close_reason,
      'created_at', rc.created_at,
      'updated_at', rc.updated_at,
      'version', rc.version
    ),
    'student',
    jsonb_build_object(
      'id', s.id,
      'firestore_student_id', s.firestore_student_id,
      'full_name', s.full_name,
      'lifecycle_status', s.lifecycle_status,
      'pause_status', s.pause_status,
      'updated_at', s.updated_at
    ),
    'subscription',
    jsonb_build_object(
      'id', sub.id,
      'billing_account_id', sub.billing_account_id,
      'plan_name', sub.plan_name,
      'lifecycle_status', sub.lifecycle_status,
      'pause_status', sub.pause_status,
      'financial_status', sub.financial_status,
      'started_at', sub.started_at,
      'scheduled_service_end_at', sub.scheduled_service_end_at,
      'ended_at', sub.ended_at,
      'mrr_brl', sub.mrr_brl,
      'original_mrr_value', sub.original_mrr_value,
      'original_currency', sub.original_currency,
      'fx_rate', sub.fx_rate,
      'fx_rate_source', sub.fx_rate_source,
      'fx_rate_date', sub.fx_rate_date,
      'updated_at', sub.updated_at,
      'version', sub.version
    ),
    'billingAccount',
    case when ba.id is null then null else jsonb_build_object(
      'id', ba.id,
      'display_name', ba.display_name,
      'external_key', ba.external_key
    ) end
  )
  from public.retention_cases rc
  join public.students s on s.id = rc.student_id
  join public.subscriptions sub on sub.id = rc.subscription_id
  left join public.billing_accounts ba on ba.id = sub.billing_account_id
  where rc.id = p_case_id
$$;

create or replace function public.retention_resolve_subject_by_firestore_student_id(p_firestore_student_id text)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'student_id', s.id,
    'subscription_id', sub.id,
    'firestore_student_id', s.firestore_student_id
  )
  from public.students s
  join public.subscriptions sub on sub.student_id = s.id
  where s.firestore_student_id = p_firestore_student_id
  order by sub.created_at desc
  limit 1
$$;

create or replace function public.retention_list_cases(p_filters jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_stage text := nullif(trim(coalesce(p_filters->>'stage', '')), '');
  v_owner text := nullif(trim(coalesce(p_filters->>'owner_uid', '')), '');
  v_risk text := nullif(trim(coalesce(p_filters->>'risk_level', '')), '');
  v_month text := nullif(trim(coalesce(p_filters->>'month_key', '')), '');
  v_rows jsonb := '[]'::jsonb;
  v_counts jsonb := '{}'::jsonb;
begin
  select coalesce(jsonb_agg(row_to_json(x)), '[]'::jsonb)
    into v_rows
  from (
    select
      rc.id,
      rc.student_id,
      rc.subscription_id,
      rc.case_kind,
      rc.stage,
      rc.risk_level,
      rc.lifecycle_status,
      rc.pause_status,
      rc.financial_status,
      rc.owner_uid,
      rc.owner_name,
      rc.scheduled_service_end_at,
      rc.first_contact_at,
      rc.last_contact_at,
      rc.awaiting_customer_since,
      rc.saved_at,
      rc.churned_at,
      rc.closed_at,
      rc.close_reason,
      rc.version,
      rc.updated_at,
      s.firestore_student_id,
      s.full_name,
      sub.plan_name,
      sub.mrr_brl,
      case
        when sub.mrr_brl is null then 'Dados financeiros incompletos'
        else to_char(sub.mrr_brl, 'FM"R$ "999999990D00')
      end as mrr_display
    from public.retention_cases rc
    join public.students s on s.id = rc.student_id
    join public.subscriptions sub on sub.id = rc.subscription_id
    where (v_stage is null or rc.stage = v_stage)
      and (v_owner is null or rc.owner_uid = v_owner)
      and (v_risk is null or rc.risk_level = v_risk)
      and (v_month is null or to_char(coalesce(rc.scheduled_service_end_at, rc.created_at) at time zone 'America/Sao_Paulo', 'YYYY-MM') = v_month)
    order by coalesce(rc.scheduled_service_end_at, rc.updated_at) asc, s.full_name asc
  ) x;

  select jsonb_build_object(
    'open', count(*) filter (where closed_at is null),
    'awaiting_customer', count(*) filter (where stage = 'awaiting_customer'),
    'scheduled', count(*) filter (where stage = 'scheduled'),
    'saved', count(*) filter (where stage = 'saved' and closed_at is not null),
    'lost', count(*) filter (where stage = 'lost' and closed_at is not null)
  )
  into v_counts
  from public.retention_cases;

  return jsonb_build_object('rows', v_rows, 'counts', v_counts);
end;
$$;

create or replace function public.retention_get_case_timeline(p_case_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'events',
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', ev.id,
          'event_type', ev.event_type,
          'occurred_at', ev.occurred_at,
          'origin',
            case
              when ev.source_system = 'legacy_import' then 'legacy_import'
              when coalesce(ev.actor_uid, '') = 'system:retention-cron' then 'automatic'
              when coalesce(ev.actor_uid, '') <> '' then 'human'
              else 'automatic'
            end,
          'actor_name',
            case
              when coalesce(ev.actor_uid, '') = 'system:retention-cron' then 'Sistema'
              when coalesce(ev.actor_name, '') <> '' then ev.actor_name
              else null
            end,
          'actor_role', nullif(ev.actor_role, ''),
          'summary', coalesce(nullif(ev.payload->>'reason', ''), nullif(ev.payload->>'detail', ''), nullif(ev.payload->>'notes', ''), nullif(ev.payload->>'outcome', ''), nullif(ev.payload->>'mode', ''), '—'),
          'state_before', ev.state_before,
          'state_after', ev.state_after
        )
        order by ev.occurred_at asc, ev.created_at asc
      ),
      '[]'::jsonb
    )
  )
  from public.retention_events ev
  where ev.case_id = p_case_id
$$;

create or replace function public.retention_apply_command(p_command jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_case_id uuid := nullif(p_command->>'case_id', '')::uuid;
  v_student_id uuid := nullif(p_command->>'student_id', '')::uuid;
  v_subscription_id uuid := nullif(p_command->>'subscription_id', '')::uuid;
  v_command text := trim(coalesce(p_command->>'command', ''));
  v_event_type text := trim(coalesce(p_command->>'event_type', ''));
  v_actor_uid text := nullif(trim(coalesce(p_command->'actor'->>'uid', '')), '');
  v_actor_name text := nullif(trim(coalesce(p_command->'actor'->>'name', '')), '');
  v_actor_role text := nullif(trim(coalesce(p_command->'actor'->>'role', '')), '');
  v_client_action_id text := trim(coalesce(p_command->>'client_action_id', ''));
  v_idempotency_key text := trim(coalesce(p_command->>'idempotency_key', ''));
  v_command_fingerprint text := trim(coalesce(p_command->>'command_fingerprint', ''));
  v_justification text := nullif(trim(coalesce(p_command->>'justification', '')), '');
  v_expected_version integer := coalesce((p_command->>'expected_version')::integer, 0);
  v_payload jsonb := coalesce(p_command->'payload', '{}'::jsonb);
  v_case public.retention_cases%rowtype;
  v_existing_event public.retention_events%rowtype;
  v_prev_lifecycle text;
  v_prev_pause text;
  v_prev_financial text;
  v_prev_stage text;
  v_new_stage text;
  v_now timestamptz := now();
  v_event_id uuid := gen_random_uuid();
  v_scheduled_end_at timestamptz;
  v_close_reason text := null;
  v_state_before jsonb;
  v_state_after jsonb;
  v_source_system text := coalesce(nullif(trim(coalesce(p_command->>'source_system', '')), ''), 'api');
  v_source_confidence text := coalesce(nullif(trim(coalesce(p_command->>'source_confidence', '')), ''), 'high');
  v_requested_at timestamptz;
  v_existing_formal_case_id uuid;
begin
  if v_command = '' or v_client_action_id = '' or v_idempotency_key = '' or v_command_fingerprint = '' then
    raise exception 'invalid_retention_command';
  end if;

  if v_command not in (
    'flag_risk',
    'register_preventive_intent',
    'register_formal_request',
    'register_contact',
    'mark_awaiting_customer',
    'retract_cancellation',
    'pause_billable',
    'pause_non_billable',
    'resume_lessons',
    'confirm_cancellation_continuity',
    'schedule_program_end',
    'effectuate_churn',
    'reactivate_subscription',
    'delinquency_recovered'
  ) then
    raise exception 'unsupported_retention_command';
  end if;

  select * into v_existing_event
  from public.retention_events
  where idempotency_key = v_idempotency_key;

  if found then
    if v_existing_event.command_fingerprint <> v_command_fingerprint then
      raise exception 'idempotency_key_payload_mismatch';
    end if;
    return jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'event_id', v_existing_event.id,
      'case_id', v_existing_event.case_id,
      'snapshot', public.retention_case_snapshot(v_existing_event.case_id)
    );
  end if;

  if v_case_id is null then
    if v_student_id is null or v_subscription_id is null then
      raise exception 'missing_case_or_entities';
    end if;

    if v_command = 'register_formal_request' then
      select rc.id
        into v_existing_formal_case_id
      from public.retention_cases rc
      where rc.subscription_id = v_subscription_id
        and rc.case_kind = 'formal'
        and rc.closed_at is null
        and rc.stage in ('open', 'awaiting_customer', 'scheduled')
      limit 1;

      if v_existing_formal_case_id is not null then
        raise exception 'formal_case_already_open';
      end if;
    end if;

    insert into public.retention_cases (
      student_id,
      subscription_id,
      case_kind,
      stage,
      risk_level,
      lifecycle_status,
      pause_status,
      financial_status,
      owner_uid,
      owner_name,
      scheduled_service_end_at,
      source_system,
      source_ref
    )
    values (
      v_student_id,
      v_subscription_id,
      case
        when v_command = 'flag_risk' then 'risk'
        when v_command = 'register_preventive_intent' then 'preventive'
        else 'formal'
      end,
      'open',
      nullif(trim(coalesce(v_payload->>'risk_level', '')), ''),
      'active',
      'none',
      'unknown',
      v_actor_uid,
      v_actor_name,
      null,
      v_source_system,
      case when v_source_system = 'legacy_import' then nullif(trim(coalesce(v_payload->>'source_ref', '')), '') else null end
    )
    returning * into v_case;
  else
    select * into v_case
    from public.retention_cases
    where id = v_case_id
    for update;

    if not found then
      raise exception 'retention_case_not_found';
    end if;

    if v_expected_version > 0 and v_case.version <> v_expected_version then
      raise exception 'retention_version_conflict';
    end if;
  end if;

  v_prev_lifecycle := v_case.lifecycle_status;
  v_prev_pause := v_case.pause_status;
  v_prev_financial := v_case.financial_status;
  v_prev_stage := v_case.stage;
  v_new_stage := v_case.stage;
  v_scheduled_end_at := v_case.scheduled_service_end_at;

  if v_command = 'flag_risk' then
    v_case.risk_level := coalesce(nullif(trim(coalesce(v_payload->>'risk_level', '')), ''), v_case.risk_level, 'medium');
  elsif v_command = 'register_preventive_intent' then
    if v_case.case_kind = 'formal' and v_case.closed_at is null then
      raise exception 'formal_case_already_open';
    end if;
    v_new_stage := 'open';
  elsif v_command = 'register_formal_request' then
    v_requested_at := coalesce(nullif(v_payload->>'requested_at', '')::timestamptz, v_now);
    v_scheduled_end_at := public.retention_compute_scheduled_end_at(
      v_requested_at,
      nullif(v_payload->>'first_lesson_at', '')::timestamptz
    );
    v_case.lifecycle_status := 'cancellation_scheduled';
    v_new_stage := 'scheduled';
  elsif v_command = 'register_contact' then
    if v_case.first_contact_at is null then
      v_case.first_contact_at := v_now;
    end if;
    v_case.last_contact_at := v_now;
  elsif v_command = 'mark_awaiting_customer' then
    v_new_stage := 'awaiting_customer';
    v_case.awaiting_customer_since := v_now;
  elsif v_command = 'retract_cancellation' then
    if v_case.lifecycle_status = 'churned' then
      raise exception 'cannot_retract_after_churn';
    end if;
    v_case.lifecycle_status := 'active';
    v_new_stage := 'saved';
    v_case.saved_at := v_now;
    v_case.closed_at := v_now;
    v_close_reason := 'saved';
  elsif v_command = 'pause_billable' then
    v_case.pause_status := 'paused_billable';
  elsif v_command = 'pause_non_billable' then
    v_case.pause_status := 'paused_non_billable';
  elsif v_command = 'resume_lessons' then
    v_case.pause_status := 'none';
  elsif v_command = 'confirm_cancellation_continuity' then
    if v_case.lifecycle_status <> 'cancellation_scheduled' then
      raise exception 'formal_request_not_started';
    end if;
    v_new_stage := 'scheduled';
  elsif v_command = 'schedule_program_end' then
    v_case.lifecycle_status := 'cancellation_scheduled';
    v_new_stage := 'scheduled';
    v_scheduled_end_at := coalesce(nullif(v_payload->>'scheduled_service_end_at', '')::timestamptz, v_case.scheduled_service_end_at, v_now);
  elsif v_command = 'effectuate_churn' then
    if v_case.lifecycle_status <> 'cancellation_scheduled' then
      raise exception 'cannot_churn_without_schedule';
    end if;
    if v_case.closed_at is not null and v_case.stage = 'lost' then
      raise exception 'case_already_lost';
    end if;
    v_case.lifecycle_status := 'churned';
    v_new_stage := 'lost';
    v_case.churned_at := v_now;
    v_case.closed_at := v_now;
    v_close_reason := 'churned';
  elsif v_command = 'reactivate_subscription' then
    if v_case.lifecycle_status <> 'churned' then
      raise exception 'reactivation_requires_churned_case';
    end if;
    v_case.lifecycle_status := 'active';
    v_case.pause_status := 'none';
    v_new_stage := 'saved';
    v_case.saved_at := coalesce(v_case.saved_at, v_now);
    v_case.closed_at := coalesce(v_case.closed_at, v_now);
    v_close_reason := 'reactivated';
  elsif v_command = 'delinquency_recovered' then
    v_case.financial_status := 'current';
  end if;

  v_state_before := jsonb_build_object(
    'stage', v_prev_stage,
    'lifecycle_status', v_prev_lifecycle,
    'pause_status', v_prev_pause,
    'financial_status', v_prev_financial,
    'scheduled_service_end_at', v_case.scheduled_service_end_at
  );

  update public.retention_cases
     set risk_level = v_case.risk_level,
         lifecycle_status = v_case.lifecycle_status,
         pause_status = v_case.pause_status,
         financial_status = v_case.financial_status,
         stage = v_new_stage,
         scheduled_service_end_at = v_scheduled_end_at,
         first_contact_at = v_case.first_contact_at,
         last_contact_at = v_case.last_contact_at,
         awaiting_customer_since = v_case.awaiting_customer_since,
         saved_at = v_case.saved_at,
         churned_at = v_case.churned_at,
         closed_at = coalesce(v_case.closed_at, case when v_new_stage in ('saved', 'cancelled', 'lost') then v_now else null end),
         close_reason = coalesce(v_close_reason, v_case.close_reason),
         latest_event_id = v_event_id,
         owner_uid = coalesce(v_actor_uid, owner_uid),
         owner_name = coalesce(v_actor_name, owner_name),
         version = version + 1
   where id = v_case.id
   returning * into v_case;

  update public.subscriptions
     set lifecycle_status = v_case.lifecycle_status,
         pause_status = v_case.pause_status,
         financial_status = v_case.financial_status,
         scheduled_service_end_at = v_scheduled_end_at,
         ended_at = case when v_case.lifecycle_status = 'churned' then coalesce(ended_at, v_now) when v_case.lifecycle_status = 'active' then null else ended_at end,
         version = version + 1
   where id = v_case.subscription_id;

  update public.students
     set lifecycle_status = v_case.lifecycle_status,
         pause_status = v_case.pause_status,
         version = version + 1
   where id = v_case.student_id;

  v_state_after := jsonb_build_object(
    'stage', v_case.stage,
    'lifecycle_status', v_case.lifecycle_status,
    'pause_status', v_case.pause_status,
    'financial_status', v_case.financial_status,
    'scheduled_service_end_at', v_case.scheduled_service_end_at
  );

  insert into public.retention_events (
    id,
    case_id,
    student_id,
    subscription_id,
    event_type,
    occurred_at,
    actor_uid,
    actor_name,
    actor_role,
    client_action_id,
    idempotency_key,
    command_fingerprint,
    state_before,
    state_after,
    payload,
    source_system,
    source_confidence
  ) values (
    v_event_id,
    v_case.id,
    v_case.student_id,
    v_case.subscription_id,
    coalesce(nullif(v_event_type, ''), case when v_command = 'effectuate_churn' then 'cancellation_effective' else v_command end),
    v_now,
    v_actor_uid,
    v_actor_name,
    v_actor_role,
    v_client_action_id,
    v_idempotency_key,
    v_command_fingerprint,
    v_state_before,
    v_state_after,
    v_payload,
    v_source_system,
    v_source_confidence
  );

  if v_prev_lifecycle is distinct from v_case.lifecycle_status then
    insert into public.subscription_status_history (subscription_id, from_status, to_status, reason, retention_event_id)
    values (v_case.subscription_id, v_prev_lifecycle, v_case.lifecycle_status, v_command, v_event_id);
  end if;

  if v_prev_pause is distinct from v_case.pause_status then
    insert into public.pause_status_history (subscription_id, from_status, to_status, reason, retention_event_id)
    values (v_case.subscription_id, v_prev_pause, v_case.pause_status, v_command, v_event_id);
  end if;

  if v_prev_financial is distinct from v_case.financial_status then
    insert into public.financial_status_history (subscription_id, from_status, to_status, reason, retention_event_id)
    values (v_case.subscription_id, v_prev_financial, v_case.financial_status, v_command, v_event_id);
  end if;

  insert into public.audit_logs (
    entity_type,
    entity_id,
    action,
    actor_uid,
    actor_name,
    actor_role,
    justification,
    payload
  ) values (
    'retention_case',
    v_case.id,
    v_command,
    v_actor_uid,
    v_actor_name,
    v_actor_role,
    v_justification,
    jsonb_build_object(
      'state_before', v_state_before,
      'state_after', v_state_after,
      'has_payload', jsonb_typeof(v_payload) = 'object',
      'version', v_case.version
    )
  );

  insert into public.outbox_events (
    aggregate_type,
    aggregate_id,
    event_type,
    payload
  ) values (
    'retention_case',
    v_case.id,
    coalesce(nullif(v_event_type, ''), case when v_command = 'effectuate_churn' then 'cancellation_effective' else v_command end),
    jsonb_build_object(
      'case_id', v_case.id,
      'subscription_id', v_case.subscription_id,
      'student_id', v_case.student_id,
      'event_id', v_event_id
    )
  );

  return jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'event_id', v_event_id,
    'case_id', v_case.id,
    'version', v_case.version,
    'snapshot', public.retention_case_snapshot(v_case.id)
  );
end;
$$;

create or replace function public.retention_run_scheduled_churn(
  p_limit integer default 50,
  p_actor jsonb default '{"uid":"system:retention-cron","name":"Sistema","role":"system"}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 50), 500));
  v_row record;
  v_report jsonb := '[]'::jsonb;
  v_processed integer := 0;
  v_skipped integer := 0;
  v_failed integer := 0;
  v_now_sp timestamp := now() at time zone 'America/Sao_Paulo';
  v_result jsonb;
begin
  for v_row in
    select rc.id, s.firestore_student_id
    from public.retention_cases rc
    join public.students s on s.id = rc.student_id
    where rc.lifecycle_status = 'cancellation_scheduled'
      and rc.stage in ('scheduled', 'awaiting_customer')
      and rc.closed_at is null
      and rc.scheduled_service_end_at is not null
      and (rc.scheduled_service_end_at at time zone 'America/Sao_Paulo') <= v_now_sp
    order by rc.scheduled_service_end_at asc
    limit v_limit
  loop
    begin
      v_result := public.retention_apply_command(
        jsonb_build_object(
          'case_id', v_row.id,
          'command', 'effectuate_churn',
          'event_type', 'cancellation_effective',
          'client_action_id', 'cron:' || v_row.id::text,
          'idempotency_key', 'cron:' || v_row.id::text,
          'command_fingerprint', md5('effectuate_churn:' || v_row.id::text || ':automatic'),
          'expected_version', 0,
          'payload', jsonb_build_object('mode', 'automatic', 'effective_at_sp', v_now_sp::text),
          'actor', p_actor,
          'source_system', 'retention_cron',
          'source_confidence', 'high',
          'justification', 'scheduled_churn'
        )
      );
      v_processed := v_processed + 1;
      v_report := v_report || jsonb_build_array(jsonb_build_object('case_ref', substr(md5(coalesce(v_row.firestore_student_id, v_row.id::text)), 1, 10), 'status', 'processed'));
    exception
      when sqlstate 'P0001' then
        v_failed := v_failed + 1;
        v_report := v_report || jsonb_build_array(jsonb_build_object('case_ref', substr(md5(coalesce(v_row.firestore_student_id, v_row.id::text)), 1, 10), 'status', 'failed', 'error', SQLERRM));
      when others then
        v_failed := v_failed + 1;
        v_report := v_report || jsonb_build_array(jsonb_build_object('case_ref', substr(md5(coalesce(v_row.firestore_student_id, v_row.id::text)), 1, 10), 'status', 'failed', 'error', 'unexpected'));
    end;
  end loop;

  select count(*)
    into v_skipped
  from public.retention_cases rc
  where rc.lifecycle_status = 'cancellation_scheduled'
    and rc.stage in ('scheduled', 'awaiting_customer')
    and rc.closed_at is null
    and rc.scheduled_service_end_at is not null
    and (rc.scheduled_service_end_at at time zone 'America/Sao_Paulo') > v_now_sp;

  return jsonb_build_object(
    'ok', true,
    'processed', v_processed,
    'failed', v_failed,
    'not_due_yet', v_skipped,
    'report', v_report
  );
end;
$$;

create or replace function public.retention_import_legacy_snapshot(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_dry_run boolean := coalesce((p_payload->>'dry_run')::boolean, true);
  v_students jsonb := coalesce(p_payload->'students', '[]'::jsonb);
  v_subscriptions jsonb := coalesce(p_payload->'subscriptions', '[]'::jsonb);
  v_cases jsonb := coalesce(p_payload->'cases', '[]'::jsonb);
  v_events jsonb := coalesce(p_payload->'events', '[]'::jsonb);
  v_row jsonb;
  v_student_id uuid;
  v_subscription_id uuid;
  v_case_id uuid;
  v_students_written integer := 0;
  v_subscriptions_written integer := 0;
  v_cases_written integer := 0;
  v_events_written integer := 0;
  v_events_skipped integer := 0;
  v_conflicts jsonb := '[]'::jsonb;
  v_inserted_event_id uuid;
begin
  if v_dry_run then
    return jsonb_build_object(
      'ok', true,
      'dry_run', true,
      'students_received', jsonb_array_length(v_students),
      'subscriptions_received', jsonb_array_length(v_subscriptions),
      'cases_received', jsonb_array_length(v_cases),
      'events_received', jsonb_array_length(v_events)
    );
  end if;

  for v_row in select value from jsonb_array_elements(v_students)
  loop
    insert into public.students (
      firestore_student_id, full_name, email, phone, lifecycle_status, pause_status, source_system, legacy_source, legacy_confidence
    ) values (
      v_row->>'firestore_student_id',
      coalesce(nullif(v_row->>'full_name', ''), 'Aluno'),
      nullif(v_row->>'email', ''),
      nullif(v_row->>'phone', ''),
      coalesce(nullif(v_row->>'lifecycle_status', ''), 'active'),
      coalesce(nullif(v_row->>'pause_status', ''), 'none'),
      coalesce(nullif(v_row->>'source_system', ''), 'legacy_import'),
      coalesce(v_row->'legacy_source', '{}'::jsonb),
      coalesce(nullif(v_row->>'legacy_confidence', ''), 'unknown')
    )
    on conflict (firestore_student_id) do update
      set full_name = excluded.full_name,
          email = coalesce(excluded.email, public.students.email),
          phone = coalesce(excluded.phone, public.students.phone),
          lifecycle_status = excluded.lifecycle_status,
          pause_status = excluded.pause_status,
          source_system = excluded.source_system,
          legacy_source = excluded.legacy_source,
          legacy_confidence = excluded.legacy_confidence,
          version = public.students.version + 1
    returning id into v_student_id;
    v_students_written := v_students_written + 1;
  end loop;

  for v_row in select value from jsonb_array_elements(v_subscriptions)
  loop
    select id into v_student_id from public.students where firestore_student_id = v_row->>'firestore_student_id' limit 1;
    if v_student_id is null then
      v_conflicts := v_conflicts || jsonb_build_array(jsonb_build_object('ref', substr(md5(coalesce(v_row->>'firestore_student_id', '')), 1, 10), 'reason', 'student_missing'));
      continue;
    end if;
    insert into public.subscriptions (
      student_id, external_subscription_key, plan_name, billing_cycle, lifecycle_status, pause_status, financial_status,
      started_at, scheduled_service_end_at, ended_at, source_system, legacy_source, legacy_confidence
    ) values (
      v_student_id,
      nullif(v_row->>'external_subscription_key', ''),
      nullif(v_row->>'plan_name', ''),
      coalesce(nullif(v_row->>'billing_cycle', ''), 'monthly'),
      coalesce(nullif(v_row->>'lifecycle_status', ''), 'active'),
      coalesce(nullif(v_row->>'pause_status', ''), 'none'),
      coalesce(nullif(v_row->>'financial_status', ''), 'unknown'),
      nullif(v_row->>'started_at', '')::timestamptz,
      nullif(v_row->>'scheduled_service_end_at', '')::timestamptz,
      nullif(v_row->>'ended_at', '')::timestamptz,
      coalesce(nullif(v_row->>'source_system', ''), 'legacy_import'),
      coalesce(v_row->'legacy_source', '{}'::jsonb),
      coalesce(nullif(v_row->>'legacy_confidence', ''), 'unknown')
    )
    on conflict (student_id, external_subscription_key) do update
      set plan_name = coalesce(excluded.plan_name, public.subscriptions.plan_name),
          lifecycle_status = excluded.lifecycle_status,
          pause_status = excluded.pause_status,
          financial_status = excluded.financial_status,
          started_at = coalesce(excluded.started_at, public.subscriptions.started_at),
          scheduled_service_end_at = coalesce(excluded.scheduled_service_end_at, public.subscriptions.scheduled_service_end_at),
          ended_at = coalesce(excluded.ended_at, public.subscriptions.ended_at),
          source_system = excluded.source_system,
          legacy_source = excluded.legacy_source,
          legacy_confidence = excluded.legacy_confidence,
          version = public.subscriptions.version + 1
    returning id into v_subscription_id;
    v_subscriptions_written := v_subscriptions_written + 1;
  end loop;

  for v_row in select value from jsonb_array_elements(v_cases)
  loop
    select id into v_student_id from public.students where firestore_student_id = v_row->>'firestore_student_id' limit 1;
    select id into v_subscription_id
    from public.subscriptions
    where student_id = v_student_id
      and external_subscription_key = nullif(v_row->>'external_subscription_key', '')
    limit 1;
    if v_student_id is null or v_subscription_id is null then
      v_conflicts := v_conflicts || jsonb_build_array(jsonb_build_object('ref', substr(md5(coalesce(v_row->>'firestore_student_id', '')), 1, 10), 'reason', 'case_subject_missing'));
      continue;
    end if;
    insert into public.retention_cases (
      student_id, subscription_id, case_kind, stage, risk_level, lifecycle_status, pause_status, financial_status,
      owner_uid, owner_name, source_system, source_ref, scheduled_service_end_at, closed_at, close_reason,
      legacy_source, legacy_confidence
    ) values (
      v_student_id,
      v_subscription_id,
      coalesce(nullif(v_row->>'case_kind', ''), 'legacy_import'),
      coalesce(nullif(v_row->>'stage', ''), 'open'),
      nullif(v_row->>'risk_level', ''),
      coalesce(nullif(v_row->>'lifecycle_status', ''), 'active'),
      coalesce(nullif(v_row->>'pause_status', ''), 'none'),
      coalesce(nullif(v_row->>'financial_status', ''), 'unknown'),
      nullif(v_row->>'owner_uid', ''),
      nullif(v_row->>'owner_name', ''),
      coalesce(nullif(v_row->>'source_system', ''), 'legacy_import'),
      coalesce(nullif(v_row->'legacy_source'->>'imported_from', ''), 'legacy_case') || ':' || coalesce(v_row->>'firestore_student_id', '') || ':' || coalesce(v_row->>'scheduled_service_end_at', '') || ':' || coalesce(v_row->>'close_reason', ''),
      nullif(v_row->>'scheduled_service_end_at', '')::timestamptz,
      nullif(v_row->>'closed_at', '')::timestamptz,
      nullif(v_row->>'close_reason', ''),
      coalesce(v_row->'legacy_source', '{}'::jsonb),
      coalesce(nullif(v_row->>'legacy_confidence', ''), 'unknown')
    )
    on conflict (source_system, source_ref) do update
      set stage = excluded.stage,
          lifecycle_status = excluded.lifecycle_status,
          pause_status = excluded.pause_status,
          financial_status = excluded.financial_status,
          scheduled_service_end_at = coalesce(excluded.scheduled_service_end_at, public.retention_cases.scheduled_service_end_at),
          closed_at = coalesce(excluded.closed_at, public.retention_cases.closed_at),
          close_reason = coalesce(excluded.close_reason, public.retention_cases.close_reason),
          legacy_source = excluded.legacy_source,
          legacy_confidence = excluded.legacy_confidence,
          version = public.retention_cases.version + 1
    returning id into v_case_id;
    v_cases_written := v_cases_written + 1;
  end loop;

  for v_row in select value from jsonb_array_elements(v_events)
  loop
    select id into v_student_id from public.students where firestore_student_id = v_row->>'firestore_student_id' limit 1;
    select id into v_subscription_id
    from public.subscriptions
    where student_id = v_student_id
      and external_subscription_key = nullif(v_row->>'external_subscription_key', '')
    limit 1;
    select id into v_case_id
    from public.retention_cases
    where student_id = v_student_id
      and subscription_id = v_subscription_id
      and source_system = 'legacy_import'
    order by created_at asc
    limit 1;
    if v_student_id is null or v_subscription_id is null or v_case_id is null then
      v_conflicts := v_conflicts || jsonb_build_array(jsonb_build_object('ref', substr(md5(coalesce(v_row->>'firestore_student_id', '')), 1, 10), 'reason', 'event_subject_missing'));
      continue;
    end if;
    insert into public.retention_events (
      case_id, student_id, subscription_id, event_type, occurred_at, actor_uid, actor_name, actor_role,
      client_action_id, idempotency_key, command_fingerprint, state_before, state_after, payload, source_system, source_confidence
    ) values (
      v_case_id,
      v_student_id,
      v_subscription_id,
      coalesce(nullif(v_row->>'event_type', ''), 'legacy_import'),
      coalesce(nullif(v_row->>'occurred_at', '')::timestamptz, now()),
      null,
      null,
      null,
      coalesce(nullif(v_row->>'client_action_id', ''), 'legacy'),
      coalesce(nullif(v_row->>'idempotency_key', ''), md5(v_row::text)),
      coalesce(nullif(v_row->>'command_fingerprint', ''), md5(v_row::text)),
      null,
      null,
      coalesce(v_row->'payload', '{}'::jsonb),
      coalesce(nullif(v_row->>'source_system', ''), 'legacy_import'),
      coalesce(nullif(v_row->>'source_confidence', ''), 'medium')
    )
    on conflict (idempotency_key) do nothing
    returning id into v_inserted_event_id;
    if v_inserted_event_id is null then
      v_events_skipped := v_events_skipped + 1;
    else
      v_events_written := v_events_written + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'dry_run', false,
    'students_received', jsonb_array_length(v_students),
    'subscriptions_received', jsonb_array_length(v_subscriptions),
    'cases_received', jsonb_array_length(v_cases),
    'events_received', jsonb_array_length(v_events),
    'students_written', v_students_written,
    'subscriptions_written', v_subscriptions_written,
    'cases_written', v_cases_written,
    'events_written', v_events_written,
    'events_skipped', v_events_skipped,
    'conflicts', v_conflicts
  );
end;
$$;

do $$
declare
  role_name text;
  tbl text;
  fn text;
  retention_tables text[] := array[
    'students','billing_accounts','subscriptions','service_periods','retention_cases','retention_events',
    'subscription_status_history','pause_status_history','financial_status_history','charges','payments',
    'monthly_base_snapshots','kpi_formula_versions','kpi_monthly_snapshots','data_quality_snapshots','audit_logs','outbox_events'
  ];
  retention_functions text[] := array[
    'retention_compute_scheduled_end_at(timestamptz,timestamptz)',
    'retention_case_snapshot(uuid)',
    'retention_resolve_subject_by_firestore_student_id(text)',
    'retention_list_cases(jsonb)',
    'retention_get_case_timeline(uuid)',
    'retention_apply_command(jsonb)',
    'retention_run_scheduled_churn(integer,jsonb)',
    'retention_import_legacy_snapshot(jsonb)'
  ];
begin
  foreach tbl in array retention_tables loop
    execute format('revoke all on table public.%I from public', tbl);
  end loop;
  foreach fn in array retention_functions loop
    execute format('revoke all on function public.%s from public', fn);
  end loop;

  foreach role_name in array array['anon','authenticated'] loop
    if exists(select 1 from pg_roles where rolname = role_name) then
      foreach tbl in array retention_tables loop
        execute format('revoke all on table public.%I from %I', tbl, role_name);
      end loop;
      foreach fn in array retention_functions loop
        execute format('revoke all on function public.%s from %I', fn, role_name);
      end loop;
    end if;
  end loop;

  if exists(select 1 from pg_roles where rolname = 'service_role') then
    foreach tbl in array retention_tables loop
      execute format('grant select, insert, update on table public.%I to service_role', tbl);
    end loop;
    foreach fn in array retention_functions loop
      execute format('grant execute on function public.%s to service_role', fn);
    end loop;
  end if;
end;
$$;
