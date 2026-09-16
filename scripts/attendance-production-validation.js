// Operator-only certification. Never imported by HTTP handlers. No implicit .env loading.
const fs = require('node:fs');
const path = require('node:path');
const { parseEnv } = require('node:util');
const { randomUUID } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const assert = require('node:assert/strict');
const { assertAttendanceTarget, digest } = require('../_lib/attendance-environment');
const root = path.resolve(__dirname, '..');
const q = value => `'${String(value).replace(/'/g,"''")}'`;
function environment(filename) {
  if (process.env.ATTENDANCE_ALLOW_PRODUCTION_MUTATIONS !== 'true') throw Error('attendance_production_authorization_required');
  const resolved = fs.realpathSync(filename);
  if (fs.statSync(resolved).mode & 0o007) throw Error('attendance_credentials_world_accessible');
  if (resolved.startsWith(root + path.sep)) {
    const relative = path.relative(root,resolved);
    execFileSync('git',['check-ignore','--quiet','--',relative],{cwd:root,stdio:'pipe'});
    try { execFileSync('git',['ls-files','--error-unmatch','--',relative],{cwd:root,stdio:'pipe'}); throw Error('attendance_credentials_tracked'); }
    catch(error) { if(error.message === 'attendance_credentials_tracked') throw error; }
    if (!/^\.env(?:\.[a-zA-Z0-9.-]+)?$/.test(relative)) throw Error('attendance_credentials_location_not_private');
  }
  const raw = fs.readFileSync(resolved,'utf8'), env = parseEnv(raw);
  const keys = [...raw.matchAll(/^[ \t]*(?:export[ \t]+)?([A-Za-z_][A-Za-z0-9_]*)[ \t]*=/gm)].map(m=>m[1]);
  if(new Set(keys).size!==keys.length) throw Error('attendance_duplicate_env_key');
  const ref = new URL(env.SUPABASE_URL).hostname.split('.')[0];
  Object.assign(env,{APP_ENV:'production',SUPABASE_ENV_SCOPE:'production',SPACE_PRODUCTION_SUPABASE_URL:env.SUPABASE_URL,
    ATTENDANCE_PRODUCTION_PROJECT_REF:ref,ATTENDANCE_ALLOW_PRODUCTION_MUTATIONS:'true'});
  // Relevant inherited configuration must agree; never silently select another credential.
  for(const [k,v] of Object.entries(process.env)) if (/^(APP_ENV|SPACE_ENV|SPACE_APP_ENV|VERCEL_ENV|VERCEL_TARGET_ENV|SUPABASE_.*|NEXT_PUBLIC_SUPABASE_.*|ATTENDANCE_PRODUCTION_.*)$/.test(k)
    && v && v!==env[k]) throw Error('attendance_inherited_environment_conflict');
  return {env,target:assertAttendanceTarget(env),source:resolved};
}
function client(env) {
  let inFlight=0, maxInFlight=0;
  const request=async(route,body) => {
    inFlight++;maxInFlight=Math.max(maxInFlight,inFlight);
    try {
      const r=await fetch(new URL('/rest/v1/'+route,env.SUPABASE_URL),{method:body===undefined?'GET':'POST',redirect:'error',
        signal:AbortSignal.timeout(30000),headers:{apikey:env.SUPABASE_SERVICE_ROLE_KEY,Authorization:`Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,'Content-Type':'application/json'},
        body:body===undefined?undefined:JSON.stringify(body)});
      const data=await r.json();
      return {ok:r.ok,status:r.status,data:r.ok?data:{code:data.code}};
    } catch { throw Error('attendance_transport_failed'); } finally {inFlight--;}
  };
  return {request,peak:()=>maxInFlight};
}
function makeRun() {
  const run='attendance-prod-validation-'+new Date().toISOString().replace(/[^0-9]/g,'')+'-'+randomUUID().slice(0,8);
  return {run,connection:randomUUID(),channelA:randomUUID(),channelB:randomUUID(),teamA:randomUUID(),teamB:randomUUID(),
    agentA:run+'-a',agentB:run+'-b',supervisor:run+'-s',outsider:run+'-none'};
}
function seed(m) {
  return `begin; set local lock_timeout='5s'; set local statement_timeout='10s';
insert into public.connections(connection_id,provider,external_account_id,display_name,status,metadata)
 values(${q(m.connection)},'attendance_validation',${q(m.run)},${q(m.run)},'active',${q(JSON.stringify({validation_run_id:m.run}))}::jsonb);
insert into public.teams(team_id,name) values(${q(m.teamA)},${q(m.run+' A')}),(${q(m.teamB)},${q(m.run+' B')});
insert into public.attendance_members(user_uid,enabled) values ${[m.agentA,m.agentB,m.supervisor,m.outsider].map(u=>`(${q(u)},true)`).join(',')};
insert into public.team_members(team_id,user_uid,member_role) values(${q(m.teamA)},${q(m.agentA)},'agent'),(${q(m.teamB)},${q(m.agentB)},'agent'),(${q(m.teamA)},${q(m.supervisor)},'supervisor');
insert into public.channels(channel_id,connection_id,external_channel_id,display_name,status,default_team_id)
 values(${q(m.channelA)},${q(m.connection)},${q(m.run+'-a')},'Validation A','active',${q(m.teamA)}),(${q(m.channelB)},${q(m.connection)},${q(m.run+'-b')},'Validation B','active',${q(m.teamB)});
insert into public.channel_teams values(${q(m.channelA)},${q(m.teamA)}),(${q(m.channelB)},${q(m.teamB)});
commit;
select jsonb_build_object('validation_run_id',${q(m.run)},'connections',(select count(*) from public.connections where connection_id=${q(m.connection)}));`;
}
async function testRemote(env,m) {
  assert.equal(assertAttendanceTarget(env).environment,'production');
  const c=client(env), results=[];
  const rpc=(name,body)=>c.request('rpc/attendance_'+name,body);
  const ok=async(name,body)=>{const r=await rpc(name,body);assert.equal(r.ok,true,name+' '+r.status+' '+(r.data.code||''));return r.data;};
  const check=async(name,fn)=>{try{await fn();results.push({name,passed:true});}catch(e){e.attendanceStage=name;throw e;}};
  const inbound=(id,contact='main',channel=m.channelA)=>({p_event:{connection_id:m.connection,channel_id:channel,provider:'attendance_validation',
    external_message_id:m.run+'-'+id,external_event_id:m.run+'-event-'+id,external_contact_id:m.run+'-'+contact,
    phone_raw:'+1 (202) 555-0100',content:{text:'Synthetic '+id},metadata:{validation_run_id:m.run}}});
  const detail=(id,actor=m.agentA)=>ok('get_conversation',{p_actor_uid:actor,p_conversation_id:id});
  const command=(id,actor,cmd)=>ok('update_conversation',{p_actor_uid:actor,p_conversation_id:id,p_command:cmd});
  const a=await ok('ingest_message',inbound('first'));m.conversationA=a.conversation_id;
  const b=await ok('ingest_message',inbound('team-b','main',m.channelB));m.conversationB=b.conversation_id;
  await check('persistence_and_unidentified_identity',async()=>{
    const d=await detail(a.conversation_id);
    assert.equal(d.conversation.last_message_id,a.message_id);assert.equal(d.conversation.status,'open');
    assert.equal(d.participants[0].resolution_state,'unidentified');assert.equal(d.participants[0].internal_person_id,null);
    assert.equal((await detail(b.conversation_id,m.agentB)).conversation.team_id,m.teamB);
  });
  await check('replay_after_commit_and_payload_conflict',async()=>{
    for(let i=0;i<2;i++){const r=await ok('ingest_message',inbound('first'));assert.equal(r.message_id,a.message_id);assert.equal(r.duplicate,true);}
    const changed=inbound('first');changed.p_event.content.text='conflict';assert.equal((await rpc('ingest_message',changed)).status,409);
  });
  await check('20_concurrent_same_inbound',async()=>{
    const rows=await Promise.all(Array.from({length:20},()=>ok('ingest_message',inbound('duplicate-race','duplicate-race'))));
    assert.equal(new Set(rows.map(r=>r.message_id)).size,1);assert.equal(rows.filter(r=>!r.duplicate).length,1);
  });
  await check('20_concurrent_conversation_creation_sequence_last_message',async()=>{
    const rows=await Promise.all(Array.from({length:20},(_,i)=>ok('ingest_message',inbound('create-race-'+i,'create-race'))));
    assert.equal(new Set(rows.map(r=>r.conversation_id)).size,1);
    assert.deepEqual(rows.map(r=>r.sequence).sort((a,b)=>a-b),Array.from({length:20},(_,i)=>i+1));
    const d=await detail(rows[0].conversation_id);assert.equal(d.conversation.last_message_id,rows.find(r=>r.sequence===20).message_id);
  });
  await check('cross_team_and_nonmember_denied',async()=>{
    for(const [actor,id] of [[m.agentA,b.conversation_id],[m.agentB,a.conversation_id],[m.outsider,a.conversation_id]]) {
      for(const view of ['detail','messages'])assert.equal((await rpc('get_conversation',{p_actor_uid:actor,p_conversation_id:id,p_view:view})).status,403);
      assert.equal((await rpc('append_message',{p_actor_uid:actor,p_conversation_id:id,p_message:{client_request_id:m.run+'-forbidden',content:{text:'Denied'}}})).status,403);
    }
    for(const [actor,team] of [[m.agentA,m.teamA],[m.agentB,m.teamB]]){
      const list=await ok('list_conversations',{p_actor_uid:actor});assert.ok(list.rows.length);assert.ok(list.rows.every(r=>r.team_id===team));
    }
  });
  await check('outbound_intent_idempotency_timeline_and_read_cursor',async()=>{
    const body={p_actor_uid:m.agentA,p_conversation_id:a.conversation_id,p_message:{client_request_id:m.run+'-out',content:{text:'Synthetic no dispatch'}}};
    const first=await ok('append_message',body), second=await ok('append_message',body);assert.equal(first.status,'pending');assert.equal(second.message_id,first.message_id);assert.equal(second.duplicate,true);
    const page=await ok('get_conversation',{p_actor_uid:m.agentA,p_conversation_id:a.conversation_id,p_view:'messages'});
    assert.equal(page.rows.length,2);assert.equal(page.rows[1].direction,'outbound');
    assert.equal((await ok('mark_read',{p_actor_uid:m.agentA,p_conversation_id:a.conversation_id,p_sequence:2})).last_read_sequence,2);
    assert.equal((await ok('mark_read',{p_actor_uid:m.agentA,p_conversation_id:a.conversation_id,p_sequence:1})).last_read_sequence,2);
  });
  await check('assignment_concurrency_version_conflict',async()=>{
    const d=await detail(a.conversation_id);
    const rows=await Promise.all([0,1].map(i=>rpc('update_conversation',{p_actor_uid:m.supervisor,p_conversation_id:a.conversation_id,
      p_command:{action:'assignment',client_action_id:m.run+'-assignment-'+i,expected_version:d.conversation.version,assigned_user_uid:i?m.supervisor:m.agentA}})));
    assert.equal(rows.filter(r=>r.ok).length,1);assert.equal(rows.filter(r=>r.status===409).length,1);
  });
  await check('identity_manual_context_and_status_audit',async()=>{
    let d=await detail(a.conversation_id);
    const identity={action:'identity',client_action_id:m.run+'-identity',expected_version:d.conversation.version,resolution_state:'linked',internal_source:'synthetic_validation',internal_person_type:'lead',internal_person_id:m.run,resolution_origin:'manual_test'};
    assert.equal((await rpc('update_conversation',{p_actor_uid:m.agentA,p_conversation_id:a.conversation_id,p_command:identity})).status,403);
    await command(a.conversation_id,m.supervisor,identity);d=await detail(a.conversation_id);
    const participant=d.participants.find(p=>p.participant_role==='external');assert.equal(participant.linked_by_uid,m.supervisor);assert.ok(participant.linked_at);
    assert.equal((await detail(b.conversation_id,m.agentB)).participants[0].resolution_state,'unidentified');
    await command(a.conversation_id,m.agentA,{action:'status',client_action_id:m.run+'-status',expected_version:d.conversation.version,status:'pending'});
    assert.equal((await detail(a.conversation_id)).conversation.status,'pending');
  });
  await check('invalid_inputs_and_private_helper_denied',async()=>{
    assert.equal((await rpc('get_conversation',{p_actor_uid:m.agentA,p_conversation_id:a.conversation_id,p_limit:101})).ok,false);
    assert.equal((await rpc('mark_read',{p_actor_uid:m.agentA,p_conversation_id:a.conversation_id,p_sequence:999})).ok,false);
    assert.equal((await rpc('ingest_message',{p_event:{}})).ok,false);
    assert.equal((await rpc('has_access',{p_actor_uid:m.agentA,p_team_id:m.teamA,p_channel_id:m.channelA})).ok,false);
    for(const table of ['messages','conversations','attendance_members','teams'])assert.equal((await c.request(table+'?limit=0')).ok,false);
  });
  return {timestamp:new Date().toISOString(),run:m.run,scenarios:results,maxConcurrentHttpRequests:c.peak(),
    cross_team_unauthorized_success:0,concurrency_integrity_failure:0,
    note:'Database counts, role matrix, outbox invariants and cleanup must be verified separately by operator SQL.'};
}
async function main() {
  const args=Object.fromEntries(process.argv.slice(2).map(a=>a.replace(/^--/,'').split(/=(.*)/s).slice(0,2)));
  const {env,target,source}=environment(args['env-file']);
  if(args.mode==='preflight') {
    const r=await client(env).request('');assert.equal(r.ok,true);
    console.log(JSON.stringify({timestamp:new Date().toISOString(),environment:'production',projectRef:target.maskedRef,source,authorization:true,credentialBound:true,readOnlyPreflight:true}));return;
  }
  if(args.mode==='prepare') {
    const m=makeRun();fs.mkdirSync(args.output,{mode:0o700});
    fs.writeFileSync(path.join(args.output,'manifest.json'),JSON.stringify(m,null,2),{mode:0o600,flag:'wx'});
    fs.writeFileSync(path.join(args.output,'seed.sql'),seed(m),{mode:0o600,flag:'wx'});
    for(const [name,generate] of Object.entries(require('./attendance-production-sql'))) fs.writeFileSync(path.join(args.output,name+'.sql'),generate(m),{mode:0o600,flag:'wx'});
    console.log(JSON.stringify({run:m.run,output:args.output,remoteWrites:false}));return;
  }
  if(args.mode==='test') {
    const filename=path.join(args.output,'manifest.json'), m=JSON.parse(fs.readFileSync(filename));
    try {const result=await testRemote(env,m);fs.writeFileSync(path.join(args.output,'http-results.json'),JSON.stringify(result,null,2),{mode:0o600});console.log(JSON.stringify(result));}
    finally {fs.writeFileSync(filename,JSON.stringify(m,null,2),{mode:0o600});}
    return;
  }
  throw Error('attendance_invalid_mode');
}
if(require.main===module)main().catch(e=>{console.error(JSON.stringify({error:'attendance_production_validation_failed',
 stage:/^[a-z0-9_]+$/.test(e.attendanceStage||'')?e.attendanceStage:undefined}));process.exitCode=1;});
module.exports={environment,seed,makeRun,testRemote};
