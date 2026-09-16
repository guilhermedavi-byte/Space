// Temporary, expiring read-only endpoint; deployed only in an isolated copy of
// the exact current production commit. The capability itself is never deployed.
const crypto=require('node:crypto');
function createHandler({manifest,env=process.env,health,inspect,clock=Date.now}) {
  return async(req,res)=>{
    res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');
    const send=(status,value)=>{res.statusCode=status;res.end(JSON.stringify(value));};
    const token=String(req.headers['x-finance-certification-token']||'');
    const digest=crypto.createHash('sha256').update(token).digest('hex');
    if(req.method!=='POST'||req.headers.origin||token.length!==64||digest!==manifest.tokenDigest
      ||!Number.isFinite(Date.parse(manifest.expiresAt))||clock()>Date.parse(manifest.expiresAt))return send(404,{error:'unavailable'});
    const guards={production:env.VERCEL_ENV==='production',supabase:env.SUPABASE_URL===manifest.supabaseUrl,
      asaasBase:env.ASAAS_BASE_URL==='https://api.asaas.com/v3',asaasScope:env.ASAAS_KEY_SCOPE==='production',
      keyPresent:!!env.ASAAS_API_KEY&&env.ASAAS_API_KEY===env.ASAAS_API_KEY.trim(),
      appOrigin:['https://plataforma.spaceschoolbr.com','https://space-three-sand.vercel.app'].includes(env.SPACE_PUBLIC_BASE_URL),
      project:!env.VERCEL_PROJECT_ID||env.VERCEL_PROJECT_ID===manifest.projectId};
    if(Object.values(guards).some(v=>!v))return send(409,{status:'FAIL',stage:'guards',guards});
    try {
      if(req.query?.mode==='read'&&inspect)return send(200,await inspect(req));
      const result=await health();
      const safe={configured:result.configured===true,reachable:result.reachable===true,
        authenticated:result.authenticated===true,account_accessible:result.account_accessible===true,
        environment:result.environment==='production'?'production':'unexpected',checked_at:result.checked_at,
        error:result.error?{code:/^asaas_[a-z_]+$/.test(result.error.code)?result.error.code:'asaas_error',status:Number(result.error.status)||0}:null};
      const pass=safe.configured&&safe.reachable&&safe.authenticated&&safe.account_accessible&&safe.environment==='production';
      if(pass&&req.query?.mode==='account')return send(200,{...safe,account_reference:result.account_reference});
      if(pass&&req.query?.mode==='inventory'&&inspect)return send(200,{status:'PASS',stage:'inventory',...(await inspect(req))});
      return send(pass?200:503,{status:pass?'PASS':'FAIL',stage:'asaas_health',guards,health:safe,
        foundationEnabled:env.FINANCE_FOUNDATION_ENABLED==='true',connectionConfigured:!!env.FINANCE_CONNECTION_ID,
        dedicatedWebhookTokenConfigured:!!env.ASAAS_WEBHOOK_TOKEN,legacyWebhookTokenConfigured:!!(env.ASAAS_WEBHOOK_SECRET||env.N8N_WEBHOOK_SECRET)});
    }catch{return send(503,{status:'FAIL',stage:'asaas_health',error:'health_failed'});}
  };
}
module.exports={createHandler};
