const test = require('node:test');
const assert = require('node:assert/strict');
const { Readable } = require('node:stream');
const { createHandler } = require('../api/attendance-connections/meta-embedded-signup');

const cid = '11111111-1111-4111-8111-111111111111';
const tid = '22222222-2222-4222-8222-222222222222';

const runHandler = async ({ body, graph, request, role = 'admin' } = {}) => {
  const calls = [];
  const handler = createHandler({
    authenticate: async () => ({ role, uid: 'actor' }),
    checkEnvironment: () => {},
    environment: () => ({ appId: '1026298976506797', appSecret: 'x'.repeat(32) }),
    graph: async (...args) => { calls.push({ kind: 'graph', args }); return graph ? graph(...args) : {}; },
    request: async (...args) => { calls.push({ kind: 'rpc', args }); return request ? request(...args) : { data: { ok: true } }; },
  });
  const req = Readable.from([JSON.stringify(body || {})]); req.method = 'POST'; req.url = '/api/attendance-connections/meta-embedded-signup';
  let result; const res = { setHeader(){}, end(v){ result = { status: this.statusCode, body: JSON.parse(v) }; } };
  await handler(req, res);
  return { ...result, calls };
};

test('Server exchanges authorization code and updates existing connection through RPC only', async () => {
  const r = await runHandler({
    body: { connection_id: cid, code: 'AUTH_CODE_ONLY_TO_BACKEND', state: 'state-1', session: { data: { waba_id: '930157746803742', phone_number_id: '1298764056655056' } } },
    graph: async (path) => {
      if (path === '/oauth/access_token') return { access_token: 'SERVER_SIDE_TOKEN' };
      if (path === '/930157746803742/phone_numbers') return { data: [{ id: '1298764056655056', display_phone_number: '+55 34 9825-7677', verified_name: 'Space' }] };
      if (path === '/930157746803742') return { id: '930157746803742', name: 'Space' };
      throw new Error(path);
    },
  });
  assert.equal(r.status, 200);
  const rpc = r.calls.find(c => c.kind === 'rpc');
  assert.equal(rpc.args[0], '/rpc/attendance_complete_meta_embedded_signup');
  assert.equal(rpc.args[1].body.p_connection_id, cid);
  assert.equal(rpc.args[1].body.p_waba_id, '930157746803742');
  assert.equal(rpc.args[1].body.p_phone_number_id, '1298764056655056');
  assert.equal(rpc.args[1].body.p_actor_uid, 'actor');
  assert.equal(rpc.args[1].body.p_role, 'admin');
  assert.doesNotMatch(JSON.stringify(r.body), /AUTH_CODE_ONLY_TO_BACKEND|SERVER_SIDE_TOKEN/);
});

test('Server rejects asset mismatch without updating connection', async () => {
  const r = await runHandler({
    body: { connection_id: cid, code: 'code', state: 'state-1', session: { waba_id: 'waba', phone_number_id: 'missing' } },
    graph: async (path) => path === '/oauth/access_token' ? { access_token: 'token' } : { data: [{ id: 'other' }] },
  });
  assert.equal(r.status, 403);
  assert.equal(r.calls.some(c => c.kind === 'rpc'), false);
});

async function renderConnections(payload) {
  const { JSDOM } = require('jsdom'); const fs = require('fs');
  const dom = new JSDOM('<body data-initial-panel="attendance-connections"><div data-attendance-connections></div>', { runScripts: 'outside-only', url: 'https://plataforma.spaceschoolbr.com/app/admin/atendimento/conexoes' });
  const calls = [];
  dom.window.fetchWithAuth = async (url, opts) => { calls.push({ url, opts }); return { ok: true, json: async () => payload }; };
  dom.window.HTMLDialogElement.prototype.showModal = function(){ this.open = true; };
  dom.window.eval(fs.readFileSync('attendance-connections.js', 'utf8'));
  await new Promise(r => setTimeout(r, 20));
  return { dom, calls };
}

test('Pending connection shows Embedded Signup CTA in card and details', async () => {
  const payload = { permissions: { create: true, technical: true }, teams: [{ team_id: tid, name: 'Atendimento' }], create_teams: [{ team_id: tid, name: 'Atendimento' }], items: [{ connection_id: cid, name: 'Space | Suporte', provider: 'meta_whatsapp', status: 'pending', setup_pending: true, draft_team_id: tid, channels: [], can_edit: true }] };
  const { dom } = await renderConnections(payload);
  assert.match(dom.window.document.body.textContent, /Concluir configuração Meta/);
  dom.window.document.querySelector('[data-ac-details]').click();
  assert.match(dom.window.document.body.textContent, /Conecte a conta e o número do WhatsApp Business pela Meta/);
  assert.equal(dom.window.document.querySelectorAll('[data-ac-meta]').length >= 2, true);
  dom.window.close();
});

test('Non-pending connection does not show Embedded Signup CTA', async () => {
  const payload = { permissions: { create: true, technical: true }, teams: [{ team_id: tid, name: 'Atendimento' }], create_teams: [{ team_id: tid, name: 'Atendimento' }], items: [{ connection_id: cid, name: 'Space | Suporte', provider: 'meta_whatsapp', status: 'active', setup_pending: false, channels: [{ external_channel_id: '+55 34 9825-7677', default_team_id: tid }], can_edit: true }] };
  const { dom } = await renderConnections(payload);
  assert.doesNotMatch(dom.window.document.body.textContent, /Concluir configuração Meta/);
  dom.window.close();
});

test('Cancelled Meta signup does not call backend completion endpoint', async () => {
  const payload = { permissions: { create: true, technical: true }, teams: [{ team_id: tid, name: 'Atendimento' }], create_teams: [{ team_id: tid, name: 'Atendimento' }], items: [{ connection_id: cid, name: 'Space | Suporte', provider: 'meta_whatsapp', status: 'pending', setup_pending: true, draft_team_id: tid, channels: [], can_edit: true }] };
  const { dom, calls } = await renderConnections(payload);
  dom.window.FB = { login: cb => cb({}) };
  dom.window.document.querySelector('[data-ac-meta]').click();
  await new Promise(r => setTimeout(r, 30));
  assert.equal(calls.some(c => String(c.url).includes('meta-embedded-signup')), false);
  assert.match(dom.window.document.body.textContent, /Configuração Meta cancelada/);
  dom.window.close();
});
