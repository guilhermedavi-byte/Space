const { readJsonBody, sendJson } = require("../../_lib/http");
const { listResource, requireGrowthAccessFromRequest, saveResource } = require("../../_lib/growth-copilot");
const { requireAdminPermission } = require("../../_lib/admin-permissions");

module.exports = async (req, res) => {
  try {
    const session = requireGrowthAccessFromRequest(req);
    if (String(session?.role || "").trim().toLowerCase() === "admin") {
      const guard = await requireAdminPermission(req, "comercial.preSales.view");
      if (!guard.ok) return sendJson(res, guard.status, guard.body);
    }

    if (req.method === "GET") {
      const host = String(req.headers.host || "localhost");
      const url = new URL(req.url || "/api/growth/copilot-vendas/data", `https://${host}`);
      const resource = url.searchParams.get("resource") || "scripts";
      const result = await listResource(resource);
      sendJson(res, 200, result);
      return;
    }

    if (req.method === "POST") {
      const body = await readJsonBody(req);
      const resource = String(body?.resource || "").trim();
      const payload = body?.payload && typeof body.payload === "object" ? body.payload : {};
      const row = await saveResource(resource, payload);
      sendJson(res, 200, { ok: true, row });
      return;
    }

    res.setHeader("Allow", "GET, POST");
    sendJson(res, 405, { error: "method_not_allowed" });
  } catch (error) {
    console.error("[api] growth copilot data failed", error);
    sendJson(res, error.status || 500, { error: error.message || "growth_copilot_data_failed" });
  }
};
