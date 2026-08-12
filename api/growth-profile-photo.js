const { getSessionFromRequest } = require("../_lib/session");
const { verifyFirebaseIdToken } = require("../_lib/firebase-id-token");
const { getBearerTokenFromRequest, PROJECT_ID, encodeFields } = require("./_lib/firestore-rest");
const { commitWritesAsAdmin } = require("./_lib/firestore-admin");
const {
  parseJsonBodyWithLimit,
  decodeBase64ImagePayload,
  transformProfilePhotoBuffer,
  uploadBufferToFirebaseStorage,
} = require("./_lib/profile-photo");

const USERS_COLLECTION = "users";

const sendJson = (res, statusCode, payload) => {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload || {}));
};

const normalizeRole = (value) => {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "growth") return "growth";
  if (raw === "admin" || raw === "administrador") return "admin";
  return "";
};

const buildUserDocumentName = (uid) => {
  const safeUid = String(uid || "").trim();
  if (!PROJECT_ID || !safeUid) throw new Error("invalid_user_doc_name");
  return `projects/${PROJECT_ID}/databases/(default)/documents/${USERS_COLLECTION}/${encodeURIComponent(safeUid)}`;
};

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    sendJson(res, 405, { error: "method_not_allowed" });
    return;
  }

  const session = getSessionFromRequest(req);
  if (!session) {
    sendJson(res, 401, { error: "unauthorized" });
    return;
  }
  const role = normalizeRole(session.role);
  if (role !== "growth") {
    sendJson(res, 403, { error: "forbidden" });
    return;
  }

  const uid = String(session.sub || "").trim();
  const idToken = getBearerTokenFromRequest(req);
  if (!uid || !idToken) {
    sendJson(res, 401, { error: "unauthorized" });
    return;
  }

  try {
    const decoded = await verifyFirebaseIdToken(idToken);
    if (String(decoded?.uid || "").trim() !== uid) {
      sendJson(res, 401, { error: "invalid_credentials" });
      return;
    }
  } catch (error) {
    sendJson(res, 401, { error: "invalid_credentials" });
    return;
  }

  let body;
  try {
    body = await parseJsonBodyWithLimit(req, { maxBytes: 8 * 1024 * 1024 });
  } catch (error) {
    if (error?.message === "payload_too_large") {
      sendJson(res, 413, { error: "payload_too_large" });
      return;
    }
    sendJson(res, 400, { error: "invalid_json" });
    return;
  }

  try {
    const inputBuffer = decodeBase64ImagePayload(body?.dataBase64);
    const transformed = await transformProfilePhotoBuffer(inputBuffer);
    const storagePath = `growth_profiles/${uid}/${Date.now()}_${Math.random().toString(36).slice(2, 10)}.${transformed.outputExtension}`;
    const upload = await uploadBufferToFirebaseStorage({
      objectPath: storagePath,
      buffer: transformed.outputBuffer,
      contentType: transformed.outputMime,
    });

    const nowIso = new Date().toISOString();
    const patch = {
      photoURL: upload.url,
      photoStoragePath: storagePath,
      atualizadoEm: nowIso,
      updatedAt: nowIso,
    };
    const result = await commitWritesAsAdmin({
      writes: [
        {
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
        },
      ],
    });
    if (!result.ok) {
      sendJson(res, result.status || 500, {
        error: "profile_photo_patch_failed",
        details: result.data || result.text || null,
      });
      return;
    }

    sendJson(res, 200, {
      ok: true,
      photoURL: upload.url,
      photoStoragePath: storagePath,
      contentType: transformed.outputMime,
      width: 400,
      height: 400,
    });
  } catch (error) {
    const code = String(error?.code || error?.message || "").trim();
    if (code === "image_too_large") {
      sendJson(res, 413, { error: "image_too_large", maxBytes: error.maxBytes || undefined });
      return;
    }
    if (code === "unsupported_image_type") {
      sendJson(res, 415, { error: "unsupported_image_type" });
      return;
    }
    if (code === "invalid_image_dimensions" || code === "empty_image_payload" || code === "invalid_image_base64" || code === "missing_image_data") {
      sendJson(res, 400, { error: code });
      return;
    }
    console.error("[api] growth-profile-photo failed", error);
    sendJson(res, 500, {
      error: "growth_profile_photo_failed",
      details: error?.details || error?.message || null,
      code: error?.code || "",
    });
  }
};
