const crypto = require("crypto");

const { sendJson, readJsonBody } = require("../_lib/http");
const { getSessionFromRequest } = require("../_lib/session");
const { buildGrowthMetricsPayload, fetchAllCrmBusinessesLegacy } = require("./growth-dashboard").__private;
const { buildCrmLiveCrmSlice, loadCurrentGoal, loadGrowthPeople } = require("./_lib/crm-live");
const {
  DEFAULT_REMOTE_PAGE_SIZE,
  acquireSyncLock,
  computeOverlapCursor,
  createSyncRun,
  fetchAllMirroredBusinesses,
  fetchDatacrazyBusinessesPage,
  finishSyncRun,
  getDatacrazySyncSecret,
  getSyncState,
  isDatacrazyMirrorEnabled,
  markMissingAsSoftDeleted,
  releaseSyncLock,
  safeString,
  upsertMirrorBatch,
  upsertSyncState,
} = require("./_lib/datacrazy-mirror");

const SYNC_NAME_INCREMENTAL = "incremental";
const SYNC_NAME_RECONCILE = "reconcile";
const SYNC_NAME_VALIDATE = "validation";
const SYNC_NAME_PARITY = "parity";

const normalizeRole = (value) => {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "admin" || raw === "administrador") return "admin";
  if (raw === "growth") return "growth";
  return "";
};

const canUseSecret = (req) => {
  const configured = getDatacrazySyncSecret();
  if (!configured) return false;
  const provided = safeString(req.headers["x-sync-secret"] || req.headers["x-webhook-secret"]);
  return Boolean(provided && provided === configured);
};

const requireSyncAuth = (req, res) => {
  if (canUseSecret(req)) return { ok: true, actor: "external-job" };
  const session = getSessionFromRequest(req);
  const role = normalizeRole(session?.role);
  if (role === "admin" || role === "growth") {
    return { ok: true, actor: safeString(session?.email || session?.sub || role || "internal-user") };
  }
  sendJson(res, 401, { error: "unauthorized" });
  return null;
};

const readAction = async (req) => {
  const host = String(req.headers.host || "localhost");
  const url = new URL(req.url || "/api/datacrazy-sync", `https://${host}`);
  let body = {};
  if (req.method !== "GET" && req.method !== "HEAD") {
    body = (await readJsonBody(req).catch(() => ({}))) || {};
  }
  return {
    action: safeString(body.action || url.searchParams.get("action") || "incremental").toLowerCase(),
    force: safeString(body.force || url.searchParams.get("force")) === "1",
    maxPages: Math.max(1, Math.min(Number(body.maxPages || url.searchParams.get("maxPages")) || 8, 100)),
    take: Math.max(50, Math.min(Number(body.take || url.searchParams.get("take")) || DEFAULT_REMOTE_PAGE_SIZE, 500)),
    maxDurationMs: Math.max(3_000, Math.min(Number(body.maxDurationMs || url.searchParams.get("maxDurationMs")) || 20_000, 240_000)),
  };
};

const finishRunAndLock = async ({ syncName, lockToken, runId, status, startedAtMs, patch = {}, errorMessage = "" } = {}) => {
  await finishSyncRun({
    runId,
    patch: {
      status,
      finished_at: new Date().toISOString(),
      duration_ms: Number.isFinite(Number(startedAtMs)) ? Date.now() - Number(startedAtMs) : null,
      ...patch,
      error_summary: safeString(errorMessage) || patch.error_summary || null,
    },
  }).catch(() => null);
  await releaseSyncLock({ syncName, lockToken, status, errorMessage }).catch(() => null);
};

const runIncrementalSync = async ({ actor, force = false, maxPages, take, maxDurationMs }) => {
  const syncName = SYNC_NAME_INCREMENTAL;
  const lockToken = `lock_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
  const lock = await acquireSyncLock({ syncName, lockToken, lockOwner: actor, ttlSeconds: Math.ceil(maxDurationMs / 1000) + 120 });
  if (!lock?.ok) return { status: 409, body: { error: "sync_locked", lock } };

  const startedAtMs = Date.now();
  const state = (await getSyncState(syncName)) || {};
  const existingMeta = state.metadata && typeof state.metadata === "object" ? state.metadata : {};
  const cursorBase = force ? "" : safeString(state.cursor);
  const cursorFrom = cursorBase ? computeOverlapCursor(cursorBase) : "";
  const watermarkAt = new Date().toISOString();
  let skip = force ? 0 : Math.max(0, Number(existingMeta.nextSkip) || 0);
  let pages = 0;
  let recordsReceived = 0;
  let inserted = 0;
  let updated = 0;
  let unchanged = 0;
  let latestSeenCursor = cursorBase;
  let completed = false;
  const run = await createSyncRun({
    syncName,
    mode: cursorBase ? "incremental" : "bootstrap",
    cursorFrom: cursorFrom || null,
    watermarkAt,
    notes: { force, offsetStart: skip },
  });

  try {
    while (pages < maxPages && Date.now() - startedAtMs < maxDurationMs) {
      const page = await fetchDatacrazyBusinessesPage({ skip, take, lastMovedAfter: cursorFrom });
      const items = Array.isArray(page.items) ? page.items : [];
      const batch = await upsertMirrorBatch({ businesses: items, runId: run?.id || null });
      pages += 1;
      recordsReceived += batch.received;
      inserted += batch.inserted;
      updated += batch.updated;
      unchanged += batch.unchanged;
      items.forEach((business) => {
        const movedAt = safeString(business?.lastMovedAt);
        if (movedAt && (!latestSeenCursor || movedAt > latestSeenCursor)) latestSeenCursor = movedAt;
      });
      if (items.length < take) {
        completed = true;
        break;
      }
      skip += take;
    }

    await upsertSyncState({
      syncName,
      patch: completed
        ? {
            cursor: safeString(latestSeenCursor || watermarkAt) || watermarkAt,
            status: "idle",
            last_successful_sync_at: new Date().toISOString(),
            last_watermark_at: watermarkAt,
            last_error: null,
            metadata: { validation: existingMeta.validation || null },
          }
        : {
            status: "idle",
            last_watermark_at: watermarkAt,
            metadata: { ...existingMeta, nextSkip: skip + take, watermarkAt },
          },
    });

    await finishRunAndLock({
      syncName,
      lockToken,
      runId: run?.id,
      status: completed ? "success" : "partial",
      startedAtMs,
      patch: {
        pages,
        records_received: recordsReceived,
        inserted_count: inserted,
        updated_count: updated,
        unchanged_count: unchanged,
        cursor_to: completed ? safeString(latestSeenCursor || watermarkAt) || watermarkAt : null,
      },
    });

    return {
      status: 200,
      body: {
        ok: true,
        mode: cursorBase ? "incremental" : "bootstrap",
        completed,
        mirrorEnabled: isDatacrazyMirrorEnabled(),
        pages,
        recordsReceived,
        inserted,
        updated,
        unchanged,
        cursorFrom,
        cursorTo: completed ? safeString(latestSeenCursor || watermarkAt) || watermarkAt : null,
        watermarkAt,
      },
    };
  } catch (error) {
    await upsertSyncState({
      syncName,
      patch: {
        status: "error",
        last_error: safeString(error?.code || error?.message || "incremental_sync_failed"),
      },
    }).catch(() => null);
    await finishRunAndLock({
      syncName,
      lockToken,
      runId: run?.id,
      status: "error",
      startedAtMs,
      patch: {
        pages,
        records_received: recordsReceived,
        inserted_count: inserted,
        updated_count: updated,
        unchanged_count: unchanged,
      },
      errorMessage: safeString(error?.code || error?.message || "incremental_sync_failed"),
    });
    return { status: Number(error?.status) || 500, body: { error: safeString(error?.code || error?.message || "incremental_sync_failed") } };
  }
};

const runValidation = async ({ actor }) => {
  const syncName = SYNC_NAME_VALIDATE;
  const lockToken = `lock_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
  const lock = await acquireSyncLock({ syncName, lockToken, lockOwner: actor, ttlSeconds: 180 });
  if (!lock?.ok) return { status: 409, body: { error: "sync_locked", lock } };

  const startedAtMs = Date.now();
  const incrementalState = (await getSyncState(SYNC_NAME_INCREMENTAL)) || {};
  const baselinePage = await fetchDatacrazyBusinessesPage({ skip: 0, take: 25 });
  const since = computeOverlapCursor(incrementalState.cursor);
  const filteredPage = since ? await fetchDatacrazyBusinessesPage({ skip: 0, take: 25, lastMovedAfter: since }) : { items: [] };
  const violations = (Array.isArray(filteredPage.items) ? filteredPage.items : []).filter((row) => safeString(row?.lastMovedAt) && safeString(row.lastMovedAt) < since);
  const notes = {
    sampledWithoutFilter: Array.isArray(baselinePage.items) ? baselinePage.items.length : 0,
    sampledWithFilter: Array.isArray(filteredPage.items) ? filteredPage.items.length : 0,
    since,
    violationCount: violations.length,
    conclusion:
      "filter[lastMovedAfter] foi validado apenas como limite inferior observado sobre lastMovedAt nas amostras; ainda não há prova automática de que alterações sem movimentação atualizam lastMovedAt. O corte definitivo deve permanecer condicionado à paridade e à reconciliação completa periódica.",
  };
  const run = await createSyncRun({
    syncName,
    mode: "validate",
    cursorFrom: since || null,
    watermarkAt: new Date().toISOString(),
    notes,
  }).catch(() => null);
  await upsertSyncState({
    syncName,
    patch: {
      status: "idle",
      last_successful_sync_at: new Date().toISOString(),
      metadata: notes,
      last_error: null,
    },
  }).catch(() => null);
  await finishRunAndLock({
    syncName,
    lockToken,
    runId: run?.id,
    status: "success",
    startedAtMs,
    patch: {
      pages: 2,
      records_received: notes.sampledWithoutFilter + notes.sampledWithFilter,
      notes,
    },
  });
  return { status: 200, body: { ok: true, notes } };
};

const runReconcile = async ({ actor, maxPages, take, maxDurationMs }) => {
  const syncName = SYNC_NAME_RECONCILE;
  const lockToken = `lock_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
  const lock = await acquireSyncLock({ syncName, lockToken, lockOwner: actor, ttlSeconds: Math.ceil(maxDurationMs / 1000) + 120 });
  if (!lock?.ok) return { status: 409, body: { error: "sync_locked", lock } };

  const startedAtMs = Date.now();
  const state = (await getSyncState(syncName)) || {};
  const meta = state.metadata && typeof state.metadata === "object" ? state.metadata : {};
  const watermarkAt = safeString(meta.watermarkAt) || new Date().toISOString();
  let skip = Math.max(0, Number(meta.nextSkip) || 0);
  let pages = 0;
  let recordsReceived = 0;
  let inserted = 0;
  let updated = 0;
  let unchanged = 0;
  let completed = false;
  const run = skip > 0 ? { id: Number(meta.runId) || null } : await createSyncRun({ syncName, mode: "reconcile", watermarkAt, notes: { offsetStart: skip } });

  try {
    while (pages < maxPages && Date.now() - startedAtMs < maxDurationMs) {
      const page = await fetchDatacrazyBusinessesPage({ skip, take });
      const items = Array.isArray(page.items) ? page.items : [];
      const batch = await upsertMirrorBatch({ businesses: items, runId: run?.id || null, reconciledRunId: run?.id || null });
      pages += 1;
      recordsReceived += batch.received;
      inserted += batch.inserted;
      updated += batch.updated;
      unchanged += batch.unchanged;
      if (items.length < take) {
        completed = true;
        break;
      }
      skip += take;
    }

    if (completed) {
      await markMissingAsSoftDeleted({ reconcileRunId: run?.id || null, deletedAt: new Date().toISOString() });
    }

    await upsertSyncState({
      syncName,
      patch: completed
        ? {
            status: "idle",
            last_successful_sync_at: new Date().toISOString(),
            metadata: {},
            last_error: null,
          }
        : {
            status: "idle",
            metadata: { runId: run?.id || null, nextSkip: skip + take, watermarkAt },
          },
    });

    await finishRunAndLock({
      syncName,
      lockToken,
      runId: run?.id,
      status: completed ? "success" : "partial",
      startedAtMs,
      patch: {
        pages,
        records_received: recordsReceived,
        inserted_count: inserted,
        updated_count: updated,
        unchanged_count: unchanged,
      },
    });

    return { status: 200, body: { ok: true, completed, pages, recordsReceived, inserted, updated, unchanged } };
  } catch (error) {
    await finishRunAndLock({
      syncName,
      lockToken,
      runId: run?.id,
      status: "error",
      startedAtMs,
      patch: { pages, records_received: recordsReceived },
      errorMessage: safeString(error?.code || error?.message || "reconcile_failed"),
    });
    return { status: Number(error?.status) || 500, body: { error: safeString(error?.code || error?.message || "reconcile_failed") } };
  }
};

const runParity = async ({ actor }) => {
  const syncName = SYNC_NAME_PARITY;
  const lockToken = `lock_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
  const lock = await acquireSyncLock({ syncName, lockToken, lockOwner: actor, ttlSeconds: 900 });
  if (!lock?.ok) return { status: 409, body: { error: "sync_locked", lock } };

  const startedAtMs = Date.now();
  const run = await createSyncRun({
    syncName,
    mode: "parity",
    watermarkAt: new Date().toISOString(),
    notes: { source: "legacy-vs-mirror" },
  }).catch(() => null);

  try {
    const [legacyCrm, mirrorCrm, goal, people] = await Promise.all([
      fetchAllCrmBusinessesLegacy(),
      fetchAllMirroredBusinesses(),
      loadCurrentGoal({ now: new Date() }),
      loadGrowthPeople(),
    ]);
    const [legacyMetrics, mirrorMetrics] = await Promise.all([
      buildGrowthMetricsPayload({ crm: legacyCrm, idToken: "" }),
      buildGrowthMetricsPayload({ crm: mirrorCrm, idToken: "" }),
    ]);
    const previousFlag = process.env.DATACRAZY_MIRROR_ENABLED;
    process.env.DATACRAZY_MIRROR_ENABLED = "0";
    const legacyLive = await buildCrmLiveCrmSlice({ goal, people, now: new Date() });
    process.env.DATACRAZY_MIRROR_ENABLED = "1";
    const mirrorLive = await buildCrmLiveCrmSlice({ goal, people, now: new Date() });
    process.env.DATACRAZY_MIRROR_ENABLED = previousFlag;
    const parity = {
      growthMetrics: {
        realizedDiff: Math.abs(Number(legacyMetrics?.realizado || 0) - Number(mirrorMetrics?.realizado || 0)),
        totalVendasDiff: Math.abs(Number(legacyMetrics?.totalVendas || 0) - Number(mirrorMetrics?.totalVendas || 0)),
        agendamentosDiff: Math.abs(Number(legacyMetrics?.agendamentos || 0) - Number(mirrorMetrics?.agendamentos || 0)),
      },
      crmLive: {
        realizedDiff: Math.abs(Number(legacyLive?.month?.summary?.realizado || 0) - Number(mirrorLive?.month?.summary?.realizado || 0)),
        vendasDiff: Math.abs(Number(legacyLive?.month?.summary?.totalVendas || 0) - Number(mirrorLive?.month?.summary?.totalVendas || 0)),
      },
    };
    await finishRunAndLock({
      syncName,
      lockToken,
      runId: run?.id,
      status: "success",
      startedAtMs,
      patch: {
        records_received: (legacyCrm?.businesses || []).length,
        notes: parity,
      },
    });
    return { status: 200, body: { ok: true, parity } };
  } catch (error) {
    await finishRunAndLock({
      syncName,
      lockToken,
      runId: run?.id,
      status: "error",
      startedAtMs,
      errorMessage: safeString(error?.code || error?.message || "parity_failed"),
    });
    return { status: Number(error?.status) || 500, body: { error: safeString(error?.code || error?.message || "parity_failed") } };
  }
};

module.exports = async (req, res) => {
  if (!["GET", "HEAD", "POST"].includes(req.method || "")) {
    res.setHeader("Allow", "GET, HEAD, POST");
    return sendJson(res, 405, { error: "method_not_allowed" });
  }

  const auth = requireSyncAuth(req, res);
  if (!auth?.ok) return;

  const params = await readAction(req);
  if (params.action === "validate") {
    const result = await runValidation({ actor: auth.actor });
    return sendJson(res, result.status, result.body);
  }
  if (params.action === "reconcile") {
    const result = await runReconcile({ actor: auth.actor, maxPages: params.maxPages, take: params.take, maxDurationMs: params.maxDurationMs });
    return sendJson(res, result.status, result.body);
  }
  if (params.action === "parity") {
    const result = await runParity({ actor: auth.actor });
    return sendJson(res, result.status, result.body);
  }
  const result = await runIncrementalSync({
    actor: auth.actor,
    force: params.force,
    maxPages: params.maxPages,
    take: params.take,
    maxDurationMs: params.maxDurationMs,
  });
  return sendJson(res, result.status, result.body);
};
