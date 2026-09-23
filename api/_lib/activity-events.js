const { createHash } = require('node:crypto');
const EVENTS_COLLECTION = 'activity_events';
const studentOf = row => String(row?.studentId ?? row?.alunoId ?? row?.firestore_student_id ?? '').trim();
function planActivityChange({ id, before, patch, actor, now, archive = false }) {
  const previousStudent = studentOf(before);
  const next = { ...before, ...patch, id, studentId: Object.hasOwn(patch, 'studentId') ? String(patch.studentId || '') : previousStudent };
  next.revision = (Number(before?.revision) || 0) + 1;
  next.atualizadoEm = now;
  next.hasStudentHistory = Boolean(before?.hasStudentHistory || previousStudent || next.studentId);
  const types = [];
  if (!before) types.push(['activity_created', next.studentId]);
  if (previousStudent !== next.studentId) {
    if (previousStudent) types.push(['student_unlinked', previousStudent]);
    if (next.studentId) types.push(['student_linked', next.studentId]);
  }
  if (next.status === 'Feito' && before?.status !== 'Feito') {
    next.completedAt = now;
    next.completedBy = actor.id;
    types.push(['activity_completed', next.studentId]);
  } else if (before?.status === 'Feito' && next.status !== 'Feito') types.push(['activity_reopened', next.studentId]);
  if (archive) {
    next.isArchived = true;
    next.archivedAt = now;
    next.archivedBy = actor.id;
    types.push(['activity_archived', next.studentId || previousStudent]);
  }
  if (before && !types.length) types.push(['activity_updated', next.studentId]);
  const snapshot = JSON.parse(JSON.stringify(next));
  const events = types.map(([eventType, studentId]) => ({
    id: createHash('sha256').update(`${id}:${next.revision}:${eventType}:${studentId}`).digest('hex'),
    activityId: id, studentId, eventType, actorId: actor.id, actorName: actor.name || '',
    occurredAt: now, source: 'Atividades', snapshot: { ...snapshot, studentId },
    previousStudentId: previousStudent, nextStudentId: next.studentId,
  }));
  return { next, events };
}
module.exports = { planActivityChange, studentOf, EVENTS_COLLECTION };
