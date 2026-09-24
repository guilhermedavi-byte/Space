const { sendJson } = require('../../../../_lib/http');
const { resolveAdminRequestAuth } = require('../../../../_lib/admin-request-auth');
const { requireResolvedAdminPermission } = require('../../../../_lib/admin-permissions');

const clean = value => String(value == null ? '' : value).trim();
const safeRecordingId = value => clean(value).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 160);

const extractRecordingId = req => {
  const host = clean(req.headers.host) || 'localhost';
  const url = new URL(req.url || '/', `https://${host}`);
  const parts = url.pathname.split('/').filter(Boolean);
  const idx = parts.findIndex((part, index) => part === 'calls' && parts[index + 2] === 'audio');
  return idx >= 0 ? safeRecordingId(parts[idx + 1]) : '';
};

const headerValue = (headers, name) => headers?.get?.(name) || headers?.[name.toLowerCase?.() || name] || headers?.[name] || '';
const writeAudio = async (res, upstream, headOnly = false) => {
  res.statusCode = upstream.status || 200;
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', headerValue(upstream.headers, 'content-type') || 'audio/mpeg');
  for (const name of ['content-length', 'content-range', 'accept-ranges']) {
    const value = headerValue(upstream.headers, name);
    if (value) res.setHeader(name.replace(/(^|-)([a-z])/g, (_, p, c) => p + c.toUpperCase()), value);
  }
  if (!headerValue(upstream.headers, 'accept-ranges')) res.setHeader('Accept-Ranges', 'bytes');
  if (headOnly) return res.end();
  const buffer = Buffer.from(await upstream.arrayBuffer());
  return res.end(buffer);
};

const createHandler = ({ authResolver = resolveAdminRequestAuth, permissionResolver = requireResolvedAdminPermission, telnyxFetch = fetch } = {}) => async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return sendJson(res, 405, { error: 'method_not_allowed' });
  }

  const diagnostic = { path: '/api/admin/sdr/calls/:recordingId/audio', mode: new URL(req.url || '/', 'https://localhost').searchParams.get('format') === 'json' ? 'json' : 'stream' };
  const reply = (status, body) => {
    console.info('[admin-sdr-audio] diagnostic', { ...diagnostic, finalStatus: status });
    return sendJson(res, status, body);
  };
  try {
    const rawKey = String(process.env.TELNYX_API_KEY || '');
    const trimmedKey = rawKey.trim();
    const token = trimmedKey.replace(/^(?:Bearer\s+)+/i, '').trim();
    diagnostic.keyPresent = Boolean(rawKey);
    diagnostic.keyLength = rawKey.length;
    diagnostic.tokenLength = token.length;
    diagnostic.keyStartsKEY = token.startsWith('KEY');
    diagnostic.keyHadBearer = /^(?:Bearer\s+)+/i.test(trimmedKey);
    diagnostic.keyHadWhitespace = rawKey !== trimmedKey;
    const auth = await authResolver(req, { logPrefix: '[admin-sdr-audio]' });
    diagnostic.appAuthStatus = auth.ok ? 200 : auth.status;
    if (!auth.ok) return reply(auth.status, auth.body);
    if (clean(auth.session?.role).toLowerCase() !== 'admin') return reply(403, { error: 'admin_only' });
    const perm = await permissionResolver(auth, 'comercial.sdrPanel.view');
    if (!perm.ok) return reply(perm.status, perm.body);

    const recordingId = extractRecordingId(req);
    if (!recordingId) return reply(422, { error: 'invalid_recording_id' });

    if (!token) return reply(503, { error: 'telnyx_not_configured' });

    const response = await telnyxFetch(`https://api.telnyx.com/v2/recordings/${encodeURIComponent(recordingId)}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      redirect: 'error',
      signal: AbortSignal.timeout(15000),
    });
    const body = await response.json().catch(() => ({}));
    diagnostic.telnyxStatus = response.status;
    diagnostic.hasMp3 = Boolean(body?.data?.download_urls?.mp3);
    if (!response.ok) {
      diagnostic.telnyxErrorCodes = (Array.isArray(body.errors) ? body.errors : []).slice(0, 3).map(error => /^\d{1,8}$/.test(String(error.code)) ? String(error.code) : 'unknown');
      return reply(502, { error: 'recording_unavailable' });
    }

    const mp3 = clean(body?.data?.download_urls?.mp3);
    if (!/^https:\/\//i.test(mp3)) {
      console.warn('[admin-sdr-audio] mp3 missing', { status: response.status, hasMp3: false });
      return reply(404, { error: 'recording_audio_unavailable' });
    }
    if (new URL(req.url, 'https://localhost').searchParams.get('format') === 'json') return reply(200, { url: mp3 });

    const media = await telnyxFetch(mp3, {
      method: req.method === 'HEAD' ? 'HEAD' : 'GET',
      headers: { ...(req.headers.range ? { Range: req.headers.range } : {}) },
      redirect: 'follow',
      signal: AbortSignal.timeout(20000),
    });
    diagnostic.mediaStatus = media.status;
    if (!media.ok && media.status !== 206) return reply(502, { error: 'recording_unavailable' });
    console.info('[admin-sdr-audio] diagnostic', { ...diagnostic, finalStatus: media.status || 200 });
    return writeAudio(res, media, req.method === 'HEAD');
  } catch (error) {
    console.error('[admin-sdr-audio] failed', { code: error?.name === 'TimeoutError' ? 'timeout' : 'audio_failed' });
    return reply(502, { error: 'recording_unavailable' });
  }
};

module.exports = createHandler();
module.exports.createHandler = createHandler;
module.exports._private = { extractRecordingId, safeRecordingId, writeAudio };
