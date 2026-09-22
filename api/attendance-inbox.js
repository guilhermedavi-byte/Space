const { randomUUID } = require('node:crypto');
const { readJsonBody, sendJson } = require('../_lib/http');
const { requireAttendanceAuth } = require('./_lib/attendance-auth');
const { fail, uuid } = require('./_lib/attendance-domain');
const { supabaseFetch } = require('./_lib/supabase-rest');

const clean = (value, max = 120) => String(value || '').trim().slice(0, max);
const limit = (value, fallback = 50) => {
  const n = Number.parseInt(String(value || ''), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.min(n, 50));
};
const sanitizePayload = (value) => {
  const text = JSON.stringify(value || {});
  if (/(token|secret|authorization|credential|api[_-]?key|webhook_raw|raw_event)/i.test(text)) {
    return JSON.parse(text.replace(/token|secret|authorization|credential|api[_-]?key|webhook_raw|raw_event/gi, 'redacted'));
  }
  return value;
};
const evolutionRequest = async (instance, number, text) => {
  const key = String(process.env.EVOLUTION_API_KEY || '').trim();
  const baseRaw = String(process.env.EVOLUTION_API_URL || '').trim();
  let base;
  try { base = new URL(baseRaw); } catch { fail('evolution_not_configured', 503); }
  if (!key || base.protocol !== 'https:' || !/^[a-zA-Z0-9_-]{1,100}$/.test(instance)) fail('evolution_not_configured', 503);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(base.href.replace(/\/$/, '') + '/message/sendText/' + encodeURIComponent(instance), {
      method: 'POST', redirect: 'error', signal: controller.signal,
      headers: { apikey: key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ number, text, linkPreview: true }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.warn('[attendance-inbox] evolution send failed', { status: response.status });
      fail(response.status === 401 || response.status === 403 ? 'evolution_configuration_error' : 'evolution_unavailable', 503);
    }
    return payload;
  } catch (error) {
    if (String(error.code || '').startsWith('evolution_')) throw error;
    console.warn('[attendance-inbox] evolution send failed', { timeout: error.name === 'AbortError' });
    fail('evolution_unavailable', 503);
  } finally { clearTimeout(timer); }
};

const createHandler = ({ authenticate = requireAttendanceAuth, request = supabaseFetch, sendEvolution = evolutionRequest } = {}) => async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!['GET', 'POST'].includes(req.method)) return sendJson(res, 405, { error: 'method_not_allowed' });
  try {
    const actor = await authenticate(req, req.method === 'POST' ? 'attendance.reply' : 'attendance.view');
    if (!['admin', 'growth'].includes(actor.role)) fail('attendance_forbidden', 403);
    const url = new URL(req.url || '/', 'https://space.local');

    if (req.method === 'POST') {
      const body = await readJsonBody(req).catch(() => fail('attendance_invalid_json', 400));
      const conversationId = clean(body?.conversation_id, 64);
      const text = clean(body?.text, 4000);
      const clientRequestId = clean(body?.client_request_id || randomUUID(), 128);
      if (!conversationId || !text) fail('attendance_invalid_request', 422);
      uuid(conversationId);

      const detailResult = await request('/rpc/attendance_inbox_detail', {
        method: 'POST',
        body: { p_actor_uid: actor.uid, p_role: actor.role, p_conversation_id: conversationId, p_after: 0, p_limit: 1 },
        timeoutMs: 15000,
      });
      const detail = detailResult.data || {};
      const connection = detail?.conversation?.connection || {};
      const contact = detail?.contact || {};
      if (connection.provider !== 'evolution_whatsapp' || connection.status !== 'active' || connection.setup_pending) {
        fail('attendance_channel_disabled', 409);
      }
      const instance = clean(connection.instance_name || '', 100) || clean(
        (await request('/connections?select=external_account_id&connection_id=eq.' + encodeURIComponent(connection.connection_id), { timeoutMs: 8000 })).data?.[0]?.external_account_id,
        100
      );
      const number = String(contact.phone || '').replace(/\D/g, '');
      if (!instance || !/^\d{7,16}$/.test(number)) fail('attendance_invalid_recipient', 422);

      const appended = await request('/rpc/attendance_append_message', {
        method: 'POST',
        body: {
          p_actor_uid: actor.uid,
          p_conversation_id: conversationId,
          p_message: { direction: 'outbound', kind: 'text', content: { text }, client_request_id: clientRequestId, metadata: { provider: 'evolution_whatsapp' } },
        },
        timeoutMs: 15000,
      });
      const messageId = appended.data?.message_id;
      try {
        const provider = await sendEvolution(instance, number, text);
        const externalId = clean(provider?.key?.id || provider?.id || provider?.messageId || '', 200) || null;
        await request('/rpc/attendance_set_message_transport', {
          method: 'POST',
          body: { p_message_id: messageId, p_status: 'sent', p_external_message_id: externalId, p_metadata: { provider: 'evolution_whatsapp' } },
          timeoutMs: 15000,
        });
        return sendJson(res, 200, { ok: true, message_id: messageId, external_message_id: externalId, status: 'sent' });
      } catch (error) {
        await request('/rpc/attendance_set_message_transport', {
          method: 'POST',
          body: { p_message_id: messageId, p_status: 'failed', p_external_message_id: null, p_metadata: { provider: 'evolution_whatsapp', send_failed: true } },
          timeoutMs: 15000,
        }).catch(() => {});
        throw error;
      }
    }

    const conversationId = clean(url.searchParams.get('conversation_id'), 64);
    if (conversationId) {
      uuid(conversationId);
      const after = Math.max(0, Number.parseInt(String(url.searchParams.get('after') || '0'), 10) || 0);
      const body = { p_actor_uid: actor.uid, p_role: actor.role, p_conversation_id: conversationId, p_after: after, p_limit: limit(url.searchParams.get('limit'), 50) };
      const result = await request('/rpc/attendance_inbox_detail', { method: 'POST', body, timeoutMs: 15000 });
      const payload = sanitizePayload(result.data || {});
      const conn = payload?.conversation?.connection || {};
      const enabled = conn.provider === 'evolution_whatsapp' && conn.status === 'active' && conn.setup_pending !== true;
      payload.composer = enabled
        ? { enabled: true, reason: 'Responder pelo WhatsApp conectado via Evolution.' }
        : { enabled: false, reason: conn.provider === 'evolution_whatsapp' ? 'Reconecte o WhatsApp para enviar mensagens.' : 'Envio será habilitado após concluir a conexão com a Meta.' };
      return sendJson(res, 200, payload);
    }
    const filter = clean(url.searchParams.get('filter'), 24) || 'all';
    if (!['all', 'unread', 'mine', 'unassigned'].includes(filter)) fail('attendance_invalid_request', 422);
    const teamId = clean(url.searchParams.get('team_id'), 64);
    if (teamId) uuid(teamId);
    const filters = { filter, limit: limit(url.searchParams.get('limit'), 50) };
    const q = clean(url.searchParams.get('q'), 80);
    if (q) filters.q = q;
    if (teamId) filters.team_id = teamId;
    const result = await request('/rpc/attendance_inbox_list', { method: 'POST', body: { p_actor_uid: actor.uid, p_role: actor.role, p_filters: filters }, timeoutMs: 15000 });
    const data = result.data || {};
    return sendJson(res, 200, sanitizePayload({ rows: Array.isArray(data.rows) ? data.rows : [], teams: Array.isArray(data.teams) ? data.teams : [], limit: data.limit || filters.limit }));
  } catch (error) {
    const status = [400, 401, 403, 409, 422].includes(error.status) ? error.status : Number(error.status) === 42501 || String(error.code || '') === '42501' ? 403 : 503;
    if (status === 503) {
      console.warn('[attendance-inbox] request failed', { status: Number(error.status) || 0, code: String(error.code || error.message || 'unknown').slice(0, 80) });
    }
    const safe = new Set(['evolution_not_configured','evolution_configuration_error','evolution_unavailable','attendance_channel_disabled','attendance_invalid_recipient']);
    return sendJson(res, status, { error: safe.has(error.code) ? error.code : status === 503 ? 'attendance_unavailable' : 'attendance_request_rejected' });
  }
};

module.exports = createHandler();
module.exports.createHandler = createHandler;
