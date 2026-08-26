const { readJsonBody, sendJson } = require("./_lib/http");
const { resolveAdminRequestAuth } = require("./_lib/admin-request-auth");
const { listCollectionAsAdmin } = require("./_lib/firestore-admin");
const { buildLegacyRetentionImportSnapshot } = require("./_lib/retention-import");
const { runLegacyRetentionImport } = require("./_lib/retention-store");

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

  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    return sendJson(res, 400, { error: "invalid_json" });
  }

  const dryRun = body?.dryRun !== false;
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
    console.error("[retention] import failed", error);
    return sendJson(res, 500, {
      error: error?.code || "retention_import_failed",
      message: "Não foi possível preparar a importação legada agora.",
    });
  }
};
