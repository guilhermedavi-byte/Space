const { readJsonBody, sendJson } = require("../_lib/http");
const { supabaseFetch } = require("../_lib/supabase-rest");
const { resolveAdminRequestAuth } = require("../_lib/admin-request-auth");
const { requireResolvedAdminPermission } = require("../_lib/admin-permissions");
const { TABLES, loadAdminDashboard, loadAdminOverviewSnapshot } = require("../_lib/pedagogico-service");
const { createPerformanceTimer } = require("../_lib/performance-observer");

module.exports = async (req, res) => {
  const perf = createPerformanceTimer({ req, route: "/api/pedagogico/dashboard", operation: req.method === "GET" || req.method === "HEAD" ? "pedagogico_dashboard" : "pedagogico_student_status" });
  const send = (status, body) => {
    perf.finish(res, body);
    return sendJson(res, status, body);
  };
  if (!["GET", "HEAD", "POST", "PATCH"].includes(req.method)) {
    res.setHeader("Allow", "GET, HEAD, POST, PATCH");
    return send(405, { error: "method_not_allowed" });
  }
  const auth = await perf.measure("auth", () => resolveAdminRequestAuth(req, { logPrefix: "[api] pedagogico dashboard auth" }));
  if (!auth.ok) return send(auth.status, auth.body);
  if (auth.session?.role !== "admin") return send(403, { error: "admin_only" });
  const perm = await requireResolvedAdminPermission(auth, "pedagogico.overview.view");
  if (!perm.ok) return send(perm.status, perm.body);

  try {
    if (req.method === "POST" || req.method === "PATCH") {
      const body = await readJsonBody(req).catch(() => null);
      const action = String(body?.action || "").trim();
      const alunoChave = String(body?.aluno_chave || "").trim();
      const status = String(body?.status || "").trim().toLowerCase();
      if (action !== "set_student_status" || !alunoChave || !["ativo", "inativo"].includes(status)) {
        return send(400, { error: "invalid_payload" });
      }
      const adminId = String(auth.session.sub || auth.session.email || "").trim();
      const now = new Date().toISOString();
      const { data } = await perf.measure("saveStudentPreference", () => supabaseFetch(
        `/${TABLES.adminStudentPreferences}?on_conflict=admin_id,aluno_chave`,
        {
          method: "POST",
          headers: { Prefer: "resolution=merge-duplicates,return=representation" },
          body: {
            admin_id: adminId,
            admin_email: String(auth.session.email || ""),
            aluno_chave: alunoChave,
            status,
            updated_at: now,
          },
        }
      ));
      return send(200, { ok: true, preference: Array.isArray(data) ? data[0] || null : data });
    }

    const host = String(req.headers.host || "localhost");
    const url = new URL(req.url || "/api/pedagogico/dashboard", `https://${host}`);
    const view = String(url.searchParams.get("view") || "").trim().toLowerCase();
    const dashboard = view === "overview"
      ? await perf.measure("responseBuild", () => loadAdminOverviewSnapshot({ session: auth.session, perf }))
      : await perf.measure("responseBuild", () => loadAdminDashboard({ session: auth.session, perf }));
    return send(200, { ok: true, ...dashboard });
  } catch (error) {
    console.error("[pedagogico] dashboard failed", error);
    if (req.method === "POST" || req.method === "PATCH") {
      return send(500, {
        error: error?.code || "student_status_failed",
        message: "Não foi possível salvar a preferência deste acesso.",
      });
    }
    return send(200, {
      ok: true,
      degraded: true,
      degradedReason: "api_route_error",
      warning: "Dados pedagógicos temporariamente indisponíveis.",
      metrics: {},
      students: [],
      financeStudents: [],
      studentPreferences: [],
      onboarding: [],
      lessons: [],
      registers: [],
      pendingLessons: [],
      alerts: [],
      satisfaction: [],
      flexge: [],
      teachers: [],
      reports: [],
      riskStudents: [],
    });
  }
};
