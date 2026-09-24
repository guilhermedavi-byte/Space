const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { randomUUID } = require('node:crypto');
const eventsModule = require('../api/_lib/activity-events');
function app() {
  let version = 0;
  const docs = new Map([
    ['users/student-a', { fields: { tipo: 'student', nome: 'João', email: 'joao@test.com' }, updateTime: '0' }],
    ['users/student-b', { fields: { tipo: 'student', nome: 'Maria' }, updateTime: '0' }],
    ['users/admin', { fields: { tipo: 'admin', nome: 'Admin' }, updateTime: '0' }],
  ]);
  const commits = [];
  const requestJson = async (url, options = {}) => {
    if (url.endsWith(':commit')) {
      const writes = options.body.writes;
      for (const write of writes) {
        const key = write.update.name.split('/documents/')[1], old = docs.get(key);
        if (write.currentDocument.exists === false && old || write.currentDocument.updateTime && old?.updateTime !== write.currentDocument.updateTime) return { ok: false, status: 409 };
      }
      commits.push(writes);
      for (const write of writes) docs.set(write.update.name.split('/documents/')[1], { fields: JSON.parse(JSON.stringify(write.update.fields)), updateTime: String(++version) });
      return { ok: true, status: 200, data: {} };
    }
    if (url.endsWith(':runQuery')) {
      const query = options.body.structuredQuery;
      const filters = query.where.compositeFilter?.filters || [query.where];
      return { ok: true, data: [...docs].filter(([key, doc]) => key.startsWith(query.from[0].collectionId + '/') && filters.some(filter => doc.fields[filter.fieldFilter.field.fieldPath] === filter.fieldFilter.value.stringValue)).map(([key, doc]) => ({ document: { ...doc, name: `projects/p/databases/(default)/documents/${key}` } })) };
    }
    assert.notEqual(options.method, 'DELETE', 'never hard delete history');
    const key = url.split('/documents/')[1];
    const doc = docs.get(key);
    return doc ? { ok: true, data: { ...doc, name: key } } : { ok: false, status: 404 };
  };
  const mocks = {
    './_lib/retention-activity-health': require('../api/_lib/retention-activity-health'),
    'node:crypto': { randomUUID }, './_lib/activity-events': eventsModule,
    '../_lib/google-service-account': { getGoogleAccessToken: async () => ({ accessToken: 'fake' }) },
    './_lib/http': { readJsonBody: async req => req.body, sendJson: (res, status, body) => Object.assign(res, { status, body }) },
    './_lib/session': { getSessionFromRequest: req => req.session || { role: 'admin', sub: 'admin', nome: 'Admin' } },
    './_lib/admin-permissions': { requireAdminPermission: async () => ({ ok: true }) },
    './_lib/notification-service': {
      buildActivityCommentNotifications: () => [],
      buildActivityMutationNotifications: () => [],
      buildChecklistAssignmentNotifications: () => [],
      buildChecklistCompletedNotifications: () => [],
      commitNotifications: async () => ({ ok: true }),
      resolveCommentMentions: () => [],
    },
    './_lib/firestore-admin': { listCollectionAsAdmin: async collection => [...docs].filter(([key]) => key.split('/')[0] === collection).map(([key, doc]) => ({ ...doc.fields, id: key.split('/')[1], firestoreDocId: key.split('/')[1] })) },
    './_lib/firestore-rest': { FIRESTORE_BASE: 'https://firestore.googleapis.com/v1/projects/p/databases/(default)/documents', decodeFields: doc => doc.fields, encodeFields: fields => ({ fields }), getDocIdFromName: name => name.split('/').pop(), requestJson },
  };
  const context = { module: { exports: {} }, require: name => { if (!(name in mocks)) throw Error(name); return mocks[name]; }, URL, URLSearchParams, console: { error() {} } };
  vm.runInNewContext(fs.readFileSync(require.resolve('../api/activities'), 'utf8'), context);
  const call = async (method, query = '', body = {}, session) => { const res = { setHeader() {} }; await context.module.exports({ method, url: `/api/activities${query}`, headers: { host: 'space.test' }, body, session }, res); return res; };
  return { docs, commits, call, events: () => [...docs].filter(([key]) => key.startsWith('activity_events/')).map(([,doc]) => doc.fields) };
}
async function create(a) { const r = await a.call('POST', '', { titulo: 'Contato', studentId: 'student-a', descricao: 'Ausência nas aulas', observacoes: 'Mudança de turno', comment: 'Retornar amanhã', responsavelId: 'admin', prazo: '2026-09-25' }); assert.equal(r.status, 201); return r.body.activity; }

test('Caso 1: vínculo canônico validado, pendente visível, diretório student e troca auditada', async () => {
  const a = app(), row = await create(a);
  let result = await a.call('GET', '?studentId=student-a');
  assert.equal(result.body.activities[0].studentId, 'student-a'); assert.equal(result.body.activities[0].status, 'Pendente');
  assert.equal(result.body.students.length, 2);
  assert.equal((await a.call('POST', '', { titulo: 'Inválido', studentId: 'admin' })).status, 400);
  assert.equal((await a.call('POST', '', { titulo: 'Inválido', studentId: 'missing' })).status, 400);
  await a.call('PATCH', `?id=${row.id}`, { studentId: 'student-b' });
  result = await a.call('GET', '?studentId=student-a');
  assert.equal(result.body.activities.length, 0); assert.ok(result.body.events.some(e => e.eventType === 'student_unlinked'));
  assert.equal((await a.call('GET', '?studentId=student-b')).body.activities.length, 1);
});
test('Caso 2: conclusão atômica, snapshot completo, retry sem duplicação e duas timelines', async () => {
  const a = app(), row = await create(a);
  const responses = await Promise.all([a.call('PATCH', `?id=${row.id}`, { status: 'Feito' }), a.call('PATCH', `?id=${row.id}`, { status: 'Feito' })]);
  assert.ok(responses.some(r => r.status === 200));
  await a.call('PATCH', `?id=${row.id}`, { status: 'Feito' });
  const events = a.events().filter(e => e.eventType === 'activity_completed'); assert.equal(events.length, 1);
  const completed = events[0]; assert.ok(completed.snapshot.completedAt); assert.equal(completed.snapshot.completedBy, 'admin');
  assert.equal(completed.snapshot.descricao, 'Ausência nas aulas'); assert.equal(completed.snapshot.observacoes, 'Mudança de turno'); assert.equal(completed.snapshot.comentarios[0].text, 'Retornar amanhã');
  assert.ok(a.commits.some(writes => writes.some(w => w.update.fields.eventType === 'activity_completed') && writes.some(w => w.update.fields.status === 'Feito')));
  const source = fs.readFileSync(require.resolve('../script.js'), 'utf8');
  const helpers = source.slice(source.indexOf('const STUDENT_PROFILE_TABS ='), source.indexOf('const renderStudentSheetInto ='));
  const retention = source.slice(source.indexOf('const renderAdminStudentRetentionTimelineHtml ='), source.indexOf('const loadAdminStudentRetentionTimeline ='));
  const ctx = { escapeHtml: value => String(value ?? ''), formatAdminDate: x => x, formatAdminHistoryStamp: x => x, isRetentionV2FeatureEnabled: () => false };
  const ui = vm.runInNewContext(helpers + retention + ';({getStudentProfileJourney,renderAdminStudentRetentionTimelineHtml})', ctx);
  const hist = { profileResources: { activities: { events: [completed], rows: [row] } } };
  assert.ok(ui.getStudentProfileJourney(hist).some(e => e.title.includes('Atividade concluída') && e.date === completed.occurredAt));
  assert.match(ui.renderAdminStudentRetentionTimelineHtml({ hist }), /Atividade concluída.*Contato/); assert.match(ui.renderAdminStudentRetentionTimelineHtml({ hist }), /Mudança de turno/);
});
test('Caso 3: editar depois de concluir preserva snapshot e comentários anteriores', async () => {
  const a = app(), row = await create(a); await a.call('PATCH', `?id=${row.id}`, { status: 'Feito' });
  const snapshot = JSON.stringify(a.events().find(e => e.eventType === 'activity_completed'));
  await a.call('PATCH', `?id=${row.id}`, { descricao: 'Nova descrição', comment: 'Novo comentário', responsavelId: '' });
  assert.equal(JSON.stringify(a.events().find(e => e.eventType === 'activity_completed')), snapshot);
  assert.equal(a.docs.get(`activities/${row.id}`).fields.comentarios.length, 2);
});
test('Caso 4: exclusão arquiva, mantém documento/eventos, some da lista operacional', async () => {
  const a = app(), row = await create(a); await a.call('PATCH', `?id=${row.id}`, { status: 'Feito' });
  assert.equal((await a.call('DELETE', `?id=${row.id}`)).status, 200);
  assert.ok(a.docs.get(`activities/${row.id}`).fields.isArchived); assert.ok(a.events().some(e => e.eventType === 'activity_archived'));
  assert.equal((await a.call('GET')).body.activities.length, 0); assert.equal((await a.call('GET', '?studentId=student-a')).body.activities.length, 1);
  assert.ok(a.events().some(e => e.eventType === 'activity_completed'));
});
test('Caso 5: reabrir preserva última conclusão, evento anterior e permissões', async () => {
  const a = app(), row = await create(a); await a.call('PATCH', `?id=${row.id}`, { status: 'Feito' });
  const stamp = a.docs.get(`activities/${row.id}`).fields.completedAt;
  const reopened = await a.call('PATCH', `?id=${row.id}`, { status: 'Pendente' });
  assert.equal(reopened.body.activity.completedAt, stamp); assert.equal(reopened.body.activity.status, 'Pendente');
  assert.ok(a.events().some(e => e.eventType === 'activity_completed')); assert.ok(a.events().some(e => e.eventType === 'activity_reopened'));
  assert.equal((await a.call('PATCH', `?id=${row.id}`, { status: 'Feito' }, { role: 'teacher', sub: 'outsider' })).status, 403);
});
