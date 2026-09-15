// Executed only by the isolated, short-lived administrative function.
(async()=>{
  const zero={firestoreWritesAttempted:0,datacrazyMutationsAttempted:0,snapshotWritesAttempted:0,blockedRequests:0};
  const {project,sanitize,failure}=require('./output.cjs');let guard,loaded={};
  try{
    if(!['CRM_API_BASE_URL','CRM_API_KEY','GOOGLE_SERVICE_ACCOUNT_JSON'].every(k=>process.env[k]))throw new Error('missing_credentials');
    guard=require('./guard.cjs').createGuard({env:process.env});guard.install();
    const {collect,adapters}=require('./collect.cjs');
    const input=await collect(guard.wrapReads(adapters()),{env:process.env,onProgress:k=>{loaded[k]=true;}});
    const audit=require('../reconcile-commercial-metrics').reconcileExport(input);
    const report=sanitize(project(audit,input,guard.counts),guard.secrets);
    process.send?.(report);
  }catch(e){
    const code=['missing_credentials','unsafe_output','audit_write_or_network_blocked'].includes(e.message)?e.message:'audit_failed';
    const report=failure(guard?.counts||zero,loaded,code);
    if(e.syncMetadata){const m=e.syncMetadata;report.source={pages:m.pagesFetched??null,expectedPages:m.expectedPages??null,dealCount:m.recordsFetched??null,retries:m.retryCount??null,rateLimits:m.datacrazy429Count??null,complete:false};}
    process.send?.(sanitize(report,guard?.secrets||new Set()));
  }finally{process.disconnect?.();}
})().catch(()=>process.exit(1));
