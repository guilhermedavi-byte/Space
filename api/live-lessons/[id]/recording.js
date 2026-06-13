const { readJsonBody, sendJson } = require("../../_lib/http");
const { getSessionFromRequest } = require("../../_lib/session");
const { fetchLessonById, canEditLesson, normalizeRole } = require("../../_lib/live-lessons");
const {
  createRecording,
  getLatestRecordingForLesson,
  listRecordingsForLesson,
  stopLatestRecording,
  updateRecording,
} = require("../../_lib/live-recordings");

const getRouteId = (req) => {
  const fromQuery = String(req.query?.id || "").trim();
  if (fromQuery) return fromQuery;
  const match = String(req.url || "").match(/\/live-lessons\/([^/?#]+)\/recording/);
  return match ? decodeURIComponent(match[1]) : "";
};

const ensureCanRecord = async (req) => {
  const session = getSessionFromRequest(req);
  if (!session) {
    const error = new Error("unauthorized");
    error.status = 401;
    throw error;
  }
  const role = normalizeRole(session.role);
  if (role !== "teacher" && role !== "admin") {
    const error = new Error("teacher_or_admin_only");
    error.status = 403;
    throw error;
  }
  const id = getRouteId(req);
  const lesson = id ? await fetchLessonById(id) : null;
  if (!lesson) {
    const error = new Error("not_found");
    error.status = 404;
    throw error;
  }
  if (!canEditLesson(session, lesson)) {
    const error = new Error("forbidden");
    error.status = 403;
    throw error;
  }
  return { session, lesson };
};

module.exports = async (req, res) => {
  if (!["GET", "POST", "PATCH"].includes(req.method)) {
    res.setHeader("Allow", "GET, POST, PATCH");
    sendJson(res, 405, { error: "method_not_allowed" });
    return;
  }

  try {
    const { session, lesson } = await ensureCanRecord(req);

    if (req.method === "GET") {
      const recordings = await listRecordingsForLesson(lesson.id);
      sendJson(res, 200, { latest: recordings[0] || null, recordings });
      return;
    }

    const body = await readJsonBody(req).catch(() => ({}));
    const action = String(body?.action || "").trim().toLowerCase();

    if (action === "start") {
      const latest = await getLatestRecordingForLesson(lesson.id);
      if (latest && ["requested", "recording"].includes(String(latest.status || "").toLowerCase())) {
        sendJson(res, 200, { recording: latest, alreadyActive: true });
        return;
      }
      const recording = await createRecording({ lesson, session, status: "recording" });
      sendJson(res, 200, { recording });
      return;
    }

    if (action === "stop") {
      const recording = await stopLatestRecording(lesson.id);
      sendJson(res, 200, { recording });
      return;
    }

    if (action === "save_transcript") {
      const latest = await getLatestRecordingForLesson(lesson.id);
      if (!latest) {
        sendJson(res, 404, { error: "recording_not_found" });
        return;
      }
      const transcript = String(body?.transcricao_texto || body?.transcript || "").trim();
      const recording = await updateRecording(latest.id, {
        transcricao_texto: transcript || null,
        transcricao_status: transcript ? "saved" : "empty",
      });
      sendJson(res, 200, { recording });
      return;
    }

    sendJson(res, 400, { error: "invalid_action" });
  } catch (error) {
    const status = Number(error?.status) || 500;
    if (status >= 500) {
      console.error("[api] live lesson recording failed", {
        message: error?.message,
        code: error?.code,
        details: error?.details,
        hint: error?.hint,
      });
    }
    sendJson(res, status, { error: error?.message || "recording_failed" });
  }
};
