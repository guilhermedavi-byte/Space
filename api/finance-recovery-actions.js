const {getSessionFromRequest}=require('../_lib/session');
const {canAccessFinance}=require('./_lib/finance-integrations');
const {sendJson,readJsonBody}=require('./_lib/http');
const {createRecoveryOperations}=require('./_lib/finance-recovery-operations');

function createHandler({session=getSessionFromRequest,service=createRecoveryOperations(),env=process.env}={}){
 return async(req,res)=>{
  res.setHeader('Cache-Control','private, no-store');
  const user=session(req);if(!user)return sendJson(res,401,{error:'unauthorized'});if(!canAccessFinance(user))return sendJson(res,403,{error:'forbidden'});
  if(env.FINANCE_FOUNDATION_ENABLED!=='true')return sendJson(res,503,{error:'finance_foundation_disabled'});
  if(req.method!=='POST'){res.setHeader('Allow','POST');return sendJson(res,405,{error:'method_not_allowed'});}
  if(!env.SPACE_PUBLIC_BASE_URL||req.headers.origin!==new URL(env.SPACE_PUBLIC_BASE_URL).origin)return sendJson(res,403,{error:'invalid_origin'});
  try{
   const body=await readJsonBody(req);
   const result=await service.recordAction(body,String(user.sub||user.uid||user.id||user.email||''));
   return sendJson(res,200,{...result,refresh:true});
  }catch(e){
   const safe=new Set(['finance_recovery_payment_invalid','finance_recovery_action_invalid','finance_recovery_amount_invalid','finance_recovery_promise_required','finance_recovery_followup_required','finance_recovery_not_active']);
   return sendJson(res,safe.has(e.code)?(e.status||400):503,{error:safe.has(e.code)?e.code:'finance_recovery_unavailable'});
  }
 };
}
module.exports=createHandler();module.exports.createHandler=createHandler;
