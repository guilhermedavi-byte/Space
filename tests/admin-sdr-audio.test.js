const test = require('node:test');
const assert = require('node:assert/strict');
const { Readable } = require('node:stream');
const { createHandler, _private } = require('../api/admin/sdr/calls/[recordingId]/audio');

const invoke = async (handler, { url = '/api/admin/sdr/calls/rec_123/audio', method = 'GET' } = {}) => {
  const req = Readable.from([]);
  req.method = method;
  req.url = url;
  req.headers = { host: 'localhost' };
  let body = '';
  const headers = {};
  const res = { statusCode: 200, setHeader(k, v) { headers[k.toLowerCase()] = v; }, end(v = '') { body += v; } };
  await handler(req, res);
  let json = null;
  try { json = body ? JSON.parse(body) : null; } catch {}
  return { status: res.statusCode, headers, body, json };
};

test('SDR audio endpoint redirects to a fresh Telnyx mp3 URL', async () => {
  const old = process.env.TELNYX_API_KEY;
  process.env.TELNYX_API_KEY = 'secret-test';
  const calls = [];
  const handler = createHandler({
    authResolver: async () => ({ ok: true, session: { role: 'admin', sub: 'admin' } }),
    telnyxFetch: async (url, options) => {
      calls.push({ url, options });
      return { ok: true, json: async () => ({ data: { download_urls: { mp3: 'https://audio.example/fresh.mp3' } } }) };
    },
  });
  const res = await invoke(handler);
  process.env.TELNYX_API_KEY = old;

  assert.equal(res.status, 307);
  assert.equal(res.headers.location, 'https://audio.example/fresh.mp3');
  assert.equal(res.headers['cache-control'], 'no-store');
  assert.equal(calls[0].url, 'https://api.telnyx.com/v2/recordings/rec_123');
  assert.equal(calls[0].options.headers.Authorization, 'Bearer secret-test');
});

test('SDR audio endpoint fails closed when Telnyx key is missing', async () => {
  const old = process.env.TELNYX_API_KEY;
  delete process.env.TELNYX_API_KEY;
  const handler = createHandler({ authResolver: async () => ({ ok: true, session: { role: 'admin', sub: 'admin' } }) });
  const res = await invoke(handler);
  process.env.TELNYX_API_KEY = old;
  assert.equal(res.status, 503);
  assert.equal(res.json.error, 'telnyx_not_configured');
  assert.equal(res.headers['cache-control'], 'no-store');
});

test('SDR audio endpoint requires admin auth', async () => {
  const handler = createHandler({ authResolver: async () => ({ ok: true, session: { role: 'growth', sub: 'g' } }) });
  const res = await invoke(handler);
  assert.equal(res.status, 403);
});

test('SDR audio endpoint sanitizes recording id from the route', () => {
  const req = { headers: { host: 'localhost' }, url: '/api/admin/sdr/calls/rec_123-%24bad/audio' };
  assert.equal(_private.extractRecordingId(req), 'rec_123-24bad');
});

test('audio JSON mode accepts existing Production env and never returns the API key', async () => {
  const saved = { ...process.env };
  delete process.env.TELNYX_API_KEY;
  delete process.env.TELNYX_API_TOKEN;
  process.env.Telnyx = 'private-production-key';
  try {
    const handler = createHandler({
      authResolver: async () => ({ ok: true, session: { role: 'admin' } }),
      telnyxFetch: async (_url, options) => {
        assert.equal(options.headers.Authorization, 'Bearer private-production-key');
        return { ok: true, json: async () => ({ data: { download_urls: { mp3: 'https://audio.example/fresh.mp3' } } }) };
      },
    });
    const res = await invoke(handler, { url: '/api/admin/sdr/calls/rec_123/audio?format=json' });
    assert.equal(res.status, 200);
    assert.deepEqual(res.json, { url: 'https://audio.example/fresh.mp3' });
    assert.ok(!res.body.includes('private-production-key'));
  } finally { process.env = saved; }
});

test('unauthenticated audio request never calls Telnyx', async () => {
  const res = await invoke(createHandler({ authResolver: async () => ({ ok: false, status: 401, body: { error: 'unauthenticated' } }), telnyxFetch: () => { throw new Error('must not call'); } }));
  assert.equal(res.status, 401);
});
