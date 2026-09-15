const { randomUUID } = require('node:crypto');
const { createAsaasClient, AsaasError } = require('./asaas');
const { createFinanceStore, safeFinanceError } = require('./finance-store');
const { FinanceError, externalId, uuid, normalizeWebhook, normalizeResource, isSupportedEvent, comparePayment, stable } = require('./finance-domain');
function createFinanceFoundation({store=createFinanceStore(),client=createAsaasClient(),
  connectionId=process.env.FINANCE_CONNECTION_ID, logger=(entry)=>console.info(JSON.stringify(entry))}={}) {
  const scope=()=>({connection_id:uuid(connectionId)});
  const log=(action,details={})=>logger({domain:'finance_foundation',action,...details});
  const health=async()=>{
    const checked=await client.checkAsaasConnection();
    if(!connectionId) return checked;
    return { ...checked, projection:await store.rpc('health',{...scope(),health:checked}) };
  };
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
  const sync=async({resource='payments',source='ASAAS_BACKFILL',dryRun=true,filters={},offset=0,limit=100,maxPages=10000,actor='operator'}={})=>{
    if(!['ASAAS_BACKFILL','ASAAS_RECONCILIATION'].includes(source)) throw new FinanceError('finance_source_invalid');
    if(!['payments','customers','subscriptions'].includes(resource)) throw new FinanceError('finance_resource_invalid');
    // Explicit supported windows, never invented updated-since. Unknown filters fail closed.
    const filterKeys=new Set(['customer','subscription','status','dateCreated[ge]','dateCreated[le]','paymentDate[ge]','paymentDate[le]','dueDate[ge]','dueDate[le]']);
    if(Object.entries(filters).some(([k,v])=>!filterKeys.has(k)||typeof v!=='string'||v.length>256)) throw new FinanceError('finance_filters_invalid');
    await verifyConnection({recordHealth:!dryRun});
    const {run_id}=dryRun ? {run_id:randomUUID()} : await store.rpc('run_start',{...scope(),source,resource,dry_run:false,filters,offset});
    const report={run_id,source,resource,dry_run:dryRun,examined:0,changed:0,duplicates:0,counts:{},issues:[],issues_truncated:false,next_offset:offset};
    const seen=new Set();
    try {
      for await(const page of client.pages(resource,{filters,offset,limit,maxPages})) {
        for(const raw of page.data) {
          const id=externalId(raw.id);
          if(seen.has(id)){report.duplicates++;continue;}seen.add(id);
          const snapshot=normalizeResource(resource,raw);
          const local=await store.rpc('get',{...scope(),resource,external_object_id:id});
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
        }
        report.next_offset=page.nextOffset;
        if(!dryRun)await store.rpc('run_update',{...scope(),run_id,next_offset:report.next_offset,report});
      }
      if(!dryRun)await store.rpc('run_update',{...scope(),run_id,next_offset:report.next_offset,report,status:'completed'});
      return report;
    } catch(error){const safe=safeFinanceError(error);
      if(!dryRun)await store.rpc('run_update',{...scope(),run_id,report,status:'failed',error_code:safe.code});
      throw new FinanceError(safe.code,safe.retryable,503);}
  };
  const linkCustomer=async(customerId,firestoreDocId,{actor,resolveStudent}={})=>{
    externalId(customerId);
    if(!actor || typeof resolveStudent!=='function' || !/^[A-Za-z0-9_-]{1,128}$/.test(firestoreDocId)) throw new FinanceError('finance_identity_unverified');
    await verifyConnection();
    const student=await resolveStudent(firestoreDocId);
    if(!student || !['student','aluno'].includes(String(student.tipo||student.role||student.type).toLowerCase())) throw new FinanceError('finance_identity_unverified');
    const customer=await client.request(`/customers/${customerId}`);
    if(customer.id!==customerId || customer.deleted)throw new FinanceError('finance_customer_invalid');
    return store.rpc('link',{...scope(),customer_id:customerId,firestore_doc_id:firestoreDocId,verified_by:actor});
  };
  return {health,verifyConnection,ingestWebhook,processWebhookEvent,retryWebhookEvent,drain,repairPaymentById,sync,linkCustomer};
}
module.exports={createFinanceFoundation};
