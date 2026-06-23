const { readJsonBody, sendJson } = require("../../_lib/http");
const { requireGrowthAccessFromRequest, saveResource, summaryWithAi } = require("../../_lib/growth-copilot");
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
    const result = await summaryWithAi({ ...(body || {}), transcript });
    saveResource("sessions", {
      session_id: body?.sessionId || "",
      lead_name: body?.leadContext?.leadName || "",
      lead_phone: body?.leadContext?.phone || "",
      closer_name: body?.leadContext?.closer || session?.name || session?.email || "",
      source: body?.leadContext?.source || "",
      ended_at: new Date().toISOString(),
      final_stage: body?.sessionState?.stage || result?.finalStage || "",
      lead_temperature: result?.leadTemperature || body?.sessionState?.leadTemperature || "",
      summary: result?.summary || "",
      pain: result?.pain || "",
      goal: result?.goal || "",
      urgency: result?.urgency || "",
      budget: result?.budget || "",
      recommended_plan: result?.recommendedPlan || "",
      next_step: result?.nextStep || "",
      crm_notes: result?.crmNotes || "",
      saved_to_crm: false,
      lead_context: body?.leadContext || {},
      transcript,
      summary_payload: result,
    }).catch((error) => console.warn("[api] copilot session persistence skipped", error.message));
    sendJson(res, 200, result);
  } catch (error) {
    console.error("[api] growth copilot summary failed", error);
    sendJson(res, error.status || 500, { error: error.message || "growth_copilot_summary_failed" });
  }
};
