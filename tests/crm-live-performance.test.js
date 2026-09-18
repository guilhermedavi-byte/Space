const test = require('node:test');
const assert = require('node:assert/strict');
const { isLivePerformanceEligible } = require('../api/_lib/crm-live-eligibility');
const { buildLivePerformance, sortConversions, rate } = require('../api/_lib/crm-live-performance');
const { personalBestCopy, createRecordRoundRobin } = require('../api/_lib/crm-live-presentation');
const { createLiveTvLoopController, buildScreenKeys } = require('../api/_lib/live-tv-rotation');
const period = { startDateKey: '2026-09-16', endDateKey: '2026-09-22' };
const now = new Date('2026-09-17T18:00:00-03:00');
const people = [
 {personId:'s',displayName:'SDR',active:true,roles:['sdr'],sdrUid:'uid-s'},
 {personId:'c',displayName:'Closer',active:true,roles:['closer'],crmAttendantIds:['att-c']},
].map(person => ({crmAttendantIds:[], crmAttendantAliases:[], sdrEmails:[], sdrUids:[], ...person}));
const base = {people, period, now, snapshotId:'snapshot', sdrRows:[{personId:'s',displayName:'SDR',targetValue:20}],closerRows:[{personId:'c',displayName:'Closer',targetValue:1000,count:4}]};
const call = (id,outcome='atendeu',extra={}) => ({id,sdrUid:'uid-s',eventType:'call',outcome,dateKey:'2026-09-17',...extra});
const sale = (id,day) => ({id,stage:{name:'Fechado',pipeline:{name:'Conversão'}},attendant:{id:'att-c'},statusChangedAt:day+'T12:00:00-03:00',value:500});

test('eligibility is role-local, finite and strictly positive, including null/missing/NaN',()=>{
 for(const targetValue of [20,1,'20'])assert.equal(isLivePerformanceEligible({targetValue}),true);
 for(const targetValue of [0,-1,null,undefined,NaN,Infinity,'', 'invalid'])assert.equal(isLivePerformanceEligible({targetValue}),false);
 assert.equal(isLivePerformanceEligible({targetValue:20,active:false}),false);
 assert.equal(isLivePerformanceEligible({targetValue:20,isAggregate:true}),false);
});
for(const role of ['sdr','closer'])test('record copy states and singular/plural for '+role,()=>{
 const noun=role==='sdr'?'agendamento':'venda';
 const item={role,personName:'Pessoa com nome longo '.repeat(5),historicalBest:8};
 assert.match(personalBestCopy({...item,actualValue:7}).headline,new RegExp('2 '+noun+'s'));
 assert.match(personalBestCopy({...item,actualValue:8}).headline,/igualou/);
 assert.match(personalBestCopy({...item,actualValue:9}).headline,new RegExp('em 1 '+noun+'\\.'));
 assert.match(personalBestCopy({...item,actualValue:10}).headline,new RegExp('em 2 '+noun+'s'));
 assert.match(personalBestCopy({...item,actualValue:0}).headline,/Faltam 9/);
});
test('100 calls and 20 bookings gives 20%; double counts one; duplicates and future/invalid calls excluded',()=>{
 const events=Array.from({length:100},(_,i)=>call(String(i),i<19?'agendou':i===19?'double':'nao_atendeu'));
 events.push({...events[0]},call('future','agendou',{dateKey:'2026-09-18'}),call('noshow','noshow',{eventType:'meeting'}),call('bad','invalid'),call('','agendou'),call('future-hour','agendou',{time:'2026-09-17T23:00:00-03:00'}));
 const result=buildLivePerformance({...base,events});
 assert.equal(result.conversions.sdr[0].numerator,20);
 assert.equal(result.conversions.sdr[0].denominator,100);
 assert.equal(result.conversions.sdr[0].conversionRate,20);
 assert.equal(result.audit.includedBookings.length,20);
});
test('closer conversion: 4 won sales / 10 held meetings, excluding canceled/no-show/future and deduplicating',()=>{
 const meetings=Array.from({length:10},(_,i)=>({id:String(i),personId:'c',dateKey:'2026-09-17',status:'held'}));
 meetings.push({...meetings[0]},{id:'cancel',personId:'c',dateKey:'2026-09-17',status:'cancelled'},{id:'future',personId:'c',dateKey:'2026-09-18',status:'held'});
 const result=buildLivePerformance({...base,meetings});
 assert.equal(result.conversions.closers[0].conversionRate,40);
 assert.equal(result.conversions.closers[0].denominator,10);
});
test('missing source and zero sample stay null; no NaN or Infinity; rankings deterministic',()=>{
 assert.equal(rate(4,0),null);assert.equal(rate(0,null),null);
 const result=buildLivePerformance(base);
 assert.equal(result.conversions.sdr[0].conversionRate,null);
 assert.equal(result.conversions.closers[0].denominator,null);
 const zero=buildLivePerformance({...base,meetings:[]});assert.equal(zero.conversions.closers[0].denominator,0);assert.equal(zero.conversions.closers[0].conversionRate,null);
 const rows=[{personId:'z',conversionRate:20,numerator:2,denominator:10},{personId:'a',conversionRate:20,numerator:4,denominator:20},{personId:'b',conversionRate:null,numerator:8,denominator:0},{personId:'c',conversionRate:40,numerator:4,denominator:10}];
 assert.deepEqual(sortConversions(rows).map(r=>r.personId),['c','a','z','b']);
 assert.deepEqual(sortConversions(rows.slice().reverse()),sortConversions(rows));
});
test('records use historical booking events and sale quantities, never old revenue/show rollups',()=>{
 const result=buildLivePerformance({...base,businesses:[sale('1','2026-09-10'),sale('2','2026-09-11')],events:[call('old-a','agendou',{dateKey:'2026-09-10'}),call('old-b','show',{eventType:'meeting',dateKey:'2026-09-10'}),call('today','agendou')]});
 assert.equal(result.recordCandidates.length,2);
 const s=result.recordCandidates.find(r=>r.role==='sdr'),c=result.recordCandidates.find(r=>r.role==='closer');
 assert.equal(s.historicalBest,1);assert.equal(s.actualValue,1);
 assert.equal(c.historicalBest,2);assert.equal(c.actualValue,4);
});
test('five people rotate once per complete cycle; refresh/pause/manual backward do not advance records',()=>{
 const pool=Array.from({length:5},(_,i)=>({id:'record:'+i,personId:String(i),role:i<3?'sdr':'closer'}));
 const rr=createRecordRoundRobin();rr.setCandidates(pool);
 let tick;const seen=[];
 const loop=createLiveTvLoopController({setIntervalFn:fn=>{tick=fn;return 1},clearIntervalFn(){},onCycleComplete:()=>rr.advance()});
 const payload={recordCandidates:pool,news:[{type:'personal_best'}]};loop.setPayload(payload);
 const keys=buildScreenKeys(payload);assert.equal(keys.filter(k=>k==='personal_record').length,1);assert.equal(keys.some(k=>k.startsWith('news_')),false);
 loop.step(-1);loop.step(1);assert.equal(rr.current().id,pool[0].id);
 for(let cycle=0;cycle<6;cycle++){
   seen.push(rr.current().id);rr.setCandidates(pool.slice().reverse());loop.setPayload(payload);loop.setPaused(true);loop.setPaused(false);
   for(let i=0;i<keys.length;i++)tick();
 }
 assert.deepEqual(seen,['record:0','record:1','record:2','record:3','record:4','record:0']);
});
test('conflicting duplicate identities fail closed',()=>{
 assert.throws(()=>buildLivePerformance({...base,events:[call('x'),call('x','agendou')]}),/conflicting/);
});

test('a person with both roles has one turn per round and alternates their roles',()=>{
 const rr=createRecordRoundRobin();
 rr.setCandidates([{id:'a:closer',personId:'a'},{id:'a:sdr',personId:'a'},{id:'b:sdr',personId:'b'}]);
 const seen=[];for(let i=0;i<5;i++){seen.push(rr.current().id);rr.advance();}
 assert.deepEqual(seen,['a:closer','b:sdr','a:sdr','b:sdr','a:closer']);
});
