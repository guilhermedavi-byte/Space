const test=require('node:test'),assert=require('node:assert/strict');
const {normalizeWebhook,normalizePayment,money,comparePayment}=require('../api/_lib/finance-domain');
const {createHandler}=require('../api/asaas-webhook');
const {createHandler:createAdminHandler}=require('../api/finance-foundation');
const {assertApplyEnvironment}=require('../scripts/finance-foundation');
const {Readable}=require('node:stream');
const fixture=(patch={})=>({id:'pay_test',customer:'cus_test',status:'PENDING',value:120,dueDate:'2026-10-01',billingType:'PIX',...patch});
const invoke=async(handler,{body={},headers={},method='POST'}={})=>{
  const req=Readable.from([typeof body==='string'?body:JSON.stringify(body)]);req.method=method;req.headers=headers;
  const res={setHeader(){},end(b){this.body=JSON.parse(b);}};await handler(req,res);return {status:res.statusCode,...res.body};
};
test('financial normalization uses fixed decimals and preserves confirmed/received/refund distinctions',()=>{
  assert.equal(money(120.1),'120.10');assert.throws(()=>money(-1));assert.throws(()=>money(1.111));
  assert.equal(normalizePayment(fixture({status:'CONFIRMED'})).status,'CONFIRMED');
  assert.equal(normalizePayment(fixture({status:'RECEIVED'})).has_settlement,true);
  assert.equal(normalizePayment(fixture({deleted:true})).status,'DELETED');
  assert.throws(()=>normalizePayment(fixture({dueDate:'2026-02-30'})));
});
test('inbox normalization deduplicates canonical payload, rejects invalid bodies, excludes PII and credentials',()=>{
  const a={id:'evt_test&123',event:'PAYMENT_CREATED',payment:{...fixture(),name:'Private Name',cpfCnpj:'111',apiKey:'SECRET'},token:'SECRET'};
  const x=normalizeWebhook(a),y=normalizeWebhook({...a,payment:{...a.payment,name:'Other name'},password:'SECRET'});
  assert.equal(x.payload_hash,y.payload_hash);assert.equal(x.dedupe_key,'event:evt_test&123');
  assert.ok(!JSON.stringify(x).includes('SECRET'));assert.ok(!JSON.stringify(x).includes('Private Name'));
  assert.notEqual(normalizeWebhook({...a,payment:fixture({value:121})}).payload_hash,x.payload_hash);
  assert.ok(normalizeWebhook({...a,id:undefined}).dedupe_key.startsWith('hash:'));
  for(const b of [null,[],{}, {event:'PAYMENT_CREATED'}, {event:'PAYMENT_CREATED',payment:{id:'../secret'}}])assert.throws(()=>normalizeWebhook(b));
});
test('comparison identifies missing/status/value/due mismatches without guessing a student',()=>{
  const p=normalizePayment(fixture());assert.deepEqual(comparePayment(null,p,[]),['MISSING_LOCAL','UNMATCHED_CUSTOMER']);
  assert.deepEqual(comparePayment({snapshot:p,status:'OVERDUE',provider_status:'OVERDUE',value:121,due_date:'2026-10-02',deleted:false},p,['student']),['STATUS_MISMATCH','VALUE_MISMATCH','DUE_DATE_MISMATCH']);
});
test('webhook auth/body/persistence acknowledgement and rollout compatibility',async()=>{
  let saves=0,legacyCalls=0;
  const env={FINANCE_FOUNDATION_ENABLED:'true',ASAAS_WEBHOOK_TOKEN:'test-secret'};
  const handler=createHandler({env,service:()=>({ingestWebhook:async b=>{normalizeWebhook(b);saves++;return{event_id:'event',duplicate:saves>1}}})});
  assert.equal((await invoke(handler)).status,401);
  assert.equal((await invoke(handler,{headers:{authorization:'Bearer test-secret'}})).status,401);
  assert.equal((await invoke(handler,{headers:{'asaas-access-token':'wrong-token'}})).status,401);
  const headers={'asaas-access-token':'test-secret'};
  assert.equal((await invoke(handler,{method:'GET',headers})).status,405);
  assert.equal((await invoke(handler,{body:'invalid',headers})).status,400);
  assert.equal((await invoke(handler,{body:'x'.repeat(262145),headers})).status,413);
  assert.equal(saves,0);
  const body={id:'evt_test',event:'PAYMENT_CREATED',payment:fixture()};
  assert.equal((await invoke(handler,{body,headers})).status,200);
  for(let i=0;i<20;i++)assert.equal((await invoke(handler,{body,headers})).duplicate,true);
  const disabled=createHandler({env:{},legacyHandler:async(req,res)=>{legacyCalls++;res.statusCode=200;res.end('{}');}});
  await invoke(disabled);assert.equal(legacyCalls,1);
  const down=createHandler({env,service:()=>({ingestWebhook:async()=>{throw Error('database password secret');}})});
  const r=await invoke(down,{body,headers});assert.equal(r.status,503);assert.equal(r.error,'finance_storage_error');
});
test('foundation maintenance API: admin/CSRF/feature flag enforced',async()=>{
  const env={FINANCE_FOUNDATION_ENABLED:'true',SPACE_PUBLIC_BASE_URL:'https://space.test'};
  assert.equal((await invoke(createAdminHandler({env,session:()=>null}))).status,401);
  assert.equal((await invoke(createAdminHandler({env,session:()=>({role:'FINANCE'})}))).status,403);
  assert.equal((await invoke(createAdminHandler({env,session:()=>({role:'admin',uid:'admin'})}))).status,403);
  let options;
  const h=createAdminHandler({env,session:()=>({role:'admin',uid:'admin'}),service:()=>({repairPaymentById:async(id,o)=>{options=o;return{ok:true}}})});
  assert.equal((await invoke(h,{body:{action:'repair',payment_id:'pay_test'},headers:{origin:'https://space.test'}})).status,200);
  assert.equal(options.dryRun,true);
});
test('CLI apply blocks production and unverified DB targets',()=>{
  const flags=new Set(['--apply']);
  for(const env of [{ASAAS_BASE_URL:'https://api.asaas.com/v3'},
    {ASAAS_BASE_URL:'https://api-sandbox.asaas.com/v3',SUPABASE_URL:'https://prod'},
    {NODE_ENV:'staging',SUPABASE_URL:'https://test',SPACE_STAGING_SUPABASE_URL:'https://test'}]) {
    assert.throws(()=>assertApplyEnvironment(env,flags),/staging_required/);
  }
});
module.exports={fixture,invoke};
