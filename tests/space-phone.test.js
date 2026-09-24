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
  const res = await invoke(handler, { method: "PATCH", body: { id: "call-1", notes: "Cliente pediu retorno.", outcome: "retornar_depois", callbackAt: "2026-09-25T17:00:00.000Z" } });
  assert.equal(res.status, 200);
  assert.equal(patches.length, 1);
  assert.equal(patches[0].path, "/voice_calls?id=eq.call-1");
  assert.deepEqual(patches[0].body, { notes: "Cliente pediu retorno.", outcome: "retornar_depois", callback_at: "2026-09-25T17:00:00.000Z" });
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
    assert.match(body, /src="script\.js\?v=7"/);
    assert.match(body, /src="space-phone\.js\?v=6"/);
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
  assert.match(result.body, /src="script\.js\?v=7"/);
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
  assert.deepEqual(patches[0], { path: "/voice_calls?id=eq.call-space", body: { telnyx_call_leg_id: "leg-real", telnyx_call_session_id: "session-real" } });
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
  assert.equal(res.json.calls[0].analysisStatus, "processing");
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
  assert.equal(ok.json.qualification.datacrazy.syncStatus, 'blocked_api_audit');
  assert.equal(calls.some(call => String(call.path).startsWith('/datacrazy')), false);
});

test('space phone AI suggestion marks missing fields as not validated', async () => {
  const patches = [];
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
  const res = await invoke(handler, { url: '/api/space-phone?id=call-ai' });
  assert.equal(res.status, 200);
  assert.equal(res.json.call.qualification.status, 'review_required');
  assert.equal(res.json.call.qualification.ai.decisionInvestment, 'Precisa ser validado');
  assert.equal(patches[0].status, 'review_required');
});
