const { sendJson } = require('../../../../_lib/http');
const { resolveAdminRequestAuth } = require('../../../../_lib/admin-request-auth');

const clean = value => String(value == null ? '' : value).trim();
const safeRecordingId = value => clean(value).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 160);

const extractRecordingId = req => {
  const host = clean(req.headers.host) || 'localhost';
  const url = new URL(req.url || '/', `https://${host}`);
  const parts = url.pathname.split('/').filter(Boolean);
  const idx = parts.findIndex((part, index) => part === 'calls' && parts[index + 2] === 'audio');
  return idx >= 0 ? safeRecordingId(parts[idx + 1]) : '';
};

const createHandler = ({ authResolver = resolveAdminRequestAuth, telnyxFetch = fetch } = {}) => async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return sendJson(res, 405, { error: 'method_not_allowed' });
  }

  try {
    const auth = await authResolver(req, { logPrefix: '[admin-sdr-audio]' });
    if (!auth.ok) return sendJson(res, auth.status, auth.body);
    if (clean(auth.session?.role).toLowerCase() !== 'admin') return sendJson(res, 403, { error: 'admin_only' });

    const recordingId = extractRecordingId(req);
    if (!recordingId) return sendJson(res, 422, { error: 'invalid_recording_id' });

    const token = clean(process.env.TELNYX_API_KEY || process.env.TELNYX_API_TOKEN || process.env.Telnyx || '');
    if (!token) return sendJson(res, 503, { error: 'telnyx_not_configured' });

    const response = await telnyxFetch(`https://api.telnyx.com/v2/recordings/${encodeURIComponent(recordingId)}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      redirect: 'error',
      signal: AbortSignal.timeout(15000),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.warn('[admin-sdr-audio] Telnyx unavailable', { status: response.status });
      return sendJson(res, 502, { error: 'recording_unavailable' });
    }

    const mp3 = clean(body?.data?.download_urls?.mp3);
    if (!/^https:\/\//i.test(mp3)) {
      console.warn('[admin-sdr-audio] mp3 missing', { status: response.status, hasMp3: false });
      return sendJson(res, 404, { error: 'recording_audio_unavailable' });
    }
    if (new URL(req.url, 'https://localhost').searchParams.get('format') === 'json') return sendJson(res, 200, { url: mp3 });

    res.statusCode = 307;
    res.setHeader('Location', mp3);
    return res.end();
  } catch (error) {
    console.error('[admin-sdr-audio] failed', { code: error?.name === 'TimeoutError' ? 'timeout' : 'audio_failed' });
    return sendJson(res, 502, { error: 'recording_unavailable' });
  }
};

module.exports = createHandler();
module.exports.createHandler = createHandler;
module.exports._private = { extractRecordingId, safeRecordingId };
