const PROJECT_ID = "plataforma-space";
const API_KEY = "AIzaSyD0qyhYh6MWRPMRDN_SYqdDEeogS3thQPE";
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

const getBearerTokenFromRequest = (req) => {
  const header = String(req?.headers?.authorization || req?.headers?.Authorization || "").trim();
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? String(match[1] || "").trim() : "";
};

const encodeValue = (value) => {
  if (value == null) return { nullValue: "NULL_VALUE" };

  if (value instanceof Date) {
    return { timestampValue: value.toISOString() };
  }

  const type = typeof value;

  if (type === "string") return { stringValue: value };
  if (type === "boolean") return { booleanValue: value };

  if (type === "number") {
    if (!Number.isFinite(value)) return { nullValue: "NULL_VALUE" };
    if (Number.isInteger(value)) return { integerValue: String(value) };
    return { doubleValue: value };
  }

  if (Array.isArray(value)) {
    const values = value.map((v) => encodeValue(v)).filter(Boolean);
    return values.length ? { arrayValue: { values } } : { arrayValue: {} };
  }

  if (type === "object") {
    const fields = {};
    Object.entries(value).forEach(([k, v]) => {
      if (!k) return;
      fields[k] = encodeValue(v);
    });
    return { mapValue: { fields } };
  }

  // Unsupported types (function, symbol, bigint...)
  return { nullValue: "NULL_VALUE" };
};

const encodeFields = (data) => {
  const safe = data && typeof data === "object" ? data : {};
  const fields = {};
  Object.entries(safe).forEach(([k, v]) => {
    if (!k) return;
    fields[k] = encodeValue(v);
  });
  return { fields };
};

const decodeValue = (value) => {
  if (!value || typeof value !== "object") return null;
  if (Object.prototype.hasOwnProperty.call(value, "nullValue")) return null;
  if (typeof value.stringValue === "string") return value.stringValue;
  if (typeof value.booleanValue === "boolean") return value.booleanValue;

  if (typeof value.integerValue === "string") {
    const n = Number(value.integerValue);
    return Number.isFinite(n) ? n : null;
  }
  if (typeof value.doubleValue === "number") {
    return Number.isFinite(value.doubleValue) ? value.doubleValue : null;
  }

  if (typeof value.timestampValue === "string") {
    const d = new Date(value.timestampValue);
    return Number.isNaN(d.getTime()) ? value.timestampValue : d;
  }

  if (value.arrayValue && typeof value.arrayValue === "object") {
    const values = Array.isArray(value.arrayValue.values) ? value.arrayValue.values : [];
    return values.map((v) => decodeValue(v));
  }

  if (value.mapValue && typeof value.mapValue === "object") {
    const rawFields = value.mapValue.fields && typeof value.mapValue.fields === "object" ? value.mapValue.fields : {};
    const out = {};
    Object.entries(rawFields).forEach(([k, v]) => {
      out[k] = decodeValue(v);
    });
    return out;
  }

  return null;
};

const decodeFields = (doc) => {
  const fields = doc && typeof doc === "object" ? doc.fields : null;
  if (!fields || typeof fields !== "object") return {};
  const out = {};
  Object.entries(fields).forEach(([k, v]) => {
    out[k] = decodeValue(v);
  });
  return out;
};

const getDocIdFromName = (name) => {
  const raw = String(name || "");
  const parts = raw.split("/").filter(Boolean);
  return parts.length ? parts[parts.length - 1] : "";
};

const requestJson = async (url, { method = "GET", headers, body } = {}) => {
  const safeHeaders = headers && typeof headers === "object" ? headers : {};
  const upper = String(method || "GET").toUpperCase();

  const opts = { method: upper, headers: safeHeaders };
  if (body != null) {
    opts.body = typeof body === "string" ? body : JSON.stringify(body);
    if (!opts.headers["Content-Type"] && !opts.headers["content-type"]) {
      opts.headers["Content-Type"] = "application/json";
    }
  }

  if (typeof fetch === "function") {
    const res = await fetch(url, opts);
    const text = await res.text().catch(() => "");
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch (error) {
      data = null;
    }
    return { ok: res.ok, status: res.status, data, text };
  }

  return new Promise((resolve, reject) => {
    // eslint-disable-next-line global-require
    const https = require("https");
    const parsed = new URL(url);
    const req = https.request(
      parsed,
      { method: upper, headers: safeHeaders },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          const status = Number(res.statusCode) || 0;
          const ok = status >= 200 && status < 300;
          const text = Buffer.concat(chunks).toString("utf8");
          let data = null;
          try {
            data = text ? JSON.parse(text) : null;
          } catch (error) {
            data = null;
          }
          resolve({ ok, status, data, text });
        });
      }
    );
    req.on("error", reject);
    if (opts.body) req.write(opts.body);
    req.end();
  });
};

const firestoreGetDocument = async ({ docPath, idToken }) => {
  const token = String(idToken || "").trim();
  const path = String(docPath || "").replace(/^\/+/, "");
  if (!path || !token) throw new Error("missing_params");

  const url = `${FIRESTORE_BASE}/${encodeURI(path)}?key=${encodeURIComponent(API_KEY)}`;
  return requestJson(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
};

const firestorePatchDocument = async ({ docPath, idToken, data, updateMaskPaths } = {}) => {
  const token = String(idToken || "").trim();
  const path = String(docPath || "").replace(/^\/+/, "");
  if (!path || !token) throw new Error("missing_params");

  const params = new URLSearchParams();
  params.set("key", API_KEY);
  const mask = Array.isArray(updateMaskPaths) ? updateMaskPaths.filter((p) => typeof p === "string" && p) : [];
  mask.forEach((fieldPath) => {
    params.append("updateMask.fieldPaths", fieldPath);
  });

  const url = `${FIRESTORE_BASE}/${encodeURI(path)}?${params.toString()}`;
  return requestJson(url, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}` },
    body: encodeFields(data),
  });
};

const firestoreDeleteDocument = async ({ docPath, idToken } = {}) => {
  const token = String(idToken || "").trim();
  const path = String(docPath || "").replace(/^\/+/, "");
  if (!path || !token) throw new Error("missing_params");

  const url = `${FIRESTORE_BASE}/${encodeURI(path)}?key=${encodeURIComponent(API_KEY)}`;
  return requestJson(url, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
};

const firestoreRunQuery = async ({ idToken, structuredQuery } = {}) => {
  const token = String(idToken || "").trim();
  if (!token) throw new Error("missing_token");
  const query = structuredQuery && typeof structuredQuery === "object" ? structuredQuery : null;
  if (!query) throw new Error("missing_query");

  const url = `${FIRESTORE_BASE}:runQuery?key=${encodeURIComponent(API_KEY)}`;
  return requestJson(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: { structuredQuery: query },
  });
};

const firestoreListDocuments = async ({ collectionPath, idToken, pageSize = 1000 } = {}) => {
  const token = String(idToken || "").trim();
  const path = String(collectionPath || "").replace(/^\/+/, "");
  if (!path || !token) throw new Error("missing_params");

  const safeSize = Math.max(1, Math.min(Number(pageSize) || 1000, 2000));

  const all = [];
  let pageToken = "";
  let safety = 0;

  while (safety < 20) {
    safety += 1;
    const params = new URLSearchParams();
    params.set("key", API_KEY);
    params.set("pageSize", String(safeSize));
    if (pageToken) params.set("pageToken", pageToken);

    const url = `${FIRESTORE_BASE}/${encodeURI(path)}?${params.toString()}`;
    const res = await requestJson(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) return res;
    const docs = Array.isArray(res.data?.documents) ? res.data.documents : [];
    docs.forEach((doc) => all.push(doc));
    pageToken = typeof res.data?.nextPageToken === "string" ? res.data.nextPageToken : "";
    if (!pageToken) {
      return { ...res, documents: all };
    }
  }

  return { ok: true, status: 200, data: null, text: "", documents: all };
};

module.exports = {
  PROJECT_ID,
  API_KEY,
  FIRESTORE_BASE,
  decodeFields,
  decodeValue,
  encodeFields,
  encodeValue,
  firestoreDeleteDocument,
  firestoreGetDocument,
  firestoreListDocuments,
  firestorePatchDocument,
  firestoreRunQuery,
  getBearerTokenFromRequest,
  getDocIdFromName,
  requestJson,
};
