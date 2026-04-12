const crypto = require("crypto");

const {
  clampInt,
  getDayOfWeekFromDateKey,
  rangesOverlap,
  timeToMinutes,
  toUtcMsForDateKeyAndMinutes,
} = require("./scheduling-utils");

const normalizeStatus = (value) => {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "cancelado") return "cancelado";
  if (raw === "concluido") return "concluido";
  return "agendado";
};

const buildEventId = () => {
  const rand = crypto.randomBytes(6).toString("hex");
  return `evt_${Date.now()}_${rand}`;
};

const getTeacherById = (store, teacherId) => {
  return (store.teachers || []).find((t) => t && t.id === teacherId) || null;
};

const getTeacherWorkWindowsForDow = (teacher, dow) => {
  const map = teacher && teacher.workHours && typeof teacher.workHours === "object" ? teacher.workHours : {};
  const windows = Array.isArray(map[String(dow)]) ? map[String(dow)] : [];
  return windows
    .map((w) => {
      if (!w || typeof w !== "object") return null;
      const startMin = clampInt(w.startMin, 0, 1440);
      const endMin = clampInt(w.endMin, 0, 1440);
      if (endMin <= startMin) return null;
      return { startMin, endMin };
    })
    .filter(Boolean)
    .sort((a, b) => a.startMin - b.startMin);
};

const slotFitsWorkHours = ({ windows, startMin, endMin }) => {
  return windows.some((w) => startMin >= w.startMin && endMin <= w.endMin);
};

const getBlockingEventsForTeacherOnDate = (store, teacherId, dateKey) => {
  const events = Array.isArray(store.events) ? store.events : [];
  return events
    .filter((evt) => evt && evt.teacherId === teacherId && evt.dateKey === dateKey)
    .filter((evt) => normalizeStatus(evt.status) !== "cancelado")
    .map((evt) => ({
      startMin: clampInt(evt.startMin, 0, 1440),
      endMin: clampInt(evt.endMin, 0, 1440),
    }))
    .filter((evt) => evt.endMin > evt.startMin);
};

const slotConflictsWithEvents = ({ events, startMin, endMin, bufferMinutes }) => {
  const buffer = clampInt(bufferMinutes, 0, 60);
  for (const evt of events) {
    const blockStart = clampInt(evt.startMin - buffer, 0, 1440);
    const blockEnd = clampInt(evt.endMin + buffer, 0, 1440);
    if (rangesOverlap(startMin, endMin, blockStart, blockEnd)) return true;
  }
  return false;
};

const getSchoolSlotStartMinutes = (store, dow) => {
  const schoolSlots = store && store.config && typeof store.config.schoolSlots === "object" ? store.config.schoolSlots : {};
  const times = Array.isArray(schoolSlots[String(dow)]) ? schoolSlots[String(dow)] : [];
  return times
    .map((t) => timeToMinutes(t))
    .filter((m) => Number.isFinite(m))
    .sort((a, b) => a - b);
};

const computeTeachersBySlot = (store, dateKey) => {
  const dow = getDayOfWeekFromDateKey(dateKey);
  if (dow == null) return new Map();

  const duration = clampInt(store?.config?.slotDurationMinutes, 15, 180);
  const bufferMinutes = clampInt(store?.config?.bufferMinutes, 0, 60);
  const starts = getSchoolSlotStartMinutes(store, dow);

  const out = new Map();
  const teachers = Array.isArray(store.teachers) ? store.teachers : [];

  for (const teacher of teachers) {
    if (!teacher || typeof teacher !== "object" || !teacher.id) continue;
    if (teacher.active === false) continue;
    const windows = getTeacherWorkWindowsForDow(teacher, dow);
    if (!windows.length) continue;
    const blocking = getBlockingEventsForTeacherOnDate(store, teacher.id, dateKey);

    for (const startMin of starts) {
      const endMin = startMin + duration;
      if (endMin > 1440) continue;
      if (!slotFitsWorkHours({ windows, startMin, endMin })) continue;
      if (slotConflictsWithEvents({ events: blocking, startMin, endMin, bufferMinutes })) continue;

      const key = String(startMin);
      const arr = out.get(key) || [];
      arr.push(teacher.id);
      out.set(key, arr);
    }
  }

  return out;
};

const computeAvailableSlotsForDate = (store, dateKey) => {
  const duration = clampInt(store?.config?.slotDurationMinutes, 15, 180);
  const teachersBySlot = computeTeachersBySlot(store, dateKey);

  const slots = Array.from(teachersBySlot.keys())
    .map((k) => Number(k))
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b)
    .map((startMin) => ({
      startMin,
      endMin: startMin + duration,
    }));

  return { slots, teachersBySlot };
};

const teacherRankIndex = (store, teacherId) => {
  const order = Array.isArray(store?.ranking?.order) ? store.ranking.order : [];
  const idx = order.indexOf(teacherId);
  return idx < 0 ? Number.MAX_SAFE_INTEGER : idx;
};

const studentHasConflict = (store, studentId, dateKey, startMin, endMin) => {
  const events = Array.isArray(store.events) ? store.events : [];
  return events
    .filter((evt) => evt && evt.studentId === studentId && evt.dateKey === dateKey)
    .filter((evt) => normalizeStatus(evt.status) !== "cancelado")
    .some((evt) => rangesOverlap(startMin, endMin, clampInt(evt.startMin, 0, 1440), clampInt(evt.endMin, 0, 1440)));
};

const bookSlotForStudent = ({ store, studentId, dateKey, startMin, endMin }) => {
  const duration = clampInt(store?.config?.slotDurationMinutes, 15, 180);
  const safeStart = clampInt(startMin, 0, 1440);
  const safeEnd = clampInt(endMin != null ? endMin : safeStart + duration, 0, 1440);
  if (safeEnd <= safeStart) {
    return { ok: false, error: "invalid_time" };
  }

  const tzOffsetMinutes = clampInt(store?.config?.tzOffsetMinutes, -12 * 60, 14 * 60);
  const startMs = toUtcMsForDateKeyAndMinutes(dateKey, safeStart, { tzOffsetMinutes });
  if (!startMs || startMs <= Date.now()) {
    return { ok: false, error: "slot_unavailable" };
  }

  if (studentHasConflict(store, studentId, dateKey, safeStart, safeEnd)) {
    return { ok: false, error: "student_conflict" };
  }

  const { teachersBySlot } = computeAvailableSlotsForDate(store, dateKey);
  const teacherIds = teachersBySlot.get(String(safeStart)) || [];
  if (!teacherIds.length) {
    return { ok: false, error: "slot_unavailable" };
  }

  const ranked = [...teacherIds].sort((a, b) => teacherRankIndex(store, a) - teacherRankIndex(store, b));
  const teacherId = ranked[0];
  const teacher = getTeacherById(store, teacherId);
  if (!teacher) {
    return { ok: false, error: "teacher_missing" };
  }

  const event = {
    id: buildEventId(),
    teacherId,
    studentId,
    dateKey,
    startMin: safeStart,
    endMin: safeEnd,
    status: "agendado",
    createdAt: new Date().toISOString(),
    title: "Aula ao vivo",
    description: "",
    guests: [],
    documents: [],
  };

  store.events = Array.isArray(store.events) ? store.events : [];
  store.events.push(event);

  return { ok: true, event };
};

module.exports = {
  bookSlotForStudent,
  computeAvailableSlotsForDate,
  computeTeachersBySlot,
  getTeacherById,
  normalizeStatus,
};
