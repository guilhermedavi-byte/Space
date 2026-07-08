const { getBearerTokenFromRequest } = require("./firestore-rest");
const { verifyFirebaseIdToken } = require("./firebase-id-token");
const { fetchUserProfileByUid } = require("./firestore-user");

const normalizeRole = (value) => {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "admin" || raw === "administrador") return "admin";
  if (raw === "teacher" || raw === "professor") return "teacher";
  if (raw === "student" || raw === "aluno") return "student";
  if (raw === "growth") return "growth";
  if (raw === "finance" || raw === "financeiro") return "financeiro";
  return "";
};

const resolveAdminRequestAuth = async (req, { logPrefix = "[api]" } = {}) => {
  const idToken = getBearerTokenFromRequest(req);
  if (!idToken) {
    return {
      ok: false,
      status: 401,
      body: { error: "unauthenticated", reason: "missing_token" },
    };
  }

  let decoded;
  try {
    decoded = await verifyFirebaseIdToken(idToken);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`${logPrefix} verifyIdToken failed`, error);
    return {
      ok: false,
      status: 401,
      body: { error: "unauthenticated", reason: "invalid_token" },
    };
  }

  const profile = await fetchUserProfileByUid({ uid: decoded.uid, idToken });
  const role = normalizeRole(profile?.user?.role);
  if (!role) {
    return {
      ok: false,
      status: 401,
      body: { error: "unauthenticated", reason: "invalid_token" },
    };
  }

  return {
    ok: true,
    idToken,
    decoded,
    session: {
      sub: decoded.uid,
      role,
      name: profile?.user?.name || "",
      email: profile?.user?.email || decoded.email || "",
    },
    profile,
  };
};

module.exports = {
  resolveAdminRequestAuth,
};
