const {supabaseFetch}=require('./supabase-rest');
const {createAsaasClient}=require('./asaas');
const {createFinanceFoundation}=require('./finance-foundation');
const {uuid,externalId}=require('./finance-domain');
const space=require('./finance-space');
const {classify}=require('./finance-identity-bridge');
const {createFinanceReconciliation}=require('./finance-reconciliation');
const {paymentCompetenceDate}=require('./finance-revenue-policy');
const OPEN=new Set(['PENDING','OVERDUE','DUNNING_REQUESTED']);
const PAID=new Set(['RECEIVED','RECEIVED_IN_CASH','DUNNING_RECEIVED']);
const CLOSED=new Set(['DELETED','REFUNDED','PARTIALLY_REFUNDED','CHARGEBACK_REQUESTED','CHARGEBACK_DISPUTE','AWAITING_CHARGEBACK_REVERSAL']);
const LABELS={PENDING:'A vencer',OVERDUE:'Vencido',DUNNING_REQUESTED:'Em cobrança',CONFIRMED:'Confirmado',RECEIVED:'Recebido',RECEIVED_IN_CASH:'Recebido em dinheiro',DUNNING_RECEIVED:'Recebido',DELETED:'Cancelado',REFUNDED:'Estornado',PARTIALLY_REFUNDED:'Estorno parcial',CHARGEBACK_REQUESTED:'Chargeback solicitado',CHARGEBACK_DISPUTE:'Chargeback em disputa',AWAITING_CHARGEBACK_REVERSAL:'Reversão de chargeback',ACTIVE:'Ativa',INACTIVE:'Inativa',EXPIRED:'Encerrada'};
const METHOD={PIX:'Pix',BOLETO:'Boleto',CREDIT_CARD:'Cartão de crédito',DEBIT_CARD:'Cartão de débito',UNDEFINED:'Não definido',TRANSFER:'Transferência',DEPOSIT:'Depósito'};
const CYCLE={WEEKLY:'Semanal',BIWEEKLY:'Quinzenal',MONTHLY:'Mensal',BIMONTHLY:'Bimestral',QUARTERLY:'Trimestral',SEMIANNUALLY:'Semestral',YEARLY:'Anual'};
const todayBR=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const cents=value=>{if(value==null)return null;const s=String(value);if(!/^\d+(?:\.\d{1,2})?$/.test(s))throw Error('finance_amount_invalid');const [a,b='']=s.split('.');const n=Number(a)*100+Number(b.padEnd(2,'0'));if(!Number.isSafeInteger(n))throw Error('finance_amount_invalid');return n;};
const sum=(rows,get)=>rows.reduce((a,r)=>{const v=get(r);if(v==null)return a;const n=a+v;if(!Number.isSafeInteger(n))throw Error('finance_amount_invalid');return n;},0);
const fold=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const days=(due,today)=>due&&due<today?Math.floor((Date.parse(today+'T00:00:00Z')-Date.parse(due+'T00:00:00Z'))/86400000):0;
const safeLink=value=>{try{const u=new URL(value);return u.protocol==='https:'&&(u.hostname==='asaas.com'||u.hostname.endsWith('.asaas.com'))?u.href:null;}catch{return null;}};

function cached(loader,ttl){let value,until=0,pending,generation=0;const read=async()=>{if(value&&Date.now()<until)return value;if(!pending){const g=generation;pending=loader().then(v=>{if(g===generation){value=v;until=Date.now()+ttl;}return v;}).finally(()=>{if(g===generation)pending=null;});}return pending;};read.clear=()=>{generation++;value=null;until=0;pending=null;};return read;}
function createReader({request=supabaseFetch,client=createAsaasClient({readOnly:true}),connectionId=process.env.FINANCE_CONNECTION_ID,today=todayBR,spaceLoader=space.loadSources,verify=()=>createFinanceFoundation({connectionId,client,logger:()=>{}}).verifyConnection({recordHealth:false})}={}){
 const scope=()=>uuid(connectionId);
 const recoveryOps=()=>require('./finance-recovery-operations').createRecoveryOperations({request,connectionId});
 const readAll=async(table,select,extra='')=>{const rows=[];for(let offset=0;offset<20000;offset+=500){const r=await request(`/${table}?connection_id=eq.${scope()}&select=${select}${extra}&order=${table==='finance_customer_student_links'?'asaas_customer_id,firestore_doc_id':'id'}&offset=${offset}&limit=500`);if(!Array.isArray(r.data))throw Error('finance_read_failed');rows.push(...r.data);if(r.data.length<500)return rows;}throw Error('finance_read_limit');};
 const core=cached(async()=>{const [receivables,payments,objects,links]=await Promise.all([
  readAll('finance_receivables','id,asaas_payment_id,asaas_customer_id,asaas_subscription_id,status,provider_status,value,due_date,billing_type,deleted,snapshot,last_synced_at'),
  readAll('finance_payments','id,asaas_payment_id,status,value,payment_date,confirmed_date,refund_value'),
  readAll('finance_provider_objects','id,resource,external_object_id,snapshot,last_synced_at'),
  readAll('finance_customer_student_links','asaas_customer_id,firestore_doc_id')]);
  return {receivables,payments,objects,links,read_at:new Date().toISOString()};},20000);
 const directory=cached(async()=>{
  await verify();const result={customers:[],subscriptions:[]};
  // Existing central client, GET-only. This enrichment never changes projections.
  for(const resource of ['customers'])for await(const page of client.pages(resource,{limit:100,maxPages:100})){result[resource].push(...page.data.map(r=>resource==='customers'?{id:r.id,name:r.name||null,deleted:r.deleted===true,email:r.email,phone:r.phone,mobilePhone:r.mobilePhone,cpfCnpj:r.cpfCnpj,externalReference:r.externalReference}:{id:r.id,customer:r.customer,status:r.deleted?'DELETED':r.status,value:r.value,cycle:r.cycle,next_due_date:r.nextDueDate,billing_type:r.billingType}));}
  const financial=await core();await require('./finance-customer-directory').completeCustomers(result.customers,financial.receivables.map(r=>r.asaas_customer_id),client);
  return result;
 },300000);
 const spaceDirectory=cached(async()=>{const sources=await spaceLoader();return {sources,profiles:space.profiles(sources)};},300000);
 const dataset=async()=>{const data=await core();let enrichment,warning=null;try{enrichment=await directory();}catch{warning='Não foi possível consultar os nomes no Asaas. As projeções financeiras e de assinaturas continuam disponíveis.';enrichment={customers:data.objects.filter(o=>o.resource==='customers').map(o=>({id:o.external_object_id,name:o.snapshot.name,deleted:o.snapshot.deleted})),subscriptions:data.objects.filter(o=>o.resource==='subscriptions').map(o=>({id:o.external_object_id,...o.snapshot}))};}
  enrichment.subscriptions=data.objects.filter(o=>o.resource==='subscriptions').map(o=>({id:o.external_object_id,...o.snapshot,status:o.snapshot.deleted?'DELETED':o.snapshot.status}));
  let studentProfiles=new Map(),identity=new Map();try{const context=await spaceDirectory();studentProfiles=context.profiles;identity=new Map(classify({sources:context.sources,customers:enrichment.customers,subscriptions:enrichment.subscriptions,existing:data.links}).map(r=>[r.customer_id,r]));}catch{warning=[warning,'Dados Space temporariamente indisponíveis; vínculos existentes preservados.'].filter(Boolean).join(' ');}
  const names=new Map(enrichment.customers.map(c=>[c.id,c]));const linked=new Map();for(const l of data.links){const ids=linked.get(l.asaas_customer_id)||[];ids.push(l.firestore_doc_id);linked.set(l.asaas_customer_id,ids);}
  const now=today();const customer=id=>({customer_id:id,name:names.get(id)?.name||null,student_ids:linked.get(id)||[],linked:Boolean(linked.get(id)?.length),identity_status:linked.get(id)?.length?'LINKED':identity.get(id)?.status||'UNMATCHED',space_students:(linked.get(id)||[]).map(sid=>studentProfiles.get(sid)||{student_id:sid,unavailable:true})});
  const rows=data.receivables.map(r=>{const open=!r.deleted&&OPEN.has(r.status),late=open&&r.due_date&&r.due_date<now;return {id:r.asaas_payment_id,asaas_payment_id:r.asaas_payment_id,snapshot:r.snapshot||{},...customer(r.asaas_customer_id),status:r.status,status_label:late?'Vencido':LABELS[r.status]||r.status,group:r.deleted||CLOSED.has(r.status)?'closed':PAID.has(r.status)?'received':late?'overdue':open?'upcoming':'other',value:cents(r.value),due_date:r.due_date,days_overdue:late?days(r.due_date,now):0,method:r.billing_type,method_label:METHOD[r.billing_type]||r.billing_type||'Não informado',subscription_id:r.asaas_subscription_id,last_synced_at:r.last_synced_at};});
  let recovery_rules=null;try{recovery_rules=await recoveryOps().materializeRules(rows,now);}catch{}
  const subscriptions=enrichment.subscriptions.map(s=>({id:s.id,...customer(s.customer),status:s.status,status_label:LABELS[s.status]||s.status||'Não informado',value:cents(s.value),cycle:s.cycle,cycle_label:CYCLE[s.cycle]||s.cycle||'Não informado',next_due_date:s.next_due_date,method:s.billing_type,method_label:METHOD[s.billing_type]||s.billing_type||'Não informado'}));
  return {...data,rows,subscriptions,customer,names,warning,directory_complete:!warning,today:now,recovery_rules};
 };
 const metadata=d=>({source:'Financial Foundation',subscription_source:'Financial Foundation · projeções Asaas',directory_source:d.directory_complete?'Asaas · consulta de leitura':'Projeções disponíveis',directory_complete:d.directory_complete,warning:d.warning,read_at:d.read_at,today:d.today,receivables:d.rows.length,unlinked_customers:new Set(d.rows.filter(r=>!r.linked&&r.customer_id).map(r=>r.customer_id)).size,missing_values:d.rows.filter(r=>r.value==null).length,recovery_rules:d.recovery_rules});
 const paginate=(items,q)=>{const size=30,page=Math.min(Math.max(1,Number(q.page)||1),Math.max(1,Math.ceil(items.length/size)));return {items:items.slice((page-1)*size,page*size),total:items.length,page,pages:Math.max(1,Math.ceil(items.length/size)),page_size:size};};
 const search=(row,q)=>!q||fold([row.name,row.id,row.customer_id,row.subscription_id,...(row.student_ids||[])].join(' ')).includes(fold(q));
 return {async get(view,q={}){
  if(q.fresh==='1'){core.clear();spaceDirectory.clear();}
  const d=await dataset(),meta=metadata(d);const paymentById=new Map(d.payments.map(p=>[p.asaas_payment_id,p]));
  const receivedValue=r=>PAID.has(r.status)&&r.group!=='closed'?cents(paymentById.get(r.id)?.value):0;
  if(view==='overview'){
   const month=q.month||d.today.slice(0,7);const recon=createFinanceReconciliation({connectionId});const cases=await recon.listCases();let financial=recon.buildFinancials(d.rows,d.payments,cases,month,d.today);const paymentByPaymentId=new Map(d.payments.map(p=>[p.asaas_payment_id,p]));const caseByMovement=new Map(cases.map(c=>[c.movement_id,c]));const allocatedIds=new Set(cases.flatMap(c=>Array.isArray(c.allocations)?c.allocations.map(a=>a.receivable_id).filter(Boolean):[]));const needsClassification=r=>r.status==='RECEIVED_IN_CASH'||['TRANSFER','DEPOSIT','UNDEFINED'].includes(String(r.method||''));const eligibleRevenueRows=d.rows.filter(r=>!r.deleted&&!CLOSED.has(r.status)&&!allocatedIds.has(r.asaas_payment_id)&&['RECEIVED','RECEIVED_IN_CASH','DUNNING_RECEIVED','CONFIRMED'].includes(r.status)).filter(r=>{const c=caseByMovement.get(`mov_${r.asaas_payment_id}`);if(c?.classification)return false;if(Array.isArray(c?.allocations)&&c.allocations.some(a=>a.revenue_recognized!==false))return true;return !needsClassification(r);}).map(r=>({row:r,payment:paymentByPaymentId.get(r.asaas_payment_id)})).filter(x=>String(paymentCompetenceDate(x.row,x.payment)||'').startsWith(month));const received=sum(eligibleRevenueRows.filter(x=>PAID.has(x.row.status)),x=>cents(x.payment?.value??x.row.value));const confirmed=sum(eligibleRevenueRows.filter(x=>x.row.status==='CONFIRMED'),x=>cents(x.payment?.value??x.row.value));const allocatedMonth=cases.flatMap(c=>Array.isArray(c.allocations)?c.allocations:[]).filter(a=>a?.receivable_id&&a.revenue_recognized!==false&&String(a.recognized_date||'').startsWith(month));const allocatedReceived=sum(allocatedMonth,a=>cents(a.value));financial={...financial,faturamento:received+confirmed+allocatedReceived,received:received+allocatedReceived,confirmed,source:'Financial Foundation · política central de receita',count:eligibleRevenueRows.length+allocatedMonth.length};const monthRows=d.rows.filter(r=>r.due_date?.startsWith(month));const overdue=d.rows.filter(r=>r.group==='overdue');
   return {meta:{...meta,revenue_source:financial.source||'Financial Foundation',revenue_policy:'backend_central_v1',revenue_payments:financial.count||null},month,kpis:{revenue:financial.faturamento,received:financial.received,confirmed_only:financial.confirmed,due:sum(monthRows.filter(r=>['overdue','upcoming'].includes(r.group)),r=>r.value),overdue:sum(overdue,r=>r.value),delinquency:financial.delinquency_percent,delinquency_value:financial.delinquency_value},definitions:{revenue:'Faturamento no mês: receita real de cliente pela data de pagamento ou confirmação, excluindo não-receita e pendências de classificação.',received:'Receita real de cliente recebida/liquidada no mês.',confirmed_only:'Receita real de cliente confirmada e ainda não recebida.',delinquency:'Vencido do mês atual ÷ total elegível com vencimento no mês atual.'},comparison:{expected:sum(monthRows.filter(r=>r.group!=='closed'),r=>r.value),received:financial.received},aging:[{label:'1–7 dias',min:1,max:7},{label:'8–30 dias',min:8,max:30},{label:'31–60 dias',min:31,max:60},{label:'61–90 dias',min:61,max:90},{label:'90+ dias',min:91,max:Infinity}].map(b=>({label:b.label,count:overdue.filter(r=>r.days_overdue>=b.min&&r.days_overdue<=b.max).length,value:sum(overdue.filter(r=>r.days_overdue>=b.min&&r.days_overdue<=b.max),r=>r.value)})),recent:d.rows.filter(r=>PAID.has(r.status)&&paymentById.get(r.id)?.payment_date).map(r=>({...r,payment_date:paymentById.get(r.id).payment_date})).sort((a,b)=>b.payment_date.localeCompare(a.payment_date)||a.id.localeCompare(b.id)).slice(0,6),alerts:{confirmed:d.rows.filter(r=>r.status==='CONFIRMED').length,missing_payment_dates:d.rows.filter(r=>PAID.has(r.status)&&!paymentById.get(r.id)?.payment_date).length}};
  }
  if(view==='reconciliation'){
   const recon=createFinanceReconciliation({connectionId}),cases=await recon.listCases(),all=recon.buildMovements(d.rows,d.payments,cases);
   const items=all.filter(m=>search(m,q.q)&&(!q.status||q.status==='all'||m.status===q.status));
   const resolved=all.filter(m=>['reconciled','classified'].includes(m.status));
   const pending=all.filter(m=>m.status==='pending'||m.status==='partially_reconciled');const month=d.today.slice(0,7),pendingMonth=pending.filter(m=>String(m.date||'').startsWith(month));
   const originMap=new Map();for(const m of pending){const key=m.origin||'Origem não identificada',row=originMap.get(key)||{origin:key,count:0,value:0,classifiable_count:0,classifiable_value:0};row.count++;row.value+=m.difference>0?m.difference:m.value;if(m.status==='pending'&&!m.value_allocated){row.classifiable_count++;row.classifiable_value+=m.value;}originMap.set(key,row);}const origins=[...originMap.values()].sort((a,b)=>b.value-a.value||b.count-a.count).slice(0,12);
   return {meta:{...meta,reconciliation_scope:'histórico total; mês atual informado à parte'},...paginate(items,q),origins,kpis:{pending:pending.length,pending_value:sum(pending,m=>m.difference>0?m.difference:m.value),pending_month:pendingMonth.length,pending_month_value:sum(pendingMonth,m=>m.difference>0?m.difference:m.value),resolved:resolved.length,resolved_value:sum(resolved,m=>m.value),reconciled_month:all.filter(m=>m.case?.updated_at?.startsWith(d.today.slice(0,7))&&['reconciled','classified'].includes(m.status)).length},statuses:[{id:'all',label:'Todos'},{id:'pending',label:'Pendentes'},{id:'partially_reconciled',label:'Parciais'},{id:'reconciled',label:'Conciliados'},{id:'classified',label:'Classificados'}]};
  }
  if(view==='reconciliation_movement'){
   if(!/^mov_pay_[A-Za-z0-9_-]+$/.test(q.id||''))return {not_found:true};
   const recon=createFinanceReconciliation({connectionId}),cases=await recon.listCases(),movement=recon.buildMovements(d.rows,d.payments,cases).find(m=>m.id===q.id);if(!movement)return {not_found:true};
   return {meta,movement,candidates:recon.candidateReceivables(d.rows,q.q)};
  }
  if(view==='receivables'){
   const counts=Object.fromEntries(['all','upcoming','overdue','received','closed'].map(k=>[k,k==='all'?d.rows.length:d.rows.filter(r=>r.group===k).length]));
   const items=d.rows.filter(r=>(!q.status||q.status==='all'||r.group===q.status)&&search(r,q.q)&&(!q.method||r.method===q.method)&&(!q.from||r.due_date&&r.due_date>=q.from)&&(!q.to||r.due_date&&r.due_date<=q.to)&&(!q.customer||r.customer_id===q.customer)&&(!q.subscription||r.subscription_id===q.subscription)).sort((a,b)=>(a.due_date||'9999').localeCompare(b.due_date||'9999')||a.id.localeCompare(b.id));
   return {meta,...paginate(items,q),counts,filter_context:q.customer?{label:d.customer(q.customer).name||q.customer}:q.subscription?{label:q.subscription}:null,methods:[...new Set(d.rows.map(r=>r.method).filter(Boolean))].map(id=>({id,label:METHOD[id]||id}))};
  }
  if(view==='recovery'){
   const cases=await recoveryOps().casesFor(d.rows.filter(r=>r.group==='overdue').map(r=>r.id));
   const {items:all,...summary}=require('./finance-recovery-view').recovery(d.rows,cases);
   const items=all.filter(r=>search(r,q.q)&&(!q.aging||r.aging===q.aging)&&(!q.stage||r.stage===q.stage)&&(!q.link||q.link===(r.linked?'linked':'unlinked'))).sort((a,b)=>b.days_overdue-a.days_overdue||a.id.localeCompare(b.id));
   return {meta,...summary,...paginate(items,q)};
  }
  if(view==='subscriptions')return {meta,...paginate(d.subscriptions.filter(r=>search(r,q.q)&&(!q.status||r.status===q.status)).sort((a,b)=>(a.next_due_date||'9999').localeCompare(b.next_due_date||'9999')||a.id.localeCompare(b.id)),q),statuses:[...new Set(d.subscriptions.map(r=>r.status).filter(Boolean))]};
  if(view==='customers'){
   const ids=new Set([...d.names.keys(),...d.rows.map(r=>r.customer_id),...d.subscriptions.map(r=>r.customer_id)].filter(Boolean));const items=[...ids].map(id=>{const rows=d.rows.filter(r=>r.customer_id===id),overdue=sum(rows.filter(r=>r.group==='overdue'),r=>r.value),open=sum(rows.filter(r=>['overdue','upcoming'].includes(r.group)),r=>r.value);return {id,...d.customer(id),overdue,open,received:sum(rows,receivedValue),count:rows.length,subscriptions:d.subscriptions.filter(s=>s.customer_id===id).map(s=>s.id),financial_status:overdue>0?'overdue':open>0?'open':rows.length?'clear':'none'};}).filter(r=>search(r,q.q)&&(!q.status||r.financial_status===q.status)&&(!q.link||(q.link==='ambiguous'?r.identity_status==='AMBIGUOUS':q.link===(r.linked?'linked':'unlinked')))).sort((a,b)=>b.overdue-a.overdue||String(a.name||a.id).localeCompare(String(b.name||b.id)));
   return {meta,...paginate(items,q)};
  }
  if(view==='receivable'){
   externalId(q.id);const row=d.rows.find(r=>r.id===q.id);if(!row)return {not_found:true};const raw=d.receivables.find(r=>r.asaas_payment_id===q.id),s=raw.snapshot||{};
   const audit=(await request(`/finance_audit_events?connection_id=eq.${scope()}&object_type=eq.payments&external_object_id=eq.${encodeURIComponent(q.id)}&select=id,source,action,created_at,state_before,state_after&order=created_at.desc,id.desc&limit=21`)).data;
   if(!Array.isArray(audit))throw Error('finance_read_failed');
   const ops=recoveryOps(),caseMap=await ops.casesFor([q.id]),events=await ops.eventsFor(q.id);
   const keys=['status','value','due_date','deleted'];return {meta,item:row,details:{provider_status:raw.provider_status,original_due_date:s.original_due_date,payment_date:s.payment_date,confirmed_date:s.confirmed_date,credit_date:s.credit_date,estimated_credit_date:s.estimated_credit_date,net_value:cents(s.net_value),refund_value:cents(s.refund_value),created_date:s.date_created},links:[{label:'Abrir cobrança no Asaas',url:safeLink(s.invoice_url)},{label:'Abrir boleto',url:safeLink(s.bank_slip_url)}].filter(l=>l.url),recovery_case:caseMap.get(q.id)||null,recovery_events:events,audit: audit.slice(0,20).map(a=>({id:a.id,source:a.source,action:a.action,created_at:a.created_at,changes:keys.filter(k=>a.state_before?.[k]!==a.state_after?.[k]).map(k=>({field:k,before:k==='value'?cents(a.state_before?.[k]):k==='status'?(LABELS[a.state_before?.[k]]||a.state_before?.[k]||null):a.state_before?.[k]??null,after:k==='value'?cents(a.state_after?.[k]):k==='status'?(LABELS[a.state_after?.[k]]||a.state_after?.[k]||null):a.state_after?.[k]??null}))})),audit_more:audit.length>20};
  }
  throw Error('finance_view_invalid');
 }};
}
module.exports={createReader,cents,todayBR};
