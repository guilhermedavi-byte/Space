const { readJsonBody, sendJson } = require("./_lib/http");
const { loadUsers, findUserByEmailAndRole, normalizeRole } = require("./_lib/users");
const { verifyPassword } = require("./_lib/password");
const { createSessionForUser, buildSessionCookie, isSecureRequest } = require("./_lib/session");

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
  const email = String(body?.email || "").trim().toLowerCase();
  const password = String(body?.password || "");

  if (!role || !email || !password) {
    return sendJson(res, 401, { error: "invalid_credentials" });
  }

  const users = loadUsers();
  const user = findUserByEmailAndRole(users, { email, role });
  if (!user) {
    return sendJson(res, 401, { error: "invalid_credentials" });
  }

  const ok = verifyPassword(password, user.passwordHash);
  if (!ok) {
    return sendJson(res, 401, { error: "invalid_credentials" });
  }

  const session = createSessionForUser(user);
  const cookie = buildSessionCookie(session.token, { maxAgeSeconds: session.maxAgeSeconds, secure: isSecureRequest(req) });
  res.setHeader("Set-Cookie", cookie);

  return sendJson(res, 200, {
    user: { id: user.id, role: user.role, name: user.name, email: user.email },
  });
};

