const { decodeFields, getDocIdFromName } = require('../../_lib/firestore-rest');
const { normalizeKey: normalizeForecastKey, getDealValue } = require('../../_lib/forecast-service');
const { resolveCommercialWeek, isValidDateKey } = require('./commercial-week');

const GROWTH_PEOPLE_COLLECTION = 'growthPeople';
const VALID_WEEKLY_ROLES = new Set(['closer', 'sdr', 'both']);
const VALID_CURRENT_ROLES = new Set(['closer', 'sdr', 'both']);
const CONVERSION_PIPELINE_KEY = normalizeForecastKey('Conversão');
const CLOSED_STAGE_KEY = normalizeForecastKey('Fechado');

const safeString = (value) => (value == null ? '' : String(value).trim());
const safeNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};
const normalizeLoose = (value) =>
  safeString(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const toStringArray = (value) => {
  if (!Array.isArray(value)) return [];
  return value.map((item) => safeString(item)).filter(Boolean);
};

const uniq = (values) => [...new Set((Array.isArray(values) ? values : []).map((value) => safeString(value)).filter(Boolean))];

const normalizePersonRoles = (value) => {
  const raw = Array.isArray(value) ? value : value ? [value] : [];
  return uniq(raw.map((item) => normalizeLoose(item)).filter((item) => VALID_CURRENT_ROLES.has(item)));
};

const normalizeWeeklyRole = (value) => {
  const normalized = normalizeLoose(value);
  return VALID_WEEKLY_ROLES.has(normalized) ? normalized : '';
};

const extractCrmAttendantId = (business = {}) => {
  const raw = business?.attendantId ?? business?.attendant?.id ?? business?.attendant?._id ?? business?.attendant?.uuid ?? '';
  return safeString(raw);
};

const extractCrmAttendantName = (business = {}) => safeString(business?.attendant?.name || business?.attendantName || '');

const getBusinessId = (business = {}) => safeString(business?.id || business?._id || business?.uuid || business?.businessId || '');

const getBusinessLastMovedAt = (business = {}) => {
  const raw = business?.lastMovedAt;
  if (!raw) return null;
  const date = raw instanceof Date ? raw : new Date(String(raw));
  return Number.isNaN(date.getTime()) ? null : date;
};

const getSaoPauloDateKey = (value) => {
  const date = value instanceof Date ? value : new Date(value || Date.now());
  if (Number.isNaN(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type)?.value || '';
  return `${get('year')}-${get('month')}-${get('day')}`;
};

const decodeGrowthPeopleDoc = (doc) => {
  if (!doc || typeof doc !== 'object') return null;
  const fields = decodeFields(doc);
  const personId = safeString(fields.personId || getDocIdFromName(doc.name));
  if (!personId) return null;
  return {
    personId,
    displayName: safeString(fields.displayName || fields.nome || personId) || personId,
    active: fields.active !== false,
    roles: normalizePersonRoles(fields.roles),
    crmAttendantIds: uniq(toStringArray(fields.crmAttendantIds)),
    crmAttendantAliases: uniq(toStringArray(fields.crmAttendantAliases)),
    sdrUid: safeString(fields.sdrUid),
    sdrEmails: uniq(toStringArray(fields.sdrEmails).map((value) => safeString(value).toLowerCase())),
    createdAt: fields.createdAt instanceof Date ? fields.createdAt.toISOString() : null,
    updatedAt: fields.updatedAt instanceof Date ? fields.updatedAt.toISOString() : null,
  };
};

const decodeWeeklyGoalsMap = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const result = {};
  for (const [weekKeyRaw, weekValue] of Object.entries(value)) {
    const weekKey = safeString(weekKeyRaw);
    if (!weekKey || !weekValue || typeof weekValue !== 'object' || Array.isArray(weekValue)) continue;
    const startDateKey = isValidDateKey(weekValue.startDateKey) ? safeString(weekValue.startDateKey) : weekKey.startsWith('wk_') && isValidDateKey(weekKey.slice(3)) ? weekKey.slice(3) : '';
    const endDateKey = isValidDateKey(weekValue.endDateKey) ? safeString(weekValue.endDateKey) : '';
    const teamTarget = safeNumber(weekValue.teamTarget);
    const peopleRaw = weekValue.people && typeof weekValue.people === 'object' && !Array.isArray(weekValue.people) ? weekValue.people : {};
    const people = Object.entries(peopleRaw)
      .map(([personIdRaw, row]) => {
        if (!row || typeof row !== 'object' || Array.isArray(row)) return null;
        const personId = safeString(personIdRaw);
        const role = normalizeWeeklyRole(row.role);
        const target = safeNumber(row.targetValue ?? row.target ?? row.meta);
        if (!personId || !role) return null;
        return {
          personId,
          role,
          targetValue: target,
        };
      })
      .filter(Boolean);
    result[weekKey] = {
      weekKey,
      startDateKey,
      endDateKey,
      teamTarget,
      people,
    };
  }
  return result;
};

const buildGrowthPeopleIndexes = (people = []) => {
  const byPersonId = new Map();
  const byCrmAttendantId = new Map();
  const byCrmAlias = new Map();
  const bySdrUid = new Map();
  const bySdrEmail = new Map();
  (Array.isArray(people) ? people : []).forEach((person) => {
    if (!person || !person.personId) return;
    byPersonId.set(person.personId, person);
    person.crmAttendantIds.forEach((crmAttendantId) => {
      if (!byCrmAttendantId.has(crmAttendantId)) byCrmAttendantId.set(crmAttendantId, person.personId);
    });
    person.crmAttendantAliases.forEach((alias) => {
      const normalized = normalizeLoose(alias);
      if (normalized && !byCrmAlias.has(normalized)) byCrmAlias.set(normalized, person.personId);
    });
    if (person.sdrUid && !bySdrUid.has(person.sdrUid)) bySdrUid.set(person.sdrUid, person.personId);
    person.sdrEmails.forEach((email) => {
      const normalized = safeString(email).toLowerCase();
      if (normalized && !bySdrEmail.has(normalized)) bySdrEmail.set(normalized, person.personId);
    });
  });
  return { byPersonId, byCrmAttendantId, byCrmAlias, bySdrUid, bySdrEmail };
};

const resolvePersonIdForBusiness = (business, indexes) => {
  const crmAttendantId = extractCrmAttendantId(business);
  if (crmAttendantId && indexes.byCrmAttendantId.has(crmAttendantId)) {
    return { personId: indexes.byCrmAttendantId.get(crmAttendantId), method: 'crmAttendantId', crmAttendantId };
  }
  const attendantName = extractCrmAttendantName(business);
  const normalizedName = normalizeLoose(attendantName);
  if (normalizedName && indexes.byCrmAlias.has(normalizedName)) {
    return { personId: indexes.byCrmAlias.get(normalizedName), method: 'crmAttendantAlias', crmAttendantId };
  }
  return { personId: '', method: '', crmAttendantId };
};

const buildUnknownCrmAttendants = (businesses = [], indexes, week) => {
  const grouped = new Map();
  (Array.isArray(businesses) ? businesses : []).forEach((business) => {
    const lastMovedAt = getBusinessLastMovedAt(business);
    if (!lastMovedAt) return;
    const dateKey = getSaoPauloDateKey(lastMovedAt);
    if (!dateKey || dateKey < week.startDateKey || dateKey > week.endDateKey) return;
    const pipelineKey = normalizeForecastKey(business?.stage?.pipeline?.name);
    const stageKey = normalizeForecastKey(business?.stage?.name);
    if (pipelineKey !== CONVERSION_PIPELINE_KEY || stageKey !== CLOSED_STAGE_KEY) return;
    const resolved = resolvePersonIdForBusiness(business, indexes);
    if (resolved.personId) return;
    const crmAttendantId = resolved.crmAttendantId || extractCrmAttendantId(business) || 'missing_attendant_id';
    const entry = grouped.get(crmAttendantId) || {
      crmAttendantId: crmAttendantId === 'missing_attendant_id' ? '' : crmAttendantId,
      attendantName: extractCrmAttendantName(business) || null,
      businessIds: [],
      revenue: 0,
      count: 0,
    };
    const businessId = getBusinessId(business);
    if (businessId) entry.businessIds.push(businessId);
    entry.count += 1;
    entry.revenue += getDealValue(business);
    grouped.set(crmAttendantId, entry);
  });
  return Array.from(grouped.values()).sort((a, b) => b.revenue - a.revenue || b.count - a.count || safeString(a.attendantName).localeCompare(safeString(b.attendantName), 'pt-BR'));
};

const buildUnknownSdrActors = (events = [], indexes, week) => {
  const grouped = new Map();
  (Array.isArray(events) ? events : []).forEach((event) => {
    const eventType = safeString(event?.eventType);
    const deletedAt = safeString(event?.deletedAt);
    const dateKey = safeString(event?.dateKey);
    if (deletedAt || !dateKey || dateKey < week.startDateKey || dateKey > week.endDateKey) return;
    if (eventType !== 'meeting' && eventType !== 'call') return;
    const sdrUid = safeString(event?.sdrUid);
    const sdrEmail = safeString(event?.sdrEmail).toLowerCase();
    const resolvedPersonId = (sdrUid && indexes.bySdrUid.get(sdrUid)) || (sdrEmail && indexes.bySdrEmail.get(sdrEmail)) || '';
    if (resolvedPersonId) return;
    const mapKey = `${sdrUid || 'missing_uid'}::${sdrEmail || 'missing_email'}`;
    const entry = grouped.get(mapKey) || {
      sdrUid,
      sdrEmail: sdrEmail || '',
      sdrName: safeString(event?.sdrName) || null,
      totalEvents: 0,
      meetingShows: 0,
      calls: 0,
      meetings: 0,
    };
    entry.totalEvents += 1;
    if (eventType === 'call') entry.calls += 1;
    if (eventType === 'meeting') entry.meetings += 1;
    if (eventType === 'meeting' && safeString(event?.outcome) === 'show') entry.meetingShows += 1;
    grouped.set(mapKey, entry);
  });
  return Array.from(grouped.values()).sort((a, b) => b.totalEvents - a.totalEvents || b.meetingShows - a.meetingShows || safeString(a.sdrName).localeCompare(safeString(b.sdrName), 'pt-BR'));
};

const summarizeWeeklyCloserProgress = ({ businesses = [], goalPeople = [], indexes, week }) => {
  const rowsByPerson = new Map(goalPeople.filter((row) => row.role === 'closer' || row.role === 'both').map((row) => [row.personId, { personId: row.personId, role: row.role, targetValue: safeNumber(row.targetValue), actualValue: 0, count: 0 }]));
  (Array.isArray(businesses) ? businesses : []).forEach((business) => {
    const lastMovedAt = getBusinessLastMovedAt(business);
    if (!lastMovedAt) return;
    const dateKey = getSaoPauloDateKey(lastMovedAt);
    if (!dateKey || dateKey < week.startDateKey || dateKey > week.endDateKey) return;
    const pipelineKey = normalizeForecastKey(business?.stage?.pipeline?.name);
    const stageKey = normalizeForecastKey(business?.stage?.name);
    if (pipelineKey !== CONVERSION_PIPELINE_KEY || stageKey !== CLOSED_STAGE_KEY) return;
    const resolved = resolvePersonIdForBusiness(business, indexes);
    if (!resolved.personId || !rowsByPerson.has(resolved.personId)) return;
    const row = rowsByPerson.get(resolved.personId);
    row.actualValue += getDealValue(business);
    row.count += 1;
  });
  return Array.from(rowsByPerson.values());
};

const summarizeWeeklySdrProgress = ({ events = [], goalPeople = [], indexes, week }) => {
  const rowsByPerson = new Map(goalPeople.filter((row) => row.role === 'sdr' || row.role === 'both').map((row) => [row.personId, { personId: row.personId, role: row.role, targetValue: safeNumber(row.targetValue), actualValue: 0, count: 0 }]));
  (Array.isArray(events) ? events : []).forEach((event) => {
    const eventType = safeString(event?.eventType);
    const outcome = safeString(event?.outcome);
    const deletedAt = safeString(event?.deletedAt);
    const dateKey = safeString(event?.dateKey);
    const sdrUid = safeString(event?.sdrUid);
    const email = safeString(event?.sdrEmail).toLowerCase();
    if (deletedAt || eventType !== 'meeting' || outcome !== 'show') return;
    if (!dateKey || dateKey < week.startDateKey || dateKey > week.endDateKey) return;
    const personId = (sdrUid && indexes.bySdrUid.get(sdrUid)) || indexes.bySdrEmail.get(email);
    if (!personId || !rowsByPerson.has(personId)) return;
    const row = rowsByPerson.get(personId);
    row.actualValue += 1;
    row.count += 1;
  });
  return Array.from(rowsByPerson.values());
};

const attachPersonMeta = (rows = [], indexes) =>
  (Array.isArray(rows) ? rows : [])
    .map((row) => {
      const person = indexes.byPersonId.get(row.personId);
      const targetValue = safeNumber(row.targetValue);
      const actualValue = safeNumber(row.actualValue);
      return {
        personId: row.personId,
        displayName: person?.displayName || row.personId,
        role: row.role,
        targetValue,
        actualValue,
        progressPct: targetValue > 0 ? (actualValue / targetValue) * 100 : 0,
        count: safeNumber(row.count),
      };
    })
    .sort((a, b) => b.progressPct - a.progressPct || b.actualValue - a.actualValue || safeString(a.displayName).localeCompare(safeString(b.displayName), 'pt-BR'));

const buildWeeklyGoalsReadModel = ({ goal = null, people = [], businesses = [], sdrEvents = [], now = new Date() } = {}) => {
  const week = resolveCommercialWeek({ now });
  const safeGoal = goal && typeof goal === 'object' ? goal : null;
  const weeklyGoal = safeGoal?.weeklyGoals?.[week.weekKey] || null;
  const indexes = buildGrowthPeopleIndexes(people);
  const goalPeople = Array.isArray(weeklyGoal?.people) ? weeklyGoal.people : [];
  const closerRows = attachPersonMeta(summarizeWeeklyCloserProgress({ businesses, goalPeople, indexes, week }), indexes);
  const sdrRows = attachPersonMeta(summarizeWeeklySdrProgress({ events: sdrEvents, goalPeople, indexes, week }), indexes);
  return {
    commercialWeek: week,
    weeklyGoal,
    people,
    progress: {
      closers: closerRows,
      sdrs: sdrRows,
    },
    unresolved: {
      crmAttendantIds: buildUnknownCrmAttendants(businesses, indexes, week),
      sdrActors: buildUnknownSdrActors(sdrEvents, indexes, week),
    },
  };
};

module.exports = {
  GROWTH_PEOPLE_COLLECTION,
  decodeGrowthPeopleDoc,
  decodeWeeklyGoalsMap,
  buildGrowthPeopleIndexes,
  buildWeeklyGoalsReadModel,
  resolveCommercialWeek,
  extractCrmAttendantId,
};
