// Vercel Cron only. Uses the same durable processor as the operator CLI.
const {equalSecret}=require('../../_lib/attendance-meta-adapter');
const {checkMetaEnvironment}=require('../../_lib/attendance-meta-store');
const {processMetaWebhookEvent}=require('../../_lib/attendance-meta-processor');
module.exports=async(req,res)=>{
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='GET'){res.statusCode=405;return res.end();}
 const secret=process.env.CRON_SECRET;
 if(!secret||secret.length<32){res.statusCode=503;return res.end();}
 if(!equalSecret(req.headers.authorization,'Bearer '+secret)){res.statusCode=401;return res.end();}
 try{
  checkMetaEnvironment();const deadline=Date.now()+15000;let count=0;
  while(count<25&&Date.now()<deadline){const result=await processMetaWebhookEvent();if(result.state==='not_claimed')break;count++;}
  res.setHeader('Content-Type','application/json');res.statusCode=200;res.end(JSON.stringify({processed:count}));
 }catch{res.statusCode=503;res.end('meta_processor_unavailable');}
};
