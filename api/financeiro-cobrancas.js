const { readJsonBody, sendJson } = require("./_lib/http");
const { getSessionFromRequest } = require("../_lib/session");
const { supabaseFetch } = require("./_lib/supabase-rest");
const {
  FINANCE_TABLE,
  canAccessFinance,
  normalizeChatwootConversationId,
  buildChatwootConversationUrl,
} = require("./_lib/finance-integrations");

const MANUAL_PAYMENT_METHODS = new Set(["CPF_GUILHERME", "XP", "PIX_MANUAL", "OUTRO"]);
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

const sanitizeStatus = (value) => {
  const raw = String(value || "").trim().toLowerCase();
  if (["pendente", "vencido", "pago", "cancelado"].includes(raw)) return raw;
  return "pendente";
};

const sanitizePaymentMethod = (value) => {
  const raw = String(value || "").trim().toUpperCase();
  return PAYMENT_METHODS.has(raw) ? raw : "ASAAS";
};

const sanitizeRowForClient = (row) => {
  const idConversa = normalizeChatwootConversationId(row?.id_conversa_chatwoot);
  return {
    ...row,
    id_conversa_chatwoot: idConversa || row?.id_conversa_chatwoot || null,
    chatwoot_url: idConversa ? buildChatwootConversationUrl(idConversa) : "",
  };
};

const buildPatch = (body, session) => {
  const formaPagamento = sanitizePaymentMethod(body?.forma_pagamento);
  const idConversa = normalizeChatwootConversationId(body?.id_conversa_chatwoot);
  const nowIso = new Date().toISOString();
  const patch = {
    aluno_id: nullableString(body?.aluno_id),
    aluno_nome: nullableString(body?.aluno_nome),
    aluno_email: nullableString(body?.aluno_email),
    valor: nullableNumber(body?.valor ?? body?.valor_cobranca),
    vencimento: nullableDate(body?.vencimento ?? body?.data_vencimento),
    status: sanitizeStatus(body?.status),
    forma_pagamento: formaPagamento,
    id_cobranca_externa: nullableString(body?.id_cobranca_externa),
    link_fatura: nullableString(body?.link_fatura),
    link_boleto: nullableString(body?.link_boleto),
    id_conversa_chatwoot: idConversa || null,
    observacao_pagamento: nullableString(body?.observacao_pagamento),
    updated_at: nowIso,
  };

  Object.keys(patch).forEach((key) => {
    if (patch[key] === undefined) delete patch[key];
  });

  if (!patch.aluno_id) delete patch.aluno_id;
  if (!patch.aluno_nome) delete patch.aluno_nome;
  if (!patch.aluno_email) delete patch.aluno_email;
  if (patch.valor == null) delete patch.valor;
  if (!patch.vencimento) delete patch.vencimento;

  if (body?.confirmar_pagamento === true) {
    if (!MANUAL_PAYMENT_METHODS.has(formaPagamento)) {
      const error = new Error("invalid_manual_payment_method");
      error.code = "invalid_manual_payment_method";
      throw error;
    }
    patch.status = "pago";
    patch.pago_em = nowIso;
    patch.confirmado_por = String(session?.name || session?.email || "financeiro").trim() || "financeiro";
    patch.forma_confirmacao = formaPagamento;
  }

  return patch;
};

const handleList = async (req, res) => {
  const host = String(req.headers.host || "localhost");
  const url = new URL(req.url || "/api/financeiro-cobrancas", `https://${host}`);
  const alunoId = String(url.searchParams.get("aluno_id") || url.searchParams.get("alunoId") || "").trim();
  const query = alunoId
    ? `/${FINANCE_TABLE}?aluno_id=eq.${encodeURIComponent(alunoId)}&order=created_at.desc.nullslast`
    : `/${FINANCE_TABLE}?order=created_at.desc.nullslast&limit=200`;

  const result = await supabaseFetch(query);
  const rows = Array.isArray(result.data) ? result.data.map(sanitizeRowForClient) : [];
  sendJson(res, 200, { rows });
};

const handleSave = async (req, res, session) => {
  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    sendJson(res, 400, { error: "invalid_json" });
    return;
  }

  let patch;
  try {
    patch = buildPatch(body, session);
  } catch (error) {
    sendJson(res, 400, { error: error.code || "invalid_request" });
    return;
  }

  const id = String(body?.id || "").trim();
  let result;
  if (id) {
    result = await supabaseFetch(`/${FINANCE_TABLE}?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: patch,
    });
  } else {
    result = await supabaseFetch(`/${FINANCE_TABLE}`, {
      method: "POST",
      body: { ...patch, created_at: new Date().toISOString() },
    });
  }

  const row = Array.isArray(result.data) ? sanitizeRowForClient(result.data[0] || null) : null;
  sendJson(res, 200, { ok: true, row });
};

module.exports = async (req, res) => {
  const session = getSessionFromRequest(req);
  if (!session) return sendJson(res, 401, { error: "unauthorized" });
  if (!canAccessFinance(session)) return sendJson(res, 403, { error: "forbidden" });

  try {
    if (req.method === "GET") return await handleList(req, res);
    if (req.method === "POST" || req.method === "PATCH") return await handleSave(req, res, session);
    res.setHeader("Allow", "GET, POST, PATCH");
    return sendJson(res, 405, { error: "method_not_allowed" });
  } catch (error) {
    if (error?.code === "supabase_not_configured") {
      return sendJson(res, 500, { error: "supabase_not_configured" });
    }
    console.error("[api] financeiro-cobrancas failed", error);
    return sendJson(res, 500, { error: "finance_request_failed" });
  }
};
