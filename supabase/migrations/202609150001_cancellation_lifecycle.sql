-- Space canonical lifecycle. Apply AFTER retention-lifecycle-v2.sql and provisioning.
-- Additive data changes only; no inferred dates and no historical rewrites.
begin;
alter table public.subscriptions add column if not exists legacy_operational_suspended boolean not null default false;
alter table public.subscriptions alter column billing_cycle drop not null;
alter table public.outbox_events add column if not exists projection_delivered_at timestamptz;
alter table public.students drop constraint if exists students_lifecycle_status_check;
alter table public.students add constraint students_lifecycle_status_check check (lifecycle_status in ('active','cancellation_requested','cancellation_scheduled','churned'));
alter table public.subscriptions drop constraint if exists subscriptions_lifecycle_status_check;
alter table public.subscriptions add constraint subscriptions_lifecycle_status_check check (lifecycle_status in ('active','cancellation_requested','cancellation_scheduled','churned'));
alter table public.retention_cases drop constraint if exists retention_cases_lifecycle_status_check;
alter table public.retention_cases add constraint retention_cases_lifecycle_status_check check (lifecycle_status in ('active','cancellation_requested','cancellation_scheduled','churned'));
alter table public.subscriptions add column if not exists cancellation_requested_at timestamptz;
alter table public.subscriptions add column if not exists notice_started_at timestamptz;
alter table public.subscriptions add column if not exists last_active_date date;
alter table public.subscriptions add column if not exists churn_at date;
alter table public.subscriptions drop constraint if exists subscriptions_notice_dates_check;
alter table public.subscriptions add constraint subscriptions_notice_dates_check check (
 (notice_started_at is null and last_active_date is null and churn_at is null) or
 (notice_started_at is not null and last_active_date is not null and churn_at is not null and last_active_date = ((notice_started_at at time zone 'America/Sao_Paulo')::date + interval '2 months')::date and churn_at = last_active_date + 1)
);
alter table public.retention_cases add column if not exists cancellation_requested_at timestamptz;
alter table public.retention_cases add column if not exists notice_started_at timestamptz;
alter table public.retention_cases add column if not exists last_active_date date;
alter table public.retention_cases add column if not exists churn_at date;
alter table public.retention_cases drop constraint if exists retention_cases_notice_dates_check;
alter table public.retention_cases add constraint retention_cases_notice_dates_check check (
 (notice_started_at is null and last_active_date is null and churn_at is null) or
 (notice_started_at is not null and last_active_date is not null and churn_at is not null and last_active_date = ((notice_started_at at time zone 'America/Sao_Paulo')::date + interval '2 months')::date and churn_at = last_active_date + 1)
);

create or replace function public.retention_compute_scheduled_end_at(p_requested_at timestamptz, p_first_lesson_at timestamptz default null)
returns timestamptz language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
  -- Signature retained for database compatibility; the first argument is NOTICE START.
  if p_requested_at is null then raise exception 'notice_started_at_required'; end if;
  return (((p_requested_at at time zone 'America/Sao_Paulo')::date + interval '2 months')::date + time '12:00') at time zone 'America/Sao_Paulo';
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
    'studentSubscriptions', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from public.subscriptions x where x.student_id=rc.student_id),
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
      'cancellation_requested_at', rc.cancellation_requested_at,
      'notice_started_at', rc.notice_started_at,
      'last_active_date', rc.last_active_date,
      'churn_at', rc.churn_at,
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
      'cancellation_requested_at', sub.cancellation_requested_at,
      'notice_started_at', sub.notice_started_at,
      'last_active_date', sub.last_active_date,
      'churn_at', sub.churn_at,
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
      rc.cancellation_requested_at, rc.notice_started_at, rc.last_active_date, rc.churn_at,
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
      and (v_month is null or rc.closed_at is null or to_char(coalesce(rc.scheduled_service_end_at, rc.created_at) at time zone 'America/Sao_Paulo', 'YYYY-MM') = v_month)
    order by coalesce(rc.scheduled_service_end_at, rc.updated_at) asc, s.full_name asc
  ) x;

  select jsonb_build_object(
    'open', count(*) filter (where closed_at is null),
    'awaiting_customer', count(*) filter (where stage = 'awaiting_customer'),
    'requested', count(*) filter (where lifecycle_status='cancellation_requested' and closed_at is null),
    'scheduled', count(*) filter (where lifecycle_status='cancellation_scheduled' and closed_at is null),
    'saved', count(*) filter (where stage = 'saved' and closed_at is not null),
    'lost', count(*) filter (where stage = 'lost' and closed_at is not null)
  )
  into v_counts
  from public.retention_cases;

  return jsonb_build_object('rows', v_rows, 'counts', v_counts);
end;
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
  v_subscription public.subscriptions%rowtype;
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
    'delinquency_started',
    'delinquency_recovered'
  ) then
    raise exception 'unsupported_retention_command';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_idempotency_key, 0));

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

  if v_case_id is not null then
    select subscription_id into v_subscription_id from public.retention_cases where id=v_case_id;
  end if;
  select * into v_subscription from public.subscriptions where id=v_subscription_id for update;
  if not found then raise exception 'retention_subscription_not_found'; end if;
  if v_student_id is not null and v_student_id <> v_subscription.student_id then raise exception 'retention_subject_mismatch'; end if;
  v_student_id := v_subscription.student_id;

  if v_case_id is null then
    if v_command not in ('register_formal_request','register_preventive_intent','flag_risk') then raise exception 'retention_case_required'; end if;
    if v_subscription.lifecycle_status <> 'active' then raise exception 'request_requires_active_subscription'; end if;
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
      v_subscription.lifecycle_status,
      v_subscription.pause_status,
      v_subscription.financial_status,
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

  if v_case.closed_at is not null and v_command <> 'reactivate_subscription' then raise exception 'retention_case_closed'; end if;
  if v_command = 'reactivate_subscription' and exists(select 1 from public.retention_cases where subscription_id=v_case.subscription_id and id<>v_case.id and created_at>v_case.created_at) then raise exception 'retention_case_superseded'; end if;
  if v_case.lifecycle_status <> v_subscription.lifecycle_status and v_command <> 'reactivate_subscription' then raise exception 'retention_case_superseded'; end if;
  -- Independent financial/pause facts always come from the locked subscription.
  v_case.financial_status := v_subscription.financial_status;
  v_case.pause_status := v_subscription.pause_status;
  v_state_before := to_jsonb(v_case);
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
    if v_subscription.lifecycle_status <> 'active' or v_case.cancellation_requested_at is not null then raise exception 'request_requires_active_subscription'; end if;
    v_requested_at := coalesce(nullif(v_payload->>'requested_at','')::timestamptz,v_now);
    if v_requested_at > v_now then raise exception 'request_cannot_be_future'; end if;
    v_case.case_kind := 'formal';
    v_case.cancellation_requested_at := v_requested_at;
    v_case.lifecycle_status := 'cancellation_requested';
    v_new_stage := 'open';
    v_scheduled_end_at := v_subscription.scheduled_service_end_at;
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
    if v_case.lifecycle_status not in ('cancellation_requested','cancellation_scheduled') then raise exception 'request_not_open'; end if;
    v_case.lifecycle_status := 'active';
    v_scheduled_end_at := null;
    v_case.notice_started_at := null;
    v_case.last_active_date := null;
    v_case.churn_at := null;
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
  elsif v_command in ('confirm_cancellation_continuity','schedule_program_end') then
    if v_case.lifecycle_status <> 'cancellation_requested' then raise exception 'formal_request_not_started'; end if;
    v_case.notice_started_at := coalesce(nullif(v_payload->>'notice_started_at','')::timestamptz,v_now);
    if v_case.notice_started_at < v_case.cancellation_requested_at or v_case.notice_started_at > v_now then raise exception 'invalid_notice_start'; end if;
    v_case.last_active_date := ((v_case.notice_started_at at time zone 'America/Sao_Paulo')::date + interval '2 months')::date;
    v_case.churn_at := v_case.last_active_date + 1;
    v_scheduled_end_at := public.retention_compute_scheduled_end_at(v_case.notice_started_at);
    v_case.lifecycle_status := 'cancellation_scheduled';
    v_new_stage := 'scheduled';
  elsif v_command = 'effectuate_churn' then
    if v_case.lifecycle_status <> 'cancellation_scheduled' then
      raise exception 'cannot_churn_without_schedule';
    end if;
    if v_case.churn_at is null or v_case.notice_started_at is null then
      raise exception 'cannot_churn_without_scheduled_end_at';
    end if;
    if (v_now at time zone 'America/Sao_Paulo')::date < v_case.churn_at then
      raise exception 'cannot_churn_before_scheduled_end';
    end if;
    if v_case.closed_at is not null and v_case.stage = 'lost' then
      raise exception 'case_already_lost';
    end if;
    v_case.lifecycle_status := 'churned';
    v_new_stage := 'lost';
    v_case.churned_at := v_case.churn_at::timestamp at time zone 'America/Sao_Paulo';
    v_case.closed_at := v_now;
    v_close_reason := 'churned';
  elsif v_command = 'reactivate_subscription' then
    if v_case.lifecycle_status <> 'churned' then
      raise exception 'reactivation_requires_churned_case';
    end if;
    v_case.lifecycle_status := 'active';
    v_case.pause_status := 'none';
    v_scheduled_end_at := null;
    v_new_stage := 'saved';
    v_case.saved_at := coalesce(v_case.saved_at, v_now);
    v_case.closed_at := coalesce(v_case.closed_at, v_now);
    v_close_reason := 'reactivated';
  elsif v_command = 'delinquency_started' then
    v_case.financial_status := 'delinquent';
  elsif v_command = 'delinquency_recovered' then
    v_case.financial_status := 'current';
  end if;



  update public.retention_cases
     set case_kind = v_case.case_kind,
         cancellation_requested_at = v_case.cancellation_requested_at,
         notice_started_at = v_case.notice_started_at,
         last_active_date = v_case.last_active_date,
         churn_at = v_case.churn_at,
         risk_level = v_case.risk_level,
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
     set cancellation_requested_at = v_case.cancellation_requested_at,
         notice_started_at = case when v_case.lifecycle_status='active' then null else v_case.notice_started_at end,
         last_active_date = case when v_case.lifecycle_status='active' then null else v_case.last_active_date end,
         churn_at = case when v_case.lifecycle_status='active' then null else v_case.churn_at end,
         lifecycle_status = v_case.lifecycle_status,
         pause_status = v_case.pause_status,
         legacy_operational_suspended = case when v_command in ('resume_lessons','reactivate_subscription','pause_billable','pause_non_billable') then false else legacy_operational_suspended end,
         financial_status = v_case.financial_status,
         scheduled_service_end_at = v_scheduled_end_at,
         ended_at = case when v_case.lifecycle_status = 'churned' then v_case.churned_at when v_case.lifecycle_status = 'active' then null else ended_at end,
         version = version + 1
   where id = v_case.subscription_id;

  update public.students
     set lifecycle_status = (select x.lifecycle_status from public.subscriptions x where x.student_id=v_case.student_id
       order by case x.lifecycle_status when 'active' then 0 when 'cancellation_requested' then 1 when 'cancellation_scheduled' then 2 else 3 end limit 1),
         pause_status = v_case.pause_status,
         version = version + 1
   where id = v_case.student_id;

  v_state_after := jsonb_build_object(
    'stage', v_case.stage,
    'lifecycle_status', v_case.lifecycle_status,
    'pause_status', v_case.pause_status,
    'financial_status', v_case.financial_status,
    'scheduled_service_end_at', v_case.scheduled_service_end_at,
    'cancellation_requested_at', v_case.cancellation_requested_at,
    'notice_started_at', v_case.notice_started_at,
    'last_active_date', v_case.last_active_date,
    'churn_at', v_case.churn_at
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
    case v_command when 'register_formal_request' then 'cancellation.requested' when 'retract_cancellation' then 'cancellation.reverted' when 'confirm_cancellation_continuity' then 'notice.started' when 'schedule_program_end' then 'notice.started' when 'effectuate_churn' then 'student.churned' else v_command end,
    jsonb_build_object(
      'case_id', v_case.id,
      'subscription_id', v_case.subscription_id,
      'student_id', v_case.student_id,
      'event_id', v_event_id,
      'schema_version', 1,
      'billing_account_id', v_subscription.billing_account_id,
      'external_subscription_key', v_subscription.external_subscription_key,
      'mrr_brl', v_subscription.mrr_brl,
      'plan_name', v_subscription.plan_name,
      'firestore_student_id', (select firestore_student_id from public.students where id=v_case.student_id),
      'notice_started_at', v_case.notice_started_at,
      'last_active_date', v_case.last_active_date,
      'churn_at', v_case.churn_at,
      'financial_status', v_case.financial_status,
      'lifecycle_status', v_case.lifecycle_status
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
      and rc.notice_started_at is not null and rc.churn_at is not null
      and rc.churn_at <= v_now_sp::date
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
    and rc.notice_started_at is not null and rc.churn_at is not null
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
  if p_payload->>'mode' = 'backfill' then
    if jsonb_array_length(v_cases)<>0 or jsonb_array_length(v_events)<>0 then raise exception 'backfill_must_be_silent'; end if;
    if exists (select 1 from jsonb_array_elements(v_subscriptions) x where
      x->>'source_system' is distinct from 'legacy_backfill' or x->>'external_subscription_key' is null or
      x->>'lifecycle_status' not in ('active','churned') or
      coalesce(x->>'started_at',x->>'scheduled_service_end_at',x->>'ended_at',x->>'cancellation_requested_at',x->>'notice_started_at',x->>'last_active_date',x->>'churn_at') is not null)
    then raise exception 'invalid_silent_backfill_payload'; end if;
  end if;
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
    on conflict (firestore_student_id) do nothing returning id into v_student_id;
    if v_student_id is not null then v_students_written := v_students_written + 1; end if;
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
      started_at, scheduled_service_end_at, ended_at, source_system, legacy_source, legacy_confidence, cancellation_requested_at, notice_started_at, last_active_date, churn_at, legacy_operational_suspended
    ) values (
      v_student_id,
      nullif(v_row->>'external_subscription_key', ''),
      nullif(v_row->>'plan_name', ''),
      case when p_payload->>'mode'='backfill' then null else coalesce(nullif(v_row->>'billing_cycle', ''), 'monthly') end,
      coalesce(nullif(v_row->>'lifecycle_status', ''), 'active'),
      coalesce(nullif(v_row->>'pause_status', ''), 'none'),
      coalesce(nullif(v_row->>'financial_status', ''), 'unknown'),
      nullif(v_row->>'started_at', '')::timestamptz,
      nullif(v_row->>'scheduled_service_end_at', '')::timestamptz,
      nullif(v_row->>'ended_at', '')::timestamptz,
      coalesce(nullif(v_row->>'source_system', ''), 'legacy_import'),
      coalesce(v_row->'legacy_source', '{}'::jsonb),
      coalesce(nullif(v_row->>'legacy_confidence', ''), 'unknown'),
      nullif(v_row->>'cancellation_requested_at','')::timestamptz, nullif(v_row->>'notice_started_at','')::timestamptz,
      nullif(v_row->>'last_active_date','')::date, nullif(v_row->>'churn_at','')::date,
      coalesce((v_row->>'legacy_operational_suspended')::boolean,false)
    )
    on conflict (student_id, external_subscription_key) do nothing returning id into v_subscription_id;
    if v_subscription_id is not null then v_subscriptions_written := v_subscriptions_written + 1; end if;
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
      legacy_source, legacy_confidence, created_at, cancellation_requested_at, saved_at, notice_started_at, last_active_date, churn_at, churned_at
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
      coalesce(nullif(v_row->>'source_ref',''), 'legacy:' || md5(v_row::text)),
      nullif(v_row->>'scheduled_service_end_at', '')::timestamptz,
      nullif(v_row->>'closed_at', '')::timestamptz,
      nullif(v_row->>'close_reason', ''),
      coalesce(v_row->'legacy_source', '{}'::jsonb),
      coalesce(nullif(v_row->>'legacy_confidence', ''), 'unknown'),
      coalesce(nullif(v_row->>'created_at','')::timestamptz,now()), nullif(v_row->>'cancellation_requested_at','')::timestamptz,
      nullif(v_row->>'saved_at','')::timestamptz, nullif(v_row->>'notice_started_at','')::timestamptz,
      nullif(v_row->>'last_active_date','')::date, nullif(v_row->>'churn_at','')::date, nullif(v_row->>'churned_at','')::timestamptz
    )
    on conflict (source_system, source_ref) do nothing returning id into v_case_id;
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
      and source_ref = v_row->>'source_ref'
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
      jsonb_build_object(
        'stage', (select rc.stage from public.retention_cases rc where rc.id = v_case_id),
        'lifecycle_status', (select rc.lifecycle_status from public.retention_cases rc where rc.id = v_case_id),
        'pause_status', (select rc.pause_status from public.retention_cases rc where rc.id = v_case_id),
        'financial_status', (select rc.financial_status from public.retention_cases rc where rc.id = v_case_id),
        'scheduled_service_end_at', (select rc.scheduled_service_end_at from public.retention_cases rc where rc.id = v_case_id)
      ),
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
create or replace function public.retention_resolve_subject_by_firestore_student_id(p_firestore_student_id text)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_student uuid; v_subscription uuid; v_count integer;
begin
 select id into v_student from public.students where firestore_student_id=p_firestore_student_id;
 select count(*), (array_agg(id))[1] into v_count,v_subscription from public.subscriptions
 where student_id=v_student and lifecycle_status <> 'churned';
 if v_count=0 then
   select count(*),(array_agg(id))[1] into v_count,v_subscription from public.subscriptions where student_id=v_student;
 end if;
 if v_count>1 then raise exception 'retention_subscription_selection_required'; end if;
 if v_count=0 then return null; end if;
 return jsonb_build_object('student_id',v_student,'subscription_id',v_subscription,'firestore_student_id',p_firestore_student_id);
end;
$$;

-- Limit new service grants/receivables by SERVICE PERIOD, never by payment due date.
create or replace function public.retention_guard_service_period()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare v_new jsonb := to_jsonb(new); v_old jsonb; v_start date; v_end date; v_sub public.subscriptions%rowtype;
begin
 if tg_op='UPDATE' then
  v_old:=to_jsonb(old);
  if (v_new->>'subscription_id') is not distinct from (v_old->>'subscription_id')
   and (v_new->>'period_start') is not distinct from (v_old->>'period_start')
   and (v_new->>'period_end') is not distinct from (v_old->>'period_end')
   and (v_new->>'service_period_start') is not distinct from (v_old->>'service_period_start')
   and (v_new->>'service_period_end') is not distinct from (v_old->>'service_period_end') then return new; end if;
 end if;
 select * into v_sub from public.subscriptions where id=nullif(v_new->>'subscription_id','')::uuid for update;
 if not found then return new; end if; -- Legacy rows without contract identity remain reconciliation items.
 v_start:=nullif(coalesce(v_new->>'service_period_start',v_new->>'period_start'),'')::date;
 v_end:=nullif(coalesce(v_new->>'service_period_end',v_new->>'period_end'),'')::date;
 if v_sub.lifecycle_status in ('cancellation_scheduled','churned') then
  if v_sub.last_active_date is null then raise exception 'lifecycle_reconciliation_required'; end if;
  if v_start is null or v_end is null then raise exception 'service_period_required'; end if;
  if v_end < v_start or v_start>v_sub.last_active_date or v_end>v_sub.last_active_date then raise exception 'outside_student_service_period'; end if;
 end if;
 return new;
end;
$$;
drop trigger if exists retention_limit_service_period on public.service_periods;
create trigger retention_limit_service_period before insert or update on public.service_periods for each row execute function public.retention_guard_service_period();
drop trigger if exists retention_limit_charges on public.charges;
create trigger retention_limit_charges before insert or update on public.charges for each row execute function public.retention_guard_service_period();
do $$ begin
 if to_regclass('public.n8n_cobrancas_financeiras_space') is not null then
  alter table public.n8n_cobrancas_financeiras_space add column if not exists subscription_id uuid references public.subscriptions(id);
  alter table public.n8n_cobrancas_financeiras_space add column if not exists service_period_start date;
  alter table public.n8n_cobrancas_financeiras_space add column if not exists service_period_end date;
  drop trigger if exists retention_limit_manual_charges on public.n8n_cobrancas_financeiras_space;
  create trigger retention_limit_manual_charges before insert or update on public.n8n_cobrancas_financeiras_space for each row execute function public.retention_guard_service_period();
 end if;
end $$;
revoke all on function public.retention_guard_service_period() from public;

commit;
