/* Canonical contract-day policy. Shared verbatim by Node and the browser. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SpaceLifecycle = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const TIME_ZONE = 'America/Sao_Paulo';
  function dateKey(value) {
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const parsed = new Date(value + 'T12:00:00Z');
      if (Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value) return value;
      throw new Error('invalid_business_date');
    }
    const date = value instanceof Date ? value : new Date(value);
    if (value == null || !Number.isFinite(date.getTime())) throw new Error('invalid_business_date');
    return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
  }
  function addDays(value, amount) {
    const date = new Date(dateKey(value) + 'T12:00:00Z');
    date.setUTCDate(date.getUTCDate() + amount);
    return date.toISOString().slice(0, 10);
  }
  function addMonths(value, amount) {
    const [year, month, day] = dateKey(value).split('-').map(Number);
    const target = new Date(Date.UTC(year, month - 1 + amount, 1, 12));
    const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
    target.setUTCDate(Math.min(day, last));
    return target.toISOString().slice(0, 10);
  }
  function noticeDates(start) {
    const last_active_date = addMonths(start, 2);
    return { notice_started_at: start, last_active_date, churn_at: addDays(last_active_date, 1) };
  }
  const contract = student => student?.lifecycle || student || {};
  function getLastActiveDate(student) {
    const row = contract(student);
    if (row.subscriptions) { const dates = row.subscriptions.map(getLastActiveDate); return dates.includes(null) ? null : dates.sort().at(-1); }
    const value = row.last_active_date || row.lastActiveDate;
    return value ? dateKey(value) : null;
  }
  function getChurnDate(student) {
    const row = contract(student), last = getLastActiveDate(row);
    if (last) return addDays(last, 1);
    return row.churn_at || row.churnAt || row.churned_at || row.churnedAt ? dateKey(row.churn_at || row.churnAt || row.churned_at || row.churnedAt) : null;
  }
  function getLifecycleStatus(student, on = new Date()) {
    const row = contract(student);
    if (row.subscriptions) {
      const statuses = row.subscriptions.map(sub => getLifecycleStatus(sub,on));
      return ['active','cancellation_requested','cancellation_scheduled','churned'].find(status => statuses.includes(status)) || 'churned';
    }
    const raw = row.lifecycle_status || row.lifecycleStatus || 'active';
    const status = raw === 'notice_period' ? 'cancellation_scheduled' : raw;
    const churn = getChurnDate(row);
    if (churn && dateKey(on) >= churn) return 'churned';
    // Persisted churn is never used to deactivate an earlier valid contract day.
    if (status === 'churned' && churn && dateKey(on) < churn) return 'cancellation_scheduled';
    return status;
  }
  function isActiveOn(student, on = new Date()) {
    const row = contract(student), day = dateKey(on);
    if (row.subscriptions) return row.subscriptions.some(sub => isActiveOn(sub, on));
    if (row.started_at && day < dateKey(row.started_at)) return false;
    if (row.administratively_inactive === true) return false;
    return getLifecycleStatus(row, day) !== 'churned';
  }
  function canScheduleFor(student, on, now = new Date()) {
    const row = contract(student);
    if (row.subscriptions) return row.subscriptions.some(sub => canScheduleFor(sub,on,now));
    if (row.reconciliation_required) return false;
    return isActiveOn(row, now) && isActiveOn(row, on) && (!row.pause_status || row.pause_status === 'none');
  }
  function canCreateObligationFor(student, start, end = start) {
    const row = contract(student);
    if (row.reconciliation_required) return false;
    return dateKey(start) <= dateKey(end) && isActiveOn(row, start) && isActiveOn(row, end);
  }
  function toLegacyStudent(student, lifecycle) {
    return { ...student, lifecycle, ativo: isActiveOn(lifecycle),
      lifecycle_status: getLifecycleStatus(lifecycle), last_active_date: getLastActiveDate(lifecycle), churn_at: getChurnDate(lifecycle) };
  }
  return { TIME_ZONE, dateKey, addDays, addMonths, noticeDates, getLifecycleStatus, isActiveOn, canScheduleFor,
    canCreateObligationFor, getLastActiveDate, getChurnDate, toLegacyStudent };
});
