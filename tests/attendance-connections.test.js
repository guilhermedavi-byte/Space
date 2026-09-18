const test = require('node:test');
const assert = require('node:assert/strict');
const { Readable } = require('node:stream');
const { createHandler } = require('../api/attendance-connections');
const cid='11111111-1111-4111-8111-111111111111', tid='22222222-2222-4222-8222-222222222222';
async function run(role, body, supervisor = false) {
 const writes=[];
 const rows={connections:[{connection_id:cid,provider:'meta_whatsapp',external_account_type:'waba',external_account_id:'pending:test',display_name:'Teste',status:'pending',metadata:{setup_pending:true,default_team_id:tid,secret:'NEVER_RETURN'}}],channels:[],teams:[{team_id:tid,name:'Comercial',active:true}],channel_teams:[],attendance_members:[{enabled:true}],team_members:supervisor?[{team_id:tid,active:true,member_role:'supervisor'}]:[]};
 const handler=createHandler({authenticate:async()=>({role,uid:'user'}),checkEnvironment:()=>{},request:async(path,opts)=>{if(opts){writes.push({path,...opts});return {data:[]};}return {data:rows[path.split('?')[0].slice(1)]};}});
 const req=Readable.from(body?[JSON.stringify(body)]:[]);req.method=body?'POST':'GET';
 let result;const res={setHeader(){},end(v){result={status:this.statusCode,body:JSON.parse(v)};}};
 await handler(req,res);return {...result,writes};
}
test('Admin sees persisted connections through a secret-free allowlist', async()=>{const r=await run('admin');assert.equal(r.status,200);assert.equal(r.body.items.length,1);assert.equal(r.body.permissions.technical,true);assert.ok(!JSON.stringify(r.body).includes('NEVER_RETURN'));});
test('Growth has no visibility or write access outside team scope',async()=>{assert.equal((await run('growth')).body.items.length,0);assert.equal((await run('growth',{action:'rename',connection_id:cid,name:'Other'})).status,403);});
test('Growth supervisor may create a pending connection, never provision Meta',async()=>{const r=await run('growth',{action:'create',name:'Comercial',team_id:tid},true);assert.equal(r.status,200);assert.equal(r.writes.length,1);assert.equal(r.writes[0].path,'/rpc/attendance_create_pending_connection');assert.deepEqual(r.writes[0].body,{p_name:'Comercial',p_team_id:tid});});
test('Pending connections cannot be activated and deletion is rejected',async()=>{assert.equal((await run('admin',{action:'status',connection_id:cid,status:'active'})).status,409);assert.equal((await run('admin',{action:'delete',connection_id:cid})).writes.length,0);const r=await run('admin',{action:'status',connection_id:cid,status:'disabled'});assert.deepEqual(Object.keys(r.writes[0].body).sort(),['metadata','status','updated_at']);});

test('Empty persisted connection list returns 200 with an empty list', async()=>{
 const handler=createHandler({authenticate:async()=>({role:'admin',uid:'admin'}),checkEnvironment:()=>{},request:async()=>({data:[]})});
 const req=Readable.from([]);req.method='GET';let result;const res={setHeader(){},end(v){result={status:this.statusCode,body:JSON.parse(v)};}};
 await handler(req,res);assert.equal(result.status,200);assert.deepEqual(result.body.items,[]);
});
test('GET infrastructure failures are not silently masked as an empty list', async()=>{
 const error=Object.assign(new Error('supabase_request_failed'),{status:522});
 const handler=createHandler({authenticate:async()=>({role:'admin',uid:'admin'}),checkEnvironment:()=>{},request:async()=>{throw error;}});
 const req=Readable.from([]);req.method='GET';let result;const res={setHeader(){},end(v){result={status:this.statusCode,body:JSON.parse(v)};}};
 await handler(req,res);assert.equal(result.status,503);assert.deepEqual(result.body,{error:'attendance_unavailable'});
});
test('Frontend renders persisted data safely and exposes pending Meta wizard',async()=>{
 const {JSDOM}=require('jsdom');const fs=require('fs');const payload=(await run('admin')).body;payload.items[0].name='<img src=x onerror=alert(1)>';
 const dom=new JSDOM('<body data-initial-panel="attendance-connections"><div data-attendance-connections></div>',{runScripts:'outside-only'});
 dom.window.fetchWithAuth=async()=>({ok:true,json:async()=>payload});dom.window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
 dom.window.eval(fs.readFileSync('attendance-connections.js','utf8'));await new Promise(r=>setTimeout(r,0));
 assert.match(dom.window.document.body.textContent,/Configuração da Meta pendente/);assert.equal(dom.window.document.querySelector('img'),null);
 dom.window.document.querySelector('[data-ac-new]').click();assert.ok(dom.window.document.querySelector('dialog'));assert.equal(dom.window.document.querySelector('input[type=password]'),null);dom.window.close();
});
test('Frontend keeps Meta activation guidance out of list loading errors',async()=>{
 const {JSDOM}=require('jsdom');const fs=require('fs');
 const dom=new JSDOM('<body data-initial-panel="attendance-connections"><div data-attendance-connections></div>',{runScripts:'outside-only'});
 dom.window.fetchWithAuth=async()=>({ok:false,status:409,json:async()=>({error:'conflict'})});
 dom.window.eval(fs.readFileSync('attendance-connections.js','utf8'));await new Promise(r=>setTimeout(r,0));
 assert.doesNotMatch(dom.window.document.body.textContent,/Conclua a configuração Meta antes de ativar/);
 assert.match(dom.window.document.body.textContent,/Conexões indisponíveis/);dom.window.close();
});
test('Admin and Growth direct routes render the shared connections panel', async()=>{
 const sessionPath=require.resolve('../_lib/session'), appPath=require.resolve('../api/app');
 const originalSession=require.cache[sessionPath], originalApp=require.cache[appPath];
 try {for(const role of ['admin','growth']) {
  require.cache[sessionPath]={id:sessionPath,filename:sessionPath,loaded:true,exports:{getSessionFromRequest:()=>({sub:'test',role,name:'Teste'})}};
  delete require.cache[appPath];const res={setHeader(){},end(body){this.body=body;}};
  await require('../api/app')({method:'GET',headers:{host:'localhost'},url:`/api/app?path=${role}/atendimento/conexoes`},res);
  assert.equal(res.statusCode,200);assert.match(res.body,/data-initial-panel="attendance-connections"/);assert.match(res.body,/src="attendance-connections.js"/);
 }}finally{if(originalSession)require.cache[sessionPath]=originalSession;else delete require.cache[sessionPath];if(originalApp)require.cache[appPath]=originalApp;else delete require.cache[appPath];}
});
