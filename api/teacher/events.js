const { readJsonBody, sendJson } = require("../_lib/http");
const { getSessionFromRequest } = require("../_lib/session");
const { mutateStore, readStore } = require("../_lib/scheduling-store");
const { normalizeStatus } = require("../_lib/scheduling-core");
const { clampInt, isValidDateKey } = require("../_lib/scheduling-utils");

const findStudentName = (store, studentId) => {
  if (!studentId) return null;
  const students = Array.isArray(store.students) ? store.students : [];
  return students.find((s) => s && s.id === studentId)?.name || null;
};

const listTeacherEvents = (store, teacherId, { from, to } = {}) => {
  const events = Array.isArray(store.events) ? store.events : [];
  const fromKey = isValidDateKey(from) ? from : null;
  const toKey = isValidDateKey(to) ? to : null;

  return events
    .filter((evt) => evt && evt.teacherId === teacherId)
    .filter((evt) => {
      if (fromKey && String(evt.dateKey) < fromKey) return false;
      if (toKey && String(evt.dateKey) > toKey) return false;
      return true;
    })
    .map((evt) => {
      const isLesson = evt.studentId != null;
      return {
        id: evt.id,
        type: isLesson ? "lesson" : "manual",
        dateKey: evt.dateKey,
        startMin: evt.startMin,
        endMin: evt.endMin,
        status: normalizeStatus(evt.status),
        title: isLesson ? findStudentName(store, evt.studentId) || "Aluno" : evt.title || "",
        description: isLesson ? "" : evt.description || "",
        guests: isLesson ? [] : Array.isArray(evt.guests) ? evt.guests : [],
        documents: isLesson ? [] : Array.isArray(evt.documents) ? evt.documents : [],
      };
    })
    .sort((a, b) => (a.dateKey === b.dateKey ? a.startMin - b.startMin : a.dateKey.localeCompare(b.dateKey)));
};

const createManualEvent = (store, teacherId, payload) => {
  const dateKey = String(payload?.dateKey || "").trim();
  const startMin = clampInt(payload?.startMin, 0, 1440);
  const endMin = clampInt(payload?.endMin, 0, 1440);
  const title = String(payload?.title || "").trim();
  const description = String(payload?.description || "");
  const guests = Array.isArray(payload?.guests) ? payload.guests.filter((g) => typeof g === "string") : [];
  const documents = Array.isArray(payload?.documents) ? payload.documents.filter((d) => d && typeof d === "object") : [];

  if (!isValidDateKey(dateKey)) return { ok: false, error: "invalid_date" };
  if (endMin <= startMin) return { ok: false, error: "invalid_time" };
  if (!title) return { ok: false, error: "title_required" };

  const event = {
    id: `m_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
    teacherId,
    studentId: null,
    dateKey,
    startMin,
    endMin,
    status: "agendado",
    createdAt: new Date().toISOString(),
    title,
    description,
    guests,
    documents,
  };

  store.events = Array.isArray(store.events) ? store.events : [];
  store.events.push(event);
  return { ok: true, event };
};

const updateManualEvent = (store, teacherId, payload) => {
  const id = String(payload?.id || "").trim();
  if (!id) return { ok: false, error: "id_required" };
  store.events = Array.isArray(store.events) ? store.events : [];
  const idx = store.events.findIndex((evt) => evt && evt.id === id && evt.teacherId === teacherId);
  if (idx < 0) return { ok: false, error: "not_found" };

  const existing = store.events[idx];
  if (existing.studentId != null) return { ok: false, error: "forbidden" };

  const dateKey = String(payload?.dateKey || existing.dateKey || "").trim();
  const startMin = clampInt(payload?.startMin ?? existing.startMin, 0, 1440);
  const endMin = clampInt(payload?.endMin ?? existing.endMin, 0, 1440);
  const title = String(payload?.title ?? existing.title || "").trim();
  const description = String(payload?.description ?? existing.description || "");
  const guests = Array.isArray(payload?.guests) ? payload.guests.filter((g) => typeof g === "string") : existing.guests || [];
  const documents = Array.isArray(payload?.documents) ? payload.documents.filter((d) => d && typeof d === "object") : existing.documents || [];

  if (!isValidDateKey(dateKey)) return { ok: false, error: "invalid_date" };
  if (endMin <= startMin) return { ok: false, error: "invalid_time" };
  if (!title) return { ok: false, error: "title_required" };

  store.events[idx] = {
    ...existing,
    dateKey,
    startMin,
    endMin,
    title,
    description,
    guests,
    documents,
  };

  return { ok: true, event: store.events[idx] };
};

const deleteManualEvent = (store, teacherId, id) => {
  store.events = Array.isArray(store.events) ? store.events : [];
  const idx = store.events.findIndex((evt) => evt && evt.id === id && evt.teacherId === teacherId);
  if (idx < 0) return { ok: false, error: "not_found" };
  const existing = store.events[idx];
  if (existing.studentId != null) return { ok: false, error: "forbidden" };
  store.events.splice(idx, 1);
  return { ok: true };
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
    const host = String(req.headers.host || "localhost");
    const url = new URL(req.url || "/api/teacher/events", `https://${host}`);
    const from = url.searchParams.get("from") || "";
    const to = url.searchParams.get("to") || "";
    const events = listTeacherEvents(store, teacherId, { from, to });
    sendJson(res, 200, { events });
    return;
  }

  if (req.method === "POST" || req.method === "PUT" || req.method === "DELETE") {
    let body;
    try {
      body = await readJsonBody(req);
    } catch (error) {
      sendJson(res, 400, { error: "invalid_json" });
      return;
    }

    let result = null;

    await mutateStore((store) => {
      if (req.method === "POST") {
        result = createManualEvent(store, teacherId, body);
        return store;
      }
      if (req.method === "PUT") {
        result = updateManualEvent(store, teacherId, body);
        return store;
      }
      if (req.method === "DELETE") {
        const id = String(body?.id || "").trim();
        if (!id) {
          result = { ok: false, error: "id_required" };
          return store;
        }
        result = deleteManualEvent(store, teacherId, id);
        return store;
      }
      return store;
    });

    if (!result || !result.ok) {
      const err = result?.error || "unknown";
      const status = err === "not_found" ? 404 : err === "forbidden" ? 403 : 400;
      sendJson(res, status, { error: err });
      return;
    }

    sendJson(res, 200, result.event ? { ok: true, event: result.event } : { ok: true });
    return;
  }

  res.setHeader("Allow", "GET, HEAD, POST, PUT, DELETE");
  sendJson(res, 405, { error: "method_not_allowed" });
};

