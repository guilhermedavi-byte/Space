const crypto = require("node:crypto");
const { readJsonBody, sendJson } = require("../../_lib/http");
const { supabaseFetch } = require("../../_lib/supabase-rest");

const LESSONS_TABLE = "n8n_aulas_pedagogicas_space";
const REPORTS_TABLE = "n8n_relatorios_pedagogicos_space";

const safeEncode = (value) => encodeURIComponent(String(value || ""));

const timingSafeEqual = (a, b) => {
  const left = Buffer.from(String(a || ""));
  const right = Buffer.from(String(b || ""));
  return left.length > 0 && left.length === right.length && crypto.timingSafeEqual(left, right);
};

const getMeetCode = (value) => {
  const raw = String(value || "").trim().toLowerCase();
  if (/^[a-z]{3}-[a-z]{4}-[a-z]{3}$/.test(raw)) return raw;
  const match = raw.match(/meet\.google\.com\/([a-z]{3}-[a-z]{4}-[a-z]{3})/i);
  return match?.[1]?.toLowerCase() || "";
};

const findLesson = async (body) => {
  const occurrenceId = String(body.calendar_uid || body.occurrence_id || "").trim();
  if (occurrenceId) {
    const { data } = await supabaseFetch(
      `/${LESSONS_TABLE}?select=*&occurrence_id=eq.${safeEncode(occurrenceId)}&limit=1`
    ).catch(() => ({ data: [] }));
    const row = Array.isArray(data) ? data[0] : null;
    if (row) return row;
  }

  const meetCode = getMeetCode(body.native_meeting_id || body.meeting_url);
  if (meetCode) {
    const { data } = await supabaseFetch(
      `/${LESSONS_TABLE}?select=*&google_meet_url=ilike.${safeEncode(`*${meetCode}*`)}&limit=1`
    ).catch(() => ({ data: [] }));
    const row = Array.isArray(data) ? data[0] : null;
    if (row) return row;
  }

  const referenceRaw = body.scheduled_at || body.meeting_start_time || body.started_at || "";
  const referenceMs = Date.parse(String(referenceRaw || ""));
  const studentName = String(body.student_name || body.student_name_guess || "").trim();

  if (Number.isFinite(referenceMs) && studentName) {
    const from = new Date(referenceMs - 2 * 60 * 60 * 1000).toISOString();
    const to = new Date(referenceMs + 2 * 60 * 60 * 1000).toISOString();
    const { data } = await supabaseFetch(
      `/${LESSONS_TABLE}?select=*&aluno_nome=ilike.${safeEncode(`*${studentName}*`)}&inicio=gte.${safeEncode(from)}&inicio=lte.${safeEncode(to)}&order=inicio.asc.nullslast&limit=10`
    ).catch(() => ({ data: [] }));

    const rows = Array.isArray(data) ? data : [];
    if (rows.length === 1) return rows[0];
  }

  return null;
};

const findExistingAudit = async ({ alunoId, meetingId }) => {
  if (!alunoId || meetingId == null) return null;

  const { data } = await supabaseFetch(
    `/${REPORTS_TABLE}?select=*&aluno_id=eq.${safeEncode(alunoId)}&tipo_relatorio=eq.auditoria_aula_ia&order=created_at.desc.nullslast&limit=30`
  ).catch(() => ({ data: [] }));

  const rows = Array.isArray(data) ? data : [];
  return rows.find((row) => String(row?.payload?.meeting_id ?? "") === String(meetingId)) || null;
};

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { error: "method_not_allowed" });
  }

  const expected = String(process.env.N8N_WEBHOOK_SECRET || "").trim();
  const supplied = String(req.headers["x-space-webhook-secret"] || "").trim();

  if (!expected || expected.length < 16) {
    return sendJson(res, 503, { error: "n8n_webhook_secret_not_configured" });
  }

  if (!timingSafeEqual(expected, supplied)) {
    return sendJson(res, 401, { error: "unauthorized" });
  }

  const body = await readJsonBody(req).catch(() => null);
  if (!body || typeof body !== "object") {
    return sendJson(res, 400, { error: "invalid_json" });
  }

  if (body.meeting_id == null || !body.analysis || typeof body.analysis !== "object") {
    return sendJson(res, 400, { error: "missing_audit_payload" });
  }

  try {
    const lesson = await findLesson(body);

    if (!lesson) {
      return sendJson(res, 404, {
        error: "lesson_not_found_for_audit",
        meeting_id: body.meeting_id,
      });
    }

    const alunoId = String(lesson.aluno_id || lesson.firestore_doc_id || "").trim();
    const alunoNome = String(lesson.aluno_nome || body.student_name_guess || "Aluno").trim();

    const existing = await findExistingAudit({
      alunoId,
      meetingId: body.meeting_id,
    });

    if (existing) {
      return sendJson(res, 200, {
        ok: true,
        saved: false,
        duplicate: true,
        report_id: existing.id,
        lesson_id: lesson.id,
        aluno_id: alunoId || null,
        aluno_nome: alunoNome,
      });
    }

    const now = new Date().toISOString();
    const reportPayload = {
      meeting_id: body.meeting_id,
      native_meeting_id: body.native_meeting_id || null,
      calendar_uid: body.calendar_uid || null,
      title: body.title || null,
      teacher_name: body.teacher_name || null,
      teacher_email: body.teacher_email || null,
      student_name_guess: body.student_name_guess || null,
      lesson_id: String(lesson.id || ""),
      audit_generated_at: body.audit_generated_at || now,
      transcript_quality: body.transcript_quality || null,
      timing_metrics: body.timing_metrics || null,
      talk_metrics: body.talk_metrics || null,
      analysis: body.analysis,
      report: body.report || "",
      transcript_source: body.transcript_source || null,
      fallback_used: body.fallback_used === true,
    };

    const metricas = {
      qualidade_dados: body.analysis?.qualidade_dados || null,
      horario: body.analysis?.horario || null,
      tempo_fala_aluno: body.analysis?.tempo_fala_aluno || null,
      tipo_aula: body.analysis?.tipo_aula || null,
    };

    const row = {
      tipo_relatorio: "auditoria_aula_ia",
      periodo_inicio: body.meeting_start_time || body.timing_metrics?.actual_class_start || null,
      periodo_fim: body.meeting_end_time || body.timing_metrics?.actual_class_end || null,
      resumo: String(body.report || "").trim() || "Auditoria pedagógica gerada automaticamente.",
      metricas,
      status: "concluido",
      canal: "n8n_vexa_openai",
      enviado_em: null,
      payload: reportPayload,
      aluno_id: alunoId || null,
      aluno_nome: alunoNome,
      onboarding_id: String(lesson.onboarding_id || "").trim() || null,
      created_at: now,
      updated_at: now,
    };

    const { data } = await supabaseFetch(`/${REPORTS_TABLE}`, {
      method: "POST",
      body: row,
    });

    const saved = Array.isArray(data) ? data[0] : data;

    return sendJson(res, 200, {
      ok: true,
      saved: true,
      duplicate: false,
      report_id: saved?.id ?? null,
      lesson_id: lesson.id,
      aluno_id: alunoId || null,
      aluno_nome: alunoNome,
    });
  } catch (error) {
    console.error("[n8n-pedagogical-audit]", {
      code: error?.code || "",
      message: String(error?.message || "").slice(0, 200),
    });

    return sendJson(res, 500, {
      error: "pedagogical_audit_save_failed",
    });
  }
};
