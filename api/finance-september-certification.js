const {getSessionFromRequest}=require('../_lib/session');
const {canAccessFinance}=require('./_lib/finance-integrations');
const {supabaseFetch}=require('./_lib/supabase-rest');
const {createAsaasClient}=require('./_lib/asaas');
const {createFinanceReconciliation}=require('./_lib/finance-reconciliation');
const {paymentCompetenceDate,isRevenueRow,originRuleMap,movementOrigin,CLOSED_STATUSES,AMBIGUOUS_BILLING_TYPES}=require('./_lib/finance-revenue-policy');
const CONNECTION_ID=()=>process.env.FINANCE_CONNECTION_ID;
const monthBounds=month=>({from:`${month}-01`,to:`${month}-${new Date(Number(month.slice(0,4)),Number(month.slice(5,7)),0).getDate().toString().padStart(2,'0')}`});
const moneyCents=value=>{if(value==null||value==='')return 0;const raw=String(value).trim().replace(/\s/g,'').replace('R$','').replace(/\.(?=\d{3}(?:\D|$))/g,'').replace(',','.');const n=Number(raw);return Number.isFinite(n)?Math.round(n*100):0;};
const send=(res,status,data)=>{res.statusCode=status;res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','private, no-store');res.end(JSON.stringify(data));};
async function all(table,select){let out=[],from=0,step=1000;for(;;){const sep=select.includes('?')?'&':'?';const r=await supabaseFetch(`/${table}${sep}select=${encodeURIComponent(select.replace(/^.*\?/,'')||'*')}`,{headers:{Range:`${from}-${from+step-1}`},timeoutMs:12000});const data=Array.isArray(r.data)?r.data:[];out.push(...data);if(data.length<step)break;from+=step;}return out;}
async function asaasPages(client,pathBase,params={}){let out=[],offset=0,limit=100;for(let i=0;i<200;i++){const qs=new URLSearchParams({...params,limit:String(limit),offset:String(offset)});const page=await client.request(`${pathBase}?${qs}`);const data=Array.isArray(page?.data)?page.data:[];out.push(...data);if(!page?.hasMore)break;offset+=data.length;if(!data.length)break;}return out;}
const clean=s=>String(s||'').replace(/[\r\n\t]+/g,' ').slice(0,160);
const dateOfTx=t=>String(t.date||t.transactionDate||t.effectiveDate||t.createdDate||t.dateCreated||'').slice(0,10);
const txValue=t=>moneyCents(Math.abs(Number(t.value??t.amount??0)));
const isCredit=t=>Number(t.value??t.amount??0)>0||String(t.type||t.operation||'').toUpperCase().includes('CREDIT');
const classificationNature=c=>({pf_receivables_transfer:'TREASURY_TRANSFER',tap_tap_remittance:'CUSTOMER_PAYMENT_UNALLOCATED',space_refund:'REFUND',capital_contribution:'CAPITAL_CONTRIBUTION',partner_loan:'OWNER_LOAN',internal_transfer:'TREASURY_TRANSFER',non_operational_movement:'UNCLASSIFIED',other:'UNCLASSIFIED'}[c]||'UNCLASSIFIED');
function summarize(items,pred){return items.filter(pred).reduce((s,x)=>s+(x.value_cents||0),0);}
function buildLedger({rows,payments,cases,links,month}){
 const paymentById=new Map(payments.map(p=>[p.asaas_payment_id,p]));
 const caseByMovement=new Map(cases.map(c=>[c.movement_id,c]));
 const originRules=originRuleMap(cases);
 const linkByCustomer=new Map(links.map(l=>[l.asaas_customer_id,l]));
 const allocated=[];const allocatedIds=new Set();
 for(const c of cases)for(const a of Array.isArray(c.allocations)?c.allocations:[])if(a?.receivable_id&&a?.revenue_recognized!==false){allocated.push({caseDoc:c,...a});allocatedIds.add(a.receivable_id);}
 const ledger=[];const seen=new Set();
 const add=e=>{const id=e.event_id;if(seen.has(id))return;seen.add(id);ledger.push(e);};
 for(const row of rows){const payment=paymentById.get(row.asaas_payment_id);const comp=paymentCompetenceDate(row,payment);const caseDoc=caseByMovement.get(`mov_${row.asaas_payment_id}`);const origin=movementOrigin(row);const hasAllocation=allocatedIds.has(row.asaas_payment_id);const relevant=String(comp||'').startsWith(month)||String(row.due_date||'').startsWith(month)||caseDoc;
  if(!relevant)continue;
  const linked=Boolean(linkByCustomer.get(row.asaas_customer_id));
  let revenue=false,nature='UNCLASSIFIED',reason='fora da política de receita reconhecida';
  if(hasAllocation){reason='receita considerada via alocação de conciliação';}
  else if(row.deleted||CLOSED_STATUSES.has(row.status)){nature=row.status&&String(row.status).includes('REFUND')?'REFUND':'UNCLASSIFIED';reason='cobrança encerrada/cancelada/estornada';}
  else if(row.status==='RECEIVED_IN_CASH'){revenue=true;nature='CUSTOMER_PAYMENT_EXTERNAL';reason='cobrança real de cliente marcada RECEIVED_IN_CASH';}
  else if(caseDoc?.classification){nature=classificationNature(caseDoc.classification);if(caseDoc.classification==='tap_tap_remittance'&&!(Array.isArray(caseDoc.allocations)&&caseDoc.allocations.some(a=>a?.revenue_recognized!==false))){revenue=true;reason='Tap Tap Send Payments: pagamento de cliente não alocado';}else reason=`classificação de conciliação: ${caseDoc.classification}`;}
  else if(isRevenueRow(row,payment,caseDoc,originRules.get(origin))){revenue=true;nature='CUSTOMER_PAYMENT';reason=row.status==='CONFIRMED'?'pagamento de cliente confirmado':'pagamento de cliente recebido';}
  else if(AMBIGUOUS_BILLING_TYPES.has(String(row.billing_type||row.method||''))){nature='UNCLASSIFIED';reason='movimentação ambígua sem vínculo confiável';}
  add({event_id:`payment:${row.asaas_payment_id}`,payment_id:row.asaas_payment_id,movement_id:`mov_${row.asaas_payment_id}`,customer_id:row.asaas_customer_id||null,student_id:linkByCustomer.get(row.asaas_customer_id)?.firestore_doc_id||null,student_linked:linked,date:comp||row.due_date||null,value_cents:moneyCents(payment?.value??row.value),status:row.status,origin:clean(origin),billing_type:row.billing_type||null,nature,revenue_recognized:revenue&&String(comp||'').startsWith(month),reason});
 }
 for(const a of allocated){if(!String(a.recognized_date||'').startsWith(month))continue;const row=rows.find(r=>r.asaas_payment_id===a.receivable_id)||{};const origin=clean(a.caseDoc?.origin||a.caseDoc?.movement_id||'Conciliação');const tap=/tap\s*tap|remessa/i.test(origin)||a.caseDoc?.classification==='tap_tap_remittance';add({event_id:`allocation:${a.caseDoc?.movement_id}:${a.receivable_id}`,payment_id:a.receivable_id,movement_id:a.caseDoc?.movement_id||null,customer_id:a.customer_id||row.asaas_customer_id||null,student_id:(a.student_ids||row.student_ids||[])[0]||null,student_linked:Boolean((a.student_ids||row.student_ids||[]).length),date:a.recognized_date,value_cents:moneyCents(a.value),status:row.status||'ALLOCATED',origin,billing_type:row.billing_type||null,nature:tap?'CUSTOMER_PAYMENT':'CUSTOMER_PAYMENT',revenue_recognized:true,reason:tap?'Tap Tap/remessa conciliada com cobrança real de aluno':'movimento conciliado com cobrança real de aluno'});}
 return ledger.sort((a,b)=>String(a.date||'').localeCompare(String(b.date||''))||String(a.payment_id||'').localeCompare(String(b.payment_id||'')));
}
module.exports=async(req,res)=>{try{const user=getSessionFromRequest(req);if(!user)return send(res,401,{error:'unauthorized'});if(!canAccessFinance(user))return send(res,403,{error:'forbidden'});if(req.method!=='GET')return send(res,405,{error:'read_only'});const month=new URL(req.url,'https://space.invalid').searchParams.get('month')||'2026-09';if(month!=='2026-09')return send(res,400,{error:'month_not_supported'});const {from,to}=monthBounds(month);
 const [rows,payments,links]=await Promise.all([
  all('finance_receivables','id,asaas_payment_id,asaas_customer_id,status,value,due_date,billing_type,deleted,snapshot'),
  all('finance_payments','id,asaas_payment_id,status,value,payment_date,confirmed_date,refund_value'),
  all('finance_customer_student_links','asaas_customer_id,firestore_doc_id,verified_by')
 ]);
 const recon=createFinanceReconciliation({connectionId:CONNECTION_ID()});const cases=await recon.listCases();
 const client=createAsaasClient({readOnly:true,timeoutMs:15000});
 const [asaasPayments,transactions]=await Promise.all([
  asaasPages(client,'/payments',{}),
  asaasPages(client,'/financialTransactions',{startDate:from,finishDate:to}).catch(error=>({error:error.code||'financial_transactions_unavailable',data:[]}))
 ]);
 const ledger=buildLedger({rows,payments,cases,links,month});
 const recognized=ledger.filter(x=>x.revenue_recognized);const excluded=ledger.filter(x=>!x.revenue_recognized&&String(x.date||'').startsWith(month));
 const txItems=Array.isArray(transactions)?transactions:[];const creditTx=txItems.filter(t=>isCredit(t)&&String(dateOfTx(t)||'').startsWith(month));
 const summary={month,
  total_gross_asaas_cents:creditTx.reduce((s,t)=>s+txValue(t),0),
  recognized_customer_revenue_cents:summarize(ledger,x=>x.revenue_recognized),
  received_cents:summarize(ledger,x=>x.revenue_recognized&&['RECEIVED','RECEIVED_IN_CASH','DUNNING_RECEIVED'].includes(x.status)),
  confirmed_cents:summarize(ledger,x=>x.revenue_recognized&&x.status==='CONFIRMED'),
  received_in_cash_cents:summarize(ledger,x=>x.revenue_recognized&&x.status==='RECEIVED_IN_CASH'),
  pf_transfers_cents:summarize(ledger,x=>!x.revenue_recognized&&x.nature==='TREASURY_TRANSFER'&&/pf_receivables_transfer|guilherme/i.test(`${x.reason} ${x.origin}`)),
  tap_tap_reconciled_cents:summarize(ledger,x=>x.revenue_recognized&&/tap\s*tap|remessa/i.test(`${x.reason} ${x.origin}`)),
  tap_tap_unallocated_cents:summarize(ledger,x=>x.nature==='CUSTOMER_PAYMENT_UNALLOCATED'&&x.revenue_recognized),
  tap_tap_pending_cents:summarize(ledger,x=>!x.revenue_recognized&&/tap\s*tap|remessa|tap_tap/i.test(`${x.reason} ${x.origin}`)),
  other_non_revenue_cents:summarize(ledger,x=>!x.revenue_recognized&&['OWNER_REIMBURSEMENT','CAPITAL_CONTRIBUTION','OWNER_LOAN','TREASURY_TRANSFER'].includes(x.nature)&&!/pf_receivables_transfer|guilherme/i.test(`${x.reason} ${x.origin}`)),
  refunds_cents:summarize(ledger,x=>!x.revenue_recognized&&x.nature==='REFUND'),
  unclassified_count:ledger.filter(x=>!x.revenue_recognized&&x.nature==='UNCLASSIFIED'&&String(x.date||'').startsWith(month)).length,
  unclassified_cents:summarize(ledger,x=>!x.revenue_recognized&&x.nature==='UNCLASSIFIED'&&String(x.date||'').startsWith(month)),
  recognized_count:recognized.length,exclusions_count:excluded.length,
  asaas_payments_seen:asaasPayments.length,financial_transactions_seen:creditTx.length,financial_transactions_error:Array.isArray(transactions)?null:transactions.error||'financial_transactions_unavailable'};
 const bridgeCents=summary.total_gross_asaas_cents-summary.recognized_customer_revenue_cents-summary.pf_transfers_cents-summary.other_non_revenue_cents-summary.tap_tap_pending_cents+summary.received_in_cash_cents-summary.refunds_cents;
 summary.reconciliation_difference_cents=bridgeCents;
 const compactLedger=ledger.map(x=>({payment_id:x.payment_id,movement_id:x.movement_id,customer_id:x.customer_id,student_id:x.student_id,date:x.date,value_cents:x.value_cents,status:x.status,origin:x.origin,nature:x.nature,revenue_recognized:x.revenue_recognized,reason:x.reason}));
 const compactTransactions=creditTx.map(t=>({id:t.id||t.object||null,date:dateOfTx(t),value_cents:txValue(t),type:t.type||t.operation||null,description:clean(t.description||t.event||t.transactionType||''),payment_id:t.paymentId||t.payment||t.payment_id||null}));
 return send(res,200,{generated_at:new Date().toISOString(),summary,ledger:compactLedger,asaas_financial_transactions:compactTransactions});
}catch(error){return send(res,503,{error:'certification_unavailable',code:error?.code||error?.message||'unknown'});}};
