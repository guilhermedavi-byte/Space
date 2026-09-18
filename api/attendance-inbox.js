const { sendJson } = require('../_lib/http');
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

const createHandler = ({ authenticate = requireAttendanceAuth, request = supabaseFetch } = {}) => async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'method_not_allowed' });
  try {
    const actor = await authenticate(req, 'attendance.view');
    if (!['admin', 'growth'].includes(actor.role)) fail('attendance_forbidden', 403);
    const url = new URL(req.url || '/', 'https://space.local');
    const conversationId = clean(url.searchParams.get('conversation_id'), 64);
    if (conversationId) {
      uuid(conversationId);
      const after = Math.max(0, Number.parseInt(String(url.searchParams.get('after') || '0'), 10) || 0);
      const body = { p_actor_uid: actor.uid, p_role: actor.role, p_conversation_id: conversationId, p_after: after, p_limit: limit(url.searchParams.get('limit'), 50) };
      const result = await request('/rpc/attendance_inbox_detail', { method: 'POST', body, timeoutMs: 15000 });
      return sendJson(res, 200, sanitizePayload(result.data || {}));
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
    const status = [400, 401, 403, 422].includes(error.status) ? error.status : Number(error.status) === 42501 || String(error.code || '') === '42501' ? 403 : 503;
    if (status === 503) {
      console.warn('[attendance-inbox] read failed', { status: Number(error.status) || 0, code: String(error.code || error.message || 'unknown').slice(0, 80) });
    }
    return sendJson(res, status, { error: status === 503 ? 'attendance_unavailable' : 'attendance_request_rejected' });
  }
};

module.exports = createHandler();
module.exports.createHandler = createHandler;
