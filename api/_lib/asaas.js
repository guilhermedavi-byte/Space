const { getAsaasConfig } = require("./finance-integrations");

const asaasFetch = async (path, { method = "GET", body, headers = {} } = {}) => {
  const cfg = getAsaasConfig();
  if (!cfg.apiKey) {
    const error = new Error("asaas_not_configured");
    error.code = "asaas_not_configured";
    throw error;
  }

  const safePath = String(path || "").startsWith("/") ? String(path || "") : `/${String(path || "")}`;
  const res = await fetch(`${cfg.baseUrl}${safePath}`, {
    method,
    headers: {
      access_token: cfg.apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...headers,
    },
    body: body == null ? undefined : JSON.stringify(body),
  });

  const text = await res.text().catch(() => "");
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!res.ok) {
    const error = new Error("asaas_request_failed");
    error.status = res.status;
    error.data = data;
    throw error;
  }

  return data;
};

module.exports = { asaasFetch };
