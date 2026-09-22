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

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'method_not_allowed' });
  try {
    const expected = String(process.env.EVOLUTION_WEBHOOK_SECRET || '').trim();
    const supplied = String(req.headers['x-space-evolution-secret'] || '').trim();
    if (!expected || expected.length < 24 || !equal(expected, supplied)) return sendJson(res, 401, { error: 'unauthorized' });

    const payload = await readJsonBody(req);
    const instance = String(payload?.instance || '').trim();
    const event = String(payload?.event || '').trim().toLowerCase();
    if (!/^[a-zA-Z0-9_-]{1,100}$/.test(instance)) return sendJson(res, 202, { ok: true });

    const connectionRows = (await supabaseFetch(
      '/connections?select=connection_id,external_account_id,status,metadata&provider=eq.evolution_whatsapp&external_account_id=eq.' + encodeURIComponent(instance)
    )).data || [];
    const connection = connectionRows[0];
    if (!connection) return sendJson(res, 202, { ok: true });

    const channels = (await supabaseFetch(
      '/channels?select=channel_id,default_team_id,status&connection_id=eq.' + encodeURIComponent(connection.connection_id) + '&limit=1'
    )).data || [];
    const channel = channels[0];
    if (!channel) return sendJson(res, 202, { ok: true });

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
      const content = text ? { text } : { text: '[' + kind + ']' };
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
            metadata: { provider: 'evolution_whatsapp', instance }
          }
        }
      });
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
