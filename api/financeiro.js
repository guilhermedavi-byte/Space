const { getSessionFromRequest } = require("../_lib/session");
const { canAccessFinance } = require("./_lib/finance-integrations");

const sendRedirect = (res, location) => {
  res.statusCode = 302;
  res.setHeader("Location", location);
  res.setHeader("Cache-Control", "no-store");
  res.end("");
};

module.exports = async (req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    res.statusCode = 405;
    res.end("Method Not Allowed");
    return;
  }

  const session = getSessionFromRequest(req);
  if (!session) {
    sendRedirect(res, "/");
    return;
  }

  if (!canAccessFinance(session)) {
    sendRedirect(res, "/app");
    return;
  }

  const role = String(session.role || "").trim();
  sendRedirect(res, role === "admin" ? "/app/admin/financeiro" : "/app/financeiro");
};
