const { readJsonBody, sendJson } = require("../../_lib/http");
const { requireGrowthAccessFromRequest, saveResource, summaryWithAi } = require("../../_lib/growth-copilot");

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
    const session = requireGrowthAccessFromRequest(req);
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      sendJson(res, 405, { error: "method_not_allowed" });
      return;
    }
    const body = await readJsonBody(req);
    const transcript = String(body?.transcript || body?.fullTranscript || body?.transcriptChunk || "").trim();
    const result = await summaryWithAi({ ...(body || {}), transcript });
    saveResource("sessions", {
      lead_context: body?.leadContext || {},
      transcript,
      summary: result,
      closer_name: body?.leadContext?.closer || session?.name || session?.email || "",
    }).catch((error) => console.warn("[api] copilot session persistence skipped", error.message));
    sendJson(res, 200, result);
  } catch (error) {
    console.error("[api] growth copilot summary failed", error);
    sendJson(res, error.status || 500, { error: error.message || "growth_copilot_summary_failed" });
  }
};
