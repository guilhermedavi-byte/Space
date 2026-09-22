const {getSessionFromRequest}=require('../_lib/session');
const {canAccessFinance}=require('./_lib/finance-integrations');
const {sendJson,readJsonBody}=require('./_lib/http');
const {supabaseFetch}=require('./_lib/supabase-rest');
const {uuid,externalId}=require('./_lib/finance-domain');

const NATURES=new Set(['RECURRING','RECURRING_FIRST_PAYMENT','ACQUISITION_ONE_OFF','NON_RECURRING_OTHER','UNKNOWN']);
const safeActor=user=>String(user?.sub||user?.uid||user?.id||user?.email||'').slice(0,160)||'finance_user';
const safeText=value=>String(value||'').trim().slice(0,800);
const connection=()=>uuid(process.env.FINANCE_CONNECTION_ID);
const request=(path,opts)=>supabaseFetch(path,opts);

async function classify({paymentId,nature,reason,actor}){
  const connectionId=connection();
  const id=externalId(paymentId);
  if(!NATURES.has(nature)){const e=new Error('finance_receivable_nature_invalid');e.code=e.message;e.status=400;throw e;}
  const found=await request(`/finance_receivables?connection_id=eq.${connectionId}&asaas_payment_id=eq.${encodeURIComponent(id)}&select=id,asaas_payment_id,asaas_customer_id,asaas_subscription_id,value,due_date,billing_type,snapshot&limit=1`,{timeoutMs:8000});
  const row=Array.isArray(found.data)?found.data[0]:null;
  if(!row){const e=new Error('finance_receivable_not_found');e.code=e.message;e.status=404;throw e;}
  const before=row.snapshot?.receivable_nature||{classification:'UNKNOWN',source:'implicit'};
  const now=new Date().toISOString();
  const source=row.asaas_subscription_id?'manual_subscription_scope':'manual_payment_scope';
  const after={classification:nature,source,reason:safeText(reason),actor,classified_at:now};
  const nextSnapshot={...(row.snapshot||{}),receivable_nature:after};
  await request(`/finance_receivables?connection_id=eq.${connectionId}&asaas_payment_id=eq.${encodeURIComponent(id)}`,{method:'PATCH',body:{snapshot:nextSnapshot,updated_at:now},headers:{Prefer:'return=minimal'},timeoutMs:8000});
  await request('/finance_audit_events',{method:'POST',body:{connection_id:connectionId,source:'ADMIN_USER',actor,object_type:'payments',external_object_id:id,action:'receivable_nature_classified',state_before:{receivable_nature:before},state_after:{receivable_nature:after},correlation_id:`receivable_nature:${id}:${now}`},headers:{Prefer:'return=minimal'},timeoutMs:8000});
  if(row.asaas_subscription_id&&nature!=='UNKNOWN'){
    const future=await request(`/finance_receivables?connection_id=eq.${connectionId}&asaas_subscription_id=eq.${encodeURIComponent(row.asaas_subscription_id)}&snapshot->receivable_nature=is.null&select=asaas_payment_id,snapshot&limit=100`,{timeoutMs:8000}).catch(()=>({data:[]}));
    for(const f of Array.isArray(future.data)?future.data:[]){
      if(f.asaas_payment_id===id)continue;
      const propagated={classification:nature==='RECURRING_FIRST_PAYMENT'?'RECURRING':nature,source:'propagated_from_subscription',reason:`Fonte: ${id}`,actor,classified_at:now};
      await request(`/finance_receivables?connection_id=eq.${connectionId}&asaas_payment_id=eq.${encodeURIComponent(f.asaas_payment_id)}`,{method:'PATCH',body:{snapshot:{...(f.snapshot||{}),receivable_nature:propagated},updated_at:now},headers:{Prefer:'return=minimal'},timeoutMs:8000}).catch(()=>null);
    }
  }
  return {ok:true,payment_id:id,before,after,propagation_scope:row.asaas_subscription_id?'subscription':'payment'};
}

function createHandler({session=getSessionFromRequest,env=process.env}={}){return async(req,res)=>{
  res.setHeader('Cache-Control','private, no-store');
  const user=session(req);if(!user)return sendJson(res,401,{error:'unauthorized'});if(!canAccessFinance(user))return sendJson(res,403,{error:'forbidden'});
  if(env.FINANCE_FOUNDATION_ENABLED!=='true')return sendJson(res,503,{error:'finance_foundation_disabled'});
  if(req.method!=='POST'){res.setHeader('Allow','POST');return sendJson(res,405,{error:'method_not_allowed'});}
  if(!env.SPACE_PUBLIC_BASE_URL||req.headers.origin!==new URL(env.SPACE_PUBLIC_BASE_URL).origin)return sendJson(res,403,{error:'invalid_origin'});
  try{const body=await readJsonBody(req);const result=await classify({paymentId:body.payment_id,nature:String(body.nature||'').toUpperCase(),reason:body.reason,actor:safeActor(user)});return sendJson(res,200,{...result,refresh:true});}
  catch(e){const safe=new Set(['finance_receivable_nature_invalid','finance_receivable_not_found','finance_external_id_invalid','finance_uuid_invalid']);return sendJson(res,safe.has(e.code||e.message)?(e.status||400):503,{error:safe.has(e.code||e.message)?(e.code||e.message):'finance_receivable_nature_unavailable'});}
};}
module.exports=createHandler();module.exports.createHandler=createHandler;module.exports.classify=classify;
