const test = require('node:test');
const assert = require('node:assert/strict');
const { Readable } = require('node:stream');

const tokenHandler = require('../api/voice/telnyx/token').createHandler;
const callsHandler = require('../api/voice/calls').createHandler;
const { normalizePhoneNumber, createTelnyxCredentialToken } = require('../api/_lib/space-phone');

function req(method, body = undefined) {
  const stream = new Readable({ read() {} });
  stream.method = method;
  stream.url = '/api/voice/calls';
  stream.headers = { authorization: 'Bearer test' };
  if (body !== undefined) stream.push(JSON.stringify(body));
  stream.push(null);
  return stream;
}

function res() {
  return {
    statusCode: 0,
    headers: {},
    setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
    end(payload) { this.payload = payload; this.body = payload ? JSON.parse(payload) : null; },
  };
}

const auth = { ok: true, session: { sub: 'growth-1', role: 'growth', email: 'sdr@space.test', name: 'SDR' } };
const authResolver = async () => auth;
const permissionResolver = async value => value;

test('Space Phone endpoints fail closed when feature flag is disabled', async () => {
  const old = process.env.SPACE_PHONE_ENABLED;
  process.env.SPACE_PHONE_ENABLED = '';
  const out = res();
  await tokenHandler({ authResolver, permissionResolver, supabase: async () => { throw new Error('should_not_read'); } })(req('POST'), out);
  assert.equal(out.statusCode, 403);
  assert.equal(out.body.error, 'space_phone_disabled');
  process.env.SPACE_PHONE_ENABLED = old;
});

test('token endpoint exchanges Telnyx credential server-side without returning API key', async () => {
  const oldFlag = process.env.SPACE_PHONE_ENABLED;
  const oldKey = process.env.TELNYX_API_KEY;
  process.env.SPACE_PHONE_ENABLED = 'true';
  process.env.TELNYX_API_KEY = 'KEY_TEST_SECRET';
  const calls = [];
  const out = res();
  await tokenHandler({
    authResolver,
    permissionResolver,
    supabase: async path => {
      calls.push({ type: 'supabase', path });
      return { data: [{ telnyx_credential_id: 'cred_123', caller_id: '+15551234567', enabled: true }] };
    },
    fetchImpl: async (url, init) => {
      calls.push({ type: 'fetch', url, auth: init.headers.Authorization });
      return { ok: true, status: 201, text: async () => 'jwt.short.token' };
    },
  })(req('POST'), out);
  assert.equal(out.statusCode, 200);
  assert.equal(out.body.login_token, 'jwt.short.token');
  assert.equal(out.body.identity.caller_id_configured, true);
  assert.ok(!JSON.stringify(out.body).includes('KEY_TEST_SECRET'));
  assert.equal(calls[1].url, 'https://api.telnyx.com/v2/telephony_credentials/cred_123/token');
  assert.equal(calls[1].auth, 'Bearer KEY_TEST_SECRET');
  process.env.SPACE_PHONE_ENABLED = oldFlag;
  process.env.TELNYX_API_KEY = oldKey;
});

test('call creation validates E.164-ish number and persists canonical voice_calls row', async () => {
  const oldFlag = process.env.SPACE_PHONE_ENABLED;
  const oldFrom = process.env.TELNYX_DEFAULT_FROM_NUMBER;
  process.env.SPACE_PHONE_ENABLED = 'true';
  process.env.TELNYX_DEFAULT_FROM_NUMBER = '+15557654321';
  const writes = [];
  const out = res();
  await callsHandler({
    authResolver,
    permissionResolver,
    supabase: async (path, options) => {
      if (path.startsWith('/voice_phone_identities')) return { data: [{ telnyx_credential_id: 'cred_123', enabled: true }] };
      writes.push({ path, options });
      return { data: [{ ...options.body, id: '11111111-1111-4111-8111-111111111111' }] };
    },
  })(req('POST', { phoneNumber: '(617) 555-1212', context: { leadId: 'lead-1', opportunityId: 'opp-1', leadName: 'Matheus' } }), out);
  assert.equal(out.statusCode, 200);
  assert.equal(out.body.call.to_number, '+6175551212');
  assert.equal(writes[0].path, '/voice_calls');
  assert.equal(writes[0].options.body.provider, 'telnyx');
  assert.equal(writes[0].options.body.source, 'space_webrtc');
  assert.equal(writes[0].options.body.direction, 'outbound');
  assert.equal(writes[0].options.body.space_user_uid, 'growth-1');
  assert.equal(writes[0].options.body.from_number, '+15557654321');
  process.env.SPACE_PHONE_ENABLED = oldFlag;
  process.env.TELNYX_DEFAULT_FROM_NUMBER = oldFrom;
});

test('call creation does not succeed without mapped Telnyx identity', async () => {
  const oldFlag = process.env.SPACE_PHONE_ENABLED;
  process.env.SPACE_PHONE_ENABLED = 'true';
  const out = res();
  await callsHandler({ authResolver, permissionResolver, supabase: async () => ({ data: [] }) })(req('POST', { phoneNumber: '+15551234567' }), out);
  assert.equal(out.statusCode, 409);
  assert.equal(out.body.error, 'voice_identity_not_configured');
  process.env.SPACE_PHONE_ENABLED = oldFlag;
});

test('Telnyx API key is trimmed before Bearer header', async () => {
  const response = await createTelnyxCredentialToken({
    credentialId: 'cred',
    apiKey: '  KEY_TRIMMED\n',
    fetchImpl: async (_url, init) => {
      assert.equal(init.headers.Authorization, 'Bearer KEY_TRIMMED');
      return { ok: true, status: 201, text: async () => 'jwt' };
    },
  });
  assert.equal(response, 'jwt');
});

test('phone normalization rejects invalid values', () => {
  assert.equal(normalizePhoneNumber('abc'), '');
  assert.equal(normalizePhoneNumber('+1 617 555 1212'), '+16175551212');
});
