const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM } = require('jsdom');
const { buildCommercialGoalsModel, listCompetenciaWeeks } = require('../api/_lib/commercial-goals');
const { buildActiveCommercialPeople, getGrowthGoalBuckets, decodeWeeklyGoalsMap, normalizeWeeklyGoalConfigEntry } = require('../api/_lib/growth-people');
const { summarizeClosedSales } = require('../api/_lib/commercial-sales');
const now = new Date('2026-09-14T12:00:00-03:00');
const people = [...buildActiveCommercialPeople([
  { firestoreDocId: 'luis', nome: 'Luis Perdigão', tipo: 'growth', ativo: true },
  { firestoreDocId: 'closer', nome: 'Closer real', tipo: 'growth', ativo: true },
  { firestoreDocId: 'invalid', nome: 'ABCD123456789012345678901', tipo: 'growth', ativo: true },
  { firestoreDocId: 'inactive', nome: 'Inativo', tipo: 'growth', ativo: false },
], []), ...getGrowthGoalBuckets()];
const weekly = (target = 9000) => ({ people: { luis: { role: 'sdr', targetValue: 0 }, closer: { role: 'closer', targetValue: target }, outros: { role: 'closer', targetValue: 1000 }, orphan: { role: 'sdr', targetValue: 40 } } });
const makeGoal = () => ({ competencia: '2026-09', valorMeta: 80000, weeklyGoals: decodeWeeklyGoalsMap({ 'wk_2026-09-02': weekly(), 'wk_2026-09-09': weekly(), 'wk_2026-09-23': weekly() }) });
const model = (extra = {}) => buildCommercialGoalsModel({ competencia: '2026-09', goal: makeGoal(), people, now, ...extra });

test('management preserves weekly calendar, cross-month ownership and historical special week', () => {
  assert.deepEqual(listCompetenciaWeeks('2026-09').map(w => w.startDateKey), ['2026-09-02', '2026-09-09', '2026-09-16', '2026-09-23', '2026-09-30']);
  assert.equal(listCompetenciaWeeks('2026-09').at(-1).endDateKey, '2026-10-06');
  assert.equal(listCompetenciaWeeks('2026-08').find(w => w.startDateKey === '2026-08-11').endDateKey, '2026-08-18');
});
test('monthly existence is independent from document and weekly defaults', () => {
  assert.equal(model().monthlyExists, true);
  assert.equal(model().month.summary.meta, 80000);
  assert.equal(model({ goal: { weeklyGoals: makeGoal().weeklyGoals } }).monthlyExists, false);
  assert.equal(model({ goal: null }).monthlyExists, false);
});
test('explicit week existence, current week and four statuses reflect real storage', () => {
  const data = model();
  assert.deepEqual(data.weeks.map(w => w.status), ['Concluída', 'Em andamento', 'Não definida', 'Programada', 'Não definida']);
  assert.deepEqual(data.weeks.filter(w => w.isCurrent).map(w => w.weekKey), ['wk_2026-09-09']);
  const withDefault = model({ goal: { defaultWeeklyConfig: normalizeWeeklyGoalConfigEntry({ rawConfig: weekly() }) } });
  assert.equal(withDefault.weeks[0].exists, false);
  assert.equal(withDefault.weeks[0].effectiveConfig, true);
});
test('roster keeps Luis and zero, rejects ghosts and internal names, and retains Outros as bucket', () => {
  const rows = model().weeks[1].rows;
  assert.deepEqual(rows.map(r => r.displayName), ['Luis Perdigão', 'Closer real', 'Outros']);
  assert.equal(rows[0].targetValue, 0);
  assert.equal(rows.at(-1).isAggregate, true);
  assert.equal(rows.at(-1).role, 'closer');
});
test('financial truth matches official sales and planning respects explicit team targets', () => {
  const businesses = [{ id: 'sale', stage: { name: 'Fechado', pipeline: { name: 'Conversão' } }, total: 12650, closedAt: '2026-09-10T12:00:00-03:00' }];
  const data = model({ businesses });
  const official = summarizeClosedSales({ businesses, period: data.weeks[1] });
  assert.equal(official.actualValue, 12650);
  assert.equal(data.weeks[1].summary.actualValue, official.actualValue);
  assert.equal(data.month.summary.realizado, official.actualValue);
  assert.equal(data.planning.distributed, 30000);
  const goal = makeGoal(); goal.weeklyGoals['wk_2026-09-09'].teamTarget = 20000;
  assert.equal(model({ goal }).planning.distributed, 40000);
});
test('copy is only available with immediately previous saved week, including previous competence', () => {
  const data = model();
  assert.equal(data.weeks[0].copyFromPrevious, null);
  assert.equal(data.weeks[1].copyFromPrevious, null);
  assert.equal(data.weeks[2].copyFromPrevious.rows[0].targetValue, 0);
  const october = model({ competencia: '2026-10', goal: null, previousGoal: { weeklyGoals: decodeWeeklyGoalsMap({ 'wk_2026-09-30': weekly() }) } });
  assert.ok(october.weeks[0].copyFromPrevious);
});
test('historical roles come from period, not current role; model does not mutate inputs', () => {
  const goal = makeGoal(); const before = JSON.stringify(goal);
  const data = model({ goal, now: new Date('2026-10-15T12:00:00-03:00'), people: people.map(p => p.personId === 'luis' ? { ...p, roles: ['closer'] } : p) });
  assert.equal(data.editable, false);
  assert.equal(data.weeks[1].rows[0].role, 'sdr');
  assert.equal(JSON.stringify(goal), before);
});
test('explicit exclusions through aliases are not reintroduced in the editor', () => {
  const goal = makeGoal(); goal.weeklyGoals['wk_2026-09-09'].people.push({ personId: 'old-luis', excluded: true });
  const data = model({ goal, people: people.map(p => p.personId === 'luis' ? { ...p, identityKeys: ['old-luis', 'luis'] } : p) });
  assert.ok(!data.weeks[1].rows.some(p => p.personId === 'luis'));
});

function ui(extra = {}) {
  const dom = new JSDOM('<div id="root"></div>', { runScripts: 'outside-only', url: 'http://localhost' });
  dom.window.eval(fs.readFileSync(require.resolve('../commercial-goals.js'), 'utf8'));
  const calls = [];
  let goal = Object.prototype.hasOwnProperty.call(extra, 'goal') ? extra.goal : makeGoal();
  const fetchWithAuth = async (url, options) => {
    calls.push({ url, ...options });
    if (options.method === 'POST') {
      if (extra.failSave) return { ok: false, json: async () => ({ error: 'write_failed' }) };
      const body = JSON.parse(options.body); goal ||= { competencia: body.competencia, weeklyGoals: {} };
      if (body.valorMeta != null) goal.valorMeta = body.valorMeta;
      if (body.weeklyGoal) goal.weeklyGoals = { ...goal.weeklyGoals, ...decodeWeeklyGoalsMap({ [body.weeklyGoal.weekKey]: body.weeklyGoal }) };
      return { ok: true, json: async () => ({ ok: true }) };
    }
    const competencia = new URL(url, 'http://localhost').searchParams.get('competencia');
    return { ok: true, json: async () => ({ management: model({ goal, competencia, ...extra, ...(extra.goal === null ? { goal } : {}) }) }) };
  };
  const controller = dom.window.SpaceCommercialGoals.create({ root: dom.window.document.querySelector('#root'), fetchWithAuth, currentCompetencia: '2026-09' });
  const click = selector => dom.window.document.querySelector(selector).click();
  const flush = () => new Promise(resolve => setImmediate(resolve));
  const submit = () => dom.window.document.querySelector('form').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
  return { dom, controller, calls, click, flush, submit, document: dom.window.document };
}
test('page loads current competence; existing month opens edit with saved amount and no writes', async t => {
  const h = ui(); t.after(() => h.dom.window.close()); await h.controller.load();
  assert.match(h.calls[0].url, /competencia=2026-09/);
  assert.equal(h.document.querySelector('[data-goals-action="monthly"]').textContent, 'Editar meta mensal');
  h.click('[data-goals-action="monthly"]');
  assert.equal(h.document.querySelector('[data-goals-value]').value, '80000');
  assert.match(h.document.querySelector('[role="dialog"]').textContent, /Editar meta mensal/);
  assert.ok(h.calls.every(c => c.method === 'GET'));
});
test('empty month uses define and monthly save refreshes existence', async t => {
  const h = ui({ goal: null }); t.after(() => h.dom.window.close()); await h.controller.load();
  assert.equal(h.document.querySelector('[data-goals-action="monthly"]').textContent, 'Definir meta mensal');
  h.click('[data-goals-action="monthly"]'); h.document.querySelector('[data-goals-value]').value = '80000';
  h.submit(); await h.flush();
  assert.equal(h.document.querySelector('[data-goals-action="monthly"]').textContent, 'Editar meta mensal');
  assert.equal(h.calls.filter(c => c.method === 'POST').length, 1);
});
test('month arrows and picker navigate, preserve scope and show history as read-only', async t => {
  const h = ui(); t.after(() => h.dom.window.close()); await h.controller.load();
  h.click('[data-goals-action="previous"]'); await h.flush();
  assert.equal(h.controller.state.competencia, '2026-08');
  assert.equal(h.document.querySelector('[data-goals-action="monthly"]'), null);
  h.click('[data-goals-action="next"]'); await h.flush();
  assert.equal(h.controller.state.competencia, '2026-09');
  const picker = h.document.querySelector('[data-goals-month]'); picker.value = '2026-10'; picker.dispatchEvent(new h.dom.window.Event('change', { bubbles: true })); await h.flush();
  assert.equal(h.controller.state.competencia, '2026-10');
});
test('existing week opens edit; new week opens define; neither opening writes', async t => {
  const h = ui(); t.after(() => h.dom.window.close()); await h.controller.load();
  h.click('[data-goals-action="week:1"]'); assert.match(h.document.querySelector('[role="dialog"] h2').textContent, /Editar/);
  h.controller.closeDrawer(); h.click('[data-goals-action="week:2"]'); assert.match(h.document.querySelector('[role="dialog"] h2').textContent, /Definir/);
  assert.ok(h.calls.every(c => c.method === 'GET'));
});
test('copy changes only local draft; save posts configuration without results or record IDs and refreshes status', async t => {
  const h = ui(); t.after(() => h.dom.window.close()); await h.controller.load();
  h.click('[data-goals-action="week:2"]'); h.click('[data-goals-action="copy"]');
  assert.equal(h.controller.state.drawer.rows.find(r => r.personId === 'closer').targetValue, 9000);
  assert.ok(h.calls.every(c => c.method === 'GET'));
  h.submit(); await h.flush();
  const writes = h.calls.filter(c => c.method === 'POST'); assert.equal(writes.length, 1);
  const saved = JSON.parse(writes[0].body);
  assert.equal(saved.weeklyGoal.weekKey, 'wk_2026-09-16');
  assert.deepEqual(saved.weeklyGoal.people.luis, { role: 'sdr', targetValue: 0 });
  assert.equal(saved.weeklyGoal.people.outros.role, 'closer');
  assert.equal(saved.weeklyGoal.actualValue, undefined);
  assert.equal(h.controller.state.data.weeks[2].exists, true);
  assert.match(h.document.querySelector('[data-goals-toast]').textContent, /sucesso/);
});
test('save error preserves draft and closing without save never persists copied values', async t => {
  const h = ui({ failSave: true }); t.after(() => h.dom.window.close()); await h.controller.load();
  h.click('[data-goals-action="week:2"]'); h.click('[data-goals-action="copy"]'); h.controller.closeDrawer();
  assert.ok(h.calls.every(c => c.method === 'GET'));
  h.click('[data-goals-action="week:2"]'); h.click('[data-goals-action="copy"]'); h.submit(); await h.flush();
  assert.ok(h.controller.state.drawer);
  assert.equal(h.document.querySelector('[data-goals-error]').hidden, false);
  assert.equal(h.controller.state.drawer.rows.find(r => r.personId === 'closer').targetValue, 9000);
});

test('rapid competence changes cannot replace the latest month with a stale response', async t => {
  const dom = new JSDOM('<div id="root"></div>', { runScripts: 'outside-only' });
  t.after(() => dom.window.close());
  dom.window.eval(fs.readFileSync(require.resolve('../commercial-goals.js'), 'utf8'));
  const pending = [];
  const controller = dom.window.SpaceCommercialGoals.create({ root: dom.window.document.querySelector('#root'), currentCompetencia: '2026-09', fetchWithAuth: () => new Promise(resolve => pending.push(resolve)) });
  const first = controller.load('2026-09');
  assert.ok(dom.window.document.querySelector('[aria-busy="true"]'));
  const second = controller.load('2026-10');
  pending[1]({ ok: true, json: async () => ({ management: model({ competencia: '2026-10' }) }) });
  await second;
  pending[0]({ ok: true, json: async () => ({ management: model() }) });
  await first;
  assert.equal(controller.state.data.competencia, '2026-10');
  assert.equal(dom.window.document.querySelector('[data-goals-month]').value, '2026-10');
});
test('historical drawer has no save; Escape closes and returns focus', async t => {
  const h = ui({ now: new Date('2026-10-15T12:00:00-03:00') }); t.after(() => h.dom.window.close());
  await h.controller.load();
  const trigger = h.document.querySelector('[data-goals-action="week:1"]'); trigger.focus(); trigger.click();
  assert.equal(h.document.querySelector('[type="submit"]'), null);
  assert.match(h.document.querySelector('[role="dialog"] h2').textContent, /Consultar/);
  h.document.querySelector('[role="dialog"]').dispatchEvent(new h.dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assert.equal(h.controller.state.drawer, null);
  assert.equal(h.document.activeElement, trigger);
});

test('completed week opens consultation and offers explicit editing only in an editable competence', async t => {
  const h = ui(); t.after(() => h.dom.window.close()); await h.controller.load();
  h.click('[data-goals-action="week:0"]');
  assert.match(h.document.querySelector('[role="dialog"] h2').textContent, /Consultar/);
  assert.equal(h.document.querySelector('[type="submit"]'), null);
  h.click('[data-goals-action="edit-week"]');
  assert.match(h.document.querySelector('[role="dialog"] h2').textContent, /Editar/);
  assert.ok(h.document.querySelector('[type="submit"]'));
  assert.ok(h.calls.every(c => c.method === 'GET'));
});
