const { getSessionFromRequest } = require('../_lib/session');
const { readJsonBody, sendJson } = require('./_lib/http');
const { requireAdminPermission } = require('./_lib/admin-permissions');
const { createFinanceFoundation } = require('./_lib/finance-foundation');
const { FinanceError } = require('./_lib/finance-domain');
const { safeFinanceError } = require('./_lib/finance-store');
function createHandler({ session=getSessionFromRequest, service=()=>createFinanceFoundation(), env=process.env }={}) {
  return async(req,res)=>{
    const user=session(req);
    if(!user)return sendJson(res,401,{error:'unauthorized'});
    if(user.role!=='admin')return sendJson(res,403,{error:'forbidden'});
    const guard=await requireAdminPermission(req,'financeiro.overview');if(!guard.ok)return sendJson(res,guard.status,guard.body);
    if(env.FINANCE_FOUNDATION_ENABLED!=='true')return sendJson(res,503,{error:'finance_foundation_disabled'});
    try {
      const f=service();
      if(req.method==='GET')return sendJson(res,200,await f.health({recordHealth:env.FINANCE_ENV_SCOPE!=='production'}));
      if(req.method!=='POST'){res.setHeader('Allow','GET, POST');return sendJson(res,405,{error:'method_not_allowed'});}
      // Cookie-authenticated mutations must originate from the configured application.
      if(!env.SPACE_PUBLIC_BASE_URL || req.headers.origin!==new URL(env.SPACE_PUBLIC_BASE_URL).origin) return sendJson(res,403,{error:'invalid_origin'});
      let body;try{body=await readJsonBody(req);}catch{throw new FinanceError('finance_payload_invalid');}
      // Production maintenance uses the CLI's explicit apply and private snapshots.
      if(env.FINANCE_ENV_SCOPE==='production' && (body.action!=='repair'||body.apply===true))
        return sendJson(res,409,{error:'finance_production_use_audited_cli'});
      const actor=String(user.sub||user.uid||user.id||'');if(!actor)throw new FinanceError('finance_actor_missing',false,403);
      if(body.action==='retry')return sendJson(res,200,await f.retryWebhookEvent(body.event_id,{actor}));
      if(body.action==='process')return sendJson(res,200,await f.drain({limit:Math.min(20,Math.max(1,Number(body.limit)||10)),actor}));
      // Bulk apply is intentionally CLI-only. Repair is preview-first unless explicitly requested.
      if(body.action==='repair')return sendJson(res,200,await f.repairPaymentById(body.payment_id,{dryRun:body.apply!==true,actor}));
      return sendJson(res,400,{error:'finance_action_invalid'});
    }catch(e){const error=safeFinanceError(e);return sendJson(res,error.status||503,{error:error.code});}
  };
}
module.exports=createHandler();module.exports.createHandler=createHandler;
