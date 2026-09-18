const { isLivePerformanceEligible } = require("./_lib/crm-live-eligibility");
const { sendJson } = require("../_lib/http");
const { getSessionFromRequest } = require("../_lib/session");
const {
  CRM_LIVE_READ_MODEL_VERSION,
  buildWeeklyNewsScreens,
  decorateLeaderboardComparisons,
  getCacheMeta,
  readCacheDoc,
  validateCookieViewer,
} = require("./_lib/crm-live");
const { getCrmLiveBuildId } = require("./_lib/crm-live-build");

const CRM_CACHE_DOC_ID = "crm";
const SDR_CACHE_DOC_ID = "sdr";
const HEALTHY_MS = 3 * 60 * 1000;
const CRITICAL_MS = 30 * 60 * 1000;

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

const classifyFreshness = ({ snapshot = {}, generatedAt = "", nowMs = Date.now() } = {}) => {
  const lastSuccessfulRefreshAt = snapshot.lastSuccessfulRefreshAt || snapshot.calculatedAt || snapshot.fetchCompletedAt || generatedAt || "";
  const lastMs = Date.parse(lastSuccessfulRefreshAt || "");
  const ageMs = Number.isFinite(lastMs) ? Math.max(0, nowMs - lastMs) : null;
  const status = ageMs === null ? "UNAVAILABLE" : ageMs > CRITICAL_MS ? "CRITICAL" : ageMs > HEALTHY_MS ? "DEGRADED" : "HEALTHY";
  return {
    status,
    sourceFetchedAt: snapshot.fetchCompletedAt || null,
    snapshotCalculatedAt: snapshot.calculatedAt || null,
    snapshotPublishedAt: generatedAt || snapshot.calculatedAt || null,
    lastSuccessfulRefreshAt: lastSuccessfulRefreshAt || null,
    lastFailedRefreshAt: snapshot.lastFailedRefreshAt || null,
    snapshotAgeSeconds: ageMs === null ? null : Math.round(ageMs / 1000),
    withinSlo: ageMs !== null && ageMs <= HEALTHY_MS,
    stale: status !== "HEALTHY",
  };
};

const loadSlice = async (docId) => {
  const snap = await readCacheDoc(docId);
  if (!snap.ok || !snap.data?.payload) return null;
  return { payload: snap.data.payload, meta: getCacheMeta(snap.data), cached: true };
};

module.exports = async (req, res) => {
  const startedAt = Date.now();
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    return sendJson(res, 405, { error: "method_not_allowed" });
  }

  const auth = await canReadCrmLive(req);
  if (!auth?.ok) return sendJson(res, auth?.status || 401, { error: auth?.error || "unauthorized" });

  const host = String(req.headers.host || "localhost");
  const buildId = getCrmLiveBuildId();
  const url = new URL(req.url || "/api/crm-live-data", `https://${host}`);
  if (url.searchParams.has("auditFrom") || url.searchParams.has("auditTo")) {
    if (auth.mode !== "session" || !["admin", "growth"].includes(normalizeRole(auth.session?.role))) {
      return sendJson(res, 403, { error: "audit_admin_required" });
    }
    try {
      const { readCompleteCrmSource } = require("./_lib/crm-source-snapshot");
      const { auditSource } = require("./_lib/crm-source-audit");
      const source = await readCompleteCrmSource();
      const audit = auditSource(source, url.searchParams.get("auditFrom") || "", url.searchParams.get("auditTo") || "");
      const excludedByReason = {};
      audit.rows.filter((row) => !row.included).forEach((row) => {
        excludedByReason[row.reason] = (excludedByReason[row.reason] || 0) + 1;
      });
      const requestedPage = url.searchParams.get("auditPage");
      const page = requestedPage === null ? null : Number(requestedPage);
      if (page !== null && (!Number.isSafeInteger(page) || page < 0)) return sendJson(res, 400, { error: "invalid_audit_page" });
      return sendJson(res, 200, {
        ...audit,
        excludedByReason,
        recordsTotal: audit.rows.length,
        page,
        rows: page === null ? audit.rows.filter((row) => row.included) : audit.rows.slice(page * 200, (page + 1) * 200),
      });
    } catch (error) {
      return sendJson(res, error.status || 503, { error: error.code || "audit_failed" });
    }
  }

  try {
    const [crmSlice, sdrSlice] = await Promise.all([loadSlice(CRM_CACHE_DOC_ID), loadSlice(SDR_CACHE_DOC_ID)]);
    if (!crmSlice?.payload) {
      return sendJson(res, 503, {
        error: "crm_live_snapshot_unavailable",
        message: "CRM Live ainda não possui snapshot válido publicado.",
        snapshot: { status: "UNAVAILABLE", refreshStatus: "UNAVAILABLE" },
        stale: true,
        buildId,
      });
    }
    const effectiveSdrSlice = (crmSlice?.payload?.sdrSnapshot ? { payload: crmSlice.payload.sdrSnapshot, meta: crmSlice.meta, cached: true } : sdrSlice) || {
      payload: { weekly: { sdrs: [], team: { sdrs: { targetValue: 0, actualValue: 0, progressPct: 0 } } }, highlights: {}, unresolved: {}, cacheDebug: {} },
      meta: { generatedAt: "" },
      cached: false,
    };

    const closers = decorateLeaderboardComparisons({ rows: (crmSlice.payload.weekly?.closers || []).filter(isLivePerformanceEligible), discrete: false });
    const sdrs = decorateLeaderboardComparisons({ rows: (effectiveSdrSlice.payload.weekly?.sdrs || []).filter(isLivePerformanceEligible), discrete: true });
    const weekKey = crmSlice.payload.weekly?.commercialWeek?.weekKey || effectiveSdrSlice.payload.weekly?.commercialWeek?.weekKey || "";
    const weeklyRollups = []; // Record history is computed once in the published performance snapshot.
    const news = buildWeeklyNewsScreens({
      month: crmSlice.payload.month,
      weekly: {
        commercialWeek: crmSlice.payload.weekly?.commercialWeek || effectiveSdrSlice.payload.weekly?.commercialWeek,
        team: {
          closers: crmSlice.payload.weekly?.team?.closers || { targetValue: 0, actualValue: 0, progressPct: 0 },
          sdrs: effectiveSdrSlice.payload.weekly?.team?.sdrs || { targetValue: 0, actualValue: 0, progressPct: 0 },
        },
        closers,
        sdrs,
        configSource: crmSlice.payload.weekly?.configSource || effectiveSdrSlice.payload.weekly?.configSource || "",
      },
      previousMonthComparison: crmSlice.payload.monthComparison || null,
      weeklyRollups: weeklyRollups.filter((row) => row.weekKey !== weekKey),
      now: new Date(),
    });

    if (url.searchParams.get('auditPerformance') === '1') {
      if (auth.mode !== 'session' || !['admin', 'growth'].includes(normalizeRole(auth.session?.role))) return sendJson(res, 403, { error: 'audit_admin_required' });
      return sendJson(res, 200, { snapshotId: crmSlice.payload.snapshot?.snapshotId, performance: crmSlice.payload.performance || null });
    }

    const freshness = classifyFreshness({ snapshot: crmSlice.payload.snapshot || {}, generatedAt: crmSlice.meta?.generatedAt || "", nowMs: Date.now() });
    const sourceDate = freshness.lastSuccessfulRefreshAt || crmSlice.meta?.generatedAt || "";
    const sourceAgeMs = Date.now() - Date.parse(sourceDate || "");
    const stale = Boolean(freshness.stale || !crmSlice.payload.snapshot);
    const snapshotQuality = {
      ...crmSlice.payload.snapshot,
      status: crmSlice.payload.snapshot?.status || "LEGACY",
      calculationVersion: crmSlice.payload.snapshot?.calculationVersion || 0,
      refreshStatus: freshness.status,
      healthStatus: freshness.status,
      sourceFetchedAt: freshness.sourceFetchedAt,
      snapshotCalculatedAt: freshness.snapshotCalculatedAt,
      snapshotPublishedAt: freshness.snapshotPublishedAt,
      lastSuccessfulRefreshAt: freshness.lastSuccessfulRefreshAt,
      lastFailedRefreshAt: freshness.lastFailedRefreshAt,
      lastCompleteAt: freshness.lastSuccessfulRefreshAt,
      stale,
      dataFreshnessLagMs: Number.isFinite(sourceAgeMs) ? Math.max(0, sourceAgeMs) : null,
    };
    const staleAgeMinutes = Math.max(Number(crmSlice.meta?.ageMinutes || 0), Number(effectiveSdrSlice.meta?.ageMinutes || 0));
    const snapshotGeneratedAt = String(crmSlice.meta?.generatedAt || freshness.lastSuccessfulRefreshAt || "");

    return sendJson(res, 200, {
      snapshot: snapshotQuality,
      calculationVersion: CRM_LIVE_READ_MODEL_VERSION,
      month: crmSlice.payload.month,
      news: news.filter(item => item.type !== 'personal_best'),
      recordCandidates: crmSlice.payload.performance?.recordCandidates || [],
      conversions: crmSlice.payload.performance?.conversions || { sdr: [], closers: [] },
      performance: crmSlice.payload.performance ? { version: crmSlice.payload.performance.version, snapshotId: crmSlice.payload.performance.snapshotId, period: crmSlice.payload.performance.period, sources: crmSlice.payload.performance.sources } : null,
      pipeline: crmSlice.payload.pipeline || { rows: [], windowStartDateKey: "" },
      weekly: {
        commercialWeek: crmSlice.payload.weekly?.commercialWeek || effectiveSdrSlice.payload.weekly?.commercialWeek,
        team: {
          closers: crmSlice.payload.weekly?.team?.closers || { targetValue: 0, actualValue: 0, progressPct: 0 },
          sdrs: effectiveSdrSlice.payload.weekly?.team?.sdrs || { targetValue: 0, actualValue: 0, progressPct: 0 },
        },
        closers,
        sdrs,
      },
      highlights: {
        dayKey: crmSlice.payload.highlights?.dayKey || effectiveSdrSlice.payload.highlights?.dayKey || "",
        weekKey: crmSlice.payload.highlights?.weekKey || effectiveSdrSlice.payload.highlights?.weekKey || "",
        closer: isLivePerformanceEligible(crmSlice.payload.highlights?.closer) ? crmSlice.payload.highlights.closer : null,
        sdr: isLivePerformanceEligible(effectiveSdrSlice.payload.highlights?.sdr) ? effectiveSdrSlice.payload.highlights.sdr : null,
      },
      latestSale: crmSlice.payload.latestSale || null,
      unresolved: {
        missingResponsible: crmSlice.payload.unresolved?.missingResponsible || [],
        unknownResponsible: crmSlice.payload.unresolved?.unknownResponsible || [],
        sdrActors: effectiveSdrSlice.payload.unresolved?.sdrActors || [],
      },
      cacheDebug: {
        crm: crmSlice.payload.cacheDebug?.crm || null,
        sdr: effectiveSdrSlice.payload.cacheDebug?.sdr || null,
      },
      generatedAt: snapshotGeneratedAt || new Date().toISOString(),
      snapshotGeneratedAt: sourceDate || snapshotGeneratedAt || "",
      staleSource: stale ? "crm" : "",
      stale,
      cached: true,
      staleAgeMinutes,
      freshness,
      metrics: {
        crm_snapshot_age_seconds: freshness.snapshotAgeSeconds,
        reader_response_time_ms: Date.now() - startedAt,
      },
      buildId,
    });
  } catch (error) {
    console.error("[crm-live] read-only payload failed", error);
    return sendJson(res, error?.status || 500, {
      error: error?.error || error?.code || "crm_live_payload_failed",
      message:
        error?.status === 401
          ? "Acesso CRM Live não autorizado."
          : error?.message
            ? String(error.message)
            : "Não foi possível ler o último snapshot do CRM Live agora.",
    });
  }
};
