const test=require('node:test');const assert=require('node:assert/strict');
const {conversion}=require('../api/_lib/space-phone-conversion');
const {rangeForPeriod}=require('../api/_lib/space-phone');
const now=new Date().toISOString();
const call=(uid,outcome)=>({space_user_uid:uid,status:'connected',outcome,started_at:now});
function db(){
 const bookings=[{id:'a',sdr_uid:'own',lead_id:'lead-a',status:'confirmed',start_at:now},{id:'b',sdr_uid:'other',lead_id:'lead-b',status:'confirmed',start_at:now}];
 const meetings={ 'lead-a':[{id:'m-a',status:'scheduled'}],'lead-b':[{id:'m-b',status:'completed'}]};
 const paths=[];
 return {bookings,meetings,paths,request:async path=>{paths.push(path);const p=new URL(path,'https://test').searchParams;
 if(path.startsWith('/commercial_bookings'))return {data:bookings.filter(b=>b.status==='confirmed'&&(!p.get('sdr_uid')?.startsWith('eq.')||b.sdr_uid===p.get('sdr_uid').slice(3))&&Date.parse(b.start_at)>=Date.parse(p.getAll('start_at')[0].slice(4))&&Date.parse(b.start_at)<=Date.parse(p.getAll('start_at')[1].slice(4)))};
 return {data:meetings[p.get('lead_id').slice(3)]||[]};}};
}
const args=db=>({request:db.request,user:{sub:'own'},isAdmin:false,sdr:'other',range:rangeForPeriod('last7'),resolveNames:async()=>new Map([['own','Luana Mendonça'],['other','Ayres André']])});
test('Growth all four rates use own canonical disposition, never a spoofed SDR',async()=>{
 const d=db();d.meetings['lead-a'][0].status='completed';
 const c=await conversion({...args(d),calls:[call('own','caixa_postal'),call('own','agendado'),call('own','interessado'),call('other','agendado')]});
 assert.equal(c.calls,3);assert.equal(c.answered,2);assert.equal(c.scheduled,1);assert.equal(c.done,1);assert.equal(c.bookings,1);
 assert.equal(c.attendance.percent,200/3);assert.equal(c.callToBooking.percent,100/3);assert.equal(c.answeredToBooking.percent,50);assert.equal(c.bookingToDone.percent,100);assert.equal(c.ranking,undefined);
 assert.ok(d.paths[0].includes('sdr_uid=eq.own'));
});
test('Admin team, ranking real names and single SDR scope',async()=>{
 const d=db(),calls=[call('own','agendado'),call('other','ocupado')];
 const all=await conversion({...args(d),isAdmin:true,sdr:'all',calls});assert.equal(all.calls,2);assert.equal(all.bookings,2);assert.equal(all.ranking.length,2);assert.equal(all.ranking[0].displayName,'Luana Mendonça');
 const one=await conversion({...args(d),isAdmin:true,sdr:'own',calls});assert.equal(one.calls,1);assert.equal(one.ranking.length,1);
});
for(const period of ['today','last7','last30'])test(`period ${period}: calls and bookings use explicit own-period cohorts`,async()=>{
 const d=db();d.bookings.push({...d.bookings[0],id:'old',start_at:'2020-01-01T00:00:00Z'});
 const result=await conversion({...args(d),range:rangeForPeriod(period),calls:[call('own','agendado'),{...call('own','agendado'),started_at:'2020-01-01T00:00:00Z'}]});
 assert.equal(result.calls,1);assert.equal(result.bookings,1);
});
test('fresh outcome, booking cancellation/reschedule and meeting completion reflected on next read',async()=>{
 const d=db(),calls=[call('own','caixa_postal')],read=()=>conversion({...args(d),calls});
 assert.equal((await read()).scheduled,0);calls[0].outcome='agendado';assert.equal((await read()).scheduled,1);
 assert.equal((await read()).done,0);d.meetings['lead-a'][0].status='attended';assert.equal((await read()).done,1);
 d.bookings[0].status='cancelled';assert.equal((await read()).bookings,0);
 d.bookings[0].status='confirmed';d.bookings[0].start_at='2099-01-01T00:00:00Z';assert.equal((await read()).bookings,0);
});
test('unknown or ambiguous meeting never counted as done, cancelled bookings excluded',async()=>{
 const d=db();d.meetings['lead-a'].push({id:'m-duplicate',status:'completed'});
 const result=await conversion({...args(d),calls:[]});assert.equal(result.done,0);assert.equal(result.unlinked,1);assert.equal(result.bookingToDone.incomplete,true);assert.equal(result.attendance.percent,null);
});
test('all no-contact outcomes override connected; all commercial human outcomes count',async()=>{
 const d=db();const result=await conversion({...args(d),calls:['nao_atendeu','ocupado','caixa_postal','numero_invalido','sem_interesse','retornar_depois','interessado','agendado'].map(o=>call('own',o))});
 assert.equal(result.answered,4);assert.equal(result.calls,8);assert.equal(result.attendance.percent,50);
});
