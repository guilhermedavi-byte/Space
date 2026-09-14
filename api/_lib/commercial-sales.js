const { getDealValue, normalizeKey } = require('../../_lib/forecast-service');
const { formatSaoPauloDateKey } = require('./commercial-period');

// Same precedence as the Commercial dashboard: movement is only a legacy fallback.
const BUSINESS_CLOSING_DATE_FIELDS = ['wonAt', 'wonDate', 'gainedAt', 'gainAt', 'soldAt', 'soldDate', 'saleAt', 'closedAt', 'finishedAt', 'statusChangedAt', 'stageChangedAt', 'lastMovedAt'];
const getBusinessClosingDate = (business = {}) => {
  for (const field of BUSINESS_CLOSING_DATE_FIELDS) {
    if (!business[field]) continue;
    const date = new Date(business[field]);
    if (!Number.isNaN(date.getTime())) return { date, field };
  }
  return { date: null, field: '' };
};
const getBusinessId = (business = {}) => String(business.id || business._id || business.uuid || business.businessId || business.external_id || '').trim();
const getPipelineKey = (business) => normalizeKey(business?.stage?.pipeline?.name || business?.pipeline?.name || business?.pipelineName);
const getStageKey = (business) => normalizeKey(business?.stage?.name || business?.stageName || business?.stage);
const chooseCommercialPipeline = (businesses = []) => businesses.some((business) => getPipelineKey(business) === normalizeKey('Funil principal'))
  ? normalizeKey('Funil principal') : normalizeKey('Conversão');

const summarizeClosedSales = ({ businesses = [], period, pipelineKey = chooseCommercialPipeline(businesses) } = {}) => {
  const byId = new Map();
  const excluded = [];
  for (const business of businesses) {
    const id = getBusinessId(business);
    const { date, field } = getBusinessClosingDate(business);
    const dateKey = date ? formatSaoPauloDateKey(date) : '';
    const reason = !id ? 'missing_business_id'
      : getPipelineKey(business) !== pipelineKey ? 'other_pipeline'
      : getStageKey(business) !== normalizeKey('Fechado') ? 'not_closed'
      : !dateKey ? 'missing_closing_date'
      : !period || dateKey < period.startDateKey || dateKey > period.endDateKey ? 'outside_period'
      : byId.has(id) ? 'duplicate' : '';
    if (reason) { excluded.push({ id, reason, dateKey, dateField: field }); continue; }
    byId.set(id, { id, business, value: getDealValue(business), dateKey, dateField: field });
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

module.exports = { BUSINESS_CLOSING_DATE_FIELDS, getBusinessClosingDate, getBusinessId, chooseCommercialPipeline, summarizeClosedSales };
