const { readJsonBody, sendJson } = require("../../_lib/http");
const { getSessionFromRequest } = require("../../_lib/session");
const { supabaseFetch } = require("../../_lib/supabase-rest");
const { fetchLessonById, canAccessLesson, normalizeRole } = require("../../_lib/live-lessons");

const getRouteId = (req) => {
  const fromQuery = String(req.query?.id || "").trim();
  if (fromQuery) return fromQuery;
  const match = String(req.url || "").match(/\/live-lessons\/([^/?#]+)\/feedback/);
  return match ? decodeURIComponent(match[1]) : "";
};

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    sendJson(res, 405, { error: "method_not_allowed" });
    return;
  }

  const session = getSessionFromRequest(req);
  if (!session) {
    sendJson(res, 401, { error: "unauthorized" });
    return;
  }

  const role = normalizeRole(session.role);
  if (role !== "student") {
    sendJson(res, 403, { error: "student_only" });
    return;
  }

  const id = getRouteId(req);
  const payload = await readJsonBody(req).catch(() => null);
  const nota = Number(payload?.nota);
  const mensagem = String(payload?.mensagem || "").trim();
  if (!id || !Number.isFinite(nota) || nota < 1 || nota > 10) {
    sendJson(res, 400, { error: "invalid_payload" });
    return;
  }

  try {
    const lesson = await fetchLessonById(id);
    if (!lesson) {
      sendJson(res, 404, { error: "not_found" });
      return;
    }
    if (!canAccessLesson(session, lesson)) {
      sendJson(res, 403, { error: "forbidden" });
      return;
    }

    const now = new Date().toISOString();
    const body = {
      aula_id: lesson.id,
      aluno_id: lesson.aluno_id || String(session.sub || "") || null,
      aluno_nome: lesson.aluno_nome || String(session.name || "") || null,
      professor_id: lesson.professor_id || null,
      professor_nome: lesson.professor_nome || null,
      nota_professor: Math.max(1, Math.min(10, Math.trunc(nota))),
      mensagem: mensagem || null,
      respondido_por: String(session.name || session.email || session.sub || "aluno"),
      created_at: now,
      updated_at: now,
    };

    const { data } = await supabaseFetch("/n8n_avaliacoes_aula_space", {
      method: "POST",
      body,
    });
    sendJson(res, 200, { ok: true, feedback: Array.isArray(data) ? data[0] : data || body });
  } catch (error) {
    console.error("[api] live lesson feedback failed", {
      message: error?.message,
      code: error?.code,
      details: error?.details,
      hint: error?.hint,
    });
    sendJson(res, 500, { error: "feedback_failed" });
  }
};
