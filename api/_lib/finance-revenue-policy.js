const PAID_STATUSES=new Set(['RECEIVED','RECEIVED_IN_CASH','DUNNING_RECEIVED']);
const REVENUE_STATUSES=new Set(['RECEIVED','RECEIVED_IN_CASH','DUNNING_RECEIVED','CONFIRMED']);
const CLOSED_STATUSES=new Set(['DELETED','REFUNDED','PARTIALLY_REFUNDED','CHARGEBACK_REQUESTED','CHARGEBACK_DISPUTE','AWAITING_CHARGEBACK_REVERSAL']);
const NON_REVENUE_CLASSIFICATIONS=new Set(['pf_receivables_transfer','tap_tap_remittance','space_refund','capital_contribution','partner_loan','internal_transfer','non_operational_movement','other']);
const AMBIGUOUS_BILLING_TYPES=new Set(['TRANSFER','DEPOSIT','UNDEFINED']);
const cents=value=>{if(value==null)return null;if(typeof value==='number'&&Number.isSafeInteger(value))return value;const s=String(value);if(!/^\d+(?:\.\d{1,2})?$/.test(s))return null;const [a,b='']=s.split('.');const n=Number(a)*100+Number(b.padEnd(2,'0'));return Number.isSafeInteger(n)?n:null;};
const sumCents=(rows,get)=>rows.reduce((n,r)=>{const v=get(r);return n+(Number.isSafeInteger(v)?v:0);},0);
function paymentCompetenceDate(row,payment){
 if(row?.status==='CONFIRMED')return payment?.confirmed_date||row?.snapshot?.confirmed_date||row?.snapshot?.payment_date||null;
 if(row?.status==='RECEIVED_IN_CASH')return payment?.payment_date||row?.snapshot?.client_payment_date||row?.snapshot?.payment_date||null;
 return payment?.payment_date||row?.snapshot?.client_payment_date||row?.snapshot?.payment_date||payment?.confirmed_date||row?.snapshot?.confirmed_date||null;
}
function originRuleMap(cases=[]){const rules=new Map();for(const c of cases){if(c?.origin&&NON_REVENUE_CLASSIFICATIONS.has(c.classification))rules.set(c.origin,c.classification);}return rules;}
function movementOrigin(row){const s=row?.snapshot||{},pix=s.pixTransaction||s.pix_transaction||null;return pix?.payer?.name||pix?.payerName||s.description||row?.name||row?.asaas_customer_id||'Origem não identificada';}
function rowNeedsConcilation(row){return !row?.linked||row?.status==='RECEIVED_IN_CASH'||AMBIGUOUS_BILLING_TYPES.has(String(row?.billing_type||row?.method||''));}
function originRuleApplies(row){return row?.status==='RECEIVED_IN_CASH'||AMBIGUOUS_BILLING_TYPES.has(String(row?.billing_type||row?.method||''));}
function isRevenueRow(row,payment,caseDoc,originClassification){
 if(!row||row.deleted||CLOSED_STATUSES.has(row.status)||!REVENUE_STATUSES.has(row.status))return false;
 if(caseDoc?.classification)return false;
 if(originClassification&&originRuleApplies(row))return false;
 if(Array.isArray(caseDoc?.allocations)&&caseDoc.allocations.some(a=>a?.revenue_recognized!==false))return true;
 if(row.status==='RECEIVED_IN_CASH')return Boolean(row.linked);
 if(AMBIGUOUS_BILLING_TYPES.has(String(row.billing_type||row.method||'')))return false;
 return true;
}
function revenueSummary({rows=[],payments=[],cases=[],month,today=new Date().toISOString().slice(0,10)}={}){
 const paymentById=new Map(payments.map(p=>[p.asaas_payment_id,p]));
 const caseByMovement=new Map(cases.map(c=>[c.movement_id,c]));
 const originRules=originRuleMap(cases);
 const allocated=[];const allocatedIds=new Set();
 for(const c of cases)for(const a of Array.isArray(c.allocations)?c.allocations:[])if(a?.receivable_id&&a?.revenue_recognized!==false){allocated.push(a);allocatedIds.add(a.receivable_id);}
 const recognized=rows.filter(r=>!allocatedIds.has(r.asaas_payment_id)).map(row=>({row,payment:paymentById.get(row.asaas_payment_id),caseDoc:caseByMovement.get(`mov_${row.asaas_payment_id}`),originClassification:originRules.get(movementOrigin(row))})).filter(x=>isRevenueRow(x.row,x.payment,x.caseDoc,x.originClassification));
 const inMonth=recognized.filter(x=>String(paymentCompetenceDate(x.row,x.payment)||'').startsWith(month));
 const received=sumCents(inMonth.filter(x=>PAID_STATUSES.has(x.row.status)),x=>cents(x.payment?.value??x.row.value));
 const confirmed=sumCents(inMonth.filter(x=>x.row.status==='CONFIRMED'),x=>cents(x.payment?.value??x.row.value));
 const allocatedMonth=allocated.filter(a=>String(a.recognized_date||'').startsWith(month));
 const allocatedReceived=sumCents(allocatedMonth,a=>cents(a.value));
 const monthDue=rows.filter(r=>!r.deleted&&!CLOSED_STATUSES.has(r.status)&&String(r.due_date||'').startsWith(month));
 const cutoff=today&&String(today).startsWith(month)?today:String(today||'')<month?null:`${month}-${new Date(Number(month.slice(0,4)),Number(month.slice(5,7)),0).getDate().toString().padStart(2,'0')}`;
 const dueToDate=cutoff?monthDue.filter(r=>r.due_date&&r.due_date<=cutoff):[];
 const overdue=dueToDate.filter(r=>['PENDING','OVERDUE','DUNNING_REQUESTED'].includes(r.status));
 const dueBase=sumCents(dueToDate,r=>cents(r.value));
 const monthDueBase=sumCents(monthDue,r=>cents(r.value));
 const delinquencyValue=sumCents(overdue,r=>cents(r.value));
 return {faturamento:received+confirmed+allocatedReceived,received:received+allocatedReceived,confirmed,count:inMonth.length+allocatedMonth.length,source:'Financial Foundation · política central de receita',delinquency_value:delinquencyValue,delinquency_percent:dueBase?Math.round(delinquencyValue/dueBase*10000)/100:null,delinquency_due_base:dueBase,delinquency_month_due_base:monthDueBase,origin_rules:originRules.size};
}
module.exports={PAID_STATUSES,REVENUE_STATUSES,CLOSED_STATUSES,NON_REVENUE_CLASSIFICATIONS,AMBIGUOUS_BILLING_TYPES,cents,sumCents,paymentCompetenceDate,originRuleMap,movementOrigin,rowNeedsConcilation,originRuleApplies,isRevenueRow,revenueSummary};
