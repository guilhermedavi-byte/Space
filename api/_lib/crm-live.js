const crypto = require("crypto");

const { getGoogleAccessToken } = require("../../_lib/google-service-account");
const { requestJson, FIRESTORE_BASE, API_KEY, PROJECT_ID, encodeFields, decodeFields, getDocIdFromName } = require("../../_lib/firestore-rest");
const { getDocumentAsAdmin, listCollectionAsAdmin, queryCollectionByDateRangeAsAdmin, commitWritesAsAdmin } = require("./firestore-admin");
const { signJwt, verifyJwt, parseCookies, isSecureRequest } = require("./session");
const { resolveCommercialPeriod, formatSaoPauloDateKey, getCalendarMonthBounds } = require("./commercial-period");
const {
  buildWeeklyGoalsReadModel,
  decodeGrowthPeopleDoc,
  decodeGrowthConfigDoc,
  decodeWeeklyGoalsMap,
  normalizeWeeklyGoalConfigEntry,
  resolveCommercialWeek,
  extractCrmAttendantId,
  buildGrowthPeopleIndexes,
  resolveCloserBucketForBusiness,
  AGGREGATE_OTHERS_PERSON_ID,
  AGGREGATE_OTHERS_DISPLAY_NAME,
  GROWTH_CONFIG_COLLECTION,
  CRM_LIVE_DEFAULTS_DOC_ID,
} = require("./growth-people");
const { getDealValue, normalizeKey } = require("../../_lib/forecast-service");
const { fetchMirroredBusinesses, getSyncState, isDatacrazyMirrorEnabled } = require("./datacrazy-mirror");

const DATASTORE_SCOPE = "https://www.googleapis.com/auth/datastore";
const GOALS_COLLECTION = "growthGoals";
const GROWTH_PEOPLE_COLLECTION = "growthPeople";
const SDR_ACTIVITY_COLLECTION = "sdrActivityEvents";
const CRM_LIVE_CACHE_COLLECTION = "crmLiveCache";
const CRM_LIVE_ACCESS_COLLECTION = "crmLiveAccessTokens";
const CRM_LIVE_EVENTS_COLLECTION = "crmLiveEventsState";
const CRM_LIVE_DAILY_ROLLUPS_COLLECTION = "crmLiveDailyRollups";
const CRM_LIVE_WEEKLY_ROLLUPS_COLLECTION = "crmLiveWeeklyRollups";
const CRM_LIVE_COOKIE_NAME = "space_crm_live";
const CRM_LIVE_COOKIE_SCOPE = "crm-live:read";
const CRM_LIVE_COOKIE_MAX_AGE_SECONDS = 90 * 24 * 60 * 60;
const CRM_CACHE_TTL_MS = 2 * 60 * 1000;
const SDR_CACHE_TTL_MS = 60 * 1000;
const CONVERSION_PIPELINE_FALLBACK_KEY = normalizeKey("Conversão");
const CLOSED_STAGE_KEY = normalizeKey("Fechado");

const safeString = (value) => (value == null ? "" : String(value).trim());
const safeNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};
const roundMoney = (value) => Math.round((safeNumber(value) + Number.EPSILON) * 100) / 100;
const subtractMonthsFromMonthKey = (monthKey, count = 1) => {
  const raw = safeString(monthKey);
  if (!/^\d{4}-\d{2}$/.test(raw)) return "";
  const date = new Date(`${raw}-15T12:00:00-03:00`);
  if (Number.isNaN(date.getTime())) return "";
  date.setMonth(date.getMonth() - Math.max(0, Number(count) || 0));
  return formatSaoPauloDateKey(date).slice(0, 7);
};
const countSalesDaysElapsedInclusive = (period, now = new Date()) => {
  if (!period) return 0;
  const nowKey = formatSaoPauloDateKey(now);
  if (!nowKey || nowKey < period.startDateKey) return 0;
  const endBound = nowKey > period.endDateKey ? period.endDateKey : nowKey;
  const startDate = new Date(`${period.startDateKey}T12:00:00-03:00`);
  const endDate = new Date(`${endBound}T12:00:00-03:00`);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate < startDate) return 0;
  let count = 0;
  for (const cursor = new Date(startDate); cursor <= endDate; cursor.setDate(cursor.getDate() + 1)) {
    if (cursor.getDay() !== 0) count += 1;
  }
  return count;
};
const resolveNthSalesDayCutoff = (period, salesDaysCount) => {
  if (!period || safeNumber(salesDaysCount) <= 0) return "";
  const startDate = new Date(`${period.startDateKey}T12:00:00-03:00`);
  const endDate = new Date(`${period.endDateKey}T12:00:00-03:00`);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate < startDate) return "";
  let seen = 0;
  for (const cursor = new Date(startDate); cursor <= endDate; cursor.setDate(cursor.getDate() + 1)) {
    if (cursor.getDay() === 0) continue;
    seen += 1;
    if (seen >= salesDaysCount) return formatSaoPauloDateKey(cursor);
  }
  return period.endDateKey;
};
const progressPctFromRow = (row = {}) => {
  const target = safeNumber(row?.targetValue);
  const actual = safeNumber(row?.actualValue);
  return target > 0 ? (actual / target) * 100 : 0;
};
const computeRawUnitsToBeatLeader = ({ leaderPct = 0, challengerTarget = 0, challengerActual = 0, discrete = false } = {}) => {
  const pct = safeNumber(leaderPct);
  const target = safeNumber(challengerTarget);
  const actual = safeNumber(challengerActual);
  if (pct <= 0 || target <= 0) return 0;
  const strictThreshold = (pct / 100) * target;
  if (discrete) {
    const targetUnits = Math.floor(strictThreshold) + 1;
    return Math.max(0, targetUnits - actual);
  }
  return Math.max(0, roundMoney(strictThreshold - actual + 0.01));
};
const decorateLeaderboardComparisons = ({ rows = [], discrete = false } = {}) => {
  const list = Array.isArray(rows) ? rows.map((row) => ({ ...row })) : [];
  if (!list.length) return [];
  const leader = list[0];
  const leaderPct = progressPctFromRow(leader);
  return list.map((row, index) => {
    const missingToGoal = discrete
      ? Math.max(0, Math.ceil(safeNumber(row.targetValue) - safeNumber(row.actualValue)))
      : roundMoney(Math.max(0, safeNumber(row.targetValue) - safeNumber(row.actualValue)));
    if (index === 0) {
      const next = list[1] || null;
      const nextMissingToBeat = next
        ? computeRawUnitsToBeatLeader({
            leaderPct,
            challengerTarget: safeNumber(next.targetValue),
            challengerActual: safeNumber(next.actualValue),
            discrete,
          })
        : 0;
      return {
        ...row,
        progressPct: leaderPct,
        missingToGoal,
        leaderPressureFromPersonId: safeString(next?.personId),
        leaderPressureFromName: safeString(next?.displayName),
        leaderPressureUnits: nextMissingToBeat,
      };
    }
    return {
      ...row,
      progressPct: progressPctFromRow(row),
      missingToGoal,
      missingToLead: computeRawUnitsToBeatLeader({
        leaderPct,
        challengerTarget: safeNumber(row.targetValue),
        challengerActual: safeNumber(row.actualValue),
        discrete,
      }),
      leaderPersonId: safeString(leader?.personId),
      leaderName: safeString(leader?.displayName),
    };
  });
};

const hashSecret = (value) => crypto.createHash("sha256").update(String(value || ""), "utf8").digest("hex");
const buildDocumentName = (collection, docId) => {
  const safeCollection = safeString(collection);
  const safeDocId = safeString(docId);
  if (!PROJECT_ID || !safeCollection || !safeDocId) {
    const error = new Error("invalid_firestore_document_name");
    error.code = "invalid_firestore_document_name";
    throw error;
  }
  return `projects/${PROJECT_ID}/databases/(default)/documents/${safeCollection}/${encodeURIComponent(safeDocId)}`;
};
const buildCookie = (name, value, { maxAgeSeconds = CRM_LIVE_COOKIE_MAX_AGE_SECONDS, secure = false, path = "/" } = {}) => {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    `Path=${path}`,
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${Math.max(0, Number(maxAgeSeconds) || 0)}`,
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
};
const clearCookie = ({ secure = false, path = "/" } = {}) => buildCookie(CRM_LIVE_COOKIE_NAME, "", { maxAgeSeconds: 0, secure, path });

const formatDateKeyStartIso = (dateKey) => {
  const safe = safeString(dateKey);
  if (!safe) return "";
  const date = new Date(`${safe}T00:00:00-03:00`);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
};

const requestJsonRaw = async (url, { method = "GET", headers, body } = {}) => {
  const safeHeaders = headers && typeof headers === "object" ? headers : {};
  return requestJson(url, { method, headers: safeHeaders, body });
};

const extractBusinessesArray = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data?.items)) return payload.data.items;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
};

const extractStageName = (business) => safeString(business?.stage?.name || business?.stageName || business?.stage);
const extractPipelineName = (business) => safeString(business?.stage?.pipeline?.name || business?.pipeline?.name || business?.pipelineName);
const extractBusinessId = (business) => safeString(business?.id || business?._id || business?.uuid || business?.businessId);
const extractBusinessClientName = (business) =>
  safeString(business?.lead?.name || business?.leadName || business?.clientName || business?.customerName || business?.name);
const extractBusinessPlanName = (business) =>
  safeString(business?.products?.[0]?.product?.name || business?.planName || business?.produto?.nome);
const extractBusinessAttendantName = (business) => safeString(business?.attendant?.name || business?.attendantName);
const extractBusinessStatus = (business) => safeString(business?.status || business?.dealStatus || business?.situation);
const extractBusinessLastMovedAt = (business) => {
  const raw = business?.lastMovedAt;
  if (!raw) return null;
  const date = raw instanceof Date ? raw : new Date(String(raw));
  return Number.isNaN(date.getTime()) ? null : date;
};

const getFirestoreAdminAccessToken = async () => {
  const result = await getGoogleAccessToken({ scope: DATASTORE_SCOPE });
  return safeString(result?.accessToken);
};

const firestoreGetDocumentWithAccessToken = async ({ docPath, accessToken } = {}) => {
  const path = safeString(docPath).replace(/^\/+/, "");
  const token = safeString(accessToken);
  if (!path || !token) throw new Error("missing_doc_or_token");
  const params = new URLSearchParams();
  params.set("key", API_KEY);
  return requestJsonRaw(`${FIRESTORE_BASE}/${encodeURI(path)}?${params.toString()}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
};

const writeDocAsAdmin = async ({ docPath, data, updateMaskPaths } = {}) => {
  const path = safeString(docPath).replace(/^\/+/, "");
  if (!path) throw new Error("missing_doc_path");
  const [collection, docId] = path.split("/");
  const name = buildDocumentName(collection, docId);
  const fields = encodeFields(data).fields || {};
  const fieldPaths = Array.isArray(updateMaskPaths) ? updateMaskPaths.filter(Boolean) : Object.keys(fields);
  return commitWritesAsAdmin({
    writes: [
      {
        update: {
          name,
          fields,
        },
        updateMask: { fieldPaths },
      },
    ],
  });
};

const deleteDocAsAdmin = async ({ docPath } = {}) => {
  const path = safeString(docPath).replace(/^\/+/, "");
  if (!path) throw new Error("missing_doc_path");
  const [collection, docId] = path.split("/");
  return commitWritesAsAdmin({
    writes: [{ delete: buildDocumentName(collection, docId) }],
  });
};

const readCacheDoc = async (docId) => {
  const accessToken = await getFirestoreAdminAccessToken();
  const snap = await firestoreGetDocumentWithAccessToken({
    docPath: `${CRM_LIVE_CACHE_COLLECTION}/${encodeURIComponent(docId)}`,
    accessToken,
  });
  if (!snap.ok) return snap.status === 404 ? { ok: false, status: 404, data: null } : snap;
  const fields = decodeFields(snap.data);
  return {
    ok: true,
    status: 200,
    data: {
      payload: fields?.payload && typeof fields.payload === "object" ? fields.payload : null,
      generatedAt: safeString(fields?.generatedAt),
    },
  };
};

const writeCacheDoc = async ({ docId, payload, generatedAt }) =>
  writeDocAsAdmin({
    docPath: `${CRM_LIVE_CACHE_COLLECTION}/${encodeURIComponent(docId)}`,
    data: { payload, generatedAt },
    updateMaskPaths: ["payload", "generatedAt"],
  });

const getCacheMeta = (row) => {
  const generatedAt = safeString(row?.generatedAt);
  const generatedMs = generatedAt ? Date.parse(generatedAt) : NaN;
  const ageMs = Number.isFinite(generatedMs) ? Math.max(0, Date.now() - generatedMs) : Number.POSITIVE_INFINITY;
  return { generatedAt, ageMs, ageMinutes: Math.round(ageMs / 60000) };
};

const readStateDoc = async (collection, docId) => {
  try {
    const doc = await getDocumentAsAdmin(`${collection}/${encodeURIComponent(docId)}`);
    return { ok: true, data: doc };
  } catch (error) {
    if (Number(error?.status) === 404) return { ok: false, status: 404, data: null };
    throw error;
  }
};

const writeStateDoc = async ({ collection, docId, data, updateMaskPaths } = {}) =>
  writeDocAsAdmin({
    docPath: `${collection}/${encodeURIComponent(docId)}`,
    data,
    updateMaskPaths,
  });

const decodeGoalDoc = (doc) => {
  if (!doc || typeof doc !== "object") return null;
  const id = getDocIdFromName(doc.name);
  if (!id) return null;
  const fields = decodeFields(doc);
  return {
    id,
    competencia: safeString(fields.competencia || id),
    valorMeta: Number.isFinite(Number(fields.valorMeta)) ? Number(fields.valorMeta) : null,
    periodStart: safeString(fields.periodStart) || null,
    periodEnd: safeString(fields.periodEnd) || null,
    defaultWeeklyConfig: fields.defaultWeeklyConfig ? normalizeWeeklyGoalConfigEntry({ weekKey: "", rawConfig: fields.defaultWeeklyConfig }) : null,
    weeklyGoals: decodeWeeklyGoalsMap(fields.weeklyGoals),
  };
};

const loadCrmLiveDefaultsConfig = async () => {
  try {
    const doc = await getDocumentAsAdmin(`${GROWTH_CONFIG_COLLECTION}/${encodeURIComponent(CRM_LIVE_DEFAULTS_DOC_ID)}`);
    return decodeGrowthConfigDoc({
      name: `${GROWTH_CONFIG_COLLECTION}/${encodeURIComponent(CRM_LIVE_DEFAULTS_DOC_ID)}`,
      fields: encodeFields(doc).fields,
    });
  } catch (error) {
    if (Number(error?.status) === 404) return null;
    throw error;
  }
};

const loadCurrentGoal = async ({ now = new Date() } = {}) => {
  const { monthKey } = getCalendarMonthBounds(now);
  try {
    const doc = await getDocumentAsAdmin(`${GOALS_COLLECTION}/${encodeURIComponent(monthKey)}`);
    return decodeGoalDoc({ name: `${GOALS_COLLECTION}/${encodeURIComponent(monthKey)}`, fields: encodeFields(doc).fields });
  } catch (error) {
    if (Number(error?.status) === 404) return null;
    throw error;
  }
};

const loadGrowthPeople = async () => {
  const docs = await listCollectionAsAdmin(GROWTH_PEOPLE_COLLECTION, { pageSize: 1000 });
  const people = docs
    .map((row) => decodeGrowthPeopleDoc({ name: `${GROWTH_PEOPLE_COLLECTION}/${encodeURIComponent(row.firestoreDocId || row.id)}`, fields: encodeFields(row).fields }))
    .filter(Boolean)
    .filter((row) => row.active !== false);
  const userUids = [...new Set(people.map((row) => safeString(row.userUid)).filter(Boolean))];
  if (!userUids.length) return people;
  const photoByUid = new Map();
  await Promise.all(
    userUids.map(async (uid) => {
      try {
        const userDoc = await getDocumentAsAdmin(`users/${encodeURIComponent(uid)}`);
        const photoURL = safeString(userDoc?.photoURL || userDoc?.photoUrl);
        if (photoURL) photoByUid.set(uid, photoURL);
      } catch (error) {
        if (Number(error?.status) !== 404) {
          console.warn("[crm-live] user photo lookup failed", { uid, status: Number(error?.status) || null });
        }
      }
    })
  );
  return people.map((row) => ({
    ...row,
    photoURL: safeString(row.photoURL) || photoByUid.get(safeString(row.userUid)) || "",
  }));
};

const decodeSdrEventRow = (row = {}) => {
  const dateKey = safeString(row.dateKey);
  const eventType = safeString(row.eventType);
  const outcome = safeString(row.outcome);
  const deletedAt = row.deletedAt ? safeString(row.deletedAt) : "";
  if (!dateKey || !eventType || !outcome || deletedAt) return null;
  return {
    id: safeString(row.firestoreDocId || row.id),
    dateKey,
    eventType,
    outcome,
    sdrUid: safeString(row.sdrUid),
    sdrEmail: safeString(row.sdrEmail).toLowerCase(),
    sdrName: safeString(row.sdrName),
    source: safeString(row.source),
    createdAt: safeString(row.createdAt),
  };
};

const loadSdrEventsRange = async ({ fromKey, toKey } = {}) => {
  const rows = await queryCollectionByDateRangeAsAdmin(SDR_ACTIVITY_COLLECTION, {
    dateField: "dateKey",
    from: fromKey,
    to: toKey,
  }).catch(() => []);
  return rows.map(decodeSdrEventRow).filter(Boolean);
};

const fetchCrmBusinessesLegacy = async ({ startDateKey, lastMovedAfter = "", status = "" } = {}) => {
  const apiKey = safeString(process.env.CRM_API_KEY);
  const base = safeString(process.env.CRM_API_BASE_URL).replace(/\/+$/, "");
  if (!apiKey || !base) {
    const error = new Error("missing_crm_env");
    error.status = 500;
    throw error;
  }
  const since = safeString(lastMovedAfter) || formatDateKeyStartIso(startDateKey);
  const take = 200;
  let skip = 0;
  let pages = 0;
  const businesses = [];
  const startedAt = Date.now();

  while (pages < 200) {
    const params = new URLSearchParams();
    params.set("skip", String(skip));
    params.set("take", String(take));
    if (since) params.set("filter[lastMovedAfter]", since);
    if (safeString(status)) params.set("filter[status]", safeString(status));
    const res = await requestJsonRaw(`${base}/api/v1/businesses?${params.toString()}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) {
      const error = new Error("crm_window_fetch_failed");
      error.status = res.status || 500;
      error.details = res.data || res.text || null;
      throw error;
    }
    const items = extractBusinessesArray(res.data);
    pages += 1;
    businesses.push(...items);
    if (items.length < take) break;
    skip += take;
  }

  return {
    businesses,
    pagination: {
      pages,
      totalFetched: businesses.length,
      baselinePages: 44,
      baselineTotal: 8790,
      elapsedMs: Date.now() - startedAt,
      lastMovedAfter: since,
      status: safeString(status),
    },
  };
};

const fetchCrmBusinesses = async ({ startDateKey, lastMovedAfter = "", status = "" } = {}) => {
  if (isDatacrazyMirrorEnabled()) {
    const result = await fetchMirroredBusinesses({ startDateKey, lastMovedAfter, status });
    const syncState = await getSyncState("incremental").catch(() => null);
    return {
      businesses: result.businesses || [],
      pagination: {
        ...(result.pagination || {}),
        lastSuccessfulSyncAt: safeString(syncState?.last_successful_sync_at),
      },
    };
  }
  return fetchCrmBusinessesLegacy({ startDateKey, lastMovedAfter, status });
};

const fetchCrmWindow = async ({ startDateKey } = {}) => fetchCrmBusinesses({ startDateKey });

const choosePipelineKey = (businesses = []) => {
  const preferred = normalizeKey("Funil principal");
  const hasPreferred = businesses.some((business) => normalizeKey(extractPipelineName(business)) === preferred);
  return hasPreferred ? preferred : CONVERSION_PIPELINE_FALLBACK_KEY;
};

const formatBusinessDateKey = (business) => {
  const movedAt = extractBusinessLastMovedAt(business);
  return movedAt ? formatSaoPauloDateKey(movedAt) : "";
};

const filterWindowBusinesses = ({ businesses = [], period }) =>
  (Array.isArray(businesses) ? businesses : []).filter((business) => {
    const movedAt = extractBusinessLastMovedAt(business);
    if (!movedAt) return false;
    const dateKey = formatSaoPauloDateKey(movedAt);
    return dateKey >= period.startDateKey && dateKey <= period.endDateKey;
  });

const buildMonthSummary = ({ businesses = [], goal = null, now = new Date() } = {}) => {
  const period = resolveCommercialPeriod({
    now,
    periodStart: safeString(goal?.periodStart),
    periodEnd: safeString(goal?.periodEnd),
  });
  const monthWindow = filterWindowBusinesses({ businesses, period });
  const pipelineKey = choosePipelineKey(monthWindow);
  const filtered = monthWindow.filter((business) => normalizeKey(extractPipelineName(business)) === pipelineKey);
  const closed = filtered.filter((business) => normalizeKey(extractStageName(business)) === CLOSED_STAGE_KEY);
  const realized = closed.reduce((sum, business) => sum + getDealValue(business), 0);
  const totalVendas = closed.length;
  const meta = Number(goal?.valorMeta || 0);
  const percent = meta > 0 ? (realized / meta) * 100 : 0;
  const latestSale = closed
    .slice()
    .sort((left, right) => {
      const leftMs = extractBusinessLastMovedAt(left)?.getTime() || 0;
      const rightMs = extractBusinessLastMovedAt(right)?.getTime() || 0;
      return rightMs - leftMs;
    })[0] || null;

  return {
    period,
    summary: {
      meta,
      realizado: realized,
      totalVendas,
      ticketMedio: totalVendas > 0 ? realized / totalVendas : 0,
      percentAtingimento: percent,
      gap: meta > 0 ? Math.max(0, meta - realized) : 0,
    },
    latestSale: latestSale
      ? {
          id: extractBusinessId(latestSale),
          cliente: extractBusinessClientName(latestSale),
          plano: extractBusinessPlanName(latestSale),
          valor: getDealValue(latestSale),
          closer: extractBusinessAttendantName(latestSale) || "Sem responsável",
          when: extractBusinessLastMovedAt(latestSale)?.toISOString() || "",
        }
      : null,
    pipelineKey,
    windowCount: monthWindow.length,
  };
};

const buildWeeklyTeamSummary = ({ weeklyReadModel }) => {
  const closerRows = Array.isArray(weeklyReadModel?.progress?.closers) ? weeklyReadModel.progress.closers : [];
  const sdrRows = Array.isArray(weeklyReadModel?.progress?.sdrs) ? weeklyReadModel.progress.sdrs : [];
  const configuredCloserTarget = safeNumber(weeklyReadModel?.weeklyGoal?.teamTarget);
  const closersTarget = configuredCloserTarget > 0 ? configuredCloserTarget : closerRows.reduce((sum, row) => sum + safeNumber(row.targetValue), 0);
  const closersActual = closerRows.reduce((sum, row) => sum + safeNumber(row.actualValue), 0);
  const closersCount = closerRows.reduce((sum, row) => sum + safeNumber(row.count), 0);
  const sdrTarget = sdrRows.reduce((sum, row) => sum + safeNumber(row.targetValue), 0);
  const sdrActual = sdrRows.reduce((sum, row) => sum + safeNumber(row.actualValue), 0);
  const sdrCount = sdrRows.reduce((sum, row) => sum + safeNumber(row.count), 0);
  return {
    closers: {
      targetValue: closersTarget,
      actualValue: closersActual,
      missingValue: Math.max(0, closersTarget - closersActual),
      progressPct: closersTarget > 0 ? (closersActual / closersTarget) * 100 : 0,
      count: closersCount,
      ticketMedio: closersCount > 0 ? closersActual / closersCount : 0,
    },
    sdrs: {
      targetValue: sdrTarget,
      actualValue: sdrActual,
      missingValue: Math.max(0, sdrTarget - sdrActual),
      progressPct: sdrTarget > 0 ? (sdrActual / sdrTarget) * 100 : 0,
      count: sdrCount,
    },
  };
};

const countSalesDaysRemainingInclusive = (period, now = new Date()) => {
  if (!period) return 0;
  const nowKey = formatSaoPauloDateKey(now);
  const fromKey = !nowKey || nowKey < period.startDateKey ? period.startDateKey : nowKey;
  const fromDate = new Date(`${fromKey}T12:00:00-03:00`);
  const endDate = new Date(`${period.endDateKey}T12:00:00-03:00`);
  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(endDate.getTime()) || fromDate > endDate) return 0;
  let count = 0;
  for (const cursor = new Date(fromDate); cursor <= endDate; cursor.setDate(cursor.getDate() + 1)) {
    if (cursor.getDay() !== 0) count += 1;
  }
  return count;
};

const buildPipelineRows = ({ businesses = [], people = [], now = new Date(), commercialStartDateKey = "" } = {}) => {
  const indexes = buildGrowthPeopleIndexes(people);
  const tenDaysAgo = new Date((now instanceof Date ? now : new Date(now)).getTime() - (10 * 86400000));
  const tenDaysAgoKey = formatSaoPauloDateKey(tenDaysAgo);
  const thresholdKey = [safeString(commercialStartDateKey), tenDaysAgoKey].filter(Boolean).sort()[0] || tenDaysAgoKey;
  const grouped = new Map();
  (Array.isArray(businesses) ? businesses : []).forEach((business) => {
    const status = normalizeKey(extractBusinessStatus(business));
    const stageKey = normalizeKey(extractStageName(business));
    const movedAt = extractBusinessLastMovedAt(business);
    const dateKey = movedAt ? formatSaoPauloDateKey(movedAt) : "";
    if (!dateKey || dateKey < thresholdKey) return;
    if (status !== normalizeKey("in_process")) return;
    if (stageKey !== normalizeKey("Forecast") && stageKey !== normalizeKey("Pagamento Parcial")) return;
    const bucket = resolveCloserBucketForBusiness(business, indexes);
    const personId = safeString(bucket.bucketPersonId);
    const person = indexes.byPersonId.get(personId);
    if (!personId) return;
    const entry = grouped.get(personId) || {
      personId,
      displayName: safeString(person?.displayName) || safeString(bucket.bucketDisplayName) || AGGREGATE_OTHERS_DISPLAY_NAME,
      photoURL: safeString(person?.photoURL),
      isAggregate: person?.isAggregate === true || personId === AGGREGATE_OTHERS_PERSON_ID,
      value: 0,
      dealsCount: 0,
    };
    entry.value += getDealValue(business);
    entry.dealsCount += 1;
    grouped.set(personId, entry);
  });
  return Array.from(grouped.values())
    .filter((row) => safeNumber(row.value) > 0)
    .sort((left, right) => safeNumber(right.value) - safeNumber(left.value) || safeString(left.displayName).localeCompare(safeString(right.displayName), "pt-BR"));
};

const loadGoalByMonthKey = async (monthKey) => {
  const safeMonthKey = safeString(monthKey);
  if (!/^\d{4}-\d{2}$/.test(safeMonthKey)) return null;
  try {
    const doc = await getDocumentAsAdmin(`${GOALS_COLLECTION}/${encodeURIComponent(safeMonthKey)}`);
    return decodeGoalDoc({ name: `${GOALS_COLLECTION}/${encodeURIComponent(safeMonthKey)}`, fields: encodeFields(doc).fields });
  } catch (error) {
    if (Number(error?.status) === 404) return null;
    throw error;
  }
};

const resolveGoalCommercialPeriod = ({ goal = null, now = new Date() } = {}) =>
  resolveCommercialPeriod({
    now,
    periodStart: safeString(goal?.periodStart),
    periodEnd: safeString(goal?.periodEnd),
  });

const sumClosedRevenueForPeriod = ({ businesses = [], period, pipelineKey = "" } = {}) =>
  filterWindowBusinesses({ businesses, period })
    .filter((business) => normalizeKey(extractPipelineName(business)) === pipelineKey)
    .filter((business) => normalizeKey(extractStageName(business)) === CLOSED_STAGE_KEY)
    .reduce((sum, business) => sum + getDealValue(business), 0);

const countClosedSalesForPeriod = ({ businesses = [], period, pipelineKey = "" } = {}) =>
  filterWindowBusinesses({ businesses, period })
    .filter((business) => normalizeKey(extractPipelineName(business)) === pipelineKey)
    .filter((business) => normalizeKey(extractStageName(business)) === CLOSED_STAGE_KEY).length;

const buildWeeklyProjection = ({ weeklyTeam = {}, commercialWeek, now = new Date() } = {}) => {
  const actual = safeNumber(weeklyTeam?.actualValue);
  const target = safeNumber(weeklyTeam?.targetValue);
  const elapsedSalesDays = countSalesDaysElapsedInclusive(commercialWeek, now);
  const totalSalesDays = countSalesDaysElapsedInclusive(commercialWeek, new Date(`${commercialWeek?.endDateKey || ""}T12:00:00-03:00`));
  const averagePerDay = elapsedSalesDays > 0 ? actual / elapsedSalesDays : 0;
  const projected = totalSalesDays > 0 ? averagePerDay * totalSalesDays : actual;
  return {
    actual,
    target,
    elapsedSalesDays,
    totalSalesDays,
    averagePerDay,
    projected: roundMoney(projected),
    gap: Math.max(0, roundMoney(target - projected)),
    beatsTarget: target > 0 && projected >= target,
  };
};

const buildMonthVsPrevious = ({ currentPeriod, currentRealized = 0, currentMonthKey = "", currentPipelineKey = "", now = new Date(), previousGoal = null, previousBusinesses = [] } = {}) => {
  if (!currentPeriod || !currentMonthKey || !currentPipelineKey) return null;
  const previousMonthKey = subtractMonthsFromMonthKey(currentMonthKey, 1);
  if (!previousMonthKey) return null;
  const previousNow = new Date(`${previousMonthKey}-15T12:00:00-03:00`);
  const previousPeriod = resolveGoalCommercialPeriod({ goal: previousGoal, now: previousNow });
  const salesDaysElapsed = countSalesDaysElapsedInclusive(currentPeriod, now);
  const previousCutoffDateKey = resolveNthSalesDayCutoff(previousPeriod, salesDaysElapsed);
  if (!previousCutoffDateKey) return null;
  const previousComparablePeriod = {
    startDateKey: previousPeriod.startDateKey,
    endDateKey: previousCutoffDateKey,
  };
  const previousRealized = sumClosedRevenueForPeriod({
    businesses: previousBusinesses,
    period: previousComparablePeriod,
    pipelineKey: currentPipelineKey,
  });
  return {
    previousMonthKey,
    previousPeriod,
    salesDaysElapsed,
    previousCutoffDateKey,
    previousRealized: roundMoney(previousRealized),
    delta: roundMoney(currentRealized - previousRealized),
    ahead: currentRealized >= previousRealized,
  };
};

const buildPersonalBestHeadline = ({ weeklyRollups = [], currentRows = [], role = "" } = {}) => {
  const rows = Array.isArray(currentRows) ? currentRows : [];
  if (!rows.length || !Array.isArray(weeklyRollups) || !weeklyRollups.length) return null;
  let best = null;
  rows.forEach((row) => {
    const personId = safeString(row?.personId);
    const targetValue = safeNumber(row?.targetValue);
    if (!personId || targetValue <= 0) return;
    const actualValue = safeNumber(row?.actualValue);
    let historicalBest = 0;
    weeklyRollups.forEach((rollup) => {
      const progressRows = Array.isArray(rollup?.peopleProgress?.[role]) ? rollup.peopleProgress[role] : [];
      const historical = progressRows.find((entry) => safeString(entry?.personId) === personId);
      if (historical) historicalBest = Math.max(historicalBest, safeNumber(historical.actualValue));
    });
    if (historicalBest <= 0 || actualValue > historicalBest) return;
    const remaining = Math.max(0, Math.ceil(historicalBest - actualValue));
    if (remaining <= 0) return;
    const candidate = {
      personId,
      displayName: safeString(row?.displayName),
      photoURL: safeString(row?.photoURL),
      actualValue,
      historicalBest,
      remaining,
      targetValue,
      progressPct: safeNumber(row?.progressPct),
    };
    if (!best || candidate.remaining < best.remaining || (candidate.remaining === best.remaining && candidate.progressPct > best.progressPct)) {
      best = candidate;
    }
  });
  if (!best) return null;
  return {
    id: `personal_best:${role}:${best.personId}`,
    type: "personal_best",
    personId: best.personId,
    personName: best.displayName,
    photoURL: best.photoURL,
    role,
    remaining: best.remaining,
    historicalBest: best.historicalBest,
    actualValue: best.actualValue,
    headline: `${best.displayName} está a ${best.remaining} ${best.remaining === 1 ? "reunião" : "reuniões"} do melhor dele na semana.`,
  };
};

const buildWeeklyNewsScreens = ({ month = {}, weekly = {}, previousMonthComparison = null, weeklyRollups = [], now = new Date() } = {}) => {
  const screens = [];
  const sdrRows = Array.isArray(weekly?.sdrs) ? weekly.sdrs : [];
  const weekProjection = buildWeeklyProjection({ weeklyTeam: weekly?.team?.closers, commercialWeek: weekly?.commercialWeek, now });

  if (weekly?.team?.closers && weekly?.commercialWeek) {
    screens.push({
      id: "week_projection",
      type: "week_projection",
      projected: weekProjection.projected,
      target: weekProjection.target,
      averagePerDay: weekProjection.averagePerDay,
      beatsTarget: weekProjection.beatsTarget,
      gap: weekProjection.gap,
    });
  }

  const personalBest = buildPersonalBestHeadline({ weeklyRollups, currentRows: sdrRows, role: "sdrs" });
  if (personalBest) screens.push(personalBest);

  return screens;
};

const buildPreviousDayHighlights = ({ goal, globalConfig = null, people, businesses = [], sdrEvents = [], now = new Date() } = {}) => {
  const previousDay = new Date(now instanceof Date ? now.getTime() : Date.now());
  previousDay.setDate(previousDay.getDate() - 1);
  const weekForPreviousDay = resolveCommercialWeek({ now: previousDay });
  const weeklyReadModel = buildWeeklyGoalsReadModel({ goal, globalConfig, people, businesses, sdrEvents, now: previousDay });
  const indexes = buildGrowthPeopleIndexes(people);
  const previousDayKey = formatSaoPauloDateKey(previousDay);
  const pipelineKey = choosePipelineKey(businesses);

  const closerDaily = new Map();
  filterWindowBusinesses({ businesses, period: { startDateKey: previousDayKey, endDateKey: previousDayKey } })
    .filter((business) => normalizeKey(extractPipelineName(business)) === pipelineKey)
    .filter((business) => normalizeKey(extractStageName(business)) === CLOSED_STAGE_KEY)
    .forEach((business) => {
      const bucket = resolveCloserBucketForBusiness(business, indexes);
      if (bucket.bucketPersonId === AGGREGATE_OTHERS_PERSON_ID) return;
      const row = Array.isArray(weeklyReadModel?.progress?.closers)
        ? weeklyReadModel.progress.closers.find((entry) => entry.personId && entry.personId === bucket.bucketPersonId)
        : null;
      if (!row) return;
      closerDaily.set(row.personId, (closerDaily.get(row.personId) || 0) + getDealValue(business));
    });

  const sdrDaily = new Map();
  (Array.isArray(sdrEvents) ? sdrEvents : [])
    .filter((event) => safeString(event.dateKey) === previousDayKey)
    .filter((event) => event.eventType === "meeting" && event.outcome === "show")
    .forEach((event) => {
      const row = Array.isArray(weeklyReadModel?.progress?.sdrs)
        ? weeklyReadModel.progress.sdrs.find(
            (entry) =>
              entry.personId &&
              people.some(
                (person) =>
                  person.personId === entry.personId &&
                  (safeString(person.sdrUid) === safeString(event.sdrUid) ||
                    person.sdrEmails.includes(safeString(event.sdrEmail).toLowerCase()))
              )
          )
        : null;
      if (!row) return;
      sdrDaily.set(row.personId, (sdrDaily.get(row.personId) || 0) + 1);
    });

  const closerHighlight = (weeklyReadModel?.progress?.closers || [])
    .filter((row) => row?.isAggregate !== true)
    .map((row) => {
      const dailyValue = closerDaily.get(row.personId) || 0;
      return { ...row, dailyValue, dailyProgressPct: row.targetValue > 0 ? (dailyValue / row.targetValue) * 100 : 0 };
    })
    .sort((a, b) => b.dailyProgressPct - a.dailyProgressPct || b.dailyValue - a.dailyValue)[0] || null;

  const sdrHighlight = (weeklyReadModel?.progress?.sdrs || [])
    .map((row) => {
      const dailyValue = sdrDaily.get(row.personId) || 0;
      return { ...row, dailyValue, dailyProgressPct: row.targetValue > 0 ? (dailyValue / row.targetValue) * 100 : 0 };
    })
    .sort((a, b) => b.dailyProgressPct - a.dailyProgressPct || b.dailyValue - a.dailyValue)[0] || null;

  return {
    dayKey: previousDayKey,
    weekKey: weekForPreviousDay.weekKey,
    closer: closerHighlight,
    sdr: sdrHighlight,
  };
};

const buildUnresolvedBuckets = ({ businesses = [], people = [], goal, globalConfig = null, sdrEvents = [], now = new Date() } = {}) => {
  const weekly = buildWeeklyGoalsReadModel({ goal, globalConfig, people, businesses, sdrEvents, now });
  const missingResponsible = [];
  const unknownResponsible = [];
  const week = weekly.commercialWeek;
  const weekBusinesses = filterWindowBusinesses({ businesses, period: { startDateKey: week.startDateKey, endDateKey: week.endDateKey } });
  const pipelineKey = choosePipelineKey(weekBusinesses);
  weekBusinesses
    .filter((business) => normalizeKey(extractPipelineName(business)) === pipelineKey)
    .filter((business) => normalizeKey(extractStageName(business)) === CLOSED_STAGE_KEY)
    .forEach((business) => {
      const attendantId = extractCrmAttendantId(business);
      if (!attendantId) {
        missingResponsible.push({
          businessId: extractBusinessId(business),
          cliente: extractBusinessClientName(business),
          valor: getDealValue(business),
          movedAt: extractBusinessLastMovedAt(business)?.toISOString() || "",
        });
        return;
      }
    });
  const unknown = Array.isArray(weekly?.unresolved?.crmAttendantIds) ? weekly.unresolved.crmAttendantIds : [];
  unknown.forEach((row) => {
    if (safeString(row.crmAttendantId)) unknownResponsible.push(row);
  });
  return {
    missingResponsible,
    unknownResponsible,
    sdrActors: Array.isArray(weekly?.unresolved?.sdrActors) ? weekly.unresolved.sdrActors : [],
  };
};

const buildCrmLiveCrmSlice = async ({ goal, globalConfig = null, people, now = new Date() } = {}) => {
  const monthPeriod = resolveCommercialPeriod({
    now,
    periodStart: safeString(goal?.periodStart),
    periodEnd: safeString(goal?.periodEnd),
  });
  const tenDaysAgoKey = formatSaoPauloDateKey(new Date((now instanceof Date ? now : new Date(now)).getTime() - (10 * 86400000)));
  const crmWindowStartDateKey = [monthPeriod.startDateKey, tenDaysAgoKey].filter(Boolean).sort()[0] || monthPeriod.startDateKey;
  // Pipeline é estoque, não ciclo: por isso a tela "Dinheiro na mesa" usa a janela mais ampla
  // entre o início do ciclo comercial e os últimos 10 dias de movimentação.
  const crm = await fetchCrmWindow({ startDateKey: crmWindowStartDateKey });
  const monthSummary = buildMonthSummary({ businesses: crm.businesses, goal, now });
  const previousMonthKey = subtractMonthsFromMonthKey(monthPeriod.monthKey, 1);
  const previousGoal = previousMonthKey ? await loadGoalByMonthKey(previousMonthKey) : null;
  const previousPeriod = previousMonthKey
    ? resolveGoalCommercialPeriod({ goal: previousGoal, now: new Date(`${previousMonthKey}-15T12:00:00-03:00`) })
    : null;
  const previousCrm = previousPeriod ? await fetchCrmWindow({ startDateKey: previousPeriod.startDateKey }) : { businesses: [], pagination: null };
  const monthComparison = previousPeriod
    ? buildMonthVsPrevious({
        currentPeriod: monthSummary.period,
        currentRealized: safeNumber(monthSummary.summary?.realizado),
        currentMonthKey: monthPeriod.monthKey,
        currentPipelineKey: monthSummary.pipelineKey,
        now,
        previousGoal,
        previousBusinesses: previousCrm.businesses,
      })
    : null;
  const weeklyReadModel = buildWeeklyGoalsReadModel({
    goal,
    globalConfig,
    people,
    businesses: crm.businesses,
    sdrEvents: [],
    now,
  });
  const highlights = buildPreviousDayHighlights({
    goal,
    globalConfig,
    people,
    businesses: crm.businesses,
    sdrEvents: [],
    now,
  });
  const unresolved = buildUnresolvedBuckets({
    businesses: crm.businesses,
    people,
    goal,
    globalConfig,
    sdrEvents: [],
    now,
  });
  const weeklyTeam = buildWeeklyTeamSummary({ weeklyReadModel });
  return {
    generatedAt: new Date().toISOString(),
    month: monthSummary,
    weekly: {
      commercialWeek: weeklyReadModel.commercialWeek,
      team: {
        closers: weeklyTeam.closers,
      },
      closers: weeklyReadModel.progress.closers || [],
      configSource: weeklyReadModel.weeklyGoalConfigSource || "",
    },
    pipeline: {
      windowStartDateKey: crmWindowStartDateKey,
      rows: buildPipelineRows({
        businesses: crm.businesses,
        people,
        now,
        commercialStartDateKey: monthPeriod.startDateKey,
      }),
    },
    highlights: {
      dayKey: highlights.dayKey,
      weekKey: highlights.weekKey,
      closer: highlights.closer,
    },
    latestSale: monthSummary.latestSale,
    monthComparison,
    unresolved: {
      missingResponsible: unresolved.missingResponsible,
      unknownResponsible: unresolved.unknownResponsible,
    },
    cacheDebug: {
      crm: {
        ...(crm.pagination || {}),
        commercialStartDateKey: monthPeriod.startDateKey,
        pipelineWindowStartDateKey: crmWindowStartDateKey,
        weeklyConfigSource: weeklyReadModel.weeklyGoalConfigSource || "",
      },
    },
  };
};

const buildCrmLiveSdrSlice = async ({ goal, globalConfig = null, people, now = new Date() } = {}) => {
  const sdrWeek = resolveCommercialWeek({ now });
  const yesterdayKey = formatSaoPauloDateKey(new Date(now.getTime() - 86400000));
  const sdrFromKey = sdrWeek.startDateKey < yesterdayKey ? sdrWeek.startDateKey : yesterdayKey;
  const sdrEvents = await loadSdrEventsRange({ fromKey: sdrFromKey, toKey: sdrWeek.endDateKey });
  const weeklyReadModel = buildWeeklyGoalsReadModel({
    goal,
    globalConfig,
    people,
    businesses: [],
    sdrEvents,
    now,
  });
  const highlights = buildPreviousDayHighlights({
    goal,
    globalConfig,
    people,
    businesses: [],
    sdrEvents,
    now,
  });
  return {
    generatedAt: new Date().toISOString(),
    weekly: {
      commercialWeek: weeklyReadModel.commercialWeek,
      team: {
        sdrs: buildWeeklyTeamSummary({ weeklyReadModel }).sdrs,
      },
      sdrs: weeklyReadModel.progress.sdrs || [],
      configSource: weeklyReadModel.weeklyGoalConfigSource || "",
    },
    highlights: {
      dayKey: highlights.dayKey,
      weekKey: highlights.weekKey,
      sdr: highlights.sdr,
    },
    unresolved: {
      sdrActors: Array.isArray(weeklyReadModel?.unresolved?.sdrActors) ? weeklyReadModel.unresolved.sdrActors : [],
    },
    cacheDebug: {
      sdr: {
        eventsLoaded: sdrEvents.length,
        fromKey: sdrFromKey,
        toKey: sdrWeek.endDateKey,
        weeklyConfigSource: weeklyReadModel.weeklyGoalConfigSource || "",
      },
    },
  };
};

const buildCrmLivePayload = async ({ now = new Date() } = {}) => {
  const goal = await loadCurrentGoal({ now });
  const [globalConfig, people] = await Promise.all([loadCrmLiveDefaultsConfig(), loadGrowthPeople()]);
  const [crm, sdr] = await Promise.all([
    buildCrmLiveCrmSlice({ goal, globalConfig, people, now }),
    buildCrmLiveSdrSlice({ goal, globalConfig, people, now }),
  ]);
  const closers = decorateLeaderboardComparisons({ rows: crm.weekly?.closers || [], discrete: false });
  const sdrs = decorateLeaderboardComparisons({ rows: sdr.weekly?.sdrs || [], discrete: true });
  const weeklyHistory = await loadWeeklyRollupsHistory({ limit: 32 });
  const news = buildWeeklyNewsScreens({
    month: crm.month,
    weekly: {
      commercialWeek: crm.weekly?.commercialWeek || sdr.weekly?.commercialWeek,
      team: {
        closers: crm.weekly?.team?.closers,
        sdrs: sdr.weekly?.team?.sdrs,
      },
      closers,
      sdrs,
    },
    previousMonthComparison: crm.monthComparison || null,
    weeklyRollups: weeklyHistory.filter((row) => row.weekKey !== safeString(crm.weekly?.commercialWeek?.weekKey)),
    now,
  });
  return {
    generatedAt: new Date().toISOString(),
    month: crm.month,
    news,
    weekly: {
      commercialWeek: crm.weekly.commercialWeek || sdr.weekly.commercialWeek,
      team: {
        closers: crm.weekly.team.closers,
        sdrs: sdr.weekly.team.sdrs,
      },
      closers,
      sdrs,
      configSource: crm.weekly.configSource || sdr.weekly.configSource || "",
    },
    highlights: {
      dayKey: crm.highlights.dayKey || sdr.highlights.dayKey,
      weekKey: crm.highlights.weekKey || sdr.highlights.weekKey,
      closer: crm.highlights.closer,
      sdr: sdr.highlights.sdr,
    },
    latestSale: crm.latestSale,
    unresolved: {
      missingResponsible: crm.unresolved.missingResponsible,
      unknownResponsible: crm.unresolved.unknownResponsible,
      sdrActors: sdr.unresolved.sdrActors,
    },
    cacheDebug: {
      crm: crm.cacheDebug.crm,
      sdr: sdr.cacheDebug.sdr,
    },
  };
};

const decodeDetectorState = (doc = {}) => {
  const state = doc && typeof doc === "object" ? doc : {};
  const lastLeaders = state.lastLeaders && typeof state.lastLeaders === "object" ? state.lastLeaders : {};
  const currentWeek = state.currentWeek && typeof state.currentWeek === "object" ? state.currentWeek : {};
  return {
    cursor: safeString(state.cursor),
    initializedAt: safeString(state.initializedAt),
    updatedAt: safeString(state.updatedAt),
    lastLeaders: {
      closers: safeString(lastLeaders.closers),
      sdrs: safeString(lastLeaders.sdrs),
    },
    currentWeek: {
      weekKey: safeString(currentWeek.weekKey),
      metaIndividualsHit: Array.isArray(currentWeek.metaIndividualsHit) ? currentWeek.metaIndividualsHit.map((value) => safeString(value)).filter(Boolean) : [],
      teamMetasHit: Array.isArray(currentWeek.teamMetasHit) ? currentWeek.teamMetasHit.map((value) => safeString(value)).filter(Boolean) : [],
    },
    announcedSaleIds: Array.isArray(state.announcedSaleIds) ? state.announcedSaleIds.map((value) => safeString(value)).filter(Boolean) : [],
  };
};

const buildDetectorStateSnapshot = ({ cursor = "", weeklyReadModel, announcedSaleIds = [], currentWeek = null, initializedAt = "", updatedAt = "" } = {}) => {
  const closerLeader = safeString(weeklyReadModel?.progress?.closers?.[0]?.personId);
  const sdrLeader = safeString(weeklyReadModel?.progress?.sdrs?.[0]?.personId);
  const weekKey = safeString(weeklyReadModel?.commercialWeek?.weekKey);
  const currentWeekState = currentWeek && typeof currentWeek === "object" ? currentWeek : {};
  return {
    cursor: safeString(cursor),
    initializedAt: safeString(initializedAt),
    updatedAt: safeString(updatedAt),
    lastLeaders: {
      closers: closerLeader,
      sdrs: sdrLeader,
    },
    currentWeek: {
      weekKey,
      metaIndividualsHit: Array.isArray(currentWeekState.metaIndividualsHit) ? currentWeekState.metaIndividualsHit.map((value) => safeString(value)).filter(Boolean) : [],
      teamMetasHit: Array.isArray(currentWeekState.teamMetasHit) ? currentWeekState.teamMetasHit.map((value) => safeString(value)).filter(Boolean) : [],
    },
    announcedSaleIds: Array.isArray(announcedSaleIds) ? [...new Set(announcedSaleIds.map((value) => safeString(value)).filter(Boolean))].slice(-500) : [],
  };
};

const buildWonBusinessEventContext = ({ business, weeklyReadModel, monthSummary }) => {
  const indexes = buildGrowthPeopleIndexes(Array.isArray(weeklyReadModel?.people) ? weeklyReadModel.people : []);
  const bucket = resolveCloserBucketForBusiness(business, indexes);
  const bucketPerson = bucket.bucketPersonId ? indexes.byPersonId.get(bucket.bucketPersonId) || null : null;
  const weekGap = Math.max(0, safeNumber(weeklyReadModel?.team?.closers?.targetValue) - safeNumber(weeklyReadModel?.team?.closers?.actualValue));
  return {
    businessId: extractBusinessId(business),
    clientName: extractBusinessClientName(business) || "Cliente sem nome",
    planName: extractBusinessPlanName(business) || "Plano não informado",
    personId: safeString(bucket.bucketPersonId),
    isAggregate: bucket.bucketPersonId === AGGREGATE_OTHERS_PERSON_ID || bucketPerson?.isAggregate === true,
    closerName:
      bucket.bucketPersonId === AGGREGATE_OTHERS_PERSON_ID
        ? AGGREGATE_OTHERS_DISPLAY_NAME
        : safeString(bucketPerson?.displayName || extractBusinessAttendantName(business) || "Sem responsável"),
    photoURL: bucket.bucketPersonId === AGGREGATE_OTHERS_PERSON_ID ? "" : safeString(bucketPerson?.photoURL),
    value: getDealValue(business),
    movedAt: extractBusinessLastMovedAt(business)?.toISOString() || "",
    dateKey: formatBusinessDateKey(business),
    status: extractBusinessStatus(business),
    weekGap,
    monthGap: Math.max(0, safeNumber(monthSummary?.summary?.gap)),
  };
};

const buildCrmLiveEventQueue = ({ previousState, weeklyReadModel, weekTeamSummary, freshWonBusinesses = [], monthSummary, now = new Date() } = {}) => {
  const currentState = decodeDetectorState(previousState || {});
  const nowIso = now instanceof Date ? now.toISOString() : new Date().toISOString();
  const announcedSaleIds = new Set(currentState.announcedSaleIds);
  const currentWeekKey = safeString(weeklyReadModel?.commercialWeek?.weekKey);
  const previousWeekKey = safeString(currentState.currentWeek?.weekKey);
  const weekRolled = Boolean(previousWeekKey && currentWeekKey && previousWeekKey !== currentWeekKey);
  const coldStart = !safeString(currentState.cursor);

  const sortedWon = (Array.isArray(freshWonBusinesses) ? freshWonBusinesses : [])
    .slice()
    .sort((left, right) => {
      const leftMs = extractBusinessLastMovedAt(left)?.getTime() || 0;
      const rightMs = extractBusinessLastMovedAt(right)?.getTime() || 0;
      return leftMs - rightMs;
    });

  const latestCursor = sortedWon.length
    ? (extractBusinessLastMovedAt(sortedWon[sortedWon.length - 1])?.toISOString() || safeString(currentState.cursor) || nowIso)
    : safeString(currentState.cursor) || nowIso;

  const currentClosers = Array.isArray(weeklyReadModel?.progress?.closers) ? weeklyReadModel.progress.closers : [];
  const currentSdrs = Array.isArray(weeklyReadModel?.progress?.sdrs) ? weeklyReadModel.progress.sdrs : [];
  const previousHitPeople = new Set(weekRolled ? [] : (currentState.currentWeek?.metaIndividualsHit || []));
  const previousTeamHits = new Set(weekRolled ? [] : (currentState.currentWeek?.teamMetasHit || []));
  const events = [];

  if (coldStart) {
    const seededPeople = [
      ...currentClosers.filter((row) => safeNumber(row.progressPct) >= 100).map((row) => safeString(row.personId)),
      ...currentSdrs.filter((row) => safeNumber(row.progressPct) >= 100).map((row) => safeString(row.personId)),
    ].filter(Boolean);
    const seededTeams = [];
    if (safeNumber(weekTeamSummary?.closers?.progressPct) >= 100) seededTeams.push("closers");
    if (safeNumber(weekTeamSummary?.sdrs?.progressPct) >= 100) seededTeams.push("sdrs");
    return {
      coldStart: true,
      weekRolled,
      events: [],
      newSales: [],
      nextState: buildDetectorStateSnapshot({
        cursor: latestCursor,
        weeklyReadModel,
        announcedSaleIds: [...announcedSaleIds, ...sortedWon.map((business) => extractBusinessId(business))],
        currentWeek: {
          metaIndividualsHit: seededPeople,
          teamMetasHit: seededTeams,
        },
        initializedAt: currentState.initializedAt || nowIso,
        updatedAt: nowIso,
      }),
    };
  }

  const newSales = sortedWon.filter((business) => {
    const id = extractBusinessId(business);
    return id && !announcedSaleIds.has(id);
  });

  newSales.forEach((business) => {
    const context = buildWonBusinessEventContext({ business, weeklyReadModel: { ...weeklyReadModel, team: weekTeamSummary }, monthSummary });
    events.push({
      id: `sale:${context.businessId}`,
      type: "sale_closed",
      happenedAt: context.movedAt || nowIso,
      saleId: context.businessId,
      payload: context,
    });
    announcedSaleIds.add(context.businessId);
  });

  const currentLeaderClosers = safeString(currentClosers[0]?.personId);
  const currentLeaderSdrs = safeString(currentSdrs[0]?.personId);
  if (!weekRolled && safeString(currentState.lastLeaders?.closers) && currentLeaderClosers && currentLeaderClosers !== safeString(currentState.lastLeaders.closers)) {
    const leader = currentClosers[0];
    events.push({
      id: `leader:closers:${currentWeekKey}:${currentLeaderClosers}`,
      type: "leader_changed",
      happenedAt: nowIso,
      leaderboard: "closers",
      payload: {
        leaderboard: "closers",
        personId: currentLeaderClosers,
        displayName: safeString(leader?.displayName),
        isAggregate: leader?.isAggregate === true,
        photoURL: safeString(leader?.photoURL),
        progressPct: safeNumber(leader?.progressPct),
        actualValue: safeNumber(leader?.actualValue),
        targetValue: safeNumber(leader?.targetValue),
      },
    });
  }
  if (!weekRolled && safeString(currentState.lastLeaders?.sdrs) && currentLeaderSdrs && currentLeaderSdrs !== safeString(currentState.lastLeaders.sdrs)) {
    const leader = currentSdrs[0];
    events.push({
      id: `leader:sdrs:${currentWeekKey}:${currentLeaderSdrs}`,
      type: "leader_changed",
      happenedAt: nowIso,
      leaderboard: "sdrs",
      payload: {
        leaderboard: "sdrs",
        personId: currentLeaderSdrs,
        displayName: safeString(leader?.displayName),
        isAggregate: leader?.isAggregate === true,
        photoURL: safeString(leader?.photoURL),
        progressPct: safeNumber(leader?.progressPct),
        actualValue: safeNumber(leader?.actualValue),
        targetValue: safeNumber(leader?.targetValue),
      },
    });
  }

  [...currentClosers, ...currentSdrs].forEach((row) => {
    const personId = safeString(row?.personId);
    if (!personId || previousHitPeople.has(personId) || safeNumber(row?.progressPct) < 100) return;
    events.push({
      id: `meta:person:${currentWeekKey}:${personId}`,
      type: "individual_goal_hit",
      happenedAt: nowIso,
      payload: {
        personId,
        displayName: safeString(row?.displayName),
        role: safeString(row?.role),
        isAggregate: row?.isAggregate === true,
        photoURL: safeString(row?.photoURL),
        progressPct: safeNumber(row?.progressPct),
        actualValue: safeNumber(row?.actualValue),
        targetValue: safeNumber(row?.targetValue),
      },
    });
    previousHitPeople.add(personId);
  });

  [
    { key: "closers", row: weekTeamSummary?.closers },
    { key: "sdrs", row: weekTeamSummary?.sdrs },
  ].forEach(({ key, row }) => {
    if (previousTeamHits.has(key) || safeNumber(row?.progressPct) < 100) return;
    events.push({
      id: `meta:team:${currentWeekKey}:${key}`,
      type: "team_goal_hit",
      happenedAt: nowIso,
      payload: {
        team: key,
        progressPct: safeNumber(row?.progressPct),
        actualValue: safeNumber(row?.actualValue),
        targetValue: safeNumber(row?.targetValue),
      },
    });
    previousTeamHits.add(key);
  });

  events.sort((left, right) => {
    const leftTs = Date.parse(left?.happenedAt || "") || 0;
    const rightTs = Date.parse(right?.happenedAt || "") || 0;
    if (leftTs !== rightTs) return leftTs - rightTs;
    const weight = {
      sale_closed: 0,
      individual_goal_hit: 1,
      leader_changed: 2,
      team_goal_hit: 3,
    };
    return (weight[left?.type] ?? 99) - (weight[right?.type] ?? 99);
  });

  return {
    coldStart: false,
    weekRolled,
    events,
    newSales,
    nextState: buildDetectorStateSnapshot({
      cursor: latestCursor,
      weeklyReadModel,
      announcedSaleIds: Array.from(announcedSaleIds),
      currentWeek: {
        metaIndividualsHit: Array.from(previousHitPeople),
        teamMetasHit: Array.from(previousTeamHits),
      },
      initializedAt: currentState.initializedAt || nowIso,
      updatedAt: nowIso,
    }),
  };
};

const writeDailyRollups = async ({ sales = [] } = {}) => {
  const grouped = new Map();
  (Array.isArray(sales) ? sales : []).forEach((business) => {
    const dateKey = formatBusinessDateKey(business);
    if (!dateKey) return;
    const entry = grouped.get(dateKey) || { dateKey, count: 0, latestMovedAt: "" };
    entry.count += 1;
    const movedAt = extractBusinessLastMovedAt(business)?.toISOString() || "";
    if (movedAt && (!entry.latestMovedAt || movedAt > entry.latestMovedAt)) entry.latestMovedAt = movedAt;
    grouped.set(dateKey, entry);
  });
  for (const entry of grouped.values()) {
    const existing = await readStateDoc(CRM_LIVE_DAILY_ROLLUPS_COLLECTION, entry.dateKey);
    const previousCount = safeNumber(existing?.data?.count || 0);
    await writeStateDoc({
      collection: CRM_LIVE_DAILY_ROLLUPS_COLLECTION,
      docId: entry.dateKey,
      data: {
        dateKey: entry.dateKey,
        teveVenda: true,
        count: previousCount + entry.count,
        lastSaleAt: entry.latestMovedAt || null,
        updatedAt: new Date(),
      },
      updateMaskPaths: ["dateKey", "teveVenda", "count", "lastSaleAt", "updatedAt"],
    });
  }
};

const loadWeeklyRollupsHistory = async ({ limit = 32 } = {}) => {
  const rows = await listCollectionAsAdmin(CRM_LIVE_WEEKLY_ROLLUPS_COLLECTION, { pageSize: Math.max(10, Number(limit) || 32) }).catch(() => []);
  return rows
    .map((row) => ({
      weekKey: safeString(row.weekKey || row.firestoreDocId || row.id),
      updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : safeString(row.updatedAt),
      leaders: row.leaders && typeof row.leaders === "object" ? row.leaders : {},
      team: row.team && typeof row.team === "object" ? row.team : {},
      peopleProgress: row.peopleProgress && typeof row.peopleProgress === "object" ? row.peopleProgress : {},
    }))
    .filter((row) => row.weekKey)
    .sort((left, right) => safeString(right.weekKey).localeCompare(safeString(left.weekKey), "pt-BR"));
};

const writeWeeklyRollup = async ({ weeklyReadModel, weekTeamSummary, now = new Date() } = {}) => {
  const weekKey = safeString(weeklyReadModel?.commercialWeek?.weekKey);
  if (!weekKey) return { ok: false, skipped: true };
  const closers = Array.isArray(weeklyReadModel?.progress?.closers) ? weeklyReadModel.progress.closers : [];
  const sdrs = Array.isArray(weeklyReadModel?.progress?.sdrs) ? weeklyReadModel.progress.sdrs : [];
  const data = {
    weekKey,
    updatedAt: now,
    leaders: {
      closers: closers[0]
        ? {
            personId: safeString(closers[0].personId),
            displayName: safeString(closers[0].displayName),
            progressPct: safeNumber(closers[0].progressPct),
            actualValue: safeNumber(closers[0].actualValue),
            targetValue: safeNumber(closers[0].targetValue),
          }
        : null,
      sdrs: sdrs[0]
        ? {
            personId: safeString(sdrs[0].personId),
            displayName: safeString(sdrs[0].displayName),
            progressPct: safeNumber(sdrs[0].progressPct),
            actualValue: safeNumber(sdrs[0].actualValue),
            targetValue: safeNumber(sdrs[0].targetValue),
          }
        : null,
    },
    team: {
      closers: {
        actualValue: safeNumber(weekTeamSummary?.closers?.actualValue),
        targetValue: safeNumber(weekTeamSummary?.closers?.targetValue),
        progressPct: safeNumber(weekTeamSummary?.closers?.progressPct),
      },
      sdrs: {
        actualValue: safeNumber(weekTeamSummary?.sdrs?.actualValue),
        targetValue: safeNumber(weekTeamSummary?.sdrs?.targetValue),
        progressPct: safeNumber(weekTeamSummary?.sdrs?.progressPct),
      },
    },
    peopleProgress: {
      closers: closers.map((row) => ({
        personId: safeString(row.personId),
        displayName: safeString(row.displayName),
        actualValue: safeNumber(row.actualValue),
        targetValue: safeNumber(row.targetValue),
        progressPct: safeNumber(row.progressPct),
      })),
      sdrs: sdrs.map((row) => ({
        personId: safeString(row.personId),
        displayName: safeString(row.displayName),
        actualValue: safeNumber(row.actualValue),
        targetValue: safeNumber(row.targetValue),
        progressPct: safeNumber(row.progressPct),
      })),
    },
  };
  return writeStateDoc({
    collection: CRM_LIVE_WEEKLY_ROLLUPS_COLLECTION,
    docId: weekKey,
    data,
    updateMaskPaths: ["weekKey", "updatedAt", "leaders", "team", "peopleProgress"],
  });
};

const buildCrmLiveReadCookie = ({ tokenId } = {}) => {
  const now = Math.floor(Date.now() / 1000);
  return signJwt({
    scope: CRM_LIVE_COOKIE_SCOPE,
    tokenId: safeString(tokenId),
    iat: now,
    exp: now + CRM_LIVE_COOKIE_MAX_AGE_SECONDS,
  });
};

const parseCrmLiveReadCookie = (req) => {
  const cookies = parseCookies(req);
  const raw = cookies[CRM_LIVE_COOKIE_NAME];
  if (!raw) return null;
  const payload = verifyJwt(raw);
  if (!payload || payload.scope !== CRM_LIVE_COOKIE_SCOPE || !safeString(payload.tokenId)) return null;
  return payload;
};

const parseEntryToken = (rawToken) => {
  const raw = safeString(rawToken);
  const dot = raw.indexOf(".");
  if (dot <= 0 || dot >= raw.length - 1) return null;
  return { tokenId: raw.slice(0, dot), secret: raw.slice(dot + 1) };
};

const validateEntryToken = async (rawToken) => {
  const parsed = parseEntryToken(rawToken);
  if (!parsed) return { ok: false, error: "invalid_token_format", status: 401 };
  try {
    const doc = await getDocumentAsAdmin(`${CRM_LIVE_ACCESS_COLLECTION}/${encodeURIComponent(parsed.tokenId)}`);
    const active = doc?.active !== false && !doc?.revokedAt;
    const expiresAt = safeString(doc?.expiresAt);
    const expired = expiresAt ? Date.parse(expiresAt) < Date.now() : false;
    if (!active || expired) return { ok: false, error: "token_revoked", status: 401 };
    if (safeString(doc?.secretHash) !== hashSecret(parsed.secret)) return { ok: false, error: "invalid_token", status: 401 };
    await writeDocAsAdmin({
      docPath: `${CRM_LIVE_ACCESS_COLLECTION}/${encodeURIComponent(parsed.tokenId)}`,
      data: { lastUsedAt: new Date() },
      updateMaskPaths: ["lastUsedAt"],
    }).catch(() => {});
    return { ok: true, tokenId: parsed.tokenId, doc };
  } catch (error) {
    if (Number(error?.status) === 404) return { ok: false, error: "token_not_found", status: 401 };
    throw error;
  }
};

const validateCookieViewer = async (req) => {
  const payload = parseCrmLiveReadCookie(req);
  if (!payload) return { ok: false, error: "missing_cookie", status: 401 };
  try {
    const doc = await getDocumentAsAdmin(`${CRM_LIVE_ACCESS_COLLECTION}/${encodeURIComponent(payload.tokenId)}`);
    const active = doc?.active !== false && !doc?.revokedAt;
    const expiresAt = safeString(doc?.expiresAt);
    const expired = expiresAt ? Date.parse(expiresAt) < Date.now() : false;
    if (!active || expired) return { ok: false, error: "token_revoked", status: 401 };
    return { ok: true, tokenId: payload.tokenId, doc };
  } catch (error) {
    if (Number(error?.status) === 404) return { ok: false, error: "token_not_found", status: 401 };
    throw error;
  }
};

const createAccessTokenRecord = async ({ label = "", expiresAt = "" } = {}) => {
  const tokenId = `tv_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
  const secret = crypto.randomBytes(24).toString("hex");
  const now = new Date();
  const data = {
    label: safeString(label) || "CRM Live TV",
    active: true,
    secretHash: hashSecret(secret),
    createdAt: now,
    updatedAt: now,
    revokedAt: null,
    lastUsedAt: null,
    expiresAt: safeString(expiresAt) || null,
  };
  const write = await writeDocAsAdmin({
    docPath: `${CRM_LIVE_ACCESS_COLLECTION}/${encodeURIComponent(tokenId)}`,
    data,
    updateMaskPaths: Object.keys(data),
  });
  if (!write?.ok) {
    const error = new Error("crm_live_token_create_failed");
    error.code = "crm_live_token_create_failed";
    error.status = write?.status || 500;
    error.details = write?.data || write?.text || null;
    throw error;
  }
  return {
    tokenId,
    token: `${tokenId}.${secret}`,
    data,
  };
};

const listAccessTokens = async () => {
  const rows = await listCollectionAsAdmin(CRM_LIVE_ACCESS_COLLECTION, { pageSize: 200 });
  return rows.map((row) => ({
    tokenId: safeString(row.firestoreDocId || row.id),
    label: safeString(row.label),
    active: row.active !== false && !row.revokedAt,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : safeString(row.createdAt),
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : safeString(row.updatedAt),
    expiresAt: row.expiresAt instanceof Date ? row.expiresAt.toISOString() : safeString(row.expiresAt),
    revokedAt: row.revokedAt instanceof Date ? row.revokedAt.toISOString() : safeString(row.revokedAt),
    lastUsedAt: row.lastUsedAt instanceof Date ? row.lastUsedAt.toISOString() : safeString(row.lastUsedAt),
  }));
};

const revokeAccessToken = async ({ tokenId } = {}) => {
  const id = safeString(tokenId);
  if (!id) throw new Error("missing_token_id");
  const now = new Date();
  const write = await writeDocAsAdmin({
    docPath: `${CRM_LIVE_ACCESS_COLLECTION}/${encodeURIComponent(id)}`,
    data: { active: false, revokedAt: now, updatedAt: now },
    updateMaskPaths: ["active", "revokedAt", "updatedAt"],
  });
  if (!write?.ok) {
    const error = new Error("crm_live_token_revoke_failed");
    error.code = "crm_live_token_revoke_failed";
    error.status = write?.status || 500;
    error.details = write?.data || write?.text || null;
    throw error;
  }
  return { ok: true };
};

module.exports = {
  CRM_LIVE_ACCESS_COLLECTION,
  CRM_LIVE_CACHE_COLLECTION,
  CRM_LIVE_DAILY_ROLLUPS_COLLECTION,
  CRM_LIVE_EVENTS_COLLECTION,
  CRM_LIVE_WEEKLY_ROLLUPS_COLLECTION,
  CRM_LIVE_COOKIE_NAME,
  CRM_LIVE_COOKIE_MAX_AGE_SECONDS,
  buildCrmLiveEventQueue,
  buildWeeklyProjection,
  buildWeeklyNewsScreens,
  decorateLeaderboardComparisons,
  buildCookie,
  buildCrmLiveCrmSlice,
  buildCrmLivePayload,
  buildCrmLiveReadCookie,
  buildCrmLiveSdrSlice,
  buildWeeklyTeamSummary,
  loadCurrentGoal,
  loadGoalByMonthKey,
  loadGrowthPeople,
  loadCrmLiveDefaultsConfig,
  loadSdrEventsRange,
  loadWeeklyRollupsHistory,
  clearCookie,
  createAccessTokenRecord,
  fetchCrmBusinesses,
  listAccessTokens,
  parseCrmLiveReadCookie,
  readCacheDoc,
  readStateDoc,
  revokeAccessToken,
  validateCookieViewer,
  validateEntryToken,
  writeDailyRollups,
  writeWeeklyRollup,
  writeCacheDoc,
  writeStateDoc,
  getCacheMeta,
  isSecureRequest,
  CRM_CACHE_TTL_MS,
  SDR_CACHE_TTL_MS,
};
