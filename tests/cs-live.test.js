const test = require("node:test");
const assert = require("node:assert/strict");

const dataPath = require.resolve("../api/cs-live-data");
const routePath = require.resolve("../api/cs-live");
const authPath = require.resolve("../api/_lib/cs-live-auth");
const sessionPath = require.resolve("../_lib/session");
const httpPath = require.resolve("../_lib/http");

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

test("CS Live payload mock expõe metas e direção por métrica", async () => {
  delete require.cache[dataPath];
  installHttpStub();
  require.cache[sessionPath] = {
    id: sessionPath,
    filename: sessionPath,
    loaded: true,
    exports: {
      getSessionFromRequest() {
        return { role: "admin", sub: "u-1" };
      },
    },
  };
  const handler = require("../api/cs-live-data");
  const res = makeRes();
  await handler({ method: "GET", url: "/api/cs-live-data", headers: { host: "localhost" } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(Array.isArray(res.body?.metrics), true);
  assert.deepEqual(
    res.body.metrics.map((metric) => ({ key: metric.key, targetValue: metric.targetValue, direction: metric.direction })),
    [
      { key: "cancelamento", targetValue: 3.5, direction: "lower_is_better" },
      { key: "inadimplencia", targetValue: 5, direction: "lower_is_better" },
      { key: "presenca", targetValue: 88, direction: "higher_is_better" },
    ]
  );
});

test("CS Live usa cookie Path=/ no redirect com token", async () => {
  delete require.cache[routePath];
  delete require.cache[authPath];
  require.cache[authPath] = {
    id: authPath,
    filename: authPath,
    loaded: true,
    exports: {
      buildCookie(name, value, options = {}) {
        return `${name}=${value}; Path=${options.path || "/"}`;
      },
      buildReadCookie() {
        return "signed";
      },
      clearCookie() {
        return "space_cs_live=; Path=/";
      },
      isSecureRequest() {
        return false;
      },
      validateEntryToken: async () => ({ ok: true, tokenId: "tv_1" }),
      validateCookieViewer: async () => ({ ok: true }),
      CS_LIVE_COOKIE_NAME: "space_cs_live",
    },
  };
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
  const handler = require("../api/cs-live");
  const res = makeRes();
  await handler({ method: "GET", url: "/tv/cs-live?token=abc", headers: { host: "localhost" } }, res);
  assert.equal(res.statusCode, 302);
  assert.match(String(res.headers["Set-Cookie"] || ""), /Path=\//);
});

test("HTML do CS Live deixa dados de exemplo visíveis", () => {
  delete require.cache[routePath];
  const route = require("../api/cs-live");
  const html = route.buildHtml({ buildId: "test-build" });
  assert.equal(html.includes("Dados de exemplo"), true);
  assert.equal(html.includes("/api/cs-live-data"), true);
});
