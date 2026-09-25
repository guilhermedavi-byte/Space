const test=require('node:test');const assert=require('node:assert/strict');const {Readable}=require('node:stream');const {createHmac}=require('node:crypto');
const lib=require('../api/_lib/commercial-bookings');const handler=require('../api/commercial-bookings').createHandler;const webhook=require('../api/webhooks/calcom').createHandler;
const callId='11111111-1111-4111-8111-111111111111',ctxId='22222222-2222-4222-8222-222222222222';
const booking={uid:'booking-abc',eventTypeId:lib.CAL_EVENT_TYPE_ID,status:'accepted',start:'2026-10-01T13:00:00Z',end:'2026-10-01T13:30:00Z',updatedAt:'2026-09-25T12:00:00Z',attendees:[{name:'Test',email:'test@example.test',timeZone:'America/Sao_Paulo'}],hosts:[{name:'Closer'}],metadata:{spaceBookingContext:ctxId}};
function harness(){
  const store=new Map(),requests=[];let provider={...booking};
  const request=async(path,options={})=>{
    requests.push({path,...options});
    if(path.startsWith('/voice_calls'))return {data:[{id:callId,space_user_uid:'sdr-1',lead_id:'lead-1'}]};
    if(path.startsWith('/commercial_booking_contexts'))return {data:[{id:ctxId,sdr_uid:'sdr-1',voice_call_id:callId,lead_id:'lead-1'}]};
    if(path==='/rpc/space_produce_calcom_meeting')return {data:{meeting_id:null,meeting_status:'unresolved',match_method:'unresolved'}};
    if(path.startsWith('/rpc/')){const b=options.body.p_booking;const old=store.get(b.calcom_booking_id);if(!old||old.provider_updated_at<b.provider_updated_at)store.set(b.calcom_booking_id,{...b,id:'stored'});return {data:store.get(b.calcom_booking_id)};}
    if(path.includes('calcom_booking_id=eq.')){const uid=new URLSearchParams(path.split('?')[1]).get('calcom_booking_id').slice(3);return {data:store.has(uid)?[store.get(uid)]:[]};}
    return {data:[...store.values()].filter(b=>!path.includes('sdr_uid=eq.')||path.includes(`sdr_uid=eq.${b.sdr_uid}`))};
  };
  const fetcher=async url=>({ok:true,json:async()=>({status:'success',data:url.includes('event-types/')?{bookingUrl:`https://cal.com/${lib.CAL_LINK}`}:{...provider}})});
  return {request,fetcher,env:{CALCOM_API_KEY:'test-server-key'},store,requests,set:b=>provider={...provider,...b}};
}
function req(method,body,url='/api/commercial-bookings'){const r=Readable.from(body?[JSON.stringify(body)]:[]);r.method=method;r.url=url;r.headers={host:'space.test',origin:'https://space.test'};return r;}
function res(){return {setHeader(){},end(v){this.body=JSON.parse(v);}};}
const authResolver=async()=>({ok:true,session:{sub:'sdr-1',role:'growth',commercialRoles:['sdr']}});
test('canonical provider snapshot confirms booking, explicit server context links call, duplicate is one row',async()=>{
  const h=harness();const a=await lib.reconcile({...h,uid:booking.uid});await lib.reconcile({...h,uid:booking.uid});
  assert.equal(a.bookingConfirmed,true);assert.equal(a.voiceCallId,callId);assert.equal(h.store.size,1);
  assert.equal(h.requests.some(x=>x.path.startsWith('/voice_calls')&&x.method==='PATCH'),false);
  assert.equal(JSON.stringify(a).includes('test-server-key'),false);
});
test('cancelled and stale deliveries read current provider truth',async()=>{
  const h=harness();await lib.reconcile({...h,uid:booking.uid});h.set({status:'cancelled',updatedAt:'2026-09-25T13:00:00Z'});
  const b=await lib.reconcile({...h,uid:booking.uid});assert.equal(b.bookingConfirmed,false);assert.equal(b.status,'cancelled');
});
test('pending booking never becomes confirmed from outcome or browser claim',async()=>{
  const h=harness();h.set({status:'pending'});const b=await lib.reconcile({...h,uid:booking.uid});assert.equal(b.bookingConfirmed,false);
});
test('missing context does not guess SDR from phone/email',async()=>{
  const h=harness();h.set({metadata:{voiceCallId:callId,sdrUid:'sdr-1'}});const b=await lib.reconcile({...h,uid:booking.uid});assert.equal(b.sdrUid,null);assert.equal(b.voiceCallId,null);
});
test('wrong event, missing key, invalid response and provider failures fail closed',async()=>{
  const h=harness();await assert.rejects(()=>lib.reconcile({...h,uid:booking.uid,env:{}}),/calcom_not_configured/);assert.equal(h.store.size,0);
  await assert.rejects(()=>lib.reconcile({...h,uid:booking.uid,fetcher:async()=>({ok:false,status:401,json:async()=>({})})}),/calcom_provider_failed/);
  await assert.rejects(()=>lib.reconcile({...h,uid:booking.uid,fetcher:async url=>({ok:true,json:async()=>({status:'success',data:{...booking,eventTypeId:999}})})}),/booking_event_not_allowed/);assert.equal(h.store.size,0);
});
test('Growth cannot create context or read bookings for another call owner',async()=>{
  const h=harness();for(const operation of [()=>lib.context({...h,user:{sub:'other'},isAdmin:false,callId}),()=>lib.list({...h,user:{sub:'other'},isAdmin:false,callId})])await assert.rejects(operation,/call_not_found/);
});
test('Growth list ignores SDR spoof and forces authenticated uid; Admin retains scope',async()=>{
  const h=harness();const r=res();await handler({...h,authResolver})(req('GET',null,'/api/commercial-bookings?sdr=other'),r);
  assert.equal(r.statusCode,200);assert.match(h.requests.at(-1).path,/sdr_uid=eq.sdr-1/);
  await lib.list({...h,user:{sub:'admin'},isAdmin:true});assert.doesNotMatch(h.requests.at(-1).path,/sdr_uid=eq/);
});
test('Growth cannot sync another users booking even knowing provider UID',async()=>{
  const h=harness();await assert.rejects(()=>lib.reconcile({...h,uid:booking.uid,user:{sub:'other'},isAdmin:false}),/booking_not_found/);assert.equal(h.store.size,0);
});
test('webhook rejects invalid signature and never accepts supplied status/PII',async()=>{
  const h=harness();const body={triggerEvent:'BOOKING_CREATED',payload:{uid:booking.uid,status:'ACCEPTED',attendeeName:'Forged'}};
  const bad=req('POST',body);bad.headers['x-cal-signature-256']='a'.repeat(64);const r=res();await webhook({...h,env:{...h.env,CALCOM_WEBHOOK_SECRET:'secret'}})(bad,r);assert.equal(r.statusCode,401);assert.equal(h.store.size,0);
  h.set({status:'pending'});const good=req('POST',body);good.headers['x-cal-signature-256']=createHmac('sha256','secret').update(JSON.stringify(body)).digest('hex');const out=res();await webhook({...h,env:{...h.env,CALCOM_WEBHOOK_SECRET:'secret'}})(good,out);assert.equal(out.statusCode,200);assert.deepEqual(out.body,{ok:true});assert.equal(h.store.get(booking.uid).status,'pending');assert.equal(h.store.get(booking.uid).attendee_name,'Test');
});
test('cross-origin write blocked before context creation',async()=>{
  const h=harness();const r=res(),input=req('POST',{action:'context',callId});input.headers.origin='https://evil.test';await handler({...h,authResolver})(input,r);assert.equal(r.statusCode,403);assert.equal(h.requests.length,0);
});
test('producer receives only a unique provider Google event reference and canonical Meet URL',async()=>{
  const h=harness();const base=h.fetcher;
  h.fetcher=async url=>url.includes('/references?')?{ok:true,json:async()=>({status:'success',data:[{type:'google_calendar',eventUid:'google-event'}]})}:base(url);
  h.set({meetingUrl:'https://meet.google.com/abc-defg-hij'});
  await lib.reconcile({...h,uid:booking.uid});
  const p=h.requests.find(r=>r.path==='/rpc/space_produce_calcom_meeting');
  assert.deepEqual(p.body,{p_booking_id:'stored',p_google_event_id:'google-event',p_meet_link:'https://meet.google.com/abc-defg-hij'});
});
test('ambiguous calendar references never select one arbitrarily',async()=>{
  const h=harness();const base=h.fetcher;
  h.fetcher=async url=>url.includes('/references?')?{ok:true,json:async()=>({status:'success',data:[{type:'google_calendar',eventUid:'a'},{type:'google_calendar',eventUid:'b'}]})}:base(url);
  await lib.reconcile({...h,uid:booking.uid});
  assert.equal(h.requests.find(r=>r.path==='/rpc/space_produce_calcom_meeting').body.p_google_event_id,null);
});
test('meeting producer failure is not converted to booking success',async()=>{
  const h=harness();const base=h.request;
  h.request=async(p,o)=>{if(p==='/rpc/space_produce_calcom_meeting')throw Error('producer_failed');return base(p,o);};
  await assert.rejects(lib.reconcile({...h,uid:booking.uid}),/producer_failed/);
});
