const { readJsonBody, sendJson } = require("./_lib/http");
const { getSessionFromRequest } = require("../_lib/session");
const { supabaseFetch } = require("./_lib/supabase-rest");
const {
  FINANCE_TABLES,
  canAccessFinance,
  normalizeChatwootConversationId,
  buildChatwootConversationUrl,
} = require("./_lib/finance-integrations");

const PAYMENT_METHODS = new Set(["ASAAS", "CPF_GUILHERME", "XP", "PIX_MANUAL", "OUTRO"]);

const nullableString = (value) => {
  const text = String(value || "").trim();
  return text || null;
};

const nullableNumber = (value) => {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const nullableDate = (value) => {
  const text = String(value || "").trim();
  if (!text) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const d = new Date(text);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
};

const cleanObject = (obj) => {
  const out = {};
  Object.entries(obj || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") out[key] = value;
  });
  return out;
};

const sanitizeStatus = (value, fallback = "pendente") => {
  const raw = String(value || "").trim().toLowerCase();
  if (["ativo", "inativo", "pendente", "vencido", "pago", "cancelado"].includes(raw)) return raw;
  return fallback;
};

const sanitizePaymentMethod = (value) => {
  const raw = String(value || "").trim().toUpperCase();
  return PAYMENT_METHODS.has(raw) ? raw : "ASAAS";
};

const withChatwootUrl = (row) => {
  const id = normalizeChatwootConversationId(row?.id_conversa_chatwoot);
  return {
    ...row,
    id_conversa_chatwoot: id || row?.id_conversa_chatwoot || null,
    chatwoot_url: id ? buildChatwootConversationUrl(id) : "",
  };
};

const loadTable = async ({ key, path }) => {
  try {
    const result = await supabaseFetch(path);
    const rows = Array.isArray(result.data) ? result.data : [];
    return { key, rows: rows.map(withChatwootUrl), error: "" };
  } catch (error) {
    console.error(`[api] financeiro dashboard table failed: ${key}`, error);
    return { key, rows: [], error: error?.code || error?.message || "load_failed" };
  }
};

const handleGet = async (res) => {
  const results = await Promise.all([
    loadTable({ key: "alunos", path: `/${FINANCE_TABLES.alunos}?order=updated_at.desc.nullslast&limit=500` }),
    loadTable({ key: "cobrancas", path: `/${FINANCE_TABLES.cobrancas}?order=vencimento.asc.nullslast&limit=500` }),
    loadTable({ key: "logs", path: `/${FINANCE_TABLES.logs}?order=enviado_em.desc.nullslast&limit=200` }),
    loadTable({ key: "eventos", path: `/${FINANCE_TABLES.eventos}?order=created_at.desc.nullslast&limit=200` }),
    loadTable({ key: "pagamentos", path: `/${FINANCE_TABLES.pagamentos}?order=data_pagamento.desc.nullslast&limit=300` }),
  ]);

  const payload = { alunos: [], cobrancas: [], logs: [], eventos: [], pagamentos: [], errors: {} };
  results.forEach((item) => {
    payload[item.key] = item.rows;
    if (item.error) payload.errors[item.key] = item.error;
  });

  sendJson(res, 200, payload);
};

const buildAlunoPayload = (body) =>
  cleanObject({
    aluno_nome: nullableString(body?.aluno_nome),
    telefone: nullableString(body?.telefone),
    email: nullableString(body?.email),
    asaas_customer_id: nullableString(body?.asaas_customer_id),
    asaas_subscription_id: nullableString(body?.asaas_subscription_id),
    id_conversa_chatwoot: normalizeChatwootConversationId(body?.id_conversa_chatwoot) || null,
    status: sanitizeStatus(body?.status, "ativo"),
    updated_at: new Date().toISOString(),
  });

const buildCobrancaPayload = (body) =>
  cleanObject({
    id_cobranca_externa: nullableString(body?.id_cobranca_externa),
    aluno_nome: nullableString(body?.aluno_nome),
    telefone: nullableString(body?.telefone),
    email: nullableString(body?.email),
    valor: nullableNumber(body?.valor),
    vencimento: nullableDate(body?.vencimento),
    status: sanitizeStatus(body?.status, "pendente"),
    forma_pagamento: sanitizePaymentMethod(body?.forma_pagamento),
    link_fatura: nullableString(body?.link_fatura),
    link_boleto: nullableString(body?.link_boleto),
    id_conversa_chatwoot: normalizeChatwootConversationId(body?.id_conversa_chatwoot) || null,
    observacao_pagamento: nullableString(body?.observacao_pagamento),
    updated_at: new Date().toISOString(),
  });

const handlePost = async (req, res, session) => {
  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    return sendJson(res, 400, { error: "invalid_json" });
  }

  const action = String(body?.action || "").trim();
  const nowIso = new Date().toISOString();

  if (action === "save_aluno") {
    const payload = buildAlunoPayload(body);
    if (!payload.aluno_nome) return sendJson(res, 400, { error: "missing_aluno_nome" });
    const id = String(body?.id || "").trim();
    const result = id
      ? await supabaseFetch(`/${FINANCE_TABLES.alunos}?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", body: payload })
      : await supabaseFetch(`/${FINANCE_TABLES.alunos}`, { method: "POST", body: { ...payload, created_at: nowIso } });
    const row = Array.isArray(result.data) ? withChatwootUrl(result.data[0] || null) : null;
    return sendJson(res, 200, { ok: true, row });
  }

  if (action === "save_cobranca") {
    const payload = buildCobrancaPayload(body);
    if (!payload.aluno_nome) return sendJson(res, 400, { error: "missing_aluno_nome" });
    const id = String(body?.id || "").trim();
    const result = id
      ? await supabaseFetch(`/${FINANCE_TABLES.cobrancas}?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", body: payload })
      : await supabaseFetch(`/${FINANCE_TABLES.cobrancas}`, { method: "POST", body: { ...payload, created_at: nowIso } });
    const row = Array.isArray(result.data) ? withChatwootUrl(result.data[0] || null) : null;
    return sendJson(res, 200, { ok: true, row });
  }

  if (action === "confirm_cobranca") {
    const id = String(body?.id || "").trim();
    if (!id) return sendJson(res, 400, { error: "missing_id" });
    const formaConfirmacao = sanitizePaymentMethod(body?.forma_confirmacao || body?.forma_pagamento || "OUTRO");
    const payload = {
      status: "pago",
      pago_em: nowIso,
      confirmado_por: String(session?.name || session?.email || "financeiro").trim() || "financeiro",
      forma_confirmacao: formaConfirmacao,
      observacao_pagamento: nullableString(body?.observacao_pagamento),
      updated_at: nowIso,
    };
    await supabaseFetch(`/${FINANCE_TABLES.cobrancas}?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", body: cleanObject(payload) });
    return sendJson(res, 200, { ok: true });
  }

  if (action === "link_conversation") {
    const conversationId = normalizeChatwootConversationId(body?.id_conversa_chatwoot);
    if (!conversationId) return sendJson(res, 400, { error: "missing_conversation_id" });

    const alunoId = String(body?.aluno_id || body?.id || "").trim();
    const cobrancaId = String(body?.cobranca_id || "").trim();
    const email = String(body?.email || "").trim().toLowerCase();
    const alunoNome = String(body?.aluno_nome || "").trim();
    const patch = { id_conversa_chatwoot: conversationId, updated_at: nowIso };

    let alunoUpdated = 0;
    let cobrancasUpdated = 0;

    if (alunoId) {
      const result = await supabaseFetch(`/${FINANCE_TABLES.alunos}?id=eq.${encodeURIComponent(alunoId)}`, { method: "PATCH", body: patch });
      alunoUpdated = Array.isArray(result.data) ? result.data.length : 0;
    } else if (email) {
      const result = await supabaseFetch(`/${FINANCE_TABLES.alunos}?email=eq.${encodeURIComponent(email)}`, { method: "PATCH", body: patch });
      alunoUpdated = Array.isArray(result.data) ? result.data.length : 0;
    } else if (alunoNome) {
      const result = await supabaseFetch(`/${FINANCE_TABLES.alunos}?aluno_nome=eq.${encodeURIComponent(alunoNome)}`, { method: "PATCH", body: patch });
      alunoUpdated = Array.isArray(result.data) ? result.data.length : 0;
    }

    if (cobrancaId) {
      const result = await supabaseFetch(`/${FINANCE_TABLES.cobrancas}?id=eq.${encodeURIComponent(cobrancaId)}`, { method: "PATCH", body: patch });
      cobrancasUpdated += Array.isArray(result.data) ? result.data.length : 0;
    }
    if (email) {
      const result = await supabaseFetch(`/${FINANCE_TABLES.cobrancas}?email=eq.${encodeURIComponent(email)}&id_conversa_chatwoot=is.null`, { method: "PATCH", body: patch });
      cobrancasUpdated += Array.isArray(result.data) ? result.data.length : 0;
    } else if (alunoNome) {
      const result = await supabaseFetch(`/${FINANCE_TABLES.cobrancas}?aluno_nome=eq.${encodeURIComponent(alunoNome)}&id_conversa_chatwoot=is.null`, {
        method: "PATCH",
        body: patch,
      });
      cobrancasUpdated += Array.isArray(result.data) ? result.data.length : 0;
    }

    return sendJson(res, 200, { ok: true, alunoUpdated, cobrancasUpdated });
  }

  return sendJson(res, 400, { error: "invalid_action" });
};

module.exports = async (req, res) => {
  const session = getSessionFromRequest(req);
  if (!session) return sendJson(res, 401, { error: "unauthorized" });
  if (!canAccessFinance(session)) return sendJson(res, 403, { error: "forbidden" });

  try {
    if (req.method === "GET") return await handleGet(res);
    if (req.method === "POST" || req.method === "PATCH") return await handlePost(req, res, session);
    res.setHeader("Allow", "GET, POST, PATCH");
    return sendJson(res, 405, { error: "method_not_allowed" });
  } catch (error) {
    console.error("[api] financeiro-dashboard failed", error);
    return sendJson(res, 500, { error: error?.code || "finance_dashboard_failed" });
  }
};
