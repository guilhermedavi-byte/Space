const { assertEnvironmentIsolation } = require("../../_lib/runtime-env");

const getSupabaseConfig = () => {
  assertEnvironmentIsolation();
  const url = String(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || "").trim();
  if (!url || !key) {
    const error = new Error("supabase_not_configured");
    error.code = "supabase_not_configured";
    throw error;
  }
  return { url, key };
};

const supabaseFetch = async (path, { method = "GET", headers = {}, body } = {}) => {
  const { url, key } = getSupabaseConfig();
  let res;
  try {
    res = await fetch(`${url}/rest/v1${path}`, {
      method,
      // A redirect could forward the custom apikey header to a different origin.
      redirect: "error",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
        ...headers,
      },
      body: body == null ? undefined : JSON.stringify(body),
    });
  } catch {
    // Transport errors may include request headers/URLs. Never propagate their cause.
    const error = new Error("supabase_transport_failed");
    error.code = "supabase_transport_failed";
    throw error;
  }

  // Sanitize before parsing, including successful responses and nested error payloads.
  const text = (await res.text().catch(() => "")).split(key).join("[REDACTED]");
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  // JSON escapes can conceal the key in the raw response. Redact decoded values/keys too.
  const redact = (value) => {
    if (typeof value === "string") return value.split(key).join("[REDACTED]");
    if (Array.isArray(value)) return value.map(redact);
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([name, item]) => [redact(name), redact(item)]));
    return value;
  };
  data = redact(data);

  if (!res.ok) {
    const error = new Error("supabase_request_failed");
    error.status = res.status;
    error.data = data;
    if (data && typeof data === "object") {
      error.code = data.code || data.error || "supabase_request_failed";
      error.message = data.message || data.msg || error.message;
      error.details = data.details || "";
      error.hint = data.hint || "";
    } else if (typeof data === "string" && data) {
      error.message = data;
    }
    throw error;
  }

  return { status: res.status, data };
};

module.exports = { supabaseFetch };
