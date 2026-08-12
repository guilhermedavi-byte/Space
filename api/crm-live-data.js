const { sendJson } = require("../_lib/http");
const { getSessionFromRequest } = require("../_lib/session");
const {
  buildCrmLiveCrmSlice,
  buildCrmLiveSdrSlice,
  buildWeeklyNewsScreens,
  decorateLeaderboardComparisons,
  validateCookieViewer,
  readCacheDoc,
  writeCacheDoc,
  getCacheMeta,
  CRM_CACHE_TTL_MS,
  SDR_CACHE_TTL_MS,
  loadWeeklyRollupsHistory,
  loadCurrentGoal,
  loadGrowthPeople,
} = require("./_lib/crm-live");

const normalizeRole = (value) => {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "admin" || raw === "administrador") return "admin";
  if (raw === "growth") return "growth";
  return "";
};

const CRM_CACHE_DOC_ID = "crm";
const SDR_CACHE_DOC_ID = "sdr";

const canReadViaSession = (req) => {
  const session = getSessionFromRequest(req);
  const role = normalizeRole(session?.role);
  if (role === "admin" || role === "growth") return { ok: true, mode: "session", session };
  return null;
};

const canReadCrmLive = async (req) => {
  const bySession = canReadViaSession(req);
  if (bySession) return bySession;
  const byCookie = await validateCookieViewer(req);
  if (byCookie.ok) return { ok: true, mode: "tv", tokenId: byCookie.tokenId };
  return { ok: false, status: byCookie.status || 401, error: byCookie.error || "unauthorized" };
};

module.exports = async (req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    return sendJson(res, 405, { error: "method_not_allowed" });
  }

  const auth = await canReadCrmLive(req);
  if (!auth?.ok) return sendJson(res, auth?.status || 401, { error: auth?.error || "unauthorized" });

  const host = String(req.headers.host || "localhost");
  const url = new URL(req.url || "/api/crm-live-data", `https://${host}`);
  const forceRefresh = String(url.searchParams.get("refresh") || "").trim() === "1";
  const now = new Date();

  const loadSlice = async ({ cacheDocId, ttlMs, build }) => {
    let cached = null;
    let meta = null;
    try {
      const snap = await readCacheDoc(cacheDocId);
      if (snap.ok && snap.data?.payload) {
        cached = snap.data;
        meta = getCacheMeta(cached);
        if (!forceRefresh && meta.ageMs <= ttlMs) {
          return { payload: cached.payload, meta, cached: true, stale: false };
        }
      }
    } catch (error) {
      console.warn("[crm-live] cache read failed", cacheDocId, error);
    }

    try {
      const payload = await build();
      const generatedAt = new Date().toISOString();
      await writeCacheDoc({ docId: cacheDocId, payload, generatedAt }).catch((error) => {
        console.warn("[crm-live] cache write failed", cacheDocId, error);
      });
      return { payload, meta: { generatedAt, ageMs: 0, ageMinutes: 0 }, cached: false, stale: false };
    } catch (error) {
      console.error("[crm-live] slice build failed", cacheDocId, error);
      if (cached?.payload && meta) {
        return { payload: cached.payload, meta, cached: true, stale: true };
      }
      throw error;
    }
  };

  try {
    const [goal, people] = await Promise.all([loadCurrentGoal({ now }), loadGrowthPeople()]);
    const [crmSlice, sdrSlice] = await Promise.all([
      loadSlice({
        cacheDocId: CRM_CACHE_DOC_ID,
        ttlMs: CRM_CACHE_TTL_MS,
        build: () => buildCrmLiveCrmSlice({ goal, people, now }),
      }),
      loadSlice({
        cacheDocId: SDR_CACHE_DOC_ID,
        ttlMs: SDR_CACHE_TTL_MS,
        build: () => buildCrmLiveSdrSlice({ goal, people, now }),
      }),
    ]);

    const closers = decorateLeaderboardComparisons({
      rows: crmSlice.payload.weekly?.closers || [],
      discrete: false,
    });
    const sdrs = decorateLeaderboardComparisons({
      rows: sdrSlice.payload.weekly?.sdrs || [],
      discrete: true,
    });
    const weekKey = crmSlice.payload.weekly?.commercialWeek?.weekKey || sdrSlice.payload.weekly?.commercialWeek?.weekKey || "";
    const weeklyRollups = await loadWeeklyRollupsHistory({ limit: 32 });
    const news = buildWeeklyNewsScreens({
      month: crmSlice.payload.month,
      weekly: {
        commercialWeek: crmSlice.payload.weekly?.commercialWeek || sdrSlice.payload.weekly?.commercialWeek,
        team: {
          closers: crmSlice.payload.weekly?.team?.closers || { targetValue: 0, actualValue: 0, progressPct: 0 },
          sdrs: sdrSlice.payload.weekly?.team?.sdrs || { targetValue: 0, actualValue: 0, progressPct: 0 },
        },
        closers,
        sdrs,
      },
      previousMonthComparison: crmSlice.payload.monthComparison || null,
      weeklyRollups: weeklyRollups.filter((row) => row.weekKey !== weekKey),
      now,
    });

    const stale = Boolean(crmSlice.stale || sdrSlice.stale);
    const staleAgeMinutes = Math.max(Number(crmSlice.meta?.ageMinutes || 0), Number(sdrSlice.meta?.ageMinutes || 0));
    return sendJson(res, 200, {
      month: crmSlice.payload.month,
      news,
      weekly: {
        commercialWeek: crmSlice.payload.weekly?.commercialWeek || sdrSlice.payload.weekly?.commercialWeek,
        team: {
          closers: crmSlice.payload.weekly?.team?.closers || { targetValue: 0, actualValue: 0, progressPct: 0 },
          sdrs: sdrSlice.payload.weekly?.team?.sdrs || { targetValue: 0, actualValue: 0, progressPct: 0 },
        },
        closers,
        sdrs,
      },
      highlights: {
        dayKey: crmSlice.payload.highlights?.dayKey || sdrSlice.payload.highlights?.dayKey || "",
        weekKey: crmSlice.payload.highlights?.weekKey || sdrSlice.payload.highlights?.weekKey || "",
        closer: crmSlice.payload.highlights?.closer || null,
        sdr: sdrSlice.payload.highlights?.sdr || null,
      },
      latestSale: crmSlice.payload.latestSale || null,
      unresolved: {
        missingResponsible: crmSlice.payload.unresolved?.missingResponsible || [],
        unknownResponsible: crmSlice.payload.unresolved?.unknownResponsible || [],
        sdrActors: sdrSlice.payload.unresolved?.sdrActors || [],
      },
      cacheDebug: {
        crm: crmSlice.payload.cacheDebug?.crm || null,
        sdr: sdrSlice.payload.cacheDebug?.sdr || null,
      },
      generatedAt: new Date().toISOString(),
      stale,
      cached: Boolean(crmSlice.cached || sdrSlice.cached),
      staleAgeMinutes,
    });
  } catch (error) {
    console.error("[crm-live] top-level payload failed", error);
    return sendJson(res, error?.status || 500, {
      error: error?.error || error?.code || "crm_live_payload_failed",
      message:
        error?.status === 401
          ? "Acesso CRM Live não autorizado."
          : error?.message
            ? String(error.message)
            : "Não foi possível montar o payload do CRM Live agora.",
    });
  }
};
