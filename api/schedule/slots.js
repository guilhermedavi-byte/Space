const { sendJson } = require("../_lib/http");
const { getSessionFromRequest } = require("../_lib/session");
const { computeAvailableSlotsForDate } = require("../_lib/scheduling-core");
const { verifyFirebaseIdToken } = require("../_lib/firebase-id-token");
const { firestoreListDocuments, getBearerTokenFromRequest } = require("../_lib/firestore-rest");
const {
  DEFAULT_CONFIG,
  decodeStoreEvent,
  fetchActiveTeachers,
  fetchRankingOrder,
  fetchTeacherWorkHours,
} = require("../_lib/scheduling-firestore");
const {
  addDaysToDateKey,
  clampInt,
  getDayOfWeekFromDateKey,
  isValidDateKey,
  minutesToTime,
} = require("../_lib/scheduling-utils");

const dateKeyNowForOffset = (tzOffsetMinutes) => {
  const offset = clampInt(tzOffsetMinutes, -12 * 60, 14 * 60);
  const shifted = new Date(Date.now() + offset * 60 * 1000);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const d = String(shifted.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const collectValidDateKeys = (startDateKey, count) => {
  const days = [];
  let cursor = String(startDateKey || "");
  if (!isValidDateKey(cursor)) return days;
  let safety = 0;

  while (days.length < count && safety < 20) {
    const dow = getDayOfWeekFromDateKey(cursor);
    if (dow !== 0) {
      days.push({ dateKey: cursor, dow });
    }
    cursor = addDaysToDateKey(cursor, 1);
    safety += 1;
  }

  return days;
};

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

  const host = String(req.headers.host || "localhost");
  const url = new URL(req.url || "/api/schedule/slots", `https://${host}`);

  const daysCount = clampInt(url.searchParams.get("days") || 4, 1, 7);
  const startParam = String(url.searchParams.get("start") || "").trim();
  const start = isValidDateKey(startParam) ? startParam : dateKeyNowForOffset(DEFAULT_CONFIG.tzOffsetMinutes);

  let teachers = [];
  let order = [];

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
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[api] schedule slots teachers fetch failed", error);
    sendJson(res, 500, { error: "internal_error" });
    return;
  }

  const days = [];
  const dateKeys = collectValidDateKeys(start, daysCount);
  const requestedKeys = new Set(dateKeys.map((d) => d.dateKey));

  let allEvents = [];
  try {
    const resEvents = await firestoreListDocuments({ collectionPath: "events", idToken, pageSize: 1600 });
    if (!resEvents.ok) throw new Error("firestore_list_failed");
    const docs = Array.isArray(resEvents.documents)
      ? resEvents.documents
      : Array.isArray(resEvents.data?.documents)
        ? resEvents.data.documents
        : [];
    allEvents = docs.map((doc) => decodeStoreEvent(doc)).filter(Boolean).filter((evt) => requestedKeys.has(evt.dateKey));
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[api] schedule slots events prefetch failed", error);
    allEvents = [];
  }

  const eventsByDate = new Map();
  allEvents.forEach((evt) => {
    const key = String(evt.dateKey || "");
    if (!eventsByDate.has(key)) eventsByDate.set(key, []);
    eventsByDate.get(key).push(evt);
  });

  for (const entry of dateKeys) {
    const dateKey = entry.dateKey;
    const dow = entry.dow;
    const events = eventsByDate.get(dateKey) || [];

    const store = {
      config: DEFAULT_CONFIG,
      teachers,
      ranking: { order },
      events,
    };

    const { slots } = computeAvailableSlotsForDate(store, dateKey);
    days.push({
      dateKey,
      dow,
      slots: slots.map((slot) => ({
        startMin: slot.startMin,
        endMin: slot.endMin,
        time: minutesToTime(slot.startMin),
      })),
    });
  }

  sendJson(res, 200, {
    timeZone: DEFAULT_CONFIG.timeZone,
    tzOffsetMinutes: DEFAULT_CONFIG.tzOffsetMinutes,
    slotDurationMinutes: DEFAULT_CONFIG.slotDurationMinutes,
    days,
  });
};
