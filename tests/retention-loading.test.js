const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const H=require('../api/_lib/retention-health-engine');
function store({fail='',hangActivities=false}={}){
 const timers=[];
 const module={exports:{}};
 const ctx=vm.createContext({module,console,Date,Promise,setTimeout:fn=>{timers.push(fn);return fn;},clearTimeout:()=>{},require:name=>{
  if(name==='./supabase-rest')return {supabaseFetch:async path=>{
   if(path.startsWith('/'+fail+'?')&&fail)throw Error('source unavailable');
   return {data:path.startsWith('/retention_population_snapshots?')?[{snapshot_date:'2026-09-25',data:{}}]:[]};
  }};
  if(name==='./firestore-admin')return {listCollectionAsAdmin:()=>hangActivities?new Promise(()=>{}):Promise.resolve([])};
  if(name==='./retention-health-engine')return H;
  if(name==='./retention-health-lifecycle')return require('../api/_lib/retention-health-lifecycle');
  throw Error(name);
 }});
 vm.runInContext(fs.readFileSync(require.resolve('../api/_lib/retention-health-store'),'utf8'),ctx);
 return {read:module.exports.readIntelligence,timers};
}
test('Optional source failure degrades with explicit warning',async()=>{
 const s=store({fail:'student_quality_pulses'}),data=await s.read('2026-09');
 assert.equal(data.rows.length,0);assert.ok(data.source_warnings.includes('Quality Pulse'));
});
test('Optional hanging activities are bounded',async()=>{
 const s=store({hangActivities:true}),pending=s.read('2026-09');
 await new Promise(setImmediate);s.timers.forEach(fn=>fn());
 const data=await pending;assert.ok(data.source_warnings.includes('Atividades atuais (usando snapshot)'));
});
test('Mandatory lifecycle source failure never masquerades as empty success',async()=>{
 await assert.rejects(store({fail:'subscriptions'}).read('2026-09'),/source unavailable/);
});
