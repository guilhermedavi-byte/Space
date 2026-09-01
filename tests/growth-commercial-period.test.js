const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  resolveCommercialPeriod,
  countPeriodDaysElapsedInclusive,
  countRemainingWeekdaysMonFri,
  countRemainingSalesDaysSegSabInclusive,
  isDateWithinCommercialPeriod,
} = require("../api/_lib/commercial-period");
const { calculateGrowthForecast3Parts } = require("../_lib/forecast-service");
const { buildGrowthMetricsPayload } = require("../api/growth-dashboard").__private;

test("resolveCommercialPeriod mantém calendário quando não há override", () => {
  const period = resolveCommercialPeriod({ now: new Date("2026-08-11T12:00:00-03:00") });
  assert.deepEqual(period, {
    monthKey: "2026-08",
    startDateKey: "2026-08-01",
    endDateKey: "2026-08-31",
    nowDateKey: "2026-08-11",
    isCustom: false,
  });
  assert.equal(countPeriodDaysElapsedInclusive(period, new Date("2026-08-11T12:00:00-03:00")), 11);
  assert.equal(countRemainingWeekdaysMonFri(period, new Date("2026-08-11T12:00:00-03:00")), 14);
  assert.equal(countRemainingSalesDaysSegSabInclusive(period, new Date("2026-08-11T12:00:00-03:00")), 18);
});

test("resolveCommercialPeriod aplica janela customizada do comercial", () => {
  const period = resolveCommercialPeriod({
    now: new Date("2026-08-11T12:00:00-03:00"),
    periodStart: "2026-08-02",
    periodEnd: "2026-08-31",
  });
  assert.deepEqual(period, {
    monthKey: "2026-08",
    startDateKey: "2026-08-02",
    endDateKey: "2026-08-31",
    nowDateKey: "2026-08-11",
    isCustom: true,
  });
  assert.equal(countPeriodDaysElapsedInclusive(period, new Date("2026-08-11T12:00:00-03:00")), 10);
  assert.equal(countRemainingWeekdaysMonFri(period, new Date("2026-08-11T12:00:00-03:00")), 14);
  assert.equal(countRemainingSalesDaysSegSabInclusive(period, new Date("2026-08-11T12:00:00-03:00")), 18);
  assert.equal(isDateWithinCommercialPeriod("2026-08-01T15:00:00Z", period), false);
  assert.equal(isDateWithinCommercialPeriod("2026-08-02T15:00:00Z", period), true);
});

test("forecast 3-partes aceita callback de período customizado", () => {
  const period = resolveCommercialPeriod({
    now: new Date("2026-08-11T12:00:00-03:00"),
    periodStart: "2026-08-02",
    periodEnd: "2026-08-31",
  });
  const deals = [
    {
      id: "outside-start",
      stage: { name: "Fechado" },
      createdAt: "2026-08-01T12:00:00-03:00",
      closedAt: "2026-08-01T16:00:00-03:00",
      total: 1000,
    },
    {
      id: "inside-window",
      stage: { name: "Fechado" },
      createdAt: "2026-08-02T12:00:00-03:00",
      closedAt: "2026-08-03T16:00:00-03:00",
      total: 500,
    },
  ];
  const result = calculateGrowthForecast3Parts({
    deals,
    nowMonthKey: "2026-08",
    getMonthKey: () => "2026-08",
    getClosedDate: (deal) => new Date(deal.closedAt),
    isWithinCurrentPeriod: (value) => isDateWithinCommercialPeriod(value, period),
    daysPassed: 10,
    daysRemaining: 14,
    rates: {
      taxaAgendamento: 0.4,
      taxaNoShow: 0.2,
      taxaConversao: 0.5,
      ticketMedio: 500,
    },
  });
  assert.equal(result.parte1_fechado, 500);
  assert.equal(result.debug.leadsDoMes, 1);
});

test("growth metrics escolhe o pipeline dentro da coorte e filtra pela criação", async () => {
  const makeDeal = ({ id, createdAt, total, pipeline = "Conversão" }) => ({
    id,
    createdAt,
    total,
    stage: { name: "Fechado", pipeline: { name: pipeline } },
    attendant: { name: "Responsável" },
  });
  const payload = await buildGrowthMetricsPayload({
    crm: {
      businesses: [
        makeDeal({ id: "inside", createdAt: "2026-05-05T12:00:00-03:00", total: 1000 }),
        makeDeal({ id: "outside", createdAt: "2026-05-20T12:00:00-03:00", total: 9000 }),
        makeDeal({ id: "new-pipeline", createdAt: "2026-09-01T12:00:00-03:00", total: 12000, pipeline: "Funil principal" }),
      ],
    },
    periodStart: "2026-05-01",
    periodEnd: "2026-05-12",
    filterByCreatedAt: true,
  });

  assert.equal(payload.summary.realizado, 1000);
  assert.equal(payload.summary.totalVendas, 1);
  assert.equal(payload.summary.ticketMedio, 1000);
  assert.equal(payload.summary.forecast, 1000);
  assert.equal(payload.stageBreakdown[0].count, 1);
  assert.deepEqual(payload.period, {
    startDateKey: "2026-05-01",
    endDateKey: "2026-05-12",
    startAt: "2026-05-01T00:00:00-03:00",
    endAt: "2026-05-12T23:59:59.999-03:00",
    filterField: "createdAt",
    pipelineKey: "conversao",
  });
});

test("intervalo comercial inclui 00:00 inicial e 23:59:59 final em São Paulo", () => {
  const period = resolveCommercialPeriod({
    now: new Date("2026-09-01T12:00:00-03:00"),
    periodStart: "2026-08-01",
    periodEnd: "2026-08-31",
  });
  assert.equal(isDateWithinCommercialPeriod("2026-08-01T02:59:59.999Z", period), false);
  assert.equal(isDateWithinCommercialPeriod("2026-08-01T03:00:00.000Z", period), true);
  assert.equal(isDateWithinCommercialPeriod("2026-09-01T02:59:59.999Z", period), true);
  assert.equal(isDateWithinCommercialPeriod("2026-09-01T03:00:00.000Z", period), false);
});

test("API de growth metrics valida e usa periodStart/periodEnd fora do cache mensal", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "api", "growth-dashboard.js"), "utf8");
  const clientSource = fs.readFileSync(path.join(__dirname, "..", "script.js"), "utf8");
  assert.match(source, /const hasRequestedPeriod = Boolean\(periodStart \|\| periodEnd\)/);
  assert.match(source, /filterByCreatedAt: hasRequestedPeriod/);
  assert.match(source, /periodStart > periodEnd/);
  assert.match(source, /params\.set\("filter\[lastMovedAfter\]", String\(lastMovedAfter\)\.trim\(\)\)/);
  assert.match(source, /new Date\(`\$\{periodStart\}T00:00:00-03:00`\)\.toISOString\(\)/);
  assert.match(clientSource, /new URLSearchParams\(\{ api: "growth-metrics", periodStart: range\.start, periodEnd: range\.end \}\)/);
  assert.match(clientSource, /crm\?\.period\?\.startDateKey !== range\.start/);
});

test("save de growth-goals invalida o cache persistente imediatamente", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "api", "growth-dashboard.js"), "utf8");
  assert.match(source, /const invalidateGrowthMetricsCacheDoc = async/);
  assert.match(source, /await invalidateGrowthMetricsCacheDoc\(\{ accessToken \}\)/);
  assert.match(source, /delete globalThis\.__growthMetricsCache/);
});

test("POST parcial de growth-goals preserva valorMeta existente quando omitido", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "api", "growth-dashboard.js"), "utf8");
  assert.match(source, /const hasValorMeta = body && Object\.prototype\.hasOwnProperty\.call\(body, "valorMeta"\)/);
  assert.match(source, /const valorMeta = hasValorMeta[\s\S]*existingGoal/);
});

test("GET de growth-goals aceita weekStart para calcular weeklyReadModel fora da semana atual", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "api", "growth-dashboard.js"), "utf8");
  assert.match(source, /const requestedWeekStart = String\(url\.searchParams\.get\("weekStart"\) \|\| ""\)\.trim\(\)/);
  assert.match(source, /now: requestedWeekDate \|\| new Date\(\)/);
});

test("POST de growth-goals aceita salvar weeklyGoal sem exigir valorMeta mensal", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "api", "growth-dashboard.js"), "utf8");
  assert.match(source, /const weeklyGoalInput = normalizeWeeklyGoalPayload\(body\?\.weeklyGoal\)/);
  assert.match(source, /if \(!shouldPersistValorMeta && !weeklyGoalInput\)/);
  assert.match(source, /base\.weeklyGoals = \{/);
});
