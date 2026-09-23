const { readJsonBody, sendJson } = require("../_lib/http");
const { requireAdminPermission } = require("./_lib/admin-permissions");
const { createAccessTokenRecord, listAccessTokens, revokeAccessToken } = require("./_lib/crm-live");

const normalizeRole = (value) => {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "admin" || raw === "administrador") return "admin";
  if (raw === "growth") return "growth";
  return "";
};

const requireAdmin = async (req, res) => {
  const guard = await requireAdminPermission(req, "comercial.crmLive.update");
  if (!guard.ok) {
    sendJson(res, guard.status || 403, guard.body || { error: "forbidden" });
    return null;
  }
  if (normalizeRole(guard.session?.role) !== "admin") {
    sendJson(res, 403, { error: "forbidden" });
    return null;
  }
  return guard.session;
};

module.exports = async (req, res) => {
  const session = await requireAdmin(req, res);
  if (!session) return;

  if (req.method === "GET" || req.method === "HEAD") {
    try {
      const items = await listAccessTokens();
      return sendJson(res, 200, { items });
    } catch (error) {
      console.error("[crm-live-access] list failed", error);
      return sendJson(res, 500, { error: "crm_live_access_list_failed" });
    }
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, HEAD, POST");
    return sendJson(res, 405, { error: "method_not_allowed" });
  }

  try {
    const body = await readJsonBody(req);
    const action = String(body?.action || "create").trim().toLowerCase();
    if (action === "revoke") {
      await revokeAccessToken({ tokenId: body?.tokenId });
      return sendJson(res, 200, { ok: true });
    }
    const created = await createAccessTokenRecord({
      label: body?.label,
      expiresAt: body?.expiresAt,
    });
    return sendJson(res, 200, {
      ok: true,
      tokenId: created.tokenId,
      token: created.token,
      accessUrl: `/tv/crm-live?token=${encodeURIComponent(created.token)}`,
    });
  } catch (error) {
    console.error("[crm-live-access] write failed", error);
    return sendJson(res, error?.status || 500, {
      error: error?.code || "crm_live_access_write_failed",
      message: error?.message || "crm_live_access_write_failed",
      details: error?.details || null,
      collection: "crmLiveAccessTokens",
      permissionModel: "firestore_admin_service_account",
    });
  }
};
