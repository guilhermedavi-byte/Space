const { createHash } = require('node:crypto');
const EVENTS_COLLECTION = 'activity_events';
const studentOf = row => String(row?.studentId ?? row?.alunoId ?? row?.firestore_student_id ?? '').trim();
const eventIdFor = ({ activityId, revision, eventType, studentId, seed = '' }) =>
  createHash('sha256').update(`${activityId}:${revision}:${eventType}:${studentId}:${seed}`).digest('hex');

const buildActivityEvent = ({ activityId, revision, eventType, studentId, actor, now, before = null, after = null, metadata = {}, snapshot = null, seed = '' }) => ({
  id: eventIdFor({ activityId, revision, eventType, studentId, seed }),
  activityId,
  studentId,
  eventType,
  actorId: actor?.id || '',
  actorName: actor?.name || '',
  actorNameSnapshot: actor?.name || '',
  actorPhotoSnapshot: actor?.photo || '',
  occurredAt: now,
  source: 'Atividades',
  before,
  after,
  metadata,
  snapshot,
});

function planActivityChange({ id, before, patch, actor, now, archive = false }) {
  const previousStudent = studentOf(before);
  const next = { ...before, ...patch, id, studentId: Object.hasOwn(patch, 'studentId') ? String(patch.studentId || '') : previousStudent };
  next.revision = (Number(before?.revision) || 0) + 1;
  next.atualizadoEm = now;
  next.hasStudentHistory = Boolean(before?.hasStudentHistory || previousStudent || next.studentId);
  const types = [];
  if (!before) types.push(['activity_created', next.studentId, null, { title: next.titulo || '' }]);
  if (previousStudent !== next.studentId) {
    if (previousStudent) types.push(['student_unlinked', previousStudent, previousStudent, next.studentId]);
    if (next.studentId) types.push(['student_linked', next.studentId, previousStudent, next.studentId]);
  }
  if (next.status === 'Feito' && before?.status !== 'Feito') {
    next.completedAt = now;
    next.completedBy = actor.id;
    types.push(['activity_completed', next.studentId, before?.status || null, next.status]);
  } else if (before?.status === 'Feito' && next.status !== 'Feito') types.push(['activity_reopened', next.studentId, before?.status, next.status]);
  if (before && before.status !== next.status && !types.some(([type]) => type === 'activity_completed' || type === 'activity_reopened')) types.push(['status_changed', next.studentId, before.status || null, next.status || null]);
  if (before && String(before.responsavelId || '') !== String(next.responsavelId || '')) types.push(['assignee_changed', next.studentId, before.responsavelId || null, next.responsavelId || null]);
  if (before && String(before.prazo || '') !== String(next.prazo || '')) types.push(['due_date_changed', next.studentId, before.prazo || null, next.prazo || null]);
  if (before && String(before.prioridade || '') !== String(next.prioridade || '')) types.push(['priority_changed', next.studentId, before.prioridade || null, next.prioridade || null]);
  if (archive) {
    next.isArchived = true;
    next.archivedAt = now;
    next.archivedBy = actor.id;
    types.push(['activity_archived', next.studentId || previousStudent, false, true]);
  }
  if (before && !types.length) types.push(['activity_updated', next.studentId]);
  const snapshot = JSON.parse(JSON.stringify(next));
  const events = types.map(([eventType, studentId, beforeValue, afterValue]) =>
    buildActivityEvent({
      activityId: id,
      revision: next.revision,
      eventType,
      studentId,
      actor,
      now,
      before: beforeValue,
      after: afterValue,
      snapshot: { ...snapshot, studentId },
      metadata: { previousStudentId: previousStudent, nextStudentId: next.studentId },
    })
  );
  return { next, events };
}
module.exports = { buildActivityEvent, planActivityChange, studentOf, EVENTS_COLLECTION };
