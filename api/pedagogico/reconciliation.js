const { sendJson } = require("../_lib/http");
const { resolveAdminRequestAuth } = require("../_lib/admin-request-auth");
const { buildReconciliationReport } = require("../_lib/pedagogico-reconciliation");

module.exports = async (req, res) => {
  if (!["GET", "HEAD"].includes(req.method)) {
    res.setHeader("Allow", "GET, HEAD");
    return sendJson(res, 405, { error: "method_not_allowed" });
  }

  const auth = await resolveAdminRequestAuth(req, { logPrefix: "[api] pedagogico reconciliation auth" });
  if (!auth.ok) return sendJson(res, auth.status, auth.body);
  if (auth.session?.role !== "admin") return sendJson(res, 403, { error: "admin_only" });

  try {
    const url = new URL(req.url, "http://localhost");
    const report = await buildReconciliationReport({
      from: String(url.searchParams.get("from") || "").trim(),
      to: String(url.searchParams.get("to") || "").trim(),
      teacherId: String(url.searchParams.get("teacher_id") || "").trim(),
      severity: String(url.searchParams.get("severity") || "").trim(),
      category: String(url.searchParams.get("category") || "").trim(),
      limit: Number(url.searchParams.get("limit") || 100),
      cursor: String(url.searchParams.get("cursor") || "").trim(),
    });
    return sendJson(res, 200, report);
  } catch (error) {
    console.error("[pedagogico] reconciliation failed", error);
    return sendJson(res, 500, {
      error: error?.code || "reconciliation_failed",
      message: "Não foi possível gerar a reconciliação agora.",
    });
  }
};
