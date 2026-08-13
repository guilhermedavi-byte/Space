const test = require('node:test');
const assert = require('node:assert/strict');

const crmLiveDataPath = require.resolve('../api/crm-live-data');
const growthDashboardPath = require.resolve('../api/growth-dashboard');
const sessionPath = require.resolve('../api/_lib/session');
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
