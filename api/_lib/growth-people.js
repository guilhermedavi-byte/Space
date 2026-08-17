const { decodeFields, getDocIdFromName } = require('../../_lib/firestore-rest');
const { normalizeKey: normalizeForecastKey, getDealValue } = require('../../_lib/forecast-service');
const { resolveCommercialWeek, isValidDateKey } = require('./commercial-week');

const GROWTH_PEOPLE_COLLECTION = 'growthPeople';
const GROWTH_CONFIG_COLLECTION = 'growthConfig';
const CRM_LIVE_DEFAULTS_DOC_ID = 'crmLiveDefaults';
const VALID_WEEKLY_ROLES = new Set(['closer', 'sdr', 'both']);
const VALID_CURRENT_ROLES = new Set(['closer', 'sdr', 'both']);
const CONVERSION_PIPELINE_KEY = normalizeForecastKey('Conversão');
const CLOSED_STAGE_KEY = normalizeForecastKey('Fechado');
const AGGREGATE_OTHERS_PERSON_ID = 'outros';
const AGGREGATE_OTHERS_DISPLAY_NAME = 'Outros';

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

const isCloserRole = (role) => role === 'closer' || role === 'both';
const isCloserPerson = (person) =>
  !!person && person.active !== false && Array.isArray(person.roles) && person.roles.some((role) => isCloserRole(normalizeLoose(role)));

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
    isAggregate: fields.isAggregate === true,
    sortOrder: Number.isFinite(Number(fields.sortOrder)) ? Number(fields.sortOrder) : 0,
    roles: normalizePersonRoles(fields.roles),
    crmAttendantIds: uniq(toStringArray(fields.crmAttendantIds)),
    crmAttendantAliases: uniq(toStringArray(fields.crmAttendantAliases)),
    userUid: safeString(fields.userUid),
    photoURL: safeString(fields.photoURL || fields.photoUrl),
    sdrUid: safeString(fields.sdrUid),
    sdrEmails: uniq(toStringArray(fields.sdrEmails).map((value) => safeString(value).toLowerCase())),
    createdAt: fields.createdAt instanceof Date ? fields.createdAt.toISOString() : null,
    updatedAt: fields.updatedAt instanceof Date ? fields.updatedAt.toISOString() : null,
  };
};

function getWeeklyPeopleSource(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  if (Array.isArray(value.people)) return value.people;
  if (value.individualMonthlyGoals && typeof value.individualMonthlyGoals === 'object' && !Array.isArray(value.individualMonthlyGoals)) return value.individualMonthlyGoals;
  if (value.defaultIndividualGoals && typeof value.defaultIndividualGoals === 'object' && !Array.isArray(value.defaultIndividualGoals)) return value.defaultIndividualGoals;
  if (value.individualGoals && typeof value.individualGoals === 'object' && !Array.isArray(value.individualGoals)) return value.individualGoals;
  if (value.people && typeof value.people === 'object' && !Array.isArray(value.people)) return value.people;
  return {};
}

function normalizeWeeklyGoalConfigEntry({ weekKey = '', rawConfig = null, fallbackStartDateKey = '', fallbackEndDateKey = '' } = {}) {
  const source = rawConfig && typeof rawConfig === 'object' && !Array.isArray(rawConfig) ? rawConfig : {};
  const safeWeekKey = safeString(weekKey);
  const startDateKey = isValidDateKey(source.startDateKey) ? safeString(source.startDateKey) : safeString(fallbackStartDateKey);
  const endDateKey = isValidDateKey(source.endDateKey) ? safeString(source.endDateKey) : safeString(fallbackEndDateKey);
  const teamTarget = safeNumber(source.teamTarget ?? source.defaultTeamTarget);
  const rawPeopleSource = getWeeklyPeopleSource(source);
  const people = (Array.isArray(rawPeopleSource) ? rawPeopleSource : Object.entries(rawPeopleSource).map(([personId, row]) => ({ ...(row || {}), personId })))
    .map((entry) => {
      const row = entry && typeof entry === 'object' ? entry : null;
      if (!row || Array.isArray(row)) return null;
      const personId = safeString(row.personId);
      const excluded = row.excluded === true || row.exclude === true || row.disabled === true;
      const role = normalizeWeeklyRole(row.role);
      const target = safeNumber(row.targetValue ?? row.target ?? row.meta);
      if (!personId) return null;
      if (excluded) {
        return {
          personId,
          excluded: true,
        };
      }
      if (!role) return null;
      return {
        personId,
        role,
        targetValue: target,
        excluded: false,
      };
    })
    .filter(Boolean);
  return {
    weekKey: safeWeekKey,
    startDateKey,
    endDateKey,
    teamTarget,
    people,
  };
}

const decodeWeeklyGoalsMap = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const result = {};
  for (const [weekKeyRaw, weekValue] of Object.entries(value)) {
    const weekKey = safeString(weekKeyRaw);
    if (!weekKey || !weekValue || typeof weekValue !== 'object' || Array.isArray(weekValue)) continue;
    result[weekKey] = normalizeWeeklyGoalConfigEntry({
      weekKey,
      rawConfig: weekValue,
      fallbackStartDateKey: weekKey.startsWith('wk_') && isValidDateKey(weekKey.slice(3)) ? weekKey.slice(3) : '',
      fallbackEndDateKey: '',
    });
  }
  return result;
};

const decodeGrowthConfigDoc = (doc) => {
  if (!doc || typeof doc !== 'object') return null;
  const fields = decodeFields(doc);
  const id = safeString(fields.id || getDocIdFromName(doc.name));
  return {
    id,
    defaultWeeklyConfig: fields.defaultWeeklyConfig
      ? normalizeWeeklyGoalConfigEntry({
          weekKey: '',
          rawConfig: fields.defaultWeeklyConfig,
        })
      : null,
  };
};

const hasWeeklyGoalConfig = (config) =>
  !!config &&
  typeof config === 'object' &&
  (safeNumber(config.teamTarget) > 0 || (Array.isArray(config.people) && config.people.length > 0));

const mergeWeeklyGoalPeople = (...configs) => {
  const peopleById = new Map();
  (Array.isArray(configs) ? configs : []).forEach((config) => {
    const people = Array.isArray(config?.people) ? config.people : [];
    people.forEach((row) => {
      const personId = safeString(row?.personId);
      if (!personId) return;
      if (row?.excluded === true) {
        peopleById.delete(personId);
        return;
      }
      peopleById.set(personId, {
        personId,
        role: normalizeWeeklyRole(row?.role),
        targetValue: safeNumber(row?.targetValue),
        excluded: false,
      });
    });
  });
  return Array.from(peopleById.values()).filter((row) => row.personId && row.role);
};

const resolveWeeklyGoalConfig = ({ goal = null, globalConfig = null, week } = {}) => {
  const currentWeek = week && typeof week === 'object' ? week : resolveCommercialWeek({ now: new Date() });
  const weekGoalRaw = goal?.weeklyGoals?.[currentWeek.weekKey] || null;
  const weekConfig =
    weekGoalRaw && typeof weekGoalRaw === 'object'
      ? normalizeWeeklyGoalConfigEntry({
          weekKey: currentWeek.weekKey,
          rawConfig: weekGoalRaw,
          fallbackStartDateKey: currentWeek.startDateKey,
          fallbackEndDateKey: currentWeek.endDateKey,
        })
      : null;
  const competenciaDefaultRaw = goal?.defaultWeeklyConfig;
  const competenciaConfig =
    competenciaDefaultRaw && typeof competenciaDefaultRaw === 'object'
      ? normalizeWeeklyGoalConfigEntry({
          weekKey: currentWeek.weekKey,
          rawConfig: competenciaDefaultRaw,
          fallbackStartDateKey: currentWeek.startDateKey,
          fallbackEndDateKey: currentWeek.endDateKey,
        })
      : null;
  const globalDefaultRaw = globalConfig?.defaultWeeklyConfig;
  const globalDefaultConfig =
    globalDefaultRaw && typeof globalDefaultRaw === 'object'
      ? normalizeWeeklyGoalConfigEntry({
          weekKey: currentWeek.weekKey,
          rawConfig: globalDefaultRaw,
          fallbackStartDateKey: currentWeek.startDateKey,
          fallbackEndDateKey: currentWeek.endDateKey,
        })
      : null;

  const teamTargetSource =
    safeNumber(weekConfig?.teamTarget) > 0
      ? 'week'
      : safeNumber(competenciaConfig?.teamTarget) > 0
        ? 'competencia'
        : safeNumber(globalDefaultConfig?.teamTarget) > 0
          ? 'global'
          : '';
  const teamTarget =
    teamTargetSource === 'week'
      ? safeNumber(weekConfig?.teamTarget)
      : teamTargetSource === 'competencia'
        ? safeNumber(competenciaConfig?.teamTarget)
        : teamTargetSource === 'global'
          ? safeNumber(globalDefaultConfig?.teamTarget)
          : 0;
  const mergedPeople = mergeWeeklyGoalPeople(globalDefaultConfig, competenciaConfig, weekConfig);
  const peopleSource = Array.isArray(weekConfig?.people) && weekConfig.people.length > 0 ? 'week' : Array.isArray(competenciaConfig?.people) && competenciaConfig.people.length > 0 ? 'competencia' : Array.isArray(globalDefaultConfig?.people) && globalDefaultConfig.people.length > 0 ? 'global' : '';
  const weeklyGoal = {
    weekKey: currentWeek.weekKey,
    startDateKey: currentWeek.startDateKey,
    endDateKey: currentWeek.endDateKey,
    teamTarget,
    people: mergedPeople,
  };
  if (!hasWeeklyGoalConfig(weeklyGoal)) {
    return {
      weeklyGoal: null,
      source: '',
      sourceDetails: {
        teamTarget: '',
        people: '',
      },
    };
  }
  const source = teamTargetSource === peopleSource ? teamTargetSource : teamTargetSource || peopleSource || '';
  return {
    weeklyGoal,
    source: source && teamTargetSource && peopleSource && teamTargetSource !== peopleSource ? 'mixed' : source,
    sourceDetails: {
      teamTarget: teamTargetSource,
      people: peopleSource,
    },
  };
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

const resolvePersonForBusiness = (business, indexes) => {
  const resolved = resolvePersonIdForBusiness(business, indexes);
  return {
    ...resolved,
    person: resolved.personId ? indexes.byPersonId.get(resolved.personId) || null : null,
    attendantName: extractCrmAttendantName(business),
  };
};

const resolveCloserBucketForBusiness = (business, indexes) => {
  const resolved = resolvePersonForBusiness(business, indexes);
  const person = resolved.person;
  if (resolved.personId && person && isCloserPerson(person) && person.isAggregate !== true) {
    return {
      bucketPersonId: resolved.personId,
      bucketDisplayName: safeString(person.displayName) || resolved.personId,
      bucketIsAggregate: false,
      resolvedPersonId: resolved.personId,
      resolvedPerson: person,
      crmAttendantId: resolved.crmAttendantId,
      attendantName: resolved.attendantName,
      method: resolved.method,
    };
  }
  const aggregatePerson = indexes?.byPersonId?.get(AGGREGATE_OTHERS_PERSON_ID) || null;
  return {
    bucketPersonId: AGGREGATE_OTHERS_PERSON_ID,
    bucketDisplayName: safeString(aggregatePerson?.displayName) || AGGREGATE_OTHERS_DISPLAY_NAME,
    bucketIsAggregate: true,
    resolvedPersonId: resolved.personId,
    resolvedPerson: person,
    crmAttendantId: resolved.crmAttendantId,
    attendantName: resolved.attendantName,
    method: resolved.method,
  };
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
  const rowsByPerson = new Map(
    goalPeople
      .filter((row) => row.role === 'closer' || row.role === 'both')
      .map((row, index) => [
        row.personId,
        {
          personId: row.personId,
          role: row.role,
          targetValue: safeNumber(row.targetValue),
          goalOrder: index,
          actualValue: 0,
          count: 0,
          breakdown: row.personId === AGGREGATE_OTHERS_PERSON_ID ? [] : undefined,
        },
      ])
  );
  (Array.isArray(businesses) ? businesses : []).forEach((business) => {
    const lastMovedAt = getBusinessLastMovedAt(business);
    if (!lastMovedAt) return;
    const dateKey = getSaoPauloDateKey(lastMovedAt);
    if (!dateKey || dateKey < week.startDateKey || dateKey > week.endDateKey) return;
    const pipelineKey = normalizeForecastKey(business?.stage?.pipeline?.name);
    const stageKey = normalizeForecastKey(business?.stage?.name);
    if (pipelineKey !== CONVERSION_PIPELINE_KEY || stageKey !== CLOSED_STAGE_KEY) return;
    const bucket = resolveCloserBucketForBusiness(business, indexes);
    if (!bucket.bucketPersonId || !rowsByPerson.has(bucket.bucketPersonId)) return;
    const row = rowsByPerson.get(bucket.bucketPersonId);
    const value = getDealValue(business);
    row.actualValue += value;
    row.count += 1;
    if (bucket.bucketIsAggregate) {
      const label = safeString(bucket.attendantName || bucket.crmAttendantId || bucket.resolvedPerson?.displayName || 'Sem responsável');
      const breakdownKey = safeString(bucket.crmAttendantId || label || 'missing_attendant_id');
      const breakdown = Array.isArray(row.breakdown) ? row.breakdown : [];
      const existing = breakdown.find((entry) => entry.key === breakdownKey);
      if (existing) {
        existing.value += value;
        existing.count += 1;
      } else {
        breakdown.push({
          key: breakdownKey,
          crmAttendantId: safeString(bucket.crmAttendantId),
          attendantName: label || null,
          value,
          count: 1,
          resolvedPersonId: safeString(bucket.resolvedPersonId),
        });
      }
      row.breakdown = breakdown;
    }
  });
  return Array.from(rowsByPerson.values());
};

const summarizeWeeklySdrProgress = ({ events = [], goalPeople = [], indexes, week }) => {
  const rowsByPerson = new Map(
    goalPeople
      .filter((row) => row.role === 'sdr' || row.role === 'both')
      .map((row, index) => [row.personId, { personId: row.personId, role: row.role, targetValue: safeNumber(row.targetValue), goalOrder: index, actualValue: 0, count: 0 }])
  );
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
        displayName: person?.displayName || (row.personId === AGGREGATE_OTHERS_PERSON_ID ? AGGREGATE_OTHERS_DISPLAY_NAME : row.personId),
        role: row.role,
        photoURL: person?.photoURL || "",
        isAggregate: person?.isAggregate === true || row.personId === AGGREGATE_OTHERS_PERSON_ID,
        sortOrder: Number.isFinite(Number(person?.sortOrder)) ? Number(person.sortOrder) : row.personId === AGGREGATE_OTHERS_PERSON_ID ? 999 : 0,
        goalOrder: Number.isFinite(Number(row.goalOrder)) ? Number(row.goalOrder) : Number.MAX_SAFE_INTEGER,
        targetValue,
        actualValue,
        progressPct: targetValue > 0 ? (actualValue / targetValue) * 100 : 0,
        count: safeNumber(row.count),
        breakdown: Array.isArray(row.breakdown)
          ? row.breakdown
              .map((entry) => ({
                crmAttendantId: safeString(entry.crmAttendantId),
                attendantName: safeString(entry.attendantName) || null,
                value: safeNumber(entry.value),
                count: safeNumber(entry.count),
                resolvedPersonId: safeString(entry.resolvedPersonId),
              }))
              .sort((a, b) => b.value - a.value || b.count - a.count || safeString(a.attendantName).localeCompare(safeString(b.attendantName), 'pt-BR'))
          : undefined,
      };
    })
    .sort((a, b) => b.progressPct - a.progressPct || b.actualValue - a.actualValue || safeNumber(a.sortOrder) - safeNumber(b.sortOrder) || safeNumber(a.goalOrder) - safeNumber(b.goalOrder) || safeString(a.displayName).localeCompare(safeString(b.displayName), 'pt-BR'));

const buildWeeklyGoalsReadModel = ({ goal = null, globalConfig = null, people = [], businesses = [], sdrEvents = [], now = new Date() } = {}) => {
  const week = resolveCommercialWeek({ now });
  const safeGoal = goal && typeof goal === 'object' ? goal : null;
  const resolvedConfig = resolveWeeklyGoalConfig({ goal: safeGoal, globalConfig, week });
  const weeklyGoal = resolvedConfig.weeklyGoal;
  const indexes = buildGrowthPeopleIndexes(people);
  const goalPeople = Array.isArray(weeklyGoal?.people) ? weeklyGoal.people : [];
  const closerRows = attachPersonMeta(summarizeWeeklyCloserProgress({ businesses, goalPeople, indexes, week }), indexes);
  const sdrRows = attachPersonMeta(summarizeWeeklySdrProgress({ events: sdrEvents, goalPeople, indexes, week }), indexes);
  return {
    commercialWeek: week,
    weeklyGoal,
    weeklyGoalConfigSource: resolvedConfig.source,
    weeklyGoalConfigSourceDetails: resolvedConfig.sourceDetails || { teamTarget: '', people: '' },
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
  GROWTH_CONFIG_COLLECTION,
  CRM_LIVE_DEFAULTS_DOC_ID,
  decodeGrowthPeopleDoc,
  decodeGrowthConfigDoc,
  decodeWeeklyGoalsMap,
  buildGrowthPeopleIndexes,
  buildWeeklyGoalsReadModel,
  resolveWeeklyGoalConfig,
  normalizeWeeklyGoalConfigEntry,
  resolveCommercialWeek,
  extractCrmAttendantId,
  resolveCloserBucketForBusiness,
  AGGREGATE_OTHERS_PERSON_ID,
  AGGREGATE_OTHERS_DISPLAY_NAME,
};
