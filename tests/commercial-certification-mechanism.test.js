const test=require('node:test'),assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');
const {createGuard}=require('../scripts/commercial-certification/guard.cjs');
const {project,sanitize,failure}=require('../scripts/commercial-certification/output.cjs');
const {createHandler}=require('../scripts/commercial-certification/handler.cjs');
const env={CRM_API_BASE_URL:'https://crm.example.test',CRM_API_KEY:'TEST_ONLY_PRIVATE_TOKEN_12345',GOOGLE_SERVICE_ACCOUNT_JSON:'{"private_key":"TEST_ONLY_PRIVATE_KEY_12345"}'};
for(const [label,url,method,counter] of [
 ['Firestore set','https://firestore.googleapis.com/v1/projects/plataforma-space/databases/(default)/documents/growthGoals/a','PATCH','firestoreWritesAttempted'],
 ['Firestore batch','https://firestore.googleapis.com/v1/projects/plataforma-space/databases/(default)/documents:commit','POST','snapshotWritesAttempted'],
 ['Datacrazy mutation','https://crm.example.test/api/v1/businesses','POST','datacrazyMutationsAttempted']])test(`${label} blocked before transport`,async()=>{
 let network=0;const g=createGuard({env,fetchImpl:async()=>{network++;}});await assert.rejects(g.fetchReadOnly(url,{method}),/blocked/);assert.equal(network,0);assert.equal(g.counts[counter],1);
});
test('read adapter does not expose functioning write methods',()=>{const g=createGuard({env});const reads=g.wrapReads({get:()=>null,list:()=>[]});assert.throws(()=>reads.set('x',{}),/blocked/);assert.equal(g.counts.firestoreWritesAttempted,1);assert.deepEqual(Object.keys(reads),['get','list']);});
test('only exact read endpoints allowed; redirects disabled; Request objects rejected',async()=>{
 const calls=[];const g=createGuard({env,fetchImpl:async(url,opts)=>{calls.push({url,opts});return new Response('{}');}});
 await g.fetchReadOnly('https://crm.example.test/api/v1/businesses?skip=0&take=200');assert.equal(calls[0].opts.redirect,'error');
 await assert.rejects(g.fetchReadOnly('https://crm.example.test/api/v1/businesses/delete'));
 await assert.rejects(g.fetchReadOnly('https://other.example.test/'));
 await assert.rejects(g.fetchReadOnly(new Request('https://crm.example.test/api/v1/businesses',{method:'DELETE'})));
 assert.equal(calls.length,1);
});
for(const bad of [{email:'name@example.test'},{dealId:env.CRM_API_KEY},{headers:{Authorization:'Bearer xyz'}},{dealId:'name@example.test'},{privateKey:'secret'},{dealId:'-----BEGIN PRIVATE KEY-----'}])test('sanitizer rejects PII/secret-shaped output '+Object.keys(bad)[0],()=>assert.throws(()=>sanitize(bad,new Set(Object.values(env))),/unsafe_output/));
function response(){return {headers:{},setHeader(k,v){this.headers[k]=v;},end(v){this.body=JSON.parse(v);}};}
for(const variant of ['get','expired','wrong-host','wrong-env'])test('handler refuses '+variant+' before spawning',async()=>{
 let spawned=0;const e={...env,VERCEL_ENV:'production',VERCEL_URL:'audit.example.vercel.app'};if(variant==='wrong-env')e.VERCEL_ENV='preview';
 const h=createHandler({manifest:{expiresAt:new Date(variant==='expired'?0:Date.now()+10000).toISOString()},env:e,spawn:()=>{spawned++;}}),res=response();
 await h({method:variant==='get'?'GET':'POST',url:'/api/certify',headers:{host:variant==='wrong-host'?'plataforma.spaceschoolbr.com':e.VERCEL_URL}},res);
 assert.equal(res.statusCode,404);assert.equal(spawned,0);
});
test('handler passes only three secrets to child; no logs; single start per instance',async()=>{
 let options;const child=new EventEmitter();child.kill=()=>{};
 const e={...env,UNRELATED_SECRET:'do-not-pass',VERCEL_ENV:'production',VERCEL_URL:'audit.vercel.app'};
 const h=createHandler({manifest:{expiresAt:new Date(Date.now()+10000).toISOString()},env:e,spawn:(file,args,opt)=>{options=opt;return child;}});
 const req={method:'POST',url:'/api/certify',headers:{host:e.VERCEL_URL}},res=response();await h(req,res);
 assert.equal(options.env.UNRELATED_SECRET,undefined);assert.deepEqual(options.stdio,['ignore','ignore','ignore','ipc']);
 child.emit('message',failure({firestoreWritesAttempted:0,datacrazyMutationsAttempted:0,snapshotWritesAttempted:0,blockedRequests:0}));
 assert.equal(res.body.certification,'FAIL');const again=response();await h(req,again);assert.equal(again.statusCode,409);
});
const makeInput=()=>{
 const businesses=['07','08'].map(m=>({id:'deal-'+m,total:100,wonAt:`2026-${m}-10T12:00:00-03:00`,stage:{name:'Fechado',pipeline:{name:'Conversão'}},sdrId:null}));
 businesses.push(...['11396','11296','8895','7580'].map(number=>({id:'fixture-'+number,number,total:25,wonAt:'2026-09-10T12:00:00-03:00',stage:{name:'Fechado',pipeline:{name:'Conversão'}},sdrId:null})));
 return {businesses,users:[],growthPeople:[],goals:{'2026-07':{},'2026-08':{},'2026-09':{}},globalConfig:null,sdrEvents:[],sdrEventsComplete:true,identityKind:'dealId',source:{fetchCompleted:true,paginationCompleted:true,pagesFetched:1,expectedPages:1,recordsFetched:6,retryCount:0,datacrazy429Count:0},sdrAttribution:{status:'loaded',evidence:businesses.map(b=>({dealId:b.id,sdrId:null,source:'explicit_datacrazy_sdrId_null'}))}};
};
test('complete simulated execution uses real engine and sanitized output; no raw source PII',()=>{
 const {reconcileExport}=require('../scripts/reconcile-commercial-metrics');const input=makeInput();const first=reconcileExport(input);
 input.snapshots=Object.fromEntries(Object.entries(first.months).map(([key,m])=>[key,{snapshot:{monthlyIncludedDeals:m.ledger.rows,includedDeals:key==='2026-09'?first.weekly.rows:[],fetchCompleted:true,paginationCompleted:true},month:{period:{monthKey:key},summary:{realizado:100,totalVendas:m.ledger.rows.length}},weekly:{team:{closers:{actualValue:key==='2026-09'?100:0,count:key==='2026-09'?first.weekly.rows.length:0}}}}]));
 input.businesses[0].lead={name:'Private Name',email:'private@example.test',phone:'55512345678'};
 const result=reconcileExport(input);const g=createGuard({env});const report=sanitize(project(result,input,g.counts),g.secrets);
 assert.equal(report.certification,'PASS');assert.equal(report.writesAttempted,0);assert.equal(report.financialDelta,0);assert.equal(report.dealIdDelta,0);
 assert.equal(JSON.stringify(report).includes('Private Name'),false);assert.equal(JSON.stringify(report).includes('private@example'),false);
 assert.equal(report.months['2026-09'].closer.closerOtherRevenue,100);
});
test('incomplete Datacrazy and missing SDR evidence cannot produce PASS',()=>{
 const {reconcileExport}=require('../scripts/reconcile-commercial-metrics');const input=makeInput();input.source.paginationCompleted=false;delete input.sdrAttribution;
 const report=project(reconcileExport(input),input,createGuard({env}).counts);assert.equal(report.certification,'FAIL');assert.equal(report.sdrCertified,false);assert.equal(report.months['2026-09'].sdr.sdrNotLoadedDeals,4);assert.equal(report.months['2026-09'].sdr.sdrFinancialDelta,null);
});
test('collector rejects missing credentials without giving runtime write interfaces',async()=>{
 const {collect}=require('../scripts/commercial-certification/collect.cjs');let reads=0;await assert.rejects(collect({get:()=>{reads++;},list:()=>{reads++;}},{env:{}}),/missing_credentials/);assert.equal(reads,0);
});
test('browser-origin request cannot start the audit',async()=>{
 const h=createHandler({manifest:{expiresAt:new Date(Date.now()+10000).toISOString()},env:{VERCEL_ENV:'production',VERCEL_URL:'audit.vercel.app'},spawn:()=>assert.fail('must not spawn')});
 const res=response();await h({method:'POST',url:'/api/certify',headers:{host:'audit.vercel.app',origin:'https://plataforma.spaceschoolbr.com'}},res);assert.equal(res.statusCode,404);
});
test('installed guard blocks raw sockets and runtime snapshot publication in an isolated process',()=>{
 const {execFileSync}=require('node:child_process');
 const code=`const g=require('./scripts/commercial-certification/guard.cjs').createGuard({env:${JSON.stringify(env)}});g.install();let blocked=0;try{require('node:net').connect(443,'example.test');}catch{blocked++;}try{require('./api/_lib/crm-snapshot-publish').publishCrmSnapshot({});}catch{blocked++;}process.stdout.write(JSON.stringify({blocked,counts:g.counts}));`;
 const result=JSON.parse(execFileSync(process.execPath,['-e',code],{cwd:require('node:path').resolve(__dirname,'..'),encoding:'utf8'}));
 assert.equal(result.blocked,2);assert.equal(result.counts.snapshotWritesAttempted,1);assert.equal(result.counts.blockedRequests,1);
});
test('complete worker simulation: real collector, Firestore read adapter, OAuth path, runtime and sanitization',()=>{
 const {execFileSync}=require('node:child_process');
 const script=`
 process.env.APP_ENV='production';
 const {privateKey}=require('node:crypto').generateKeyPairSync('rsa',{modulusLength:2048});
 process.env.GOOGLE_SERVICE_ACCOUNT_JSON=JSON.stringify({client_email:'test@test.invalid',private_key:privateKey.export({type:'pkcs8',format:'pem'})});
 process.env.CRM_API_BASE_URL='https://crm.example.test';process.env.CRM_API_KEY='TEST_ONLY_PRIVATE_TOKEN_12345';
 const input=${JSON.stringify(makeInput())};
 const first=require('./scripts/reconcile-commercial-metrics').reconcileExport(input);
 const docs={};for(const [key,m] of Object.entries(first.months)){
  docs['growthGoals/'+key]={};
  const p={snapshot:{monthlyIncludedDeals:m.ledger.rows,includedDeals:m.ledger.rows,fetchCompleted:true,paginationCompleted:true},month:{period:{monthKey:key},summary:{realizado:100,totalVendas:m.ledger.rows.length}},weekly:{commercialWeek:require('./api/_lib/commercial-week').resolveCommercialWeek({now:key+'-10'}),team:{closers:{actualValue:100,count:m.ledger.rows.length}}}};
  docs['crmLiveSnapshots/'+key]={payload:p};if(key==='2026-09')docs['crmLiveCache/crm']={payload:p};
 }
 const encode=require('./_lib/firestore-rest').encodeFields;
 const asDoc=(key,data)=>({name:'projects/plataforma-space/databases/(default)/documents/'+key,fields:encode(data).fields});
 global.fetch=async(url,opts={})=>{
  url=new URL(url);
  if(url.hostname==='oauth2.googleapis.com')return new Response(JSON.stringify({access_token:'TEST_ONLY_OAUTH_ACCESS_TOKEN_12345',expires_in:3600}));
  if(url.pathname.endsWith('documents:runQuery'))return new Response('[]');
  if((opts.method||'GET')!=='GET')throw new Error('fixture_write');
  if(url.hostname==='crm.example.test')return new Response(JSON.stringify({items:input.businesses,total:input.businesses.length}));
  const key=decodeURIComponent(url.pathname.split('/documents/')[1]||'');
  if(Object.hasOwn(docs,key))return new Response(JSON.stringify(asDoc(key,docs[key])));
  if(key.includes('/'))return new Response('{}',{status:404});
  return new Response(JSON.stringify({documents:Object.entries(docs).filter(([k])=>k.split('/')[0]===key).map(([k,v])=>asDoc(k,v))}));
 };
 process.send=r=>process.stdout.write(JSON.stringify(r));process.disconnect=()=>{};
 require('./scripts/commercial-certification/worker.cjs');`;
 const output=execFileSync(process.execPath,['-e',script],{cwd:require('node:path').resolve(__dirname,'..'),encoding:'utf8'});
 const result=JSON.parse(output);assert.equal(result.certification,'PASS');assert.equal(result.authenticatedSourceLoaded,true);assert.equal(result.writesAttempted,0);assert.equal(result.source.pages,1);assert.equal(result.months['2026-09'].sdr.sdrNoAttributionDeals,4);
 assert.equal(output.includes('PRIVATE_TOKEN'),false);assert.equal(output.includes('test@test.invalid'),false);
});
test('incomplete real collector fails before any Firestore read',async()=>{
 const original=global.fetch;let reads=0;
 try{global.fetch=async()=>new Response(JSON.stringify({items:[{id:'partial',total:1}],total:2}));await assert.rejects(require('../scripts/commercial-certification/collect.cjs').collect({get:()=>{reads++;},list:()=>{reads++;}},{env}));assert.equal(reads,0);}finally{global.fetch=original;}
});
test('worker with missing authentication reports FAIL without network or output secrets',()=>{
 const {execFileSync}=require('node:child_process');
 const output=execFileSync(process.execPath,['-e',"global.fetch=()=>{throw new Error('network_must_not_run');};process.send=r=>process.stdout.write(JSON.stringify(r));process.disconnect=()=>{};require('./scripts/commercial-certification/worker.cjs');"],{cwd:require('node:path').resolve(__dirname,'..'),env:{},encoding:'utf8'});
 const report=JSON.parse(output);assert.equal(report.certification,'FAIL');assert.equal(report.failure,'missing_credentials');assert.equal(report.writesAttempted,0);
});
test('PII rejected before any output file is persisted',async()=>{
 const {Readable}=require('node:stream'),fs=require('node:fs'),path=require('node:path');
 const dest=path.resolve(__dirname,'../artifacts/.certification-rejected-test');
 assert.equal(fs.existsSync(dest),false);
 await assert.rejects(require('../scripts/commercial-certification/persist.cjs').persist(Readable.from([JSON.stringify({certification:'FAIL',writesAttempted:0,email:'private@example.test'})]),dest),/unsafe_output/);
 assert.equal(fs.existsSync(dest),false);
});
test('local persistence rejects a PASS without machine-readable proof fields',async()=>{
 const {Readable}=require('node:stream');
 await assert.rejects(require('../scripts/commercial-certification/persist.cjs').persist(Readable.from(['{"certification":"PASS","writesAttempted":0}']),'artifacts/.certification-rejected-test'),/unsubstantiated_pass/);
});
test('worker spawn failure cannot leak the exception or invent zero counters',async()=>{
 const h=createHandler({manifest:{expiresAt:new Date(Date.now()+10000).toISOString()},env:{VERCEL_ENV:'production',VERCEL_URL:'audit.vercel.app'},spawn:()=>{throw new Error('sensitive implementation detail');}}),res=response();
 await h({method:'POST',url:'/api/certify',headers:{host:'audit.vercel.app'}},res);
 assert.equal(res.body.certification,'FAIL');assert.equal(res.body.writesAttempted,null);assert.equal(JSON.stringify(res.body).includes('sensitive'),false);
});
test('exit before IPC drain does not replace a valid delayed report with worker_failed',async()=>{
 const child=new EventEmitter();child.kill=()=>{};
 const h=createHandler({manifest:{expiresAt:new Date(Date.now()+10000).toISOString()},env:{VERCEL_ENV:'production',VERCEL_URL:'audit.vercel.app'},spawn:()=>child}),res=response();
 await h({method:'POST',url:'/api/certify',headers:{host:'audit.vercel.app'}},res);
 child.emit('exit',0,null);assert.equal(res.body,undefined);
 child.emit('message',failure({firestoreWritesAttempted:0,datacrazyMutationsAttempted:0,snapshotWritesAttempted:0,blockedRequests:0},{},'audit_failed'));
 child.emit('close',0,null);assert.equal(res.body.failure,'audit_failed');assert.equal(res.body.writesAttempted,0);
});
test('OAuth failure preserves completed source metadata and exposes only a safe stage/code',()=>{
 const script=`
 process.env.APP_ENV='production';
 process.env.CRM_API_BASE_URL='https://crm.example.test';process.env.CRM_API_KEY='TEST_ONLY_PRIVATE_TOKEN_12345';
 const {privateKey}=require('node:crypto').generateKeyPairSync('rsa',{modulusLength:2048});
 process.env.GOOGLE_SERVICE_ACCOUNT_JSON=JSON.stringify({client_email:'test@test.invalid',private_key:privateKey.export({type:'pkcs8',format:'pem'})});
 global.fetch=async url=>String(url).includes('oauth2.googleapis.com')?new Response('{"error":"test@test.invalid TEST_ONLY_PRIVATE_TOKEN_12345"}',{status:401}):new Response('{"items":[],"total":0}');
 process.send=r=>process.stdout.write(JSON.stringify(r));process.disconnect=()=>{};
 require('./scripts/commercial-certification/worker.cjs');`;
 const output=require('node:child_process').execFileSync(process.execPath,['-e',script],{cwd:require('node:path').resolve(__dirname,'..'),env:{},encoding:'utf8'});
 const r=JSON.parse(output);assert.equal(r.diagnosticCode,'oauth_token_failed');assert.equal(r.failureStage,'read_growthGoals/2026-06');assert.equal(r.source.complete,true);assert.equal(r.source.pages,1);assert.equal(r.writesAttempted,0);assert.equal(output.includes('test@test.invalid'),false);assert.equal(output.includes('PRIVATE_TOKEN'),false);
});
test('real child process delivers its final report before closing IPC',async()=>{
 const {fork}=require('node:child_process');
 const child=fork(require.resolve('../scripts/commercial-certification/worker.cjs'),[],{env:{},stdio:['ignore','ignore','ignore','ipc'],execArgv:[]});
 const messages=[];child.on('message',m=>messages.push(m));
 const code=await new Promise((resolve,reject)=>{child.once('close',resolve);child.once('error',reject);});
 assert.equal(code,0);assert.equal(messages.length,1);assert.equal(messages[0].failure,'missing_credentials');assert.equal(messages[0].writesAttempted,0);
});
test('progress cannot finish an audit and only known stages survive an incomplete close',async()=>{
 const child=new EventEmitter();child.kill=()=>{};
 const h=createHandler({manifest:{expiresAt:new Date(Date.now()+10000).toISOString()},env:{VERCEL_ENV:'production',VERCEL_URL:'audit.vercel.app'},spawn:()=>child}),res=response();
 await h({method:'POST',url:'/api/certify',headers:{host:'audit.vercel.app'}},res);
 child.emit('message',{kind:'audit_progress',stage:'read_sdrActivityEvents'});assert.equal(res.body,undefined);
 child.emit('message',{kind:'audit_progress',stage:'private@example.test'});child.emit('close',0,null);
 assert.equal(res.body.failureStage,'read_sdrActivityEvents');assert.equal(res.body.writesAttempted,null);assert.equal(res.body.countersVerified,false);
});
