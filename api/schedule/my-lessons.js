const { sendJson } = require("../_lib/http");
const { getSessionFromRequest } = require("../_lib/session");
const { readStore } = require("../_lib/scheduling-store");
const { getTeacherById, normalizeStatus } = require("../_lib/scheduling-core");
const { toUtcMsForDateKeyAndMinutes } = require("../_lib/scheduling-utils");

const hoursBetween = (fromMs, toMs) => (toMs - fromMs) / (1000 * 60 * 60);

module.exports = async (req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    sendJson(res, 405, { error: "method_not_allowed" });
    return;
  }

  const session = getSessionFromRequest(req);
  if (!session) {
    sendJson(res, 401, { error: "unauthorized" });
    return;
  }

  if (String(session.role || "") !== "student") {
    sendJson(res, 403, { error: "forbidden" });
    return;
  }

  const studentId = String(session.sub || "");
  if (!studentId) {
    sendJson(res, 401, { error: "unauthorized" });
    return;
  }

  const store = readStore();
  const tzOffsetMinutes = store.config.tzOffsetMinutes;
  const now = Date.now();

  const events = Array.isArray(store.events) ? store.events : [];
  const upcoming = events
    .filter((evt) => evt && evt.studentId === studentId)
    .filter((evt) => normalizeStatus(evt.status) !== "cancelado")
    .map((evt) => {
      const startMs = toUtcMsForDateKeyAndMinutes(evt.dateKey, evt.startMin, { tzOffsetMinutes });
      const endMs = toUtcMsForDateKeyAndMinutes(evt.dateKey, evt.endMin, { tzOffsetMinutes });
      return startMs && endMs
        ? {
            id: evt.id,
            dateKey: evt.dateKey,
            startMin: evt.startMin,
            endMin: evt.endMin,
            status: normalizeStatus(evt.status),
            teacherId: evt.teacherId,
            startMs,
            endMs,
          }
        : null;
    })
    .filter(Boolean)
    .filter((evt) => evt.endMs > now)
    .sort((a, b) => a.startMs - b.startMs);

  const lessons = upcoming.map((evt) => {
    const hoursRestantes = hoursBetween(now, evt.startMs);
    const teacherVisible = evt.status === "agendado" && hoursRestantes <= 12;
    const teacherName = teacherVisible ? getTeacherById(store, evt.teacherId)?.name || null : null;

    return {
      id: evt.id,
      dateKey: evt.dateKey,
      startMin: evt.startMin,
      endMin: evt.endMin,
      status: evt.status,
      professor_nome: teacherName,
    };
  });

  sendJson(res, 200, { lessons });
};

