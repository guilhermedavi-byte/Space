const { sendJson } = require("../_lib/http");
const { getSessionFromRequest } = require("../_lib/session");
const { CRM_LIVE_EVENTS_COLLECTION, readStateDoc, validateCookieViewer } = require("./_lib/crm-live");
const { DETECTOR_DOC_ID, EVENT_QUEUE_DURATION_MS } = require("./_lib/crm-live-refresh");

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

module.exports = async (req, res) => {
  const startedAt = Date.now();
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    return sendJson(res, 405, { error: "method_not_allowed" });
  }

  const auth = await canReadCrmLive(req);
  if (!auth?.ok) return sendJson(res, auth?.status || 401, { error: auth?.error || "unauthorized" });

  try {
    const stateSnap = await readStateDoc(CRM_LIVE_EVENTS_COLLECTION, DETECTOR_DOC_ID);
    const state = stateSnap.ok && stateSnap.data ? stateSnap.data : null;
    const generatedAt = String(state?.queueGeneratedAt || "");
    const ageMs = Date.now() - Date.parse(generatedAt || "");
    const queueDurationMs = Number(state?.queueDurationMs || EVENT_QUEUE_DURATION_MS) || EVENT_QUEUE_DURATION_MS;
    const freshQueue = generatedAt && Number.isFinite(ageMs) && ageMs >= 0 && ageMs <= queueDurationMs;
    const events = freshQueue && Array.isArray(state?.pendingEvents) ? state.pendingEvents : [];
    return sendJson(res, 200, {
      ok: true,
      coldStart: Boolean(state?.initializedAt) === false,
      weekRolled: false,
      generatedAt: generatedAt || new Date().toISOString(),
      queueDurationMs,
      events,
      debug: {
        materialized: true,
        lastRefreshSnapshotId: state?.lastRefreshSnapshotId || "",
        queueAgeMs: Number.isFinite(ageMs) ? Math.max(0, ageMs) : null,
        reader_response_time_ms: Date.now() - startedAt,
        ...(state?.debug && typeof state.debug === "object" ? state.debug : {}),
      },
    });
  } catch (error) {
    console.error("[crm-live-events] read-only queue failed", {
      status: Number(error?.status || 0) || 500,
      code: error?.code || error?.error || error?.message || "crm_live_events_failed",
      elapsedMs: Date.now() - startedAt,
    });
    return sendJson(res, error?.status || 500, {
      error: error?.code || error?.error || "crm_live_events_failed",
      message: "Não foi possível ler a fila de interrupções do CRM Live agora.",
    });
  }
};
