const { readJsonBody, sendJson } = require("../_lib/http");
const { getFirebaseServerConfig } = require("../_lib/runtime-env");
const { getGoogleAccessToken } = require("../_lib/google-service-account");
const { resolveAdminRequestAuth } = require("./_lib/admin-request-auth");
const { commitWritesAsAdmin, listCollectionAsAdmin } = require("./_lib/firestore-admin");
const { FIRESTORE_BASE, PROJECT_ID, encodeFields, requestJson } = require("./_lib/firestore-rest");
const { syncStudentMirrorToSupabase } = require("./_lib/student-mirror-sync");

const DEFAULT_PASSWORD = "Space123";
const CLOUD_PLATFORM_SCOPE = "https://www.googleapis.com/auth/cloud-platform";

const normalizeEmail = (value) => String(value || "").trim().toLowerCase();
const normalizeName = (value) => String(value || "").trim().replace(/\s+/g, " ");
const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value));

const splitCsvLine = (line, sep) => {
  const out = [];
  let current = "";
  let inQuotes = false;
  const raw = String(line || "");
  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i];
    if (ch === '"') {
      if (inQuotes && raw[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (!inQuotes && ch === sep) {
      out.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  out.push(current.trim());
  return out;
};

const stripBom = (value) => String(value || "").replace(/^\uFEFF/, "");

const normalizeHeader = (value) =>
  stripBom(value)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const STUDENT_IMPORT_NAME_HEADERS = new Set([
  "nome",
  "name",
  "aluno",
  "student",
  "estudante",
  "nome_aluno",
  "nome_do_aluno",
  "nome_estudante",
  "nome_do_estudante",
  "nome_completo",
  "full_name",
  "student_name",
  "display_name",
]);

const STUDENT_IMPORT_EMAIL_HEADERS = new Set([
  "email",
  "e_mail",
  "mail",
  "email_aluno",
  "email_do_aluno",
  "e_mail_aluno",
  "e_mail_do_aluno",
  "email_estudante",
  "email_do_estudante",
  "e_mail_estudante",
  "e_mail_do_estudante",
  "correio",
  "correio_eletronico",
]);

const findStudentImportColumnIndex = (headers, acceptedHeaders) => headers.findIndex((header) => acceptedHeaders.has(header));

const parseStudentImportText = (text) => {
  const lines = String(text || "")
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) return [];

  const delimiter = lines[0].includes(";") ? ";" : lines[0].includes("\t") ? "\t" : ",";
  const firstCells = splitCsvLine(lines[0], delimiter);
  const headers = firstCells.map(normalizeHeader);
  const nameHeaderIndex = findStudentImportColumnIndex(headers, STUDENT_IMPORT_NAME_HEADERS);
  const emailHeaderIndex = findStudentImportColumnIndex(headers, STUDENT_IMPORT_EMAIL_HEADERS);
  const hasRecognizedHeader = nameHeaderIndex >= 0 || emailHeaderIndex >= 0;
  const firstLineLooksLikeData = firstCells.some((cell) => isValidEmail(cell));
  const shouldSkipFirstLine = hasRecognizedHeader || (!firstLineLooksLikeData && lines.length > 1);
  const dataLines = shouldSkipFirstLine ? lines.slice(1) : lines;
  const nameIndex = nameHeaderIndex >= 0 ? nameHeaderIndex : 0;
  const emailIndex = emailHeaderIndex >= 0 ? emailHeaderIndex : 1;

  return dataLines.map((line, index) => {
    const cells = splitCsvLine(line, delimiter);
    return {
      lineNumber: (shouldSkipFirstLine ? 2 : 1) + index,
      name: normalizeName(cells[nameIndex] || ""),
      email: normalizeEmail(cells[emailIndex] || ""),
    };
  });
};

const buildDefaultStudentDocument = ({ uid, name, email, adminId }) => {
  const nowIso = new Date().toISOString();
  return {
    id: uid,
    uid,
    authUserId: uid,
    firestoreDocId: uid,
    docId: uid,
    nome: name,
    nomeCompleto: name,
    name,
    displayName: name,
    email,
    telefone: "",
    tipo: "student",
    role: "student",
    ativo: true,
    status: "ativo",
    plano: "",
    professorId: "",
    professorNome: "",
    turma: "",
    nivelInglesAtual: "",
    objetivoPrincipal: "",
    observacoesPedagogicas: "",
    forcePasswordChange: true,
    defaultPasswordIssued: true,
    createdBy: adminId || "",
    criadoEm: nowIso,
    createdAt: nowIso,
    atualizadoEm: nowIso,
    updatedAt: nowIso,
    source: "admin_student_import",
  };
};

const listExistingStudentEmails = async () => {
  const rows = await listCollectionAsAdmin("users", { pageSize: 1500 });
  const emails = new Set();
  rows.forEach((row) => {
    const email = normalizeEmail(row?.email);
    if (email) emails.add(email);
  });
  return emails;
};

const createAuthUserWithPassword = async ({ email, password, displayName }) => {
  const { apiKey } = getFirebaseServerConfig();
  if (!apiKey) throw new Error("missing_firebase_api_key");
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${encodeURIComponent(apiKey)}`;
  const response = await requestJson(url, {
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
  if (!uid) throw new Error("missing_auth_uid");
  return { uid };
};

const deleteAuthUserBestEffort = async (uid) => {
  const localId = String(uid || "").trim();
  if (!localId) return;
  try {
    if (!PROJECT_ID) return;
    const token = await getGoogleAccessToken({ scope: CLOUD_PLATFORM_SCOPE });
    const accessToken = String(token?.accessToken || "");
    if (!accessToken) return;
    await requestJson(`https://identitytoolkit.googleapis.com/v1/projects/${encodeURIComponent(PROJECT_ID)}/accounts:delete`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: { localId },
    });
  } catch (error) {
    console.warn("[admin-students-import] auth rollback failed", { uid: localId, message: error?.message || String(error || "") });
  }
};

const createStudentFirestoreDoc = async ({ uid, name, email, adminId }) => {
  const doc = buildDefaultStudentDocument({ uid, name, email, adminId });
  const write = {
    update: {
      name: `${FIRESTORE_BASE}/users/${encodeURIComponent(uid)}`,
      fields: encodeFields(doc).fields,
    },
  };
  const response = await commitWritesAsAdmin({ writes: [write] });
  if (!response.ok) {
    const error = new Error("firestore_create_student_failed");
    error.status = response.status;
    error.details = response.data || response.text || null;
    throw error;
  }
  return doc;
};

const errorReason = (error) => {
  const code = String(error?.code || error?.message || "").trim();
  if (/EMAIL_EXISTS|email.*exists|already/i.test(code)) return "email_already_exists";
  if (/INVALID_EMAIL/i.test(code)) return "invalid_email";
  if (/WEAK_PASSWORD/i.test(code)) return "weak_password";
  if (/OPERATION_NOT_ALLOWED/i.test(code)) return "password_provider_disabled";
  return code || "unknown_error";
};

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    sendJson(res, 405, { error: "method_not_allowed" });
    return;
  }

  const auth = await resolveAdminRequestAuth(req, { logPrefix: "[admin-students-import]" });
  if (!auth.ok) {
    sendJson(res, auth.status, auth.body);
    return;
  }
  if (String(auth.session?.role || "") !== "admin") {
    sendJson(res, 403, { error: "forbidden" });
    return;
  }

  let body;
  try {
    body = await readJsonBody(req);
  } catch (error) {
    sendJson(res, 400, { error: "invalid_json" });
    return;
  }

  const rows = Array.isArray(body?.rows)
    ? body.rows.map((row, index) => ({ lineNumber: Number(row?.lineNumber) || index + 1, name: normalizeName(row?.name || row?.nome), email: normalizeEmail(row?.email) }))
    : parseStudentImportText(body?.text || "");

  if (!rows.length) {
    sendJson(res, 400, { error: "empty_import" });
    return;
  }
  if (rows.length > 300) {
    sendJson(res, 400, { error: "too_many_rows", limit: 300 });
    return;
  }

  const summary = { created: 0, skipped: 0, failed: 0, results: [] };
  const seenInFile = new Set();
  let existingEmails = new Set();
  try {
    existingEmails = await listExistingStudentEmails();
  } catch (error) {
    console.warn("[admin-students-import] existing email precheck failed", error);
  }

  for (const row of rows) {
    const lineNumber = Number(row.lineNumber) || 0;
    const name = normalizeName(row.name);
    const email = normalizeEmail(row.email);
    if (!name || !email) {
      summary.failed += 1;
      summary.results.push({ lineNumber, name, email, status: "failed", reason: "missing_name_or_email" });
      continue;
    }
    if (!isValidEmail(email)) {
      summary.failed += 1;
      summary.results.push({ lineNumber, name, email, status: "failed", reason: "invalid_email" });
      continue;
    }
    if (seenInFile.has(email) || existingEmails.has(email)) {
      summary.skipped += 1;
      summary.results.push({ lineNumber, name, email, status: "skipped", reason: "email_already_exists" });
      continue;
    }
    seenInFile.add(email);

    let uid = "";
    try {
      const createdAuth = await createAuthUserWithPassword({ email, password: DEFAULT_PASSWORD, displayName: name });
      uid = createdAuth.uid;
      await createStudentFirestoreDoc({ uid, name, email, adminId: auth.session.sub });
      existingEmails.add(email);
      summary.created += 1;
      summary.results.push({ lineNumber, name, email, uid, status: "created" });
      syncStudentMirrorToSupabase(uid).catch((syncError) => {
        console.warn("[admin-students-import] student mirror sync failed", { uid, message: syncError?.message || String(syncError || "") });
      });
    } catch (error) {
      if (uid) await deleteAuthUserBestEffort(uid);
      const reason = errorReason(error);
      if (reason === "email_already_exists") {
        summary.skipped += 1;
        existingEmails.add(email);
        summary.results.push({ lineNumber, name, email, status: "skipped", reason });
      } else {
        summary.failed += 1;
        summary.results.push({ lineNumber, name, email, status: "failed", reason });
      }
    }
  }

  sendJson(res, 200, { ok: true, defaultPassword: DEFAULT_PASSWORD, summary });
};

module.exports._private = {
  parseStudentImportText,
  buildDefaultStudentDocument,
  isValidEmail,
};
