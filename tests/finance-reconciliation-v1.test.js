const test=require('node:test'),assert=require('node:assert/strict');
const {buildFinancials,buildMovements}=require('../api/_lib/finance-reconciliation');

test('financials recognize each customer obligation once and exclude allocated transfer duplicate',()=>{
 const rows=[
  {asaas_payment_id:'pay_card',status:'RECEIVED',value:'100.00',due_date:'2026-09-05',billing_type:'CREDIT_CARD',deleted:false,linked:true,snapshot:{payment_date:'2026-09-05'}},
  {asaas_payment_id:'pay_conf',status:'CONFIRMED',value:'50.00',due_date:'2026-09-06',billing_type:'PIX',deleted:false,linked:true,snapshot:{confirmed_date:'2026-09-06'}},
  {asaas_payment_id:'pay_cash',status:'RECEIVED_IN_CASH',value:'80.00',due_date:'2026-09-07',billing_type:'UNDEFINED',deleted:false,linked:false,snapshot:{payment_date:'2026-09-07'}},
  {asaas_payment_id:'pay_due',status:'OVERDUE',value:'40.00',due_date:'2026-09-01',billing_type:'PIX',deleted:false,linked:true,snapshot:{}},
 ];
 const payments=[{asaas_payment_id:'pay_card',value:'100.00',payment_date:'2026-09-05'},{asaas_payment_id:'pay_conf',value:'50.00',confirmed_date:'2026-09-06'},{asaas_payment_id:'pay_cash',value:'80.00',payment_date:'2026-09-07'}];
 const cases=[{movement_id:'mov_pay_cash',allocations:[{receivable_id:'pay_cash',value:'80.00',recognized_date:'2026-09-07',revenue_recognized:true}]}];
 const k=buildFinancials(rows,payments,cases,'2026-09');
 assert.equal(k.faturamento,23000);
 assert.equal(k.received,18000);
 assert.equal(k.confirmed,5000);
 assert.equal(k.delinquency_value,4000);
 assert.equal(k.delinquency_percent,14.81);
});

test('unlinked received Asaas entries become reconciliation movements with allocation difference',()=>{
 const rows=[{asaas_payment_id:'pay_cash',status:'RECEIVED_IN_CASH',value:'5000.00',due_date:'2026-09-07',billing_type:'PIX',deleted:false,linked:false,student_ids:[],snapshot:{pixTransaction:{payer:{name:'Guilherme'}}}}];
 const movements=buildMovements(rows,[{asaas_payment_id:'pay_cash',value:'5000.00',payment_date:'2026-09-07'}],[{movement_id:'mov_pay_cash',allocations:[{receivable_id:'pay_a',value:'1000.00'}]}]);
 assert.equal(movements.length,1);
 assert.equal(movements[0].origin,'Guilherme');
 assert.equal(movements[0].value,500000);
 assert.equal(movements[0].value_allocated,100000);
 assert.equal(movements[0].difference,400000);
});


test('groups pending movements by exact origin for batch classification',()=>{
 const rows=[
  {asaas_payment_id:'pay_a',status:'RECEIVED_IN_CASH',value:'100.00',due_date:'2026-09-07',billing_type:'PIX',deleted:false,linked:false,student_ids:[],snapshot:{pixTransaction:{payer:{name:'Origem A'}}}},
  {asaas_payment_id:'pay_b',status:'RECEIVED_IN_CASH',value:'200.00',due_date:'2026-09-08',billing_type:'PIX',deleted:false,linked:false,student_ids:[],snapshot:{pixTransaction:{payer:{name:'Origem A'}}}},
  {asaas_payment_id:'pay_c',status:'RECEIVED_IN_CASH',value:'50.00',due_date:'2026-09-09',billing_type:'PIX',deleted:false,linked:false,student_ids:[],snapshot:{pixTransaction:{payer:{name:'Origem B'}}}},
 ];
 const movements=buildMovements(rows,[],[]);const groups=new Map();for(const m of movements){const g=groups.get(m.origin)||{count:0,value:0};g.count++;g.value+=m.value;groups.set(m.origin,g);}assert.equal(groups.get('Origem A').count,2);assert.equal(groups.get('Origem A').value,30000);
});

test('saved exact-origin non-revenue rule excludes future entries from revenue',()=>{
 const rows=[
  {asaas_payment_id:'pay_old',status:'RECEIVED_IN_CASH',value:'100.00',due_date:'2026-09-01',billing_type:'PIX',deleted:false,linked:false,snapshot:{pixTransaction:{payer:{name:'Guilherme Davi'}},payment_date:'2026-09-01'}},
  {asaas_payment_id:'pay_new',status:'RECEIVED_IN_CASH',value:'200.00',due_date:'2026-09-02',billing_type:'PIX',deleted:false,linked:false,snapshot:{pixTransaction:{payer:{name:'Guilherme Davi'}},payment_date:'2026-09-02'}},
  {asaas_payment_id:'pay_customer',status:'RECEIVED_IN_CASH',value:'300.00',due_date:'2026-09-03',billing_type:'PIX',deleted:false,linked:true,snapshot:{payment_date:'2026-09-03'}},
 ];
 const payments=rows.map(r=>({asaas_payment_id:r.asaas_payment_id,value:r.value,payment_date:r.snapshot.payment_date}));
 const cases=[{movement_id:'mov_pay_old',origin:'Guilherme Davi',classification:'pf_receivables_transfer',allocations:[]}];
 const k=buildFinancials(rows,payments,cases,'2026-09');
 assert.equal(k.faturamento,30000);
 const future=buildMovements(rows,payments,cases).find(m=>m.id==='mov_pay_new');
 assert.equal(future.status,'classified');
 assert.equal(future.classification,'pf_receivables_transfer');
});

test('origin non-revenue rule does not exclude reliable Asaas customer charges with same name',()=>{
 const rows=[
  {asaas_payment_id:'pay_rule',status:'RECEIVED_IN_CASH',value:'100.00',due_date:'2026-09-01',billing_type:'PIX',deleted:false,linked:false,snapshot:{pixTransaction:{payer:{name:'Cliente A'}},payment_date:'2026-09-01'}},
  {asaas_payment_id:'pay_charge',status:'RECEIVED',value:'250.00',due_date:'2026-09-02',billing_type:'PIX',deleted:false,linked:false,name:'Cliente A',snapshot:{payment_date:'2026-09-02'}},
  {asaas_payment_id:'pay_confirmed',status:'CONFIRMED',value:'75.00',due_date:'2026-09-03',billing_type:'PIX',deleted:false,linked:false,name:'Cliente A',snapshot:{confirmed_date:'2026-09-03'}},
 ];
 const payments=[{asaas_payment_id:'pay_rule',value:'100.00',payment_date:'2026-09-01'},{asaas_payment_id:'pay_charge',value:'250.00',payment_date:'2026-09-02'},{asaas_payment_id:'pay_confirmed',value:'75.00',confirmed_date:'2026-09-03'}];
 const cases=[{movement_id:'mov_pay_rule',origin:'Cliente A',classification:'pf_receivables_transfer',allocations:[]}];
 const k=buildFinancials(rows,payments,cases,'2026-09');
 assert.equal(k.faturamento,32500);
 assert.equal(k.received,25000);
 assert.equal(k.confirmed,7500);
});
