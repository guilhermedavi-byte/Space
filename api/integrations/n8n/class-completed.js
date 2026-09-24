const crypto = require("node:crypto");
const { readJsonBody, sendJson } = require("../../_lib/http");
const { supabaseFetch } = require("../../_lib/supabase-rest");
const { createLessonRegister, normalizeLesson } = require("../../_lib/live-lessons");

const LESSONS_TABLE = "n8n_aulas_pedagogicas_space";

const safeEncode = (value) => encodeURIComponent(String(value || ""));

const timingSafeEqual = (a, b) => {
  const left = Buffer.from(String(a || ""));
  const right = Buffer.from(String(b || ""));
  return left.length > 0 && left.length === right.length && crypto.timingSafeEqual(left, right);
};

const normalizeText = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const normalizeName = (value) =>
  normalizeText(value)
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const compact = (value) => normalizeName(value).replace(/\s+/g, "");

const namesMatch = (a, b) => {
  const left = normalizeName(a);
  const right = normalizeName(b);
  if (!left || !right) return false;
  if (left === right) return true;
  const lc = compact(left);
  const rc = compact(right);
  return Boolean(lc && rc && (lc.includes(rc) || rc.includes(lc)));
};

const getMeetCode = (value) => {
  const raw = String(value || "").trim().toLowerCase();
  if (/^[a-z]{3}-[a-z]{4}-[a-z]{3}$/.test(raw)) return raw;
  const match = raw.match(/meet\.google\.com\/([a-z]{3}-[a-z]{4}-[a-z]{3})/i);
  return match?.[1]?.toLowerCase() || "";
};

const deriveStudentName = (body = {}) => {
  const explicit = String(body.student_name || body.student_name_guess || "").trim();
  if (explicit) return explicit;
  const title = String(body.title || "").trim();
  if (!title) return "";
  return title
    .replace(/^aula\s+/i, "")
    .replace(/\s*[-–—]\s*teacher\s+.+$/i, "")
    .trim();
};

const scoreCandidate = ({ row, body, referenceMs }) => {
  const lesson = normalizeLesson(row);
  if (!lesson) return { score: -1, direct: false, reasons: [] };

  let score = 0;
  let direct = false;
  const reasons = [];
  const meetCode = getMeetCode(body.native_meeting_id || body.meeting_url);

  const links = [
    lesson.meeting_url,
    lesson.video_room_url,
    lesson.video_join_url_aluno,
    lesson.video_join_url_professor,
    lesson.link_aula,
    lesson.google_meet_link_fallback,
  ]
    .map((value) => String(value || "").toLowerCase())
    .filter(Boolean);

  if (meetCode && links.some((value) => value.includes(meetCode))) {
    score += 120;
    direct = true;
    reasons.push("meet_code");
  }

  const calendarUid = String(body.calendar_uid || "").trim();
  if (calendarUid) {
    const eventIds = [
      lesson.google_event_id,
      lesson.occurrence_id,
      row?.google_event_id,
      row?.occurrence_id,
    ]
      .map((value) => String(value || "").trim())
      .filter(Boolean);

    if (eventIds.some((value) => value === calendarUid || calendarUid.startsWith(value) || value.startsWith(calendarUid))) {
      score += 90;
      direct = true;
      reasons.push("calendar_uid");
    }
  }

  const teacherEmail = normalizeText(body.teacher_email);
  const lessonTeacherEmail = normalizeText(lesson.professor_email);
  if (teacherEmail && lessonTeacherEmail && teacherEmail === lessonTeacherEmail) {
    score += 35;
    reasons.push("teacher_email");
  }

  const studentName = deriveStudentName(body);
  if (studentName && lesson.aluno_nome && namesMatch(studentName, lesson.aluno_nome)) {
    score += 30;
    reasons.push("student_name");
  }

  const title = normalizeName(body.title);
  const lessonTitle = normalizeName(lesson.titulo);
  if (title && lessonTitle && (title === lessonTitle || compact(title) === compact(lessonTitle))) {
    score += 20;
    reasons.push("title");
  }

  const lessonStartMs = Date.parse(String(lesson.inicio || ""));
  if (Number.isFinite(referenceMs) && Number.isFinite(lessonStartMs)) {
    const deltaMin = Math.abs(lessonStartMs - referenceMs) / 60000;
    if (deltaMin <= 10) {
      score += 30;
      reasons.push("time_10m");
    } else if (deltaMin <= 30) {
      score += 20;
      reasons.push("time_30m");
    } else if (deltaMin <= 90) {
      score += 10;
      reasons.push("time_90m");
    }
  }

  return { score, direct, reasons, lesson };
};

const fetchCandidateLessons = async (body) => {
  const referenceRaw = body.scheduled_at || body.meeting_start_time || body.started_at || "";
  const referenceMs = Date.parse(String(referenceRaw || ""));

  if (!Number.isFinite(referenceMs)) {
    const error = new Error("missing_reference_time");
    error.code = "missing_reference_time";
    throw error;
  }

  const from = new Date(referenceMs - 6 * 60 * 60 * 1000).toISOString();
  const to = new Date(referenceMs + 6 * 60 * 60 * 1000).toISOString();
  const path =
    `/${LESSONS_TABLE}?select=*&inicio=gte.${safeEncode(from)}&inicio=lte.${safeEncode(to)}&order=inicio.asc.nullslast&limit=200`;

  const { data } = await supabaseFetch(path);
  return {
    rows: Array.isArray(data) ? data : [],
    referenceMs,
  };
};

const resolveLesson = async (body) => {
  const { rows, referenceMs } = await fetchCandidateLessons(body);
  const scored = rows
    .map((row) => scoreCandidate({ row, body, referenceMs }))
    .filter((item) => item.lesson)
    .sort((a, b) => b.score - a.score);

  const top = scored[0];
  const second = scored[1];

  if (!top || top.score < 60) {
    return {
      ok: false,
      reason: "lesson_not_found",
      topScore: top?.score ?? null,
      candidateCount: scored.length,
    };
  }

  if (!top.direct && second && second.score >= top.score - 10) {
    return {
      ok: false,
      reason: "lesson_ambiguous",
      topScore: top.score,
      secondScore: second.score,
      candidateCount: scored.length,
    };
  }

  return {
    ok: true,
    lesson: top.lesson,
    score: top.score,
    direct: top.direct,
    reasons: top.reasons,
  };
};

const buildRegisterPayload = (body, lesson) => {
  const audit = body.audit && typeof body.audit === "object" ? body.audit : {};
  const tipo = String(audit?.tipo_aula?.tipo || "").trim();
  const tema = String(audit?.tipo_aula?.estrutura_ou_tema || "").trim();
  const conteudo =
    String(body.conteudo_aula || body.conteudo_trabalhado || "").trim() ||
    [tipo, tema].filter(Boolean).join(" — ") ||
    "Aula realizada automaticamente via Vexa";

  const observacoesBase = String(body.observacoes || "").trim();
  const observacoes =
    observacoesBase ||
    "Registro automático: aula confirmada como concluída pelo Vexa.";

  return {
    status: "realizada",
    onboarding_id: body.onboarding_id || lesson.onboarding_id || "",
    conteudo_aula: conteudo,
    conteudo_trabalhado: conteudo,
    observacoes,
    homework: String(audit?.tarefa_casa?.descricao || body.homework || ""),
    proxima_aula_recomendada: String(body.proxima_aula_recomendada || ""),
  };
};

const handler = async (req, res) => {
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

  const status = String(body.status || body.meeting_status || "").trim().toLowerCase();
  if (status && !["completed", "realizada", "finished", "ended"].includes(status)) {
    return sendJson(res, 409, {
      error: "meeting_not_completed",
      status,
    });
  }

  try {
    const resolved = await resolveLesson(body);
    if (!resolved.ok) {
      const httpStatus = resolved.reason === "lesson_ambiguous" ? 409 : 404;
      return sendJson(res, httpStatus, {
        error: resolved.reason,
        top_score: resolved.topScore ?? null,
        second_score: resolved.secondScore ?? null,
        candidate_count: resolved.candidateCount ?? 0,
      });
    }

    const lesson = resolved.lesson;

    if (String(lesson.status_aula || "").toLowerCase() === "realizada") {
      return sendJson(res, 200, {
        ok: true,
        saved: false,
        duplicate: true,
        lesson_id: lesson.id,
        occurrence_id: lesson.occurrence_id || null,
        match_score: resolved.score,
        match_reasons: resolved.reasons,
      });
    }

    const session = {
      sub: "n8n-vexa",
      role: "admin",
      name: "Space Automação",
      email: "n8n@space.internal",
    };

    const payload = buildRegisterPayload(body, lesson);
    const saved = await createLessonRegister({ lesson, session, payload });

    return sendJson(res, 200, {
      ok: true,
      saved: true,
      duplicate: false,
      lesson_id: lesson.id,
      occurrence_id: lesson.occurrence_id || null,
      register_id: saved?.register?.id || null,
      lesson_status: saved?.lesson?.status_aula || "realizada",
      match_score: resolved.score,
      match_reasons: resolved.reasons,
      matched_student: lesson.aluno_nome || null,
      matched_teacher: lesson.professor_nome || null,
    });
  } catch (error) {
    const code = String(error?.code || error?.message || "class_completed_failed");
    if (code === "missing_reference_time") {
      return sendJson(res, 400, { error: "missing_reference_time" });
    }

    console.error("[n8n-class-completed]", {
      code,
      message: String(error?.message || "").slice(0, 200),
    });

    return sendJson(res, 500, {
      error: "class_completed_failed",
    });
  }
};

handler._test = {
  getMeetCode,
  deriveStudentName,
  scoreCandidate,
  namesMatch,
};

module.exports = handler;
