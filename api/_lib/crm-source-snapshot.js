const crypto = require('crypto');
const { gzipSync, gunzipSync } = require('zlib');
const { collectBusinesses, canonicalJson, failure, log } = require('./datacrazy-ingestion');
const { createFirestoreStore } = require('./crm-snapshot-store');
const SOURCE_VERSION = 1;
const SOURCE_TTL_MS = 5 * 60 * 1000;
const LEASE_MS = 260000;
const STATE_PATH = 'crmLiveSync/source';
const createSourceService = ({ store = createFirestoreStore(), collect = collectBusinesses, clock = Date.now, logger = log } = {}) => {
  const hydrate = async (manifest, attempt, stale) => {
    if (!manifest || manifest.status !== 'VALID' || manifest.sourceVersion !== SOURCE_VERSION) throw failure('no_complete_crm_source', { status: 503 });
    const encoded = [];
    for (const path of manifest.chunks) {
      const chunk = await store.read(path);
      if (!chunk?.data?.content) throw failure('missing_dataset_chunk');
      encoded.push(chunk.data.content);
    }
    const businesses = JSON.parse(gunzipSync(Buffer.from(encoded.join(''), 'base64')).toString());
    const hash = crypto.createHash('sha256').update(canonicalJson(businesses)).digest('hex');
    if (hash !== manifest.datasetHash || businesses.length !== manifest.recordsConsidered) throw failure('dataset_integrity_failed');
    let recordPages = {};
    if (manifest.provenanceChunks?.length) {
      const parts=[];
      for(const path of manifest.provenanceChunks){const chunk=await store.read(path);if(!chunk?.data?.content)throw failure('missing_provenance_chunk');parts.push(chunk.data.content);}
      const json=gunzipSync(Buffer.from(parts.join(''),'base64')).toString();
      if(crypto.createHash('sha256').update(json).digest('hex')!==manifest.provenanceHash)throw failure('provenance_integrity_failed');
      recordPages=JSON.parse(json);
    }
    return { businesses, recordPages, metadata: manifest, stale, lastAttempt: attempt || null,
      pagination: { ...manifest, pages: manifest.pagesFetched, totalFetched: manifest.recordsFetched, source: 'datacrazy-complete-snapshot' } };
  };
  return {
    async readOnly() {
      const prior = await store.read(STATE_PATH);
      const state = prior?.data || {};
      const age = clock() - Date.parse(state.current?.fetchCompletedAt || '');
      return hydrate(state.current, state.lastAttempt, !Number.isFinite(age) || age < 0 || age >= SOURCE_TTL_MS || state.lastAttempt?.status === 'FAILED');
    },
    async get({ allowStale = true } = {}) {
      const prior = await store.read(STATE_PATH);
      const state = prior?.data || {};
      const age = clock() - Date.parse(state.current?.fetchCompletedAt || '');
      if (state.current?.sourceVersion === SOURCE_VERSION && age >= 0 && age < SOURCE_TTL_MS && state.lastAttempt?.status !== 'FAILED') return hydrate(state.current, state.lastAttempt, false);
      if (Number(state.leaseUntil || 0) > clock() || Number(state.retryNotBefore || 0) > clock()) {
        if (allowStale && state.current) return hydrate(state.current, state.lastAttempt, true);
        throw failure('crm_sync_pending', { status: 503, retryAfterMs: Math.max(state.leaseUntil || 0, state.retryNotBefore || 0) - clock() });
      }
      const snapshotId = crypto.randomUUID();
      const runPath = `crmLiveSyncRuns/${snapshotId}`;
      const attempt = { snapshotId, status: 'PROCESSING', fetchStartedAt: new Date(clock()).toISOString(), error: null };
      let leaseVersion;
      try {
        [leaseVersion] = await store.commit([
          { path: STATE_PATH, data: { ...state, leaseUntil: clock() + LEASE_MS, lastAttempt: attempt }, version: prior?.version ?? null },
          { path: runPath, data: attempt, version: null },
        ]);
      } catch (error) {
        // Only a CAS conflict means another worker owns the lease. Fail closed on storage errors.
        if (![409, 412].includes(error.status)) throw error;
        const current = await store.read(STATE_PATH);
        if (allowStale && current?.data.current) return hydrate(current.data.current, current.data.lastAttempt, true);
        throw failure('crm_sync_pending', { status: 503 });
      }
      let result;
      try {
        logger('sync_started', { snapshotId });
        result = await collect({ snapshotId });
        const m = result.metadata;
        if (!m.fetchCompleted || !m.paginationCompleted || (m.expectedPages !== null && m.pagesFetched !== m.expectedPages)) throw failure('source_quality_gate_failed');
        let chunks = state.current?.datasetHash === m.datasetHash ? state.current.chunks : null;
        if (!chunks) {
          chunks = [];
          const content = gzipSync(canonicalJson(result.businesses)).toString('base64');
          // Strings avoid Firestore nested-array restrictions and stay well below the 1 MiB document limit.
          for (let offset = 0; offset < content.length; offset += 500000) {
            const path = `crmLiveDatasetChunks/${m.datasetHash}-${chunks.length}`;
            await store.commit([{ path, data: { content: content.slice(offset, offset + 500000) } }]);
            chunks.push(path);
          }
        }
        const provenanceChunks=[];
        const provenanceJson=canonicalJson(result.recordPages || {});
        const provenanceHash=crypto.createHash('sha256').update(provenanceJson).digest('hex');
        const provenanceContent=gzipSync(provenanceJson).toString('base64');
        for(let offset=0;offset<provenanceContent.length;offset+=500000){
          const path=`crmLiveDatasetChunks/pages-${provenanceHash}-${provenanceChunks.length}`;
          await store.commit([{path,data:{content:provenanceContent.slice(offset,offset+500000)}}]);provenanceChunks.push(path);
        }
        const manifest = { ...m, provenanceChunks, provenanceHash, sourceVersion: SOURCE_VERSION, status: 'VALID', error: null, chunks };
        // Staging chunks cannot be read as current before this atomic, fenced commit.
        await store.commit([
          { path: STATE_PATH, data: { current: manifest, leaseUntil: 0, retryNotBefore: 0, lastAttempt: manifest }, version: leaseVersion },
          { path: runPath, data: manifest },
        ]);
        logger('source_published', { snapshotId, recordsFetched: m.recordsFetched, sync_success_rate: 1, sync_duration: m.durationMs, datacrazy_429_count: m.datacrazy429Count, datacrazy_retry_count: m.retryCount });
        return { businesses: result.businesses, recordPages: result.recordPages || {}, metadata: manifest, stale: false, lastAttempt: manifest,
          pagination: { ...m, pages: m.pagesFetched, totalFetched: m.recordsFetched, source: 'datacrazy-complete-snapshot' } };
      } catch (error) {
        const failed = { ...attempt, ...(error.syncMetadata || result?.metadata || {}), status: 'FAILED', failedAt: new Date(clock()).toISOString(),
          error: { code: error.code || 'sync_failed', status: error.status || 0, page: error.page || (error.syncMetadata?.pagesFetched || 0) + 1 },
          durationMs: clock() - Date.parse(attempt.fetchStartedAt) };
        // Do not replace current. A lost lease cannot publish or release a newer worker's lock.
        await store.commit([
          { path: STATE_PATH, data: { ...state, leaseUntil: 0, retryNotBefore: clock() + Math.max(120000, error.retryAfterMs || 0), lastAttempt: failed }, version: leaseVersion },
          { path: runPath, data: failed },
        ]).catch(() => logger('failure_record_not_committed', { snapshotId, code: 'lease_lost_or_store_unavailable' }));
        logger('sync_failed', { snapshotId, error: failed.error, sync_success_rate: 0, durationMs: failed.durationMs });
        if (allowStale && state.current) return hydrate(state.current, failed, true);
        throw error;
      }
    },
  };
};
let service;
const getCompleteCrmSource = (options) => (service ||= createSourceService()).get(options);
const readCompleteCrmSource = () => (service ||= createSourceService()).readOnly();
module.exports = { readCompleteCrmSource, createSourceService, getCompleteCrmSource, SOURCE_TTL_MS, STATE_PATH };
