const { supabaseFetch } = require("./supabase-rest");

const LESSONS_TABLE = "n8n_aulas_pedagogicas_space";
const REGISTERS_TABLE = "n8n_registros_aula_space";

const normalizeRole = (role) => {
  const raw = String(role || "").trim().toLowerCase();
  if (raw === "admin" || raw === "coord" || raw === "coordenacao") return "admin";
  if (raw === "teacher" || raw === "professor") return "teacher";
  if (raw === "student" || raw === "aluno") return "student";
  return raw;
};

const isAdminRole = (role) => normalizeRole(role) === "admin";
const isTeacherRole = (role) => normalizeRole(role) === "teacher";
const isStudentRole = (role) => normalizeRole(role) === "student";

const safeEncode = (value) => encodeURIComponent(String(value || ""));

const normalizeName = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const compactName = (value) => normalizeName(value).replace(/\s+/g, "");

const nameTokens = (value) =>
  normalizeName(value)
    .split(/\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 3);

const idsMatch = (a, b) => {
  const left = String(a || "").trim();
  const right = String(b || "").trim();
  return Boolean(left && right && left === right);
};

const namesMatch = (a, b) => {
  const left = normalizeName(a);
  const right = normalizeName(b);
  if (!left || !right) return false;
  if (left === right) return true;
  const leftCompact = compactName(left);
  const rightCompact = compactName(right);
  if (leftCompact && rightCompact && (leftCompact.includes(rightCompact) || rightCompact.includes(leftCompact))) return true;
  const leftTokens = new Set(nameTokens(left));
  const rightTokens = nameTokens(right);
  return Boolean(rightTokens.length && rightTokens.every((token) => leftTokens.has(token)));
};

const personMatches = (session, id, name) =>
  idsMatch(session?.sub, id) ||
  namesMatch(session?.name, name) ||
  namesMatch(session?.email, name);

const getLessonStartMs = (lesson) => {
  const ms = Date.parse(String(lesson?.inicio || ""));
  return Number.isFinite(ms) ? ms : 0;
};

const getLessonEndMs = (lesson) => {
  const ms = Date.parse(String(lesson?.fim || ""));
  return Number.isFinite(ms) ? ms : 0;
};

const normalizeLesson = (row) => {
  if (!row || typeof row !== "object") return null;
  const id = String(row.id || "").trim();
  if (!id) return null;
  const status = String(row.status_aula || row.status || "agendada").trim().toLowerCase();
  return {
    id,
    aluno_id: row.aluno_id == null ? "" : String(row.aluno_id),
    aluno_nome: row.aluno_nome == null ? "" : String(row.aluno_nome),
    professor_id: row.professor_id == null ? "" : String(row.professor_id),
    professor_nome: row.professor_nome == null ? "" : String(row.professor_nome),
    titulo: row.titulo == null ? "" : String(row.titulo),
    status_aula: status || "agendada",
    inicio: row.inicio || null,
    fim: row.fim || null,
    timezone: row.timezone || "America/Sao_Paulo",
    video_provider: row.video_provider || "",
    video_room_id: row.video_room_id || "",
    video_room_url: row.video_room_url || "",
    video_join_url_aluno: row.video_join_url_aluno || "",
    video_join_url_professor: row.video_join_url_professor || "",
    video_status: row.video_status || "",
    google_calendar_id: row.google_calendar_id || "",
    google_event_id: row.google_event_id || "",
    google_meet_link_fallback: row.google_meet_link_fallback || "",
    origem: row.origem || "",
    plano: row.plano || row.aluno_plano || "",
    briefing_pedagogico: row.briefing_pedagogico || row.briefing || "",
    objetivo_aluno: row.objetivo_aluno || row.objetivo || "",
    nivel_declarado: row.nivel_declarado || row.nivel || "",
    observacoes: row.observacoes || row.observacao || "",
    created_at: row.created_at || null,
    updated_at: row.updated_at || null,
    startMs: getLessonStartMs(row),
    endMs: getLessonEndMs(row),
  };
};

const canAccessLesson = (session, lesson) => {
  const role = normalizeRole(session?.role);
  if (isAdminRole(role)) return true;
  if (isTeacherRole(role)) {
    return personMatches(session, lesson.professor_id, lesson.professor_nome);
  }
  if (isStudentRole(role)) {
    return personMatches(session, lesson.aluno_id, lesson.aluno_nome);
  }
  return false;
};

const canEditLesson = (session, lesson) => {
  const role = normalizeRole(session?.role);
  if (isAdminRole(role)) return true;
  if (isTeacherRole(role)) {
    return personMatches(session, lesson.professor_id, lesson.professor_nome);
  }
  return false;
};

const fetchLessonById = async (id) => {
  const query = `/${LESSONS_TABLE}?select=*&id=eq.${safeEncode(id)}&limit=1`;
  const { data } = await supabaseFetch(query);
  const row = Array.isArray(data) ? data[0] : null;
  return normalizeLesson(row);
};

const listLiveLessons = async ({ session, limit = 50, scope = "upcoming" } = {}) => {
  const role = normalizeRole(session?.role);
  const max = Math.max(1, Math.min(Number(limit) || 50, 200));
  const select = "select=*";
  const order = "order=inicio.asc.nullslast";
  const { data } = await supabaseFetch(`/${LESSONS_TABLE}?${select}&${order}&limit=${max}`);
  const now = Date.now();
  const oneDayAgo = now - 24 * 60 * 60 * 1000;
  return (Array.isArray(data) ? data : [])
    .map(normalizeLesson)
    .filter(Boolean)
    .filter((lesson) => canAccessLesson(session, lesson))
    .filter((lesson) => {
      if (scope === "dashboard") return !lesson.startMs || lesson.startMs >= oneDayAgo || lesson.endMs >= oneDayAgo;
      if (lesson.endMs) return lesson.endMs >= now;
      if (lesson.startMs) return lesson.startMs >= oneDayAgo;
      return true;
    });
};

const patchLesson = async (id, patch) => {
  const payload = {
    ...patch,
    updated_at: new Date().toISOString(),
  };
  const { data } = await supabaseFetch(`/${LESSONS_TABLE}?id=eq.${safeEncode(id)}`, {
    method: "PATCH",
    body: payload,
  });
  const row = Array.isArray(data) ? data[0] : null;
  return normalizeLesson(row);
};

const createLessonRegister = async ({ lesson, session, payload }) => {
  const now = new Date().toISOString();
  const status = String(payload?.status || "realizada").trim().toLowerCase();
  const register = {
    aula_id: lesson.id,
    aluno_id: lesson.aluno_id || null,
    aluno_nome: lesson.aluno_nome || null,
    professor_id: lesson.professor_id || null,
    professor_nome: lesson.professor_nome || null,
    status,
    conteudo_trabalhado: String(payload?.conteudo_trabalhado || "").trim() || null,
    observacoes: String(payload?.observacoes || "").trim() || null,
    engajamento: String(payload?.engajamento || "").trim() || null,
    humor: String(payload?.humor || "").trim() || null,
    dificuldades_percebidas: String(payload?.dificuldades_percebidas || "").trim() || null,
    proximo_foco: String(payload?.proximo_foco || "").trim() || null,
    motivo_falta: String(payload?.motivo_falta || "").trim() || null,
    nova_data: payload?.nova_data || null,
    registrado_por: String(session?.name || session?.email || session?.sub || "professor"),
    created_at: now,
    updated_at: now,
  };

  const { data } = await supabaseFetch(`/${REGISTERS_TABLE}`, {
    method: "POST",
    body: register,
  });
  const saved = Array.isArray(data) ? data[0] : data;
  const lessonPatch = { status_aula: status === "remarcada" ? "remarcada" : status === "falta" ? "falta" : "realizada" };
  if (status === "remarcada" && payload?.nova_data) lessonPatch.inicio = payload.nova_data;
  const updatedLesson = await patchLesson(lesson.id, lessonPatch);
  return { register: saved || register, lesson: updatedLesson };
};

const summarizeLiveLessons = (lessons) => {
  const now = Date.now();
  const todayKey = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  const statusOf = (lesson) => String(lesson.status_aula || "").toLowerCase();
  const isToday = (lesson) => {
    const d = lesson.inicio ? new Date(lesson.inicio) : null;
    if (!d || Number.isNaN(d.getTime())) return false;
    return new Intl.DateTimeFormat("en-CA", { timeZone: lesson.timezone || "America/Sao_Paulo" }).format(d) === todayKey;
  };
  const liveNow = lessons.filter((lesson) => statusOf(lesson) === "ao_vivo" || (lesson.startMs <= now && lesson.endMs >= now));
  return {
    liveNow: liveNow.length,
    upcomingToday: lessons.filter((lesson) => isToday(lesson) && lesson.startMs > now).length,
    waitingStart: lessons.filter((lesson) => statusOf(lesson) === "aguardando_inicio").length,
    noVideoRoom: lessons.filter((lesson) => !lesson.video_room_id && !lesson.video_room_url).length,
    noRegister: lessons.filter((lesson) => ["realizada", "pendente_registro"].includes(statusOf(lesson))).length,
    cancelled: lessons.filter((lesson) => statusOf(lesson) === "cancelada").length,
    teachersInClass: new Set(liveNow.map((lesson) => lesson.professor_id || lesson.professor_nome).filter(Boolean)).size,
    studentsInClass: new Set(liveNow.map((lesson) => lesson.aluno_id || lesson.aluno_nome).filter(Boolean)).size,
  };
};

const n8nTodo = async () => ({ ok: false, configured: false, message: "Webhook n8n ainda nao configurado." });

const createLiveLessonViaN8n = n8nTodo;
const createVideoRoomViaN8n = n8nTodo;
const rescheduleLiveLessonViaN8n = n8nTodo;
const cancelLiveLessonViaN8n = n8nTodo;
const notifyLessonStartedViaN8n = n8nTodo;
const notifyLessonFinishedViaN8n = n8nTodo;

module.exports = {
  LESSONS_TABLE,
  REGISTERS_TABLE,
  normalizeRole,
  isAdminRole,
  isTeacherRole,
  isStudentRole,
  normalizeLesson,
  canAccessLesson,
  canEditLesson,
  fetchLessonById,
  listLiveLessons,
  patchLesson,
  createLessonRegister,
  summarizeLiveLessons,
  createLiveLessonViaN8n,
  createVideoRoomViaN8n,
  rescheduleLiveLessonViaN8n,
  cancelLiveLessonViaN8n,
  notifyLessonStartedViaN8n,
  notifyLessonFinishedViaN8n,
};
