// Provider decryption material stays in server-only message metadata, never in Inbox responses.
function binaryBase64(value) {
  if (typeof value === 'string') return value.length <= 256 && /^[A-Za-z0-9+/]+={0,2}$/.test(value) ? value : undefined;
  let bytes;
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) bytes=Array.from(value);
  else if (value?.type === 'Buffer' && Array.isArray(value.data)) bytes=value.data;
  else if (Array.isArray(value)) bytes=value;
  else if (value && typeof value === 'object') {
    const keys=Object.keys(value);if(keys.length && keys.length <= 64 && keys.every((k,i)=>k===String(i)))bytes=keys.map(k=>value[k]);
  }
  if(!bytes?.length || bytes.length>64 || !bytes.every(n=>Number.isInteger(n)&&n>=0&&n<=255))return undefined;
  return Buffer.from(bytes).toString('base64');
}
function compactEvolutionMessage(data,message) {
  const unwrap=message?.documentWithCaptionMessage?.message || message || {};
  const type=['image','audio','video','document','sticker'].find(type=>unwrap[`${type}Message`]);
  if(!type)return null;
  const src=unwrap[`${type}Message`];
  const numberish=value=>{
    const n=typeof value==='object' && Number.isInteger(value?.low) ? (value.high || 0)*4294967296+(value.low>>>0) : Number(value);
    return Number.isFinite(n)&&n>=0&&n<=100*1024*1024?n:undefined;
  };
  const str=(v,max)=>typeof v==='string'?v.slice(0,max):undefined;
  return {key:{id:str(data?.key?.id,256),remoteJid:str(data?.key?.remoteJid || data?.key?.remoteJidAlt,256),fromMe:data?.key?.fromMe===true,participant:str(data?.key?.participant,256)},
    messageType:`${type}Message`,message:{[`${type}Message`]:{
      url:str(src.url,2048),directPath:str(src.directPath,2048),mediaKey:binaryBase64(src.mediaKey),
      fileSha256:binaryBase64(src.fileSha256),fileEncSha256:binaryBase64(src.fileEncSha256),
      mimetype:str(src.mimetype || src.mimeType,120),fileLength:numberish(src.fileLength),seconds:numberish(src.seconds),
      fileName:str(src.fileName,220),caption:str(src.caption,2000),ptt:typeof src.ptt==='boolean'?src.ptt:undefined
    }}};
}
module.exports={compactEvolutionMessage,binaryBase64};
