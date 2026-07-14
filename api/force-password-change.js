const { readJsonBody, sendJson } = require("../_lib/http");
const { resolveAdminRequestAuth } = require("./_lib/admin-request-auth");
const { commitWritesAsAdmin } = require("./_lib/firestore-admin");
const { FIRESTORE_BASE, encodeFields } = require("./_lib/firestore-rest");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    sendJson(res, 405, { error: "method_not_allowed" });
    return;
  }

  const auth = await resolveAdminRequestAuth(req, { logPrefix: "[force-password-change]" });
  if (!auth.ok) {
    sendJson(res, auth.status, auth.body);
    return;
  }

  let body;
  try {
    body = await readJsonBody(req);
  } catch (error) {
    sendJson(res, 400, { error: "invalid_json" });
    return;
  }

  const uid = String(auth.session?.sub || "").trim();
  const requestedUid = String(body?.uid || "").trim();
  if (!uid || (requestedUid && requestedUid !== uid)) {
    sendJson(res, 403, { error: "forbidden" });
    return;
  }

  const nowIso = new Date().toISOString();
  const patch = {
    forcePasswordChange: false,
    defaultPasswordIssued: false,
    passwordChangedAt: nowIso,
    atualizadoEm: nowIso,
    updatedAt: nowIso,
  };

  try {
    const response = await commitWritesAsAdmin({
      writes: [
        {
          update: {
            name: `${FIRESTORE_BASE}/users/${encodeURIComponent(uid)}`,
            fields: encodeFields(patch).fields,
          },
          updateMask: { fieldPaths: Object.keys(patch) },
        },
      ],
    });
    if (!response.ok) {
      sendJson(res, response.status || 500, { error: "force_password_patch_failed" });
      return;
    }
    sendJson(res, 200, { ok: true });
  } catch (error) {
    console.error("[force-password-change] patch failed", error);
    sendJson(res, 500, { error: "force_password_patch_failed" });
  }
};
