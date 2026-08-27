const test = require("node:test");
const assert = require("node:assert/strict");

const handlerPath = require.resolve("../api/retention-churn-job");
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

const makeReq = ({ body = {}, secret = "" } = {}) => ({
  method: "POST",
  headers: { host: "localhost", "x-retention-job-secret": secret },
  on(event, callback) {
    if (event === "data") callback(Buffer.from(JSON.stringify(body)));
    if (event === "end") callback();
  },
});

const install = ({ enabled = true, result = { ok: true, processed: 1 } } = {}) => {
  delete require.cache[handlerPath];
  require.cache[storePath] = {
    id: storePath,
    filename: storePath,
    loaded: true,
    exports: {
      runScheduledRetentionChurn: async () => result,
    },
  };
  require.cache[flagsPath] = {
    id: flagsPath,
    filename: flagsPath,
    loaded: true,
    exports: {
      isRetentionInvoluntaryChurnEnabled: () => enabled,
    },
  };
  return require("../api/retention-churn-job");
};

test("job recusa execução sem segredo configurado", async () => {
  const prev = process.env.RETENTION_CHURN_JOB_SECRET;
  delete process.env.RETENTION_CHURN_JOB_SECRET;
  const handler = install();
  const res = makeRes();
  await handler(makeReq(), res);
  assert.equal(res.statusCode, 503);
  process.env.RETENTION_CHURN_JOB_SECRET = prev;
});

test("job exige segredo correto e respeita flag", async () => {
  const prev = process.env.RETENTION_CHURN_JOB_SECRET;
  process.env.RETENTION_CHURN_JOB_SECRET = "segredo";
  const handler = install({ enabled: false });
  const res = makeRes();
  await handler(makeReq({ secret: "segredo" }), res);
  assert.equal(res.statusCode, 409);
  assert.equal(res.body.error, "involuntary_churn_disabled");
  process.env.RETENTION_CHURN_JOB_SECRET = prev;
});

test("job executa com segredo válido", async () => {
  const prev = process.env.RETENTION_CHURN_JOB_SECRET;
  process.env.RETENTION_CHURN_JOB_SECRET = "segredo";
  const handler = install({ enabled: true, result: { ok: true, processed: 2 } });
  const res = makeRes();
  await handler(makeReq({ secret: "segredo", body: { limit: 20 } }), res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.result.processed, 2);
  process.env.RETENTION_CHURN_JOB_SECRET = prev;
});
