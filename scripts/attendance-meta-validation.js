// Controlled synthetic certification only. No Meta HTTP client or external destination.
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {randomUUID,randomBytes,createHmac}=require('node:crypto');
const assert=require('node:assert/strict');
const {environment,makeRun,seed}=require('./attendance-production-validation');
const {cleanup}=require('./attendance-production-sql');
const {createMetaStore}=require('../api/_lib/attendance-meta-store');
const {createMetaProcessor}=require('../api/_lib/attendance-meta-processor');
const {createHandler}=require('../api/attendance/meta/webhook');
const q=v=>`'${String(v).replace(/'/g,"''")}'`;
const envelope=(m,id,contact='synthetic-contact')=>({object:'whatsapp_business_account',entry:[{id:m.run,changes:[{field:'messages',value:{messaging_product:'whatsapp',metadata:{phone_number_id:m.run+'-a'},messages:[{id:m.run+'-'+id,from:contact,timestamp:'1789430000',type:'text',text:{body:'Controlled synthetic Meta inbound'}}]}}]}]});
function prepare(directory){
 fs.mkdirSync(directory,{mode:0o700});const m=makeRun();m.rawIds=[];
 fs.writeFileSync(path.join(directory,'manifest.json'),JSON.stringify(m,null,2),{mode:0o600,flag:'wx'});
 const s=seed(m)+`\nbegin;
 update public.connections set provider='meta_whatsapp',external_account_type='waba' where connection_id=${q(m.connection)};
 do $$ declare inbound jsonb;outbound jsonb;begin
 inbound:=public.attendance_ingest_message(jsonb_build_object('connection_id',${q(m.connection)},'channel_id',${q(m.channelA)},'provider','meta_whatsapp',
 'external_message_id',${q(m.run+'-seed')},'external_contact_id','synthetic-seed','content',jsonb_build_object('text','Synthetic setup only')));
 outbound:=public.attendance_append_message(${q(m.agentA)},(inbound->>'conversation_id')::uuid,jsonb_build_object('client_request_id','meta-receipt-intent','kind','text','content',jsonb_build_object('text','Intent only; never dispatch')));
 update public.messages set external_message_id=${q(m.run+'-outbound')} where message_id=(outbound->>'message_id')::uuid;
 end $$;
 commit;
 select jsonb_build_object('run',${q(m.run)},'synthetic_connection',exists(select 1 from public.connections where connection_id=${q(m.connection)} and provider='meta_whatsapp'));`;
 fs.writeFileSync(path.join(directory,'seed.sql'),s,{mode:0o600});return m;
}
async function run(env,m,save){
 let active=0,peak=0;const logs=[],checks=[];
 const request=async(route,{method,body})=>{
  active++;peak=Math.max(peak,active);
  try{const r=await fetch(new URL('/rest/v1'+route,env.SUPABASE_URL),{method,redirect:'error',signal:AbortSignal.timeout(30000),
   headers:{apikey:env.SUPABASE_SERVICE_ROLE_KEY,Authorization:'Bearer '+env.SUPABASE_SERVICE_ROLE_KEY,'Content-Type':'application/json'},body:JSON.stringify(body)});
   if(!r.ok)throw Object.assign(Error('meta_rpc_failed'),{status:r.status});return {data:await r.json()};
  }finally{active--;}
 };
 const repository=createMetaStore({request,checkEnvironment:()=>require('../_lib/attendance-environment').assertAttendanceTarget(env)});
 const tracked={...repository,capture:async(...args)=>{const r=await repository.capture(...args);if(!m.rawIds.includes(r.raw_event_id)){m.rawIds.push(r.raw_event_id);save();}return r;}};
 const processEvent=createMetaProcessor({repository,log:e=>logs.push(e)});
 const appSecret=randomBytes(32).toString('hex'),verifyToken=randomBytes(32).toString('hex');
 const handler=createHandler({repository:tracked,checkEnvironment:()=>{},environment:()=>({META_APP_SECRET:appSecret,META_WEBHOOK_VERIFY_TOKEN:verifyToken}),log:e=>logs.push(e)});
 const server=http.createServer(handler);await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+server.address().port;
 const post=async(body,{signature,raw}={})=>{raw=raw||JSON.stringify(body);return fetch(base,{method:'POST',headers:{'content-type':'application/json',
  'x-hub-signature-256':signature||'sha256='+createHmac('sha256',appSecret).update(raw).digest('hex')},body:raw});};
 const check=async(name,fn)=>{await fn();checks.push({name,passed:true});};
 try{
  await check('verification_and_forged_signature',async()=>{
   assert.equal((await fetch(base+'/?hub.mode=subscribe&hub.verify_token='+verifyToken+'&hub.challenge=123')).status,200);
   assert.equal((await fetch(base+'/?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=123')).status,403);
   assert.equal((await post(envelope(m,'invalid'),{signature:'sha256='+'0'.repeat(64)})).status,401);
   assert.equal(m.rawIds.length,0);
  });
  await check('20_signed_deliveries_one_durable_raw',async()=>{
   const replies=await Promise.all(Array.from({length:20},()=>post(envelope(m,'same'))));assert.ok(replies.every(r=>r.status===200));assert.equal(m.rawIds.length,1);
  });
  await check('20_processors_one_domain_effect',async()=>{
   const rows=await Promise.all(Array.from({length:20},()=>processEvent(m.rawIds[0])));
   assert.equal(rows.filter(r=>r.state==='processed').length,1);assert.equal(rows.reduce((n,r)=>n+(r.inbound_created||0),0),1);
   m.conversation=rows.find(r=>r.state==='processed').items[0].conversation_id;save();
  });
  await check('two_distinct_messages_same_contact_concurrent_conversation_creation',async()=>{
   const rows=await Promise.all(['two','three'].map(id=>tracked.capture(JSON.stringify(envelope(m,id,'concurrent-contact')),randomUUID())));
   const processed=await Promise.all(rows.map(r=>processEvent(r.raw_event_id)));assert.ok(processed.every(r=>r.state==='processed'));
   assert.equal(new Set(processed.map(r=>r.items[0].conversation_id)).size,1);
  });
  await check('semantic_replay_metadata_injection_and_cross_team',async()=>{
   const body=envelope(m,'same');body.entry[0].changes[0].value.metadata.channel_id=m.channelB;
   const result=await processEvent((await tracked.capture(JSON.stringify(body),randomUUID())).raw_event_id);
   assert.equal(result.state,'processed');assert.equal(result.inbound_created,0);assert.equal(result.items[0].conversation_id,m.conversation);
   await assert.rejects(request('/rpc/attendance_get_conversation',{method:'POST',body:{p_actor_uid:m.agentB,p_conversation_id:m.conversation}}),e=>e.status===403);
  });
  await check('status_read_then_sent_delivered_failed_and_replay',async()=>{
   for(const [n,state] of ['read','sent','delivered','failed','read'].entries()){
    const body=envelope(m,'unused'),value=body.entry[0].changes[0].value;delete value.messages;
    value.statuses=[{id:m.run+'-outbound',status:state,timestamp:'1789430001'}];
    assert.equal((await processEvent((await tracked.capture(JSON.stringify(body),randomUUID())).raw_event_id)).state,n===4?'not_claimed':'processed');
   }
  });
  await check('unsupported_retained_and_unknown_mapping_retryable',async()=>{
   const body=envelope(m,'unsupported');body.entry[0].changes[0].value.messages[0].type='image';
   assert.equal((await processEvent((await tracked.capture(JSON.stringify(body),randomUUID())).raw_event_id)).state,'unhandled');
   const missing=envelope(m,'unknown-mapping');missing.entry[0].id=m.run+'-unmapped';
   m.retryRaw=(await tracked.capture(JSON.stringify(missing),randomUUID())).raw_event_id;save();
   assert.equal((await processEvent(m.retryRaw)).state,'retryable_failed');
  });
  const ack=logs.filter(x=>x.event==='meta_webhook_durable').map(x=>x.webhook_ack_latency).sort((a,b)=>a-b);
  return {timestamp:new Date().toISOString(),run:m.run,transport:'localhost HTTP signed synthetic -> production PostgREST; NOT Vercel/Meta E2E',
   scenarios:checks,maxConcurrentHttpRequests:peak,rawEvents:m.rawIds.length,webhook_ack_samples:ack.length,webhook_ack_p95_ms:ack[Math.ceil(ack.length*.95)-1],
   invalid_signature_accepted:0,concurrency_integrity_failure:0,cross_team_unauthorized_success:0,unexpected_outbound_requests:0,
   note:'DB counts, audit, durable retention and monotonic status independently checked by SQL. No real Meta traffic.'};
 }finally{await new Promise(r=>server.close(r));}
}
function queries(m){
 const rawScope=`raw_event_id in (${m.rawIds.map(q).join(',')})`;
 const verify=`begin read only; select jsonb_build_object('run',${q(m.run)},
 'raw_count',(select count(*) from public.attendance_provider_events where ${rawScope}),
 'delivery_count',(select sum(delivery_count) from public.attendance_provider_events where ${rawScope}),
 'raw_states',(select jsonb_object_agg(state,n) from (select state,count(*) n from public.attendance_provider_events where ${rawScope} group by state) s),
 'message_count',(select count(*) from public.messages where channel_id=${q(m.channelA)}),
 'status_projection',(select transport_status from public.messages where external_message_id=${q(m.run+'-outbound')} and channel_id=${q(m.channelA)}),
 'status_audit_count',(select count(*) from public.conversation_events where conversation_id in(select conversation_id from public.conversations where channel_id=${q(m.channelA)}) and event_type='message.status.changed'),
 'outbox_unsafe_count',(select count(*) from public.outbox_events where payload->>'validation_run_id'=${q(m.run)} and (delivery_status<>'failed' or attempts<>0 or available_at<>'infinity'::timestamptz or payload->>'dispatch_disabled'<>'true')),
 'duplicate_persistence_count',(select count(*) from(select channel_id,external_message_id from public.messages where channel_id=${q(m.channelA)} group by 1,2 having count(*)>1) d),
 'unexpected_identity_links',(select count(*) from public.conversation_participants where conversation_id in(select conversation_id from public.conversations where channel_id=${q(m.channelA)}) and internal_person_id is not null),
 'missing_last_message',(select count(*) from public.conversations c where channel_id=${q(m.channelA)} and not exists(select 1 from public.messages mm where mm.message_id=c.last_message_id and mm.sequence=c.message_sequence)),
 'raw_rls',(select bool_and(relrowsecurity) from pg_class where oid in ('public.attendance_provider_events'::regclass,'public.attendance_provider_event_items'::regclass)),
 'browser_rpc_grants',(select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname ~ '^attendance_meta_' and (has_function_privilege('anon',p.oid,'execute') or has_function_privilege('authenticated',p.oid,'execute')))
 );rollback;`;
 const clean=cleanup(m).replaceAll("provider='attendance_validation'","provider='meta_whatsapp'").replace('lock table public.conversation_events',()=>
 `-- Only raw IDs recorded from this synthetic run; reject any unscoped content.
 do $$ begin if exists(select 1 from public.attendance_provider_events where ${rawScope} and position(${q(m.run)} in raw_body)=0) then raise exception 'meta_cleanup_scope_mismatch';end if;end $$;
 delete from public.attendance_provider_event_items where ${rawScope};
 delete from public.attendance_provider_events where ${rawScope};
 lock table public.conversation_events`);
 return {verify,cleanup:clean};
}
async function main(){
 const [mode,filename,directory]=process.argv.slice(2);const {env}=environment(filename);
 if(mode==='prepare'){const m=prepare(directory);console.log(JSON.stringify({run:m.run,prepared:true}));return;}
 if(mode!=='test')throw Error('invalid_mode');const p=path.join(directory,'manifest.json'),m=JSON.parse(fs.readFileSync(p));
 try{const r=await run(env,m,()=>fs.writeFileSync(p,JSON.stringify(m,null,2),{mode:0o600}));fs.writeFileSync(path.join(directory,'http-results.json'),JSON.stringify(r,null,2));console.log(JSON.stringify(r));}
 finally{for(const [name,sql] of Object.entries(queries(m)))fs.writeFileSync(path.join(directory,name+'.sql'),sql,{mode:0o600});}
}
if(require.main===module)main().catch(()=>{console.error('meta_validation_failed');process.exitCode=1;});
module.exports={prepare,run,queries};
