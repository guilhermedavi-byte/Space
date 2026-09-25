const test = require('node:test');
const assert = require('node:assert/strict');
const { Readable } = require('node:stream');

const invoke = async (handler, { method = 'GET', url = '/api/integrations/n8n/space-phone-qualification', body, secret = 'shared-secret-123456' } = {}) => {
  const req = body ? Readable.from([JSON.stringify(body)]) : Readable.from([]);
  req.method = method;
  req.url = url;
  req.headers = { host: 'localhost', 'x-space-n8n-secret': secret };
  let raw = '';
  const res = { statusCode: 200, headers: {}, setHeader(k, v) { this.headers[k.toLowerCase()] = v; }, end(v = '') { raw += v; } };
  await handler(req, res);
  return { status: res.statusCode, json: raw ? JSON.parse(raw) : null };
};

const withEnv = async (env, fn) => {
  const previous = {};
  for (const [k, v] of Object.entries(env)) { previous[k] = process.env[k]; process.env[k] = v; }
  try { return await fn(); }
  finally { for (const k of Object.keys(env)) { if (previous[k] == null) delete process.env[k]; else process.env[k] = previous[k]; } }
};

const installSupabaseStub = (request) => {
  const path = require.resolve('../api/_lib/supabase-rest');
  const previous = require.cache[path];
  require.cache[path] = { id: path, filename: path, loaded: true, exports: { supabaseFetch: request } };
  for (const mod of ['../api/_lib/space-phone-n8n', '../api/integrations/n8n/space-phone-qualification', '../api/integrations/n8n/datacrazy-resolve', '../api/integrations/n8n/datacrazy-note']) delete require.cache[require.resolve(mod)];
  return () => {
    if (previous) require.cache[path] = previous; else delete require.cache[path];
    for (const mod of ['../api/_lib/space-phone-n8n', '../api/integrations/n8n/space-phone-qualification', '../api/integrations/n8n/datacrazy-resolve', '../api/integrations/n8n/datacrazy-note']) delete require.cache[require.resolve(mod)];
  };
};

const fixtures = () => ({
  call: { id: 'call-1', space_user_uid: 'sdr-1', space_user_email: 'sdr@space.test', lead_id: 'contact-known', opportunity_id: 'deal-known', lead_name: 'Lead', from_number: '+16892232696', to_number: '+14077511479', telnyx_call_leg_id: 'leg-1', outcome: 'agendado', status: 'ended', started_at: '2026-09-24T12:00:00Z' },
  qualification: { id: 'q1', voice_call_id: 'call-1', space_user_uid: 'sdr-1', context: 'Mora nos EUA', pain_goal: 'Autonomia', experience: 'Não identificado', urgency: 'Alta', decision_investment: 'Decide sozinha', key_point: 'Autonomia nos EUA', final_summary: 'Resumo', status: 'complete' },
  score: { recording_id: 'rec-1', call_leg_id: 'leg-1', transcript: 'SDR: Olá\nLead: Quero inglês.', analysis: { summary: 'Resumo IA' }, score: 80 },
});

const makeRequest = (fx = fixtures(), seen = []) => async (path, options = {}) => {
  seen.push({ path, options });
  if (path.startsWith('/voice_calls')) return { data: [fx.call] };
  if (path.startsWith('/voice_call_qualifications') && options.method === 'POST') return { data: [{ ...fx.qualification, ...options.body }] };
  if (path.startsWith('/voice_call_qualifications') && options.method === 'PATCH') return { data: [{ ...fx.qualification, ...options.body }] };
  if (path.startsWith('/voice_call_qualifications')) return { data: fx.qualification ? [fx.qualification] : [] };
  if (path.startsWith('/sdr_call_scores')) return { data: [fx.score] };
  if (path.startsWith('/n8n_estado_leads_comercial_space')) return { data: [{ telefone_normalizado: '14077511479', datacrazy_contact_id: 'contact-local', datacrazy_deal_id: 'deal-local', nome: 'Lead Local' }] };
  if (path.startsWith('/n8n_sales_call_outcome_enrichment_space')) return { data: [] };
  return { data: [] };
};

test('n8n qualification endpoint rejects invalid secret', async () => withEnv({ SPACE_N8N_SHARED_SECRET: 'shared-secret-123456' }, async () => {
  const restore = installSupabaseStub(makeRequest());
  try {
    const handler = require('../api/integrations/n8n/space-phone-qualification');
    const res = await invoke(handler, { secret: 'wrong-secret' });
    assert.equal(res.status, 401);
  } finally { restore(); }
}));

test('n8n GET returns call qualification and transcript without logging secrets', async () => withEnv({ SPACE_N8N_SHARED_SECRET: 'shared-secret-123456' }, async () => {
  const restore = installSupabaseStub(makeRequest());
  try {
    const handler = require('../api/integrations/n8n/space-phone-qualification');
    const res = await invoke(handler, { url: '/api/integrations/n8n/space-phone-qualification?callId=call-1' });
    assert.equal(res.status, 200);
    assert.equal(res.json.callId, 'call-1');
    assert.equal(res.json.transcript.includes('Quero inglês'), true);
    assert.equal(res.json.qualification.confirmedBySdr, true);
    assert.equal(res.json.datacrazy.contactId, 'contact-known');
  } finally { restore(); }
}));

test('n8n save_ai_qualification writes only ai fields and review_required', async () => withEnv({ SPACE_N8N_SHARED_SECRET: 'shared-secret-123456' }, async () => {
  const seen = [];
  const fx = fixtures(); fx.qualification.status = 'ai_processing';
  const restore = installSupabaseStub(makeRequest(fx, seen));
  try {
    const handler = require('../api/integrations/n8n/space-phone-qualification');
    const res = await invoke(handler, { method: 'POST', body: { action: 'save_ai_qualification', callId: 'call-1', qualification: { context: 'AI contexto', painGoal: 'AI dor', finalSummary: 'AI resumo' } } });
    assert.equal(res.status, 200);
    const post = seen.find(item => item.options.method === 'PATCH');
    assert.equal(post.options.body.ai_context, 'AI contexto');
    assert.equal(post.options.body.context, undefined);
    assert.equal(post.options.body.status, 'review_required');
  } finally { restore(); }
}));

test('n8n mark_datacrazy_synced is idempotent and marks sent', async () => withEnv({ SPACE_N8N_SHARED_SECRET: 'shared-secret-123456' }, async () => {
  const seen = [];
  const restore = installSupabaseStub(makeRequest(fixtures(), seen));
  try {
    const handler = require('../api/integrations/n8n/space-phone-qualification');
    const res = await invoke(handler, { method: 'POST', body: { action: 'mark_datacrazy_synced', callId: 'call-1', sync: { contactId: 'c1', noteId: 'n1' } } });
    assert.equal(res.status, 200);
    const patch = seen.find(item => item.options.method === 'PATCH');
    assert.equal(patch.options.body.datacrazy_note_id, 'n1');
    assert.equal(patch.options.body.datacrazy_sync_status, 'sent');
    assert.equal(patch.options.body.status, undefined);
  } finally { restore(); }
}));

test('datacrazy resolve prefers deterministic ids and local state matches safely', async () => withEnv({ SPACE_N8N_SHARED_SECRET: 'shared-secret-123456' }, async () => {
  const restore = installSupabaseStub(makeRequest());
  try {
    const handler = require('../api/integrations/n8n/datacrazy-resolve');
    const res = await invoke(handler, { method: 'POST', url: '/api/integrations/n8n/datacrazy-resolve', body: { callId: 'call-1', phone: '+1 407 751 1479' } });
    assert.equal(res.status, 200);
    assert.ok(res.json.matches.some(m => m.source === 'voice_call' && m.datacrazyContactId === 'contact-known'));
    assert.ok(res.json.matches.some(m => m.source === 'n8n_estado_leads_comercial_space' && m.datacrazyContactId === 'contact-local'));
  } finally { restore(); }
}));

test('datacrazy note enforces gate, idempotency and blocks uncertified write endpoint', async () => withEnv({ SPACE_N8N_SHARED_SECRET: 'shared-secret-123456', CRM_API_BASE_URL: 'https://datacrazy.test', CRM_API_KEY: 'secret-key' }, async () => {
  const restore = installSupabaseStub(makeRequest());
  try {
    const handler = require('../api/integrations/n8n/datacrazy-note');
    const res = await invoke(handler, { method: 'POST', url: '/api/integrations/n8n/datacrazy-note', body: { callId: 'call-1', datacrazyId: 'contact-local', note: 'Qualificação SDR — Space\nContexto: ok\nTranscript: não deve ir' } });
    assert.equal(res.status, 501);
    assert.equal(res.json.error, 'DATACRAZY_NOTE_WRITE_BLOCKED_API_ENDPOINT');
    assert.equal(res.json.preparedNote.includes('Transcript'), false);
    assert.equal(res.json.preparedNote.includes('Qualificação SDR — Space'), true);
  } finally { restore(); }
}));


test('late AI callback preserves human completion and final summary', async () => {
  const seen = [];
  const { saveAiQualification } = require('../api/_lib/space-phone-n8n');
  const result = await saveAiQualification({ callId: 'call-1', qualification: { finalSummary: 'Late AI' }, request: makeRequest(fixtures(), seen) });
  assert.equal(result.skipped, true);
  assert.equal(seen.some(r => r.options.method), false);
});

test('AI dispatch failure releases its claim for retry, without overwriting completion', async () => {
  const { requestAiQualification } = require('../api/_lib/space-phone-n8n');
  const fx = fixtures(); fx.qualification.status = 'draft'; fx.qualification.updated_at = '2026-09-24T12:00:00Z';
  const seen = [];
  const result = await requestAiQualification({ call: fx.call, request: makeRequest(fx, seen), dispatch: async () => ({ ok: false }), now: new Date('2026-09-24T12:30:00Z') });
  assert.equal(result.aiStatus, 'failed');
  const writes = seen.filter(r => r.options.method === 'PATCH');
  assert.equal(writes[0].options.body.status, 'ai_processing');
  assert.equal(writes[1].options.body.status, 'draft');
  assert.ok(writes[1].path.includes('status=eq.ai_processing&updated_at=eq.'));
});

test('AI requires real transcript and claim ownership before dispatch', async () => {
  const { requestAiQualification } = require('../api/_lib/space-phone-n8n');
  const fx = fixtures(); fx.qualification.status = 'draft'; fx.score.transcript = '';
  let events = 0;
  const seen = [];
  await requestAiQualification({ call: fx.call, request: makeRequest(fx, seen), dispatch: async () => { events++; return { ok: true }; } });
  assert.equal(events, 0);
  assert.equal(seen.some(r => r.options.method), false);
  fx.score.transcript = 'Real transcript';
  const request = makeRequest(fx);
  await requestAiQualification({ call: fx.call, request: (path, options) => options?.method === 'PATCH' ? { data: [] } : request(path, options), dispatch: async () => { events++; return { ok: true }; } });
  assert.equal(events, 0);
});

test('worker processes pending transcript automatically without browser requests', async () => withEnv({ SPACE_PHONE_QUALIFICATION_N8N_WEBHOOK_URL: 'https://n8n.test/webhook' }, async () => {
  const { processPendingQualifications } = require('../api/_lib/space-phone-n8n');
  const fx = fixtures(); fx.qualification.status = 'draft'; fx.qualification.updated_at = '2026-09-24T12:00:00Z';
  const previous = global.fetch; const events = [];
  global.fetch = async (_url, opts) => { events.push(JSON.parse(opts.body)); return { ok: true, status: 200 }; };
  try {
    const result = await processPendingQualifications({ request: makeRequest(fx), now: new Date('2026-09-24T13:00:00Z') });
    assert.equal(result.dispatched, 1);
    assert.equal(events[0].event, 'qualification.ai_requested');
  } finally { global.fetch = previous; }
}));

test('scheduled worker fails closed without its cron secret', async () => withEnv({ CRON_SECRET: '' }, async () => {
  const handler = require('../api/space-phone-qualification-process');
  const res = await invoke(handler);
  assert.equal(res.status, 401);
}));

test('blocked Datacrazy write persists only handoff fields', async () => {
  const { datacrazyNote } = require('../api/_lib/space-phone-n8n');
  const seen = [];
  const result = await datacrazyNote({ callId: 'call-1', request: makeRequest(fixtures(), seen) });
  assert.equal(result.error, 'DATACRAZY_NOTE_WRITE_BLOCKED_API_ENDPOINT');
  const write = seen.find(r => r.options.method === 'PATCH');
  assert.equal(write.options.body.datacrazy_sync_status, 'blocked');
  assert.equal(write.options.body.status, undefined);
});
