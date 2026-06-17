const { sendJson } = require("../_lib/http");
const { getSessionFromRequest } = require("../_lib/session");
const { normalizeRole } = require("../_lib/live-lessons");
const { loadAdminDashboard } = require("../_lib/pedagogico-service");

module.exports = async (req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    return sendJson(res, 405, { error: "method_not_allowed" });
  }
  const session = getSessionFromRequest(req);
  if (!session) return sendJson(res, 401, { error: "unauthorized" });
  if (normalizeRole(session.role) !== "admin") return sendJson(res, 403, { error: "admin_only" });

  try {
    const dashboard = await loadAdminDashboard();
    return sendJson(res, 200, { ok: true, ...dashboard });
  } catch (error) {
    console.error("[pedagogico] dashboard failed", error);
    return sendJson(res, 200, {
      ok: true,
      degraded: true,
      warning: "Dados pedagógicos temporariamente indisponíveis.",
      metrics: {},
      onboarding: [],
      lessons: [],
      registers: [],
      pendingLessons: [],
      alerts: [],
      satisfaction: [],
      flexge: [],
      teachers: [],
      reports: [],
      riskStudents: [],
    });
  }
};
