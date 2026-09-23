const { sendJson } = require("../_lib/http");
const { getSessionFromRequest } = require("../_lib/session");
const { getDocumentAsAdmin } = require("./_lib/firestore-admin");
const { normalizeCommercialRoles } = require("./_lib/commercial-permissions");
const { adminAccessPayloadForUser } = require("./_lib/admin-permissions");

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return sendJson(res, 405, { error: "method_not_allowed" });
  }

  const session = getSessionFromRequest(req);
  if (!session) {
    return sendJson(res, 401, { error: "unauthenticated" });
  }

  let lifecycle = null;
  if (session.role === 'student' && require('./_lib/retention-flags').isRetentionV2Enabled()) {
    try {
      const service = require('./_lib/student-lifecycle');
      lifecycle = await service.getForStudent(session.sub);
      if (!service.isActiveOn(lifecycle,new Date())) return sendJson(res,403,{error:'student_service_ended'});
    } catch (error) { return sendJson(res,error.status || 503,{error:error.code || 'lifecycle_unavailable'}); }
  }
  let commercialRoles = normalizeCommercialRoles(session.commercialRoles);
  let adminAccess = {
    isSuperAdmin: session.isSuperAdmin === true,
    adminPermissions: Array.isArray(session.adminPermissions) ? session.adminPermissions : [],
    adminPermissionsVersion: Number(session.adminPermissionsVersion || 0) || 0,
  };
  if (session.role === "growth" || session.role === "admin") {
    try {
      const row = await getDocumentAsAdmin(`users/${encodeURIComponent(String(session.sub || ""))}`);
      if (session.role === "growth") commercialRoles = normalizeCommercialRoles(row?.commercialRoles);
      if (session.role === "admin") adminAccess = adminAccessPayloadForUser(row);
    } catch {
      // Keep session value if the user document cannot be read.
    }
  }
  return sendJson(res, 200, { lifecycle: lifecycle ? {subscriptions:lifecycle.subscriptions} : null,
    user: {
      id: String(session.sub || ""),
      role: String(session.role || ""),
      name: String(session.name || ""),
      email: String(session.email || ""),
      commercialRoles,
      isSuperAdmin: adminAccess.isSuperAdmin,
      adminPermissions: adminAccess.adminPermissions,
      adminPermissionsVersion: adminAccess.adminPermissionsVersion,
    },
  });
};
