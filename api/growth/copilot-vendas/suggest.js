const { readJsonBody, sendJson } = require("../../_lib/http");
const { requireGrowthAccessFromRequest, saveResource, suggestWithAi } = require("../../_lib/growth-copilot");
const { applyCors } = require("../../_lib/security");

module.exports = async (req, res) => {
  try {
    if (req.method === "OPTIONS") {
      applyCors(req, res);
      res.statusCode = 204;
      res.end("");
      return;
    }
    applyCors(req, res);
    const session = requireGrowthAccessFromRequest(req);
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      sendJson(res, 405, { error: "method_not_allowed" });
      return;
    }
    const body = await readJsonBody(req);
    const transcript = String(body?.transcript || body?.fullTranscript || body?.transcriptChunk || "").trim();
    const result = await suggestWithAi({ ...(body || {}), transcript });
    saveResource("suggestions", {
      session_id: body?.sessionId || "",
      lead_name: body?.leadContext?.leadName || body?.leadContext?.nome || "",
      closer_name: body?.leadContext?.closer || session?.name || session?.email || "",
      stage: result?.stage || "",
      type: result?.cards?.[0]?.type || "",
      title: result?.cards?.[0]?.title || "",
      content: result?.cards?.[0]?.content || "",
      priority: result?.cards?.[0]?.priority || "",
      cards: result?.cards || [],
      transcript_tail: transcript.slice(-3000),
    }).catch((error) => console.warn("[api] copilot suggestion persistence skipped", error.message));
    sendJson(res, 200, {
      stage: result?.stage || "diagnóstico",
      leadTemperature: result?.leadTemperature || "morno",
      temperatureReason: result?.temperatureReason || "",
      detectedSignals: Array.isArray(result?.detectedSignals) ? result.detectedSignals : [],
      updatedState: result?.updatedState || {},
      cards: Array.isArray(result?.cards) ? result.cards : [],
    });
  } catch (error) {
    console.error("[api] growth copilot suggest failed", error);
    sendJson(res, error.status || 500, { error: error.message || "growth_copilot_suggest_failed" });
  }
};
