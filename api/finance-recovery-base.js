const {getSessionFromRequest}=require('../_lib/session');
const {readJsonBody,sendJson}=require('./_lib/http');
const {requireAdminPermission}=require('./_lib/admin-permissions');
const {createAsaasClient}=require('./_lib/asaas');
const {createFinanceFoundation}=require('./_lib/finance-foundation');
const {supabaseFetch}=require('./_lib/supabase-rest');
const space=require('./_lib/finance-space');
module.exports=async(req,res)=>{
 res.setHeader('Cache-Control','private, no-store');
 const user=getSessionFromRequest(req);
 if(user?.role!=='admin')return sendJson(res,403,{error:'forbidden'});
 const guard=await requireAdminPermission(req,'financeiro.recovery');if(!guard.ok)return sendJson(res,guard.status,guard.body);
 if(process.env.FINANCE_FOUNDATION_ENABLED!=='true')return sendJson(res,503,{error:'foundation_disabled'});
 if(!['GET','POST'].includes(req.method))return sendJson(res,405,{error:'method_not_allowed'});
 if(req.method==='POST'&&req.headers.origin!==process.env.SPACE_PUBLIC_BASE_URL)return sendJson(res,403,{error:'invalid_origin'});
 try{
  const body=req.method==='POST'?await readJsonBody(req):{};
  const f=createFinanceFoundation({logger:()=>{}});const actor=String(user.sub||user.uid||user.id||'');if(!actor)return sendJson(res,403,{error:'actor_required'});
  if(body.action==='sync_subscriptions')return sendJson(res,200,await f.syncSubscriptionPage({offset:body.offset||0,limit:20,actor}));
  const sources=await space.loadSources();const client=createAsaasClient({readOnly:true});await f.verifyConnection({recordHealth:false});
  const customers=[],subscriptions=[];for(const [resource,rows]of [['customers',customers],['subscriptions',subscriptions]])for await(const page of client.pages(resource,{limit:100,maxPages:100}))rows.push(...page.data);
  const id=process.env.FINANCE_CONNECTION_ID;const existing=(await supabaseFetch(`/finance_customer_student_links?connection_id=eq.${id}&select=asaas_customer_id,firestore_doc_id&limit=20000`)).data;
  const matches=space.candidates(sources,customers,subscriptions,existing);let applied=0;
  if(req.method==='POST'){
   if(body.action!=='link_identifiers')return sendJson(res,400,{error:'invalid_action'});
   for(const m of matches.accepted.filter(m=>!existing.some(l=>l.asaas_customer_id===m.customer_id&&l.firestore_doc_id===m.student_id)).slice(0,20)){
    await f.linkCustomer(m.customer_id,m.student_id,{actor:actor+':'+m.sources.join('+'),resolveStudent:async sid=>sources.users.find(s=>s.firestoreDocId===sid)});applied++;
   }
  }
  return sendJson(res,200,{customers:customers.length,subscriptions:subscriptions.length,students:sources.users.filter(space.isStudent).length,existing_links:existing.length,eligible:matches.accepted.length,uncertain:matches.uncertain.length,applied,pending:matches.accepted.filter(m=>!existing.some(l=>l.asaas_customer_id===m.customer_id&&l.firestore_doc_id===m.student_id)).length-applied,customer_references_present:customers.filter(c=>c.externalReference).length,subscription_references_present:subscriptions.filter(c=>c.externalReference).length,external_reference_exact:matches.accepted.filter(m=>m.sources.includes('asaas_external_reference')).length});
 }catch{return sendJson(res,503,{error:'finance_recovery_base_failed'});}
};
