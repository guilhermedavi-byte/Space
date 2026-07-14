const { readJsonBody, sendJson } = require("./http");
const { getSessionFromRequest } = require("./session");
const { fetchLessonById, canEditLesson, createLessonRegister, normalizeRole } = require("./live-lessons");
const { triggerLessonWorkflow } = require("./pedagogico-n8n");

const CONFIG = {
  registro_aula: {
    status: "realizada",
    workflow: "pedagogico_registro_aula",
    envName: ["N8N_PEDAGOGICO_REGISTRO_AULA_WEBHOOK_URL", "N8N_PEDAGOGICO_REGISTRO_AULA_URL"],
    required: ["aula_id", "conteudo_aula"],
    missingWebhookMessage: "Webhook de registro de aula não configurado",
  },
  registro_falta: {
    status: "falta",
    workflow: "pedagogico_registro_falta",
    envName: ["N8N_PEDAGOGICO_REGISTRO_FALTA_WEBHOOK_URL", "N8N_PEDAGOGICO_REGISTRO_FALTA_URL"],
    required: ["aula_id", "motivo_falta"],
    missingWebhookMessage: "Webhook de registro de falta não configurado",
  },
  remarcacao_aula: {
    status: "remarcada",
    workflow: "pedagogico_remarcacao",
    envName: ["N8N_PEDAGOGICO_REMARCACAO_AULA_WEBHOOK_URL", "N8N_PEDAGOGICO_REMARCACAO_URL"],
    required: ["aula_id", "motivo_remarcacao"],
    missingWebhookMessage: "Webhook de remarcação de aula não configurado",
  },
};

const missingFields = (body, fields) => fields.filter((field) => body?.[field] == null || String(body[field]).trim() === "");

const normalizeRemarcacaoSituacao = (value, body = {}) => {
  const raw = String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (["agendada_agora", "agendada", "novo_horario", "ja_tenho_novo_horario"].includes(raw)) return "agendada_agora";
  if (["aguardando_aluno", "aguardando", "aguardando_retorno"].includes(raw)) return "aguardando_aluno";
  if (["incompatibilidade_horario", "incompatibilidade", "sem_horario_compativel"].includes(raw)) return "incompatibilidade_horario";
  return body?.nova_data_aula || body?.nova_data ? "agendada_agora" : "";
};

const normalizePayload = (kind, body, lesson) => {
  const common = {
    aula_id: String(body.aula_id || ""),
    onboarding_id: body.onboarding_id || lesson.onboarding_id || "",
  };
  if (kind === "registro_aula") {
    return {
      ...common,
      conteudo_aula: String(body.conteudo_aula || ""),
      conteudo_trabalhado: String(body.conteudo_aula || ""),
      observacoes: String(body.observacoes || ""),
      desempenho_aluno: String(body.desempenho_aluno || ""),
      humor_aluno: String(body.humor_aluno || ""),
      estrelas: Number(body.estrelas) || null,
      homework: String(body.homework || ""),
      proxima_aula_recomendada: String(body.proxima_aula_recomendada || ""),
      proxima_recomendacao: String(body.proxima_aula_recomendada || ""),
    };
  }
  if (kind === "registro_falta") {
    return {
      ...common,
      motivo_falta: String(body.motivo_falta || ""),
      responsavel_falta: String(body.responsavel_falta || ""),
      observacoes: String(body.observacoes || ""),
      reposicao_necessaria: Boolean(body.reposicao_necessaria),
    };
  }
  const situacaoReposicao = normalizeRemarcacaoSituacao(body.situacao_reposicao, body);
  return {
    ...common,
    nova_data_aula: String(body.nova_data_aula || ""),
    nova_data: String(body.nova_data_aula || ""),
    motivo_remarcacao: String(body.motivo_remarcacao || ""),
    tipo_movimento: String(body.tipo_movimento || body.tipo_remarcacao || "remarcacao"),
    tipo_remarcacao: String(body.tipo_movimento || body.tipo_remarcacao || "remarcacao"),
    responsavel_remarcacao: String(body.responsavel_remarcacao || ""),
    data_aviso_remarcacao: String(body.data_aviso_remarcacao || ""),
    elegibilidade: body.elegibilidade && typeof body.elegibilidade === "object" ? body.elegibilidade : {},
    situacao_reposicao: situacaoReposicao,
    needs_admin_review: body.needs_admin_review === true,
    observacoes: String(body.observacoes || ""),
  };
};

const validateRemarcacaoPayload = (body) => {
  const missing = [];
  const situacaoReposicao = normalizeRemarcacaoSituacao(body?.situacao_reposicao, body);
  if (!situacaoReposicao) missing.push("situacao_reposicao");
  if (!body?.responsavel_remarcacao && !body?.tipo_movimento) missing.push("responsavel_remarcacao");
  if (situacaoReposicao === "agendada_agora" && !body?.nova_data_aula && !body?.nova_data) missing.push("nova_data_aula");
  return missing;
};

const handlePedagogicoLessonAction = (kind) => async (req, res) => {
  const cfg = CONFIG[kind];
  if (!cfg) return sendJson(res, 500, { error: "invalid_action_config" });
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { error: "method_not_allowed" });
  }

  const session = getSessionFromRequest(req);
  if (!session) return sendJson(res, 401, { error: "unauthorized" });
  const role = normalizeRole(session.role);
  if (!["teacher", "admin"].includes(role)) return sendJson(res, 403, { error: "teacher_or_admin_only" });

  const body = await readJsonBody(req).catch(() => null);
  if (!body || typeof body !== "object") return sendJson(res, 400, { error: "invalid_json" });
  console.log("[DEBUG-SAVE] api:pedagogico-action:start", {
    kind,
    role,
    aulaId: body?.aula_id || "",
    status: cfg.status,
    responsavelRemarcacao: body?.responsavel_remarcacao || "",
    situacaoReposicao: body?.situacao_reposicao || "",
    needsAdminReview: body?.needs_admin_review,
  });
  const missing = missingFields(body, cfg.required);
  if (missing.length) return sendJson(res, 400, { error: "missing_required_fields", fields: missing });
  if (kind === "remarcacao_aula") {
    const remarcacaoMissing = validateRemarcacaoPayload(body);
    console.log("[DEBUG-SAVE] api:pedagogico-action:remarcacaoValidation", {
      kind,
      aulaId: body?.aula_id || "",
      missing: remarcacaoMissing,
    });
    if (remarcacaoMissing.length) return sendJson(res, 400, { error: "missing_required_fields", fields: remarcacaoMissing });
  }

  try {
    console.log("[DEBUG-SAVE] api:pedagogico-action:beforeFetchLesson", { kind, aulaId: body.aula_id || "" });
    const lesson = await fetchLessonById(body.aula_id);
    console.log("[DEBUG-SAVE] api:pedagogico-action:afterFetchLesson", { kind, aulaId: body.aula_id || "", found: Boolean(lesson) });
    if (!lesson) return sendJson(res, 404, { error: "lesson_not_found" });
    if (!canEditLesson(session, lesson)) return sendJson(res, 403, { error: "forbidden" });

    const payload = normalizePayload(kind, body, lesson);
    console.log("[DEBUG-SAVE] api:pedagogico-action:beforeCreateRegister", {
      kind,
      aulaId: body.aula_id || "",
      payloadSummary: {
        situacao_reposicao: payload.situacao_reposicao,
        responsavel_remarcacao: payload.responsavel_remarcacao,
        needs_admin_review: payload.needs_admin_review,
      },
    });
    const saved = await createLessonRegister({ lesson, session, payload: { ...payload, status: cfg.status } });
    console.log("[DEBUG-SAVE] api:pedagogico-action:afterCreateRegister", {
      kind,
      aulaId: body.aula_id || "",
      registerId: saved?.register?.id || "",
    });
    console.log("[DEBUG-SAVE] api:pedagogico-action:beforeN8n", { kind, aulaId: body.aula_id || "", workflow: cfg.workflow });
    const n8n = await triggerLessonWorkflow({
      workflow: cfg.workflow,
      envName: cfg.envName,
      lesson,
      onboardingId: payload.onboarding_id,
      payload,
      eventKey: `pedagogico:${cfg.workflow}:${lesson.id}:${saved?.register?.id || Date.now()}`,
    }).catch((error) => ({ ok: false, error: error?.message || "n8n_failed" }));
    console.log("[DEBUG-SAVE] api:pedagogico-action:afterN8n", {
      kind,
      aulaId: body.aula_id || "",
      n8n: { ok: n8n?.ok, configured: n8n?.configured, error: n8n?.error },
    });

    return sendJson(res, 200, {
      ok: true,
      saved: true,
      register: saved.register,
      lesson: saved.lesson,
      n8n,
      warning: n8n?.configured === false ? cfg.missingWebhookMessage : undefined,
    });
  } catch (error) {
    console.error(`[pedagogico] ${kind} failed`, error);
    return sendJson(res, 500, { error: `${kind}_failed`, message: "Não foi possível salvar a ação pedagógica agora." });
  }
};

module.exports = { handlePedagogicoLessonAction };
