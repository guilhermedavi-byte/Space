const {buildSdrEvidence}=require('../../api/_lib/commercial-sdr-origin');
const {reconcileSdrAttribution}=require('../../api/_lib/commercial-sdr');
const {backfill}=require('./backfill.cjs');
module.exports=async()=>{
 const baseStore=require('../../api/_lib/crm-snapshot-store').createFirestoreStore();
 let writes=0;
 const store={read:p=>baseStore.read(p),commit:entries=>{
  if(entries.some(e=>!/^crmLiveSnapshot(Backups|s)\/[A-Za-z0-9_-]+$/.test(e.path)))throw Error('backfill_scope_rejected');
  writes+=entries.length;return baseStore.commit(entries);
 }};
 const source=await require('../../api/_lib/crm-source-snapshot').createSourceService({store:{read:store.read,commit:()=>{throw Error('source_write_forbidden');}},logger:()=>{}}).readOnly();
 if(!source.metadata.fetchCompleted||!source.metadata.paginationCompleted)throw Error('source_incomplete');
 const baseline=require('./certified-baseline.json'),byId=new Map(source.businesses.map(b=>[require('../../api/_lib/commercial-sales').getBusinessId(b),b]));
 const selected=Object.values(baseline).flatMap(m=>m.rows).map(r=>byId.get(r.dealId));
 if(selected.some(b=>!b))throw Error('certified_deal_missing');
 const events=await require('./read-sdr.cjs').readSdrEvents({getToken:async()=>(await require('../../_lib/google-service-account').getGoogleAccessToken({scope:'https://www.googleapis.com/auth/datastore'})).accessToken,decode:require('../../_lib/firestore-rest').decodeFields});
 const evidence=buildSdrEvidence(selected,events,{sourceComplete:true,eventsComplete:true});
 const rows=Object.values(baseline).flatMap(m=>m.rows).map(r=>({id:r.dealId,value:r.amount,sourceSdrId:byId.get(r.dealId).sdrUid||byId.get(r.dealId).sdrId||byId.get(r.dealId).sdr?.id||null}));
 const sdr=reconcileSdrAttribution(rows,evidence);
 const counts=Object.fromEntries(['value','no_attribution','source_error','not_loaded'].map(k=>[k,sdr.records.filter(r=>r.status===k).length]));
 if(!sdr.pass)return {certification:'FAIL',sdr:{status:'FAIL',...counts},snapshotWrites:writes};
 const {getDocumentAsAdmin,listCollectionAsAdmin}=require('../../api/_lib/firestore-admin');
 const goals={};for(const month of ['2026-06','2026-07','2026-08','2026-09']){try{goals[month]=await getDocumentAsAdmin('growthGoals/'+month);}catch(e){if(e.status!==404)throw e;goals[month]=null;}}
 const gp=require('../../api/_lib/growth-people'),{encodeFields}=require('../../_lib/firestore-rest');
 for(const g of Object.values(goals))if(g)g.weeklyGoals=gp.decodeWeeklyGoalsMap(g.weeklyGoals||{});
 const configs=(await listCollectionAsAdmin('growthPeople')).map(p=>gp.decodeGrowthPeopleDoc({name:'growthPeople/'+(p.personId||p.firestoreDocId),fields:encodeFields(p).fields}));
 const people=[...gp.buildActiveCommercialPeople(await listCollectionAsAdmin('users'),configs),...gp.getGrowthGoalBuckets()];
 let globalConfig;try{globalConfig=await getDocumentAsAdmin('growthConfig/crmLiveDefaults');}catch(e){if(e.status!==404)throw e;globalConfig=null;}
 const history=await listCollectionAsAdmin('crmLiveSnapshots'),plans=[];
 for(const month of ['2026-07','2026-08']){
  const ledger=require('../../api/_lib/commercial-reconciliation').buildCommercialLedger({competencia:month,goal:goals[month],goals,globalConfig,people,businesses:source.businesses,recordPages:source.recordPages});
  const expected=baseline[month],old=new Map(expected.rows.map(r=>[r.dealId,r]));
  if(ledger.rows.length!==expected.count||ledger.metrics.monthly_realized!==expected.revenue||ledger.rows.some(r=>{const e=old.get(r.id);return !e||r.value!==e.amount||r.closingDate!==e.revenueRecognitionTimestamp||r.responsibleId!==e.closerId||r.weekKey!==e.week;}))throw Error('certified_baseline_changed');
  const existing=history.filter(r=>r.payload?.month?.period?.monthKey===month).sort((a,b)=>String(a.generatedAt||'').localeCompare(String(b.generatedAt||''))).at(-1);
  plans.push({store,month,ledger,source:source.metadata,existingPath:existing?'crmLiveSnapshots/'+existing.firestoreDocId:undefined});
 }
 const snapshots=[];for(const p of plans)snapshots.push(await backfill(p));
 // A second application is a targeted idempotence check, not another audit.
 const repeated=[];for(const p of plans)repeated.push(await backfill(p));
 return {certification:'PASS',scope:'sdr_and_july_august_snapshots',sdr:{status:'PASS',...counts,financialDelta:sdr.reconciliation_delta},snapshots,idempotent:repeated.every(r=>r.operation==='unchanged'),snapshotWrites:writes,originalBusinessWrites:0};
};
