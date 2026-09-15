// Synthetic compliance probes against the ACTUAL legacy implementations.
// Exit 1 means the official Space policy is not met. No remote writes.
// node scripts/audit-cancellation-policy.js [--postgres]
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { isDeepStrictEqual } = require('node:util');
const { applyCommandToProjection, computeScheduledServiceEndAt, buildQueuesFromCases } = require('../api/_lib/retention-domain');
const { buildLegacyRetentionImportSnapshot } = require('../api/_lib/retention-import');
const { bookSlotForStudent } = require('../api/_lib/scheduling-core');
const root = path.resolve(__dirname, '..');
const probes = [];
function check(id, expected, observed, scope) {
  probes.push({ id, status: isDeepStrictEqual(expected, observed) ? 'PASS' : 'FAIL', expected, observed, scope });
}
async function main() {
  const requested = applyCommandToProjection({}, { event_type: 'register_formal_request', occurred_at: '2026-09-10T15:00:00Z' });
  check('A/B_request_is_distinct_from_notice', 'cancellation_requested', requested.lifecycleStatus, 'JS event projection');
  const reverted = applyCommandToProjection(requested, { event_type: 'retract_cancellation', occurred_at: '2026-09-12T15:00:00Z' });
  check('A_reverted_is_active_without_churn', { active: true, churn: null },
    { active: reverted.lifecycleStatus === 'active', churn: reverted.churnedAt }, 'Projection only; financial/access not verified');
  const imported = buildLegacyRetentionImportSnapshot({ dryRun: true, users: [{
    id: 'synthetic-student', tipo: 'student', nome: 'Synthetic', ativo: true,
    createdAt: '2026-01-01T15:00:00Z', cancelamentosAnteriores: [{ dataPedido: '2026-09-10T15:00:00Z',
      dataEfetivacao: '2026-09-12T15:00:00Z', desfecho: 'revertido', eventos: [] }],
  }] });
  check('A_import_reversal_must_not_be_churn', { stage: 'saved', lifecycle: 'active' },
    { stage: imported.payload.cases[0].stage, lifecycle: imported.payload.cases[0].lifecycle_status }, 'Dry-run import builder');
  const notice = applyCommandToProjection(requested, { event_type: 'confirm_cancellation_continuity', occurred_at: '2026-09-20T15:00:00Z' });
  check('B_notice_start_recorded_explicitly', '2026-09-20T15:00:00Z', notice.noticeStartedAt ?? null, 'JS event projection');
  const queues = buildQueuesFromCases([{ id: 'synthetic-case', case_kind: 'formal', stage: 'open', lifecycle_status: 'active' }]);
  check('B_open_request_not_in_notice_queue', 0, queues.avisos.length, 'Backend queue builder');
  check('D_notice_not_churned', { scheduled: true, churn: null },
    { scheduled: notice.lifecycleStatus === 'cancellation_scheduled', churn: notice.churnedAt }, 'Projection only; base/access/finance not verified');
  const bookedDate = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  const dow = new Date(bookedDate + 'T12:00:00Z').getUTCDay();
  // A closed student is not loaded by the real booking handler. Supply the same store
  // contract as that handler to demonstrate the domain cannot enforce lifecycle.
  const store = { config: { slotDurationMinutes: 30, tzOffsetMinutes: -180, minLeadTimeMinutes: 0, bufferMinutes: 0 },
    teachers: [{ id: 'synthetic-teacher', active: true, workHours: { [dow]: [{ startMin: 600, endMin: 660 }] } }],
    studentLifecycles: { 'synthetic-churned-student': { lifecycle_status: 'churned', last_active_date: '2026-01-01' } }, events: [], ranking: { order: ['synthetic-teacher'] } };
  const booking = bookSlotForStudent({ store, studentId: 'synthetic-churned-student', dateKey: bookedDate, startMin: 600 });
  check('E_booking_has_no_contract_boundary', false, booking.ok, 'Booking core; route also does not load lifecycle. Synthetic student label alone has no semantics in the core');
  // Same local contract day, month-end UTC rollover: July 30 23:30 SP = July 31 UTC; target September has only 30 days.
  const end = computeScheduledServiceEndAt({ noticeStartedAt: '2026-07-31T02:30:00Z' });
  const localDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(end);
  check('F_calendar_months_use_business_day', '2026-09-30', localDay, 'JS date arithmetic; request used because legacy has no notice argument');
  let postgres = { status: 'NOT_RUN' };
  if (process.argv.includes('--postgres')) postgres = await sqlProbes();
  const report = { observed_at: new Date().toISOString(), fixtures: 'SYNTHETIC_ONLY', production_writes: false,
    status: probes.some(row => row.status === 'FAIL') ? 'FAIL' : postgres.status === 'EXECUTED' ? 'PASS' : 'INCOMPLETE', probes, postgres,
    unverified: ['Financial and pedagogical end-to-end A-D', 'External credit/billing idempotency G',
      'Browser/API/database/metrics reconciliation', 'External n8n and Asaas contract boundaries'] };
  fs.mkdirSync(path.join(root, 'artifacts/cancellation-implementation'), { recursive: true });
  fs.writeFileSync(path.join(root, 'artifacts/cancellation-implementation/policy-probes.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ status: report.status, probes: probes.length, passed: probes.filter(p => p.status === 'PASS').length,
    failed: probes.filter(p => p.status === 'FAIL').length, postgres }));
  process.exitCode = report.status === 'PASS' ? 0 : report.status === 'FAIL' ? 1 : 2;
}
async function sqlProbes() {
  const name = `space_cancellation_audit_${randomUUID().slice(0, 8)}`;
  const docker = (args, input) => execFileSync('docker', args, { input, encoding: 'utf8', timeout: 60000, stdio: ['pipe', 'pipe', 'pipe'] });
  const sql = query => docker(['exec', '-i', name, 'psql', '-X', '-h', '127.0.0.1', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-Atq'], query).trim();
  let created = false;
  try {
    docker(['run', '--pull=never', '--network=none', '--name', name, '-e', 'POSTGRES_PASSWORD=synthetic-local-only', '-d', 'postgres:14-alpine']);
    created = true;
    for (let attempt = 0; ; attempt++) {
      try { sql('select 1;'); break; } catch (error) { if (attempt === 79) throw error; await new Promise(r => setTimeout(r, 250)); }
    }
    sql(fs.readFileSync(path.join(root, 'supabase/retention-lifecycle-v2.sql'), 'utf8'));
    sql(fs.readFileSync(path.join(root, 'supabase/migrations/202609150001_cancellation_lifecycle.sql'), 'utf8'));
    const observed = JSON.parse(sql(`
      begin;
      create temporary table observations (value jsonb);
      do $$ declare s uuid; sub uuid; r jsonb; c uuid; n timestamptz; result jsonb; begin
        insert into public.students(firestore_student_id,full_name) values ('synthetic','Synthetic') returning id into s;
        insert into public.subscriptions(student_id,financial_status,pause_status) values(s,'current','paused_billable') returning id into sub;
        r := public.retention_apply_command(jsonb_build_object('command','register_formal_request','student_id',s,'subscription_id',sub,
          'client_action_id','request','idempotency_key','request','command_fingerprint','request'));
        c := (r->>'case_id')::uuid;
        result := jsonb_build_object('request_lifecycle',r->'snapshot'->'case'->>'lifecycle_status',
          'financial_after_request',r->'snapshot'->'subscription'->>'financial_status',
          'pause_after_request',r->'snapshot'->'subscription'->>'pause_status');
        r := public.retention_apply_command(jsonb_build_object('command','retract_cancellation','case_id',c,
          'client_action_id','revert','idempotency_key','revert','command_fingerprint','revert'));
        result := result || jsonb_build_object('end_after_reversion',r->'snapshot'->'subscription'->>'scheduled_service_end_at');
        r := public.retention_apply_command(jsonb_build_object('command','register_formal_request','student_id',s,'subscription_id',sub,
          'client_action_id','request2','idempotency_key','request2','command_fingerprint','request2')); 
        c := (r->>'case_id')::uuid;
        -- Fixture has an explicitly confirmed notice and known last active day today.
        n := ((now() at time zone 'America/Sao_Paulo')::date - interval '2 months') at time zone 'America/Sao_Paulo';
        update public.retention_cases set cancellation_requested_at=n - interval '1 day' where id=c;
        r := public.retention_apply_command(jsonb_build_object('command','confirm_cancellation_continuity','case_id',c,
          'client_action_id','notice','idempotency_key','notice','command_fingerprint','notice', 'payload',jsonb_build_object('notice_started_at',n)));
        begin
          perform public.retention_apply_command(jsonb_build_object('command','effectuate_churn','case_id',c,
            'client_action_id','early','idempotency_key','early','command_fingerprint','early'));
          result := result || jsonb_build_object('churn_on_last_day',true);
        exception when others then
          if SQLERRM <> 'cannot_churn_before_scheduled_end' then raise; end if;
          result := result || jsonb_build_object('churn_on_last_day',false);
        end;
        -- A second, unambiguously expired notice for the retry check.
        n := n - interval '1 month';
        update public.retention_cases set notice_started_at=n, last_active_date=((n at time zone 'America/Sao_Paulo')::date + interval '2 months')::date,
          churn_at=((n at time zone 'America/Sao_Paulo')::date + interval '2 months')::date + 1 where id=c;
        r := public.retention_apply_command(jsonb_build_object('command','effectuate_churn','case_id',c,
          'client_action_id','churn','idempotency_key','churn','command_fingerprint','churn'));
        result := result || jsonb_build_object('churn_at_is_processing_time',(r->'snapshot'->'case'->>'churned_at')::timestamptz=now());
        r := public.retention_apply_command(jsonb_build_object('command','effectuate_churn','case_id',c,
          'client_action_id','churn','idempotency_key','churn','command_fingerprint','churn'));
        result := result || jsonb_build_object('retry_idempotent',r->'idempotent',
          'churn_event_count',(select count(*) from public.retention_events where case_id=c and event_type='cancellation_effective'));
        insert into observations values(result);
      end $$;
      select value from observations;
      rollback;`));
    check('A_SQL_reversion_clears_current_end', null, observed.end_after_reversion, 'Actual RPC in disposable PostgreSQL');
    check('B_SQL_request_preserves_financial_status', 'current', observed.financial_after_request, 'Actual RPC');
    check('B_SQL_request_preserves_independent_pause', 'paused_billable', observed.pause_after_request, 'Actual RPC');
    check('C_SQL_no_churn_on_last_active_day', false, observed.churn_on_last_day, 'Actual RPC, business-day midnight fixture');
    check('G_SQL_same_command_retry_is_idempotent', { retry: true, count: 1 },
      { retry: observed.retry_idempotent, count: observed.churn_event_count }, 'Actual RPC; does not prove downstream delivery');
    return { status: 'EXECUTED', engine: 'postgres:14-alpine', network: 'none', observations: observed };
  } finally {
    if (created) docker(['rm', '-f', name]);
  }
}
main().catch(error => { console.error(JSON.stringify({ status: 'AUDIT_ERROR', error: error.code || 'probe_failed' })); process.exitCode = 2; });
