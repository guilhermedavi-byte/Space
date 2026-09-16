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
  closed: 'Encerrado',
  recovered: 'Recuperado',
};
const ACTION_LABELS = {
  contact_attempt: 'Tentativa de contato',
  payment_promise: 'Promessa de pagamento',
  followup_delayed: 'Acompanhamento adiado',
  human_intervention: 'Encaminhado para intervenção humana',
  negotiating: 'Marcado como em negociação',
  auto_recovered: 'Recuperado automaticamente',
  auto_closed: 'Régua encerrada automaticamente',
  rule_due: 'Ação automática pendente',
  rule_paused: 'Régua pausada',
  rule_resumed: 'Régua retomada',
  rule_d_minus_3: 'D-3',
  rule_d_minus_1: 'D-1',
  rule_d0: 'D0',
  rule_d_plus_1: 'D+1',
  rule_d_plus_3: 'D+3',
  rule_d_plus_7: 'D+7',
  promise_followup: 'Retomar após promessa',
};
const RULES=[
 {stage:'D-3',offset:-3,type:'rule_d_minus_3'},
 {stage:'D-1',offset:-1,type:'rule_d_minus_1'},
 {stage:'D0',offset:0,type:'rule_d0'},
 {stage:'D+1',offset:1,type:'rule_d_plus_1'},
 {stage:'D+3',offset:3,type:'rule_d_plus_3'},
 {stage:'D+7',offset:7,type:'rule_d_plus_7',can_escalate_human:true},
 {stage:'Intervenção humana',offset:16,type:'human_intervention'},
];
const ACTIVE_GROUPS=new Set(['upcoming','overdue']);
const STOP_GROUPS=new Set(['received','closed']);
const ACTIONS = new Set(['contact_attempt','payment_promise','followup_delayed','human_intervention','negotiating','pause_rule','resume_rule']);
const clean = (value, max = 1200) => String(value || '').trim().slice(0, max);
const isDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
const addDays=(date,days)=>{const d=new Date(`${date}T00:00:00Z`);d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);};
const diffDays=(today,due)=>Math.floor((Date.parse(`${today}T00:00:00Z`)-Date.parse(`${due}T00:00:00Z`))/86400000);
const ruleForOffset=offset=>RULES.filter(r=>offset>=r.offset).at(-1)||null;
const nextRuleAfter=offset=>RULES.find(r=>offset<r.offset)||null;
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
  rule_state: row.rule_state || 'active',
  rule_state_label: ({active:'Ativa',paused:'Pausada',stopped:'Encerrada'}[row.rule_state]) || 'Ativa',
  current_rule_stage: row.current_rule_stage || null,
  next_action_at: row.next_action_at || row.next_action_date || null,
  next_action_type: row.next_action_type || null,
  next_action_type_label: ACTION_LABELS[row.next_action_type] || row.next_action_type || null,
  pause_reason: row.pause_reason || null,
  pending_actions: Array.isArray(row.pending_internal_events) ? row.pending_internal_events.filter(e=>e?.status==='pending').length : 0,
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
const internalEvent=(row,rule,now)=>({id:`rule_${row.id}_${rule.stage.replace(/[^A-Za-z0-9]+/g,'_')}`,contract_version:1,source:'finance_recovery_rule',action:'rule_due',action_label:ACTION_LABELS.rule_due,status:'pending',stage:rule.stage,action_type:rule.type,channel:null,delivery:'not_scheduled',can_escalate_human:rule.can_escalate_human===true,asaas_payment_id:row.id,asaas_customer_id:row.customer_id||null,student_ids:row.student_ids||[],due_date:row.due_date||null,created_at:now});
const docId = (paymentId) => encodeURIComponent(externalId(paymentId));
const docPath = (paymentId) => `financeRecoveryCases/${docId(paymentId)}`;
const docName = (paymentId, projectId=PROJECT_ID) => {
  if(!projectId){const e=new Error('missing_firestore_project_id');e.code=e.message;throw e;}
  return `projects/${projectId}/databases/(default)/documents/${docPath(paymentId)}`;
};

function createRecoveryOperations({request=supabaseFetch,connectionId=process.env.FINANCE_CONNECTION_ID,firestore={getDocumentAsAdmin,listCollectionAsAdmin,commitWritesAsAdmin},projectId=PROJECT_ID}={}){
 const scope=()=>uuid(connectionId);
 const readDoc=async(paymentId)=>{try{return await firestore.getDocumentAsAdmin(docPath(paymentId));}catch(error){if(error.status===404)return null;throw error;}};
 const writeDoc=async(paymentId,data)=>{
  const fields=Object.keys(data);
  const result=await firestore.commitWritesAsAdmin({writes:[{update:{name:docName(paymentId,projectId),fields:encodeFields(data).fields},updateMask:{fieldPaths:fields}}]});
  if(!result.ok){const e=new Error('finance_recovery_unavailable');e.code=e.message;e.status=503;throw e;}
  return data;
 };
 const writeDocs=async(docs)=>{
  const items=docs.filter(Boolean);
  for(let i=0;i<items.length;i+=200){
   const batch=items.slice(i,i+200).map(({paymentId,data})=>({update:{name:docName(paymentId,projectId),fields:encodeFields(data).fields},updateMask:{fieldPaths:Object.keys(data)}}));
   const result=await firestore.commitWritesAsAdmin({writes:batch});
   if(!result.ok){const e=new Error('finance_recovery_unavailable');e.code=e.message;e.status=503;throw e;}
  }
  return {ok:true};
 };
 const loadCases=async()=>{
  const rows=await firestore.listCollectionAsAdmin('financeRecoveryCases',{pageSize:1000,maxPages:5,decorate:false});
  return rows.filter(row=>row.connection_id===scope());
 };
 const casesFor=async(ids)=>{
  const cleanIds=[...new Set(ids.filter(Boolean).map(externalId))];
  if(!cleanIds.length)return new Map();
  try{
   const wanted=new Set(cleanIds);
   return new Map((await loadCases()).filter(row=>wanted.has(row.asaas_payment_id||row.payment_id)).map(row=>[row.asaas_payment_id||row.payment_id,decorateCase(row)]));
  }catch{return new Map();}
 };
 const eventsFor=async(paymentId)=>{
  const id=externalId(paymentId);
  try{
   const row=await readDoc(id);
   return (Array.isArray(row?.events)?row.events:[]).slice().sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at))||String(b.id).localeCompare(String(a.id))).slice(0,30).map(decorateEvent);
  }catch{return [];}
 };
 const stopFinished=async(rows=[])=>{
  const stopped=new Map(rows.filter(r=>STOP_GROUPS.has(r.group)).map(r=>[r.id,r]));
  if(!stopped.size)return {updated:0};
  let updated=0;
  const cases=await casesFor([...stopped.keys()]);
  for(const [paymentId,current] of cases){
   if(current.rule_state==='stopped')continue;
   const prior=await readDoc(paymentId);
   if(!prior)continue;
   const row=stopped.get(paymentId),paid=row?.group==='received';
   const now=new Date().toISOString();
   const action=paid?'auto_recovered':'auto_closed',status=paid?'recovered':'closed';
   const event={id:`auto_${Date.now()}_${Math.random().toString(16).slice(2)}`,action,status_after:status,actor:'asaas',note:paid?'Cobrança marcada como paga na Financial Foundation.':'Cobrança encerrada/cancelada na Financial Foundation.',created_at:now};
   await writeDoc(paymentId,{...prior,status,rule_state:'stopped',next_action_at:null,next_action_type:null,last_action:action,last_event_at:now,updated_at:now,pending_internal_events:[],events:[...(Array.isArray(prior.events)?prior.events:[]),event].slice(-80)});
   updated++;
  }
  return {updated};
 };
 const materializeRules=async(rows=[],today)=>{
  const todayKey=today||new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  let active=0,pending=0,updated=0,paused=0,stopped=(await stopFinished(rows)).updated;
  const rawCases=new Map((await loadCases()).map(row=>[row.asaas_payment_id||row.payment_id,row]));
  const cases=new Map([...rawCases].map(([id,row])=>[id,decorateCase(row)]));
  const writes=[];
  for(const row of rows.filter(r=>ACTIVE_GROUPS.has(r.group)&&r.due_date)){
   const currentRaw=rawCases.get(row.id)||{},current=cases.get(row.id);
   const now=new Date().toISOString(),offset=diffDays(todayKey,row.due_date),dueRule=ruleForOffset(offset),nextRule=nextRuleAfter(offset);
   const promised=currentRaw.promised_payment_date&&currentRaw.status==='promised'&&currentRaw.promised_payment_date>=todayKey;
   const manualPaused=currentRaw.rule_state==='paused'&&currentRaw.pause_reason==='manual';
   const rule_state=promised||manualPaused?'paused':'active';
   const next_action_at=promised?currentRaw.promised_payment_date:manualPaused?null:nextRule?addDays(row.due_date,nextRule.offset):null;
   const next_action_type=promised?'promise_followup':manualPaused?null:nextRule?.type||null;
   const executed=new Set(Array.isArray(currentRaw.executed_rule_steps)?currentRaw.executed_rule_steps:[]);
   const pendingEvents=Array.isArray(currentRaw.pending_internal_events)?currentRaw.pending_internal_events.filter(e=>e?.status==='pending'):[];
   let events=Array.isArray(currentRaw.events)?currentRaw.events:[],changed=false;
   if(rule_state==='active'&&dueRule&&!executed.has(dueRule.stage)){
    const ev=internalEvent(row,dueRule,now);
    if(!pendingEvents.some(e=>e.id===ev.id))pendingEvents.push(ev);
    executed.add(dueRule.stage);events=[...events,{...ev,status_after:currentRaw.status||'new',actor:'system'}].slice(-80);changed=true;pending++;
   }else pending+=pendingEvents.length;
   const next={...currentRaw,connection_id:scope(),asaas_payment_id:row.id,asaas_customer_id:row.customer_id||null,status:currentRaw.status||'new',rule_state,current_rule_stage:dueRule?.stage||'Pré-régua',next_action_at,next_action_type,next_action_date:next_action_at,executed_rule_steps:[...executed],pending_internal_events:pendingEvents,last_rule_evaluated_at:now,updated_at:now,created_at:currentRaw.created_at||now,events};
   if(rule_state==='paused')paused++;else active++;
   const comparable=['rule_state','current_rule_stage','next_action_at','next_action_type','status'];
   if(changed||!current||comparable.some(k=>currentRaw[k]!==next[k])||(currentRaw.executed_rule_steps||[]).length!==next.executed_rule_steps.length||(currentRaw.pending_internal_events||[]).length!==next.pending_internal_events.length){writes.push({paymentId:row.id,data:next});updated++;}
  }
  if(writes.length)await writeDocs(writes);
  return {active,pending,paused,stopped,updated};
 };
 const autoRecover=stopFinished;
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
   const status={contact_attempt:'followup',payment_promise:'promised',followup_delayed:'followup',human_intervention:'human_intervention',negotiating:'negotiation',pause_rule:current.status||'followup',resume_rule:current.status||'followup'}[action];
   const event={id:`evt_${Date.now()}_${Math.random().toString(16).slice(2)}`,action,status_after:status,promised_payment_date:payload.promised_payment_date||null,promised_amount:payload.promised_amount||null,followup_date:payload.followup_date||null,note:payload.note||null,responsible:payload.responsible||null,actor:payload.actor,created_at:now};
   const next={...current,connection_id:scope(),asaas_payment_id:paymentId,asaas_customer_id:receivable.asaas_customer_id||null,status,last_action:action,last_event_at:now,updated_at:now,created_at:current.created_at||now,events:[...(Array.isArray(current.events)?current.events:[]),event].slice(-80)};
   if(action==='followup_delayed'){next.next_action_date=payload.followup_date;next.next_action_note=payload.note||null;}
   if(action==='payment_promise'){next.promised_payment_date=payload.promised_payment_date;next.promised_amount=payload.promised_amount;next.promise_note=payload.note||null;next.rule_state='paused';next.pause_reason='promise';next.next_action_at=payload.promised_payment_date;next.next_action_type='promise_followup';}
   if(action==='pause_rule'){next.rule_state='paused';next.pause_reason='manual';next.next_action_at=null;next.next_action_type=null;}
   if(action==='resume_rule'){next.rule_state='active';next.pause_reason=null;}
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
 return {casesFor,eventsFor,recordAction,autoRecover,materializeRules,STATUS_LABELS,ACTION_LABELS,RULES};
}
module.exports={createRecoveryOperations,STATUS_LABELS,ACTION_LABELS,RULES};
