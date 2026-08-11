const TIME_ZONE = "America/Sao_Paulo";

const formatSaoPauloDateKey = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value || "";
  const month = parts.find((part) => part.type === "month")?.value || "";
  const day = parts.find((part) => part.type === "day")?.value || "";
  if (!year || !month || !day) return "";
  return `${year}-${month}-${day}`;
};

const isValidDateKey = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || "").trim());

const toLocalNoonDate = (dateKey) => {
  if (!isValidDateKey(dateKey)) return null;
  const date = new Date(`${dateKey}T12:00:00-03:00`);
  return Number.isNaN(date.getTime()) ? null : date;
};

const getCalendarMonthBounds = (now = new Date()) => {
  const nowDate = now instanceof Date ? now : new Date(now);
  const nowKey = formatSaoPauloDateKey(nowDate);
  const monthKey = nowKey.slice(0, 7);
  const startDateKey = `${monthKey}-01`;
  const startDate = toLocalNoonDate(startDateKey);
  const endDate = startDate ? new Date(startDate) : null;
  if (endDate) {
    endDate.setMonth(endDate.getMonth() + 1);
    endDate.setDate(0);
  }
  return {
    monthKey,
    startDateKey,
    endDateKey: endDate ? formatSaoPauloDateKey(endDate) : startDateKey,
  };
};

const resolveCommercialPeriod = ({ now = new Date(), periodStart = "", periodEnd = "" } = {}) => {
  const nowDate = now instanceof Date ? now : new Date(now);
  const nowDateKey = formatSaoPauloDateKey(nowDate);
  const bounds = getCalendarMonthBounds(nowDate);
  const startDateKey = isValidDateKey(periodStart) ? String(periodStart).trim() : bounds.startDateKey;
  const endDateKey = isValidDateKey(periodEnd) ? String(periodEnd).trim() : bounds.endDateKey;
  if (startDateKey > endDateKey) {
    return {
      monthKey: bounds.monthKey,
      startDateKey: bounds.startDateKey,
      endDateKey: bounds.endDateKey,
      nowDateKey,
      isCustom: false,
    };
  }
  return {
    monthKey: bounds.monthKey,
    startDateKey,
    endDateKey,
    nowDateKey,
    isCustom: startDateKey !== bounds.startDateKey || endDateKey !== bounds.endDateKey,
  };
};

const isDateWithinCommercialPeriod = (value, period) => {
  if (!period || typeof period !== "object") return false;
  const dateKey = formatSaoPauloDateKey(value);
  if (!dateKey) return false;
  return dateKey >= String(period.startDateKey || "") && dateKey <= String(period.endDateKey || "");
};

const countPeriodDaysElapsedInclusive = (period, now = new Date()) => {
  if (!period) return 0;
  const nowKey = formatSaoPauloDateKey(now);
  if (!nowKey || nowKey < period.startDateKey) return 0;
  const endBound = nowKey > period.endDateKey ? period.endDateKey : nowKey;
  const startDate = toLocalNoonDate(period.startDateKey);
  const endDate = toLocalNoonDate(endBound);
  if (!startDate || !endDate) return 0;
  return Math.floor((endDate.getTime() - startDate.getTime()) / 86400000) + 1;
};

const countRemainingWeekdaysMonFri = (period, now = new Date()) => {
  if (!period) return 0;
  const nowKey = formatSaoPauloDateKey(now);
  const fromKey = !nowKey || nowKey < period.startDateKey ? period.startDateKey : nowKey;
  const fromDate = toLocalNoonDate(fromKey);
  const endDate = toLocalNoonDate(period.endDateKey);
  if (!fromDate || !endDate || fromDate > endDate) return 0;
  let count = 0;
  for (const cursor = new Date(fromDate); cursor <= endDate; cursor.setDate(cursor.getDate() + 1)) {
    if (formatSaoPauloDateKey(cursor) === fromKey) continue;
    const weekday = cursor.getDay();
    if (weekday !== 0 && weekday !== 6) count += 1;
  }
  return count;
};

const countRemainingSalesDaysSegSabInclusive = (period, now = new Date()) => {
  if (!period) return 0;
  const nowKey = formatSaoPauloDateKey(now);
  const fromKey = !nowKey || nowKey < period.startDateKey ? period.startDateKey : nowKey;
  const fromDate = toLocalNoonDate(fromKey);
  const endDate = toLocalNoonDate(period.endDateKey);
  if (!fromDate || !endDate || fromDate > endDate) return 0;
  let count = 0;
  for (const cursor = new Date(fromDate); cursor <= endDate; cursor.setDate(cursor.getDate() + 1)) {
    if (cursor.getDay() !== 0) count += 1;
  }
  return count;
};

module.exports = {
  formatSaoPauloDateKey,
  getCalendarMonthBounds,
  resolveCommercialPeriod,
  isDateWithinCommercialPeriod,
  countPeriodDaysElapsedInclusive,
  countRemainingWeekdaysMonFri,
  countRemainingSalesDaysSegSabInclusive,
  isValidDateKey,
};
