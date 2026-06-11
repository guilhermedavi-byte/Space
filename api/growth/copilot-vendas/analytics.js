const { sendJson } = require("../../_lib/http");
const { listResource, requireGrowthAccessFromRequest } = require("../../_lib/growth-copilot");

const countBy = (rows, key) =>
  rows.reduce((acc, row) => {
    const value = String(row?.[key] || "sem_dado");
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});

module.exports = async (req, res) => {
  try {
    requireGrowthAccessFromRequest(req);
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      sendJson(res, 405, { error: "method_not_allowed" });
      return;
    }

    const [sessions, suggestions, feedback, phrases] = await Promise.all([
      listResource("sessions"),
      listResource("suggestions"),
      listResource("feedback"),
      listResource("phrases"),
    ]);
    const suggestionRows = suggestions.rows || [];
    const feedbackRows = feedback.rows || [];
    const sessionRows = sessions.rows || [];
    sendJson(res, 200, {
      sessions: sessionRows.length,
      suggestions: suggestionRows.length,
      copied: suggestionRows.filter((row) => row.was_copied).length,
      useful: feedbackRows.filter((row) => ["útil", "util", "useful"].includes(String(row.feedback || row.feedback_type || "").toLowerCase())).length,
      bad: feedbackRows.filter((row) => ["ruim", "bad"].includes(String(row.feedback || row.feedback_type || "").toLowerCase())).length,
      savedPhrases: (phrases.rows || []).length,
      objectionsByStage: countBy(suggestionRows, "stage"),
      closers: countBy([...sessionRows, ...suggestionRows], "closer_name"),
      temperatures: countBy(sessionRows, "lead_temperature"),
      rows: { sessions: sessionRows, suggestions: suggestionRows.slice(0, 50), feedback: feedbackRows.slice(0, 50) },
    });
  } catch (error) {
    console.error("[api] growth copilot analytics failed", error);
    sendJson(res, error.status || 500, { error: error.message || "growth_copilot_analytics_failed" });
  }
};
