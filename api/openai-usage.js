const { readJsonBody, sendJson } = require("../_lib/http");

const OPENAI_API = "https://api.openai.com/v1";

async function getJson(path, key) {
  const response = await fetch(`${OPENAI_API}${path}`, {
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = response.status === 401 || response.status === 403
      ? "Chave recusada. A consulta exige uma Admin API Key da organização."
      : payload.error?.message || `A OpenAI respondeu com erro ${response.status}.`;
    throw Object.assign(new Error(message), { statusCode: response.status === 401 || response.status === 403 ? 401 : 502 });
  }
  return payload;
}

const sum = (items, field) => items.reduce((total, item) => total + Number(item[field] || 0), 0);

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { error: "method_not_allowed" });
  }

  try {
    const { key } = await readJsonBody(req);
    if (typeof key !== "string" || !key.startsWith("sk-admin-") || key.length > 500) {
      return sendJson(res, 400, { error: "invalid_admin_key", message: "Informe uma Admin API Key válida da OpenAI." });
    }

    const now = Math.floor(Date.now() / 1000);
    const startTime = now - 30 * 86400;
    const query = new URLSearchParams({
      start_time: String(startTime),
      end_time: String(now),
      bucket_width: "1d",
      limit: "31",
    });
    const modelQuery = new URLSearchParams(query);
    modelQuery.append("group_by", "model");

    const [usage, byModel, costs] = await Promise.all([
      getJson(`/organization/usage/completions?${query}`, key),
      getJson(`/organization/usage/completions?${modelQuery}`, key),
      getJson(`/organization/costs?${query}`, key),
    ]);

    const results = (usage.data || []).flatMap((bucket) => bucket.results || []);
    const modelResults = (byModel.data || []).flatMap((bucket) => bucket.results || []);
    const costResults = (costs.data || []).flatMap((bucket) => bucket.results || []);
    const models = new Map();
    for (const item of modelResults) {
      const name = item.model || "sem modelo";
      models.set(name, (models.get(name) || 0) + Number(item.input_tokens || 0) + Number(item.output_tokens || 0));
    }
    const days = (usage.data || []).map((bucket) =>
      sum(bucket.results || [], "input_tokens") + sum(bucket.results || [], "output_tokens")
    );
    const maxDay = Math.max(...days, 1);

    return sendJson(res, 200, {
      inputTokens: sum(results, "input_tokens"),
      outputTokens: sum(results, "output_tokens"),
      cachedTokens: sum(results, "input_cached_tokens"),
      requests: sum(results, "num_model_requests"),
      cost: costResults.reduce((total, item) => total + Number(item.amount?.value || 0), 0),
      days: days.map((value) => Math.round(value / maxDay * 100)),
      models: [...models.entries()]
        .map(([name, tokens]) => ({ name, tokens }))
        .sort((a, b) => b.tokens - a.tokens),
    });
  } catch (error) {
    return sendJson(res, error.statusCode || 500, {
      error: "openai_usage_failed",
      message: error.message || "Não foi possível consultar o uso da OpenAI.",
    });
  }
};
