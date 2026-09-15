// Reproduce prior DOM observations. This is NOT a production transactional export.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const prior = path.join(root, 'artifacts/commercial-goals-production-audit-2026-09-14');
const obs = JSON.parse(fs.readFileSync(path.join(prior, 'observations.json')));
const history = JSON.parse(fs.readFileSync(path.join(prior, 'history-observations.json')));
const { reconcileExport } = require('../../scripts/reconcile-commercial-metrics');
const input = { identityKind:'business_number', source:{fetchCompleted:false,paginationCompleted:false},
  users:obs.users, growthPeople:obs.people, goals:obs.goals, sdrEventsComplete:false,
  businesses:obs.septemberDeals.map(d=>({id:d.number,number:d.number,name:d.name,total:d.value,wonDate:d.wonDate,
    stage:{name:'Fechado',pipeline:{name:d.pipeline}},attendant:{name:d.owner}})) };
const replay = reconcileExport(input);
// Historical DOM rows have neither UUID nor number: do not manufacture identities.
const historical = Object.fromEntries(['2026-07','2026-08'].map(key=>[key,{
  identityCertified:false,status:'not_loaded',reason:'missing_dealId',
  observations:history[key].deals,
}]));
const result={scope:'LOCAL REPLAY OF PRIOR DOM OBSERVATIONS; NOT PRODUCTION DRY-RUN',certified:false,
  limits:['No transactional dealId export','Historical rows have no UUID/number','Gain day only; normalized midnight is not observed timestamp','No SDR event export','No source batch provenance'],
  historical,september:replay.months['2026-09'],weekly:replay.weekly,oldSnapshot:obs.crmLiveSnapshot,
  four:replay.weekly.rows.filter(d=>['11396','11296','8895','7580'].includes(d.number))};
fs.writeFileSync(path.join(process.env.COMMERCIAL_REPLAY_OUTPUT||__dirname,'observed-replay.json'),JSON.stringify(result,null,2),{mode:0o600});
console.log(JSON.stringify({certified:false,historicalStatus:'not_loaded: missing_dealId',september:result.september.metrics,weekly:result.weekly.actualValue},null,2));
