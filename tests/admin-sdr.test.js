const test = require('node:test');
const assert = require('node:assert/strict');
const { Readable } = require('node:stream');
const { createHandler, __private } = require('../api/admin-sdr');
const appHandler = require('../api/app');
const { createSessionForUser } = require('../_lib/session');

const invoke = async (handler, { method = 'GET', url = '/api/admin-sdr', body } = {}) => {
  const req = body ? Readable.from([JSON.stringify(body)]) : Readable.from([]);
  req.method = method; req.url = url; req.headers = { host: 'localhost' };
  let result = '';
  const headers = {};
  const res = { statusCode: 200, setHeader(k,v){ headers[k.toLowerCase()] = v; }, end(v=''){ result += v; } };
  await handler(req, res);
  return { status: res.statusCode, headers, body: result ? JSON.parse(result) : null };
};

test('admin SDR API builds real operational model without mock metrics', async () => {
  const handler = createHandler({
    authResolver: async () => ({ ok: true, session: { role: 'admin', sub: 'admin' } }),
    build: async () => ({ ok: true, source: { usesMockData: false }, kpis: { totalCalls: 2 }, sdrs: [{ uid: 's1', name: 'SDR' }], calls: [] }),
  });
  const res = await invoke(handler);
  assert.equal(res.status, 200);
  assert.equal(res.body.source.usesMockData, false);
  assert.equal(res.body.kpis.totalCalls, 2);
});

test('admin SDR API rejects non-admin users', async () => {
  const handler = createHandler({ authResolver: async () => ({ ok: true, session: { role: 'growth', sub: 'g' } }) });
  const res = await invoke(handler);
  assert.equal(res.status, 403);
});

test('range resolver covers requested date filters', () => {
  const now = new Date('2026-09-18T15:00:00-03:00');
  assert.deepEqual(__private.resolveRange({ period: 'today', now }), { period: 'today', fromKey: '2026-09-18', toKey: '2026-09-18' });
  assert.deepEqual(__private.resolveRange({ period: 'yesterday', now }), { period: 'yesterday', fromKey: '2026-09-17', toKey: '2026-09-17' });
  assert.deepEqual(__private.resolveRange({ period: 'last7', now }), { period: 'last7', fromKey: '2026-09-12', toKey: '2026-09-18' });
});

test('admin SDR route boots the dedicated panel and script', async () => {
  const req = Readable.from([]); req.method = 'GET'; req.url = '/api/app?path=admin/comercial/pre-vendas/painel-sdr'; req.headers = { host: 'localhost', cookie: 'space_session=' + createSessionForUser({ id: 'admin', role: 'admin', name: 'Admin', email: 'admin@example.com' }).token };
  let body = ''; const res = { statusCode: 200, setHeader(){}, end(v=''){ body += v; } };
  await appHandler(req, res);
  assert.equal(res.statusCode, 200);
  assert.match(body, /data-initial-panel="admin-sdr"/);
  assert.match(body, /data-admin-sdr/);
  assert.match(body, /src="admin-sdr\.js"/);
});


test('admin SDR normalizes scored calls from Postgres/N8N payload', () => {
  const call = __private.normalizeScoredCall({
    id: 'score-1',
    recording_id: 'rec-1',
    call_leg_id: 'leg-1',
    sdr_name: 'Ana SDR',
    lead_name: 'Lead Exemplo',
    phone: '+5534999999999',
    duration_seconds: 92,
    recording_url: 'https://cdn.example/audio.mp3',
    transcription: 'Olá, aqui é a Ana falando da Space.',
    score: 87,
    script_adherence: 91,
    status: 'completed',
    outcome: 'agendamento',
    analysis: {
      summary: 'Boa condução comercial.',
      strengths: ['Rapport claro'],
      weaknesses: ['Explorar dor antes'],
      criteria: [{ name: 'Abertura', score: 90 }],
    },
    created_at: '2026-09-18T13:20:00.000Z',
  });

  assert.equal(call.id, 'score-1');
  assert.equal(call.status, 'connected');
  assert.equal(call.analysisStatus, 'completed');
  assert.equal(call.sdrName, 'Ana SDR');
  assert.equal(call.leadName, 'Lead Exemplo');
  assert.equal(call.durationSeconds, 92);
  assert.equal(call.score, 87);
  assert.equal(call.scriptAdherence, 91);
  assert.equal(call.transcript, 'Olá, aqui é a Ana falando da Space.');
  assert.equal(call.scorecard[0].name, 'Abertura');
  assert.equal(call.scorecard[0].score, 90);
});
