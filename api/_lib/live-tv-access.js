const crypto = require("crypto");

const { getDocumentAsAdmin, listCollectionAsAdmin, commitWritesAsAdmin } = require("./firestore-admin");
const { signJwt, verifyJwt, parseCookies } = require("./session");

const safeString = (value) => (value == null ? "" : String(value).trim());
const hashSecret = (value) => crypto.createHash("sha256").update(String(value || ""), "utf8").digest("hex");

const buildCookie = (name, value, { maxAgeSeconds = 90 * 24 * 60 * 60, secure = false, path = "/" } = {}) => {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    `Path=${path}`,
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${Math.max(0, Number(maxAgeSeconds) || 0)}`,
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
};

const buildFirestorePatch = async ({ collection, docId, data, updateMaskPaths } = {}) => {
  const safeCollection = safeString(collection);
  const safeDocId = safeString(docId);
  if (!safeCollection || !safeDocId) throw new Error("missing_collection_or_doc_id");
  return commitWritesAsAdmin({
    writes: [
      {
        update: {
          name: `projects/${process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || ""}/databases/(default)/documents/${safeCollection}/${encodeURIComponent(safeDocId)}`,
          fields: require("./firestore-rest").encodeFields(data).fields || {},
        },
        updateMask: { fieldPaths: Array.isArray(updateMaskPaths) ? updateMaskPaths.filter(Boolean) : Object.keys(data || {}) },
      },
    ],
  });
};

function createLiveTvAccess({
  collection,
  cookieName,
  cookieScope,
  cookieMaxAgeSeconds = 90 * 24 * 60 * 60,
  defaultLabel = "TV",
} = {}) {
  const safeCollection = safeString(collection);
  const safeCookieName = safeString(cookieName);
  const safeCookieScope = safeString(cookieScope);

  const clearCookie = ({ secure = false, path = "/" } = {}) =>
    buildCookie(safeCookieName, "", { maxAgeSeconds: 0, secure, path });

  const buildReadCookie = ({ tokenId } = {}) => {
    const now = Math.floor(Date.now() / 1000);
    return signJwt({
      scope: safeCookieScope,
      tokenId: safeString(tokenId),
      iat: now,
      exp: now + cookieMaxAgeSeconds,
    });
  };

  const parseReadCookie = (req) => {
    const cookies = parseCookies(req);
    const raw = cookies[safeCookieName];
    if (!raw) return null;
    const payload = verifyJwt(raw);
    if (!payload || payload.scope !== safeCookieScope || !safeString(payload.tokenId)) return null;
    return payload;
  };

  const parseEntryToken = (rawToken) => {
    const raw = safeString(rawToken);
    const dot = raw.indexOf(".");
    if (dot <= 0 || dot >= raw.length - 1) return null;
    return { tokenId: raw.slice(0, dot), secret: raw.slice(dot + 1) };
  };

  const validateEntryToken = async (rawToken) => {
    const parsed = parseEntryToken(rawToken);
    if (!parsed) return { ok: false, error: "invalid_token_format", status: 401 };
    try {
      const doc = await getDocumentAsAdmin(`${safeCollection}/${encodeURIComponent(parsed.tokenId)}`);
      const active = doc?.active !== false && !doc?.revokedAt;
      const expiresAt = safeString(doc?.expiresAt);
      const expired = expiresAt ? Date.parse(expiresAt) < Date.now() : false;
      if (!active || expired) return { ok: false, error: "token_revoked", status: 401 };
      if (safeString(doc?.secretHash) !== hashSecret(parsed.secret)) return { ok: false, error: "invalid_token", status: 401 };
      await buildFirestorePatch({
        collection: safeCollection,
        docId: parsed.tokenId,
        data: { lastUsedAt: new Date() },
        updateMaskPaths: ["lastUsedAt"],
      }).catch(() => {});
      return { ok: true, tokenId: parsed.tokenId, doc };
    } catch (error) {
      if (Number(error?.status) === 404) return { ok: false, error: "token_not_found", status: 401 };
      throw error;
    }
  };

  const validateCookieViewer = async (req) => {
    const payload = parseReadCookie(req);
    if (!payload) return { ok: false, error: "missing_cookie", status: 401 };
    try {
      const doc = await getDocumentAsAdmin(`${safeCollection}/${encodeURIComponent(payload.tokenId)}`);
      const active = doc?.active !== false && !doc?.revokedAt;
      const expiresAt = safeString(doc?.expiresAt);
      const expired = expiresAt ? Date.parse(expiresAt) < Date.now() : false;
      if (!active || expired) return { ok: false, error: "token_revoked", status: 401 };
      return { ok: true, tokenId: payload.tokenId, doc };
    } catch (error) {
      if (Number(error?.status) === 404) return { ok: false, error: "token_not_found", status: 401 };
      throw error;
    }
  };

  const createAccessTokenRecord = async ({ label = "", expiresAt = "" } = {}) => {
    const tokenId = `tv_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
    const secret = crypto.randomBytes(24).toString("hex");
    const now = new Date();
    const data = {
      label: safeString(label) || defaultLabel,
      active: true,
      secretHash: hashSecret(secret),
      createdAt: now,
      updatedAt: now,
      revokedAt: null,
      lastUsedAt: null,
      expiresAt: safeString(expiresAt) || null,
    };
    const write = await buildFirestorePatch({
      collection: safeCollection,
      docId: tokenId,
      data,
      updateMaskPaths: Object.keys(data),
    });
    if (!write?.ok) {
      const error = new Error("live_tv_token_create_failed");
      error.code = "live_tv_token_create_failed";
      error.status = write?.status || 500;
      error.details = write?.data || write?.text || null;
      throw error;
    }
    return {
      tokenId,
      token: `${tokenId}.${secret}`,
      data,
    };
  };

  const listAccessTokens = async () => {
    const rows = await listCollectionAsAdmin(safeCollection, { pageSize: 200 });
    return rows.map((row) => ({
      tokenId: safeString(row.firestoreDocId || row.id),
      label: safeString(row.label),
      active: row.active !== false && !row.revokedAt,
      createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : safeString(row.createdAt),
      updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : safeString(row.updatedAt),
      expiresAt: row.expiresAt instanceof Date ? row.expiresAt.toISOString() : safeString(row.expiresAt),
      revokedAt: row.revokedAt instanceof Date ? row.revokedAt.toISOString() : safeString(row.revokedAt),
      lastUsedAt: row.lastUsedAt instanceof Date ? row.lastUsedAt.toISOString() : safeString(row.lastUsedAt),
    }));
  };

  const revokeAccessToken = async ({ tokenId } = {}) => {
    const id = safeString(tokenId);
    if (!id) throw new Error("missing_token_id");
    const now = new Date();
    const write = await buildFirestorePatch({
      collection: safeCollection,
      docId: id,
      data: { active: false, revokedAt: now, updatedAt: now },
      updateMaskPaths: ["active", "revokedAt", "updatedAt"],
    });
    if (!write?.ok) {
      const error = new Error("live_tv_token_revoke_failed");
      error.code = "live_tv_token_revoke_failed";
      error.status = write?.status || 500;
      error.details = write?.data || write?.text || null;
      throw error;
    }
    return { ok: true };
  };

  return {
    buildCookie,
    clearCookie,
    buildReadCookie,
    parseReadCookie,
    validateEntryToken,
    validateCookieViewer,
    createAccessTokenRecord,
    listAccessTokens,
    revokeAccessToken,
  };
}

module.exports = {
  buildCookie,
  createLiveTvAccess,
};
