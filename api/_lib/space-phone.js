const callbacksQueue = require('./space-phone-callbacks');
const { analysisIntegrity, logIntegrity } = require('./space-phone-analysis-integrity');
const { businessDisposition } = require('./business-disposition');
const crypto = require('node:crypto');
const { resolveSdrNames } = require('./space-phone-sdr-names');
const { resolveAdminRequestAuth } = require('./admin-request-auth');
const { requireResolvedAdminPermission } = require('./admin-permissions');
const { supabaseFetch } = require('./supabase-rest');
const { commitWritesAsAdmin } = require('./firestore-admin');
const { PROJECT_ID, encodeFields } = require('./firestore-rest');
const { normalizePhoneNumber } = require('../../src/space-phone/phone-number');
const { dispatchQualificationEvent, requestAiQualification } = require('./space-phone-n8n');

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


const QUALIFICATION_FIELDS = ['context', 'painGoal', 'experience', 'urgency', 'decisionInvestment', 'keyPoint'];
const QUALIFICATION_COLUMNS = {
  context: 'context',
  painGoal: 'pain_goal',
  experience: 'experience',
  urgency: 'urgency',
  decisionInvestment: 'decision_investment',
  keyPoint: 'key_point',
};
const AI_COLUMNS = {
  context: 'ai_context',
  painGoal: 'ai_pain_goal',
  experience: 'ai_experience',
  urgency: 'ai_urgency',
  decisionInvestment: 'ai_decision_investment',
  keyPoint: 'ai_key_point',
};
const REQUIRED_QUALIFICATION_FIELDS = ['context', 'painGoal', 'urgency', 'decisionInvestment', 'keyPoint'];

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
const dateKeyFor = (value, now = new Date()) => {
  const d = value ? new Date(value) : now;
  const safe = Number.isNaN(d.getTime()) ? now : d;
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(safe);
  const get = type => parts.find(part => part.type === type)?.value || '';
  return { dateKey: `${get('year')}-${get('month')}-${get('day')}`, localTime: `${get('hour')}:${get('minute')}` };
};
const outcomeToSdrOutcome = outcome => businessDisposition({ outcome }).activityOutcome;
const firestoreDocName = (collection, id, { allowTestProject = false } = {}) => {
  const project = PROJECT_ID || (allowTestProject ? 'test-project' : '');
  if (!project) throw Object.assign(new Error('missing_project_id'), { status: 503 });
  return `projects/${project}/databases/(default)/documents/${collection}/${encodeURIComponent(id)}`;
};

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
  const today = dateKeyFor(now).dateKey;
  const end = new Date(`${today}T23:59:59.999-03:00`);
  const start = new Date(`${today}T00:00:00-03:00`);
  start.setUTCDate(start.getUTCDate() - (normalized === 'today' ? 0 : normalized === 'last30' ? 29 : 6));
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
  if (context.callbackSourceCallId) {
    const isAdmin = require('./commercial-permissions').getCommercialPermissions(session).isAdmin;
    const parent = await callbacksQueue.list({request:supabase,user:session,isAdmin});
    const original = parent.find(c => c.id === context.callbackSourceCallId);
    if (!original || normalizePhoneNumber(original.number) !== row.to_number) throw Object.assign(new Error('callback_not_found'),{status:404});
    row.callback_source_call_id = original.id;
    row.lead_id = original.leadId || null;
    row.opportunity_id = original.opportunityId || null;
    row.lead_name = original.name || null;
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
    if (patch[key] != null && safeText(patch[key])) allowed[key] = safeText(patch[key]);
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
  if (updated.ended_at || updated.status === 'ended') {
    // Queue qualification without changing the recording/transcription pipeline.
    await supabase('/voice_call_qualifications?on_conflict=voice_call_id', { method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=representation' }, body: { voice_call_id: updated.id, space_user_uid: clean(session?.sub), status: 'draft' } }).catch(() => null);
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


const qualificationSelect = [
  'id', 'voice_call_id', 'space_user_uid', 'context', 'pain_goal', 'experience', 'urgency', 'decision_investment', 'key_point',
  'ai_context', 'ai_pain_goal', 'ai_experience', 'ai_urgency', 'ai_decision_investment', 'ai_key_point', 'final_summary',
  'status', 'created_at', 'updated_at', 'completed_at', 'datacrazy_lead_id', 'datacrazy_note_id', 'datacrazy_synced_at', 'datacrazy_sync_status', 'datacrazy_sync_error',
].join(',');

const normalizeQualification = (row = null) => {
  if (!row) return null;
  const qualification = {
    id: clean(row.id),
    voiceCallId: clean(row.voice_call_id || row.voiceCallId),
    spaceUserUid: clean(row.space_user_uid || row.spaceUserUid),
    context: clean(row.context),
    painGoal: clean(row.pain_goal || row.painGoal),
    experience: clean(row.experience),
    urgency: clean(row.urgency),
    decisionInvestment: clean(row.decision_investment || row.decisionInvestment),
    keyPoint: clean(row.key_point || row.keyPoint),
    ai: {
      context: clean(row.ai_context || row.ai?.context),
      painGoal: clean(row.ai_pain_goal || row.ai?.painGoal),
      experience: clean(row.ai_experience || row.ai?.experience),
      urgency: clean(row.ai_urgency || row.ai?.urgency),
      decisionInvestment: clean(row.ai_decision_investment || row.ai?.decisionInvestment),
      keyPoint: clean(row.ai_key_point || row.ai?.keyPoint),
    },
    finalSummary: clean(row.final_summary || row.finalSummary),
    status: clean(row.status) || 'draft',
    aiStatus: ['review_required', 'complete', 'sent'].includes(row.status) ? 'ready' : 'pending',
    createdAt: clean(row.created_at || row.createdAt),
    updatedAt: clean(row.updated_at || row.updatedAt),
    completedAt: clean(row.completed_at || row.completedAt),
    datacrazy: {
      leadId: clean(row.datacrazy_lead_id || row.datacrazy?.leadId),
      noteId: clean(row.datacrazy_note_id || row.datacrazy?.noteId),
      syncedAt: clean(row.datacrazy_synced_at || row.datacrazy?.syncedAt),
      syncStatus: clean(row.datacrazy_sync_status || row.datacrazy?.syncStatus),
      syncError: clean(row.datacrazy_sync_error || row.datacrazy?.syncError),
    },
  };
  qualification.missingRequired = REQUIRED_QUALIFICATION_FIELDS.filter(field => !clean(qualification[field]));
  qualification.complete = qualification.status === 'complete' || qualification.status === 'sent';
  qualification.handoffReady = qualification.complete && !qualification.missingRequired.length;
  return qualification;
};

const qualificationRowFromPatch = (patch = {}) => {
  const row = {};
  for (const field of QUALIFICATION_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(patch, field)) row[QUALIFICATION_COLUMNS[field]] = clean(patch[field]).slice(0, 4000);
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'finalSummary')) row.final_summary = clean(patch.finalSummary).slice(0, 12000);
  return row;
};

const loadQualification = async ({ request = supabaseFetch, voiceCallId }) => {
  const id = clean(voiceCallId);
  if (!id) return null;
  const rows = asRows(await request(`/voice_call_qualifications?select=${qualificationSelect}&voice_call_id=eq.${encodeURIComponent(id)}&limit=1`, { timeoutMs: 12000 }));
  return normalizeQualification(rows[0] || null);
};

const loadQualificationsMap = async ({ request = supabaseFetch, callIds = [] } = {}) => {
  const ids = [...new Set(callIds.map(clean).filter(Boolean))];
  const map = new Map();
  if (!ids.length) return map;
  try {
    const quoted = ids.map(id => `"${id}"`).join(',');
    const rows = asRows(await request(`/voice_call_qualifications?select=${qualificationSelect}&voice_call_id=in.(${encodeURIComponent(quoted)})&limit=${Math.min(ids.length, 1000)}`, { timeoutMs: 12000 }));
    rows.forEach(row => map.set(clean(row.voice_call_id), normalizeQualification(row)));
  } catch {
    // Qualification is additive; list/history should remain available if the new table is not migrated yet.
  }
  return map;
};

const qualificationSummary = (q = {}) => [
  ['Contexto', q.context],
  ['Objetivo/Dor', q.painGoal],
  ['Experiência', q.experience || 'Não identificado'],
  ['Urgência', q.urgency],
  ['Decisão/Investimento', q.decisionInvestment],
  ['Ponto-chave', q.keyPoint],
].map(([label, value]) => `${label}:\n${clean(value) || 'Precisa ser validado'}`).join('\n\n');

const buildAiQualificationSuggestion = ({ call = {}, qualification = null } = {}) => {
  const analysis = call.analysis && typeof call.analysis === 'object' ? call.analysis : (typeof call.analysis === 'string' ? (() => { try { return JSON.parse(call.analysis); } catch { return { summary: call.analysis }; } })() : {});
  const summary = clean(analysis?.summary || analysis?.resumo || analysis?.call_summary || call.summary || call.analysisText);
  const base = qualification || {};
  const missing = 'Precisa ser validado';
  const ai = {
    context: clean(base.context) || summary || missing,
    painGoal: clean(base.painGoal) || missing,
    experience: clean(base.experience) || 'Não identificado',
    urgency: clean(base.urgency) || missing,
    decisionInvestment: clean(base.decisionInvestment) || missing,
    keyPoint: clean(base.keyPoint) || summary || missing,
  };
  return { ...ai, finalSummary: qualificationSummary({ ...base, ...Object.fromEntries(Object.entries(ai).map(([k,v]) => [k, clean(base[k]) || v])) }) };
};

const upsertQualification = async ({ request = supabaseFetch, call, user, patch = {}, now = new Date() }) => {
  const voiceCallId = clean(call?.id || patch.voiceCallId);
  if (!voiceCallId) throw Object.assign(new Error('missing_call_id'), { status: 400 });
  if (clean(call?.sdrUid || call?.space_user_uid) !== clean(user?.sub) && normalizeRole(user?.role) !== 'admin') throw Object.assign(new Error('forbidden'), { status: 403 });
  const current = await loadQualification({ request, voiceCallId }).catch(() => null);
  const row = qualificationRowFromPatch(patch);
  const nowIso = now.toISOString();
  const body = {
    voice_call_id: voiceCallId,
    space_user_uid: clean(call?.sdrUid || call?.space_user_uid || user?.sub),
    ...row,
    status: clean(current?.status) || 'draft',
    updated_at: nowIso,
  };
  if (!current?.id) body.created_at = nowIso;
  else { delete body.status; delete body.created_at; }
  const response = await request('/voice_call_qualifications?on_conflict=voice_call_id', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=representation' }, body, timeoutMs: 12000 });
  return normalizeQualification(asRows(response)[0] || body);
};

const completeQualification = async ({ request = supabaseFetch, call, user, now = new Date() }) => {
  if (clean(call?.outcome) !== 'agendado') throw Object.assign(new Error('qualification_requires_agendado'), { status: 409 });
  const current = await loadQualification({ request, voiceCallId: call.id });
  if (!current) throw Object.assign(new Error('qualification_required'), { status: 409 });
  if (current.complete) {
    const sent = current.datacrazy.syncStatus === 'sent';
    const n8n = sent ? { ok: true, skipped: true } : await dispatchQualificationEvent({ event: 'qualification.completed', callId: call.id });
    return { ok: true, qualification: current, n8n, datacrazy: { ok: sent, status: current.datacrazy.syncStatus } };
  }
  const missing = REQUIRED_QUALIFICATION_FIELDS.filter(field => !clean(current[field]));
  if (missing.length) {
    const error = new Error('qualification_incomplete');
    error.status = 409;
    error.missing = missing;
    throw error;
  }
  const finalSummary = clean(current.finalSummary) || qualificationSummary(current);
  const nowIso = now.toISOString();
  const patch = { status: 'complete', final_summary: finalSummary, completed_at: nowIso, updated_at: nowIso, datacrazy_sync_status: 'pending', datacrazy_sync_error: null };
  const rows = asRows(await request(`/voice_call_qualifications?voice_call_id=eq.${encodeURIComponent(call.id)}&status=in.(draft,ai_processing,review_required)`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: patch, timeoutMs: 12000 }));
  if (!rows[0]) {
    const latest = await loadQualification({ request, voiceCallId: call.id });
    if (latest?.complete && latest.completedAt) return { ok: true, qualification: latest, datacrazy: { ok: latest.datacrazy.syncStatus === 'sent', status: latest.datacrazy.syncStatus } };
  }
  if (!rows[0] || rows[0].status !== 'complete' || !rows[0].completed_at) throw Object.assign(new Error('qualification_completion_not_persisted'), { status: 409 });
  const qualification = normalizeQualification(rows[0]);
  const eventDispatch = await dispatchQualificationEvent({ event: 'qualification.completed', callId: call.id }).catch(error => ({ ok: false, error: clean(error?.message) || 'n8n_dispatch_failed' }));
  const bridge = await syncQualificationToSdrActivity({ call, qualification, user }).catch(error => ({ ok: false, error: clean(error?.message) || 'qualification_bridge_failed' }));
  return { ok: true, qualification, bridge, n8n: eventDispatch, datacrazy: { ok: qualification.datacrazy.syncStatus === 'sent', status: qualification.datacrazy.syncStatus } };
};

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

const normalizeCall = (row = {}, analysis = null, crm = null, qualification = null, sdrName = '') => {
  const to = clean(row.to_number || row.phone || '');
  const from = clean(row.from_number || '');
  const integrity = analysisIntegrity(row, analysis);
  const normalizedQualification = normalizeQualification(qualification);
  if (integrity.inconsistent && normalizedQualification) normalizedQualification.ai = {};
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
    leadName: clean(row.lead_name),
    sdrName: clean(sdrName) || clean(row.space_user_email).split('@')[0].replace(/[._-]+/g, ' ') || 'SDR',
    sdrEmail: clean(row.space_user_email),
    status: businessDisposition({ ...row, status: statusKind(row) }).status,
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
    transcriptionAvailable: !integrity.inconsistent && Boolean(analysis?.transcript),
    analysisStatus: integrity.inconsistent ? 'failed' : analysis?.transcript ? (analysis.score != null ? 'completed' : 'analyzing') : analysis ? 'transcribing' : 'waiting_recording',
    score: integrity.inconsistent ? null : analysis?.score ?? null,
    transcript: integrity.inconsistent ? '' : clean(analysis?.transcript),
    analysis: integrity.inconsistent ? null : analysis?.analysis || null,
    analysisWarning: integrity.reason,
    crm,
    qualification: normalizedQualification,
  };
};

const filterForUser = ({ user, isAdmin, sdr }) => {
  const requested = clean(sdr);
  if (isAdmin && requested && requested !== 'all') return { userUid: requested };
  if (isAdmin) return {};
  if (!clean(user?.sub)) throw Object.assign(new Error('forbidden'), { status: 403 });
  return { userUid: clean(user.sub) };
};

const filterCallStatus = (rows, status) => {
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

const queryVoiceCalls = async ({ request, range, userFilter, status = '', q = '', limit = 80, offset = 0 }) => {
  const params = [
    `select=${voiceCallSelect}`,
    ...(range ? [`or=(started_at.gte.${encodeURIComponent(range.from)},created_at.gte.${encodeURIComponent(range.from)})`, `or=(started_at.lte.${encodeURIComponent(range.to)},created_at.lte.${encodeURIComponent(range.to)})`] : []),
    'order=started_at.desc.nullslast,created_at.desc,id.desc',
    `offset=${Math.max(0, Math.floor(Number(offset) || 0))}`,
    `limit=${clamp(limit, 1, 200)}`,
  ];
  if (userFilter.userUid) params.push(`space_user_uid=eq.${encodeURIComponent(userFilter.userUid)}`);
  if (q) {
    const normalized = normalizePhoneInput(q).normalized || clean(q);
    params.push(`or=(to_number.ilike.*${escapeFilter(normalized)}*,from_number.ilike.*${escapeFilter(normalized)}*)`);
  }
  const rows = asRows(await request(`/voice_calls?${params.join('&')}`, { timeoutMs: 15000 }));
  return filterCallStatus(rows, status);
};

const queryMetricCalls = async options => {
  const rows = [];
  for (let offset = 0; ; offset += 200) {
    const page = await queryVoiceCalls({ ...options, status: '', limit: 200, offset });
    rows.push(...page);
    if (page.length < 200) return filterCallStatus(rows, options.status);
  }
};

const indexAnalysis = (map, row, analysis) => map.set(clean(row.id), analysis);

const { getCorrelatedScore } = require('./space-phone-correlation');
const loadAnalysisMap = async ({ request, calls }) => {
  const map = new Map();
  let cursor = 0;
  const worker = async () => {
    while (cursor < calls.length) {
      const call = calls[cursor++];
      try {
        const score = await getCorrelatedScore(call, request);
        if (score) indexAnalysis(map, call, score);
      } catch {
        // Optional enrichment does not block history; cron retries infrastructure failures.
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(4, calls.length) }, worker));
  return map;
};

const findAnalysis = (row, analysisMap) => analysisMap.get(clean(row.id)) || null;

const summarize = calls => {
  const totalCalls = calls.length;
  const connected = calls.filter(call => call.status === 'connected').length;
  const failed = calls.filter(call => call.status === 'failed').length;
  const unanswered = calls.filter(call => call.status === 'unanswered' || call.outcome === 'nao_atendeu').length;
  const talkTime = calls.reduce((sum, call) => sum + businessDisposition(call).humanTalkTimeSeconds, 0);
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

const listModel = async ({ request, user, isAdmin, query = {}, resolveNames = resolveSdrNames }) => {
  const range = rangeForPeriod(query.period);
  let sdrs = [];
  if (isAdmin) {
    const identities = asRows(await request('/voice_phone_identities?select=space_user_uid&enabled=eq.true&order=space_user_uid.asc', { timeoutMs: 15000 }));
    const names = await resolveNames(identities, user);
    sdrs = identities.map(row => ({ uid: clean(row.space_user_uid), displayName: clean(names.get(clean(row.space_user_uid))) || 'SDR sem nome cadastrado' }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName, 'pt-BR'));
  }
  const selectedSdr = isAdmin && sdrs.some(sdr => sdr.uid === clean(query.sdr)) ? clean(query.sdr) : 'all';
  const userFilter = filterForUser({ user, isAdmin, sdr: selectedSdr });
  const historyOnly = query.view === 'history';
  const analyticsOnly = query.view === 'analytics';
  const offset = Math.max(0, Math.min(1000000, Math.floor(Number(query.historyOffset) || 0)));
  const [metricRows, recentRows] = await Promise.all([
    historyOnly ? [] : queryMetricCalls({ request, range, userFilter, status: query.status, q: query.q }),
    analyticsOnly ? [] : queryVoiceCalls({ request, range, userFilter, q: query.q, limit: 51, offset }),
  ]);
  const rows = filterCallStatus(recentRows.slice(0, 50), query.status);
  const analysisMap = await loadAnalysisMap({ request, calls: rows });
  const qualificationMap = await loadQualificationsMap({ request, callIds: rows.map(row => row.id) });
  const names = await resolveNames(rows, user);
  const calls = rows.map(row => normalizeCall(row, findAnalysis(row, analysisMap), null, qualificationMap.get(clean(row.id)), names.get(clean(row.space_user_uid))));
  const callbacks = analyticsOnly ? [] : await callbacksQueue.list({ request, user, isAdmin, sdr: selectedSdr });
  return { ok: true, range, scope: isAdmin ? 'admin' : 'self', ...(isAdmin ? { sdrs, selectedSdr } : {}),
    ...(!historyOnly ? { analytics: summarize(metricRows.map(row => normalizeCall(row))) } : {}),
    ...(!analyticsOnly ? { calls, callbacks, history: { hasMore: recentRows.length > 50, nextOffset: offset + 50 } } : {}),
  };
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
  const analysis = findAnalysis(row, analysisMap);
  const crm = await loadCrmContext({ request, phone: row.to_number || row.from_number }).catch(() => null);
  const qualification = await loadQualification({ request, voiceCallId: row.id }).catch(() => null);
  const names = await resolveSdrNames([row], user);
  const call = normalizeCall(row, analysis, crm, qualification, names.get(clean(row.space_user_uid)));
  if (call.analysisWarning) logIntegrity(row, analysis);
  if (!call.analysisWarning && analysis?.transcript && (!qualification || ['draft', 'ai_processing'].includes(qualification.status))) {
    const result = await requestAiQualification({ call: row, request }).catch(() => ({ aiStatus: 'failed' }));
    call.qualification = await loadQualification({ request, voiceCallId: row.id }).catch(() => qualification);
    if (call.qualification) call.qualification.aiStatus = result.aiStatus || 'pending';
  }
  return { ok: true, call };
};

const syncOutcomeToSdrActivity = async ({ call, outcome, user, now = new Date(), commit = commitWritesAsAdmin } = {}) => {
  const mappedOutcome = outcomeToSdrOutcome(outcome);
  const voiceCallId = clean(call?.id);
  if (!voiceCallId || !mappedOutcome) return { ok: false, skipped: true };
  const time = clean(call?.endedAt || call?.ended_at || call?.startedAt || call?.started_at || call?.createdAt || call?.created_at) || now.toISOString();
  const local = dateKeyFor(time, now);
  const id = `space_phone_call_${voiceCallId}`;
  const payload = {
    id,
    clientRequestId: id,
    sdrUid: clean(call?.sdrUid || call?.space_user_uid || user?.sub),
    sdrName: clean(call?.sdrName || call?.space_user_email || user?.name || user?.email || 'SDR'),
    sdrEmail: clean(call?.sdrEmail || call?.space_user_email || user?.email),
    dateKey: local.dateKey,
    localTime: local.localTime,
    eventType: 'call',
    outcome: mappedOutcome,
    sourceOutcome: clean(outcome),
    source: 'space_phone',
    sourceVoiceCallId: voiceCallId,
    phone: clean(call?.toNumber || call?.to_number || call?.number),
    durationSeconds: businessDisposition({ ...call, outcome }).humanTalkTimeSeconds,
    time,
    createdAt: time,
    updatedAt: now.toISOString(),
  };
  const response = await commit({ writes: [{ update: { name: firestoreDocName('sdrActivityEvents', id, { allowTestProject: commit !== commitWritesAsAdmin }), fields: encodeFields(payload).fields } }] });
  if (!response.ok) throw Object.assign(new Error('sdr_activity_bridge_failed'), { status: response.status || 500 });
  return { ok: true, id, outcome: mappedOutcome };
};


const syncQualificationToSdrActivity = async ({ call, qualification, user, now = new Date(), commit = commitWritesAsAdmin } = {}) => {
  const voiceCallId = clean(call?.id);
  if (!voiceCallId || !qualification?.complete) return { ok: false, skipped: true };
  const time = clean(call?.endedAt || call?.ended_at || call?.startedAt || call?.started_at || call?.createdAt || call?.created_at) || now.toISOString();
  const local = dateKeyFor(time, now);
  const id = `space_phone_call_${voiceCallId}`;
  const payload = {
    id,
    clientRequestId: id,
    sdrUid: clean(call?.sdrUid || call?.space_user_uid || user?.sub),
    sdrName: clean(call?.sdrName || call?.space_user_email || user?.name || user?.email || 'SDR'),
    sdrEmail: clean(call?.sdrEmail || call?.space_user_email || user?.email),
    dateKey: local.dateKey,
    localTime: local.localTime,
    eventType: 'call',
    outcome: outcomeToSdrOutcome(clean(call?.outcome)) || 'agendou',
    sourceOutcome: clean(call?.outcome),
    source: 'space_phone',
    sourceVoiceCallId: voiceCallId,
    qualificationStatus: qualification.status,
    qualificationComplete: true,
    datacrazySyncStatus: qualification.datacrazy?.syncStatus || 'blocked',
    phone: clean(call?.toNumber || call?.to_number || call?.number),
    durationSeconds: businessDisposition(call).humanTalkTimeSeconds,
    time,
    updatedAt: now.toISOString(),
  };
  const response = await commit({ writes: [{ update: { name: firestoreDocName('sdrActivityEvents', id, { allowTestProject: commit !== commitWritesAsAdmin }), fields: encodeFields(payload).fields } }] });
  if (!response.ok) throw Object.assign(new Error('qualification_bridge_failed'), { status: response.status || 500 });
  return { ok: true, id };
};

const updateCall = async ({ request, id, user, isAdmin, patch = {}, bridgeCommit } = {}) => {
  if (['callback_schedule','callback_snooze','callback_complete','callback_cancel'].includes(patch.action)) return callbacksQueue.update({request,user,isAdmin,id,patch});
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
  if (Object.prototype.hasOwnProperty.call(patch, 'callbackAt')) {
    body.callback_at = isoOrNull(patch.callbackAt);
    if (patch.callbackAt && (!body.callback_at || Date.parse(body.callback_at) <= Date.now())) throw Object.assign(new Error('callback_future_time_required'), {status:400});
    body.callback_status = body.callback_at ? 'scheduled' : 'cancelled';
  }
  if (body.outcome && body.outcome !== 'retornar_depois') body.callback_status = 'cancelled';
  if (Object.prototype.hasOwnProperty.call(patch, 'endedReason')) body.ended_reason = clean(patch.endedReason).slice(0, 120) || null;
  if (clean(patch.action) === 'retry_ai_qualification') {
    const call = { id: current.id, space_user_uid: current.sdrUid, from_number: current.fromNumber, to_number: current.toNumber, started_at: current.startedAt, duration_seconds: current.durationSeconds, outcome: current.outcome, telnyx_call_leg_id: current.callLegId, telnyx_call_session_id: current.callSessionId };
    const result = await requestAiQualification({ call, request, retry: true });
    console.info('[space-phone] transcription retry', { callId: call.id, aiStatus: result.aiStatus, queued: Boolean(result.queued), reason: result.reason || null });
    return { ok: true, ...result };
  }
  if (clean(patch.action) === 'save_qualification') {
    const qualification = await upsertQualification({ request, call: current, user, patch: patch.qualification || patch });
    return { ok: true, call: { ...current, qualification }, qualification };
  }
  if (clean(patch.action) === 'complete_qualification') {
    const result = await completeQualification({ request, call: current, user });
    return { ok: true, call: { ...current, qualification: result.qualification }, qualification: result.qualification, datacrazy: result.datacrazy, bridge: result.bridge };
  }
  if (!Object.keys(body).length) return { ok: true, call: current };
  const rows = asRows(await request(`/voice_calls?id=eq.${encodeURIComponent(current.id)}`, { method: 'PATCH', body, timeoutMs: 12000 }));
  const call = normalizeCall(rows[0] || { ...current, ...body });
  let bridge = null;
  if (Object.prototype.hasOwnProperty.call(body, 'outcome') && body.outcome && (bridgeCommit || PROJECT_ID)) {
    try {
      bridge = await syncOutcomeToSdrActivity({ call, outcome: body.outcome, user, commit: bridgeCommit || commitWritesAsAdmin });
    } catch (error) {
      console.error('[space-phone] sdr activity bridge failed', { code: error?.message || 'bridge_failed', status: error?.status || 500 });
      bridge = { ok: false, error: 'sdr_activity_bridge_failed' };
    }
  }
  return { ok: true, call, bridge };
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
  normalizeQualification,
  normalizePhoneNumber,
  publicError,
  rangeForPeriod,
  sendJson,
  summarize,
  syncOutcomeToSdrActivity,
  syncQualificationToSdrActivity,
  upsertQualification,
  completeQualification,
  outcomeToSdrOutcome,
  updateCall,
  updateVoiceCall,
  voiceCallSelect,
};
