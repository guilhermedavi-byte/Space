#!/usr/bin/env node
// Read-only production collector + deterministic offline audit. No publish/backfill path.
// node scripts/reconcile-commercial-metrics.js --input /secure/export.json --output /local/report.json
// node scripts/reconcile-commercial-metrics.js --production-read-only --output /local/report.json
const fs=require('node:fs');
const {assessStoredSnapshot}=require('../api/_lib/crm-snapshot-publish');
const {reconcileSdrAttribution}=require('../api/_lib/commercial-sdr');
const {buildCommercialLedger,compareDealLedgers}=require('../api/_lib/commercial-reconciliation');
const {buildActiveCommercialPeople,getGrowthGoalBuckets,decodeWeeklyGoalsMap,decodeGrowthPeopleDoc,buildWeeklyGoalsReadModel}=require('../api/_lib/growth-people');
const {encodeFields}=require('../_lib/firestore-rest');
const {buildCommercialGoalsModel}=require('../api/_lib/commercial-goals');
const {buildMonthSummary,buildWeeklyTeamSummary}=require('../api/_lib/crm-live');
function reconcileExport(input){
  if(!Array.isArray(input.businesses)||!Array.isArray(input.users)||!input.goals)throw new Error('incomplete_export');
  const goals=Object.fromEntries(Object.entries(input.goals).map(([key,g])=>[key,g?{...g,competencia:key,weeklyGoals:decodeWeeklyGoalsMap(g.weeklyGoals||{})}:null]));
  const configs=(input.growthPeople||[]).map(p=>decodeGrowthPeopleDoc({name:`growthPeople/${p.personId||p.firestoreDocId}`,fields:encodeFields(p).fields}));
  const people=[...buildActiveCommercialPeople(input.users,configs),...getGrowthGoalBuckets()];
  const sourceComplete=input.source?.fetchCompleted===true&&input.source?.paginationCompleted===true&&input.identityKind==='dealId';
  const months={};
  for(const competencia of ['2026-07','2026-08','2026-09']){
    const goal=goals[competencia],now=new Date(`${competencia}-14T12:00:00-03:00`);
    const ledger=buildCommercialLedger({competencia,goal,goals,people,businesses:input.businesses,globalConfig:input.globalConfig,recordPages:input.recordPages});
    const previousKey=new Date(Date.UTC(Number(competencia.slice(0,4)),Number(competencia.slice(5))-2,15)).toISOString().slice(0,7);
    const management=buildCommercialGoalsModel({competencia,goal,previousGoal:goals[previousKey],people,businesses:input.businesses,sdrEvents:input.sdrEvents||[],globalConfig:input.globalConfig,now});
    const month=buildMonthSummary({businesses:input.businesses,goal,now});
    const snap=input.snapshots?.[competencia];
    const snapshotComparison=compareDealLedgers(ledger.rows,snap?.snapshot?.monthlyIncludedDeals);
    const managementComparison=compareDealLedgers(ledger.rows,management.reconciliation.rows);
    const sets={SOURCE_DEALS:input.businesses,CANONICAL_MONTHLY_DEALS:ledger.rows,
      CANONICAL_WEEKLY_DEALS:ledger.weekly.flatMap(w=>w.rows),CRM_LIVE_DEALS:month.includedDeals,
      GOALS_DEALS:management.reconciliation.rows,SNAPSHOT_DEALS:snap?.snapshot?.monthlyIncludedDeals??null};
    const monthlyWeekly=compareDealLedgers(sets.CANONICAL_MONTHLY_DEALS,sets.CANONICAL_WEEKLY_DEALS);
    const crmGoals=compareDealLedgers(sets.GOALS_DEALS,sets.CRM_LIVE_DEALS,{fields:['value','dateKey','dateField'],attribution:false});
    const sdrAttribution=reconcileSdrAttribution(ledger.rows,input.sdrAttribution);
    const sdr=ledger.weekly.map(part=>{
      const owner=part.fullWeekStartDateKey.slice(0,7);
      return buildWeeklyGoalsReadModel({goal:goals[owner],people,businesses:[],sdrEvents:(input.sdrEvents||[]).filter(e=>e.dateKey>=part.startDateKey&&e.dateKey<=part.endDateKey),globalConfig:input.globalConfig,now:new Date(part.start+'')}).sdrReconciliation;
    });
    months[competencia]={sets,monthlyWeekly,crmGoals,sdrAttribution,snapshotAssessment:assessStoredSnapshot(snap,ledger.rows,'month'),meta:goal?.valorMeta??null,ledger,metrics:{...ledger.metrics,
      crm_live_metas_delta:month.summary.realizado-management.month.summary.realizado,
      snapshot_delta:snap?.month?.summary? snap.month.summary.realizado-ledger.metrics.monthly_realized:null,
      snapshot_reconciliation_rate:snapshotComparison.snapshot_reconciliation_rate},snapshotComparison,managementComparison,
      sdr:{available:input.sdrEventsComplete===true,partitions:sdr,unallocated:sdr.reduce((s,p)=>s+p.metrics.unallocated_events,0),missingIds:sdr.reduce((s,p)=>s+p.metrics.missing_event_ids,0)}};
  }
  const now=new Date('2026-09-14T12:00:00-03:00');
  const w=buildWeeklyGoalsReadModel({goal:goals['2026-09'],people,businesses:input.businesses,sdrEvents:input.sdrEvents||[],globalConfig:input.globalConfig,now});
  const ledger=buildCommercialLedger({competencia:'2026-09',goal:goals['2026-09'],goals,people,businesses:input.businesses,periodOverride:w.commercialWeek,recordPages:input.recordPages});
  const weeklySnapshot=input.snapshots?.['2026-09'];
  const weekly={...buildWeeklyTeamSummary({weeklyReadModel:w}).closers,rows:ledger.rows,
    snapshotComparison:compareDealLedgers(ledger.rows,weeklySnapshot?.snapshot?.includedDeals),
    snapshotAssessment:assessStoredSnapshot(weeklySnapshot,ledger.rows),
    oldSnapshotValue:weeklySnapshot?.weekly?.team?.closers?.actualValue??null};
  const invariantPass=Object.values(months).every(m=>['monthly_weekly_delta','overlapping_periods','improper_gaps','orphan_deals','unallocated_revenue','duplicate_attribution_revenue','estimated_value_deals','invalid_financial_deals','unverified_revenue_dates','crm_live_metas_delta'].every(k=>m.metrics[k]===0));
  const certified=sourceComplete&&input.sdrEventsComplete===true&&invariantPass&&Object.values(months).every(m=>m.snapshotComparison.pass&&m.managementComparison.pass&&m.monthlyWeekly.pass&&m.crmGoals.pass&&m.sdrAttribution.pass&&m.sdr.unallocated===0&&m.sdr.missingIds===0)&&weekly.snapshotComparison.pass;
  return {result:certified?'PASS':'FAIL',certified,sourceComplete,productionAltered:false,deployExecuted:false,source:input.source||null,identityKind:input.identityKind||'unknown',months,weekly,
    limits:!sourceComplete?['Not a certified complete transactional export with dealId; replay is not a production dry-run.']:[]};
}
async function collectProduction(){
  // Only list/get reads and Datacrazy GET collection. Deliberately DO NOT import
  // getCompleteCrmSource(), runCrmSnapshot(), or a publication/backfill endpoint.
  const missing=['CRM_API_BASE_URL','CRM_API_KEY'].filter(k=>!process.env[k]);
  if(missing.length)throw new Error('missing_local_'+missing.join('_and_'));
  // Firestore uses the runtime service-account resolver, including supported aliases.
  const {listCollectionAsAdmin,getDocumentAsAdmin}=require('../api/_lib/firestore-admin');
  const {collectBusinesses}=require('../api/_lib/datacrazy-ingestion');
  const read=async p=>{try{return await getDocumentAsAdmin(p)}catch(e){if(e.status===404)return null;throw e}};
  const source=await collectBusinesses({logger:()=>{}});
  const goals={};for(const key of ['2026-06','2026-07','2026-08','2026-09','2026-10'])goals[key]=await read(`growthGoals/${key}`);
  const users=(await listCollectionAsAdmin('users')).map(u=>Object.fromEntries(['firestoreDocId','uid','userId','nome','nomeCompleto','fullName','displayName','name','tipo','role','type','perfil','ativo','email'].filter(k=>u[k]!==undefined).map(k=>[k,u[k]])));
  const growthPeople=await listCollectionAsAdmin('growthPeople'),sdrEvents=await listCollectionAsAdmin('sdrActivityEvents');
  const current=await read('crmLiveCache/crm');
  // History export is read-only; select by actual period, not current clock.
  const history=await listCollectionAsAdmin('crmLiveSnapshots');const snapshots={};
  for(const record of [...history,current].filter(Boolean).sort((a,b)=>String(a.generatedAt||'').localeCompare(String(b.generatedAt||'')))){
    const payload=record.payload;if(!payload?.month?.period?.monthKey)continue;
    snapshots[payload.month.period.monthKey]=payload;
  }
  return {businesses:source.businesses,recordPages:source.recordPages,source:source.metadata,identityKind:'dealId',users,growthPeople,goals,sdrEvents,sdrEventsComplete:true,globalConfig:await read('growthConfig/crmLiveDefaults'),snapshots};
}
if(require.main===module)(async()=>{
  const args=process.argv.slice(2),value=flag=>args[args.indexOf(flag)+1];
  const input=args.includes('--production-read-only')?await collectProduction():JSON.parse(fs.readFileSync(value('--input'),'utf8'));
  const result=reconcileExport(input);const output=JSON.stringify(result,null,2);
  if(args.includes('--output'))fs.writeFileSync(value('--output'),output,{mode:0o600});else console.log(output);
  if(!result.certified)process.exitCode=2;
})().catch(e=>{console.error(JSON.stringify({result:'FAIL',code:e.code||e.message,productionAltered:false,deployExecuted:false}));process.exitCode=1;});
module.exports={reconcileExport,collectProduction};
