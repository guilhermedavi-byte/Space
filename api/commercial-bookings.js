const {readJsonBody,sendJson}=require('./_lib/http');
const {resolveAdminRequestAuth}=require('./_lib/admin-request-auth');
const {requireResolvedAdminPermission}=require('./_lib/admin-permissions');
const {getCommercialPermissions}=require('./_lib/commercial-permissions');
const booking=require('./_lib/commercial-bookings');
const createHandler=({authResolver=resolveAdminRequestAuth,permissionResolver=requireResolvedAdminPermission,request,fetcher,env=process.env}={})=>async(req,res)=>{
  res.setHeader('Cache-Control','private, no-store');
  if(!['GET','POST'].includes(req.method))return sendJson(res,405,{error:'method_not_allowed'});
  const auth=await authResolver(req,{logPrefix:'[commercial-bookings]'});
  if(!auth.ok)return sendJson(res,auth.status,auth.body);
  const user={...auth.session,commercialRoles:auth.profile?.user?.commercialRoles||auth.session?.commercialRoles||[]};
  const permissions=getCommercialPermissions(user),isAdmin=permissions.isAdmin;
  if(!user.sub || (!isAdmin&&!permissions.canUseSdrWorkspace))return sendJson(res,403,{error:'forbidden'});
  if(isAdmin){const p=await permissionResolver(auth,'comercial.spacePhone.view');if(!p.ok)return sendJson(res,p.status,p.body);}
  try {
    const url=new URL(req.url,'https://space.local');
    if(req.method==='GET')return sendJson(res,200,{bookings:await booking.list({request,user,isAdmin,callId:url.searchParams.get('callId')}),syncAvailable:Boolean(String(env.CALCOM_API_KEY||'').trim())});
    // Cookie-based writes require same-origin. Bearer-only server clients may omit Origin.
    const origin=req.headers?.origin;
    if(origin && origin!==`https://${req.headers.host}` && origin!==`http://${req.headers.host}`)throw booking.fail('invalid_origin',403);
    const body=await readJsonBody(req);
    if(body.action==='context')return sendJson(res,200,await booking.context({request,user,isAdmin,callId:body.callId}));
    if(body.action==='sync')return sendJson(res,200,{booking:await booking.reconcile({uid:body.uid,request,fetcher,env,user,isAdmin})});
    if(body.action==='manual')return sendJson(res,200,{booking:await booking.manual({request,user,isAdmin,body})});
    throw booking.fail('invalid_action');
  }catch(e){console.warn('[commercial-bookings]',JSON.stringify({code:e.status?e.message:'internal_error',status:e.status||500}));return sendJson(res,e.status||500,{error:e.status&&e.status<500?e.message:'booking_temporarily_unavailable'});}
};
module.exports=createHandler();module.exports.createHandler=createHandler;
