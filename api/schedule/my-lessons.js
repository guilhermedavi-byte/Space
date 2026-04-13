const { sendJson } = require("../_lib/http");
const { getSessionFromRequest } = require("../_lib/session");
const { normalizeStatus } = require("../_lib/scheduling-core");
const { verifyFirebaseIdToken } = require("../_lib/firebase-id-token");
const { toUtcMsForDateKeyAndMinutes } = require("../_lib/scheduling-utils");
const {
  decodeFields,
  firestoreGetDocument,
  firestoreListDocuments,
  getBearerTokenFromRequest,
} = require("../_lib/firestore-rest");
const { DEFAULT_CONFIG, decodeStoreEvent } = require("../_lib/scheduling-firestore");

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

  const tzOffsetMinutes = DEFAULT_CONFIG.tzOffsetMinutes;
  const now = Date.now();

  let rawEvents = [];
  try {
    const resList = await firestoreListDocuments({ collectionPath: "events", idToken, pageSize: 1200 });
    if (!resList.ok) throw new Error("firestore_list_failed");
    const docs = Array.isArray(resList.documents) ? resList.documents : Array.isArray(resList.data?.documents) ? resList.data.documents : [];
    rawEvents = docs
      .map((doc) => decodeStoreEvent(doc))
      .filter(Boolean)
      .filter((evt) => evt.studentId === studentId)
      .filter((evt) => normalizeStatus(evt.status) !== "cancelado");
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[api] schedule my-lessons query failed", error);
    sendJson(res, 500, { error: "internal_error" });
    return;
  }

  const upcoming = rawEvents
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

  const teacherCache = new Map();

  const getTeacherName = async (teacherId) => {
    if (!teacherId) return null;
    if (teacherCache.has(teacherId)) return teacherCache.get(teacherId);
    try {
      const snap = await firestoreGetDocument({ docPath: `users/${encodeURIComponent(teacherId)}`, idToken });
      if (!snap.ok) {
        teacherCache.set(teacherId, null);
        return null;
      }
      const fields = decodeFields(snap.data);
      const name = typeof fields?.nome === "string" ? fields.nome.trim() : "";
      teacherCache.set(teacherId, name || null);
      return name || null;
    } catch (error) {
      teacherCache.set(teacherId, null);
      return null;
    }
  };

  const lessons = [];
  for (const evt of upcoming) {
    const hoursRestantes = hoursBetween(now, evt.startMs);
    const teacherVisible = evt.status === "agendado" && hoursRestantes <= 12;
    const teacherName = teacherVisible ? await getTeacherName(evt.teacherId) : null;
    lessons.push({
      id: evt.id,
      dateKey: evt.dateKey,
      startMin: evt.startMin,
      endMin: evt.endMin,
      status: evt.status,
      professor_nome: teacherName,
    });
  }

  sendJson(res, 200, { lessons });
};
