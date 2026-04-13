const { readJsonBody, sendJson } = require("../_lib/http");
const { getSessionFromRequest } = require("../_lib/session");
const { bookSlotForStudent } = require("../_lib/scheduling-core");
const { clampInt, isValidDateKey } = require("../_lib/scheduling-utils");
const { verifyFirebaseIdToken } = require("../_lib/firebase-id-token");
const { firestorePatchDocument, getBearerTokenFromRequest } = require("../_lib/firestore-rest");
const {
  DEFAULT_CONFIG,
  fetchActiveTeachers,
  fetchEventsForDateKey,
  fetchRankingOrder,
  fetchTeacherWorkHours,
} = require("../_lib/scheduling-firestore");

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

  const studentId = String(session.sub || "");
  const idToken = getBearerTokenFromRequest(req);
  if (!studentId || !idToken) {
    sendJson(res, 401, { error: "unauthorized" });
    return;
  }

  try {
    const decoded = await verifyFirebaseIdToken(idToken);
    if (decoded.uid !== studentId) {
      sendJson(res, 401, { error: "invalid_credentials" });
      return;
    }
  } catch (error) {
    sendJson(res, 401, { error: "invalid_credentials" });
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

  let teachers = [];
  let order = [];
  let events = [];

  try {
    const activeTeachers = await fetchActiveTeachers({ idToken });
    const teacherIds = activeTeachers.map((t) => t.id);
    const storedOrder = await fetchRankingOrder({ idToken });
    const deduped = [];
    const seen = new Set();
    storedOrder.forEach((id) => {
      if (!teacherIds.includes(id)) return;
      if (seen.has(id)) return;
      seen.add(id);
      deduped.push(id);
    });
    teacherIds.forEach((id) => {
      if (seen.has(id)) return;
      seen.add(id);
      deduped.push(id);
    });
    order = deduped;

    teachers = await Promise.all(
      activeTeachers.map(async (teacher) => {
        const workHours = await fetchTeacherWorkHours({ idToken, teacherId: teacher.id });
        return { id: teacher.id, name: teacher.name, active: teacher.active !== false, workHours };
      })
    );

    events = await fetchEventsForDateKey({ idToken, dateKey });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[api] schedule book load failed", error);
    sendJson(res, 500, { error: "internal_error" });
    return;
  }

  const store = {
    config: DEFAULT_CONFIG,
    teachers,
    ranking: { order },
    events: Array.isArray(events) ? events : [],
  };

  const result = bookSlotForStudent({ store, studentId, dateKey, startMin, endMin });
  if (!result.ok || !result.event) {
    const failure = result.error || "unknown";
    const status = failure === "student_conflict" ? 409 : failure === "slot_unavailable" ? 409 : 400;
    sendJson(res, status, { error: failure || "booking_failed" });
    return;
  }

  const created = result.event;

  try {
    const docPath = `events/${encodeURIComponent(created.id)}`;
    const patch = await firestorePatchDocument({
      docPath,
      idToken,
      data: {
        teacherId: created.teacherId,
        studentId: created.studentId,
        studentName: String(session.name || "").trim() || "Aluno",
        dateKey: created.dateKey,
        startMin: created.startMin,
        endMin: created.endMin,
        status: created.status,
        createdAt: new Date(),
        kind: "lesson",
      },
      updateMaskPaths: [
        "teacherId",
        "studentId",
        "studentName",
        "dateKey",
        "startMin",
        "endMin",
        "status",
        "createdAt",
        "kind",
      ],
    });
    if (!patch.ok) throw new Error("firestore_patch_failed");
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[api] schedule book save failed", error);
    sendJson(res, 500, { error: "internal_error" });
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
