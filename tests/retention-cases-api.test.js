const test = require("node:test");
const assert = require("node:assert/strict");

const handlerPath = require.resolve("../api/retention-cases");
const authPath = require.resolve("../api/_lib/admin-request-auth");
const storePath = require.resolve("../api/_lib/retention-store");
const flagsPath = require.resolve("../api/_lib/retention-flags");

const makeRes = () => ({
  statusCode: 0,
  headers: {},
  body: null,
  setHeader(name, value) {
    this.headers[name] = value;
  },
  end(value) {
    this.body = JSON.parse(String(value || "{}"));
  },
});

const installCommonStubs = ({
  role = "admin",
  listResult = { rows: [], counts: {}, queues: { avisos: [], decisoes: [], efetivados: [] } },
  applyResult = { ok: true, idempotent: false, snapshot: { case: {}, student: {} } },
  resolvedTargets = { studentId: "student-uuid", subscriptionId: "subscription-uuid", firestoreStudentId: "firestore-123" },
  retentionEnabled = true,
  involuntaryEnabled = false,
} = {}) => {
  delete require.cache[handlerPath];
  require.cache[authPath] = {
    id: authPath,
    filename: authPath,
    loaded: true,
    exports: {
      resolveAdminRequestAuth: async () => ({
        ok: true,
        status: 200,
        session: { sub: "user-1", role, name: "Usuário", email: "user@example.com" },
      }),
    },
  };
  require.cache[storePath] = {
    id: storePath,
    filename: storePath,
    loaded: true,
    exports: {
      listRetentionCases: async () => listResult,
      getRetentionCaseTimeline: async () => ({ events: [] }),
      applyRetentionCommand: async ({ command }) => ({ ...applyResult, receivedCommand: command }),
      resolveRetentionSubjectByFirestoreStudentId: async () => resolvedTargets,
    },
  };
  require.cache[flagsPath] = {
    id: flagsPath,
    filename: flagsPath,
    loaded: true,
    exports: {
      isRetentionV2Enabled: () => retentionEnabled,
      isRetentionInvoluntaryChurnEnabled: () => involuntaryEnabled,
    },
  };
  return require("../api/retention-cases");
};

test("GET queues retorna fonte nova e filas serializadas", async () => {
  const handler = installCommonStubs({
    listResult: {
      rows: [{ id: "case-1" }],
      counts: { open: 1 },
      queues: { avisos: [{ alunoId: "firestore-1" }], decisoes: [], efetivados: [] },
    },
  });
  const res = makeRes();
  await handler({ method: "GET", url: "/api/retention-cases?view=queues", headers: { host: "localhost" } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.source, "retention_v2");
  assert.equal(res.body.queues.avisos.length, 1);
});

test("POST bloqueia usuário sem capability", async () => {
  const handler = installCommonStubs({ role: "financeiro" });
  const res = makeRes();
  const req = {
    method: "POST",
    url: "/api/retention-cases",
    headers: { host: "localhost" },
    on(event, callback) {
      if (event === "data") callback(Buffer.from(JSON.stringify({ command: "register_formal_request", clientActionId: "click-1", firestoreStudentId: "firestore-123" })));
      if (event === "end") callback();
    },
  };
  await handler(req, res);
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.error, "forbidden");
});

test("POST exige justificativa em churn manual administrativo", async () => {
  const handler = installCommonStubs({ role: "admin" });
  const res = makeRes();
  const req = {
    method: "POST",
    url: "/api/retention-cases",
    headers: { host: "localhost" },
    on(event, callback) {
      if (event === "data") callback(Buffer.from(JSON.stringify({ command: "effectuate_churn", clientActionId: "click-1", firestoreStudentId: "firestore-123", override: true })));
      if (event === "end") callback();
    },
  };
  await handler(req, res);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, "missing_justification");
});

test("POST bloqueia churn involuntário quando a flag está desligada", async () => {
  const handler = installCommonStubs({ role: "admin", involuntaryEnabled: false });
  const res = makeRes();
  const req = {
    method: "POST",
    url: "/api/retention-cases",
    headers: { host: "localhost" },
    on(event, callback) {
      if (event === "data") callback(Buffer.from(JSON.stringify({
        command: "effectuate_churn",
        clientActionId: "click-2",
        firestoreStudentId: "firestore-123",
        justification: "rotina automática",
        override: true,
        payload: { mode: "automatic" },
      })));
      if (event === "end") callback();
    },
  };
  await handler(req, res);
  assert.equal(res.statusCode, 409);
  assert.equal(res.body.error, "involuntary_churn_disabled");
});

test("POST resolve student/subscription a partir do firestore_student_id", async () => {
  const handler = installCommonStubs({ role: "growth" });
  const res = makeRes();
  const req = {
    method: "POST",
    url: "/api/retention-cases",
    headers: { host: "localhost" },
    on(event, callback) {
      if (event === "data") callback(Buffer.from(JSON.stringify({
        command: "register_formal_request",
        clientActionId: "click-3",
        firestoreStudentId: "firestore-123",
        payload: { requested_at: "2026-08-26T12:00:00.000Z", reason: "Quero cancelar" },
      })));
      if (event === "end") callback();
    },
  };
  await handler(req, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.result.receivedCommand.student_id, "student-uuid");
  assert.equal(res.body.result.receivedCommand.subscription_id, "subscription-uuid");
});

test("POST exige requested_at saneado no pedido formal", async () => {
  const handler = installCommonStubs({ role: "growth" });
  const res = makeRes();
  const req = {
    method: "POST",
    url: "/api/retention-cases",
    headers: { host: "localhost" },
    on(event, callback) {
      if (event === "data") callback(Buffer.from(JSON.stringify({
        command: "register_formal_request",
        clientActionId: "click-4",
        firestoreStudentId: "firestore-123",
        payload: { requested_at: "invalid-date", reason: "Quero cancelar" },
      })));
      if (event === "end") callback();
    },
  };
  await handler(req, res);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, "missing_requested_at");
});

test("POST traduz mismatch de idempotência em conflito controlado", async () => {
  delete require.cache[handlerPath];
  require.cache[authPath] = {
    id: authPath,
    filename: authPath,
    loaded: true,
    exports: {
      resolveAdminRequestAuth: async () => ({
        ok: true,
        status: 200,
        session: { sub: "user-1", role: "admin", name: "Usuário" },
      }),
    },
  };
  require.cache[storePath] = {
    id: storePath,
    filename: storePath,
    loaded: true,
    exports: {
      listRetentionCases: async () => ({ rows: [], counts: {}, queues: { avisos: [], decisoes: [], efetivados: [] } }),
      getRetentionCaseTimeline: async () => ({ events: [] }),
      applyRetentionCommand: async () => {
        const error = new Error("idempotency_key_payload_mismatch");
        error.code = "idempotency_key_payload_mismatch";
        throw error;
      },
      resolveRetentionSubjectByFirestoreStudentId: async () => ({ studentId: "student-uuid", subscriptionId: "subscription-uuid" }),
    },
  };
  require.cache[flagsPath] = {
    id: flagsPath,
    filename: flagsPath,
    loaded: true,
    exports: {
      isRetentionV2Enabled: () => true,
      isRetentionInvoluntaryChurnEnabled: () => true,
    },
  };
  const handler = require("../api/retention-cases");
  const res = makeRes();
  const req = {
    method: "POST",
    url: "/api/retention-cases",
    headers: { host: "localhost" },
    on(event, callback) {
      if (event === "data") callback(Buffer.from(JSON.stringify({
        command: "effectuate_churn",
        clientActionId: "click-5",
        firestoreStudentId: "firestore-123",
        justification: "ok",
        override: true,
      })));
      if (event === "end") callback();
    },
  };
  await handler(req, res);
  assert.equal(res.statusCode, 409);
  assert.equal(res.body.error, "idempotency_key_payload_mismatch");
});
