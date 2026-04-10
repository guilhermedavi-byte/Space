const { readJsonBody, sendJson } = require("../_lib/http");
const { getSessionFromRequest } = require("../_lib/session");
const { mutateStore, readStore } = require("../_lib/scheduling-store");
const { clampInt } = require("../_lib/scheduling-utils");

const normalizeWindows = (raw) => {
  const windows = Array.isArray(raw) ? raw : [];
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

const validateWorkHours = (workHours) => {
  const errors = [];
  for (let dow = 0; dow <= 6; dow += 1) {
    const dayKey = String(dow);
    const windows = normalizeWindows(workHours[dayKey]);
    for (let i = 1; i < windows.length; i += 1) {
      const prev = windows[i - 1];
      const cur = windows[i];
      if (cur.startMin < prev.endMin) {
        errors.push({ day: dayKey, code: "overlap" });
        break;
      }
    }
  }
  return errors;
};

const normalizeWorkHoursPayload = (value) => {
  const payload = value && typeof value === "object" ? value : {};
  const workHoursRaw = payload.workHours && typeof payload.workHours === "object" ? payload.workHours : {};
  const out = {};
  for (let dow = 0; dow <= 6; dow += 1) {
    const dayKey = String(dow);
    out[dayKey] = normalizeWindows(workHoursRaw[dayKey]);
  }
  return out;
};

const getTeacherRecord = (store, teacherId) => {
  return (store.teachers || []).find((t) => t && t.id === teacherId) || null;
};

module.exports = async (req, res) => {
  const session = getSessionFromRequest(req);
  if (!session) {
    sendJson(res, 401, { error: "unauthorized" });
    return;
  }

  if (String(session.role || "") !== "teacher") {
    sendJson(res, 403, { error: "forbidden" });
    return;
  }

  const teacherId = String(session.sub || "");
  if (!teacherId) {
    sendJson(res, 401, { error: "unauthorized" });
    return;
  }

  if (req.method === "GET" || req.method === "HEAD") {
    const store = readStore();
    const teacher = getTeacherRecord(store, teacherId);
    sendJson(res, 200, { workHours: teacher ? teacher.workHours : {} });
    return;
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, HEAD, POST");
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

  const workHours = normalizeWorkHoursPayload(body);
  const errors = validateWorkHours(workHours);
  if (errors.length) {
    sendJson(res, 400, { error: "invalid_work_hours", details: errors });
    return;
  }

  await mutateStore((store) => {
    store.teachers = Array.isArray(store.teachers) ? store.teachers : [];
    const idx = store.teachers.findIndex((t) => t && t.id === teacherId);
    if (idx < 0) {
      store.teachers.push({ id: teacherId, name: String(session.name || "Professor"), workHours });
    } else {
      store.teachers[idx] = { ...store.teachers[idx], workHours };
    }
    return store;
  });

  sendJson(res, 200, { ok: true });
};

