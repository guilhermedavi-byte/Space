// Explicit operator entry. Requires prior real dry-run, real health and private snapshots.
const fs=require('node:fs');
async function main(){
 if(process.env.FINANCE_PRODUCTION_APPLY!=='YES')throw Error('finance_apply_confirmation_required');
 const state=JSON.parse(fs.readFileSync('/tmp/space-finance-preflight-private.json'));
 const before=JSON.parse(fs.readFileSync('artifacts/finance-production-2026-09-15/backfill-dry-run-before.json'));
 if(!before.dry_run||before.examined!==2074||before.duplicates||before.local_only_scan!=='complete'||Object.keys(before.counts).some(k=>!['MISSING_LOCAL','UNMATCHED_CUSTOMER','MATCH'].includes(k)))throw Error('finance_dry_run_review_required');
 if(process.env.SUPABASE_URL!=='https://mlpojyvwyqcrelagtgkw.supabase.co'||process.env.ASAAS_BASE_URL!=='https://api.asaas.com/v3'||process.env.ASAAS_KEY_SCOPE!=='production')throw Error('finance_production_target_invalid');
 const {client}=await require('./local-bridge.cjs').connect({deployment:state.deployment});
 const {supabaseFetch}=require('../../api/_lib/supabase-rest');
 const rawStore=require('../../api/_lib/finance-store').createFinanceStore();
 const snapshot=await require('./read-snapshot.cjs').readSnapshot(rawStore,supabaseFetch,state.connectionId);
 const secured=require('../finance-production-snapshot').productionSnapshotStore(rawStore,{directory:state.snapshotDir,request:supabaseFetch});
 let committed=0;
 const store={...secured,rpc:async(action,args)=>{
   // Comparison uses an explicitly captured real DB baseline; acquire/commit and
   // all pre-write backups always hit the live database.
   if(action==='get'||action==='identity')return snapshot.store.rpc(action,args);
   const r=await secured.rpc(action,args);
   if(action==='commit'&&++committed%100===0)console.log(JSON.stringify({stage:'backfill_apply',committed}));
   return r;
 }};
 const previousRuns=JSON.parse(fs.readFileSync('artifacts/finance-production-2026-09-15/backfill-apply-first-failure.json'));
 const resumeOffset=previousRuns[0].next_offset;if(previousRuns[0].last_error!=='asaas_rate_limited'||resumeOffset!==100)throw Error('finance_resume_review_required');
 const service=require('../../api/_lib/finance-foundation').createFinanceFoundation({store,client,connectionId:state.connectionId,logger:()=>{}});
 const report=await service.sync({source:'ASAAS_BACKFILL',dryRun:false,offset:resumeOffset,maxPages:100,concurrency:4,actor:'user-authorized-finance-certification-2026-09-15'});
 report.resumed_from={run_id:previousRuns[0].id,offset:resumeOffset,prior_committed:previousRuns[0].report.changed};
 report.local_snapshot={captured_at:snapshot.capturedAt,rows:snapshot.rows};
 fs.writeFileSync('artifacts/finance-production-2026-09-15/backfill-apply.json',JSON.stringify(report,null,2));
 console.log(JSON.stringify({...report,issues:report.issues.slice(0,3)}));
}
if(require.main===module)main().catch(e=>{console.log(JSON.stringify({status:'FAIL',error:/^(asaas|finance|bridge|snapshot)_[a-z_]+$/.test(e.message)?e.message:'production_apply_failed'}));process.exitCode=1;});
module.exports={main};
