const { getDealValue, normalizeKey } = require('../../_lib/forecast-service');
const { formatSaoPauloDateKey } = require('./commercial-period');
const { parseCommercialDate, containsInstant } = require('./commercial-time');

// Same precedence as the Commercial dashboard: movement is only a legacy fallback.
const BUSINESS_CLOSING_DATE_FIELDS = ['wonAt', 'wonDate', 'gainedAt', 'gainAt', 'soldAt', 'soldDate', 'saleAt', 'closedAt', 'finishedAt', 'statusChangedAt', 'stageChangedAt', 'lastMovedAt'];
const getBusinessClosingDate = (business = {}) => {
  for (const field of BUSINESS_CLOSING_DATE_FIELDS) {
    if (!business[field]) continue;
    const date = parseCommercialDate(business[field]);
    if (date) return { date, field };
  }
  return { date: null, field: '' };
};
const getBusinessId = (business = {}) => String(business.id || business._id || business.uuid || business.businessId || business.external_id || '').trim();
const getPipelineKey = (business) => normalizeKey(business?.stage?.pipeline?.name || business?.pipeline?.name || business?.pipelineName);
const getStageKey = (business) => normalizeKey(business?.stage?.name || business?.stageName || business?.stage);
const chooseCommercialPipeline = (businesses = []) => businesses.some((business) => getPipelineKey(business) === normalizeKey('Funil principal'))
  ? normalizeKey('Funil principal') : normalizeKey('Conversão');

// Preserve explicit zero. Legacy ticket fallback is used only for a missing value
// and is surfaced by reconciliation; it is never silently certified as source money.
const getCommercialDealValue = business => {
  const raw = business?.total ?? business?.value;
  if (raw !== null && raw !== undefined && raw !== '' && Number.isFinite(Number(raw))) return Number(raw);
  return getDealValue(business);
};
const summarizeClosedSales = ({ businesses = [], period, pipelineKey = chooseCommercialPipeline(businesses) } = {}) => {
  const byId = new Map();
  const seenFacts = new Map();
  const excluded = [];
  for (const business of businesses) {
    const id = getBusinessId(business);
    const { date, field } = getBusinessClosingDate(business);
    const dateKey = date ? formatSaoPauloDateKey(date) : '';
    const facts = JSON.stringify([getPipelineKey(business),getStageKey(business),date?.toISOString()||'',getCommercialDealValue(business),business.attendant?.id||business.attendantId||'',business.attendant?.name||business.attendantName||'']);
    if (id && seenFacts.has(id) && seenFacts.get(id) !== facts) throw new Error('conflicting_duplicate_business');
    if (id) seenFacts.set(id, facts);
    const reason = getPipelineKey(business) !== pipelineKey ? 'other_pipeline'
      : getStageKey(business) !== normalizeKey('Fechado') ? 'not_closed'
      : !dateKey ? 'missing_closing_date'
      : !containsInstant(date, period) ? 'outside_period'
      : !id ? 'missing_business_id'
      : byId.has(id) ? 'duplicate' : '';
    if (reason) { excluded.push({ id, reason, dateKey, dateField: field }); continue; }
    byId.set(id, { id, business, value: getCommercialDealValue(business), dateKey, dateField: field });
  }
  const sales = [...byId.values()];
  return {
    actualValue: Math.round((sales.reduce((sum, sale) => sum + sale.value, 0) + Number.EPSILON) * 100) / 100,
    count: sales.length,
    pipelineKey,
    sales,
    excluded,
  };
};

module.exports = { getCommercialDealValue, BUSINESS_CLOSING_DATE_FIELDS, getBusinessClosingDate, getBusinessId, chooseCommercialPipeline, summarizeClosedSales };
