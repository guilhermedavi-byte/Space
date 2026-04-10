const { sendJson } = require("../_lib/http");
const { getSessionFromRequest } = require("../_lib/session");
const { readStore } = require("../_lib/scheduling-store");
const { computeAvailableSlotsForDate } = require("../_lib/scheduling-core");
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

  const store = readStore();
  const host = String(req.headers.host || "localhost");
  const url = new URL(req.url || "/api/schedule/slots", `https://${host}`);

  const daysCount = clampInt(url.searchParams.get("days") || 4, 1, 7);
  const startParam = String(url.searchParams.get("start") || "").trim();
  const start = isValidDateKey(startParam) ? startParam : dateKeyNowForOffset(store.config.tzOffsetMinutes);

  const days = collectValidDateKeys(start, daysCount).map(({ dateKey, dow }) => {
    const { slots } = computeAvailableSlotsForDate(store, dateKey);
    return {
      dateKey,
      dow,
      slots: slots.map((slot) => ({
        startMin: slot.startMin,
        endMin: slot.endMin,
        time: minutesToTime(slot.startMin),
      })),
    };
  });

  sendJson(res, 200, {
    timeZone: store.config.timeZone,
    tzOffsetMinutes: store.config.tzOffsetMinutes,
    slotDurationMinutes: store.config.slotDurationMinutes,
    days,
  });
};

