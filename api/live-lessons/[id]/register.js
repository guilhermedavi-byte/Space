const { readJsonBody, sendJson } = require("../../_lib/http");
const { getSessionFromRequest } = require("../../_lib/session");
const { fetchLessonById, canEditLesson, createLessonRegister, normalizeRole } = require("../../_lib/live-lessons");

const labelForStatus = (status) => {
  const s = String(status || "").toLowerCase();
  if (s === "falta") return "Falta";
  if (s === "remarcada") return "Remarcada";
  return "Realizada";
};

const getRouteId = (req) => {
  const fromQuery = String(req.query?.id || "").trim();
  if (fromQuery) return fromQuery;
  const match = String(req.url || "").match(/\/live-lessons\/([^/?#]+)\/register/);
  return match ? decodeURIComponent(match[1]) : "";
};

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    sendJson(res, 405, { error: "method_not_allowed" });
    return;
  }

  const session = getSessionFromRequest(req);
  if (!session) {
    sendJson(res, 401, { error: "unauthorized" });
    return;
  }
  if (normalizeRole(session.role) !== "teacher") {
    sendJson(res, 403, { error: "teacher_only" });
    return;
  }

  const id = getRouteId(req);
  const payload = await readJsonBody(req).catch(() => null);
  const status = String(payload?.status || "realizada").trim().toLowerCase();
  if (!id || !["realizada", "falta", "remarcada"].includes(status)) {
    sendJson(res, 400, { error: "invalid_payload" });
    return;
  }

  try {
    const lesson = await fetchLessonById(id);
    if (!lesson) {
      sendJson(res, 404, { error: "not_found" });
      return;
    }
    if (!canEditLesson(session, lesson)) {
      sendJson(res, 403, { error: "forbidden" });
      return;
    }
    const result = await createLessonRegister({ lesson, session, payload: { ...payload, status } });
    sendJson(res, 200, { ...result, label: labelForStatus(status) });
  } catch (error) {
    console.error("[api] live lesson register failed", error);
    sendJson(res, 500, { error: "register_failed" });
  }
};
