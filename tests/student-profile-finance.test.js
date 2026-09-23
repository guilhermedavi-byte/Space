const test = require('node:test');
const assert = require('node:assert/strict');
const { readStudentProfileFinance } = require('../api/_lib/student-profile-finance');
const connectionId='11111111-1111-4111-8111-111111111111';
test('consulta somente vínculos exatos, pagina cobranças e pagamentos, sem writes',async()=>{
 const calls=[];
 const result=await readStudentProfileFinance('student-1',{connectionId,request:async(path,options)=>{
  calls.push({path,options});const q=new URL(path,'https://test');
  if(q.pathname==='/finance_customer_student_links'){assert.equal(q.searchParams.get('firestore_doc_id'),'eq.student-1');return {data:[{asaas_customer_id:'cus_1',firestore_doc_id:'student-1'}]};}
  if(q.pathname==='/finance_receivables'){
   assert.equal(q.searchParams.get('asaas_customer_id'),'eq.cus_1');
   const offset=Number(q.searchParams.get('offset'));
   return {data:offset===0?Array.from({length:500},(_,i)=>({id:String(i),asaas_payment_id:'pay_'+i,status:'PENDING',value:50,due_date:'2026-09-01'})):[{id:'501',asaas_payment_id:'pay_deleted',deleted:true}]};
  }
  assert.equal(q.pathname,'/finance_payments');return {data:[{id:q.searchParams.get('asaas_payment_id'),status:'RECEIVED',value:50,payment_date:'2026-09-01'}]};
 }});
 assert.equal(result.cobrancas.length,500);assert.equal(result.pagamentos.length,5);
 assert.ok(result.cobrancas.every(row=>row.firestore_doc_id==='student-1'));
 assert.ok(calls.every(c=>c.options.method==='GET'));
 assert.ok(!calls.some(c=>c.path.includes('pay_deleted')||c.path.includes('/rpc/')));
});
test('sem vínculo retorna vazio e não pesquisa por nome ou email',async()=>{
 let calls=0;const r=await readStudentProfileFinance('student-1',{connectionId,request:async()=>{calls++;return {data:[]};}});
 assert.equal(calls,1);assert.deepEqual(r.cobrancas,[]);assert.deepEqual(r.pagamentos,[]);
});
test('identificadores inválidos e falhas de leitura não viram ausência de cobrança',async()=>{
 await assert.rejects(()=>readStudentProfileFinance('bad&id=all',{connectionId}),/invalid_student_id/);
 await assert.rejects(()=>readStudentProfileFinance('student-1',{connectionId,request:async()=>{throw Error('offline');}}),/offline/);
});
