const test = require('node:test');
const assert = require('node:assert/strict');

const crmLiveDataPath = require.resolve('../api/crm-live-data');
const growthDashboardPath = require.resolve('../api/growth-dashboard');
const sessionPath = require.resolve('../_lib/session');
const httpPath = require.resolve('../_lib/http');
const crmLiveLibPath = require.resolve('../api/_lib/crm-live');

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

const installHttpStub = () => {
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
      buildCrmLiveCrmSlice: async () => ({ weekly: { team: { closers: {}, sdrs: {} }, closers: [] }, month: {}, highlights: {}, latestSale: null, unresolved: {}, cacheDebug: {} }),
      buildCrmLiveSdrSlice: async () => ({ weekly: { commercialWeek: { weekKey: 'wk_2026-08-13' }, team: { closers: {}, sdrs: {} }, sdrs: [] }, highlights: {}, unresolved: {}, cacheDebug: {} }),
      buildWeeklyNewsScreens: () => [],
      decorateLeaderboardComparisons: ({ rows = [] }) => rows,
      validateCookieViewer: async () => ({ ok: true, tokenId: 'tv_test' }),
      readCacheDoc: async () => ({ ok: false, status: 404, data: null }),
      writeCacheDoc: async () => ({ ok: true }),
      getCacheMeta: () => ({ generatedAt: '', ageMs: Infinity, ageMinutes: 0 }),
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
      buildCrmLiveCrmSlice: async () => ({ weekly: { team: { closers: {}, sdrs: {} }, closers: [], commercialWeek: { weekKey: 'wk_2026-08-13' } }, month: {}, highlights: {}, latestSale: null, unresolved: {}, cacheDebug: {} }),
      buildCrmLiveSdrSlice: async () => ({ weekly: { commercialWeek: { weekKey: 'wk_2026-08-13' }, team: { closers: {}, sdrs: {} }, sdrs: [] }, highlights: {}, unresolved: {}, cacheDebug: {} }),
      buildWeeklyNewsScreens: () => [],
      decorateLeaderboardComparisons: ({ rows = [] }) => rows,
      validateCookieViewer: async () => ({ ok: false, status: 401, error: 'missing_cookie' }),
      readCacheDoc: async () => ({ ok: false, status: 404, data: null }),
      writeCacheDoc: async () => ({ ok: true }),
      getCacheMeta: () => ({ generatedAt: '', ageMs: Infinity, ageMinutes: 0 }),
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
      buildCrmLiveSdrSlice: async () => ({ weekly: { commercialWeek: { weekKey: 'wk_2026-08-11' }, team: { closers: {}, sdrs: {} }, sdrs: [] }, highlights: {}, unresolved: {}, cacheDebug: {} }),
      buildWeeklyNewsScreens: () => [],
      decorateLeaderboardComparisons: ({ rows = [] }) => rows,
      validateCookieViewer: async () => ({ ok: false, status: 401, error: 'missing_cookie' }),
      readCacheDoc: async (docId) => docId === 'crm'
        ? ({ ok: true, data: { payload: { weekly: { commercialWeek: { weekKey: 'wk_2026-08-11' }, team: { closers: {}, sdrs: {} }, closers: [] }, month: {}, highlights: {}, unresolved: {}, cacheDebug: {} }, generatedAt: '2026-08-17T10:00:00.000Z' } })
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

test('cache stale de semana anterior é descartado na virada de semana', async () => {
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
    assert.equal(res.statusCode, 500);
  } finally {
    global.Date = RealDate;
  }
});
