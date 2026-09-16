const test=require('node:test');
const assert=require('node:assert/strict');
const {createHmac,randomUUID}=require('node:crypto');
const {Readable,PassThrough}=require('node:stream');
const http=require('node:http');
const fs=require('node:fs');
const adapter=require('../api/_lib/attendance-meta-adapter');
const {createHandler}=require('../api/attendance/meta/webhook');
const {createMetaStore}=require('../api/_lib/attendance-meta-store');
const {createMetaProcessor}=require('../api/_lib/attendance-meta-processor');
const {createHarness,delay}=require('./helpers/attendance-postgres');
const {makeRun,seed}=require('../scripts/attendance-production-validation');
const secret='synthetic-app-secret-test-only',verify='synthetic-verify-token-test-only';
const envelope=(id='wamid.test',from='opaque-person',phone='phone',waba='waba')=>({object:'whatsapp_business_account',entry:[{id:waba,changes:[{field:'messages',value:{messaging_product:'whatsapp',metadata:{phone_number_id:phone},messages:[{id,from,timestamp:'1789430000',type:'text',text:{body:'Olá 👋'}}]}}]}]});
const sign=raw=>'sha256='+createHmac('sha256',secret).update(raw).digest('hex');

test('Meta verification and raw HMAC: valid, forged, absent, changed bytes, duplicate parameters',()=>{
 const raw=Buffer.from(JSON.stringify(envelope()));
 assert.equal(adapter.verifyChallenge('/?hub.mode=subscribe&hub.verify_token='+verify+'&hub.challenge=123',verify),'123');
 for(const url of ['/?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=123','/?hub.mode=bad','/?hub.mode=subscribe&hub.mode=subscribe&hub.verify_token='+verify+'&hub.challenge=123'])assert.throws(()=>adapter.verifyChallenge(url,verify));
 assert.equal(adapter.verifySignature(raw,sign(raw),secret),true);
 for(const signature of [undefined,'sha256='+'0'.repeat(64),'bad'])assert.equal(adapter.verifySignature(raw,signature,secret),false);
 assert.equal(adapter.verifySignature(Buffer.concat([raw,Buffer.from(' ')]),sign(raw),secret),false);
});
test('Raw body reads Vercel restored stream without invoking its lazy JSON getter',async()=>{
 const raw=Buffer.from(' { "a": "ç" } '),req=new PassThrough();req.headers={};
 Object.defineProperty(req,'body',{get(){throw Error('must never parse');}});
 const read=adapter.readRawBody(req);req.end(raw);assert.deepEqual(await read,raw);
 await assert.rejects(adapter.readRawBody({headers:{},body:{a:1}}),/raw_body_unavailable/);
 await assert.rejects(adapter.readRawBody({headers:{'content-length':String(adapter.MAX_BODY_BYTES+1)}}),/payload_too_large/);
 const huge=Readable.from([Buffer.alloc(adapter.MAX_BODY_BYTES+1)]);huge.headers={};await assert.rejects(adapter.readRawBody(huge),/payload_too_large/);
});
test('Envelope preserves opaque identity, batches, unknown types and rejects invalid UTF8/secret fields',()=>{
 const body=envelope();body.entry[0].changes[0].value.metadata.connection_id=randomUUID();
 body.entry[0].changes[0].value.messages.push({id:'img',from:'opaque',timestamp:'1789430000',type:'image',image:{id:'media'}});
 body.entry.push({id:'second',changes:[{field:'account_update',value:{test:true}}]});
 const items=adapter.normalizeEnvelope(adapter.parseEnvelope(Buffer.from(JSON.stringify(body))).body);
 assert.equal(items.length,3);assert.equal(items[0].phone_raw,null);assert.equal(items[0].connection_id,undefined);
 assert.equal(items[1].message_type,'image');assert.equal(items[2].category,'unhandled');
 for(const raw of [Buffer.from('{'),Buffer.from([255]),Buffer.from(JSON.stringify({...body,access_token:'forbidden'}))])assert.throws(()=>adapter.parseEnvelope(raw));
 body.entry[0].changes[0].value.messages=[{}];assert.equal(adapter.normalizeEnvelope(body)[0].category,'unhandled');
});
test('HTTP ACK waits for durable capture; all invalid requests rejected; no processing or provider call',async t=>{
 let count=0,release;const logs=[];
 const handler=createHandler({checkEnvironment:()=>{},environment:()=>({META_APP_SECRET:secret,META_WEBHOOK_VERIFY_TOKEN:verify}),log:e=>logs.push(e),
 repository:{capture:async()=>{count++;if(release)await release;return {raw_event_id:randomUUID(),duplicate:false};}}});
 const server=http.createServer(handler);await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>server.close());
 const url='http://127.0.0.1:'+server.address().port;
 const post=(raw,signature=sign(raw),extra={})=>fetch(url,{method:'POST',headers:{'Content-Type':'application/json','x-hub-signature-256':signature,...extra},body:raw});
 const raw=Buffer.from(JSON.stringify(envelope()));
 let unlock;release=new Promise(r=>unlock=r);let ack=false;
 const pending=post(raw).then(r=>{ack=true;return r;});await delay(60);assert.equal(ack,false);unlock();assert.equal((await pending).status,200);release=null;
 for(const [body,sig,status] of [[raw,'forged',401],[Buffer.concat([raw,Buffer.from(' ')]),sign(raw),401],[Buffer.from('{'),sign(Buffer.from('{')),400]])assert.equal((await post(body,sig)).status,status);
 assert.equal((await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:raw})).status,401);
 assert.equal((await post(raw,sign(raw),{'content-encoding':'gzip'})).status,415);
 assert.equal((await fetch(url,{method:'PUT'})).status,405);assert.equal(count,1);
 assert.equal((await fetch(url+'/?hub.mode=subscribe&hub.verify_token='+verify+'&hub.challenge=123')).status,200);
 assert.equal(JSON.stringify(logs).includes(secret),false);assert.equal(JSON.stringify(logs).includes('Olá'),false);
});
test('Capture failure never ACKs 200 and outbound always throws before network',async()=>{
 const handler=createHandler({checkEnvironment:()=>{},environment:()=>({META_APP_SECRET:secret,META_WEBHOOK_VERIFY_TOKEN:verify}),log:()=>{},repository:{capture:async()=>{throw Error(secret);}}});
 const raw=Buffer.from(JSON.stringify(envelope()));const req=Readable.from([raw]);Object.assign(req,{method:'POST',url:'/',headers:{'content-type':'application/json','x-hub-signature-256':sign(raw)}});
 const res={setHeader(){},end(body){this.body=body;}};await handler(req,res);assert.equal(res.statusCode,503);assert.equal(res.body.includes(secret),false);
 assert.throws(()=>adapter.sendMetaMessage({to:'never'}),/outbound_not_implemented/);
});

test('Meta PostgreSQL 17/PostgREST durable processing, replay, concurrency, status, retry and ACL',
 {skip:process.env.ATTENDANCE_SQL_INTEGRATION!=='true',timeout:180000},async t=>{
 const h=await createHarness();t.after(()=>h.cleanup());
 h.sql(fs.readFileSync('supabase/migrations/202609150002_attendance_meta_inbound.sql','utf8'));
 h.sql(fs.readFileSync('supabase/migrations/202609150003_attendance_meta_raw_json.sql','utf8'));
 // Schema reload is asynchronous; wait until the new RPC appears, not a fixed sleep.
 for(let n=0;;n++){try{await h.request('/rpc/attendance_meta_claim',{method:'POST',body:{p_event_id:null}});break;}catch(e){if(n===30)throw e;await delay(100);}}
 const m=makeRun();m.rawIds=[];h.sql(seed(m));h.sql(`update public.connections set provider='meta_whatsapp',external_account_type='waba' where connection_id='${m.connection}';`);
 const repository=createMetaStore({request:h.request,checkEnvironment:()=>{}}),processEvent=createMetaProcessor({repository,log:()=>{}});
 const event=(id,contact='opaque')=>envelope(id,contact,m.run+'-a',m.run);
 const capture=async body=>{const r=await repository.capture(JSON.stringify(body),randomUUID());if(!m.rawIds.includes(r.raw_event_id))m.rawIds.push(r.raw_event_id);return r;};
 let first;
 await t.test('escaped NUL remains durable raw and becomes unhandled without losing payload',async()=>{
  const body=event('unicode');body.entry[0].changes[0].value.messages[0].text.body='text\u0000suffix';
  const raw=await capture(body);assert.equal((await processEvent(raw.raw_event_id)).state,'unhandled');
  assert.equal(h.sql(`select raw_body like '%\\u0000%' from public.attendance_provider_events where raw_event_id='${raw.raw_event_id}';`),'t');
 });
 await t.test('20 deliveries and 20 processors of one event produce one message',async()=>{
  const rows=await Promise.all(Array.from({length:20},()=>capture(event('same'))));
  assert.equal(new Set(rows.map(r=>r.raw_event_id)).size,1);assert.equal(rows.filter(r=>!r.duplicate).length,1);first=rows[0].raw_event_id;
  const processed=await Promise.all(Array.from({length:20},()=>processEvent(first)));
  assert.equal(processed.filter(r=>r.state==='processed').length,1);
  assert.equal(h.sql('select count(*) from public.messages;'),'1');assert.equal(h.sql(`select delivery_count from public.attendance_provider_events where raw_event_id='${first}';`),'20');
 });
 await t.test('distinct simultaneous messages create one conversation with contiguous sequences',async()=>{
  const ids=await Promise.all(['two','three'].map(x=>capture(event(x,'new-contact'))));
  const results=await Promise.all(ids.map(x=>processEvent(x.raw_event_id)));assert.ok(results.every(x=>x.state==='processed'));
  assert.equal(h.sql('select count(*) from public.conversations;'),'2');
  assert.equal(h.sql('select count(*) from public.conversations where message_sequence=2;'),'1');
  assert.equal(h.sql("select count(*) from public.conversation_participants where internal_person_id is not null;"),'0');
 });
 await t.test('semantic replay across raw whitespace and malicious internal IDs cannot duplicate or redirect',async()=>{
  const body=event('same');body.entry[0].changes[0].value.metadata.channel_id=m.channelB;
  const raw=await capture(body);assert.equal((await processEvent(raw.raw_event_id)).state,'processed');
  assert.equal(h.sql('select count(*) from public.messages;'),'3');
  const mismatch=event('mismatch');mismatch.entry[0].id='other-waba';
  assert.equal((await processEvent((await capture(mismatch)).raw_event_id)).state,'retryable_failed');
  assert.equal(h.sql(`select count(*) from public.messages where channel_id='${m.channelB}';`),'0');
 });
 await t.test('outbound receipts monotonic, replay audit once, unknown message recoverable',async()=>{
  const conv=h.sql(`select conversation_id from public.messages where external_message_id='same';`);
  const out=(await h.request('/rpc/attendance_append_message',{method:'POST',body:{p_actor_uid:m.agentA,p_conversation_id:conv,p_message:{direction:'outbound',kind:'text',content:{text:'Intent only'},client_request_id:'receipt-test'}}})).data;
  h.sql(`update public.messages set external_message_id='out-test' where message_id='${out.message_id}';`);
  const status=(state,id='out-test')=>{const b=event('unused');const v=b.entry[0].changes[0].value;delete v.messages;v.statuses=[{id,status:state,timestamp:'1789430001'}];return b;};
  for(const [n,s] of ['read','sent','delivered','failed','read'].entries()){
   assert.equal((await processEvent((await capture(status(s))).raw_event_id)).state,n===4?'not_claimed':'processed');
   assert.equal(h.sql(`select transport_status from public.messages where message_id='${out.message_id}';`),'read');
  }
  assert.equal(h.sql("select count(*) from public.conversation_events where event_type='message.status.changed';"),'1');
  const missing=await capture(status('delivered','later'));assert.equal((await processEvent(missing.raw_event_id)).state,'retryable_failed');
  h.sql(`update public.messages set external_message_id='later',transport_status='accepted' where message_id='${out.message_id}'; update public.attendance_provider_events set available_at=now() where raw_event_id='${missing.raw_event_id}';`);
  assert.equal((await processEvent(missing.raw_event_id)).state,'processed');
  assert.equal(h.sql(`select transport_status from public.messages where message_id='${out.message_id}';`),'delivered');
 });
 await t.test('unknown retained, payload conflict terminal, crashed lease recovered and retries bounded',async()=>{
  const unknown=event('unknown');unknown.entry[0].changes[0].value.messages[0].type='sticker';
  assert.equal((await processEvent((await capture(unknown)).raw_event_id)).state,'unhandled');
  const conflict=event('same');conflict.entry[0].changes[0].value.messages[0].text.body='changed';
  assert.equal((await processEvent((await capture(conflict)).raw_event_id)).state,'terminal_failed');
  const crash=await capture(event('crash')),lease=await repository.claim(crash.raw_event_id);
  h.sql(`update public.attendance_provider_events set lease_until=now()-interval '1 second' where raw_event_id='${crash.raw_event_id}';`);
  assert.equal((await processEvent(crash.raw_event_id)).state,'processed');
  assert.equal((await repository.complete(crash.raw_event_id,lease.lease_id,adapter.normalizeEnvelope(event('crash')))).state,'lease_lost');
  const fail=await capture(event('fail'));const broken=createMetaProcessor({repository:{...repository,complete:async()=>{throw Error('private details');}},log:()=>{}});
  for(let i=0;i<8;i++){h.sql(`update public.attendance_provider_events set available_at=now() where raw_event_id='${fail.raw_event_id}';`);assert.equal((await broken(fail.raw_event_id)).state,i===7?'terminal_failed':'retryable_failed');}
  assert.equal((await processEvent(fail.raw_event_id)).state,'not_claimed');
 });
 await t.test('multi-entry raw keeps successful items atomic and recovers failed sibling without duplication',async()=>{
  const batch=event('batch-a','batch');const second=event('batch-b','batch');
  second.entry[0].changes[0].value.metadata.phone_number_id='later-channel';batch.entry.push(second.entry[0]);
  const raw=await capture(batch);const partial=await processEvent(raw.raw_event_id);assert.equal(partial.state,'retryable_failed');assert.equal(partial.inbound_created,1);
  h.sql(`begin;insert into public.channels(connection_id,external_channel_id,display_name,status,default_team_id) values('${m.connection}','later-channel','Synthetic','active','${m.teamA}');
   insert into public.channel_teams select channel_id,'${m.teamA}' from public.channels where connection_id='${m.connection}' and external_channel_id='later-channel';
   update public.attendance_provider_events set available_at=now() where raw_event_id='${raw.raw_event_id}';commit;`);
  const recovered=await processEvent(raw.raw_event_id);assert.equal(recovered.state,'processed');assert.equal(recovered.inbound_created,1);
  assert.equal(h.sql("select count(*) from public.messages where external_message_id in ('batch-a','batch-b');"),'2');
 });
 await t.test('all raw/RPC access denied to browser roles; outbox fixtures quarantined; cross-team denied',async()=>{
  for(const role of ['anon','authenticated'])for(const query of ["select * from public.attendance_provider_events","select * from public.attendance_provider_event_items","select public.attendance_meta_claim(null)"])
   await assert.rejects(h.sqlAsync(`begin;set local role ${role};${query};rollback;`),/permission denied/);
  assert.equal(h.sql("select count(*) from public.outbox_events where delivery_status<>'failed' or available_at<>'infinity'::timestamptz or attempts<>0;"),'0');
  const conv=h.sql("select conversation_id from public.messages where external_message_id='same';");
  await assert.rejects(h.request('/rpc/attendance_get_conversation',{method:'POST',body:{p_actor_uid:m.agentB,p_conversation_id:conv}}),e=>e.status===403);
  assert.equal(h.sql('select count(*) from (select channel_id,external_message_id from public.messages where external_message_id is not null group by 1,2 having count(*)>1) x;'),'0');
 });
 await t.test('operator cleanup preserves unrelated raw and immutable trigger, including escaped Unicode fixtures',async()=>{
  const outside=await repository.capture(JSON.stringify(envelope('outside','unrelated','unrelated','unrelated')),randomUUID());
  const {queries}=require('../scripts/attendance-meta-validation');h.sql(queries(m).cleanup);
  assert.equal(h.sql('select count(*) from public.connections;'),'0');
  assert.equal(h.sql('select count(*) from public.attendance_provider_event_items;'),'0');
  assert.equal(h.sql('select raw_event_id from public.attendance_provider_events;'),outside.raw_event_id);
  assert.equal(h.sql("select tgenabled from pg_trigger where tgname='attendance_events_immutable';"),'O');
 });
});
module.exports={envelope};
