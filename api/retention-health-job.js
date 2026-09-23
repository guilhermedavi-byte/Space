const {timingSafeEqual}=require('node:crypto');
const {sendJson}=require('./_lib/http');
module.exports=async(req,res)=>{
 if(!['GET','POST'].includes(req.method)) return sendJson(res,405,{error:'method_not_allowed'});
 const secret=Buffer.from(process.env.CRON_SECRET||'');
 const provided=Buffer.from(String(req.headers.authorization||'').replace(/^Bearer /,''));
 if(!secret.length || secret.length!==provided.length || !timingSafeEqual(secret,provided)) return sendJson(res,401,{error:'unauthorized'});
 try{return sendJson(res,200,{ok:true,...await require('./_lib/retention-health-store').runHealthSnapshot()});}
 catch(error){console.error('[retention-health-job]',{code:error.code||error.message});return sendJson(res,500,{error:'health_snapshot_failed'});}
};
