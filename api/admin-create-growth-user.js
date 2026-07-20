const { readJsonBody, sendJson } = require("../_lib/http");
const { getFirebaseServerConfig } = require("../_lib/runtime-env");
const { getGoogleAccessToken } = require("../_lib/google-service-account");
const { resolveAdminRequestAuth } = require("./_lib/admin-request-auth");
const { commitWritesAsAdmin } = require("./_lib/firestore-admin");
const { PROJECT_ID, encodeFields, requestJson } = require("./_lib/firestore-rest");

const CLOUD_PLATFORM_SCOPE = "https://www.googleapis.com/auth/cloud-platform";

const normalizeEmail = (value) => String(value || "").trim().toLowerCase();
const normalizeName = (value) => String(value || "").trim().replace(/\s+/g, " ");
const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value));

const buildUserCommitDocumentName = (uid) => {
  const safeUid = String(uid || "").trim();
  if (!PROJECT_ID) {
    const error = new Error("missing_firestore_project_id");
    error.code = "missing_firestore_project_id";
    throw error;
  }
  if (!safeUid) {
    const error = new Error("missing_user_uid");
    error.code = "missing_user_uid";
    throw error;
  }
  return `projects/${PROJECT_ID}/databases/(default)/documents/users/${encodeURIComponent(safeUid)}`;
};

const createAuthUserWithPassword = async ({ email, password, displayName }) => {
  const { apiKey } = getFirebaseServerConfig();
  if (!apiKey) {
    const error = new Error("missing_firebase_api_key");
    error.code = "missing_firebase_api_key";
    throw error;
  }
  const response = await requestJson(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    body: {
      email,
      password,
      displayName,
      returnSecureToken: true,
    },
  });
  if (!response.ok) {
    const rawMessage = String(response.data?.error?.message || response.text || "auth_create_failed");
    const error = new Error(rawMessage);
    error.code = rawMessage;
    error.status = response.status;
    throw error;
  }
  const uid = String(response.data?.localId || "").trim();
  if (!uid) {
    const error = new Error("missing_auth_uid");
    error.code = "missing_auth_uid";
    throw error;
  }
  return { uid };
};

const deleteAuthUserBestEffort = async (uid) => {
  const localId = String(uid || "").trim();
  if (!localId || !PROJECT_ID) return;
  try {
    const token = await getGoogleAccessToken({ scope: CLOUD_PLATFORM_SCOPE });
    const accessToken = String(token?.accessToken || "");
    if (!accessToken) return;
    await requestJson(`https://identitytoolkit.googleapis.com/v1/projects/${encodeURIComponent(PROJECT_ID)}/accounts:delete`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: { localId },
    });
  } catch (error) {
    console.warn("[admin-create-growth-user] auth rollback failed", { uid: localId, message: error?.message || String(error || "") });
  }
};

const createGrowthFirestoreDoc = async ({ uid, nome, email, createdBy }) => {
  const nowIso = new Date().toISOString();
  const doc = {
    nome,
    name: nome,
    displayName: nome,
    email,
    tipo: "growth",
    role: "growth",
    ativo: true,
    criadoPor: createdBy || "",
    createdBy: createdBy || "",
    criadoEm: nowIso,
    createdAt: nowIso,
    atualizadoEm: nowIso,
    updatedAt: nowIso,
    source: "admin_comercial_users",
  };
  const response = await commitWritesAsAdmin({
    writes: [
      {
        update: {
          name: buildUserCommitDocumentName(uid),
          fields: encodeFields(doc).fields,
        },
      },
    ],
  });
  if (!response.ok) {
    const error = new Error("firestore_create_growth_failed");
    error.code = "firestore_create_growth_failed";
    error.status = response.status;
    error.details = response.data || response.text || null;
    throw error;
  }
  return doc;
};

const mapFirebaseAuthError = (error) => {
  const code = String(error?.code || error?.message || "").trim();
  if (/EMAIL_EXISTS|email.*exists|already/i.test(code)) {
    return { status: 409, error: "email_already_exists", message: "Este e-mail já está cadastrado." };
  }
  if (/INVALID_EMAIL/i.test(code)) {
    return { status: 400, error: "invalid_email", message: "E-mail inválido." };
  }
  if (/WEAK_PASSWORD/i.test(code)) {
    return { status: 400, error: "weak_password", message: "Senha fraca. Use pelo menos 6 caracteres." };
  }
  if (/OPERATION_NOT_ALLOWED/i.test(code)) {
    return { status: 400, error: "password_provider_disabled", message: "Login por senha não está habilitado neste projeto Firebase." };
  }
  return { status: 500, error: "auth_create_failed", message: "Não foi possível criar o usuário Growth no Firebase Auth." };
};

const extractErrorDetail = (error) => {
  const details = error?.details;
  if (details && typeof details === "object") {
    const nested = details.error && typeof details.error === "object" ? details.error : details;
    return String(nested.message || nested.status || nested.code || "").trim();
  }
  if (typeof details === "string") return details.trim();
  return String(error?.message || "").trim();
};

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    sendJson(res, 405, { error: "method_not_allowed" });
    return;
  }

  const auth = await resolveAdminRequestAuth(req, { logPrefix: "[admin-create-growth-user]" });
  if (!auth.ok) {
    sendJson(res, auth.status, auth.body);
    return;
  }
  if (String(auth.session?.role || "") !== "admin") {
    sendJson(res, 403, { error: "forbidden", message: "Apenas administradores podem criar usuários Growth." });
    return;
  }

  let body;
  try {
    body = await readJsonBody(req);
  } catch (error) {
    sendJson(res, 400, { error: "invalid_json", message: "Payload inválido." });
    return;
  }

  const nome = normalizeName(body?.nome || body?.name);
  const email = normalizeEmail(body?.email);
  const senha = String(body?.senha || body?.password || "");

  if (!nome) {
    sendJson(res, 400, { error: "missing_name", message: "Informe o nome do usuário Growth." });
    return;
  }
  if (!isValidEmail(email)) {
    sendJson(res, 400, { error: "invalid_email", message: "Informe um e-mail válido." });
    return;
  }
  if (senha.length < 6) {
    sendJson(res, 400, { error: "weak_password", message: "A senha precisa ter pelo menos 6 caracteres." });
    return;
  }

  let uid = "";
  try {
    const created = await createAuthUserWithPassword({ email, password: senha, displayName: nome });
    uid = created.uid;
    const doc = await createGrowthFirestoreDoc({ uid, nome, email, createdBy: auth.session.sub });
    sendJson(res, 200, {
      ok: true,
      user: { id: uid, uid, firestoreDocId: uid, ...doc },
    });
  } catch (error) {
    if (uid) await deleteAuthUserBestEffort(uid);
    const mapped = mapFirebaseAuthError(error);
    const errorDetail = extractErrorDetail(error);
    console.error("[admin-create-growth-user] failed", {
      status: mapped.status,
      error: mapped.error,
      code: error?.code || "",
      detail: errorDetail,
    });
    sendJson(res, mapped.status, {
      error: mapped.error,
      message: mapped.message,
      errorDetail,
    });
  }
};

module.exports._private = {
  buildUserCommitDocumentName,
  isValidEmail,
  mapFirebaseAuthError,
  normalizeEmail,
  normalizeName,
};
