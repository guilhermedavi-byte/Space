const { getSessionFromRequest } = require("../../_lib/session");
const { readJsonBody, sendJson } = require("../../_lib/http");
const { requireGrowthAccess, saveResource, suggestWithAi } = require("../../_lib/growth-copilot");

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
    const result = await suggestWithAi(body || {});
    saveResource("suggestions", {
      lead_name: body?.leadContext?.leadName || body?.leadContext?.nome || "",
      closer: body?.leadContext?.closer || session?.name || session?.email || "",
      stage: result?.stage || "",
      cards: result?.cards || [],
      transcript_tail: String(body?.transcript || "").slice(-3000),
    }).catch((error) => console.warn("[api] copilot suggestion persistence skipped", error.message));
    sendJson(res, 200, {
      stage: result?.stage || "diagnóstico",
      cards: Array.isArray(result?.cards) ? result.cards : [],
    });
  } catch (error) {
    console.error("[api] growth copilot suggest failed", error);
    sendJson(res, error.status || 500, { error: error.message || "growth_copilot_suggest_failed" });
  }
};
