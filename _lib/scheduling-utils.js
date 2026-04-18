const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

const clampInt = (value, min, max) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.trunc(n)));
};

const isValidDateKey = (dateKey) => DATE_KEY_RE.test(String(dateKey || ""));

const parseDateKeyParts = (dateKey) => {
  if (!isValidDateKey(dateKey)) return null;
  const [y, m, d] = String(dateKey).split("-").map((v) => Number(v));
  if (!y || !m || !d) return null;
  return { year: y, month: m, day: d };
};

const dateKeyToUtcDate = (dateKey) => {
  const parts = parseDateKeyParts(dateKey);
  if (!parts) return null;
  // Use UTC to avoid runtime timezone differences.
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
};

const getDayOfWeekFromDateKey = (dateKey) => {
  const d = dateKeyToUtcDate(dateKey);
  if (!d) return null;
  return d.getUTCDay(); // 0 (Sun) - 6 (Sat)
};

const addDaysToDateKey = (dateKey, deltaDays) => {
  const d = dateKeyToUtcDate(dateKey);
  if (!d) return null;
  d.setUTCDate(d.getUTCDate() + Number(deltaDays || 0));
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const addBusinessDaysSkippingSunday = (startDateKey, businessDays) => {
  let cursor = String(startDateKey || "");
  if (!isValidDateKey(cursor)) return null;
  let added = 0;

  while (added < businessDays) {
    cursor = addDaysToDateKey(cursor, 1);
    const dow = getDayOfWeekFromDateKey(cursor);
    if (dow === 0) continue; // skip Sunday
    added += 1;
  }

  return cursor;
};

const timeToMinutes = (time) => {
  const raw = String(time || "").trim();
  if (!TIME_RE.test(raw)) return null;
  const [h, m] = raw.split(":").map((v) => Number(v));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
};

const minutesToTime = (minutes) => {
  const safe = clampInt(minutes, 0, 1439);
  const h = String(Math.floor(safe / 60)).padStart(2, "0");
  const m = String(safe % 60).padStart(2, "0");
  return `${h}:${m}`;
};

const rangesOverlap = (aStart, aEnd, bStart, bEnd) => {
  return Number(aStart) < Number(bEnd) && Number(bStart) < Number(aEnd);
};

const toUtcMsForDateKeyAndMinutes = (dateKey, minutesFromMidnight, { tzOffsetMinutes = -180 } = {}) => {
  const parts = parseDateKeyParts(dateKey);
  if (!parts) return null;
  const minutes = clampInt(minutesFromMidnight, 0, 1440);
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  // Build a UTC timestamp that represents the local time in the chosen timezone offset.
  // Example: local 2026-04-10 09:00 at -03:00 => UTC 2026-04-10 12:00.
  const utcMs = Date.UTC(parts.year, parts.month - 1, parts.day, hours, mins, 0, 0);
  return utcMs - tzOffsetMinutes * 60 * 1000;
};

module.exports = {
  addBusinessDaysSkippingSunday,
  addDaysToDateKey,
  clampInt,
  getDayOfWeekFromDateKey,
  isValidDateKey,
  minutesToTime,
  parseDateKeyParts,
  rangesOverlap,
  timeToMinutes,
  toUtcMsForDateKeyAndMinutes,
};

