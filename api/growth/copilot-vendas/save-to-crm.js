const { readJsonBody, sendJson } = require("../../_lib/http");
const { requireGrowthAccessFromRequest, saveResource } = require("../../_lib/growth-copilot");

module.exports = async (req, res) => {
  try {
    const session = requireGrowthAccessFromRequest(req);
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      sendJson(res, 405, { error: "method_not_allowed" });
      return;
    }

    const body = await readJsonBody(req);
    const leadId = String(body?.leadId || "").trim();
    const dealId = String(body?.dealId || "").trim();
    const payload = {
      session_id: body?.sessionId || "",
      lead_id: leadId,
      deal_id: dealId,
      lead_phone: body?.leadPhone || "",
      summary: body?.summary || "",
      crm_notes: body?.crmNotes || "",
      next_step: body?.nextStep || "",
      lead_temperature: body?.leadTemperature || "",
      objections: Array.isArray(body?.objections) ? body.objections : [],
      closer_name: session?.name || session?.email || "",
      status: leadId || dealId ? "queued_manual_review" : "manual_copy_required",
    };

    saveResource("crmSaves", payload).catch((error) => console.warn("[api] copilot crm save persistence skipped", error.message));

    sendJson(res, 200, {
      ok: true,
      mode: "fallback",
      savedToCrm: false,
      message: leadId || dealId ? "Registro preparado. Integração Datacrazy ainda está em modo fallback." : "Sem leadId/dealId. Copie o resumo manualmente para o CRM.",
      payload,
    });
  } catch (error) {
    console.error("[api] growth copilot save-to-crm failed", error);
    sendJson(res, error.status || 500, { error: error.message || "growth_copilot_save_to_crm_failed" });
  }
};
