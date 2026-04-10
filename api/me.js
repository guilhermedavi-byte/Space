const { sendJson } = require("./_lib/http");
const { getSessionFromRequest } = require("./_lib/session");

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return sendJson(res, 405, { error: "method_not_allowed" });
  }

  const session = getSessionFromRequest(req);
  if (!session) {
    return sendJson(res, 401, { error: "unauthenticated" });
  }

  return sendJson(res, 200, {
    user: {
      id: String(session.sub || ""),
      role: String(session.role || ""),
      name: String(session.name || ""),
      email: String(session.email || ""),
    },
  });
};

