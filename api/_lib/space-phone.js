const crypto = require('node:crypto');
const { resolveAdminRequestAuth } = require('./admin-request-auth');
const { requireResolvedAdminPermission } = require('./admin-permissions');
const { supabaseFetch } = require('./supabase-rest');

const isSpacePhoneEnabled = () => String(process.env.SPACE_PHONE_ENABLED || '').trim().toLowerCase() === 'true';

const sendJson = (res, status, body) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
};

const normalizeRole = value => String(value || '').trim().toLowerCase();

const assertVoiceAccess = async (req, { authResolver = resolveAdminRequestAuth, permissionResolver = requireResolvedAdminPermission } = {}) => {
  if (!isSpacePhoneEnabled()) {
    return { ok: false, status: 403, body: { error: 'space_phone_disabled' } };
  }
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

const normalizePhoneNumber = value => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const plus = raw.startsWith('+');
  const digits = raw.replace(/\D/g, '');
  if (!digits || digits.length < 8 || digits.length > 15) return '';
  return `${plus ? '+' : '+'}${digits}`;
};

const safeText = value => String(value || '').trim().slice(0, 240);

const selectSingle = async (path, { supabase = supabaseFetch } = {}) => {
  const response = await supabase(path, { method: 'GET', headers: { Accept: 'application/json' } });
  const rows = Array.isArray(response.data) ? response.data : [];
  return rows[0] || null;
};

const loadVoiceIdentity = async (uid, { supabase = supabaseFetch } = {}) => {
  const safeUid = encodeURIComponent(String(uid || '').trim());
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
    space_user_uid: String(session?.sub || ''),
    space_user_email: String(session?.email || ''),
    lead_id: safeText(context.leadId) || null,
    opportunity_id: safeText(context.opportunityId) || null,
    lead_name: safeText(context.leadName) || null,
    from_number: normalizePhoneNumber(identity?.caller_id || process.env.TELNYX_DEFAULT_FROM_NUMBER),
    to_number: toNumber,
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
  const safeCallId = String(callId || '').trim();
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
  const uid = encodeURIComponent(String(session?.sub || '').trim());
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

const createTelnyxCredentialToken = async ({ credentialId, fetchImpl = fetch, apiKey = process.env.TELNYX_API_KEY }) => {
  const safeCredentialId = String(credentialId || '').trim();
  const safeApiKey = String(apiKey || '').trim();
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
  const response = await fetchImpl(url, {
    method: 'POST',
    redirect: 'error',
    headers: {
      Authorization: `Bearer ${safeApiKey}`,
      Accept: 'text/plain',
    },
  });
  const text = String(await response.text().catch(() => '') || '').trim();
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

module.exports = {
  assertVoiceAccess,
  createTelnyxCredentialToken,
  createVoiceCall,
  isSpacePhoneEnabled,
  loadVoiceIdentity,
  mapErrorStatus,
  normalizePhoneNumber,
  sendJson,
  updateVoiceCall,
};
