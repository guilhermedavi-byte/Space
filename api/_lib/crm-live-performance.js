const { isLivePerformanceEligible } = require('./crm-live-eligibility');
const { resolveCommercialWeek, isValidDateKey } = require('./commercial-week');
const { formatSaoPauloDateKey } = require('./commercial-period');
const { summarizeClosedSales } = require('./commercial-sales');
const { buildGrowthPeopleIndexes, resolveCloserBucketForBusiness } = require('./growth-people');
const { personalBestCopy } = require('./crm-live-presentation');
const CALL_OUTCOMES = new Set(['nao_atendeu', 'atendeu', 'agendou', 'double']);
const rate = (numerator, denominator) => Number.isFinite(denominator) && denominator > 0 ? numerator / denominator * 100 : null;
const sortConversions = rows => rows.slice().sort((a,b) =>
  (b.conversionRate ?? -1) - (a.conversionRate ?? -1) || b.numerator - a.numerator ||
  (b.denominator ?? -1) - (a.denominator ?? -1) || a.personId.localeCompare(b.personId));

function buildLivePerformance({ people = [], closerRows = [], sdrRows = [], businesses = [], events = [], meetings, period, now = new Date(), snapshotId = '' }) {
  const indexes = buildGrowthPeopleIndexes(people);
  const today = formatSaoPauloDateKey(now);
  const cutoff = period.endDateKey < today ? period.endDateKey : today;
  const current = key => key >= period.startDateKey && key <= cutoff;
  const eligibleSdrs = sdrRows.filter(isLivePerformanceEligible);
  const eligibleClosers = closerRows.filter(isLivePerformanceEligible);
  const calls = new Map(), bookings = new Map(), history = new Map(), seen = new Map();
  const audit = { includedCalls: [], includedBookings: [], excludedEvents: [], excludedEventCounts: {}, includedMeetings: [], historicalWeeks: {} };
  const exclude = (id, reason) => {
    audit.excludedEventCounts[reason] = (audit.excludedEventCounts[reason] || 0) + 1;
    // Historical exclusions are sampled so the atomic Firestore document stays bounded.
    if (audit.excludedEvents.length < 100) audit.excludedEvents.push({ id, reason });
  };
  const add = (map, id, n = 1) => map.set(id, (map.get(id) || 0) + n);
  const historical = (role, personId, dateKey) => {
    if (dateKey >= period.startDateKey) return;
    const weekKey = resolveCommercialWeek({ now: dateKey }).weekKey;
    const key = `${role}:${personId}`;
    if (!history.has(key)) history.set(key, new Map());
    add(history.get(key), weekKey);
  };
  for (const event of events) {
    const id = String(event.id || event.firestoreDocId || '');
    const facts = JSON.stringify([event.dateKey, event.eventType, event.outcome, event.sdrUid, event.sdrEmail, event.deletedAt || null, event.time || null]);
    if (id && seen.has(id)) {
      if (seen.get(id) !== facts) throw new Error('conflicting_performance_event');
      exclude(id, 'duplicate'); continue;
    }
    if (id) seen.set(id, facts);
    const personId = indexes.bySdrUid.get(event.sdrUid) || indexes.bySdrEmail.get(String(event.sdrEmail || '').toLowerCase());
    const eventTime = event.time ? Date.parse(event.time) : null;
    const reason = !id ? 'missing_id' : event.deletedAt ? 'deleted' : !isValidDateKey(event.dateKey) ? 'invalid_date'
      : event.dateKey > today || (eventTime !== null && (!Number.isFinite(eventTime) || eventTime > now.getTime())) ? 'future_or_invalid_time'
      : event.eventType !== 'call' || !CALL_OUTCOMES.has(event.outcome) ? 'not_valid_call'
      : !personId ? 'unresolved_actor' : '';
    if (reason) { exclude(id, reason); continue; }
    const scheduled = event.outcome === 'agendou' || event.outcome === 'double';
    if (scheduled) historical('sdr', personId, event.dateKey);
    if (!current(event.dateKey)) continue;
    add(calls, personId); audit.includedCalls.push({ id, personId, outcome: event.outcome, dateKey: event.dateKey });
    if (scheduled) { add(bookings, personId); audit.includedBookings.push({ id, personId, dateKey: event.dateKey }); }
  }
  // Same won-sale classifier and attribution as the financial read model; no new remote collection.
  const allSales = summarizeClosedSales({ businesses, period: { startDateKey: '2000-01-01', endDateKey: cutoff } });
  for (const sale of allSales.sales) {
    const personId = resolveCloserBucketForBusiness(sale.business, indexes).bucketPersonId;
    if (personId !== 'outros') historical('closer', personId, sale.dateKey);
  }
  const meetingCounts = new Map(), seenMeetings = new Map();
  for (const meeting of meetings || []) {
    const facts = JSON.stringify([meeting.personId, meeting.dateKey, meeting.status]);
    if (seenMeetings.has(meeting.id)) {
      if (seenMeetings.get(meeting.id) !== facts) throw new Error('conflicting_performance_meeting');
      continue;
    }
    seenMeetings.set(meeting.id, facts);
    if (!meeting.id || meeting.status !== 'held' || !isValidDateKey(meeting.dateKey) || !current(meeting.dateKey)) continue;
    add(meetingCounts, meeting.personId); audit.includedMeetings.push({ id: meeting.id, personId: meeting.personId, dateKey: meeting.dateKey });
  }
  const sdr = sortConversions(eligibleSdrs.map(row => {
    const numerator = bookings.get(row.personId) || 0, denominator = calls.get(row.personId) || 0;
    return { ...row, role: 'sdr', numerator, denominator, conversionRate: rate(numerator, denominator), denominatorStatus: 'available' };
  }));
  const closers = sortConversions(eligibleClosers.map(row => {
    const numerator = row.count || 0, denominator = meetings ? meetingCounts.get(row.personId) || 0 : null;
    return { ...row, role: 'closer', numerator, denominator, conversionRate: rate(numerator, denominator), denominatorStatus: meetings ? 'available' : 'unavailable' };
  }));
  const candidates = [...sdr, ...closers].flatMap(row => {
    const weeks = history.get(`${row.role}:${row.personId}`) || new Map();
    audit.historicalWeeks[`${row.role}:${row.personId}`] = Object.fromEntries(weeks);
    const historicalBest = Math.max(0, ...weeks.values());
    const item = { id: `record:${row.personId}:${row.role}`, type: 'personal_best', role: row.role, personId: row.personId,
      personName: row.displayName, photoURL: row.photoURL || '', historicalBest, actualValue: row.numerator };
    return [{ ...item, ...personalBestCopy(item) }];
  }).sort((a,b) => a.id.localeCompare(b.id));
  return { version: 1, snapshotId, period: { from: period.startDateKey, to: period.endDateKey, asOf: now.toISOString() },
    sources: { calls: 'sdrActivityEvents:call[nao_atendeu,atendeu,agendou,double]', bookings: 'sdrActivityEvents:call[agendou,double]; double counts once',
      sales: 'shared Datacrazy snapshot: commercial-sales + weekly closer count', meetings: meetings ? 'explicit held meeting events' : 'unavailable: no verified closer meeting source' },
    conversions: { sdr, closers }, recordCandidates: candidates, audit };
}
module.exports = { buildLivePerformance, sortConversions, rate };
