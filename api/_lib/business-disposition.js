const NO_CONTACT = new Set(['nao_atendeu', 'ocupado', 'caixa_postal', 'numero_invalido']);
const HUMAN = new Set(['sem_interesse', 'retornar_depois', 'interessado', 'agendado', 'atendeu', 'agendou', 'double']);
const businessDisposition = (call = {}) => {
  const outcome = String(call.sourceOutcome ?? (call.outcome === 'none' ? '' : call.outcome) ?? '').trim();
  const raw = String(call.status || '').toLowerCase();
  const human = HUMAN.has(outcome) || (!outcome && (Boolean(call.answered_at || call.answeredAt) || ['connected','answered','completed','in_progress','active'].includes(raw)));
  const unanswered = NO_CONTACT.has(outcome) || (!outcome && ['unanswered','no_answer','missed','nao_atendida'].includes(raw));
  const scheduled = ['agendado','agendou','double'].includes(outcome);
  const duration = Math.max(0, Number(call.durationSeconds ?? call.duration_seconds) || 0);
  return { humanContact: human, unanswered, scheduled, status: human ? 'connected' : unanswered ? 'unanswered' : raw || 'unknown', humanTalkTimeSeconds: human ? duration : 0,
    activityOutcome: scheduled ? (outcome === 'double' ? 'double' : 'agendou') : human ? 'atendeu' : unanswered ? 'nao_atendeu' : '' };
};
module.exports = { businessDisposition };
