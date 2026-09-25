const test = require('node:test');
const assert = require('node:assert/strict');
const { Readable } = require('node:stream');
const fs = require('node:fs');
const rest = require.resolve('../api/_lib/supabase-rest');
let lessons = [], saved = new Map(), requests = [], failRead = false;
require.cache[rest] = { exports: { supabaseFetch: async (path, options) => {
  requests.push(path);
  if (path.startsWith('/rpc/')) {
    const row = options.body.p_report;
    const old = saved.get(row.payload.meeting_id);
    const result = { ...row, id: old?.id || saved.size + 1, payload: { ...row.payload,
      transcript: row.payload.transcript || old?.payload.transcript || '' } };
    saved.set(row.payload.meeting_id, result);
    return { data: [result] };
  }
  if (failRead) throw Object.assign(new Error('unavailable'), { code: 'supabase_transport_failed' });
  const q = new URL('https://example.com' + path).searchParams;
  return { data: lessons.filter(l => ['id', 'occurrence_id', 'inicio'].every(k =>
    !q.has(k) || String(l[k]) === q.get(k).slice(3))) };
} } };
const handler = require('../api/integrations/n8n/pedagogical-audit');
const body = { meeting_id: 460, calendar_uid: 'recurring', scheduled_at: '2026-09-25T00:00:00.000Z', analysis: {}, transcript: 'Professor: Olá. Aluno: Hello.' };
const lesson = { id: 101, occurrence_id: 'recurring', inicio: body.scheduled_at, aluno_id: 'student-a', professor_id: 'teacher-a' };
async function post(payload) {
  process.env.N8N_WEBHOOK_SECRET = 'test-secret-at-least-sixteen';
  const req = Readable.from([JSON.stringify(payload)]);
  req.method = 'POST'; req.headers = { 'x-space-webhook-secret': process.env.N8N_WEBHOOK_SECRET };
  let output;
  const res = { setHeader() {}, end(value) { output = JSON.parse(value); } };
  await handler(req, res);
  return { status: res.statusCode, body: output };
}
test.beforeEach(() => { lessons = [lesson]; saved = new Map(); requests = []; failRead = false; });
test('persists actual transcript and deterministic lesson/student/teacher', async () => {
  assert.equal((await post(body)).status, 200);
  const row = saved.get(460);
  assert.equal(row.payload.transcript, body.transcript);
  assert.equal(row.payload.lesson_id, '101');
  assert.equal(row.aluno_id, 'student-a');
  assert.equal(row.payload.professor_id, 'teacher-a');
});
test('duplicate webhook enriches same report and empty retry preserves transcript', async () => {
  await post(body); await post(body); await post({ ...body, transcript: '' });
  assert.equal(saved.size, 1); assert.equal(saved.get(460).payload.transcript, body.transcript);
});
test('missing occurrence stores unlinked transcript without name matching', async () => {
  lessons = [];
  assert.equal((await post({ ...body, student_name_guess: 'Student' })).status, 202);
  assert.equal(saved.get(460).payload.lesson_id, null);
  assert.equal(saved.get(460).aluno_id, null);
  assert.ok(requests.every(p => !p.includes('aluno_nome')));
});
test('recurring calendar UID cannot attach to previous lesson of same student', async () => {
  lessons = [{ ...lesson, id: 100, inicio: '2026-09-24T00:00:00.000Z' }, lesson];
  await post(body); assert.equal(saved.get(460).payload.lesson_id, '101');
});
test('multiple teacher lessons on same day match only exact occurrence', async () => {
  lessons = [lesson, { ...lesson, id: 102, occurrence_id: 'another' }];
  await post(body); assert.equal(saved.get(460).payload.lesson_id, '101');
});
test('ambiguous occurrence and explicit identity conflict fail closed', async () => {
  lessons = [lesson, { ...lesson, id: 102 }];
  assert.equal((await post(body)).status, 202);
  lessons = [lesson];
  assert.equal((await post({ ...body, lesson_id: 101, student_id: 'wrong' })).status, 202);
});
test('infrastructure failure is not disguised as pending success', async () => {
  failRead = true;
  assert.equal((await post(body)).status, 500); assert.equal(saved.size, 0);
});
test('rejects malformed transcript', async () => {
  assert.equal((await post({ ...body, transcript: {} })).status, 400);
});
test('durable idempotency is enforced in SQL; RPC is privileged only', () => {
  const sql = fs.readFileSync('supabase/migrations/20260925041734_pedagogical_transcript_persistence.sql', 'utf8');
  assert.match(sql, /CREATE UNIQUE INDEX/); assert.match(sql, /ON CONFLICT/);
  assert.match(sql, /SECURITY INVOKER/); assert.match(sql, /FROM PUBLIC, anon, authenticated/);
});
test('UI reads persisted reports and escapes transcript without editing teacher data', () => {
  const s = fs.readFileSync('script.js', 'utf8');
  const fn = s.slice(s.indexOf('const renderAdminPedLessonTranscript'), s.indexOf('const renderAdminPedLessonRecordDetail'));
  assert.match(fn, /pedagogicalOps\?\.reports/); assert.match(fn, /String\(row.payload.lesson_id\) === lessonId/);
  assert.match(fn, /escapeHtml\(report.payload.transcript\)/);
});
