'use strict';
const { supabaseFetch } = require('./supabase-rest');
const { listCollectionAsAdmin } = require('./firestore-admin');
const H = require('./retention-health-engine');
const {applyLifecycleHealth,operationalLifecycle}=require('./retention-health-lifecycle');
async function all(table, query = '', order = 'id') {
  const rows = [];
  for (let offset=0;offset<100000;offset+=1000) {
    const {data} = await supabaseFetch(`/${table}?select=*&${query}&order=${order}&limit=1000&offset=${offset}`);
    if (!Array.isArray(data)) throw Error(`invalid_${table}_response`);
    rows.push(...data); if(data.length<1000) return rows;
  }
  throw Error('retention_read_limit');
}
const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const supportTypes = new Set(['suporte','reclamacao','retencao','troca de professor','support','complaint']);
const safeDay = value => { try { return value ? H.dateKey(value) : null; } catch { return null; } };
async function collectHealth(now = new Date()) {
  const day = H.dateKey(now), errors = {};
  const optional = (name,promise) => promise.catch(() => { errors[name] = 'Fonte indisponível'; return null; });
  const [users,canonical,subscriptions,activities,logs,links,receivables,payments,connections,cases,occurrences,pulses,lifecycleEvents] = await Promise.all([
    listCollectionAsAdmin('users',{decorate:false}), all('students'), all('subscriptions'),
    optional('activities',listCollectionAsAdmin('activities',{decorate:false})),
    optional('attendance',listCollectionAsAdmin('lessonLogs',{decorate:false})),
    optional('finance_links',all('finance_customer_student_links','','asaas_customer_id,firestore_doc_id')),
    optional('receivables',all('finance_receivables','deleted=eq.false')),
    optional('payments',all('finance_payments')),
    optional('connections',all('finance_connection_state','','connection_id')),
    optional('cases',all('retention_cases')),
    optional('occurrences',all('student_occurrences')),optional('quality_pulses',all('student_quality_pulses')),all('student_health_lifecycle_events'),
  ]);
  // The completed Activity is the durable source; repair a projection interrupted after its Firestore commit.
  for(const activity of activities||[]) {
    if(activity.status==='Feito' && activity.qualityPulse) {
      try { await require('./retention-activity-health').projectQuality({...activity,id:activity.firestoreDocId||activity.id}); if(pulses && !pulses.some(p=>p.activity_id===(activity.firestoreDocId||activity.id)))pulses.push({...activity.qualityPulse,activity_id:activity.firestoreDocId||activity.id,student_id:activity.studentId}); }
      catch { errors.quality_projection='Projeção de Quality Pulse pendente'; }
    }
  }
  const population = H.activePopulation(users,canonical,subscriptions,day).map(row=>({...row,teacher_name:users.find(user=>(user.firestoreDocId||user.id)===row.teacher)?.nome||null}));
  if (!population.length) throw Error('empty_operational_roster');
  const rows = population.map(student => {
    const monitored = [], signals = { financial_status:'unknown' };
    const tasks = activities?.filter(row => String(row.studentId ?? row.alunoId ?? row.firestore_student_id ?? '') === student.student_id) || [];
    if (activities) {
      const open = tasks.filter(row => !row.isArchived && row.status !== 'Feito');
      const support = open.filter(row => supportTypes.has(normalize(row.tipo)));
      signals.support_observed=true;
      signals.open_activities=open.length;
      signals.overdue_activities=open.filter(row => safeDay(row.prazo) && safeDay(row.prazo)<day).length;
      signals.overdue_support_activities=support.filter(row => safeDay(row.prazo) && safeDay(row.prazo)<day).length;
      signals.critical_support_activities=support.filter(row => row.prioridade==='Alta').length;
      signals.activity_ids=open.map(row=>row.id);
      monitored.push('overdue_retention_activity','critical_support_activity');
    }
    if(logs) {
      Object.assign(signals,H.presenceSignals(logs.filter(log=>log.alunoId===student.student_id),day));
      monitored.push('consecutive_absences','absences_last_five','low_attendance');
    }
    signals.occurrences_observed=occurrences!==null;
    signals.occurrences=(occurrences||[]).filter(o=>o.student_id===student.student_id);
    signals.quality_pulse=(pulses||[]).filter(p=>p.student_id===student.student_id && p.called_at<=now.toISOString()).sort((a,b)=>b.called_at.localeCompare(a.called_at))[0]||null;
    if(occurrences) monitored.push('open_occurrence');
    if(pulses) monitored.push('negative_quality_pulse');
    const studentLinks=(links||[]).filter(link=>link.firestore_doc_id===student.student_id);
    const ids=new Set(studentLinks.map(link=>`${link.connection_id}:${link.asaas_customer_id}`));
    const charges=(receivables||[]).filter(row=>ids.has(`${row.connection_id}:${row.asaas_customer_id}`));
    const usedConnections=(connections||[]).filter(row=>studentLinks.some(link=>link.connection_id===row.connection_id));
    // A recent individual webhook does not certify a full customer balance.
    const fresh=usedConnections.length && usedConnections.every(row=>row.last_reconciliation && now-new Date(row.last_reconciliation)<=48*3600000 && now>=new Date(row.last_reconciliation));
    signals.financial_as_of=usedConnections.map(row=>row.last_reconciliation).filter(Boolean).sort()[0] || null;
    if (links && receivables && fresh && charges.length) {
      const open=charges.filter(row=>['PENDING','OVERDUE','DUNNING_REQUESTED','AWAITING_RISK_ANALYSIS'].includes(row.status));
      const overdue=open.filter(row=>safeDay(row.due_date) && row.due_date<day);
      signals.days_overdue=overdue.length ? Math.max(...overdue.map(row=>H.daysBetween(row.due_date,day))) : 0;
      signals.overdue_amount=overdue.every(row=>H.finite(row.value)) ? overdue.reduce((sum,row)=>sum+Number(row.value),0) : null;
      signals.financial_status=overdue.length?'overdue':'current';
      signals.next_due_at=open.filter(row=>row.due_date>=day).map(row=>row.due_date).sort()[0] || null;
      monitored.push('overdue_payment');
    }
    const chargeIds=new Set(charges.map(row=>`${row.connection_id}:${row.asaas_payment_id}`));
    const paid=(payments||[]).filter(row=>chargeIds.has(`${row.connection_id}:${row.asaas_payment_id}`) && ['RECEIVED','CONFIRMED','RECEIVED_IN_CASH'].includes(row.status)).sort((a,b)=>String(b.confirmed_date||b.payment_date).localeCompare(String(a.confirmed_date||a.payment_date)))[0];
    if(paid) { signals.last_payment_at=paid.confirmed_date||paid.payment_date; signals.last_payment_amount=paid.value; }
    const score=applyLifecycleHealth(H.scoreHealth(signals,day),{lifecycle:operationalLifecycle(subscriptions.filter(s=>student.canonical_ids.includes(s.student_id)),day,student.lifecycle),events:lifecycleEvents.filter(e=>e.student_id===student.student_id),occurrences:signals.occurrences,on:now.toISOString()});
    const related=(cases||[]).filter(row=>student.canonical_ids.includes(row.student_id));
    if(cases) {
      monitored.push('cancellation_request_without_contact','notice_near_end');
      const waiting=related.find(row=>row.cancellation_requested_at && !row.first_contact_at && !row.closed_at && !row.saved_at && !row.churned_at && H.daysBetween(row.cancellation_requested_at,day)>=2);
      if(waiting) score.risk_factors.push({type:'cancellation_request_without_contact',severity:'high',label:'Pedido sem primeiro contato registrado há 2+ dias',metric:'days_without_contact',current_value:H.daysBetween(waiting.cancellation_requested_at,day),threshold:2});
      if(['cancellation_scheduled','notice_period'].includes(student.lifecycle) && student.last_active_date && H.daysBetween(day,student.last_active_date)>=0 && H.daysBetween(day,student.last_active_date)<=7) score.risk_factors.push({type:'notice_near_end',severity:'attention',label:'Aviso termina nos próximos 7 dias',metric:'notice_days_remaining',current_value:H.daysBetween(day,student.last_active_date),threshold:7});
    }
    const latestCase=related.slice().sort((a,b)=>String(b.updated_at).localeCompare(String(a.updated_at)))[0];
    const nextTask=tasks.filter(t=>!t.isArchived&&t.status!=='Feito').sort((a,b)=>String(a.prazo||'9999').localeCompare(String(b.prazo||'9999')))[0];
    return {...student,...score,snapshot_date:day,monitored_alert_types:monitored,
      notice_days_remaining:student.last_active_date?Math.max(0,H.daysBetween(day,student.last_active_date)):null,
      last_contact_at:latestCase?.last_contact_at||latestCase?.first_contact_at||null,
      retention_owner:latestCase?.owner_name||null,next_activity:nextTask?{id:nextTask.firestoreDocId||nextTask.id,title:nextTask.titulo,due:nextTask.prazo,owner:nextTask.responsavelNome||null}:null};
  });
  return {day,rows,users,activities,population:{...H.executive(rows),source_errors:errors,model_version:'admin_v0',computed_at:now.toISOString()}};
}
async function runHealthSnapshot() {
  const result=await collectHealth();
  const automation=await require('./retention-risk-automation').runAbsenceAutomation(result);
  const {data}=await supabaseFetch('/rpc/retention_health_snapshot',{method:'POST',body:{p_date:result.day,p_rows:result.rows,p_population:result.population},timeoutMs:15000});
  return {...data,summary:result.population,automation};
}
async function readIntelligence(month) {
  const day=H.dateKey(new Date());
  const populations=await all('retention_population_snapshots',`snapshot_date=gte.${H.addDays(day,-400)}`,'snapshot_date.desc');
  const latest=populations[0];
  if(!latest) return {rows:[],alerts:[],events:[],trend:[],summary:null,snapshot_date:null,analytics:{},missing:['Snapshot inicial ainda não disponível']};
  const [daily,history,alerts,events,cases,openingRows,riskCases,occurrences,pulses,settings,riskActions,lifecycleEvents,subscriptions,currentActivities]=await Promise.all([
    all('student_health_daily',`snapshot_date=eq.${latest.snapshot_date}`,'student_id'),
    all('student_health_daily',`snapshot_date=in.(${H.addDays(latest.snapshot_date,-7)},${H.addDays(latest.snapshot_date,-14)})`,'snapshot_date,student_id'),
    all('retention_alerts'),all('retention_health_events',`snapshot_date=gte.${H.addDays(day,-90)}`),all('retention_cases'),
    all('student_health_daily',`snapshot_date=eq.${month}-01`,'student_id'),
    all('retention_risk_cases'),all('student_occurrences'),all('student_quality_pulses'),all('retention_health_settings'),all('retention_risk_actions'),all('student_health_lifecycle_events'),all('subscriptions'),listCollectionAsAdmin('activities',{decorate:false}).catch(()=>null),
  ]);
  const rows=daily.map(row=>{
    const base=row.data;
    const subs=subscriptions.filter(s=>(base.canonical_ids||[]).includes(s.student_id));
    const lifecycle=subs.length?require('../../assets/student-lifecycle').getLifecycleStatus({subscriptions:subs},day):base.lifecycle;
    // Reapply against raw dimensions, never compound yesterday's operational cap.
    const observed=H.scoreHealth(base.signals||{},latest.snapshot_date);
    const live=applyLifecycleHealth(observed,{lifecycle:operationalLifecycle(subs,day,lifecycle),events:lifecycleEvents.filter(e=>e.student_id===row.student_id),occurrences:occurrences.filter(o=>o.student_id===row.student_id)});
    const caseNow=cases.filter(c=>(base.canonical_ids||[]).includes(c.student_id)).sort((a,b)=>String(b.updated_at).localeCompare(String(a.updated_at)))[0];
    const next=(currentActivities||[]).filter(t=>(t.studentId||t.alunoId||t.firestore_student_id)===row.student_id&&!t.isArchived&&t.status!=='Feito').sort((a,b)=>String(a.prazo||'9999').localeCompare(String(b.prazo||'9999')))[0];
    const end=subs.filter(s=>['cancellation_scheduled','notice_period'].includes(s.lifecycle_status)).map(s=>s.last_active_date).filter(Boolean).sort()[0];
    const data={...base,...live,lifecycle,risk_factors:base.risk_factors,
      last_contact_at:caseNow?.last_contact_at||caseNow?.first_contact_at||null,retention_owner:caseNow?.owner_name||null,
      notice_days_remaining:end?Math.max(0,H.daysBetween(day,end)):null,
      next_activity:currentActivities?(next?{id:next.firestoreDocId||next.id,title:next.titulo,due:next.prazo,owner:next.responsavelNome||null}:null):base.next_activity};
    const delta=days=> {const previous=history.find(item=>item.student_id===row.student_id && item.snapshot_date===H.addDays(latest.snapshot_date,-days)); return previous && previous.data?.model_version===row.data?.model_version && previous.score_coverage_pct===row.score_coverage_pct && JSON.stringify(previous.missing_dimensions)===JSON.stringify(row.missing_dimensions) && H.finite(previous.health_score) && H.finite(row.health_score) ? row.health_score-previous.health_score:null;};
    return {...data,risk_cases:riskCases.filter(c=>c.student_id===row.student_id).map(c=>({...c,actions:riskActions.filter(a=>a.risk_case_id===c.id)})),occurrences:occurrences.filter(c=>c.student_id===row.student_id),quality_pulse:pulses.filter(c=>c.student_id===row.student_id).sort((a,b)=>b.called_at.localeCompare(a.called_at))[0]||null,health_change_7d:delta(7),health_change_14d:delta(14)};
  });
  const canonicalIds=new Set(rows.flatMap(row=>row.canonical_ids||[]));
  const operationalCases=cases.filter(row=>canonicalIds.has(row.student_id));
  const requested=operationalCases.filter(row=>row.cancellation_requested_at?.startsWith(month));
  const saved=requested.filter(row=>row.saved_at && !row.churned_at);
  const lost=requested.filter(row=>row.churned_at);
  const closed=saved.length+lost.length;
  const churn=operationalCases.filter(row=>row.churned_at?.startsWith(month));
  const start=populations.find(row=>row.snapshot_date===`${month}-01`);
  const openingIds=new Set(openingRows.filter(row=>row.data?.is_active).flatMap(row=>row.data.canonical_ids||[]));
  const notices=requested.filter(row=>row.notice_started_at);
  const resolvedNotices=notices.filter(row=>row.churned_at||row.saved_at);
  const byReason={};churn.forEach(row=>{const reason=row.close_reason||'Sem motivo registrado';byReason[reason]=(byReason[reason]||0)+1;});
  const firstContacts=requested.filter(row=>row.first_contact_at && new Date(row.first_contact_at)>=new Date(row.cancellation_requested_at)).map(row=>(new Date(row.first_contact_at)-new Date(row.cancellation_requested_at))/3600000);
  const analytics={month,requests_mtd:requested.length,saved:saved.length,churn_mtd:churn.length,save_rate:closed?100*saved.length/closed:null,save_cohort_size:closed,
    base_start:start?.active_students??null,logo_churn:start?.active_students?100*new Set(churn.filter(row=>openingIds.has(row.student_id)).map(row=>row.student_id)).size/start.active_students:null,
    request_rate:start?.active_students?100*new Set(requested.filter(row=>openingIds.has(row.student_id)).map(row=>row.student_id)).size/start.active_students:null,
    request_to_notice:requested.length?100*notices.length/requested.length:null,notice_to_churn:resolvedNotices.length?100*resolvedNotices.filter(row=>row.churned_at).length/resolvedNotices.length:null,
    first_contact_hours:firstContacts.length?firstContacts.reduce((a,b)=>a+b,0)/firstContacts.length:null,first_contact_coverage:requested.length?100*firstContacts.length/requested.length:0,
    grr:null,nrr:null,revenue_churn:null,revenue_saved:null,reasons:byReason,methodology:'Casos da cohort de pedido no mês; Save Rate sobre desfechos conhecidos. Base inicial somente snapshot do dia 1.'};
  return {rows,alerts,events,settings:settings[0]||{},summary:{...latest.data,...H.executive(rows)},snapshot_date:latest.snapshot_date,computed_at:latest.updated_at,trend:populations.map(row=>({date:row.snapshot_date,...row.data})).reverse(),analytics,cases:operationalCases,
    missing:['Teacher Pulse: Não disponível neste modelo.','Admin V0: expert-informed; não é um modelo preditivo comprovado','MRR, tenure e survival dependem de contratos confiáveis','NRR/GRR dependem de base MRR e movimentos de receita','Financeiro só pontua após reconciliação completa nas últimas 48h']};
}
module.exports={all,collectHealth,runHealthSnapshot,readIntelligence};
