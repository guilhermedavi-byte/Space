const { readJsonBody, sendJson } = require('./_lib/http');
const { resolveAdminRequestAuth } = require('./_lib/admin-request-auth');
const { requireResolvedAdminPermission } = require('./_lib/admin-permissions');
const { getCommercialPermissions } = require('./_lib/commercial-permissions');
const booking = require('./_lib/commercial-bookings');
const createHandler=({authResolver=resolveAdminRequestAuth,permissionResolver=requireResolvedAdminPermission,request}={})=>async(req,res)=>{
  res.setHeader('Cache-Control','private, no-store');
  if(req.method!=='POST')return sendJson(res,405,{error:'method_not_allowed'});
  const auth=await authResolver(req,{logPrefix:'[meet-addon-context]'});
  if(!auth.ok)return sendJson(res,auth.status,auth.body);
  const user={...auth.session,commercialRoles:auth.profile?.user?.commercialRoles||auth.session?.commercialRoles||[]};
  const permissions=getCommercialPermissions(user),isAdmin=permissions.isAdmin;
  if(!user.sub || (!isAdmin&&!permissions.canUseSdrWorkspace))return sendJson(res,403,{error:'forbidden'});
  if(isAdmin){const p=await permissionResolver(auth,'comercial.spacePhone.view');if(!p.ok)return sendJson(res,p.status,p.body);}
  try{
    const body=await readJsonBody(req);
    return sendJson(res,200,await booking.meetContext({request,user,isAdmin,body}));
  }catch(e){
    const status=e.status||500;
    console.warn('[meet-addon-context]',JSON.stringify({code:e.status?e.message:'internal_error',status}));
    return sendJson(res,status,{error:e.status?e.message:'meeting_context_unavailable'});
  }
};
module.exports=createHandler();module.exports.createHandler=createHandler;
