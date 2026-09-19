const {getSessionFromRequest}=require('../_lib/session');
const {canAccessFinance}=require('./_lib/finance-integrations');
const {supabaseFetch}=require('./_lib/supabase-rest');
const {createAsaasClient}=require('./_lib/asaas');
const {createFinanceReconciliation}=require('./_lib/finance-reconciliation');
const {buildRevenueLedger,revenueSummaryFromLedger}=require('./_lib/finance-revenue-ledger');
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
function summarize(items,pred){return items.filter(pred).reduce((s,x)=>s+(x.amount||0),0);}
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
 const {ledger}=buildRevenueLedger({connectionId:CONNECTION_ID(),rows,payments,cases,links,month});
 const guardedSummary=revenueSummaryFromLedger(ledger,month);const recognized=ledger.filter(x=>x.revenue_recognized);const excluded=ledger.filter(x=>!x.revenue_recognized&&String(x.competence_date||'').startsWith(month));
 const txItems=Array.isArray(transactions)?transactions:[];const creditTx=txItems.filter(t=>isCredit(t)&&String(dateOfTx(t)||'').startsWith(month));
 const summary={month,
  total_gross_asaas_cents:creditTx.reduce((s,t)=>s+txValue(t),0),
  recognized_customer_revenue_cents:summarize(ledger,x=>x.revenue_recognized),
  received_cents:summarize(ledger,x=>x.revenue_recognized&&['RECEIVED','RECEIVED_IN_CASH'].includes(x.status)),
  confirmed_cents:summarize(ledger,x=>x.revenue_recognized&&x.status==='CONFIRMED'),
  received_in_cash_cents:summarize(ledger,x=>x.revenue_recognized&&x.status==='RECEIVED_IN_CASH'),
  pf_transfers_cents:summarize(ledger,x=>!x.revenue_recognized&&x.economic_nature==='TREASURY_TRANSFER'&&/pf_receivables_transfer|guilherme/i.test(`${x.reason} ${x.origin}`)),
  tap_tap_reconciled_cents:summarize(ledger,x=>x.revenue_recognized&&/tap\s*tap|remessa/i.test(`${x.reason} ${x.origin}`)),
  tap_tap_unallocated_cents:summarize(ledger,x=>x.economic_nature==='CUSTOMER_PAYMENT_UNALLOCATED'&&x.revenue_recognized),
  tap_tap_pending_cents:summarize(ledger,x=>!x.revenue_recognized&&/tap\s*tap|remessa|tap_tap/i.test(`${x.reason} ${x.origin}`)),
  other_non_revenue_cents:summarize(ledger,x=>!x.revenue_recognized&&['OWNER_REIMBURSEMENT','CAPITAL_CONTRIBUTION','OWNER_LOAN','INTERNAL_TRANSFER','TREASURY_TRANSFER','NON_REVENUE'].includes(x.economic_nature)&&!/pf_receivables_transfer|guilherme/i.test(`${x.reason} ${x.origin}`)),
  refunds_cents:summarize(ledger,x=>!x.revenue_recognized&&x.economic_nature==='REFUND'),
  unclassified_count:ledger.filter(x=>!x.revenue_recognized&&x.economic_nature==='UNCLASSIFIED'&&String(x.competence_date||'').startsWith(month)).length,
  unclassified_cents:summarize(ledger,x=>!x.revenue_recognized&&x.economic_nature==='UNCLASSIFIED'&&String(x.competence_date||'').startsWith(month)),
  recognized_count:recognized.length,exclusions_count:excluded.length,certified_period:guardedSummary.certified_period,finance_data_inconsistent:guardedSummary.finance_data_inconsistent,raw_recognized_customer_revenue_cents:guardedSummary.raw_revenue??guardedSummary.revenue,
  asaas_payments_seen:asaasPayments.length,financial_transactions_seen:creditTx.length,financial_transactions_error:Array.isArray(transactions)?null:transactions.error||'financial_transactions_unavailable'};
 const bridgeCents=summary.total_gross_asaas_cents-summary.recognized_customer_revenue_cents-summary.pf_transfers_cents-summary.other_non_revenue_cents-summary.tap_tap_pending_cents+summary.received_in_cash_cents-summary.refunds_cents;
 summary.reconciliation_difference_cents=bridgeCents;
 const compactLedger=ledger.map(x=>({payment_id:x.asaas_payment_id,movement_id:x.movement_id,customer_id:x.customer_id,student_id:x.student_id,date:x.competence_date,amount:x.amount,status:x.status,origin:x.origin,nature:x.economic_nature,revenue_recognized:x.revenue_recognized,reason:x.reason}));
 const compactTransactions=creditTx.map(t=>({id:t.id||t.object||null,date:dateOfTx(t),amount:txValue(t),type:t.type||t.operation||null,description:clean(t.description||t.event||t.transactionType||''),payment_id:t.paymentId||t.payment||t.payment_id||null}));
 return send(res,200,{generated_at:new Date().toISOString(),summary,ledger:compactLedger,asaas_financial_transactions:compactTransactions});
}catch(error){return send(res,503,{error:'certification_unavailable',code:error?.code||error?.message||'unknown'});}};
