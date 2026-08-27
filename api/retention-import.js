const { readJsonBody, sendJson } = require("./_lib/http");
const { resolveAdminRequestAuth } = require("./_lib/admin-request-auth");
const { listCollectionAsAdmin } = require("./_lib/firestore-admin");
const { buildLegacyRetentionImportSnapshot } = require("./_lib/retention-import");
const { runLegacyRetentionImport } = require("./_lib/retention-store");
const { isRetentionLegacyImportEnabled } = require("./_lib/retention-flags");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { error: "method_not_allowed" });
  }

  const auth = await resolveAdminRequestAuth(req, { logPrefix: "[api] retention import auth" });
  if (!auth.ok) return sendJson(res, auth.status, auth.body);
  if (String(auth.session?.role || "").trim().toLowerCase() !== "admin") {
    return sendJson(res, 403, { error: "forbidden" });
  }
  if (!isRetentionLegacyImportEnabled()) {
    return sendJson(res, 409, { error: "retention_legacy_import_disabled" });
  }

  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    return sendJson(res, 400, { error: "invalid_json" });
  }

  const dryRun = body?.dryRun !== false;
  const executeImport = body?.executeImport === true;
  const confirmImport = String(body?.confirmImport || "").trim();
  if (!dryRun && !executeImport) {
    return sendJson(res, 400, { error: "missing_execute_import_confirmation" });
  }
  if (!dryRun && confirmImport !== "CONFIRM_RETENTION_LEGACY_IMPORT") {
    return sendJson(res, 400, { error: "missing_import_confirmation_phrase" });
  }
  if (
    !dryRun &&
    String(process.env.APP_ENV || process.env.SPACE_APP_ENV || process.env.VERCEL_ENV || process.env.NODE_ENV || "")
      .trim()
      .toLowerCase() === "production" &&
    body?.productionAcknowledge !== true
  ) {
    return sendJson(res, 400, { error: "missing_production_acknowledge" });
  }
  try {
    const users = await listCollectionAsAdmin("users", { pageSize: 1500 });
    const snapshot = buildLegacyRetentionImportSnapshot({ users, dryRun });
    if (dryRun) {
      return sendJson(res, 200, {
        ok: true,
        dryRun: true,
        report: snapshot.report,
      });
    }
    const result = await runLegacyRetentionImport({ payload: snapshot.payload });
    return sendJson(res, 200, {
      ok: true,
      dryRun: false,
      report: snapshot.report,
      result,
    });
  } catch (error) {
    console.error("[retention] import failed", { code: error?.code || "", message: error?.message || "retention_import_failed" });
    return sendJson(res, 500, {
      error: error?.code || "retention_import_failed",
      message: "Não foi possível preparar a importação legada agora.",
    });
  }
};
