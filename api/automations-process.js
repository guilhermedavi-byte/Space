const { sendJson } = require("../_lib/http");
const { processOneAutomationEvent } = require("./_lib/automation-engine");

const constantTimeEqual = (left, right) => {
  const a = Buffer.from(String(left || ""), "utf8");
  const b = Buffer.from(String(right || ""), "utf8");
  if (a.length !== b.length || a.length === 0) return false;
  return require("crypto").timingSafeEqual(a, b);
};

module.exports = async (req, res) => {
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return sendJson(res, 405, { error: "method_not_allowed" });
  }
  const configured = String(process.env.CRON_SECRET || process.env.AUTOMATIONS_PROCESS_SECRET || "").trim();
  const provided = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!configured || !constantTimeEqual(provided, configured)) {
    return sendJson(res, configured ? 401 : 503, { error: configured ? "unauthorized" : "automations_worker_not_configured" });
  }
  const deadline = Date.now() + 15000;
  const results = [];
  try {
    while (Date.now() < deadline && results.length < 25) {
      const result = await processOneAutomationEvent();
      results.push(result);
      if (result.state === "not_claimed") break;
    }
    return sendJson(res, 200, { ok: true, processed: results.filter((r) => r.state === "processed").length, results });
  } catch (error) {
    console.error("[automations] worker failed", { message: error?.message || "automation_worker_failed" });
    return sendJson(res, 500, { error: "automation_worker_failed" });
  }
};
