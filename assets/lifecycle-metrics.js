(function(root,factory){
 if(typeof module==='object' && module.exports) module.exports=factory(require('./student-lifecycle'));
 else root.SpaceLifecycleMetrics=factory(root.SpaceLifecycle);
})(typeof globalThis !== 'undefined' ? globalThis : this,function(policy){
const {dateKey,isActiveOn}=policy;
// Historical rates require an observed opening population, never reverse-estimated counts.
function computeLifecycleMetrics({events=[],students=[],month,withSeries=true,populationSnapshot=null,activeCount=null}) {
  const rows = events.map(e => {
    const state=e.state_after || {}, payload=e.payload || {};
    const kind=e.event_type;
    let date=null, metric=null;
    if (kind==='register_formal_request') { metric='pedidosNoMes'; date=state.cancellation_requested_at || payload.requested_at || e.occurred_at; }
    if (kind==='retract_cancellation') { metric='revertidosNoMes'; date=e.occurred_at; }
    if (['confirm_cancellation_continuity','schedule_program_end'].includes(kind) && (state.notice_started_at || payload.notice_started_at)) { metric='avisosNoMes'; date=state.notice_started_at || payload.notice_started_at; }
    if (kind==='cancellation_effective') { metric='churnNoMes'; date=state.churn_at || e.occurred_at; }
    return { metric, date:date ? dateKey(date) : null, event:e };
  });
  const result={monthKey:month,pedidosNoMes:0,revertidosNoMes:0,avisosNoMes:0,churnNoMes:0,byOutcome:{},byReason:{}};
  for (const row of rows) if (row.metric && row.date?.startsWith(month)) {
    result[row.metric]++;
    if (row.metric==='pedidosNoMes') { const reason=row.event.payload?.reason || 'Sem motivo'; result.byReason[reason]=(result.byReason[reason] || 0)+1; }
    if (row.metric==='churnNoMes') { const reason=row.event.payload?.outcome || row.event.payload?.notes || 'Sem motivo'; result.byOutcome[reason]=(result.byOutcome[reason] || 0)+1; }
  }
  result.ativosAtuais=students.filter(s=>(s.subscriptions || []).some(sub=>isActiveOn(sub,new Date()))).length;
  result.novosNoMes=students.filter(s=>s.created_at && dateKey(s.created_at).startsWith(month)).length;
  if (Number.isInteger(activeCount)) result.ativosAtuais=activeCount;
  result.ativosInicioMes=populationSnapshot?.snapshot_date===month+'-01' ? populationSnapshot.active_students : null;
  result.ativosInicioMesApproach=result.ativosInicioMes==null?'Dados insuficientes':'snapshot diário canônico';
  const percent=n=>result.ativosInicioMes ? 100*n/result.ativosInicioMes : null;
  result.pedidosPct=percent(result.pedidosNoMes); result.churnPct=percent(result.churnNoMes);
  result.casosFechadosNoMes=result.revertidosNoMes+result.churnNoMes;
  result.reversalRate=result.casosFechadosNoMes ? 100*result.revertidosNoMes/result.casosFechadosNoMes : null;
  result.methodology='lifecycle_events_with_observed_population';
  result.series6m=[];
  if(withSeries) for(let offset=5;offset>=0;offset--) {
    const d=new Date(month+'-01T12:00:00Z');d.setUTCMonth(d.getUTCMonth()-offset);
    const key=d.toISOString().slice(0,7), m=computeLifecycleMetrics({events,students,month:key,withSeries:false});
    result.series6m.push({monthKey:key,label:key,pedidos:m.pedidosNoMes,churn:m.churnNoMes,revertidos:m.revertidosNoMes,avisos:m.avisosNoMes});
  }
  return result;
}
return {computeLifecycleMetrics};
});
