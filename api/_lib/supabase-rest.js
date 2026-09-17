const https = require("node:https");
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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const nodeHttpsFetch = (target, { method = "GET", headers = {}, body, timeoutMs = 8000 } = {}) => new Promise((resolve, reject) => {
  let url;
  try { url = new URL(target); } catch { reject(Object.assign(new Error("supabase_transport_failed"), { code: "supabase_transport_failed" })); return; }
  if (url.protocol !== "https:") { reject(Object.assign(new Error("supabase_transport_failed"), { code: "supabase_transport_failed" })); return; }
  const req = https.request(url, { method, headers, timeout: Math.max(1000, Math.min(Number(timeoutMs) || 8000, 15000)) }, (res) => {
    const chunks = [];
    res.on("data", chunk => chunks.push(chunk));
    res.on("end", () => resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode || 0, text: async () => Buffer.concat(chunks).toString("utf8") }));
  });
  req.on("timeout", () => req.destroy(Object.assign(new Error("supabase_transport_failed"), { code: "supabase_transport_failed" })));
  req.on("error", () => reject(Object.assign(new Error("supabase_transport_failed"), { code: "supabase_transport_failed" })));
  if (body != null) req.write(body);
  req.end();
});


const shouldRetry = (error) => {
  const status = Number(error?.status) || 0;
  const code = String(error?.code || error?.message || "");
  return status === 522 || status === 524 || status === 502 || status === 503 || status === 504 || code === "supabase_transport_failed";
};

const supabaseFetchOnce = async (path, { method = "GET", headers = {}, body, signal, timeoutMs = 8000 } = {}) => {
  const { url, key } = getSupabaseConfig();
  let res;
  const controller = typeof AbortController === "function" && !signal ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), Math.max(1000, Math.min(Number(timeoutMs) || 8000, 15000))) : null;
  const target = `${url}/rest/v1${path}`;
  const requestHeaders = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
    ...headers,
  };
  const requestBody = body == null ? undefined : JSON.stringify(body);
  try {
    res = await fetch(target, {
      method,
      // A redirect could forward the custom apikey header to a different origin.
      redirect: "error",
      signal: signal || controller?.signal,
      headers: requestHeaders,
      body: requestBody,
    });
  } catch {
    if (method === "GET" && !signal) {
      try {
        res = await nodeHttpsFetch(target, { method, headers: requestHeaders, timeoutMs });
      } catch {
        const error = new Error("supabase_transport_failed");
        error.code = "supabase_transport_failed";
        throw error;
      }
    } else {
      // Transport errors may include request headers/URLs. Never propagate their cause.
      const error = new Error("supabase_transport_failed");
      error.code = "supabase_transport_failed";
      throw error;
    }
  } finally {
    if (timer) clearTimeout(timer);
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

const supabaseFetch = async (path, options = {}) => {
  const method = String(options.method || "GET").toUpperCase();
  const attempts = method === "GET" && !options.signal ? 2 : 1;
  let last;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await supabaseFetchOnce(path, options);
    } catch (error) {
      last = error;
      if (attempt + 1 >= attempts || !shouldRetry(error)) throw error;
      await sleep(250);
    }
  }
  throw last;
};

module.exports = { supabaseFetch };
