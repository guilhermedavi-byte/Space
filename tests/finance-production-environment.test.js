const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {assertFinanceProductionTarget:target,assertFinanceProductionApply:apply}=require('../_lib/finance-production-environment');
const {assertFinanceCertificationTarget}=require('../_lib/finance-certification-environment');
const {createAsaasClient}=require('../api/_lib/asaas');
const {productionSnapshotStore}=require('../scripts/finance-production-snapshot');
const {createFinanceFoundation}=require('../api/_lib/finance-foundation');
const policy=require('../config/finance-production-target.json');
const fixture=()=>({FINANCE_ENV_SCOPE:'production',APP_ENV:'production',SPACE_APP_ENV:'production',SUPABASE_ENV_SCOPE:'production',SUPABASE_URL:policy.supabaseUrl,ASAAS_BASE_URL:'https://api.asaas.com/v3',ASAAS_KEY_SCOPE:'production',SPACE_PUBLIC_BASE_URL:policy.appOrigins[0],SUPABASE_SERVICE_ROLE_KEY:'sb_secret_synthetic',ASAAS_API_KEY:'$aact_prod_synthetic',ASAAS_WEBHOOK_TOKEN:'synthetic'.repeat(5)});
test('production is explicit and independent from staging; writes require separate confirmation',()=>{
 const env=fixture();assert.equal(assertFinanceCertificationTarget(env).asaas_environment,'production');
 assert.equal(target(env).remote_verified,false);
 assert.throws(()=>apply(env,new Set(['--apply'])),/confirmation_required/);
 assert.throws(()=>apply({...env,FINANCE_STAGING_APPLY:'YES'},new Set(['--apply'])),/confirmation_required/);
 assert.doesNotThrow(()=>apply({...env,FINANCE_PRODUCTION_APPLY:'YES'},new Set(['--apply'])));
 for(const patch of [{FINANCE_ENV_SCOPE:''},{APP_ENV:'staging'},{SPACE_APP_ENV:'staging'},{VERCEL_ENV:'preview'},{SUPABASE_URL:'https://uacxsjitygrraggkbxgm.supabase.co'},{ASAAS_BASE_URL:'https://api-sandbox.asaas.com/v3'},{ASAAS_KEY_SCOPE:'sandbox'},{ASAAS_API_KEY:'$aact_hmlg_synthetic'},{SUPABASE_SERVICE_KEY:'other'},{SPACE_PUBLIC_BASE_URL:'https://attacker.test'},{VERCEL_PROJECT_ID:'other'}])assert.throws(()=>target({...env,...patch}),/finance_production_/);
});
test('production Asaas client rejects remote financial mutations before transport',async()=>{
 let calls=0;const client=createAsaasClient({readOnly:true,config:()=>({apiKey:'synthetic',baseUrl:'https://api.asaas.com/v3'}),fetchImpl:async()=>{calls++;return new Response('{}');}});
 for(const method of ['POST','PUT','DELETE','PATCH'])await assert.rejects(client.request('/payments/pay_existing',{method}),/asaas_read_only/);
 assert.equal(calls,0);await client.request('/payments/pay_existing');assert.equal(calls,1);
});
test('production snapshot precedes mutation and a failed read prevents mutation',async()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'finance-backup-test-'));fs.chmodSync(directory,0o700);
 try {let writes=0,reads=0;
 const store=productionSnapshotStore({rpc:async()=>{assert.equal(fs.readdirSync(directory).length,1);writes++;return{};}},{directory,request:async()=>{reads++;return{data:[]};}});
 const args={connection_id:'11111111-1111-4111-8111-111111111111',resource:'payments',external_object_id:'pay_existing'};
 await store.rpc('acquire',args);assert.equal(writes,1);assert.equal(reads,2);
 const file=path.join(directory,fs.readdirSync(directory)[0]);assert.equal(fs.statSync(file).mode&0o777,0o600);
 assert.equal(JSON.parse(fs.readFileSync(file)).rows.length,2);
 const failed=productionSnapshotStore({rpc:async()=>{writes++;}},{directory,request:async()=>{throw Error('read_failed');}});
 await assert.rejects(failed.rpc('acquire',args),/read_failed/);assert.equal(writes,1);
 } finally {fs.rmSync(directory,{recursive:true,force:true});}
});
test('read-only health and observability never send health telemetry to RPC',async()=>{
 const calls=[];const f=createFinanceFoundation({connectionId:'11111111-1111-4111-8111-111111111111',store:{rpc:async(action,args)=>{calls.push({action,args});return{last_repair:null,last_backfill:null};}},client:{checkAsaasConnection:async()=>({environment:'production',authenticated:true})}});
 await f.health({recordHealth:false});await f.observe();assert.equal(calls.length,2);for(const c of calls){assert.equal(c.action,'health');assert.equal(Object.hasOwn(c.args,'health'),false);}
});
test('reconciliation checks local-only IDs by GET and never deletes or fabricates remote state',async()=>{
 const {AsaasError}=require('../api/_lib/asaas');const writes=[];
 const f=createFinanceFoundation({connectionId:'11111111-1111-4111-8111-111111111111',logger:()=>{},store:{
  rpc:async(action)=>{if(action==='connection')return{environment:'production',account_reference:'0001:123:4'};if(action==='get')return {status:'PENDING',provider_status:'PENDING',deleted:false,value:null,due_date:null,snapshot:require('../api/_lib/finance-domain').normalizePayment({id:'pay_outside_window',status:'PENDING'})};if(action==='identity')return ['student'];writes.push(action);},
  localPaymentIds:async()=>({ids:['pay_outside_window','pay_missing'],hasMore:false})
 },client:{checkAsaasConnection:async()=>({environment:'production',account_reference:'0001:123:4'}),pages:async function*(){yield{data:[],nextOffset:0};},request:async(p)=>{if(p.endsWith('pay_missing'))throw new AsaasError('asaas_not_found',404);return{id:'pay_outside_window',status:'PENDING'};}}});
 const report=await f.sync({source:'ASAAS_RECONCILIATION',dryRun:true,inspectLocalOnly:true});
 assert.equal(report.counts.LOCAL_ONLY,1);assert.equal(report.local_only_scan,'complete');assert.deepEqual(writes,[]);
 assert.deepEqual(report.issues,[{external_object_id:'pay_missing',issues:['LOCAL_ONLY'],evidence:'asaas_get_404'}]);
});
