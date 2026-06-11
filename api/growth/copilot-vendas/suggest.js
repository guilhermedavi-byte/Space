const { getSessionFromRequest } = require("../../_lib/session");
const { readJsonBody, sendJson } = require("../../_lib/http");
const { requireGrowthAccess, saveResource, suggestWithAi } = require("../../_lib/growth-copilot");

module.exports = async (req, res) => {
  try {
    if (req.method === "OPTIONS") {
      res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Copilot-Token");
      res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
      res.statusCode = 204;
      res.end("");
      return;
    }
    res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    const session = getSessionFromRequest(req);
    requireGrowthAccess(session);
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      sendJson(res, 405, { error: "method_not_allowed" });
      return;
    }
    const body = await readJsonBody(req);
    const transcript = String(body?.transcript || body?.fullTranscript || body?.transcriptChunk || "").trim();
    const result = await suggestWithAi({ ...(body || {}), transcript });
    saveResource("suggestions", {
      lead_name: body?.leadContext?.leadName || body?.leadContext?.nome || "",
      closer: body?.leadContext?.closer || session?.name || session?.email || "",
      stage: result?.stage || "",
      cards: result?.cards || [],
      transcript_tail: transcript.slice(-3000),
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
