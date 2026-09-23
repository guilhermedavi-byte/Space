const { readJsonBody, sendJson } = require('../../_lib/http');
const { requireAttendanceAuth } = require('../_lib/attendance-auth');
const { assertAttendanceEnvironment, fail, only, uuid, text } = require('../_lib/attendance-domain');
const { supabaseFetch } = require('../_lib/supabase-rest');

const APP_ID = '1026298976506797';
const GRAPH_VERSION = 'v21.0';
const pick = (...values) => values.map(v => String(v || '').trim()).find(Boolean) || '';
const cleanGraphText = value => String(value || '').trim().slice(0, 256);
const getEnv = () => ({
  appId: String(process.env.META_APP_ID || process.env.WHATSAPP_META_APP_ID || APP_ID).trim(),
  appSecret: String(process.env.META_APP_SECRET || process.env.FACEBOOK_APP_SECRET || '').trim(),
});

const graphRequest = async (path, params = {}, accessToken = '') => {
  const url = new URL(`https://graph.facebook.com/${GRAPH_VERSION}${path.startsWith('/') ? path : `/${path}`}`);
  Object.entries(params).forEach(([key, value]) => { if (value != null && String(value).trim()) url.searchParams.set(key, String(value)); });
  if (accessToken) url.searchParams.set('access_token', accessToken);
  const res = await fetch(url, { method: 'GET', redirect: 'error' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error('meta_graph_request_failed');
    error.status = res.status;
    error.code = data?.error?.code || data?.error?.type || 'meta_graph_request_failed';
    throw error;
  }
  return data;
};

const extractSession = (session = {}) => {
  const data = session?.data && typeof session.data === 'object' ? session.data : session;
  return {
    wabaId: pick(data.waba_id, data.wabaId, data.whatsapp_business_account_id, data.whatsappBusinessAccountId),
    phoneNumberId: pick(data.phone_number_id, data.phoneNumberId, data.phone_number?.id, data.phoneNumber?.id),
  };
};

const createHandler = ({ authenticate = requireAttendanceAuth, request = supabaseFetch, graph = graphRequest, environment = getEnv, checkEnvironment = assertAttendanceEnvironment } = {}) => async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'method_not_allowed' });
  try {
    checkEnvironment();
    const actor = await authenticate(req, 'attendance.manage', undefined, { adminPermission: 'attendance.connections.create' });
    if (!['admin', 'growth'].includes(actor.role)) fail('attendance_forbidden', 403);
    const body = await readJsonBody(req).catch(() => fail('attendance_invalid_json', 400));
    only(body, ['connection_id', 'code', 'session', 'state']);
    uuid(body.connection_id);
    text(body.code, 4096);
    text(body.state, 160);
    const env = environment();
    if (!env.appId || !env.appSecret || env.appSecret.length < 16) fail('meta_not_configured', 503);
    const session = extractSession(body.session || {});
    if (!session.wabaId || !session.phoneNumberId) fail('attendance_meta_session_incomplete', 422);

    const token = await graph('/oauth/access_token', { client_id: env.appId, client_secret: env.appSecret, code: body.code });
    const accessToken = String(token.access_token || '').trim();
    if (!accessToken) fail('attendance_meta_token_exchange_failed', 503);

    const numbers = await graph(`/${session.wabaId}/phone_numbers`, { fields: 'id,display_phone_number,verified_name,status,platform_type' }, accessToken);
    const phone = Array.isArray(numbers.data) ? numbers.data.find(item => String(item.id) === session.phoneNumberId) : null;
    if (!phone) fail('attendance_meta_asset_mismatch', 403);

    await graph(`/${session.wabaId}`, { fields: 'id,name' }, accessToken);
    const rpc = await request('/rpc/attendance_complete_meta_embedded_signup', { method: 'POST', body: {
      p_connection_id: body.connection_id,
      p_waba_id: session.wabaId,
      p_phone_number_id: session.phoneNumberId,
      p_display_phone: cleanGraphText(phone.display_phone_number),
      p_verified_name: cleanGraphText(phone.verified_name),
      p_actor_uid: actor.uid,
      p_role: actor.role,
    } });
    return sendJson(res, 200, { ok: true, connection: rpc.data || {} });
  } catch (error) {
    const status = [400, 401, 403, 409, 422].includes(error.status) ? error.status : 503;
    if (status === 503) console.warn('[attendance-meta-signup] failed', { status: Number(error.status) || 0, code: String(error.code || error.message || 'unknown').slice(0, 80) });
    return sendJson(res, status, { error: status === 503 ? 'attendance_meta_unavailable' : 'attendance_request_rejected' });
  }
};

module.exports = createHandler();
module.exports.createHandler = createHandler;
