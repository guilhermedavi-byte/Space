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
  CRM_LIVE_READ_MODEL_VERSION,
  loadWeeklyRollupsHistory,
  loadCurrentGoal,
  loadGrowthPeople,
  loadCrmLiveDefaultsConfig,
} = require("./_lib/crm-live");
const { runCrmSnapshot } = require('./_lib/crm-snapshot-publish');
const { resolveCommercialWeek } = require("./_lib/growth-people");
const { getCrmLiveBuildId } = require("./_lib/crm-live-build");

const normalizeRole = (value) => {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "admin" || raw === "administrador") return "admin";
  if (raw === "growth") return "growth";
  if (["comercial", "closer", "sales"].includes(raw)) return "commercial";
  return "";
};

const CRM_CACHE_DOC_ID = "crm";
const SDR_CACHE_DOC_ID = "sdr";

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

module.exports = async (req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    return sendJson(res, 405, { error: "method_not_allowed" });
  }

  const auth = await canReadCrmLive(req);
  if (!auth?.ok) return sendJson(res, auth?.status || 401, { error: auth?.error || "unauthorized" });

  const host = String(req.headers.host || "localhost");
  const buildId = getCrmLiveBuildId();
  const url = new URL(req.url || "/api/crm-live-data", `https://${host}`);
  if (url.searchParams.has('auditFrom') || url.searchParams.has('auditTo')) {
    if (auth.mode !== 'session' || !['admin', 'growth'].includes(normalizeRole(auth.session?.role))) return sendJson(res, 403, { error: 'audit_admin_required' });
    try {
      const { getCompleteCrmSource } = require('./_lib/crm-source-snapshot');
      const { auditSource } = require('./_lib/crm-source-audit');
      const source = await getCompleteCrmSource({ allowStale: false });
      const audit = auditSource(source, url.searchParams.get('auditFrom') || '', url.searchParams.get('auditTo') || '');
      const excludedByReason = {};
      audit.rows.filter(r => !r.included).forEach(r => { excludedByReason[r.reason] = (excludedByReason[r.reason] || 0) + 1; });
      const requestedPage = url.searchParams.get('auditPage');
      const page = requestedPage === null ? null : Number(requestedPage);
      if (page !== null && (!Number.isSafeInteger(page) || page < 0)) return sendJson(res, 400, { error: 'invalid_audit_page' });
      return sendJson(res, 200, { ...audit, excludedByReason, recordsTotal: audit.rows.length, page,
        rows: page === null ? audit.rows.filter(r => r.included) : audit.rows.slice(page * 200, (page + 1) * 200) });
    } catch (error) { return sendJson(res, error.status || 503, { error: error.code || 'audit_failed' }); }
  }
  const forceRefresh = String(url.searchParams.get("refresh") || "").trim() === "1";
  const now = new Date();
  const currentWeekKey = resolveCommercialWeek({ now }).weekKey;

  const loadSlice = async ({ cacheDocId, ttlMs, build }) => {
    let cached = null;
    let meta = null;
    try {
      const snap = await readCacheDoc(cacheDocId);
      if (snap.ok && snap.data?.payload) {
        cached = snap.data;
        meta = getCacheMeta(cached);
        const cachedWeekKey = String(cached?.payload?.weekly?.commercialWeek?.weekKey || "");
        const isCurrentWeekCache = Boolean(cachedWeekKey) && cachedWeekKey === currentWeekKey &&
          cached.payload.readModelVersion === CRM_LIVE_READ_MODEL_VERSION;
        if (!forceRefresh && isCurrentWeekCache && meta.ageMs <= ttlMs) {
          return { payload: cached.payload, meta, cached: true, stale: false };
        }
        // Retain old calculation versions as explicitly stale within the same week.
        // Do not combine last week's CRM metrics with this week's SDR metrics.
        if (cachedWeekKey !== currentWeekKey) { cached = null; meta = null; }
      }
    } catch (error) {
      console.warn("[crm-live] cache read failed", cacheDocId, error);
    }

    try {
      const payload = cacheDocId === CRM_CACHE_DOC_ID
        ? await runCrmSnapshot((snapshotId) => build(snapshotId)) : await build();
      const generatedAt = new Date().toISOString();
      if (cacheDocId !== CRM_CACHE_DOC_ID) {
        const write = await writeCacheDoc({ docId: cacheDocId, payload, generatedAt });
        if (!write.ok) throw new Error('snapshot_write_failed');
      }
      return { payload, meta: { generatedAt, ageMs: 0, ageMinutes: 0 }, cached: false, stale: false };
    } catch (error) {
      console.error("[crm-live] slice build failed", cacheDocId, error);
      if (cached?.payload && meta) {
        return { payload: cached.payload, meta, cached: true, stale: true, lastError: { code: error.code || error.message, status: error.status || 0 } };
      }
      throw error;
    }
  };

  try {
    const [goal, globalConfig, people] = await Promise.all([loadCurrentGoal({ now }), loadCrmLiveDefaultsConfig(), loadGrowthPeople()]);
    const [crmSlice, sdrSlice] = await Promise.all([
      loadSlice({
        cacheDocId: CRM_CACHE_DOC_ID,
        ttlMs: CRM_CACHE_TTL_MS,
        build: (snapshotId) => buildCrmLiveCrmSlice({ goal, globalConfig, people, now, snapshotId }),
      }),
      loadSlice({
        cacheDocId: SDR_CACHE_DOC_ID,
        ttlMs: SDR_CACHE_TTL_MS,
        build: () => buildCrmLiveSdrSlice({ goal, globalConfig, people, now }),
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
        configSource: crmSlice.payload.weekly?.configSource || sdrSlice.payload.weekly?.configSource || "",
      },
      previousMonthComparison: crmSlice.payload.monthComparison || null,
      weeklyRollups: weeklyRollups.filter((row) => row.weekKey !== weekKey),
      now,
    });

    const sourceDate = crmSlice.payload.snapshot?.fetchCompletedAt || crmSlice.meta.generatedAt;
    const sourceAgeMs = Date.now() - Date.parse(sourceDate || '');
    const stale = Boolean(crmSlice.stale || sdrSlice.stale || !crmSlice.payload.snapshot || sourceAgeMs >= 5 * 60000);
    const snapshotQuality = { ...crmSlice.payload.snapshot, status: crmSlice.payload.snapshot?.status || 'LEGACY',
      calculationVersion: crmSlice.payload.snapshot?.calculationVersion || 0, lastCompleteAt: sourceDate || null,
      stale, lastError: crmSlice.lastError || sdrSlice.lastError || null,
      dataFreshnessLagMs: Number.isFinite(sourceAgeMs) ? Math.max(0, sourceAgeMs) : null };
    const sliceMetas = [
      { key: "crm", meta: crmSlice.meta || {}, stale: Boolean(crmSlice.stale) },
      { key: "sdr", meta: sdrSlice.meta || {}, stale: Boolean(sdrSlice.stale) },
    ];
    const staleSource = sliceMetas
      .filter((entry) => entry.stale)
      .sort((left, right) => Number(right.meta?.ageMs || 0) - Number(left.meta?.ageMs || 0))[0] || null;
    const freshestSource = sliceMetas
      .slice()
      .sort((left, right) => Date.parse(String(right.meta?.generatedAt || "")) - Date.parse(String(left.meta?.generatedAt || "")))[0] || null;
    const staleAgeMinutes = Math.max(Number(crmSlice.meta?.ageMinutes || 0), Number(sdrSlice.meta?.ageMinutes || 0));
    const snapshotGeneratedAt = stale
      ? String(staleSource?.meta?.generatedAt || freshestSource?.meta?.generatedAt || "")
      : String(freshestSource?.meta?.generatedAt || "");
    return sendJson(res, 200, {
      snapshot: snapshotQuality,
      calculationVersion: CRM_LIVE_READ_MODEL_VERSION,
      month: crmSlice.payload.month,
      news,
      pipeline: crmSlice.payload.pipeline || { rows: [], windowStartDateKey: "" },
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
      generatedAt: snapshotGeneratedAt || new Date().toISOString(),
      snapshotGeneratedAt: sourceDate || snapshotGeneratedAt || "",
      staleSource: stale ? String(staleSource?.key || "") : "",
      stale,
      cached: Boolean(crmSlice.cached || sdrSlice.cached),
      staleAgeMinutes,
      buildId,
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
