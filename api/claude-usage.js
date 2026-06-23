const { readJsonBody, sendJson } = require("../_lib/http");

const USAGE_HEADERS = {
  status: "anthropic-ratelimit-unified-status",
  usage5: "anthropic-ratelimit-unified-5h-utilization",
  reset5: "anthropic-ratelimit-unified-5h-reset",
  usage7: "anthropic-ratelimit-unified-7d-utilization",
  reset7: "anthropic-ratelimit-unified-7d-reset",
  claim: "anthropic-ratelimit-unified-representative-claim",
  overage: "anthropic-ratelimit-unified-overage-status",
};

const numberHeader = (headers, name, multiplier = 1) => {
  const value = Number(headers.get(name));
  return Number.isFinite(value) ? value * multiplier : 0;
};

async function fetchUsage(token) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "anthropic-version": "2023-06-01",
      "anthropic-beta": "oauth-2025-04-20",
      "User-Agent": "claude-cli/2.0.0 (external, usage-monitor)",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1,
      messages: [{ role: "user", content: "." }],
    }),
  });

  const hasUsage = response.headers.has(USAGE_HEADERS.usage5);
  if (!response.ok && !hasUsage) {
    if (response.status === 401 || response.status === 403) {
      throw Object.assign(new Error("Token recusado. Gere um novo com claude setup-token."), { statusCode: 401 });
    }
    throw Object.assign(new Error(`A Anthropic respondeu com erro ${response.status}.`), { statusCode: 502 });
  }

  return {
    status: response.headers.get(USAGE_HEADERS.status) || "allowed",
    usage5: numberHeader(response.headers, USAGE_HEADERS.usage5, 100),
    reset5: numberHeader(response.headers, USAGE_HEADERS.reset5),
    usage7: numberHeader(response.headers, USAGE_HEADERS.usage7, 100),
    reset7: numberHeader(response.headers, USAGE_HEADERS.reset7),
    claim: response.headers.get(USAGE_HEADERS.claim) || "five_hour",
    overage: response.headers.get(USAGE_HEADERS.overage) || "unavailable",
  };
}

async function fetchStatus() {
  try {
    const response = await fetch("https://status.claude.com/api/v2/incidents/unresolved.json");
    if (!response.ok) return { models: null, incident: null };
    const payload = await response.json();
    const incidents = Array.isArray(payload.incidents) ? payload.incidents : [];
    const text = incidents.map((item) => `${item.name || ""} ${item.impact || ""}`).join(" ").toLowerCase();
    const modelUp = (name) => !text.includes(name.toLowerCase());
    return {
      models: {
        Haiku: modelUp("haiku"),
        Sonnet: modelUp("sonnet"),
        Opus: modelUp("opus"),
        Fable: modelUp("fable"),
      },
      incident: incidents[0]?.name || null,
    };
  } catch {
    return { models: null, incident: null };
  }
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { error: "method_not_allowed" });
  }

  try {
    const { token } = await readJsonBody(req);
    if (typeof token !== "string" || token.length < 20 || token.length > 400 || !token.startsWith("sk-ant-")) {
      return sendJson(res, 400, { error: "invalid_token", message: "Informe um token OAuth válido do Claude Code." });
    }

    const [usage, status] = await Promise.all([fetchUsage(token), fetchStatus()]);
    return sendJson(res, 200, { usage, models: status.models, incident: status.incident });
  } catch (error) {
    return sendJson(res, error.statusCode || 500, {
      error: "claude_usage_failed",
      message: error.message || "Não foi possível consultar o uso do Claude.",
    });
  }
};
