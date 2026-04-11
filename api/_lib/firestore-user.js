const PROJECT_ID = "plataforma-space";
const API_KEY = "AIzaSyD0qyhYh6MWRPMRDN_SYqdDEeogS3thQPE";
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

const normalizeRole = (value) => {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "student" || raw === "aluno") return "student";
  if (raw === "teacher" || raw === "professor") return "teacher";
  if (raw === "admin" || raw === "administrador") return "admin";
  return "";
};

const readStringField = (fields, key) => {
  if (!fields || typeof fields !== "object") return "";
  const entry = fields[key];
  if (!entry || typeof entry !== "object") return "";
  const raw = entry.stringValue;
  return typeof raw === "string" ? raw : "";
};

const readBooleanField = (fields, key, fallback) => {
  if (!fields || typeof fields !== "object") return fallback;
  const entry = fields[key];
  if (!entry || typeof entry !== "object") return fallback;
  const raw = entry.booleanValue;
  return typeof raw === "boolean" ? raw : fallback;
};

const fetchJsonWithHeaders = async (url, { headers } = {}) => {
  const safeHeaders = headers && typeof headers === "object" ? headers : {};

  if (typeof fetch === "function") {
    const res = await fetch(url, { headers: safeHeaders });
    const text = await res.text().catch(() => "");
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch (error) {
      data = null;
    }
    return { ok: res.ok, status: res.status, data };
  }

  return new Promise((resolve, reject) => {
    // eslint-disable-next-line global-require
    const https = require("https");
    const req = https.request(
      url,
      { method: "GET", headers: safeHeaders },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          const status = Number(res.statusCode) || 0;
          const ok = status >= 200 && status < 300;
          const body = Buffer.concat(chunks).toString("utf8");
          let data = null;
          try {
            data = body ? JSON.parse(body) : null;
          } catch (error) {
            data = null;
          }
          resolve({ ok, status, data });
        });
      }
    );
    req.on("error", reject);
    req.end();
  });
};

const fetchUserProfileByUid = async ({ uid, idToken }) => {
  const safeUid = String(uid || "").trim();
  const token = String(idToken || "").trim();
  if (!safeUid || !token) return null;

  const url = `${FIRESTORE_BASE}/users/${encodeURIComponent(safeUid)}?key=${encodeURIComponent(API_KEY)}`;
  const { ok, status, data } = await fetchJsonWithHeaders(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!ok) {
    if (status === 404) return null;
    throw new Error("firestore_fetch_failed");
  }

  const fields = data && typeof data === "object" ? data.fields : null;
  const name = readStringField(fields, "nome").trim();
  const email = readStringField(fields, "email").trim().toLowerCase();
  const role = normalizeRole(readStringField(fields, "tipo"));
  const active = readBooleanField(fields, "ativo", true);

  if (!active) return null;
  if (!name || !email || !role) return null;

  return {
    id: safeUid,
    role,
    name,
    email,
  };
};

module.exports = {
  fetchUserProfileByUid,
};
