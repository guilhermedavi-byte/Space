const test=require('node:test');
const assert=require('node:assert/strict');
const {getRevenueSummary}=require('../api/_lib/finance-revenue-ledger');

const row=(id,status,value,date,extra={})=>({asaas_payment_id:id,asaas_customer_id:extra.customer||`cus_${id}`,status,value,due_date:extra.due||date,billing_type:extra.billing_type||'PIX',deleted:false,snapshot:{payment_date:date,confirmed_date:date,client_payment_date:date,...(extra.snapshot||{})},...extra});
const pay=(id,status,value,date)=>({asaas_payment_id:id,status,value,payment_date:status==='CONFIRMED'?null:date,confirmed_date:date});

test('september certified golden revenue ledger closes exactly',()=>{
 const rows=[
  row('received_official','RECEIVED','87850.81','2026-09-10'),
  row('cash_official','RECEIVED_IN_CASH','13213.00','2026-09-11',{billing_type:'UNDEFINED'}),
  row('confirmed_official','CONFIRMED','11389.22','2026-09-12'),
  row('taptap_unallocated','RECEIVED','1275.03','2026-09-01',{customer:'cus_taptap'}),
  row('pf_transfer_a','RECEIVED','5362.66','2026-09-17',{customer:'cus_owner',snapshot:{description:'Guilherme Davi'}}),
  row('pf_transfer_b','RECEIVED','1152.00','2026-09-01',{customer:'cus_owner',snapshot:{description:'DLOCAL - Guilherme Davi'}}),
 ];
 const payments=rows.map(r=>pay(r.asaas_payment_id,r.status,r.value,r.snapshot.payment_date||r.snapshot.confirmed_date));
 const cases=[
  {movement_id:'mov_taptap_unallocated',classification:'tap_tap_remittance',origin:'Tap Tap Send Payments Canada I Davi',allocations:[]},
  {movement_id:'mov_pf_prior',classification:'pf_receivables_transfer',origin:'Guilherme Davi',allocations:[]},
  {movement_id:'mov_pf_transfer_b',classification:'pf_receivables_transfer',origin:'DLOCAL - Guilherme Davi',allocations:[]},
 ];
 rows.push(row('pf_prior','RECEIVED','1.00','2026-08-01',{customer:'cus_owner',snapshot:{description:'Guilherme Davi'}}));
 payments.push(pay('pf_prior','RECEIVED','1.00','2026-08-01'));
 const s=getRevenueSummary({rows,payments,cases,links:[],month:'2026-09',today:'2026-09-19'});
 assert.equal(s.revenue,11372806);
 assert.equal(s.received,10233884);
 assert.equal(s.confirmed,1138922);
 assert.equal(s.received+s.confirmed,s.revenue);
 assert.equal(s.duplicate_economic_events,0);
 assert.ok(s.ledger.find(e=>e.asaas_payment_id==='cash_official').revenue_recognized);
 assert.equal(s.ledger.find(e=>e.asaas_payment_id==='pf_transfer_a').revenue_recognized,false);
 assert.equal(s.ledger.find(e=>e.asaas_payment_id==='taptap_unallocated').economic_nature,'CUSTOMER_PAYMENT_UNALLOCATED');
});
