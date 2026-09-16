const {getSessionFromRequest}=require('../_lib/session');
const {canAccessFinance}=require('./_lib/finance-integrations');
const {supabaseFetch}=require('./_lib/supabase-rest');
const {uuid}=require('./_lib/finance-domain');
const {createFinanceReconciliation}=require('./_lib/finance-reconciliation');
const {createAsaasClient}=require('./_lib/asaas');
async function body(req){const chunks=[];for await(const c of req)chunks.push(Buffer.from(c));return JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}');}
async function readRows(connectionId=process.env.FINANCE_CONNECTION_ID){
 const c=uuid(connectionId),all=async(table,select)=>{const order=table==='finance_customer_student_links'?'asaas_customer_id,firestore_doc_id':'id';const out=[];for(let offset=0;offset<20000;offset+=500){const r=await supabaseFetch(`/${table}?connection_id=eq.${c}&select=${select}&order=${order}&offset=${offset}&limit=500`);if(!Array.isArray(r.data))throw Error('finance_read_failed');out.push(...r.data);if(r.data.length<500)return out;}throw Error('finance_read_limit');};
 const [receivables,payments,objects,links]=await Promise.all([all('finance_receivables','id,asaas_payment_id,asaas_customer_id,status,value,due_date,billing_type,deleted,snapshot'),all('finance_payments','id,asaas_payment_id,status,value,payment_date,confirmed_date,refund_value'),all('finance_provider_objects','id,resource,external_object_id,snapshot'),all('finance_customer_student_links','asaas_customer_id,firestore_doc_id')]);
 const names=new Map(objects.filter(o=>o.resource==='customers').map(o=>[o.external_object_id,o.snapshot?.name||null]));
 const linked=new Map();for(const l of links){const ids=linked.get(l.asaas_customer_id)||[];ids.push(l.firestore_doc_id);linked.set(l.asaas_customer_id,ids);}
 return {rows:receivables.map(r=>({...r,name:names.get(r.asaas_customer_id)||null,student_ids:linked.get(r.asaas_customer_id)||[],linked:Boolean(linked.get(r.asaas_customer_id)?.length)})),payments};
}
module.exports=async(req,res)=>{
 res.setHeader('Cache-Control','private, no-store');res.setHeader('Content-Type','application/json');const send=(s,d)=>{res.statusCode=s;res.end(JSON.stringify(d));};
 const user=getSessionFromRequest(req);if(!user)return send(401,{error:'unauthorized'});if(!canAccessFinance(user))return send(403,{error:'forbidden'});if(req.method!=='POST'){res.setHeader('Allow','POST');return send(405,{error:'method_not_allowed'});}if(process.env.FINANCE_FOUNDATION_ENABLED!=='true')return send(503,{error:'finance_foundation_disabled'});
 try{const b=await body(req),data=await readRows(),svc=createFinanceReconciliation({client:createAsaasClient({readOnly:false})});const actor=String(user.sub||user.uid||user.email||'operator');const result=b.action==='undo_reconciliation'?await svc.undo({body:b,actor}):b.action==='classify_origin'?await svc.classifyOrigin({body:b,actor,rows:data.rows,payments:data.payments}):await svc.confirm({body:b,actor,rows:data.rows});return send(200,{ok:true,result});}
 catch(e){const safe=new Set(['finance_reconciliation_invalid','finance_reconciliation_classification_invalid','finance_reconciliation_not_found','finance_external_id_invalid','finance_uuid_invalid','asaas_read_only','asaas_remote_error','asaas_forbidden','asaas_unauthorized']);const code=e.code||e.message||'unknown';if(!safe.has(code))console.error(JSON.stringify({scope:'finance_reconciliation_action_error',code,status:e.status||null}));return send(e.status|| (safe.has(code)?400:503),{error:safe.has(code)?code:'finance_reconciliation_unavailable'});}
};
