const {timingSafeEqual}=require('node:crypto');
const {getSessionFromRequest}=require('../_lib/session');
const {readJsonBody,sendJson}=require('./_lib/http');
const {createAsaasClient}=require('./_lib/asaas');
const {createFinanceFoundation}=require('./_lib/finance-foundation');
const {supabaseFetch}=require('./_lib/supabase-rest');
const space=require('./_lib/finance-space'),bridge=require('./_lib/finance-identity-bridge');
function maintenance(req){const given=String(req.headers.authorization||'').replace(/^Bearer /,''),expected=process.env.FINANCE_RECOVERY_MAINTENANCE_TOKEN||'';return /^[a-f0-9]{64}$/.test(given)&&expected.length===64&&Date.now()<Date.parse(process.env.FINANCE_RECOVERY_MAINTENANCE_UNTIL||'')&&timingSafeEqual(Buffer.from(given),Buffer.from(expected));}
module.exports=async(req,res)=>{res.setHeader('Cache-Control','private, no-store');const temporary=maintenance(req),user=getSessionFromRequest(req);if(!temporary&&user?.role!=='admin')return sendJson(res,403,{error:'forbidden'});if(process.env.FINANCE_FOUNDATION_ENABLED!=='true')return sendJson(res,503,{error:'foundation_disabled'});if(!['GET','POST'].includes(req.method))return sendJson(res,405,{error:'method_not_allowed'});if(req.method==='POST'&&!temporary&&req.headers.origin!==process.env.SPACE_PUBLIC_BASE_URL)return sendJson(res,403,{error:'invalid_origin'});
 try{if(req.method==='POST'&&(await readJsonBody(req)).action!=='apply')return sendJson(res,400,{error:'invalid_action'});const actor=temporary?'identity_bridge_operator':String(user.sub||user.uid||user.id||'');if(!actor)return sendJson(res,403,{error:'actor_required'});
 const client=createAsaasClient({readOnly:true}),f=createFinanceFoundation({client,logger:()=>{}});await f.verifyConnection({recordHealth:false});
 const legacy=[];const legacyCounts={};for(const table of ['n8n_alunos_financeiro_space','n8n_onboarding_alunos_space','n8n_cobrancas_financeiras_space','billing_accounts']){const rows=await space.all(table,'*');legacyCounts[table]=rows.length;legacy.push(...rows.map(r=>({...r,bridge_source:table})));}
 const sources=await space.loadSources(),customers=[],subscriptions=[];for(const [resource,rows]of [['customers',customers],['subscriptions',subscriptions]])for await(const p of client.pages(resource,{limit:100,maxPages:100}))rows.push(...p.data);
 const connection=process.env.FINANCE_CONNECTION_ID;const existing=(await supabaseFetch(`/finance_customer_student_links?connection_id=eq.${connection}&select=asaas_customer_id,firestore_doc_id,verified_by,verified_at&limit=20000`)).data;if(!Array.isArray(existing)||existing.length>=20000)throw Error();
 const ids=new Set(customers.map(c=>c.id));for(let offset=0;offset<20000;offset+=500){const {data}=await supabaseFetch(`/finance_receivables?connection_id=eq.${connection}&select=asaas_customer_id&order=id&offset=${offset}&limit=500`);for(const r of data)if(r.asaas_customer_id)ids.add(r.asaas_customer_id);if(data.length<500)break;if(offset===19500)throw Error();}for(const s of subscriptions)ids.add(s.customer);
 // Historic IDs omitted by Asaas listing are retained explicitly; no guessed identifiers.
 for(const id of ids)if(!customers.some(c=>c.id===id)){try{const c=await client.request('/customers/'+encodeURIComponent(id));if(c.id!==id)throw Error();customers.push(c);}catch(e){if(e.code!=='asaas_not_found')throw e;customers.push({id,unavailable:true});}}
 const matches=bridge.classify({sources,customers,subscriptions,existing,legacy});let applied=0;
 if(req.method==='POST')for(const m of matches.filter(r=>r.status==='MATCHED'&&!r.existing).slice(0,20)){
  const current=(await supabaseFetch(`/finance_customer_student_links?connection_id=eq.${connection}&asaas_customer_id=eq.${encodeURIComponent(m.customer_id)}&select=firestore_doc_id`)).data;if(current.some(l=>l.firestore_doc_id!==m.student_id))continue;
  await f.linkCustomer(m.customer_id,m.student_id,{actor:JSON.stringify({actor,method:m.method,source:m.source,bridge_version:1}),resolveStudent:async id=>sources.users.find(s=>s.firestoreDocId===id)});m.existing=true;applied++;
 }
 return sendJson(res,200,{...bridge.summarize(matches),applied,legacy:legacyCounts,space_students:sources.users.filter(space.isStudent).length});
 }catch{return sendJson(res,503,{error:'identity_bridge_failed'});}
};
