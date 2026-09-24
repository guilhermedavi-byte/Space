const test = require("node:test");
const assert = require("node:assert/strict");
const { Readable } = require("node:stream");
const { createHandler, __private } = require("../api/space-phone");
const { createSessionForUser } = require("../_lib/session");

const invoke = async (handler, { method = "GET", url = "/api/space-phone", body } = {}) => {
  const req = body ? Readable.from([JSON.stringify(body)]) : Readable.from([]);
  req.method = method;
  req.url = url;
  req.headers = { host: "localhost" };
  let raw = "";
  const headers = {};
  const res = { statusCode: 200, setHeader(k, v) { headers[k.toLowerCase()] = v; }, end(v = "") { raw += v; } };
  await handler(req, res);
  return { status: res.statusCode, headers, json: raw ? JSON.parse(raw) : null };
};

test("space phone normalizes manual US and international phone numbers", () => {
  assert.deepEqual(__private.normalizePhoneInput("(617) 555-1212"), { ok: true, raw: "(617) 555-1212", normalized: "+16175551212" });
  assert.deepEqual(__private.normalizePhoneInput("6175551212"), { ok: true, raw: "6175551212", normalized: "+16175551212" });
  assert.deepEqual(__private.normalizePhoneInput("+55 11 99999-9999"), { ok: true, raw: "+55 11 99999-9999", normalized: "+5511999999999" });
  assert.equal(__private.normalizePhoneInput("123").ok, false);
});

test("growth SDR list is server-side scoped to own voice calls", async () => {
  const seen = [];
  const handler = createHandler({
    authResolver: async () => ({ ok: true, session: { role: "growth", sub: "sdr-1" }, profile: { user: { commercialRoles: ["sdr"] } } }),
    request: async (path) => {
      seen.push(path);
      if (path.startsWith("/voice_calls")) return { data: [{ id: "c1", sdr_uid: "sdr-1", to_number: "+16175551212", status: "completed", started_at: "2026-09-24T12:00:00Z", duration_seconds: 61 }] };
      return { data: [] };
    },
  });
  const res = await invoke(handler, { url: "/api/space-phone?period=today&sdr=other" });
  assert.equal(res.status, 200);
  assert.equal(res.json.scope, "self");
  assert.equal(res.json.calls[0].sdrUid, "sdr-1");
  assert.ok(seen.find((path) => path.includes("space_user_uid=eq.sdr-1")));
  assert.ok(!seen.find((path) => path.includes("space_user_uid=eq.other")));
});

test("admin can list all calls or select an SDR", async () => {
  const seen = [];
  const handler = createHandler({
    authResolver: async () => ({ ok: true, session: { role: "admin", sub: "admin" } }),
    permissionResolver: async () => ({ ok: true }),
    request: async (path) => {
      seen.push(path);
      return { data: path.startsWith("/voice_calls") ? [{ id: "c2", sdr_uid: "sdr-2", to_number: "+16175550000", status: "completed", started_at: "2026-09-24T12:00:00Z" }] : [] };
    },
  });
  const res = await invoke(handler, { url: "/api/space-phone?period=last7&sdr=sdr-2" });
  assert.equal(res.status, 200);
  assert.equal(res.json.scope, "admin");
  assert.ok(seen.find((path) => path.includes("space_user_uid=eq.sdr-2")));
});

test("space phone persists notes, outcome and callback on the real voice call", async () => {
  const patches = [];
  const handler = createHandler({
    authResolver: async () => ({ ok: true, session: { role: "growth", sub: "sdr-1" }, profile: { user: { commercialRoles: ["sdr"] } } }),
    request: async (path, options = {}) => {
      if (options.method === "PATCH") {
        patches.push({ path, body: options.body });
        return { data: [{ id: "call-1", sdr_uid: "sdr-1", to_number: "+16175551212", notes: options.body.notes, outcome: options.body.outcome, callback_at: options.body.callback_at }] };
      }
      if (path.startsWith("/voice_calls")) return { data: [{ id: "call-1", sdr_uid: "sdr-1", to_number: "+16175551212", status: "completed", started_at: "2026-09-24T12:00:00Z" }] };
      return { data: [] };
    },
  });
  const res = await invoke(handler, { method: "PATCH", body: { id: "call-1", notes: "Cliente pediu retorno.", outcome: "retornar_depois", callbackAt: "2026-09-25T17:00:00.000Z" } });
  assert.equal(res.status, 200);
  assert.equal(patches.length, 1);
  assert.equal(patches[0].path, "/voice_calls?id=eq.call-1");
  assert.deepEqual(patches[0].body, { notes: "Cliente pediu retorno.", outcome: "retornar_depois", callback_at: "2026-09-25T17:00:00.000Z" });
  assert.equal(res.json.call.outcome, "retornar_depois");
});

test("space phone route boots the dedicated admin panel and script", async () => {
  const appPath = require.resolve("../api/app");
  const firestoreAdminPath = require.resolve("../api/_lib/firestore-admin");
  const previousApp = require.cache[appPath];
  const previousFirestoreAdmin = require.cache[firestoreAdminPath];
  require.cache[firestoreAdminPath] = {
    id: firestoreAdminPath,
    filename: firestoreAdminPath,
    loaded: true,
    exports: { getDocumentAsAdmin: async () => ({ tipo: "admin", role: "admin", isSuperAdmin: true, adminPermissions: ["comercial.spacePhone.view"] }) },
  };
  delete require.cache[appPath];
  const appHandler = require("../api/app");
  const req = Readable.from([]);
  req.method = "GET";
  req.url = "/api/app?path=admin/comercial/pre-vendas/ligacoes";
  req.headers = { host: "localhost", cookie: "space_session=" + createSessionForUser({ id: "admin", role: "admin", name: "Admin", email: "admin@example.com", adminPermissions: ["comercial.spacePhone.view"] }).token };
  let body = "";
  const res = { statusCode: 200, setHeader() {}, end(v = "") { body += v; } };
  try {
    await appHandler(req, res);
    assert.equal(res.statusCode, 200);
    assert.match(body, /data-initial-panel="space-phone"/);
    assert.match(body, /data-space-phone/);
    assert.match(body, /src="space-phone\.js\?v=1"/);
  } finally {
    if (previousApp) require.cache[appPath] = previousApp;
    else delete require.cache[appPath];
    if (previousFirestoreAdmin) require.cache[firestoreAdminPath] = previousFirestoreAdmin;
    else delete require.cache[firestoreAdminPath];
  }
});

test("space phone route boots the Growth equivalent panel", async () => {
  const appPath = require.resolve("../api/app");
  const previousApp = require.cache[appPath];
  delete require.cache[appPath];
  const appHandler = require("../api/app");
  const req = Readable.from([]);
  req.method = "GET";
  req.url = "/api/app?path=growth/comercial/pre-vendas/ligacoes";
  req.headers = { host: "localhost", cookie: "space_session=" + createSessionForUser({ id: "growth-1", role: "growth", name: "SDR", email: "sdr@example.com", commercialRoles: ["sdr"] }).token };
  let body = "";
  const res = { statusCode: 200, setHeader() {}, end(v = "") { body += v; } };
  try {
    await appHandler(req, res);
    assert.equal(res.statusCode, 200);
    assert.match(body, /data-initial-panel="space-phone"/);
    assert.match(body, /data-space-phone/);
  } finally {
    if (previousApp) require.cache[appPath] = previousApp;
    else delete require.cache[appPath];
  }
});
