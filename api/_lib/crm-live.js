const crypto = require("crypto");

const { getGoogleAccessToken } = require("../../_lib/google-service-account");
const { requestJson, FIRESTORE_BASE, API_KEY, PROJECT_ID, encodeFields, decodeFields, getDocIdFromName } = require("../../_lib/firestore-rest");
const { getDocumentAsAdmin, listCollectionAsAdmin, queryCollectionByDateRangeAsAdmin, commitWritesAsAdmin } = require("./firestore-admin");
const { signJwt, verifyJwt, parseCookies, isSecureRequest } = require("./session");
const { resolveCommercialPeriod, formatSaoPauloDateKey, getCalendarMonthBounds } = require("./commercial-period");
const { buildWeeklyGoalsReadModel, decodeGrowthPeopleDoc, decodeWeeklyGoalsMap, resolveCommercialWeek, extractCrmAttendantId, buildGrowthPeopleIndexes } = require("./growth-people");
const { getDealValue, normalizeKey } = require("../../_lib/forecast-service");

const DATASTORE_SCOPE = "https://www.googleapis.com/auth/datastore";
const GOALS_COLLECTION = "growthGoals";
const GROWTH_PEOPLE_COLLECTION = "growthPeople";
const SDR_ACTIVITY_COLLECTION = "sdrActivityEvents";
const CRM_LIVE_CACHE_COLLECTION = "crmLiveCache";
const CRM_LIVE_ACCESS_COLLECTION = "crmLiveAccessTokens";
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
const buildCookie = (name, value, { maxAgeSeconds = CRM_LIVE_COOKIE_MAX_AGE_SECONDS, secure = false, path = "/tv/crm-live" } = {}) => {
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
const clearCookie = ({ secure = false, path = "/tv/crm-live" } = {}) => buildCookie(CRM_LIVE_COOKIE_NAME, "", { maxAgeSeconds: 0, secure, path });

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
    weeklyGoals: decodeWeeklyGoalsMap(fields.weeklyGoals),
  };
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
  return docs
    .map((row) => decodeGrowthPeopleDoc({ name: `${GROWTH_PEOPLE_COLLECTION}/${encodeURIComponent(row.firestoreDocId || row.id)}`, fields: encodeFields(row).fields }))
    .filter(Boolean)
    .filter((row) => row.active !== false);
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

const fetchCrmWindow = async ({ startDateKey } = {}) => {
  const apiKey = safeString(process.env.CRM_API_KEY);
  const base = safeString(process.env.CRM_API_BASE_URL).replace(/\/+$/, "");
  if (!apiKey || !base) {
    const error = new Error("missing_crm_env");
    error.status = 500;
    throw error;
  }
  const lastMovedAfter = formatDateKeyStartIso(startDateKey);
  const take = 200;
  let skip = 0;
  let pages = 0;
  const businesses = [];
  const startedAt = Date.now();

  while (pages < 200) {
    const params = new URLSearchParams();
    params.set("skip", String(skip));
    params.set("take", String(take));
    params.set("filter[lastMovedAfter]", lastMovedAfter);
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
      lastMovedAfter,
    },
  };
};

const choosePipelineKey = (businesses = []) => {
  const preferred = normalizeKey("Funil principal");
  const hasPreferred = businesses.some((business) => normalizeKey(extractPipelineName(business)) === preferred);
  return hasPreferred ? preferred : CONVERSION_PIPELINE_FALLBACK_KEY;
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
      totalVendas: closed.length,
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
  const closersTarget = closerRows.reduce((sum, row) => sum + safeNumber(row.targetValue), 0);
  const closersActual = closerRows.reduce((sum, row) => sum + safeNumber(row.actualValue), 0);
  const sdrTarget = sdrRows.reduce((sum, row) => sum + safeNumber(row.targetValue), 0);
  const sdrActual = sdrRows.reduce((sum, row) => sum + safeNumber(row.actualValue), 0);
  return {
    closers: {
      targetValue: closersTarget,
      actualValue: closersActual,
      progressPct: closersTarget > 0 ? (closersActual / closersTarget) * 100 : 0,
    },
    sdrs: {
      targetValue: sdrTarget,
      actualValue: sdrActual,
      progressPct: sdrTarget > 0 ? (sdrActual / sdrTarget) * 100 : 0,
    },
  };
};

const buildPreviousDayHighlights = ({ goal, people, businesses = [], sdrEvents = [], now = new Date() } = {}) => {
  const previousDay = new Date(now instanceof Date ? now.getTime() : Date.now());
  previousDay.setDate(previousDay.getDate() - 1);
  const weekForPreviousDay = resolveCommercialWeek({ now: previousDay });
  const weeklyReadModel = buildWeeklyGoalsReadModel({ goal, people, businesses, sdrEvents, now: previousDay });
  const indexes = buildGrowthPeopleIndexes(people);
  const previousDayKey = formatSaoPauloDateKey(previousDay);
  const pipelineKey = choosePipelineKey(businesses);

  const closerDaily = new Map();
  filterWindowBusinesses({ businesses, period: { startDateKey: previousDayKey, endDateKey: previousDayKey } })
    .filter((business) => normalizeKey(extractPipelineName(business)) === pipelineKey)
    .filter((business) => normalizeKey(extractStageName(business)) === CLOSED_STAGE_KEY)
    .forEach((business) => {
      const attendantId = extractCrmAttendantId(business);
      const attendantName = extractBusinessAttendantName(business);
      const normalizedName = attendantName
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
      const resolved =
        (attendantId && indexes.byCrmAttendantId.get(attendantId)) ||
        (normalizedName && indexes.byCrmAlias.get(normalizedName)) ||
        "";
      const row = Array.isArray(weeklyReadModel?.progress?.closers)
        ? weeklyReadModel.progress.closers.find((entry) => entry.personId && entry.personId === resolved)
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

const buildUnresolvedBuckets = ({ businesses = [], people = [], goal, sdrEvents = [], now = new Date() } = {}) => {
  const weekly = buildWeeklyGoalsReadModel({ goal, people, businesses, sdrEvents, now });
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

const buildCrmLiveCrmSlice = async ({ goal, people, now = new Date() } = {}) => {
  const monthPeriod = resolveCommercialPeriod({
    now,
    periodStart: safeString(goal?.periodStart),
    periodEnd: safeString(goal?.periodEnd),
  });
  const crm = await fetchCrmWindow({ startDateKey: monthPeriod.startDateKey });
  const monthSummary = buildMonthSummary({ businesses: crm.businesses, goal, now });
  const weeklyReadModel = buildWeeklyGoalsReadModel({
    goal,
    people,
    businesses: crm.businesses,
    sdrEvents: [],
    now,
  });
  const highlights = buildPreviousDayHighlights({
    goal,
    people,
    businesses: crm.businesses,
    sdrEvents: [],
    now,
  });
  const unresolved = buildUnresolvedBuckets({
    businesses: crm.businesses,
    people,
    goal,
    sdrEvents: [],
    now,
  });
  return {
    generatedAt: new Date().toISOString(),
    month: monthSummary,
    weekly: {
      commercialWeek: weeklyReadModel.commercialWeek,
      team: {
        closers: buildWeeklyTeamSummary({ weeklyReadModel }).closers,
      },
      closers: weeklyReadModel.progress.closers || [],
    },
    highlights: {
      dayKey: highlights.dayKey,
      weekKey: highlights.weekKey,
      closer: highlights.closer,
    },
    latestSale: monthSummary.latestSale,
    unresolved: {
      missingResponsible: unresolved.missingResponsible,
      unknownResponsible: unresolved.unknownResponsible,
    },
    cacheDebug: {
      crm: crm.pagination,
    },
  };
};

const buildCrmLiveSdrSlice = async ({ goal, people, now = new Date() } = {}) => {
  const sdrWeek = resolveCommercialWeek({ now });
  const yesterdayKey = formatSaoPauloDateKey(new Date(now.getTime() - 86400000));
  const sdrFromKey = sdrWeek.startDateKey < yesterdayKey ? sdrWeek.startDateKey : yesterdayKey;
  const sdrEvents = await loadSdrEventsRange({ fromKey: sdrFromKey, toKey: sdrWeek.endDateKey });
  const weeklyReadModel = buildWeeklyGoalsReadModel({
    goal,
    people,
    businesses: [],
    sdrEvents,
    now,
  });
  const highlights = buildPreviousDayHighlights({
    goal,
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
      },
    },
  };
};

const buildCrmLivePayload = async ({ now = new Date() } = {}) => {
  const goal = await loadCurrentGoal({ now });
  const people = await loadGrowthPeople();
  const [crm, sdr] = await Promise.all([
    buildCrmLiveCrmSlice({ goal, people, now }),
    buildCrmLiveSdrSlice({ goal, people, now }),
  ]);
  return {
    generatedAt: new Date().toISOString(),
    month: crm.month,
    weekly: {
      commercialWeek: crm.weekly.commercialWeek || sdr.weekly.commercialWeek,
      team: {
        closers: crm.weekly.team.closers,
        sdrs: sdr.weekly.team.sdrs,
      },
      closers: crm.weekly.closers,
      sdrs: sdr.weekly.sdrs,
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
  CRM_LIVE_COOKIE_NAME,
  CRM_LIVE_COOKIE_MAX_AGE_SECONDS,
  buildCookie,
  buildCrmLiveCrmSlice,
  buildCrmLivePayload,
  buildCrmLiveReadCookie,
  buildCrmLiveSdrSlice,
  loadCurrentGoal,
  loadGrowthPeople,
  clearCookie,
  createAccessTokenRecord,
  listAccessTokens,
  parseCrmLiveReadCookie,
  readCacheDoc,
  revokeAccessToken,
  validateCookieViewer,
  validateEntryToken,
  writeCacheDoc,
  getCacheMeta,
  isSecureRequest,
  CRM_CACHE_TTL_MS,
  SDR_CACHE_TTL_MS,
};
