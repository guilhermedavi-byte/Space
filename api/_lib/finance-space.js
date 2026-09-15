const {supabaseFetch}=require('./supabase-rest');
const {listCollectionAsAdmin}=require('./firestore-admin');
const lifecycle=require('./student-lifecycle');
const text=v=>typeof v==='string'&&v.trim()?v.trim():null;
const isStudent=s=>['student','aluno'].includes(String(s.tipo||s.role||s.type||'').toLowerCase());
async function all(table,select,request=supabaseFetch){const rows=[];for(let offset=0;offset<20000;offset+=500){const {data}=await request(`/${table}?select=${select}&order=id&offset=${offset}&limit=500`);if(!Array.isArray(data))throw Error('finance_space_read_failed');rows.push(...data);if(data.length<500)return rows;}throw Error('finance_space_read_limit');}
async function loadSources(){const [users,students,contracts]=await Promise.all([listCollectionAsAdmin('users',{decorate:false}),all('students','id,firestore_student_id,lifecycle_status,pause_status'),all('subscriptions','id,student_id,external_subscription_key,plan_name,lifecycle_status,pause_status,notice_started_at,last_active_date,churn_at,started_at')]);return {users,students,contracts};}
function candidates({users,students,contracts},customers,subscriptions,existing=[]){
 const valid=new Map(users.filter(isStudent).map(s=>[s.firestoreDocId,s]));const proposed=new Map();const add=(cid,sid,source)=>{if(!/^cus_[A-Za-z0-9]+$/.test(cid||'')||!valid.has(sid))return;const entries=proposed.get(cid)||[];entries.push({student_id:sid,source});proposed.set(cid,entries);};
 for(const c of customers)if(!c.deleted)add(c.id,c.externalReference,'asaas_external_reference');
 for(const s of valid.values())for(const field of ['asaas_customer_id','asaasCustomerId'])add(s[field],s.firestoreDocId,'firestore_'+field);
 const byStudent=new Map(students.map(s=>[s.id,s.firestore_student_id]));const bySub=new Map(subscriptions.map(s=>[s.id,s.customer]));
 for(const s of contracts)if(/^sub_[A-Za-z0-9]+$/.test(s.external_subscription_key||''))add(bySub.get(s.external_subscription_key),byStudent.get(s.student_id),'space_external_subscription_key');
 const active=new Set(customers.filter(c=>!c.deleted).map(c=>c.id));const accepted=[],uncertain=[];
 for(const [customer_id,entries]of proposed){const ids=new Set(entries.map(e=>e.student_id));const prior=existing.filter(l=>l.asaas_customer_id===customer_id);if(ids.size!==1||!active.has(customer_id)||prior.some(l=>!ids.has(l.firestore_doc_id))){uncertain.push(customer_id);continue;}accepted.push({customer_id,student_id:[...ids][0],sources:[...new Set(entries.map(e=>e.source))]});}
 return {accepted,uncertain};
}
function profiles({users,students,contracts}){
 const canonical=new Map(students.map(s=>[s.firestore_student_id,s]));const result=new Map();
 for(const s of users.filter(isStudent)){
  const student=canonical.get(s.firestoreDocId);const own=student?contracts.filter(c=>c.student_id===student.id):[];
  const rows=own.length?own:Array.isArray(s.lifecycleSubscriptions)?s.lifecycleSubscriptions:s.lifecycle?[s.lifecycle]:[];
  const status=rows.length?lifecycle.getLifecycleStatus({subscriptions:rows}):student?.lifecycle_status||null;
  result.set(s.firestoreDocId,{student_id:s.firestoreDocId,name:text(s.nome||s.nomeCompleto||s.displayName||s.name),lifecycle_status:status,lifecycle_label:({active:'Ativo',cancellation_requested:'Cancelamento solicitado',cancellation_scheduled:'Em aviso prévio',churned:'Encerrado'})[status]||status,
   student_status:typeof s.ativo==='boolean'?(s.ativo?'Ativo':'Inativo'):text(s.status),plans:[...new Set([...rows.map(r=>text(r.plan_name)),text(s.plano||s.plan)].filter(Boolean))],notice:rows.filter(r=>r.notice_started_at).map(r=>({started_at:r.notice_started_at,last_active_date:r.last_active_date||null,churn_at:r.churn_at||null})),cs_owner:text(s.responsavelCS||s.csResponsavel||s.cs_owner_name),source:own.length?'Space · contratos canônicos':'Space · Firestore'});
 }
 return result;
}
module.exports={all,loadSources,candidates,profiles,isStudent};
