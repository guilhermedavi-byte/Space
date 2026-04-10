const { readJsonBody, sendJson } = require("../_lib/http");
const { getSessionFromRequest } = require("../_lib/session");
const { mutateStore } = require("../_lib/scheduling-store");
const { bookSlotForStudent } = require("../_lib/scheduling-core");
const { clampInt, isValidDateKey } = require("../_lib/scheduling-utils");

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

  const dateKey = String(body?.dateKey || "").trim();
  const startMin = clampInt(body?.startMin, 0, 1440);
  const endMin = body?.endMin == null ? null : clampInt(body.endMin, 0, 1440);

  if (!isValidDateKey(dateKey)) {
    sendJson(res, 400, { error: "invalid_date" });
    return;
  }

  const studentId = String(session.sub || "");
  if (!studentId) {
    sendJson(res, 401, { error: "unauthorized" });
    return;
  }

  let created = null;
  let failure = null;

  await mutateStore((store) => {
    const result = bookSlotForStudent({ store, studentId, dateKey, startMin, endMin });
    if (!result.ok) {
      failure = result.error || "unknown";
      return store;
    }
    created = result.event;
    return store;
  });

  if (!created) {
    const status = failure === "student_conflict" ? 409 : failure === "slot_unavailable" ? 409 : 400;
    sendJson(res, status, { error: failure || "booking_failed" });
    return;
  }

  // Never return teacher info here (student only sees the teacher close to the class time).
  sendJson(res, 200, {
    ok: true,
    event: {
      id: created.id,
      dateKey: created.dateKey,
      startMin: created.startMin,
      endMin: created.endMin,
      status: created.status,
    },
    message: "Aula agendada com sucesso! O professor sera revelado 12h antes da aula.",
  });
};

