const { getSessionFromRequest } = require("../_lib/session");
const { verifyFirebaseIdToken } = require("../_lib/firebase-id-token");
const { getBearerTokenFromRequest, PROJECT_ID, encodeFields } = require("./_lib/firestore-rest");
const { commitWritesAsAdmin, getDocumentAsAdmin } = require("./_lib/firestore-admin");
const {
  parseJsonBodyWithLimit,
  decodeBase64ImagePayload,
  transformProfilePhotoBuffer,
  uploadBufferToFirebaseStorage,
  deleteFirebaseStorageObject,
} = require("./_lib/profile-photo");

const USERS_COLLECTION = "users";
const ALLOWED_ROLES = new Set(["admin", "growth"]);

const sendJson = (res, statusCode, payload) => {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload || {}));
};

const normalizeRole = (value) => {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "admin" || raw === "administrador") return "admin";
  if (raw === "growth") return "growth";
  return "";
};

const buildUserDocumentName = (uid) => {
  const safeUid = String(uid || "").trim();
  if (!PROJECT_ID || !safeUid) throw new Error("invalid_user_doc_name");
  return `projects/${PROJECT_ID}/databases/(default)/documents/${USERS_COLLECTION}/${encodeURIComponent(safeUid)}`;
};

const buildAuditDocumentName = (id) => {
  const safeId = String(id || "").trim();
  if (!PROJECT_ID || !safeId) throw new Error("invalid_audit_doc_name");
  return `projects/${PROJECT_ID}/databases/(default)/documents/adminAuditEvents/${encodeURIComponent(safeId)}`;
};

const isOwnAvatarStoragePath = (uid, objectPath) => {
  const safeUid = String(uid || "").trim();
  const safePath = String(objectPath || "").trim();
  if (!safeUid || !safePath) return false;
  return (
    safePath.startsWith(`profile_avatars/${safeUid}/`) ||
    safePath.startsWith(`admin_profiles/${safeUid}/`) ||
    safePath.startsWith(`growth_profiles/${safeUid}/`)
  );
};

const buildUserPatchWrite = (uid, patch) => ({
  update: {
    name: buildUserDocumentName(uid),
    fields: encodeFields(patch).fields,
  },
  updateMask: {
    fieldPaths: Object.keys(patch),
  },
  currentDocument: {
    exists: true,
  },
});

const buildAuditWrite = ({ type, uid, actorId, timestamp }) => {
  const id = `${type}_${uid}_${Date.now()}`;
  return {
    update: {
      name: buildAuditDocumentName(id),
      fields: encodeFields({
        id,
        type,
        userId: uid,
        actorUserId: actorId,
        timestamp,
        createdAt: timestamp,
      }).fields,
    },
  };
};

const parseBody = async (req) => parseJsonBodyWithLimit(req, { maxBytes: 8 * 1024 * 1024 });

const mapPhotoError = (error) => {
  const code = String(error?.code || error?.message || "").trim();
  if (code === "payload_too_large") return [413, { error: "payload_too_large" }];
  if (code === "image_too_large") return [413, { error: "image_too_large", maxBytes: error.maxBytes || undefined }];
  if (code === "unsupported_image_type") return [415, { error: "unsupported_image_type" }];
  if (["invalid_image_dimensions", "empty_image_payload", "invalid_image_base64", "missing_image_data"].includes(code)) {
    return [400, { error: code }];
  }
  return [500, { error: "profile_avatar_failed", code }];
};

const createHandler = ({
  getSession = getSessionFromRequest,
  getBearerToken = getBearerTokenFromRequest,
  verifyToken = verifyFirebaseIdToken,
  readProfile = getDocumentAsAdmin,
  commitWrites = commitWritesAsAdmin,
  parseRequestBody = parseBody,
  decodeImage = decodeBase64ImagePayload,
  transformImage = transformProfilePhotoBuffer,
  uploadObject = uploadBufferToFirebaseStorage,
  deleteObject = deleteFirebaseStorageObject,
  now = () => new Date(),
  randomSuffix = () => Math.random().toString(36).slice(2, 10),
} = {}) => async (req, res) => {
  if (!["POST", "DELETE"].includes(req.method)) {
    res.setHeader("Allow", "POST, DELETE");
    sendJson(res, 405, { error: "method_not_allowed" });
    return;
  }

  const session = getSession(req);
  if (!session) {
    sendJson(res, 401, { error: "unauthorized" });
    return;
  }
  const role = normalizeRole(session.role);
  if (!ALLOWED_ROLES.has(role)) {
    sendJson(res, 403, { error: "forbidden" });
    return;
  }

  const uid = String(session.sub || "").trim();
  const idToken = getBearerToken(req);
  if (!uid || !idToken) {
    sendJson(res, 401, { error: "unauthorized" });
    return;
  }

  try {
    const decoded = await verifyToken(idToken);
    if (String(decoded?.uid || "").trim() !== uid) {
      sendJson(res, 401, { error: "invalid_credentials" });
      return;
    }
  } catch {
    sendJson(res, 401, { error: "invalid_credentials" });
    return;
  }

  let profile = {};
  try {
    profile = await readProfile(`users/${encodeURIComponent(uid)}`);
  } catch (error) {
    console.error("[api] profile avatar read failed", { code: error?.code || error?.message || "profile_read_failed" });
    sendJson(res, 500, { error: "profile_read_failed" });
    return;
  }

  if (req.method === "DELETE") {
    const oldPath = String(profile?.photoStoragePath || "").trim();
    const timestamp = now().toISOString();
    const patch = {
      photoURL: null,
      photoStoragePath: null,
      avatarUpdatedAt: timestamp,
      atualizadoEm: timestamp,
      updatedAt: timestamp,
    };
    const result = await commitWrites({
      writes: [
        buildUserPatchWrite(uid, patch),
        buildAuditWrite({ type: "profile_avatar_removed", uid, actorId: uid, timestamp }),
      ],
    });
    if (!result.ok) {
      console.error("[api] avatar_profile_update_failed", { uid, status: result.status, action: "remove" });
      sendJson(res, result.status || 500, { error: "avatar_profile_update_failed" });
      return;
    }
    if (isOwnAvatarStoragePath(uid, oldPath)) {
      try {
        await deleteObject({ objectPath: oldPath });
      } catch (error) {
        console.error("[api] avatar_remove_failed", { uid, code: error?.code || error?.message || "storage_delete_failed" });
      }
    }
    sendJson(res, 200, { ok: true, photoURL: "", photoStoragePath: "", avatarUpdatedAt: timestamp });
    return;
  }

  let body;
  try {
    body = await parseRequestBody(req);
  } catch (error) {
    const [status, payload] = mapPhotoError(error);
    sendJson(res, status === 500 ? 400 : status, status === 500 ? { error: "invalid_json" } : payload);
    return;
  }

  let upload = null;
  const oldPath = String(profile?.photoStoragePath || "").trim();
  try {
    const inputBuffer = decodeImage(body?.dataBase64);
    const transformed = await transformImage(inputBuffer);
    const timestamp = now().toISOString();
    const storagePath = `profile_avatars/${uid}/${Date.now()}_${randomSuffix()}.${transformed.outputExtension}`;
    upload = await uploadObject({
      objectPath: storagePath,
      buffer: transformed.outputBuffer,
      contentType: transformed.outputMime,
    });

    const patch = {
      photoURL: upload.url,
      photoStoragePath: storagePath,
      avatarUpdatedAt: timestamp,
      atualizadoEm: timestamp,
      updatedAt: timestamp,
    };
    const result = await commitWrites({
      writes: [
        buildUserPatchWrite(uid, patch),
        buildAuditWrite({ type: "profile_avatar_updated", uid, actorId: uid, timestamp }),
      ],
    });
    if (!result.ok) {
      try {
        await deleteObject({ objectPath: storagePath });
      } catch (cleanupError) {
        console.error("[api] avatar_upload_cleanup_failed", { uid, code: cleanupError?.code || cleanupError?.message || "storage_delete_failed" });
      }
      console.error("[api] avatar_profile_update_failed", { uid, status: result.status, action: "upload" });
      sendJson(res, result.status || 500, { error: "avatar_profile_update_failed" });
      return;
    }

    if (isOwnAvatarStoragePath(uid, oldPath) && oldPath !== storagePath) {
      try {
        await deleteObject({ objectPath: oldPath });
      } catch (deleteError) {
        console.error("[api] avatar_remove_failed", { uid, code: deleteError?.code || deleteError?.message || "storage_delete_failed" });
      }
    }

    sendJson(res, 200, {
      ok: true,
      photoURL: upload.url,
      photoStoragePath: storagePath,
      avatarUpdatedAt: timestamp,
      contentType: transformed.outputMime,
      width: 400,
      height: 400,
    });
  } catch (error) {
    const [status, payload] = mapPhotoError(error);
    if (status >= 500) {
      console.error("[api] avatar_upload_failed", { uid, code: error?.code || error?.message || "profile_avatar_failed" });
    }
    sendJson(res, status, payload);
  }
};

module.exports = createHandler();
module.exports._test = {
  createHandler,
  isOwnAvatarStoragePath,
  normalizeRole,
};
