create or replace function public.retention_provision_subject(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_student jsonb := coalesce(p_payload->'student', '{}'::jsonb);
  v_billing jsonb := coalesce(p_payload->'billing_account', '{}'::jsonb);
  v_subscription jsonb := coalesce(p_payload->'subscription', '{}'::jsonb);
  v_service_period jsonb := coalesce(p_payload->'service_period', '{}'::jsonb);
  v_firestore_student_id text := nullif(trim(coalesce(v_student->>'firestore_student_id', '')), '');
  v_student_id uuid;
  v_billing_account_id uuid;
  v_subscription_id uuid;
  v_service_period_id uuid;
  v_period_start date;
  v_period_end date;
begin
  if v_firestore_student_id is null then
    raise exception 'missing_firestore_student_id';
  end if;

  if nullif(trim(coalesce(v_student->>'full_name', '')), '') is null then
    raise exception 'missing_student_full_name';
  end if;

  if nullif(trim(coalesce(v_billing->>'display_name', '')), '') is null then
    raise exception 'missing_billing_account_display_name';
  end if;

  if nullif(trim(coalesce(v_billing->>'external_key', '')), '') is null then
    raise exception 'missing_billing_account_external_key';
  end if;

  if nullif(trim(coalesce(v_subscription->>'external_subscription_key', '')), '') is null then
    raise exception 'missing_external_subscription_key';
  end if;

  v_period_start := nullif(trim(coalesce(v_service_period->>'period_start', '')), '')::date;
  v_period_end := nullif(trim(coalesce(v_service_period->>'period_end', '')), '')::date;
  if v_period_start is null or v_period_end is null then
    raise exception 'missing_service_period_bounds';
  end if;

  if v_period_end < v_period_start then
    raise exception 'invalid_service_period_bounds';
  end if;

  perform pg_advisory_xact_lock(hashtext(v_firestore_student_id));

  insert into public.billing_accounts (
    external_key,
    display_name,
    email,
    phone,
    source_system,
    legacy_source,
    legacy_confidence
  )
  values (
    nullif(trim(coalesce(v_billing->>'external_key', '')), ''),
    trim(coalesce(v_billing->>'display_name', '')),
    nullif(trim(coalesce(v_billing->>'email', '')), ''),
    nullif(trim(coalesce(v_billing->>'phone', '')), ''),
    coalesce(nullif(trim(coalesce(v_billing->>'source_system', '')), ''), 'firestore_on_demand'),
    coalesce(v_billing->'legacy_source', '{}'::jsonb),
    coalesce(nullif(trim(coalesce(v_billing->>'legacy_confidence', '')), ''), 'low')
  )
  on conflict (external_key) do update set
    display_name = excluded.display_name,
    email = excluded.email,
    phone = excluded.phone,
    source_system = excluded.source_system,
    legacy_source = excluded.legacy_source,
    legacy_confidence = excluded.legacy_confidence
  returning id into v_billing_account_id;

  insert into public.students (
    firestore_student_id,
    full_name,
    email,
    phone,
    lifecycle_status,
    pause_status,
    source_system,
    legacy_source,
    legacy_confidence
  )
  values (
    v_firestore_student_id,
    trim(coalesce(v_student->>'full_name', '')),
    nullif(trim(coalesce(v_student->>'email', '')), ''),
    nullif(trim(coalesce(v_student->>'phone', '')), ''),
    coalesce(nullif(trim(coalesce(v_student->>'lifecycle_status', '')), ''), 'active'),
    coalesce(nullif(trim(coalesce(v_student->>'pause_status', '')), ''), 'none'),
    coalesce(nullif(trim(coalesce(v_student->>'source_system', '')), ''), 'firestore_on_demand'),
    coalesce(v_student->'legacy_source', '{}'::jsonb),
    coalesce(nullif(trim(coalesce(v_student->>'legacy_confidence', '')), ''), 'medium')
  )
  on conflict (firestore_student_id) do update set
    full_name = excluded.full_name,
    email = excluded.email,
    phone = excluded.phone,
    lifecycle_status = excluded.lifecycle_status,
    pause_status = excluded.pause_status,
    source_system = excluded.source_system,
    legacy_source = excluded.legacy_source,
    legacy_confidence = excluded.legacy_confidence
  returning id into v_student_id;

  insert into public.subscriptions (
    student_id,
    billing_account_id,
    external_subscription_key,
    plan_name,
    billing_cycle,
    lifecycle_status,
    pause_status,
    financial_status,
    started_at,
    scheduled_service_end_at,
    ended_at,
    source_system,
    legacy_source,
    legacy_confidence
  )
  values (
    v_student_id,
    v_billing_account_id,
    nullif(trim(coalesce(v_subscription->>'external_subscription_key', '')), ''),
    nullif(trim(coalesce(v_subscription->>'plan_name', '')), ''),
    coalesce(nullif(trim(coalesce(v_subscription->>'billing_cycle', '')), ''), 'monthly'),
    coalesce(nullif(trim(coalesce(v_subscription->>'lifecycle_status', '')), ''), 'active'),
    coalesce(nullif(trim(coalesce(v_subscription->>'pause_status', '')), ''), 'none'),
    coalesce(nullif(trim(coalesce(v_subscription->>'financial_status', '')), ''), 'unknown'),
    nullif(trim(coalesce(v_subscription->>'started_at', '')), '')::timestamptz,
    nullif(trim(coalesce(v_subscription->>'scheduled_service_end_at', '')), '')::timestamptz,
    nullif(trim(coalesce(v_subscription->>'ended_at', '')), '')::timestamptz,
    coalesce(nullif(trim(coalesce(v_subscription->>'source_system', '')), ''), 'firestore_on_demand'),
    coalesce(v_subscription->'legacy_source', '{}'::jsonb),
    coalesce(nullif(trim(coalesce(v_subscription->>'legacy_confidence', '')), ''), 'low')
  )
  on conflict (student_id, external_subscription_key) do update set
    billing_account_id = excluded.billing_account_id,
    plan_name = excluded.plan_name,
    billing_cycle = excluded.billing_cycle,
    lifecycle_status = excluded.lifecycle_status,
    pause_status = excluded.pause_status,
    financial_status = excluded.financial_status,
    started_at = coalesce(excluded.started_at, public.subscriptions.started_at),
    scheduled_service_end_at = excluded.scheduled_service_end_at,
    ended_at = excluded.ended_at,
    source_system = excluded.source_system,
    legacy_source = excluded.legacy_source,
    legacy_confidence = excluded.legacy_confidence
  returning id into v_subscription_id;

  insert into public.service_periods (
    subscription_id,
    period_start,
    period_end,
    source_system,
    legacy_source,
    legacy_confidence
  )
  values (
    v_subscription_id,
    v_period_start,
    v_period_end,
    coalesce(nullif(trim(coalesce(v_service_period->>'source_system', '')), ''), 'firestore_on_demand'),
    coalesce(v_service_period->'legacy_source', '{}'::jsonb),
    coalesce(nullif(trim(coalesce(v_service_period->>'legacy_confidence', '')), ''), 'low')
  )
  on conflict (subscription_id, period_start, period_end) do update set
    source_system = excluded.source_system,
    legacy_source = excluded.legacy_source,
    legacy_confidence = excluded.legacy_confidence
  returning id into v_service_period_id;

  return jsonb_build_object(
    'ok', true,
    'firestore_student_id', v_firestore_student_id,
    'student_id', v_student_id,
    'billing_account_id', v_billing_account_id,
    'subscription_id', v_subscription_id,
    'service_period_id', v_service_period_id
  );
end;
$$;

do $$
begin
  execute 'revoke all on function public.retention_provision_subject(jsonb) from public';
  if exists(select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on function public.retention_provision_subject(jsonb) from anon';
  end if;
  if exists(select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on function public.retention_provision_subject(jsonb) from authenticated';
  end if;
  if exists(select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant execute on function public.retention_provision_subject(jsonb) to service_role';
  end if;
end;
$$;
