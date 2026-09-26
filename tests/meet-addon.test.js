const test=require('node:test');const assert=require('node:assert/strict');const {Readable}=require('node:stream');const {JSDOM}=require('jsdom');const fs=require('node:fs');
const booking=require('../api/_lib/commercial-bookings');const handler=require('../api/meet-addon-context').createHandler;const commercialHandler=require('../api/commercial-bookings').createHandler;
const id='55555555-5555-4555-8555-555555555555';
function req(body){const r=Readable.from([JSON.stringify(body||{})]);r.method='POST';r.url='/api/meet-addon-context';r.headers={host:'space.test',origin:'https://space.test'};return r;}
function res(){return {setHeader(){},end(v){this.body=JSON.parse(v)}};}
const authResolver=async()=>({ok:true,session:{sub:'sdr-1',role:'growth',commercialRoles:['sdr']}});
test('Google Meet URL extraction normalizes only valid meet links',()=>{
 assert.equal(booking.meetUrl('https://meet.google.com/ABC-DEFG-HIJ?x=1'),'https://meet.google.com/abc-defg-hij');
 assert.equal(booking.meetCode('https://meet.google.com/abc-defg-hij'),'abc-defg-hij');
 assert.equal(booking.extractMeetUrl({location:'Join https://meet.google.com/abc-defg-hij now'}),'https://meet.google.com/abc-defg-hij');
 assert.equal(booking.meetUrl('https://evil.test/abc-defg-hij'),null);
});
test('Meet add-on context resolves by meeting code and enforces SDR scope',async()=>{
 const row={id,calcom_booking_id:'cal-1',status:'confirmed',start_at:'2026-10-01T13:00:00Z',end_at:'2026-10-01T13:30:00Z',provider_updated_at:'2026-09-25T12:00:00Z',sdr_uid:'sdr-1',attendee_name:'Lead Meet',attendee_phone:'+15551234567',meeting_provider:'google_meet',meeting_url:'https://meet.google.com/abc-defg-hij',meeting_code:'abc-defg-hij',meeting_notes:'Nota',context_payload:{}};
 const request=async path=>path.includes('sdr_uid=eq.sdr-1')?{data:[row]}:{data:[]};
 const out=res();await handler({authResolver,request})(req({meetingInfo:{meetingId:'abc-defg-hij'}}),out);assert.equal(out.statusCode,200);assert.equal(out.body.context.leadName,'Lead Meet');assert.equal(out.body.context.notes,'Nota');
 const denied=res();await handler({authResolver:async()=>({ok:true,session:{sub:'other',role:'growth',commercialRoles:['sdr']}}),request})(req({meetingInfo:{meetingId:'abc-defg-hij'}}),denied);assert.equal(denied.statusCode,404);
});
test('Meet add-on context fails closed when meeting is missing or ambiguous',async()=>{
 const request=async()=>({data:[{id:'a'},{id:'b'}]});const out=res();await handler({authResolver,request})(req({meetingInfo:{meetingId:'abc-defg-hij'}}),out);assert.equal(out.statusCode,409);
 const missing=res();await handler({authResolver,request:async()=>({data:[]})})(req({meetingInfo:{meetingId:'abc-defg-hij'}}),missing);assert.equal(missing.statusCode,404);
});
test('meeting notes persist through commercial bookings endpoint',async()=>{
 let row={id,calcom_booking_id:'cal-1',status:'confirmed',start_at:'2026-10-01T13:00:00Z',end_at:'2026-10-01T13:30:00Z',provider_updated_at:'2026-09-25T12:00:00Z',sdr_uid:'sdr-1',context_payload:{}};const writes=[];
 const request=async(path,opt={})=>{writes.push({path,...opt}); if(path.startsWith('/commercial_bookings?id=eq.')){if(opt.method==='PATCH')row={...row,...opt.body};return {data:[row]};} if(path==='/commercial_booking_audit_events')return {data:[]}; return {data:[]};};
 const r=Readable.from([JSON.stringify({action:'save_notes',bookingId:id,notes:'Notas comerciais'})]);r.method='POST';r.url='/api/commercial-bookings';r.headers={host:'space.test',origin:'https://space.test'};const out=res();await commercialHandler({authResolver,request})(r,out);assert.equal(out.statusCode,200);assert.equal(out.body.booking.meetingNotes,'Notas comerciais');assert.ok(writes.some(w=>w.path==='/commercial_booking_audit_events'));
});
test('Agenda shows Join Meet only for valid Google Meet URL',async t=>{
 const dom=new JSDOM('<body data-active-panel="space-agenda"><div data-space-agenda></div></body>',{url:'https://space.test/app/admin/comercial/pre-vendas/agenda',runScripts:'outside-only'});t.after(()=>dom.window.close());
 dom.window.fetchWithAuth=async()=>({ok:true,json:async()=>({scope:'self',bookings:[{id:'b1',status:'confirmed',bookingStartAt:new Date().toISOString(),attendeeName:'Lead',attendeePhone:'+1555',meetingUrl:'https://meet.google.com/abc-defg-hij'}],syncAvailable:true})});
 dom.window.eval(fs.readFileSync('space-agenda.js','utf8'));await dom.window.SpaceAgenda.open();dom.window.document.querySelector('[data-agenda-event="b1"]').click();assert.match(dom.window.document.querySelector('.space-agenda-drawer').textContent,/Entrar no Meet/);assert.equal(dom.window.document.querySelector('[data-agenda-meet]').href,'https://meet.google.com/abc-defg-hij');
});

test('Cal.com reconcile persists Google Meet URL without creating a new meeting', async()=>{
  const store=new Map();const requests=[];const uid='booking-meet';
  const request=async(path,opt={})=>{requests.push({path,...opt});
    if(path.startsWith('/commercial_booking_contexts'))return {data:[{id:'ctx',sdr_uid:'sdr-1',voice_call_id:null,lead_id:'lead-1'}]};
    if(path.includes('commercial_booking_contexts?id=eq.'))return {data:[{id:'ctx',sdr_uid:'sdr-1',voice_call_id:null,lead_id:'lead-1'}]};
    if(path.includes('calcom_booking_id=eq.'))return {data:store.has(uid)?[store.get(uid)]:[]};
    if(path==='/rpc/space_upsert_commercial_booking'){const row={...opt.body.p_booking,id:'stored'};store.set(row.calcom_booking_id,row);return {data:row};}
    if(path.startsWith('/commercial_bookings?id=eq.stored')&&opt.method==='PATCH'){const row={...store.get(uid),...opt.body};store.set(uid,row);return {data:[row]};}
    if(path==='/rpc/space_produce_calcom_meeting')return {data:{meeting_id:null,meeting_status:'unresolved',match_method:'unresolved'}};
    return {data:[]};
  };
  const fetcher=async()=>({ok:true,json:async()=>({status:'success',data:{uid,eventTypeId:booking.CAL_EVENT_TYPE_ID,status:'accepted',start:'2026-10-01T13:00:00Z',end:'2026-10-01T13:30:00Z',updatedAt:'2026-09-25T12:00:00Z',attendees:[{name:'Lead',phoneNumber:'+1555'}],hosts:[{name:'SDR'}],metadata:{spaceBookingContext:'22222222-2222-4222-8222-222222222222'},meetingUrl:'https://meet.google.com/abc-defg-hij'}})});
  const out=await booking.reconcile({uid,request,fetcher,env:{CALCOM_API_KEY:'x'}});assert.equal(out.meetingUrl,'https://meet.google.com/abc-defg-hij');assert.equal(out.meetingProvider,'google_meet');assert.equal(out.meetingCode,'abc-defg-hij');
  assert.equal(requests.find(r=>r.path==='/rpc/space_produce_calcom_meeting').body.p_meet_link,'https://meet.google.com/abc-defg-hij');
});
