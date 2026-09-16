const {supabaseFetch}=require('./supabase-rest');
const {assertAttendanceTarget}=require('../../_lib/attendance-environment');
function checkMetaEnvironment(env=process.env){
 if(env.META_INBOUND_ENABLED!=='true')throw Object.assign(new Error('meta_inbound_disabled'),{status:503});
 if(env.META_OUTBOUND_ENABLED&&env.META_OUTBOUND_ENABLED!=='false')throw Object.assign(new Error('meta_outbound_forbidden'),{status:503});
 assertAttendanceTarget(env);
}
function createMetaStore({request=supabaseFetch,checkEnvironment=checkMetaEnvironment}={}){
 const rpc=async(name,body)=>{checkEnvironment();return(await request('/rpc/attendance_meta_'+name,{method:'POST',body,
  signal:AbortSignal.timeout(name==='capture'?10000:30000)})).data;};
 return {
  capture:(raw,requestId)=>rpc('capture',{p_raw_body:raw,p_request_id:requestId}),
  claim:id=>rpc('claim',{p_event_id:id||null}),
  complete:(id,lease,items)=>rpc('complete',{p_event_id:id,p_lease_id:lease,p_items:items}),
  fail:(id,lease,code,retryable)=>rpc('fail',{p_event_id:id,p_lease_id:lease,p_error_code:code,p_retryable:retryable}),
 };
}
module.exports={checkMetaEnvironment,createMetaStore,...createMetaStore()};
