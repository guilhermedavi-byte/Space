const { readJsonBody, sendJson } = require("../../_lib/http");
const { getSessionFromRequest } = require("../../_lib/session");
const { fetchLessonById, canEditLesson, normalizeRole } = require("../../_lib/live-lessons");
const { triggerLessonWorkflow } = require("../../_lib/pedagogico-n8n");

const actionConfig = {
  registro_aula: {
    workflow: "pedagogico_registro_aula",
    envName: "N8N_PEDAGOGICO_REGISTRO_AULA_URL",
  },
  falta: {
    workflow: "pedagogico_registro_falta",
    envName: "N8N_PEDAGOGICO_REGISTRO_FALTA_URL",
  },
  remarcacao: {
    workflow: "pedagogico_remarcacao",
    envName: "N8N_PEDAGOGICO_REMARCACAO_URL",
  },
};

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
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
    sendJson(res, 403, { error: "teacher_or_admin_only" });
    return;
  }

  const body = await readJsonBody(req).catch(() => null);
  const action = String(body?.action || "").trim().toLowerCase();
  const cfg = actionConfig[action];
  const aulaId = String(body?.aula_id || "").trim();
  if (!cfg || !aulaId) {
    sendJson(res, 400, { error: "invalid_payload" });
    return;
  }

  try {
    const lesson = await fetchLessonById(aulaId);
    if (!lesson) {
      sendJson(res, 404, { error: "lesson_not_found" });
      return;
    }
    if (!canEditLesson(session, lesson)) {
      sendJson(res, 403, { error: "forbidden" });
      return;
    }

    const payload = {
      ...body,
      aula_id: aulaId,
      onboarding_id: body.onboarding_id || lesson.onboarding_id || "",
    };
    const result = await triggerLessonWorkflow({
      workflow: cfg.workflow,
      envName: cfg.envName,
      lesson,
      onboardingId: payload.onboarding_id,
      payload,
      eventKey: `pedagogico:${action}:${aulaId}:${JSON.stringify(payload)}`,
    });
    sendJson(res, 200, { ok: true, n8n: result });
  } catch (error) {
    console.error("[pedagogico] lesson action failed", error);
    sendJson(res, 500, { error: "lesson_action_failed" });
  }
};
