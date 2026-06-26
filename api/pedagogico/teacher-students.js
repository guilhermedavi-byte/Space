const { sendJson } = require("../_lib/http");
const { getSessionFromRequest } = require("../_lib/session");
const { normalizeRole } = require("../_lib/live-lessons");
const { loadTeacherStudents } = require("../_lib/pedagogico-service");

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
  if (role !== "teacher" && role !== "admin") {
    sendJson(res, 403, { error: "teacher_only" });
    return;
  }

  try {
    const payload = await loadTeacherStudents({ session });
    sendJson(res, 200, { ok: true, ...payload });
  } catch (error) {
    console.error("[pedagogico] teacher students failed", error);
    sendJson(res, 200, {
      ok: true,
      degraded: true,
      warning: "Alunos do professor temporariamente indisponíveis.",
      students: [],
      summaries: [],
      events: [],
      logs: [],
    });
  }
};

