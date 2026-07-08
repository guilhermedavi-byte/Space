const { sendJson } = require("../_lib/http");
const { resolveAdminRequestAuth } = require("./_lib/admin-request-auth");
const { listCollectionAsAdmin } = require("./_lib/firestore-admin");

const ALLOWED_COLLECTIONS = new Set([
  "users",
  "classes",
  "groups",
  "plans",
  "surveys",
  "teacherAlerts",
  "pedagogicalFeedbacks",
  "lessonLogs",
  "onboardingContents",
  "onboardingQuizzes",
  "teacherOnboardingProgress",
  "teacherQuizSubmissions",
]);

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return sendJson(res, 405, { error: "method_not_allowed" });
  }

  const auth = await resolveAdminRequestAuth(req, { logPrefix: "[api] admin-data auth" });
  if (!auth.ok) return sendJson(res, auth.status, auth.body);
  if (String(auth.session?.role || "").toLowerCase() !== "admin") {
    return sendJson(res, 403, { error: "forbidden" });
  }

  const host = String(req.headers.host || "localhost");
  const url = new URL(req.url || "/api/admin-data", `https://${host}`);
  const collection = String(url.searchParams.get("collection") || "").trim();
  if (!ALLOWED_COLLECTIONS.has(collection)) {
    return sendJson(res, 400, { error: "invalid_collection" });
  }

  try {
    let rows = await listCollectionAsAdmin(collection);
    const type = String(url.searchParams.get("type") || "").trim().toLowerCase();
    if (collection === "users" && type) {
      rows = rows.filter((row) => String(row?.tipo || row?.role || "").trim().toLowerCase() === type);
    }
    return sendJson(res, 200, { rows });
  } catch (error) {
    console.error("[api] admin data failed", collection, error);
    return sendJson(res, error?.message === "missing_service_account" ? 503 : 500, {
      error: error?.message === "missing_service_account" ? "service_account_not_configured" : "admin_data_failed",
    });
  }
};
