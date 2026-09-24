const crypto = require('node:crypto');
const { resolveAdminRequestAuth } = require('./admin-request-auth');
const { requireResolvedAdminPermission } = require('./admin-permissions');
const { supabaseFetch } = require('./supabase-rest');
const { normalizePhoneNumber } = require('../../src/space-phone/phone-number');

const OUTCOMES = new Set([
  'nao_atendeu',
  'ocupado',
  'numero_invalido',
  'caixa_postal',
  'sem_interesse',
  'retornar_depois',
  'interessado',
  'agendado',
]);

const isSpacePhoneEnabled = () => String(process.env.SPACE_PHONE_ENABLED || '').trim().toLowerCase() === 'true';

const sendJson = (res, status, body) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
};

const clean = value => String(value == null ? '' : value).trim();
const number = value => (Number.isFinite(Number(value)) ? Number(value) : 0);
const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || min));
const normalizeRole = value => clean(value).toLowerCase();
const safeText = value => clean(value).slice(0, 240);
const asRows = result => (Array.isArray(result?.data) ? result.data : []);

const isoOrNull = value => {
  const raw = clean(value);
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const normalizePhoneInput = (raw, country = 'US') => {
  const input = clean(raw);
  const normalized = normalizePhoneNumber(input, { defaultCountry: country });
  if (!input) return { ok: false, raw: input, normalized: '', error: 'missing_phone' };
  if (!normalized) return { ok: false, raw: input, normalized: '', error: 'invalid_phone' };
  return { ok: true, raw: input, normalized };
};

const normalizePeriod = value => {
  const raw = clean(value).toLowerCase();
  if (raw === 'today' || raw === 'hoje') return 'today';
  if (raw === '30' || raw === '30d' || raw === 'last30') return 'last30';
  return 'last7';
};

const rangeForPeriod = (period, now = new Date()) => {
  const normalized = normalizePeriod(period);
  const end = new Date(now);
  const start = new Date(now);
  if (normalized === 'today') start.setHours(0, 0, 0, 0);
  else start.setDate(start.getDate() - (normalized === 'last30' ? 29 : 6));
  if (normalized !== 'today') start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  return { period: normalized, from: start.toISOString(), to: end.toISOString() };
};

const publicError = (error, fallback = 'space_phone_unavailable') => {
  const code = clean(error?.code || error?.message);
  if (['PGRST116', '42P01', '42703', 'supabase_not_configured'].includes(code)) return code;
  return fallback;
};

const assertVoiceAccess = async (req, { authResolver = resolveAdminRequestAuth, permissionResolver = requireResolvedAdminPermission } = {}) => {
  if (!isSpacePhoneEnabled()) return { ok: false, status: 403, body: { error: 'space_phone_disabled' } };
  const auth = await authResolver(req, { logPrefix: '[space-phone]' });
  if (!auth?.ok) return auth;
  const role = normalizeRole(auth.session?.role);
  if (role === 'growth') return auth;
  if (role === 'admin') {
    const primary = await permissionResolver(auth, 'comercial.preSales.view');
    if (primary?.ok) return primary;
    const secondary = await permissionResolver(auth, 'comercial.sdrPanel.view');
    if (secondary?.ok) return secondary;
    return primary || secondary || { ok: false, status: 403, body: { error: 'forbidden' } };
  }
  return { ok: false, status: 403, body: { error: 'forbidden' } };
};

const selectSingle = async (path, { supabase = supabaseFetch } = {}) => {
  const response = await supabase(path, { method: 'GET', headers: { Accept: 'application/json' } });
  const rows = asRows(response);
  return rows[0] || null;
};

const loadVoiceIdentity = async (uid, { supabase = supabaseFetch } = {}) => {
  const safeUid = encodeURIComponent(clean(uid));
  if (!safeUid) return null;
  return selectSingle(`/voice_phone_identities?space_user_uid=eq.${safeUid}&enabled=eq.true&select=*`, { supabase });
};

const createVoiceCall = async ({ session, identity, toNumber, context = {}, supabase = supabaseFetch, now = new Date() }) => {
  const id = crypto.randomUUID();
  const nowIso = now.toISOString();
  const row = {
    id,
    provider: 'telnyx',
    source: 'space_webrtc',
    direction: 'outbound',
    space_user_uid: clean(session?.sub),
    space_user_email: clean(session?.email),
    lead_id: safeText(context.leadId) || null,
    opportunity_id: safeText(context.opportunityId) || null,
    lead_name: safeText(context.leadName) || null,
    from_number: normalizePhoneNumber(identity?.caller_id || process.env.TELNYX_DEFAULT_FROM_NUMBER),
    to_number: normalizePhoneNumber(toNumber),
    status: 'created',
    started_at: nowIso,
    created_at: nowIso,
    updated_at: nowIso,
  };
  if (!row.from_number) {
    const error = new Error('caller_id_not_configured');
    error.status = 409;
    throw error;
  }
  const response = await supabase('/voice_calls', { method: 'POST', body: row, headers: { Prefer: 'return=representation' } });
  const created = Array.isArray(response.data) ? response.data[0] : response.data;
  return created || row;
};

const updateVoiceCall = async ({ session, callId, patch = {}, supabase = supabaseFetch, now = new Date() }) => {
  const safeCallId = clean(callId);
  if (!safeCallId) {
    const error = new Error('call_id_required');
    error.status = 400;
    throw error;
  }
  const allowed = {};
  ['status', 'telnyx_call_control_id', 'telnyx_call_leg_id', 'telnyx_call_session_id'].forEach(key => {
    if (patch[key] != null) allowed[key] = safeText(patch[key]);
  });
  if (patch.answered_at != null) allowed.answered_at = safeText(patch.answered_at);
  if (patch.ended_at != null) allowed.ended_at = safeText(patch.ended_at);
  if (patch.duration_seconds != null) {
    const n = Number(patch.duration_seconds);
    if (Number.isFinite(n) && n >= 0) allowed.duration_seconds = Math.floor(n);
  }
  allowed.updated_at = now.toISOString();
  const uid = encodeURIComponent(clean(session?.sub));
  const id = encodeURIComponent(safeCallId);
  const response = await supabase(`/voice_calls?id=eq.${id}&space_user_uid=eq.${uid}`, { method: 'PATCH', body: allowed, headers: { Prefer: 'return=representation' } });
  const updated = Array.isArray(response.data) ? response.data[0] : null;
  if (!updated) {
    const error = new Error('call_not_found');
    error.status = 404;
    throw error;
  }
  return updated;
};

const resolveTelnyxWebrtcApiKey = () => clean(process.env.TELNYX_WEBRTC_API_KEY) || clean(process.env.TELNYX_API_KEY);

const createTelnyxCredentialToken = async ({ credentialId, fetchImpl = fetch, apiKey = resolveTelnyxWebrtcApiKey() }) => {
  const safeCredentialId = clean(credentialId);
  const safeApiKey = clean(apiKey);
  if (!safeCredentialId) {
    const error = new Error('telnyx_credential_not_configured');
    error.status = 409;
    throw error;
  }
  if (!safeApiKey) {
    const error = new Error('telnyx_api_key_not_configured');
    error.status = 503;
    throw error;
  }
  const url = `https://api.telnyx.com/v2/telephony_credentials/${encodeURIComponent(safeCredentialId)}/token`;
  const response = await fetchImpl(url, { method: 'POST', redirect: 'error', headers: { Authorization: `Bearer ${safeApiKey}`, Accept: 'text/plain' } });
  const text = clean(await response.text().catch(() => ''));
  if (!response.ok) {
    const error = new Error('telnyx_token_failed');
    error.status = response.status || 502;
    error.telnyxStatus = response.status || 0;
    error.telnyxBody = text.slice(0, 300);
    throw error;
  }
  if (!text) {
    const error = new Error('telnyx_empty_token');
    error.status = 502;
    throw error;
  }
  return text;
};

const mapErrorStatus = error => Number(error?.status || error?.telnyxStatus || 500) || 500;

const escapeFilter = value => encodeURIComponent(clean(value).replace(/[%*,()]/g, ''));
const voiceCallSelect = [
  'id',
  'provider',
  'source',
  'direction',
  'space_user_uid',
  'space_user_email',
  'lead_id',
  'opportunity_id',
  'lead_name',
  'from_number',
  'to_number',
  'telnyx_call_control_id',
  'telnyx_call_leg_id',
  'telnyx_call_session_id',
  'status',
  'started_at',
  'answered_at',
  'ended_at',
  'duration_seconds',
  'notes',
  'outcome',
  'callback_at',
  'ended_reason',
  'created_at',
  'updated_at',
].join(',');

const duration = (row = {}) => {
  const explicit = number(row.duration_seconds);
  if (explicit > 0) return explicit;
  const start = Date.parse(row.answered_at || row.started_at || row.created_at || '');
  const end = Date.parse(row.ended_at || '');
  return start && end && end > start ? Math.round((end - start) / 1000) : 0;
};

const statusKind = (row = {}) => {
  const raw = clean(row.status).toLowerCase();
  const outcome = clean(row.outcome).toLowerCase();
  if (['failed', 'erro', 'error'].includes(raw)) return 'failed';
  if (['no_answer', 'missed', 'nao_atendida'].includes(raw) || outcome === 'nao_atendeu') return 'unanswered';
  if (['completed', 'answered', 'connected', 'in_progress'].includes(raw) || row.answered_at) return 'connected';
  return raw || 'unknown';
};

const normalizeCall = (row = {}, analysis = null, crm = null) => {
  const to = clean(row.to_number || row.phone || '');
  const from = clean(row.from_number || '');
  return {
    id: clean(row.id || row.telnyx_call_leg_id || row.telnyx_call_session_id || analysis?.recording_id),
    callLegId: clean(row.telnyx_call_leg_id),
    callSessionId: clean(row.telnyx_call_session_id),
    callControlId: clean(row.telnyx_call_control_id),
    connectionId: clean(analysis?.connection_id),
    recordingId: clean(analysis?.recording_id),
    direction: clean(row.direction) || 'outbound',
    number: to || from,
    fromNumber: from,
    toNumber: to,
    callerId: from,
    sdrUid: clean(row.space_user_uid || ''),
    sdrName: clean(row.lead_name || row.space_user_email || 'SDR'),
    sdrEmail: clean(row.space_user_email),
    status: statusKind(row),
    rawStatus: clean(row.status),
    startedAt: clean(row.started_at || row.created_at),
    answeredAt: clean(row.answered_at),
    endedAt: clean(row.ended_at),
    durationSeconds: duration(row),
    notes: clean(row.notes),
    outcome: clean(row.outcome),
    callbackAt: clean(row.callback_at),
    endedReason: clean(row.ended_reason),
    recordingAvailable: Boolean(analysis?.recording_id || analysis?.recording_url),
    transcriptionAvailable: Boolean(analysis?.transcript),
    analysisStatus: analysis ? (analysis.score != null ? 'completed' : analysis.transcript ? 'analyzing' : 'processing') : 'processing',
    score: analysis?.score ?? null,
    transcript: clean(analysis?.transcript),
    analysis: analysis?.analysis || null,
    crm,
  };
};

const filterForUser = ({ user, isAdmin, sdr }) => {
  const requested = clean(sdr);
  if (isAdmin && requested && requested !== 'all') return { userUid: requested };
  if (isAdmin) return {};
  return { userUid: clean(user?.sub) };
};

const queryVoiceCalls = async ({ request, range, userFilter, status = '', q = '', limit = 80 }) => {
  const params = [
    `select=${voiceCallSelect}`,
    `or=(started_at.gte.${encodeURIComponent(range.from)},created_at.gte.${encodeURIComponent(range.from)})`,
    `or=(started_at.lte.${encodeURIComponent(range.to)},created_at.lte.${encodeURIComponent(range.to)})`,
    'order=started_at.desc.nullslast,created_at.desc',
    `limit=${clamp(limit, 1, 200)}`,
  ];
  if (userFilter.userUid) params.push(`space_user_uid=eq.${encodeURIComponent(userFilter.userUid)}`);
  if (q) {
    const normalized = normalizePhoneInput(q).normalized || clean(q);
    params.push(`or=(to_number.ilike.*${escapeFilter(normalized)}*,from_number.ilike.*${escapeFilter(normalized)}*)`);
  }
  const rows = asRows(await request(`/voice_calls?${params.join('&')}`, { timeoutMs: 15000 }));
  return clean(status)
    ? rows.filter(row => {
        const call = normalizeCall(row);
        if (status === 'answered') return call.status === 'connected';
        if (status === 'unanswered') return call.status === 'unanswered' || call.outcome === 'nao_atendeu';
        if (status === 'scheduled') return call.outcome === 'agendado';
        if (status === 'failed') return call.status === 'failed';
        return true;
      })
    : rows;
};

const scoreAnalysisCandidate = (call = {}, analysis = {}) => {
  if (clean(call.from_number) !== clean(analysis.from_number)) return null;
  if (clean(call.to_number) !== clean(analysis.to_number)) return null;
  const callStarted = Date.parse(call.started_at || call.created_at || '');
  const analysisStarted = Date.parse(analysis.started_at || analysis.created_at || '');
  if (!callStarted || !analysisStarted) return null;
  const startedDeltaSeconds = Math.abs(callStarted - analysisStarted) / 1000;
  if (startedDeltaSeconds > 90) return null;
  const callDuration = duration(call);
  const analysisDuration = number(analysis.duration_seconds);
  const durationDeltaSeconds = Math.abs(callDuration - analysisDuration);
  if (callDuration && analysisDuration && durationDeltaSeconds > 5) return null;
  return startedDeltaSeconds + durationDeltaSeconds;
};

const indexAnalysis = (map, row, analysis) => {
  const ids = [row.id, row.telnyx_call_leg_id, row.telnyx_call_session_id, analysis?.call_leg_id, analysis?.call_session_id]
    .map(clean)
    .filter(Boolean);
  ids.forEach(id => map.set(id, analysis));
};

const maybeSelfHealVoiceCall = async ({ request, call, analysis }) => {
  const id = clean(call.id);
  if (!id || (!clean(analysis?.call_leg_id) && !clean(analysis?.call_session_id))) return;
  const body = {};
  if (!clean(call.telnyx_call_leg_id) && clean(analysis.call_leg_id)) body.telnyx_call_leg_id = clean(analysis.call_leg_id);
  if (!clean(call.telnyx_call_session_id) && clean(analysis.call_session_id)) body.telnyx_call_session_id = clean(analysis.call_session_id);
  if (!Object.keys(body).length) return;
  try {
    await request(`/voice_calls?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', body, timeoutMs: 8000 });
  } catch {
    // Self-heal is best-effort; analysis remains visible for this response.
  }
};

const loadAnalysisMap = async ({ request, calls }) => {
  const map = new Map();
  const select = 'recording_id,call_leg_id,call_session_id,connection_id,from_number,to_number,started_at,duration_seconds,transcript,score,analysis,recording_url,created_at';
  const pairs = calls.flatMap(row => [
    ['call_leg_id', clean(row.telnyx_call_leg_id)],
    ['call_session_id', clean(row.telnyx_call_session_id)],
  ]).filter(([, value]) => value).slice(0, 80);
  for (const [field, value] of pairs) {
    try {
      const rows = asRows(await request(`/sdr_call_scores?select=${select}&${field}=eq.${encodeURIComponent(value)}&limit=1`, { timeoutMs: 8000 }));
      if (rows[0]) calls.forEach(call => {
        if ([call.telnyx_call_leg_id, call.telnyx_call_session_id].map(clean).includes(value)) indexAnalysis(map, call, rows[0]);
      });
    } catch {
      // Analysis is optional for first-call certification.
    }
  }
  for (const call of calls.filter(row => !clean(row.telnyx_call_leg_id) && !clean(row.telnyx_call_session_id))) {
    const from = clean(call.from_number);
    const to = clean(call.to_number);
    if (!from || !to) continue;
    try {
      const rows = asRows(await request(`/sdr_call_scores?select=${select}&from_number=eq.${encodeURIComponent(from)}&to_number=eq.${encodeURIComponent(to)}&order=created_at.desc&limit=8`, { timeoutMs: 8000 }));
      const candidates = rows
        .map(row => ({ row, score: scoreAnalysisCandidate(call, row) }))
        .filter(item => item.score != null)
        .sort((a, b) => a.score - b.score);
      if (!candidates[0]) continue;
      if (candidates[1] && Math.abs(candidates[0].score - candidates[1].score) <= 1) continue;
      indexAnalysis(map, call, candidates[0].row);
      await maybeSelfHealVoiceCall({ request, call, analysis: candidates[0].row });
    } catch {
      // Fallback analysis correlation is optional.
    }
  }
  return map;
};

const findAnalysis = (row, analysisMap) => {
  const key = [row.id, row.telnyx_call_leg_id, row.telnyx_call_session_id].map(clean).find(id => analysisMap.has(id));
  return key ? analysisMap.get(key) : null;
};

const summarize = calls => {
  const totalCalls = calls.length;
  const connected = calls.filter(call => call.status === 'connected').length;
  const failed = calls.filter(call => call.status === 'failed').length;
  const unanswered = calls.filter(call => call.status === 'unanswered' || call.outcome === 'nao_atendeu').length;
  const talkTime = calls.reduce((sum, call) => sum + (call.status === 'connected' ? number(call.durationSeconds) : 0), 0);
  const scheduled = calls.filter(call => call.outcome === 'agendado').length;
  return {
    totalCalls,
    connectedCalls: connected,
    connectRate: totalCalls ? connected / totalCalls : 0,
    talkTimeSeconds: talkTime,
    averageTalkTimeSeconds: connected ? Math.round(talkTime / connected) : 0,
    unansweredCalls: unanswered,
    failedCalls: failed,
    scheduledCalls: scheduled || null,
    callsToMeetingRate: scheduled && totalCalls ? scheduled / totalCalls : null,
  };
};

const loadCrmContext = async ({ request, phone }) => {
  const normalized = normalizePhoneInput(phone).normalized || clean(phone);
  if (!normalized) return null;
  const digits = normalized.replace(/\D+/g, '');
  const queries = [
    `/outbound_leads?select=id,name,phone,phone_normalized,owner_id,owner_name,status&or=(phone_normalized.eq.${encodeURIComponent(normalized)},phone.ilike.*${escapeFilter(digits.slice(-8))}*)&limit=1`,
    `/contacts?select=id,name,phone,email,owner_id,owner_name&phone=ilike.*${escapeFilter(digits.slice(-8))}*&limit=1`,
  ];
  for (const path of queries) {
    try {
      const row = asRows(await request(path, { timeoutMs: 8000 }))[0];
      if (row) return { found: true, name: clean(row.name), owner: clean(row.owner_name || row.owner_id), source: path.includes('outbound') ? 'outbound_leads' : 'contacts', id: clean(row.id), status: clean(row.status) };
    } catch {
      // Optional CRM context only.
    }
  }
  return { found: false };
};

const listModel = async ({ request, user, isAdmin, query = {} }) => {
  const range = rangeForPeriod(query.period);
  const userFilter = filterForUser({ user, isAdmin, sdr: query.sdr });
  const rows = await queryVoiceCalls({ request, range, userFilter, status: query.status, q: query.q, limit: query.limit });
  const analysisMap = await loadAnalysisMap({ request, calls: rows });
  const calls = rows.map(row => normalizeCall(row, findAnalysis(row, analysisMap)));
  const callbacks = calls.filter(call => call.callbackAt && new Date(call.callbackAt).getTime() >= Date.now()).slice(0, 12);
  return { ok: true, range, scope: isAdmin ? 'admin' : 'self', analytics: summarize(calls), calls, callbacks };
};

const detailModel = async ({ request, id, user, isAdmin }) => {
  const safeId = clean(id);
  if (!safeId) {
    const error = new Error('missing_call_id');
    error.status = 400;
    throw error;
  }
  const filters = [`id=eq.${encodeURIComponent(safeId)}`, `telnyx_call_leg_id=eq.${encodeURIComponent(safeId)}`, `telnyx_call_session_id=eq.${encodeURIComponent(safeId)}`];
  let row = null;
  for (const filter of filters) {
    const rows = asRows(await request(`/voice_calls?select=${voiceCallSelect}&${filter}&limit=1`, { timeoutMs: 12000 }));
    if (rows[0]) {
      row = rows[0];
      break;
    }
  }
  if (!row) {
    const error = new Error('call_not_found');
    error.status = 404;
    throw error;
  }
  if (!isAdmin && clean(row.space_user_uid) !== clean(user.sub)) {
    const error = new Error('forbidden');
    error.status = 403;
    throw error;
  }
  const analysisMap = await loadAnalysisMap({ request, calls: [row] });
  const crm = await loadCrmContext({ request, phone: row.to_number || row.from_number }).catch(() => null);
  return { ok: true, call: normalizeCall(row, findAnalysis(row, analysisMap), crm) };
};

const updateCall = async ({ request, id, user, isAdmin, patch = {} }) => {
  const current = (await detailModel({ request, id, user, isAdmin })).call;
  const body = {};
  if (Object.prototype.hasOwnProperty.call(patch, 'notes')) body.notes = clean(patch.notes).slice(0, 5000);
  if (Object.prototype.hasOwnProperty.call(patch, 'outcome')) {
    const outcome = clean(patch.outcome);
    if (outcome && !OUTCOMES.has(outcome)) {
      const error = new Error('invalid_outcome');
      error.status = 400;
      throw error;
    }
    body.outcome = outcome || null;
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'callbackAt')) body.callback_at = isoOrNull(patch.callbackAt);
  if (Object.prototype.hasOwnProperty.call(patch, 'endedReason')) body.ended_reason = clean(patch.endedReason).slice(0, 120) || null;
  if (!Object.keys(body).length) return { ok: true, call: current };
  const rows = asRows(await request(`/voice_calls?id=eq.${encodeURIComponent(current.id)}`, { method: 'PATCH', body, timeoutMs: 12000 }));
  return { ok: true, call: normalizeCall(rows[0] || { ...current, ...body }) };
};

module.exports = {
  OUTCOMES,
  assertVoiceAccess,
  createTelnyxCredentialToken,
  createVoiceCall,
  detailModel,
  isSpacePhoneEnabled,
  listModel,
  loadVoiceIdentity,
  mapErrorStatus,
  normalizePhoneInput,
  normalizePhoneNumber,
  publicError,
  rangeForPeriod,
  sendJson,
  summarize,
  updateCall,
  updateVoiceCall,
  voiceCallSelect,
};
