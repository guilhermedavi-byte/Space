const test = require('node:test');
const assert = require('node:assert/strict');
const { supabaseFetch } = require('../api/_lib/supabase-rest');

const key = 'sb_secret_synthetic_credential_for_tests_only';
const withConfig = async (fn) => {
  const previous = { ...process.env }, previousFetch = global.fetch;
  try {
    process.env.APP_ENV = 'production';
    process.env.SUPABASE_URL = 'https://example.invalid';
    process.env.SUPABASE_SERVICE_ROLE_KEY = key;
    delete process.env.SPACE_STAGING_SUPABASE_URL;
    await fn();
  } finally {
    global.fetch = previousFetch;
    for (const name of Object.keys(process.env)) if (!(name in previous)) delete process.env[name];
    Object.assign(process.env, previous);
  }
};

test('service role: redirects bloqueados; credencial refletida removida até de respostas de sucesso', async () => withConfig(async () => {
  global.fetch = async (_url, options) => {
    assert.equal(options.redirect, 'error');
    assert.equal(options.headers.apikey, key);
    return { ok: true, status: 200, text: async () => JSON.stringify({ nested: { reflected: key }, rows: [key] }).replaceAll('sb_secret', '\\u0073b_secret') };
  };
  const result = await supabaseFetch('/rpc/synthetic', { method: 'POST', body: {} });
  assert.equal(result.data.nested.reflected, '[REDACTED]');
  assert.doesNotMatch(JSON.stringify(result), /sb_secret_/);
}));

test('service role: erros upstream serializáveis não carregam credencial', async () => withConfig(async () => {
  global.fetch = async () => ({ ok: false, status: 409, text: async () => JSON.stringify({ code: 'PT409',
    message: key, details: { request: key }, hint: key }) });
  await assert.rejects(supabaseFetch('/rpc/synthetic'), (error) => {
    assert.equal(error.code, 'PT409');
    assert.equal(error.status, 409);
    assert.equal(error.message, '[REDACTED]');
    assert.ok(!JSON.stringify(error).includes(key));
    return true;
  });
}));

test('service role: erro de transporte não expõe headers, URL ou cause original', async () => withConfig(async () => {
  global.fetch = async () => { throw Object.assign(new Error(`request failed ${key}`), { headers: { apikey: key } }); };
  await assert.rejects(supabaseFetch('/rpc/synthetic'), (error) => {
    assert.equal(error.message, 'supabase_transport_failed');
    assert.equal(error.cause, undefined);
    assert.ok(!error.stack.includes(key));
    assert.ok(!JSON.stringify(error).includes(key));
    return true;
  });
}));
