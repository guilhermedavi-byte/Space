const {timingSafeEqual}=require('node:crypto');
const {getSessionFromRequest}=require('../_lib/session');
const {readJsonBody,sendJson}=require('./_lib/http');
const {createAsaasClient}=require('./_lib/asaas');
const {createFinanceFoundation}=require('./_lib/finance-foundation');
const {supabaseFetch}=require('./_lib/supabase-rest');
const space=require('./_lib/finance-space');
function maintenance(req){const supplied=String(req.headers.authorization||'').replace(/^Bearer /,'');const expected=process.env.FINANCE_RECOVERY_MAINTENANCE_TOKEN||'';return expected.length>=32&&Date.now()<Date.parse(process.env.FINANCE_RECOVERY_MAINTENANCE_UNTIL||'')&&supplied.length===expected.length&&timingSafeEqual(Buffer.from(supplied),Buffer.from(expected));}
module.exports=async(req,res)=>{
 res.setHeader('Cache-Control','private, no-store');
 const trusted=maintenance(req),user=getSessionFromRequest(req);
 if(!trusted&&user?.role!=='admin')return sendJson(res,403,{error:'forbidden'});
 if(process.env.FINANCE_FOUNDATION_ENABLED!=='true')return sendJson(res,503,{error:'foundation_disabled'});
 if(!['GET','POST'].includes(req.method))return sendJson(res,405,{error:'method_not_allowed'});
 if(req.method==='POST'&&!trusted&&req.headers.origin!==process.env.SPACE_PUBLIC_BASE_URL)return sendJson(res,403,{error:'invalid_origin'});
 try{
  const body=req.method==='POST'?await readJsonBody(req):{};
  const f=createFinanceFoundation({logger:()=>{}});const actor=trusted?'finance_recovery_base_operator':String(user.sub||user.uid||'admin');
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
  const fields={};for(const s of sources.users.filter(space.isStudent))for(const [key,value]of Object.entries(s))if(value!=null&&value!=='')fields[key]=(fields[key]||0)+1;
  return sendJson(res,200,{customers:customers.length,subscriptions:subscriptions.length,students:sources.users.filter(space.isStudent).length,existing_links:existing.length,eligible:matches.accepted.length,uncertain:matches.uncertain.length,applied,pending:matches.accepted.filter(m=>!existing.some(l=>l.asaas_customer_id===m.customer_id&&l.firestore_doc_id===m.student_id)).length-applied,student_fields:fields,external_reference_exact:matches.accepted.filter(m=>m.sources.includes('asaas_external_reference')).length});
 }catch{return sendJson(res,503,{error:'finance_recovery_base_failed'});}
};
