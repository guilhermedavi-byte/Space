const {normalizeEnvelope,parseEnvelope}=require('./attendance-meta-adapter');
const store=require('./attendance-meta-store');
const {createHash}=require('node:crypto');
function createMetaProcessor({repository=store,log=event=>console.info(JSON.stringify(event))}={}){
 return async function processMetaWebhookEvent(eventId){
  const started=performance.now();const claimed=await repository.claim(eventId);
  if(!claimed?.lease_id)return {state:claimed?.state||'not_claimed'};
  const id=claimed.raw_event_id,lease=claimed.lease_id;
  try{
   const items=normalizeEnvelope(parseEnvelope(Buffer.from(claimed.raw_body,'utf8')).body);
   const result=await repository.complete(id,lease,items);
   log({event:'meta_processing',raw_event_id:id,request_id:claimed.request_id,provider:'meta_whatsapp',
    state:result.state,attempt:claimed.attempt_count,event_retry_total:claimed.attempt_count>1?1:0,
    event_processing_success_total:result.state==='processed'?1:0,event_processing_failure_total:['retryable_failed','terminal_failed'].includes(result.state)?1:0,
    unhandled_event_total:result.unhandled_count||0,inbound_message_created_total:result.inbound_created||0,event_processing_latency:performance.now()-started,
    external_message_id_hashes:items.filter(i=>i.external_message_id).map(i=>createHash('sha256').update(i.external_message_id).digest('hex')),
    contexts:(result.items||[]).map(i=>({item_id:i.item_id,connection_id:i.connection_id,conversation_id:i.conversation_id,message_id:i.message_id,state:i.state}))});
   return result;
  }catch(e){
   const terminal=['meta_invalid_json','meta_invalid_envelope','meta_too_many_items','meta_secret_in_payload'].includes(e.code);
   // SQL/network exception text may contain payload. Persist and log only fixed codes.
   const result=await repository.fail(id,lease,terminal?'invalid_envelope':'processor_unavailable',!terminal);
   log({event:'meta_processing_failure',raw_event_id:id,request_id:claimed.request_id,provider:'meta_whatsapp',
    event_processing_failure_total:1,state:result.state,event_processing_latency:performance.now()-started});
   return result;
  }
 };
}
module.exports={createMetaProcessor,processMetaWebhookEvent:createMetaProcessor()};
