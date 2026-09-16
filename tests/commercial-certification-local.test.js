const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {EventEmitter}=require('node:events');
const {credentials,scanWorkspace,runWorker}=require('../scripts/commercial-certification/local.cjs');
const {sanitize}=require('../scripts/commercial-certification/output.cjs');
const {createGuard}=require('../scripts/commercial-certification/guard.cjs');
const {privateKey}=crypto.generateKeyPairSync('rsa',{modulusLength:2048,privateKeyEncoding:{type:'pkcs8',format:'pem'},publicKeyEncoding:{type:'spki',format:'pem'}});
const env={CRM_API_BASE_URL:'https://synthetic.example.test',CRM_API_KEY:crypto.randomBytes(24).toString('hex'),GOOGLE_SERVICE_ACCOUNT_JSON:JSON.stringify({type:'service_account',project_id:'plataforma-space',client_email:'commercial-cert-202609@plataforma-space.iam.gserviceaccount.com',private_key_id:crypto.randomBytes(20).toString('hex'),private_key:privateKey})};
test('only dedicated identity and required environment reach worker',()=>{
 const c=credentials({...env,UNRELATED_SECRET:'ignored',RETENTION_V2_ENABLED:'true'});
 assert.deepEqual(Object.keys(c.env).sort(),['APP_ENV','CRM_API_BASE_URL','CRM_API_KEY','GOOGLE_SERVICE_ACCOUNT_JSON','NODE_ENV']);
 const sa=JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_JSON);sa.client_email='admin@example.test';
 assert.throws(()=>credentials({...env,GOOGLE_SERVICE_ACCOUNT_JSON:JSON.stringify(sa)}));
});
test('arguments, missing credentials and runtime injection fail before worker',()=>{
 assert.throws(()=>credentials(env,['--api-key='+env.CRM_API_KEY]));
 assert.throws(()=>credentials({...env,CRM_API_KEY:''}));
 assert.throws(()=>credentials({...env,NODE_OPTIONS:'--inspect'}));
 assert.throws(()=>credentials(env,[],['--inspect']));
});
for(const kind of ['source','artifact','ignored-env','escaped-key','binary-boundary'])test('reject credential on disk: '+kind,()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'audit-synthetic-'));
 try{
  scanWorkspace(root,credentials(env).secrets);
  const content=kind==='escaped-key'?JSON.stringify(privateKey):kind==='binary-boundary'?Buffer.concat([Buffer.alloc(65530),Buffer.from(env.CRM_API_KEY)]):env.CRM_API_KEY;
  fs.writeFileSync(path.join(root,kind==='ignored-env'?'.env':kind==='artifact'?'result.json':'fixture.js'),content);
  assert.throws(()=>scanWorkspace(root,credentials(env).secrets),/credential_on_disk/);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('symlink refused instead of skipping unverifiable workspace files',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'audit-link-'));
 try{fs.symlinkSync(os.tmpdir(),path.join(root,'external'));assert.throws(()=>scanWorkspace(root,credentials(env).secrets),/symlink/);}
 finally{fs.rmSync(root,{recursive:true,force:true});}
});
for(const [label,value] of Object.entries({Authorization:{Authorization:'Bearer synthetic'},Bearer:{detail:'Bearer synthetic'},privateKey:{detail:privateKey},serviceAccount:{detail:env.GOOGLE_SERVICE_ACCOUNT_JSON},crmKey:{detail:env.CRM_API_KEY},cookies:{cookie:'synthetic'},email:{detail:'synthetic@example.test'},phone:{detail:'+55 (11) 99999-9999'},stack:{stack:'Error: '+env.CRM_API_KEY}}))test('output rejects '+label,()=>assert.throws(()=>sanitize(value,credentials(env).secrets),/unsafe_output/));
test('worker errors discard stacks and unrelated environment; one child only',async()=>{
 let starts=0;
 await assert.rejects(runWorker(credentials(env).env,(file,args,opts)=>{
  starts++;assert.deepEqual(args,[]);assert.deepEqual(opts.execArgv,[]);assert.deepEqual(opts.stdio,['ignore','ignore','ignore','ipc']);
  const child=new EventEmitter();child.kill=()=>{};
  process.nextTick(()=>child.emit('error',Error(env.CRM_API_KEY)));
  return child;
 }),e=>e.message==='worker_failed'&&!e.stack.includes(env.CRM_API_KEY));
 assert.equal(starts,1);
});
test('Firestore allowlist excludes other documents and subcollections',async()=>{
 let calls=0;const g=createGuard({env,fetchImpl:async()=>{calls++;return new Response('{}');}});
 const prefix='https://firestore.googleapis.com/v1/projects/plataforma-space/databases/(default)/documents/';
 await g.fetchReadOnly(prefix+'growthGoals/2026-07');
 await g.fetchReadOnly(prefix+'users?pageSize=1000');
 for(const p of ['growthGoals/2026-11','growthConfig/other','users/a/private','crmLiveCache/other'])await assert.rejects(g.fetchReadOnly(prefix+p));
 assert.equal(calls,2);
});
