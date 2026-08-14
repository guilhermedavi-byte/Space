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
    required: ["aula_id"],
    missingWebhookMessage: "Webhook de remarcação de aula não configurado",
  },
};

const missingFields = (body, fields) => fields.filter((field) => body?.[field] == null || String(body[field]).trim() === "");

const normalizeLessonKind = (value) => {
  const raw = String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (raw === "aula_experimental") return "experimental";
  if (raw === "onboarding_de_aluno") return "onboarding";
  return ["experimental", "onboarding", "coordenacao", "outro"].includes(raw) ? raw : "";
};

const isSpecialLessonRegister = (lesson) => {
  const kind = normalizeLessonKind(lesson?.tipo_evento || lesson?.tipoEvento || "");
  return kind === "experimental" || kind === "onboarding";
};

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
    const isSpecial = isSpecialLessonRegister(lesson);
    const content = String(body.conteudo_aula || "").trim() || (isSpecial ? "Evento especial realizado" : "");
    return {
      ...common,
      conteudo_aula: content,
      conteudo_trabalhado: content,
      observacoes: String(body.observacoes || ""),
      engajamento: String(body.engajamento || ""),
      desempenho_aluno: String(body.desempenho_aluno || ""),
      confianca: String(body.confianca || ""),
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

const isValidIsoDateTime = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return false;
  const ms = Date.parse(raw);
  return Number.isFinite(ms);
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

  try {
    const lesson = await fetchLessonById(body.aula_id);
    if (!lesson) return sendJson(res, 404, { error: "lesson_not_found" });
    if (!canEditLesson(session, lesson)) return sendJson(res, 403, { error: "forbidden" });
    const requiredFields =
      kind === "registro_aula" && isSpecialLessonRegister(lesson)
        ? ["aula_id"]
        : cfg.required;
    const missing = missingFields(body, requiredFields);
    if (missing.length) return sendJson(res, 400, { error: "missing_required_fields", fields: missing });
    if (kind === "remarcacao_aula") {
      const remarcacaoMissing = validateRemarcacaoPayload(body);
      if (remarcacaoMissing.length) return sendJson(res, 400, { error: "missing_required_fields", fields: remarcacaoMissing });
      if (normalizeRemarcacaoSituacao(body?.situacao_reposicao, body) === "agendada_agora") {
        const nextDateIso = String(body?.nova_data_aula || body?.nova_data || "").trim();
        if (!isValidIsoDateTime(nextDateIso)) {
          return sendJson(res, 400, { error: "invalid_date", fields: ["nova_data_aula"] });
        }
      }
    }

    const payload = normalizePayload(kind, body, lesson);
    const saved = await createLessonRegister({ lesson, session, payload: { ...payload, status: cfg.status } });
    const n8n = await triggerLessonWorkflow({
      workflow: cfg.workflow,
      envName: cfg.envName,
      lesson,
      onboardingId: payload.onboarding_id,
      payload,
      eventKey: `pedagogico:${cfg.workflow}:${lesson.id}:${saved?.register?.id || Date.now()}`,
    }).catch((error) => ({ ok: false, error: error?.message || "n8n_failed" }));

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

module.exports = { handlePedagogicoLessonAction, normalizePayload };
