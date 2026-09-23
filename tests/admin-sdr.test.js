const test = require('node:test');
const assert = require('node:assert/strict');
const { Readable } = require('node:stream');
const { createHandler, __private } = require('../api/admin-sdr');
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
    permissionResolver: async () => ({ ok: true }),
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
  const appPath = require.resolve('../api/app');
  const firestoreAdminPath = require.resolve('../api/_lib/firestore-admin');
  const previousApp = require.cache[appPath];
  const previousFirestoreAdmin = require.cache[firestoreAdminPath];
  require.cache[firestoreAdminPath] = {
    id: firestoreAdminPath,
    filename: firestoreAdminPath,
    loaded: true,
    exports: {
      getDocumentAsAdmin: async () => ({ tipo: 'admin', role: 'admin', isSuperAdmin: true }),
    },
  };
  delete require.cache[appPath];
  const appHandler = require('../api/app');
  const req = Readable.from([]); req.method = 'GET'; req.url = '/api/app?path=admin/comercial/pre-vendas/painel-sdr'; req.headers = { host: 'localhost', cookie: 'space_session=' + createSessionForUser({ id: 'admin', role: 'admin', name: 'Admin', email: 'admin@example.com' }).token };
  let body = ''; const res = { statusCode: 200, setHeader(){}, end(v=''){ body += v; } };
  try {
    await appHandler(req, res);
    assert.equal(res.statusCode, 200);
    assert.match(body, /data-initial-panel="admin-sdr"/);
    assert.match(body, /data-admin-sdr/);
    assert.match(body, /src="admin-sdr\.js"/);
  } finally {
    if (previousApp) require.cache[appPath] = previousApp;
    else delete require.cache[appPath];
    if (previousFirestoreAdmin) require.cache[firestoreAdminPath] = previousFirestoreAdmin;
    else delete require.cache[firestoreAdminPath];
  }
});


test('admin SDR normalizes scored calls from Postgres/N8N payload', () => {
  const call = __private.normalizeScoredCall({
    recording_id: 'rec-1',
    call_leg_id: 'leg-1',
    sdr: 'Ana SDR',
    to_number: '+5534999999999',
    duration_seconds: 92,
    recording_url: 'https://cdn.example/audio.mp3',
    transcript: 'Olá, aqui é a Ana falando da Space.',
    score: 87,
    analysis: {
      summary: 'Boa condução comercial.',
      strengths: ['Rapport claro'],
      weaknesses: ['Explorar dor antes'],
      criteria: [{ name: 'Abertura', score: 90 }],
    },
    created_at: '2026-09-18T13:20:00.000Z',
  });

  assert.equal(call.id, 'rec-1');
  assert.equal(call.status, 'connected');
  assert.equal(call.analysisStatus, 'completed');
  assert.equal(call.sdrName, 'Ana SDR');
  assert.equal(call.phone, '+5534999999999');
  assert.equal(call.durationSeconds, 92);
  assert.equal(call.score, 87);
  assert.equal(call.scriptAdherence, null);
  assert.equal(call.transcript, 'Olá, aqui é a Ana falando da Space.');
  assert.equal(call.scorecard[0].name, 'Abertura');
  assert.equal(call.scorecard[0].score, 90);
});

test('admin SDR buildModel uses scored calls for IA summary without mock data', async () => {
  const model = await __private.buildModel({ period: 'today' }, {
    activity: async () => ({
      events: [],
      sdrs: [{ sdrUid: 's1', sdrName: 'Ana SDR', sdrEmail: 'ana@example.com' }],
    }),
    request: async () => ({ data: [{
      recording_id: 'score-2',
      sdr: 'Ana SDR',
      duration_seconds: 130,
      score: 82,
      created_at: '2026-09-18T12:00:00.000Z',
    }] }),
  });

  assert.equal(model.source.callAnalysis, 'Postgres/sdr_call_scores');
  assert.equal(model.source.scoreRows, 1);
  assert.equal(model.kpis.analyzedCalls, 1);
  assert.equal(model.kpis.avgScore, 82);
  assert.equal(model.sdrs[0].analyzedCalls, 1);
  assert.equal(model.calls.length, 1);
});

test('admin SDR loads transcript and analysis only in recording detail', async () => {
  const calls = [];
  const request = async (path) => {
    calls.push(path);
    if (path.includes('recording_id=eq.rec-detail')) {
      return { data: [{
        recording_id: 'rec-detail',
        call_leg_id: 'leg-detail',
        call_session_id: 'session-detail',
        connection_id: 'conn-detail',
        sdr: 'Ana SDR',
        from_number: '+100',
        to_number: '+200',
        started_at: '2026-09-18T12:00:00.000Z',
        ended_at: '2026-09-18T12:03:00.000Z',
        duration_seconds: 180,
        transcript: 'Transcrição completa',
        score: 91,
        analysis: 'Análise textual completa',
        recording_url: 'https://cdn.example/detail.mp3',
        created_at: '2026-09-18T12:04:00.000Z',
      }] };
    }
    return { data: [{
      recording_id: 'rec-detail',
      sdr: 'Ana SDR',
      to_number: '+200',
      duration_seconds: 180,
      score: 91,
      started_at: '2026-09-18T12:00:00.000Z',
      created_at: '2026-09-18T12:04:00.000Z',
    }] };
  };
  const model = await __private.buildModel({ period: 'today', callId: 'rec-detail' }, {
    activity: async () => ({ events: [], sdrs: [] }),
    request,
  });

  assert.equal(model.calls[0].transcript, '');
  assert.equal(model.calls[0].recording, '');
  assert.equal(model.selectedCall.transcript, 'Transcrição completa');
  assert.equal(model.selectedCall.analysisText, 'Análise textual completa');
  assert.equal(model.selectedCall.recording, 'https://cdn.example/detail.mp3');
  assert.ok(calls.some(path => path.includes('select=recording_id,sdr,to_number,duration_seconds,score,started_at,created_at')));
  assert.ok(calls.some(path => path.includes('select=recording_id,call_leg_id,call_session_id,connection_id,sdr,from_number,to_number,started_at,ended_at,duration_seconds,transcript,score,analysis,recording_url,created_at')));
});

test('calls merge started_at and created_at fallback before paging newest first', async () => {
  const urls = [];
  const result = await __private.loadScoredCalls({ limit: 2, offset: 1, request: async url => {
    urls.push(url);
    return { data: url.includes('started_at=not.is.null') ? [
      { recording_id: 'new', started_at: '2026-09-18T15:00:00Z', created_at: '2026-09-18T16:00:00Z' },
      { recording_id: 'old', started_at: '2026-09-18T12:00:00Z', created_at: '2026-09-18T17:00:00Z' },
    ] : [{ recording_id: 'fallback', started_at: null, created_at: '2026-09-18T14:00:00Z' }] };
  } });
  assert.deepEqual(result.rows.map(row => row.recording_id), ['fallback', 'old']);
  assert.ok(urls.every(url => url.includes('limit=3')));
});
