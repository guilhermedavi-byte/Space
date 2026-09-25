const crypto = require('node:crypto');
const {unwrap,remoteIdentity,transportStatus,quotedId}=require('../../_lib/attendance-provider-message');
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
  const n = Number(value?.low ?? value);
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
    ptt: src.ptt === true,
    caption: textOf(message) || null
  };
};
const { compactEvolutionMessage } = require('../../_lib/attendance-media-envelope');
// Optional identity enrichment: shared TTL/cache, never gates message ingestion.
const { byIdentity: refreshContactAvatar, logFailure: logAvatarFailure } = require('../../_lib/attendance-avatar');
const refreshAvatar = ({ connectionId, externalIdentifier, identifierType }) => refreshContactAvatar({
  connection_id: connectionId, identifier_type: identifierType, external_identifier: externalIdentifier
});

const createHandler=({request=supabaseFetch,refresh=refreshAvatar,env=process.env}={})=>async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'method_not_allowed' });
  try {
    const expected = String(env.EVOLUTION_WEBHOOK_SECRET || env.EVOLUTION_API_KEY || '').trim();
    const supplied = String(req.headers['x-space-evolution-secret'] || '').trim();
    if (!expected || expected.length < 24 || !equal(expected, supplied)) return sendJson(res, 401, { error: 'unauthorized' });

    const payload = await readJsonBody(req);
    const instance = String(payload?.instance || '').trim();
    const event = String(payload?.event || '').trim().toLowerCase().replace(/_/g,'.');
    if (!/^[a-zA-Z0-9_-]{1,100}$/.test(instance)) return sendJson(res, 202, { ok: true });
    if (event === 'ping') return sendJson(res, 200, { ok: true, ignored: 'ping' });

    const resolved = (await request('/rpc/attendance_evolution_resolve_instance', {
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
      const outbound=d?.key?.fromMe===true;
      const identity=remoteIdentity(d.key);
      const externalMessageId=String(d?.key?.id||'').trim();
      if(!identity||!externalMessageId)return sendJson(res,200,{ok:true,ignored:'non_direct_or_invalid'});
      const remoteJid=identity.jid,phone=identity.phone;
      d.message=unwrap(d.message);
      if(outbound)console.info('[attendance-provider]',{event:'provider_outbound_received',from_me:true,has_id:!!externalMessageId,has_remote_jid:!!d.key.remoteJid,has_remote_jid_alt:!!d.key.remoteJidAlt,has_participant:!!d.key.participant,has_timestamp:!!d.messageTimestamp,message_type:kindOf(d.message)});
      const text = textOf(d.message);
      const kind = kindOf(d.message);
      const media = mediaOf(d.message);
      if(kind==='text'&&!text)return sendJson(res,200,{ok:true,ignored:'unsupported_message'});
      const content = text ? { text } : {};
      if (media) content.media = { ...media, fetch_status: 'pending' };
      const ingested=await request('/rpc/attendance_ingest_provider_message', {
        method: 'POST',
        body: {
          p_event: {
            provider: 'evolution_whatsapp',
            direction:outbound?'outbound':'inbound',
            transport_status:outbound?(transportStatus(d.status)||'sent'):'received',
            identity_aliases:identity.aliases,
            connection_id: connection.connection_id,
            channel_id: channel.channel_id,
            external_event_id: externalMessageId,
            external_message_id: externalMessageId,
            external_contact_id: remoteJid,
            identifier_type: 'whatsapp_jid',
            display_name: String(outbound ? phone || 'Contato WhatsApp' : d.pushName || phone || 'Contato WhatsApp').slice(0,200),
            phone_raw: phone ? '+' + phone : null,
            country_calling_code: null,
            external_conversation_id: remoteJid,
            kind,
            content,
            provider_timestamp: stampOf(d.messageTimestamp),
            external_reply_to_id: quotedId(d.message),
            metadata: {
              provider: 'evolution_whatsapp',
              instance,
              media: media ? { ...media, fetch_status: 'pending' } : undefined,
              evolution_message: compactEvolutionMessage(d, d.message)
            }
          }
        }
      });
      if(outbound)console.info('[attendance-provider]',{event:ingested.data?.deferred?'provider_outbound_deferred':'provider_outbound_'+(ingested.data?.outcome||'inserted'),deferred:!!ingested.data?.deferred});
      refresh({ instance, connectionId: connection.connection_id, externalIdentifier: remoteJid, identifierType: 'whatsapp_jid', phone }).catch(logAvatarFailure);
      return sendJson(res, 200, { ok: true });
    }

    if (event === 'messages.update') {
      const d = payload.data || {};
      const externalId = String(d.keyId || d?.key?.id || '').trim();
      const status = transportStatus(d.status ?? d.update?.status);
      if (externalId && status) {
        await request('/rpc/attendance_set_transport_by_external', {
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
        await request('/rpc/attendance_evolution_connection', {
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
    console.warn('[attendance-evolution-webhook]', { event:'provider_outbound_failed', status:Number(error.status)||0, code:/^[0-9A-Z]{5}$/.test(error.code||'')?error.code:'attendance_provider_failed' });
    return sendJson(res, 503, { error: 'attendance_unavailable' });
  }
};

module.exports=createHandler();
module.exports.createHandler=createHandler;
