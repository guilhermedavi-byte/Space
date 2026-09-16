const {getSessionFromRequest}=require('../_lib/session');
const {canAccessFinance}=require('./_lib/finance-integrations');
const {sendJson,readJsonBody}=require('./_lib/http');
const service=require('./_lib/finance-customer-link');
function createHandler({session=getSessionFromRequest,links=service,env=process.env}={}){return async(req,res)=>{
 res.setHeader('Cache-Control','private, no-store');const user=session(req);if(!user||!canAccessFinance(user))return sendJson(res,403,{error:'forbidden'});if(env.FINANCE_FOUNDATION_ENABLED!=='true')return sendJson(res,503,{error:'finance_foundation_disabled'});
 try{if(req.method==='GET'){const q=new URL(req.url,'https://space.invalid').searchParams;return sendJson(res,200,await links.search(q.get('customer'),q.get('q')||''));}
 if(req.method!=='POST')return sendJson(res,405,{error:'method_not_allowed'});
 if(!env.SPACE_PUBLIC_BASE_URL||req.headers.origin!==new URL(env.SPACE_PUBLIC_BASE_URL).origin)return sendJson(res,403,{error:'invalid_origin'});
 const body=await readJsonBody(req);if(body.confirmed!==true)return sendJson(res,400,{error:'confirmation_required'});
 const result=await links.registerCanonicalPair({customerId:body.customer_id,studentId:body.student_id,actor:String(user.sub||user.uid||user.id||''),source:'manual'});return sendJson(res,200,{...result,refresh:true});
 }catch(e){const safe=new Set(['canonical_pair_required','finance_identity_already_linked','finance_identity_busy','finance_identity_unverified','customer_unavailable','invalid_query']);return sendJson(res,safe.has(e.code)?(e.status||409):503,{error:safe.has(e.code)?e.code:'link_unavailable'});}
};}
module.exports=createHandler();module.exports.createHandler=createHandler;
