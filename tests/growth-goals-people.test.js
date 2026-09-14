const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { buildActiveCommercialPeople, buildWeeklyGoalsReadModel, decodeWeeklyGoalsMap, getGrowthGoalBuckets } = require('../api/_lib/growth-people');
const firestore = require('../_lib/firestore-rest');

const users = [
  { firestoreDocId: 'new-user', nome: 'Luis Perdigão', tipo: 'growth', ativo: true },
  { firestoreDocId: 'existing-user', nome: 'Existing', role: 'growth', ativo: true },
  { firestoreDocId: 'inactive-user', nome: 'Inactive', tipo: 'growth', ativo: false },
  { firestoreDocId: 'student', nome: 'Student', tipo: 'student', ativo: true },
  { firestoreDocId: 'legacy-user', nome: 'Legacy', perfil: 'growth', email: 'legacy@example.test' },
];
const person = (personId, extra = {}) => ({ personId, displayName: personId, active: true, roles: [], crmAttendantIds: [], crmAttendantAliases: [], sdrEmails: [], ...extra });
const people = [
  person('existing-person', { userUid: 'existing-user', roles: ['closer'], active: false }),
  person('inactive-person', { userUid: 'inactive-user' }),
  person('legacy-person', { sdrEmails: ['legacy@example.test'] }),
  person('outros', { isAggregate: true }),
];

test('active Commercial users are the base, independently of configuration, goals or role', () => {
  const before = JSON.stringify({ users, people });
  const rows = buildActiveCommercialPeople([...users, users[0]], people);
  assert.deepEqual(rows.map((row) => row.personId), ['new-user', 'existing-person', 'legacy-person']);
  assert.equal(rows[0].displayName, 'Luis Perdigão');
  assert.deepEqual(rows[0].roles, []);
  assert.equal(rows[1].active, true); // users.ativo is authoritative
  assert.equal(JSON.stringify({ users, people }), before);
  assert.equal(buildActiveCommercialPeople([...users, { firestoreDocId: 'future-user', tipo: 'growth' }], people).length, 4);
});

test('goals join by stable identity and selected week, retaining zero targets', () => {
  const activePeople = buildActiveCommercialPeople(users, people);
  const goal = { weeklyGoals: decodeWeeklyGoalsMap({
    'wk_2026-09-16': { startDateKey: '2026-09-16', endDateKey: '2026-09-22', people: { 'existing-person': { role: 'closer', targetValue: 0 } } },
    'wk_2026-09-23': { startDateKey: '2026-09-23', endDateKey: '2026-09-29', people: { 'existing-person': { role: 'sdr', targetValue: 45 } } },
  }) };
  for (const [date, role, target] of [['2026-09-16', 'closer', 0], ['2026-09-23', 'sdr', 45]]) {
    const model = buildWeeklyGoalsReadModel({ goal, people: activePeople, now: new Date(`${date}T12:00:00-03:00`) });
    assert.equal(model.people.length, 3);
    assert.deepEqual(model.weeklyGoal.people[0], { personId: 'existing-person', role, targetValue: target, excluded: false });
  }
});

test('homonyms stay distinct and duplicate configurations resolve to one real user', () => {
  assert.equal(buildActiveCommercialPeople([{ ...users[0] }, { ...users[0], firestoreDocId: 'homonym' }], []).length, 2);
  const joined = buildActiveCommercialPeople(users, [...people, person('duplicate', { userUid: 'existing-user' })]);
  assert.equal(joined.length, 3);
  assert.ok(joined.find((row) => row.userUid === 'existing-user').identityKeys.includes('existing-person'));
});

const makeApi = ({ missingGoal = false, failRead = false, failUsers = false, legacyArray = false } = {}) => {
  const filename = require.resolve('../api/growth-dashboard');
  const localRequire = createRequire(filename);
  const calls = [];
  const month = '2099-09';
  const initial = {
    competencia: month, valorMeta: 123456,
    weeklyGoals: {
      'wk_2099-09-16': { startDateKey: '2099-09-16', endDateKey: '2099-09-22', teamTarget: 100,
        individualMonthlyGoals: { 'existing-person': { role: 'closer', targetValue: 8000 }, 'inactive-person': { role: 'sdr', targetValue: 42 }, outros: { role: 'closer', targetValue: 4000 } } },
      'wk_2099-09-23': { startDateKey: '2099-09-23', endDateKey: '2099-09-29', customField: 'keep', individualMonthlyGoals: { 'existing-person': { role: 'sdr', targetValue: 77 } } },
    },
  };
  initial.weeklyGoals['wk_2099-09-16'].customWeekField = 'preserve-week';
  initial.weeklyGoals['wk_2099-09-16'].individualMonthlyGoals['existing-person'].customPersonField = 'preserve-person';
  if (legacyArray) initial.weeklyGoals['wk_2099-09-16'].people = Object.entries(initial.weeklyGoals['wk_2099-09-16'].individualMonthlyGoals).map(([personId, row]) => ({ personId, ...row }));
  let saved = missingGoal ? null : structuredClone(initial);
  const doc = (path, fields) => ({ name: `documents/${path}`, ...firestore.encodeFields(fields) });
  const requestJson = async (url, options = {}) => {
    const path = new URL(url).pathname.split('/documents/')[1];
    const method = options.method || 'GET';
    calls.push({ path, method, body: options.body });
    if (method === 'DELETE') return { ok: true, status: 200 };
    if (path === `growthGoals/${month}`) {
      if (method === 'PATCH') {
        saved = { ...saved, ...firestore.decodeFields(options.body) };
        return { ok: true, status: 200, data: doc(path, saved) };
      }
      if (failRead) return { ok: false, status: 503 };
      return saved ? { ok: true, status: 200, data: doc(path, saved) } : { ok: false, status: 404 };
    }
    if (path?.startsWith('growthGoals/')) return { ok: false, status: 404 };
    if (path === 'users') {
      if (failUsers) return { ok: false, status: 503 };
      const secondPage = new URL(url).searchParams.has('pageToken');
      return { ok: true, status: 200, data: {
        documents: (secondPage ? users.slice(2) : users.slice(0, 2)).map((user) => doc(`users/${user.firestoreDocId}`, user)),
        ...(!secondPage ? { nextPageToken: 'page-2' } : {}),
      } };
    }
    if (path === 'growthConfig/crmLiveDefaults') return { ok: false, status: 404 };
    if (path === 'sdrActivityEvents') return { ok: true, status: 200, data: { documents: [] } };
    if (path === 'growthPeople') return { ok: true, status: 200, data: { documents: people.map((person) => doc(`growthPeople/${person.personId}`, person)) } };
    throw new Error(`Unexpected request ${method} ${path}`);
  };
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
    module, exports: module.exports, URL, URLSearchParams, Date, console, process, Buffer,
    require: (name) => {
      if (name === '../_lib/session') return { getSessionFromRequest: () => ({ role: 'admin', sub: 'admin-test' }) };
      if (name === '../_lib/google-service-account') return { getGoogleAccessToken: async () => ({ accessToken: 'test-token' }) };
      if (name === '../_lib/firestore-rest') return { ...firestore, FIRESTORE_BASE: 'https://firestore.test/documents', requestJson };
      if (name === './_lib/datacrazy-mirror') return { isDatacrazyMirrorEnabled: () => true, fetchAllMirroredBusinesses: async () => ({ businesses: [] }) };
      return localRequire(name);
    },
  }, { filename });
  const request = async (method = 'GET', body = {}, query = '') => {
    const req = { method, url: `/api/growth-dashboard?api=growth-goals&competencia=${month}&includePeople=1${query}`, headers: { host: 'localhost' },
      on(event, cb) { if (event === 'data') cb(JSON.stringify(body)); if (event === 'end') cb(); } };
    const res = { setHeader() {}, end(value) { this.body = JSON.parse(value); } };
    await module.exports(req, res);
    return res;
  };
  return { request, calls, initial, getSaved: () => saved, month };
};

test('GET includes active users even without a month document and never writes', async () => {
  for (const missingGoal of [true, false]) {
    const api = makeApi({ missingGoal });
    const res = await api.request('GET', {}, '&includeWeeklyProgress=1&weekStart=2099-09-16');
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body.people.map((person) => person.personId), ['new-user', 'existing-person', 'legacy-person']);
    assert.equal(res.body.goal === null, missingGoal);
    assert.deepEqual(res.body.goalBuckets.map((bucket) => [bucket.personId, bucket.roles, bucket.isAggregate]), [['outros', ['closer'], true]]);
    assert.ok(res.body.weeklyReadModel.people.some((person) => person.personId === 'new-user'));
    assert.equal(api.calls.filter((call) => call.path === 'users').length, 2, 'reads every user page');
    assert.ok(api.calls.every((call) => call.method === 'GET'));
  }
});

test('POST saves new user with SDR or Closer, preserving hidden goals, other weeks and monthly total', async () => {
  for (const role of ['sdr', 'closer']) {
    const api = makeApi();
    const res = await api.request('POST', { competencia: api.month, weeklyGoal: {
      weekKey: 'wk_2099-09-16', startDateKey: '2099-09-16', endDateKey: '2099-09-22',
      people: { 'new-user': { role, targetValue: 30 }, 'existing-person': { role: 'closer', targetValue: 8000 }, outros: { role: 'sdr', targetValue: 5000 } },
    } });
    assert.equal(res.statusCode, 200);
    const saved = api.getSaved();
    assert.equal(saved.valorMeta, api.initial.valorMeta);
    assert.deepEqual(saved.weeklyGoals['wk_2099-09-23'], api.initial.weeklyGoals['wk_2099-09-23']);
    const entries = saved.weeklyGoals['wk_2099-09-16'].individualMonthlyGoals;
    assert.equal(entries['new-user'].role, role);
    assert.equal(entries['inactive-person'].targetValue, 42);
    assert.equal(entries.outros.targetValue, 5000);
    assert.equal(entries.outros.role, 'closer');
    assert.equal(entries['existing-person'].targetValue, 8000);
    assert.equal((await api.request()).body.goal.weeklyGoals['wk_2099-09-16'].people.length, 4);
    assert.ok(api.calls.filter((call) => call.method === 'PATCH').every((call) => call.path === `growthGoals/${api.month}`));
  }
});

test('read failures do not produce incomplete editable data or overwrite existing goals', async () => {
  const listing = makeApi({ failUsers: true });
  assert.equal((await listing.request()).statusCode, 500);
  const saving = makeApi({ failRead: true });
  assert.equal((await saving.request('POST', { competencia: saving.month, valorMeta: 999 })).statusCode, 500);
  assert.ok([...listing.calls, ...saving.calls].every((call) => call.method === 'GET'));
});

test('modal renders unconfigured users, retains saved inputs and posts only after Salvar', async () => {
  class Element {
    constructor(value = '') { this.value = value; this.innerHTML = ''; this.classList = { toggle() {} }; }
    addEventListener() {}
    focus() {}
  }
  class Input extends Element {}
  class Select extends Element {}
  class Form extends Element {}
  const week = { weekKey: 'wk_2099-09-16', startDateKey: '2099-09-16', endDateKey: '2099-09-22', competencia: '2099-09' };
  const elements = new Map([
    ['[data-goal-competencia]', new Input(week.competencia)],
    ['[data-goal-valor]', new Input()],
    ['[data-goal-week-select]', new Select(week.startDateKey)],
    ['[data-goal-weekly-list]', new Element()],
    ['[data-goal-buckets-list]', new Element()],
  ]);
  const list = elements.get('[data-goal-weekly-list]');
  const buckets = elements.get('[data-goal-buckets-list]');
  const form = new Form();
  form.querySelector = (selector) => elements.get(selector) || null;
  // Minimal DOM adapter reads the actual rendered inputs for the save handler.
  form.querySelectorAll = () => [...(list.innerHTML + buckets.innerHTML).matchAll(/data-goal-weekly-row="([^"]+)"([\s\S]*?)(?=<div class="growth-goal-weekly-row"|$)/g)].map((match) => {
    const row = new Element();
    row.getAttribute = () => match[1];
    const role = match[2].match(/<option value="([^"]+)" selected>/)?.[1];
    const target = match[2].match(/data-goal-weekly-target\s+value="([^"]*)"/)?.[1];
    row.querySelector = (selector) => selector === '[data-goal-weekly-role]' ? new Select(role) : new Input(match[1] === 'new-user' ? '25' : target);
    return row;
  });
  let modal;
  let resolvePayload;
  const requests = [];
  const script = fs.readFileSync(require.resolve('../script.js'), 'utf8');
  const source = script.slice(script.indexOf('const openAdminGrowthGoalModal ='), script.indexOf('\nconst salesCopilotState'));
  vm.runInNewContext(`${source}\nopenAdminGrowthGoalModal();`, {
    currentRole: 'admin', adminGrowthGoalsState: { currentCompetencia: week.competencia, byCompetencia: new Map() },
    getCompetenciaKeySaoPaulo: () => week.competencia, isValidCompetenciaKey: () => true,
    getGrowthCommercialWeekOptions: () => [week], formatGrowthCommercialWeekLabel: () => 'Semana', formatCompetenciaLabelPtBr: (v) => v,
    escapeHtml: (v) => v, openModal: (options) => { modal = options; }, closeModal() {},
    modalBody: { querySelector: () => form }, modalPrimary: new Element(), modalSecondary: new Element(),
    HTMLElement: Element, HTMLFormElement: Form, HTMLInputElement: Input, HTMLSelectElement: Select,
    window: { setTimeout: (cb) => cb() }, console,
    loadGrowthGoalsWeekPayload: () => new Promise((resolve) => { resolvePayload = resolve; }),
    getDefaultWeeklyRoleForPerson: (p) => p.roles.includes('closer') ? 'closer' : 'sdr',
    currencyPtBrNoCents: String, formatGrowthWeeklyActualValue: (_, value) => String(value),
    parseMoneyPtBrLoose: Number,
    fetchWithAuth: async (url, options) => { requests.push({ url, ...options, body: JSON.parse(options.body) }); return { ok: true, json: async () => ({ ok: true }) }; },
    loadAdminGrowthGoals: async () => {},
  });
  modal.onPrimary();
  assert.equal(requests.length, 0, 'cannot save while loading');
  resolvePayload({ people: buildActiveCommercialPeople(users, people), goalBuckets: getGrowthGoalBuckets(), weeklyReadModel: {
    weeklyGoal: { people: [{ personId: 'existing-person', role: 'closer', targetValue: 8123.45 }, { personId: 'outros', role: 'closer', targetValue: 4000 }] },
  } });
  await new Promise(setImmediate);
  assert.match(list.innerHTML, /Luis Perdigão/);
  assert.doesNotMatch(list.innerHTML, /data-goal-weekly-row="outros"/);
  assert.match(buckets.innerHTML, /data-goal-weekly-role disabled/);
  assert.match(buckets.innerHTML, /value="4000"/);
  assert.doesNotMatch(buckets.innerHTML, /value="sdr"/);
  assert.doesNotMatch(list.innerHTML, /inactive-person/);
  assert.equal((list.innerHTML.match(/data-goal-weekly-row="new-user"/g) || []).length, 1);
  assert.match(list.innerHTML, /value="8123.45"/);
  assert.equal(requests.length, 0, 'opening the modal never persists');
  modal.onPrimary();
  await new Promise(setImmediate);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].method, 'POST');
  assert.deepEqual(requests[0].body.weeklyGoal.people.outros, { role: 'closer', targetValue: 4000 });
  assert.equal(requests[0].body.competencia, week.competencia);
  assert.deepEqual(requests[0].body.weeklyGoal.people['new-user'], { role: 'sdr', targetValue: 25 });
  assert.deepEqual(requests[0].body.weeklyGoal.people['existing-person'], { role: 'closer', targetValue: 8123.45 });
});


test('management GET aggregates the competence in one read-only response', async () => {
  const api = makeApi();
  const res = await api.request('GET', {}, '&mode=management');
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.management.monthlyExists, true);
  assert.equal(res.body.management.month.summary.meta, 123456);
  assert.equal(res.body.management.competencia, api.month);
  assert.ok(res.body.management.weeks.length >= 4);
  assert.ok(api.calls.every(call => call.method === 'GET'));
});

test('entity action is create for a new week inside an existing month and update after saving', async () => {
  const api = makeApi();
  const payload = { competencia: api.month, weeklyGoal: { weekKey: 'wk_2099-09-30', startDateKey: '2099-09-30', endDateKey: '2099-10-06', people: { 'new-user': { role: 'sdr', targetValue: 0 } } } };
  assert.equal((await api.request('POST', payload)).body.action, 'created');
  assert.equal((await api.request('POST', payload)).body.action, 'updated');
  assert.equal(api.getSaved().valorMeta, api.initial.valorMeta);
  assert.equal(api.getSaved().weeklyGoals['wk_2099-09-23'].customField, 'keep');
});


test('updating a legacy week preserves unknown fields and synchronizes legacy people arrays', async () => {
  const api = makeApi({ legacyArray: true });
  const result = await api.request('POST', { competencia: api.month, weeklyGoal: {
    weekKey: 'wk_2099-09-16', startDateKey: '2099-09-16', endDateKey: '2099-09-22',
    people: { 'existing-person': { role: 'closer', targetValue: 9500 } },
  } });
  assert.equal(result.statusCode, 200);
  const saved = api.getSaved().weeklyGoals['wk_2099-09-16'];
  assert.equal(saved.customWeekField, 'preserve-week');
  assert.equal(saved.individualMonthlyGoals['existing-person'].customPersonField, 'preserve-person');
  const read = await api.request();
  assert.equal(read.body.goal.weeklyGoals['wk_2099-09-16'].people.find(row => row.personId === 'existing-person').targetValue, 9500);
  assert.equal(saved.individualMonthlyGoals['inactive-person'].targetValue, 42);
});
