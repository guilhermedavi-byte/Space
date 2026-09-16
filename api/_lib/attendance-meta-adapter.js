const {createHash,createHmac,timingSafeEqual}=require('node:crypto');
const MAX_BODY_BYTES=1024*1024;
const error=(code,status=400)=>Object.assign(new Error(code),{code,status});
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const sqlText=v=>typeof v==='string'&&!v.includes('\u0000')&&v.isWellFormed();
const identifier=v=>sqlText(v)&&v.length>0&&v.length<=256;
const hash=v=>createHash('sha256').update(v).digest('hex');
function equalSecret(actual,expected){
 return typeof actual==='string'&&typeof expected==='string'&&expected.length>=16
  &&timingSafeEqual(createHash('sha256').update(actual).digest(),createHash('sha256').update(expected).digest());
}
function verifyChallenge(url,token){
 const params=new URL(url,'https://space.invalid').searchParams;
 for(const k of ['hub.mode','hub.verify_token','hub.challenge'])if(params.getAll(k).length!==1)throw error('meta_invalid_verification');
 const challenge=params.get('hub.challenge');
 if(params.get('hub.mode')!=='subscribe'||!/^\d{1,128}$/.test(challenge||''))throw error('meta_invalid_verification');
 if(!equalSecret(params.get('hub.verify_token'),token))throw error('meta_verification_denied',403);
 return challenge;
}
function verifySignature(raw,signature,secret){
 if(!Buffer.isBuffer(raw)||typeof secret!=='string'||secret.length<16||typeof signature!=='string'||!/^sha256=[a-fA-F0-9]{64}$/.test(signature))return false;
 return timingSafeEqual(Buffer.from(signature.slice(7),'hex'),createHmac('sha256',secret).update(raw).digest());
}
async function readRawBody(req){
 const length=req.headers?.['content-length'];
 if(length!==undefined&&(!/^\d+$/.test(String(length))||Number(length)>MAX_BODY_BYTES))throw error('meta_payload_too_large',413);
 // Vercel Node helpers expose a lazy JSON getter and restore the original stream.
 // Do not access req.body: that getter parses and changes the representation.
 const body=Object.getOwnPropertyDescriptor(req,'body');
 if(body&&'value' in body){
  if(!Buffer.isBuffer(body.value))throw error('meta_raw_body_unavailable',503);
  if(body.value.length>MAX_BODY_BYTES)throw error('meta_payload_too_large',413);
  return body.value;
 }
 return new Promise((resolve,reject)=>{
  const chunks=[];let size=0,done=false;
  const finish=(err)=>{if(done)return;done=true;clearTimeout(timeout);
   req.removeListener('data',data);req.removeListener('end',end);
   req.removeListener('error',fail);req.removeListener('aborted',abort);
   err?reject(err):resolve(Buffer.concat(chunks));};
  const data=chunk=>{if(!Buffer.isBuffer(chunk))return finish(error('meta_raw_body_unavailable',503));
   size+=chunk.length;if(size>MAX_BODY_BYTES)return finish(error('meta_payload_too_large',413));chunks.push(chunk);};
  const end=()=>finish(),fail=()=>finish(error('meta_body_unavailable',400)),abort=()=>finish(error('meta_body_aborted',400));
  const timeout=setTimeout(()=>finish(error('meta_body_timeout',408)),10000);timeout.unref?.();
  req.on('data',data);req.on('end',end);req.on('error',fail);req.on('aborted',abort);
 });
}
function parseEnvelope(raw,knownSecrets=[]){
 let text,body;
 try{text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(raw);body=JSON.parse(text);}catch{throw error('meta_invalid_json');}
 if(!object(body)||body.object!=='whatsapp_business_account'||!Array.isArray(body.entry)||body.entry.length<1||body.entry.length>100)throw error('meta_invalid_envelope');
 const inspect=(v,depth=0)=>{if(depth>64)throw error('meta_invalid_envelope');
  if(Array.isArray(v)){for(const x of v)inspect(x,depth+1);}
  else if(object(v))for(const [k,x] of Object.entries(v)){if(/^(access_token|app_secret|verify_token|authorization|api_key|service_role_key)$/i.test(k))throw error('meta_secret_in_payload');inspect(x,depth+1);}
 };
 inspect(body);
 if(knownSecrets.some(s=>typeof s==='string'&&s.length>=16&&text.includes(s)))throw error('meta_secret_in_payload');
 return {text,body};
}
const timestamp=value=>{if(typeof value!=='string'||!/^\d{1,12}$/.test(value))return null;
 const millis=Number(value)*1000;return Number.isFinite(millis)&&millis<=8640000000000000?new Date(millis).toISOString():null;};
const categories=new Set(['text','image','audio','video','document','location','contacts','interactive','reaction','sticker','unknown']);
function normalizeEnvelope(body){
 const items=[];
 const add=item=>{if(items.length>=500)throw error('meta_too_many_items');items.push(item);};
 const unknown=(waba,phone,value,reason)=>({category:'unhandled',waba_id:identifier(waba)?waba:'',phone_number_id:identifier(phone)?phone:'',semantic_key:hash(JSON.stringify(value)),reason});
 for(const entry of body.entry){
  if(!object(entry)||!identifier(entry.id)||!Array.isArray(entry.changes)){add(unknown(null,null,entry,'invalid_entry'));continue;}
  for(const change of entry.changes){
   const value=change?.value, phone=value?.metadata?.phone_number_id;
   if(change?.field!=='messages'||!object(value)||value.messaging_product!=='whatsapp'){
    add(unknown(entry.id,phone,change,'unhandled_change'));continue;
   }
   let found=false;
   if(Array.isArray(value.messages))for(const m of value.messages){
    found=true;const type=categories.has(m?.type)?m.type:'unknown';
    if(!identifier(phone)||!identifier(m?.id)||!identifier(m?.from)||!timestamp(m.timestamp)){
     add(unknown(entry.id,phone,m,'missing_message_identifiers'));continue;
    }
    if(type!=='text'||!sqlText(m.text?.body)||!m.text.body.length||m.text.body.length>16000){
     add({...unknown(entry.id,phone,m,'unsupported_message_type'),message_type:type,external_message_id:m.id});continue;
    }
    const contact=Array.isArray(value.contacts)?value.contacts.find(c=>c?.wa_id===m.from):null;
    add({category:'message',waba_id:entry.id,phone_number_id:phone,semantic_key:m.id,external_message_id:m.id,
     external_contact_id:m.from,identifier_type:'provider_user',display_name:sqlText(contact?.profile?.name)?Array.from(contact.profile.name).slice(0,200).join(''):null,
     phone_raw:contact&&/^\d{8,15}$/.test(m.from)?'+'+m.from:null,provider_timestamp:timestamp(m.timestamp),
     kind:'text',content:{text:m.text.body},external_reply_to_id:identifier(m.context?.id)?m.context.id:null});
   }
   if(Array.isArray(value.statuses))for(const s of value.statuses){
    found=true;
    if(!identifier(phone)||!identifier(s?.id)||!timestamp(s.timestamp)||!['sent','delivered','read','failed'].includes(s.status)){
     add(unknown(entry.id,phone,s,'unhandled_status'));continue;
    }
    const codes=Array.isArray(s.errors)?s.errors.map(e=>e?.code).filter(Number.isSafeInteger):[];
    add({category:'status',waba_id:entry.id,phone_number_id:phone,external_message_id:s.id,status:s.status,provider_timestamp:timestamp(s.timestamp),
     error_codes:codes,semantic_key:hash(JSON.stringify([s.id,s.status,s.timestamp,codes]))});
   }
   if(!found)add(unknown(entry.id,phone,change,'unhandled_messages_change'));
  }
 }
 if(!items.length)add(unknown(null,null,body,'empty_changes'));
 return items;
}
// No network implementation exists in this phase, even if an operator flips a flag.
function sendMetaMessage(){throw error('meta_outbound_not_implemented',409);}
module.exports={MAX_BODY_BYTES,error,equalSecret,verifyChallenge,verifySignature,readRawBody,parseEnvelope,normalizeEnvelope,sendMetaMessage};
