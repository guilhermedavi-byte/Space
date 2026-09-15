// LOCAL AUDIT ONLY. No production requests or writes. Input is observed DOM data,
// not a raw CRM API export. Historical UI aggregates are explicitly independent.
const fs=require('fs'),path=require('path'),http=require('http');
const root=path.resolve(__dirname,'../..');
const {buildCommercialGoalsModel}=require(path.join(root,'api/_lib/commercial-goals'));
const {buildActiveCommercialPeople,getGrowthGoalBuckets,decodeWeeklyGoalsMap}=require(path.join(root,'api/_lib/growth-people'));
const {buildMonthSummary,buildWeeklyTeamSummary}=require(path.join(root,'api/_lib/crm-live'));
const {buildWeeklyGoalsReadModel}=require(path.join(root,'api/_lib/growth-people'));
const obs=JSON.parse(fs.readFileSync(path.join(__dirname,'observations.json')));
const hist=JSON.parse(fs.readFileSync(path.join(__dirname,'history-observations.json')));
const people=[...buildActiveCommercialPeople(obs.users,obs.people),...getGrowthGoalBuckets()];
const goals=Object.fromEntries(Object.entries(obs.goals).map(([key,g])=>[key,{...g,weeklyGoals:decodeWeeklyGoalsMap(g.weeklyGoals||{})}]));
// Real business numbers identify current observations. wonDate contains the actual
// displayed calendar day plus a timezone marker for replay, NOT an observed time.
const businesses=obs.septemberDeals.map(d=>({id:d.number,name:d.name,total:d.value,wonDate:d.wonDate+'T12:00:00-03:00',stage:{name:'Fechado',pipeline:{name:d.pipeline}},attendant:{name:d.owner}}));
const models={};
for(const key of Object.keys(goals)){
 const m=buildCommercialGoalsModel({competencia:key,goal:goals[key],previousGoal:goals[key==='2026-09'?'2026-08':'2026-07'],people,businesses:key==='2026-09'?businesses:[],now:new Date('2026-09-14T23:02:50.843Z')});
 if(key!=='2026-09'){
  // Historical UUIDs/numbers unavailable: never invent IDs to certify selection.
  // Only UI display is replayed from independently summed visible source rows.
  const ds=[...hist['2026-07'].deals,...hist['2026-08'].deals,...obs.septemberDeals];
  const summarize=(start,end)=>{const rows=ds.filter(d=>d.wonDate>=start&&d.wonDate<=end);return {actual:rows.reduce((s,d)=>s+d.value,0),count:rows.length}};
  const a=summarize(m.month.period.startDateKey,m.month.period.endDateKey),target=m.month.summary.meta;
  Object.assign(m.month.summary,{realizado:a.actual,totalVendas:a.count,ticketMedio:a.actual/a.count,percentAtingimento:a.actual/target*100,gap:Math.max(0,target-a.actual)});
  for(const w of m.weeks){const a=summarize(w.startDateKey,w.endDateKey),t=w.summary.targetValue;Object.assign(w.summary,{actualValue:a.actual,count:a.count,ticketMedio:a.count?a.actual/a.count:0,progressPct:t?a.actual/t*100:0,missingValue:Math.max(0,t-a.actual)});}
 }
 // SDR events were unavailable. Do not represent absent input as real zero activity.
 for(const w of m.weeks)w.progress.sdrs=w.progress.sdrs.map(r=>({...r,actualValue:null,count:null,progressPct:null}));
 models[key]=m;
}
const current=models['2026-09'];
const b=buildMonthSummary({businesses,goal:goals['2026-09'],now:new Date('2026-09-14T23:02:50Z')});
const bw=buildWeeklyTeamSummary({weeklyReadModel:buildWeeklyGoalsReadModel({goal:goals['2026-09'],people,businesses,now:new Date('2026-09-14T23:02:50Z')})});
const reconciliation={scope:'Replay of real DOM observations, not production API execution',A:current.month.summary,B:b.summary,weeklyA:current.weeks[1].summary,weeklyB:bw.closers,cache:obs.crmLiveSnapshot,peopleCount:people.filter(p=>!p.isAggregate).length};
fs.writeFileSync(path.join(__dirname,'replay-models.json'),JSON.stringify(models,null,2));
fs.writeFileSync(path.join(__dirname,'reconciliation.json'),JSON.stringify(reconciliation,null,2));
console.log(JSON.stringify({current:current.month.summary,week:current.weeks[1].summary,planning:current.planning,augustWeeks:models['2026-08'].weeks.map(w=>({start:w.startDateKey,end:w.endDateKey,actual:w.summary.actualValue,target:w.summary.targetValue}))}));
if(process.argv.includes('--serve')) http.createServer((req,res)=>{
 if(req.method!=='GET'){res.writeHead(405);return res.end('Auditoria read-only');}
 const url=new URL(req.url,'http://127.0.0.1');
 if(url.pathname==='/api/growth-dashboard'){const m=models[url.searchParams.get('competencia')];res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({management:m}));}
 if(['/styles.css','/commercial-goals.js'].includes(url.pathname)){res.setHeader('Content-Type',url.pathname.endsWith('.css')?'text/css':'application/javascript');return res.end(fs.readFileSync(path.join(root,url.pathname.slice(1))));}
 res.setHeader('Content-Type','text/html; charset=utf-8');res.end(`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Auditoria local — Comercial Metas</title><link rel="stylesheet" href="/styles.css"><style>body{display:block;margin:0;background:var(--app-bg-gradient);color:var(--text-main)}main{max-width:1180px;margin:24px auto;padding:24px}aside{padding:16px;background:#fff3c9;color:#182331;font:14px system-ui}</style><aside>REPRODUÇÃO LOCAL — dados reais transcritos; referência 14/09/2026. Sem conexão com produção. Setembro: helpers atuais com observações normalizadas. Histórico: somas independentes para conferir a UI; seleção por UUID não certificada. Eventos SDR não extraídos. Escrita bloqueada.</aside><main id="root"></main><script src="/commercial-goals.js"></script><script>SpaceCommercialGoals.create({root:document.getElementById('root'),currentCompetencia:'2026-09',fetchWithAuth:(url,options)=>{if(options.method!=='GET')throw new Error('audit_read_only');return fetch(url,options)}}).load();</script></html>`);
}).listen(4179,'127.0.0.1',()=>console.log('Audit preview http://127.0.0.1:4179'));
