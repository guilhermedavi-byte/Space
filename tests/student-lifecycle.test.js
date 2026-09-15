const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const policy=require('../assets/student-lifecycle');
const {applyCommandToProjection}=require('../api/_lib/retention-domain');
const {buildLegacyRetentionImportSnapshot}=require('../api/_lib/retention-import');
const {computeLifecycleMetrics}=require('../api/_lib/lifecycle-metrics');
const {syncProjection}=require('../api/_lib/lifecycle-projection');
const requested=()=>applyCommandToProjection({financialStatus:'delinquent',pauseStatus:'none'}, {event_type:'register_formal_request',occurred_at:'2026-09-10T15:00:00Z'});
const notice=()=>applyCommandToProjection(requested(),{event_type:'confirm_cancellation_continuity',occurred_at:'2026-09-20T15:00:00Z'});
test('pedido não altera financeiro, pausa, fim ou churn',()=>{
 const value=requested();assert.equal(value.lifecycleStatus,'cancellation_requested');assert.equal(value.financialStatus,'delinquent');
 assert.equal(value.pauseStatus,'none');assert.equal(value.scheduledServiceEndAt,null);assert.equal(value.churnedAt,null);
 assert.equal(policy.isActiveOn(value,'2027-05-01'),true);
});
test('pedido revertido mantém data do pedido, registra reversão e continua ativo',()=>{
 const value=applyCommandToProjection(requested(),{event_type:'retract_cancellation',occurred_at:'2026-09-12T15:00:00Z'});
 assert.equal(value.lifecycleStatus,'active');assert.equal(value.requestedAt,'2026-09-10T15:00:00Z');assert.equal(value.savedAt,'2026-09-12T15:00:00Z');
 assert.equal(value.churnedAt,null);assert.equal(value.scheduledServiceEndAt,null);assert.equal(value.financialStatus,'delinquent');
});
test('aviso explícito é dois meses, churn é dia seguinte',()=>{
 const value=notice();assert.equal(value.noticeStartedAt,'2026-09-20T15:00:00Z');assert.equal(value.lastActiveDate,'2026-11-20');assert.equal(value.churnAt,'2026-11-21');
});
for(const [day,active] of [['2026-10-15',true],['2026-11-20',true],['2026-11-21',false]]) test(`vigência em ${day}`,()=>{
 const value=notice();assert.equal(policy.isActiveOn(value,day),active);assert.equal(policy.getLifecycleStatus(value,day)==='churned',!active);
 assert.equal(policy.canCreateObligationFor(value,day,day),active);
});
test('agenda aceita último dia e recusa dia posterior sem mudar regras de horários',()=>{
 assert.equal(policy.canScheduleFor(notice(),'2026-11-20','2026-10-01'),true);
 assert.equal(policy.canScheduleFor(notice(),'2026-11-21','2026-10-01'),false);
 assert.equal(policy.canScheduleFor(notice(),'2026-11-20','2026-11-21'),false);
});
test('virada de dia usa São Paulo e independe de job atrasado',()=>{
 assert.equal(policy.isActiveOn(notice(),'2026-11-21T02:59:59Z'),true);
 assert.equal(policy.isActiveOn(notice(),'2026-11-21T03:00:00Z'),false);
});
for(const [start,end] of [['2026-01-31','2026-03-31'],['2026-12-31','2027-02-28'],['2023-12-31','2024-02-29'],['2026-07-31','2026-09-30'],['2026-07-31T02:30:00Z','2026-09-30']]) test(`calendário ${start}`,()=>assert.equal(policy.noticeDates(start).last_active_date,end));
test('datas inválidas não normalizam silenciosamente',()=>assert.throws(()=>policy.dateKey('2026-02-30'),/invalid_business_date/));
test('contrato simultâneo ativo mantém direitos após churn de outro',()=>{
 const student={subscriptions:[{lifecycle_status:'churned',last_active_date:'2026-01-01'},{lifecycle_status:'active'}]};
 assert.equal(policy.isActiveOn(student,'2026-10-01'),true);assert.equal(policy.canScheduleFor(student,'2026-12-01','2026-10-01'),true);
});
test('nenhuma obrigação pode abranger dias posteriores ao contrato',()=>{
 assert.equal(policy.canCreateObligationFor(notice(),'2026-11-01','2026-11-21'),false);
 assert.equal(policy.canCreateObligationFor(notice(),'2026-11-01','2026-11-20'),true);
});
test('importação de reversão é determinística, preserva os eventos e não inventa aviso',()=>{
 const users=[{id:'synthetic-reversed',tipo:'student',ativo:true,cancelamentosAnteriores:[{dataPedido:'2026-09-10T15:00:00Z',dataEfetivacao:'2026-09-12T15:00:00Z',desfecho:'revertido'}]}];
 const first=buildLegacyRetentionImportSnapshot({users,importedAt:'2026-09-13T15:00:00Z'});
 assert.deepEqual(first,buildLegacyRetentionImportSnapshot({users,importedAt:'2026-09-13T15:00:00Z'}));
 assert.equal(first.payload.cases[0].stage,'saved');assert.equal(first.payload.cases[0].lifecycle_status,'active');assert.equal(first.payload.cases[0].notice_started_at,null);
 assert.deepEqual(first.payload.events.map(e=>e.event_type),['register_formal_request','retract_cancellation']);
});
test('importador emite exceção em vez de inventar churn e datas',()=>{
 const result=buildLegacyRetentionImportSnapshot({users:[{id:'ambiguous',tipo:'student',ativo:false,cancelamento:{desfecho:'churned'}}]});
 assert.equal(result.payload.cases.length,0);assert.equal(result.report.exceptions[0].reason,'missing_request_date');
});
test('métricas contam quatro eventos separadamente e usam data efetiva de churn atrasado',()=>{
 const metrics=computeLifecycleMetrics({month:'2026-11',students:[],events:[
 {event_type:'register_formal_request',occurred_at:'2026-11-01T15:00:00Z'},
 {event_type:'retract_cancellation',occurred_at:'2026-11-02T15:00:00Z'},
 {event_type:'confirm_cancellation_continuity',occurred_at:'2026-11-03T15:00:00Z',state_after:{notice_started_at:'2026-11-03T15:00:00Z'}},
 {event_type:'cancellation_effective',occurred_at:'2026-12-05T15:00:00Z',state_after:{churn_at:'2026-11-21'}}]});
 assert.deepEqual([metrics.pedidosNoMes,metrics.revertidosNoMes,metrics.avisosNoMes,metrics.churnNoMes],[1,1,1,1]);
 assert.equal(metrics.reversalRate,50);
});
test('browser executa exatamente o mesmo domínio de datas',()=>{
 const context={};vm.runInNewContext(fs.readFileSync(require.resolve('../assets/student-lifecycle'),'utf8'),context);
 assert.equal(context.SpaceLifecycle.noticeDates('2023-12-31').last_active_date,'2024-02-29');
 assert.equal(context.SpaceLifecycle.isActiveOn(notice(),'2026-11-20'),true);
});
test('projeção Firestore é persistida, idempotente e rejeita versão antiga',async()=>{
 let fields={},writes=0;const snapshot={subscriptions:[{version:4,lifecycle_status:'cancellation_requested'}]};
 const deps={load:async()=>snapshot,read:async()=>({fields,updateTime:'version'}),write:async(id,next)=>{fields=next;writes++;}};
 await syncProjection('synthetic',deps);assert.equal(fields.lifecycle.lifecycle_status,'cancellation_requested');assert.equal(fields.ativo,true);
 await syncProjection('synthetic',deps);assert.equal(writes,1);
 snapshot.subscriptions[0]={version:3,lifecycle_status:'churned'};
 const result=await syncProjection('synthetic',deps);assert.equal(result.stale,true);assert.equal(writes,1);
});
