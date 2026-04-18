const { isValidDateKey } = require("./scheduling-utils");
const { normalizeStatus } = require("./scheduling-core");
const { clampInt } = require("./scheduling-utils");
const {
  decodeFields,
  firestoreGetDocument,
  firestoreListDocuments,
  getDocIdFromName,
} = require("./firestore-rest");

const DEFAULT_CONFIG = {
  timeZone: "America/Sao_Paulo",
  // GMT-03:00.
  tzOffsetMinutes: -180,
  slotDurationMinutes: 30,
  bufferMinutes: 10,
  // Student-facing schedule should not show slots too close to "now".
  minLeadTimeMinutes: 120,
  schoolSlots: {
    // Keys follow Date.getDay(): 0 (Sun) - 6 (Sat). Sunday intentionally empty.
    0: [],
    1: ["09:00", "11:30", "16:30", "19:00"],
    2: ["08:00", "10:30", "15:00", "18:30"],
    3: ["09:30", "12:00", "14:30", "19:30"],
    4: ["08:30", "11:00", "16:00", "18:00"],
    5: ["09:00", "13:30", "15:30", "18:30"],
    6: ["09:00", "10:30", "11:30", "13:00"],
  },
};

const DOW_TO_KEY = {
  0: "dom",
  1: "seg",
  2: "ter",
  3: "qua",
  4: "qui",
  5: "sex",
  6: "sab",
};

const defaultTeacherWorkHours = () => {
  const byDay = {};
  for (let dow = 0; dow <= 6; dow += 1) {
    byDay[String(dow)] = dow === 0 ? [] : [{ startMin: 0, endMin: 23 * 60 + 59 }];
  }
  return byDay;
};

const hmToMinutes = (hm) => {
  const raw = String(hm || "").trim();
  if (!/^\d{2}:\d{2}$/.test(raw)) return null;
  const [h, m] = raw.split(":").map((part) => Number(part));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  const safeH = clampInt(h, 0, 23);
  const safeM = clampInt(m, 0, 59);
  return safeH * 60 + safeM;
};

const normalizeHorariosToWorkHours = (horarios) => {
  const out = {};
  for (let dow = 0; dow <= 6; dow += 1) {
    out[String(dow)] = [];
  }

  const map = horarios && typeof horarios === "object" ? horarios : {};
  for (let dow = 0; dow <= 6; dow += 1) {
    const key = DOW_TO_KEY[dow];
    const entry = map[key];
    if (!entry || typeof entry !== "object") continue;
    if (entry.ativo === false) {
      out[String(dow)] = [];
      continue;
    }
    const faixas = Array.isArray(entry.faixas) ? entry.faixas : [];
    out[String(dow)] = faixas
      .map((w) => {
        if (!w || typeof w !== "object") return null;
        const startMin = hmToMinutes(w.inicio);
        const endMin = hmToMinutes(w.fim);
        if (!Number.isFinite(startMin) || !Number.isFinite(endMin) || endMin <= startMin) return null;
        return { startMin, endMin };
      })
      .filter(Boolean)
      .sort((a, b) => a.startMin - b.startMin);
  }

  return out;
};

const normalizeWorkHours = (raw) => {
  const base = defaultTeacherWorkHours();
  if (!raw || typeof raw !== "object") return base;

  for (let dow = 0; dow <= 6; dow += 1) {
    const key = String(dow);
    const windowsRaw = raw[key];
    const windows = Array.isArray(windowsRaw) ? windowsRaw : [];
    const normalized = windows
      .map((w) => {
        if (!w || typeof w !== "object") return null;
        const startMin = clampInt(w.startMin, 0, 1440);
        const endMin = clampInt(w.endMin, 0, 1440);
        if (endMin <= startMin) return null;
        return { startMin, endMin };
      })
      .filter(Boolean)
      .sort((a, b) => a.startMin - b.startMin);
    base[key] = normalized;
  }

  return base;
};

const fetchActiveTeachers = async ({ idToken } = {}) => {
  const res = await firestoreListDocuments({ collectionPath: "users", idToken, pageSize: 800 });
  if (!res.ok) throw new Error("firestore_list_failed");
  const docs = Array.isArray(res.documents) ? res.documents : Array.isArray(res.data?.documents) ? res.data.documents : [];

  return docs
    .map((doc) => {
      if (!doc || typeof doc !== "object") return null;
      const id = getDocIdFromName(doc.name);
      const fields = decodeFields(doc);
      const name = String(fields?.nome || "").trim();
      const type = String(fields?.tipo || "").trim().toLowerCase();
      const active = typeof fields?.ativo === "boolean" ? fields.ativo : true;
      if (type !== "teacher" || !active) return null;
      if (!id || !name) return null;
      return { id, name, active };
    })
    .filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
};

const fetchRankingOrder = async ({ idToken } = {}) => {
  const docPath = "config/teacherRanking";
  const snap = await firestoreGetDocument({ docPath, idToken });
  if (!snap.ok) {
    if (snap.status === 404) return [];
    throw new Error("firestore_get_failed");
  }
  const fields = decodeFields(snap.data);
  return Array.isArray(fields?.order) ? fields.order.filter((id) => typeof id === "string") : [];
};

const fetchTeacherWorkHours = async ({ idToken, teacherId } = {}) => {
  const safeId = String(teacherId || "").trim();
  if (!safeId) return defaultTeacherWorkHours();
  const docPath = `workHours/${encodeURIComponent(safeId)}`;
  const snap = await firestoreGetDocument({ docPath, idToken });
  if (!snap.ok) {
    if (snap.status === 404) return defaultTeacherWorkHours();
    throw new Error("firestore_get_failed");
  }
  const fields = decodeFields(snap.data);
  if (fields?.horarios && typeof fields.horarios === "object") {
    return normalizeHorariosToWorkHours(fields.horarios);
  }
  return normalizeWorkHours(fields?.workHours);
};

const decodeStoreEvent = (doc) => {
  if (!doc || typeof doc !== "object") return null;
  const id = getDocIdFromName(doc.name);
  const fields = decodeFields(doc);
  const teacherId = typeof fields.teacherId === "string" ? fields.teacherId : "";
  const dateKey = typeof fields.dateKey === "string" ? fields.dateKey : "";
  const startMin = clampInt(fields.startMin, 0, 1440);
  const endMin = clampInt(fields.endMin, 0, 1440);
  const status = normalizeStatus(fields.status);
  const studentId = fields.studentId == null ? null : typeof fields.studentId === "string" ? fields.studentId : "";

  if (!id || !teacherId || !isValidDateKey(dateKey)) return null;
  if (endMin <= startMin) return null;
  if (studentId !== null && !studentId) return null;

  return {
    id,
    teacherId,
    studentId,
    dateKey,
    startMin,
    endMin,
    status,
    createdAt: typeof fields.createdAt === "string" ? fields.createdAt : "",
    title: typeof fields.title === "string" ? fields.title : "",
    description: typeof fields.description === "string" ? fields.description : "",
    guests: Array.isArray(fields.guests) ? fields.guests.filter((g) => typeof g === "string") : [],
    documents: Array.isArray(fields.documents) ? fields.documents.filter((d) => d && typeof d === "object") : [],
  };
};

const fetchEventsForDateKey = async ({ idToken, dateKey } = {}) => {
  const key = String(dateKey || "").trim();
  if (!isValidDateKey(key)) return [];

  const res = await firestoreListDocuments({ collectionPath: "events", idToken, pageSize: 1600 });
  if (!res.ok) throw new Error("firestore_list_failed");
  const docs = Array.isArray(res.documents) ? res.documents : Array.isArray(res.data?.documents) ? res.data.documents : [];
  return docs
    .map((doc) => decodeStoreEvent(doc))
    .filter(Boolean)
    .filter((evt) => evt.dateKey === key);
};

module.exports = {
  DEFAULT_CONFIG,
  decodeStoreEvent,
  defaultTeacherWorkHours,
  fetchActiveTeachers,
  fetchEventsForDateKey,
  fetchRankingOrder,
  fetchTeacherWorkHours,
};
