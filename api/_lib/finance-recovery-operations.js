const { supabaseFetch } = require('./supabase-rest');
const { uuid, externalId } = require('./finance-domain');
const { cents } = require('./finance-v1-read');
const {getDocumentAsAdmin,listCollectionAsAdmin,commitWritesAsAdmin}=require('./firestore-admin');
const {PROJECT_ID,encodeFields}=require('../../_lib/firestore-rest');

const STATUS_LABELS = {
  new: 'Novo',
  followup: 'Em acompanhamento',
  promised: 'Promessa de pagamento',
  negotiation: 'Em negociação',
  human_intervention: 'Intervenção humana',
  recovered: 'Recuperado',
};
const ACTION_LABELS = {
  contact_attempt: 'Tentativa de contato',
  payment_promise: 'Promessa de pagamento',
  followup_delayed: 'Acompanhamento adiado',
  human_intervention: 'Encaminhado para intervenção humana',
  negotiating: 'Marcado como em negociação',
  auto_recovered: 'Recuperado automaticamente',
};
const ACTIONS = new Set(['contact_attempt','payment_promise','followup_delayed','human_intervention','negotiating']);
const clean = (value, max = 1200) => String(value || '').trim().slice(0, max);
const isDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
const amount = (value) => {
  const raw = String(value ?? '').trim().replace(',', '.');
  if (!/^\d+(?:\.\d{1,2})?$/.test(raw)) return null;
  return raw;
};
const decorateCase = (row) => row ? {
  payment_id: row.asaas_payment_id || row.payment_id,
  status: row.status,
  status_label: STATUS_LABELS[row.status] || row.status,
  next_action_date: row.next_action_date || null,
  next_action_note: row.next_action_note || null,
  promised_payment_date: row.promised_payment_date || null,
  promised_amount: cents(row.promised_amount),
  promise_note: row.promise_note || null,
  responsible: row.responsible || null,
  last_action: row.last_action || null,
  last_action_label: ACTION_LABELS[row.last_action] || null,
  last_event_at: row.last_event_at || null,
} : null;
const decorateEvent = (row) => ({
  id: row.id,
  action: row.action,
  action_label: ACTION_LABELS[row.action] || row.action,
  status_after: row.status_after,
  status_label: STATUS_LABELS[row.status_after] || row.status_after,
  promised_payment_date: row.promised_payment_date || null,
  promised_amount: cents(row.promised_amount),
  followup_date: row.followup_date || null,
  note: row.note || null,
  responsible: row.responsible || null,
  actor: row.actor || null,
  created_at: row.created_at,
});
const docId = (paymentId) => encodeURIComponent(externalId(paymentId));
const docPath = (paymentId) => `financeRecoveryCases/${docId(paymentId)}`;
const docName = (paymentId) => {
  if(!PROJECT_ID){const e=new Error('missing_firestore_project_id');e.code=e.message;throw e;}
  return `projects/${PROJECT_ID}/databases/(default)/documents/${docPath(paymentId)}`;
};

function createRecoveryOperations({request=supabaseFetch,connectionId=process.env.FINANCE_CONNECTION_ID}={}){
 const scope=()=>uuid(connectionId);
 const readDoc=async(paymentId)=>{try{return await getDocumentAsAdmin(docPath(paymentId));}catch(error){if(error.status===404)return null;throw error;}};
 const writeDoc=async(paymentId,data)=>{
  const fields=Object.keys(data);
  const result=await commitWritesAsAdmin({writes:[{update:{name:docName(paymentId),fields:encodeFields(data).fields},updateMask:{fieldPaths:fields}}]});
  if(!result.ok){const e=new Error('finance_recovery_unavailable');e.code=e.message;e.status=503;throw e;}
  return data;
 };
 const casesFor=async(ids)=>{
  const cleanIds=[...new Set(ids.filter(Boolean).map(externalId))];
  if(!cleanIds.length)return new Map();
  try{
   const wanted=new Set(cleanIds);
   const rows=await listCollectionAsAdmin('financeRecoveryCases',{pageSize:1000,maxPages:5,decorate:false});
   return new Map(rows.filter(row=>row.connection_id===scope()&&wanted.has(row.asaas_payment_id||row.payment_id)).map(row=>[row.asaas_payment_id||row.payment_id,decorateCase(row)]));
  }catch{return new Map();}
 };
 const eventsFor=async(paymentId)=>{
  const id=externalId(paymentId);
  try{
   const row=await readDoc(id);
   return (Array.isArray(row?.events)?row.events:[]).slice().sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at))||String(b.id).localeCompare(String(a.id))).slice(0,30).map(decorateEvent);
  }catch{return [];}
 };
 const autoRecover=async(rows=[])=>{
  const paid=new Set(rows.filter(r=>r.group==='received').map(r=>r.id));
  if(!paid.size)return {updated:0};
  let updated=0;
  const cases=await casesFor([...paid]);
  for(const [paymentId,current] of cases){
   if(current.status==='recovered')continue;
   const prior=await readDoc(paymentId);
   if(!prior)continue;
   const now=new Date().toISOString();
   const event={id:`auto_${Date.now()}_${Math.random().toString(16).slice(2)}`,action:'auto_recovered',status_after:'recovered',actor:'asaas',note:'Cobrança marcada como paga na Financial Foundation.',created_at:now};
   await writeDoc(paymentId,{...prior,status:'recovered',last_action:'auto_recovered',last_event_at:now,updated_at:now,events:[...(Array.isArray(prior.events)?prior.events:[]),event].slice(-80)});
   updated++;
  }
  return {updated};
 };
 const recordAction=async(body,actor)=>{
  const paymentId=externalId(body?.payment_id);
  const action=clean(body?.action,40);
  if(!ACTIONS.has(action)){const e=new Error('finance_recovery_action_invalid');e.code=e.message;e.status=400;throw e;}
  const payload={connection_id:scope(),asaas_payment_id:paymentId,action,actor:clean(actor,160),note:clean(body?.note),responsible:clean(body?.responsible,160)};
  if(action==='payment_promise'){
   const promised=amount(body?.promised_amount);
   if(!isDate(body?.promised_payment_date)||!promised){const e=new Error('finance_recovery_promise_required');e.code=e.message;e.status=400;throw e;}
   payload.promised_payment_date=body.promised_payment_date;
   payload.promised_amount=promised;
  }
  if(action==='followup_delayed'){
   if(!isDate(body?.followup_date)){const e=new Error('finance_recovery_followup_required');e.code=e.message;e.status=400;throw e;}
   payload.followup_date=body.followup_date;
  }
  try{
   const {data}=await request(`/finance_receivables?connection_id=eq.${scope()}&asaas_payment_id=eq.${encodeURIComponent(paymentId)}&deleted=eq.false&status=in.(PENDING,OVERDUE,DUNNING_REQUESTED)&select=asaas_payment_id,asaas_customer_id&limit=1`);
   const receivable=Array.isArray(data)&&data[0];
   if(!receivable){const e=new Error('finance_recovery_not_active');e.code=e.message;e.status=400;throw e;}
   const current=await readDoc(paymentId)||{};
   const now=new Date().toISOString();
   const status={contact_attempt:'followup',payment_promise:'promised',followup_delayed:'followup',human_intervention:'human_intervention',negotiating:'negotiation'}[action];
   const event={id:`evt_${Date.now()}_${Math.random().toString(16).slice(2)}`,action,status_after:status,promised_payment_date:payload.promised_payment_date||null,promised_amount:payload.promised_amount||null,followup_date:payload.followup_date||null,note:payload.note||null,responsible:payload.responsible||null,actor:payload.actor,created_at:now};
   const next={...current,connection_id:scope(),asaas_payment_id:paymentId,asaas_customer_id:receivable.asaas_customer_id||null,status,last_action:action,last_event_at:now,updated_at:now,created_at:current.created_at||now,events:[...(Array.isArray(current.events)?current.events:[]),event].slice(-80)};
   if(action==='followup_delayed'){next.next_action_date=payload.followup_date;next.next_action_note=payload.note||null;}
   if(action==='payment_promise'){next.promised_payment_date=payload.promised_payment_date;next.promised_amount=payload.promised_amount;next.promise_note=payload.note||null;}
   if(payload.responsible)next.responsible=payload.responsible;
   const saved=await writeDoc(paymentId,next);
   return {case:decorateCase(saved),events:(saved.events||[]).slice().reverse().map(decorateEvent)};
  }catch(error){
   const allowed=new Set(['finance_recovery_payment_invalid','finance_recovery_action_invalid','finance_recovery_amount_invalid','finance_recovery_promise_required','finance_recovery_followup_required','finance_recovery_not_active']);
   error.code=allowed.has(error.message)?error.message:'finance_recovery_unavailable';
   error.status=allowed.has(error.code)?400:503;
   throw error;
  }
 };
 return {casesFor,eventsFor,recordAction,autoRecover,STATUS_LABELS,ACTION_LABELS};
}
module.exports={createRecoveryOperations,STATUS_LABELS,ACTION_LABELS};
