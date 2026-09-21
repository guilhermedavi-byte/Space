const { randomUUID } = require('node:crypto');
const { createAsaasClient, AsaasError } = require('./asaas');
const { invalidateOverviewSnapshots } = require('./finance-dashboard-snapshot');
const { createFinanceStore, safeFinanceError } = require('./finance-store');
const { FinanceError, externalId, uuid, normalizeWebhook, normalizeResource, isSupportedEvent, comparePayment, stable } = require('./finance-domain');
function createFinanceFoundation({store=createFinanceStore(),client=createAsaasClient({readOnly:true}),
  connectionId=process.env.FINANCE_CONNECTION_ID, logger=(entry)=>console.info(JSON.stringify(entry))}={}) {
  const scope=()=>({connection_id:uuid(connectionId)});
  const log=(action,details={})=>logger({domain:'finance_foundation',action,...details});
  const health=async({recordHealth=true}={})=>{
    const checked=await client.checkAsaasConnection();
    if(!connectionId) return checked;
    return { ...checked, projection:await store.rpc('health',{...scope(),...(recordHealth?{health:checked}:{})}) };
  };
  const observe=()=>store.rpc('health',scope());
  const verifyConnection=async({recordHealth=true}={})=>{
    const registered=await store.rpc('connection',scope());
    const h=await client.checkAsaasConnection();
    if(h.error) {if(recordHealth)await store.rpc('health',{...scope(),health:h});throw new AsaasError(h.error.code,h.error.status,h.error.retryable);}
    if(h.environment!==registered.environment || h.account_reference!==registered.account_reference) throw new FinanceError('finance_account_mismatch',false,409);
    if(recordHealth)await store.rpc('health',{...scope(),health:h}); return registered;
  };
  const ingestWebhook=async(body)=>{
    const event=normalizeWebhook(body);
    const result=await store.rpc('ingest',{...scope(),...event});
    log(result.conflict?'webhook_conflict':'webhook_received',{event_id:result.event_id,duplicate:Boolean(result.duplicate)});
    return result;
  };
  // The lease is acquired BEFORE the remote read. Expired/superseded readers cannot commit.
  const project=async(resource,id,{event,source='ASAAS_REPAIR',actor='system',correlationId=randomUUID()}={})=>{
    const args={...scope(),resource,external_object_id:externalId(id),actor,source,correlation_id:correlationId,
      ...(event?{event_id:event.id}:{})};
    const lease=await store.rpc('acquire',args);
    if(!lease.token) return lease;
    const lock={...args,token:lease.token};
    try {
      const remote=await client.request(`/${resource}/${encodeURIComponent(id)}`);
      const snapshot=normalizeResource(resource,remote);
      if(snapshot.id!==id) throw new FinanceError('finance_snapshot_id_mismatch');
      const result=await store.rpc('commit',{...lock,snapshot});
      log('object_projected',{resource,event_id:event?.id||null,external_object_id:id,changed:result.changed});
      if(result.changed){const reason=`${resource}_projected`;await invalidateOverviewSnapshots(connectionId,{reason});if(!['ASAAS_BACKFILL','ASAAS_RECONCILIATION'].includes(source)){const {rebuildOverviewMonths,paymentMonths,saoPauloMonth}=require('./finance-overview-rebuild');await rebuildOverviewMonths({connectionId,months:resource==='payments'?paymentMonths(snapshot):[saoPauloMonth()],reason});}}
      return result;
    } catch(error) {
      const safe=safeFinanceError(error);
      try {await store.rpc('release',{...lock,error_code:safe.code,retryable:safe.retryable});}
      catch {log('lease_release_deferred',{event_id:event?.id||null});}
      log('processing_failed',{event_id:event?.id||null,external_object_id:id,error:safe.code});
      throw error;
    }
  };
  const processWebhookEvent=async(eventId,{verified=false,actor='worker'}={})=>{
    const event=await store.rpc('event',{...scope(),event_id:uuid(eventId)});
    if(!event) throw new FinanceError('finance_event_not_found',false,404);
    if(['processed','ignored'].includes(event.processing_status)) return {done:true};
    if(!isSupportedEvent(event)) return store.rpc('ignore',{...scope(),event_id:event.id});
    if(!verified) await verifyConnection();
    return project(event.resource,event.external_object_id,{event,source:'ASAAS_WEBHOOK',actor,correlationId:event.id});
  };
  const retryWebhookEvent=(eventId,options)=>processWebhookEvent(eventId,options);
  const drain=async({limit=20,actor='worker'}={})=>{
    await verifyConnection();
    const ids=await store.rpc('pending',{...scope(),limit});const results=[];
    for(const id of ids){try{results.push({event_id:id,...await processWebhookEvent(id,{verified:true,actor})});}
      catch(e){results.push({event_id:id,error:safeFinanceError(e).code});}}
    return {examined:ids.length,results};
  };
  const repairPaymentById=async(id,{dryRun=true,actor='operator'}={})=>{
    externalId(id);await verifyConnection({recordHealth:!dryRun});
    if(!dryRun) return project('payments',id,{source:'ASAAS_REPAIR',actor});
    const snapshot=normalizeResource('payments',await client.request(`/payments/${id}`));
    const local=await store.rpc('get',{...scope(),resource:'payments',external_object_id:id});
    const refs=await store.rpc('identity',{...scope(),customer_id:snapshot.customer});
    return {dry_run:true,external_object_id:id,issues:comparePayment(local,snapshot,refs)};
  };
  const sync=async({resource='payments',source='ASAAS_BACKFILL',dryRun=true,filters={},offset=0,limit=100,maxPages=10000,actor='operator',inspectLocalOnly=false,concurrency=1}={})=>{
    if(!Number.isInteger(concurrency)||concurrency<1||concurrency>8)throw new FinanceError('finance_concurrency_invalid');
    if(!['ASAAS_BACKFILL','ASAAS_RECONCILIATION'].includes(source)) throw new FinanceError('finance_source_invalid');
    if(!['payments','customers','subscriptions'].includes(resource)) throw new FinanceError('finance_resource_invalid');
    // Explicit supported windows, never invented updated-since. Unknown filters fail closed.
    const filterKeys=new Set(['customer','subscription','status','dateCreated[ge]','dateCreated[le]','paymentDate[ge]','paymentDate[le]','dueDate[ge]','dueDate[le]']);
    if(Object.entries(filters).some(([k,v])=>!filterKeys.has(k)||typeof v!=='string'||v.length>256)) throw new FinanceError('finance_filters_invalid');
    await verifyConnection({recordHealth:!dryRun});
    const {run_id}=dryRun ? {run_id:randomUUID()} : await store.rpc('run_start',{...scope(),source,resource,dry_run:false,filters,offset});
    const report={run_id,source,resource,dry_run:dryRun,examined:0,local_existing:0,changed:0,duplicates:0,counts:{},issues:[],issues_truncated:false,next_offset:offset,local_only_scan:'not_requested'};
    const seen=new Set();
    try {
      for await(const page of client.pages(resource,{filters,offset,limit,maxPages})) {
        const unique=[];
        for(const raw of page.data){const id=externalId(raw.id);if(seen.has(id)){report.duplicates++;report.counts.DUPLICATE_EXTERNAL_ID=report.duplicates;continue;}seen.add(id);unique.push(raw);}
        let cursor=0,firstError=null;
        const worker=async()=>{while(cursor<unique.length&&!firstError){const raw=unique[cursor++];try{
          const id=externalId(raw.id);
          const snapshot=normalizeResource(resource,raw);
          const local=await store.rpc('get',{...scope(),resource,external_object_id:id});
          if(local)report.local_existing++;
          let issues;
          if(resource==='payments'){
            const refs=await store.rpc('identity',{...scope(),customer_id:snapshot.customer});
            issues=comparePayment(local,snapshot,refs);
          } else issues=!local?['MISSING_LOCAL']:stable(local.snapshot)===stable(snapshot)?['MATCH']:['DETAIL_MISMATCH'];
          for(const issue of issues)report.counts[issue]=(report.counts[issue]||0)+1;
          if(issues.some(i=>i!=='MATCH')) {
            if(report.issues.length<1000)report.issues.push({external_object_id:id,issues});else report.issues_truncated=true;
          }
          // Re-read under the lease: list pages can be stale relative to webhooks.
          if(!dryRun){const result=await project(resource,id,{source,actor,correlationId:run_id});
            if(result.busy)throw new FinanceError('finance_object_busy',true,409);
            if(result.changed)report.changed++;}
          report.examined++;
        }catch(error){firstError ||= error;}}};
        // Finish all in-flight objects before persisting failure/cursor. Each object
        // still re-reads Asaas only after acquiring its own transactional lease.
        await Promise.all(Array.from({length:Math.min(concurrency,unique.length)},worker));
        if(firstError)throw firstError;
        report.next_offset=page.nextOffset;
        if(!dryRun)await store.rpc('run_update',{...scope(),run_id,next_offset:report.next_offset,report});
      }
      if(inspectLocalOnly && resource==='payments') {
        if(typeof store.localPaymentIds!=='function')throw new FinanceError('finance_local_scan_unavailable');
        report.local_only_scan='bounded';
        for(let page=0;page<maxPages;page++) {
          const localPage=await store.localPaymentIds(scope().connection_id,{offset:page*limit,limit});
          for(const rawId of localPage.ids) {
            const id=externalId(rawId);if(seen.has(id))continue;
            try {
              // Asaas can omit deleted payments from lists while GET still returns
              // the real object with deleted=true. Compare that evidence as well.
              const remote=await client.request(`/payments/${encodeURIComponent(id)}`);
              const snapshot=normalizeResource('payments',remote);
              if(snapshot.id!==id)throw new FinanceError('finance_snapshot_id_mismatch');
              const local=await store.rpc('get',{...scope(),resource:'payments',external_object_id:id});
              const refs=await store.rpc('identity',{...scope(),customer_id:snapshot.customer});
              const issues=comparePayment(local,snapshot,refs);
              report.individual_lookups=(report.individual_lookups||0)+1;
              for(const issue of issues)report.counts[issue]=(report.counts[issue]||0)+1;
              if(issues.some(i=>i!=='MATCH')) {
                if(report.issues.length<1000)report.issues.push({external_object_id:id,issues,evidence:'asaas_get_existing_outside_list'});
                else report.issues_truncated=true;
              }
              // This scan observes IDs outside the requested listing/filter; any
              // repair remains an explicit, individually backed-up operation.
            }
            catch(error) {
              if(!(error instanceof AsaasError)||error.code!=='asaas_not_found')throw error;
              // A GET 404 is evidence of local-only visibility, not proof of deletion.
              report.counts.LOCAL_ONLY=(report.counts.LOCAL_ONLY||0)+1;
              if(report.issues.length<1000)report.issues.push({external_object_id:id,issues:['LOCAL_ONLY'],evidence:'asaas_get_404'});
              else report.issues_truncated=true;
            }
          }
          if(!localPage.hasMore){report.local_only_scan='complete';break;}
          if(page===maxPages-1)throw new FinanceError('finance_local_scan_limit');
        }
      }
      if(!dryRun)await store.rpc('run_update',{...scope(),run_id,next_offset:report.next_offset,report,status:'completed'});
      return report;
    } catch(error){const safe=safeFinanceError(error);
      if(!dryRun)await store.rpc('run_update',{...scope(),run_id,report,status:'failed',error_code:safe.code});
      throw new FinanceError(safe.code,safe.retryable,503);}
  };
  const linkCustomer=async(customerId,firestoreDocId,{actor,resolveStudent,allowDeleted=false}={})=>{
    externalId(customerId);
    if(!actor || typeof resolveStudent!=='function' || !/^[A-Za-z0-9_-]{1,128}$/.test(firestoreDocId)) throw new FinanceError('finance_identity_unverified');
    await verifyConnection();
    const student=await resolveStudent(firestoreDocId);
    if(!student || !['student','aluno'].includes(String(student.tipo||student.role||student.type).toLowerCase())) throw new FinanceError('finance_identity_unverified');
    const customer=await client.request(`/customers/${customerId}`);
    if(customer.id!==customerId || (customer.deleted&&!allowDeleted))throw new FinanceError('finance_customer_invalid');
    const lock={...scope(),resource:'customers',external_object_id:customerId,actor,source:'ADMIN_USER'};
    const lease=await store.rpc('acquire',lock);if(!lease.token)throw new FinanceError('finance_identity_busy',true,409);
    const started=Date.now();
    try {
      const current=await store.rpc('identity',{...scope(),customer_id:customerId});
      if(current.some(id=>id!==firestoreDocId))throw new FinanceError('finance_identity_already_linked',false,409);
      if(Date.now()-started>45000)throw new FinanceError('finance_identity_busy',true,409);
      const result=await store.rpc('link',{...scope(),customer_id:customerId,firestore_doc_id:firestoreDocId,verified_by:actor});
      await invalidateOverviewSnapshots(connectionId,{reason:'customer_linked'});{const {rebuildOverviewMonths,saoPauloMonth}=require('./finance-overview-rebuild');await rebuildOverviewMonths({connectionId,months:[saoPauloMonth()],reason:'customer_linked'});}
      return result;
    }finally{await store.rpc('release',{...lock,token:lease.token});}
  };
  const syncSubscriptionPage=async({offset=0,limit=20,actor='operator'}={})=>{
    if(!Number.isInteger(offset)||offset<0||!Number.isInteger(limit)||limit<1||limit>20)throw new FinanceError('finance_pagination_invalid');
    await verifyConnection();
    const {run_id}=await store.rpc('run_start',{...scope(),source:'ASAAS_RECONCILIATION',resource:'subscriptions',dry_run:false,filters:{},offset});
    try {
      const page=(await client.pages('subscriptions',{offset,limit}).next()).value;
      let changed=0;for(const raw of page.data){const r=await project('subscriptions',externalId(raw.id),{source:'ASAAS_RECONCILIATION',actor,correlationId:run_id});if(r.busy)throw new FinanceError('finance_object_busy',true,409);if(r.changed)changed++;}
      const report={examined:page.data.length,changed,next_offset:page.nextOffset,has_more:page.hasMore};
      await store.rpc('run_update',{...scope(),run_id,next_offset:page.nextOffset,report,status:'completed'});return report;
    }catch(error){await store.rpc('run_update',{...scope(),run_id,status:'failed',error_code:safeFinanceError(error).code});throw error;}
  };
  return {syncSubscriptionPage,health,observe,verifyConnection,ingestWebhook,processWebhookEvent,retryWebhookEvent,drain,repairPaymentById,sync,linkCustomer};
}
module.exports={createFinanceFoundation};
