const { uuid } = require('./finance-domain');
const { supabaseFetch } = require('./supabase-rest');
const { paymentCompetenceDate, isRevenueRow, originRuleMap, movementOrigin } = require('./finance-revenue-policy');

const MODEL_VERSION = 'finance_forecast_v2';
const OPEN = new Set(['PENDING', 'OVERDUE', 'DUNNING_REQUESTED']);
const CLOSED = new Set(['DELETED', 'REFUNDED', 'PARTIALLY_REFUNDED', 'CHARGEBACK_REQUESTED', 'CHARGEBACK_DISPUTE', 'AWAITING_CHARGEBACK_REVERSAL']);
const RECURRING = new Set(['RECURRING', 'RECURRING_FIRST_PAYMENT']);
const NON_RECURRING = new Set(['ACQUISITION_ONE_OFF', 'NON_RECURRING_OTHER']);
const MIN_SAMPLE = 12;
const HORIZONS = [1, 3, 7, 15, 30, 60, 90];

const dayKey = value => String(value || '').slice(0, 10);
const signedDayDiff = (from, to) => Math.floor((Date.parse(`${dayKey(to)}T00:00:00Z`) - Date.parse(`${dayKey(from)}T00:00:00Z`)) / 86400000);
const addDays = (dateKey, n) => { const d = new Date(`${dayKey(dateKey)}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const monthLastDay = month => `${month}-${new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate().toString().padStart(2, '0')}`;
const sum = (rows, get = x => x.value || 0) => rows.reduce((a, r) => a + (get(r) || 0), 0);
const pct = v => v == null ? null : Math.round(v * 10000) / 100;
const clamp01 = v => Math.max(0, Math.min(1, v));
const quantile = (values, q) => { const a = values.filter(Number.isFinite).sort((x, y) => x - y); if (!a.length) return null; const p = (a.length - 1) * q, b = Math.floor(p), r = p - b; return a[b] + ((a[b + 1] - a[b]) || 0) * r; };
const natureOf = r => String(r?.receivable_nature || r?.snapshot?.receivable_nature?.classification || r?.snapshot?.receivable_nature || 'UNKNOWN').toUpperCase();
const valueOf = r => Number.isSafeInteger(r?.value) ? r.value : Math.round(Number(r?.value || 0) * 100);

function makeRevenuePredicates({ payments, cases }) {
  const paymentById = new Map((payments || []).map(p => [p.asaas_payment_id, p]));
  const caseByMovement = new Map((cases || []).map(c => [c.movement_id, c]));
  const allocatedIds = new Set((cases || []).flatMap(c => Array.isArray(c.allocations) ? c.allocations.map(a => a.receivable_id).filter(Boolean) : []));
  const originRules = originRuleMap(cases || []);
  const revenueEligible = r => !allocatedIds.has(r.asaas_payment_id) && isRevenueRow(r, paymentById.get(r.asaas_payment_id), caseByMovement.get(`mov_${r.asaas_payment_id}`), originRules.get(movementOrigin(r)));
  const paidAt = r => paymentCompetenceDate(r, paymentById.get(r.asaas_payment_id));
  return { revenueEligible, paidAt };
}

function buildObservations({ rows, payments, cases, today }) {
  const { revenueEligible, paidAt } = makeRevenuePredicates({ payments, cases });
  const eligibleBase = r => !r.deleted && !CLOSED.has(r.status) && r.due_date && valueOf(r) > 0;
  const build = predicate => (rows || []).filter(r => eligibleBase(r) && predicate(r)).flatMap(r => {
    const paid = paidAt(r);
    if (revenueEligible(r) && paid) {
      const eventDay = signedDayDiff(r.due_date, paid);
      return [{ id: r.asaas_payment_id || r.id, value: valueOf(r), eventDay, paid: true, due: r.due_date }];
    }
    if (OPEN.has(r.status) && r.due_date < today) {
      return [{ id: r.asaas_payment_id || r.id, value: valueOf(r), eventDay: null, censorDay: signedDayDiff(r.due_date, today), paid: false, due: r.due_date }];
    }
    return [];
  });
  const recurring = build(r => RECURRING.has(natureOf(r)));
  if (recurring.filter(o => o.paid).length >= MIN_SAMPLE) return { observations: recurring, quality: 'recurring_classified', fallback_used: false };
  const fallback = build(r => !NON_RECURRING.has(natureOf(r)));
  return { observations: fallback, quality: recurring.length ? 'fallback_excluding_known_non_recurring' : 'fallback_legacy_excluding_known_non_recurring', fallback_used: true, recurring_sample: recurring.length };
}

function modelFromObservations(observations) {
  const paid = observations.filter(o => o.paid && Number.isFinite(o.eventDay));
  const sampleValue = sum(observations);
  const paidValue = sum(paid);
  const conditional = (currentDay, horizonDay) => {
    if (horizonDay <= currentDay) return { probability: 0, risk_value: 0, event_value: 0, sample_count: 0 };
    const risk = paid.filter(o => o.eventDay > currentDay);
    const riskValue = sum(risk);
    const events = risk.filter(o => o.eventDay <= horizonDay);
    const eventValue = sum(events);
    if (risk.length < MIN_SAMPLE || riskValue <= 0) return { probability: null, risk_value: riskValue, event_value: eventValue, sample_count: risk.length };
    return { probability: clamp01(eventValue / riskValue), risk_value: riskValue, event_value: eventValue, sample_count: risk.length };
  };
  const cumulative = horizonDay => {
    const eligible = paid.filter(o => o.eventDay <= horizonDay), eventValue = sum(eligible);
    return paidValue ? eventValue / paidValue : null;
  };
  return { conditional, cumulative, sample_count: observations.length, paid_sample_count: paid.length, sample_value: sampleValue, paid_sample_value: paidValue };
}

function openCurrentReceivables(rows, month, today) {
  return (rows || []).filter(r => !r.deleted && OPEN.has(r.status) && r.due_date?.startsWith(month) && valueOf(r) > 0 && RECURRING.has(natureOf(r)));
}

function buildFinanceForecastV2({ rows, payments, cases, today, month, financial, commercial_target }) {
  const end = monthLastDay(month);
  const { observations, quality, fallback_used, recurring_sample } = buildObservations({ rows, payments, cases, today });
  const model = modelFromObservations(observations);
  const currentOpen = openCurrentReceivables(rows, month, today);
  const unknownOpen = (rows || []).filter(r => !r.deleted && OPEN.has(r.status) && r.due_date?.startsWith(month) && natureOf(r) === 'UNKNOWN');
  let expectedNotDue = 0, notDueBase = 0, notDueEstimated = 0, recoveryMonth = 0, recoveryBase = 0, recoveryEstimated = 0, overdueD90 = 0, overdueD90Base = 0;
  const details = [];
  for (const r of currentOpen) {
    const value = valueOf(r), currentDay = signedDayDiff(r.due_date, today), horizonDay = signedDayDiff(r.due_date, end);
    const byClose = model.conditional(currentDay, horizonDay);
    const byD90 = model.conditional(currentDay, Math.max(90, currentDay));
    const expected = byClose.probability == null ? null : Math.round(value * byClose.probability);
    const expected90 = byD90.probability == null ? null : Math.round(value * byD90.probability);
    const bucket = r.due_date < today ? 'overdue' : 'not_due';
    if (bucket === 'overdue') { recoveryBase += value; if (expected != null) { recoveryMonth += expected; recoveryEstimated += value; } if (expected90 != null) { overdueD90 += expected90; overdueD90Base += value; } }
    else { notDueBase += value; if (expected != null) { expectedNotDue += expected; notDueEstimated += value; } }
    details.push({ id: r.asaas_payment_id || r.id, value, due_date: r.due_date, relative_day: currentDay, horizon_day: horizonDay, bucket, probability_by_month_end: byClose.probability == null ? null : pct(byClose.probability), expected_by_month_end: expected, probability_by_d90: byD90.probability == null ? null : pct(byD90.probability), expected_by_d90: expected90, sample_count: byClose.sample_count });
  }
  const expectedReceivables = expectedNotDue + recoveryMonth;
  const commercialValue = commercial_target?.value ?? null;
  const commercialRealized = commercial_target?.realized ?? null;
  const commercialGap = commercialValue == null || commercialRealized == null ? null : Math.max(commercialValue - commercialRealized, 0);
  const expectedNewSales = commercialGap;
  const realized = financial.faturamento || 0;
  const forecastOperational = realized + expectedReceivables;
  const projection = forecastOperational + (expectedNewSales || 0);
  const commercialAttainment = commercialValue && commercialRealized != null ? pct(commercialRealized / commercialValue) : null;
  const rates = HORIZONS.map(h => model.cumulative(h)).filter(v => v != null);
  const baseRate = model.cumulative(90);
  let scenarios = null, scenarioReason = '';
  if (rates.length >= 3 && expectedReceivables > 0) {
    const low = quantile(rates, .25), high = quantile(rates, .75), base = baseRate || quantile(rates, .5) || 1;
    { const conservativeRaw = realized + Math.round(expectedReceivables * (low / base)) + (expectedNewSales || 0); const upsideRaw = realized + Math.round(expectedReceivables * (high / base)) + (expectedNewSales || 0); scenarios = { method: 'forecast_v2_conditional_curve_plus_commercial_gap', conservative: Math.min(conservativeRaw, projection), base: projection, upside: Math.max(upsideRaw, projection), commercial_gap_added: expectedNewSales || 0, low_rate: pct(low), base_rate: pct(base), high_rate: pct(high) }; }
  } else scenarioReason = `Cenários indisponíveis: amostra ${model.paid_sample_count} abaixo do mínimo.`;
  const recoveredByHorizon = Object.fromEntries(HORIZONS.map(h => [`D+${h}`, { day: h, recovered_rate: pct(model.cumulative(h)), sample_count: model.paid_sample_count, sample_value: model.paid_sample_value }]));
  return { method: MODEL_VERSION, forecast_model_version: MODEL_VERSION, month, as_of: today, month_end: end, realized, expected_receivables: expectedReceivables, expected_remaining: expectedReceivables, expected_not_due: expectedNotDue, expected_not_due_base: notDueBase, expected_not_due_estimated_base: notDueEstimated, expected_not_due_rate: notDueEstimated ? pct(expectedNotDue / notDueEstimated) : null, expected_recovery_current_month: recoveryMonth, expected_recovery_current_month_base: recoveryBase, expected_recovery_current_month_estimated_base: recoveryEstimated, expected_recovery_current_month_rate: recoveryEstimated ? pct(recoveryMonth / recoveryEstimated) : null, expected_recovery_m15: 0, overdue_eventual_d90: overdueD90, overdue_eventual_d90_base: overdueD90Base, overdue_eventual_d90_rate: overdueD90Base ? pct(overdueD90 / overdueD90Base) : null, expected_new_sales: expectedNewSales, expected_new_sales_source: expectedNewSales == null ? 'unavailable' : 'commercial_goal_gap', expected_new_sales_label: expectedNewSales == null ? 'Dados comerciais indisponíveis' : 'Cenário considera meta comercial atingida', forecast_operational: forecastOperational, forecast_with_commercial_goal: projection, projection, projection_is_conservative: true, commercial_target: commercialValue, commercial_realized: commercialRealized, commercial_gap: commercialGap, commercial_current_attainment: commercialAttainment, commercial_projected_attainment: commercialValue && commercialRealized != null ? 100 : null, commercial_target_status: commercial_target?.status || 'unavailable', commercial_target_reason: commercial_target?.reason || null, target_gap: commercialGap == null ? null : 0, target_attainment: null, forecast_sample_quality: { quality, fallback_used, sample_count: model.paid_sample_count, sample_value: model.paid_sample_value, recurring_sample: recurring_sample ?? model.paid_sample_count, unknown_open_count: unknownOpen.length, unknown_open_value: sum(unknownOpen, valueOf) }, structural_d90: { value: overdueD90Base - overdueD90, total: overdueD90Base, rate: overdueD90Base ? pct((overdueD90Base - overdueD90) / overdueD90Base) : null, recovered_rate: overdueD90Base ? pct(overdueD90 / overdueD90Base) : null, sample_count: model.paid_sample_count, sample_value: model.paid_sample_value, cutoff: addDays(today, -90), window_start: addDays(today, -455) }, recovery_curve: recoveredByHorizon, recovery: { current_overdue_value: recoveryBase, expected_total: overdueD90, expected_by_month_end: recoveryMonth, expected_m15: 0, expected_eventual_d90: overdueD90, expected_loss: overdueD90Base - overdueD90, median_days: null, rates_by_band: [] }, receivable_forecast_items: details, breakdown: [{ id: 'realized', label: 'Já realizado', gross: realized, rate: 100, expected: realized }, { id: 'not_due', label: 'Ainda a vencer', gross: notDueBase, rate: notDueEstimated ? pct(expectedNotDue / notDueEstimated) : null, expected: expectedNotDue }, { id: 'recovery_month', label: 'Recuperação de vencidos até fechamento', gross: recoveryBase, rate: recoveryEstimated ? pct(recoveryMonth / recoveryEstimated) : null, expected: recoveryMonth }, { id: 'new_sales', label: 'Novas vendas até meta', gross: commercialGap, rate: commercialGap == null ? null : 100, expected: expectedNewSales, note: expectedNewSales == null ? 'Dados comerciais indisponíveis' : 'Cenário considera meta comercial atingida' }, { id: 'projection', label: 'Projeção total', gross: null, rate: null, expected: projection }], scenarios, scenario_range_available: Boolean(scenarios), scenario_reason: scenarioReason, historical_sample: model.paid_sample_count, historical_sample_value: model.paid_sample_value };
}

async function writeForecastSnapshot({ connectionId = process.env.FINANCE_CONNECTION_ID, month, today, forecast, request = supabaseFetch }) {
  if (!forecast || !month || !connectionId) return { ok: false, skipped: 'missing_data' };
  const conn = uuid(connectionId), forecastDate = dayKey(today || new Date().toISOString()), corr = `forecast:${MODEL_VERSION}:${month}:${forecastDate}`;
  const existing = await request(`/finance_audit_events?connection_id=eq.${conn}&object_type=eq.forecast&external_object_id=eq.${encodeURIComponent(month)}&action=eq.daily_snapshot&correlation_id=eq.${encodeURIComponent(corr)}&select=id&limit=1`, { timeoutMs: 5000 }).catch(() => ({ data: [] }));
  if (Array.isArray(existing.data) && existing.data.length) return { ok: true, skipped: 'already_saved' };
  const end = monthLastDay(month), daysToClose = signedDayDiff(forecastDate, end);
  const state = { forecast_date: forecastDate, competence: month, model_version: MODEL_VERSION, realized: forecast.realized, expected_receivables: forecast.expected_receivables, commercial_gap: forecast.commercial_gap, forecast_operational: forecast.forecast_operational, forecast_with_commercial_goal: forecast.forecast_with_commercial_goal, receivables_count: forecast.receivable_forecast_items?.length || 0, receivables_value: sum(forecast.receivable_forecast_items || [], x => x.value), sample_size: forecast.historical_sample, sample_value: forecast.historical_sample_value, sample_quality: forecast.forecast_sample_quality, days_to_closing: daysToClose };
  await request('/finance_audit_events', { method: 'POST', body: { connection_id: conn, source: 'SYSTEM', actor: 'finance_forecast_v2', object_type: 'forecast', external_object_id: month, action: 'daily_snapshot', state_after: state, correlation_id: corr }, headers: { Prefer: 'return=minimal' }, timeoutMs: 8000 }).catch(() => null);
  if (forecastDate > end) {
    const backtestCorr = `forecast-backtest:${MODEL_VERSION}:${month}:${forecastDate}`;
    const expected = forecast.forecast_with_commercial_goal, actual = forecast.realized, signedBias = expected - actual;
    await request('/finance_audit_events', { method: 'POST', body: { connection_id: conn, source: 'SYSTEM', actor: 'finance_forecast_v2', object_type: 'forecast', external_object_id: month, action: 'backtest_evaluated', state_after: { ...state, final_revenue: actual, absolute_error: Math.abs(signedBias), percent_error: actual ? pct(Math.abs(signedBias) / actual) : null, signed_bias: signedBias }, correlation_id: backtestCorr }, headers: { Prefer: 'return=minimal' }, timeoutMs: 8000 }).catch(() => null);
  }
  return { ok: true };
}

module.exports = { MODEL_VERSION, signedDayDiff, buildFinanceForecastV2, writeForecastSnapshot };
