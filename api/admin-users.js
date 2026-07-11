const { readJsonBody, sendJson } = require("../_lib/http");
const { getSessionFromRequest } = require("../_lib/session");
const { verifyFirebaseIdToken } = require("../_lib/firebase-id-token");
const { getBearerTokenFromRequest, firestorePatchDocument } = require("./_lib/firestore-rest");

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

    if (!uid || !name || !role) {
      sendJson(res, 400, { error: "invalid_request" });
      return;
    }

    // This endpoint previously synced a local JSON scheduling store. Scheduling is now Firestore-backed,
    // and the source of truth for user state is the `users/{uid}` document written from the admin UI.
    // Keep this endpoint as a safe no-op for backward compatibility with older front-end calls.
    sendJson(res, 200, { ok: true });
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
    const result = await firestorePatchDocument({
      docPath: `users/${uid}`,
      idToken,
      data: cleanPatch,
      updateMaskPaths: Object.keys(cleanPatch),
    });
    if (!result.ok) {
      sendJson(res, result.status || 500, { error: "firestore_patch_failed" });
      return;
    }
    sendJson(res, 200, { ok: true });
  } catch (error) {
    console.error("[api] admin-users patch failed", error);
    sendJson(res, 500, { error: "admin_users_patch_failed" });
  }
};
