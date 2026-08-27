const { readJsonBody, sendJson } = require("./_lib/http");
const { runScheduledRetentionChurn } = require("./_lib/retention-store");
const { isRetentionInvoluntaryChurnEnabled } = require("./_lib/retention-flags");

const constantTimeEqual = (left, right) => {
  const a = Buffer.from(String(left || ""), "utf8");
  const b = Buffer.from(String(right || ""), "utf8");
  if (a.length !== b.length || a.length === 0) return false;
  return require("crypto").timingSafeEqual(a, b);
};

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { error: "method_not_allowed" });
  }

  const configuredSecret = String(process.env.RETENTION_CHURN_JOB_SECRET || "").trim();
  const providedSecret = String(req.headers["x-retention-job-secret"] || "").trim();
  if (!configuredSecret || !constantTimeEqual(providedSecret, configuredSecret)) {
    return sendJson(res, configuredSecret ? 401 : 503, { error: configuredSecret ? "unauthorized" : "retention_job_not_configured" });
  }

  if (!isRetentionInvoluntaryChurnEnabled()) {
    return sendJson(res, 409, {
      error: "involuntary_churn_disabled",
      message: "Churn involuntário permanece bloqueado por feature flag.",
    });
  }

  let body = {};
  try {
    body = await readJsonBody(req);
  } catch {
    return sendJson(res, 400, { error: "invalid_json" });
  }

  try {
    const limit = Math.max(1, Math.min(Number(body.limit) || 50, 500));
    const result = await runScheduledRetentionChurn({
      limit,
      actor: { uid: "system:retention-cron", name: "Sistema", role: "system" },
    });
    return sendJson(res, 200, { ok: true, result });
  } catch (error) {
    console.error("[retention] churn job failed", { code: error?.code || "", message: error?.message || "retention_churn_job_failed" });
    return sendJson(res, 500, {
      error: error?.code || "retention_churn_job_failed",
      message: "Não foi possível executar o churn automático agora.",
    });
  }
};
