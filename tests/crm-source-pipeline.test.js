const test = require('node:test');
const assert = require('node:assert/strict');
const { collectBusinesses, retryAfterMs } = require('../api/_lib/datacrazy-ingestion');
const { createSourceService, STATE_PATH } = require('../api/_lib/crm-source-snapshot');
const { publishCrmSnapshot, runCrmSnapshot } = require('../api/_lib/crm-snapshot-publish');
const { describeSnapshot } = require('../api/_lib/crm-snapshot-freshness');
const { auditSource } = require('../api/_lib/crm-source-audit');
const { buildWeeklyGoalsReadModel } = require('../api/_lib/growth-people');
const silent = () => {};
const deal = (id, value = 42) => ({ id, total: value, status: 'won', stage: { name: 'Fechado', pipeline: { name: 'Conversão' } }, lastMovedAt: '2026-09-08T20:00:00-03:00', statusChangedAt: '2026-09-09T00:00:00-03:00', attendant: { id: 'sdr-a', name: 'SDR A' } });
const response = (status, data, after = '') => ({ status, ok: status === 200, headers: { get: () => after }, json: async () => data });
const harness = (responses, options = {}) => {
  let time = Date.parse('2026-09-14T12:00:00Z');
  const waits = [], calls = [], logs = [];
  return { waits, calls, logs, clock: () => time, advance: ms => { time += ms; },
    run: () => collectBusinesses({ apiKey: 'test-only', base: 'https://datacrazy.test', take: 2, paceMs: 10,
      clock: () => time, wait: async ms => { waits.push(ms); time += ms; }, random: () => 0,
      logger: (event, data) => logs.push({ event, ...data }), fetchImpl: async (url) => { calls.push(url); return responses.shift(); }, ...options }) };
};
function memoryStore() {
  const docs = new Map(); let version = 0;
  return { docs,
    async read(path) { return structuredClone(docs.get(path) || null); },
    async commit(entries) {
      for (const e of entries) if (e.version !== undefined && (docs.get(e.path)?.version ?? null) !== e.version) throw Object.assign(new Error('conflict'), { status: 409 });
      return entries.map(e => { const v = String(++version); docs.set(e.path, { data: structuredClone(e.data), version: v }); return v; });
    } };
}
const metricPayload = (metadata, id = 'snapshot-a') => {
  const rows=[{id:'a',value:42,dateKey:'2026-09-09',dateField:'statusChangedAt',weekKey:'wk_2026-09-09',competencia:'2026-09',status:'Fechado',responsibleId:'a',role:'closer'}];
  const metrics={monthly_weekly_delta:0,overlapping_periods:0,improper_gaps:0,orphan_deals:0,unallocated_revenue:0,duplicate_attribution_revenue:0,estimated_value_deals:0,invalid_financial_deals:0};
  return { snapshot: { ...metadata, snapshotId: id, status: 'VALID', sourceSnapshotId: metadata.snapshotId, calculationVersion: 4, calculationCompleted: true, calculatedAt: new Date().toISOString(), recordsEligible: 1, includedDeals:rows, monthlyIncludedDeals:rows, reconciliation:{month:metrics,week:metrics} }, weekly: { team: { closers: { actualValue: 42, count: 1 } }, closers: [{ personId: 'a', actualValue: 42, count: 1 }] }, month: { summary: { realizado: 42, totalVendas: 1 } } };
};

test('normal pagination: terminal page, counts, stable IDs and atomic publication', async () => {
  const h = harness([response(200, { items: [deal('b'), deal('a')], total: 3 }), response(200, { items: [deal('c')], total: 3 })]);
  const store = memoryStore();
  const source = await createSourceService({ store, collect: h.run, clock: h.clock, logger: silent }).get();
  assert.deepEqual(source.businesses.map(b => b.id), ['a','b','c']);
  assert.equal(source.metadata.pagesFetched, 2); assert.equal(source.metadata.expectedPages, 2);
  await publishCrmSnapshot(metricPayload(source.metadata), { store, logger: silent });
  assert.equal((await store.read('crmLiveCache/crm')).data.payload.snapshot.status, 'VALID');
  assert.equal((await store.read('crmLiveSnapshots/snapshot-a')).data.payload.weekly.team.closers.actualValue, 42);
});
test('429 recovers with exponential backoff, jitter, Retry-After and same page', async () => {
  const h = harness([response(429, {}, '3'), response(503, {}), response(200, { items: [deal('a')], total: 1 })]);
  const source = await h.run();
  assert.equal(source.metadata.retryCount, 2); assert.equal(source.metadata.datacrazy429Count, 1);
  assert.deepEqual(h.waits, [3000,1000]); assert.equal(new Set(h.calls).size, 1);
  assert.equal(h.logs.filter(l => l.event === 'request_retry').length, 2);
  const store = memoryStore(); await publishCrmSnapshot(metricPayload(source.metadata), { store, logger: silent });
  assert.ok(await store.read('crmLiveCache/crm'));
});
test('permanent 429: FAILED attempt, previous source and metric snapshot untouched, cooldown', async () => {
  const store = memoryStore(); const first = harness([response(200, { items: [deal('a')], total: 1 })]);
  const service = createSourceService({ store, collect: first.run, clock: first.clock, logger: silent });
  const old = await service.get(); await publishCrmSnapshot(metricPayload(old.metadata), { store, logger: silent });
  const before = await store.read('crmLiveCache/crm');
  first.advance(301000);
  const failing = harness(Array.from({ length: 5 }, () => response(429, {})));
  const next = createSourceService({ store, collect: failing.run, clock: first.clock, logger: silent });
  const fallback = await next.get();
  assert.equal(fallback.stale, true); assert.equal(fallback.lastAttempt.status, 'FAILED');
  assert.equal(failing.calls.length, 5); assert.equal((await store.read(STATE_PATH)).data.current.snapshotId, old.metadata.snapshotId);
  assert.deepEqual(await store.read('crmLiveCache/crm'), before);
  await next.get(); assert.equal(failing.calls.length, 5);
});
test('intermediate failure and pagination safety cap cannot publish partial datasets', async () => {
  for (const variant of ['fail','cap','short','totalChange','invalid']) {
    const store = memoryStore();
    const pages = variant === 'invalid' ? [response(200, { nonsense: true })] : [response(200, { items: [deal('a'),deal('b')], total: 3 }),
      variant === 'fail' ? response(403, {}) : response(200, { items: [], total: variant === 'totalChange' ? 4 : 3 })];
    const h = harness(pages, variant === 'cap' ? { maxPages: 1 } : {});
    await assert.rejects(createSourceService({ store, collect: h.run, logger: silent }).get({ allowStale: false }));
    assert.equal((await store.read(STATE_PATH)).data.lastAttempt.status, 'FAILED');
    assert.equal((await store.read(STATE_PATH)).data.current, undefined);
    assert.equal(await store.read('crmLiveCache/crm'), null);
  }
});
test('idempotence: repeated identical IDs do not change total, reordered pages preserve hash; conflicting IDs fail', async () => {
  const a = await harness([response(200, [deal('b'),deal('a')]),response(200, [deal('a')])]).run();
  const b = await harness([response(200, [deal('a'),deal('b')]),response(200, [])]).run();
  assert.equal(a.metadata.datasetHash, b.metadata.datasetHash); assert.equal(a.businesses.length, 2);
  await assert.rejects(harness([response(200, [deal('a'),deal('a', 99)])]).run(), /conflicting_duplicate/);
});
test('distributed concurrency: only one worker collects; expired worker is fenced', async () => {
  const store = memoryStore(); const h = harness([response(200, { items: [deal('a')], total: 1 })]);
  let release, entered; const started = new Promise(r=>{entered=r;}); const blocked = new Promise(r=>{release=r;}); let calls=0;
  const collect = async () => { calls++; entered(); await blocked; return h.run(); };
  const first = createSourceService({ store, collect, clock: h.clock, logger: silent }).get({ allowStale: false });
  await started;
  await assert.rejects(createSourceService({ store, collect, clock: h.clock, logger: silent }).get({ allowStale: false }), /pending/);
  assert.equal(calls, 1);
  h.advance(261000);
  const fresh = harness([response(200, { items: [deal('new')], total: 1 })]);
  const winner = await createSourceService({ store, collect: fresh.run, clock: h.clock, logger: silent }).get();
  release(); await assert.rejects(first);
  assert.equal((await store.read(STATE_PATH)).data.current.snapshotId, winner.metadata.snapshotId);
});
test('quality gate and calculation failure leave current intact', async () => {
  const store = memoryStore(); const source = await harness([response(200, [deal('a')])]).run();
  const original = metricPayload(source.metadata);
  await publishCrmSnapshot(original, { store, logger: silent });
  const before = await store.read('crmLiveCache/crm');
  await assert.rejects(publishCrmSnapshot({ ...original, snapshot: { ...original.snapshot, paginationCompleted: false } }, { store, logger: silent }), /quality_gate/);
  await assert.rejects(runCrmSnapshot(async()=>{throw new Error('calculation_error');},{store,logger:silent}));
  assert.deepEqual(await store.read('crmLiveCache/crm'), before);
  assert.ok([...store.docs.values()].some(r=>r.data.snapshot?.status === 'FAILED'));
});
test('gain date includes restored sale on new day, and SDR revenues remain in team', async () => {
  const source = await harness([response(200, [deal('a'),deal('b', 17)]),response(200, [deal('c', 23)])]).run();
  const audit = auditSource(source, '2026-09-09', '2026-09-14');
  assert.equal(audit.actualValue, 82); assert.equal(audit.count, 3);
  assert.ok(audit.rows.every(r=>r.included && r.closingDateField === 'statusChangedAt'));
  const weekly = buildWeeklyGoalsReadModel({ businesses: source.businesses, people: [{ personId:'sdr-a', displayName:'SDR A', active:true, roles:['sdr'], crmAttendantIds:['sdr-a'], crmAttendantAliases:[], sdrEmails:[] }], goal: null, now: new Date('2026-09-14T12:00:00Z') });
  assert.equal(weekly.closedSales.actualValue, 82);
  assert.equal(weekly.progress.closers.reduce((s,r)=>s+r.actualValue,0), 82);
});
test('freshness: legacy, failures and aged browser fallbacks never look fresh', () => {
  const now = Date.parse('2026-09-14T12:00:00Z');
  const data = { snapshot: { status:'VALID', calculationVersion:4, fetchCompletedAt:new Date(now).toISOString() } };
  assert.equal(describeSnapshot(data,false,now).pending,false);
  assert.match(describeSnapshot(data,true,now).text,/Atualização pendente/);
  assert.equal(describeSnapshot(data,false,now+301000).pending,true);
  assert.equal(describeSnapshot({generatedAt:new Date(now).toISOString()},false,now).pending,true);
  assert.equal(retryAfterMs('Mon, 14 Sep 2026 12:00:04 GMT',now),4000);
});
test('Retry-After beyond job deadline fails without another request; 401 does not retry', async () => {
  const h=harness([response(429,{},'999')],{budgetMs:10000});
  await assert.rejects(h.run(),/deadline/); assert.equal(h.calls.length,1);
  const auth=harness([response(401,{})]); await assert.rejects(auth.run()); assert.equal(auth.calls.length,1);
});

test('publication rejects late old sources and failed atomic commits do not change current', async () => {
  const store = memoryStore(); const source = await harness([response(200, [deal('a')])]).run();
  const current = metricPayload(source.metadata, 'current');
  await publishCrmSnapshot(current, { store, logger: silent });
  const old = metricPayload({...source.metadata, fetchStartedAt:'2020-01-01T00:00:00Z'}, 'older');
  assert.equal((await publishCrmSnapshot(old, { store, logger:silent })).snapshot.snapshotId, 'current');
  const broken = { ...store, commit:async()=>{throw Object.assign(new Error('unavailable'),{status:503});} };
  const next = metricPayload({...source.metadata, fetchStartedAt:'2030-01-01T00:00:00Z'}, 'next');
  await assert.rejects(publishCrmSnapshot(next, {store:broken,logger:silent}));
  assert.equal((await store.read('crmLiveCache/crm')).data.payload.snapshot.snapshotId, 'current');
  assert.equal(await store.read('crmLiveSnapshots/next'), null);
});
test('request timeout retries and missing IDs fail closed', async () => {
  let calls=0;
  const h=harness([], {fetchImpl:async()=>{ if (++calls===1) throw Object.assign(new Error('timeout'),{name:'TimeoutError'}); return response(200,[deal('a')]); }});
  assert.equal((await h.run()).metadata.retryCount,1);
  await assert.rejects(harness([response(200,[{total:1}])]).run(),/missing_business_id/);
});

test('daily rollups reconcile full counts idempotently instead of incrementing replayed sales', async () => {
  const { publishDailyCounts } = require('../api/_lib/crm-daily-rollups');
  const store=memoryStore(); const dataset=await harness([response(200,[deal('a'),deal('b')]),response(200,[])]).run();
  const args={businesses:dataset.businesses,source:{...dataset.metadata,status:'VALID'},period:{startDateKey:'2026-09-09',endDateKey:'2026-09-14'}};
  await publishDailyCounts(args,{store}); await publishDailyCounts(args,{store});
  assert.equal((await store.read('crmLiveDailyRollups/2026-09-09')).data.count,2);
  await assert.rejects(publishDailyCounts({...args,source:{...args.source,paginationCompleted:false}},{store}));
});
