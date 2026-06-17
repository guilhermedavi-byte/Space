const { readJsonBody, sendJson } = require("../../_lib/http");
const { getSessionFromRequest } = require("../../_lib/session");
const { fetchLessonById, canEditLesson, createLessonRegister, normalizeRole } = require("../../_lib/live-lessons");
const { triggerLessonWorkflow } = require("../../_lib/pedagogico-n8n");

const labelForStatus = (status) => {
  const s = String(status || "").toLowerCase();
  if (s === "falta") return "Falta";
  if (s === "remarcada") return "Remarcada";
  if (s === "cancelada") return "Cancelada";
  return "Realizada";
};

const getRouteId = (req) => {
  const fromQuery = String(req.query?.id || "").trim();
  if (fromQuery) return fromQuery;
  const match = String(req.url || "").match(/\/live-lessons\/([^/?#]+)\/register/);
  return match ? decodeURIComponent(match[1]) : "";
};

const n8nConfigForStatus = (status) => {
  const s = String(status || "").toLowerCase();
  if (s === "falta") {
    return {
      workflow: "pedagogico_registro_falta",
      envName: ["N8N_PEDAGOGICO_REGISTRO_FALTA_WEBHOOK_URL", "N8N_PEDAGOGICO_REGISTRO_FALTA_URL"],
    };
  }
  if (s === "remarcada") {
    return {
      workflow: "pedagogico_remarcacao",
      envName: ["N8N_PEDAGOGICO_REMARCACAO_AULA_WEBHOOK_URL", "N8N_PEDAGOGICO_REMARCACAO_URL"],
    };
  }
  if (s === "cancelada") return null;
  return {
    workflow: "pedagogico_registro_aula",
    envName: ["N8N_PEDAGOGICO_REGISTRO_AULA_WEBHOOK_URL", "N8N_PEDAGOGICO_REGISTRO_AULA_URL"],
  };
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

  const id = getRouteId(req);
  const payload = await readJsonBody(req).catch(() => null);
  const status = String(payload?.status || "realizada").trim().toLowerCase();
  if (!id || !["realizada", "falta", "remarcada", "cancelada"].includes(status)) {
    sendJson(res, 400, { error: "invalid_payload" });
    return;
  }

  try {
    const lesson = await fetchLessonById(id);
    if (!lesson) {
      sendJson(res, 404, { error: "not_found" });
      return;
    }
    if (!canEditLesson(session, lesson)) {
      sendJson(res, 403, { error: "forbidden" });
      return;
    }
    const result = await createLessonRegister({ lesson, session, payload: { ...payload, status } });
    const cfg = n8nConfigForStatus(status);
    const n8nPayload = {
      aula_id: lesson.id,
      onboarding_id: payload?.onboarding_id || lesson.onboarding_id || "",
      conteudo_trabalhado: payload?.conteudo_trabalhado || "",
      desempenho_aluno: payload?.desempenho_aluno || payload?.desempenho || "",
      humor_aluno: payload?.humor_aluno || payload?.humor || "",
      estrelas: Number(payload?.estrelas || payload?.nota || 0) || null,
      observacoes: payload?.observacoes || "",
      homework: payload?.homework || payload?.tarefa || "",
      proxima_recomendacao: payload?.proxima_recomendacao || payload?.proximo_foco || "",
      motivo_falta: payload?.motivo_falta || "",
      responsavel_falta: payload?.responsavel_falta || "",
      reposicao_necessaria: Boolean(payload?.reposicao_necessaria),
      nova_data_aula: payload?.nova_data_aula || payload?.nova_data || "",
      tipo: status === "remarcada" ? payload?.tipo || "remarcacao" : undefined,
      motivo_remarcacao: payload?.motivo_remarcacao || payload?.motivo_falta || "",
    };
    const n8n = cfg
      ? await triggerLessonWorkflow({
          ...cfg,
          lesson,
          onboardingId: n8nPayload.onboarding_id,
          payload: n8nPayload,
          eventKey: `pedagogico:${cfg.workflow}:${lesson.id}:${result?.register?.id || status}`,
        }).catch((error) => ({ ok: false, error: error?.message || "n8n_failed" }))
      : { skipped: true, reason: "no_workflow_for_cancelled_lesson" };
    sendJson(res, 200, { ...result, n8n, label: labelForStatus(status) });
  } catch (error) {
    console.error("[api] live lesson register failed", error);
    sendJson(res, 500, { error: "register_failed" });
  }
};
