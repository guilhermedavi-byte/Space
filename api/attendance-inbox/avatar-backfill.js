const { timingSafeEqual } = require('node:crypto');
const { sendJson, readJsonBody } = require('../../_lib/http');
const { supabaseFetch } = require('../_lib/supabase-rest');
const { byIdentity, logFailure } = require('../_lib/attendance-avatar');
// Maintenance only. Reuses the existing server credential; never sent to the operator UI.
const createHandler=({request=supabaseFetch,refresh=byIdentity,env=process.env}={})=>async(req,res)=>{
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST')return sendJson(res,405,{error:'method_not_allowed'});
 const expected=Buffer.from(env.SUPABASE_SERVICE_ROLE_KEY||env.SUPABASE_SERVICE_KEY||'');
 const supplied=Buffer.from(String(req.headers.authorization||'').replace(/^Bearer /,''));
 if(!expected.length||expected.length!==supplied.length||!timingSafeEqual(expected,supplied))return sendJson(res,401,{error:'unauthorized'});
 try{
  const body=await readJsonBody(req);const after=body.after || null;
  if(after&&!/^[a-f0-9-]{36}$/.test(after))return sendJson(res,400,{error:'invalid_cursor'});
  const {data}=await request('/rpc/attendance_avatar_backfill_candidates',{method:'POST',body:{p_after:after,p_limit:5}});
  const results=[];
  for(const identity of data||[]){
   try{const result=await refresh(identity);results.push({contact_id:identity.contact_id,status:result.asset?.fetch_status,code:result.asset?.error_code||null,cached:!!result.cached});}
   catch(e){logFailure(e);results.push({contact_id:identity.contact_id,status:'failed',code:'avatar_cache_failed'});}
  }
  return sendJson(res,200,{results,next_cursor:data?.length===5?data.at(-1).contact_identity_id:null});
 }catch(e){logFailure(e);return sendJson(res,503,{error:'avatar_backfill_unavailable'});}
};
module.exports=createHandler();module.exports.createHandler=createHandler;
