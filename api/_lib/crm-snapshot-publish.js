const crypto = require('crypto');
const { createFirestoreStore } = require('./crm-snapshot-store');
const { failure, log } = require('./datacrazy-ingestion');
const CALCULATION_VERSION = 4;
function assessStoredSnapshot(payload, canonicalRows, scope = 'week') {
  const { compareDealLedgers } = require('./commercial-reconciliation');
  const snapshot = payload?.snapshot || {};
  const aggregate = scope === 'month' ? payload?.month?.summary : payload?.weekly?.team?.closers;
  const revenue = scope === 'month' ? aggregate?.realizado : aggregate?.actualValue;
  const rows = scope === 'month' ? snapshot.monthlyIncludedDeals : snapshot.includedDeals;
  const canonicalRevenue = canonicalRows.reduce((s,d)=>s+d.value,0);
  const delta = Number.isFinite(revenue) ? Math.round((revenue-canonicalRevenue)*100)/100 : null;
  const comparison = compareDealLedgers(canonicalRows, rows);
  const complete = snapshot.fetchCompleted === true && snapshot.paginationCompleted === true;
  const status = !payload || delta === null ? 'INVALID'
    : delta !== 0 ? 'STALE'
    : !complete || (snapshot.expectedPages != null && snapshot.pagesFetched !== snapshot.expectedPages) ? 'INCOMPLETE'
    : !comparison.pass ? 'INVALID' : 'RECONCILED';
  return { status, generated_at:payload?.generatedAt || snapshot.calculatedAt || null,
    source_completeness:complete?true:snapshot.fetchCompleted===false||snapshot.paginationCompleted===false?false:null, page_count:snapshot.pagesFetched ?? null, expected_page_count:snapshot.expectedPages ?? null,
    deal_count:scope==='month' ? aggregate?.totalVendas ?? null : aggregate?.count ?? null,
    revenue:revenue ?? null, canonical_revenue:canonicalRevenue, delta, comparison };
}
function validateCrmSnapshot(payload) {
  const m = payload.snapshot;
  const week = payload.weekly?.team?.closers;
  const month = payload.month?.summary;
  if (!m || m.status !== 'VALID' || m.calculationVersion !== CALCULATION_VERSION || !m.fetchCompleted || !m.paginationCompleted || !m.calculationCompleted || (m.expectedPages !== null && m.pagesFetched !== m.expectedPages)) throw failure('snapshot_quality_gate_failed');
  if (m.recordsEligible > m.recordsConsidered) throw failure('invalid_eligible_count');
  if (!week || !month || ![week.actualValue, week.count, month.realizado, month.totalVendas].every(Number.isFinite)) throw failure('invalid_snapshot_metrics');
  for (const [deals, value, count] of [[m.includedDeals, week.actualValue, week.count], [m.monthlyIncludedDeals, month.realizado, month.totalVendas]]) {
    if (!Array.isArray(deals) || deals.length !== count || new Set(deals.map(d=>d.id)).size !== deals.length ||
        deals.some(d=>!d.id || !d.weekKey || !d.competencia || !d.responsibleId || !d.dateField || !d.dateKey || !d.status || !d.role || !Number.isFinite(d.value)) ||
        Math.abs(deals.reduce((s,d)=>s+d.value,0)-value)>0.005) throw failure('snapshot_deal_reconciliation_failed');
  }
  for (const metric of [m.reconciliation?.month,m.reconciliation?.week]) {
    if (!metric || ['monthly_weekly_delta','overlapping_periods','improper_gaps','orphan_deals','unallocated_revenue','duplicate_attribution_revenue','estimated_value_deals','invalid_financial_deals','unverified_revenue_dates'].some(k=>metric[k] !== 0)) throw failure('snapshot_ledger_invariant_failed');
  }
  const rows = payload.weekly.closers || [];
  for (const row of rows) {
    const attributed=m.includedDeals.filter(d=>d.responsibleId===row.personId);
    if(attributed.length!==row.count || Math.abs(attributed.reduce((s,d)=>s+d.value,0)-row.actualValue)>0.005) throw failure('snapshot_role_reconciliation_failed');
  }
  if (new Set(rows.map(r => r.personId)).size !== rows.length || Math.abs(rows.reduce((s,r)=>s+r.actualValue,0) - week.actualValue) > 0.005 || rows.reduce((s,r)=>s+r.count,0) !== week.count) throw failure('snapshot_reconciliation_failed');
}
async function publishCrmSnapshot(payload, { store = createFirestoreStore(), logger = log } = {}) {
  validateCrmSnapshot(payload);
  const snapshot = payload.snapshot;
  const path = 'crmLiveCache/crm';
  const prior = await store.read(path);
  const previous = prior?.data.payload?.snapshot;
  // Source chronology is primary. Completion order must not let an older dataset overwrite a newer one.
  if (previous && (previous.fetchStartedAt > snapshot.fetchStartedAt ||
    (previous.fetchStartedAt === snapshot.fetchStartedAt && (previous.calculationStartedAt || previous.calculatedAt) >= (snapshot.calculationStartedAt || snapshot.calculatedAt)))) return prior.data.payload;
  const record = { payload, generatedAt: snapshot.calculatedAt, snapshot };
  const writes = [
    { path, data: record, version: prior?.version ?? null },
    { path: `crmLiveSnapshots/${snapshot.snapshotId}`, data: record },
  ];
  // Keep the previous useful snapshot as history on the first migration, too.
  if (prior?.data.payload && !previous) writes.push({ path: `crmLiveSnapshots/legacy-${crypto.createHash('sha256').update(JSON.stringify(prior.data)).digest('hex')}`, data: prior.data });
  try { await store.commit(writes); }
  catch (error) {
    if ([409, 412].includes(error.status)) {
      const winner = await store.read(path);
      if (winner?.data.payload?.snapshot?.status === 'VALID') return winner.data.payload;
    }
    throw error;
  }
  logger('snapshot_published', { snapshotId: snapshot.snapshotId, sourceSnapshotId: snapshot.sourceSnapshotId,
    eligible_deals_count: snapshot.recordsEligible, actualValue: payload.weekly.team.closers.actualValue, count: payload.weekly.team.closers.count,
    data_freshness_lag: Math.max(0, Date.now() - Date.parse(snapshot.fetchCompletedAt)), durationMs: snapshot.durationMs });
  return payload;
}
async function runCrmSnapshot(build, { store = createFirestoreStore(), logger = log } = {}) {
  const snapshotId = crypto.randomUUID();
  const path = `crmLiveSnapshots/${snapshotId}`;
  const processing = { snapshotId, status: 'PROCESSING', calculationVersion: CALCULATION_VERSION, startedAt: new Date().toISOString(), calculatedAt: null, fetchStartedAt: null, fetchCompletedAt: null, sourceMaxDate: null, recordsFetched: 0, recordsEligible: 0, pagesFetched: 0, expectedPages: null, requestsCount: 0, retryCount: 0, durationMs: 0, error: null };
  await store.commit([{ path, data: { snapshot: processing }, version: null }]);
  try {
    const payload = await build(snapshotId);
    validateCrmSnapshot(payload);
    logger('snapshot_validated', { snapshotId, period: payload.snapshot.period, includedDeals: payload.snapshot.includedDeals });
    return await publishCrmSnapshot(payload, { store, logger });
  } catch (error) {
    await store.commit([{ path, data: { snapshot: { ...processing, ...(error.syncMetadata || error.sourceAttempt || {}), snapshotId, status: 'FAILED', durationMs: Date.now() - Date.parse(processing.startedAt), failedAt: new Date().toISOString(), error: { code: error.code || error.message, status: error.status || 0 }, sourceAttempt: error.sourceAttempt || null } } }])
      .catch(() => logger('snapshot_failure_record_failed', { snapshotId }));
    logger('snapshot_failed', { snapshotId, code: error.code || error.message });
    throw error;
  }
}
module.exports = { CALCULATION_VERSION, assessStoredSnapshot, validateCrmSnapshot, publishCrmSnapshot, runCrmSnapshot };
