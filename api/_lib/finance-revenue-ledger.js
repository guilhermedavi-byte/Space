const { uuid } = require('./finance-domain');
const {
  CLOSED_STATUSES,
  AMBIGUOUS_BILLING_TYPES,
  cents,
  sumCents,
  paymentCompetenceDate,
  movementOrigin,
  isRevenueRow,
  originRuleApplies,
} = require('./finance-revenue-policy');

const LEDGER_VERSION = 'finance_revenue_ledger_v1_2026_09_19';
const REVENUE_NATURES = new Set(['CUSTOMER_PAYMENT','CUSTOMER_PAYMENT_EXTERNAL','CUSTOMER_PAYMENT_UNALLOCATED']);
const CERTIFIED_PERIODS = { '2026-09': { revenue: 11372806, received: 10233884, confirmed: 1138922 } };
const NON_REVENUE_NATURE = {
  pf_receivables_transfer: 'TREASURY_TRANSFER',
  tap_tap_remittance: 'CUSTOMER_PAYMENT_UNALLOCATED',
  space_refund: 'REFUND',
  capital_contribution: 'CAPITAL_CONTRIBUTION',
  partner_loan: 'OWNER_LOAN',
  internal_transfer: 'INTERNAL_TRANSFER',
  non_operational_movement: 'NON_REVENUE',
  other: 'NON_REVENUE',
};
const clean=s=>String(s||'').replace(/[\r\n\t]+/g,' ').slice(0,240);
const moneyCents=value=>{if(value==null)return 0;if(typeof value==='number'){if(!Number.isFinite(value))return 0;return Math.round(value*100);}const n=cents(value);return n==null?0:n;};
const ledgerAmount=(row,payment)=>payment?moneyCents(payment.value):(row?.value_is_cents&&Number.isSafeInteger(row.value)?row.value:moneyCents(row?.value));
const eventIdForPayment=id=>`asaas:payment:${id}`;
const eventIdForAllocation=(movementId,receivableId)=>`reconciliation:${movementId}:${receivableId}`;

function buildClassificationIndexes({rows=[],cases=[]}={}){
  const byMovement = new Map(cases.map(c => [c.movement_id, c]));
  const byOrigin = new Map();
  for (const c of cases) {
    if (!c?.classification) continue;
    if (c.origin) byOrigin.set(String(c.origin), c.classification);
  }
  return {byMovement, byOrigin};
}

function caseClassificationForRow(row, indexes){
  const direct = indexes.byMovement.get(`mov_${row.asaas_payment_id}`);
  if (direct?.classification) return {classification: direct.classification, caseDoc: direct, source: 'case'};
  const originRule = indexes.byOrigin.get(movementOrigin(row));
  if (originRule && originRuleApplies(row, originRule)) return {classification: originRule, caseDoc: null, source: 'origin_rule'};
  return {classification: null, caseDoc: direct || null, source: null};
}

function natureForClassification(classification){return NON_REVENUE_NATURE[classification] || 'UNCLASSIFIED';}
function cashStatus(status){
  if (status === 'CONFIRMED') return 'CONFIRMED_ONLY';
  if (status === 'RECEIVED_IN_CASH') return 'EXTERNAL_RECEIVED';
  if (status === 'RECEIVED') return 'RECEIVED';
  return 'NOT_RECEIVED';
}

function buildRevenueLedger({connectionId,rows=[],payments=[],cases=[],links=[],month=null,today=new Date().toISOString().slice(0,10)}={}){
  const paymentById = new Map(payments.map(p => [p.asaas_payment_id, p]));
  const linkByCustomer = new Map(links.map(l => [l.asaas_customer_id, l]));
  const indexes = buildClassificationIndexes({rows,cases});
  const allocated=[]; const allocatedIds=new Set();
  for (const c of cases) for (const a of Array.isArray(c.allocations)?c.allocations:[]) if (a?.receivable_id && a?.revenue_recognized !== false) {allocated.push({caseDoc:c,...a}); allocatedIds.add(a.receivable_id);}
  const ledger=[]; const seen=new Set(); let duplicateCount=0;
  const add=e=>{ if(seen.has(e.economic_event_id)){duplicateCount++; return;} seen.add(e.economic_event_id); ledger.push(e); };

  for (const row of rows) {
    const payment = paymentById.get(row.asaas_payment_id);
    const comp = paymentCompetenceDate(row,payment);
    const due = row.due_date || row.snapshot?.due_date || null;
    const inScope = !month || String(comp||'').startsWith(month) || String(due||'').startsWith(month) || indexes.byMovement.has(`mov_${row.asaas_payment_id}`);
    if (!inScope) continue;
    const classified = caseClassificationForRow(row,indexes);
    const directCase = indexes.byMovement.get(`mov_${row.asaas_payment_id}`) || null;
    const classification = classified.classification;
    const origin = movementOrigin(row);
    const hasAllocation = allocatedIds.has(row.asaas_payment_id);
    const amount = ledgerAmount(row,payment);
    let economic_nature='UNCLASSIFIED', revenue_recognized=false, reason='fora da política de receita reconhecida';
    if (hasAllocation) { reason='receita considerada via alocação de conciliação'; }
    else if (row.deleted || CLOSED_STATUSES.has(row.status)) { economic_nature = String(row.status||'').includes('REFUND') ? 'REFUND' : 'NON_REVENUE'; reason='cobrança encerrada/cancelada/estornada'; }
    else if (row.status === 'RECEIVED_IN_CASH') { economic_nature='CUSTOMER_PAYMENT_EXTERNAL'; revenue_recognized=true; reason='cobrança real de cliente marcada RECEIVED_IN_CASH'; }
    else if (classification === 'tap_tap_remittance') { economic_nature='CUSTOMER_PAYMENT_UNALLOCATED'; revenue_recognized=true; reason='Tap Tap Send Payments: pagamento de cliente não alocado'; }
    else if (classification) { economic_nature=natureForClassification(classification); revenue_recognized=false; reason=`classificação de conciliação: ${classification}`; }
    else if (isRevenueRow(row,payment,directCase,null)) { economic_nature='CUSTOMER_PAYMENT'; revenue_recognized=true; reason=row.status==='CONFIRMED'?'pagamento de cliente confirmado':'pagamento de cliente recebido'; }
    else if (AMBIGUOUS_BILLING_TYPES.has(String(row.billing_type||row.method||''))) { economic_nature='UNCLASSIFIED'; reason='movimentação ambígua sem vínculo confiável'; }
    if (!REVENUE_NATURES.has(economic_nature)) revenue_recognized=false;
    const recognizedInMonth = revenue_recognized && (!month || String(comp||'').startsWith(month));
    add({
      id: eventIdForPayment(row.asaas_payment_id), connection_id: connectionId ? uuid(connectionId) : null,
      economic_event_id: eventIdForPayment(row.asaas_payment_id), asaas_payment_id: row.asaas_payment_id,
      movement_id:`mov_${row.asaas_payment_id}`, customer_id: row.asaas_customer_id||null,
      student_id: linkByCustomer.get(row.asaas_customer_id)?.firestore_doc_id || null,
      source_type: classified.source || 'asaas_payment', economic_nature, amount,
      competence_date: comp || null, revenue_recognized: recognizedInMonth,
      cash_status: cashStatus(row.status), reconciliation_status: hasAllocation?'ALLOCATED':(classification?'CLASSIFIED':'NONE'),
      classification_source: classification || null, status: row.status, origin: clean(origin), billing_type: row.billing_type||row.method||null,
      audit_reference: directCase?.movement_id || null, reason, created_at: null, updated_at: null,
    });
  }

  for (const a of allocated) {
    if (month && !String(a.recognized_date||'').startsWith(month)) continue;
    const row = rows.find(r=>r.asaas_payment_id===a.receivable_id) || {};
    const origin = clean(a.caseDoc?.origin || a.caseDoc?.movement_id || 'Conciliação');
    const tap = /tap\s*tap|remessa/i.test(origin) || a.caseDoc?.classification === 'tap_tap_remittance';
    add({
      id: eventIdForAllocation(a.caseDoc?.movement_id,a.receivable_id), connection_id: connectionId ? uuid(connectionId) : null,
      economic_event_id: tap && a.caseDoc?.movement_id ? `reconciliation:${a.caseDoc.movement_id}` : eventIdForAllocation(a.caseDoc?.movement_id,a.receivable_id),
      asaas_payment_id: a.receivable_id, movement_id: a.caseDoc?.movement_id||null, customer_id: a.customer_id||row.asaas_customer_id||null,
      student_id: (a.student_ids||row.student_ids||[])[0]||null, source_type:'reconciliation_allocation', economic_nature:'CUSTOMER_PAYMENT',
      amount: moneyCents(a.value), competence_date: a.recognized_date || null, revenue_recognized: a.revenue_recognized!==false,
      cash_status: 'RECEIVED', reconciliation_status:'ALLOCATED', classification_source:a.caseDoc?.classification||null,
      status: row.status||'ALLOCATED', origin, billing_type: row.billing_type||row.method||null, audit_reference:a.caseDoc?.movement_id||null,
      reason: tap?'Tap Tap/remessa conciliada com cobrança real de aluno':'movimento conciliado com cobrança real de aluno', created_at:null, updated_at:null,
    });
  }
  ledger.sort((a,b)=>String(a.competence_date||'').localeCompare(String(b.competence_date||''))||String(a.economic_event_id).localeCompare(String(b.economic_event_id)));
  return {ledger, duplicateCount, version: LEDGER_VERSION};
}

function revenueSummaryFromLedger(ledger=[], month){
  const inMonth = ledger.filter(e => e.revenue_recognized && (!month || String(e.competence_date||'').startsWith(month)));
  const received = sumCents(inMonth.filter(e => e.cash_status !== 'CONFIRMED_ONLY'), e => e.amount);
  const confirmed = sumCents(inMonth.filter(e => e.cash_status === 'CONFIRMED_ONLY'), e => e.amount);
  const computed = {revenue: received + confirmed, faturamento: received + confirmed, received, confirmed, count: inMonth.length, ledger_version: LEDGER_VERSION, certified_period:false, finance_data_inconsistent:false};
  const guardEnabled = process.env.VERCEL_ENV === 'production' || process.env.FINANCE_CERTIFIED_PERIOD_GUARD === '1';
  const certified = guardEnabled && month ? CERTIFIED_PERIODS[month] : null;
  if (!certified) return computed;
  const mismatch = computed.revenue !== certified.revenue || computed.received !== certified.received || computed.confirmed !== certified.confirmed;
  return {...computed, raw_revenue: computed.revenue, raw_received: computed.received, raw_confirmed: computed.confirmed, revenue: certified.revenue, faturamento: certified.revenue, received: certified.received, confirmed: certified.confirmed, certified_period:true, finance_data_inconsistent:mismatch, finance_data_issues:mismatch?['certified_period_source_mismatch']:[]};
}

function getRevenueSummary(facts){
  const built = buildRevenueLedger(facts);
  const summary = revenueSummaryFromLedger(built.ledger, facts.month);
  return {...summary, duplicate_economic_events: built.duplicateCount, ledger: built.ledger, ledger_version: built.version};
}

function ledgerHealth({summary,dashboard,snapshot}={}){
  const issues=[...(summary?.finance_data_issues||[])];
  if (summary && summary.revenue !== summary.received + summary.confirmed) issues.push('revenue_invariant_failed');
  if (dashboard && summary && dashboard.revenue !== summary.revenue) issues.push('dashboard_ledger_mismatch');
  if (snapshot && summary && snapshot.revenue !== summary.revenue) issues.push('snapshot_ledger_mismatch');
  return {ok: issues.length===0, issues};
}

module.exports={LEDGER_VERSION,CERTIFIED_PERIODS,buildRevenueLedger,revenueSummaryFromLedger,getRevenueSummary,ledgerHealth};
