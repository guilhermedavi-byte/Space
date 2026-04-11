const { readJsonBody, sendJson } = require("./_lib/http");
const { loadUsers, findUserByEmailAndRole, normalizeRole } = require("./_lib/users");
const { createSessionForUser, buildSessionCookie, isSecureRequest } = require("./_lib/session");
const { verifyFirebaseIdToken } = require("./_lib/firebase-id-token");
const { fetchUserProfileByUid } = require("./_lib/firestore-user");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { error: "method_not_allowed" });
  }

  let body;
  try {
    body = await readJsonBody(req);
  } catch (error) {
    return sendJson(res, 400, { error: "invalid_request" });
  }

  const role = normalizeRole(body?.role);
  const idToken = String(body?.idToken || "").trim();
  const email = String(body?.email || "").trim().toLowerCase();
  const password = String(body?.password || "");

  if (!role) {
    return sendJson(res, 401, { error: "invalid_credentials" });
  }

  const users = loadUsers();
  let user = null;

  if (idToken) {
    let decoded;
    try {
      decoded = await verifyFirebaseIdToken(idToken);
    } catch (error) {
      return sendJson(res, 401, { error: "invalid_credentials" });
    }

    try {
      user = await fetchUserProfileByUid({ uid: decoded.uid, idToken });
    } catch (error) {
      user = null;
    }

    // Fallback to the local seed list while the Firestore user base is being migrated.
    if (!user) {
      user = findUserByEmailAndRole(users, { email: decoded.email, role });
    }

    if (!user) {
      return sendJson(res, 401, { error: "invalid_credentials" });
    }
  } else {
    // Legacy fallback (non-Firebase): allow the old session flow to keep working during migration.
    if (!email || !password) {
      return sendJson(res, 401, { error: "invalid_credentials" });
    }

    user = findUserByEmailAndRole(users, { email, role });
    if (!user) {
      return sendJson(res, 401, { error: "invalid_credentials" });
    }

    // eslint-disable-next-line global-require
    const { verifyPassword } = require("./_lib/password");
    const ok = verifyPassword(password, user.passwordHash);
    if (!ok) {
      return sendJson(res, 401, { error: "invalid_credentials" });
    }
  }

  const session = createSessionForUser(user);
  const cookie = buildSessionCookie(session.token, { maxAgeSeconds: session.maxAgeSeconds, secure: isSecureRequest(req) });
  res.setHeader("Set-Cookie", cookie);

  return sendJson(res, 200, {
    user: { id: user.id, role: user.role, name: user.name, email: user.email },
  });
};
