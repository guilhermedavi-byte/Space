const { assertEnvironmentIsolation, getFirebaseServerConfig } = require("./runtime-env");
const { getGoogleAccessToken } = require("./google-service-account");
const { FIRESTORE_BASE, decodeFields, requestJson } = require("./firestore-rest");

const DATASTORE_SCOPE = "https://www.googleapis.com/auth/datastore";

const getFirestoreUserRuntime = () => {
  assertEnvironmentIsolation();
  const { projectId, apiKey } = getFirebaseServerConfig();
  if (!projectId || !apiKey) {
    const error = new Error("firebase_runtime_not_configured");
    error.code = "firebase_runtime_not_configured";
    throw error;
  }
  return {
    projectId,
    apiKey,
    baseUrl: `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`,
  };
};

const normalizeRole = (value) => {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "student" || raw === "aluno") return "student";
  if (raw === "teacher" || raw === "professor") return "teacher";
  if (raw === "admin" || raw === "administrador") return "admin";
  if (raw === "growth") return "growth";
  if (raw === "finance" || raw === "financeiro") return "FINANCE";
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

const fetchUserFieldsByUidAsAdmin = async (uid) => {
  const safeUid = String(uid || "").trim();
  if (!safeUid) return null;
  const token = await getGoogleAccessToken({ scope: DATASTORE_SCOPE });
  const accessToken = String(token?.accessToken || "");
  if (!accessToken) return null;
  const response = await requestJson(`${FIRESTORE_BASE}/users/${encodeURIComponent(safeUid)}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    if (response.status === 404) return null;
    throw new Error("firestore_admin_fetch_failed");
  }
  return decodeFields(response.data);
};

const normalizeUserProfileFromFields = ({ uid, fields } = {}) => {
  const safeUid = String(uid || "").trim();
  const rawFields = fields && typeof fields === "object" ? fields : {};
  const readString = (key) => {
    const value = rawFields[key];
    return typeof value === "string" ? value : "";
  };
  const name = String(readString("nome") || readString("nomeCompleto") || readString("displayName") || readString("name") || "").trim();
  const email = String(readString("email") || "").trim().toLowerCase();
  const role = normalizeRole(readString("tipo") || readString("role") || readString("type"));
  const active = typeof rawFields.ativo === "boolean" ? rawFields.ativo : true;
  if (!safeUid || !name || !email || !role) return null;
  return {
    user: {
      id: safeUid,
      role,
      name,
      email,
    },
    active,
  };
};

const fetchUserProfileByUid = async ({ uid, idToken }) => {
  const safeUid = String(uid || "").trim();
  const token = String(idToken || "").trim();
  if (!safeUid || !token) return null;

  const { apiKey, baseUrl } = getFirestoreUserRuntime();
  const url = `${baseUrl}/users/${encodeURIComponent(safeUid)}?key=${encodeURIComponent(apiKey)}`;
  const { ok, status, data } = await fetchJsonWithHeaders(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!ok) {
    if (status === 404) return null;
    try {
      const adminFields = await fetchUserFieldsByUidAsAdmin(safeUid);
      return normalizeUserProfileFromFields({ uid: safeUid, fields: adminFields });
    } catch (error) {
      throw new Error("firestore_fetch_failed");
    }
  }

  const fields = data && typeof data === "object" ? data.fields : null;
  const decodedFields = decodeFields({ fields });
  return normalizeUserProfileFromFields({ uid: safeUid, fields: decodedFields });
};

module.exports = {
  fetchUserProfileByUid,
};
