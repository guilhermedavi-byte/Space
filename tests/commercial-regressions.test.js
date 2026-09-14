const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { buildActiveCommercialPeople, getGrowthGoalBuckets, buildWeeklyGoalsReadModel, decodeWeeklyGoalsMap, decodeGrowthPeopleDoc } = require('../api/_lib/growth-people');
const { summarizeClosedSales, getBusinessClosingDate } = require('../api/_lib/commercial-sales');
const { buildWeeklyTeamSummary } = require('../api/_lib/crm-live');
const { buildGrowthMetricsPayload } = require('../api/growth-dashboard').__private;
const { encodeFields } = require('../_lib/firestore-rest');
const { auditCommercialClosings } = require('../scripts/audit-commercial-closings');

const now = new Date('2026-09-14T12:00:00-03:00');
const weekKey = 'wk_2026-09-09';
const period = { startDateKey: '2026-09-09', endDateKey: '2026-09-15' };
const users = [
  { firestoreDocId: 'new-sdr-uid', tipo: 'growth', ativo: true, nome: 'Luis Perdigão' },
  { firestoreDocId: 'legacy-sdr-uid', tipo: 'growth', ativo: true, nome: 'Ana Silva' },
  { firestoreDocId: 'inactive-uid', tipo: 'growth', ativo: false, nome: 'Inativo' },
  { firestoreDocId: 'closer-uid', tipo: 'growth', ativo: true, nome: 'Closer Real' },
  { firestoreDocId: 'invalid-uid', tipo: 'growth', ativo: true, nome: 'LaFuFrHf9XanTC9SRniRMV123' },
  { firestoreDocId: 'email-uid', tipo: 'growth', ativo: true, nome: 'user@example.test' },
];
const configurations = [
  { personId: 'legacy-sdr', userUid: 'legacy-sdr-uid', sdrUid: 'old-actor', displayName: 'Wrong legacy name', roles: ['closer'] },
  { personId: 'real-closer', userUid: 'closer-uid', roles: ['sdr'], crmAttendantIds: ['crm-closer'] },
  { personId: 'orphan', displayName: 'Ghost', roles: ['sdr'] },
].map((person) => decodeGrowthPeopleDoc({ name: `growthPeople/${person.personId}`, ...encodeFields(person) }));
const people = [...buildActiveCommercialPeople(users, configurations), ...getGrowthGoalBuckets()];
const makeGoal = (entries) => ({ competencia: '2026-09', weeklyGoals: decodeWeeklyGoalsMap({ [weekKey]: { ...period, people: entries } }) });

test('SDR roster joins real active users and monthly role, includes zero and suppresses orphan/internal names', () => {
  const goal = makeGoal({
    'new-sdr-uid': { role: 'sdr', targetValue: 30 },
    'legacy-sdr': { role: 'sdr', targetValue: 40 },
    'legacy-sdr-uid': { role: 'sdr', targetValue: 99 },
    'inactive-uid': { role: 'sdr', targetValue: 30 },
    orphan: { role: 'sdr', targetValue: 30 },
    'invalid-uid': { role: 'sdr', targetValue: 30 },
    'email-uid': { role: 'sdr', targetValue: 30 },
    'random-orphan-uid': { role: 'sdr', targetValue: 30 },
    outros: { role: 'sdr', targetValue: 1000 },
  });
  const model = buildWeeklyGoalsReadModel({ goal, people, now, sdrEvents: [
    { id: 'event1', dateKey: '2026-09-10', eventType: 'meeting', outcome: 'show', sdrUid: 'old-actor' },
    { id: 'event2', dateKey: '2026-09-10', eventType: 'meeting', outcome: 'show', sdrUid: 'legacy-sdr-uid' },
  ] });
  assert.deepEqual(model.progress.sdrs.map((person) => person.displayName), ['Ana Silva', 'Luis Perdigão']);
  assert.equal(model.progress.sdrs[0].actualValue, 2);
  assert.equal(model.progress.sdrs[0].targetValue, 40);
  assert.equal(model.progress.sdrs[1].actualValue, 0);
  assert.equal(model.progress.closers.find((person) => person.personId === 'outros').role, 'closer');
  assert.equal(new Set(model.progress.sdrs.map((person) => person.personId)).size, 2);
});

test('weekly UID overrides legacy defaults by identity without changing historical configuration', () => {
  const goal = makeGoal({ 'legacy-sdr-uid': { role: 'sdr', targetValue: 0 } });
  goal.defaultWeeklyConfig = { people: { 'legacy-sdr': { role: 'closer', targetValue: 8000 } } };
  const original = JSON.stringify(goal);
  const model = buildWeeklyGoalsReadModel({ goal, people, now });
  assert.deepEqual(model.progress.sdrs.map((row) => [row.personId, row.targetValue]), [['legacy-sdr', 0]]);
  assert.equal(model.progress.closers.length, 0);
  assert.equal(JSON.stringify(goal), original);
  const nextWeek = buildWeeklyGoalsReadModel({ goal, people, now: new Date('2026-09-16T12:00:00-03:00') });
  assert.equal(nextWeek.progress.sdrs.length, 0);
  assert.equal(nextWeek.progress.closers[0].targetValue, 8000);
});

// Synthetic equivalent of the reported amounts, not an export of production.
const sale = (id, value, extra = {}) => ({
  id, total: value, status: 'won', lastMovedAt: '2026-09-10T12:00:00-03:00',
  stage: { name: 'Fechado', pipeline: { name: 'Conversão' } },
  attendantId: 'crm-closer', ...extra,
});
const sales = [
  sale('fixture-configured', 8400),
  sale('fixture-unmapped', 2250, { attendantId: 'unmapped-closer' }),
  sale('fixture-closing-date', 2000, { attendantId: null, statusChangedAt: '2026-09-11T12:00:00-03:00', lastMovedAt: '2026-08-31T12:00:00-03:00' }),
];

test('R$12,650 includes all valid closings regardless of closer, goal or result roster, once per deal', () => {
  const duplicate = { ...sales[1], id: undefined, _id: sales[1].id };
  const businesses = [...sales, duplicate,
    sale('old-closing', 900, { wonAt: '2026-08-31T12:00:00-03:00' }),
    sale('open', 800, { stage: { name: 'Em fechamento', pipeline: { name: 'Conversão' } } }),
    sale('outside', 700, { lastMovedAt: '2026-09-16T12:00:00-03:00' }),
  ];
  const audit = summarizeClosedSales({ businesses, period });
  assert.equal(audit.actualValue, 12650);
  assert.equal(audit.count, 3);
  assert.deepEqual(audit.sales.map((row) => row.id), sales.map((row) => row.id));
  assert.equal(audit.excluded.filter((row) => row.reason === 'duplicate').length, 1);
  for (const activePeople of [people, [], getGrowthGoalBuckets()]) {
    const model = buildWeeklyGoalsReadModel({ goal: makeGoal({ 'real-closer': { role: 'closer', targetValue: 10000 } }), people: activePeople, businesses, now });
    const team = buildWeeklyTeamSummary({ weeklyReadModel: model });
    assert.equal(team.closers.actualValue, 12650);
    assert.equal(team.closers.count, 3);
    assert.equal(model.progress.closers.reduce((sum, row) => sum + row.actualValue, 0), 12650);
  }
});

test('Outros is a closer bucket and its saved target contributes to the team target', () => {
  const goal = makeGoal({ 'real-closer': { role: 'closer', targetValue: 8000 }, outros: { role: 'closer', targetValue: 4000 } });
  const model = buildWeeklyGoalsReadModel({ people, goal, businesses: sales, now });
  const bucket = model.progress.closers.find((row) => row.personId === 'outros');
  assert.equal(bucket.targetValue, 4000);
  assert.equal(bucket.actualValue, 4250);
  assert.equal(bucket.isAggregate, true);
  assert.equal(buildWeeklyTeamSummary({ weeklyReadModel: model }).closers.targetValue, 12000);
  assert.ok(!buildActiveCommercialPeople(users, configurations).some((row) => row.isAggregate));
  assert.equal(getGrowthGoalBuckets()[0].roles[0], 'closer');
});

test('financial date precedence, timezone boundaries and established pipeline rule are shared', () => {
  assert.equal(getBusinessClosingDate({ soldAt: '2026-09-10', statusChangedAt: '2026-08-01', lastMovedAt: '2026-09-11' }).field, 'soldAt');
  const businesses = [sale('boundary-before', 10, { wonAt: '2026-09-09T02:59:59Z' }), sale('boundary-in', 20, { wonAt: '2026-09-09T03:00:00Z' })];
  assert.equal(summarizeClosedSales({ businesses, period }).actualValue, 20);
  businesses.push(sale('main-pipeline', 100, { stage: { name: 'Fechado', pipeline: { name: 'Funil principal' } } }));
  assert.equal(summarizeClosedSales({ businesses, period }).actualValue, 100);
});

test('dashboard and CRM weekly total agree for identical periods and equivalent R$12,650 data', async () => {
  const dashboard = await buildGrowthMetricsPayload({ crm: { businesses: sales }, periodStart: period.startDateKey, periodEnd: period.endDateKey });
  const model = buildWeeklyGoalsReadModel({ people, businesses: sales, now });
  assert.equal(dashboard.summary.realizado, model.closedSales.actualValue);
});

test('read-only audit explains the synthetic R$8,400 -> R$12,650 difference by deal', () => {
  const report = auditCommercialClosings({ now, users,
    growthPeople: configurations.map((person) => person.personId === 'real-closer' ? { ...person, roles: ['closer'] } : person),
    goal: makeGoal({ 'real-closer': { role: 'closer', targetValue: 10000 } }), businesses: sales,
  });
  assert.equal(report.actualValue, 12650);
  assert.equal(report.previouslyCountedFromTheseSales, 8400);
  assert.deepEqual(report.sales.filter((sale) => sale.previousExclusions.length).map((sale) => [sale.id, sale.value]), [
    ['fixture-unmapped', 2250], ['fixture-closing-date', 2000],
  ]);
});

test('ranking renders the backend names, including eligible SDRs below fifth place', () => {
  const source = fs.readFileSync(require.resolve('../api/crm-live'), 'utf8');
  const start = source.indexOf('const renderRankingRows =');
  const end = source.indexOf('const renderHighlight', start);
  assert.ok(end > start);
  const input = Array.from({ length: 6 }, (_, index) => ({ displayName: index === 5 ? 'Luis Perdigão' : `Pessoa ${index}`, personId: `internal-uid-${index}` }));
  const html = vm.runInNewContext(`${source.slice(start, end)}\nrenderRankingRows(input, {role: 'sdr'});`, {
    input, safeArray: (rows) => rows, escapeHtml: String, avatarHtml: () => '',
    abbreviateProgress: () => '', clampPercent: () => 0, percent: () => '0%',
  });
  assert.match(html, /Luis Perdigão/);
  assert.doesNotMatch(html, /internal-uid-/);
  assert.equal((html.match(/crm-live-ranking-name/g) || []).length, 6);
});

test('mirror financial windows include closed deals without recent movement', async () => {
  const filename = require.resolve('../api/_lib/datacrazy-mirror');
  const localRequire = createRequire(filename);
  const queries = [];
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
    module, exports: module.exports, process, URL, URLSearchParams, Date, console,
    require(name) {
      if (name === './supabase-rest') return { supabaseFetch: async (query) => { queries.push(decodeURIComponent(query)); return { data: [] }; } };
      return localRequire(name);
    },
  }, { filename });
  await module.exports.fetchMirroredBusinesses({ startDateKey: period.startDateKey, includeClosings: true });
  assert.match(queries[0], /or=\(last_moved_at.gte.*stage_key.eq.fechado\)/);
  assert.match(queries[0], /deleted_at=is.null/);
  await module.exports.fetchMirroredBusinesses({ startDateKey: period.startDateKey });
  assert.match(queries[1], /last_moved_at=gte/);
  assert.doesNotMatch(queries[1], /stage_key.eq.fechado/);
});

test('CRM Live loader reads users, rejects ghosts, and uses the week competence across a month boundary', async () => {
  const filename = require.resolve('../api/_lib/crm-live');
  const localRequire = createRequire(filename);
  const calls = [];
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
    module, exports: module.exports, Date, URL, URLSearchParams, console, process, Buffer,
    require(name) {
      if (name === './firestore-admin') return {
        listCollectionAsAdmin: async (collection) => { calls.push(collection); return collection === 'users' ? users : configurations; },
        queryCollectionByDateRangeAsAdmin: async () => [],
        getDocumentAsAdmin: async (path) => { calls.push(path); return { competencia: '2026-09', weeklyGoals: {
          'wk_2026-09-30': { ...period, people: { 'new-sdr-uid': { role: 'sdr', targetValue: 55 } } },
        } }; },
      };
      return localRequire(name);
    },
  }, { filename });
  const roster = await module.exports.loadGrowthPeople();
  assert.ok(calls.includes('users'));
  assert.ok(roster.some((person) => person.displayName === 'Luis Perdigão'));
  assert.ok(!roster.some((person) => person.personId === 'orphan'));
  const payload = await module.exports.buildCrmLiveSdrSlice({ goal: { competencia: '2026-10' }, people: roster, now: new Date('2026-10-01T12:00:00-03:00') });
  assert.ok(calls.includes('growthGoals/2026-09'));
  assert.equal(payload.weekly.sdrs[0].displayName, 'Luis Perdigão');
  assert.equal(payload.weekly.sdrs[0].targetValue, 55);
  assert.equal(payload.weekly.sdrs[0].actualValue, 0);
});
