const fs = require("fs");
const path = require("path");

const { loadUsers } = require("./users");
const { clampInt } = require("./scheduling-utils");

const STORE_VERSION = 1;
const STORE_FILENAME = "scheduling.json";
const LOCK_FILENAME = "scheduling.lock";

const DATA_DIR = path.join(__dirname, "..", "..", "data");
const STORE_PATH = path.join(DATA_DIR, STORE_FILENAME);
const LOCK_PATH = path.join(DATA_DIR, LOCK_FILENAME);

const TMP_DIR = process.env.TMPDIR || "/tmp";
const TMP_STORE_PATH = path.join(TMP_DIR, `space_${STORE_FILENAME}`);
const TMP_LOCK_PATH = path.join(TMP_DIR, `space_${LOCK_FILENAME}`);

let ACTIVE_STORE_PATH = STORE_PATH;
let ACTIVE_LOCK_PATH = LOCK_PATH;

const selectWritableStorePaths = () => {
  // Prefer repo-local `data/` in local dev, but fall back to `/tmp` on read-only hosts (e.g. serverless).
  ensureDataDir();
  const probePath = path.join(DATA_DIR, ".scheduling_write_probe");
  try {
    fs.writeFileSync(probePath, "ok", "utf8");
    fs.unlinkSync(probePath);
    ACTIVE_STORE_PATH = STORE_PATH;
    ACTIVE_LOCK_PATH = LOCK_PATH;
  } catch (error) {
    ACTIVE_STORE_PATH = TMP_STORE_PATH;
    ACTIVE_LOCK_PATH = TMP_LOCK_PATH;
  }
};

selectWritableStorePaths();

const ensureDataDir = () => {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (error) {
    // ignore - read-only environments will fail here.
  }
};

const safeReadJsonFile = (filePath) => {
  try {
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, "utf8");
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (error) {
    return null;
  }
};

const safeWriteJsonFile = (filePath, payload) => {
  const body = JSON.stringify(payload ?? {}, null, 2);
  try {
    fs.writeFileSync(filePath, body, "utf8");
    return true;
  } catch (error) {
    return false;
  }
};

const defaultSchoolSlots = () => {
  // Keys follow Date.getDay(): 0 (Sun) - 6 (Sat). Sunday intentionally empty.
  return {
    0: [],
    1: ["09:00", "11:30", "16:30", "19:00"],
    2: ["08:00", "10:30", "15:00", "18:30"],
    3: ["09:30", "12:00", "14:30", "19:30"],
    4: ["08:30", "11:00", "16:00", "18:00"],
    5: ["09:00", "13:30", "15:30", "18:30"],
    6: ["09:00", "10:30", "11:30", "13:00"],
  };
};

const defaultTeacherWorkHours = () => {
  // Default: enabled Mon-Sat with a broad window; Sunday off.
  const byDay = {};
  for (let dow = 0; dow <= 6; dow += 1) {
    byDay[String(dow)] = dow === 0 ? [] : [{ startMin: 8 * 60, endMin: 20 * 60 }];
  }
  return byDay;
};

const normalizeWorkHours = (value) => {
  const out = {};
  for (let dow = 0; dow <= 6; dow += 1) {
    out[String(dow)] = [];
  }

  if (!value || typeof value !== "object") {
    return out;
  }

  for (let dow = 0; dow <= 6; dow += 1) {
    const raw = value[String(dow)];
    const windows = Array.isArray(raw) ? raw : [];
    out[String(dow)] = windows
      .map((w) => {
        if (!w || typeof w !== "object") return null;
        const startMin = clampInt(w.startMin, 0, 1440);
        const endMin = clampInt(w.endMin, 0, 1440);
        if (endMin <= startMin) return null;
        return { startMin, endMin };
      })
      .filter(Boolean)
      .sort((a, b) => a.startMin - b.startMin);
  }

  return out;
};

const normalizeTeacher = (value) => {
  if (!value || typeof value !== "object") return null;
  const id = typeof value.id === "string" ? value.id : "";
  const name = typeof value.name === "string" ? value.name : "";
  const active =
    typeof value.active === "boolean" ? value.active : typeof value.ativo === "boolean" ? value.ativo : true;
  if (!id || !name) return null;
  return {
    id,
    name,
    active,
    workHours: normalizeWorkHours(value.workHours),
  };
};

const normalizeStudent = (value) => {
  if (!value || typeof value !== "object") return null;
  const id = typeof value.id === "string" ? value.id : "";
  const name = typeof value.name === "string" ? value.name : "";
  if (!id || !name) return null;
  return { id, name };
};

const normalizeEvent = (value) => {
  if (!value || typeof value !== "object") return null;
  const id = typeof value.id === "string" ? value.id : "";
  const teacherId = typeof value.teacherId === "string" ? value.teacherId : "";
  const studentId = value.studentId == null ? null : typeof value.studentId === "string" ? value.studentId : "";
  const dateKey = typeof value.dateKey === "string" ? value.dateKey : "";
  const startMin = clampInt(value.startMin, 0, 1440);
  const endMin = clampInt(value.endMin, 0, 1440);
  const status = typeof value.status === "string" ? value.status : "agendado";
  const createdAt = typeof value.createdAt === "string" ? value.createdAt : "";
  const title = typeof value.title === "string" ? value.title : "";
  const description = typeof value.description === "string" ? value.description : "";
  const guests = Array.isArray(value.guests) ? value.guests.filter((g) => typeof g === "string") : [];
  const documents = Array.isArray(value.documents) ? value.documents.filter((d) => d && typeof d === "object") : [];

  if (!id || !teacherId || !dateKey) return null;
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
    createdAt,
    title,
    description,
    guests,
    documents,
  };
};

const buildInitialStore = () => {
  const users = loadUsers();
  const teachers = users.filter((u) => u.role === "teacher").map((u) => ({
    id: u.id,
    name: u.name,
    active: true,
    workHours: defaultTeacherWorkHours(),
  }));
  const students = users.filter((u) => u.role === "student").map((u) => ({ id: u.id, name: u.name }));

  return {
    version: STORE_VERSION,
    config: {
      timeZone: "America/Sao_Paulo",
      // GMT-03:00. (Keeping it simple for this prototype.)
      tzOffsetMinutes: -180,
      slotDurationMinutes: 30,
      bufferMinutes: 10,
      schoolSlots: defaultSchoolSlots(),
    },
    teachers,
    students,
    ranking: {
      order: teachers.map((t) => t.id),
    },
    events: [],
  };
};

const normalizeStore = (value) => {
  const base = buildInitialStore();
  if (!value || typeof value !== "object") return base;

  const version = Number(value.version);
  const config = value.config && typeof value.config === "object" ? value.config : {};
  const timeZone = typeof config.timeZone === "string" ? config.timeZone : base.config.timeZone;
  const tzOffsetMinutes = clampInt(config.tzOffsetMinutes, -12 * 60, 14 * 60);
  const slotDurationMinutes = clampInt(config.slotDurationMinutes, 15, 180);
  const bufferMinutes = clampInt(config.bufferMinutes, 0, 60);
  const schoolSlots = config.schoolSlots && typeof config.schoolSlots === "object" ? config.schoolSlots : base.config.schoolSlots;

  const teachersRaw = Array.isArray(value.teachers) ? value.teachers : [];
  const studentsRaw = Array.isArray(value.students) ? value.students : [];
  const eventsRaw = Array.isArray(value.events) ? value.events : [];
  const rankingRaw = value.ranking && typeof value.ranking === "object" ? value.ranking : {};

  const teachers = teachersRaw.map(normalizeTeacher).filter(Boolean);
  const students = studentsRaw.map(normalizeStudent).filter(Boolean);
  const events = eventsRaw.map(normalizeEvent).filter(Boolean);

  const activeTeachers = teachers.filter((t) => t && t.active !== false);
  const teacherIds = new Set(activeTeachers.map((t) => t.id));
  const order = Array.isArray(rankingRaw.order) ? rankingRaw.order.filter((id) => typeof id === "string") : [];
  const dedupedOrder = [];
  const seen = new Set();
  order.forEach((id) => {
    if (!teacherIds.has(id)) return;
    if (seen.has(id)) return;
    seen.add(id);
    dedupedOrder.push(id);
  });

  // Ensure all teachers are present in the ranking order.
  activeTeachers.forEach((t) => {
    if (!seen.has(t.id)) dedupedOrder.push(t.id);
  });

  const store = {
    version: Number.isFinite(version) && version === STORE_VERSION ? STORE_VERSION : STORE_VERSION,
    config: { timeZone, tzOffsetMinutes, slotDurationMinutes, bufferMinutes, schoolSlots },
    teachers,
    students,
    ranking: { order: dedupedOrder },
    events,
  };

  return seedUsersIntoStore(store);
};

const seedUsersIntoStore = (store) => {
  const users = loadUsers();
  const teacherUsers = users.filter((u) => u.role === "teacher");
  const studentUsers = users.filter((u) => u.role === "student");

  const teachersById = new Map(store.teachers.map((t) => [t.id, t]));
  teacherUsers.forEach((u) => {
    if (teachersById.has(u.id)) return;
    const record = { id: u.id, name: u.name, active: true, workHours: defaultTeacherWorkHours() };
    store.teachers.push(record);
    teachersById.set(u.id, record);
  });

  const studentsById = new Map(store.students.map((s) => [s.id, s]));
  studentUsers.forEach((u) => {
    if (studentsById.has(u.id)) return;
    const record = { id: u.id, name: u.name };
    store.students.push(record);
    studentsById.set(u.id, record);
  });

  const rankingOrder = Array.isArray(store.ranking?.order) ? store.ranking.order : [];
  const activeTeacherIds = new Set(
    store.teachers
      .filter((t) => t && typeof t === "object" && typeof t.id === "string" && t.active !== false)
      .map((t) => t.id)
  );
  const dedupedOrder = [];
  const seen = new Set();
  rankingOrder.forEach((id) => {
    if (typeof id !== "string") return;
    if (!activeTeacherIds.has(id) || seen.has(id)) return;
    seen.add(id);
    dedupedOrder.push(id);
  });
  store.teachers.forEach((t) => {
    if (!t || typeof t !== "object" || typeof t.id !== "string") return;
    if (t.active === false) return;
    if (seen.has(t.id)) return;
    seen.add(t.id);
    dedupedOrder.push(t.id);
  });
  store.ranking = { order: dedupedOrder };

  return store;
};

const readStore = () => {
  ensureDataDir();

  const raw = safeReadJsonFile(ACTIVE_STORE_PATH) || (ACTIVE_STORE_PATH !== STORE_PATH ? safeReadJsonFile(STORE_PATH) : null);
  if (!raw) {
    const base = buildInitialStore();
    safeWriteJsonFile(ACTIVE_STORE_PATH, base);
    return base;
  }
  const normalized = normalizeStore(raw);
  // Keep the on-disk store shape up to date when possible.
  safeWriteJsonFile(ACTIVE_STORE_PATH, normalized);
  return normalized;
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const withLock = async (fn, { timeoutMs = 1200 } = {}) => {
  ensureDataDir();
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    try {
      const fd = fs.openSync(ACTIVE_LOCK_PATH, "wx");
      try {
        const result = await fn();
        return result;
      } finally {
        try {
          fs.closeSync(fd);
        } catch (error) {
          // ignore
        }
        try {
          fs.unlinkSync(ACTIVE_LOCK_PATH);
        } catch (error) {
          // ignore
        }
      }
    } catch (error) {
      if (error && error.code === "EEXIST") {
        await sleep(25);
        continue;
      }
      // If we can't lock (read-only / no fs), fall back to best-effort without a lock.
      return fn();
    }
  }

  // Timeout: proceed without a lock (best effort) to avoid request hangs.
  return fn();
};

const mutateStore = async (mutator) => {
  return withLock(async () => {
    const store = readStore();
    const clone = JSON.parse(JSON.stringify(store));
    const next = (await mutator(clone)) || store;
    const normalized = normalizeStore(next);
    safeWriteJsonFile(ACTIVE_STORE_PATH, normalized);
    return normalized;
  });
};

module.exports = {
  mutateStore,
  normalizeStore,
  readStore,
};
