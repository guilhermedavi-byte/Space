const crypto = require("crypto");

const { readJsonBody, sendJson } = require("../_lib/http");
const { getSessionFromRequest } = require("../_lib/session");
const { verifyFirebaseIdToken } = require("../_lib/firebase-id-token");
const { listCollectionAsAdmin } = require("./_lib/firestore-admin");
const { DEFAULT_CONFIG } = require("../_lib/scheduling-firestore");
const { fetchUserProfileByUid } = require("../_lib/firestore-user");
const { supabaseFetch } = require("./_lib/supabase-rest");
const {
  addDaysToDateKey,
  clampInt,
  getDayOfWeekFromDateKey,
  isValidDateKey,
  minutesToTime,
  timeToMinutes,
  toUtcMsForDateKeyAndMinutes,
} = require("../_lib/scheduling-utils");
const {
  decodeFields,
  encodeFields,
  FIRESTORE_BASE,
  API_KEY,
  PROJECT_ID,
  firestoreDeleteDocument,
  firestoreGetDocument,
  firestoreListDocuments,
  firestorePatchDocument,
  firestoreRunQuery,
  getBearerTokenFromRequest,
  getDocIdFromName,
  requestJson,
} = require("../_lib/firestore-rest");

const DOW_TO_KEY = {
  0: "dom",
  1: "seg",
  2: "ter",
  3: "qua",
  4: "qui",
  5: "sex",
  6: "sab",
};

const normalizeRole = (role) => {
  const raw = String(role || "").trim().toLowerCase();
  if (raw === "admin" || raw === "administrador") return "admin";
  if (raw === "teacher" || raw === "professor") return "teacher";
  if (raw === "student" || raw === "aluno") return "student";
  return "";
};

const normalizeText = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const normalizeCompact = (value) => normalizeText(value).replace(/[^a-z0-9]+/g, "");

const nameTokens = (value) => normalizeText(value).split(/[^a-z0-9]+/).filter((token) => token.length >= 2);

const summarizeScheduleEventBody = (body) => {
  const repeat = body?.repeat && typeof body.repeat === "object" ? body.repeat : null;
  const days = repeat?.days && typeof repeat.days === "object" ? repeat.days : null;
  return {
    id: String(body?.id || "").trim(),
    eventType: String(body?.eventType || "").trim(),
    title: String(body?.title || "").trim(),
    description: String(body?.description || "").trim(),
    alunoId: body?.alunoId ?? body?.studentId ?? null,
    professorId: body?.professorId ?? body?.teacherId ?? null,
    dateKey: String(body?.dateKey || "").trim(),
    startMin: body?.startMin ?? body?.horaInicio ?? body?.startTime ?? null,
    endMin: body?.endMin ?? body?.horaFim ?? body?.endTime ?? null,
    recorrente: Boolean(body?.recorrente),
    repeatMode: String(body?.repeatMode || body?.recurrenceMode || "").trim(),
    repeat: repeat
      ? {
          enabled: Boolean(repeat.enabled),
          type: String(repeat.type || "").trim(),
          weekday: String(repeat.weekday || "").trim(),
          dayOfMonth: repeat.dayOfMonth ?? null,
          daysCount: days ? Object.keys(days).length : 0,
        }
      : null,
    grupoRecorrenciaId: String(body?.grupoRecorrenciaId || "").trim(),
    guestsCount: Array.isArray(body?.guests) ? body.guests.length : 0,
    documentsCount: Array.isArray(body?.documents) ? body.documents.length : 0,
  };
};

const logScheduleEventsError = ({ point, error, body, extra = {} }) => {
  try {
    // eslint-disable-next-line no-console
    console.error("[schedule-events] create/update failure", {
      point,
      payload: summarizeScheduleEventBody(body),
      error: {
        message: error?.message,
        stack: error?.stack,
        code: error?.code,
        status: error?.status,
        details: error?.details,
        hint: error?.hint,
      },
      ...extra,
    });
  } catch (loggingError) {
    // eslint-disable-next-line no-console
    console.error("[schedule-events] failed while logging create/update failure", {
      point,
      originalError: {
        message: error?.message,
        stack: error?.stack,
        code: error?.code,
        status: error?.status,
      },
      loggingError: {
        message: loggingError?.message,
        stack: loggingError?.stack,
      },
      ...extra,
    });
  }
};

const namesMatch = (a, b) => {
  const left = normalizeText(a);
  const right = normalizeText(b);
  if (!left || !right) return false;
  if (left === right) return true;
  const leftCompact = normalizeCompact(left);
  const rightCompact = normalizeCompact(right);
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

const phonesMatch = (a, b) => {
  const left = String(a || "").replace(/\D+/g, "");
  const right = String(b || "").replace(/\D+/g, "");
  return Boolean(left && right && left === right);
};

const buildId = (prefix) => {
  const rand = crypto.randomBytes(6).toString("hex");
  return `${prefix}_${Date.now()}_${rand}`;
};

const slugifyRoomPart = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);

const buildLiveRoomId = ({ eventId, alunoNome, professorNome, dateKey, startMin }) => {
  const parts = [
    "space-aula",
    slugifyRoomPart(alunoNome) || "aluno",
    slugifyRoomPart(professorNome) || "professor",
    String(dateKey || "").replace(/-/g, ""),
    String(startMin || 0),
    String(eventId || "").slice(-6),
  ].filter(Boolean);
  return parts.join("-");
};

const createLiveLessonMirror = async ({ eventId, data, startMs, endMs } = {}) => {
  if (!data || !data.alunoId) return null;
  const roomId = buildLiveRoomId({
    eventId,
    alunoNome: data.alunoNome,
    professorNome: data.professorNome,
    dateKey: data.dateKey,
    startMin: data.startMin,
  });
  const baseUrl = String(process.env.JITSI_BASE_URL || "https://meet.jit.si").replace(/\/+$/, "");
  const now = new Date().toISOString();
  const payload = {
    aluno_id: data.alunoId || null,
    aluno_nome: data.alunoNome || null,
    aluno_email: data.alunoEmail || null,
    aluno_telefone: data.alunoTelefone || null,
    professor_id: data.professorId || null,
    professor_nome: data.professorNome || null,
    titulo: data.alunoNome ? `Aula ao vivo - ${data.alunoNome}` : "Aula ao vivo Space",
    status_aula: "agendada",
    inicio: new Date(startMs).toISOString(),
    fim: new Date(endMs).toISOString(),
    timezone: "America/Sao_Paulo",
    video_provider: "jitsi",
    video_room_id: roomId,
    video_room_url: `${baseUrl}/${encodeURIComponent(roomId)}`,
    video_status: "ready",
    origem: "plataforma",
    plano: null,
    created_at: now,
    updated_at: now,
  };

  if (data.dateKey) payload.data_aula = data.dateKey;
  if (data.observacoes) {
    payload.observacoes = data.observacoes;
    payload.briefing_pedagogico = data.observacoes;
  }

  const insertPayload = async (body) => {
    const { data: inserted } = await supabaseFetch("/n8n_aulas_pedagogicas_space", {
      method: "POST",
      body,
    });
    const row = Array.isArray(inserted) ? inserted[0] : inserted;
    return row && row.id != null ? String(row.id) : null;
  };

  try {
    return await insertPayload(payload);
  } catch (error) {
    if (error?.code === "PGRST204" || /Could not find|column/i.test(String(error?.message || ""))) {
      const fallbackPayload = {
        aluno_id: payload.aluno_id,
        aluno_nome: payload.aluno_nome,
        professor_id: payload.professor_id,
        professor_nome: payload.professor_nome,
        status_aula: payload.status_aula,
        inicio: payload.inicio,
        fim: payload.fim,
        timezone: payload.timezone,
        video_provider: payload.video_provider,
        video_room_id: payload.video_room_id,
        video_room_url: payload.video_room_url,
        video_status: payload.video_status,
        origem: payload.origem,
        data_aula: payload.data_aula,
        created_at: payload.created_at,
        updated_at: payload.updated_at,
      };
      try {
        return await insertPayload(fallbackPayload);
      } catch (fallbackError) {
        error = fallbackError;
      }
    }
    // The old agenda must keep working even if a legacy Supabase schema rejects a mirror field.
    console.error("[schedule-events] live lesson mirror failed", {
      message: error?.message,
      code: error?.code,
      details: error?.details,
      hint: error?.hint,
    });
    return null;
  }
};

const getUserNameById = async ({ idToken, uid }) => {
  const safeUid = String(uid || "").trim();
  if (!safeUid) return null;
  const snap = await firestoreGetDocument({ docPath: `users/${encodeURIComponent(safeUid)}`, idToken });
  if (!snap.ok) return null;
  const fields = decodeFields(snap.data);
  const name = typeof fields?.nome === "string" ? fields.nome.trim() : "";
  return name || null;
};

const parseMinutes = (value) => {
  if (typeof value === "number" && Number.isFinite(value)) return clampInt(value, 0, 1440);
  const str = typeof value === "string" ? value.trim() : "";
  if (!str) return null;
  const parsed = timeToMinutes(str);
  return Number.isFinite(parsed) ? clampInt(parsed, 0, 1440) : null;
};

const normalizeRepeatMode = (raw) => {
  const mode = String(raw || "").trim().toLowerCase();
  if (!mode) return "weekly";
  if (mode === "daily" || mode === "diaria" || mode === "daily_mon_sat" || mode === "diaria_seg_sab") return "daily";
  return "weekly";
};

const isHiddenAulaStatus = (value) => {
  const raw = String(value || "").trim().toLowerCase();
  return raw === "cancelada" || raw === "cancelado" || raw === "cancelled" || raw === "canceled" || raw === "deleted";
};

const WEEKDAY_TO_DOW = {
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
  // pt-BR shorthands (for safety)
  seg: 1,
  ter: 2,
  qua: 3,
  qui: 4,
  sex: 5,
  sab: 6,
};

const normalizeWeekdayKey = (raw) => {
  const key = String(raw || "").trim().toLowerCase();
  return WEEKDAY_TO_DOW[key] != null ? key : "";
};

const nextDateKeyOnOrAfterDow = (dateKey, targetDow) => {
  const baseKey = String(dateKey || "").trim();
  if (!isValidDateKey(baseKey)) return null;
  const baseDow = getDayOfWeekFromDateKey(baseKey);
  if (baseDow == null) return null;
  const safeTarget = clampInt(targetDow, 0, 6);
  const delta = (safeTarget - baseDow + 7) % 7;
  return addDaysToDateKey(baseKey, delta);
};

const buildOccurrences = ({ dateKey, recorrente, repeatMode }) => {
  if (!recorrente) return [dateKey];
  const mode = normalizeRepeatMode(repeatMode);

  if (mode === "daily") {
    // From the selected date forward, for the next 12 weeks, Mon-Sat only.
    const out = [];
    for (let dayOffset = 0; dayOffset < 12 * 7; dayOffset += 1) {
      const key = addDaysToDateKey(dateKey, dayOffset);
      if (!key) continue;
      const dow = getDayOfWeekFromDateKey(key);
      if (dow == null || dow === 0) continue; // ignore Sunday
      out.push(key);
    }
    return out.length ? out : [dateKey];
  }

  // Weekly: same weekday for the next 12 weeks (including the selected date).
  const out = [];
  for (let w = 0; w < 12; w += 1) {
    const key = addDaysToDateKey(dateKey, w * 7);
    if (!key) continue;
    out.push(key);
  }
  return out.length ? out : [dateKey];
};

const buildCustomWeeklyOccurrences = ({ dateKey, days }) => {
  const baseKey = String(dateKey || "").trim();
  if (!isValidDateKey(baseKey)) return [];
  const arr = Array.isArray(days) ? days : [];

  const out = [];
  const seen = new Set();

  for (const raw of arr) {
    const weekdayKey = normalizeWeekdayKey(raw?.weekday);
    const targetDow = WEEKDAY_TO_DOW[weekdayKey];
    if (targetDow == null) continue;

    const startMin = parseMinutes(raw?.startMin ?? raw?.startTime);
    const endMin = parseMinutes(raw?.endMin ?? raw?.endTime);
    if (!Number.isFinite(startMin) || !Number.isFinite(endMin) || endMin <= startMin) continue;

    const firstKey = nextDateKeyOnOrAfterDow(baseKey, targetDow);
    if (!firstKey) continue;

    for (let w = 0; w < 12; w += 1) {
      const key = addDaysToDateKey(firstKey, w * 7);
      if (!key || !isValidDateKey(key)) continue;
      const uniq = `${key}:${startMin}:${endMin}`;
      if (seen.has(uniq)) continue;
      seen.add(uniq);
      out.push({ dateKey: key, startMin, endMin });
    }
  }

  return out;
};

const parseDateKeyParts = (dateKey) => {
  const raw = String(dateKey || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const y = Number(raw.slice(0, 4));
  const m = Number(raw.slice(5, 7));
  const d = Number(raw.slice(8, 10));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  return { y, m, d };
};

const toDateKey = (y, m, d) => {
  const yy = String(y).padStart(4, "0");
  const mm = String(m).padStart(2, "0");
  const dd = String(d).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
};

const lastDayOfMonthUtc = (y, m1) => {
  // m1 is 1-12
  return new Date(Date.UTC(y, m1, 0)).getUTCDate();
};

const buildMonthlyOccurrences = ({ dateKey, dayOfMonth }) => {
  const parts = parseDateKeyParts(dateKey);
  if (!parts) return [];
  const dom = clampInt(Number(dayOfMonth) || parts.d, 1, 31);

  const baseMs = Date.UTC(parts.y, parts.m - 1, parts.d);
  const endMs = baseMs + 84 * 24 * 60 * 60 * 1000; // 12 weeks window (3 months-ish)

  const out = [];
  for (let mo = 0; mo < 12; mo += 1) {
    const totalMonth = (parts.m - 1) + mo;
    const y = parts.y + Math.floor(totalMonth / 12);
    const m0 = totalMonth % 12; // 0-11
    const m1 = m0 + 1;
    const last = lastDayOfMonthUtc(y, m1);
    const d = Math.min(dom, last);
    const key = toDateKey(y, m1, d);
    if (!isValidDateKey(key)) continue;
    const ms = Date.UTC(y, m0, d);
    if (ms < baseMs) continue;
    if (ms > endMs) break;
    out.push(key);
  }
  return out.length ? out : [dateKey];
};

const decodeAulaDoc = (doc) => {
  if (!doc || typeof doc !== "object") return null;
  const id = doc.id ? String(doc.id) : getDocIdFromName(doc.name);
  if (!id) return null;
  const fields = doc.fields ? decodeFields(doc) : doc;

  const professorId = typeof fields.professorId === "string" ? fields.professorId : "";
  const alunoId = fields.alunoId == null ? null : typeof fields.alunoId === "string" ? fields.alunoId : null;

  const dateKey = typeof fields.dateKey === "string" ? fields.dateKey : "";
  const startMin = Number.isFinite(Number(fields.startMin)) ? clampInt(fields.startMin, 0, 1440) : parseMinutes(fields.horaInicio);
  const endMin = Number.isFinite(Number(fields.endMin)) ? clampInt(fields.endMin, 0, 1440) : parseMinutes(fields.horaFim);

  if (!professorId) return null;
  if (!isValidDateKey(dateKey)) return null;
  if (!Number.isFinite(startMin) || !Number.isFinite(endMin) || endMin <= startMin) return null;

  const professorNome = typeof fields.professorNome === "string" ? fields.professorNome.trim() : "";
  const alunoNome = typeof fields.alunoNome === "string" ? fields.alunoNome.trim() : "";
  const alunoEmail = typeof fields.alunoEmail === "string" ? fields.alunoEmail.trim().toLowerCase() : "";
  const alunoTelefone = typeof fields.alunoTelefone === "string" ? fields.alunoTelefone.trim() : "";

  const recorrente = typeof fields.recorrente === "boolean" ? fields.recorrente : false;
  const grupoRecorrenciaId = typeof fields.grupoRecorrenciaId === "string" ? fields.grupoRecorrenciaId : "";

  const title = typeof fields.title === "string" ? fields.title : "";
  const description = typeof fields.description === "string" ? fields.description : "";
  const guests = Array.isArray(fields.guests) ? fields.guests.filter((g) => typeof g === "string") : [];
  const documents = Array.isArray(fields.documents) ? fields.documents.filter((d) => d && typeof d === "object") : [];
  const liveLessonId = fields.liveLessonId == null ? null : String(fields.liveLessonId || "").trim() || null;

  return {
    id,
    professorId,
    alunoId,
    dateKey,
    startMin,
    endMin,
    status: String(fields.status || "").trim().toLowerCase() || "agendada",
    type: alunoId ? "lesson" : "manual",
    professorNome: professorNome || null,
    alunoNome: alunoNome || null,
    alunoEmail: alunoEmail || null,
    alunoTelefone: alunoTelefone || null,
    recorrente,
    grupoRecorrenciaId: grupoRecorrenciaId || null,
    title,
    description,
    guests,
    documents,
    liveLessonId,
  };
};

const parseDeleteModeFromUrl = (url) => {
  const mode = String(url?.searchParams?.get("mode") || "")
    .trim()
    .toLowerCase();
  return mode === "future" ? "future" : "single";
};

const parseDeleteIdFromUrl = (url, body) => {
  const fromQuery = String(url?.searchParams?.get("id") || "").trim();
  if (fromQuery) return fromQuery;
  const fromBody = String(body?.id || "").trim();
  return fromBody || "";
};

const decodeAulaCoreForDelete = (doc) => {
  if (!doc || typeof doc !== "object") return null;
  const id = getDocIdFromName(doc.name);
  if (!id) return null;
  const fields = decodeFields(doc);
  const professorId = typeof fields.professorId === "string" ? fields.professorId : "";
  const alunoId = fields.alunoId == null ? null : typeof fields.alunoId === "string" ? fields.alunoId : null;
  const dateKey = typeof fields.dateKey === "string" ? fields.dateKey : "";
  const startMinRaw = Number(fields.startMin);
  const endMinRaw = Number(fields.endMin);
  const startMin = Number.isFinite(startMinRaw) ? clampInt(startMinRaw, 0, 1440) : timeToMinutes(fields.horaInicio);
  const endMin = Number.isFinite(endMinRaw) ? clampInt(endMinRaw, 0, 1440) : timeToMinutes(fields.horaFim);
  const grupoRecorrenciaId = typeof fields.grupoRecorrenciaId === "string" ? fields.grupoRecorrenciaId : "";
  const criadoPor = typeof fields.criadoPor === "string" ? fields.criadoPor : "";

  if (!professorId) return null;
  if (!isValidDateKey(dateKey)) return null;
  if (!Number.isFinite(startMin) || !Number.isFinite(endMin) || endMin <= startMin) return null;

  const startMs = toUtcMsForDateKeyAndMinutes(dateKey, startMin, { tzOffsetMinutes: DEFAULT_CONFIG.tzOffsetMinutes });
  return {
    id,
    professorId,
    alunoId,
    dateKey,
    startMin,
    endMin,
    startMs: startMs || 0,
    grupoRecorrenciaId: grupoRecorrenciaId || null,
    criadoPor,
  };
};

const firestoreCommitWrites = async ({ idToken, writes } = {}) => {
  const token = String(idToken || "").trim();
  const arr = Array.isArray(writes) ? writes.filter(Boolean) : [];
  if (!token) throw new Error("missing_token");
  if (!arr.length) return { ok: true, status: 200, data: { writeResults: [] }, text: "" };

  const url = `${FIRESTORE_BASE}:commit?key=${encodeURIComponent(API_KEY)}`;
  return requestJson(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: { writes: arr },
  });
};

const toFirestoreDocName = (docPath) => {
  const path = String(docPath || "").replace(/^\/+/, "");
  // Commit "name" is a Firestore resource name, not a URL.
  // Example: projects/<projectId>/databases/(default)/documents/aulas/<docId>
  return `projects/${PROJECT_ID}/databases/(default)/documents/${path}`;
};

const toLogIdFromEventId = (eventId) => {
  const safe = String(eventId || "").trim();
  if (!safe) return "";
  const normalized = safe.replace(/[^\w-]/g, "_");
  return `log_${normalized}`;
};

  const decodeLessonLogDoc = (doc) => {
  if (!doc || typeof doc !== "object") return null;
  const id = getDocIdFromName(doc.name);
  if (!id) return null;
  const fields = decodeFields(doc);

  const eventId = typeof fields.eventId === "string" ? fields.eventId : "";
  const professorId = typeof fields.professorId === "string" ? fields.professorId : "";
  const alunoId = typeof fields.alunoId === "string" ? fields.alunoId : "";
  const dateKey = typeof fields.dateKey === "string" ? fields.dateKey : "";
  const statusAula = typeof fields.statusAula === "string" ? fields.statusAula : "";

  return {
    id,
    eventId,
    professorId,
    alunoId,
    dateKey,
    statusAula,
    atualizadoEm: fields.atualizadoEm instanceof Date ? fields.atualizadoEm.toISOString() : null,
    criadoEm: fields.criadoEm instanceof Date ? fields.criadoEm.toISOString() : null,
    payload: fields,
  };
};

const normalizeStatusAula = (raw) => {
  const s = String(raw || "").trim().toLowerCase();
  if (s === "realizada") return "realizada";
  if (s === "falta_aluno" || s === "falta" || s === "falta_do_aluno" || s === "falta do aluno") return "falta_aluno";
  if (s === "remarcada") return "remarcada";
  if (s === "cancelada") return "cancelada";
  return "";
};

const normalizeDifficulty = (raw) => {
  const s = String(raw || "").trim().toLowerCase();
  if (s === "muito_facil" || s === "muito fácil") return "muito_facil";
  if (s === "adequado") return "adequado";
  if (s === "desafiador") return "desafiador";
  if (s === "muito_dificil" || s === "muito difícil") return "muito_dificil";
  return "";
};

const normalizeEvolucao = (raw) => {
  const s = String(raw || "").trim().toLowerCase();
  if (s === "regressou") return "regressou";
  if (s === "estavel" || s === "estável") return "estavel";
  if (s === "evoluiu") return "evoluiu";
  if (s === "evoluiu_muito" || s === "evoluiu muito") return "evoluiu_muito";
  return "";
};

const normalizeCEFR = (raw) => {
  const s = String(raw || "").trim().toUpperCase();
  const allowed = new Set(["A1", "A2", "B1", "B2", "C1", "C2"]);
  return allowed.has(s) ? s : "";
};

const normalizeTopics = (raw) => {
  const arr = Array.isArray(raw) ? raw : [];
  const allowed = new Set(["Gramática", "Vocabulário", "Pronúncia", "Conversação", "Escrita", "Compreensão"]);
  const out = [];
  arr.forEach((item) => {
    const val = String(item || "").trim();
    if (allowed.has(val) && !out.includes(val)) out.push(val);
  });
  return out;
};

const normalizeOneOf = (raw, allowed) => {
  const s = String(raw || "").trim().toLowerCase();
  return allowed.includes(s) ? s : "";
};

const normalizeDuracaoReal = (raw) => {
  const s = String(raw || "").trim();
  const allowed = new Set(["15", "30", "45", "60", "60+"]);
  return allowed.has(s) ? s : "";
};

const handleLessonLogsApi = async (req, res, { idToken, role, requesterId, url } = {}) => {
  const effectiveRole = String(role || "");

  if (req.method === "GET" || req.method === "HEAD") {
    const eventId = String(url.searchParams.get("eventId") || "").trim();
    const professorIdParam = String(url.searchParams.get("professorId") || "").trim();
    const professorId = effectiveRole === "admin" && professorIdParam ? professorIdParam : requesterId;

    if (eventId) {
      const logId = toLogIdFromEventId(eventId);
      const docPath = `lessonLogs/${encodeURIComponent(logId)}`;
      const snap = await firestoreGetDocument({ docPath, idToken });
      if (!snap.ok) {
        sendJson(res, snap.status === 404 ? 200 : 500, { log: null });
        return;
      }
      const decoded = decodeLessonLogDoc(snap.data);
      sendJson(res, 200, { log: decoded });
      return;
    }

    try {
      const query = {
        from: [{ collectionId: "lessonLogs" }],
        where: {
          fieldFilter: {
            field: { fieldPath: "professorId" },
            op: "EQUAL",
            value: { stringValue: professorId },
          },
        },
      };

      const result = await firestoreRunQuery({ idToken, structuredQuery: query });
      if (!result.ok) throw new Error("firestore_query_failed");
      const rows = Array.isArray(result.data) ? result.data : [];
      const docs = rows.map((row) => row?.document).filter(Boolean);
      const logs = docs.map((doc) => decodeLessonLogDoc(doc)).filter(Boolean);
      sendJson(res, 200, { logs });
      return;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("[api] lesson-logs list failed", error);
      sendJson(res, 500, { error: "internal_error" });
      return;
    }
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, HEAD, POST");
    sendJson(res, 405, { error: "method_not_allowed" });
    return;
  }

  if (effectiveRole !== "teacher") {
    sendJson(res, 403, { error: "forbidden" });
    return;
  }

  let body;
  try {
    body = await readJsonBody(req);
  } catch (error) {
    sendJson(res, 400, { error: "invalid_json" });
    return;
  }

  const eventId = String(body?.eventId || "").trim();
  if (!eventId) {
    sendJson(res, 400, { error: "invalid_payload", missingFields: ["eventId"] });
    return;
  }

  const statusAula = normalizeStatusAula(body?.statusAula);
  if (!statusAula) {
    sendJson(res, 400, { error: "invalid_payload", missingFields: ["statusAula"] });
    return;
  }

  const now = new Date();
  const logId = toLogIdFromEventId(eventId);
  const docPath = `lessonLogs/${logId}`;

  const data = {
    eventId,
    professorId: requesterId,
    alunoId: String(body?.alunoId || "").trim() || null,
    dateKey: isValidDateKey(String(body?.dateKey || "")) ? String(body.dateKey) : "",
    criadoEm: body?.criadoEm ? new Date(String(body.criadoEm)) : now,
    atualizadoEm: now,
    statusAula,
    // Realizada (form curto)
    conteudoTrabalhado: String(body?.conteudoTrabalhado || "").trim() || "",
    engajamentoNota: clampInt(Number(body?.engajamentoNota || 0), 0, 5, 0),
    evolucaoNota: clampInt(Number(body?.evolucaoNota || 0), 0, 5, 0),
    humorAluno: normalizeOneOf(body?.humorAluno, ["animado", "neutro", "cansado", "ansioso"]) || "",
    proximaAula: String(body?.proximaAula || "").trim() || "",
    avisosCoordenacao: (() => {
      const allowed = new Set([
        "🔴 Risco de cancelamento",
        "🟡 Aluno desmotivado",
        "🟡 Frequência caindo",
        "🟡 Não está evoluindo",
        "🟢 Muito satisfeito",
        "🟢 Quer mais aulas",
        "🟢 Potencial indicação",
      ]);
      const raw = Array.isArray(body?.avisosCoordenacao) ? body.avisosCoordenacao : Array.isArray(body?.avisos) ? body.avisos : [];
      const out = [];
      raw.forEach((item) => {
        const v = String(item || "").trim();
        if (!v) return;
        if (!allowed.has(v)) return;
        if (!out.includes(v)) out.push(v);
      });
      return out;
    })(),
    observacoesInternas: String(body?.observacoesInternas || "").trim() || "",
    precisaIntervencao: Boolean(body?.precisaIntervencao),
    // Campos do registro enxuto (Controle Pedagógico v2).
    motivoFalta: normalizeOneOf(body?.motivoFalta, [
      "atrasou_trabalho",
      "saude",
      "familia",
      "esqueceu",
      "internet_tecnologia",
      "viagem",
      "cansaco",
      "nao_informado",
      "outro",
    ]) || "",
    motivoRemarcacao: normalizeOneOf(body?.motivoRemarcacao, [
      "atrasou_trabalho",
      "saude",
      "familia",
      "internet_tecnologia",
      "viagem",
      "aluno_pediu",
      "professor_remarcou",
      "escola_remarcou",
      "nao_informado",
      "outro",
    ]) || "",
    novaDataRemarcacao: isValidDateKey(String(body?.novaDataRemarcacao || "")) ? String(body.novaDataRemarcacao) : "",
    // Novo: horários separados (inicio/fim). Mantém compatibilidade com "novoHorarioRemarcacao" se existir.
    horarioInicioRemarcacao: /^\d{2}:\d{2}$/.test(String(body?.horarioInicioRemarcacao || body?.novoHorarioRemarcacao || ""))
      ? String(body?.horarioInicioRemarcacao || body?.novoHorarioRemarcacao)
      : "",
    horarioFimRemarcacao: /^\d{2}:\d{2}$/.test(String(body?.horarioFimRemarcacao || ""))
      ? String(body?.horarioFimRemarcacao)
      : "",
    riscoEvasao: normalizeOneOf(body?.riscoEvasao, ["baixo", "medio", "alto"]) || "",
    observacao: String(body?.observacao || "").trim().slice(0, 250) || "",
  };

  // Enforce intervention rule on the server as well (don't rely only on the client).
  const negativeAvisos = new Set(["🔴 Risco de cancelamento", "🟡 Aluno desmotivado", "🟡 Frequência caindo", "🟡 Não está evoluindo"]);
  if (Array.isArray(data.avisosCoordenacao) && data.avisosCoordenacao.some((v) => negativeAvisos.has(String(v || "").trim()))) {
    data.precisaIntervencao = true;
  }

  // Limpa campos fora do contexto.
  if (statusAula !== "falta_aluno") {
    data.motivoFalta = "";
  }
  if (statusAula !== "remarcada") {
    data.motivoRemarcacao = "";
    data.novaDataRemarcacao = "";
    data.horarioInicioRemarcacao = "";
    data.horarioFimRemarcacao = "";
  }
  if (statusAula !== "falta_aluno" && statusAula !== "remarcada") {
    data.riscoEvasao = "";
    data.observacao = "";
  }
  if (statusAula !== "realizada") {
    data.conteudoTrabalhado = "";
    data.engajamentoNota = 0;
    data.evolucaoNota = 0;
    data.humorAluno = "";
    data.proximaAula = "";
    data.avisosCoordenacao = [];
    data.observacoesInternas = "";
    data.precisaIntervencao = false;
  }

  const writes = [
    {
      update: { name: toFirestoreDocName(docPath), fields: encodeFields(data).fields },
      updateMask: { fieldPaths: Object.keys(data) },
    },
  ];

  // Alerta para coordenação quando o professor remarca a aula.
  if (statusAula === "remarcada" && data.motivoRemarcacao === "professor_remarcou") {
    const alertId = `alert_${eventId}`;
    const alertDocPath = `adminAlerts/${alertId}`;
    let professorNome = "";
    let alunoNome = "";
    try {
      professorNome = (await getUserNameById({ idToken, uid: requesterId })) || "";
      if (data.alunoId) alunoNome = (await getUserNameById({ idToken, uid: data.alunoId })) || "";
    } catch {
      professorNome = "";
      alunoNome = "";
    }
    const alertData = {
      type: "remarcacao_professor",
      createdAt: now,
      updatedAt: now,
      status: "open",
      eventId,
      professorId: requesterId,
      professorNome: professorNome || null,
      alunoId: data.alunoId || null,
      alunoNome: alunoNome || null,
      dateKey: data.dateKey || "",
      novaDataRemarcacao: data.novaDataRemarcacao || "",
      horarioInicioRemarcacao: data.horarioInicioRemarcacao || "",
      horarioFimRemarcacao: data.horarioFimRemarcacao || "",
      observacao: data.observacao || "",
    };
    writes.push({
      update: { name: toFirestoreDocName(alertDocPath), fields: encodeFields(alertData).fields },
      updateMask: { fieldPaths: Object.keys(alertData) },
    });
  }

  const commit = await firestoreCommitWrites({ idToken, writes });
  if (!commit.ok) {
    // eslint-disable-next-line no-console
    console.error("[api] lesson-logs commit failed", { status: commit.status, data: commit.data, text: commit.text });
    sendJson(res, commit.status === 403 ? 403 : commit.status === 401 ? 401 : 500, { error: "internal_error" });
    return;
  }

  sendJson(res, 200, { ok: true, id: logId });
};

const decodeAdminAlertDoc = (doc) => {
  if (!doc || typeof doc !== "object") return null;
  const id = getDocIdFromName(doc.name);
  if (!id) return null;
  const fields = decodeFields(doc);
  return {
    id,
    type: typeof fields.type === "string" ? fields.type : "",
    status: typeof fields.status === "string" ? fields.status : "",
    eventId: typeof fields.eventId === "string" ? fields.eventId : "",
    professorId: typeof fields.professorId === "string" ? fields.professorId : "",
    professorNome: typeof fields.professorNome === "string" ? fields.professorNome : "",
    alunoId: typeof fields.alunoId === "string" ? fields.alunoId : "",
    alunoNome: typeof fields.alunoNome === "string" ? fields.alunoNome : "",
    dateKey: typeof fields.dateKey === "string" ? fields.dateKey : "",
    novaDataRemarcacao: typeof fields.novaDataRemarcacao === "string" ? fields.novaDataRemarcacao : "",
    horarioInicioRemarcacao: typeof fields.horarioInicioRemarcacao === "string" ? fields.horarioInicioRemarcacao : "",
    horarioFimRemarcacao: typeof fields.horarioFimRemarcacao === "string" ? fields.horarioFimRemarcacao : "",
    observacao: typeof fields.observacao === "string" ? fields.observacao : "",
    createdAt: fields.createdAt instanceof Date ? fields.createdAt.toISOString() : null,
    updatedAt: fields.updatedAt instanceof Date ? fields.updatedAt.toISOString() : null,
  };
};

const handleAdminAlertsApi = async (req, res, { idToken, role } = {}) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    sendJson(res, 405, { error: "method_not_allowed" });
    return;
  }
  if (String(role || "") !== "admin") {
    sendJson(res, 403, { error: "forbidden" });
    return;
  }

  try {
    const resList = await firestoreListDocuments({ collectionPath: "adminAlerts", idToken, pageSize: 200 });
    if (!resList.ok) throw new Error("firestore_list_failed");
    const docs = Array.isArray(resList.documents)
      ? resList.documents
      : Array.isArray(resList.data?.documents)
        ? resList.data.documents
        : [];
    const alerts = docs.map((doc) => decodeAdminAlertDoc(doc)).filter(Boolean);
    alerts.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
    sendJson(res, 200, { alerts });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[api] admin-alerts list failed", error);
    sendJson(res, 500, { error: "internal_error" });
  }
};

module.exports = async (req, res) => {
  const idToken = getBearerTokenFromRequest(req);
  const cookieSession = getSessionFromRequest(req);
  const method = String(req.method || "GET").toUpperCase();
  const isReadOnlyList = method === "GET" || method === "HEAD";
  let body = null;

  if (!isReadOnlyList && method !== "DELETE") {
    try {
      body = await readJsonBody(req);
    } catch (error) {
      sendJson(res, 400, { error: "invalid_json" });
      return;
    }
  }

  // Primary auth for this endpoint is the Firebase ID token sent by fetchWithAuth().
  // Cookie sessions can be stale/mismatched, so we treat them as optional metadata only.
  let decoded;
  let role = "";
  let requesterId = "";
  let profile;
  if (idToken) {
    try {
      decoded = await verifyFirebaseIdToken(idToken);
    } catch (error) {
      sendJson(res, 401, { error: "invalid_credentials" });
      return;
    }

    // If there is a cookie session but it doesn't match the Firebase user, ignore it.
    const cookieSub = String(cookieSession?.sub || "").trim();
    if (cookieSub && cookieSub !== decoded.uid) {
      // eslint-disable-next-line no-console
      console.warn("[api] schedule-events cookie/session mismatch; ignoring cookie session");
      // eslint-disable-next-line no-console
      console.warn("[api] schedule-events cookie/session mismatch", {
        cookieUid: cookieSub,
        firebaseUid: decoded.uid,
        role: String(cookieSession?.role || ""),
      });
    }

    try {
      profile = await fetchUserProfileByUid({ uid: decoded.uid, idToken });
    } catch (error) {
      logScheduleEventsError({
        point: "falhou no lookup de perfil autenticado",
        error,
        body,
        extra: { uid: decoded.uid },
      });
      sendJson(res, 500, { error: "internal_error" });
      return;
    }
    if (!profile?.user?.role) {
      sendJson(res, 401, { error: "unauthorized" });
      return;
    }
    role = normalizeRole(profile.user.role);
    requesterId = decoded.uid;
  } else if (isReadOnlyList && cookieSession) {
    role = normalizeRole(cookieSession.role);
    requesterId = String(cookieSession.sub || "").trim();
  } else {
    sendJson(res, 401, { error: "unauthorized" });
    return;
  }

  if (role !== "admin" && role !== "teacher" && role !== "student") {
    sendJson(res, 403, { error: "forbidden" });
    return;
  }

  const host = String(req.headers.host || "localhost");
  const url = new URL(req.url || "/api/schedule-events", `https://${host}`);
  const resource = String(url.searchParams.get("resource") || "").trim().toLowerCase();

  if (resource === "lesson-logs") {
    await handleLessonLogsApi(req, res, { idToken, role, requesterId, url });
    return;
  }
  if (resource === "admin-alerts") {
    await handleAdminAlertsApi(req, res, { idToken, role, requesterId, url });
    return;
  }

  if (req.method === "GET" || req.method === "HEAD") {
    const from = String(url.searchParams.get("from") || "").trim();
    const to = String(url.searchParams.get("to") || "").trim();

    if ((from && !isValidDateKey(from)) || (to && !isValidDateKey(to))) {
      sendJson(res, 400, { error: "invalid_date" });
      return;
    }

    try {
      let docs = [];
      if (idToken) {
        const resList = await firestoreListDocuments({ collectionPath: "aulas", idToken, pageSize: 2000 });
        if (!resList.ok) throw new Error("firestore_list_failed");
        docs = Array.isArray(resList.documents)
          ? resList.documents
          : Array.isArray(resList.data?.documents)
            ? resList.data.documents
            : [];
      } else {
        docs = await listCollectionAsAdmin("aulas", { pageSize: 2000 });
      }

      const events = docs
        .map((doc) => decodeAulaDoc(doc))
        .filter(Boolean)
        .filter((evt) => !isHiddenAulaStatus(evt.status))
        .filter((evt) => {
          if (role === "teacher" && evt.professorId !== requesterId) return false;
          if (
            role === "student" &&
            evt.alunoId !== requesterId &&
            !emailsMatch(evt.alunoEmail, session.email) &&
            !phonesMatch(evt.alunoTelefone, session.phone) &&
            !namesMatch(evt.alunoNome, session.name)
          ) {
            return false;
          }
          if (from && evt.dateKey < from) return false;
          if (to && evt.dateKey > to) return false;
          return true;
        })
        .sort((a, b) => (a.dateKey === b.dateKey ? a.startMin - b.startMin : a.dateKey.localeCompare(b.dateKey)))
        .map((evt) => {
          // Teacher calendar expects a minimal shape.
          const title = evt.type === "lesson" ? evt.alunoNome || "Aluno" : evt.title || "Evento";
          // In admin view, it helps to display the teacher name as well.
          const adminTitle = evt.type === "lesson" ? `${title}${evt.professorNome ? ` · ${evt.professorNome}` : ""}` : title;
          return {
            id: evt.id,
            type: evt.type,
            dateKey: evt.dateKey,
            startMin: evt.startMin,
            endMin: evt.endMin,
            status: evt.status,
            title: role === "admin" ? adminTitle : title,
            description: evt.description || "",
            guests: evt.guests,
            documents: evt.documents,
            recorrente: evt.recorrente,
            grupoRecorrenciaId: evt.grupoRecorrenciaId,
            alunoId: evt.alunoId,
            alunoNome: evt.alunoNome,
            alunoEmail: evt.alunoEmail,
            alunoTelefone: evt.alunoTelefone,
            professorId: evt.professorId,
            professorNome: evt.professorNome,
            liveLessonId: evt.liveLessonId,
            liveUrl: evt.liveLessonId ? `/aula/${encodeURIComponent(evt.liveLessonId)}` : "",
          };
        });

      sendJson(res, 200, { events });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("[api] schedule events list failed", error);
      sendJson(res, 500, { error: "internal_error" });
    }
    return;
  }

  if (role === "student") {
    sendJson(res, 403, { error: "forbidden" });
    return;
  }

  if (req.method === "DELETE") {
    const id = parseDeleteIdFromUrl(url);
    if (!id) {
      sendJson(res, 400, { error: "id_required" });
      return;
    }
    const mode = parseDeleteModeFromUrl(url);

    try {
      const docPath = `aulas/${encodeURIComponent(id)}`;
      const snap = await firestoreGetDocument({ docPath, idToken });
      if (!snap.ok) {
        sendJson(res, snap.status === 404 ? 404 : 500, { error: snap.status === 404 ? "not_found" : "internal_error" });
        return;
      }

      const evt = decodeAulaCoreForDelete(snap.data);
      if (!evt) {
        sendJson(res, 404, { error: "not_found" });
        return;
      }

      if (role === "teacher") {
        if (evt.professorId !== requesterId) {
          sendJson(res, 403, { error: "forbidden" });
          return;
        }
        if (evt.criadoPor !== "professor") {
          sendJson(res, 403, { error: "forbidden" });
          return;
        }
      }

      const cancelAula = async (targetId) => {
        const del = await firestoreDeleteDocument({
          docPath: `aulas/${encodeURIComponent(targetId)}`,
          idToken,
        });
        return del.ok;
      };

      if (mode !== "future" || !evt.grupoRecorrenciaId) {
        const ok = await cancelAula(evt.id);
        if (!ok) throw new Error("firestore_cancel_failed");
        sendJson(res, 200, { ok: true, deleted: 1, cancelled: 1 });
        return;
      }

      const resList = await firestoreListDocuments({ collectionPath: "aulas", idToken, pageSize: 2000 });
      if (!resList.ok) throw new Error("firestore_list_failed");
      const docs = Array.isArray(resList.documents)
        ? resList.documents
        : Array.isArray(resList.data?.documents)
          ? resList.data.documents
          : [];

      const toDelete = docs
        .map((doc) => decodeAulaCoreForDelete(doc))
        .filter(Boolean)
        .filter((row) => row.grupoRecorrenciaId === evt.grupoRecorrenciaId)
        .filter((row) => (row.startMs || 0) >= (evt.startMs || 0));

      if (role === "teacher") {
        if (toDelete.some((row) => row.professorId !== requesterId || row.criadoPor !== "professor")) {
          sendJson(res, 403, { error: "forbidden" });
          return;
        }
      }

      let deleted = 0;
      for (const row of toDelete) {
        const ok = await cancelAula(row.id);
        if (ok) deleted += 1;
      }

      sendJson(res, 200, { ok: true, deleted, cancelled: deleted });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("[api] schedule events delete failed", error);
      sendJson(res, 500, { error: "internal_error" });
    }
    return;
  }

  if (req.method !== "POST" && req.method !== "PUT") {
    res.setHeader("Allow", "GET, HEAD, POST, PUT, DELETE");
    sendJson(res, 405, { error: "method_not_allowed" });
    return;
  }

  const tzOffsetMinutes = DEFAULT_CONFIG.tzOffsetMinutes;

  const isCreate = req.method === "POST";
  const eventId = String(body?.id || "").trim();
  if (!isCreate && !eventId) {
    sendJson(res, 400, { error: "id_required" });
    return;
  }

  // Core scheduling fields (prefer dateKey + minutes since that's what the UI already uses).
  const dateKey = String(body?.dateKey || "").trim();
  if (!isValidDateKey(dateKey)) {
    sendJson(res, 400, { error: "invalid_date" });
    return;
  }

  const startMin = parseMinutes(body?.startMin ?? body?.horaInicio ?? body?.startTime);
  const endMin = parseMinutes(body?.endMin ?? body?.horaFim ?? body?.endTime);
  if (!Number.isFinite(startMin) || !Number.isFinite(endMin) || endMin <= startMin) {
    sendJson(res, 400, { error: "invalid_time" });
    return;
  }

  const repeatObj = body?.repeat && typeof body.repeat === "object" ? body.repeat : null;
  const repeatEnabled = Boolean(repeatObj?.enabled);
  const repeatType = String(repeatObj?.type || "").trim().toLowerCase();

  const isWeeklyCustom = isCreate && role === "admin" && repeatEnabled && repeatType === "weekly_custom" && Array.isArray(repeatObj?.days);
  const isMonthly = isCreate && role === "admin" && repeatEnabled && repeatType === "monthly";
  const isWeeklySimple = isCreate && role === "admin" && repeatEnabled && repeatType === "weekly";

  const recorrente = (isWeeklyCustom || isMonthly || isWeeklySimple) ? true : Boolean(body?.recorrente);
  const repeatMode = normalizeRepeatMode(body?.repeatMode || body?.recurrenceMode);
  const grupoRecorrenciaId = String(body?.grupoRecorrenciaId || "").trim() || (recorrente && isCreate ? buildId("grp") : "");

  const alunoIdProvided = Object.prototype.hasOwnProperty.call(body || {}, "alunoId") || Object.prototype.hasOwnProperty.call(body || {}, "studentId");
  const alunoIdRaw = body?.alunoId ?? body?.studentId ?? null;
  const alunoId = alunoIdRaw == null ? null : String(alunoIdRaw || "").trim() || null;

  const professorIdFromBody = String(body?.professorId || body?.teacherId || "").trim();
  let professorId = role === "teacher" ? requesterId : professorIdFromBody;
  const requestedEventType = String(body?.eventType || "").trim().toLowerCase();
  const wantsLesson = requestedEventType === "lesson";
  if (isCreate && role === "admin" && !professorId && !wantsLesson) {
    professorId = requesterId;
  }

  if (isCreate && !professorId) {
    sendJson(res, 400, { error: "invalid_payload", missingFields: ["professorId"], receivedBody: body || null });
    return;
  }

  // Manual event extra fields (teacher events modal).
  const title = String(body?.title || "").trim();
  const description = String(body?.description || "").trim();
  const guests = Array.isArray(body?.guests) ? body.guests.filter((g) => typeof g === "string" && g.trim()) : [];
  const documents = Array.isArray(body?.documents) ? body.documents.filter((d) => d && typeof d === "object") : [];

  const isLesson = Boolean(alunoId);
  const createdBy = role === "admin" ? "admin" : "professor";

  // If the client explicitly requested a lesson, require the linking ids.
  if (isCreate && wantsLesson) {
    const missingFields = [];
    if (!alunoId) missingFields.push("alunoId");
    if (!professorId) missingFields.push("professorId");
    if (missingFields.length) {
      // eslint-disable-next-line no-console
      console.error("[schedule-events] invalid payload", { missingFields, body });
      sendJson(res, 400, { error: "invalid_payload", missingFields, receivedBody: body || null });
      return;
    }
  }

  // Keep the legacy teacher behavior: manual events require a title.
  if (!isLesson && role === "teacher" && !title) {
    sendJson(res, 400, { error: "title_required" });
    return;
  }

  const startMs = toUtcMsForDateKeyAndMinutes(dateKey, startMin, { tzOffsetMinutes });
  if (!startMs) {
    sendJson(res, 400, { error: "invalid_date" });
    return;
  }

  const dow = getDayOfWeekFromDateKey(dateKey);
  const diaSemana = dow == null ? "" : DOW_TO_KEY[dow] || "";

  // Resolve names to persist denormalized data (keeps the UI fast and avoids joins).
  let professorNome = "";
  let alunoNome = "";
  const professorNomeBody = String(body?.professorNome || body?.professor_nome || "").trim();
  const alunoNomeBody = String(body?.alunoNome || body?.aluno_nome || "").trim();
  const alunoEmail = String(body?.alunoEmail || body?.aluno_email || "").trim().toLowerCase();
  const alunoTelefone = String(body?.alunoTelefone || body?.aluno_telefone || body?.telefone || "").trim();
  try {
    if (professorId) {
      professorNome = (await getUserNameById({ idToken, uid: professorId })) || "";
    }
    alunoNome = alunoId ? (await getUserNameById({ idToken, uid: alunoId })) || "" : "";
  } catch (error) {
    professorNome = "";
    alunoNome = "";
  }
  professorNome = professorNome || professorNomeBody;
  alunoNome = alunoNome || alunoNomeBody;

  const baseDoc = ({ overrideDateKey, overrideStartMin, overrideEndMin, repeatMeta } = {}) => {
    const key = overrideDateKey || dateKey;
    const occStartMin = Number.isFinite(Number(overrideStartMin)) ? clampInt(overrideStartMin, 0, 1440) : startMin;
    const occEndMin = Number.isFinite(Number(overrideEndMin)) ? clampInt(overrideEndMin, 0, 1440) : endMin;

    const occurrenceDow = getDayOfWeekFromDateKey(key);
    const occurrenceDiaSemana = occurrenceDow == null ? "" : DOW_TO_KEY[occurrenceDow] || "";
    const occStartMs = toUtcMsForDateKeyAndMinutes(key, occStartMin, { tzOffsetMinutes });
    const data = occStartMs ? new Date(occStartMs) : new Date(startMs);

    return {
      alunoId: alunoId || null,
      professorId,
      alunoNome: alunoNome || null,
      alunoEmail: alunoEmail || null,
      alunoTelefone: alunoTelefone || null,
      professorNome: professorNome || null,
      data,
      diaSemana: occurrenceDiaSemana || diaSemana,
      horaInicio: minutesToTime(occStartMin),
      horaFim: minutesToTime(occEndMin),
      dateKey: key,
      startMin: occStartMin,
      endMin: occEndMin,
      status: "agendada",
      recorrente: Boolean(recorrente),
      grupoRecorrenciaId: grupoRecorrenciaId || null,
      criadoEm: new Date(),
      criadoPor: createdBy,
      // Manual event fields (compatible with the existing calendar modal).
      title: isLesson ? "" : title,
      description: isLesson ? "" : description,
      guests: isLesson ? [] : guests,
      documents: isLesson ? [] : documents,
      ...(repeatMeta && typeof repeatMeta === "object" ? repeatMeta : {}),
    };
  };

  try {
    if (isCreate) {
      let customOccurrences = [];
      if (isWeeklyCustom) {
        customOccurrences = buildCustomWeeklyOccurrences({ dateKey, days: repeatObj?.days });
        if (!customOccurrences.length) {
          sendJson(res, 400, { error: "invalid_repeat" });
          return;
        }
      }

      const monthlyKeys = isMonthly ? buildMonthlyOccurrences({ dateKey, dayOfMonth: repeatObj?.dayOfMonth }) : [];

      const occurrences = isWeeklyCustom
        ? customOccurrences
        : (isMonthly ? monthlyKeys : buildOccurrences({ dateKey, recorrente, repeatMode })).map((key) => ({ dateKey: key }));

      const createdIds = [];
      const repeatMeta = repeatEnabled
        ? repeatType === "weekly_custom"
          ? { repeatType: "weekly_custom", repeatDays: repeatObj?.days || [] }
          : repeatType === "monthly"
            ? { repeatType: "monthly", repeatDayOfMonth: clampInt(repeatObj?.dayOfMonth || 1, 1, 31) }
            : repeatType === "weekly"
              ? { repeatType: "weekly", repeatWeekday: String(repeatObj?.weekday || "") || null }
              : null
        : null;

      const writes = [];
      for (const occ of occurrences) {
        const key = String(occ?.dateKey || "").trim();
        if (!isValidDateKey(key)) continue;
        const id = buildId("aula");
        createdIds.push(id);
        const docPath = `aulas/${id}`;
        const data = baseDoc({
          overrideDateKey: key,
          overrideStartMin: isWeeklyCustom ? occ?.startMin : undefined,
          overrideEndMin: isWeeklyCustom ? occ?.endMin : undefined,
          repeatMeta,
        });

        if (data.alunoId) {
          const occStartMs = toUtcMsForDateKeyAndMinutes(data.dateKey, data.startMin, { tzOffsetMinutes });
          const occEndMs = toUtcMsForDateKeyAndMinutes(data.dateKey, data.endMin, { tzOffsetMinutes });
          if (occStartMs && occEndMs) {
            const liveLessonId = await createLiveLessonMirror({ eventId: id, data, startMs: occStartMs, endMs: occEndMs });
            if (liveLessonId) data.liveLessonId = liveLessonId;
          }
        }

        const mask = Object.keys(data);
        const encoded = encodeFields(data);
        writes.push({
          update: { name: toFirestoreDocName(docPath), fields: encoded.fields },
          updateMask: { fieldPaths: mask },
        });
      }

      // If we somehow filtered everything out, treat as invalid repeat to keep the UI consistent.
      if (!writes.length) {
        sendJson(res, 400, { error: repeatEnabled ? "invalid_repeat" : "invalid_date" });
        return;
      }

      // Firestore commit limit is 500 writes. Our recurrence windows are far below this, but keep it safe.
      const chunks = [];
      for (let i = 0; i < writes.length; i += 450) {
        chunks.push(writes.slice(i, i + 450));
      }

      for (const chunk of chunks) {
        const commit = await firestoreCommitWrites({ idToken, writes: chunk });
        if (!commit.ok) {
          // eslint-disable-next-line no-console
          console.error("[api] schedule events commit failed", {
            status: commit.status,
            data: commit.data,
            text: commit.text,
            writesCount: chunk.length,
          });
          if (commit.status === 401) {
            sendJson(res, 401, { error: "invalid_credentials" });
            return;
          }
          if (commit.status === 403) {
            sendJson(res, 403, { error: "forbidden" });
            return;
          }
          if (commit.status === 400) {
            // eslint-disable-next-line no-console
            console.error("[schedule-events] firestore rejected payload", { body, commitData: commit.data, commitText: commit.text });
            sendJson(res, 400, {
              error: "invalid_payload",
              missingFields: [],
              receivedBody: body || null,
              firestore: commit.data || null,
            });
            return;
          }
          logScheduleEventsError({
            point: "falhou no commit Firestore",
            error: new Error(`firestore_commit_failed_${commit.status || "unknown"}`),
            body,
            extra: {
              status: commit.status,
              commitData: commit.data,
              commitText: commit.text,
              writesCount: chunk.length,
            },
          });
          sendJson(res, 500, { error: "internal_error" });
          return;
        }
      }

      sendJson(res, 200, { ok: true, ids: createdIds, grupoRecorrenciaId: grupoRecorrenciaId || null });
      return;
    }

    // Update: allow admin to edit any event; teacher only their own manual events created by the teacher.
    const docPath = `aulas/${encodeURIComponent(eventId)}`;
    const snap = await firestoreGetDocument({ docPath, idToken });
    if (!snap.ok) {
      sendJson(res, snap.status === 404 ? 404 : 500, { error: snap.status === 404 ? "not_found" : "internal_error" });
      return;
    }
    const existing = decodeFields(snap.data);
    const existingProfessorId = typeof existing.professorId === "string" ? existing.professorId : "";
    const existingAlunoId = existing.alunoId == null ? null : typeof existing.alunoId === "string" ? existing.alunoId : null;
    const existingCriadoPor = typeof existing.criadoPor === "string" ? existing.criadoPor : "";
    const existingStatus = String(existing.status || "").trim().toLowerCase() || "agendada";

    if (role === "teacher") {
      if (existingProfessorId !== requesterId) {
        sendJson(res, 403, { error: "forbidden" });
        return;
      }
      if (existingCriadoPor !== "professor") {
        sendJson(res, 403, { error: "forbidden" });
        return;
      }
      if (existingAlunoId != null) {
        // Keep lessons read-only for teachers (admin controls the schedule).
        sendJson(res, 403, { error: "forbidden" });
        return;
      }
    }

    // For admin updates, allow omitting professor/aluno ids (keep existing).
    if (role === "admin") {
      professorId = professorId || existingProfessorId;
    }
    const alunoIdFinal = role === "admin" ? (alunoIdProvided ? alunoId : existingAlunoId) : existingAlunoId;
    const isLessonFinal = Boolean(alunoIdFinal);

    // Re-resolve names only if ids changed or missing.
    let professorNomeFinal = typeof existing.professorNome === "string" ? existing.professorNome.trim() : "";
    let alunoNomeFinal = typeof existing.alunoNome === "string" ? existing.alunoNome.trim() : "";
    try {
      if (!professorNomeFinal || professorId !== existingProfessorId) {
        professorNomeFinal = professorId ? (await getUserNameById({ idToken, uid: professorId })) || "" : "";
      }
      if (alunoIdFinal && (!alunoNomeFinal || alunoIdFinal !== existingAlunoId)) {
        alunoNomeFinal = (await getUserNameById({ idToken, uid: alunoIdFinal })) || "";
      }
    } catch (error) {
      // ignore
    }

    const patchData = {
      ...baseDoc(dateKey),
      professorId,
      alunoId: alunoIdFinal || null,
      professorNome: professorNomeFinal || null,
      alunoNome: alunoIdFinal ? alunoNomeFinal || null : null,
      title: isLessonFinal ? "" : title,
      description: isLessonFinal ? "" : description,
      guests: isLessonFinal ? [] : guests,
      documents: isLessonFinal ? [] : documents,
      status: existingStatus,
    };
    // Preserve recurrence group info on edit (do not accidentally flip it).
    patchData.recorrente = typeof existing.recorrente === "boolean" ? existing.recorrente : patchData.recorrente;
    patchData.grupoRecorrenciaId =
      typeof existing.grupoRecorrenciaId === "string" ? existing.grupoRecorrenciaId : patchData.grupoRecorrenciaId;
    patchData.criadoEm = existing.criadoEm instanceof Date ? existing.criadoEm : patchData.criadoEm;
    patchData.criadoPor = existingCriadoPor || patchData.criadoPor;
    patchData.atualizadoEm = new Date();

    const updateMaskPaths = Object.keys(patchData);
    const patch = await firestorePatchDocument({ docPath, idToken, data: patchData, updateMaskPaths });
    if (!patch.ok) throw new Error("firestore_patch_failed");
    sendJson(res, 200, { ok: true });
  } catch (error) {
    // eslint-disable-next-line no-console
    logScheduleEventsError({
      point: "fallback final do endpoint",
      error,
      body,
      extra: {
        method: req.method,
        isCreate,
        role,
        requesterId,
      },
    });
    sendJson(res, 500, { error: "internal_error" });
  }
};
