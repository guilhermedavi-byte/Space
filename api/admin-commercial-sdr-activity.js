const { sendJson } = require("../_lib/http");
const { resolveAdminRequestAuth } = require("./_lib/admin-request-auth");
const { loadAdminCommercialSdrActivity } = require("./_lib/admin-commercial-sdr-activity");

module.exports = async (req, res) => {
  if (!["GET", "HEAD"].includes(req.method)) {
    res.setHeader("Allow", "GET, HEAD");
    return sendJson(res, 405, { error: "method_not_allowed" });
  }

  try {
    const auth = await resolveAdminRequestAuth(req, { logPrefix: "[admin-commercial-sdr-activity]" });
    if (!auth.ok) return sendJson(res, auth.status, auth.body);
    if (String(auth.session?.role || "").trim().toLowerCase() !== "admin") {
      return sendJson(res, 403, { error: "admin_only", message: "Acesso restrito ao admin." });
    }

    const host = String(req.headers.host || "localhost");
    const url = new URL(req.url || "/api/admin-commercial-sdr-activity", `https://${host}`);
    const payload = await loadAdminCommercialSdrActivity({
      period: String(url.searchParams.get("period") || "today").trim(),
      from: String(url.searchParams.get("from") || "").trim(),
      to: String(url.searchParams.get("to") || "").trim(),
    });
    return sendJson(res, 200, payload);
  } catch (error) {
    console.error("[admin-commercial-sdr-activity] failed", error);
    return sendJson(res, error?.status || 500, {
      error: error?.message || "admin_commercial_sdr_activity_failed",
      message: "Não foi possível carregar a atividade diária dos SDRs agora.",
    });
  }
};
