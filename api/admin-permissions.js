const { readJsonBody, sendJson } = require("./_lib/http");
const { resolveAdminRequestAuth } = require("./_lib/admin-request-auth");
const { listCollectionAsAdmin } = require("./_lib/firestore-admin");
const {
  ADMIN_PERMISSION_REGISTRY,
  adminAccessPayloadForUser,
  backfillExistingAdminPermissions,
  isSuperAdminUser,
  normalizeAdminPermissions,
  saveAdminPermissions,
} = require("./_lib/admin-permissions");

const normalizeRole = (value) => {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "admin" || raw === "administrador") return "admin";
  return raw;
};

const adminRow = (row = {}) => {
  const id = String(row?.firestoreDocId || row?.id || row?.uid || "").trim();
  if (!id || normalizeRole(row?.role || row?.tipo || row?.type) !== "admin") return null;
  const access = adminAccessPayloadForUser(row);
  return {
    id,
    uid: id,
    role: "admin",
    tipo: "admin",
    nome: String(row?.nome || row?.name || row?.displayName || row?.email || "Administrador").trim(),
    email: String(row?.email || "").trim().toLowerCase(),
    criadoEm: row?.criadoEm || row?.createdAt || row?.created_at || null,
    ativo: row?.ativo !== false,
    isSuperAdmin: row?.isSuperAdmin === true,
    adminPermissions: access.adminPermissions,
    adminPermissionsVersion: access.adminPermissionsVersion,
  };
};

const loadAdmins = async () => {
  const rows = await listCollectionAsAdmin("users", { pageSize: 1500 });
  return rows.map(adminRow).filter(Boolean).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
};

module.exports = async (req, res) => {
  const auth = await resolveAdminRequestAuth(req, { logPrefix: "[admin-permissions]" });
  if (!auth.ok) return sendJson(res, auth.status, auth.body);
  if (String(auth.session?.role || "") !== "admin") return sendJson(res, 403, { error: "forbidden" });

  const requester = auth.profile?.user || {};
  if (!isSuperAdminUser(requester)) return sendJson(res, 403, { error: "super_admin_only" });

  if (req.method === "GET") {
    try {
      const migration = await backfillExistingAdminPermissions({ actorUserId: auth.session.sub });
      const admins = await loadAdmins();
      return sendJson(res, 200, {
        ok: true,
        registry: ADMIN_PERMISSION_REGISTRY,
        admins,
        migration,
      });
    } catch (error) {
      console.error("[admin-permissions] list failed", error);
      return sendJson(res, 500, { error: "admin_permissions_list_failed" });
    }
  }

  if (req.method === "PATCH") {
    let body;
    try {
      body = await readJsonBody(req);
    } catch {
      return sendJson(res, 400, { error: "invalid_json" });
    }
    const targetUid = String(body?.uid || body?.targetUserId || "").trim();
    const permissions = normalizeAdminPermissions(body?.permissions);
    if (!targetUid) return sendJson(res, 400, { error: "missing_target" });
    if (!Array.isArray(body?.permissions)) return sendJson(res, 400, { error: "invalid_permissions" });
    if (permissions.length !== body.permissions.length) return sendJson(res, 400, { error: "invalid_permission_key" });

    try {
      const saved = await saveAdminPermissions({ actorUserId: auth.session.sub, targetUid, permissions });
      const admins = await loadAdmins();
      return sendJson(res, 200, { ok: true, ...saved, admins });
    } catch (error) {
      console.error("[admin-permissions] save failed", { message: error?.message, status: error?.status });
      return sendJson(res, error?.status || 500, { error: error?.message || "admin_permissions_save_failed" });
    }
  }

  res.setHeader("Allow", "GET, PATCH");
  return sendJson(res, 405, { error: "method_not_allowed" });
};
