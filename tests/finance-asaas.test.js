const test = require('node:test');
const assert = require('node:assert/strict');
const { createAsaasClient } = require('../api/_lib/asaas');
const cfg = { baseUrl: 'https://api-sandbox.asaas.com/v3', apiKey: 'test-private-key' };
const client = (fetchImpl, config = cfg, options = {}) => createAsaasClient({ config: () => config, fetchImpl, ...options });
test('Asaas health: missing key performs no request', async () => {
  const h = await client(() => { throw Error('must not call'); }, { ...cfg, apiKey: '' }).checkAsaasConnection();
  assert.equal(h.configured, false); assert.equal(h.error.code, 'asaas_not_configured');
});
test('Asaas health: validates account response without exposing secret', async () => {
  const c = client(async (url, opts) => { assert.equal(opts.headers.access_token, cfg.apiKey); assert.equal(opts.redirect, 'error');
    assert.ok(url.endsWith('/myAccount/accountNumber')); return new Response(JSON.stringify({ agency: '0001', account: '123', accountDigit: '4' })); });
  const h = await c.checkAsaasConnection(); assert.equal(h.account_accessible, true); assert.equal(h.environment, 'sandbox');
  assert.ok(!JSON.stringify(h).includes(cfg.apiKey));
});
test('Asaas remote errors are sanitized, including body and thrown network details', async () => {
  const h = await client(async () => new Response(JSON.stringify({ errors: [{ description: cfg.apiKey }] }), { status: 401 })).checkAsaasConnection();
  assert.equal(h.error.code, 'asaas_unauthorized'); assert.ok(!JSON.stringify(h).includes(cfg.apiKey));
  await assert.rejects(client(async () => { throw Error(cfg.apiKey); }).request('/payments'), { message: 'asaas_unreachable' });
});
test('Asaas transport: verbs, JSON, timeout, redirect/path restrictions', async () => {
  const calls = [];
  const c = client(async (url, o) => { calls.push(o.method); return new Response('{"ok":true}'); });
  for (const method of ['GET', 'POST', 'PUT', 'DELETE']) await c.request('/payments/pay_test', { method });
  assert.deepEqual(calls, ['GET', 'POST', 'PUT', 'DELETE']);
  await assert.rejects(c.request('/payments', { method: 'PATCH' }), /method_invalid/);
  await assert.rejects(c.request('//evil.test'), /path_invalid/);
  await assert.rejects(client(async () => new Response('secret')).request('/payments'), /invalid_response/);
  await assert.rejects(client(async (_, o) => new Promise((_, reject) => o.signal.addEventListener('abort', () => reject(Error('secret')))), cfg,
    { timeoutMs: 10 }).request('/payments'), /asaas_timeout/);
});
test('Asaas pagination follows hasMore and rejects non-progress', async () => {
  const urls=[]; const c=client(async (u)=>{urls.push(u); return new Response(JSON.stringify({data:urls.length===1?[{id:'a'},{id:'b'}]:[{id:'c'}],hasMore:urls.length===1}));});
  const rows=[]; for await(const p of c.pages('payments',{limit:2})) rows.push(...p.data);
  assert.equal(rows.length,3); assert.ok(urls[1].includes('offset=2'));
  await assert.rejects(async()=>{for await(const p of client(async()=>new Response('{"data":[],"hasMore":true}')).pages('payments')) void p;}, /pagination_invalid/);
});
