'use strict';
const { supabaseFetch } = require('./supabase-rest');
const { listCollectionAsAdmin } = require('./firestore-admin');
const H = require('./retention-health-engine');
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
  const [users,canonical,subscriptions,activities,logs,links,receivables,payments,connections,cases] = await Promise.all([
    listCollectionAsAdmin('users',{decorate:false}), all('students'), all('subscriptions'),
    optional('activities',listCollectionAsAdmin('activities',{decorate:false})),
    optional('attendance',listCollectionAsAdmin('lessonLogs',{decorate:false})),
    optional('finance_links',all('finance_customer_student_links','','asaas_customer_id,firestore_doc_id')),
    optional('receivables',all('finance_receivables','deleted=eq.false')),
    optional('payments',all('finance_payments')),
    optional('connections',all('finance_connection_state','','connection_id')),
    optional('cases',all('retention_cases')),
  ]);
  const population = H.activePopulation(users,canonical,subscriptions,day);
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
      monitored.push('overdue_retention_activity');
    }
    const studentLogs=(logs||[]).filter(log => log.alunoId===student.student_id && safeDay(log.dateKey) && log.dateKey>=H.addDays(day,-30) && log.dateKey<=day);
    const dedupLogs=[...new Map(studentLogs.map(log => [log.eventId || log.id,log])).values()].sort((a,b)=>b.dateKey.localeCompare(a.dateKey));
    const observed=dedupLogs.filter(log=>['realizada','falta_aluno','falta','falta_do_aluno','falta do aluno'].includes(log.statusAula));
    if (observed.length) {
      signals.classes_attended_30d=observed.filter(log=>log.statusAula==='realizada').length;
      signals.classes_missed_30d=observed.length-signals.classes_attended_30d;
      signals.attendance_rate_30d=100*signals.classes_attended_30d/observed.length;
      signals.consecutive_no_shows=observed.findIndex(log=>log.statusAula==='realizada');
      if(signals.consecutive_no_shows<0) signals.consecutive_no_shows=observed.length;
      signals.last_class_at=observed.find(log=>log.statusAula==='realizada')?.dateKey || null;
      signals.rescheduled_classes_30d=dedupLogs.filter(log=>log.statusAula==='remarcada').length;
      monitored.push('consecutive_absences');
    }
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
    const score=H.scoreHealth(signals);
    const related=(cases||[]).filter(row=>student.canonical_ids.includes(row.student_id));
    if(cases) {
      monitored.push('cancellation_request_without_contact','notice_near_end');
      const waiting=related.find(row=>row.cancellation_requested_at && !row.first_contact_at && !row.closed_at && !row.saved_at && !row.churned_at && H.daysBetween(row.cancellation_requested_at,day)>=2);
      if(waiting) score.risk_factors.push({type:'cancellation_request_without_contact',severity:'high',label:'Pedido sem primeiro contato registrado há 2+ dias',metric:'days_without_contact',current_value:H.daysBetween(waiting.cancellation_requested_at,day),threshold:2});
      if(['cancellation_scheduled','notice_period'].includes(student.lifecycle) && student.last_active_date && H.daysBetween(day,student.last_active_date)>=0 && H.daysBetween(day,student.last_active_date)<=7) score.risk_factors.push({type:'notice_near_end',severity:'attention',label:'Aviso termina nos próximos 7 dias',metric:'notice_days_remaining',current_value:H.daysBetween(day,student.last_active_date),threshold:7});
    }
    return {...student,...score,snapshot_date:day,monitored_alert_types:monitored};
  });
  return {day,rows,population:{...H.executive(rows),source_errors:errors,model_version:'deterministic-v1',computed_at:now.toISOString()}};
}
async function runHealthSnapshot() {
  const result=await collectHealth();
  const {data}=await supabaseFetch('/rpc/retention_health_snapshot',{method:'POST',body:{p_date:result.day,p_rows:result.rows,p_population:result.population},timeoutMs:15000});
  return {...data,summary:result.population};
}
async function readIntelligence(month) {
  const day=H.dateKey(new Date());
  const populations=await all('retention_population_snapshots',`snapshot_date=gte.${H.addDays(day,-400)}`,'snapshot_date.desc');
  const latest=populations[0];
  if(!latest) return {rows:[],alerts:[],events:[],trend:[],summary:null,snapshot_date:null,analytics:{},missing:['Snapshot inicial ainda não disponível']};
  const [daily,history,alerts,events,cases,openingRows]=await Promise.all([
    all('student_health_daily',`snapshot_date=eq.${latest.snapshot_date}`,'student_id'),
    all('student_health_daily',`snapshot_date=in.(${H.addDays(latest.snapshot_date,-7)},${H.addDays(latest.snapshot_date,-14)})`,'snapshot_date,student_id'),
    all('retention_alerts'),all('retention_health_events',`snapshot_date=gte.${H.addDays(day,-90)}`),all('retention_cases'),
    all('student_health_daily',`snapshot_date=eq.${month}-01`,'student_id'),
  ]);
  const rows=daily.map(row=>{
    const data=row.data;
    const delta=days=> {const previous=history.find(item=>item.student_id===row.student_id && item.snapshot_date===H.addDays(latest.snapshot_date,-days)); return previous && previous.score_coverage_pct===row.score_coverage_pct && H.finite(previous.health_score) && H.finite(row.health_score) ? row.health_score-previous.health_score:null;};
    return {...data,health_change_7d:delta(7),health_change_14d:delta(14)};
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
  return {rows,alerts,events,summary:latest.data,snapshot_date:latest.snapshot_date,computed_at:latest.updated_at,trend:populations.map(row=>({date:row.snapshot_date,...row.data})).reverse(),analytics,cases:operationalCases,
    missing:['Engagement/baseline: telemetria de estudo não integrada','Learning/CEFR: avaliações e progresso confiáveis não integrados','Créditos e guided learning hours não disponíveis','MRR, tenure e survival dependem de contratos confiáveis','NRR/GRR dependem de base MRR e movimentos de receita','Financeiro só pontua após reconciliação completa nas últimas 48h']};
}
module.exports={all,collectHealth,runHealthSnapshot,readIntelligence};
