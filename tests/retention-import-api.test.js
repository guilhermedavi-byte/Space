const test = require("node:test");
const assert = require("node:assert/strict");

const handlerPath = require.resolve("../api/retention-import");
const authPath = require.resolve("../api/_lib/admin-request-auth");
const firestorePath = require.resolve("../api/_lib/firestore-admin");
const importLibPath = require.resolve("../api/_lib/retention-import");
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

const makeReq = (body = {}) => ({
  method: "POST",
  headers: { host: "localhost" },
  on(event, callback) {
    if (event === "data") callback(Buffer.from(JSON.stringify(body)));
    if (event === "end") callback();
  },
});

const install = ({ role = "admin", importEnabled = true, runImport = async () => ({ ok: true }) } = {}) => {
  delete require.cache[handlerPath];
  require.cache[authPath] = {
    id: authPath,
    filename: authPath,
    loaded: true,
    exports: {
      resolveAdminRequestAuth: async () => ({ ok: true, status: 200, session: { role, sub: "admin-1", name: "Admin" } }),
    },
  };
  require.cache[firestorePath] = {
    id: firestorePath,
    filename: firestorePath,
    loaded: true,
    exports: {
      listCollectionAsAdmin: async () => [{ firestoreDocId: "student-1", tipo: "student", nome: "Aluno" }],
    },
  };
  require.cache[importLibPath] = {
    id: importLibPath,
    filename: importLibPath,
    loaded: true,
    exports: {
      buildLegacyRetentionImportSnapshot: () => ({
        report: { importedStudents: 1 },
        payload: { dry_run: false, students: [], subscriptions: [], cases: [], events: [] },
      }),
    },
  };
  require.cache[storePath] = {
    id: storePath,
    filename: storePath,
    loaded: true,
    exports: {
      runLegacyRetentionImport: runImport,
    },
  };
  require.cache[flagsPath] = {
    id: flagsPath,
    filename: flagsPath,
    loaded: true,
    exports: {
      isRetentionLegacyImportEnabled: () => importEnabled,
    },
  };
  return require("../api/retention-import");
};

test("importador permanece bloqueado com flag desligada", async () => {
  const handler = install({ importEnabled: false });
  const res = makeRes();
  await handler(makeReq({ dryRun: true }), res);
  assert.equal(res.statusCode, 409);
  assert.equal(res.body.error, "retention_legacy_import_disabled");
});

test("dryRun não dispara importação real", async () => {
  let executed = 0;
  const handler = install({
    runImport: async () => {
      executed += 1;
      return { ok: true };
    },
  });
  const res = makeRes();
  await handler(makeReq({ dryRun: true }), res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.dryRun, true);
  assert.equal(executed, 0);
});

test("importação real exige confirmação explícita", async () => {
  const handler = install();
  const res = makeRes();
  await handler(makeReq({ dryRun: false, executeImport: true }), res);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, "missing_import_confirmation_phrase");
});
