const { sendJson } = require("../_lib/http");
const { getSessionFromRequest } = require("../_lib/session");
const { normalizeRole } = require("../_lib/live-lessons");
const { loadStudentCard, loadTeacherStudents } = require("../_lib/pedagogico-service");

const normalizeText = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const canUseStudentCard = (session) => {
  const role = normalizeRole(session?.role);
  return role === "admin" || role === "teacher";
};

module.exports = async (req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    sendJson(res, 405, { error: "method_not_allowed" });
    return;
  }

  const session = getSessionFromRequest(req);
  if (!session) {
    sendJson(res, 401, { error: "unauthorized" });
    return;
  }
  if (!canUseStudentCard(session)) {
    sendJson(res, 403, { error: "forbidden" });
    return;
  }

  const alunoId = String(req.query?.aluno_id || req.query?.student_id || "").trim();
  const alunoNome = String(req.query?.aluno_nome || req.query?.name || "").trim();
  if (!alunoId && !alunoNome) {
    sendJson(res, 400, { error: "missing_student" });
    return;
  }

  try {
    if (normalizeRole(session.role) === "teacher") {
      const owned = await loadTeacherStudents({ session });
      const ownRows = [
        ...(Array.isArray(owned?.students) ? owned.students : []),
        ...(Array.isArray(owned?.summaries) ? owned.summaries : []),
      ];
      const safeAlunoId = String(alunoId || "").trim();
      const safeAlunoNome = normalizeText(alunoNome);
      const isOwned = ownRows.some((row) => {
        const rowId = String(row?.aluno_id || row?.alunoId || row?.id || "").trim();
        const rowName = normalizeText(row?.aluno_nome || row?.nome || row?.name || "");
        if (safeAlunoId && rowId && rowId === safeAlunoId) return true;
        if (safeAlunoNome && rowName && rowName === safeAlunoNome) return true;
        return false;
      });
      if (!isOwned) {
        sendJson(res, 403, { error: "student_out_of_scope" });
        return;
      }
    }

    const ficha = await loadStudentCard({ alunoId, alunoNome });
    sendJson(res, 200, { ok: true, ficha });
  } catch (error) {
    console.error("[pedagogico] student card load failed", error);
    sendJson(res, 200, {
      ok: true,
      degraded: true,
      warning: "Ficha pedagógica temporariamente indisponível.",
      ficha: { aluno_id: alunoId, aluno_nome: alunoNome, aulas: [], registros: [], faltas: [], remarcacoes: [], ocorrencias: [], avaliacoes: [] },
    });
  }
};
