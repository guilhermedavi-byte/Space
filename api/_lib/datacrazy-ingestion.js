const crypto = require('crypto');
const { getBusinessId, getBusinessClosingDate } = require('./commercial-sales');
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const log = (event, fields = {}) => console.info(JSON.stringify({ component: 'datacrazy-sync', event, ...fields }));
const failure = (code, info = {}) => Object.assign(new Error(code), { code, ...info });
const canonical = (v) => v && typeof v === 'object'
  ? Array.isArray(v) ? v.map(canonical) : Object.fromEntries(Object.keys(v).sort().map(k => [k, canonical(v[k])])) : v;
const canonicalJson = v => JSON.stringify(canonical(v));
const retryAfterMs = (raw, now) => {
  if (!raw) return 0;
  const seconds = Number(raw);
  return Number.isFinite(seconds) ? Math.max(0, seconds * 1000) : Math.max(0, Date.parse(raw) - now) || 0;
};
const decodePage = (payload) => {
  const items = [payload, payload?.items, payload?.businesses, payload?.data?.items, payload?.data?.businesses, payload?.data].find(Array.isArray);
  if (!items) throw failure('invalid_datacrazy_page');
  const total = [payload?.total, payload?.count, payload?.meta?.total, payload?.data?.total].find(n => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0);
  return { items, total: total ?? null };
};
// Sequential requests, including retries. The caller must hold the distributed source lease.
async function collectBusinesses({ snapshotId = crypto.randomUUID(), fetchImpl = globalThis.fetch, wait = sleep,
  clock = Date.now, random = Math.random, logger = log, take = 200, maxPages = 200,
  maxAttempts = 5, paceMs = 1000, timeoutMs = 15000, budgetMs = 220000,
  base = process.env.CRM_API_BASE_URL, apiKey = process.env.CRM_API_KEY } = {}) {
  if (!base || !apiKey) throw failure('missing_crm_env', { status: 503 });
  const started = clock();
  const metadata = { snapshotId, fetchStartedAt: new Date(started).toISOString(), fetchCompletedAt: null,
    sourceMaxDate: null, recordsFetched: 0, recordsConsidered: 0, pagesFetched: 0, expectedPages: null,
    expectedRecords: null, requestsCount: 0, retryCount: 0, datacrazy429Count: 0, durationMs: 0,
    fetchCompleted: false, paginationCompleted: false };
  const rows = new Map();
  const recordPages = {};
  let lastRequestAt = -Infinity;
  logger('fetch_started', { snapshotId });
  const delay = async (ms) => {
    if (clock() + ms >= started + budgetMs) throw failure('sync_deadline_exceeded', { retryAfterMs: ms });
    if (ms > 0) await wait(ms);
  };
  try {
    for (let page = 1; page <= maxPages; page++) {
      let decoded;
      const skip = (page - 1) * take;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        await delay(Math.max(0, paceMs - (clock() - lastRequestAt)));
        if (clock() >= started + budgetMs) throw failure('sync_deadline_exceeded');
        metadata.requestsCount++;
        lastRequestAt = clock();
        let response, retryDelay = 0;
        try {
          const params = new URLSearchParams({ skip: String(skip), take: String(take) });
          response = await fetchImpl(`${String(base).replace(/\/+$/, '')}/api/v1/businesses?${params}`, {
            headers: { Authorization: `Bearer ${apiKey}` },
            signal: AbortSignal.timeout(Math.max(1, Math.min(timeoutMs, started + budgetMs - clock()))),
          });
          if (response.status === 429) metadata.datacrazy429Count++;
          if (response.ok) {
            decoded = decodePage(await response.json());
            break;
          }
          retryDelay = retryAfterMs(response.headers?.get('retry-after'), clock());
          const recoverable = [408, 429, 500, 502, 503, 504].includes(response.status);
          // Never include response bodies, URLs, credentials or lead PII in operational logs.
          throw failure('datacrazy_http_error', { status: response.status, recoverable, retryAfterMs: retryDelay });
        } catch (error) {
          const recoverable = error.recoverable ?? ['TimeoutError', 'AbortError', 'TypeError'].includes(error.name);
          const context = { snapshotId, page, skip, take, attempt, status: error.status || 0, code: error.code || error.name };
          if (!recoverable || attempt === maxAttempts) throw failure(error.code || 'datacrazy_request_failed', { ...context, retryAfterMs: error.retryAfterMs || 0 });
          const backoff = Math.min(30000, 1000 * (2 ** (attempt - 1))) * (0.5 + random() * 0.5);
          const waitMs = Math.ceil(Math.max(backoff, retryDelay));
          metadata.retryCount++;
          logger('request_retry', { ...context, retryAfterMs: retryDelay, waitMs });
          await delay(waitMs);
        }
      }
      if (!decoded) throw failure('pagination_incomplete');
      if (decoded.items.length > take) throw failure('invalid_page_size');
      if (decoded.total !== null) {
        if (metadata.expectedRecords !== null && metadata.expectedRecords !== decoded.total) throw failure('source_total_changed');
        metadata.expectedRecords = decoded.total;
        metadata.expectedPages = Math.max(1, Math.ceil(decoded.total / take));
      }
      metadata.pagesFetched++;
      metadata.recordsFetched += decoded.items.length;
      for (const business of decoded.items) {
        const id = getBusinessId(business);
        if (!id) throw failure('missing_business_id');
        const serialized = canonicalJson(business);
        if (rows.has(id) && rows.get(id).serialized !== serialized) throw failure('conflicting_duplicate_business');
        (recordPages[id] ||= []).push(page);
        rows.set(id, { business, serialized });
      }
      logger('page_completed', { snapshotId, page, expectedPages: metadata.expectedPages, received: decoded.items.length, recordsFetched: metadata.recordsFetched });
      const terminal = decoded.items.length < take || (metadata.expectedRecords !== null && metadata.recordsFetched >= metadata.expectedRecords);
      if (terminal) {
        if (metadata.expectedRecords !== null && (rows.size !== metadata.expectedRecords || metadata.recordsFetched !== metadata.expectedRecords || metadata.pagesFetched !== metadata.expectedPages)) throw failure('pagination_count_mismatch');
        metadata.paginationCompleted = true;
        break;
      }
    }
    if (!metadata.paginationCompleted) throw failure('pagination_limit_exceeded');
    const businesses = [...rows.entries()].sort(([a], [b]) => a.localeCompare(b, 'en')).map(([, row]) => row.business);
    metadata.recordsConsidered = businesses.length;

    metadata.sourceMaxDate = businesses.map(b => getBusinessClosingDate(b).date?.toISOString()).filter(Boolean).sort().pop() || null;
    metadata.fetchCompleted = true;
    metadata.fetchCompletedAt = new Date(clock()).toISOString();
    metadata.durationMs = clock() - started;
    metadata.datasetHash = crypto.createHash('sha256').update(canonicalJson(businesses)).digest('hex');
    logger('fetch_completed', metadata);
    return { businesses, metadata, recordPages };
  } catch (error) {
    metadata.durationMs = clock() - started;
    error.syncMetadata = metadata;
    logger('fetch_failed', { ...metadata, code: error.code || 'fetch_failed', page: error.page, status: error.status });
    throw error;
  }
}
module.exports = { collectBusinesses, retryAfterMs, canonicalJson, failure, log };
