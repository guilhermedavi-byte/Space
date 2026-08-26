create extension if not exists pgcrypto;

create or replace function public.retention_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.retention_prevent_history_mutation()
returns trigger
language plpgsql
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
  version integer not null default 1
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
  version integer not null default 1
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
  version integer not null default 1,
  unique (student_id, external_subscription_key)
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
  version integer not null default 1,
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
  stage text not null check (stage in ('open', 'awaiting_customer', 'scheduled', 'saved', 'cancelled', 'churned')),
  risk_level text check (risk_level in ('low', 'medium', 'high', 'critical') or risk_level is null),
  lifecycle_status text not null default 'active' check (lifecycle_status in ('active', 'cancellation_scheduled', 'churned')),
  pause_status text not null default 'none' check (pause_status in ('none', 'paused_billable', 'paused_non_billable')),
  financial_status text not null default 'unknown' check (financial_status in ('unknown', 'current', 'delinquent', 'paused', 'cancelled')),
  owner_uid text,
  owner_name text,
  latest_event_id uuid,
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
  version integer not null default 1
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
  version integer not null default 1,
  check (service_period_end is null or service_period_start is null or service_period_end >= service_period_start)
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
  version integer not null default 1,
  check (service_period_end is null or service_period_start is null or service_period_end >= service_period_start)
);

create index if not exists idx_payments_subscription_id on public.payments(subscription_id);
create index if not exists idx_payments_paid_at on public.payments(paid_at desc);

create table if not exists public.monthly_base_snapshots (
  id uuid primary key default gen_random_uuid(),
  month_key text not null,
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
  month_key text not null,
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
  attempts integer not null default 0,
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

create or replace function public.retention_compute_scheduled_end_at(
  p_requested_at timestamptz,
  p_first_lesson_at timestamptz default null
)
returns timestamptz
language plpgsql
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
as $$
  select jsonb_build_object(
    'case', to_jsonb(rc),
    'student', to_jsonb(s),
    'subscription', to_jsonb(sub),
    'billingAccount', to_jsonb(ba)
  )
  from public.retention_cases rc
  join public.students s on s.id = rc.student_id
  join public.subscriptions sub on sub.id = rc.subscription_id
  left join public.billing_accounts ba on ba.id = sub.billing_account_id
  where rc.id = p_case_id
$$;

create or replace function public.retention_list_cases(p_filters jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
stable
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
      s.email,
      s.phone,
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
    'churned', count(*) filter (where stage = 'churned' and closed_at is not null)
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
as $$
  select jsonb_build_object(
    'events',
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', ev.id,
          'event_type', ev.event_type,
          'occurred_at', ev.occurred_at,
          'actor_uid', ev.actor_uid,
          'actor_name', ev.actor_name,
          'actor_role', ev.actor_role,
          'client_action_id', ev.client_action_id,
          'payload', ev.payload,
          'source_system', ev.source_system,
          'source_confidence', ev.source_confidence
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
as $$
declare
  v_case_id uuid := nullif(p_command->>'case_id', '')::uuid;
  v_student_id uuid := nullif(p_command->>'student_id', '')::uuid;
  v_subscription_id uuid := nullif(p_command->>'subscription_id', '')::uuid;
  v_command text := trim(coalesce(p_command->>'command', ''));
  v_actor_uid text := nullif(trim(coalesce(p_command->'actor'->>'uid', '')), '');
  v_actor_name text := nullif(trim(coalesce(p_command->'actor'->>'name', '')), '');
  v_actor_role text := nullif(trim(coalesce(p_command->'actor'->>'role', '')), '');
  v_client_action_id text := trim(coalesce(p_command->>'client_action_id', ''));
  v_idempotency_key text := trim(coalesce(p_command->>'idempotency_key', ''));
  v_justification text := nullif(trim(coalesce(p_command->>'justification', '')), '');
  v_expected_version integer := coalesce((p_command->>'expected_version')::integer, 0);
  v_payload jsonb := coalesce(p_command->'payload', '{}'::jsonb);
  v_case public.retention_cases%rowtype;
  v_existing_event public.retention_events%rowtype;
  v_prev_lifecycle text;
  v_prev_pause text;
  v_prev_financial text;
  v_new_stage text;
  v_now timestamptz := now();
  v_event_id uuid := gen_random_uuid();
  v_scheduled_end_at timestamptz;
  v_close_reason text := null;
begin
  if v_command = '' or v_client_action_id = '' or v_idempotency_key = '' then
    raise exception 'invalid_retention_command';
  end if;

  select * into v_existing_event
  from public.retention_events
  where idempotency_key = v_idempotency_key;

  if found then
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
      source_system
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
      coalesce(nullif(trim(coalesce(p_command->>'source_system', '')), ''), 'api')
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
  v_new_stage := v_case.stage;
  v_scheduled_end_at := v_case.scheduled_service_end_at;

  if v_command = 'flag_risk' then
    v_case.risk_level := coalesce(nullif(trim(coalesce(v_payload->>'risk_level', '')), ''), v_case.risk_level, 'medium');
  elsif v_command = 'register_preventive_intent' then
    v_new_stage := 'open';
  elsif v_command = 'register_formal_request' then
    v_scheduled_end_at := public.retention_compute_scheduled_end_at(
      coalesce(nullif(v_payload->>'requested_at', '')::timestamptz, v_now),
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
      v_case.lifecycle_status := 'cancellation_scheduled';
    end if;
    v_new_stage := 'scheduled';
  elsif v_command = 'schedule_program_end' then
    v_case.lifecycle_status := 'cancellation_scheduled';
    v_new_stage := 'scheduled';
    v_scheduled_end_at := coalesce(nullif(v_payload->>'scheduled_service_end_at', '')::timestamptz, v_case.scheduled_service_end_at, v_now);
  elsif v_command = 'effectuate_churn' then
    v_case.lifecycle_status := 'churned';
    v_new_stage := 'churned';
    v_case.churned_at := v_now;
    v_case.closed_at := v_now;
    v_close_reason := 'churned';
  elsif v_command = 'reactivate_subscription' then
    v_case.lifecycle_status := 'active';
    v_case.pause_status := 'none';
    v_new_stage := 'saved';
    v_case.saved_at := coalesce(v_case.saved_at, v_now);
    v_case.closed_at := coalesce(v_case.closed_at, v_now);
    v_close_reason := 'reactivated';
  else
    raise exception 'unsupported_retention_command';
  end if;

  update public.retention_cases
     set risk_level = v_case.risk_level,
         lifecycle_status = v_case.lifecycle_status,
         pause_status = v_case.pause_status,
         stage = v_new_stage,
         scheduled_service_end_at = v_scheduled_end_at,
         first_contact_at = v_case.first_contact_at,
         last_contact_at = v_case.last_contact_at,
         awaiting_customer_since = v_case.awaiting_customer_since,
         saved_at = v_case.saved_at,
         churned_at = v_case.churned_at,
         closed_at = coalesce(v_case.closed_at, case when v_new_stage in ('saved', 'cancelled', 'churned') then v_now else null end),
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
         scheduled_service_end_at = v_scheduled_end_at,
         ended_at = case when v_case.lifecycle_status = 'churned' then coalesce(ended_at, v_now) else ended_at end,
         version = version + 1
   where id = v_case.subscription_id;

  update public.students
     set lifecycle_status = v_case.lifecycle_status,
         pause_status = v_case.pause_status,
         version = version + 1
   where id = v_case.student_id;

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
    payload,
    source_system,
    source_confidence
  ) values (
    v_event_id,
    v_case.id,
    v_case.student_id,
    v_case.subscription_id,
    v_command,
    v_now,
    v_actor_uid,
    v_actor_name,
    v_actor_role,
    v_client_action_id,
    v_idempotency_key,
    v_payload,
    coalesce(nullif(trim(coalesce(p_command->>'source_system', '')), ''), 'api'),
    coalesce(nullif(trim(coalesce(p_command->>'source_confidence', '')), ''), 'high')
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
    jsonb_build_object('payload', v_payload, 'version', v_case.version)
  );

  insert into public.outbox_events (
    aggregate_type,
    aggregate_id,
    event_type,
    payload
  ) values (
    'retention_case',
    v_case.id,
    v_command,
    jsonb_build_object('case_id', v_case.id, 'subscription_id', v_case.subscription_id, 'student_id', v_case.student_id)
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

create or replace function public.retention_import_legacy_snapshot(p_payload jsonb)
returns jsonb
language plpgsql
as $$
declare
  v_dry_run boolean := coalesce((p_payload->>'dry_run')::boolean, true);
  v_students jsonb := coalesce(p_payload->'students', '[]'::jsonb);
  v_cases jsonb := coalesce(p_payload->'cases', '[]'::jsonb);
  v_events jsonb := coalesce(p_payload->'events', '[]'::jsonb);
begin
  return jsonb_build_object(
    'ok', true,
    'dry_run', v_dry_run,
    'students_received', jsonb_array_length(v_students),
    'cases_received', jsonb_array_length(v_cases),
    'events_received', jsonb_array_length(v_events)
  );
end;
$$;
