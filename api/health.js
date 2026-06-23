const { sendJson } = require("../_lib/http");

const configured = (...names) =>
  names.some((name) => String(process.env[name] || "").trim().length > 0);

module.exports = async (req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    return sendJson(res, 405, { error: "method_not_allowed" });
  }

  const checks = {
    auth: configured("SPACE_AUTH_SECRET"),
    publicUrl: configured("SPACE_PUBLIC_BASE_URL"),
    supabase: configured("SUPABASE_URL") && configured("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_ANON_KEY"),
    asaas: configured("ASAAS_API_KEY") && configured("ASAAS_BASE_URL"),
    chatwoot:
      configured("CHATWOOT_BASE_URL") &&
      configured("CHATWOOT_ACCOUNT_ID") &&
      configured("CHATWOOT_INBOX_ID") &&
      configured("CHATWOOT_API_TOKEN"),
    openai: configured("OPENAI_API_KEY"),
    n8n: configured("N8N_BASE_URL"),
    webhookProtection: configured("N8N_WEBHOOK_SECRET", "ASAAS_WEBHOOK_TOKEN", "ZAPSIGN_WEBHOOK_SECRET"),
    firebaseServiceAccount:
      configured("FIREBASE_SERVICE_ACCOUNT_JSON", "GOOGLE_SERVICE_ACCOUNT_JSON") ||
      (configured("GOOGLE_CLIENT_EMAIL", "FIREBASE_CLIENT_EMAIL") &&
        configured("GOOGLE_PRIVATE_KEY", "FIREBASE_PRIVATE_KEY")),
  };

  const required = ["auth", "publicUrl", "supabase", "asaas", "chatwoot", "n8n", "webhookProtection"];
  const ready = required.every((key) => checks[key]);
  return sendJson(res, ready ? 200 : 503, {
    status: ready ? "ready" : "degraded",
    checks,
    timestamp: new Date().toISOString(),
  });
};
