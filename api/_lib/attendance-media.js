const { randomUUID } = require('node:crypto');
const { supabaseFetch } = require('./supabase-rest');
const MAX_BYTES = 24 * 1024 * 1024;
const MIME = {
  audio: new Set(['audio/ogg','audio/mpeg','audio/mp4','audio/aac','audio/wav','audio/webm']),
  image: new Set(['image/jpeg','image/png','image/webp','image/gif']),
  video: new Set(['video/mp4','video/webm','video/quicktime']),
  sticker: new Set(['image/webp','image/png'])
};
const ERROR_CODES = new Set(['media_not_found','provider_fetch_failed','unsupported_mime','invalid_base64','media_too_large','storage_upload_failed','storage_download_failed','provider_message_missing','media_fetching','media_asset_failed']);
const clean = (v, max=200) => String(v ?? '').trim().slice(0,max);
const mediaError = code => Object.assign(new Error(code), { code, status: code === 'media_fetching' ? 409 : ['provider_message_missing','media_not_found'].includes(code) ? 404 : 503 });
const mediaLabel = kind => ({audio:'Áudio',image:'Imagem',video:'Vídeo',document:'Documento',sticker:'Sticker'})[kind] || 'Mídia';
const mimeBase = mime => String(mime || '').split(';')[0].trim().toLowerCase();
function safeMime(kind,value) {
  const raw = String(value || '').trim().toLowerCase();
  if (raw.length > 120 || /[\r\n\0]/.test(raw)) return '';
  const base = mimeBase(raw);
  if (kind === 'document') return /^[a-z0-9.+-]+\/[a-z0-9.+-]+$/.test(base) ? base : 'application/octet-stream';
  if (!MIME[kind]?.has(base)) return '';
  // Only a bounded codec parameter is useful for inline audio/video. Never reflect arbitrary parameters.
  const codec = raw.match(/;\s*codecs\s*=\s*"?([a-z0-9., _-]{1,64})"?\s*$/);
  return codec && ['audio','video'].includes(kind) ? `${base}; codecs="${codec[1].trim()}"` : base;
}
function safeFilename(value) { return clean(value || 'media',180).normalize('NFKD').replace(/[^\x20-\x7e]|["\\/;<>]/g,'_') || 'media'; }
function extensionFor(mime) {
  return ({'audio/ogg':'ogg','audio/mpeg':'mp3','audio/mp4':'m4a','audio/aac':'aac','audio/wav':'wav','audio/webm':'webm','image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif','video/mp4':'mp4','video/webm':'webm','video/quicktime':'mov','application/pdf':'pdf'})[mimeBase(mime)] || 'bin';
}
const storagePath = (id,mime) => `attendance/${id.slice(0,2)}/${id}.${extensionFor(mime)}`;
function evolutionMediaBody(message) {
  const id = clean(message?.external_message_id || message?.metadata?.evolution_message?.key?.id,256);
  return id ? { key: { id } } : null;
}
function storedEnvelope(message) {
  const stored = message?.metadata?.evolution_message;
  const src = stored?.message?.[`${message.kind}Message`];
  return stored?.key?.id && src?.mediaKey && (src.url || src.directPath) ? stored : null;
}
async function boundedBody(response,limit,code) {
  if (Number(response.headers.get('content-length')) > limit) { await response.body?.cancel(); throw mediaError(code); }
  const chunks=[];let size=0;
  for await (const chunk of response.body || []) { size+=chunk.length;if(size>limit)throw mediaError(code);chunks.push(Buffer.from(chunk)); }
  return Buffer.concat(chunks);
}
function decodeBase64(value) {
  if(typeof value !== 'string')throw mediaError('invalid_base64');
  const b64=value.replace(/^data:[^,]{1,150};base64,/, '').replace(/\s/g,'');
  if(b64.length>Math.ceil(MAX_BYTES/3)*4)throw mediaError('media_too_large');
  if(!b64 || b64.length%4!==0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(b64))throw mediaError('invalid_base64');
  const buffer=Buffer.from(b64,'base64');
  if(!buffer.length || buffer.toString('base64')!==b64)throw mediaError('invalid_base64');
  if(buffer.length>MAX_BYTES)throw mediaError('media_too_large');
  return buffer;
}
function createMediaService({ request=supabaseFetch, fetchImpl=(...args)=>fetch(...args), env=process.env, sleep=ms=>new Promise(r=>setTimeout(r,ms)) }={}) {
  const flights=new Map();
  const mark=async(id,patch)=>{
    try {return (await request('/rpc/attendance_upsert_media_asset',{method:'POST',body:{p_message_id:id,p_asset:patch},timeoutMs:10000})).data;}
    catch {throw mediaError('media_asset_failed');}
  };
  async function provider(instance,message) {
    let url;try{url=new URL(env.EVOLUTION_API_URL);}catch{throw mediaError('provider_fetch_failed');}
    if(url.protocol!=='https:' || url.username || url.password || !env.EVOLUTION_API_KEY || !/^[\w-]{1,100}$/.test(instance))throw mediaError('provider_fetch_failed');
    const candidates=[evolutionMediaBody(message),storedEnvelope(message)].filter(Boolean);
    if(!candidates.length)throw mediaError('provider_message_missing');
    let last='provider_fetch_failed';
    for(const body of candidates){
      try{
        const response=await fetchImpl(url.href.replace(/\/$/,'')+`/chat/getBase64FromMediaMessage/${encodeURIComponent(instance)}`,{
          method:'POST',redirect:'error',signal:AbortSignal.timeout(15000),headers:{apikey:env.EVOLUTION_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({message:body,convertToMp4:false})});
        if(!response.ok){const text=(await boundedBody(response,32768,'provider_fetch_failed')).toString();last=/message not found|message.*missing/i.test(text)||response.status===404?'provider_message_missing':'provider_fetch_failed';continue;}
        const payload=JSON.parse((await boundedBody(response,Math.ceil(MAX_BYTES/3)*4+65536,'media_too_large')).toString());
        const value=payload?.base64 ?? payload?.data?.base64 ?? payload?.media;
        return {buffer:decodeBase64(value),mime:payload?.mimetype || payload?.mimeType || payload?.data?.mimetype};
      }catch(error){last=ERROR_CODES.has(error.code)?error.code:'provider_fetch_failed';if(['media_too_large','invalid_base64'].includes(last))throw mediaError(last);}
    }
    throw mediaError(last);
  }
  function storageConfig(path) {
    const url=String(env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/,'');
    const key=env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY;
    const bucket=env.ATTENDANCE_MEDIA_BUCKET || 'attendance-media';
    if(!/^https:\/\//.test(url)||!key||!/^[\w.-]+$/.test(bucket)||!/^attendance\/[a-f0-9]{2}\/[a-f0-9-]{36}\.[a-z0-9]+$/.test(path))throw mediaError('storage_download_failed');
    return {url,bucket,path,headers:{apikey:key,Authorization:`Bearer ${key}`}};
  }
  async function storageDownload(asset,message) {
    const mime=safeMime(message.kind,asset.mime_type);
    if(!mime || asset.storage_path!==storagePath(message.message_id,mime))throw mediaError('storage_download_failed');
    const cfg=storageConfig(asset.storage_path);
    try{
      const r=await fetchImpl(`${cfg.url}/storage/v1/object/authenticated/${cfg.bucket}/${cfg.path}`,{headers:cfg.headers,redirect:'error',signal:AbortSignal.timeout(15000)});
      if(!r.ok)throw Object.assign(mediaError('storage_download_failed'),{cacheMissing:r.status===404});
      const buffer=await boundedBody(r,MAX_BYTES,'media_too_large');if(!buffer.length)throw mediaError('storage_download_failed');
      return {buffer,mime,filename:safeFilename(asset.filename),source:'storage'};
    }catch(error){throw Object.assign(mediaError(ERROR_CODES.has(error.code)?error.code:'storage_download_failed'),{cacheMissing:error.cacheMissing===true});}
  }
  async function storageUpload(path,buffer,mime) {
    try{
      const cfg=storageConfig(path);
      // POST creates a missing object; x-upsert handles an existing deterministic cache entry.
      const r=await fetchImpl(`${cfg.url}/storage/v1/object/${cfg.bucket}/${cfg.path}`,{method:'POST',headers:{...cfg.headers,'Content-Type':mime,'x-upsert':'true'},body:buffer,redirect:'error',signal:AbortSignal.timeout(15000)});
      if(!r.ok)throw mediaError('storage_upload_failed');
    }catch{throw mediaError('storage_upload_failed');}
  }
  async function run({asset={},message,connection={},reloadAsset}) {
    const id=message.message_id,kind=message.kind,declared=message.metadata?.media || message.content?.media || {};
    if(!['image','audio','video','document','sticker'].includes(kind))throw mediaError('media_not_found');
    let cacheBroken=false;
    if(asset.fetch_status==='ready'){
      try{return await storageDownload(asset,message);}catch(error){
        // A temporary Storage outage must not invalidate a ready asset or download it again.
        if(!error.cacheMissing)throw error;
        cacheBroken=true;console.warn('[attendance-media]',{message_id:id,code:error.code});
      }
    }
    const token=randomUUID();
    const lease=await mark(id,{fetch_status:'fetching',fetch_token:token,retry_ready:cacheBroken});
    if(!lease?.claimed){
      if(lease?.asset?.fetch_status==='ready')return storageDownload(lease.asset,message);
      // Cross-worker coalescing. Stale leases are reclaimable by the next request after 90 seconds.
      if(reloadAsset)for(let i=0;i<20;i++){await sleep(500);const latest=await reloadAsset();if(latest?.fetch_status==='ready')return storageDownload(latest,message);if(latest?.fetch_status==='failed')throw mediaError('provider_fetch_failed');}
      throw mediaError('media_fetching');
    }
    try{
      if(Number(declared.size)>MAX_BYTES)throw mediaError('media_too_large');
      if(connection.provider && connection.provider!=='evolution_whatsapp')throw mediaError('provider_fetch_failed');
      const fetched=await provider(clean(connection.instance_name || connection.external_account_id,100),message);
      const mime=safeMime(kind,fetched.mime || declared.mime_type);
      if(!mime)throw mediaError('unsupported_mime');
      const path=storagePath(id,mime), filename=safeFilename(declared.filename || `${mediaLabel(kind)}.${extensionFor(mime)}`);
      await storageUpload(path,fetched.buffer,mime);
      await mark(id,{fetch_status:'ready',fetch_token:token,media_type:kind,mime_type:mime,filename,size_bytes:fetched.buffer.length,
        duration_seconds:declared.duration ?? null,storage_path:path,provider_media_id:message.external_message_id || null,external_message_id:message.external_message_id || null,error_code:null});
      return {buffer:fetched.buffer,mime,filename,source:'provider'};
    }catch(error){
      const code=ERROR_CODES.has(error.code)?error.code:'provider_fetch_failed';
      await mark(id,{fetch_status:'failed',fetch_token:token,error_code:code}).catch(()=>{});
      throw mediaError(code);
    }
  }
  function resolveMedia(input){
    const id=input.message?.message_id;
    if(!id)return Promise.reject(mediaError('media_not_found'));
    if(flights.has(id))return flights.get(id);
    const promise=run(input).finally(()=>flights.delete(id));flights.set(id,promise);return promise;
  }
  return {resolveMedia};
}
const {resolveMedia}=createMediaService();
module.exports={resolveMedia,createMediaService,mediaLabel,safeMime,safeFilename,evolutionMediaBody,decodeBase64,MAX_BYTES,ERROR_CODES};
