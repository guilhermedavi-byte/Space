const { supabaseFetch } = require("./supabase-rest");
const { fetchOnboardingRows } = require("./pedagogico-service");
const { assertEnvironmentIsolation } = require("../../_lib/runtime-env");

const INTEGRATION_LOGS_TABLE = "n8n_logs_pedagogico_space";
const ONBOARDING_TABLE = "n8n_onboarding_alunos_space";
const ALERTS_TABLE = "n8n_ocorrencias_pedagogicas_space";
const LESSONS_TABLE = "n8n_aulas_pedagogicas_space";

const safeEncode = (value) => encodeURIComponent(String(value || ""));

const nowIso = () => new Date().toISOString();

const normalizeStatus = (value) => String(value || "").trim().toLowerCase();

const getEnvUrl = (name) => {
  assertEnvironmentIsolation();
  const names = Array.isArray(name) ? name : [name];
  for (const item of names) {
    const value = String(process.env[item] || "").trim();
    if (value) return value;
  }
  return "";
};

const buildSecretHeaders = () => {
  const secret = String(process.env.N8N_WEBHOOK_SECRET || "").trim();
  return secret ? { "x-space-webhook-secret": secret } : {};
};

const N8N_WORKFLOW_TIMEOUT_MS = 12_000;

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

  const log =
    existing ||
    (await createIntegrationLog({ workflow, origem, alunoId, onboardingId, idempotencyKey: key, payload }).catch(() => ({
      workflow,
      origem,
      aluno_id: alunoId || null,
      onboarding_id: onboardingId || null,
      idempotency_key: key,
      payload_enviado: payload || {},
      status: "pendente",
    })));
  const url = getEnvUrl(envName);
  if (!url) {
    const updated = await patchIntegrationLog(log.id, {
      status: "erro",
      erro: `missing_env:${envName}`,
      resposta_recebida: { error: "webhook_not_configured", envName },
    }).catch(() => log);
    return {
      ok: false,
      configured: false,
      log: updated,
      error: "webhook_not_configured",
      message: "Webhook não configurado",
    };
  }

  await patchIntegrationLog(log.id, { status: "enviado" }).catch(() => null);

  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timeoutId = controller
    ? setTimeout(() => controller.abort(), N8N_WORKFLOW_TIMEOUT_MS)
    : null;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...buildSecretHeaders(),
      },
      body: JSON.stringify(payload || {}),
      signal: controller?.signal,
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
    const message = error?.name === "AbortError" ? "n8n_workflow_timeout" : error?.message || "request_failed";
    const updated = await patchIntegrationLog(log.id, {
      status: "erro",
      erro: message,
      resposta_recebida: { error: message },
    }).catch(() => log);
    return { ok: false, error: message, log: updated };
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
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
    // ESPELHO DESNORMALIZADO — fonte: Firestore users/{id}
    firestore_doc_id: payload?.firestore_doc_id || payload?.firestoreDocId || payload?.student_id || payload?.aluno_id || null,
    aluno_id: studentId || null,
    contract_id: contractId || studentId,
    aluno_nome: payload?.aluno_nome || payload?.nome || payload?.nomeCompleto || null,
    telefone: payload?.telefone || payload?.whatsapp || null,
    email: payload?.email || null,
    plano: payload?.plano || payload?.contrato || null,
    valor: payload?.valor == null ? null : Number(payload.valor) || null,
    closer: payload?.closer || payload?.vendedor || null,
    status_contrato: "assinado",
    status_financeiro: payload?.status_financeiro || payload?.pagamento_status || null,
    pagamento_status: payload?.pagamento_status || payload?.status_financeiro || null,
    status_onboarding: "disparo_pendente",
    etapa_atual: payload?.etapa_atual || "contrato_assinado",
    objetivo_ingles: payload?.objetivo_ingles || null,
    nivel_declarado: payload?.nivel_declarado || null,
    pais: payload?.pais || null,
    estado: payload?.estado || null,
    disponibilidade_aluno: payload?.disponibilidade_aluno || null,
    asaas_customer_id: payload?.asaas_customer_id || null,
    asaas_subscription_id: payload?.asaas_subscription_id || null,
    id_conversa_chatwoot: payload?.id_conversa_chatwoot || null,
    origem_onboarding: payload?.origem_onboarding || source,
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
    status_financeiro: onboarding?.status_financeiro || input?.status_financeiro || "",
    closer: onboarding?.closer || input?.closer || input?.vendedor || "",
    objetivo_ingles: onboarding?.objetivo_ingles || input?.objetivo_ingles || "",
    nivel_declarado: onboarding?.nivel_declarado || input?.nivel_declarado || "",
    pais: onboarding?.pais || input?.pais || "",
    estado: onboarding?.estado || input?.estado || "",
    disponibilidade_aluno: onboarding?.disponibilidade_aluno || input?.disponibilidade_aluno || "",
    asaas_customer_id: onboarding?.asaas_customer_id || input?.asaas_customer_id || "",
    asaas_subscription_id: onboarding?.asaas_subscription_id || input?.asaas_subscription_id || "",
    id_conversa_chatwoot: onboarding?.id_conversa_chatwoot || input?.id_conversa_chatwoot || "",
    origem_onboarding: onboarding?.origem_onboarding || input?.origem_onboarding || source,
    metadata: input?.metadata || input || {},
  };
  const key = `pedagogico:onboarding:contract_signed:${payload.contract_id || payload.student_id}`;
  const result = await callN8nWorkflow({
    workflow: "pedagogico_onboarding",
    envName: ["N8N_PEDAGOGICO_ONBOARDING_WEBHOOK_URL", "N8N_PEDAGOGICO_ONBOARDING_URL"],
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
  return fetchOnboardingRows(`select=*&order=updated_at.desc.nullslast&limit=${max}`);
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
    professor_email: payload.professor_email || null,
    professor_telefone: payload.professor_telefone || null,
    primeira_aula_em: payload.data_primeira_aula || payload.data_aula || null,
    horario_fixo_texto: payload.horario_fixo_texto || null,
    coordenacao_nome: payload.coordenacao_nome || null,
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
  const workflowPayload = {
    onboarding_id: id,
    aluno_nome: onboarding?.aluno_nome || payload.aluno_nome || "",
    telefone: onboarding?.telefone || payload.telefone || "",
    email: onboarding?.email || payload.email || "",
    professor_id: payload.professor_id || "",
    professor_nome: payload.professor_nome || "",
    professor_email: payload.professor_email || "",
    professor_telefone: payload.professor_telefone || "",
    data_primeira_aula: payload.data_primeira_aula || payload.data_aula || "",
    horario_fixo_texto: payload.horario_fixo_texto || "",
    closer: onboarding?.closer || payload.closer || payload.vendedor || "",
    coordenacao_nome: payload.coordenacao_nome || "",
    observacoes: payload.observacoes || "",
  };
  const result = await callN8nWorkflow({
    workflow: "pedagogico_professor_primeira_aula",
    envName: ["N8N_PEDAGOGICO_PROFESSOR_PRIMEIRA_AULA_WEBHOOK_URL", "N8N_PEDAGOGICO_PROFESSOR_PRIMEIRA_AULA_URL"],
    origem: "platform",
    alunoId: onboarding?.aluno_id || "",
    onboardingId: id,
    idempotencyKey: `pedagogico:first_lesson:${id}:${payload.data_primeira_aula || payload.data_aula || ""}:${payload.professor_id || payload.professor_nome || ""}`,
    payload: workflowPayload,
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
