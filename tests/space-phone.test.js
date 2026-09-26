const test = require("node:test");
const assert = require("node:assert/strict");
const { Readable } = require("node:stream");
const { createHandler, __private } = require("../api/space-phone");
const { createSessionForUser } = require("../_lib/session");


const invokeAppRoute = async ({ pathParam, sessionUser, firestoreUser }) => {
  const appPath = require.resolve("../api/app");
  const firestoreAdminPath = require.resolve("../api/_lib/firestore-admin");
  const previousApp = require.cache[appPath];
  const previousFirestoreAdmin = require.cache[firestoreAdminPath];
  require.cache[firestoreAdminPath] = {
    id: firestoreAdminPath,
    filename: firestoreAdminPath,
    loaded: true,
    exports: { getDocumentAsAdmin: async () => firestoreUser },
  };
  delete require.cache[appPath];
  const appHandler = require("../api/app");
  const req = Readable.from([]);
  req.method = "GET";
  req.url = `/api/app?path=${encodeURIComponent(pathParam)}`;
  req.headers = { host: "localhost", cookie: "space_session=" + createSessionForUser(sessionUser).token };
  let body = "";
  const res = { statusCode: 200, setHeader() {}, end(v = "") { body += v; } };
  try {
    await appHandler(req, res);
    return { statusCode: res.statusCode, body };
  } finally {
    if (previousApp) require.cache[appPath] = previousApp;
    else delete require.cache[appPath];
    if (previousFirestoreAdmin) require.cache[firestoreAdminPath] = previousFirestoreAdmin;
    else delete require.cache[firestoreAdminPath];
  }
};

const extractEmbeddedSession = (html) => {
  const match = String(html || "").match(/window\.__SPACE_SESSION__ = (\{[\s\S]*?\});/);
  assert.ok(match, "embedded session exists");
  return JSON.parse(match[1]);
};

const invoke = async (handler, { method = "GET", url = "/api/space-phone", body } = {}) => {
  const req = body ? Readable.from([JSON.stringify(body)]) : Readable.from([]);
  req.method = method;
  req.url = url;
  req.headers = { host: "localhost" };
  let raw = "";
  const headers = {};
  const res = { statusCode: 200, setHeader(k, v) { headers[k.toLowerCase()] = v; }, end(v = "") { raw += v; } };
  await handler(req, res);
  return { status: res.statusCode, headers, json: raw ? JSON.parse(raw) : null };
};

test("space phone normalizes manual US and international phone numbers", () => {
  assert.deepEqual(__private.normalizePhoneInput("(617) 555-1212"), { ok: true, raw: "(617) 555-1212", normalized: "+16175551212" });
  assert.deepEqual(__private.normalizePhoneInput("6175551212"), { ok: true, raw: "6175551212", normalized: "+16175551212" });
  assert.deepEqual(__private.normalizePhoneInput("+55 11 99999-9999"), { ok: true, raw: "+55 11 99999-9999", normalized: "+5511999999999" });
  assert.equal(__private.normalizePhoneInput("123").ok, false);
});


test("voice call select only references canonical production columns plus new disposition columns", () => {
  const allowed = new Set([
    "id", "provider", "source", "direction", "space_user_uid", "space_user_email", "lead_id", "opportunity_id", "lead_name",
    "from_number", "to_number", "telnyx_call_control_id", "telnyx_call_leg_id", "telnyx_call_session_id", "status",
    "started_at", "answered_at", "ended_at", "duration_seconds", "created_at", "updated_at",
    "notes", "outcome", "callback_at", "ended_reason",
  ]);
  const selected = __private.voiceCallSelect.split(",");
  assert.ok(selected.includes("telnyx_call_leg_id"));
  assert.ok(selected.includes("telnyx_call_session_id"));
  for (const col of selected) assert.ok(allowed.has(col), `unexpected voice_calls column ${col}`);
  assert.equal(selected.includes("call_leg_id"), false);
  assert.equal(selected.includes("sdr_uid"), false);
  assert.equal(selected.includes("recording_id"), false);
});

test("growth SDR list is server-side scoped to own voice calls", async () => {
  const seen = [];
  const handler = createHandler({
    authResolver: async () => ({ ok: true, session: { role: "growth", sub: "sdr-1" }, profile: { user: { commercialRoles: ["sdr"] } } }),
    request: async (path) => {
      seen.push(path);
      if (path.startsWith("/voice_calls")) return { data: [{ id: "c1", space_user_uid: "sdr-1", space_user_email: "sdr1@space.test", to_number: "+16175551212", status: "completed", started_at: "2026-09-24T12:00:00Z", duration_seconds: 61 }] };
      return { data: [] };
    },
  });
  const res = await invoke(handler, { url: "/api/space-phone?period=today&sdr=other" });
  assert.equal(res.status, 200);
  assert.equal(res.json.scope, "self");
  assert.equal(res.json.calls[0].sdrUid, "sdr-1");
  assert.ok(seen.find((path) => path.includes("space_user_uid=eq.sdr-1")));
  assert.ok(!seen.find((path) => path.includes("space_user_uid=eq.other")));
});

test("admin can list all calls or select an SDR", async () => {
  const seen = [];
  const handler = createHandler({
    authResolver: async () => ({ ok: true, session: { role: "admin", sub: "admin" } }),
    permissionResolver: async () => ({ ok: true }),
    request: async (path) => {
      seen.push(path);
      return { data: path.startsWith("/voice_calls") ? [{ id: "c2", space_user_uid: "sdr-2", space_user_email: "sdr2@space.test", to_number: "+16175550000", status: "completed", started_at: "2026-09-24T12:00:00Z" }] : [] };
    },
    resolveOperationalSdrs: async () => [{ uid: "sdr-2", displayName: "SDR 2" }],
  });
  const res = await invoke(handler, { url: "/api/space-phone?period=last7&sdr=sdr-2" });
  assert.equal(res.status, 200);
  assert.equal(res.json.scope, "admin");
  assert.ok(seen.find((path) => path.includes("space_user_uid=eq.sdr-2")));
});

test("space phone persists notes, outcome and callback on the real voice call", async () => {
  const patches = [];
  const handler = createHandler({
    authResolver: async () => ({ ok: true, session: { role: "growth", sub: "sdr-1" }, profile: { user: { commercialRoles: ["sdr"] } } }),
    request: async (path, options = {}) => {
      if (options.method === "PATCH") {
        patches.push({ path, body: options.body });
        return { data: [{ id: "call-1", space_user_uid: "sdr-1", space_user_email: "sdr1@space.test", to_number: "+16175551212", notes: options.body.notes, outcome: options.body.outcome, callback_at: options.body.callback_at }] };
      }
      if (path.startsWith("/voice_calls")) return { data: [{ id: "call-1", space_user_uid: "sdr-1", space_user_email: "sdr1@space.test", to_number: "+16175551212", status: "completed", started_at: "2026-09-24T12:00:00Z" }] };
      return { data: [] };
    },
  });
  const res = await invoke(handler, { method: "PATCH", body: { id: "call-1", notes: "Cliente pediu retorno.", outcome: "retornar_depois", callbackAt: "2099-09-25T17:00:00.000Z" } });
  assert.equal(res.status, 200);
  assert.equal(patches.length, 1);
  assert.equal(patches[0].path, "/voice_calls?id=eq.call-1");
  assert.deepEqual(patches[0].body, { notes: "Cliente pediu retorno.", outcome: "retornar_depois", callback_at: "2099-09-25T17:00:00.000Z", callback_status: "scheduled" });
  assert.equal(res.json.call.outcome, "retornar_depois");
});

test("space phone route boots the dedicated admin panel and script", async () => {
  const appPath = require.resolve("../api/app");
  const firestoreAdminPath = require.resolve("../api/_lib/firestore-admin");
  const previousApp = require.cache[appPath];
  const previousFirestoreAdmin = require.cache[firestoreAdminPath];
  require.cache[firestoreAdminPath] = {
    id: firestoreAdminPath,
    filename: firestoreAdminPath,
    loaded: true,
    exports: { getDocumentAsAdmin: async () => ({ tipo: "admin", role: "admin", isSuperAdmin: true, adminPermissions: ["comercial.spacePhone.view"] }) },
  };
  delete require.cache[appPath];
  const appHandler = require("../api/app");
  const req = Readable.from([]);
  req.method = "GET";
  req.url = "/api/app?path=admin/comercial/pre-vendas/ligacoes";
  req.headers = { host: "localhost", cookie: "space_session=" + createSessionForUser({ id: "admin", role: "admin", name: "Admin", email: "admin@example.com", adminPermissions: ["comercial.spacePhone.view"] }).token };
  let body = "";
  const res = { statusCode: 200, setHeader() {}, end(v = "") { body += v; } };
  try {
    await appHandler(req, res);
    assert.equal(res.statusCode, 200);
    assert.match(body, /data-initial-panel="space-phone"/);
    assert.match(body, /data-space-phone/);
    assert.match(body, /src="script\.js\?v=9"/);
    assert.match(body, /src="space-phone\.js\?v=20"/);
  } finally {
    if (previousApp) require.cache[appPath] = previousApp;
    else delete require.cache[appPath];
    if (previousFirestoreAdmin) require.cache[firestoreAdminPath] = previousFirestoreAdmin;
    else delete require.cache[firestoreAdminPath];
  }
});

test("space phone route boots the Growth equivalent panel with Firestore commercial roles", async () => {
  const result = await invokeAppRoute({
    pathParam: "growth/comercial/pre-vendas/ligacoes",
    sessionUser: { id: "growth-1", role: "growth", name: "SDR", email: "sdr@example.com" },
    firestoreUser: { id: "growth-1", tipo: "growth", role: "growth", ativo: true, active: true, commercialRoles: ["sdr"] },
  });
  assert.equal(result.statusCode, 200);
  assert.match(result.body, /data-initial-panel="space-phone"/);
  assert.match(result.body, /data-space-phone/);
  assert.deepEqual(extractEmbeddedSession(result.body).commercialRoles, ["sdr"]);
});

test("Growth SDR panel route boots admin-sdr and preserves closer plus SDR roles", async () => {
  const result = await invokeAppRoute({
    pathParam: "growth/comercial/pre-vendas/painel-sdr",
    sessionUser: { id: "matheus", role: "growth", name: "Matheus", email: "matheus@example.com", commercialRoles: [] },
    firestoreUser: { id: "matheus", tipo: "growth", role: "growth", ativo: true, active: true, commercialRoles: ["closer", "sdr"] },
  });
  assert.equal(result.statusCode, 200);
  assert.match(result.body, /data-initial-panel="admin-sdr"/);
  assert.match(result.body, /data-admin-sdr/);
  assert.deepEqual(extractEmbeddedSession(result.body).commercialRoles, ["closer", "sdr"]);
});

test("Growth closer-only session is hydrated from Firestore without SDR role", async () => {
  const result = await invokeAppRoute({
    pathParam: "growth/comercial/crm",
    sessionUser: { id: "closer-1", role: "growth", name: "Closer", email: "closer@example.com", commercialRoles: ["sdr"] },
    firestoreUser: { id: "closer-1", tipo: "growth", role: "growth", ativo: true, active: true, commercialRoles: ["closer"] },
  });
  assert.equal(result.statusCode, 200);
  assert.match(result.body, /data-initial-panel="native-crm"/);
  assert.deepEqual(extractEmbeddedSession(result.body).commercialRoles, ["closer"]);
});

test("server-rendered app html cache-busts script.js", async () => {
  const result = await invokeAppRoute({
    pathParam: "growth/comercial/pre-vendas/ligacoes",
    sessionUser: { id: "growth-1", role: "growth", name: "SDR", email: "sdr@example.com" },
    firestoreUser: { id: "growth-1", tipo: "growth", role: "growth", ativo: true, active: true, commercialRoles: ["sdr"] },
  });
  assert.equal(result.statusCode, 200);
  assert.match(result.body, /src="script\.js\?v=9"/);
  assert.doesNotMatch(result.body, /src="script\.js"><\/script>/);
});


test("space phone correlates post-call AI by from/to/time/duration fallback and self-heals IDs", async () => {
  const patches = [];
  const handler = createHandler({
    authResolver: async () => ({ ok: true, session: { role: "growth", sub: "sdr-1" }, profile: { user: { commercialRoles: ["sdr"] } } }),
    request: async (path, options = {}) => {
      if (options.method === "PATCH") { patches.push({ path, body: options.body }); return { data: [] }; }
      if (path.startsWith("/voice_calls")) return { data: [{ id: "call-space", space_user_uid: "sdr-1", space_user_email: "sdr@space.test", from_number: "+16892232696", to_number: "+5534999569129", status: "completed", started_at: "2026-09-24T18:00:00Z", duration_seconds: 72 }] };
      if (path.startsWith("/sdr_call_scores")) return { data: [{ recording_id: "567415f8-0551-4dc6-b0a4-a1315d71a7bb", call_leg_id: "leg-real", call_session_id: "session-real", from_number: "+16892232696", to_number: "+5534999569129", started_at: "2026-09-24T18:00:45Z", duration_seconds: 72, transcript: "SDR: Olá", score: 0, analysis: { summary: "Resumo" } }] };
      return { data: [] };
    },
  });
  const res = await invoke(handler, { url: "/api/space-phone?period=today" });
  assert.equal(res.status, 200);
  assert.equal(res.json.calls[0].score, 0);
  assert.equal(res.json.calls[0].analysisStatus, "completed");
  assert.equal(res.json.calls[0].transcriptionAvailable, true);
  assert.equal(res.json.calls[0].recordingId, "567415f8-0551-4dc6-b0a4-a1315d71a7bb");
  assert.deepEqual(patches[0], { path: "/voice_calls?id=eq.call-space&telnyx_call_leg_id=is.null&telnyx_call_session_id=is.null", body: { telnyx_call_leg_id: "leg-real", telnyx_call_session_id: "session-real" } });
});

test("space phone does not correlate ambiguous fallback candidates", async () => {
  const patches = [];
  const handler = createHandler({
    authResolver: async () => ({ ok: true, session: { role: "growth", sub: "sdr-1" }, profile: { user: { commercialRoles: ["sdr"] } } }),
    request: async (path, options = {}) => {
      if (options.method === "PATCH") { patches.push({ path, body: options.body }); return { data: [] }; }
      if (path.startsWith("/voice_calls")) return { data: [{ id: "call-amb", space_user_uid: "sdr-1", from_number: "+16892232696", to_number: "+15550000000", status: "completed", started_at: "2026-09-24T18:00:00Z", duration_seconds: 72 }] };
      if (path.startsWith("/sdr_call_scores")) return { data: [
        { recording_id: "r1", call_leg_id: "leg-1", call_session_id: "sess-1", from_number: "+16892232696", to_number: "+15550000000", started_at: "2026-09-24T18:00:30Z", duration_seconds: 72, transcript: "A", score: 80 },
        { recording_id: "r2", call_leg_id: "leg-2", call_session_id: "sess-2", from_number: "+16892232696", to_number: "+15550000000", started_at: "2026-09-24T18:00:31Z", duration_seconds: 72, transcript: "B", score: 81 },
      ] };
      return { data: [] };
    },
  });
  const res = await invoke(handler, { url: "/api/space-phone?period=today" });
  assert.equal(res.status, 200);
  assert.equal(res.json.calls[0].analysisStatus, "waiting_recording");
  assert.equal(patches.length, 0);
});

test('space phone outcome bridge writes deterministic SDR activity event', async () => {
  const writes = [];
  const handler = createHandler({
    authResolver: async () => ({ ok: true, session: { role: 'growth', sub: 'sdr-1', email: 'sdr1@space.test', name: 'Matheus' }, profile: { user: { commercialRoles: ['sdr'] } } }),
    bridgeCommit: async ({ writes: incoming }) => { writes.push(...incoming); return { ok: true }; },
    request: async (path, options = {}) => {
      if (options.method === 'PATCH') return { data: [{ id: 'call-bridge', space_user_uid: 'sdr-1', space_user_email: 'sdr1@space.test', to_number: '+16175551212', outcome: options.body.outcome, duration_seconds: 61, started_at: '2026-09-24T12:00:00Z', ended_at: '2026-09-24T12:01:01Z' }] };
      if (path.startsWith('/voice_calls')) return { data: [{ id: 'call-bridge', space_user_uid: 'sdr-1', space_user_email: 'sdr1@space.test', to_number: '+16175551212', status: 'completed', started_at: '2026-09-24T12:00:00Z', ended_at: '2026-09-24T12:01:01Z', duration_seconds: 61 }] };
      return { data: [] };
    },
  });
  const first = await invoke(handler, { method: 'PATCH', body: { id: 'call-bridge', outcome: 'interessado' } });
  const second = await invoke(handler, { method: 'PATCH', body: { id: 'call-bridge', outcome: 'agendado' } });
  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.equal(writes.length, 2);
  assert.equal(writes[0].update.name.endsWith('/sdrActivityEvents/space_phone_call_call-bridge'), true);
  assert.equal(writes[1].update.name, writes[0].update.name);
  assert.equal(first.json.bridge.outcome, 'atendeu');
  assert.equal(second.json.bridge.outcome, 'agendou');
});

test('space phone qualification autosaves draft and restores on refresh', async () => {
  const store = new Map();
  const handler = createHandler({
    authResolver: async () => ({ ok: true, session: { role: 'growth', sub: 'sdr-1', email: 'sdr1@space.test' }, profile: { user: { commercialRoles: ['sdr'] } } }),
    request: async (path, options = {}) => {
      if (path.startsWith('/voice_calls')) return { data: [{ id: 'call-q1', space_user_uid: 'sdr-1', space_user_email: 'sdr1@space.test', to_number: '+16175551212', status: 'active', started_at: '2026-09-24T12:00:00Z' }] };
      if (path.startsWith('/voice_call_qualifications') && options.method === 'POST') { const row = { id: 'qual-1', ...store.get('call-q1'), ...options.body }; store.set('call-q1', row); return { data: [row] }; }
      if (path.startsWith('/voice_call_qualifications')) return { data: store.has('call-q1') ? [store.get('call-q1')] : [] };
      return { data: [] };
    },
  });
  const saved = await invoke(handler, { method: 'PATCH', body: { id: 'call-q1', action: 'save_qualification', qualification: { context: 'Mora nos EUA' } } });
  assert.equal(saved.status, 200);
  assert.equal(saved.json.qualification.context, 'Mora nos EUA');
  const restored = await invoke(handler, { url: '/api/space-phone?id=call-q1' });
  assert.equal(restored.json.call.qualification.context, 'Mora nos EUA');
});

test('space phone qualification completion is gated by agendado and required fields', async () => {
  const qualification = { id: 'qual-2', voice_call_id: 'call-q2', space_user_uid: 'sdr-1', context: 'Contexto', pain_goal: '', urgency: 'Alta', decision_investment: 'Decide sozinha', key_point: 'Autonomia', status: 'draft' };
  const calls = [];
  const handler = createHandler({
    authResolver: async () => ({ ok: true, session: { role: 'growth', sub: 'sdr-1', email: 'sdr1@space.test' }, profile: { user: { commercialRoles: ['sdr'] } } }),
    request: async (path, options = {}) => {
      calls.push({ path, options });
      if (path.startsWith('/voice_calls')) return { data: [{ id: 'call-q2', space_user_uid: 'sdr-1', space_user_email: 'sdr1@space.test', to_number: '+16175551212', outcome: 'agendado', status: 'ended', started_at: '2026-09-24T12:00:00Z' }] };
      if (path.startsWith('/voice_call_qualifications') && options.method === 'PATCH') return { data: [{ ...qualification, ...options.body }] };
      if (path.startsWith('/voice_call_qualifications')) return { data: [qualification] };
      return { data: [] };
    },
  });
  const blocked = await invoke(handler, { method: 'PATCH', body: { id: 'call-q2', action: 'complete_qualification' } });
  assert.equal(blocked.status, 409);
  qualification.pain_goal = 'Quer destravar comunicação';
  const ok = await invoke(handler, { method: 'PATCH', body: { id: 'call-q2', action: 'complete_qualification' } });
  assert.equal(ok.status, 200);
  assert.equal(ok.json.qualification.status, 'complete');
  assert.equal(ok.json.qualification.datacrazy.syncStatus, 'pending');
  assert.equal(calls.some(call => String(call.path).startsWith('/datacrazy')), false);
});

test('space phone dispatches AI requested without storing fake live summary', async () => {
  const previous = process.env.SPACE_PHONE_QUALIFICATION_N8N_WEBHOOK_URL;
  process.env.SPACE_PHONE_QUALIFICATION_N8N_WEBHOOK_URL = 'https://n8n.test/webhook';
  const patches = [];
  const originalFetch = global.fetch;
  const events = [];
  global.fetch = async (_url, options = {}) => { events.push(JSON.parse(options.body)); return { ok: true, status: 200 }; };
  const handler = createHandler({
    authResolver: async () => ({ ok: true, session: { role: 'growth', sub: 'sdr-1' }, profile: { user: { commercialRoles: ['sdr'] } } }),
    request: async (path, options = {}) => {
      if (options.method === 'PATCH') { patches.push(options.body); return { data: [{ voice_call_id: 'call-ai', space_user_uid: 'sdr-1', ...options.body }] }; }
      if (path.startsWith('/voice_calls')) return { data: [{ id: 'call-ai', space_user_uid: 'sdr-1', to_number: '+1', telnyx_call_leg_id: 'leg-ai', status: 'ended', started_at: '2026-09-24T12:00:00Z' }] };
      if (path.startsWith('/sdr_call_scores')) return { data: [{ recording_id: 'rec-ai', call_leg_id: 'leg-ai', transcript: 'SDR: Olá. Lead: quero melhorar inglês.', analysis: { summary: 'Lead quer melhorar inglês.' }, score: 80 }] };
      if (path.startsWith('/voice_call_qualifications')) return { data: [{ voice_call_id: 'call-ai', space_user_uid: 'sdr-1', context: 'Lead mora fora', status: 'draft' }] };
      return { data: [] };
    },
  });
  try {
    const res = await invoke(handler, { url: '/api/space-phone?id=call-ai' });
    assert.equal(res.status, 200);
    assert.equal(events[0].event, 'qualification.ai_requested');
    assert.equal(events[0].callId, 'call-ai');
    assert.equal(events[0].transcript, undefined);
    assert.equal(patches[0].status, 'ai_processing');
  } finally {
    global.fetch = originalFetch;
    if (previous == null) delete process.env.SPACE_PHONE_QUALIFICATION_N8N_WEBHOOK_URL; else process.env.SPACE_PHONE_QUALIFICATION_N8N_WEBHOOK_URL = previous;
  }
});

test('manual qualification completes before unavailable n8n, without rollback', async () => {
  const original = global.fetch;
  const previous = process.env.SPACE_PHONE_QUALIFICATION_N8N_WEBHOOK_URL;
  process.env.SPACE_PHONE_QUALIFICATION_N8N_WEBHOOK_URL = 'https://n8n.test/webhook';
  const q = { id: 'q1', voice_call_id: 'call-manual', context: 'Human', pain_goal: 'English', urgency: 'Now', decision_investment: 'Decider', key_point: 'Work', status: 'draft' };
  const events = [];
  global.fetch = async () => { events.push('dispatch'); throw new Error('offline'); };
  const handler = createHandler({
    authResolver: async () => ({ ok: true, session: { role: 'growth', sub: 'sdr-1' }, profile: { user: { commercialRoles: ['sdr'] } } }),
    request: async (path, options = {}) => {
      if (path.startsWith('/voice_calls')) return { data: [{ id: 'call-manual', space_user_uid: 'sdr-1', outcome: 'agendado', status: 'ended' }] };
      if (options.method === 'PATCH') { Object.assign(q, options.body); events.push('saved'); }
      return { data: [q] };
    },
  });
  try {
    const res = await invoke(handler, { method: 'PATCH', body: { id: 'call-manual', action: 'complete_qualification' } });
    assert.equal(res.status, 200);
    assert.equal(res.json.qualification.status, 'complete');
    assert.equal(res.json.qualification.datacrazy.syncStatus, 'pending');
    assert.equal(events[0], 'saved');
    assert.ok(events.includes('dispatch'));
  } finally {
    global.fetch = original;
    if (previous === undefined) delete process.env.SPACE_PHONE_QUALIFICATION_N8N_WEBHOOK_URL; else process.env.SPACE_PHONE_QUALIFICATION_N8N_WEBHOOK_URL = previous;
  }
});

for (const persisted of [true, false]) test(`completed dispatch requires persisted human confirmation: ${persisted}`, async () => {
  const previous = process.env.SPACE_PHONE_QUALIFICATION_N8N_WEBHOOK_URL;
  const originalFetch = global.fetch;
  process.env.SPACE_PHONE_QUALIFICATION_N8N_WEBHOOK_URL = 'https://n8n.test/production-workflow';
  const q = { id: 'q-second', voice_call_id: 'call-second', context: 'Reviewed', pain_goal: 'English', urgency: 'Now', decision_investment: 'Decider', key_point: 'Work', status: 'review_required' };
  const events = [];
  global.fetch = async (url, options) => {
    if (url !== 'https://n8n.test/production-workflow') throw new Error('unconfigured_external_bridge');
    assert.equal(q.status, 'complete');
    assert.ok(Number.isFinite(Date.parse(q.completed_at)));
    const event = JSON.parse(options.body);
    assert.deepEqual(Object.keys(event).sort(), ['callId', 'event', 'occurredAt']);
    assert.equal(event.event, 'qualification.completed');
    assert.equal(event.callId, 'call-second');
    assert.ok(Number.isFinite(Date.parse(event.occurredAt)));
    events.push(event);
    return { ok: true, status: 200 };
  };
  const handler = createHandler({
    authResolver: async () => ({ ok: true, session: { role: 'growth', sub: 'sdr-1' }, profile: { user: { commercialRoles: ['sdr'] } } }),
    request: async (path, options = {}) => {
      if (path.startsWith('/voice_calls')) return { data: [{ id: 'call-second', space_user_uid: 'sdr-1', outcome: 'agendado', status: 'ended' }] };
      if (options.method === 'PATCH') {
        if (!persisted) return { data: [] };
        Object.assign(q, options.body);
      }
      return { data: [q] };
    },
  });
  try {
    const result = await invoke(handler, { method: 'PATCH', body: { id: 'call-second', action: 'complete_qualification' } });
    assert.equal(result.status, persisted ? 200 : 409);
    assert.equal(events.length, persisted ? 1 : 0);
  } finally {
    global.fetch = originalFetch;
    if (previous === undefined) delete process.env.SPACE_PHONE_QUALIFICATION_N8N_WEBHOOK_URL; else process.env.SPACE_PHONE_QUALIFICATION_N8N_WEBHOOK_URL = previous;
  }
});

test('repeated SDR completion never resets sent or a reserved Datacrazy handoff', async () => {
  const { completeQualification } = require('../api/_lib/space-phone');
  const previous = process.env.SPACE_PHONE_QUALIFICATION_N8N_WEBHOOK_URL;
  process.env.SPACE_PHONE_QUALIFICATION_N8N_WEBHOOK_URL = '';
  try {
    for (const syncStatus of ['sent', 'pending']) {
      const writes = [];
      const result = await completeQualification({ call: { id: 'call-1', outcome: 'agendado' }, user: { sub: 'sdr-1' }, request: async (path, opts = {}) => {
        if (opts.method) writes.push(opts);
        return { data: [{ id: 'q1', voice_call_id: 'call-1', status: syncStatus === 'sent' ? 'sent' : 'complete', completed_at: '2026-09-24T12:00:00Z', datacrazy_sync_status: syncStatus, datacrazy_sync_error: syncStatus === 'pending' ? 'DATACRAZY_WRITE_IN_PROGRESS' : null }] };
      } });
      assert.equal(result.qualification.datacrazy.syncStatus, syncStatus);
      assert.equal(writes.length, 0);
    }
  } finally {
    if (previous === undefined) delete process.env.SPACE_PHONE_QUALIFICATION_N8N_WEBHOOK_URL; else process.env.SPACE_PHONE_QUALIFICATION_N8N_WEBHOOK_URL = previous;
  }
});

test('period filters yesterday from both history and KPIs, preserving Growth and Admin scope', async () => {
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1); yesterday.setHours(12, 0, 0, 0);
  const data = [{ id: 'own-yesterday', space_user_uid: 'sdr-history', started_at: yesterday.toISOString(), status: 'completed', duration_seconds: 60, outcome: 'agendado' }, { id: 'other-yesterday', space_user_uid: 'sdr-other', started_at: yesterday.toISOString(), status: 'completed' }];
  for (const role of ['growth', 'admin']) {
    const handler = createHandler({
      authResolver: async () => ({ ok: true, session: { role, sub: 'sdr-history' }, profile: { user: { commercialRoles: ['sdr'] } } }),
      permissionResolver: async () => ({ ok: true }),
      request: async path => {
        if (!path.startsWith('/voice_calls')) return { data: [] };
        const url = new URL(path, 'https://test'); const scope = url.searchParams.get('space_user_uid');
        if (role === 'growth') assert.equal(scope, 'eq.sdr-history');
        const allowed = !scope ? [] : scope.startsWith('eq.') ? [scope.slice(3)] : scope.slice(4, -1).split(',');
        if (role === 'admin') assert.deepEqual(new Set(allowed), new Set(['sdr-history', 'sdr-other']));
        const start = url.searchParams.getAll('or').find(x => x.includes('started_at.gte.'))?.match(/started_at.gte.([^,]+)/)[1] || '';
        return { data: data.filter(row => allowed.includes(row.space_user_uid) && row.started_at >= start) };
      },
      resolveOperationalSdrs: async () => [{ uid: 'sdr-history', displayName: 'Luana Mendonça' }, { uid: 'sdr-other', displayName: 'Ayres André' }],
    });
    for (const period of ['today', 'last7', 'last30']) {
      const response = await invoke(handler, { url: `/api/space-phone?period=${period}` });
      assert.equal(response.status, 200);
      assert.equal(response.json.calls.length, period === 'today' ? 0 : role === 'growth' ? 1 : 2);
      assert.equal(response.json.analytics.totalCalls, period === 'today' ? 0 : role === 'growth' ? 1 : 2);
      if (period !== 'today') assert.equal(response.json.calls[0].outcome, 'agendado');
    }
  }
});

test('SDR names resolve once per unique UID and are separate from the lead and email', async () => {
  const { resolveSdrNames } = require('../api/_lib/space-phone-sdr-names');
  let reads = 0;
  const rows = [{ space_user_uid: 'batch-sdr-name', space_user_email: 'luana@space.test', lead_name: 'Lead Ronaldo' }, { space_user_uid: 'batch-sdr-name' }];
  const names = await resolveSdrNames(rows, {}, { batchRead: async ids => { reads++; assert.deepEqual(ids, ['batch-sdr-name']); return new Map([['batch-sdr-name', 'Luana Mendonça']]); } });
  const model = await __private.listModel({ request: async path => ({ data: path.startsWith('/voice_calls') ? [rows[0]] : [] }), user: { sub: 'batch-sdr-name' }, isAdmin: false, resolveNames: async () => names });
  const c = model.calls[0];
  assert.equal(c.sdrName, 'Luana Mendonça'); assert.equal(c.sdrEmail, 'luana@space.test'); assert.equal(c.leadName, 'Lead Ronaldo');
  await resolveSdrNames(rows, {}, { batchRead: async () => { reads++; throw new Error('should use cache'); } });
  assert.equal(reads, 1);
});

test('history search and status retain own-call scope and scheduled outcome', async () => {
  const model = await __private.listModel({
    user: { sub: 'history-owner' }, isAdmin: false,
    query: { period: 'last7', q: '+16175551212', status: 'scheduled', sdr: 'someone-else' },
    resolveNames: async () => new Map(),
    request: async path => {
      if (!path.startsWith('/voice_calls')) return { data: [] };
      const params = new URL(path, 'https://test').searchParams;
      assert.equal(params.get('space_user_uid'), 'eq.history-owner');
      if(params.has('callback_status')) return {data:[]};
      assert.ok(params.getAll('or').some(value => value.includes('to_number.ilike.*+16175551212*')));
      return { data: [
        { id: 'scheduled', space_user_uid: 'history-owner', outcome: 'agendado', status: 'completed' },
        { id: 'missed', space_user_uid: 'history-owner', outcome: 'nao_atendeu', status: 'completed' },
      ] };
    },
  });
  assert.deepEqual(model.calls.map(call => call.id), ['scheduled']);
  assert.equal(model.calls[0].outcome, 'agendado');
});

test('history pages retain period; analytics-only does not reload history', async () => {
  const rows = Array.from({length: 63}, (_,i) => ({id: `recent-${i}`, space_user_uid:'owner', started_at:'2026-01-01T12:00:00Z'}));
  const seen=[];
  const request=async path=>{
    if (!path.startsWith('/voice_calls')) return {data:[]};
    const q=new URL(path,'https://test').searchParams; seen.push(q);
    assert.equal(q.get('space_user_uid'),'eq.owner');
    if(q.has('callback_status')) return {data:[]};
    assert.ok(q.getAll('or').some(v=>v.includes('started_at.gte')));
    if(q.get('limit') === '200') return {data:[]};
    assert.equal(q.get('order'),'started_at.desc.nullslast,created_at.desc,id.desc');
    const offset=Number(q.get('offset'));return {data:rows.slice(offset,offset+Number(q.get('limit')))};
  };
  const args={request,user:{sub:'owner'},isAdmin:false,resolveNames:async()=>new Map()};
  const first=await __private.listModel({...args,query:{period:'today'}});
  assert.equal(first.analytics.totalCalls,0);assert.equal(first.calls.length,50);assert.equal(first.history.hasMore,true);
  const second=await __private.listModel({...args,query:{view:'history',historyOffset:first.history.nextOffset,period:'today'}});
  assert.equal(second.calls.length,13);assert.equal(second.calls[0].id,'recent-50');assert.equal(second.history.hasMore,false);
  seen.length=0;
  const metrics=await __private.listModel({...args,query:{view:'analytics',period:'last30'}});
  assert.equal(seen.length,1);assert.equal(metrics.calls,undefined);assert.equal(metrics.analytics.totalCalls,0);
});

test('Admin SDR and Growth spoof isolation apply to metrics, recent history and callbacks', async () => {
  const now = new Date().toISOString();
  const yesterday = new Date(Date.now() - 86400000).toISOString();
  const source = [
    { id: 'own-now', space_user_uid: 'luana', started_at: now, callback_at: '2099-01-01T00:00:00Z' },
    { id: 'own-old', space_user_uid: 'luana', started_at: yesterday },
    { id: 'other', space_user_uid: 'other', started_at: now },
  ];
  const request = async path => {
    if (!path.startsWith('/voice_calls')) return { data: [] };
    const p = new URL(path, 'https://test').searchParams;
    const scope = p.get('space_user_uid');
    let allowed = null;
    if (scope?.startsWith('eq.')) allowed = [scope.slice(3)];
    if (scope?.startsWith('in.(')) allowed = scope.slice(4, -1).split(',');
    let rows = source.filter(r => !allowed || allowed.includes(r.space_user_uid));
    if (p.getAll('or').some(v => v.includes('started_at.gte'))) rows = rows.filter(r => r.started_at === now);
    return { data: rows };
  };
  const args = { request, user: { sub: 'luana' }, resolveNames: async () => new Map([['luana', 'Luana Mendonça'], ['other', 'Guilherme Davi']]), resolveOperationalSdrs: async () => [{ uid: 'luana', displayName: 'Luana Mendonça' }, { uid: 'other', displayName: 'Ayres André' }] };
  for (const [isAdmin, sdr, count, history] of [[true,'all',2,2],[true,'luana',1,1],[false,'other',1,1],[false,'all',1,1],[true,'inactive',2,2]]) {
    const model = await __private.listModel({ ...args, isAdmin, query: { period: 'today', sdr } });
    assert.equal(model.analytics.totalCalls,count); assert.equal(model.calls.length,history);
    assert.equal(model.calls[0].sdrName,'Luana Mendonça');
    if (!isAdmin || sdr === 'luana') assert.ok([...model.calls,...model.callbacks].every(c => c.sdrUid === 'luana'));
    if (isAdmin) { assert.equal(model.sdrs.find(s => s.uid === 'luana').displayName,'Luana Mendonça'); assert.equal(model.selectedSdr,sdr === 'luana' ? 'luana' : 'all'); }
    else assert.equal(model.sdrs,undefined);
  }
});

test('KPI pagination counts more than 200 calls without truncating totals', async () => {
  const model = await __private.listModel({ user:{sub:'owner'},isAdmin:false,query:{view:'analytics'},resolveNames:async()=>new Map(),request:async path=> {
    const p = new URL(path,'https://test').searchParams;
    const offset = Number(p.get('offset'));
    return {data:Array.from({length:offset===0?200:5},(_,i)=>({id:`c-${offset+i}`,space_user_uid:'owner'}))};
  }});
  assert.equal(model.analytics.totalCalls,205);
});

test('Admin users are excluded from operational SDR filter, team KPIs, history and callbacks', async () => {
  const now = new Date().toISOString();
  const source = [
    { id: 'admin-test', space_user_uid: 'admin-gui', started_at: now, status: 'connected', outcome: 'agendado', callback_at: '2099-01-01T00:00:00Z' },
    { id: 'growth-real', space_user_uid: 'luana', started_at: now, status: 'connected', outcome: 'agendado', callback_at: '2099-01-01T00:00:00Z' },
  ];
  const paths = [];
  const request = async path => {
    paths.push(path);
    if (!path.startsWith('/voice_calls')) return { data: [] };
    const p = new URL(path, 'https://test').searchParams;
    const scope = p.get('space_user_uid');
    assert.notEqual(scope, 'eq.admin-gui');
    const allowed = scope?.startsWith('in.(') ? scope.slice(4, -1).split(',') : scope?.startsWith('eq.') ? [scope.slice(3)] : source.map(row => row.space_user_uid);
    return { data: source.filter(row => allowed.includes(row.space_user_uid)) };
  };
  const model = await __private.listModel({
    request,
    user: { sub: 'admin-gui', role: 'admin' },
    isAdmin: true,
    query: { period: 'today', sdr: 'admin-gui' },
    resolveNames: async () => new Map([['luana', 'Luana Mendonça'], ['admin-gui', 'Guilherme Davi']]),
    resolveOperationalSdrs: async () => [{ uid: 'luana', displayName: 'Luana Mendonça' }],
  });
  assert.deepEqual(model.sdrs.map(sdr => sdr.uid), ['luana']);
  assert.equal(model.selectedSdr, 'all');
  assert.equal(model.analytics.totalCalls, 1);
  assert.deepEqual(model.calls.map(call => call.sdrUid), ['luana']);
  assert.deepEqual(model.callbacks.map(callback => callback.sdrUid), ['luana']);
  assert.ok(paths.some(path => path.includes('space_user_uid=in.(luana)')));
});
