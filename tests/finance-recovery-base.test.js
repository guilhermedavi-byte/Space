const test=require('node:test'),assert=require('node:assert/strict');
const {candidates,profiles}=require('../api/_lib/finance-space');
const source={users:[{firestoreDocId:'student1',tipo:'student',nome:'Mesmo nome',email:'same@test',ativo:true,plano:'Gold'},{firestoreDocId:'student2',tipo:'student',nome:'Mesmo nome',asaas_customer_id:'cus_conflict'}],students:[{id:'canonical1',firestore_student_id:'student1'}],contracts:[{id:'contract1',student_id:'canonical1',external_subscription_key:'sub_exact',lifecycle_status:'cancellation_scheduled',notice_started_at:'2026-09-01T12:00:00Z',last_active_date:'2026-11-01',churn_at:'2026-11-02',plan_name:'Gold'}]};
test('only explicit identifiers link; names/emails, missing students, conflicts stay unlinked',()=>{
 const r=candidates(source,[{id:'cus_exact',externalReference:'student1'},{id:'cus_name',name:'Mesmo nome',email:'same@test'},{id:'cus_missing',externalReference:'absent'},{id:'cus_conflict',externalReference:'student1'},{id:'cus_sub'}],[{id:'sub_exact',customer:'cus_sub'}]);
 assert.deepEqual(r.accepted.map(x=>x.customer_id).sort(),['cus_exact','cus_sub']);assert.deepEqual(r.uncertain,['cus_conflict']);
 const conflict=candidates(source,[{id:'cus_exact',externalReference:'student1'}],[],[{asaas_customer_id:'cus_exact',firestore_doc_id:'student2'}]);assert.equal(conflict.accepted.length,0);
});
test('Space enrichment preserves canonical notice and does not fabricate absent owner or lifecycle',()=>{
 const p=profiles(source);assert.deepEqual(p.get('student1').plans,['Gold']);assert.equal(p.get('student1').notice[0].last_active_date,'2026-11-01');assert.equal(p.get('student1').cs_owner,null);assert.equal(p.get('student2').lifecycle_status,null);assert.equal(p.get('student1').student_status,'Ativo');
});
test('subscription page uses existing lease projection and blocks invalid cursors',async()=>{
 const calls=[];const store={rpc:async(a,b)=>{calls.push([a,b]);if(a==='connection')return {environment:'production',account_reference:'account'};if(a==='run_start')return {run_id:'run'};if(a==='acquire')return {token:'lease'};if(a==='commit')return {changed:true};return {};}};
 const client={checkAsaasConnection:async()=>({environment:'production',account_reference:'account'}),pages:async function*(){yield {data:[{id:'sub_exact'}],nextOffset:1,hasMore:false};},request:async()=>({id:'sub_exact',customer:'cus_exact',status:'ACTIVE',value:100,cycle:'MONTHLY',billingType:'PIX',nextDueDate:'2026-10-01'})};
 const f=require('../api/_lib/finance-foundation').createFinanceFoundation({store,client,connectionId:'589367ba-e7c4-4c26-af71-53f97eac31a4',logger:()=>{}});
 assert.equal((await f.syncSubscriptionPage()).examined,1);assert.ok(calls.find(([a,b])=>a==='commit'&&b.resource==='subscriptions'&&b.token==='lease'));await assert.rejects(()=>f.syncSubscriptionPage({offset:-1}));
});
