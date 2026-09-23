const { sendJson } = require('../../_lib/http');
const { requireAttendanceAuth } = require('../_lib/attendance-auth');
const { fail, uuid } = require('../_lib/attendance-domain');
const { supabaseFetch } = require('../_lib/supabase-rest');
const { resolveMedia, safeFilename, ERROR_CODES } = require('../_lib/attendance-media');

const clean = (value, max = 120) => String(value || '').trim().slice(0, max);

const createHandler = ({ authenticate = requireAttendanceAuth, request = supabaseFetch, mediaResolver = resolveMedia } = {}) => async (req, res) => {
  res.setHeader('Cache-Control', 'private, max-age=300');
  if (req.method !== 'GET' && req.method !== 'HEAD') return sendJson(res, 405, { error: 'method_not_allowed' });
  try {
    const actor = await authenticate(req, 'attendance.view', undefined, { adminPermission: 'attendance.inbox.view' });
    if (!['admin', 'growth'].includes(actor.role)) fail('attendance_forbidden', 403);
    const url = new URL(req.url || '/', 'https://space.local');
    const messageId = clean(url.searchParams.get('message_id'), 64);
    uuid(messageId);
    const readAsset = () => request('/rpc/attendance_get_media_asset', {
      method: 'POST',
      body: { p_actor_uid: actor.uid, p_role: actor.role, p_message_id: messageId },
      timeoutMs: 15000
    });
    const data = (await readAsset()).data || {};
    const message = data.message || {};
    if (!['audio', 'image', 'video', 'document', 'sticker'].includes(message.kind)) fail('attendance_media_not_found', 404);
    const media = await mediaResolver({ asset: data.asset || {}, message, connection: data.connection || {}, reloadAsset: async () => (await readAsset()).data?.asset || {} });
    if (!media?.buffer || !media.mime) fail('attendance_media_unavailable', 404);
    const total = media.buffer.length;
    let start = 0, end = total - 1;
    const range = req.method === 'GET' ? req.headers?.range : null;
    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(String(range));
      if (!match || (!match[1] && !match[2])) {
        res.setHeader('Content-Range', `bytes */${total}`); return sendJson(res, 416, { error: 'invalid_range' });
      }
      start = match[1] ? Number(match[1]) : Math.max(0, total - Number(match[2]));
      end = match[1] && match[2] ? Math.min(Number(match[2]), total - 1) : total - 1;
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= total) {
        res.setHeader('Content-Range', `bytes */${total}`); return sendJson(res, 416, { error: 'invalid_range' });
      }
      res.setHeader('Content-Range', `bytes ${start}-${end}/${total}`);
    }
    res.statusCode = range ? 206 : 200;
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Type', media.mime);
    res.setHeader('Content-Length', end - start + 1);
    res.setHeader('Content-Disposition', `${message.kind === 'document' ? 'attachment' : 'inline'}; filename="${safeFilename(media.filename)}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Vary', 'Cookie, Authorization');
    res.setHeader('X-Attendance-Media-Source', media.source || 'storage');
    if (req.method === 'HEAD') return res.end();
    return res.end(media.buffer.subarray(start, end + 1));
  } catch (error) {
    const status = error.code === '42501' ? 403 : [400, 401, 403, 404, 409, 422].includes(error.status) ? error.status : 503;
    if (status === 503) console.warn('[attendance-media] failed', { code: ERROR_CODES.has(error.code) ? error.code : 'media_backend_failed' });
    if (error.code === 'media_fetching') res.setHeader('Retry-After', '2');
    return sendJson(res, status, { error: status === 404 ? 'attendance_media_unavailable' : status === 503 ? 'attendance_unavailable' : 'attendance_request_rejected' });
  }
};

module.exports = createHandler();
module.exports.createHandler = createHandler;
