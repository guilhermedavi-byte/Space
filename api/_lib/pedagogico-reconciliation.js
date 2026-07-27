const fs = require("fs");
const path = require("path");
const { listCollectionAsAdmin } = require("./firestore-admin");
const { supabaseFetch } = require("./supabase-rest");

const LESSONS_TABLE = "n8n_aulas_pedagogicas_space";
const REGISTERS_TABLE = "n8n_registros_aula_space";
const PENDING_WRITES_COLLECTION = "pedagogico_pending_writes";
const LEGACY_MAP_PATH = path.join(process.cwd(), "data", "legacy-occurrence-map.generated.json");
const TIME_ZONE = "America/Sao_Paulo";

const safeString = (value) => (value == null ? "" : String(value).trim());

const formatLocalFromIso = (isoString) => {
  const raw = safeString(isoString);
  if (!raw) return { dateKey: "", time: "" };
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return { dateKey: "", time: "" };
  const formatter = new Intl.DateTimeFormat("sv-SE", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );
  return {
    dateKey: `${parts.year || ""}-${parts.month || ""}-${parts.day || ""}`.replace(/^--$/, ""),
    time: `${parts.hour || ""}:${parts.minute || ""}`.replace(/^:$/, ""),
  };
};

const endMsLocal = (dateKey, endTime) => {
  const safeDateKey = safeString(dateKey);
  const safeEnd = safeString(endTime);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(safeDateKey) || !/^\d{2}:\d{2}$/.test(safeEnd)) return Number.NaN;
  const [year, month, day] = safeDateKey.split("-").map(Number);
  const [hour, minute] = safeEnd.split(":").map(Number);
  return new Date(year, month - 1, day, hour, minute, 0, 0).getTime();
};

const formatHmFromMinutes = (value) => {
  const minutes = Number(value);
  if (!Number.isFinite(minutes)) return "";
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
};

const loadLegacyOccurrenceMap = () => {
  if (!fs.existsSync(LEGACY_MAP_PATH)) return { generatedAt: null, rows: [], byLessonId: new Map(), byEventId: new Map() };
  const payload = JSON.parse(fs.readFileSync(LEGACY_MAP_PATH, "utf8"));
  const rows = Array.isArray(payload?.rows) ? payload.rows.filter((row) => row && typeof row === "object") : [];
  const byLessonId = new Map();
  const byEventId = new Map();
  rows.forEach((row) => {
    const occurrenceId = safeString(row.occurrence_id || row.occurrenceId);
    if (!occurrenceId) return;
    const lessonId = safeString(row.live_lesson_id || row.liveLessonId || row.legacy_register_aula_id || row.legacyRegisterAulaId);
    const eventId = safeString(row.firestore_event_id || row.firestoreEventId);
    if (lessonId && !byLessonId.has(lessonId)) byLessonId.set(lessonId, occurrenceId);
    if (eventId && !byEventId.has(eventId)) byEventId.set(eventId, occurrenceId);
  });
  return {
    generatedAt: payload?.generatedAt || null,
    rows,
    byLessonId,
    byEventId,
  };
};

const fetchSupabaseAll = async (table, select, { pageSize = 1000 } = {}) => {
  const all = [];
  let from = 0;
  for (;;) {
    const { data } = await supabaseFetch(`/${table}?select=${encodeURIComponent(select)}&order=id.asc`, {
      headers: {
        Range: `${from}-${from + pageSize - 1}`,
        Prefer: "count=exact",
      },
    });
    const rows = Array.isArray(data) ? data : [];
    if (!rows.length) break;
    all.push(...rows);
    if (rows.length < pageSize) break;
    from += pageSize;
  }
  return all;
};

const loadReconciliationSources = async () => {
  const [events, lessons, registers, pendingWrites] = await Promise.all([
    listCollectionAsAdmin("aulas", { pageSize: 1000 }),
    fetchSupabaseAll(
      LESSONS_TABLE,
      "id,occurrence_id,firestore_doc_id,aluno_id,aluno_nome,professor_id,professor_nome,inicio,fim,status_aula,origem,video_room_id,created_at,updated_at"
    ),
    fetchSupabaseAll(
      REGISTERS_TABLE,
      "id,occurrence_id,aula_id,aluno_id,aluno_nome,professor_id,professor_nome,status,status_registro,created_at,updated_at,conteudo_trabalhado,conteudo_aula,registrado_em,engajamento,confianca"
    ),
    listCollectionAsAdmin(PENDING_WRITES_COLLECTION, { pageSize: 1000 }),
  ]);
  return { events, lessons, registers, pendingWrites };
};

const normalizeEvent = (event, legacyMap) => {
  const eventId = safeString(event?.id);
  const occurrenceId = safeString(event?.occurrenceId || legacyMap.byEventId.get(eventId));
  const dateKey = safeString(event?.dateKey);
  const startTime = safeString(event?.horaInicio) || formatHmFromMinutes(event?.startMin);
  const endTime = safeString(event?.horaFim) || formatHmFromMinutes(event?.endMin);
  return {
    eventId,
    occurrenceId,
    liveLessonId: safeString(event?.liveLessonId),
    studentId: safeString(event?.alunoId),
    studentName: safeString(event?.alunoNome),
    teacherId: safeString(event?.professorId),
    teacherName: safeString(event?.professorNome),
    dateKey,
    startTime,
    endTime,
    endMs: endMsLocal(dateKey, endTime),
  };
};

const normalizeLesson = (lesson, legacyMap) => {
  const lessonId = safeString(lesson?.id);
  const occurrenceId = safeString(lesson?.occurrence_id || legacyMap.byLessonId.get(lessonId));
  const start = formatLocalFromIso(lesson?.inicio);
  const end = formatLocalFromIso(lesson?.fim);
  return {
    lessonId,
    occurrenceId,
    firestoreDocId: safeString(lesson?.firestore_doc_id),
    studentId: safeString(lesson?.aluno_id),
    studentName: safeString(lesson?.aluno_nome),
    teacherId: safeString(lesson?.professor_id),
    teacherName: safeString(lesson?.professor_nome),
    dateKey: start.dateKey,
    startTime: start.time,
    endTime: end.time,
    origin: safeString(lesson?.origem),
    createdAt: lesson?.created_at || null,
    updatedAt: lesson?.updated_at || null,
    endMs: endMsLocal(start.dateKey, end.time),
  };
};

const normalizeRegister = (register, { legacyMap, liveById, eventsByOccurrence }) => {
  const lessonId = safeString(register?.aula_id);
  const live = lessonId ? liveById.get(lessonId) || null : null;
  const fallbackOccurrenceId = live?.occurrenceId || legacyMap.byLessonId.get(lessonId) || "";
  const occurrenceId = safeString(register?.occurrence_id || fallbackOccurrenceId);
  const event = occurrenceId ? eventsByOccurrence.get(occurrenceId) || null : null;
  return {
    registerId: safeString(register?.id),
    occurrenceId,
    legacyRegisterAulaId: lessonId,
    studentId: safeString(register?.aluno_id),
    studentName: safeString(register?.aluno_nome) || safeString(live?.studentName) || safeString(event?.studentName),
    teacherId: safeString(register?.professor_id),
    teacherName: safeString(register?.professor_nome) || safeString(live?.teacherName) || safeString(event?.teacherName),
    localDate: safeString(live?.dateKey) || safeString(event?.dateKey),
    startTime: safeString(live?.startTime) || safeString(event?.startTime),
    endTime: safeString(live?.endTime) || safeString(event?.endTime),
    status: safeString(register?.status || register?.status_registro).toLowerCase(),
    recordedAt: safeString(register?.registrado_em || register?.created_at || register?.updated_at),
    content: safeString(register?.conteudo_trabalhado || register?.conteudo_aula),
    engagement: safeString(register?.engajamento),
    confidence: safeString(register?.confianca),
  };
};

const buildCollisionGroups = (orphanLessons) => {
  const byTuple = new Map();
  orphanLessons.forEach((lesson) => {
    const key = [lesson.studentId || lesson.studentName, lesson.teacherId || lesson.teacherName, lesson.dateKey, lesson.startTime, lesson.endTime].join("|");
    const current = byTuple.get(key) || [];
    current.push(lesson);
    byTuple.set(key, current);
  });
  const groups = [];
  const singletonRows = [];
  byTuple.forEach((rows, key) => {
    if (rows.length > 1) {
      groups.push({
        key,
        rows,
      });
      return;
    }
    singletonRows.push(rows[0]);
  });
  return {
    collisionGroups: groups,
    unmatchedRows: singletonRows,
    collisionRowCount: groups.reduce((total, group) => total + group.rows.length, 0),
  };
};

const buildPendingWriteIssue = (pendingWrite, { legacyMap, liveById, eventsByOccurrence, registersByOccurrence, registerLessonIds }) => {
  const payload = pendingWrite?.payload && typeof pendingWrite.payload === "object" ? pendingWrite.payload : {};
  const meta = pendingWrite?.meta && typeof pendingWrite.meta === "object" ? pendingWrite.meta : {};
  const firstValue = (...values) => values.map(safeString).find(Boolean) || "";
  const legacyRegisterAulaId = firstValue(pendingWrite?.aula_id, pendingWrite?.aulaId, payload?.aula_id, payload?.aulaId, meta?.aula_id, meta?.aulaId);
  const occurrenceId = firstValue(
    pendingWrite?.occurrence_id,
    pendingWrite?.occurrenceId,
    payload?.occurrence_id,
    payload?.occurrenceId,
    meta?.occurrence_id,
    meta?.occurrenceId,
    legacyMap.byLessonId.get(legacyRegisterAulaId)
  );
  const live = legacyRegisterAulaId ? liveById.get(legacyRegisterAulaId) || null : null;
  const event = occurrenceId ? eventsByOccurrence.get(occurrenceId) || null : null;
  const hasRegister = (occurrenceId && registersByOccurrence.has(occurrenceId)) || (legacyRegisterAulaId && registerLessonIds.has(legacyRegisterAulaId));
  if (hasRegister || live || event) return null;
  return {
    id: safeString(pendingWrite?.id || pendingWrite?.firestoreDocId),
    category: "orphan_pending_write",
    severity: "high",
    occurrence_id: occurrenceId || null,
    firestore_event_id: null,
    live_lesson_id: null,
    legacy_register_aula_id: legacyRegisterAulaId || null,
    student_id: firstValue(pendingWrite?.aluno_id, pendingWrite?.alunoId, payload?.aluno_id, payload?.alunoId, meta?.aluno_id, meta?.alunoId) || null,
    student_name: firstValue(pendingWrite?.aluno_nome, pendingWrite?.alunoNome, payload?.aluno_nome, payload?.alunoNome, meta?.aluno_nome, meta?.alunoNome) || null,
    teacher_id: firstValue(pendingWrite?.professor_id, pendingWrite?.professorId, payload?.professor_id, payload?.professorId, meta?.professor_id, meta?.professorId) || null,
    teacher_name: firstValue(pendingWrite?.professor_nome, pendingWrite?.professorNome, payload?.professor_nome, payload?.professorNome, meta?.professor_nome, meta?.professorNome) || null,
    local_date: firstValue(pendingWrite?.date_key, pendingWrite?.dateKey, payload?.date_key, payload?.dateKey, payload?.data_aula, meta?.date_key, meta?.dateKey, meta?.data_aula) || null,
    start_time_local: firstValue(pendingWrite?.start_time, pendingWrite?.startTime, payload?.start_time, payload?.startTime, payload?.hora_inicio, meta?.start_time, meta?.startTime, meta?.hora_inicio) || null,
    end_time_local: firstValue(pendingWrite?.end_time, pendingWrite?.endTime, payload?.end_time, payload?.endTime, payload?.hora_fim, meta?.end_time, meta?.endTime, meta?.hora_fim) || null,
    evidence: {
      pending_write_state: firstValue(pendingWrite?.state, pendingWrite?.status, payload?.status, meta?.status) || null,
      created_at: pendingWrite?.createdAt || pendingWrite?.created_at || null,
      updated_at: pendingWrite?.updatedAt || pendingWrite?.updated_at || null,
    },
    suggested_action: "revisar payload durável e decidir replay manual",
    requires_manual_review: true,
    detected_at: new Date().toISOString(),
  };
};

const applyFilters = (items, { from, to, teacherId, severity, category }) =>
  items.filter((item) => {
    if (from && safeString(item.local_date) && safeString(item.local_date) < from) return false;
    if (to && safeString(item.local_date) && safeString(item.local_date) > to) return false;
    if (teacherId && safeString(item.teacher_id) !== teacherId) return false;
    if (severity && safeString(item.severity) !== severity) return false;
    if (category && safeString(item.category) !== category && !(category === "manual_review" && item.requires_manual_review)) return false;
    return true;
  });

const paginate = (items, { limit = 100, cursor = "" } = {}) => {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 100, 1000));
  const offset = cursor ? Number(Buffer.from(String(cursor), "base64").toString("utf8")) || 0 : 0;
  const slice = items.slice(offset, offset + safeLimit);
  const nextOffset = offset + slice.length;
  return {
    items: slice,
    nextCursor: nextOffset < items.length ? Buffer.from(String(nextOffset), "utf8").toString("base64") : null,
  };
};

const buildItemKey = (item) =>
  [
    safeString(item.category),
    safeString(item.occurrence_id),
    safeString(item.firestore_event_id),
    safeString(item.live_lesson_id),
    safeString(item.legacy_register_aula_id),
    safeString(item.id),
  ]
    .filter(Boolean)
    .join(":");

const buildItemTitle = (item) => {
  const student = safeString(item.student_name) || "Sem aluno";
  const teacher = safeString(item.teacher_name) || "Sem professor";
  const date = safeString(item.local_date) || "sem data";
  const start = safeString(item.start_time_local);
  const end = safeString(item.end_time_local);
  const time = start && end ? `${start}-${end}` : start || end || "sem horário";
  return `${student} · ${teacher} · ${date} ${time}`;
};

const buildReconciliationReport = async ({
  from = "",
  to = "",
  teacherId = "",
  severity = "",
  category = "",
  limit = 100,
  cursor = "",
} = {}) => {
  const [legacyMap, sources] = await Promise.all([Promise.resolve(loadLegacyOccurrenceMap()), loadReconciliationSources()]);
  const detectedAt = new Date().toISOString();
  const normalizedEvents = (sources.events || []).map((event) => normalizeEvent(event, legacyMap));
  const normalizedLessons = (sources.lessons || []).map((lesson) => normalizeLesson(lesson, legacyMap));

  const eventsByOccurrence = new Map();
  normalizedEvents.forEach((event) => {
    if (event.occurrenceId) eventsByOccurrence.set(event.occurrenceId, event);
  });
  const liveById = new Map();
  normalizedLessons.forEach((lesson) => liveById.set(lesson.lessonId, lesson));

  const orphanLessonsRaw = normalizedLessons.filter((lesson) => !lesson.occurrenceId);
  const collisionBreakdown = buildCollisionGroups(orphanLessonsRaw);

  const normalizedRegisters = (sources.registers || []).map((register) =>
    normalizeRegister(register, { legacyMap, liveById, eventsByOccurrence })
  );
  const registersByOccurrence = new Map();
  const registerLessonIds = new Set();
  const orphanRegisterItems = [];

  normalizedRegisters.forEach((register) => {
    if (register.legacyRegisterAulaId) registerLessonIds.add(register.legacyRegisterAulaId);
    const hasEvent = register.occurrenceId && eventsByOccurrence.has(register.occurrenceId);
    const hasLive =
      register.occurrenceId &&
      normalizedLessons.some((lesson) => lesson.occurrenceId && lesson.occurrenceId === register.occurrenceId);
    if (!register.occurrenceId || (!hasEvent && !hasLive)) {
      orphanRegisterItems.push({
        id: register.registerId,
        category: "orphan_register",
        severity: "high",
        occurrence_id: register.occurrenceId || null,
        firestore_event_id: hasEvent ? eventsByOccurrence.get(register.occurrenceId)?.eventId || null : null,
        live_lesson_id: null,
        legacy_register_aula_id: register.legacyRegisterAulaId || null,
        student_id: register.studentId || null,
        student_name: register.studentName || null,
        teacher_id: register.teacherId || null,
        teacher_name: register.teacherName || null,
        local_date: register.localDate || null,
        start_time_local: register.startTime || null,
        end_time_local: register.endTime || null,
        evidence: {
          register_id: register.registerId,
          status: register.status || null,
          recorded_at: register.recordedAt || null,
        },
        suggested_action: "revisar vínculo histórico e decidir se o register deve ser mantido, reatribuído ou descartado",
        requires_manual_review: true,
        detected_at: detectedAt,
      });
      return;
    }
    if (!registersByOccurrence.has(register.occurrenceId)) registersByOccurrence.set(register.occurrenceId, []);
    registersByOccurrence.get(register.occurrenceId).push(register);
  });

  const orphanLessonUnmatchedItems = collisionBreakdown.unmatchedRows.map((lesson) => ({
    id: `lesson-unmatched:${lesson.lessonId}`,
    category: "orphan_lesson_unmatched",
    severity: "medium",
    occurrence_id: null,
    firestore_event_id: null,
    live_lesson_id: lesson.lessonId || null,
    legacy_register_aula_id: null,
    student_id: lesson.studentId || null,
    student_name: lesson.studentName || null,
    teacher_id: lesson.teacherId || null,
    teacher_name: lesson.teacherName || null,
    local_date: lesson.dateKey || null,
    start_time_local: lesson.startTime || null,
    end_time_local: lesson.endTime || null,
    evidence: {
      origin: lesson.origin || null,
      created_at: lesson.createdAt || null,
      updated_at: lesson.updatedAt || null,
    },
    suggested_action: "revisar match canônico da live lesson e decidir se deve ser carimbada, consolidada ou descartada",
    requires_manual_review: true,
    detected_at: detectedAt,
  }));

  const orphanLessonCollisionGroupItems = collisionBreakdown.collisionGroups.map((group, index) => {
    const first = group.rows[0] || {};
    return {
      id: `lesson-collision-group:${index}:${group.key}`,
      category: "orphan_lesson_collision_groups",
      severity: "high",
      occurrence_id: null,
      firestore_event_id: null,
      live_lesson_id: null,
      legacy_register_aula_id: null,
      student_id: first.studentId || null,
      student_name: first.studentName || null,
      teacher_id: first.teacherId || null,
      teacher_name: first.teacherName || null,
      local_date: first.dateKey || null,
      start_time_local: first.startTime || null,
      end_time_local: first.endTime || null,
      evidence: {
        collision_key: group.key,
        live_lesson_ids: group.rows.map((row) => row.lessonId),
        origins: group.rows.map((row) => row.origin).filter(Boolean),
        row_count: group.rows.length,
      },
      suggested_action: "consolidar as live lessons duplicadas da mesma ocorrência lógica",
      requires_manual_review: true,
      detected_at: detectedAt,
    };
  });

  const orphanLessonCollisionRowItems = collisionBreakdown.collisionGroups.flatMap((group, groupIndex) =>
    group.rows.map((lesson, rowIndex) => ({
      id: `lesson-collision-row:${groupIndex}:${rowIndex}:${lesson.lessonId}`,
      category: "orphan_lesson_collision_rows",
      severity: "medium",
      occurrence_id: null,
      firestore_event_id: null,
      live_lesson_id: lesson.lessonId || null,
      legacy_register_aula_id: null,
      student_id: lesson.studentId || null,
      student_name: lesson.studentName || null,
      teacher_id: lesson.teacherId || null,
      teacher_name: lesson.teacherName || null,
      local_date: lesson.dateKey || null,
      start_time_local: lesson.startTime || null,
      end_time_local: lesson.endTime || null,
      evidence: {
        collision_group_key: group.key,
        origin: lesson.origin || null,
      },
      suggested_action: "inspecionar a live lesson participante do grupo de colisão",
      requires_manual_review: true,
      detected_at: detectedAt,
    }))
  );

  const missingRegisterItems = normalizedEvents
    .filter((event) => event.studentId && event.teacherId && event.occurrenceId && event.endMs < Date.now() && !registersByOccurrence.has(event.occurrenceId))
    .map((event) => ({
      id: `missing-register:${event.occurrenceId}`,
      category: "missing_register",
      severity: "high",
      occurrence_id: event.occurrenceId || null,
      firestore_event_id: event.eventId || null,
      live_lesson_id: event.liveLessonId || null,
      legacy_register_aula_id: event.liveLessonId || null,
      student_id: event.studentId || null,
      student_name: event.studentName || null,
      teacher_id: event.teacherId || null,
      teacher_name: event.teacherName || null,
      local_date: event.dateKey || null,
      start_time_local: event.startTime || null,
      end_time_local: event.endTime || null,
      evidence: {
        reason: "past_occurrence_without_register",
      },
      suggested_action: "cobrar fechamento pedagógico da ocorrência ou revisar se o evento deveria existir",
      requires_manual_review: true,
      detected_at: detectedAt,
    }));

  const orphanPendingWriteItems = (sources.pendingWrites || [])
    .map((pendingWrite) =>
      buildPendingWriteIssue(pendingWrite, {
        legacyMap,
        liveById,
        eventsByOccurrence,
        registersByOccurrence,
        registerLessonIds,
      })
    )
    .filter(Boolean);

  const allItems = [
    ...orphanRegisterItems,
    ...orphanLessonUnmatchedItems,
    ...orphanLessonCollisionGroupItems,
    ...orphanLessonCollisionRowItems,
    ...missingRegisterItems,
    ...orphanPendingWriteItems,
  ]
    .map((item) => ({
      ...item,
      key: buildItemKey(item),
      title: buildItemTitle(item),
    }))
    .sort((a, b) => {
    const dateA = safeString(a.local_date);
    const dateB = safeString(b.local_date);
    if (dateA !== dateB) return dateA.localeCompare(dateB);
    const startA = safeString(a.start_time_local);
    const startB = safeString(b.start_time_local);
    if (startA !== startB) return startA.localeCompare(startB);
    return safeString(a.id).localeCompare(safeString(b.id));
  });

  const filteredItems = applyFilters(allItems, { from, to, teacherId, severity, category });
  const page = paginate(filteredItems, { limit, cursor });
  const summary = {
    orphan_register: orphanRegisterItems.length,
    orphan_lesson_unmatched: orphanLessonUnmatchedItems.length,
    orphan_lesson_collision_groups: orphanLessonCollisionGroupItems.length,
    orphan_lesson_collision_rows: orphanLessonCollisionRowItems.length,
    missing_register: missingRegisterItems.length,
    orphan_pending_write: orphanPendingWriteItems.length,
    manual_review: allItems.length,
  };

  return {
    ok: true,
    generatedAt: detectedAt,
    sourceTotals: {
      firestoreEvents: normalizedEvents.length,
      liveLessons: normalizedLessons.length,
      registers: normalizedRegisters.length,
      pendingWrites: Array.isArray(sources.pendingWrites) ? sources.pendingWrites.length : 0,
      legacyOccurrenceMapRows: legacyMap.rows.length,
    },
    summary,
    items: page.items,
    nextCursor: page.nextCursor,
    totalItems: filteredItems.length,
    manual_review: {
      total: allItems.length,
      filtered: filteredItems.length,
      items: page.items,
      nextCursor: page.nextCursor,
    },
  };
};

module.exports = {
  LESSONS_TABLE,
  REGISTERS_TABLE,
  PENDING_WRITES_COLLECTION,
  buildCollisionGroups,
  buildReconciliationReport,
  loadLegacyOccurrenceMap,
};
