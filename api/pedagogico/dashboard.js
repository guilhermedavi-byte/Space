const { readJsonBody, sendJson } = require("../_lib/http");
const { getSessionFromRequest } = require("../_lib/session");
const { normalizeRole } = require("../_lib/live-lessons");
const { supabaseFetch } = require("../_lib/supabase-rest");
const { TABLES, loadAdminDashboard } = require("../_lib/pedagogico-service");

module.exports = async (req, res) => {
  if (!["GET", "HEAD", "POST", "PATCH"].includes(req.method)) {
    res.setHeader("Allow", "GET, HEAD, POST, PATCH");
    return sendJson(res, 405, { error: "method_not_allowed" });
  }
  const session = getSessionFromRequest(req);
  if (!session) return sendJson(res, 401, { error: "unauthorized" });
  if (normalizeRole(session.role) !== "admin") return sendJson(res, 403, { error: "admin_only" });

  try {
    if (req.method === "POST" || req.method === "PATCH") {
      const body = await readJsonBody(req).catch(() => null);
      const action = String(body?.action || "").trim();
      const alunoChave = String(body?.aluno_chave || "").trim();
      const status = String(body?.status || "").trim().toLowerCase();
      if (action !== "set_student_status" || !alunoChave || !["ativo", "inativo"].includes(status)) {
        return sendJson(res, 400, { error: "invalid_payload" });
      }
      const adminId = String(session.sub || session.email || "").trim();
      const now = new Date().toISOString();
      const { data } = await supabaseFetch(
        `/${TABLES.adminStudentPreferences}?on_conflict=admin_id,aluno_chave`,
        {
          method: "POST",
          headers: { Prefer: "resolution=merge-duplicates,return=representation" },
          body: {
            admin_id: adminId,
            admin_email: String(session.email || ""),
            aluno_chave: alunoChave,
            status,
            updated_at: now,
          },
        }
      );
      return sendJson(res, 200, { ok: true, preference: Array.isArray(data) ? data[0] || null : data });
    }

    const dashboard = await loadAdminDashboard({ session });
    return sendJson(res, 200, { ok: true, ...dashboard });
  } catch (error) {
    console.error("[pedagogico] dashboard failed", error);
    if (req.method === "POST" || req.method === "PATCH") {
      return sendJson(res, 500, {
        error: error?.code || "student_status_failed",
        message: "Não foi possível salvar a preferência deste acesso.",
      });
    }
    return sendJson(res, 200, {
      ok: true,
      degraded: true,
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
