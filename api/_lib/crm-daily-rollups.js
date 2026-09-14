const { summarizeClosedSales } = require('./commercial-sales');
const { createFirestoreStore } = require('./crm-snapshot-store');
const { failure } = require('./datacrazy-ingestion');
// Reconcile counts from a complete source, never increment by a replayable notification.
async function publishDailyCounts({ businesses, source, period }, { store = createFirestoreStore() } = {}) {
  if (source?.status !== 'VALID' || !source.fetchCompleted || !source.paginationCompleted) throw failure('rollup_requires_complete_source');
  const summary = summarizeClosedSales({ businesses, period });
  const groups = new Map();
  for (const sale of summary.sales) {
    const row = groups.get(sale.dateKey) || { dateKey: sale.dateKey, count: 0, teveVenda: true, lastSaleAt: null };
    row.count++;
    const at = new Date(sale.business[sale.dateField]).toISOString();
    if (!row.lastSaleAt || at > row.lastSaleAt) row.lastSaleAt = at;
    groups.set(sale.dateKey, row);
  }
  const writes = [];
  for (const row of groups.values()) {
    const path = `crmLiveDailyRollups/${row.dateKey}`;
    const previous = await store.read(path);
    if (previous?.data.sourceFetchStartedAt > source.fetchStartedAt) continue;
    writes.push({ path, version: previous?.version ?? null, data: { ...previous?.data, ...row, sourceSnapshotId: source.snapshotId, sourceFetchStartedAt: source.fetchStartedAt, updatedAt: new Date().toISOString() } });
  }
  if (writes.length) await store.commit(writes);
}
module.exports = { publishDailyCounts };
