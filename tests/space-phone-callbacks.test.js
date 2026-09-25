const test=require('node:test');
const assert=require('node:assert/strict');
const queue=require('../api/_lib/space-phone-callbacks');
const {createVoiceCall}=require('../api/_lib/space-phone');
const id='00000000-0000-4000-8000-000000000001';
const now=Date.parse('2026-09-25T20:00:00Z');
function store(){
 const data=[{id,space_user_uid:'luana',lead_name:'Lead teste',to_number:'+14075550123',callback_at:new Date(now-900000).toISOString(),callback_status:'scheduled'}, {id:'00000000-0000-4000-8000-000000000002',space_user_uid:'other',callback_at:new Date(now+900000).toISOString(),callback_status:'scheduled'}];
 const paths=[];
 return {data,paths,request:async(path,options={})=>{
 paths.push(path); const url=new URL(path,'https://db.test');
 let matches=data.filter(r=>(!url.searchParams.has('space_user_uid') || r.space_user_uid===url.searchParams.get('space_user_uid').slice(3))&&(!url.searchParams.has('id') || r.id===url.searchParams.get('id').slice(3)));
 if(options.method==='PATCH')matches.forEach(r=>Object.assign(r,options.body));
 else if(options.method==='POST'){data.push(options.body);return {data:[options.body]};}
 else if(url.searchParams.has('callback_status')) matches=matches.filter(r=>['scheduled','snoozed'].includes(r.callback_status));
 return {data:matches};
 }};
}
test('30 minute callback persisted; fresh read survives client restart and periods do not filter queue',async()=>{
 const db=store(),args={...db,user:{sub:'luana'},isAdmin:false,id,now};
 await queue.update({...args,patch:{action:'callback_schedule',callbackAt:new Date(now+1800000).toISOString()}});
 assert.equal(db.data[0].callback_at,'2026-09-25T20:30:00.000Z');
 const result=await queue.list(args);assert.equal(result[0].callbackAt,db.data[0].callback_at);
 assert.ok(db.paths.every(p=>!p.includes('started_at')));
});
test('offline due/overdue and all persisted lifecycle states',()=>{
 const r={callback_at:new Date(now).toISOString(),callback_status:'scheduled'};
 assert.equal(queue.status(r,now-1),'scheduled');assert.equal(queue.status(r,now),'due');assert.equal(queue.status(r,now+61000),'overdue');
 for(const status of ['completed','cancelled'])assert.equal(queue.status({...r,callback_status:status},now+999999),status);
 assert.equal(queue.status({...r,callback_status:'snoozed'},now-1),'snoozed');
});
test('Growth spoof ignored for list and denied for mutations; Admin team and SDR filter',async()=>{
 const db=store();
 assert.equal((await queue.list({...db,user:{sub:'luana'},isAdmin:false,sdr:'other'})).length,1);
 assert.match(db.paths.at(-1),/space_user_uid=eq.luana/);
 assert.equal((await queue.list({...db,user:{sub:'admin'},isAdmin:true})).length,2);
 assert.equal((await queue.list({...db,user:{sub:'admin'},isAdmin:true,sdr:'other'}))[0].sdrUid,'other');
 await assert.rejects(queue.update({...db,user:{sub:'other'},isAdmin:false,id,now,patch:{action:'callback_complete'}}),{status:404});
});
test('snooze replaces same callback, completion idempotent, invalid dates rejected',async()=>{
 const db=store(),args={...db,user:{sub:'luana'},isAdmin:false,id,now};
 for(let i=0;i<2;i++)await queue.update({...args,patch:{action:'callback_snooze',callbackAt:new Date(now+600000).toISOString()}});
 assert.equal(db.data.length,2);assert.equal(db.data[0].callback_status,'snoozed');
 await assert.rejects(queue.update({...args,patch:{action:'callback_schedule',callbackAt:'bad'}}),{status:400});
 for(let i=0;i<2;i++)await queue.update({...args,patch:{action:'callback_complete'}});
 assert.equal((await queue.list(args)).length,0);
});
test('callback call keeps source relation and canonical lead context; spoof denied',async()=>{
 const db=store();
 const args={session:{sub:'luana',role:'growth'},identity:{caller_id:'+14075550100'},toNumber:'+14075550123',context:{callbackSourceCallId:id,leadName:'spoof'},supabase:db.request};
 const created=await createVoiceCall(args);assert.equal(created.callback_source_call_id,id);assert.equal(created.lead_name,'Lead teste');
 await assert.rejects(createVoiceCall({...args,session:{sub:'other',role:'growth'}}),{status:404});
});
