// Executed only by the isolated, short-lived administrative function.
(async()=>{
  const zero={firestoreWritesAttempted:0,datacrazyMutationsAttempted:0,snapshotWritesAttempted:0,blockedRequests:0};
  const {project,sanitize,failure}=require('./output.cjs');let guard,loaded={},phase='credentials',sourceMetadata;
  try{
    if(!['CRM_API_BASE_URL','CRM_API_KEY','GOOGLE_SERVICE_ACCOUNT_JSON'].every(k=>process.env[k]))throw new Error('missing_credentials');
    guard=require('./guard.cjs').createGuard({env:process.env});guard.install();
    const {collect,adapters}=require('./collect.cjs');
    phase='collect';
    const input=await collect(guard.wrapReads(adapters()),{env:process.env,onProgress:(k,m)=>{phase=k;if(k==='datacrazyLoaded'||k==='firestoreLoaded')loaded[k]=true;if(m)sourceMetadata=m;}});
    phase='reconcile';
    const audit=require('../reconcile-commercial-metrics').reconcileExport(input);
    phase='project_and_sanitize';
    const report=sanitize(project(audit,input,guard.counts),guard.secrets);
    if(Buffer.byteLength(JSON.stringify(report))>3000000)throw new Error('report_too_large');
    process.send?.(report);
  }catch(e){
    const code=['missing_credentials','unsafe_output','audit_write_or_network_blocked','report_too_large'].includes(e.message)?e.message:'audit_failed';
    const report=failure(guard?.counts||zero,loaded,code);
    report.failureStage=phase;
    const known=['oauth_token_failed','oauth_token_missing','missing_service_account','firestore_admin_get_failed','firestore_admin_list_failed','firestore_pagination_incomplete','firestore_audit_query_failed','firestore_audit_query_invalid','firestore_audit_cursor_repeated','firebase_runtime_not_configured','conflicting_duplicate_business','conflicting_duplicate_sdr_event'];
    report.diagnosticCode=known.includes(e.message)?e.message:'unclassified';
    report.httpStatus=Number.isInteger(e.status)?e.status:null;
    report.errorType=['Error','TypeError','SyntaxError','RangeError'].includes(e.name)?e.name:'other';
    const m=e.syncMetadata||sourceMetadata;
    if(m)report.source={pages:m.pagesFetched??null,expectedPages:m.expectedPages??null,dealCount:m.recordsFetched??null,retries:m.retryCount??null,rateLimits:m.datacrazy429Count??null,complete:m.fetchCompleted===true&&m.paginationCompleted===true};
    process.send?.(sanitize(report,guard?.secrets||new Set()));
  }finally{process.disconnect?.();}
})().catch(()=>process.exit(1));
