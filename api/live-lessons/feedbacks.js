const { sendJson } = require("../_lib/http");
const { getSessionFromRequest } = require("../_lib/session");
const { supabaseFetch } = require("../_lib/supabase-rest");
const { normalizeRole } = require("../_lib/live-lessons");

const safeEncode = (value) => encodeURIComponent(String(value || ""));

const namesMatch = (a, b) => {
  const normalize = (value) =>
    String(value || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  const left = normalize(a);
  const right = normalize(b);
  return Boolean(left && right && left === right);
};

const normalizeFeedback = (row) => {
  if (!row || typeof row !== "object") return null;
  const id = String(row.id || "").trim();
  if (!id) return null;
  const score = Number(row.nota_professor);
  const created = row.created_at || row.updated_at || null;
  const createdAtMs = created ? Date.parse(String(created)) : 0;
  return {
    id,
    aulaId: row.aula_id == null ? "" : String(row.aula_id),
    alunoId: row.aluno_id == null ? "" : String(row.aluno_id),
    alunoNome: row.aluno_nome == null ? "" : String(row.aluno_nome),
    professorId: row.professor_id == null ? "" : String(row.professor_id),
    professorNome: row.professor_nome == null ? "" : String(row.professor_nome),
    notaProfessor: Number.isFinite(score) ? Math.max(1, Math.min(10, Math.trunc(score))) : null,
    mensagem: row.mensagem == null ? "" : String(row.mensagem),
    respondidoPor: row.respondido_por == null ? "" : String(row.respondido_por),
    createdAt: created,
    createdAtMs: Number.isFinite(createdAtMs) ? createdAtMs : 0,
  };
};

const summarize = (rows) => {
  const scores = rows.map((row) => Number(row.notaProfessor)).filter((n) => Number.isFinite(n));
  const average = scores.length ? scores.reduce((acc, n) => acc + n, 0) / scores.length : null;
  return {
    count: rows.length,
    average,
    lowScoreCount: rows.filter((row) => Number(row.notaProfessor) <= 6).length,
  };
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

  const role = normalizeRole(session.role);
  if (!["admin", "teacher"].includes(role)) {
    sendJson(res, 403, { error: "forbidden" });
    return;
  }

  const host = String(req.headers.host || "localhost");
  const url = new URL(req.url || "/api/live-lessons/feedbacks", `https://${host}`);
  const limit = Math.max(1, Math.min(Number(url.searchParams.get("limit") || 200) || 200, 500));

  try {
    const { data } = await supabaseFetch(`/n8n_avaliacoes_aula_space?select=*&order=created_at.desc&limit=${safeEncode(limit)}`);
    let rows = (Array.isArray(data) ? data : []).map(normalizeFeedback).filter(Boolean);

    if (role === "teacher") {
      rows = rows.filter(
        (row) =>
          (session.sub && row.professorId && String(session.sub) === String(row.professorId)) ||
          namesMatch(session.name, row.professorNome)
      );
      sendJson(res, 200, {
        summary: summarize(rows),
        // Professor sees only aggregate metadata, not the student's written message.
        feedbacks: rows.slice(0, 20).map((row) => ({
          id: row.id,
          aulaId: row.aulaId,
          notaProfessor: row.notaProfessor,
          createdAt: row.createdAt,
          createdAtMs: row.createdAtMs,
        })),
      });
      return;
    }

    sendJson(res, 200, {
      summary: summarize(rows),
      feedbacks: rows,
    });
  } catch (error) {
    console.error("[api] live lesson feedbacks list failed", {
      message: error?.message,
      code: error?.code,
      details: error?.details,
      hint: error?.hint,
    });
    sendJson(res, 500, { error: "feedbacks_failed" });
  }
};
