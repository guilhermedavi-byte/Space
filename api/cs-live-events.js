const { sendJson } = require("../_lib/http");
const { getSessionFromRequest } = require("../_lib/session");
const { validateCookieViewer } = require("./_lib/cs-live-auth");

const normalizeRole = (value) => {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "admin" || raw === "administrador") return "admin";
  if (raw === "teacher" || raw === "professor") return "teacher";
  if (raw === "pedagogico" || raw === "pedagógico") return "pedagogico";
  return "";
};

module.exports = async (req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    return sendJson(res, 405, { error: "method_not_allowed" });
  }

  const session = getSessionFromRequest(req);
  const role = normalizeRole(session?.role);
  const auth = role === "admin" || role === "teacher" || role === "pedagogico" ? { ok: true } : await validateCookieViewer(req);
  if (!auth?.ok) return sendJson(res, auth?.status || 401, { error: auth?.error || "unauthorized" });

  return sendJson(res, 200, {
    ok: true,
    coldStart: false,
    generatedAt: new Date().toISOString(),
    queueDurationMs: 20_000,
    events: [],
  });
};
