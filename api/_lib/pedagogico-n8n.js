const { supabaseFetch } = require("./supabase-rest");

const INTEGRATION_LOGS_TABLE = "n8n_logs_integracao_pedagogico_space";
const ONBOARDING_TABLE = "n8n_onboarding_pedagogico_space";
const ALERTS_TABLE = "n8n_ocorrencias_pedagogicas_space";
const LESSONS_TABLE = "n8n_aulas_pedagogicas_space";

const safeEncode = (value) => encodeURIComponent(String(value || ""));

const nowIso = () => new Date().toISOString();

const normalizeStatus = (value) => String(value || "").trim().toLowerCase();

const getEnvUrl = (name) => String(process.env[name] || "").trim();

const buildSecretHeaders = () => {
  const secret = String(process.env.N8N_WEBHOOK_SECRET || "").trim();
  return secret ? { "x-space-webhook-secret": secret } : {};
};

const normalizeResponseBody = async (res) => {
  const text = await res.text().catch(() => "");
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text.slice(0, 5000) };
  }
};

const getIntegrationLogByKey = async (idempotencyKey) => {
  const key = String(idempotencyKey || "").trim();
  if (!key) return null;
  const { data } = await supabaseFetch(
    `/${INTEGRATION_LOGS_TABLE}?select=*&idempotency_key=eq.${safeEncode(key)}&limit=1`
  );
  return Array.isArray(data) ? data[0] || null : null;
};

const createIntegrationLog = async ({ workflow, origem, alunoId, onboardingId, idempotencyKey, payload }) => {
  const createdAt = nowIso();
  const row = {
    workflow: String(workflow || ""),
    origem: String(origem || "platform"),
    aluno_id: alunoId || null,
    onboarding_id: onboardingId || null,
    idempotency_key: String(idempotencyKey || ""),
    payload_enviado: payload || {},
    status: "pendente",
    created_at: createdAt,
    updated_at: createdAt,
  };
  const { data } = await supabaseFetch(`/${INTEGRATION_LOGS_TABLE}?on_conflict=idempotency_key`, {
    method: "POST",
    headers: { Prefer: "resolution=ignore-duplicates,return=representation" },
    body: row,
  });
  const saved = Array.isArray(data) ? data[0] : data;
  return saved || (await getIntegrationLogByKey(idempotencyKey)) || row;
};

const patchIntegrationLog = async (id, patch) => {
  const safeId = String(id || "").trim();
  if (!safeId) return null;
  const { data } = await supabaseFetch(`/${INTEGRATION_LOGS_TABLE}?id=eq.${safeEncode(safeId)}`, {
    method: "PATCH",
    body: { ...patch, updated_at: nowIso() },
  });
  return Array.isArray(data) ? data[0] || null : data;
};

const callN8nWorkflow = async ({ workflow, envName, origem = "platform", alunoId = "", onboardingId = "", idempotencyKey, payload }) => {
  const key = String(idempotencyKey || `${workflow}:${JSON.stringify(payload || {})}`).trim();
  const existing = await getIntegrationLogByKey(key).catch(() => null);
  if (existing && ["sucesso", "enviado"].includes(normalizeStatus(existing.status))) {
    return { skipped: true, duplicate: true, log: existing };
  }

  const log = existing || (await createIntegrationLog({ workflow, origem, alunoId, onboardingId, idempotencyKey: key, payload }));
  const url = getEnvUrl(envName);
  if (!url) {
    const updated = await patchIntegrationLog(log.id, {
      status: "erro",
      erro: `missing_env:${envName}`,
      resposta_recebida: { error: "webhook_not_configured", envName },
    }).catch(() => log);
    return { ok: false, configured: false, log: updated, error: "webhook_not_configured" };
  }

  await patchIntegrationLog(log.id, { status: "enviado" }).catch(() => null);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...buildSecretHeaders(),
      },
      body: JSON.stringify(payload || {}),
    });
    const responseBody = await normalizeResponseBody(res);
    const status = res.ok ? "sucesso" : "erro";
    const updated = await patchIntegrationLog(log.id, {
      status,
      resposta_recebida: responseBody,
      erro: res.ok ? null : `http_${res.status}`,
    }).catch(() => log);
    return { ok: res.ok, status: res.status, data: responseBody, log: updated };
  } catch (error) {
    const updated = await patchIntegrationLog(log.id, {
      status: "erro",
      erro: error?.message || "request_failed",
      resposta_recebida: { error: error?.message || "request_failed" },
    }).catch(() => log);
    return { ok: false, error: error?.message || "request_failed", log: updated };
  }
};

const upsertOnboardingFromContract = async (payload, { source = "platform" } = {}) => {
  const contractId = String(payload?.contract_id || payload?.contrato_id || payload?.id || "").trim();
  const studentId = String(payload?.student_id || payload?.aluno_id || payload?.email || payload?.telefone || contractId || "").trim();
  if (!contractId && !studentId) {
    const error = new Error("missing_contract_or_student");
    error.code = "missing_contract_or_student";
    throw error;
  }

  const row = {
    aluno_id: studentId || null,
    contract_id: contractId || studentId,
    aluno_nome: payload?.aluno_nome || payload?.nome || payload?.nomeCompleto || null,
    telefone: payload?.telefone || payload?.whatsapp || null,
    email: payload?.email || null,
    plano: payload?.plano || payload?.contrato || null,
    valor: payload?.valor == null ? null : Number(payload.valor) || null,
    status_contrato: "assinado",
    pagamento_status: payload?.pagamento_status || payload?.status_financeiro || null,
    status_onboarding: "disparo_pendente",
    etapa_atual: payload?.etapa_atual || "contrato_assinado",
    origem: source,
    metadata: payload?.metadata || payload || {},
    assinou_em: payload?.assinou_em || payload?.assinadoEm || nowIso(),
    updated_at: nowIso(),
  };

  const { data } = await supabaseFetch(`/${ONBOARDING_TABLE}?on_conflict=contract_id`, {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: row,
  });
  return Array.isArray(data) ? data[0] : data;
};

const markOnboardingDispatch = async ({ onboardingId, result, payload }) => {
  const id = String(onboardingId || "").trim();
  if (!id) return null;
  const patch = {
    status_onboarding: result?.ok || result?.duplicate ? "onboarding_disparado" : "erro_onboarding",
    n8n_status: result?.ok || result?.duplicate ? "sucesso" : "erro",
    n8n_payload: payload || {},
    n8n_resposta: result?.data || result?.log?.resposta_recebida || {},
    n8n_erro: result?.ok || result?.duplicate ? null : result?.error || result?.log?.erro || "n8n_failed",
    onboarding_disparado_em: result?.ok || result?.duplicate ? nowIso() : null,
    updated_at: nowIso(),
  };
  const { data } = await supabaseFetch(`/${ONBOARDING_TABLE}?id=eq.${safeEncode(id)}`, {
    method: "PATCH",
    body: patch,
  });
  return Array.isArray(data) ? data[0] : data;
};

const triggerContractSignedOnboarding = async (input, { source = "platform" } = {}) => {
  const onboarding = await upsertOnboardingFromContract(input, { source });
  const payload = {
    event: "contract_signed",
    source,
    student_id: onboarding?.aluno_id || input?.student_id || "",
    contract_id: onboarding?.contract_id || input?.contract_id || "",
    aluno_nome: onboarding?.aluno_nome || input?.aluno_nome || "",
    telefone: onboarding?.telefone || input?.telefone || "",
    email: onboarding?.email || input?.email || "",
    plano: onboarding?.plano || input?.plano || "",
    valor: onboarding?.valor ?? input?.valor ?? "",
    status_contrato: "assinado",
    assinou_em: onboarding?.assinou_em || input?.assinou_em || nowIso(),
    pagamento_status: onboarding?.pagamento_status || input?.pagamento_status || "",
    metadata: input?.metadata || input || {},
  };
  const key = `pedagogico:onboarding:contract_signed:${payload.contract_id || payload.student_id}`;
  const result = await callN8nWorkflow({
    workflow: "pedagogico_onboarding",
    envName: "N8N_PEDAGOGICO_ONBOARDING_URL",
    origem: source,
    alunoId: payload.student_id,
    onboardingId: onboarding?.id || "",
    idempotencyKey: key,
    payload,
  });
  const updatedOnboarding = await markOnboardingDispatch({ onboardingId: onboarding?.id, result, payload }).catch(() => onboarding);
  return { onboarding: updatedOnboarding || onboarding, n8n: result, payload };
};

const listOnboarding = async ({ limit = 200 } = {}) => {
  const max = Math.max(1, Math.min(Number(limit) || 200, 1000));
  const { data } = await supabaseFetch(`/${ONBOARDING_TABLE}?select=*&order=updated_at.desc.nullslast&limit=${max}`);
  return Array.isArray(data) ? data : [];
};

const updateOnboardingFirstLesson = async ({ onboardingId, payload }) => {
  const id = String(onboardingId || payload?.onboarding_id || "").trim();
  if (!id) {
    const error = new Error("missing_onboarding_id");
    error.code = "missing_onboarding_id";
    throw error;
  }
  const patch = {
    professor_id: payload.professor_id || null,
    professor_nome: payload.professor_nome || null,
    professor_telefone: payload.professor_telefone || null,
    primeira_aula_em: payload.data_aula || null,
    duracao_minutos: Number(payload.duracao_minutos) || 60,
    observacoes_primeira_aula: payload.observacoes || null,
    status_onboarding: "primeira_aula_definida",
    etapa_atual: "primeira_aula",
    updated_at: nowIso(),
  };
  const { data } = await supabaseFetch(`/${ONBOARDING_TABLE}?id=eq.${safeEncode(id)}`, {
    method: "PATCH",
    body: patch,
  });
  const onboarding = Array.isArray(data) ? data[0] : data;
  const result = await callN8nWorkflow({
    workflow: "pedagogico_professor_primeira_aula",
    envName: "N8N_PEDAGOGICO_PROFESSOR_PRIMEIRA_AULA_URL",
    origem: "platform",
    alunoId: onboarding?.aluno_id || "",
    onboardingId: id,
    idempotencyKey: `pedagogico:first_lesson:${id}:${payload.data_aula || ""}:${payload.professor_id || payload.professor_nome || ""}`,
    payload: { onboarding_id: id, ...payload },
  });
  return { onboarding, n8n: result };
};

const triggerLessonWorkflow = async ({ workflow, envName, lesson, onboardingId, payload, eventKey }) => {
  return callN8nWorkflow({
    workflow,
    envName,
    origem: "platform",
    alunoId: lesson?.aluno_id || payload?.aluno_id || "",
    onboardingId: onboardingId || payload?.onboarding_id || "",
    idempotencyKey: eventKey,
    payload,
  });
};

const listAlerts = async ({ limit = 300 } = {}) => {
  const max = Math.max(1, Math.min(Number(limit) || 300, 1000));
  const { data } = await supabaseFetch(`/${ALERTS_TABLE}?select=*&order=created_at.desc.nullslast&limit=${max}`);
  return Array.isArray(data) ? data : [];
};

const resolveAlert = async ({ id, observacao, resolvedBy }) => {
  const safeId = String(id || "").trim();
  if (!safeId) {
    const error = new Error("missing_alert_id");
    error.code = "missing_alert_id";
    throw error;
  }
  const { data } = await supabaseFetch(`/${ALERTS_TABLE}?id=eq.${safeEncode(safeId)}`, {
    method: "PATCH",
    body: {
      status: "resolvida",
      observacao_resolucao: observacao || null,
      resolvida_por: resolvedBy || null,
      resolvida_em: nowIso(),
      updated_at: nowIso(),
    },
  });
  return Array.isArray(data) ? data[0] : data;
};

module.exports = {
  INTEGRATION_LOGS_TABLE,
  ONBOARDING_TABLE,
  ALERTS_TABLE,
  LESSONS_TABLE,
  callN8nWorkflow,
  triggerContractSignedOnboarding,
  listOnboarding,
  updateOnboardingFirstLesson,
  triggerLessonWorkflow,
  listAlerts,
  resolveAlert,
};
