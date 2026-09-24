const test = require("node:test");
const assert = require("node:assert/strict");
const { Readable } = require("node:stream");

const rollout = require("../api/_lib/commercial-rollout");

test("commercial rollout summary counts SDR, Closer, both and missing users", () => {
  const rows = [
    { id: "u1", commercialRoles: ["sdr"] },
    { id: "u2", commercialRoles: ["closer"] },
    { id: "u3", commercialRoles: ["sdr", "closer"] },
    { id: "u4", commercialRoles: [] },
    { id: "u5" },
  ];
  assert.deepEqual(rollout.summarizeCommercialRoles(rows), {
    total: 5,
    sdr: 1,
    closer: 1,
    both: 1,
    missing: 2,
  });
});

const loadAdminUsersHandler = ({
  session = { sub: "admin_1", role: "admin" },
  previousRoles = ["sdr"],
  target = null,
  targetError = null,
  actor = null,
} = {}) => {
  const writes = [];
  const adminActor = actor || {
    id: "admin_1",
    role: "admin",
    tipo: "admin",
    active: true,
    ativo: true,
    adminPermissions: ["comercial.users.update"],
  };
  const targetDoc = target || { id: "growth_1", role: "growth", tipo: "growth", commercialRoles: previousRoles, active: true, ativo: true };
  const modules = [
    "../api/admin-users",
    "../_lib/session",
    "../_lib/firebase-id-token",
    "../api/_lib/firestore-rest",
    "../api/_lib/firestore-admin",
    "../api/_lib/admin-permissions",
    "../api/_lib/student-mirror-sync",
  ];
  modules.forEach((path) => {
    try {
      delete require.cache[require.resolve(path)];
    } catch {}
  });
  require.cache[require.resolve("../_lib/session")] = {
    exports: { getSessionFromRequest: () => session },
  };
  require.cache[require.resolve("../_lib/firebase-id-token")] = {
    exports: { verifyFirebaseIdToken: async () => ({ uid: session?.sub }) },
  };
  require.cache[require.resolve("../api/_lib/firestore-rest")] = {
    exports: {
      PROJECT_ID: "space-test",
      getBearerTokenFromRequest: () => "token",
      encodeFields: (data) => ({ fields: data }),
    },
  };
  require.cache[require.resolve("../api/_lib/firestore-admin")] = {
    exports: {
      getDocumentAsAdmin: async (docPath) => {
        if (String(docPath).includes("users/admin_1")) return adminActor;
        if (targetError) throw targetError;
        return targetDoc;
      },
      commitWritesAsAdmin: async ({ writes: nextWrites }) => {
        writes.push(...nextWrites);
        return { ok: true, status: 200 };
      },
    },
  };
  require.cache[require.resolve("../api/_lib/student-mirror-sync")] = {
    exports: { syncStudentMirrorToSupabase: async () => ({ ok: true }) },
  };
  return { handler: require("../api/admin-users"), writes };
};

const invoke = async (handler, body) => {
  const req = Readable.from([Buffer.from(JSON.stringify(body))]);
  req.method = "PATCH";
  req.url = "/api/admin-users";
  req.headers = { host: "localhost", authorization: "Bearer token" };
  const res = {
    statusCode: 0,
    headers: {},
    setHeader(key, value) {
      this.headers[key] = value;
    },
    end(payload) {
      this.body = payload ? JSON.parse(payload) : {};
    },
  };
  await handler(req, res);
  return { status: res.statusCode, body: res.body };
};

test("admin commercial role update writes user patch and audit event", async () => {
  const { handler, writes } = loadAdminUsersHandler({ previousRoles: ["sdr"] });
  const res = await invoke(handler, { uid: "growth_1", patch: { commercialRoles: ["closer", "sdr", "bogus"] } });
  assert.equal(res.status, 200);
  assert.equal(res.body.sync.skipped, true);
  assert.equal(writes.length, 2);
  assert.deepEqual(writes[0].update.fields.commercialRoles, ["closer", "sdr"]);
  assert.equal(writes[1].update.fields.type, "commercialRoles.changed");
  assert.equal(writes[1].update.fields.userId, "growth_1");
  assert.deepEqual(writes[1].update.fields.from, ["sdr"]);
  assert.deepEqual(writes[1].update.fields.to, ["closer", "sdr"]);
  assert.equal(writes[1].update.fields.changedBy, "admin_1");
  assert.ok(writes[1].update.fields.timestamp);
});

test("non-admin cannot patch commercial roles", async () => {
  const { handler, writes } = loadAdminUsersHandler({ session: { sub: "growth_1", role: "growth" } });
  const res = await invoke(handler, { uid: "growth_1", patch: { commercialRoles: ["sdr"] } });
  assert.equal(res.status, 403);
  assert.equal(writes.length, 0);
});


test("ensure commercial role adds SDR to Growth user without roles", async () => {
  const { handler, writes } = loadAdminUsersHandler({ target: { role: "growth", tipo: "growth", commercialRoles: [] } });
  const res = await invoke(handler, { action: "ensure_commercial_role", uid: "growth_1", commercialRole: "sdr" });
  assert.equal(res.status, 200);
  assert.equal(res.body.unchanged, false);
  assert.deepEqual(res.body.before, []);
  assert.deepEqual(res.body.after, ["sdr"]);
  assert.deepEqual(writes[0].update.fields.commercialRoles, ["sdr"]);
  assert.equal(writes[1].update.fields.type, "commercialRoles.changed");
});

test("ensure commercial role preserves closer while adding SDR", async () => {
  const { handler, writes } = loadAdminUsersHandler({ target: { role: "growth", tipo: "growth", commercialRoles: ["closer"] } });
  const res = await invoke(handler, { action: "ensure_commercial_role", uid: "growth_1", commercialRole: "sdr" });
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.after, ["closer", "sdr"]);
  assert.deepEqual(writes[0].update.fields.commercialRoles, ["closer", "sdr"]);
});

test("ensure commercial role leaves existing SDR unchanged without writing", async () => {
  const { handler, writes } = loadAdminUsersHandler({ target: { role: "growth", tipo: "growth", commercialRoles: ["sdr"] } });
  const res = await invoke(handler, { action: "ensure_commercial_role", uid: "growth_1", commercialRole: "sdr" });
  assert.equal(res.status, 200);
  assert.equal(res.body.unchanged, true);
  assert.deepEqual(res.body.commercialRoles, ["sdr"]);
  assert.equal(writes.length, 0);
});

test("ensure commercial role leaves SDR plus closer unchanged without writing", async () => {
  const { handler, writes } = loadAdminUsersHandler({ target: { role: "growth", tipo: "growth", commercialRoles: ["sdr", "closer"] } });
  const res = await invoke(handler, { action: "ensure_commercial_role", uid: "growth_1", commercialRole: "sdr" });
  assert.equal(res.status, 200);
  assert.equal(res.body.unchanged, true);
  assert.deepEqual(res.body.commercialRoles, ["sdr", "closer"]);
  assert.equal(writes.length, 0);
});

test("ensure commercial role rejects admin target", async () => {
  const { handler, writes } = loadAdminUsersHandler({ target: { role: "admin", tipo: "admin", commercialRoles: [] } });
  const res = await invoke(handler, { action: "ensure_commercial_role", uid: "admin_2", commercialRole: "sdr" });
  assert.equal(res.status, 403);
  assert.equal(res.body.error, "target_must_be_growth");
  assert.equal(writes.length, 0);
});

test("ensure commercial role rejects student target", async () => {
  const { handler, writes } = loadAdminUsersHandler({ target: { role: "student", tipo: "student", commercialRoles: [] } });
  const res = await invoke(handler, { action: "ensure_commercial_role", uid: "student_1", commercialRole: "sdr" });
  assert.equal(res.status, 403);
  assert.equal(res.body.error, "target_must_be_growth");
  assert.equal(writes.length, 0);
});

test("ensure commercial role rejects invalid role", async () => {
  const { handler, writes } = loadAdminUsersHandler({ target: { role: "growth", tipo: "growth", commercialRoles: [] } });
  const res = await invoke(handler, { action: "ensure_commercial_role", uid: "growth_1", commercialRole: "owner" });
  assert.equal(res.status, 400);
  assert.equal(res.body.error, "invalid_commercial_role");
  assert.equal(writes.length, 0);
});

test("ensure commercial role returns 404 for missing user", async () => {
  const err = new Error("firestore_admin_get_failed");
  err.status = 404;
  const { handler, writes } = loadAdminUsersHandler({ targetError: err });
  const res = await invoke(handler, { action: "ensure_commercial_role", uid: "missing", commercialRole: "sdr" });
  assert.equal(res.status, 404);
  assert.equal(res.body.error, "user_not_found");
  assert.equal(writes.length, 0);
});

test("ensure commercial role requires comercial.users.update", async () => {
  const { handler, writes } = loadAdminUsersHandler({ actor: { role: "admin", tipo: "admin", active: true, ativo: true, adminPermissions: ["comercial.users.view"] } });
  const res = await invoke(handler, { action: "ensure_commercial_role", uid: "growth_1", commercialRole: "sdr" });
  assert.equal(res.status, 403);
  assert.equal(res.body.permission, "comercial.users.update");
  assert.equal(writes.length, 0);
});
