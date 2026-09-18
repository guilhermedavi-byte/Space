const crypto = require("crypto");

const { createFirestoreStore } = require("./crm-snapshot-store");
const { runCrmSnapshot } = require("./crm-snapshot-publish");
const {
  CRM_LIVE_EVENTS_COLLECTION,
  buildCrmLiveCrmSlice,
  buildCrmLiveEventQueue,
  buildCrmLiveSdrSlice,
  buildWeeklyTeamSummary,
  fetchCrmBusinesses,
  loadApplicableWeeklyGoal,
  loadCrmLiveDefaultsConfig,
  loadCurrentGoal,
  loadGrowthPeople,
  loadSdrEventsRange,
  readStateDoc,
  writeCacheDoc,
  writeStateDoc,
  writeWeeklyRollup,
} = require("./crm-live");
const { resolveCommercialPeriod } = require("./commercial-period");
const { buildWeeklyGoalsReadModel } = require("./growth-people");
const { summarizeClosedSales } = require("./commercial-sales");
const { log } = require("./datacrazy-ingestion");

const REFRESH_STATE_PATH = "crmLiveRefresh/state";
const DETECTOR_DOC_ID = "detector";
const EVENT_QUEUE_DURATION_MS = 20_000;
const REFRESH_LEASE_MS = 260_000;

const safeNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const buildMonthSummaryForDetector = ({ businesses = [], goal = null, period }) => {
  const realized = summarizeClosedSales({ businesses, period }).actualValue;
  const meta = safeNumber(goal?.valorMeta);
  return {
    summary: {
      meta,
      realizado: realized,
      gap: meta > 0 ? Math.max(0, meta - realized) : 0,
    },
  };
};

const acquireRefreshLease = async ({ store, nowMs, owner }) => {
  const prior = await store.read(REFRESH_STATE_PATH);
  const state = prior?.data || {};
  const leaseUntil = Number(state.leaseUntil || 0);
  if (leaseUntil > nowMs) {
    return { ok: false, state, retryAfterMs: leaseUntil - nowMs };
  }
  const runId = crypto.randomUUID();
  const next = {
    ...state,
    status: "REFRESHING",
    runId,
    owner,
    leaseUntil: nowMs + REFRESH_LEASE_MS,
    lastStartedAt: new Date(nowMs).toISOString(),
  };
  const [version] = await store.commit([{ path: REFRESH_STATE_PATH, data: next, version: prior?.version ?? null }]);
  return { ok: true, runId, version, state: next };
};

const finishRefreshLease = async ({ store, version, patch }) => {
  const current = await store.read(REFRESH_STATE_PATH);
  const data = current?.data || {};
  await store.commit([
    {
      path: REFRESH_STATE_PATH,
      data: {
        ...data,
        ...patch,
        leaseUntil: 0,
        finishedAt: new Date().toISOString(),
      },
      version: version || current?.version,
    },
  ]);
};

const refreshCrmLiveEvents = async ({ goal, globalConfig, people, now }) => {
  const weeklyGoal = await loadApplicableWeeklyGoal({ goal, now });
  const monthPeriod = resolveCommercialPeriod({
    now,
    periodStart: String(goal?.periodStart || ""),
    periodEnd: String(goal?.periodEnd || ""),
  });
  const detectorStateSnap = await readStateDoc(CRM_LIVE_EVENTS_COLLECTION, DETECTOR_DOC_ID);
  const previousState = detectorStateSnap.ok ? detectorStateSnap.data : null;
  const wonMonth = await fetchCrmBusinesses({ includeClosings: true });
  if (wonMonth.stale) {
    return { ok: false, stale: true, generatedAt: wonMonth.metadata.fetchCompletedAt, snapshotId: wonMonth.metadata.snapshotId };
  }
  const weeklyProbe = buildWeeklyGoalsReadModel({
    goal: weeklyGoal,
    globalConfig,
    people,
    businesses: wonMonth.businesses,
    sdrEvents: [],
    now,
  });
  const currentWeek = weeklyProbe.commercialWeek;
  const sdrEvents = await loadSdrEventsRange({
    fromKey: currentWeek.startDateKey,
    toKey: currentWeek.endDateKey,
  });
  const weeklyReadModel = buildWeeklyGoalsReadModel({
    goal: weeklyGoal,
    globalConfig,
    people,
    businesses: wonMonth.businesses,
    sdrEvents,
    now,
  });
  const team = buildWeeklyTeamSummary({ weeklyReadModel });
  const monthSummary = buildMonthSummaryForDetector({
    businesses: wonMonth.businesses,
    goal,
    period: monthPeriod,
  });
  const wonSinceCursor = { businesses: wonMonth.businesses.filter((b) => String(b.status || "") === "won"), pagination: wonMonth.pagination };
  const detection = buildCrmLiveEventQueue({
    previousState,
    weeklyReadModel,
    weekTeamSummary: team,
    freshWonBusinesses: wonSinceCursor.businesses,
    monthSummary,
    now,
  });
  const queueGeneratedAt = now.toISOString();
  await writeStateDoc({
    collection: CRM_LIVE_EVENTS_COLLECTION,
    docId: DETECTOR_DOC_ID,
    data: {
      ...detection.nextState,
      pendingEvents: detection.events,
      queueGeneratedAt,
      queueDurationMs: EVENT_QUEUE_DURATION_MS,
      lastRefreshSnapshotId: wonMonth.metadata.snapshotId || "",
      debug: {
        freshWonFetched: wonSinceCursor.pagination?.totalFetched || wonSinceCursor.businesses.length,
        monthWonFetched: wonMonth.pagination?.totalFetched || wonMonth.businesses.length,
      },
    },
    updateMaskPaths: [
      "cursor",
      "initializedAt",
      "updatedAt",
      "lastLeaders",
      "currentWeek",
      "announcedSaleIds",
      "pendingEvents",
      "queueGeneratedAt",
      "queueDurationMs",
      "lastRefreshSnapshotId",
      "debug",
    ],
  });
  await writeWeeklyRollup({ weeklyReadModel, weekTeamSummary: team, now }).catch((error) => {
    console.warn("[crm-live-refresh] weekly rollup write failed", error);
  });
  if (!detection.coldStart && detection.newSales.length) {
    await require("./crm-daily-rollups").publishDailyCounts({ businesses: wonMonth.businesses, source: wonMonth.metadata, period: monthPeriod });
  }
  return {
    ok: true,
    coldStart: detection.coldStart,
    weekRolled: detection.weekRolled,
    events: detection.events.length,
    generatedAt: queueGeneratedAt,
  };
};

const runCrmLiveRefresh = async ({ store = createFirestoreStore(), now = new Date(), owner = "crm-live-refresh" } = {}) => {
  const startedAt = Date.now();
  const lease = await acquireRefreshLease({ store, nowMs: startedAt, owner });
  if (!lease.ok) {
    return { ok: true, skipped: true, state: "locked", retryAfterMs: lease.retryAfterMs };
  }
  try {
    const [goal, globalConfig, people] = await Promise.all([loadCurrentGoal({ now }), loadCrmLiveDefaultsConfig(), loadGrowthPeople()]);
    const crmPayload = await runCrmSnapshot(
      (snapshotId) => buildCrmLiveCrmSlice({ goal, globalConfig, people, now, snapshotId, refreshSource: true, sourceAllowStale: false }),
      { store, logger: log }
    );
    const sdrPayload = crmPayload.sdrSnapshot || await buildCrmLiveSdrSlice({ goal, globalConfig, people, now });
    await writeCacheDoc({ docId: "sdr", payload: sdrPayload, generatedAt: now.toISOString() });
    const events = await refreshCrmLiveEvents({ goal, globalConfig, people, now });
    const durationMs = Date.now() - startedAt;
    await finishRefreshLease({
      store,
      version: lease.version,
      patch: {
        status: "HEALTHY",
        lastSuccessfulRefreshAt: new Date().toISOString(),
        lastSuccessSnapshotId: crmPayload?.snapshot?.snapshotId || "",
        lastFailureAt: null,
        lastError: null,
        durationMs,
      },
    });
    console.info(JSON.stringify({
      component: "crm-live-refresh",
      event: "refresh_success",
      crm_refresh_success_total: 1,
      crm_refresh_duration_ms: durationMs,
      crm_refresh_last_success_at: new Date().toISOString(),
      crm_source_records: crmPayload?.snapshot?.recordsFetched || 0,
      crm_source_pages: crmPayload?.snapshot?.pagesFetched || 0,
      crm_source_retry_count: crmPayload?.snapshot?.retryCount || 0,
      crm_source_429_count: crmPayload?.snapshot?.datacrazy429Count || 0,
      crm_incremental_records_changed: null,
      crm_full_reconciliation_differences: null,
      events,
    }));
    return { ok: true, skipped: false, durationMs, snapshotId: crmPayload?.snapshot?.snapshotId || "", events };
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    const code = error?.code || error?.message || "crm_live_refresh_failed";
    await finishRefreshLease({
      store,
      version: lease.version,
      patch: {
        status: "FAILED",
        lastFailedRefreshAt: new Date().toISOString(),
        lastFailureAt: new Date().toISOString(),
        lastError: { code, status: error?.status || 0 },
        durationMs,
      },
    }).catch(() => null);
    console.error(JSON.stringify({
      component: "crm-live-refresh",
      event: "refresh_failure",
      crm_refresh_failure_total: 1,
      crm_refresh_duration_ms: durationMs,
      crm_refresh_last_failure_at: new Date().toISOString(),
      code,
      status: error?.status || 0,
    }));
    throw error;
  }
};

module.exports = {
  DETECTOR_DOC_ID,
  EVENT_QUEUE_DURATION_MS,
  REFRESH_STATE_PATH,
  acquireRefreshLease,
  refreshCrmLiveEvents,
  runCrmLiveRefresh,
};
