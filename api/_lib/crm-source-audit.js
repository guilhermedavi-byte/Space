const { summarizeClosedSales, getBusinessClosingDate, getBusinessId } = require('./commercial-sales');
const { getDealValue } = require('../../_lib/forecast-service');
const { failure } = require('./datacrazy-ingestion');
function auditSource(source, from, to) {
  const valid = s => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s;
  if (!valid(from) || !valid(to) || from > to || Date.parse(to) - Date.parse(from) > 366 * 86400000) throw failure('invalid_audit_period', { status: 400 });
  if (source.stale || !source.metadata?.fetchCompleted || !source.metadata?.paginationCompleted) throw failure('audit_requires_complete_source', { status: 503 });
  const summary = summarizeClosedSales({ businesses: source.businesses, period: { startDateKey: from, endDateKey: to } });
  const included = new Set(summary.sales.map(s => s.id));
  const reasons = new Map(summary.excluded.map(s => [s.id, s.reason]));
  const rows = source.businesses.map(b => {
    const id = getBusinessId(b);
    const closing = getBusinessClosingDate(b);
    return { id, number: b.number ?? b.code ?? null, name: b.lead?.name || b.name || b.leadName || '',
      closer: b.attendant?.name || b.attendantName || '', value: getDealValue(b), status: b.status || '',
      stage: b.stage?.name || b.stageName || '', pipeline: b.stage?.pipeline?.name || b.pipeline?.name || '',
      closingDateField: closing.field, closingDate: closing.date?.toISOString() || null, lastMovedAt: b.lastMovedAt || null,
      included: included.has(id), reason: included.has(id) ? 'closed_in_period' : reasons.get(id) };
  });
  return { period: { from, to, timezone: 'America/Sao_Paulo' }, source: source.metadata,
    actualValue: summary.actualValue, count: summary.count, includedIds: summary.sales.map(s => s.id), rows };
}
module.exports = { auditSource };
