const crypto = require('node:crypto');
const { readJsonBody, sendJson } = require('../../../_lib/http');
const { supabaseFetch } = require('../../_lib/supabase-rest');

const equal = (a, b) => {
  const x = Buffer.from(String(a || ''));
  const y = Buffer.from(String(b || ''));
  return x.length === y.length && x.length > 0 && crypto.timingSafeEqual(x, y);
};
const textOf = message => {
  if (!message || typeof message !== 'object') return '';
  return String(
    message.conversation ||
    message.extendedTextMessage?.text ||
    message.imageMessage?.caption ||
    message.videoMessage?.caption ||
    message.documentMessage?.caption ||
    message.documentWithCaptionMessage?.message?.documentMessage?.caption ||
    ''
  ).trim();
};
const kindOf = message => {
  if (message?.imageMessage) return 'image';
  if (message?.videoMessage) return 'video';
  if (message?.audioMessage) return 'audio';
  if (message?.documentMessage || message?.documentWithCaptionMessage) return 'document';
  if (message?.stickerMessage) return 'sticker';
  return 'text';
};
const stampOf = value => {
  const n = Number(value);
  const d = Number.isFinite(n) && n > 0 ? new Date(n > 1e12 ? n : n * 1000) : new Date();
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
};
const normalizePhone = jid => {
  const raw = String(jid || '').split('@')[0].split(':')[0].replace(/\D/g, '');
  return /^\d{7,16}$/.test(raw) ? raw : '';
};
const mediaOf = message => {
  const unwrap = message?.documentWithCaptionMessage?.message || message || {};
  const type = kindOf(unwrap);
  const src = unwrap.imageMessage || unwrap.videoMessage || unwrap.audioMessage || unwrap.documentMessage || unwrap.stickerMessage || null;
  if (!src || type === 'text') return null;
  const size = Number(src.fileLength?.low ?? src.fileLength ?? src.fileLength?.toString?.());
  const duration = Number(src.seconds ?? src.duration);
  return {
    media_type: type,
    mime_type: String(src.mimetype || src.mimeType || '').slice(0, 120) || null,
    filename: String(src.fileName || src.title || '').slice(0, 220) || null,
    size: Number.isFinite(size) && size > 0 ? Math.min(size, 100 * 1024 * 1024) : null,
    duration: Number.isFinite(duration) && duration >= 0 ? Math.min(duration, 24 * 60 * 60) : null,
    caption: textOf(message) || null
  };
};
const compactEvolutionMessage = (d, message) => {
  const unwrap = message?.documentWithCaptionMessage?.message || message || {};
  const type = kindOf(unwrap);
  const src = unwrap.imageMessage || unwrap.videoMessage || unwrap.audioMessage || unwrap.documentMessage || unwrap.stickerMessage || null;
  if (!src || type === 'text') return null;
  const numberish = value => {
    const raw = typeof value === 'bigint' ? value.toString() : value?.toString ? value.toString() : value;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? Math.min(n, 100 * 1024 * 1024) : undefined;
  };
  return {
    key: {
      id: String(d?.key?.id || '').slice(0, 256),
      remoteJid: String(d?.key?.remoteJid || d?.key?.remoteJidAlt || '').slice(0, 256),
      fromMe: d?.key?.fromMe === true,
      participant: String(d?.key?.participant || '').slice(0, 256) || null
    },
    messageType: `${type}Message`,
    message: {
      [`${type}Message`]: {
        url: typeof src.url === 'string' ? src.url.slice(0, 2048) : undefined,
        directPath: typeof src.directPath === 'string' ? src.directPath.slice(0, 2048) : undefined,
        mediaKey: typeof src.mediaKey === 'string' ? src.mediaKey.slice(0, 256) : undefined,
        mimetype: typeof src.mimetype === 'string' ? src.mimetype.slice(0, 120) : undefined,
        fileSha256: typeof src.fileSha256 === 'string' ? src.fileSha256.slice(0, 256) : undefined,
        fileEncSha256: typeof src.fileEncSha256 === 'string' ? src.fileEncSha256.slice(0, 256) : undefined,
        fileLength: numberish(src.fileLength),
        seconds: numberish(src.seconds),
        fileName: typeof src.fileName === 'string' ? src.fileName.slice(0, 220) : undefined,
        caption: typeof src.caption === 'string' ? src.caption.slice(0, 2000) : undefined
      }
    }
  };
};
const evolutionPost = async (path, body) => {
  const key = String(process.env.EVOLUTION_API_KEY || '').trim();
  let base;
  try { base = new URL(String(process.env.EVOLUTION_API_URL || '').trim()); } catch { return null; }
  if (!key || base.protocol !== 'https:') return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(base.href.replace(/\/$/, '') + path, {
      method: 'POST',
      redirect: 'error',
      signal: controller.signal,
      headers: { apikey: key, 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {})
    });
    if (!response.ok) return null;
    return await response.json().catch(() => null);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
};
const refreshAvatar = async ({ instance, connectionId, externalIdentifier, identifierType, phone }) => {
  if (!phone) return;
  const payload = await evolutionPost(`/chat/fetchProfilePictureUrl/${encodeURIComponent(instance)}`, { number: phone });
  const url = String(payload?.profilePictureUrl || payload?.picture || '').trim();
  if (!/^https:\/\/.{8,2048}$/i.test(url)) return;
  await supabaseFetch('/rpc/attendance_update_contact_avatar_by_identity', {
    method: 'POST',
    body: {
      p_connection_id: connectionId,
      p_identifier_type: identifierType,
      p_external_identifier: externalIdentifier,
      p_avatar_url: url,
      p_avatar_source: 'whatsapp_profile',
      p_avatar_expires_at: null
    }
  }).catch(() => {});
};

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'method_not_allowed' });
  try {
    const expected = String(process.env.EVOLUTION_WEBHOOK_SECRET || process.env.EVOLUTION_API_KEY || '').trim();
    const supplied = String(req.headers['x-space-evolution-secret'] || '').trim();
    if (!expected || expected.length < 24 || !equal(expected, supplied)) return sendJson(res, 401, { error: 'unauthorized' });

    const payload = await readJsonBody(req);
    const instance = String(payload?.instance || '').trim();
    const event = String(payload?.event || '').trim().toLowerCase();
    if (!/^[a-zA-Z0-9_-]{1,100}$/.test(instance)) return sendJson(res, 202, { ok: true });
    if (event === 'ping') return sendJson(res, 200, { ok: true, ignored: 'ping' });

    const resolved = (await supabaseFetch('/rpc/attendance_evolution_resolve_instance', {
      method: 'POST',
      body: { p_instance_name: instance }
    })).data || {};
    if (!resolved.found) return sendJson(res, 202, { ok: true });
    if (!resolved.channel_id) return sendJson(res, 202, { ok: true, ignored: 'no_channel' });
    const connection = {
      connection_id: resolved.connection_id,
      status: resolved.connection_status,
      metadata: resolved.connection_metadata || {}
    };
    const channel = {
      channel_id: resolved.channel_id,
      default_team_id: resolved.team_id,
      status: resolved.channel_status
    };

    if (event === 'messages.upsert') {
      const d = payload.data || {};
      if (d?.key?.fromMe === true) return sendJson(res, 200, { ok: true, ignored: 'from_me' });
      const remoteJid = String(d?.key?.remoteJid || d?.key?.remoteJidAlt || '');
      if (!remoteJid || /@g\.us$|status@broadcast$/i.test(remoteJid)) return sendJson(res, 200, { ok: true, ignored: 'non_direct' });
      const phone = normalizePhone(remoteJid);
      const externalMessageId = String(d?.key?.id || '').trim();
      if (!phone || !externalMessageId) return sendJson(res, 200, { ok: true, ignored: 'invalid_message' });

      const text = textOf(d.message);
      const kind = kindOf(d.message);
      const media = mediaOf(d.message);
      const content = text ? { text } : {};
      if (media) content.media = { ...media, fetch_status: 'pending' };
      await supabaseFetch('/rpc/attendance_ingest_message', {
        method: 'POST',
        body: {
          p_event: {
            provider: 'evolution_whatsapp',
            connection_id: connection.connection_id,
            channel_id: channel.channel_id,
            external_event_id: externalMessageId,
            external_message_id: externalMessageId,
            external_contact_id: remoteJid,
            identifier_type: 'whatsapp_jid',
            display_name: String(d.pushName || phone).slice(0, 200),
            phone_raw: '+' + phone,
            country_calling_code: null,
            external_conversation_id: remoteJid,
            kind,
            content,
            provider_timestamp: stampOf(d.messageTimestamp),
            external_reply_to_id: d?.message?.extendedTextMessage?.contextInfo?.stanzaId || null,
            metadata: {
              provider: 'evolution_whatsapp',
              instance,
              media: media ? { ...media, fetch_status: 'pending' } : undefined,
              evolution_message: compactEvolutionMessage(d, d.message)
            }
          }
        }
      });
      refreshAvatar({ instance, connectionId: connection.connection_id, externalIdentifier: remoteJid, identifierType: 'whatsapp_jid', phone }).catch(() => {});
      return sendJson(res, 200, { ok: true });
    }

    if (event === 'messages.update') {
      const d = payload.data || {};
      const externalId = String(d.keyId || d?.key?.id || '').trim();
      const map = { READ: 'read', PLAYED: 'read', DELIVERY_ACK: 'delivered', DELIVERED: 'delivered', SERVER_ACK: 'sent', SENT: 'sent', ERROR: 'failed', FAILED: 'failed' };
      const status = map[String(d.status || '').toUpperCase()];
      if (externalId && status) {
        await supabaseFetch('/rpc/attendance_set_transport_by_external', {
          method: 'POST',
          body: { p_channel_id: channel.channel_id, p_external_message_id: externalId, p_status: status }
        });
      }
      return sendJson(res, 200, { ok: true });
    }

    if (event === 'connection.update') {
      const raw = String(payload?.data?.state || payload?.data?.status || '').toLowerCase();
      const state = raw === 'open' ? 'open' : raw === 'connecting' ? 'connecting' : ['close','closed','refused'].includes(raw) ? 'disconnected' : null;
      if (state) {
        await supabaseFetch('/rpc/attendance_evolution_connection', {
          method: 'POST',
          body: {
            p_actor_uid: 'evolution_webhook',
            p_admin: true,
            p_action: 'sync',
            p_id: connection.connection_id,
            p_input: { connection_state: state, phone: connection.metadata?.phone || null, qr_available: false }
          }
        });
      }
      return sendJson(res, 200, { ok: true });
    }

    return sendJson(res, 200, { ok: true, ignored: event || 'unknown' });
  } catch (error) {
    console.warn('[attendance-evolution-webhook]', { status: Number(error.status) || 0, code: String(error.code || error.message || 'unknown').slice(0, 80) });
    return sendJson(res, 503, { error: 'attendance_unavailable' });
  }
};
