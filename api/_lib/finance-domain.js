const { createHash } = require('node:crypto');
class FinanceError extends Error {
  constructor(code, retryable = false, status = 400) { super(code); this.name='FinanceError'; this.code=code; this.retryable=retryable; this.status=status; }
}
const fail = (code) => { throw new FinanceError(code); };
const text = (v, max=256) => v == null ? null : typeof v === 'string' && v.length <= max ? v : fail('finance_field_invalid');
const externalId = (v) => typeof v === 'string' && /^[A-Za-z0-9_-]{1,256}$/.test(v) ? v : fail('finance_external_id_invalid');
const uuid = (v) => typeof v === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v) ? v : fail('finance_uuid_invalid');
const date = (v) => {
  if(v==null || v==='') return null;
  if(typeof v!=='string' || !/^\d{4}-\d{2}-\d{2}$/.test(v) || !Number.isFinite(Date.parse(v)) || new Date(v).toISOString().slice(0,10)!==v) fail('finance_date_invalid');
  return v;
};
// Fixed decimal strings throughout JS; PostgreSQL numeric performs arithmetic/storage.
const money = (v) => {
  if(v==null) return null;
  const s=String(v); if(!/^\d{1,14}(\.\d{1,2})?$/.test(s)) fail('finance_amount_invalid');
  const [whole, fraction='']=s.split('.'); return `${BigInt(whole)}.${fraction.padEnd(2,'0')}`;
};
const url = (v) => {
  if(v==null || v==='') return null;
  try { const u=new URL(v); if(u.protocol!=='https:' || u.username || u.password || v.length>2048) fail('finance_url_invalid'); return v; }
  catch { fail('finance_url_invalid'); }
};
const statusText = (v) => typeof v==='string' && /^[A-Z][A-Z0-9_]{0,79}$/.test(v) ? v : fail('finance_status_invalid');
const SETTLEMENT_STATES = new Set(['CONFIRMED','RECEIVED','RECEIVED_IN_CASH','REFUNDED','REFUND_REQUESTED','REFUND_IN_PROGRESS',
  'CHARGEBACK_REQUESTED','CHARGEBACK_DISPUTE','AWAITING_CHARGEBACK_REVERSAL','DUNNING_RECEIVED']);
const PAYMENT_EVENTS = new Set(['PAYMENT_CREATED','PAYMENT_UPDATED','PAYMENT_CONFIRMED','PAYMENT_RECEIVED','PAYMENT_OVERDUE',
  'PAYMENT_DELETED','PAYMENT_RESTORED','PAYMENT_REFUNDED','PAYMENT_CHARGEBACK_REQUESTED','PAYMENT_CHARGEBACK_DISPUTE',
  'PAYMENT_PARTIALLY_REFUNDED','PAYMENT_REFUND_IN_PROGRESS','PAYMENT_REFUND_DENIED','PAYMENT_RECEIVED_IN_CASH_UNDONE',
  'PAYMENT_AWAITING_CHARGEBACK_REVERSAL','PAYMENT_AUTHORIZED','PAYMENT_CREDIT_CARD_CAPTURE_REFUSED',
  'PAYMENT_AWAITING_RISK_ANALYSIS','PAYMENT_APPROVED_BY_RISK_ANALYSIS','PAYMENT_REPROVED_BY_RISK_ANALYSIS',
  'PAYMENT_ANTICIPATED','PAYMENT_DUNNING_RECEIVED','PAYMENT_BANK_SLIP_CANCELLED']);
function normalizePayment(p) {
  if(!p || typeof p!=='object' || Array.isArray(p)) fail('finance_payment_invalid');
  const provider_status=statusText(p.status);
  const refunds=Array.isArray(p.refunds)?p.refunds.map(r=>({ date:text(r.dateCreated,64), value:money(r.value), status:text(r.status,80) })):[];
  // Refund requests are not completed refunds; never sum pending requests as cash reversed.
  const completed=refunds.filter(r=>r.status==='DONE');
  const refundCents=completed.reduce((n,r)=>n+(r.value==null?0n:BigInt(r.value.replace('.',''))),0n);
  const refund_value=refunds.length ? `${refundCents/100n}.${String(refundCents%100n).padStart(2,'0')}` : null;
  return {
    id:externalId(p.id),customer:p.customer==null?null:externalId(p.customer),subscription:p.subscription==null?null:externalId(p.subscription),
    provider_status,status:p.deleted===true?'DELETED':provider_status,deleted:p.deleted===true,
    value:money(p.value),net_value:money(p.netValue),due_date:date(p.dueDate),original_due_date:date(p.originalDueDate),
    billing_type:p.billingType==null?null:statusText(p.billingType),invoice_url:url(p.invoiceUrl),bank_slip_url:url(p.bankSlipUrl),
    payment_date:date(p.paymentDate),confirmed_date:date(p.confirmedDate),client_payment_date:date(p.clientPaymentDate),
    credit_date:date(p.creditDate),estimated_credit_date:date(p.estimatedCreditDate),date_created:date(p.dateCreated),
    has_settlement:SETTLEMENT_STATES.has(provider_status)||Boolean(p.paymentDate||p.confirmedDate),refund_value,refunds,
  };
}
function normalizeResource(resource,p) {
  if(resource==='payments') return normalizePayment(p);
  if(!p || typeof p!=='object' || Array.isArray(p)) fail('finance_object_invalid');
  const common={id:externalId(p.id),deleted:p.deleted===true,date_created:date(p.dateCreated)};
  if(resource==='customers') return {...common,name:text(p.name,512),email:text(p.email,320)};
  if(resource==='subscriptions') return {...common,customer:externalId(p.customer),status:statusText(p.status),value:money(p.value),
    cycle:statusText(p.cycle),billing_type:statusText(p.billingType),next_due_date:date(p.nextDueDate)};
  fail('finance_resource_invalid');
}
const stable = (v) => JSON.stringify(v===null||typeof v!=='object'?v:Array.isArray(v)?v.map(x=>JSON.parse(stable(x))):
  Object.fromEntries(Object.keys(v).sort().map(k=>[k,JSON.parse(stable(v[k]))])));
const hash = (v) => createHash('sha256').update(stable(v)).digest('hex');
function normalizeWebhook(body) {
  if(!body || typeof body!=='object' || Array.isArray(body)) fail('finance_payload_invalid');
  const event_type=statusText(body.event);
  const resource=event_type.startsWith('PAYMENT_')?'payments':event_type.startsWith('CUSTOMER_')?'customers':event_type.startsWith('SUBSCRIPTION_')?'subscriptions':'unsupported';
  const raw=body[resource==='payments'?'payment':resource==='customers'?'customer':'subscription'];
  const external_object_id=resource==='unsupported'?null:externalId(raw?.id);
  const provider_event_id=text(body.id,256);
  if(provider_event_id!==null && !/^[A-Za-z0-9_&-]{1,256}$/.test(provider_event_id)) fail('finance_event_id_invalid');
  // Persist only resource identity + event metadata. Live resource read drives projection.
  // The hash includes allowlisted financial fields, not arbitrary PII/secrets from the envelope.
  const provider_created_at=text(body.dateCreated,64);
  const financial=resource==='payments' && raw?.status ? normalizePayment(raw) : null;
  const payload={event:event_type,object_id:external_object_id,dateCreated:provider_created_at,
    financial:financial ? Object.fromEntries(Object.entries(financial).filter(([k])=>!['invoice_url','bank_slip_url'].includes(k))) : null};
  const payload_hash=hash(payload);
  return {provider_event_id,event_type,resource,external_object_id,payload,payload_hash,provider_created_at,
    dedupe_key:provider_event_id?`event:${provider_event_id}`:`hash:${payload_hash}`};
}
const isSupportedEvent = (event) => PAYMENT_EVENTS.has(event.event_type) ||
  ['CUSTOMER_CREATED','CUSTOMER_UPDATED','CUSTOMER_DELETED','SUBSCRIPTION_CREATED','SUBSCRIPTION_UPDATED','SUBSCRIPTION_DELETED','SUBSCRIPTION_INACTIVATED'].includes(event.event_type);
function comparePayment(local,snapshot,studentRefs=[]) {
  const issues=[];
  if(!local) issues.push('MISSING_LOCAL');
  else {
    if(local.status!==snapshot.status || local.provider_status!==snapshot.provider_status || local.deleted!==snapshot.deleted) issues.push('STATUS_MISMATCH');
    if(money(local.value)!==snapshot.value) issues.push('VALUE_MISMATCH');
    if(local.due_date!==snapshot.due_date) issues.push('DUE_DATE_MISMATCH');
    if(stable(local.snapshot)!==stable(snapshot) && !issues.length) issues.push('DETAIL_MISMATCH');
  }
  if(!studentRefs.length) issues.push('UNMATCHED_CUSTOMER');
  if(!issues.length) issues.push('MATCH');
  return issues;
}
module.exports={FinanceError,externalId,uuid,money,normalizePayment,normalizeResource,normalizeWebhook,isSupportedEvent,comparePayment,hash,stable};
