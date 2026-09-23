const { randomUUID } = require('node:crypto');
const { supabaseFetch } = require('./supabase-rest');
const sharp = require('sharp');
const MAX_BYTES = 2 * 1024 * 1024;
const codes = new Set(['avatar_provider_failed','avatar_no_photo','avatar_privacy_restricted','avatar_invalid_url','avatar_invalid_image','avatar_storage_failed','avatar_fetching','avatar_cache_failed']);
const error = code => Object.assign(new Error(code), { code });
const logFailure = e => console.warn('[attendance-avatar]', { code: codes.has(e?.code) ? e.code : 'avatar_cache_failed', db_code: /^[0-9A-Z]{5}$/.test(e?.code || '') ? e.code : undefined });
function profileUrl(value) {
  try {
    const u = new URL(value);
    if (u.protocol !== 'https:' || u.username || u.password || u.port || u.href.length > 2048 || !/(^|\.)(whatsapp\.net|fbcdn\.net)$/.test(u.hostname)) throw 0;
    return u.href;
  } catch { throw error('avatar_invalid_url'); }
}
async function bounded(response, limit = MAX_BYTES) {
  if (Number(response.headers.get('content-length')) > limit) throw error('avatar_invalid_image');
  const chunks = []; let size = 0;
  for await (const chunk of response.body || []) { size += chunk.length; if (size > limit) throw error('avatar_invalid_image'); chunks.push(Buffer.from(chunk)); }
  return Buffer.concat(chunks);
}
function createAvatarService({ request = supabaseFetch, fetchImpl = (...a) => fetch(...a), env = process.env, now = () => Date.now(), image = async bytes => sharp(bytes, { limitInputPixels: 16000000 }).rotate().resize(256,256,{fit:'cover'}).jpeg({quality:85}).toBuffer() } = {}) {
  const flights = new Map();
  const rpc = async (identity, asset) => (await request('/rpc/attendance_update_contact_avatar_by_identity', { method:'POST', body:{p_connection_id:identity.connection_id,p_identifier_type:identity.identifier_type,p_external_identifier:identity.external_identifier,p_asset:asset},timeoutMs:15000 })).data;
  function storage(path) {
    const base = String(env.SUPABASE_URL || '').replace(/\/$/,''); const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY;
    if (!/^https:\/\//.test(base) || !key || !/^profiles\/[a-f0-9-]{36}\.jpg$/.test(path)) throw error('avatar_storage_failed');
    return { url:`${base}/storage/v1/object/attendance-avatars/${path}`, headers:{apikey:key,Authorization:`Bearer ${key}`} };
  }
  async function read(asset) {
    if (!asset?.storage_path) return null;
    const cfg = storage(asset.storage_path);
    const r = await fetchImpl(cfg.url.replace('/object/','/object/authenticated/'),{headers:cfg.headers,redirect:'error',signal:AbortSignal.timeout(12000)});
    if (!r.ok) throw error('avatar_storage_failed');
    return {buffer:await bounded(r),mime:'image/jpeg',source:'storage',status:asset.fetch_status};
  }
  async function refresh(context) {
    const { identity, connection } = context; let asset = context.asset || {};
    if (Date.parse(asset.expires_at) > now() && ['ready','absent','failed'].includes(asset.fetch_status)) return { ...context, cached:true };
    const token = randomUUID(); const claim = await rpc(identity,{op:'claim',fetch_token:token});
    if (!claim.claimed) return {...context,asset:claim.asset,cached:true};
    let patch;
    try {
      const phone = String(identity.normalized_phone || identity.phone_raw || '').replace(/\D/g,'');
      let base; try { base = new URL(env.EVOLUTION_API_URL); } catch { throw error('avatar_provider_failed'); }
      if (!/^\d{7,16}$/.test(phone) || base.protocol !== 'https:' || base.username || base.password || !env.EVOLUTION_API_KEY || !/^[\w-]{1,100}$/.test(connection.instance_name)) throw error('avatar_provider_failed');
      const r = await fetchImpl(base.href.replace(/\/$/,'')+`/chat/fetchProfilePictureUrl/${encodeURIComponent(connection.instance_name)}`,{method:'POST',headers:{apikey:env.EVOLUTION_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({number:phone}),redirect:'error',signal:AbortSignal.timeout(10000)});
      if (r.status === 404) throw error('avatar_no_photo');
      if (!r.ok) throw error('avatar_provider_failed');
      const payload = JSON.parse((await bounded(r,16384)).toString());
      const value = payload.profilePictureUrl || payload.picture;
      if (!value) throw error('avatar_no_photo');
      const source = profileUrl(value);
      const photo = await fetchImpl(source,{redirect:'error',signal:AbortSignal.timeout(10000)});
      if ([403,404].includes(photo.status)) throw error(photo.status===403?'avatar_privacy_restricted':'avatar_no_photo');
      if (!photo.ok) throw error('avatar_provider_failed');
      let buffer; try { buffer = await image(await bounded(photo)); } catch { throw error('avatar_invalid_image'); }
      const path = `profiles/${identity.contact_identity_id}.jpg`, cfg = storage(path);
      const uploaded = await fetchImpl(cfg.url,{method:'POST',headers:{...cfg.headers,'Content-Type':'image/jpeg','x-upsert':'true'},body:buffer,redirect:'error',signal:AbortSignal.timeout(12000)});
      if (!uploaded.ok) throw error('avatar_storage_failed');
      patch = {fetch_status:'ready',storage_path:path,source_url:source,error_code:null};
    } catch(e) {
      const code = codes.has(e.code)?e.code:'avatar_provider_failed';
      patch = {fetch_status:['avatar_no_photo','avatar_privacy_restricted'].includes(code)?'absent':'failed',error_code:code};
      logFailure({code});
    }
    const result = await rpc(identity,{...patch,op:'finish',fetch_token:token});
    return {...context,asset:result.asset,cached:false};
  }
  function ensure(context) {
    const id = context.identity?.contact_identity_id;
    if (!id) return Promise.resolve(context);
    if (flights.has(id)) return flights.get(id);
    const work = refresh(context).finally(()=>flights.delete(id)); flights.set(id,work); return work;
  }
  async function byIdentity(identity) { const context = await rpc(identity,{op:'read'}); return ensure(context); }
  async function resolve(context) {
    const updated = await ensure(context);
    if (!updated.asset?.storage_path) return {status:updated.asset?.fetch_status || 'absent',buffer:null};
    return read(updated.asset);
  }
  return {ensure,resolve,byIdentity};
}
const service = createAvatarService();
const canonicalAvatar = contact => {
  const {photo_url,whatsapp_avatar_url,avatar,...rest} = contact || {};
  return {...rest,avatar_url:rest.contact_id ? `/api/attendance-inbox/avatar?contact_id=${encodeURIComponent(rest.contact_id)}` : rest.avatar_url || ''};
};
module.exports = {...service,createAvatarService,canonicalAvatar,profileUrl,logFailure};
