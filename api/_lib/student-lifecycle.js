const policy = require('../../assets/student-lifecycle');
const { supabaseFetch } = require('./supabase-rest');
const { isRetentionV2Enabled } = require('./retention-flags');
const error = (code, status=409) => Object.assign(new Error(code), { code, status });
function fromLegacy(row = {}) {
  if (row.lifecycle) return row.lifecycle;
  const c = row.cancelamento;
  const reverted = /revert|saved/.test(String(c?.desfecho?.tipo || c?.desfecho || ''));
  return { lifecycle_status: c && !reverted ? 'cancellation_requested' : 'active',
    administratively_inactive: row.ativo === false,
    reconciliation_required: !!(c && !reverted && (c.dataFimAviso || c.dataEfetivacao || c.desfecho)),
    source: 'legacy_compatibility' };
}
function aggregate(subscriptions) {
  if (!subscriptions?.length) return null;
  const rows = subscriptions.map(row => ({ ...row,
    reconciliation_required: row.lifecycle_status === 'cancellation_scheduled' && !row.notice_started_at,
    source: 'subscriptions' }));
  return { subscriptions: rows, source: 'subscriptions' };
}
async function getForStudent(id, fallback) {
  if (!isRetentionV2Enabled()) return fromLegacy(fallback);
  if (!id) throw error('lifecycle_student_required');
  const { data } = await supabaseFetch(`/students?select=id,created_at,subscriptions(*),retention_events(*)&firestore_student_id=eq.${encodeURIComponent(id)}`);
  const value = aggregate(data?.[0]?.subscriptions);
  if (value) return {...value,events:data[0].retention_events || [],created_at:data[0].created_at};
  if (fallback) return fromLegacy(fallback);
  // Never silently grant rights when a canonical subject cannot be found.
  throw error('lifecycle_subject_unavailable',503);
}
function contracts(value) { return value?.subscriptions || [value]; }
function isActiveOn(value, day) { return contracts(value).some(row => policy.isActiveOn(row,day)); }
function canScheduleFor(value, day, now) { return contracts(value).some(row => policy.canScheduleFor(row,day,now)); }
function effective(value, on = new Date()) {
  const rows = contracts(value);
  return rows.find(row => policy.isActiveOn(row,on) && !policy.getLastActiveDate(row)) ||
    rows.filter(row => policy.isActiveOn(row,on)).sort((a,b) => String(policy.getLastActiveDate(b)).localeCompare(String(policy.getLastActiveDate(a))))[0] || rows[0];
}
async function decorateStudent(row) {
  if (!isRetentionV2Enabled() || !['student','aluno'].includes(String(row?.tipo || row?.role || '').toLowerCase())) return row;
  const value = await getForStudent(row.firestoreDocId || row.id,row);
  const chosen = effective(value);
  // Aggregate is retained; UI uses all subscriptions, not the status of the last command.
  return { ...policy.toLegacyStudent(row,value), lifecycleEvents:value.events || [], lifecycleCreatedAt:value.created_at || row.createdAt || row.criadoEm || null, lifecycleSubscriptions: value.subscriptions || [chosen] };
}
async function assertSchedule(id, date, fallback) {
  if (!isRetentionV2Enabled()) return;
  const value = await getForStudent(id,fallback);
  if (!canScheduleFor(value,date)) throw error('outside_student_service_period');
  return value;
}
async function assertAccess(id, fallback) {
  if (!isRetentionV2Enabled()) return;
  const value = await getForStudent(id,fallback);
  if (!isActiveOn(value,new Date())) throw error('student_service_ended',403);
}
async function assertObligation(id, start, end, subscriptionId) {
  if (!isRetentionV2Enabled()) return;
  if (!start || !end) throw error('service_period_required');
  const value = await getForStudent(id);
  const rows = contracts(value).filter(row => !subscriptionId || row.id === subscriptionId);
  if (rows.length !== 1) throw error('unambiguous_subscription_required');
  if (!policy.canCreateObligationFor(rows[0],start,end)) throw error('outside_student_service_period');
  return rows[0];
}
// Shared boundary for Firestore scheduling writers (including partial reschedules).
async function assertScheduleWrite(docPath, data, readExisting) {
  if (!isRetentionV2Enabled() || !/^(aulas|events)\//.test(docPath)) return;
  let row = data || {};
  if (!row.alunoId && !row.studentId || !row.dateKey) row = { ...(await readExisting()), ...row };
  // Cancellation/status/history operations never destroy/refund rights here.
  if (['cancelado','cancelada','concluido','realizada','falta'].includes(row.status)) return;
  const id = row.alunoId || row.studentId;
  if (id && row.dateKey) await assertSchedule(id,row.dateKey);
  for (const member of row.studentIds || []) await assertSchedule(member,row.dateKey);
}
module.exports = { ...policy, fromLegacy, aggregate, contracts, effective, getForStudent, isActiveOn, canScheduleFor,
  decorateStudent, assertSchedule, assertAccess, assertObligation, assertScheduleWrite };
