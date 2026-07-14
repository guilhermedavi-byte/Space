const { supabaseFetch } = require("./supabase-rest");
const { listTeacherLessons } = require("./pedagogico-service");

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

const extractMissingColumns = (error) => {
  const source = [
    error?.message,
    error?.details,
    error?.hint,
    error?.data?.message,
    error?.data?.details,
    error?.data?.hint,
  ]
    .map((part) => String(part || ""))
    .filter(Boolean)
    .join("\n");
  const columns = new Set();
  let match;
  const patterns = [
    /'([^']+)'\s+column/gi,
    /column\s+"([^"]+)"/gi,
    /column\s+([a-zA-Z0-9_]+)\s+of relation/gi,
  ];
  patterns.forEach((pattern) => {
    while ((match = pattern.exec(source))) {
      if (match[1]) columns.add(match[1]);
    }
  });
  return [...columns];
};

const omitKeys = (obj, keys) => {
  const blocked = new Set(Array.isArray(keys) ? keys : []);
  return Object.fromEntries(Object.entries(obj || {}).filter(([key]) => !blocked.has(key)));
};

const supabaseWriteWithColumnFallback = async (path, options, { requiredKeys = [] } = {}) => {
  const required = new Set(requiredKeys);
  let body = options?.body && typeof options.body === "object" ? options.body : {};
  let lastError = null;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      return await supabaseFetch(path, { ...options, body });
    } catch (error) {
      lastError = error;
      const missing = extractMissingColumns(error).filter((key) => key && !required.has(key) && Object.prototype.hasOwnProperty.call(body, key));
      if (!missing.length) throw error;
      body = omitKeys(body, missing);
    }
  }

  throw lastError || new Error("supabase_write_failed");
};

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
  const rightSet = new Set(rightTokens);
  return Boolean(
    (rightTokens.length && rightTokens.every((token) => leftTokens.has(token))) ||
      (leftTokens.size && [...leftTokens].every((token) => rightSet.has(token)))
  );
};

const emailsMatch = (a, b) => {
  const left = String(a || "").trim().toLowerCase();
  const right = String(b || "").trim().toLowerCase();
  return Boolean(left && right && left === right);
};

const personMatches = (session, id, name, email) =>
  idsMatch(session?.sub, id) ||
  emailsMatch(session?.email, email) ||
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
    firestore_doc_id: row.firestore_doc_id == null ? "" : String(row.firestore_doc_id),
    onboarding_id: row.onboarding_id == null ? "" : String(row.onboarding_id),
    aluno_id: row.aluno_id == null ? "" : String(row.aluno_id),
    aluno_nome: row.aluno_nome == null ? "" : String(row.aluno_nome),
    aluno_email: row.aluno_email || row.email || "",
    aluno_telefone: row.aluno_telefone || row.telefone || "",
    professor_id: row.professor_id == null ? "" : String(row.professor_id),
    professor_nome: row.professor_nome == null ? "" : String(row.professor_nome),
    professor_email: row.professor_email == null ? "" : String(row.professor_email),
    titulo: row.titulo == null ? "" : String(row.titulo),
    status_aula: status || "agendada",
    inicio: row.inicio || null,
    fim: row.fim || null,
    timezone: row.timezone || "America/Sao_Paulo",
    video_provider: row.video_provider || "",
    video_room_id: row.video_room_id || "",
    video_room_url: row.video_room_url || "",
    assignment_id: row.assignment_id == null ? "" : String(row.assignment_id),
    meeting_room_slug: row.meeting_room_slug || row.video_room_id || "",
    meeting_url: row.meeting_url || row.video_room_url || row.video_join_url_professor || row.link_aula || "",
    deleted_at: row.deleted_at || null,
    recording_enabled: Boolean(row.recording_enabled),
    video_join_url_aluno: row.video_join_url_aluno || "",
    video_join_url_professor: row.video_join_url_professor || "",
    link_aula:
      row.link_aula ||
      row.video_join_url_professor ||
      row.video_room_url ||
      row.google_meet_link_fallback ||
      "",
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
    return personMatches(session, lesson.professor_id, lesson.professor_nome, lesson.professor_email);
  }
  if (isStudentRole(role)) {
    return (
      personMatches(session, lesson.aluno_id, lesson.aluno_nome, lesson.aluno_email) ||
      idsMatch(String(session?.phone || "").replace(/\D+/g, ""), String(lesson.aluno_telefone || "").replace(/\D+/g, ""))
    );
  }
  return false;
};

const canEditLesson = (session, lesson) => {
  const role = normalizeRole(session?.role);
  if (isAdminRole(role)) return true;
  if (isTeacherRole(role)) {
    return personMatches(session, lesson.professor_id, lesson.professor_nome, lesson.professor_email);
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
  const max = Math.max(1, Math.min(Number(limit) || 50, 1000));
  const now = Date.now();
  const oneDayAgo = now - 24 * 60 * 60 * 1000;
  const historyStart = now - 45 * 24 * 60 * 60 * 1000;
  let data;
  if (role === "teacher") {
    data = await listTeacherLessons({ session, limit: max, includeHistoryDays: scope === "pedagogico" || scope === "dashboard" ? 45 : 2 });
  } else {
    const windowStart = scope === "dashboard" || scope === "pedagogico" ? historyStart : oneDayAgo;
    const result = await supabaseFetch(
      `/${LESSONS_TABLE}?select=*&fim=gte.${safeEncode(new Date(windowStart).toISOString())}&order=inicio.asc.nullslast&limit=${max}`
    );
    data = result.data;
  }
  return (Array.isArray(data) ? data : [])
    .map(normalizeLesson)
    .filter(Boolean)
    .filter((lesson) => canAccessLesson(session, lesson))
    .filter((lesson) => {
      if (scope === "dashboard" || scope === "pedagogico") {
        return !lesson.startMs || lesson.startMs >= historyStart || lesson.endMs >= historyStart;
      }
      if (lesson.endMs) return lesson.endMs >= now;
      if (lesson.startMs) return lesson.startMs >= oneDayAgo;
      return true;
    });
};

const listLessonRegisters = async ({ session, lessonIds = [], limit = 500 } = {}) => {
  const ids = new Set((Array.isArray(lessonIds) ? lessonIds : []).map((id) => String(id || "")).filter(Boolean));
  if (!ids.size) return [];
  const max = Math.max(1, Math.min(Number(limit) || 500, 1000));
  const { data } = await supabaseFetch(`/${REGISTERS_TABLE}?select=*&order=created_at.desc.nullslast&limit=${max}`);
  const role = normalizeRole(session?.role);
  return (Array.isArray(data) ? data : []).filter((row) => {
    if (!ids.has(String(row?.aula_id || ""))) return false;
    if (role === "admin") return true;
    if (role === "teacher") return personMatches(session, row?.professor_id, row?.professor_nome, row?.professor_email);
    if (role === "student") return personMatches(session, row?.aluno_id, row?.aluno_nome);
    return false;
  });
};

const patchLesson = async (id, patch) => {
  const payload = {
    ...patch,
    updated_at: new Date().toISOString(),
  };
  const { data } = await supabaseWriteWithColumnFallback(`/${LESSONS_TABLE}?id=eq.${safeEncode(id)}`, {
    method: "PATCH",
    body: payload,
  }, { requiredKeys: ["status_aula"] });
  const row = Array.isArray(data) ? data[0] : null;
  return normalizeLesson(row);
};

const findLessonRegisterByLessonId = async (lessonId) => {
  const id = String(lessonId || "").trim();
  if (!id) return null;
  const { data } = await supabaseFetch(
    `/${REGISTERS_TABLE}?select=*&aula_id=eq.${safeEncode(id)}&order=updated_at.desc.nullslast&limit=1`
  );
  return Array.isArray(data) ? data[0] || null : null;
};

const createLessonRegister = async ({ lesson, session, payload }) => {
  const now = new Date().toISOString();
  const status = String(payload?.status || "realizada").trim().toLowerCase();
  const register = {
    aula_id: lesson.id,
    firestore_doc_id: lesson.firestore_doc_id || lesson.aluno_id || null,
    onboarding_id: payload?.onboarding_id || lesson.onboarding_id || null,
    aluno_id: lesson.aluno_id || null,
    aluno_nome: lesson.aluno_nome || null,
    professor_id: lesson.professor_id || null,
    professor_nome: lesson.professor_nome || null,
    professor_email: lesson.professor_email || null,
    status,
    conteudo_trabalhado: String(payload?.conteudo_trabalhado || "").trim() || null,
    conteudo_aula: String(payload?.conteudo_aula || payload?.conteudo_trabalhado || "").trim() || null,
    gramatica_trabalhada: String(payload?.gramatica_trabalhada || "").trim() || null,
    vocabulario_trabalhado: String(payload?.vocabulario_trabalhado || "").trim() || null,
    pronuncia_conversacao: String(payload?.pronuncia_conversacao || "").trim() || null,
    atividade_realizada: String(payload?.atividade_realizada || "").trim() || null,
    materiais_usados: String(payload?.materiais_usados || "").trim() || null,
    desempenho_aluno: String(payload?.desempenho_aluno || payload?.desempenho || "").trim() || null,
    observacoes: String(payload?.observacoes || "").trim() || null,
    engajamento: String(payload?.engajamento || "").trim() || null,
    confianca: String(payload?.confianca || "").trim() || null,
    humor: String(payload?.humor || "").trim() || null,
    humor_aluno: String(payload?.humor_aluno || payload?.humor || "").trim() || null,
    estrelas: Number.isFinite(Number(payload?.estrelas || payload?.nota)) ? Number(payload?.estrelas || payload?.nota) : null,
    homework: String(payload?.homework || payload?.tarefa || "").trim() || null,
    dificuldades_percebidas: String(payload?.dificuldades_percebidas || "").trim() || null,
    proximo_foco: String(payload?.proximo_foco || payload?.proxima_recomendacao || "").trim() || null,
    proxima_recomendacao: String(payload?.proxima_recomendacao || payload?.proximo_foco || "").trim() || null,
    proxima_aula_recomendada:
      String(payload?.proxima_aula_recomendada || payload?.proxima_recomendacao || payload?.proximo_foco || "").trim() || null,
    motivo_falta: String(payload?.motivo_falta || "").trim() || null,
    observacoes_falta: String(payload?.observacoes_falta || (status === "falta" ? payload?.observacoes : "") || "").trim() || null,
    responsavel_falta: String(payload?.responsavel_falta || "").trim() || null,
    reposicao_necessaria: Boolean(payload?.reposicao_necessaria),
    nova_data: payload?.nova_data || null,
    nova_data_aula: payload?.nova_data_aula || payload?.nova_data || null,
    tipo_remarcacao: String(payload?.tipo || payload?.tipo_remarcacao || "").trim() || null,
    tipo_movimento: String(payload?.tipo_movimento || payload?.tipo || payload?.tipo_remarcacao || "").trim() || null,
    motivo_remarcacao: String(payload?.motivo_remarcacao || "").trim() || null,
    responsavel_remarcacao: String(payload?.responsavel_remarcacao || "").trim() || null,
    data_aviso_remarcacao: String(payload?.data_aviso_remarcacao || "").trim() || null,
    elegibilidade: payload?.elegibilidade && typeof payload.elegibilidade === "object" ? payload.elegibilidade : null,
    situacao_reposicao: String(payload?.situacao_reposicao || "").trim() || null,
    needs_admin_review: Boolean(payload?.needs_admin_review),
    registrado_por: String(session?.name || session?.email || session?.sub || "professor"),
    created_at: now,
    updated_at: now,
  };

  const existing = await findLessonRegisterByLessonId(lesson.id).catch(() => null);
  const writePath = existing?.id
    ? `/${REGISTERS_TABLE}?id=eq.${safeEncode(existing.id)}`
    : `/${REGISTERS_TABLE}`;
  const writeMethod = existing?.id ? "PATCH" : "POST";
  const writeBody = existing?.id ? { ...register, created_at: existing.created_at || register.created_at } : register;
  const { data } = await supabaseWriteWithColumnFallback(writePath, {
    method: writeMethod,
    body: writeBody,
  }, { requiredKeys: ["aula_id", "status"] });
  const saved = Array.isArray(data) ? data[0] : data;
  const lessonPatch = {
    status_aula:
      status === "remarcada" ? "remarcada" : status === "falta" ? "falta" : status === "cancelada" ? "cancelada" : "realizada",
  };
  if (status === "remarcada" && (payload?.nova_data_aula || payload?.nova_data)) {
    lessonPatch.inicio = payload.nova_data_aula || payload.nova_data;
  }
  const updatedLesson = await patchLesson(lesson.id, lessonPatch);
  return { register: saved || register, lesson: updatedLesson };
};

const summarizeLiveLessons = (lessons, now = Date.now()) => {
  const todayKey = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  const statusOf = (lesson) => String(lesson.status_aula || "").toLowerCase();
  const isToday = (lesson) => {
    const d = lesson.inicio ? new Date(lesson.inicio) : null;
    if (!d || Number.isNaN(d.getTime())) return false;
    return new Intl.DateTimeFormat("en-CA", { timeZone: lesson.timezone || "America/Sao_Paulo" }).format(d) === todayKey;
  };
  const terminalStatuses = new Set(["realizada", "falta", "cancelada", "remarcada"]);
  const liveNow = lessons.filter((lesson) => {
    const status = statusOf(lesson);
    if (terminalStatuses.has(status)) return false;
    const start = Number(lesson.startMs) || Date.parse(String(lesson.inicio || ""));
    const end = Number(lesson.endMs) || Date.parse(String(lesson.fim || ""));
    if (!Number.isFinite(start) || !Number.isFinite(end)) return false;
    return start <= now && end >= now;
  });
  const staleLive = lessons.filter((lesson) => {
    if (statusOf(lesson) !== "ao_vivo") return false;
    const end = Number(lesson.endMs) || Date.parse(String(lesson.fim || ""));
    return Number.isFinite(end) && end < now;
  });
  return {
    liveNow: liveNow.length,
    upcomingToday: lessons.filter((lesson) => isToday(lesson) && lesson.startMs > now).length,
    waitingStart: lessons.filter((lesson) => statusOf(lesson) === "aguardando_inicio").length,
    noVideoRoom: lessons.filter((lesson) => !lesson.video_room_id && !lesson.video_room_url).length,
    noRegister: lessons.filter((lesson) => ["realizada", "pendente_registro"].includes(statusOf(lesson))).length,
    cancelled: lessons.filter((lesson) => statusOf(lesson) === "cancelada").length,
    teachersInClass: new Set(liveNow.map((lesson) => lesson.professor_id || lesson.professor_nome).filter(Boolean)).size,
    studentsInClass: new Set(liveNow.map((lesson) => lesson.aluno_id || lesson.aluno_nome).filter(Boolean)).size,
    staleLive: staleLive.length,
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
  listLessonRegisters,
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
