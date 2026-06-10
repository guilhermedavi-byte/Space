const FINANCE_TABLE = "n8n_cobrancas_financeiras_space";
const CHATWOOT_BASE_URL_DEFAULT = "https://chatwoot.spaceschoolbr.com";
const CHATWOOT_ACCOUNT_ID_DEFAULT = "1";
const CHATWOOT_INBOX_ID_DEFAULT = "7";

const isFinanceRole = (role) => {
  const raw = String(role || "").trim();
  return raw === "FINANCE" || ["finance", "financeiro"].includes(raw.toLowerCase());
};

const canAccessFinance = (session) => {
  const role = String(session?.role || "").trim();
  return role === "admin" || isFinanceRole(role);
};

const onlyDigits = (value) => String(value || "").replace(/\D+/g, "");

const normalizeChatwootConversationId = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^\d+$/.test(raw)) return raw;
  const match = raw.match(/\/conversations\/(\d+)(?:\D|$)/i);
  if (match) return match[1];
  return onlyDigits(raw);
};

const getChatwootConfig = () => ({
  baseUrl: String(process.env.CHATWOOT_BASE_URL || CHATWOOT_BASE_URL_DEFAULT).replace(/\/+$/, ""),
  accountId: String(process.env.CHATWOOT_ACCOUNT_ID || CHATWOOT_ACCOUNT_ID_DEFAULT).trim(),
  inboxId: String(process.env.CHATWOOT_INBOX_ID || CHATWOOT_INBOX_ID_DEFAULT).trim(),
  token: String(process.env.CHATWOOT_API_TOKEN || "").trim(),
});

const buildChatwootConversationUrl = (conversationId) => {
  const cfg = getChatwootConfig();
  const id = normalizeChatwootConversationId(conversationId);
  if (!id) return "";
  return `${cfg.baseUrl}/app/accounts/${encodeURIComponent(cfg.accountId)}/inbox/${encodeURIComponent(cfg.inboxId)}/conversations/${encodeURIComponent(id)}`;
};

const getAsaasConfig = () => ({
  baseUrl: String(process.env.ASAAS_BASE_URL || "https://api-sandbox.asaas.com/v3").replace(/\/+$/, ""),
  apiKey: String(process.env.ASAAS_API_KEY || "").trim(),
});

module.exports = {
  FINANCE_TABLE,
  canAccessFinance,
  isFinanceRole,
  normalizeChatwootConversationId,
  getChatwootConfig,
  buildChatwootConversationUrl,
  getAsaasConfig,
};
