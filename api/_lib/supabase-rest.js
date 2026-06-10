const getSupabaseConfig = () => {
  const url = String(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || "").trim();
  if (!url || !key) {
    const error = new Error("supabase_not_configured");
    error.code = "supabase_not_configured";
    throw error;
  }
  return { url, key };
};

const supabaseFetch = async (path, { method = "GET", headers = {}, body } = {}) => {
  const { url, key } = getSupabaseConfig();
  const res = await fetch(`${url}/rest/v1${path}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
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
