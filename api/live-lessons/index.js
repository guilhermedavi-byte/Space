const { sendJson } = require("../_lib/http");
const { getSessionFromRequest } = require("../_lib/session");
const { listLiveLessons, summarizeLiveLessons, normalizeRole, isAdminRole } = require("../_lib/live-lessons");

module.exports = async (req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    sendJson(res, 405, { error: "method_not_allowed" });
    return;
  }

  const session = getSessionFromRequest(req);
  if (!session) {
    sendJson(res, 401, { error: "unauthorized" });
    return;
  }

  const role = normalizeRole(session.role);
  if (!["admin", "teacher", "student"].includes(role)) {
    sendJson(res, 403, { error: "forbidden" });
    return;
  }

  const host = String(req.headers.host || "localhost");
  const url = new URL(req.url || "/api/live-lessons", `https://${host}`);
  const limit = Number(url.searchParams.get("limit") || (isAdminRole(role) ? 200 : 20));
  const scope = String(url.searchParams.get("scope") || "upcoming");

  try {
    const lessons = await listLiveLessons({ session, limit, scope });
    sendJson(res, 200, {
      lessons,
      summary: summarizeLiveLessons(lessons),
    });
  } catch (error) {
    console.error("[api] live lessons list failed", error);
    sendJson(res, 500, { error: "live_lessons_failed", message: "Nao foi possivel carregar as aulas ao vivo." });
  }
};
