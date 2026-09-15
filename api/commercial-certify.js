// Temporary production administrative audit. Generated host requires Vercel
// Authentication; application/custom-domain hosts and browser Origins are refused.
const {createHandler}=require('../scripts/commercial-certification/handler.cjs');
const expiresAt='2026-09-16T04:00:00.000Z';
let running=false;
module.exports=async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  res.setHeader('Content-Type','application/json');
  const host=String(req.headers.host||'').split(':')[0];
  if(process.env.VERCEL_ENV!=='production'||!process.env.VERCEL_URL||host!==process.env.VERCEL_URL||req.headers.origin||Date.now()>Date.parse(expiresAt)||!['GET','POST'].includes(req.method)){
    res.statusCode=404;return res.end('{"error":"unavailable"}');
  }
  if(req.method==='GET')return res.end(JSON.stringify({runtime:'commercial-certification-v1',commit:process.env.VERCEL_GIT_COMMIT_SHA||null,credentialsAvailable:['CRM_API_BASE_URL','CRM_API_KEY','GOOGLE_SERVICE_ACCOUNT_JSON'].every(k=>!!process.env[k]?.trim())}));
  if(running){res.statusCode=409;return res.end('{"error":"already_running"}');}
  running=true;res.once('finish',()=>{running=false;});res.once('close',()=>{running=false;});
  req.url='/api/certify';
  return createHandler({manifest:{expiresAt}})(req,res);
};
