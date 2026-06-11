const { readJsonBody, sendJson } = require("../../_lib/http");
const { listResource, requireGrowthAccessFromRequest, saveResource } = require("../../_lib/growth-copilot");

module.exports = async (req, res) => {
  try {
    const session = requireGrowthAccessFromRequest(req);
    if (req.method === "GET") {
      const [feedback, phrases, insights, objections, scripts] = await Promise.all([
        listResource("feedback"),
        listResource("phrases"),
        listResource("insights"),
        listResource("objections"),
        listResource("scripts"),
      ]);
      sendJson(res, 200, {
        feedback: feedback.rows || [],
        phrases: phrases.rows || [],
        insights: insights.rows || [],
        objections: objections.rows || [],
        scripts: scripts.rows || [],
      });
      return;
    }

    if (req.method === "POST") {
      const body = await readJsonBody(req);
      const action = String(body?.action || "").trim();
      const source = body?.source && typeof body.source === "object" ? body.source : {};
      if (action === "approve_phrase") {
        const row = await saveResource("phrases", {
          phrase: source.phrase || source.content || "",
          context: source.context || source.title || "Aprovada no treinamento",
          stage: source.stage || "",
          source: "training",
          closer_name: session?.name || session?.email || "",
          usage_count: 0,
          positive_count: 1,
          active: true,
        });
        sendJson(res, 200, { ok: true, row });
        return;
      }
      if (action === "insight_to_objection") {
        const row = await saveResource("objections", {
          objection: source.title || source.content || "Nova objeção",
          category: source.insight_type || "nova",
          recommended_response: source.recommended_response || source.content || "",
          deepening_question: source.deepening_question || "",
          closing_phrase: source.closing_phrase || "",
          active: true,
        });
        sendJson(res, 200, { ok: true, row });
        return;
      }
      if (action === "insight_to_script") {
        const row = await saveResource("scripts", {
          name: source.title || "Novo script",
          title: source.title || "Novo script",
          type: source.stage || "diagnostico",
          stage: source.stage || "diagnostico",
          content: source.content || "",
          active: true,
        });
        sendJson(res, 200, { ok: true, row });
        return;
      }
      sendJson(res, 400, { error: "invalid_training_action" });
      return;
    }

    res.setHeader("Allow", "GET, POST");
    sendJson(res, 405, { error: "method_not_allowed" });
  } catch (error) {
    console.error("[api] growth copilot training failed", error);
    sendJson(res, error.status || 500, { error: error.message || "growth_copilot_training_failed" });
  }
};
