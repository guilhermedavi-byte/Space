const { sendJson } = require("../_lib/http");
const { getSessionFromRequest } = require("../_lib/session");

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return sendJson(res, 405, { error: "method_not_allowed" });
  }

  const session = getSessionFromRequest(req);
  if (!session) {
    return sendJson(res, 401, { error: "unauthenticated" });
  }

  let lifecycle = null;
  if (session.role === 'student' && require('./_lib/retention-flags').isRetentionV2Enabled()) {
    try {
      const service = require('./_lib/student-lifecycle');
      lifecycle = await service.getForStudent(session.sub);
      if (!service.isActiveOn(lifecycle,new Date())) return sendJson(res,403,{error:'student_service_ended'});
    } catch (error) { return sendJson(res,error.status || 503,{error:error.code || 'lifecycle_unavailable'}); }
  }
  return sendJson(res, 200, { lifecycle: lifecycle ? {subscriptions:lifecycle.subscriptions} : null,
    user: {
      id: String(session.sub || ""),
      role: String(session.role || ""),
      name: String(session.name || ""),
      email: String(session.email || ""),
    },
  });
};
