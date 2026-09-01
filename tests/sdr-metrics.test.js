const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const sdrMetricsPath = require.resolve("../api/sdr-metrics");
const httpPath = require.resolve("../_lib/http");
const authPath = require.resolve("../api/_lib/admin-request-auth");
const firestoreAdminPath = require.resolve("../api/_lib/firestore-admin");
const firestoreRestPath = require.resolve("../api/_lib/firestore-rest");
const { computeStats } = require("../api/sdr-metrics").__private;

test("Show Rate usa reuniões feitas dividido por agendamentos da mesma fonte", () => {
  const events = [
    ...Array.from({ length: 122 }, (_, index) => ({ id: `scheduled-${index}`, eventType: "call", outcome: "agendou" })),
    ...Array.from({ length: 56 }, (_, index) => ({ id: `show-${index}`, eventType: "meeting", outcome: "show" })),
    ...Array.from({ length: 23 }, (_, index) => ({ id: `noshow-${index}`, eventType: "meeting", outcome: "noshow" })),
  ];
  const stats = computeStats(events);
  assert.equal(stats.scheduled, 122);
  assert.equal(stats.shows, 56);
  assert.equal(stats.noShows, 23);
  assert.equal(stats.totalMeetings, 79);
  assert.equal(Number(stats.showRate.toFixed(1)), 45.9);
});

test("Show Rate retorna zero quando não há agendamentos", () => {
  const stats = computeStats([{ id: "show-sem-agenda", eventType: "meeting", outcome: "show" }]);
  assert.equal(stats.scheduled, 0);
  assert.equal(stats.shows, 1);
  assert.equal(stats.showRate, 0);
});

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
  let bodyValue = body;
  const originalHttp = require.cache[httpPath];
  const originalAuth = require.cache[authPath];
  const originalFirestoreAdmin = require.cache[firestoreAdminPath];
  const originalFirestoreRest = require.cache[firestoreRestPath];
  delete require.cache[sdrMetricsPath];
  let listUsersCount = 0;
  let dateQueryCount = 0;
  let commitCount = 0;
  const writtenEvents = new Map();

  require.cache[httpPath] = {
    id: httpPath,
    filename: httpPath,
    loaded: true,
    exports: {
      readJsonBody: async () => bodyValue,
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
        return Array.from(writtenEvents.values());
      },
      commitWritesAsAdmin: async ({ writes = [] } = {}) => {
        commitCount += 1;
        const duplicate = (Array.isArray(writes) ? writes : []).find((write) => write?.currentDocument?.exists === false && writtenEvents.has(String(write?.update?.name || "")));
        if (duplicate) return { ok: false, status: 409, data: { error: { status: "ALREADY_EXISTS" } } };
        (Array.isArray(writes) ? writes : []).forEach((write) => {
          const name = String(write?.update?.name || "");
          if (!name) return;
          writtenEvents.set(name, {
            ...write.update.fields,
            firestoreDocId: name.split("/").pop(),
            id: write.update.fields?.id || name.split("/").pop(),
          });
        });
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
    setBody(nextBody) {
      bodyValue = nextBody;
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
  const { handler, stats, restore } = loadHandler({
    body: { action: "log_call", outcome: "nao_atendeu", clientRequestId: "sdrreq_testcase_001" },
  });
  try {
    const res = makeRes();
    await handler({ method: "POST", headers: {}, url: "/api/sdr-metrics" }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(stats.listUsersCount, 1);
    assert.equal(stats.dateQueryCount, 2);
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

test("POST log_call é idempotente quando o mesmo clientRequestId chega duas vezes", async () => {
  const { handler, stats, restore } = loadHandler({
    body: { action: "log_call", outcome: "agendou", clientRequestId: "sdrreq_same_click_001" },
  });
  try {
    const first = makeRes();
    await handler({ method: "POST", headers: {}, url: "/api/sdr-metrics" }, first);
    const second = makeRes();
    await handler({ method: "POST", headers: {}, url: "/api/sdr-metrics" }, second);
    assert.equal(first.statusCode, 200);
    assert.equal(second.statusCode, 200);
    assert.equal(stats.commitCount, 4);
    assert.equal(stats.dateQueryCount, 4);
  } finally {
    restore();
  }
});

test("POST log_call cria dois eventos para dois cliques legítimos consecutivos", async () => {
  const firstClientRequestId = "sdrreq_legit_click_001";
  const secondClientRequestId = "sdrreq_legit_click_002";
  const { handler, stats, setBody, restore } = loadHandler({
    body: { action: "log_call", outcome: "nao_atendeu", clientRequestId: firstClientRequestId },
  });
  try {
    const first = makeRes();
    await handler({ method: "POST", headers: {}, url: "/api/sdr-metrics" }, first);
    assert.equal(first.statusCode, 200);
    assert.equal(first.body?.payload?.events?.length, 1);

    const second = makeRes();
    setBody({
      action: "log_call",
      outcome: "nao_atendeu",
      clientRequestId: secondClientRequestId,
    });
    await handler({ method: "POST", headers: {}, url: "/api/sdr-metrics" }, second);
    assert.equal(second.statusCode, 200);
    assert.equal(second.body?.payload?.events?.length, 2);
    assert.equal(stats.commitCount, 4);
    assert.equal(stats.dateQueryCount, 4);
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
  assert.match(source, /if \(previousValue === target\) \{/);
  assert.match(source, /if \(data\?\.payload && typeof data\.payload === "object"\)/);
  assert.match(source, /sdrPanelState\.data = data\.payload/);
  assert.match(source, /clientRequestId: requestId/);
  assert.match(source, /retryRequest = \{ requestId, signature, createdAt: Date\.now\(\) \}/);
});

test("Visão Geral exibe reuniões feitas e Show Rate do recorte SDR", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "script.js"), "utf8");
  assert.match(source, /label: "Reuniões feitas", value: sdrStats\.shows/);
  assert.match(source, /label: "Show rate", value: formatPercentPtBr\(sdrStats\.showRate, 1\)/);
  assert.match(source, /new URLSearchParams\(\{ from: range\.start, to: range\.end \}\)/);
  assert.match(source, /showRate: stats\.scheduled \? \(stats\.shows \/ stats\.scheduled\) \* 100 : 0/);
  assert.match(source, /\[commercial-overview\]\[show-rate-audit\]/);
  assert.match(source, /origemDados: "Firestore\/sdrActivityEvents \(painéis SDR\/Growth\)"/);
});
