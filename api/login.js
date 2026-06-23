const { readJsonBody, sendJson } = require("../_lib/http");
const { loadUsers, findUserByEmailAndRole, normalizeRole } = require("../_lib/users");
const { createSessionForUser, buildSessionCookie, isSecureRequest } = require("../_lib/session");
const { verifyFirebaseIdToken } = require("../_lib/firebase-id-token");
const { fetchUserProfileByUid } = require("../_lib/firestore-user");

const attempts = new Map();
const RATE_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT = 8;

const getRateKey = (req, email) => {
  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return `${forwarded || req.socket?.remoteAddress || "unknown"}:${String(email || "").toLowerCase()}`;
};

const isRateLimited = (key) => {
  const now = Date.now();
  const current = attempts.get(key);
  if (!current || current.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  current.count += 1;
  return current.count > RATE_LIMIT;
};

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
  const rateKey = getRateKey(req, email);

  if (isRateLimited(rateKey)) {
    res.setHeader("Retry-After", "900");
    return sendJson(res, 429, { error: "too_many_attempts" });
  }

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
      const profile = await fetchUserProfileByUid({ uid: decoded.uid, idToken });
      if (profile && profile.user) {
        if (!profile.active) {
          return sendJson(res, 403, { error: "user_disabled" });
        }
        if (normalizeRole(profile.user.role) !== role) {
          return sendJson(res, 401, { error: "invalid_credentials" });
        }
        user = profile.user;
      }
    } catch (error) {
      user = null;
    }

    if (!user && process.env.ALLOW_LEGACY_LOGIN === "true") {
      user = findUserByEmailAndRole(users, { email: decoded.email, role });
    }

    if (!user) {
      return sendJson(res, 401, { error: "invalid_credentials" });
    }
  } else {
    if (process.env.ALLOW_LEGACY_LOGIN !== "true") {
      return sendJson(res, 401, { error: "invalid_credentials" });
    }
    if (!email || !password) {
      return sendJson(res, 401, { error: "invalid_credentials" });
    }

    user = findUserByEmailAndRole(users, { email, role });
    if (!user) {
      return sendJson(res, 401, { error: "invalid_credentials" });
    }

    // eslint-disable-next-line global-require
    const { verifyPassword } = require("../_lib/password");
    const ok = verifyPassword(password, user.passwordHash);
    if (!ok) {
      return sendJson(res, 401, { error: "invalid_credentials" });
    }
  }

  const session = createSessionForUser(user);
  attempts.delete(rateKey);
  const cookie = buildSessionCookie(session.token, { maxAgeSeconds: session.maxAgeSeconds, secure: isSecureRequest(req) });
  res.setHeader("Set-Cookie", cookie);

  return sendJson(res, 200, {
    user: { id: user.id, role: user.role, name: user.name, email: user.email },
  });
};
