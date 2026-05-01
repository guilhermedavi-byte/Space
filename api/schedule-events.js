const crypto = require("crypto");

const { readJsonBody, sendJson } = require("../_lib/http");
const { getSessionFromRequest } = require("../_lib/session");
const { verifyFirebaseIdToken } = require("../_lib/firebase-id-token");
const { DEFAULT_CONFIG } = require("../_lib/scheduling-firestore");
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
  firestoreDeleteDocument,
  firestoreGetDocument,
  firestoreListDocuments,
  firestorePatchDocument,
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

const buildId = (prefix) => {
  const rand = crypto.randomBytes(6).toString("hex");
  return `${prefix}_${Date.now()}_${rand}`;
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
  const id = getDocIdFromName(doc.name);
  if (!id) return null;
  const fields = decodeFields(doc);

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

  const recorrente = typeof fields.recorrente === "boolean" ? fields.recorrente : false;
  const grupoRecorrenciaId = typeof fields.grupoRecorrenciaId === "string" ? fields.grupoRecorrenciaId : "";

  const title = typeof fields.title === "string" ? fields.title : "";
  const description = typeof fields.description === "string" ? fields.description : "";
  const guests = Array.isArray(fields.guests) ? fields.guests.filter((g) => typeof g === "string") : [];
  const documents = Array.isArray(fields.documents) ? fields.documents.filter((d) => d && typeof d === "object") : [];

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
    recorrente,
    grupoRecorrenciaId: grupoRecorrenciaId || null,
    title,
    description,
    guests,
    documents,
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
  // Commit "name" is a Firestore resource name, not a URL. Avoid percent-encoding here.
  return `${FIRESTORE_BASE}/${path}`;
};

module.exports = async (req, res) => {
  const session = getSessionFromRequest(req);
  if (!session) {
    sendJson(res, 401, { error: "unauthorized" });
    return;
  }

  const role = normalizeRole(session.role);
  if (role !== "admin" && role !== "teacher") {
    sendJson(res, 403, { error: "forbidden" });
    return;
  }

  const requesterId = String(session.sub || "");
  const idToken = getBearerTokenFromRequest(req);
  if (!requesterId || !idToken) {
    sendJson(res, 401, { error: "unauthorized" });
    return;
  }

  try {
    const decoded = await verifyFirebaseIdToken(idToken);
    if (decoded.uid !== requesterId) {
      sendJson(res, 401, { error: "invalid_credentials" });
      return;
    }
  } catch (error) {
    sendJson(res, 401, { error: "invalid_credentials" });
    return;
  }

  const host = String(req.headers.host || "localhost");
  const url = new URL(req.url || "/api/schedule-events", `https://${host}`);

  if (req.method === "GET" || req.method === "HEAD") {
    const from = String(url.searchParams.get("from") || "").trim();
    const to = String(url.searchParams.get("to") || "").trim();

    if ((from && !isValidDateKey(from)) || (to && !isValidDateKey(to))) {
      sendJson(res, 400, { error: "invalid_date" });
      return;
    }

    try {
      const resList = await firestoreListDocuments({ collectionPath: "aulas", idToken, pageSize: 2000 });
      if (!resList.ok) throw new Error("firestore_list_failed");
      const docs = Array.isArray(resList.documents)
        ? resList.documents
        : Array.isArray(resList.data?.documents)
          ? resList.data.documents
          : [];

      const events = docs
        .map((doc) => decodeAulaDoc(doc))
        .filter(Boolean)
        .filter((evt) => {
          if (role === "teacher" && evt.professorId !== requesterId) return false;
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
            professorId: evt.professorId,
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

      if (mode !== "future" || !evt.grupoRecorrenciaId) {
        const del = await firestoreDeleteDocument({ docPath, idToken });
        if (!del.ok) throw new Error("firestore_delete_failed");
        sendJson(res, 200, { ok: true, deleted: 1 });
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
        const del = await firestoreDeleteDocument({ docPath: `aulas/${encodeURIComponent(row.id)}`, idToken });
        if (del.ok) deleted += 1;
      }

      sendJson(res, 200, { ok: true, deleted });
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

  let body;
  try {
    body = await readJsonBody(req);
  } catch (error) {
    sendJson(res, 400, { error: "invalid_json" });
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

  if (isCreate && !professorId) {
    sendJson(res, 400, { error: "professor_required" });
    return;
  }

  // Manual event extra fields (teacher events modal).
  const title = String(body?.title || "").trim();
  const description = String(body?.description || "").trim();
  const guests = Array.isArray(body?.guests) ? body.guests.filter((g) => typeof g === "string" && g.trim()) : [];
  const documents = Array.isArray(body?.documents) ? body.documents.filter((d) => d && typeof d === "object") : [];

  const isLesson = Boolean(alunoId);
  const createdBy = role === "admin" ? "admin" : "professor";

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
  try {
    if (professorId) {
      professorNome = (await getUserNameById({ idToken, uid: professorId })) || "";
    }
    alunoNome = alunoId ? (await getUserNameById({ idToken, uid: alunoId })) || "" : "";
  } catch (error) {
    professorNome = "";
    alunoNome = "";
  }

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
            sendJson(res, 400, { error: "invalid_payload" });
            return;
          }
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
    console.error("[api] schedule events mutate failed", error);
    sendJson(res, 500, { error: "internal_error" });
  }
};
