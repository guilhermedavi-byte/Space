const test = require("node:test");
const assert = require("node:assert/strict");

const handlerPath = require.resolve("../api/teacher-workhours");
const httpPath = require.resolve("../_lib/http");
const sessionPath = require.resolve("../_lib/session");
const firestoreAdminPath = require.resolve("../api/_lib/firestore-admin");
const firestoreRestPath = require.resolve("../_lib/firestore-rest");
const firebaseIdTokenPath = require.resolve("../_lib/firebase-id-token");
const firestoreUserPath = require.resolve("../_lib/firestore-user");

const loadHandler = ({
  session = { role: "teacher", sub: "teacher-1", email: "teacher@example.test" },
  idToken = "",
  decoded = null,
  profile = null,
  adminDoc = null,
} = {}) => {
  delete require.cache[handlerPath];
  require.cache[httpPath] = {
    id: httpPath,
    filename: httpPath,
    loaded: true,
    exports: {
      readJsonBody: async () => ({}),
      sendJson(res, status, body) {
        res.statusCode = status;
        res.body = body;
      },
    },
  };
  require.cache[sessionPath] = {
    id: sessionPath,
    filename: sessionPath,
    loaded: true,
    exports: {
      getSessionFromRequest() {
        return session;
      },
    },
  };
  require.cache[firestoreAdminPath] = {
    id: firestoreAdminPath,
    filename: firestoreAdminPath,
    loaded: true,
    exports: {
      async getDocumentAsAdmin() {
        if (adminDoc == null) {
          const error = new Error("not_found");
          error.status = 404;
          throw error;
        }
        return adminDoc;
      },
    },
  };
  require.cache[firestoreRestPath] = {
    id: firestoreRestPath,
    filename: firestoreRestPath,
    loaded: true,
    exports: {
      decodeFields(value) {
        return value;
      },
      async firestoreGetDocument() {
        return { ok: false, status: 401, data: null };
      },
      async firestorePatchDocument() {
        return { ok: true, status: 200 };
      },
      getBearerTokenFromRequest() {
        return idToken;
      },
    },
  };
  require.cache[firebaseIdTokenPath] = {
    id: firebaseIdTokenPath,
    filename: firebaseIdTokenPath,
    loaded: true,
    exports: {
      async verifyFirebaseIdToken() {
        if (!decoded) throw new Error("invalid");
        return decoded;
      },
    },
  };
  require.cache[firestoreUserPath] = {
    id: firestoreUserPath,
    filename: firestoreUserPath,
    loaded: true,
    exports: {
      async fetchUserProfileByUid() {
        return profile;
      },
    },
  };
  return require("../api/teacher-workhours");
};

test("GET teacher-workhours usa fallback admin quando não há idToken", async () => {
  const handler = loadHandler({
    idToken: "",
    decoded: null,
    profile: null,
    adminDoc: {
      horarios: {
        seg: { ativo: true, faixas: [{ inicio: "09:00", fim: "11:00" }] },
      },
    },
  });
  const res = {};
  await handler({ method: "GET", url: "/api/teacher-workhours", headers: {} }, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body?.workHours?.["1"], [{ startMin: 540, endMin: 660 }]);
});

test("POST teacher-workhours continua exigindo idToken válido", async () => {
  const handler = loadHandler({
    idToken: "",
    decoded: null,
    profile: null,
    adminDoc: null,
  });
  const res = {};
  await handler({ method: "POST", url: "/api/teacher-workhours", headers: {} }, res);
  assert.equal(res.statusCode, 401);
  assert.equal(res.body?.error, "missing_id_token");
});
