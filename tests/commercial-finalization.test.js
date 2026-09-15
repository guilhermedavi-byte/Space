const test=require('node:test'),assert=require('node:assert/strict');
const {buildSdrEvidence}=require('../api/_lib/commercial-sdr-origin');
const {reconcileSdrAttribution}=require('../api/_lib/commercial-sdr');
const {backfill}=require('../scripts/commercial-certification/backfill.cjs');
test('historical absence after complete reads is no_attribution without lost revenue',()=>{
 const evidence=buildSdrEvidence([{id:'a'}],[],{sourceComplete:true,eventsComplete:true});
 const r=reconcileSdrAttribution([{id:'a',value:961,sourceSdrId:null}],evidence);
 assert.equal(r.pass,true);assert.equal(r.records[0].status,'no_attribution');assert.equal(r.unassigned_revenue,961);assert.equal(r.reconciliation_delta,0);
});
test('missing reads and broken explicit origins are never reclassified as historical absence',()=>{
 const rows=[{id:'a',value:961,sourceSdrId:'real-sdr'}];
 assert.equal(reconcileSdrAttribution(rows,buildSdrEvidence([{id:'a'}],[])).records[0].status,'not_loaded');
 assert.equal(reconcileSdrAttribution(rows,buildSdrEvidence([{id:'a',sdrId:'real-sdr'}],[],{sourceComplete:true,eventsComplete:true})).records[0].status,'source_error');
});
test('monthly backfill saves backup and snapshot atomically, verifies readback, and is idempotent',async()=>{
 const db=new Map(),commits=[];const store={read:async p=>db.get(p)||null,commit:async entries=>{for(const e of entries)assert.equal(db.has(e.path),false);commits.push(entries);for(const e of entries)db.set(e.path,{data:e.data,version:'v1'});}};
 const ledger={period:{startDateKey:'2026-07-01',endDateKey:'2026-08-01'},rows:[{id:'a',value:100,dateKey:'2026-07-10',dateField:'statusChangedAt',weekKey:'wk_2026-07-08',competencia:'2026-07',status:'Fechado',responsibleId:'outros',role:'aggregate'}],metrics:{monthly_realized:100}};
 const args={store,month:'2026-07',ledger,source:{pagesFetched:50,expectedPages:50}};
 assert.equal((await backfill(args)).financialDelta,0);assert.equal((await backfill(args)).operation,'unchanged');assert.equal(commits.length,1);assert.equal(commits[0].length,2);assert.equal(commits[0][0].data.existed,false);
 await assert.rejects(backfill({...args,month:'2026-09'}),/scope_rejected/);
});
