const {createFinanceFoundation}=require('./finance-foundation');
const {createAsaasClient}=require('./asaas');
const {supabaseFetch}=require('./supabase-rest');
const {getDocumentAsAdmin}=require('./firestore-admin');
const space=require('./finance-space');
const {classify}=require('./finance-identity-bridge');
const fail=(code,status=400)=>{throw Object.assign(Error(code),{code,status});};
const validCustomer=id=>/^cus_[A-Za-z0-9]+$/.test(id||'');
async function registerCanonicalPair({customerId,studentId,actor,source='creation'},{foundation=createFinanceFoundation({logger:()=>{}}),resolveStudent=id=>getDocumentAsAdmin('users/'+id)}={}){
 if(process.env.FINANCE_FOUNDATION_ENABLED!=='true')fail('finance_foundation_disabled',503);
 if(!validCustomer(customerId)||!/^[A-Za-z0-9_-]{1,128}$/.test(studentId||''))fail('canonical_pair_required');
 if(!actor)fail('actor_required',403);
 return foundation.linkCustomer(customerId,studentId,{actor:JSON.stringify({actor,method:source==='manual'?'manual':'id',source:'space.'+source,bridge_version:2}),resolveStudent});
}
let cached,pending,until=0;
async function directory(){if(cached&&Date.now()<until)return cached;if(!pending)pending=(async()=>{const sources=await space.loadSources();const client=createAsaasClient({readOnly:true});await createFinanceFoundation({client,logger:()=>{}}).verifyConnection({recordHealth:false});const customers=[];for await(const p of client.pages('customers',{limit:100,maxPages:100}))customers.push(...p.data);const value={sources,customers};cached=value;until=Date.now()+120000;return value;})().finally(()=>pending=null);return pending;}
const summary=s=>({id:s.firestoreDocId,name:s.nome||s.nomeCompleto||s.displayName||s.name||'Aluno sem nome',email:s.email||null,phone:s.telefone||s.phone||s.telefoneWhatsapp||null});
const fold=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
async function search(customerId,q=''){
 if(!validCustomer(customerId)||q.length>160)fail('invalid_query');const {sources,customers}=await directory();
 let customer=customers.find(c=>c.id===customerId);if(!customer){try{customer=await createAsaasClient({readOnly:true}).request('/customers/'+customerId);}catch{fail('customer_unavailable',404);}}
 if(customer.deleted)fail('customer_unavailable',409);
 const existing=(await supabaseFetch(`/finance_customer_student_links?connection_id=eq.${process.env.FINANCE_CONNECTION_ID}&asaas_customer_id=eq.${customerId}&select=asaas_customer_id,firestore_doc_id&limit=100`)).data;
 if(existing.length)fail('finance_identity_already_linked',409);
 const row=classify({sources,customers:customers.some(c=>c.id===customerId)?customers:[...customers,customer],existing}).find(r=>r.customer_id===customerId);
 const students=sources.users.filter(space.isStudent);const candidateIds=row?.candidate_ids||[];const candidates=students.filter(s=>candidateIds.includes(s.firestoreDocId)).map(summary);
 const needle=fold(q.trim()),digits=q.replace(/\D/g,'');const matched=needle.length>=2?students.filter(s=>{const r=summary(s);return fold([r.name,r.email,r.phone,r.id].join(' ')).includes(needle)||(digits.length>=4&&String(r.phone||'').replace(/\D/g,'').includes(digits));}):[];
 return {customer:{id:customerId,name:customer.name||'Nome não disponível',email:customer.email||null,phone:customer.mobilePhone||customer.phone||null},status:row?.status||'UNMATCHED',candidates,items:matched.slice(0,25).map(summary),has_more:matched.length>25};
}
module.exports={registerCanonicalPair,search};
