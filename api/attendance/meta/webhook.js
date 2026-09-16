const {randomUUID}=require('node:crypto');
const {verifyChallenge,verifySignature,readRawBody,parseEnvelope,error}=require('../../_lib/attendance-meta-adapter');
const store=require('../../_lib/attendance-meta-store');
function createHandler({repository=store,checkEnvironment=store.checkMetaEnvironment,environment=()=>process.env,log=e=>console.info(JSON.stringify(e))}={}){
 return async(req,res)=>{
  const started=performance.now(),requestId=randomUUID();let received=false;
  const respond=(status,body)=>{res.statusCode=status;res.setHeader('Content-Type','text/plain; charset=utf-8');res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.end(body);};
  try{
   if(!['GET','POST'].includes(req.method)){res.setHeader('Allow','GET, POST');return respond(405,'method_not_allowed');}
   const env=environment();checkEnvironment(env);
   if(typeof env.META_WEBHOOK_VERIFY_TOKEN!=='string'||env.META_WEBHOOK_VERIFY_TOKEN.length<16)throw error('meta_not_configured',503);
   if(req.method==='GET')return respond(200,verifyChallenge(req.url,env.META_WEBHOOK_VERIFY_TOKEN));
   received=true;
   if(typeof env.META_APP_SECRET!=='string'||env.META_APP_SECRET.length<16)throw error('meta_not_configured',503);
   if(req.headers['content-encoding']&&req.headers['content-encoding']!=='identity')throw error('meta_unsupported_encoding',415);
   if(!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type']||''))throw error('meta_invalid_content_type',415);
   const raw=await readRawBody(req);
   if(!verifySignature(raw,req.headers['x-hub-signature-256'],env.META_APP_SECRET)){
    log({event:'meta_signature_invalid',request_id:requestId,provider:'meta_whatsapp',webhook_signature_invalid_total:1});
    throw error('meta_signature_invalid',401);
   }
   const {text}=parseEnvelope(raw,[env.META_APP_SECRET,env.META_WEBHOOK_VERIFY_TOKEN,env.SUPABASE_SERVICE_ROLE_KEY]);
   const result=await repository.capture(text,requestId);
   log({event:'meta_webhook_durable',request_id:requestId,raw_event_id:result.raw_event_id,provider:'meta_whatsapp',
    webhook_duplicate_total:result.duplicate?1:0,webhook_ack_latency:performance.now()-started});
   // ACK only after durable commit. No unawaited processor, provider call or timer.
   return respond(200,'EVENT_RECEIVED');
  }catch(e){
   const known=/^meta_[a-z_]+$/.test(e.code||'');const status=known&&e.status>=400&&e.status<500?e.status:503;
   log({event:'meta_webhook_rejected',request_id:requestId,provider:'meta_whatsapp',status});
   return respond(status,known?e.code:'meta_unavailable');
  }finally{if(received)log({event:'meta_webhook_received',request_id:requestId,provider:'meta_whatsapp',webhook_received_total:1});}
 };
}
module.exports=createHandler();module.exports.createHandler=createHandler;
// Plain Vercel Node runtime: read the restored byte stream without accessing req.body.
