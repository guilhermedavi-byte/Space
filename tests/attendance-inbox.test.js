const test = require('node:test');
const assert = require('node:assert/strict');
const { Readable } = require('node:stream');
const { createHandler } = require('../api/attendance-inbox');

async function run({ role = 'admin', uid = 'actor', url = '/api/attendance-inbox', data = { rows: [], teams: [], limit: 50 } } = {}) {
  const calls = [];
  const handler = createHandler({
    authenticate: async () => ({ role, uid }),
    request: async (path, opts) => { calls.push({ path, ...opts }); return { data }; },
  });
  const req = Readable.from([]); req.method = 'GET'; req.url = url;
  let result; const res = { setHeader(){}, end(v){ result = { status: this.statusCode, body: JSON.parse(v) }; } };
  await handler(req, res);
  return { ...result, calls };
}
async function postRun({ role = 'growth', uid = 'agent-1', body, request, sendEvolution } = {}) {
  const calls = [];
  const handler = createHandler({
    authenticate: async () => ({ role, uid }),
    request: async (path, opts) => {
      calls.push({ path, ...opts });
      if (request) return request(path, opts, calls);
      return { data: {} };
    },
    sendEvolution: sendEvolution || (async () => ({ key: { id: 'provider-message' } })),
    resolveProfile: async payload => payload.contact || {},
  });
  const req = Readable.from([JSON.stringify(body || {})]); req.method = 'POST'; req.url = '/api/attendance-inbox';
  let result; const res = { setHeader(){}, end(v){ result = { status: this.statusCode, body: JSON.parse(v) }; } };
  await handler(req, res);
  return { ...result, calls };
}

test('Admin inbox list calls read-only RPC and returns empty state as 200', async () => {
  const r = await run();
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.rows, []);
  assert.equal(r.calls[0].path, '/rpc/attendance_inbox_list');
  assert.equal(r.calls[0].body.p_role, 'admin');
});

test('Growth inbox list keeps actor and role for database isolation', async () => {
  const r = await run({ role: 'growth', uid: 'growth-1', url: '/api/attendance-inbox?filter=mine&q=Maria&limit=99' });
  assert.equal(r.status, 200);
  assert.equal(r.calls[0].body.p_role, 'growth');
  assert.equal(r.calls[0].body.p_actor_uid, 'growth-1');
  assert.equal(r.calls[0].body.p_filters.filter, 'mine');
  assert.equal(r.calls[0].body.p_filters.limit, 50);
});

test('Conversation detail uses detail RPC and does not expose raw sensitive keys', async () => {
  const id = '11111111-1111-4111-8111-111111111111';
  const payload = { conversation: { conversation_id: id }, messages: [{ message_id: 'm1', content: { text: 'Oi' } }], composer: { enabled: false } };
  const r = await run({ url: `/api/attendance-inbox?conversation_id=${id}`, data: payload });
  assert.equal(r.status, 200);
  assert.equal(r.calls[0].path, '/rpc/attendance_inbox_detail');
  assert.equal(r.calls[0].body.p_conversation_id, id);
  assert.doesNotMatch(JSON.stringify(r.body), /fingerprint|raw_event|authorization/i);
});

test('Forbidden roles are rejected before RPC', async () => {
  const r = await run({ role: 'teacher' });
  assert.equal(r.status, 403);
  assert.equal(r.calls.length, 0);
});

test('Conversation detail includes aggregated 360 context from backend resolver', async () => {
  const id = '11111111-1111-4111-8111-111111111111';
  const payload = { conversation: { conversation_id: id, version: 3 }, contact: { phone: '+553499999999' }, participants: [], messages: [] };
  const handler = createHandler({
    authenticate: async () => ({ role: 'admin', uid: 'actor' }),
    request: async (path, opts) => ({ data: path.includes('detail') ? payload : {} }),
    resolveContext: async () => ({ person: { id: 'student-1', name: 'Maria' }, identity: { state: 'linked', linked: true }, actions: { open_person_url: '/app/admin?person=student-1' } }),
  });
  const req = Readable.from([]); req.method = 'GET'; req.url = `/api/attendance-inbox?conversation_id=${id}`;
  let result; const res = { setHeader(){}, end(v){ result = { status: this.statusCode, body: JSON.parse(v) }; } };
  await handler(req, res);
  assert.equal(result.status, 200);
  assert.equal(result.body.context.person.name, 'Maria');
  assert.equal(result.body.context.actions.open_person_url, '/app/admin?person=student-1');
});

test('Manual person link posts identity command through Attendance RPC', async () => {
  const id = '11111111-1111-4111-8111-111111111111';
  const calls = [];
  const handler = createHandler({
    authenticate: async () => ({ role: 'admin', uid: 'actor' }),
    request: async (path, opts) => {
      calls.push({ path, ...opts });
      if (path.includes('detail')) return { data: { conversation: { conversation_id: id, version: 7 }, contact: { phone: '+553499999999' }, participants: [] } };
      return { data: { ok: true } };
    },
    resolveContext: async () => ({ identity: { candidates: [{ id: 'student-1', type: 'student', source: 'firestore', name: 'Maria' }] } }),
  });
  const req = Readable.from([JSON.stringify({ action: 'link_person', conversation_id: id, person_id: 'student-1' })]);
  req.method = 'POST'; req.url = '/api/attendance-inbox'; req.headers = { 'content-type': 'application/json' };
  let result; const res = { setHeader(){}, end(v){ result = { status: this.statusCode, body: JSON.parse(v) }; } };
  await handler(req, res);
  assert.equal(result.status, 200);
  const update = calls.find(call => call.path === '/rpc/attendance_update_conversation');
  assert.equal(update.body.p_command.action, 'identity');
  assert.equal(update.body.p_command.expected_version, 7);
  assert.equal(update.body.p_command.internal_person_id, 'student-1');
});

test('Opening a conversation can persist the read cursor through Attendance RPC', async () => {
  const id = '11111111-1111-4111-8111-111111111111';
  const r = await postRun({ body: { action: 'read', conversation_id: id, sequence: 7 } });
  assert.equal(r.status, 200);
  assert.equal(r.calls[0].path, '/rpc/attendance_mark_read');
  assert.deepEqual(r.calls[0].body, { p_actor_uid: 'agent-1', p_conversation_id: id, p_sequence: 7 });
});

test('Operational actions use detail version and update_conversation RPC', async () => {
  const id = '11111111-1111-4111-8111-111111111111';
  const team = '22222222-2222-4222-8222-222222222222';
  const r = await postRun({
    body: { action: 'update', update: 'resolve', conversation_id: id },
    request: async path => path.includes('detail')
      ? { data: { conversation: { conversation_id: id, version: 3, team: { team_id: team } } } }
      : { data: { conversation_id: id, version: 4 } },
  });
  assert.equal(r.status, 200);
  assert.equal(r.calls[1].path, '/rpc/attendance_update_conversation');
  assert.equal(r.calls[1].body.p_command.action, 'status');
  assert.equal(r.calls[1].body.p_command.status, 'resolved');
  assert.equal(r.calls[1].body.p_command.expected_version, 3);
});

test('Evolution message append, provider send and transport update remain sequenced', async () => {
  const id = '11111111-1111-4111-8111-111111111111';
  const team = '22222222-2222-4222-8222-222222222222';
  const r = await postRun({
    body: { action: 'message', conversation_id: id, text: 'Oi Maria', client_request_id: 'client-1' },
    request: async path => {
      if (path.includes('detail')) return { data: { conversation: { connection: { connection_id: '33333333-3333-4333-8333-333333333333', provider: 'evolution_whatsapp', status: 'active', setup_pending: false, instance_name: 'space-suporte' }, team: { team_id: team } }, contact: { phone: '+553499999999' } } };
      if (path.includes('append')) return { data: { message_id: '44444444-4444-4444-8444-444444444444' } };
      return { data: { ok: true } };
    },
    sendEvolution: async (instance, number, text) => {
      assert.equal(instance, 'space-suporte');
      assert.equal(number, '553499999999');
      assert.equal(text, 'Oi Maria');
      return { key: { id: 'wamid.1' } };
    },
  });
  assert.equal(r.status, 200);
  assert.deepEqual(r.calls.map(call => call.path), ['/rpc/attendance_inbox_detail', '/rpc/attendance_append_message', '/rpc/attendance_set_message_transport']);
  assert.equal(r.calls[2].body.p_status, 'sent');
});

test('Frontend renders empty inbox without an inactive composer', async () => {
  const { JSDOM } = require('jsdom'); const fs = require('fs');
  const dom = new JSDOM('<body data-initial-panel="attendance-inbox"><div data-attendance-inbox></div>', { runScripts: 'outside-only' });
  dom.window.fetchWithAuth = async () => ({ ok: true, json: async () => ({ rows: [], teams: [], limit: 50 }) });
  dom.window.eval(fs.readFileSync('attendance-inbox.js', 'utf8'));
  await new Promise(r => setTimeout(r, 20));
  assert.match(dom.window.document.body.textContent, /Nenhuma conversa encontrada/);
  assert.match(dom.window.document.body.textContent, /Selecione uma conversa/);
  assert.equal(dom.window.document.querySelector('[data-ai-compose]'), null);
  dom.window.close();
});


test('Frontend renders conversation list, chat messages and contact panel from API payload', async () => {
  const { JSDOM } = require('jsdom'); const fs = require('fs');
  const cid = '11111111-1111-4111-8111-111111111111';
  const list = { rows: [{ conversation_id: cid, status: 'open', team: { name: 'Atendimento' }, connection: { provider: 'meta_whatsapp', name: 'Space | Suporte' }, contact: { name: 'Maria', phone: '+553499999999' }, last_message: { text: 'Oi Space', direction: 'inbound' }, last_message_at: '2026-09-17T12:00:00Z', unread_count: 1 }], teams: [{ team_id: '22222222-2222-4222-8222-222222222222', name: 'Atendimento' }] };
  const detail = { conversation: { conversation_id: cid, status: 'open', team: { name: 'Atendimento' }, channel: { name: 'WhatsApp' }, connection: { provider: 'meta_whatsapp', name: 'Space | Suporte' }, last_message_at: '2026-09-17T12:00:00Z' }, contact: { name: 'Maria', phone: '+553499999999', created_at: '2026-09-17T11:00:00Z' }, participants: [], messages: [{ message_id: 'm1', sequence: 1, direction: 'inbound', kind: 'text', content: { text: 'Mensagem recebida' }, transport_status: 'received', received_at: '2026-09-17T12:00:00Z' }], composer: { enabled: false, reason: 'Envio será habilitado após concluir a conexão com a Meta.' } };
  const dom = new JSDOM('<body data-initial-panel="attendance-inbox"><div data-attendance-inbox></div>', { runScripts: 'outside-only' });
  dom.window.fetchWithAuth = async (url) => ({ ok: true, json: async () => String(url).includes('conversation_id') ? detail : list });
  dom.window.eval(fs.readFileSync('attendance-inbox.js', 'utf8'));
  await new Promise(r => setTimeout(r, 20));
  assert.match(dom.window.document.body.textContent, /Maria/);
  dom.window.document.querySelector('[data-ai-select]').click();
  await new Promise(r => setTimeout(r, 20));
  assert.match(dom.window.document.body.textContent, /Mensagem recebida/);
  assert.match(dom.window.document.body.textContent, /\+553499999999/);
  assert.equal(dom.window.document.querySelector('[data-ai-compose]'), null);
  dom.window.close();
});

test('Admin and Growth direct inbox routes render shared panel', async () => {
  const sessionPath = require.resolve('../_lib/session'), appPath = require.resolve('../api/app');
  const firestorePath = require.resolve('../api/_lib/firestore-admin');
  const originalFirestore = require.cache[firestorePath];
  const originalSession = require.cache[sessionPath], originalApp = require.cache[appPath];
  try {
    require.cache[firestorePath] = { id: firestorePath, filename: firestorePath, loaded: true, exports: { getDocumentAsAdmin: async () => ({role:'admin',isSuperAdmin:true}) } };
    for (const role of ['admin', 'growth']) {
      require.cache[sessionPath] = { id: sessionPath, filename: sessionPath, loaded: true, exports: { getSessionFromRequest: () => ({ sub: 'test', role, name: 'Teste' }) } };
      delete require.cache[appPath]; const res = { setHeader(){}, end(body){ this.body = body; } };
      await require('../api/app')({ method: 'GET', headers: { host: 'localhost' }, url: `/api/app?path=${role}/atendimento/caixa-de-entrada` }, res);
      assert.equal(res.statusCode, 200);
      assert.match(res.body, /data-initial-panel="attendance-inbox"/);
      assert.match(res.body, /src="attendance-inbox.js"/);
    }
  } finally {
    if (originalFirestore) require.cache[firestorePath] = originalFirestore; else delete require.cache[firestorePath];
    if (originalSession) require.cache[sessionPath] = originalSession; else delete require.cache[sessionPath];
    if (originalApp) require.cache[appPath] = originalApp; else delete require.cache[appPath];
  }
});
