const SPECIAL_FIRST_WEEK_START = '2026-08-11';
const SPECIAL_FIRST_WEEK_END = '2026-08-18';
const WEDNESDAY_INDEX = 3;

const { TIME_ZONE, formatDateKey, isValidDateKey, addDaysToDateKey, periodBounds } = require('./commercial-time');
const toReferenceDate = value => typeof value === 'string' && isValidDateKey(value) ? new Date(`${value}T12:00:00-03:00`) : new Date(value);
const getDayOfWeekInSaoPaulo = key => new Date(key).getUTCDay();

const resolveCommercialWeek = ({ now = new Date() } = {}) => {
  const reference = toReferenceDate(now);
  const nowDateKey = formatDateKey(reference);
  if (nowDateKey >= SPECIAL_FIRST_WEEK_START && nowDateKey <= SPECIAL_FIRST_WEEK_END) {
    return {
      weekKey: `wk_${SPECIAL_FIRST_WEEK_START}`,
      ...periodBounds(SPECIAL_FIRST_WEEK_START, SPECIAL_FIRST_WEEK_END),
      nowDateKey,
      isSpecial: true,
    };
  }

  const dow = getDayOfWeekInSaoPaulo(nowDateKey);
  const diffToWednesday = Number.isNaN(dow) ? 0 : (dow - WEDNESDAY_INDEX + 7) % 7;
  const startDateKey = addDaysToDateKey(nowDateKey, -diffToWednesday);
  const nominalEnd = addDaysToDateKey(startDateKey, 6);
  const endDateKey = startDateKey < SPECIAL_FIRST_WEEK_START && nominalEnd >= SPECIAL_FIRST_WEEK_START
    ? addDaysToDateKey(SPECIAL_FIRST_WEEK_START, -1) : nominalEnd;
  return {
    weekKey: `wk_${startDateKey}`,
    ...periodBounds(startDateKey, endDateKey),
    nowDateKey,
    isSpecial: false,
  };
};

// Accounting partition includes partial weeks at BOTH competence boundaries.
// Planning still owns a complete week by its start month; never prorate targets.
const partitionCommercialPeriod = (period) => {
  const parts = [];
  for (let day = period.startDateKey; day <= period.endDateKey;) {
    const week = resolveCommercialWeek({ now: day });
    const end = week.endDateKey < period.endDateKey ? week.endDateKey : period.endDateKey;
    parts.push({ ...periodBounds(day, end), weekKey: week.weekKey,
      fullWeekStartDateKey: week.startDateKey, fullWeekEndDateKey: week.endDateKey });
    day = addDaysToDateKey(end, 1);
  }
  return parts;
};

module.exports = {
  partitionCommercialPeriod,
  TIME_ZONE,
  SPECIAL_FIRST_WEEK_START,
  SPECIAL_FIRST_WEEK_END,
  resolveCommercialWeek,
  isValidDateKey,
  addDaysToDateKey,
  formatDateKey,
};
