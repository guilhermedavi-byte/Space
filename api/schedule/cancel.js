const { readJsonBody, sendJson } = require("../_lib/http");
const { getSessionFromRequest } = require("../_lib/session");
const { mutateStore } = require("../_lib/scheduling-store");
const { normalizeStatus } = require("../_lib/scheduling-core");

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

  if (String(session.role || "") !== "student") {
    sendJson(res, 403, { error: "forbidden" });
    return;
  }

  let body;
  try {
    body = await readJsonBody(req);
  } catch (error) {
    sendJson(res, 400, { error: "invalid_json" });
    return;
  }

  const studentId = String(session.sub || "");
  const eventId = String(body?.id || "").trim();
  if (!studentId || !eventId) {
    sendJson(res, 400, { error: "invalid_request" });
    return;
  }

  let cancelled = false;

  await mutateStore((store) => {
    store.events = Array.isArray(store.events) ? store.events : [];
    const idx = store.events.findIndex((evt) => evt && evt.id === eventId && evt.studentId === studentId);
    if (idx < 0) return store;
    const evt = store.events[idx];
    if (normalizeStatus(evt.status) === "cancelado") return store;
    store.events[idx] = { ...evt, status: "cancelado" };
    cancelled = true;
    return store;
  });

  if (!cancelled) {
    sendJson(res, 404, { error: "not_found" });
    return;
  }

  sendJson(res, 200, { ok: true });
};

