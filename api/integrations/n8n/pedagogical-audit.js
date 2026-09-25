const crypto = require("node:crypto");
const { readJsonBody, sendJson } = require("../../_lib/http");
const { supabaseFetch } = require("../../_lib/supabase-rest");

const LESSONS_TABLE = "n8n_aulas_pedagogicas_space";

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

// Calendar UIDs and Meet rooms repeat. Only a scheduled occurrence is unique.
const findLesson = async (body) => {
  const explicitId = String(body.lesson_id || "").trim();
  const scheduled = Date.parse(body.scheduled_at || body.timing_metrics?.scheduled_start || "");
  const occurrence = String(body.calendar_uid || body.occurrence_id || "").trim();
  const meet = getMeetCode(body.native_meeting_id || body.meeting_url);
  if (!explicitId && (!Number.isFinite(scheduled) || (!occurrence && !meet))) return null;
  const filter = explicitId
    ? `id=eq.${safeEncode(explicitId)}`
    : `${occurrence ? `occurrence_id=eq.${safeEncode(occurrence)}` : `google_meet_url=ilike.${safeEncode(`*${meet}*`)}`}&inicio=eq.${safeEncode(new Date(scheduled).toISOString())}`;
  const { data } = await supabaseFetch(`/${LESSONS_TABLE}?select=*&${filter}&limit=2`);
  if (!Array.isArray(data) || data.length !== 1) return null;
  const row = data[0];
  if (Number.isFinite(scheduled) && Date.parse(row.inicio || row.data_aula) !== scheduled) return null;
  if (occurrence && String(row.occurrence_id || "") !== occurrence) return null;
  if (meet && getMeetCode(row.google_meet_url) !== meet) return null;
  if (body.student_id && String(row.aluno_id) !== String(body.student_id)) return null;
  if ((body.professor_id || body.teacher_id) && String(row.professor_id) !== String(body.professor_id || body.teacher_id)) return null;
  return row;
};

const observe = (event, meetingId, lessonId = null) =>
  console.info("[n8n-pedagogical-audit]", { event, meeting_id: meetingId, lesson_id: lessonId });

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

  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(String(body.meeting_id || "")) || !body.analysis || typeof body.analysis !== "object" || Array.isArray(body.analysis) || (body.transcript != null && typeof body.transcript !== "string")) {
    observe("TRANSCRIPTION_INVALID_PAYLOAD", null);
    return sendJson(res, 400, { error: "missing_audit_payload" });
  }

  try {
    observe("TRANSCRIPTION_RECEIVED", body.meeting_id);
    const lesson = await findLesson(body);
    observe(lesson ? "TRANSCRIPTION_MATCHED_TO_LESSON" : "TRANSCRIPTION_LESSON_NOT_FOUND", body.meeting_id, lesson?.id);
    const alunoId = String(lesson?.aluno_id || "").trim();
    const alunoNome = String(lesson?.aluno_nome || "").trim();

    const now = new Date().toISOString();
    const reportPayload = {
      meeting_id: body.meeting_id,
      native_meeting_id: body.native_meeting_id || null,
      calendar_uid: body.calendar_uid || null,
      title: body.title || null,
      teacher_name: body.teacher_name || null,
      teacher_email: body.teacher_email || null,
      student_name_guess: body.student_name_guess || null,
      lesson_id: lesson ? String(lesson.id) : null,
      professor_id: lesson?.professor_id || null,
      scheduled_at: body.scheduled_at || body.timing_metrics?.scheduled_start || null,
      recording_id: body.recording_id || null,
      linkage_status: lesson ? "matched" : "pending",
      transcript: typeof body.transcript === "string" ? body.transcript.trim() : "",
      segments: Array.isArray(body.segments) ? body.segments.map(({ text, speaker, start, end }) => ({ text, speaker, start, end })) : [],
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
      status: lesson ? "concluido" : "aguardando_vinculo",
      canal: "n8n_pedagogical_audit",
      enviado_em: null,
      payload: reportPayload,
      aluno_id: alunoId || null,
      aluno_nome: alunoNome,
      onboarding_id: String(lesson?.onboarding_id || "").trim() || null,
      created_at: now,
      updated_at: now,
    };

    const { data } = await supabaseFetch("/rpc/upsert_pedagogical_audit", {
      method: "POST",
      body: { p_report: row },
    });

    const saved = Array.isArray(data) ? data[0] : data;

    observe("TRANSCRIPTION_SAVED", body.meeting_id, lesson?.id);
    if (lesson && saved?.payload?.transcript) observe("TRANSCRIPTION_AVAILABLE", body.meeting_id, lesson.id);
    return sendJson(res, lesson ? 200 : 202, {
      ok: true,
      linked: Boolean(lesson),
      transcription_available: Boolean(lesson && saved?.payload?.transcript),
      saved: true,
      report_id: saved?.id ?? null,
      lesson_id: lesson?.id || null,
      aluno_id: alunoId || null,
      aluno_nome: alunoNome,
    });
  } catch (error) {
    console.error("[n8n-pedagogical-audit]", {
      event: "TRANSCRIPTION_SAVE_FAILED",
      code: /^[A-Z0-9_]+$/i.test(error?.code || "") ? error.code : "save_failed",
    });

    return sendJson(res, 500, {
      error: "pedagogical_audit_save_failed",
    });
  }
};
