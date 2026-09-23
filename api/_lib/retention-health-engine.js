'use strict';
const { dateKey, addDays, isActiveOn, getLifecycleStatus } = require('../../assets/student-lifecycle');
const WEIGHTS = { engagement: 25, attendance: 25, learning: 20, financial: 15, relationship: 15 };
const clamp = n => Math.max(0, Math.min(100, n));
const finite = n => n !== null && n !== undefined && n !== '' && Number.isFinite(Number(n));
const daysBetween = (a, b) => Math.floor((Date.parse(dateKey(b)) - Date.parse(dateKey(a))) / 86400000);
const tier = score => score == null ? 'unknown' : score >= 80 ? 'healthy' : score >= 65 ? 'attention' : score >= 45 ? 'risk' : 'critical';
function scoreHealth(signals = {}) {
  const scores = Object.fromEntries(Object.keys(WEIGHTS).map(key => [key, null]));
  const factors = [];
  const factor = (type, severity, label, metric, current_value, threshold) => factors.push({ type, severity, label, metric, current_value, threshold });
  if (finite(signals.days_since_last_activity)) {
    const days = Number(signals.days_since_last_activity);
    scores.engagement = days < 3 ? 100 : days < 7 ? 85 : days < 14 ? 60 : days < 30 ? 30 : 10;
    if (days >= 14) factor('inactivity_14d','critical',`${days} dias sem atividade registrada`,'days_since_last_activity',days,14);
    else if (days >= 7 && finite(signals.engagement_change_pct) && signals.engagement_change_pct < 0) factor('inactivity_7d','attention',`${days} dias sem atividade, abaixo do padrão`,'days_since_last_activity',days,7);
  }
  if (finite(signals.engagement_change_pct)) {
    const drop = Number(signals.engagement_change_pct);
    if (scores.engagement == null) scores.engagement = 100;
    if (drop <= -40) { scores.engagement = Math.min(scores.engagement, clamp(100 + drop)); factor('engagement_drop','high',`Frequência caiu ${Math.abs(Math.round(drop))}% contra o próprio baseline`,'engagement_change_pct',drop,-40); }
  }
  if (finite(signals.attendance_rate_30d)) {
    scores.attendance = clamp(Number(signals.attendance_rate_30d));
    if (signals.consecutive_no_shows >= 2) { scores.attendance = Math.min(scores.attendance,40); factor('consecutive_absences','high',`${signals.consecutive_no_shows} faltas consecutivas`,'consecutive_no_shows',signals.consecutive_no_shows,2); }
  }
  if (finite(signals.days_since_progress)) {
    const days = Number(signals.days_since_progress);
    scores.learning = days < 7 ? 100 : days < 14 ? 80 : days < 30 ? 55 : 25;
    if (days >= 30) factor('stalled_learning','high',`${days} dias sem progresso registrado`,'days_since_progress',days,30);
  }
  if (['current','recovered','overdue'].includes(signals.financial_status)) {
    const days = Number(signals.days_overdue) || 0;
    scores.financial = signals.financial_status !== 'overdue' ? 100 : days <= 3 ? 75 : days <= 10 ? 55 : days <= 30 ? 25 : 0;
    if (signals.financial_status === 'overdue') factor('overdue_payment',days > 10 ? 'critical' : 'high',`Cobrança em aberto vencida há ${days} dias`,'days_overdue',days,1);
  }
  if (signals.support_observed === true) {
    scores.relationship = clamp(100 - Math.min(60, (signals.overdue_support_activities || 0) * 30) - Math.min(30, (signals.critical_support_activities || 0) * 15));
    if (signals.overdue_support_activities > 0) factor('overdue_retention_activity','high',`${signals.overdue_support_activities} atividade(s) de suporte/retenção vencida(s)`,'overdue_support_activities',signals.overdue_support_activities,1);
  }
  const available = Object.keys(WEIGHTS).filter(key => scores[key] != null);
  const coverage = available.reduce((sum,key) => sum + WEIGHTS[key],0);
  const score = coverage ? Math.round(available.reduce((sum,key) => sum + WEIGHTS[key] * scores[key],0) / coverage) : null;
  return { health_score: score, health_tier: tier(score), score_coverage_pct: coverage, missing_dimensions: Object.keys(WEIGHTS).filter(key => scores[key] == null), ...Object.fromEntries(Object.entries(scores).map(([key,val]) => [`${key}_score`,val])), risk_factors: factors, signals, model_version: 'deterministic-v1' };
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
module.exports = { WEIGHTS, scoreHealth, tier, activePopulation, executive, finite, daysBetween, dateKey, addDays };
