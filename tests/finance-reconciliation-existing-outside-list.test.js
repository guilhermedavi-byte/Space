const test=require('node:test'),assert=require('node:assert/strict');
const {createFinanceFoundation}=require('../api/_lib/finance-foundation');
const {normalizePayment}=require('../api/_lib/finance-domain');
const {AsaasError}=require('../api/_lib/asaas');
// Real production shape observed on 2026-09-15: absent from /payments,
// GET /payments/:id succeeds with status PENDING and deleted=true.
// Identifiers and amounts below are synthetic; this is a regression, not remote certification.
function fixture({remote={id:'pay_deleted',status:'PENDING',value:10,deleted:true},error}={}) {
 const writes=[];const local={...normalizePayment({id:'pay_deleted',status:'PENDING',value:10}),snapshot:normalizePayment({id:'pay_deleted',status:'PENDING',value:10})};
 const service=createFinanceFoundation({connectionId:'11111111-1111-4111-8111-111111111111',logger:()=>{},store:{rpc:async(action)=>{
  if(action==='connection')return{environment:'production',account_reference:'0001:123:4'};
  if(action==='get')return local;if(action==='identity')return[];writes.push(action);throw Error('unexpected_write');
 },localPaymentIds:async()=>({ids:['pay_deleted'],hasMore:false})},client:{checkAsaasConnection:async()=>({environment:'production',account_reference:'0001:123:4'}),pages:async function*(){yield{data:[],nextOffset:0};},request:async()=>{if(error)throw error;return remote;}}});
 return {service,writes};
}
test('real-shape regression: deleted object omitted from list is a mismatch, not a clean reconciliation',async()=>{
 const {service,writes}=fixture();const r=await service.sync({source:'ASAAS_RECONCILIATION',dryRun:true,inspectLocalOnly:true});
 assert.equal(r.counts.STATUS_MISMATCH,1);assert.equal(r.counts.LOCAL_ONLY,undefined);assert.equal(r.individual_lookups,1);
 assert.deepEqual(r.issues,[{external_object_id:'pay_deleted',issues:['STATUS_MISMATCH','UNMATCHED_CUSTOMER'],evidence:'asaas_get_existing_outside_list'}]);assert.deepEqual(writes,[]);
});
test('lookup failure or mismatched ID never becomes evidence of deletion',async()=>{
 for(const error of [new AsaasError('asaas_unauthorized',401),new AsaasError('asaas_rate_limited',429,true)]){
  const {service,writes}=fixture({error});await assert.rejects(service.sync({dryRun:true,inspectLocalOnly:true}),e=>e.code===error.code);assert.deepEqual(writes,[]);
 }
 const {service}=fixture({remote:{id:'pay_other',status:'PENDING',deleted:true}});await assert.rejects(service.sync({dryRun:true,inspectLocalOnly:true}),e=>e.code==='finance_snapshot_id_mismatch');
});
