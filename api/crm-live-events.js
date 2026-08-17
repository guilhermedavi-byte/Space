const { sendJson } = require("../_lib/http");
const { getSessionFromRequest } = require("../_lib/session");
const { resolveCommercialPeriod } = require("./_lib/commercial-period");
const { buildWeeklyGoalsReadModel } = require("./_lib/growth-people");
const {
  CRM_LIVE_EVENTS_COLLECTION,
  buildCrmLiveEventQueue,
  buildWeeklyTeamSummary,
  fetchCrmBusinesses,
  loadCurrentGoal,
  loadCrmLiveDefaultsConfig,
  loadGrowthPeople,
  loadSdrEventsRange,
  writeWeeklyRollup,
  readStateDoc,
  validateCookieViewer,
  writeDailyRollups,
  writeStateDoc,
} = require("./_lib/crm-live");

const DETECTOR_DOC_ID = "detector";
const EVENT_QUEUE_DURATION_MS = 20_000;

const normalizeRole = (value) => {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "admin" || raw === "administrador") return "admin";
  if (raw === "growth") return "growth";
  if (["comercial", "closer", "sales"].includes(raw)) return "commercial";
  return "";
};

const canReadViaSession = (req) => {
  const session = getSessionFromRequest(req);
  const role = normalizeRole(session?.role);
  if (role === "admin" || role === "growth" || role === "commercial") return { ok: true, mode: "session", session };
  return null;
};

const canReadCrmLive = async (req) => {
  const bySession = canReadViaSession(req);
  if (bySession) return bySession;
  const byCookie = await validateCookieViewer(req);
  if (byCookie.ok) return { ok: true, mode: "tv", tokenId: byCookie.tokenId };
  return { ok: false, status: byCookie.status || 401, error: byCookie.error || "unauthorized" };
};

const safeNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const buildMonthSummaryForDetector = ({ businesses = [], goal = null, period }) => {
  const filtered = (Array.isArray(businesses) ? businesses : []).filter((business) => {
    const movedAt = business?.lastMovedAt ? new Date(String(business.lastMovedAt)) : null;
    if (!movedAt || Number.isNaN(movedAt.getTime())) return false;
    const key = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(movedAt);
    return key >= period.startDateKey && key <= period.endDateKey;
  });
  const realized = filtered.reduce((sum, business) => {
    const raw = Number(business?.total ?? business?.value);
    if (Number.isFinite(raw) && raw > 0) return sum + raw;
    return sum;
  }, 0);
  const meta = safeNumber(goal?.valorMeta);
  return {
    summary: {
      meta,
      realizado: realized,
      gap: meta > 0 ? Math.max(0, meta - realized) : 0,
    },
  };
};

module.exports = async (req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    return sendJson(res, 405, { error: "method_not_allowed" });
  }

  const auth = await canReadCrmLive(req);
  if (!auth?.ok) return sendJson(res, auth?.status || 401, { error: auth?.error || "unauthorized" });

  try {
    const now = new Date();
    const [goal, globalConfig, people, detectorStateSnap] = await Promise.all([
      loadCurrentGoal({ now }),
      loadCrmLiveDefaultsConfig(),
      loadGrowthPeople(),
      readStateDoc(CRM_LIVE_EVENTS_COLLECTION, DETECTOR_DOC_ID),
    ]);

    const monthPeriod = resolveCommercialPeriod({
      now,
      periodStart: String(goal?.periodStart || ""),
      periodEnd: String(goal?.periodEnd || ""),
    });

    const previousState = detectorStateSnap.ok ? detectorStateSnap.data : null;
    const cursor = String(previousState?.cursor || "").trim();

    const [wonMonth, wonSinceCursor] = await Promise.all([
      fetchCrmBusinesses({ startDateKey: monthPeriod.startDateKey, status: "won" }),
      fetchCrmBusinesses({
        startDateKey: monthPeriod.startDateKey,
        lastMovedAfter: cursor,
        status: "won",
      }),
    ]);

    const weeklyProbe = buildWeeklyGoalsReadModel({
      goal,
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
      goal,
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

    const detection = buildCrmLiveEventQueue({
      previousState,
      weeklyReadModel,
      weekTeamSummary: team,
      freshWonBusinesses: wonSinceCursor.businesses,
      monthSummary,
      now,
    });

    await writeStateDoc({
      collection: CRM_LIVE_EVENTS_COLLECTION,
      docId: DETECTOR_DOC_ID,
      data: detection.nextState,
      updateMaskPaths: ["cursor", "initializedAt", "updatedAt", "lastLeaders", "currentWeek", "announcedSaleIds"],
    });

    await writeWeeklyRollup({
      weeklyReadModel,
      weekTeamSummary: team,
      now,
    }).catch((error) => {
      console.warn("[crm-live-events] weekly rollup write failed", error);
    });

    if (!detection.coldStart && detection.newSales.length) {
      await writeDailyRollups({ sales: detection.newSales });
    }

    return sendJson(res, 200, {
      ok: true,
      coldStart: detection.coldStart,
      weekRolled: detection.weekRolled,
      generatedAt: now.toISOString(),
      queueDurationMs: EVENT_QUEUE_DURATION_MS,
      events: detection.events,
      debug: {
        cursorUsed: cursor || null,
        freshWonFetched: wonSinceCursor.pagination?.totalFetched || 0,
        monthWonFetched: wonMonth.pagination?.totalFetched || 0,
      },
    });
  } catch (error) {
    console.error("[crm-live-events] detector failed", error);
    return sendJson(res, error?.status || 500, {
      error: error?.code || error?.error || "crm_live_events_failed",
      message: error?.message || "Não foi possível processar as interrupções do CRM Live agora.",
    });
  }
};
