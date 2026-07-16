#!/usr/bin/env node
/*
  Audita e, com --apply, encerra classes recorrentes ativas sem nenhuma ocorrência futura ativa em aulas.

  Uso:
    node --env-file=.env.local scripts/cleanup-orphan-classes.js
    CLEANUP_ORPHAN_CLASSES_CONFIRM=sim node --env-file=.env.local scripts/cleanup-orphan-classes.js --apply

  Segurança:
    - Dry-run por padrão.
    - --apply exige CLEANUP_ORPHAN_CLASSES_CONFIRM=sim.
    - Não apaga documentos; marca classes como ended/inactive com motivo de limpeza.
*/
const { commitWritesAsAdmin, listCollectionAsAdmin } = require('../api/_lib/firestore-admin');
const { encodeFields } = require('../_lib/firestore-rest');
const { isValidDateKey, timeToMinutes } = require('../_lib/scheduling-utils');

const APPLY = process.argv.includes('--apply');
const CONFIRMED = String(process.env.CLEANUP_ORPHAN_CLASSES_CONFIRM || '').trim().toLowerCase() === 'sim';

const toFirestoreDocName = (docPath) => {
  const { FIRESTORE_BASE } = require('../_lib/firestore-rest');
  const path = String(docPath || '').replace(/^\/+/, '');
  return `${FIRESTORE_BASE.replace(/\/documents$/, '')}/documents/${path}`;
};

const normalizeClassStatus = (value) => {
  const raw = String(value || '').trim().toLowerCase();
  if (['ended', 'encerrada', 'encerrado', 'inactive', 'inativa', 'inativo', 'cancelada', 'cancelado', 'deleted'].includes(raw)) return 'ended';
  if (['paused', 'pausada', 'pausado'].includes(raw)) return 'paused';
  return 'active';
};

const hiddenAulaStatus = (value) => {
  const raw = String(value || '').trim().toLowerCase();
  return ['cancelada', 'cancelado', 'cancelled', 'canceled', 'deleted', 'ended', 'inactive'].includes(raw);
};

const parseMinutes = (value, fallback) => {
  const n = Number(value);
  if (Number.isFinite(n)) return n;
  const parsed = timeToMinutes(fallback);
  return Number.isFinite(parsed) ? parsed : null;
};

const formatHm = (minutes) => {
  const n = Number(minutes);
  if (!Number.isFinite(n)) return '';
  const h = String(Math.floor(n / 60)).padStart(2, '0');
  const m = String(n % 60).padStart(2, '0');
  return `${h}:${m}`;
};

const dayLabel = (weekday) => ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][Number(weekday)] || String(weekday);

const classWindows = (row) => {
  const scheduleDays = Array.isArray(row.scheduleDays) ? row.scheduleDays : [];
  if (scheduleDays.length) {
    return scheduleDays
      .filter((day) => day && day.enabled !== false)
      .map((day) => ({
        weekday: Number(day.weekday),
        startMin: parseMinutes(day.startMin, day.startTime),
        endMin: parseMinutes(day.endMin, day.endTime),
      }))
      .filter((day) => Number.isFinite(day.weekday) && Number.isFinite(day.startMin) && Number.isFinite(day.endMin));
  }
  const days = Array.isArray(row.daysOfWeek) ? row.daysOfWeek : [];
  return days
    .map((weekday) => ({
      weekday: Number(weekday),
      startMin: parseMinutes(row.startMin, row.horaInicio),
      endMin: parseMinutes(row.endMin, row.horaFim),
    }))
    .filter((day) => Number.isFinite(day.weekday) && Number.isFinite(day.startMin) && Number.isFinite(day.endMin));
};

const classMatchesEvent = (classRow, eventRow) => {
  const groupId = String(classRow.linkedEventGroupId || classRow.grupoRecorrenciaId || classRow.id || '').trim();
  const eventGroupId = String(eventRow.grupoRecorrenciaId || '').trim();
  if (groupId && eventGroupId && groupId === eventGroupId) return true;
  const linkedEventIds = new Set((Array.isArray(classRow.linkedEventIds) ? classRow.linkedEventIds : []).map((id) => String(id || '').trim()).filter(Boolean));
  if (linkedEventIds.has(String(eventRow.id || '').trim())) return true;
  return false;
};

const main = async () => {
  if (APPLY && !CONFIRMED) throw new Error('missing_confirmation');
  const todayKey = new Date().toISOString().slice(0, 10);
  const [classes, aulas] = await Promise.all([
    listCollectionAsAdmin('classes', { pageSize: 2000 }),
    listCollectionAsAdmin('aulas', { pageSize: 2000 }),
  ]);
  const futureAulas = aulas.filter((row) => {
    const dateKey = String(row.dateKey || '').trim();
    return isValidDateKey(dateKey) && dateKey >= todayKey && !hiddenAulaStatus(row.status);
  });
  const orphans = classes
    .filter((row) => normalizeClassStatus(row.status) === 'active')
    .filter((row) => !futureAulas.some((eventRow) => classMatchesEvent(row, eventRow)))
    .map((row) => {
      const windows = classWindows(row);
      const days = windows.map((day) => dayLabel(day.weekday)).join(', ');
      const first = windows[0] || {};
      const horario = Number.isFinite(first.startMin) && Number.isFinite(first.endMin) ? `${formatHm(first.startMin)}-${formatHm(first.endMin)}` : '';
      const studentNames = Array.isArray(row.studentNames) ? row.studentNames.filter(Boolean).join(', ') : '';
      return {
        classId: String(row.firestoreDocId || row.id || '').trim(),
        professor: String(row.teacherName || row.professorNome || row.teacherId || row.professorId || '').trim(),
        aluno: studentNames || String(row.studentName || row.alunoNome || '').trim(),
        dias: days,
        horario,
        startDate: String(row.startDate || '').trim(),
        endDate: String(row.endDate || '').trim(),
        linkedEventGroupId: String(row.linkedEventGroupId || row.grupoRecorrenciaId || '').trim(),
      };
    })
    .filter((row) => row.classId);

  console.log(JSON.stringify({ dryRun: !APPLY, todayKey, totalClasses: classes.length, totalAulas: aulas.length, futureAulas: futureAulas.length, candidates: orphans }, null, 2));

  if (!APPLY || !orphans.length) return;
  const now = new Date();
  const writes = orphans.map((row) => {
    const patch = {
      status: 'ended',
      active: false,
      deletedAt: now,
      updatedAt: now,
      cleanupReason: 'active_class_without_future_aula',
    };
    return {
      update: { name: toFirestoreDocName(`classes/${encodeURIComponent(row.classId)}`), fields: encodeFields(patch).fields },
      updateMask: { fieldPaths: Object.keys(patch) },
    };
  });
  const commit = await commitWritesAsAdmin({ writes });
  if (!commit.ok) {
    console.error(JSON.stringify({ ok: false, status: commit.status, data: commit.data || commit.text || null }, null, 2));
    process.exit(1);
  }
  console.log(JSON.stringify({ ok: true, updated: writes.length, classIds: orphans.map((row) => row.classId) }, null, 2));
};

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error.message, code: error.code || '', status: error.status || null }, null, 2));
  process.exit(1);
});
