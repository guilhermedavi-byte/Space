const test = require('node:test');
const assert = require('node:assert/strict');
const { signedDayDiff, buildFinanceForecastV2 } = require('../api/_lib/finance-forecast-v2');

test('signed payment timing preserves early payments', () => {
  assert.equal(signedDayDiff('2026-09-10', '2026-09-08'), -2);
  assert.equal(signedDayDiff('2026-09-10', '2026-09-09'), -1);
  assert.equal(signedDayDiff('2026-09-10', '2026-09-10'), 0);
  assert.equal(signedDayDiff('2026-09-10', '2026-09-11'), 1);
  assert.equal(signedDayDiff('2026-09-10', '2026-09-12'), 2);
});

test('forecast v2 uses one continuous conditional curve across due-date boundary', () => {
  const rows = [];
  const payments = [];
  for (let i = 0; i < 72; i += 1) {
    const day = String((i % 25) + 1).padStart(2, '0');
    const due = `2026-08-${day}`;
    const offset = [-2, -1, 0, 1, 2, 5][i % 6];
    const paid = new Date(`${due}T00:00:00Z`);
    paid.setUTCDate(paid.getUTCDate() + offset);
    const id = `pay_hist_${i}`;
    rows.push({ id, asaas_payment_id: id, status: 'RECEIVED', due_date: due, value: 10000, receivable_nature: 'RECURRING' });
    payments.push({ asaas_payment_id: id, status: 'RECEIVED', value: '100.00', payment_date: paid.toISOString().slice(0, 10) });
  }
  [-2, -1, 0, 1, 2].forEach((offset, idx) => {
    const due = new Date('2026-09-15T00:00:00Z');
    due.setUTCDate(due.getUTCDate() - offset);
    rows.push({ id: `pay_open_${idx}`, asaas_payment_id: `pay_open_${idx}`, status: due.toISOString().slice(0, 10) < '2026-09-15' ? 'OVERDUE' : 'PENDING', due_date: due.toISOString().slice(0, 10), value: 10000, receivable_nature: 'RECURRING' });
  });
  const forecast = buildFinanceForecastV2({ rows, payments, cases: [], today: '2026-09-15', month: '2026-09', financial: { faturamento: 0 }, commercial_target: { value: 0, realized: 0 } });
  assert.equal(forecast.forecast_model_version, 'finance_forecast_v2');
  const positions = forecast.receivable_forecast_items.map(i => i.relative_day).sort((a, b) => a - b);
  assert.deepEqual(positions, [-2, -1, 0, 1, 2]);
  const probabilities = forecast.receivable_forecast_items.map(i => i.probability_by_month_end);
  assert.ok(probabilities.every(p => p != null && p >= 0 && p <= 100));
  assert.equal(forecast.forecast_sample_quality.quality, 'recurring_classified');
});

test('right-censored unpaid receivables prevent D+90 recovery from becoming 100%', () => {
  const rows = [];
  const payments = [];
  for (let i = 0; i < 70; i += 1) {
    const id = `pay_paid_d90_${i}`;
    rows.push({ id, asaas_payment_id: id, status: 'RECEIVED', due_date: '2026-05-01', value: 10000, receivable_nature: 'RECURRING' });
    payments.push({ asaas_payment_id: id, status: 'RECEIVED', value: '100.00', payment_date: '2026-07-30' });
  }
  for (let i = 0; i < 30; i += 1) {
    const id = `pay_censored_d90_${i}`;
    rows.push({ id, asaas_payment_id: id, status: 'OVERDUE', due_date: '2026-05-01', value: 10000, receivable_nature: 'RECURRING' });
  }
  rows.push({ id: 'pay_current_overdue', asaas_payment_id: 'pay_current_overdue', status: 'OVERDUE', due_date: '2026-09-10', value: 100000, receivable_nature: 'RECURRING' });
  const forecast = buildFinanceForecastV2({ rows, payments, cases: [], today: '2026-09-15', month: '2026-09', financial: { faturamento: 0 }, commercial_target: { value: 0, realized: 0 } });
  assert.equal(forecast.recovery_curve['D+90'].recovered_rate, 70);
  assert.equal(forecast.overdue_eventual_d90_rate, 70);
  assert.equal(forecast.overdue_eventual_d90, 70000);
});

test('censored observation remains at risk through censor day and leaves afterwards', () => {
  const { modelFromObservations } = require('../api/_lib/finance-forecast-v2');
  const model = modelFromObservations([
    { value: 10000, paid: true, eventDay: 10 },
    { value: 10000, paid: false, censorDay: 30 },
    { value: 10000, paid: true, eventDay: 40 }
  ]);
  assert.equal(model.riskAt(30).length, 2);
  assert.equal(model.riskAt(31).length, 1);
  assert.equal(model.conditional(0, 90).probability < 1, true);
});
