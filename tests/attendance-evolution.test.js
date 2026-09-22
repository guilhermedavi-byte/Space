const test=require('node:test');
const assert=require('node:assert/strict');
const {Readable}=require('node:stream');
const {createHandler}=require('../api/attendance-connections');
const {connectionId,createEvolutionClient,instanceFrom,qrFrom}=require('../api/_lib/attendance-evolution');
const cid='11111111-1111-4111-8111-111111111111',team='22222222-2222-4222-8222-222222222222';
const other='33333333-3333-4333-8333-333333333333';
const qr='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
function fixture({role='admin',member='supervisor',outside=false,state='close',protectedInstance=false,multi=false,failWrite=false}={}) {
 const calls=[],writes=[];
 const c={connection_id:cid,provider:'evolution_whatsapp',external_account_id:protectedInstance?'space-suporte':`space-${cid}`,external_account_type:'instance',display_name:'Suporte',status:'pending',metadata:{setup_pending:true,space_created:true,default_team_id:team,secret:'NEVER_RETURN'}};
 const rows={connections:[c],channels:[{channel_id:cid,connection_id:cid,default_team_id:team,status:'pending'},...(multi?[{channel_id:other,connection_id:cid,default_team_id:other,status:'active'}]:[])],teams:[{team_id:team,active:true,name:'Atendimento'},{team_id:other,active:true,name:'Outro'}],channel_teams:[{channel_id:cid,team_id:team},{channel_id:other,team_id:other}],attendance_members:[{enabled:true}],team_members:outside?[]:[{team_id:team,active:true,member_role:member}]};
 const handler=createHandler({authenticate:async()=>({role,uid:'user'}),checkEnvironment:()=>{},evolutionClient:async(op,name)=>{calls.push({op,name});if(op==='find')return [{name,connectionStatus:state,ownerJid:'5511999999999@s.whatsapp.net',token:'NEVER_RETURN'}];if(op==='connect')return {base64:qr,hash:{apikey:'NEVER_RETURN'}};return {};},request:async(path,opts)=>{
  if(!opts)return {data:rows[path.split('?')[0].slice(1)]};
  writes.push(opts.body);if(failWrite)throw Error('write_failed');
  const input=opts.body.p_input;c.metadata={...c.metadata,...input};c.status=input.connection_state==='open'?'active':c.status;
  return {data:{...c}};
 }});
 return {calls,writes,c,async run(method='GET',operation='',body,origin){
  const req=Readable.from(body?[JSON.stringify(body)]:[]);req.method=method;req.url=`/api/attendance-connections?connection=${cid}${operation?'&operation='+operation:''}`;req.headers=origin?{origin}:{};
  let result;const res={setHeader(){},end(v){result={status:this.statusCode,body:JSON.parse(v)};}};await handler(req,res);return result;
 }};
}
test('status returns only allowed fields and never provider credentials',async()=>{const f=fixture({state:'open'});const r=await f.run();assert.equal(r.status,200);assert.equal(r.body.item.connection_state,'open');assert.equal(r.body.item.phone,'+5511999999999');assert.ok(!JSON.stringify(r).includes('NEVER_RETURN'));assert.deepEqual(f.calls.map(x=>x.op),['find']);});
test('Growth outsider cannot read, QR or mutate; no provider call',async()=>{const f=fixture({role:'growth',outside:true});for(const [m,o] of [['GET',''],['GET','qr'],['POST','disconnect'],['PATCH','']])assert.equal((await f.run(m,o)).status,403);assert.equal(f.calls.length,0);});
test('Growth agent may read but never get QR or mutate; supervisor cannot manage shared outside channel',async()=>{const f=fixture({role:'growth',member:'agent'});assert.equal((await f.run()).status,200);assert.equal((await f.run('GET','qr')).status,403);const shared=fixture({role:'growth',multi:true});assert.equal((await shared.run('POST','reconnect',{})).status,403);});
test('QR response excludes provider envelope; open instances never reconnect',async()=>{let f=fixture();let r=await f.run('GET','qr');assert.equal(r.status,200);assert.equal(r.body.qr,qr);assert.ok(!JSON.stringify(r).includes('NEVER_RETURN'));f=fixture({state:'open'});r=await f.run('POST','reconnect',{});assert.equal(r.body.qr,null);assert.deepEqual(f.calls.map(x=>x.op),['find']);});
test('protected operational instance cannot be logged out',async()=>{const f=fixture({protectedInstance:true});assert.equal((await f.run('POST','disconnect',{})).status,409);assert.equal(f.calls.length,0);});
test('write failures and cross-origin requests fail closed',async()=>{const f=fixture({failWrite:true});assert.equal((await f.run('POST','reconnect',{})).status,503);assert.equal(f.calls.length,0);assert.equal((await fixture().run('POST','reconnect',{},'https://evil.example')).status,403);});
test('disable is logical and never invokes Evolution logout/delete',async()=>{const f=fixture();assert.equal((await f.run('DELETE')).status,200);assert.equal(f.writes[0].p_action,'disable');assert.equal(f.calls.length,0);});
test('idempotency stable per actor; strict QR validation',()=>{assert.equal(connectionId('a',cid),connectionId('a',cid));assert.notEqual(connectionId('a',cid),connectionId('b',cid));assert.equal(qrFrom({base64:'https://evil.example'}),null);assert.equal(qrFrom({base64:'data:image/svg+xml;base64,abc'}),null);assert.equal(instanceFrom([{name:'other',connectionStatus:'open'}],'expected'),null);});
test('adapter trims server credential, fixes endpoints and rejects redirects',async()=>{let sent;const client=createEvolutionClient({env:{EVOLUTION_API_URL:'https://evo.example',EVOLUTION_API_KEY:'  SERVER_ONLY\n'},transport:async(url,opts)=>{sent={url,opts};return {ok:true,json:async()=>[]};}});await client('find','space-safe');assert.equal(sent.opts.headers.apikey,'SERVER_ONLY');assert.equal(sent.opts.redirect,'error');assert.equal(sent.url,'https://evo.example/instance/fetchInstances?instanceName=space-safe');await assert.rejects(()=>client('find','../escape'));});
test('creation retry targets the same reservation and never creates another open instance',async()=>{
 const writes=[],calls=[],key='44444444-4444-4444-8444-444444444444';
 const id=connectionId('user',key);
 const c={connection_id:id,provider:'evolution_whatsapp',external_account_id:`space-${id}`,external_account_type:'instance',display_name:'Nova',status:'active',metadata:{default_team_id:team,space_created:true,connection_state:'open'}};
 const handler=createHandler({authenticate:async()=>({role:'admin',uid:'user'}),checkEnvironment:()=>{},request:async(path,opts)=>{if(opts){writes.push(opts.body);return {data:c};}return {data:path.startsWith('/teams?')?[{team_id:team,active:true}]:[]};},evolutionClient:async(op,name)=>{calls.push(op);return [{name,connectionStatus:'open'}];}});
 for(let i=0;i<2;i++) {const req=Readable.from([JSON.stringify({action:'create',provider:'evolution_whatsapp',name:'Nova',team_id:team,idempotency_key:key})]);req.method='POST';req.headers={};let code;await handler(req,{setHeader(){},end(){code=this.statusCode;}});assert.equal(code,200);}
 assert.deepEqual(writes.filter(w=>w.p_action==='reserve').map(w=>w.p_id),[id,id]);assert.deepEqual(calls,['find','find']);
});
test('native wizard displays QR, updates to connected and stops polling when closed',async()=>{
 const {JSDOM}=require('jsdom');const fs=require('fs');
 const dom=new JSDOM('<body data-initial-panel="attendance-connections"><div data-attendance-connections></div>',{runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window;const c={connection_id:cid,name:'Suporte',provider:'evolution_whatsapp',status:'pending',connection_state:'pending',can_edit:true,channels:[],draft_team_id:team};
 const payload={permissions:{create:true},items:[c],teams:[{team_id:team,name:'Atendimento'}],create_teams:[{team_id:team,name:'Atendimento'}]};
 let state='connecting';const requests=[],scheduled=[];
 w.setTimeout=(fn,ms)=>{scheduled.push({fn,ms});return scheduled.length;};w.clearTimeout=()=>{};
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
 w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
 w.fetchWithAuth=async(url,opts={})=>{requests.push({url,opts});return {ok:true,json:async()=>url==='/api/attendance-connections'?payload:{item:{...c,connection_state:state,status:state==='open'?'active':'pending'},...(url.endsWith('/reconnect')?{qr,refresh_after_seconds:40}:{})}};};
 w.eval(fs.readFileSync('attendance-connections.js','utf8'));
 const settle=()=>new Promise(resolve=>setImmediate(resolve));await settle();
 w.document.querySelector('[data-ac-qr]').click();await settle();
 assert.equal(w.document.querySelector('dialog img').src,qr);assert.match(w.document.querySelector('dialog').textContent,/Dispositivos conectados/);
 assert.equal(w.document.querySelector('[data-ac-meta]'),null);
 state='open';await scheduled.find(x=>x.ms===4000).fn();await settle();
 assert.match(w.document.querySelector('dialog').textContent,/WhatsApp conectado/);
 const count=requests.length;w.document.querySelector('dialog').close();await scheduled.find(x=>x.ms===4000).fn();assert.equal(requests.length,count);
 assert.equal(w.document.querySelector('dialog'),null);dom.window.close();
});
test('adoption observes the configured active instance without provisioning or connecting',async()=>{
 const previous=process.env.EVOLUTION_INSTANCE_NAME;process.env.EVOLUTION_INSTANCE_NAME='space-suporte';
 try {
  const calls=[],writes=[];
  const c={connection_id:cid,provider:'evolution_whatsapp',external_account_type:'instance',external_account_id:'space-suporte',display_name:'Suporte',status:'active',metadata:{}};
  const handler=createHandler({authenticate:async()=>({role:'admin',uid:'admin'}),checkEnvironment:()=>{},request:async(path,opts)=>{if(opts){writes.push(opts.body);return {data:c};}return {data:path.startsWith('/teams?')?[{team_id:team,active:true}]:[]};},evolutionClient:async(op,name)=>{calls.push({op,name});return [{name,connectionStatus:'open'}];}});
  const req=Readable.from([JSON.stringify({action:'adopt',provider:'evolution_whatsapp',name:'Suporte',team_id:team})]);req.method='POST';req.headers={};let code;
  await handler(req,{setHeader(){},end(){code=this.statusCode;}});
  assert.equal(code,200);assert.deepEqual(calls,[{op:'find',name:'space-suporte'}]);assert.deepEqual(writes.map(w=>w.p_action),['adopt','sync']);assert.equal(writes[1].p_id,cid);
 } finally {if(previous===undefined)delete process.env.EVOLUTION_INSTANCE_NAME;else process.env.EVOLUTION_INSTANCE_NAME=previous;}
});
