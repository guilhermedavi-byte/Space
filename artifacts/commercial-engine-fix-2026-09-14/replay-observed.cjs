// Reproduce prior DOM observations. This is NOT a production transactional export.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const prior = path.join(root, 'artifacts/commercial-goals-production-audit-2026-09-14');
const obs = JSON.parse(fs.readFileSync(path.join(prior, 'observations.json')));
const history = JSON.parse(fs.readFileSync(path.join(prior, 'history-observations.json')));
const { reconcileExport } = require('../../scripts/reconcile-commercial-metrics');
const { resolveCommercialPeriod } = require('../../api/_lib/commercial-period');
const { partitionCommercialPeriod } = require('../../api/_lib/commercial-week');
const input = { identityKind:'business_number', source:{fetchCompleted:false,paginationCompleted:false},
  users:obs.users, growthPeople:obs.people, goals:obs.goals, sdrEventsComplete:false,
  businesses:obs.septemberDeals.map(d=>({id:d.number,number:d.number,name:d.name,total:d.value,wonDate:d.wonDate,
    stage:{name:'Fechado',pipeline:{name:d.pipeline}},attendant:{name:d.owner}})) };
const replay = reconcileExport(input);
// Historical DOM rows have neither UUID nor number: do not manufacture identities.
const historical = {};
for (const competencia of ['2026-07','2026-08']) {
  const goal=obs.goals[competencia];
  const period=resolveCommercialPeriod({now:new Date(`${competencia}-15T12:00:00-03:00`),periodStart:goal.periodStart,periodEnd:goal.periodEnd});
  const rows=history[competencia].deals;
  const weeks=partitionCommercialPeriod(period).map(p=>({...p,rows:rows.filter(d=>d.wonDate>=p.startDateKey&&d.wonDate<=p.endDateKey)}));
  for(const w of weeks)w.actual=w.rows.reduce((s,d)=>s+d.value,0);
  const monthly=rows.reduce((s,d)=>s+d.value,0),weekly=weeks.reduce((s,w)=>s+w.actual,0);
  historical[competencia]={identityCertified:false,meta:goal.valorMeta,monthly,weekly,delta:monthly-weekly,count:rows.length,weeks,
    calendarDuplicateRows:rows.filter(d=>weeks.filter(w=>d.wonDate>=w.startDateKey&&d.wonDate<=w.endDateKey).length>1).length,
    calendarUnallocatedRows:rows.filter(d=>!weeks.some(w=>d.wonDate>=w.startDateKey&&d.wonDate<=w.endDateKey)).length};
}
const result={scope:'LOCAL REPLAY OF PRIOR DOM OBSERVATIONS; NOT PRODUCTION DRY-RUN',certified:false,
  limits:['No transactional dealId export','Historical rows have no UUID/number','Gain day only; normalized midnight is not observed timestamp','No SDR event export','No source batch provenance'],
  historical,september:replay.months['2026-09'],weekly:replay.weekly,oldSnapshot:obs.crmLiveSnapshot,
  four:replay.weekly.rows.filter(d=>['11396','11296','8895','7580'].includes(d.number))};
fs.writeFileSync(path.join(__dirname,'observed-replay.json'),JSON.stringify(result,null,2),{mode:0o600});
console.log(JSON.stringify({certified:false,historical:Object.fromEntries(Object.entries(historical).map(([k,v])=>[k,{monthly:v.monthly,weekly:v.weekly,delta:v.delta,count:v.count,calendarDuplicateRows:v.calendarDuplicateRows,calendarUnallocatedRows:v.calendarUnallocatedRows}])),september:result.september.metrics,weekly:result.weekly.actualValue,four:result.four.map(d=>({number:d.number,value:d.value,responsibleId:d.responsibleId}))},null,2));
