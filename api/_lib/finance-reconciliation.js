const { randomUUID } = require('node:crypto');
const { createAsaasClient } = require('./asaas');
const { createFinanceFoundation } = require('./finance-foundation');
const { externalId, uuid } = require('./finance-domain');
const { getDocumentAsAdmin, listCollectionAsAdmin, commitWritesAsAdmin } = require('./firestore-admin');
const { PROJECT_ID, encodeFields } = require('../../_lib/firestore-rest');

const COLLECTION='financeReconciliationCases';
const NON_REVENUE=new Set(['pf_receivables_transfer','tap_tap_remittance','space_refund','capital_contribution','partner_loan','internal_transfer','non_operational_movement','other']);
const CASH_ELIGIBLE=new Set(['PENDING','OVERDUE','DUNNING_REQUESTED']);
const PAID=new Set(['RECEIVED','RECEIVED_IN_CASH','DUNNING_RECEIVED']);
const CLOSED=new Set(['DELETED','REFUNDED','PARTIALLY_REFUNDED','CHARGEBACK_REQUESTED','CHARGEBACK_DISPUTE','AWAITING_CHARGEBACK_REVERSAL']);
const cents=value=>{if(value==null)return null;if(typeof value==='number'&&Number.isSafeInteger(value))return value;const s=String(value);if(!/^\d+(?:\.\d{1,2})?$/.test(s))return null;const [a,b='']=s.split('.');const n=Number(a)*100+Number(b.padEnd(2,'0'));return Number.isSafeInteger(n)?n:null;};
const docId=id=>encodeURIComponent(String(id||''));
const docPath=id=>`${COLLECTION}/${docId(id)}`;
const docName=(id,projectId=PROJECT_ID)=>`projects/${projectId}/databases/(default)/documents/${docPath(id)}`;
const sanitize=value=>String(value||'').trim().slice(0,1200);
const asMoney=value=>{const raw=String(value??'').trim().replace(',','.');if(!/^\d+(?:\.\d{1,2})?$/.test(raw))return null;return raw;};
const event=(action,actor,after,note='')=>({id:`evt_${Date.now()}_${Math.random().toString(16).slice(2)}`,action,actor:sanitize(actor,160),note:sanitize(note),state_after:after,created_at:new Date().toISOString()});
async function readCase(movementId){try{return await getDocumentAsAdmin(docPath(movementId));}catch(e){if(e.status===404)return null;throw e;}}
async function writeCase(movementId,data){const result=await commitWritesAsAdmin({writes:[{update:{name:docName(movementId),fields:encodeFields(data).fields},updateMask:{fieldPaths:Object.keys(data)}}]});if(!result.ok){const e=new Error('finance_reconciliation_unavailable');e.status=503;throw e;}return data;}
async function writeCases(items){for(let i=0;i<items.length;i+=400){const writes=items.slice(i,i+400).map(({movementId,data})=>({update:{name:docName(movementId),fields:encodeFields(data).fields},updateMask:{fieldPaths:Object.keys(data)}}));const result=await commitWritesAsAdmin({writes});if(!result.ok){const e=new Error('finance_reconciliation_unavailable');e.status=503;throw e;}}return items.map(i=>i.data);}
async function allCases(connectionId){try{return (await listCollectionAsAdmin(COLLECTION,{pageSize:1000,maxPages:20,decorate:false})).filter(r=>r.connection_id===uuid(connectionId));}catch{return [];}}
function paymentRecognitionDate(row,payment){return payment?.payment_date||payment?.confirmed_date||row?.snapshot?.client_payment_date||row?.snapshot?.payment_date||row?.snapshot?.confirmed_date||row?.due_date||null;}
function buildFinancials(rows,payments,cases,month,today=new Date().toISOString().slice(0,10)){
 const paymentById=new Map(payments.map(p=>[p.asaas_payment_id,p]));
 const caseByMovement=new Map(cases.map(c=>[c.movement_id,c]));
 const allocatedRevenue=new Map();
 for(const c of cases)for(const a of Array.isArray(c.allocations)?c.allocations:[])if(a?.receivable_id&&a?.revenue_recognized!==false)allocatedRevenue.set(a.receivable_id,Math.max(allocatedRevenue.get(a.receivable_id)||0,cents(a.value)));
 const eligible=r=>!r.deleted&&!CLOSED.has(r.status)&&r.value!=null;
 const recognizedRows=rows.filter(r=>eligible(r)&&!allocatedRevenue.has(r.asaas_payment_id)&&['RECEIVED','RECEIVED_IN_CASH','DUNNING_RECEIVED','CONFIRMED'].includes(r.status)).map(r=>({row:r,payment:paymentById.get(r.asaas_payment_id)}));
 const inMonth=({row,payment})=>String(paymentRecognitionDate(row,payment)||'').startsWith(month);
 const received=sumCents(recognizedRows.filter(x=>inMonth(x)&&PAID.has(x.row.status)),x=>cents(x.payment?.value??x.row.value));
 const confirmed=sumCents(recognizedRows.filter(x=>inMonth(x)&&x.row.status==='CONFIRMED'),x=>cents(x.payment?.value??x.row.value));
 const allocatedMonth=[...allocatedRevenue].filter(([id])=>String((cases.flatMap(c=>c.allocations||[]).find(a=>a.receivable_id===id)||{}).recognized_date||'').startsWith(month));
 const allocatedReceived=sumCents(allocatedMonth,([,v])=>v);
 const faturamento=received+confirmed+allocatedReceived;
 const monthDue=rows.filter(r=>eligible(r)&&String(r.due_date||'').startsWith(month));
 const overdue=monthDue.filter(r=>['PENDING','OVERDUE','DUNNING_REQUESTED'].includes(r.status)&&r.due_date&&r.due_date<today);
 const dueBase=sumCents(monthDue,r=>cents(r.value));
 const overdueValue=sumCents(overdue,r=>cents(r.value));
 return {faturamento,received:received+allocatedReceived,confirmed,delinquency_value:overdueValue,delinquency_percent:dueBase?Math.round(overdueValue/dueBase*10000)/100:null};
}
function sumCents(rows,get){return rows.reduce((n,r)=>{const v=get(r);return n+(Number.isSafeInteger(v)?v:0);},0);}
function movementFromRow(row,payment,caseDoc){
 const snapshot=row.snapshot||{},pix=snapshot.pixTransaction||snapshot.pix_transaction||null;
 const value=cents(payment?.value??row.value);
 const allocated=sumCents(Array.isArray(caseDoc?.allocations)?caseDoc.allocations:[],a=>cents(a.value));
 const classification=caseDoc?.classification||null;
 const status=classification?'classified':allocated>0?'partially_reconciled':row.linked?'linked':'pending';
 return {id:`mov_${row.asaas_payment_id}`,payment_id:row.asaas_payment_id,customer_id:row.asaas_customer_id,student_ids:row.student_ids||[],linked:Boolean(row.linked),date:payment?.payment_date||payment?.confirmed_date||snapshot.payment_date||snapshot.confirmed_date||row.due_date,origin:pix?.payer?.name||pix?.payerName||snapshot.description||row.name||row.asaas_customer_id||'Origem não identificada',value,asaas_origin_type:pix?'pixTransaction':(row.billing_type||payment?.billing_type||'payment'),status,classification,value_allocated:allocated,difference:(value||0)-allocated,raw_status:row.status,billing_type:row.billing_type,requires_reconciliation:!row.linked||row.status==='RECEIVED_IN_CASH'||['TRANSFER','DEPOSIT','UNDEFINED'].includes(String(row.billing_type||'')),case:caseDoc||null};
}
function buildMovements(rows,payments,cases){const paymentById=new Map(payments.map(p=>[p.asaas_payment_id,p]));const caseById=new Map(cases.map(c=>[c.movement_id,c]));return rows.filter(r=>!r.deleted&&PAID.has(r.status)).map(r=>movementFromRow(r,paymentById.get(r.asaas_payment_id),caseById.get(`mov_${r.asaas_payment_id}`))).filter(m=>m.requires_reconciliation).sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))||a.id.localeCompare(b.id));}
function candidateReceivables(rows,q=''){const needle=String(q||'').trim().toLowerCase();return rows.filter(r=>!r.deleted&&!CLOSED.has(r.status)&&(!needle||[r.asaas_payment_id,r.asaas_customer_id,r.name,...(r.student_ids||[])].join(' ').toLowerCase().includes(needle))).slice(0,80).map(r=>({id:r.asaas_payment_id,name:r.name||'Nome não disponível',customer_id:r.asaas_customer_id,student_ids:r.student_ids||[],status:r.status,value:cents(r.value),due_date:r.due_date,can_cash_receive:CASH_ELIGIBLE.has(r.status)}));}
function createFinanceReconciliation({connectionId=process.env.FINANCE_CONNECTION_ID,client=createAsaasClient({readOnly:false}),foundation=createFinanceFoundation({client,logger:()=>{}})}={}){
 const listCases=()=>allCases(connectionId);
 const confirm=async({body,actor,rows=[]}={})=>{
  const movementId=String(body?.movement_id||'');if(!/^mov_pay_[A-Za-z0-9_-]+$/.test(movementId)){const e=new Error('finance_reconciliation_invalid');e.status=400;throw e;}
  const allocations=Array.isArray(body?.allocations)?body.allocations:[];
  const classification=String(body?.classification||'').trim();
  if(classification&&!NON_REVENUE.has(classification)){const e=new Error('finance_reconciliation_classification_invalid');e.status=400;throw e;}
  const now=new Date().toISOString(),before=await readCase(movementId),prior=before&&typeof before==='object'?before:{};
  const valid=[];
  for(const raw of allocations){const id=externalId(raw.receivable_id||raw.payment_id);const value=asMoney(raw.value);if(!value)continue;const row=rows.find(r=>r.asaas_payment_id===id);if(!row||row.deleted||CLOSED.has(row.status))continue;valid.push({receivable_id:id,asaas_payment_id:id,customer_id:row.asaas_customer_id||null,student_ids:row.student_ids||[],value,recognized_date:row.snapshot?.client_payment_date||row.snapshot?.payment_date||row.snapshot?.confirmed_date||now.slice(0,10),revenue_recognized:true,status_before:row.status});}
  for(const a of valid.filter(a=>CASH_ELIGIBLE.has(a.status_before))){await client.request(`/payments/${encodeURIComponent(a.asaas_payment_id)}/receiveInCash`,{method:'POST',body:{paymentDate:a.recognized_date,value:Number(a.value)}});await foundation.repairPaymentById(a.asaas_payment_id,{dryRun:false,actor});}
  const status=classification?'classified':valid.length?'reconciled':'pending';
  const next={...prior,connection_id:uuid(connectionId),movement_id:movementId,status,classification:classification||prior.classification||null,allocations:valid,updated_at:now,created_at:prior.created_at||now,events:[...(Array.isArray(prior.events)?prior.events:[]),event('confirm_reconciliation',actor,{status,classification,allocations:valid},body?.note)].slice(-100)};
  await writeCase(movementId,next);return next;
 };

 const classifyOrigin=async({body,actor,rows=[],payments=[]}={})=>{
  const origin=String(body?.origin||'').trim();const classification=String(body?.classification||'').trim();
  if(!origin||origin.length>1200||!NON_REVENUE.has(classification)){const e=new Error('finance_reconciliation_classification_invalid');e.status=400;throw e;}
  const cases=await listCases();const caseById=new Map(cases.map(c=>[c.movement_id,c]));const movements=buildMovements(rows,payments,cases).filter(m=>m.origin===origin&&m.status==='pending'&&!m.value_allocated);
  const limit=Math.min(Math.max(Number(body?.limit)||500,1),500);const selected=movements.slice(0,limit);const now=new Date().toISOString();
  const docs=[];for(const m of selected){const prior=caseById.get(m.id)||{};const status='classified';const next={...prior,connection_id:uuid(connectionId),movement_id:m.id,status,classification,origin,allocations:[],updated_at:now,created_at:prior.created_at||now,events:[...(Array.isArray(prior.events)?prior.events:[]),event('classify_origin_batch',actor,{status,classification,origin},body?.note)].slice(-100)};docs.push({movementId:m.id,data:next});}
  if(docs.length)await writeCases(docs);return {origin,classification,matched:movements.length,classified:docs.length,value:sumCents(selected,m=>m.value)};
 };
 const undo=async({body,actor}={})=>{const movementId=String(body?.movement_id||'');const prior=await readCase(movementId);if(!prior){const e=new Error('finance_reconciliation_not_found');e.status=404;throw e;}const now=new Date().toISOString();const next={...prior,status:'reopened',allocations:[],classification:null,updated_at:now,events:[...(Array.isArray(prior.events)?prior.events:[]),event('undo_reconciliation',actor,{status:'reopened'},body?.note)].slice(-100)};await writeCase(movementId,next);return next;};
 return {listCases,confirm,classifyOrigin,undo,buildMovements,candidateReceivables,buildFinancials};
}
module.exports={createFinanceReconciliation,buildMovements,candidateReceivables,buildFinancials,NON_REVENUE};
