const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');

const crmLiveRoute = require('../api/crm-live');

const extractInlineScript = (html) => {
  const match = String(html || '').match(/<script>\s*([\s\S]*?)\s*<\/script>/);
  assert.ok(match && match[1], 'inline CRM Live script not found');
  return match[1];
};

const createClassList = () => {
  const values = new Set();
  return {
    add(...tokens) {
      tokens.forEach((token) => values.add(String(token)));
    },
    remove(...tokens) {
      tokens.forEach((token) => values.delete(String(token)));
    },
    toggle(token, force) {
      const key = String(token);
      if (force === true) {
        values.add(key);
        return true;
      }
      if (force === false) {
        values.delete(key);
        return false;
      }
      if (values.has(key)) {
        values.delete(key);
        return false;
      }
      values.add(key);
      return true;
    },
    contains(token) {
      return values.has(String(token));
    },
    toString() {
      return [...values].join(' ');
    },
  };
};

const createStyle = () => ({
  props: {},
  setProperty(name, value) {
    this.props[name] = String(value);
  },
  removeProperty(name) {
    delete this.props[name];
  },
});

const createElement = () => {
  const listeners = new Map();
  return {
    innerHTML: '',
    textContent: '',
    dataset: {},
    attrs: {},
    style: createStyle(),
    classList: createClassList(),
    removed: false,
    focused: false,
    parentElement: null,
    addEventListener(type, handler) {
      listeners.set(String(type), handler);
    },
    dispatch(type, event = {}) {
      const handler = listeners.get(String(type));
      if (!handler) return;
      handler({
        preventDefault() {},
        ...event,
      });
    },
    click() {
      this.dispatch('click');
    },
    focus() {
      this.focused = true;
    },
    setAttribute(name, value) {
      this.attrs[String(name)] = String(value);
    },
    getAttribute(name) {
      return this.attrs[String(name)] || null;
    },
    querySelector() {
      return null;
    },
    querySelectorAll() {
      return [];
    },
    remove() {
      this.removed = true;
    },
  };
};

const createStorage = () => {
  const map = new Map();
  return {
    getItem(key) {
      return map.has(key) ? map.get(key) : null;
    },
    setItem(key, value) {
      map.set(String(key), String(value));
    },
    removeItem(key) {
      map.delete(String(key));
    },
  };
};

const createPayload = () => ({
  buildId: 'build-a',
  generatedAt: '2026-08-18T13:00:00.000Z',
  stale: false,
  month: {
    period: { startDateKey: '2026-08-01', endDateKey: '2026-08-31' },
    summary: { meta: 100000, realizado: 13400, totalVendas: 2, ticketMedio: 6700, percentAtingimento: 13.4, gap: 86600 },
    latestSale: null,
    windowCount: 1054,
  },
  weekly: {
    closers: [
      {
        personId: 'matheus-afonso',
        displayName: 'Matheus',
        role: 'closer',
        targetValue: 8000,
        actualValue: 5700,
        progressPct: 71.25,
        missingToGoal: 2300,
        count: 1,
        photoURL: '',
      },
      {
        personId: 'luis-eduardo',
        displayName: 'Luis',
        role: 'closer',
        targetValue: 8000,
        actualValue: 7700,
        progressPct: 96.25,
        missingToGoal: 300,
        count: 1,
        photoURL: '',
      },
    ],
    sdrs: [
      {
        personId: 'luana-mendonca',
        displayName: 'Luana',
        role: 'sdr',
        targetValue: 30,
        actualValue: 18,
        progressPct: 60,
        missingToLead: 4,
        leaderName: 'Felipe',
        photoURL: '',
      },
      {
        personId: 'felipe-santos',
        displayName: 'Felipe',
        role: 'sdr',
        targetValue: 30,
        actualValue: 22,
        progressPct: 73.33,
        leaderPressureUnits: 4,
        leaderPressureFromName: 'Luana',
        photoURL: '',
      },
    ],
    team: {
      closers: { targetValue: 20000, actualValue: 13400, missingValue: 6600, progressPct: 67, count: 2, ticketMedio: 6700 },
      sdrs: { targetValue: 100, actualValue: 40, missingValue: 60, progressPct: 40, count: 40 },
    },
    commercialWeek: { startDateKey: '2026-08-12', endDateKey: '2026-08-18' },
  },
  highlights: { closer: null, sdr: null },
  pipeline: { rows: [] },
  news: [],
});

const flush = async () => {
  await new Promise((resolve) => setImmediate(resolve));
  await Promise.resolve();
  await Promise.resolve();
};

const bootCrmLive = async ({ dataResponse, eventsResponse }) => {
  const html = crmLiveRoute.buildHtml({ buildId: 'build-a' });
  const script = extractInlineScript(html);

  const crmLiveEl = createElement();
  const root = createElement();
  const sidePanelEl = createElement();
  const interruptionEl = createElement();
  const statusEl = createElement();
  const dotsEl = createElement();
  const emptyEl = createElement();
  const prevButton = createElement();
  const nextButton = createElement();
  const toggleButton = createElement();
  const toggleIconEl = createElement();
  const localStorage = createStorage();
  const sessionStorage = createStorage();
  const documentListeners = new Map();
  const fetchCalls = [];
  let intervalId = 0;

  const document = {
    hidden: false,
    querySelector(selector) {
      const map = {
        '.crm-live': crmLiveEl,
        '[data-crm-live-root]': root,
        '[data-crm-live-sidepanel]': sidePanelEl,
        '[data-crm-live-interruption]': interruptionEl,
        '[data-crm-live-status]': statusEl,
        '[data-crm-live-dots]': dotsEl,
        '[data-crm-live-empty]': emptyEl,
        '[data-crm-live-prev]': prevButton,
        '[data-crm-live-next]': nextButton,
        '[data-crm-live-toggle]': toggleButton,
        '[data-crm-live-toggle-icon]': toggleIconEl,
      };
      return map[selector] || null;
    },
    addEventListener(type, handler) {
      documentListeners.set(String(type), handler);
    },
  };

  const responseMap = {
    '/api/crm-live-data': dataResponse,
    '/api/crm-live-events': eventsResponse,
  };

  const sandbox = {
    window: {
      innerWidth: 1920,
      innerHeight: 1080,
      devicePixelRatio: 1,
      location: { reload() {} },
      localStorage,
      sessionStorage,
    },
    document,
    localStorage,
    sessionStorage,
    fetch: async (url) => {
      fetchCalls.push(String(url));
      const response = responseMap[String(url)];
      if (!response) throw new Error(`unexpected fetch: ${url}`);
      if (response.throwError) throw response.throwError;
      return {
        ok: response.ok,
        status: response.status,
        json: async () => response.body,
      };
    },
    requestAnimationFrame: (fn) => fn(),
    setInterval: () => ++intervalId,
    clearInterval() {},
    setTimeout: (fn) => {
      fn();
      return ++intervalId;
    },
    clearTimeout() {},
    Image: class {},
    URL,
    Date,
    Intl,
    Math,
    JSON,
    Number,
    String,
    Object,
    Array,
    Boolean,
    RegExp,
    Error,
    Promise,
    Map,
    Set,
    parseInt,
    parseFloat,
    encodeURIComponent,
    decodeURIComponent,
    console: {
      log() {},
      warn() {},
      error() {},
    },
  };

  vm.runInNewContext(script, sandbox);
  await flush();

  return {
    root,
    dotsEl,
    emptyEl,
    nextButton,
    prevButton,
    statusEl,
    fetchCalls,
    documentListeners,
  };
};

test('crm-live-data OK e crm-live-events falhando sai do loading e pinta o primeiro slide', async () => {
  const booted = await bootCrmLive({
    dataResponse: { ok: true, status: 200, body: createPayload() },
    eventsResponse: {
      ok: false,
      status: 500,
      body: { error: 'crm_live_events_failed', message: 'crm_window_fetch_failed' },
    },
  });

  assert.ok(booted.fetchCalls.includes('/api/crm-live-data'));
  assert.ok(booted.fetchCalls.includes('/api/crm-live-events'));
  assert.equal(booted.emptyEl.removed, true);
  assert.match(booted.root.innerHTML, /Ranking dos closers/);
  assert.doesNotMatch(booted.root.innerHTML, /Carregando CRM Live/);
});

test('fonte não-crítica em erro renderiza estado degradado e continua na rotação', async () => {
  const booted = await bootCrmLive({
    dataResponse: { ok: true, status: 200, body: createPayload() },
    eventsResponse: {
      ok: false,
      status: 500,
      body: { error: 'crm_window_fetch_failed', message: 'crm_window_fetch_failed' },
    },
  });

  assert.match(booted.root.innerHTML, /Modo degradado/);
  assert.match(booted.root.innerHTML, /Interrupções indisponíveis/);
  assert.equal((booted.dotsEl.innerHTML.match(/crm-live-dot/g) || []).length, 6);

  booted.nextButton.click();
  booted.nextButton.click();
  booted.nextButton.click();
  booted.nextButton.click();
  booted.nextButton.click();

  assert.match(booted.root.innerHTML, /Monitoramento da rotação/);
});

test('HTML servido executa o script do cliente sem exceção e monta ao menos uma tela', async () => {
  const booted = await bootCrmLive({
    dataResponse: { ok: true, status: 200, body: createPayload() },
    eventsResponse: { ok: true, status: 200, body: { coldStart: true, events: [] } },
  });

  const screenCount = (booted.root.innerHTML.match(/crm-live-screen/g) || []).length;
  assert.ok(screenCount > 0);
  assert.doesNotMatch(booted.root.innerHTML, /Carregando CRM Live/);
});

test('modo últimas 24h não renderiza mais o ponteiro de segundos', async () => {
  const booted = await bootCrmLive({
    dataResponse: { ok: true, status: 200, body: createPayload() },
    eventsResponse: { ok: true, status: 200, body: { coldStart: true, events: [] } },
  });

  assert.doesNotMatch(booted.root.innerHTML, /data-crm-live-deadline-pointer/);
  assert.doesNotMatch(crmLiveRoute.buildHtml({ buildId: 'test-build' }), /crm-live-deadline-pointer/);
});
