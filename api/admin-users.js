const { readJsonBody, sendJson } = require("../_lib/http");
const { getSessionFromRequest } = require("../_lib/session");
const { verifyFirebaseIdToken } = require("../_lib/firebase-id-token");
const { getBearerTokenFromRequest, PROJECT_ID, encodeFields } = require("./_lib/firestore-rest");
const { commitWritesAsAdmin } = require("./_lib/firestore-admin");
const { createAuthUserWithPassword, deleteAuthUserBestEffort } = require("./_lib/firebase-auth-admin");
const { syncStudentMirrorToSupabase } = require("./_lib/student-mirror-sync");

const normalizeRole = (value) => {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "teacher" || raw === "professor") return "teacher";
  if (raw === "student" || raw === "aluno") return "student";
  if (raw === "growth") return "growth";
  if (raw === "finance" || raw === "financeiro") return "financeiro";
  return "";
};

const isPlainPatchObject = (value) => {
  if (!value || typeof value !== "object") return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
};

const sanitizePatchValue = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizePatchValue(item)).filter((item) => item !== undefined);
  }
  if (!isPlainPatchObject(value)) {
    return value === undefined ? undefined : value;
  }
  return Object.fromEntries(
    Object.entries(value)
      .map(([key, entryValue]) => [key, sanitizePatchValue(entryValue)])
      .filter(([, entryValue]) => entryValue !== undefined)
  );
};

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

const normalizeText = (value) => String(value || "").trim();

const normalizeEmail = (value) => normalizeText(value).toLowerCase();

const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value));

const buildCreateUserDocument = ({ uid, role, name, email, adminId, extra = {} }) => {
  const nowIso = new Date().toISOString();
  const base = {
    ...sanitizePatchValue(extra),
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
    tipo: role,
    role,
    ativo: true,
    status: "ativo",
    createdBy: adminId || "",
    criadoEm: nowIso,
    createdAt: nowIso,
    atualizadoEm: nowIso,
    updatedAt: nowIso,
    source: "admin_create_user",
  };
  if (role === "student") {
    base.telefone = normalizeText(base.telefone);
    base.plano = normalizeText(base.plano);
    base.professorId = normalizeText(base.professorId);
    base.professorNome = normalizeText(base.professorNome);
    base.turma = normalizeText(base.turma);
    base.nivelInglesAtual = normalizeText(base.nivelInglesAtual);
    base.objetivoPrincipal = normalizeText(base.objetivoPrincipal);
    base.observacoesPedagogicas = normalizeText(base.observacoesPedagogicas);
  }
  return base;
};

const createUserDocAsAdmin = async ({ uid, data }) =>
  commitWritesAsAdmin({
    writes: [
      {
        update: {
          name: buildUserCommitDocumentName(uid),
          fields: encodeFields(data).fields,
        },
        currentDocument: {
          exists: false,
        },
      },
    ],
  });

const extractBackendErrorDetail = (error) => {
  const detail = error?.details;
  if (detail && typeof detail === "object") {
    const nested = detail.error && typeof detail.error === "object" ? detail.error : detail;
    const message = String(nested.message || "").trim();
    const status = String(nested.status || "").trim();
    const code = nested.code ? String(nested.code).trim() : "";
    if (message) return [status || code, message].filter(Boolean).join(": ");
  }
  if (typeof detail === "string" && detail.trim()) return detail.trim();
  return String(error?.message || error?.code || "").trim();
};

const patchUserAsAdmin = async ({ uid, data }) => {
  const cleanData = data && typeof data === "object" ? data : {};
  const updateMask = Object.keys(cleanData);
  if (!updateMask.length) {
    const error = new Error("empty_patch");
    error.code = "empty_patch";
    throw error;
  }
  return commitWritesAsAdmin({
    writes: [
      {
        update: {
          name: buildUserCommitDocumentName(uid),
          fields: encodeFields(cleanData).fields,
        },
        updateMask: {
          fieldPaths: updateMask,
        },
        currentDocument: {
          exists: true,
        },
      },
    ],
  });
};

module.exports = async (req, res) => {
  const session = getSessionFromRequest(req);
  if (!session) {
    sendJson(res, 401, { error: "unauthorized" });
    return;
  }

  if (String(session.role || "") !== "admin") {
    sendJson(res, 403, { error: "forbidden" });
    return;
  }

  const adminId = String(session.sub || "");
  const idToken = getBearerTokenFromRequest(req);
  if (!adminId || !idToken) {
    sendJson(res, 401, { error: "unauthorized" });
    return;
  }

  try {
    const decoded = await verifyFirebaseIdToken(idToken);
    if (decoded.uid !== adminId) {
      sendJson(res, 401, { error: "invalid_credentials" });
      return;
    }
  } catch (error) {
    sendJson(res, 401, { error: "invalid_credentials" });
    return;
  }

  if (req.method === "POST") {
    let body;
    try {
      body = await readJsonBody(req);
    } catch (error) {
      sendJson(res, 400, { error: "invalid_json" });
      return;
    }

    const uid = String(body?.uid || "").trim();
    const name = String(body?.name || "").trim();
    const role = normalizeRole(body?.role);
    const action = String(body?.action || "").trim().toLowerCase();

    if (action === "sync_mirror") {
      if (!uid) {
        sendJson(res, 400, { error: "invalid_request" });
        return;
      }
      const sync = await syncStudentMirrorToSupabase(uid);
      sendJson(res, sync.ok ? 200 : 409, { ok: sync.ok, sync });
      return;
    }

    if (action === "create_user") {
      const email = normalizeEmail(body?.email);
      const password = String(body?.password || "");
      const extra = body?.extra && typeof body.extra === "object" ? body.extra : {};

      if (!name || !email || !role || !password) {
        sendJson(res, 400, { error: "invalid_request", errorDetail: "Nome, e-mail, perfil e senha são obrigatórios." });
        return;
      }
      if (!isValidEmail(email)) {
        sendJson(res, 400, { error: "invalid_email", errorDetail: "E-mail inválido." });
        return;
      }
      if (password.length < 6) {
        sendJson(res, 400, { error: "weak_password", errorDetail: "Senha mínimo 6 caracteres." });
        return;
      }

      let createdUid = "";
      try {
        const createdAuth = await createAuthUserWithPassword({ email, password, displayName: name });
        createdUid = createdAuth.uid;
        const doc = buildCreateUserDocument({
          uid: createdUid,
          role,
          name,
          email,
          adminId,
          extra,
        });
        const writeResult = await createUserDocAsAdmin({ uid: createdUid, data: doc });
        if (!writeResult.ok) {
          const error = new Error("firestore_create_user_failed");
          error.code = "firestore_create_user_failed";
          error.status = writeResult.status;
          error.details = writeResult.data || writeResult.text || null;
          throw error;
        }
        let sync = null;
        if (role === "student") {
          syncStudentMirrorToSupabase(createdUid).catch((syncError) => {
            console.warn("[api] admin-users create mirror sync failed", {
              uid: createdUid,
              message: syncError?.message || String(syncError || ""),
            });
          });
        }
        sendJson(res, 200, { ok: true, uid: createdUid, user: doc, sync });
        return;
      } catch (error) {
        if (createdUid) await deleteAuthUserBestEffort(createdUid, { logPrefix: "[api] admin-users create" });
        const errorDetail = extractBackendErrorDetail(error);
        console.error("[api] admin-users create failed", {
          role,
          email,
          uid: createdUid,
          code: error?.code || "",
          status: error?.status || 0,
          errorDetail,
        });
        const code = String(error?.code || error?.message || "admin_user_create_failed");
        const status = Number(error?.status) || (/EMAIL_EXISTS/i.test(code) ? 409 : 500);
        sendJson(res, status, {
          error: "admin_user_create_failed",
          code,
          errorDetail: errorDetail || code,
          authStatus: error?.status || 0,
        });
        return;
      }
    }

    if (!uid || !name || !role) {
      sendJson(res, 400, { error: "invalid_request" });
      return;
    }

    // OWNERSHIP: cadastro=Firestore, operação=Supabase (contrato 2026-07-12)
    // Mantemos compatibilidade com chamadas legadas e sincronizamos o espelho
    // desnormalizado no Supabase a partir de users/{uid}.
    const sync = await syncStudentMirrorToSupabase(uid);
    sendJson(res, 200, { ok: true, sync });
    return;
  }

  if (req.method !== "PATCH") {
    res.setHeader("Allow", "POST, PATCH");
    sendJson(res, 405, { error: "method_not_allowed" });
    return;
  }

  let body;
  try {
    body = await readJsonBody(req);
  } catch (error) {
    sendJson(res, 400, { error: "invalid_json" });
    return;
  }

  const uid = String(body?.uid || "").trim();
  const patch = body?.patch && typeof body.patch === "object" ? body.patch : null;
  if (!uid || !patch) {
    sendJson(res, 400, { error: "invalid_request" });
    return;
  }

  const cleanPatch = sanitizePatchValue(patch);
  if (!cleanPatch || typeof cleanPatch !== "object" || !Object.keys(cleanPatch).length) {
    sendJson(res, 400, { error: "empty_patch" });
    return;
  }
  cleanPatch.atualizadoEm = new Date().toISOString();
  cleanPatch.updatedAt = cleanPatch.atualizadoEm;

  try {
    const result = await patchUserAsAdmin({ uid, data: cleanPatch });
    if (!result.ok) {
      const errorDetail = result.data?.error?.message || result.text || "firestore_patch_failed";
      console.warn("[api] admin-users Firestore patch failed", {
        uid,
        status: result.status,
        errorDetail,
      });
      sendJson(res, result.status || 500, {
        error: "firestore_patch_failed",
        errorDetail,
        firestoreStatus: result.status || 0,
      });
      return;
    }
    // OWNERSHIP: cadastro=Firestore, operação=Supabase (contrato 2026-07-12)
    const sync = await syncStudentMirrorToSupabase(uid);
    sendJson(res, 200, { ok: true, sync });
  } catch (error) {
    console.error("[api] admin-users patch failed", error);
    sendJson(res, 500, {
      error: "admin_users_patch_failed",
      errorDetail: error?.message || String(error || ""),
      code: error?.code || "",
    });
  }
};

module.exports._private = {
  buildCreateUserDocument,
  extractBackendErrorDetail,
  normalizeEmail,
};
