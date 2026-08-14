const crypto = require("crypto");

const { supabaseFetch } = require("./supabase-rest");

const MIRROR_TABLE = "datacrazy_businesses";
const SYNC_STATE_TABLE = "datacrazy_sync_state";
const SYNC_RUNS_TABLE = "datacrazy_sync_runs";
const DEFAULT_REMOTE_PAGE_SIZE = 200;
const DEFAULT_LOCAL_PAGE_SIZE = 1000;
const DEFAULT_OVERLAP_MS = 90 * 1000;

const truthy = (value) => ["1", "true", "yes", "on"].includes(String(value || "").trim().toLowerCase());
const safeString = (value) => (value == null ? "" : String(value).trim());
const safeNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};
const normalizeKey = (value) =>
  safeString(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const parseIsoDate = (value) => {
  const raw = safeString(value);
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
};

const escapeInValue = (value) => `"${safeString(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
const buildInFilter = (values = []) => `in.(${values.map((value) => escapeInValue(value)).join(",")})`;

const extractBusinessesArray = (payload) => {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.businesses)) return payload.businesses;
  if (Array.isArray(payload.items)) return payload.items;
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload?.data?.businesses)) return payload.data.businesses;
  if (Array.isArray(payload?.data?.items)) return payload.data.items;
  return [];
};

const extractBusinessId = (business) => safeString(business?.id || business?._id || business?.uuid || business?.businessId);
const extractBusinessStatus = (business) => safeString(business?.status || business?.dealStatus || business?.situation);
const extractStageName = (business) => safeString(business?.stage?.name || business?.stageName || business?.stage);
const extractPipelineName = (business) =>
  safeString(business?.stage?.pipeline?.name || business?.pipeline?.name || business?.pipelineName);
const extractAttendantId = (business) =>
  safeString(
    business?.attendantId ||
      business?.attendant?.id ||
      business?.attendant?._id ||
      business?.attendant?.uuid ||
      business?.responsibleId
  );
const extractAttendantName = (business) => safeString(business?.attendant?.name || business?.attendantName || business?.responsibleName);
const extractLeadName = (business) =>
  safeString(business?.lead?.name || business?.leadName || business?.clientName || business?.customerName || business?.name);
const extractPlanName = (business) =>
  safeString(business?.products?.[0]?.product?.name || business?.planName || business?.produto?.nome);
const extractCreatedAt = (business) => parseIsoDate(business?.createdAt || business?.created_at);
const extractLastMovedAt = (business) => parseIsoDate(business?.lastMovedAt);

const extractStatusChangedInfo = (business) => {
  const candidates = ["statusChangedAt", "stageChangedAt", "wonAt", "wonDate", "gainedAt", "gainAt", "closedAt", "finishedAt"];
  for (const field of candidates) {
    const date = parseIsoDate(business?.[field]);
    if (date) return { field, date };
  }
  return { field: "", date: null };
};

const computeSourceHash = (business) =>
  crypto
    .createHash("sha256")
    .update(JSON.stringify(business || {}), "utf8")
    .digest("hex");

const isDatacrazyMirrorEnabled = () => truthy(process.env.DATACRAZY_MIRROR_ENABLED);
const getDatacrazyOverlapMs = () => Math.max(0, Number(process.env.DATACRAZY_SYNC_OVERLAP_MS) || DEFAULT_OVERLAP_MS);
const getDatacrazySyncSecret = () => safeString(process.env.DATACRAZY_SYNC_SECRET);

const getDatacrazyRemoteConfig = () => {
  const apiKey = safeString(process.env.CRM_API_KEY);
  const base = safeString(process.env.CRM_API_BASE_URL).replace(/\/+$/, "");
  if (!apiKey || !base) {
    const error = new Error("missing_crm_env");
    error.status = 500;
    error.code = "missing_crm_env";
    throw error;
  }
  return { apiKey, base };
};

const requestJsonRaw = async (url, { method = "GET", headers = {}, body } = {}) => {
  const response = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: body == null ? undefined : JSON.stringify(body),
  });
  const text = await response.text().catch(() => "");
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  return {
    ok: response.ok,
    status: response.status,
    data,
    text: typeof data === "string" ? data : text,
  };
};

const fetchDatacrazyBusinessesPage = async ({ skip = 0, take = DEFAULT_REMOTE_PAGE_SIZE, lastMovedAfter = "", status = "" } = {}) => {
  const { apiKey, base } = getDatacrazyRemoteConfig();
  const params = new URLSearchParams();
  params.set("skip", String(Math.max(0, Number(skip) || 0)));
  params.set("take", String(Math.max(1, Math.min(Number(take) || DEFAULT_REMOTE_PAGE_SIZE, 500))));
  if (safeString(lastMovedAfter)) params.set("filter[lastMovedAfter]", safeString(lastMovedAfter));
  if (safeString(status)) params.set("filter[status]", safeString(status));
  const response = await requestJsonRaw(`${base}/api/v1/businesses?${params.toString()}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!response.ok) {
    const error = new Error("datacrazy_fetch_failed");
    error.status = response.status || 500;
    error.code = "datacrazy_fetch_failed";
    throw error;
  }
  const items = extractBusinessesArray(response.data);
  const total =
    typeof response.data?.total === "number"
      ? response.data.total
      : typeof response.data?.count === "number"
        ? response.data.count
        : typeof response.data?.meta?.total === "number"
          ? response.data.meta.total
          : null;
  return { items, total };
};

const buildMirrorRow = (business, { syncedAt = new Date().toISOString(), runId = null, reconciledRunId = null, softDeletedAt = null } = {}) => {
  const externalId = extractBusinessId(business);
  const lastMovedAt = extractLastMovedAt(business);
  const createdAt = extractCreatedAt(business);
  const statusChanged = extractStatusChangedInfo(business);
  return {
    external_id: externalId,
    payload: business,
    source_hash: computeSourceHash(business),
    status: extractBusinessStatus(business) || null,
    pipeline_name: extractPipelineName(business) || null,
    pipeline_key: normalizeKey(extractPipelineName(business)) || null,
    stage_name: extractStageName(business) || null,
    stage_key: normalizeKey(extractStageName(business)) || null,
    attendant_id: extractAttendantId(business) || null,
    attendant_name: extractAttendantName(business) || null,
    lead_name: extractLeadName(business) || null,
    plan_name: extractPlanName(business) || null,
    total_amount: safeNumber(business?.total ?? business?.value) || 0,
    created_at: createdAt ? createdAt.toISOString() : null,
    last_moved_at: lastMovedAt ? lastMovedAt.toISOString() : null,
    status_changed_at: statusChanged.date ? statusChanged.date.toISOString() : null,
    status_changed_field: statusChanged.field || null,
    synced_at: safeString(syncedAt) || new Date().toISOString(),
    deleted_at: softDeletedAt ? safeString(softDeletedAt) : null,
    last_sync_run_id: Number.isFinite(Number(runId)) ? Number(runId) : null,
    last_reconciled_run_id: Number.isFinite(Number(reconciledRunId)) ? Number(reconciledRunId) : null,
  };
};

const fetchMirrorRowsByExternalIds = async (externalIds = []) => {
  const ids = [...new Set((Array.isArray(externalIds) ? externalIds : []).map((value) => safeString(value)).filter(Boolean))];
  if (!ids.length) return new Map();
  const chunks = [];
  for (let index = 0; index < ids.length; index += 150) chunks.push(ids.slice(index, index + 150));
  const map = new Map();
  for (const chunk of chunks) {
    const query = `/${MIRROR_TABLE}?select=external_id,source_hash,deleted_at&external_id=${encodeURIComponent(buildInFilter(chunk))}`;
    const { data } = await supabaseFetch(query);
    (Array.isArray(data) ? data : []).forEach((row) => {
      map.set(safeString(row.external_id), row);
    });
  }
  return map;
};

const patchMirrorRowsByExternalIds = async (externalIds = [], patch = {}) => {
  const ids = [...new Set((Array.isArray(externalIds) ? externalIds : []).map((value) => safeString(value)).filter(Boolean))];
  if (!ids.length) return;
  const chunks = [];
  for (let index = 0; index < ids.length; index += 150) chunks.push(ids.slice(index, index + 150));
  for (const chunk of chunks) {
    const query = `/${MIRROR_TABLE}?external_id=${encodeURIComponent(buildInFilter(chunk))}`;
    await supabaseFetch(query, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: patch,
    });
  }
};

const upsertMirrorBatch = async ({ businesses = [], runId = null, reconciledRunId = null } = {}) => {
  const rows = (Array.isArray(businesses) ? businesses : [])
    .map((business) => buildMirrorRow(business, { runId, reconciledRunId }))
    .filter((row) => row.external_id);
  if (!rows.length) return { received: 0, inserted: 0, updated: 0, unchanged: 0 };
  const existing = await fetchMirrorRowsByExternalIds(rows.map((row) => row.external_id));
  const changedRows = [];
  const unchangedIds = [];
  let inserted = 0;
  let updated = 0;
  rows.forEach((row) => {
    const current = existing.get(row.external_id);
    const wasDeleted = safeString(current?.deleted_at);
    if (!current) {
      inserted += 1;
      changedRows.push(row);
      return;
    }
    if (safeString(current.source_hash) !== row.source_hash || wasDeleted) {
      updated += 1;
      changedRows.push(row);
      return;
    }
    unchangedIds.push(row.external_id);
  });
  if (changedRows.length) {
    await supabaseFetch(`/${MIRROR_TABLE}?on_conflict=external_id`, {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: changedRows,
    });
  }
  if (unchangedIds.length && Number.isFinite(Number(reconciledRunId))) {
    await patchMirrorRowsByExternalIds(unchangedIds, {
      last_reconciled_run_id: Number(reconciledRunId),
      synced_at: new Date().toISOString(),
      deleted_at: null,
    });
  }
  return {
    received: rows.length,
    inserted,
    updated,
    unchanged: unchangedIds.length,
  };
};

const fetchMirroredBusinesses = async ({ lastMovedAfter = "", startDateKey = "", status = "", includeDeleted = false, pageSize = DEFAULT_LOCAL_PAGE_SIZE } = {}) => {
  const filters = [];
  if (!includeDeleted) filters.push("deleted_at=is.null");
  const since = safeString(lastMovedAfter) || (safeString(startDateKey) ? `${safeString(startDateKey)}T00:00:00-03:00` : "");
  if (since) filters.push(`last_moved_at=gte.${encodeURIComponent(since)}`);
  if (safeString(status)) filters.push(`status=eq.${encodeURIComponent(safeString(status))}`);
  const safePageSize = Math.max(1, Math.min(Number(pageSize) || DEFAULT_LOCAL_PAGE_SIZE, 5000));
  let offset = 0;
  let pages = 0;
  const payloads = [];
  while (pages < 200) {
    const query = `/${MIRROR_TABLE}?select=payload&order=last_moved_at.asc.nullslast&limit=${safePageSize}&offset=${offset}${
      filters.length ? `&${filters.join("&")}` : ""
    }`;
    const { data } = await supabaseFetch(query, { headers: { Prefer: "return=representation" } });
    const rows = Array.isArray(data) ? data : [];
    pages += 1;
    rows.forEach((row) => {
      if (row && typeof row.payload === "object") payloads.push(row.payload);
    });
    if (rows.length < safePageSize) break;
    offset += safePageSize;
  }
  return {
    businesses: payloads,
    pagination: {
      pages,
      totalFetched: payloads.length,
      source: "mirror",
      lastMovedAfter: since || "",
      status: safeString(status),
    },
  };
};

const fetchAllMirroredBusinesses = async ({ includeDeleted = false, pageSize = DEFAULT_LOCAL_PAGE_SIZE } = {}) =>
  fetchMirroredBusinesses({ includeDeleted, pageSize });

const getSyncState = async (syncName) => {
  const name = safeString(syncName);
  if (!name) return null;
  const { data } = await supabaseFetch(`/${SYNC_STATE_TABLE}?select=*&sync_name=eq.${encodeURIComponent(name)}&limit=1`);
  return Array.isArray(data) && data[0] ? data[0] : null;
};

const upsertSyncState = async ({ syncName, patch = {} } = {}) => {
  const name = safeString(syncName);
  if (!name) throw new Error("missing_sync_name");
  const { data } = await supabaseFetch(`/${SYNC_STATE_TABLE}?on_conflict=sync_name`, {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: [{ sync_name: name, ...patch }],
  });
  return Array.isArray(data) && data[0] ? data[0] : null;
};

const createSyncRun = async ({ syncName, mode, cursorFrom = null, watermarkAt = null, notes = null } = {}) => {
  const { data } = await supabaseFetch(`/${SYNC_RUNS_TABLE}`, {
    method: "POST",
    body: [
      {
        sync_name: safeString(syncName),
        mode: safeString(mode) || "incremental",
        status: "running",
        cursor_from: cursorFrom,
        watermark_at: watermarkAt,
        notes: notes && typeof notes === "object" ? notes : null,
      },
    ],
  });
  return Array.isArray(data) && data[0] ? data[0] : null;
};

const finishSyncRun = async ({ runId, patch = {} } = {}) => {
  const id = Number(runId);
  if (!Number.isFinite(id) || id <= 0) return null;
  const { data } = await supabaseFetch(`/${SYNC_RUNS_TABLE}?id=eq.${id}`, {
    method: "PATCH",
    body: patch,
  });
  return Array.isArray(data) && data[0] ? data[0] : null;
};

const acquireSyncLock = async ({ syncName, lockToken, lockOwner, ttlSeconds = 900 } = {}) => {
  const { data } = await supabaseFetch(`/rpc/datacrazy_acquire_lock`, {
    method: "POST",
    body: {
      p_sync_name: safeString(syncName),
      p_lock_token: safeString(lockToken),
      p_lock_owner: safeString(lockOwner),
      p_ttl_seconds: Math.max(30, Number(ttlSeconds) || 900),
    },
  });
  return data;
};

const releaseSyncLock = async ({ syncName, lockToken, status = "", errorMessage = "" } = {}) => {
  const { data } = await supabaseFetch(`/rpc/datacrazy_release_lock`, {
    method: "POST",
    body: {
      p_sync_name: safeString(syncName),
      p_lock_token: safeString(lockToken),
      p_status: safeString(status) || null,
      p_error: safeString(errorMessage) || null,
    },
  });
  return data;
};

const markMissingAsSoftDeleted = async ({ reconcileRunId, deletedAt = new Date().toISOString() } = {}) => {
  const runId = Number(reconcileRunId);
  if (!Number.isFinite(runId) || runId <= 0) return;
  await supabaseFetch(`/${MIRROR_TABLE}?deleted_at=is.null&last_reconciled_run_id=not.eq.${runId}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: { deleted_at: safeString(deletedAt) },
  });
};

const computeOverlapCursor = (cursor, overlapMs = getDatacrazyOverlapMs()) => {
  const date = parseIsoDate(cursor);
  if (!date) return "";
  return new Date(Math.max(0, date.getTime() - Math.max(0, Number(overlapMs) || 0))).toISOString();
};

module.exports = {
  MIRROR_TABLE,
  SYNC_STATE_TABLE,
  SYNC_RUNS_TABLE,
  DEFAULT_REMOTE_PAGE_SIZE,
  buildMirrorRow,
  computeOverlapCursor,
  computeSourceHash,
  createSyncRun,
  extractAttendantId,
  extractBusinessId,
  extractBusinessesArray,
  extractLastMovedAt,
  fetchAllMirroredBusinesses,
  fetchDatacrazyBusinessesPage,
  fetchMirroredBusinesses,
  finishSyncRun,
  getDatacrazyOverlapMs,
  getDatacrazyRemoteConfig,
  getDatacrazySyncSecret,
  getSyncState,
  isDatacrazyMirrorEnabled,
  markMissingAsSoftDeleted,
  releaseSyncLock,
  requestJsonRaw,
  safeNumber,
  safeString,
  upsertMirrorBatch,
  upsertSyncState,
  acquireSyncLock,
  __private: {
    buildInFilter,
    normalizeKey,
    parseIsoDate,
    truthy,
  },
};
