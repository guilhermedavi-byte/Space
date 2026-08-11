const TIME_ZONE = 'America/Sao_Paulo';
const SPECIAL_FIRST_WEEK_START = '2026-08-11';
const SPECIAL_FIRST_WEEK_END = '2026-08-18';
const WEDNESDAY_INDEX = 3;

const pad2 = (value) => String(value).padStart(2, '0');

const formatDateKey = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type)?.value || '';
  return `${get('year')}-${get('month')}-${get('day')}`;
};

const isValidDateKey = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || '').trim());

const toReferenceDate = (value) => {
  if (value instanceof Date) return new Date(value.getTime());
  if (typeof value === 'string' && isValidDateKey(value)) return new Date(`${value}T12:00:00-03:00`);
  const date = new Date(value || Date.now());
  return Number.isNaN(date.getTime()) ? new Date() : date;
};

const addDaysToDateKey = (dateKey, days) => {
  const safe = isValidDateKey(dateKey) ? dateKey : formatDateKey(new Date());
  const date = new Date(`${safe}T12:00:00-03:00`);
  date.setDate(date.getDate() + Number(days || 0));
  return formatDateKey(date);
};

const getDayOfWeekInSaoPaulo = (dateKey) => {
  const date = new Date(`${dateKey}T12:00:00-03:00`);
  return Number.isNaN(date.getTime()) ? NaN : date.getDay();
};

const resolveCommercialWeek = ({ now = new Date() } = {}) => {
  const reference = toReferenceDate(now);
  const nowDateKey = formatDateKey(reference);
  if (nowDateKey >= SPECIAL_FIRST_WEEK_START && nowDateKey <= SPECIAL_FIRST_WEEK_END) {
    return {
      weekKey: `wk_${SPECIAL_FIRST_WEEK_START}`,
      startDateKey: SPECIAL_FIRST_WEEK_START,
      endDateKey: SPECIAL_FIRST_WEEK_END,
      nowDateKey,
      isSpecial: true,
    };
  }

  const dow = getDayOfWeekInSaoPaulo(nowDateKey);
  const diffToWednesday = Number.isNaN(dow) ? 0 : (dow - WEDNESDAY_INDEX + 7) % 7;
  const startDateKey = addDaysToDateKey(nowDateKey, -diffToWednesday);
  const endDateKey = addDaysToDateKey(startDateKey, 6);
  return {
    weekKey: `wk_${startDateKey}`,
    startDateKey,
    endDateKey,
    nowDateKey,
    isSpecial: false,
  };
};

module.exports = {
  TIME_ZONE,
  SPECIAL_FIRST_WEEK_START,
  SPECIAL_FIRST_WEEK_END,
  resolveCommercialWeek,
  isValidDateKey,
  addDaysToDateKey,
  formatDateKey,
};
