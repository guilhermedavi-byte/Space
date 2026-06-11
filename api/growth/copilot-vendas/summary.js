const { getSessionFromRequest } = require("../../_lib/session");
const { readJsonBody, sendJson } = require("../../_lib/http");
const { requireGrowthAccess, saveResource, summaryWithAi } = require("../../_lib/growth-copilot");

module.exports = async (req, res) => {
  try {
    const session = getSessionFromRequest(req);
    requireGrowthAccess(session);
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      sendJson(res, 405, { error: "method_not_allowed" });
      return;
    }
    const body = await readJsonBody(req);
    const result = await summaryWithAi(body || {});
    saveResource("sessions", {
      lead_context: body?.leadContext || {},
      transcript: String(body?.transcript || ""),
      summary: result,
      closer: body?.leadContext?.closer || session?.name || session?.email || "",
    }).catch((error) => console.warn("[api] copilot session persistence skipped", error.message));
    sendJson(res, 200, result);
  } catch (error) {
    console.error("[api] growth copilot summary failed", error);
    sendJson(res, error.status || 500, { error: error.message || "growth_copilot_summary_failed" });
  }
};
