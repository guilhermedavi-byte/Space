const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const crmLiveDataPath = require.resolve('../api/crm-live-data');
const crmLivePath = require.resolve('../api/crm-live');
const growthDashboardPath = require.resolve('../api/growth-dashboard');
const crmLiveEventsPath = require.resolve('../api/crm-live-events');
const sessionPath = require.resolve('../_lib/session');
const httpPath = require.resolve('../_lib/http');
const crmLiveLibPath = require.resolve('../api/_lib/crm-live');
const crmLiveRefreshLibPath = require.resolve('../api/_lib/crm-live-refresh');
const { resolveCommercialWeek } = require('../api/_lib/growth-people');

const makeRes = () => ({
  statusCode: 0,
  headers: {},
  setHeader(name, value) {
    this.headers[name] = value;
  },
  end(body) {
    this.body = body;
  },
});

const cachedCrmPayload = (weekKey = 'wk_2026-08-13') => ({
  snapshot: {
    status: 'VALID',
    calculationVersion: 4,
    fetchCompletedAt: '2026-08-13T12:00:00.000Z',
    calculatedAt: '2026-08-13T12:00:00.000Z',
  },
  weekly: { commercialWeek: { weekKey }, team: { closers: {}, sdrs: {} }, closers: [] },
  month: {},
  highlights: {},
  latestSale: null,
  unresolved: {},
  cacheDebug: {},
  pipeline: { rows: [], windowStartDateKey: '' },
});

const cachedSdrPayload = (weekKey = 'wk_2026-08-13') => ({
  weekly: { commercialWeek: { weekKey }, team: { sdrs: { targetValue: 0, actualValue: 0, progressPct: 0 } }, sdrs: [] },
  highlights: {},
  unresolved: {},
  cacheDebug: {},
});

const readCacheFixture = (weekKey = 'wk_2026-08-13', generatedAt = '2026-08-13T12:00:00.000Z') => async (docId) => {
  if (docId === 'crm') return { ok: true, data: { payload: cachedCrmPayload(weekKey), generatedAt } };
  if (docId === 'sdr') return { ok: true, data: { payload: cachedSdrPayload(weekKey), generatedAt } };
  return { ok: false, status: 404, data: null };
};

const installHttpStub = () => {
  // Auth tests isolate the publication boundary; pipeline tests exercise its real implementation.
  const publisherPath = require.resolve('../api/_lib/crm-snapshot-publish');
  require.cache[publisherPath] = { id: publisherPath, filename: publisherPath, loaded: true,
    exports: { runCrmSnapshot: async (build) => build('auth-test-snapshot') } };
  require.cache[httpPath] = {
    id: httpPath,
    filename: httpPath,
    loaded: true,
    exports: {
      sendJson(res, status, body) {
        res.statusCode = status;
        res.body = body;
      },
      readJsonBody: async () => ({}),
    },
  };
};

test('cookie da TV passa em /api/crm-live-data', async () => {
  delete require.cache[crmLiveDataPath];
  installHttpStub();
  require.cache[sessionPath] = {
    id: sessionPath,
    filename: sessionPath,
    loaded: true,
    exports: {
      getSessionFromRequest() {
        return null;
      },
    },
  };
  require.cache[crmLiveLibPath] = {
    id: crmLiveLibPath,
    filename: crmLiveLibPath,
    loaded: true,
    exports: {
      buildCrmLiveCrmSlice: async () => {
        throw new Error('reader_must_not_calculate_crm');
      },
      buildCrmLiveSdrSlice: async () => {
        throw new Error('reader_must_not_calculate_sdr');
      },
      buildWeeklyNewsScreens: () => [],
      decorateLeaderboardComparisons: ({ rows = [] }) => rows,
      validateCookieViewer: async () => ({ ok: true, tokenId: 'tv_test' }),
      readCacheDoc: readCacheFixture(),
      writeCacheDoc: async () => ({ ok: true }),
      getCacheMeta: () => ({ generatedAt: '2026-08-13T12:00:00.000Z', ageMs: 120000, ageMinutes: 2 }),
      CRM_CACHE_TTL_MS: 120000,
      SDR_CACHE_TTL_MS: 60000,
      loadWeeklyRollupsHistory: async () => [],
      loadCurrentGoal: async () => null,
      loadCrmLiveDefaultsConfig: async () => null,
      loadGrowthPeople: async () => [],
    },
  };
  const handler = require('../api/crm-live-data');
  const res = makeRes();
  await handler({ method: 'GET', url: '/api/crm-live-data', headers: { host: 'localhost', cookie: 'space_crm_live=token' } }, res);
  assert.equal(res.statusCode, 200);
});

test('cookie da TV não autentica /api/growth-dashboard?api=growth-metrics', async () => {
  delete require.cache[growthDashboardPath];
  installHttpStub();
  require.cache[sessionPath] = {
    id: sessionPath,
    filename: sessionPath,
    loaded: true,
    exports: {
      getSessionFromRequest() {
        return null;
      },
    },
  };
  const handler = require('../api/growth-dashboard');
  const res = makeRes();
  await handler({ method: 'GET', url: '/api/growth-dashboard?api=growth-metrics', headers: { host: 'localhost', cookie: 'space_crm_live=token' } }, res);
  assert.equal(res.statusCode, 401);
  assert.equal(res.body?.error, 'unauthorized');
});

test('sessão comercial autenticada passa em /api/crm-live-data', async () => {
  delete require.cache[crmLiveDataPath];
  installHttpStub();
  require.cache[sessionPath] = {
    id: sessionPath,
    filename: sessionPath,
    loaded: true,
    exports: {
      getSessionFromRequest() {
        return { role: 'comercial', sub: 'u-1', email: 'fabio@example.com' };
      },
    },
  };
  require.cache[crmLiveLibPath] = {
    id: crmLiveLibPath,
    filename: crmLiveLibPath,
    loaded: true,
    exports: {
      buildCrmLiveCrmSlice: async () => {
        throw new Error('reader_must_not_calculate_crm');
      },
      buildCrmLiveSdrSlice: async () => {
        throw new Error('reader_must_not_calculate_sdr');
      },
      buildWeeklyNewsScreens: () => [],
      decorateLeaderboardComparisons: ({ rows = [] }) => rows,
      validateCookieViewer: async () => ({ ok: false, status: 401, error: 'missing_cookie' }),
      readCacheDoc: readCacheFixture(),
      writeCacheDoc: async () => ({ ok: true }),
      getCacheMeta: () => ({ generatedAt: '2026-08-13T12:00:00.000Z', ageMs: 120000, ageMinutes: 2 }),
      CRM_CACHE_TTL_MS: 120000,
      SDR_CACHE_TTL_MS: 60000,
      loadWeeklyRollupsHistory: async () => [],
      loadCurrentGoal: async () => null,
      loadCrmLiveDefaultsConfig: async () => null,
      loadGrowthPeople: async () => [],
    },
  };
  const handler = require('../api/crm-live-data');
  const res = makeRes();
  await handler({ method: 'GET', url: '/api/crm-live-data', headers: { host: 'localhost' } }, res);
  assert.equal(res.statusCode, 200);
});

test('cache stale só é reaproveitado se for da mesma semana comercial', async () => {
  const currentWeekKey = resolveCommercialWeek({ now: new Date() }).weekKey;
  delete require.cache[crmLiveDataPath];
  installHttpStub();
  require.cache[sessionPath] = {
    id: sessionPath,
    filename: sessionPath,
    loaded: true,
    exports: {
      getSessionFromRequest() {
        return { role: 'comercial', sub: 'u-1' };
      },
    },
  };
  require.cache[crmLiveLibPath] = {
    id: crmLiveLibPath,
    filename: crmLiveLibPath,
    loaded: true,
    exports: {
      buildCrmLiveCrmSlice: async () => {
        throw new Error('crm_failed');
      },
      buildCrmLiveSdrSlice: async () => ({ weekly: { commercialWeek: { weekKey: currentWeekKey }, team: { closers: {}, sdrs: {} }, sdrs: [] }, highlights: {}, unresolved: {}, cacheDebug: {} }),
      buildWeeklyNewsScreens: () => [],
      decorateLeaderboardComparisons: ({ rows = [] }) => rows,
      validateCookieViewer: async () => ({ ok: false, status: 401, error: 'missing_cookie' }),
      readCacheDoc: async (docId) => docId === 'crm'
        ? ({ ok: true, data: { payload: { weekly: { commercialWeek: { weekKey: currentWeekKey }, team: { closers: {}, sdrs: {} }, closers: [] }, month: {}, highlights: {}, unresolved: {}, cacheDebug: {} }, generatedAt: '2026-08-17T10:00:00.000Z' } })
        : ({ ok: false, status: 404, data: null }),
      writeCacheDoc: async () => ({ ok: true }),
      getCacheMeta: () => ({ generatedAt: '2026-08-17T10:00:00.000Z', ageMs: 999999, ageMinutes: 17 }),
      CRM_CACHE_TTL_MS: 120000,
      SDR_CACHE_TTL_MS: 60000,
      loadWeeklyRollupsHistory: async () => [],
      loadCurrentGoal: async () => null,
      loadCrmLiveDefaultsConfig: async () => null,
      loadGrowthPeople: async () => [],
    },
  };
  const handler = require('../api/crm-live-data');
  const res = makeRes();
  await handler({ method: 'GET', url: '/api/crm-live-data', headers: { host: 'localhost' } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body?.stale, true);
});

test('cache stale de semana anterior é preservado como último snapshot bom', async () => {
  delete require.cache[crmLiveDataPath];
  installHttpStub();
  require.cache[sessionPath] = {
    id: sessionPath,
    filename: sessionPath,
    loaded: true,
    exports: {
      getSessionFromRequest() {
        return { role: 'comercial', sub: 'u-1' };
      },
    },
  };
  require.cache[crmLiveLibPath] = {
    id: crmLiveLibPath,
    filename: crmLiveLibPath,
    loaded: true,
    exports: {
      buildCrmLiveCrmSlice: async () => {
        throw new Error('crm_failed');
      },
      buildCrmLiveSdrSlice: async () => ({ weekly: { commercialWeek: { weekKey: 'wk_2026-08-19' }, team: { closers: {}, sdrs: {} }, sdrs: [] }, highlights: {}, unresolved: {}, cacheDebug: {} }),
      buildWeeklyNewsScreens: () => [],
      decorateLeaderboardComparisons: ({ rows = [] }) => rows,
      validateCookieViewer: async () => ({ ok: false, status: 401, error: 'missing_cookie' }),
      readCacheDoc: async (docId) => docId === 'crm'
        ? ({ ok: true, data: { payload: { weekly: { commercialWeek: { weekKey: 'wk_2026-08-11' }, team: { closers: {}, sdrs: {} }, closers: [] }, month: {}, highlights: {}, unresolved: {}, cacheDebug: {} }, generatedAt: '2026-08-18T23:58:00.000Z' } })
        : ({ ok: false, status: 404, data: null }),
      writeCacheDoc: async () => ({ ok: true }),
      getCacheMeta: () => ({ generatedAt: '2026-08-18T23:58:00.000Z', ageMs: 120000, ageMinutes: 2 }),
      CRM_CACHE_TTL_MS: 120000,
      SDR_CACHE_TTL_MS: 60000,
      loadWeeklyRollupsHistory: async () => [],
      loadCurrentGoal: async () => null,
      loadCrmLiveDefaultsConfig: async () => null,
      loadGrowthPeople: async () => [],
    },
  };
  const RealDate = Date;
  global.Date = class extends RealDate {
    constructor(value) {
      super(value || '2026-08-19T00:01:00-03:00');
    }
    static now() {
      return new RealDate('2026-08-19T00:01:00-03:00').getTime();
    }
  };
  try {
    const handler = require('../api/crm-live-data');
    const res = makeRes();
    await handler({ method: 'GET', url: '/api/crm-live-data', headers: { host: 'localhost' } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body?.stale, true);
    assert.equal(res.body?.snapshot?.refreshStatus, 'CRITICAL');
    assert.equal(res.body?.weekly?.commercialWeek?.weekKey, 'wk_2026-08-11');
  } finally {
    global.Date = RealDate;
  }
});

test('HTML e payload resolvem o mesmo buildId no mesmo processo', async () => {
  process.env.CRM_LIVE_BUILD_ID = 'build_same_process';
  delete require.cache[crmLiveDataPath];
  delete require.cache[crmLivePath];
  installHttpStub();
  require.cache[sessionPath] = {
    id: sessionPath,
    filename: sessionPath,
    loaded: true,
    exports: {
      getSessionFromRequest() {
        return { role: 'comercial', sub: 'u-1' };
      },
    },
  };
  require.cache[crmLiveLibPath] = {
    id: crmLiveLibPath,
    filename: crmLiveLibPath,
    loaded: true,
    exports: {
      buildCrmLiveCrmSlice: async () => {
        throw new Error('reader_must_not_calculate_crm');
      },
      buildCrmLiveSdrSlice: async () => {
        throw new Error('reader_must_not_calculate_sdr');
      },
      buildWeeklyNewsScreens: () => [],
      decorateLeaderboardComparisons: ({ rows = [] }) => rows,
      validateCookieViewer: async () => ({ ok: true, tokenId: 'tv_test' }),
      validateEntryToken: async () => ({ ok: true, tokenId: 'tv_test' }),
      buildCookie: () => 'cookie=value',
      buildCrmLiveReadCookie: () => 'read_cookie',
      clearCookie: () => 'clear_cookie',
      isSecureRequest: () => true,
      CRM_LIVE_COOKIE_NAME: 'space_crm_live',
      readCacheDoc: readCacheFixture('wk_2026-08-11'),
      writeCacheDoc: async () => ({ ok: true }),
      getCacheMeta: () => ({ generatedAt: '2026-08-13T12:00:00.000Z', ageMs: 120000, ageMinutes: 2 }),
      CRM_CACHE_TTL_MS: 120000,
      SDR_CACHE_TTL_MS: 60000,
      loadWeeklyRollupsHistory: async () => [],
      loadCurrentGoal: async () => null,
      loadCrmLiveDefaultsConfig: async () => null,
      loadGrowthPeople: async () => [],
    },
  };
  const htmlHandler = require('../api/crm-live');
  const dataHandler = require('../api/crm-live-data');
  const htmlRes = makeRes();
  await htmlHandler({ method: 'GET', url: '/tv/crm-live', headers: { host: 'localhost' } }, htmlRes);
  assert.equal(htmlRes.statusCode, 200);
  const html = String(htmlRes.body || '');
  const htmlBuildId = (html.match(/<meta name="crm-live-build-id" content="([^"]+)"/) || [])[1];
  const res = makeRes();
  await dataHandler({ method: 'GET', url: '/api/crm-live-data', headers: { host: 'localhost' } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(htmlBuildId, 'build_same_process');
  assert.equal(res.body?.buildId, 'build_same_process');
  delete process.env.CRM_LIVE_BUILD_ID;
});

test('snapshot cacheado não influencia o buildId do payload', async () => {
  process.env.CRM_LIVE_BUILD_ID = 'live_build_now';
  const currentWeekKey = resolveCommercialWeek({ now: new Date() }).weekKey;
  delete require.cache[crmLiveDataPath];
  installHttpStub();
  require.cache[sessionPath] = {
    id: sessionPath,
    filename: sessionPath,
    loaded: true,
    exports: {
      getSessionFromRequest() {
        return { role: 'comercial', sub: 'u-1' };
      },
    },
  };
  require.cache[crmLiveLibPath] = {
    id: crmLiveLibPath,
    filename: crmLiveLibPath,
    loaded: true,
    exports: {
      buildCrmLiveCrmSlice: async () => {
        throw new Error('crm_failed');
      },
      buildCrmLiveSdrSlice: async () => ({ weekly: { commercialWeek: { weekKey: currentWeekKey }, team: { closers: {}, sdrs: {} }, sdrs: [] }, highlights: {}, unresolved: {}, cacheDebug: {} }),
      buildWeeklyNewsScreens: () => [],
      decorateLeaderboardComparisons: ({ rows = [] }) => rows,
      validateCookieViewer: async () => ({ ok: false, status: 401, error: 'missing_cookie' }),
      readCacheDoc: async (docId) => docId === 'crm'
        ? ({ ok: true, data: { payload: { buildId: 'cached_old_build', weekly: { commercialWeek: { weekKey: currentWeekKey }, team: { closers: {}, sdrs: {} }, closers: [] }, month: {}, highlights: {}, unresolved: {}, cacheDebug: {} }, generatedAt: '2026-08-18T10:00:00.000Z' } })
        : ({ ok: false, status: 404, data: null }),
      writeCacheDoc: async () => ({ ok: true }),
      getCacheMeta: () => ({ generatedAt: '2026-08-18T10:00:00.000Z', ageMs: 121000, ageMinutes: 2 }),
      CRM_CACHE_TTL_MS: 120000,
      SDR_CACHE_TTL_MS: 60000,
      loadWeeklyRollupsHistory: async () => [],
      loadCurrentGoal: async () => null,
      loadCrmLiveDefaultsConfig: async () => null,
      loadGrowthPeople: async () => [],
    },
  };
  const handler = require('../api/crm-live-data');
  const res = makeRes();
  await handler({ method: 'GET', url: '/api/crm-live-data', headers: { host: 'localhost' } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body?.stale, true);
  assert.equal(res.body?.buildId, 'live_build_now');
  assert.notEqual(res.body?.buildId, 'cached_old_build');
  delete process.env.CRM_LIVE_BUILD_ID;
});

test('/api/crm-live-events lê apenas a fila materializada', async () => {
  delete require.cache[crmLiveEventsPath];
  installHttpStub();
  require.cache[sessionPath] = {
    id: sessionPath,
    filename: sessionPath,
    loaded: true,
    exports: {
      getSessionFromRequest() {
        return { role: 'comercial', sub: 'u-1' };
      },
    },
  };
  let readCount = 0;
  require.cache[crmLiveLibPath] = {
    id: crmLiveLibPath,
    filename: crmLiveLibPath,
    loaded: true,
    exports: {
      CRM_LIVE_EVENTS_COLLECTION: 'crmLiveEventsState',
      validateCookieViewer: async () => ({ ok: false, status: 401, error: 'missing_cookie' }),
      readStateDoc: async (collection, docId) => {
        readCount += 1;
        assert.equal(collection, 'crmLiveEventsState');
        assert.equal(docId, 'detector');
        return {
          ok: true,
          data: {
            initializedAt: '2026-08-13T12:00:00.000Z',
            queueGeneratedAt: new Date().toISOString(),
            queueDurationMs: 20000,
            lastRefreshSnapshotId: 'snapshot-1',
            pendingEvents: [{ id: 'event-1', type: 'sale_closed' }],
          },
        };
      },
      writeStateDoc: async () => {
        throw new Error('reader_must_not_write_event_state');
      },
      fetchCrmBusinesses: async () => {
        throw new Error('reader_must_not_fetch_crm_businesses');
      },
      buildCrmLiveEventQueue: () => {
        throw new Error('reader_must_not_build_event_queue');
      },
    },
  };
  require.cache[crmLiveRefreshLibPath] = {
    id: crmLiveRefreshLibPath,
    filename: crmLiveRefreshLibPath,
    loaded: true,
    exports: { DETECTOR_DOC_ID: 'detector', EVENT_QUEUE_DURATION_MS: 20000 },
  };
  const handler = require('../api/crm-live-events');
  const res = makeRes();
  await handler({ method: 'GET', url: '/api/crm-live-events', headers: { host: 'localhost' } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(readCount, 1);
  assert.deepEqual(res.body?.events?.map((event) => event.id), ['event-1']);
  assert.equal(res.body?.debug?.materialized, true);
});

test('leitores do CRM Live não importam refresh/cálculo/coleta DataCrazy', () => {
  const dataSource = fs.readFileSync(path.join(__dirname, '../api/crm-live-data.js'), 'utf8');
  const eventsSource = fs.readFileSync(path.join(__dirname, '../api/crm-live-events.js'), 'utf8');
  assert.doesNotMatch(dataSource, /\brunCrmSnapshot\b|\bbuildCrmLiveCrmSlice\b|\bbuildCrmLiveSdrSlice\b|\bgetCompleteCrmSource\b/);
  assert.doesNotMatch(eventsSource, /\bfetchCrmBusinesses\b|\bbuildCrmLiveEventQueue\b|\bwriteStateDoc\b|\bgetCompleteCrmSource\b/);
});

test('cron dedicado do CRM Live está configurado fora dos leitores', () => {
  const config = JSON.parse(fs.readFileSync(path.join(__dirname, '../vercel.json'), 'utf8'));
  assert.ok(config.functions?.['api/crm-live-refresh.js']);
  assert.ok(config.crons.some((entry) => entry.path === '/api/crm-live-refresh' && entry.schedule === '*/2 * * * *'));
});
