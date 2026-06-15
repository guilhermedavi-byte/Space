const { readJsonBody, sendJson } = require("../../_lib/http");
const { getSessionFromRequest } = require("../../_lib/session");
const { normalizeRole } = require("../../_lib/live-lessons");
const { callN8nWorkflow } = require("../../_lib/pedagogico-n8n");

const actionConfig = {
  criar_aluno: {
    workflow: "flexge_criar_aluno",
    envName: "N8N_FLEXGE_CRIAR_ALUNO_URL",
  },
  vincular_curso: {
    workflow: "flexge_vincular_curso",
    envName: "N8N_FLEXGE_VINCULAR_CURSO_URL",
  },
  sync_progress: {
    workflow: "flexge_sync_progress",
    envName: "N8N_FLEXGE_SYNC_PROGRESS_URL",
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
  if (normalizeRole(session.role) !== "admin") {
    sendJson(res, 403, { error: "admin_only" });
    return;
  }

  const body = await readJsonBody(req).catch(() => null);
  const action = String(body?.action || "").trim().toLowerCase();
  const cfg = actionConfig[action];
  if (!cfg) {
    sendJson(res, 400, { error: "invalid_action" });
    return;
  }

  const alunoId = String(body?.aluno_id || body?.student_id || body?.email || "").trim();
  try {
    const result = await callN8nWorkflow({
      workflow: cfg.workflow,
      envName: cfg.envName,
      origem: "platform",
      alunoId,
      onboardingId: body?.onboarding_id || "",
      idempotencyKey: `pedagogico:${cfg.workflow}:${alunoId || "sem_aluno"}:${JSON.stringify(body)}`,
      payload: body,
    });
    sendJson(res, 200, { ok: true, n8n: result });
  } catch (error) {
    console.error("[pedagogico] flexge action failed", error);
    sendJson(res, 500, { error: "flexge_action_failed" });
  }
};
