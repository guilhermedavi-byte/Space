const { randomUUID } = require('node:crypto');
const { createAsaasClient } = require('./asaas');
const { createFinanceFoundation } = require('./finance-foundation');
const { externalId, uuid } = require('./finance-domain');
const { getDocumentAsAdmin, listCollectionAsAdmin, commitWritesAsAdmin } = require('./firestore-admin');
const { PROJECT_ID, encodeFields } = require('../../_lib/firestore-rest');

const COLLECTION='financeReconciliationCases';
const {PAID_STATUSES:PAID,CLOSED_STATUSES:CLOSED,NON_REVENUE_CLASSIFICATIONS:NON_REVENUE,CUSTOMER_PAYMENT_UNALLOCATED_CLASSIFICATIONS:UNALLOCATED_REVENUE,cents,sumCents,revenueSummary,originRuleMap,rowNeedsConcilation}=require('./finance-revenue-policy');
const CASH_ELIGIBLE=new Set(['PENDING','OVERDUE','DUNNING_REQUESTED']);
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
function buildFinancials(rows,payments,cases,month,today=new Date().toISOString().slice(0,10),links=[],connectionId=null){return revenueSummary({connectionId,rows,payments,cases,links,month,today});}
function movementFromRow(row,payment,caseDoc,originRules=new Map()){
 const snapshot=row.snapshot||{},pix=snapshot.pixTransaction||snapshot.pix_transaction||null;
 const value=cents(payment?.value??row.value);
 const allocated=sumCents(Array.isArray(caseDoc?.allocations)?caseDoc.allocations:[],a=>cents(a.value));
 const origin=pix?.payer?.name||pix?.payerName||snapshot.description||row.name||row.asaas_customer_id||'Origem não identificada';
 const classification=caseDoc?.classification||originRules.get(origin)||null;
 const status=classification?'classified':allocated>0?'partially_reconciled':rowNeedsConcilation(row)?'pending':'linked';
 return {id:`mov_${row.asaas_payment_id}`,payment_id:row.asaas_payment_id,customer_id:row.asaas_customer_id,student_ids:row.student_ids||[],linked:Boolean(row.linked),date:payment?.payment_date||payment?.confirmed_date||snapshot.payment_date||snapshot.confirmed_date||row.due_date,origin,value,asaas_origin_type:pix?'pixTransaction':(row.billing_type||payment?.billing_type||'payment'),status,classification,value_allocated:allocated,difference:(value||0)-allocated,raw_status:row.status,billing_type:row.billing_type,requires_reconciliation:rowNeedsConcilation(row)||Boolean(classification),case:caseDoc||null};
}
function buildMovements(rows,payments,cases){const paymentById=new Map(payments.map(p=>[p.asaas_payment_id,p]));const caseById=new Map(cases.map(c=>[c.movement_id,c]));const rules=originRuleMap(cases);return rows.filter(r=>!r.deleted&&PAID.has(r.status)).map(r=>movementFromRow(r,paymentById.get(r.asaas_payment_id),caseById.get(`mov_${r.asaas_payment_id}`),rules)).filter(m=>m.requires_reconciliation||m.case).sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))||a.id.localeCompare(b.id));}
function candidateReceivables(rows,q=''){const needle=String(q||'').trim().toLowerCase();return rows.filter(r=>!r.deleted&&!CLOSED.has(r.status)&&(!needle||[r.asaas_payment_id,r.asaas_customer_id,r.name,...(r.student_ids||[])].join(' ').toLowerCase().includes(needle))).slice(0,80).map(r=>({id:r.asaas_payment_id,name:r.name||'Nome não disponível',customer_id:r.asaas_customer_id,student_ids:r.student_ids||[],status:r.status,value:cents(r.value),due_date:r.due_date,can_cash_receive:CASH_ELIGIBLE.has(r.status)}));}
function createFinanceReconciliation({connectionId=process.env.FINANCE_CONNECTION_ID,client=createAsaasClient({readOnly:false}),foundation=createFinanceFoundation({client,logger:()=>{}})}={}){
 const listCases=()=>allCases(connectionId);
 const confirm=async({body,actor,rows=[]}={})=>{
  const movementId=String(body?.movement_id||'');if(!/^mov_pay_[A-Za-z0-9_-]+$/.test(movementId)){const e=new Error('finance_reconciliation_invalid');e.status=400;throw e;}
  const allocations=Array.isArray(body?.allocations)?body.allocations:[];
  const classification=String(body?.classification||'').trim();
  if(classification&&!NON_REVENUE.has(classification)&&!UNALLOCATED_REVENUE.has(classification)){const e=new Error('finance_reconciliation_classification_invalid');e.status=400;throw e;}
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
  if(!origin||origin.length>1200||(!NON_REVENUE.has(classification)&&!UNALLOCATED_REVENUE.has(classification))){const e=new Error('finance_reconciliation_classification_invalid');e.status=400;throw e;}
  const cases=await listCases();const caseById=new Map(cases.map(c=>[c.movement_id,c]));const movements=buildMovements(rows,payments,cases).filter(m=>m.origin===origin&&m.status==='pending'&&!m.value_allocated);
  const limit=Math.min(Math.max(Number(body?.limit)||500,1),500);const selected=movements.slice(0,limit);const now=new Date().toISOString();
  const docs=[];for(const m of selected){const prior=caseById.get(m.id)||{};const status='classified';const next={...prior,connection_id:uuid(connectionId),movement_id:m.id,status,classification,origin,allocations:[],updated_at:now,created_at:prior.created_at||now,events:[...(Array.isArray(prior.events)?prior.events:[]),event('classify_origin_batch',actor,{status,classification,origin},body?.note)].slice(-100)};docs.push({movementId:m.id,data:next});}
  if(docs.length)await writeCases(docs);return {origin,classification,matched:movements.length,classified:docs.length,value:sumCents(selected,m=>m.value)};
 };
 const undo=async({body,actor}={})=>{const movementId=String(body?.movement_id||'');const prior=await readCase(movementId);if(!prior){const e=new Error('finance_reconciliation_not_found');e.status=404;throw e;}const now=new Date().toISOString();const next={...prior,status:'reopened',allocations:[],classification:null,updated_at:now,events:[...(Array.isArray(prior.events)?prior.events:[]),event('undo_reconciliation',actor,{status:'reopened'},body?.note)].slice(-100)};await writeCase(movementId,next);return next;};
 const buildFinancialsForConnection=(rows,payments,cases,month,today=new Date().toISOString().slice(0,10),links=[])=>buildFinancials(rows,payments,cases,month,today,links,connectionId);
 return {listCases,confirm,classifyOrigin,undo,buildMovements,candidateReceivables,buildFinancials:buildFinancialsForConnection};
}
module.exports={createFinanceReconciliation,buildMovements,candidateReceivables,buildFinancials,NON_REVENUE};
