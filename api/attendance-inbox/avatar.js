const { createHash } = require('node:crypto');
const { sendJson } = require('../../_lib/http');
const { requireAttendanceAuth } = require('../_lib/attendance-auth');
const { supabaseFetch } = require('../_lib/supabase-rest');
const { uuid } = require('../_lib/attendance-domain');
const { contactProfile } = require('../_lib/attendance-contact-profile');
const { resolve, logFailure } = require('../_lib/attendance-avatar');
const createHandler = ({authenticate=requireAttendanceAuth,request=supabaseFetch,resolveAvatar=resolve,resolveProfile=contactProfile}={}) => async(req,res)=>{
 res.setHeader('Cache-Control','private, max-age=300');
 res.setHeader('Vary','Cookie, Authorization');
 res.setHeader('X-Content-Type-Options','nosniff');
 if (!['GET','HEAD'].includes(req.method)) return sendJson(res,405,{error:'method_not_allowed'});
 try {
  const actor=await authenticate(req,'attendance.view',undefined,{adminPermission:'attendance.inbox.view'});
  if(!['admin','growth'].includes(actor.role))return sendJson(res,403,{error:'attendance_forbidden'});
  const id=new URL(req.url,'https://space.local').searchParams.get('contact_id');uuid(id);
  const {data}=await request('/rpc/attendance_get_contact_avatar',{method:'POST',body:{p_actor_uid:actor.uid,p_role:actor.role,p_contact_id:id},timeoutMs:15000});
  const official=await resolveProfile({contact:{},participants:data.participants || []});
  if(official.avatar_url){res.statusCode=302;res.setHeader('Location',official.avatar_url);return res.end();}
  const media=await resolveAvatar(data);
  if(!media?.buffer){res.setHeader('Cache-Control','private, max-age=60');return sendJson(res,404,{error:'avatar_unavailable'});}
  const etag='"'+createHash('sha256').update(media.buffer).digest('hex')+'"';
  res.setHeader('ETag',etag);res.setHeader('Content-Type','image/jpeg');res.setHeader('X-Attendance-Avatar-Source',media.source);
  if(req.headers?.['if-none-match']===etag){res.statusCode=304;return res.end();}
  res.statusCode=200;res.setHeader('Content-Length',media.buffer.length);res.setHeader('Content-Disposition','inline; filename="avatar.jpg"');
  return res.end(req.method==='HEAD'?undefined:media.buffer);
 }catch(e){logFailure(e);res.setHeader('Cache-Control','no-store');return sendJson(res,e.code==='42501'||e.status===403?403:[400,401,422].includes(e.status)?e.status:503,{error:'avatar_unavailable'});}
};
module.exports=createHandler();module.exports.createHandler=createHandler;
