const { supabaseFetch } = require('./supabase-rest');
const { uuid } = require('./finance-domain');

const SNAPSHOT_SOURCE = 'FINANCE_OVERVIEW_SNAPSHOT';
const INVALIDATION_SOURCE = 'FINANCE_OVERVIEW_INVALIDATION';
const RESOURCE = 'overview';
const OVERVIEW_SNAPSHOT_SCHEMA = 'finance_overview_2026_09_18_v9';
const memory = new Map();
const invalidations = new Map();

const monthKey = month => String(month || '').slice(0, 7);
const key = (connectionId, month) => `${uuid(connectionId)}__${monthKey(month)}`;
const validSnapshot = row => row && typeof row === 'object' && row.kind === 'finance_v1_overview' && row.schema === OVERVIEW_SNAPSHOT_SCHEMA && row.payload?.meta?.revenue_policy === 'backend_central_v1';
const rpc = (request, action, args) => request('/rpc/finance_rpc', { method: 'POST', body: { p_action: action, p_args: args } });

const latestRunReport = async (connectionId, source, request) => {
  const path = `/finance_sync_runs?connection_id=eq.${uuid(connectionId)}&source=eq.${encodeURIComponent(source)}&resource=eq.${RESOURCE}&status=eq.completed&select=id,report,started_at,finished_at&order=started_at.desc,id.desc&limit=30`;
  const result = await request(path, { method: 'GET', timeoutMs: 1500 });
  return Array.isArray(result.data) ? result.data : [];
};

const readOverviewSnapshot = async (connectionId, month, deps = {}) => {
  const request = deps.request || supabaseFetch;
  const id = key(connectionId, month);
  const cached = memory.get(id);
  if (validSnapshot(cached)) return cached;
  try {
    const rows = await latestRunReport(connectionId, SNAPSHOT_SOURCE, request);
    const found = rows.map(r => ({ ...(r.report || {}), run_id: r.id, snapshot_at: r.report?.snapshot_at || r.finished_at || r.started_at }))
      .find(r => r.month === monthKey(month) && validSnapshot(r));
    if (found) memory.set(id, found);
    return found || null;
  } catch (error) {
    return validSnapshot(cached) ? cached : null;
  }
};

const readOverviewInvalidation = async (connectionId, deps = {}) => {
  const request = deps.request || supabaseFetch;
  const id = uuid(connectionId);
  const cached = invalidations.get(id) || null;
  try {
    const rows = await latestRunReport(connectionId, INVALIDATION_SOURCE, request);
    const found = rows.map(r => ({ ...(r.report || {}), run_id: r.id, invalidated_at: r.report?.invalidated_at || r.finished_at || r.started_at }))
      .find(r => r.kind === 'finance_v1_overview_invalidation') || null;
    if (found) invalidations.set(id, found);
    return found || cached;
  } catch (error) {
    return cached;
  }
};

const writeReportRun = async (connectionId, source, report, request) => {
  const base = { connection_id: uuid(connectionId), source, resource: RESOURCE, dry_run: true, filters: { month: report.month || null, kind: report.kind }, offset: 0 };
  const started = await rpc(request, 'run_start', base);
  const run_id = started?.data?.run_id || started?.run_id;
  if (!run_id) throw Object.assign(new Error('finance_dashboard_snapshot_write_failed'), { status: 503 });
  await rpc(request, 'run_update', { connection_id: uuid(connectionId), run_id, next_offset: 0, status: 'completed', report });
  return { ...report, run_id };
};

const writeOverviewSnapshot = async (connectionId, month, payload, deps = {}) => {
  const request = deps.request || supabaseFetch;
  const snapshot_at = new Date().toISOString();
  const data = { id: key(connectionId, month), connection_id: uuid(connectionId), month: monthKey(month), kind: 'finance_v1_overview', schema: OVERVIEW_SNAPSHOT_SCHEMA, snapshot_at, payload };
  memory.set(data.id, data);
  try { return await writeReportRun(connectionId, SNAPSHOT_SOURCE, data, request); }
  catch (error) { memory.set(data.id, data); throw error; }
};

const invalidateOverviewSnapshots = async (connectionId, { reason = 'finance_data_changed' } = {}, deps = {}) => {
  const request = deps.request || supabaseFetch;
  const invalidated_at = new Date().toISOString();
  const data = { id: uuid(connectionId), connection_id: uuid(connectionId), kind: 'finance_v1_overview_invalidation', schema: OVERVIEW_SNAPSHOT_SCHEMA, invalidated_at, reason: String(reason || 'finance_data_changed').slice(0, 80) };
  invalidations.set(data.id, data);
  try { return await writeReportRun(connectionId, INVALIDATION_SOURCE, data, request); }
  catch (error) { invalidations.set(data.id, data); throw error; }
};

module.exports = { OVERVIEW_SNAPSHOT_SCHEMA, readOverviewSnapshot, readOverviewInvalidation, writeOverviewSnapshot, invalidateOverviewSnapshots };
