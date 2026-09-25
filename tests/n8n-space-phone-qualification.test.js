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
  qualification: { id: 'q1', voice_call_id: 'call-1', space_user_uid: 'sdr-1', context: 'Mora nos EUA', pain_goal: 'Autonomia', experience: 'Não identificado', urgency: 'Alta', decision_investment: 'Decide sozinha', key_point: 'Autonomia nos EUA', final_summary: 'Resumo', status: 'complete', completed_at: '2026-09-24T12:10:00Z' },
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
    const res = await invoke(handler, { method: 'POST', body: { action: 'mark_datacrazy_synced', callId: 'call-1', sync: { contactId: 'contact-known' } } });
    assert.equal(res.status, 200);
    const patch = seen.find(item => item.options.method === 'PATCH');
    assert.equal(patch.options.body.datacrazy_note_id, null);
    assert.equal(patch.options.body.datacrazy_sync_status, 'sent');
    assert.equal(patch.options.body.status, 'sent');
  } finally { restore(); }
}));

test('datacrazy resolve prefers deterministic ids and local state matches safely', async () => withEnv({ SPACE_N8N_SHARED_SECRET: 'shared-secret-123456' }, async () => {
  const restore = installSupabaseStub(makeRequest());
  try {
    const handler = require('../api/integrations/n8n/datacrazy-resolve');
    const res = await invoke(handler, { method: 'POST', url: '/api/integrations/n8n/datacrazy-resolve', body: { callId: 'call-1', phone: '+1 407 751 1479' } });
    assert.equal(res.status, 200);
    assert.ok(res.json.matches.some(m => m.source === 'voice_call' && m.datacrazyContactId === 'contact-known'));
    assert.equal(res.json.matched, true);
    assert.equal(res.json.leadId, 'contact-known');
    assert.equal(res.json.matches.length, 1);
  } finally { restore(); }
}));

test('legacy Datacrazy note endpoint is retired without writing', async () => withEnv({ SPACE_N8N_SHARED_SECRET: 'shared-secret-123456', CRM_API_BASE_URL: 'https://datacrazy.test', CRM_API_KEY: 'secret-key' }, async () => {
  const restore = installSupabaseStub(makeRequest());
  try {
    const handler = require('../api/integrations/n8n/datacrazy-note');
    const res = await invoke(handler, { method: 'POST', url: '/api/integrations/n8n/datacrazy-note', body: { callId: 'call-1', datacrazyId: 'contact-local', note: 'Qualificação SDR — Space\nContexto: ok\nTranscript: não deve ir' } });
    assert.equal(res.status, 410);
    assert.equal(res.json.error, 'DATACRAZY_WRITE_DELEGATED_TO_N8N');
    assert.equal(res.json.preparedNote.includes('Transcript'), false);
    assert.equal(res.json.preparedNote, 'Resumo');
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

test('retired Datacrazy write endpoint cannot overwrite a handoff claim', async () => {
  const { datacrazyNote } = require('../api/_lib/space-phone-n8n');
  const seen = [];
  const result = await datacrazyNote({ callId: 'call-1', request: makeRequest(fixtures(), seen) });
  assert.equal(result.error, 'DATACRAZY_WRITE_DELEGATED_TO_N8N');
  assert.equal(result.status, 410);
  assert.equal(seen.some(r => r.options.method === 'PATCH'), false);
});


test('ai_requested callback ends at review_required without starting Datacrazy', async () => {
  const fx = fixtures(); fx.qualification.status = 'ai_processing'; fx.qualification.completed_at = null;
  const seen = [];
  const { requestAiQualification, saveAiQualification, handoffEligible } = require('../api/_lib/space-phone-n8n');
  const events = [];
  await requestAiQualification({ call: fx.call, request: makeRequest(fx, seen), dispatch: async event => { events.push(event.event); return { ok: true }; } });
  assert.deepEqual(events, ['qualification.ai_requested']);
  const result = await saveAiQualification({ callId: fx.call.id, qualification: { context: 'AI suggestion' }, request: makeRequest(fx, seen) });
  assert.equal(result.qualification.status, 'review_required');
  assert.equal(handoffEligible(fx.call, result.qualification), false);
  assert.equal(seen.some(r => r.path.split('?')[0].includes('datacrazy') || r.path.includes('n8n_estado')), false);
});

for (const [name, status, outcome, confirmed, allowed] of [
  ['completed before complete', 'review_required', 'agendado', false, false],
  ['completed + complete + agendado + confirmation', 'complete', 'agendado', true, true],
  ['completed + complete + non-agendado', 'complete', 'interessado', true, false],
  ['complete without persisted human confirmation', 'complete', 'agendado', false, false],
]) test(`handoff gate: ${name}`, async () => {
  const fx = fixtures(); fx.call.outcome = outcome; fx.qualification.status = status;
  fx.qualification.completed_at = confirmed ? '2026-09-24T12:10:00Z' : null;
  const seen = [];
  const { getQualificationPayload, datacrazyNote, markDatacrazySynced } = require('../api/_lib/space-phone-n8n');
  const request = makeRequest(fx, seen);
  const payload = await getQualificationPayload({ callId: fx.call.id, request });
  assert.equal(payload.handoffEligible, allowed);
  const result = await datacrazyNote({ callId: fx.call.id, request });
  // A passing gate reaches the existing handoff implementation, which still blocks uncertified writes.
  assert.equal(result.error, allowed ? 'DATACRAZY_WRITE_DELEGATED_TO_N8N' : 'datacrazy_gate_not_satisfied');
  assert.equal(seen.some(r => r.options.method === 'PATCH'), false);
  if (!allowed) await assert.rejects(() => markDatacrazySynced({ callId: fx.call.id, request, sync: { noteId: 'note-1' } }), /datacrazy_sync_not_confirmed/);
});

test('dispatch telemetry correlates automatic completed event without logging secrets or response body', async () => withEnv({ SPACE_PHONE_QUALIFICATION_N8N_WEBHOOK_URL: 'https://n8n.test/private-webhook', SPACE_N8N_SHARED_SECRET: 'private-shared-secret' }, async () => {
  const { dispatchQualificationEvent } = require('../api/_lib/space-phone-n8n');
  const logs = []; let request;
  const result = await dispatchQualificationEvent({ event: 'qualification.completed', callId: 'call-1', now: new Date('2026-09-24T12:00:00Z'), logger: entry => logs.push(entry), fetchImpl: async (_url, options) => {
    request = options;
    return { ok: true, status: 200, headers: new Headers({ 'x-n8n-execution-id': '12345', 'x-request-id': '6f1aeb32-e8d0-4719-8c0e-b81f1e4b7a83' }), json() { throw new Error('must not inspect response body'); } };
  } });
  assert.equal(result.ok, true);
  assert.equal(request.headers['x-space-dispatch-id'], result.dispatchId);
  assert.deepEqual(JSON.parse(request.body), { event: 'qualification.completed', callId: 'call-1', occurredAt: '2026-09-24T12:00:00.000Z' });
  assert.equal(logs[0].phase, 'start');
  assert.equal(logs[1].dispatchId, result.dispatchId);
  assert.equal(logs[1].httpStatus, 200);
  assert.equal(logs[1].n8nExecutionId, '12345');
  assert.equal(logs[1].outcome, 'accepted');
  assert.ok(Number.isFinite(Date.parse(logs[1].timestamp)));
  assert.equal(JSON.stringify(logs).includes('private-'), false);
}));

test('dispatch telemetry records rejected and timed-out requests without arbitrary headers/errors', async () => withEnv({ SPACE_PHONE_QUALIFICATION_N8N_WEBHOOK_URL: 'https://n8n.test/webhook' }, async () => {
  const { dispatchQualificationEvent } = require('../api/_lib/space-phone-n8n');
  const logs = [];
  const rejected = await dispatchQualificationEvent({ event: 'qualification.completed', callId: 'call-1', logger: e => logs.push(e), fetchImpl: async () => ({ ok: false, status: 503, headers: new Headers({ 'x-n8n-execution-id': 'secret-response-value' }) }) });
  assert.equal(rejected.ok, false);
  assert.equal(logs.at(-1).httpStatus, 503);
  assert.equal(logs.at(-1).n8nExecutionId, null);
  const timeout = await dispatchQualificationEvent({ event: 'qualification.completed', callId: 'call-1', logger: e => logs.push(e), fetchImpl: async () => { throw Object.assign(new Error('secret-error-value'), { name: 'TimeoutError' }); } });
  assert.equal(timeout.ok, false);
  assert.equal(logs.at(-1).outcome, 'timeout');
  assert.equal(logs.at(-1).httpStatus, null);
  assert.equal(JSON.stringify(logs).includes('secret-'), false);
}));

test('telemetry failure does not change a successful webhook dispatch', async () => withEnv({ SPACE_PHONE_QUALIFICATION_N8N_WEBHOOK_URL: 'https://n8n.test/webhook' }, async () => {
  const { dispatchQualificationEvent } = require('../api/_lib/space-phone-n8n');
  const result = await dispatchQualificationEvent({ event: 'qualification.completed', callId: 'call-1', logger: () => { throw new Error('logging offline'); }, fetchImpl: async () => ({ ok: true, status: 200 }) });
  assert.equal(result.ok, true);
}));

test('sent callback with no note ID is idempotent and GET forbids a second handoff', async () => {
  const fx = fixtures(); fx.qualification.status = 'sent'; fx.qualification.datacrazy_sync_status = 'sent'; fx.qualification.datacrazy_note_id = null;
  const seen = []; const request = makeRequest(fx, seen);
  const { markDatacrazySynced, claimDatacrazyHandoff, getQualificationPayload } = require('../api/_lib/space-phone-n8n');
  assert.equal((await markDatacrazySynced({ callId: fx.call.id, request })).duplicate, true);
  assert.equal((await claimDatacrazyHandoff({ callId: fx.call.id, request })).shouldWrite, false);
  assert.equal((await getQualificationPayload({ callId: fx.call.id, request })).handoffEligible, false);
  assert.equal(seen.some(r => r.options.method), false);
});

for (const [name, contacts, expected] of [
  ['same lead in repeated rows', ['one', 'one'], true],
  ['two distinct leads', ['one', 'two'], false],
  ['no lead', [], false],
]) test(`strict phone match: ${name}`, async () => {
  const fx = fixtures(); fx.call.lead_id = null;
  const base = makeRequest(fx);
  const { resolveDatacrazy } = require('../api/_lib/space-phone-n8n');
  const result = await resolveDatacrazy({ callId: fx.call.id, lookupRemote: async () => ({ matches: [], incomplete: false }), request: (path, opts) => path.startsWith('/n8n_estado') ? { data: contacts.map(id => ({ lead_id: id, telefone_normalizado: '14077511479' })) } : base(path, opts) });
  assert.equal(result.matched, expected);
  assert.equal(result.leadId, expected ? 'one' : null);
});

test('suffix coincidence and deal/external IDs are not a valid lead match', async () => {
  const fx = fixtures(); fx.call.lead_id = null;
  const base = makeRequest(fx);
  const { resolveDatacrazy } = require('../api/_lib/space-phone-n8n');
  const result = await resolveDatacrazy({ callId: fx.call.id, lookupRemote: async () => ({ matches: [], incomplete: false }), request: (path, opts) => path.startsWith('/n8n_estado') ? { data: [
    { lead_id: 'wrong-country', telefone_normalizado: '55477511479' },
    { external_id: 'deal-not-lead', telefone_normalizado: '14077511479' },
  ] } : base(path, opts) });
  assert.equal(result.matched, false);
});

test('handoff claim returns resolved lead/note and blocks retry while write outcome is unknown', async () => {
  const fx = fixtures(); const base = makeRequest(fx);
  const request = async (path, opts = {}) => {
    if (path.startsWith('/voice_call_qualifications') && opts.method === 'PATCH') Object.assign(fx.qualification, opts.body);
    return base(path, opts);
  };
  const { claimDatacrazyHandoff, markDatacrazyFailed } = require('../api/_lib/space-phone-n8n');
  const first = await claimDatacrazyHandoff({ callId: fx.call.id, request });
  assert.equal(first.shouldWrite, true);
  assert.equal(first.leadId, 'contact-known');
  assert.equal(first.note, 'Resumo');
  assert.equal((await claimDatacrazyHandoff({ callId: fx.call.id, request })).shouldWrite, false);
  await markDatacrazyFailed({ callId: fx.call.id, request });
  assert.equal((await claimDatacrazyHandoff({ callId: fx.call.id, request })).shouldWrite, false);
});

test('claim loser cannot write and failed sent persistence does not report success', async () => {
  const fx = fixtures(); const base = makeRequest(fx);
  const request = (path, opts) => opts?.method === 'PATCH' ? { data: [] } : base(path, opts);
  const { claimDatacrazyHandoff, markDatacrazySynced } = require('../api/_lib/space-phone-n8n');
  assert.equal((await claimDatacrazyHandoff({ callId: fx.call.id, request })).shouldWrite, false);
  await assert.rejects(() => markDatacrazySynced({ callId: fx.call.id, request }), /datacrazy_sync_not_persisted/);
});

test('callback rejects a manually selected lead different from the resolver', async () => {
  const { markDatacrazySynced } = require('../api/_lib/space-phone-n8n');
  await assert.rejects(() => markDatacrazySynced({ callId: 'call-1', sync: { leadId: 'manual-other-lead' }, request: makeRequest() }), /datacrazy_unique_match_required/);
});


test('explicit community-node failure cannot mark handoff sent', async () => {
  const { markDatacrazySynced } = require('../api/_lib/space-phone-n8n');
  for (const sync of [{ success: false }, { statusCode: 500 }]) {
    const seen = [];
    await assert.rejects(() => markDatacrazySynced({ callId: 'call-1', sync, request: makeRequest(fixtures(), seen) }), /datacrazy_sync_not_confirmed/);
    assert.equal(seen.some(r => r.options.method === 'PATCH'), false);
  }
});
