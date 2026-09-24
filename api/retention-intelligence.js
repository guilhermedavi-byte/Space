const {sendJson,readJsonBody}=require('./_lib/http');
const {resolveAdminRequestAuth}=require('./_lib/admin-request-auth');
const {requireResolvedAdminPermission}=require('./_lib/admin-permissions');
const {supabaseFetch}=require('./_lib/supabase-rest');
module.exports=async(req,res)=>{
 const auth=await resolveAdminRequestAuth(req,{logPrefix:'[retention-health]'});
 if(!auth.ok) return sendJson(res,auth.status,auth.body);
 const guard=await requireResolvedAdminPermission(auth,'pedagogico.retention.view');
 if(!guard.ok) return sendJson(res,guard.status,guard.body);
 try{
  if(req.method==='GET') {
   const month=new URL(req.url,'https://space.invalid').searchParams.get('month')||require('../assets/student-lifecycle').dateKey(new Date()).slice(0,7);
   if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return sendJson(res,400,{error:'invalid_month'});
   return sendJson(res,200,await require('./_lib/retention-health-store').readIntelligence(month));
  }
  if(req.method==='PATCH') {
   const actionGuard=await requireResolvedAdminPermission(auth,'pedagogico.retention.update');
   if(!actionGuard.ok) return sendJson(res,actionGuard.status,actionGuard.body);
   const body=await readJsonBody(req);
   if(body.action==='settings') {
    const message=String(body.absence_message||'').trim();
    if(!message||message.length>2000)return sendJson(res,400,{error:'invalid_message'});
    await supabaseFetch('/retention_health_settings?id=eq.admin_v0',{method:'PATCH',body:{absence_message:message,updated_by:auth.session.sub,updated_at:new Date().toISOString()}});
    return sendJson(res,200,{ok:true});
   }
   if(body.action==='resolve_occurrence') {
    if(!/^[a-f0-9-]{36}$/i.test(body.id||''))return sendJson(res,400,{error:'invalid_occurrence'});
    await supabaseFetch('/student_occurrences?id=eq.'+body.id,{method:'PATCH',body:{status:'resolved',resolved_at:new Date().toISOString(),resolved_by:auth.session.sub,recovery_status:'resolved'}});
    return sendJson(res,200,{ok:true});
   }

   if(!/^[a-f0-9-]{36}$/i.test(body.id||'') || !['resolved','dismissed','acknowledged'].includes(body.status)) return sendJson(res,400,{error:'invalid_alert_update'});
   const {data}=await supabaseFetch(`/retention_alerts?id=eq.${body.id}`,{method:'PATCH',body:{status:body.status,resolved_at:body.status==='acknowledged'?null:new Date().toISOString(),resolved_by:auth.session.sub,updated_at:new Date().toISOString()}});
   return sendJson(res,200,{alert:data?.[0]||null});
  }
  return sendJson(res,405,{error:'method_not_allowed'});
 }catch(error){ console.error('[retention-health]',{code:error.code||'read_failed'});return sendJson(res,500,{error:'retention_intelligence_unavailable'}); }
};
