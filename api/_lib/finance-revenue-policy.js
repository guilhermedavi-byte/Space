const PAID_STATUSES=new Set(['RECEIVED','RECEIVED_IN_CASH']);
const REVENUE_STATUSES=new Set(['RECEIVED','RECEIVED_IN_CASH','CONFIRMED']);
const CLOSED_STATUSES=new Set(['DELETED','REFUNDED','PARTIALLY_REFUNDED','CHARGEBACK_REQUESTED','CHARGEBACK_DISPUTE','AWAITING_CHARGEBACK_REVERSAL']);
const NON_REVENUE_CLASSIFICATIONS=new Set(['pf_receivables_transfer','space_refund','capital_contribution','partner_loan','internal_transfer','non_operational_movement','other']);
const CUSTOMER_PAYMENT_UNALLOCATED_CLASSIFICATIONS=new Set(['tap_tap_remittance']);
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
function originRuleApplies(row,classification){const origin=movementOrigin(row);return (classification==='pf_receivables_transfer'&&/guilherme|dlocal/i.test(origin))||AMBIGUOUS_BILLING_TYPES.has(String(row?.billing_type||row?.method||''));}
function isRevenueRow(row,payment,caseDoc,originClassification){
 if(!row||row.deleted||CLOSED_STATUSES.has(row.status)||!REVENUE_STATUSES.has(row.status))return false;
 if(row.status==='RECEIVED_IN_CASH')return true;
 if(CUSTOMER_PAYMENT_UNALLOCATED_CLASSIFICATIONS.has(caseDoc?.classification))return !(Array.isArray(caseDoc?.allocations)&&caseDoc.allocations.some(a=>a?.revenue_recognized!==false));
 if(caseDoc?.classification)return false;
 if(originClassification&&originRuleApplies(row,originClassification))return false;
 if(Array.isArray(caseDoc?.allocations)&&caseDoc.allocations.some(a=>a?.revenue_recognized!==false))return true;
 if(AMBIGUOUS_BILLING_TYPES.has(String(row.billing_type||row.method||'')))return false;
 return true;
}
function revenueSummary({rows=[],payments=[],cases=[],links=[],month,today=new Date().toISOString().slice(0,10),connectionId=null}={}){
 const {getRevenueSummary}=require('./finance-revenue-ledger');
 const s=getRevenueSummary({connectionId,rows,payments,cases,links,month,today});
 const monthDue=rows.filter(r=>!r.deleted&&!CLOSED_STATUSES.has(r.status)&&String(r.due_date||'').startsWith(month));
 const cutoff=today&&String(today).startsWith(month)?today:String(today||'')<month?null:`${month}-${new Date(Number(month.slice(0,4)),Number(month.slice(5,7)),0).getDate().toString().padStart(2,'0')}`;
 const dueToDate=cutoff?monthDue.filter(r=>r.due_date&&r.due_date<=cutoff):[];
 const overdue=dueToDate.filter(r=>['PENDING','OVERDUE','DUNNING_REQUESTED'].includes(r.status));
 const dueBase=sumCents(dueToDate,r=>cents(r.value));
 const monthDueBase=sumCents(monthDue,r=>cents(r.value));
 const delinquencyValue=sumCents(overdue,r=>cents(r.value));
 return {faturamento:s.revenue,received:s.received,confirmed:s.confirmed,count:s.count,source:'Financial Foundation · política central de receita',ledger_version:s.ledger_version,duplicate_economic_events:s.duplicate_economic_events,certified_period:s.certified_period,finance_data_inconsistent:s.finance_data_inconsistent,finance_data_issues:s.finance_data_issues||[],raw_revenue:s.raw_revenue,raw_received:s.raw_received,raw_confirmed:s.raw_confirmed,delinquency_value:delinquencyValue,delinquency_percent:dueBase?Math.round(delinquencyValue/dueBase*10000)/100:null,delinquency_due_base:dueBase,delinquency_month_due_base:monthDueBase};
}
module.exports={PAID_STATUSES,REVENUE_STATUSES,CLOSED_STATUSES,NON_REVENUE_CLASSIFICATIONS,CUSTOMER_PAYMENT_UNALLOCATED_CLASSIFICATIONS,AMBIGUOUS_BILLING_TYPES,cents,sumCents,paymentCompetenceDate,originRuleMap,movementOrigin,rowNeedsConcilation,originRuleApplies,isRevenueRow,revenueSummary};
