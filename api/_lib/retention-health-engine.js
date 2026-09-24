'use strict';
const { dateKey, addDays, isActiveOn, getLifecycleStatus } = require('../../assets/student-lifecycle');
const WEIGHTS = { presence: 30, teacher_pulse: 30, experience: 25, financial: 15 };
const clamp = n => Math.max(0, Math.min(100, n));
const finite = n => n !== null && n !== undefined && n !== '' && Number.isFinite(Number(n));
const daysBetween = (a, b) => Math.floor((Date.parse(dateKey(b)) - Date.parse(dateKey(a))) / 86400000);
const tier = score => score == null ? 'unknown' : score >= 80 ? 'healthy' : score >= 65 ? 'attention' : score >= 45 ? 'risk' : 'critical';
// Only explicit student outcomes count. All other outcomes are neutral and cannot break a streak.
function presenceSignals(logs, on) {
  const accepted = new Set(['realizada','falta_aluno','falta','falta_do_aluno','falta do aluno']);
  const observed = [...new Map(logs.filter(l => l.dateKey && l.dateKey <= on && accepted.has(l.statusAula))
    .map(l => [l.eventId || l.firestoreDocId || l.id,l])).values()]
    .sort((a,b) => String(b.dateKey).localeCompare(String(a.dateKey)) || String(b.horaInicio || b.createdAt || b.id).localeCompare(String(a.horaInicio || a.createdAt || a.id)));
  if (!observed.length) return {};
  let streak = observed.findIndex(l => l.statusAula === 'realizada');
  if (streak < 0) streak = observed.length;
  const recent = observed.filter(l => l.dateKey >= addDays(on,-30));
  return { presence_observed: recent.length > 0, student_absence_streak: streak,
    student_absences_last_5: observed.slice(0,5).filter(l=>l.statusAula !== 'realizada').length,
    recent_absences: recent.filter(l=>l.statusAula !== 'realizada').length,
    last_attended_class_at: observed.find(l=>l.statusAula==='realizada')?.dateKey || null,
    last_absence_at: observed.find(l=>l.statusAula!=='realizada')?.dateKey || null,
    absence_sequence_id: streak ? String(observed[streak-1].eventId || observed[streak-1].firestoreDocId || observed[streak-1].id) : null,
    latest_observed_at: observed[0].dateKey,
    consecutive_no_shows: streak, last_class_at: observed.find(l=>l.statusAula==='realizada')?.dateKey || null,
    attendance_rate_30d: recent.length ? 100*recent.filter(l=>l.statusAula==='realizada').length/recent.length : null };
}
function scoreHealth(signals = {}, on = dateKey(new Date())) {
  const scores = Object.fromEntries(Object.keys(WEIGHTS).map(key => [key, null]));
  const factors = [], rules = [];
  const factor = (type,severity,label,metric,current_value,threshold) => factors.push({type,severity,label,metric,current_value,threshold});
  const hard = (type,label,min_tier) => rules.push({type,label,min_tier});
  const streak = Number(signals.student_absence_streak) || 0;
  if (signals.presence_observed === true) {
    scores.presence = streak >= 4 ? 10 : streak === 3 ? 25 : streak === 2 ? 55 : signals.recent_absences > 0 ? 90 : 100;
    if (signals.student_absences_last_5 >= 3) scores.presence = Math.min(scores.presence,50);
    if (streak >= 2) factor('consecutive_absences',streak>=4?'critical':'high',`${streak} faltas consecutivas`,'student_absence_streak',streak,2);
    if (signals.student_absences_last_5 >= 3) factor('absences_last_five','high','3+ faltas nas últimas 5 aulas observadas','student_absences_last_5',signals.student_absences_last_5,3);
  }
  // A stale source is unknown; an unresolved observed absence sequence still needs attention.
  if (streak >= 4) hard('four_absences','4 ou mais faltas consecutivas','critical');
  const occurrences = [...new Map((signals.occurrences || []).map(o=>[o.comment_id ? `${o.activity_id}:${o.comment_id}` : o.metadata?.episode_id || o.id,o])).values()];
  const open = occurrences.filter(o=>o.status==='open');
  const severity = {light:90,moderate:70,high:40,critical:15};
  let friction = null;
  if (signals.occurrences_observed === true) {
    friction = 100;
    for (const o of open) {
      const repeat = occurrences.filter(x=>x.category===o.category && daysBetween(x.opened_at,on)>=0 && daysBetween(x.opened_at,on)<=90).length;
      friction = Math.min(friction,clamp(severity[o.severity] - (repeat>=3?20:repeat===2?10:0)));
    }
    if(open.length) factor('open_occurrence',open.some(o=>o.severity==='critical')?'critical':'high',`${open.length} ocorrência(s) aberta(s)`,'open_occurrences',open.length,1);
  }
  const pulse = signals.quality_pulse;
  const age = pulse?.called_at ? daysBetween(pulse.called_at,on) : Infinity;
  const conversion = {1:10,2:35,3:65,4:85,5:100};
  const voiceFields = {general_satisfaction:.35,perceived_progress:.30,teacher_satisfaction:.20,schedule_fit:.15};
  const voice = pulse && Object.keys(voiceFields).every(k=>conversion[pulse[k]]!=null)
    ? Object.entries(voiceFields).reduce((n,[k,w])=>n+conversion[pulse[k]]*w,0) : null;
  const usableVoice = voice !== null && age>=0 && age<=60;
  if(friction!==null) scores.experience = usableVoice ? friction - Math.max(0,friction-voice)*(age<=30?1:.5) : friction;
  // Without the occurrence source, a recent pulse itself is still an observed dimension.
  else if(usableVoice && age<=30) scores.experience=voice;
  if(usableVoice && voice<65) factor('negative_quality_pulse','high','Student Voice abaixo de 65','student_voice_score',voice,65);
  if(age>=0 && age<=60 && pulse?.continuation_intent==='considering_exit') hard('considering_exit','Aluno considera sair','risk');
  if(age>=0 && age<=60 && pulse?.continuation_intent==='wants_to_cancel') hard('wants_to_cancel','Aluno manifestou intenção de cancelar; formalização depende do operador','critical');
  if(['current','overdue','recovered'].includes(signals.financial_status)) {
    const d=Number(signals.days_overdue)||0;
    scores.financial = signals.financial_status!=='overdue'?100:d<=3?80:d<=10?60:d<=30?30:10;
    if(d>0) factor('overdue_payment',d>10?'critical':'high',`Cobrança em aberto vencida há ${d} dias`,'days_overdue',d,1);
  }
  if(open.some(o=>o.severity==='critical')) {
    hard('critical_occurrence','Ocorrência crítica aberta','attention');
    if(streak>=2 || (usableVoice && voice<65) || (scores.financial!==null && scores.financial<=30)) hard('critical_with_independent_signal','Ocorrência crítica com outro sinal independente de risco','critical');
  }
  const available = Object.keys(WEIGHTS).filter(k=>scores[k]!==null);
  const coverage = available.reduce((n,k)=>n+WEIGHTS[k],0);
  const raw = coverage ? Math.round(available.reduce((n,k)=>n+scores[k]*WEIGHTS[k],0)/coverage) : null;
  const rawTier = tier(raw), rank = ['unknown','healthy','attention','risk','critical'];
  const effective = rules.reduce((t,r)=>rank.indexOf(r.min_tier)>rank.indexOf(t)?r.min_tier:t,rawTier);
  return { model_version:'admin_v0',health_score_raw:raw,health_tier_raw:rawTier,health_tier_effective:effective,
    health_score:raw,health_tier:effective,score_coverage_pct:coverage,dimension_scores:scores,
    missing_dimensions:Object.keys(WEIGHTS).filter(k=>scores[k]===null),risk_factors:factors,hard_rules_applied:rules,
    ...Object.fromEntries(Object.entries(scores).map(([k,v])=>[`${k}_score`,v])),
    signals:{...signals,friction_score:friction,student_voice_score:voice,quality_pulse_age_days:Number.isFinite(age)?age:null} };
}
function activePopulation(users, canonicalStudents, subscriptions, on) {
  const uniqueUsers = new Map(users.filter(user => ['student','aluno'].includes(user.tipo || user.role)).map(user => [user.firestoreDocId || user.id,user]));
  return [...uniqueUsers].map(([id,user]) => {
    const canonical = canonicalStudents.filter(row => row.firestore_student_id === id);
    const ids = new Set(canonical.map(row => row.id));
    const subs = subscriptions.filter(row => ids.has(row.student_id));
    const active = subs.filter(row => isActiveOn(row,on) && !row.legacy_operational_suspended);
    const reliableStart = active.map(row => row.started_at).filter(Boolean).sort()[0] || null;
    return { student_id: id, canonical_ids: [...ids], nome: user.nome || user.nomeCompleto || user.name || 'Aluno', email: user.email || '', lifecycle: subs.length ? getLifecycleStatus({ subscriptions: subs },on) : 'unknown', is_active: active.length > 0 && user.ativo !== false,
      mrr: active.length && active.every(row => finite(row.mrr_brl)) ? active.reduce((sum,row) => sum + Number(row.mrr_brl),0) : null,
      started_at: reliableStart, plan: active.map(row => row.plan_name).filter(Boolean).join(', ') || user.plano || null,
      teacher: user.professorId || user.teacherId || null, cefr: user.cefr || null, segment: ['B2B','B2C'].includes(user.segment) ? user.segment : null,
      tenure_days: reliableStart ? daysBetween(reliableStart,on) : null, last_active_date: active.map(row => row.last_active_date).filter(Boolean).sort()[0] || null,
    };
  });
}
function executive(rows) {
  const active = [...new Map(rows.filter(row => row.is_active).map(row => [row.student_id,row])).values()];
  const counts = Object.fromEntries(['healthy','attention','risk','critical','unknown'].map(key => [key,active.filter(row => row.health_tier === key).length]));
  const risk = active.filter(row => ['risk','critical'].includes(row.health_tier));
  const known = risk.filter(row => finite(row.mrr));
  const healthyActive = active.filter(row => row.health_tier === 'healthy' && row.lifecycle === 'active').length;
  return { active_students: active.length, ...counts, healthy_active: healthyActive, healthy_active_pct: active.length ? 100 * healthyActive / active.length : null,
    health_mean: active.filter(row=>row.health_score!=null).length ? active.filter(row=>row.health_score!=null).reduce((sum,row)=>sum+row.health_score,0)/active.filter(row=>row.health_score!=null).length : null,
    health_coverage_pct: active.length ? active.reduce((sum,row) => sum + row.score_coverage_pct,0) / active.length : 0,
    active_mrr: active.length && active.every(row => finite(row.mrr)) ? active.reduce((sum,row) => sum + Number(row.mrr),0) : null,
    mrr_at_risk: known.length ? known.reduce((sum,row) => sum + Number(row.mrr),0) : null, mrr_known_count: known.length, mrr_risk_count: risk.length,
    mrr_coverage_pct: risk.length ? 100 * known.length / risk.length : null,
    requested: active.filter(row => row.lifecycle === 'cancellation_requested').length,
    notice_period: active.filter(row => ['notice_period','cancellation_scheduled'].includes(row.lifecycle)).length,
    churned: rows.filter(row => row.lifecycle === 'churned').length };
}
module.exports = { WEIGHTS, presenceSignals, scoreHealth, tier, activePopulation, executive, finite, daysBetween, dateKey, addDays };
