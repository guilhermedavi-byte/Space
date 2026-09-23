const test = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");

process.env.NODE_ENV = process.env.NODE_ENV || "test";

const { createHandler, isOwnAvatarStoragePath } = require("../api/profile-avatar")._test;

const makeReq = ({ method = "POST", body = {}, session, bearer = "token" } = {}) => {
  const req = new EventEmitter();
  req.method = method;
  req.headers = bearer ? { authorization: `Bearer ${bearer}` } : {};
  process.nextTick(() => {
    if (body !== undefined) req.emit("data", Buffer.from(JSON.stringify(body)));
    req.emit("end");
  });
  req.__session = session || { sub: "admin-1", role: "admin" };
  return req;
};

const makeRes = () => {
  const res = {
    statusCode: 0,
    headers: {},
    body: "",
    setHeader(key, value) {
      this.headers[key] = value;
    },
    end(value = "") {
      this.body = String(value || "");
      this.finished = true;
    },
  };
  return res;
};

const invoke = async (deps = {}, reqOptions = {}) => {
  const res = makeRes();
  const handler = createHandler({
    getSession: (req) => req.__session,
    getBearerToken: () => "token",
    verifyToken: async () => ({ uid: reqOptions.decodedUid || reqOptions.session?.sub || "admin-1" }),
    readProfile: async () => ({ photoURL: "https://old.example/avatar.webp", photoStoragePath: "profile_avatars/admin-1/old.webp", ...(deps.profile || {}) }),
    parseRequestBody: async () => reqOptions.body || { dataBase64: "data:image/png;base64,abc" },
    decodeImage: () => Buffer.from("image"),
    transformImage: async () => ({ outputBuffer: Buffer.from("webp"), outputMime: "image/webp", outputExtension: "webp" }),
    uploadObject: async ({ objectPath }) => ({ url: `https://cdn.example/${objectPath}`, objectPath }),
    deleteObject: async ({ objectPath }) => {
      deps.deleted = deps.deleted || [];
      deps.deleted.push(objectPath);
      return { ok: true };
    },
    commitWrites: async ({ writes }) => {
      deps.writes = writes;
      return { ok: true, status: 200 };
    },
    now: () => new Date("2026-09-23T12:00:00.000Z"),
    randomSuffix: () => "fixed",
    ...deps,
  });
  await handler(makeReq({ method: reqOptions.method || "POST", session: reqOptions.session }), res);
  return { res, json: JSON.parse(res.body || "{}"), deps };
};

test("profile avatar upload persists only the authenticated admin user's own avatar", async () => {
  const { res, json, deps } = await invoke();
  assert.equal(res.statusCode, 200);
  assert.equal(json.ok, true);
  assert.match(json.photoStoragePath, /^profile_avatars\/admin-1\//);
  assert.equal(deps.writes.length, 2);
  assert.equal(deps.writes[0].updateMask.fieldPaths.includes("photoURL"), true);
  assert.equal(deps.writes[0].updateMask.fieldPaths.includes("photoStoragePath"), true);
  assert.equal(deps.deleted[0], "profile_avatars/admin-1/old.webp");
});

test("profile avatar upload rejects token/session uid mismatch", async () => {
  const { res, json } = await invoke({}, { decodedUid: "other-user" });
  assert.equal(res.statusCode, 401);
  assert.equal(json.error, "invalid_credentials");
});

test("profile avatar upload cleans new storage object when profile persistence fails", async () => {
  const deps = {
    commitWrites: async () => ({ ok: false, status: 500 }),
  };
  const { res, json, deps: out } = await invoke(deps);
  assert.equal(res.statusCode, 500);
  assert.equal(json.error, "avatar_profile_update_failed");
  assert.equal(out.deleted.length, 1);
  assert.match(out.deleted[0], /^profile_avatars\/admin-1\//);
});

test("profile avatar remove clears profile reference and tolerates old storage cleanup", async () => {
  const { res, json, deps } = await invoke({}, { method: "DELETE" });
  assert.equal(res.statusCode, 200);
  assert.equal(json.photoURL, "");
  assert.equal(deps.writes[0].updateMask.fieldPaths.includes("photoURL"), true);
  assert.equal(deps.deleted[0], "profile_avatars/admin-1/old.webp");
});

test("profile avatar accepts Growth own profile but refuses unsupported roles", async () => {
  const growth = await invoke({}, { session: { sub: "growth-1", role: "growth" }, decodedUid: "growth-1" });
  assert.equal(growth.res.statusCode, 200);

  const student = await invoke({}, { session: { sub: "student-1", role: "student" }, decodedUid: "student-1" });
  assert.equal(student.res.statusCode, 403);
  assert.equal(student.json.error, "forbidden");
});

test("isOwnAvatarStoragePath only allows known own avatar prefixes", () => {
  assert.equal(isOwnAvatarStoragePath("u1", "profile_avatars/u1/a.webp"), true);
  assert.equal(isOwnAvatarStoragePath("u1", "admin_profiles/u1/a.png"), true);
  assert.equal(isOwnAvatarStoragePath("u1", "growth_profiles/u1/a.webp"), true);
  assert.equal(isOwnAvatarStoragePath("u1", "profile_avatars/u2/a.webp"), false);
  assert.equal(isOwnAvatarStoragePath("u1", "student_files/u1/a.webp"), false);
});
