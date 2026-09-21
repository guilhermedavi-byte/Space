const { createReader } = require('./finance-v1-read');
const { readOverviewInvalidation, readOverviewSnapshot, closeStaleOverviewInvalidations } = require('./finance-dashboard-snapshot');

const saoPauloMonth = (date = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit' }).format(date).slice(0, 7);
const monthOf = value => /^\d{4}-\d{2}/.test(String(value || '')) ? String(value).slice(0, 7) : null;
const uniq = values => [...new Set(values.filter(Boolean))];
const paymentMonths = (snapshot = {}, fallback = saoPauloMonth()) => uniq([monthOf(snapshot.paymentDate), monthOf(snapshot.clientPaymentDate), monthOf(snapshot.confirmedDate), monthOf(snapshot.dueDate), fallback]);

async function rebuildOverviewMonths({ connectionId = process.env.FINANCE_CONNECTION_ID, months, reason = 'manual_rebuild', request } = {}) {
  const targetMonths = uniq(months?.length ? months : [saoPauloMonth()]);
  const reader = createReader({ connectionId, overviewReadModelRequired: false });
  const rebuilt = [];
  for (const month of targetMonths) {
    const result = await reader.get('overview', { month, fresh: '1', snapshot: '0' });
    rebuilt.push({ month, snapshot_at: result?.snapshot_at || result?.meta?.snapshot_at || null, revenue: result?.kpis?.revenue ?? null, overdue: result?.kpis?.overdue ?? null, delinquency: result?.kpis?.delinquency ?? null, freshness: result?.meta?.overdue_freshness || null, reason });
  }
  return { ok: true, rebuilt };
}

async function rebuildIfInvalidated({ connectionId = process.env.FINANCE_CONNECTION_ID, month = saoPauloMonth(), request } = {}) {
  const [snapshot, invalidation] = await Promise.all([
    readOverviewSnapshot(connectionId, month, { request }),
    readOverviewInvalidation(connectionId, { request })
  ]);
  const snapshotAt = Date.parse(String(snapshot?.snapshot_at || '')) || 0;
  const invalidatedAt = Date.parse(String(invalidation?.invalidated_at || '')) || 0;
  if (!snapshot || invalidatedAt > snapshotAt) return rebuildOverviewMonths({ connectionId, months: [month], reason: invalidation?.reason || 'invalidated', request });
  return { ok: true, rebuilt: [], current: { month, snapshot_at: snapshot.snapshot_at } };
}

module.exports = { saoPauloMonth, paymentMonths, rebuildOverviewMonths, rebuildIfInvalidated, closeStaleOverviewInvalidations };
