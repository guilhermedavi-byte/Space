// Canonical civil calendar and half-open instants. Independent of process TZ.
const TIME_ZONE = 'America/Sao_Paulo';
const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' });
const formatDateKey = value => {
  const d = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(d.getTime())) return '';
  const parts = formatter.formatToParts(d);
  return ['year', 'month', 'day'].map(k => parts.find(p => p.type === k).value).join('-');
};
const isValidDateKey = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
const addDaysToDateKey = (key, days) => {
  if (!isValidDateKey(key) || !Number.isInteger(days)) throw new Error('invalid_commercial_date');
  return new Date(Date.parse(key) + days * 86400000).toISOString().slice(0,10);
};
const starts = new Map();
function startOfDateMs(key) {
  if (!isValidDateKey(key)) throw new Error('invalid_commercial_date');
  if (starts.has(key)) return starts.get(key);
  // First actual instant of a civil day also handles historical DST midnight gaps.
  let low = Date.parse(key) - 36 * 3600000, high = Date.parse(key) + 36 * 3600000;
  while (low < high) { const mid = Math.floor((low + high) / 2); if (formatDateKey(mid) < key) low = mid + 1; else high = mid; }
  if (starts.size > 4096) starts.clear();
  starts.set(key, low); return low;
}
function periodBounds(startDateKey, endDateKey) {
  if (!isValidDateKey(startDateKey) || !isValidDateKey(endDateKey) || startDateKey > endDateKey) throw new Error('invalid_commercial_period');
  const endExclusiveDateKey = addDaysToDateKey(endDateKey, 1);
  return { startDateKey, endDateKey, endExclusiveDateKey, timezone: TIME_ZONE,
    start: new Date(startOfDateMs(startDateKey)).toISOString(), end: new Date(startOfDateMs(endExclusiveDateKey)).toISOString() };
}
function containsInstant(value, period) {
  if (!period) return false;
  const ms = value instanceof Date ? value.getTime() : Date.parse(value);
  if (!Number.isFinite(ms)) return false;
  const bounds = periodBounds(period.startDateKey, period.endDateKey);
  return ms >= Date.parse(bounds.start) && ms < Date.parse(bounds.end);
}
// Date-only source fields mean a civil day, not UTC midnight.
function parseCommercialDate(value) {
  if (isValidDateKey(value)) return new Date(startOfDateMs(value));
  if (typeof value === 'string' && !/(Z|[+-]\d{2}:?\d{2})$/i.test(value)) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isFinite(d.getTime()) ? d : null;
}
module.exports = { TIME_ZONE, formatDateKey, isValidDateKey, addDaysToDateKey, startOfDateMs, periodBounds, containsInstant, parseCommercialDate };
