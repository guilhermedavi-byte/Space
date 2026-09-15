#!/usr/bin/env node
// Uses already-exported env, or node --env-file=<sandbox file>. Never loads .env.local implicitly.
const { createAsaasClient } = require('../api/_lib/asaas');
const { createFinanceStore, safeFinanceError } = require('../api/_lib/finance-store');
const { createFinanceFoundation } = require('../api/_lib/finance-foundation');
const { FinanceError } = require('../api/_lib/finance-domain');
function assertApplyEnvironment(env,flags) {
  if(env.ASAAS_BASE_URL!=='https://api-sandbox.asaas.com/v3')throw new FinanceError('finance_cli_sandbox_required');
  const target=String(env.SUPABASE_URL||env.NEXT_PUBLIC_SUPABASE_URL||'');
  // Explicit staging reference must match, not just a variable saying "staging".
  if(!env.SPACE_STAGING_SUPABASE_URL || target!==env.SPACE_STAGING_SUPABASE_URL || target===env.SPACE_PRODUCTION_SUPABASE_URL) {
    throw new FinanceError('finance_cli_staging_database_required');
  }
  if(!flags.has('--apply'))throw new FinanceError('finance_cli_apply_required');
}
async function main(argv=process.argv.slice(2),env=process.env) {
  const [command,...args]=argv,flags=new Set(args);
  const option=(key,fallback)=>{const i=args.indexOf(key);return i<0?fallback:args[i+1];};
  const apply=flags.has('--apply');
  if(apply&&flags.has('--dry-run'))throw new FinanceError('finance_cli_conflicting_modes');
  const actor=option('--actor','');
  if(apply&&!actor)throw new FinanceError('finance_actor_missing');
  if(apply||command==='init'||command==='process'||command==='retry'||command==='link-customer')assertApplyEnvironment(env,flags);
  const client=createAsaasClient(),store=createFinanceStore(),service=createFinanceFoundation({store,client});
  if(command==='health')return service.health();
  if(command==='init'){
    const h=await client.checkAsaasConnection();if(h.error)throw new FinanceError(h.error.code,h.error.retryable);
    return store.rpc('configure',{environment:h.environment,account_reference:h.account_reference,actor});
  }
  if(command==='process')return service.drain({actor,limit:Number(option('--limit','20'))});
  if(command==='retry')return service.retryWebhookEvent(args[0],{actor});
  if(command==='repair')return service.repairPaymentById(args[0],{dryRun:!apply,actor});
  if(command==='link-customer'){
    const {getDocumentAsAdmin}=require('../api/_lib/firestore-admin');
    return service.linkCustomer(args[0],args[1],{actor,resolveStudent:id=>getDocumentAsAdmin(`users/${id}`)});
  }
  if(command==='backfill'||command==='reconcile'){
    const filters={};
    for(const [flag,key] of [['--created-from','dateCreated[ge]'],['--created-to','dateCreated[le]'],['--due-from','dueDate[ge]'],['--due-to','dueDate[le]'],['--status','status']]) {
      const value=option(flag,null);if(value)filters[key]=value;
    }
    return service.sync({source:command==='backfill'?'ASAAS_BACKFILL':'ASAAS_RECONCILIATION',resource:option('--resource','payments'),
      dryRun:!apply,filters,offset:Number(option('--offset','0')),maxPages:Number(option('--max-pages','10000')),actor});
  }
  throw new FinanceError('finance_command_invalid');
}
if(require.main===module)main().then(result=>console.log(JSON.stringify(result,null,2))).catch(e=>{
  console.error(JSON.stringify({error:safeFinanceError(e).code}));process.exitCode=1;
});
module.exports={main,assertApplyEnvironment};
