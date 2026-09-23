const { supabaseFetch } = require('./supabase-rest');

const clean = (value, max = 200) => String(value || '').trim().slice(0, max);
const MAX_BYTES = 24 * 1024 * 1024;
const MIME = {
  audio: new Set(['audio/ogg', 'audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/wav', 'audio/webm']),
  image: new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  video: new Set(['video/mp4', 'video/webm', 'video/quicktime']),
  document: null,
  sticker: new Set(['image/webp', 'image/png'])
};

function mediaLabel(kind) {
  return ({ audio: 'Áudio', image: 'Imagem', video: 'Vídeo', document: 'Documento', sticker: 'Sticker' })[kind] || 'Mídia';
}

function safeMime(kind, value) {
  const mime = clean(value, 120).toLowerCase();
  if (!mime) return kind === 'document' ? 'application/octet-stream' : '';
  if (kind === 'document') return mime.length <= 120 ? mime : 'application/octet-stream';
  return MIME[kind]?.has(mime) ? mime : '';
}

function extensionFor(mime, kind) {
  return ({
    'audio/ogg': 'ogg', 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/aac': 'aac', 'audio/wav': 'wav', 'audio/webm': 'webm',
    'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
    'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov',
    'application/pdf': 'pdf'
  })[mime] || (kind === 'document' ? 'bin' : 'dat');
}

function storagePath({ messageId, kind, mime }) {
  const id = clean(messageId, 64).replace(/[^a-zA-Z0-9-]/g, '');
  return `attendance/${id.slice(0, 2)}/${id}.${extensionFor(mime, kind)}`;
}

function evolutionMediaBody(message) {
  const stored = message?.metadata?.evolution_message;
  if (stored && typeof stored === 'object') return stored;
  return { key: { id: message?.external_message_id } };
}

async function evolutionBase64({ instance, message }) {
  const key = String(process.env.EVOLUTION_API_KEY || '').trim();
  let base;
  try { base = new URL(String(process.env.EVOLUTION_API_URL || '').trim()); } catch { return null; }
  if (!key || base.protocol !== 'https:' || !/^[a-zA-Z0-9_-]{1,100}$/.test(instance || '')) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(base.href.replace(/\/$/, '') + `/chat/getBase64FromMediaMessage/${encodeURIComponent(instance)}`, {
      method: 'POST',
      redirect: 'error',
      signal: controller.signal,
      headers: { apikey: key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: evolutionMediaBody(message), convertToMp4: false })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) return null;
    const b64 = clean(payload?.base64 || payload?.data?.base64 || payload?.media || '', MAX_BYTES * 2);
    return b64 ? { base64: b64.replace(/^data:[^;]+;base64,/, ''), mime: clean(payload?.mimetype || payload?.mimeType || payload?.data?.mimetype, 120) } : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function getSupabaseStorageConfig() {
  const url = String(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '');
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '').trim();
  const bucket = clean(process.env.ATTENDANCE_MEDIA_BUCKET || 'attendance-media', 80);
  if (!url || !key || !/^https:\/\//i.test(url) || !/^[a-zA-Z0-9._-]+$/.test(bucket)) return null;
  return { url, key, bucket };
}

async function uploadStorage(path, buffer, mime) {
  const cfg = getSupabaseStorageConfig();
  if (!cfg) return false;
  const response = await fetch(`${cfg.url}/storage/v1/object/${encodeURIComponent(cfg.bucket)}/${path.split('/').map(encodeURIComponent).join('/')}`, {
    method: 'PUT',
    redirect: 'error',
    headers: { Authorization: `Bearer ${cfg.key}`, apikey: cfg.key, 'Content-Type': mime, 'x-upsert': 'true' },
    body: buffer
  }).catch(() => null);
  return !!response?.ok;
}

async function downloadStorage(path) {
  const cfg = getSupabaseStorageConfig();
  if (!cfg || !path) return null;
  const response = await fetch(`${cfg.url}/storage/v1/object/authenticated/${encodeURIComponent(cfg.bucket)}/${String(path).split('/').map(encodeURIComponent).join('/')}`, {
    method: 'GET',
    redirect: 'error',
    headers: { Authorization: `Bearer ${cfg.key}`, apikey: cfg.key }
  }).catch(() => null);
  if (!response?.ok) return null;
  return Buffer.from(await response.arrayBuffer());
}

async function markMedia(messageId, patch) {
  await supabaseFetch('/rpc/attendance_upsert_media_asset', { method: 'POST', body: { p_message_id: messageId, p_asset: patch } }).catch(() => {});
}

async function resolveMedia({ asset, message, connection }) {
  const kind = clean(message?.kind, 40);
  const declared = message?.metadata?.media || message?.content?.media || {};
  const readyPath = asset?.fetch_status === 'ready' ? clean(asset.storage_path, 500) : '';
  const readyMime = safeMime(kind, asset?.mime_type || declared.mime_type);
  if (readyPath && readyMime) {
    const cached = await downloadStorage(readyPath);
    if (cached) return { buffer: cached, mime: readyMime, filename: asset?.filename || declared.filename || `${mediaLabel(kind)}.${extensionFor(readyMime, kind)}` };
  }
  const instance = clean(connection?.instance_name || connection?.external_account_id || message?.metadata?.instance, 100);
  const fetched = await evolutionBase64({ instance, message });
  const mime = safeMime(kind, fetched?.mime || declared.mime_type);
  if (!fetched?.base64 || !mime) {
    await markMedia(message.message_id, { fetch_status: 'failed', error_code: 'media_unavailable', media_type: kind, mime_type: declared.mime_type || null });
    return null;
  }
  const buffer = Buffer.from(fetched.base64, 'base64');
  if (!buffer.length || buffer.length > MAX_BYTES) {
    await markMedia(message.message_id, { fetch_status: 'failed', error_code: 'media_size_invalid', media_type: kind, mime_type: mime });
    return null;
  }
  const path = storagePath({ messageId: message.message_id, kind, mime });
  const uploaded = await uploadStorage(path, buffer, mime);
  await markMedia(message.message_id, {
    fetch_status: uploaded ? 'ready' : 'failed',
    error_code: uploaded ? null : 'storage_upload_failed',
    media_type: kind,
    mime_type: mime,
    filename: declared.filename || `${mediaLabel(kind)}.${extensionFor(mime, kind)}`,
    size_bytes: buffer.length,
    duration_seconds: declared.duration || null,
    storage_path: uploaded ? path : null,
    provider_media_id: message.external_message_id || null,
    external_message_id: message.external_message_id || null
  });
  return uploaded ? { buffer, mime, filename: declared.filename || `${mediaLabel(kind)}.${extensionFor(mime, kind)}` } : null;
}

module.exports = { mediaLabel, resolveMedia };
