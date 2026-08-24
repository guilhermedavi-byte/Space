const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const sdrMetricsPath = require.resolve("../api/sdr-metrics");
const httpPath = require.resolve("../_lib/http");
const authPath = require.resolve("../api/_lib/admin-request-auth");
const firestoreAdminPath = require.resolve("../api/_lib/firestore-admin");
const firestoreRestPath = require.resolve("../api/_lib/firestore-rest");

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

const loadHandler = ({
  body = { action: "log_call", outcome: "nao_atendeu" },
  authSession = { sub: "growth-1", role: "growth", name: "SDR Teste", email: "sdr@example.com" },
} = {}) => {
  const originalHttp = require.cache[httpPath];
  const originalAuth = require.cache[authPath];
  const originalFirestoreAdmin = require.cache[firestoreAdminPath];
  const originalFirestoreRest = require.cache[firestoreRestPath];
  delete require.cache[sdrMetricsPath];
  let listUsersCount = 0;
  let dateQueryCount = 0;
  let commitCount = 0;

  require.cache[httpPath] = {
    id: httpPath,
    filename: httpPath,
    loaded: true,
    exports: {
      readJsonBody: async () => body,
      sendJson(res, status, payload) {
        res.statusCode = status;
        res.body = payload;
      },
    },
  };

  require.cache[authPath] = {
    id: authPath,
    filename: authPath,
    loaded: true,
    exports: {
      resolveAdminRequestAuth: async () => ({
        ok: true,
        status: 200,
        session: authSession,
        profile: { user: { role: authSession.role } },
      }),
    },
  };

  require.cache[firestoreAdminPath] = {
    id: firestoreAdminPath,
    filename: firestoreAdminPath,
    loaded: true,
    exports: {
      listCollectionAsAdmin: async (collection) => {
        if (collection === "users") listUsersCount += 1;
        return [];
      },
      queryCollectionByDateRangeAsAdmin: async () => {
        dateQueryCount += 1;
        return [];
      },
      commitWritesAsAdmin: async () => {
        commitCount += 1;
        return { ok: true, status: 200, data: {} };
      },
    },
  };

  require.cache[firestoreRestPath] = {
    id: firestoreRestPath,
    filename: firestoreRestPath,
    loaded: true,
    exports: {
      PROJECT_ID: "space-test",
      encodeFields(data) {
        return { fields: data };
      },
    },
  };

  return {
    handler: require("../api/sdr-metrics"),
    stats: {
      get listUsersCount() {
        return listUsersCount;
      },
      get dateQueryCount() {
        return dateQueryCount;
      },
      get commitCount() {
        return commitCount;
      },
    },
    restore() {
      delete require.cache[sdrMetricsPath];
      if (originalHttp) require.cache[httpPath] = originalHttp;
      else delete require.cache[httpPath];
      if (originalAuth) require.cache[authPath] = originalAuth;
      else delete require.cache[authPath];
      if (originalFirestoreAdmin) require.cache[firestoreAdminPath] = originalFirestoreAdmin;
      else delete require.cache[firestoreAdminPath];
      if (originalFirestoreRest) require.cache[firestoreRestPath] = originalFirestoreRest;
      else delete require.cache[firestoreRestPath];
    },
  };
};

test("POST log_call não faz full scan de sdrActivityEvents", async () => {
  const { handler, stats, restore } = loadHandler();
  try {
    const res = makeRes();
    await handler({ method: "POST", headers: {}, url: "/api/sdr-metrics" }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(stats.listUsersCount, 0);
    assert.equal(stats.dateQueryCount, 1);
    assert.equal(stats.commitCount, 2);
  } finally {
    restore();
  }
});

test("POST undo_last consulta apenas a data do dia", async () => {
  const { handler, stats, restore } = loadHandler({
    body: { action: "undo_last", eventType: "call", dateKey: "2026-08-24" },
  });
  try {
    const res = makeRes();
    await handler({ method: "POST", headers: {}, url: "/api/sdr-metrics" }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(stats.listUsersCount, 0);
    assert.equal(stats.dateQueryCount, 1);
    assert.equal(stats.commitCount, 0);
  } finally {
    restore();
  }
});

test("script SDR usa timeout e estado de envio visível no POST", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "script.js"), "utf8");
  assert.match(source, /fetchWithAuthWithTimeout\(\s*"\s*\/api\/sdr-metrics"/);
  assert.match(source, /sdrPanelState\.isSubmitting = true/);
  assert.match(source, /Salvando registro…/);
  assert.match(source, /normalizeSdrWriteErrorMessage/);
});
