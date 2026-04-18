const crypto = require("crypto");

const { readJsonBody, sendJson } = require("../../../_lib/http");
const { getSessionFromRequest } = require("../../../_lib/session");
const { verifyFirebaseIdToken } = require("../../../_lib/firebase-id-token");
const { DEFAULT_CONFIG } = require("../../../_lib/scheduling-firestore");
const {
  addDaysToDateKey,
  clampInt,
  getDayOfWeekFromDateKey,
  isValidDateKey,
  minutesToTime,
  timeToMinutes,
  toUtcMsForDateKeyAndMinutes,
} = require("../../../_lib/scheduling-utils");
const {
  decodeFields,
  firestoreDeleteDocument,
  firestoreGetDocument,
  firestoreListDocuments,
  firestorePatchDocument,
  getBearerTokenFromRequest,
  getDocIdFromName,
} = require("../../../_lib/firestore-rest");

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
  const url = new URL(req.url || "/api/schedule/events", `https://${host}`);

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

  const recorrente = Boolean(body?.recorrente);
  const repeatMode = normalizeRepeatMode(body?.repeatMode || body?.repeat || body?.recurrenceMode);
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

  const baseDoc = (overrideDateKey) => {
    const key = overrideDateKey || dateKey;
    const occurrenceDow = getDayOfWeekFromDateKey(key);
    const occurrenceDiaSemana = occurrenceDow == null ? "" : DOW_TO_KEY[occurrenceDow] || "";
    const occStartMs = toUtcMsForDateKeyAndMinutes(key, startMin, { tzOffsetMinutes });
    const data = occStartMs ? new Date(occStartMs) : new Date(startMs);

    return {
      alunoId: alunoId || null,
      professorId,
      alunoNome: alunoNome || null,
      professorNome: professorNome || null,
      data,
      diaSemana: occurrenceDiaSemana || diaSemana,
      horaInicio: minutesToTime(startMin),
      horaFim: minutesToTime(endMin),
      dateKey: key,
      startMin,
      endMin,
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
    };
  };

  try {
    if (isCreate) {
      const occurrences = buildOccurrences({ dateKey, recorrente, repeatMode });
      const createdIds = [];

      for (const key of occurrences) {
        if (!isValidDateKey(key)) continue;
        const id = buildId("aula");
        createdIds.push(id);
        const docPath = `aulas/${encodeURIComponent(id)}`;
        const data = baseDoc(key);
        const mask = Object.keys(data);
        const patch = await firestorePatchDocument({
          docPath,
          idToken,
          data,
          updateMaskPaths: mask,
        });
        if (!patch.ok) throw new Error("firestore_patch_failed");
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
