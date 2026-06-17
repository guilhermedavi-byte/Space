const { readJsonBody, sendJson } = require("../../_lib/http");
const { getSessionFromRequest } = require("../../_lib/session");
const { normalizeRole } = require("../../_lib/live-lessons");
const { updateOnboardingFirstLesson } = require("../../_lib/pedagogico-n8n");

module.exports = async (req, res) => {
  if (req.method !== "POST" && req.method !== "PATCH") {
    res.setHeader("Allow", "POST, PATCH");
    sendJson(res, 405, { error: "method_not_allowed" });
    return;
  }

  const session = getSessionFromRequest(req);
  if (!session) {
    sendJson(res, 401, { error: "unauthorized" });
    return;
  }
  if (normalizeRole(session.role) !== "admin") {
    sendJson(res, 403, { error: "admin_only" });
    return;
  }

  const body = await readJsonBody(req).catch(() => null);
  if (!body || typeof body !== "object") {
    sendJson(res, 400, { error: "invalid_json" });
    return;
  }
  if (!body.onboarding_id || !body.professor_nome || !(body.data_primeira_aula || body.data_aula)) {
    sendJson(res, 400, { error: "missing_required_fields" });
    return;
  }

  try {
    const result = await updateOnboardingFirstLesson({ onboardingId: body.onboarding_id, payload: body });
    sendJson(res, 200, {
      ok: true,
      ...result,
      warning: result?.n8n?.configured === false ? "Webhook de professor + primeira aula não configurado" : undefined,
    });
  } catch (error) {
    console.error("[pedagogico] first lesson failed", error);
    sendJson(res, 500, { error: error?.code || "first_lesson_failed" });
  }
};
