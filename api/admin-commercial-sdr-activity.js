const { sendJson } = require("../_lib/http");
const { resolveAdminRequestAuth } = require("./_lib/admin-request-auth");
const { loadAdminCommercialSdrActivity } = require("./_lib/admin-commercial-sdr-activity");
const { requireResolvedAdminPermission } = require("./_lib/admin-permissions");

module.exports = async (req, res) => {
  const requestId = `sdr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  if (!["GET", "HEAD"].includes(req.method)) {
    res.setHeader("Allow", "GET, HEAD");
    return sendJson(res, 405, { error: "method_not_allowed", requestId });
  }

  try {
    const auth = await resolveAdminRequestAuth(req, { logPrefix: "[admin-commercial-sdr-activity]" });
    if (!auth.ok) return sendJson(res, auth.status, auth.body);
    if (String(auth.session?.role || "").trim().toLowerCase() !== "admin") {
      return sendJson(res, 403, { error: "admin_only", message: "Acesso restrito ao admin." });
    }
    const perm = await requireResolvedAdminPermission(auth, "comercial.preSales.view");
    if (!perm.ok) return sendJson(res, perm.status, perm.body);

    const host = String(req.headers.host || "localhost");
    const url = new URL(req.url || "/api/admin-commercial-sdr-activity", `https://${host}`);
    const payload = await loadAdminCommercialSdrActivity({
      period: String(url.searchParams.get("period") || "today").trim(),
      from: String(url.searchParams.get("from") || "").trim(),
      to: String(url.searchParams.get("to") || "").trim(),
    });
    return sendJson(res, 200, { ...payload, requestId });
  } catch (error) {
    const status = Number(error?.status || error?.statusCode || 500) || 500;
    const code = error?.code || error?.message || "admin_commercial_sdr_activity_failed";
    console.error("[admin-commercial-sdr-activity] failed", {
      requestId,
      status,
      code,
      details: error?.details || null,
      stack: error?.stack,
    });
    return sendJson(res, status, {
      error: code,
      message: "Não foi possível carregar a atividade diária dos SDRs agora.",
      requestId,
    });
  }
};
