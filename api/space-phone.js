const { readJsonBody, sendJson } = require("./_lib/http");
const { resolveAdminRequestAuth } = require("./_lib/admin-request-auth");
const { requireResolvedAdminPermission } = require("./_lib/admin-permissions");
const { getCommercialPermissions } = require("./_lib/commercial-permissions");
const { supabaseFetch } = require("./_lib/supabase-rest");
const phone = require("./_lib/space-phone");

const createHandler = ({
  authResolver = resolveAdminRequestAuth,
  permissionResolver = requireResolvedAdminPermission,
  request = supabaseFetch,
} = {}) => async (req, res) => {
  if (!["GET", "POST", "PATCH", "HEAD"].includes(req.method)) {
    res.setHeader("Allow", "GET, POST, PATCH, HEAD");
    return sendJson(res, 405, { error: "method_not_allowed" });
  }
  if (req.method === "HEAD") return sendJson(res, 200, {});

  const auth = await authResolver(req, { logPrefix: "[space-phone]" });
  if (!auth.ok) return sendJson(res, auth.status, auth.body);

  const user = {
    ...(auth.session || {}),
    commercialRoles: auth.profile?.user?.commercialRoles || auth.session?.commercialRoles || [],
  };
  const permissions = getCommercialPermissions(user);
  const isAdmin = permissions.isAdmin;
  if (!isAdmin && !permissions.canUseSdrWorkspace) return sendJson(res, 403, { error: "forbidden" });
  if (isAdmin) {
    const perm = await permissionResolver(auth, "comercial.spacePhone.view");
    if (!perm.ok) return sendJson(res, perm.status, perm.body);
  }

  try {
    const url = new URL(req.url || "/api/space-phone", "https://space.local");
    if (req.method === "GET") {
      const id = url.searchParams.get("id");
      if (id) return sendJson(res, 200, await phone.detailModel({ request, id, user, isAdmin }));
      if (url.searchParams.get("normalize")) {
        return sendJson(res, 200, phone.normalizePhoneInput(url.searchParams.get("normalize"), url.searchParams.get("country") || "US"));
      }
      return sendJson(res, 200, await phone.listModel({
        request,
        user,
        isAdmin,
        query: Object.fromEntries(url.searchParams.entries()),
      }));
    }

    const body = await readJsonBody(req).catch(() => {
      const error = new Error("invalid_json");
      error.status = 400;
      throw error;
    });
    const id = body.id || url.searchParams.get("id");
    return sendJson(res, 200, await phone.updateCall({ request, id, user, isAdmin, patch: body }));
  } catch (error) {
    const status = Number(error?.status) || (error?.message === "forbidden" ? 403 : error?.message === "call_not_found" ? 404 : 500);
    return sendJson(res, status, { error: status >= 500 ? phone.publicError(error) : String(error?.message || "space_phone_failed") });
  }
};

module.exports = createHandler();
module.exports.createHandler = createHandler;
module.exports.__private = phone;
