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

const normalizeUserRoleFilter = (value) => {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "teacher" || raw === "professor") return "teacher";
  if (raw === "student" || raw === "aluno") return "student";
  if (raw === "admin" || raw === "administrador") return "admin";
  if (raw === "growth") return "growth";
  if (raw === "finance" || raw === "financeiro") return "finance";
  return "";
};

const hasAnyValue = (row, keys = []) =>
  (Array.isArray(keys) ? keys : []).some((key) => {
    const value = row?.[key];
    if (typeof value === "boolean") return value;
    return String(value ?? "").trim() !== "";
  });

const inferLegacyUserRole = (row = {}) => {
  const explicitRole = normalizeUserRoleFilter(row?.tipo || row?.role || row?.type || row?.perfil);
  if (explicitRole) return explicitRole;

  const studentMarkers = [
    "professorId",
    "teacherId",
    "professorNome",
    "teacherNome",
    "plano",
    "plan",
    "english_level_start",
    "englishLevelStart",
    "observacoesPedagogicas",
    "objetivoPrincipal",
    "nivelInglesAtual",
    "tempoContrato",
    "faixaIdade",
    "turma",
    "groupId",
    "cancelamento",
    "cancelamentosAnteriores",
  ];
  const teacherMarkers = ["especialidade", "specialty", "nivelLeciona"];

  const isStudentLike = hasAnyValue(row, studentMarkers);
  const isTeacherLike = hasAnyValue(row, teacherMarkers);

  if (isStudentLike && !isTeacherLike) return "student";
  if (isTeacherLike && !isStudentLike) return "teacher";
  return "";
};

const buildUserDebugSummary = (rows = []) => {
  const items = Array.isArray(rows) ? rows : [];
  const samples = items.slice(0, 10).map((row) => ({
    firestoreDocId: String(row?.firestoreDocId || row?.id || "").trim(),
    tipo: row?.tipo ?? null,
    role: row?.role ?? null,
    inferredRole: inferLegacyUserRole(row),
    professorId: row?.professorId ?? null,
    teacherId: row?.teacherId ?? null,
    plano: row?.plano ?? row?.plan ?? null,
  }));
  return {
    total: items.length,
    explicitStudent: items.filter((row) => normalizeUserRoleFilter(row?.tipo || row?.role || row?.type || row?.perfil) === "student").length,
    explicitTeacher: items.filter((row) => normalizeUserRoleFilter(row?.tipo || row?.role || row?.type || row?.perfil) === "teacher").length,
    inferredStudent: items.filter((row) => inferLegacyUserRole(row) === "student").length,
    inferredTeacher: items.filter((row) => inferLegacyUserRole(row) === "teacher").length,
    missingRoleField: items.filter((row) => !String(row?.tipo || row?.role || row?.type || row?.perfil || "").trim()).length,
    samples,
  };
};

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
    const wantsDebug = url.searchParams.get("debug") === "1";
    const fullDebugSummary = collection === "users" && wantsDebug ? buildUserDebugSummary(rows) : null;
    if (collection === "users" && type) {
      const normalizedType = normalizeUserRoleFilter(type);
      rows = rows.filter((row) => inferLegacyUserRole(row) === normalizedType);
      if (wantsDebug) {
        console.warn("[api] admin-data users debug", {
          requestedType: normalizedType,
          beforeFilter: fullDebugSummary,
          afterFilter: buildUserDebugSummary(rows),
        });
      }
    }
    const body = { rows };
    if (collection === "users" && wantsDebug) {
      body.debug = {
        beforeFilter: fullDebugSummary,
        afterFilter: buildUserDebugSummary(rows),
      };
    }
    return sendJson(res, 200, body);
  } catch (error) {
    console.error("[api] admin data failed", collection, error);
    return sendJson(res, error?.message === "missing_service_account" ? 503 : 500, {
      error: error?.message === "missing_service_account" ? "service_account_not_configured" : "admin_data_failed",
    });
  }
};
