const {readJsonBody,sendJson}=require('../../_lib/http');
const {requireAttendanceAuth}=require('../_lib/attendance-auth');
const {fail,uuid,only}=require('../_lib/attendance-domain');
const {supabaseFetch}=require('../_lib/supabase-rest');
const {createComposerService}=require('../_lib/attendance-composer');
function createHandler({authenticate=requireAttendanceAuth,request=supabaseFetch,service=createComposerService({request})}={}){return async(req,res)=>{
 res.setHeader('Cache-Control','no-store');if(req.method!=='POST')return sendJson(res,405,{error:'method_not_allowed'});
 try{
  const actor=await authenticate(req,'attendance.reply',undefined,{adminPermission:'attendance.inbox.reply'});
  if(!['admin','growth'].includes(actor.role))fail('attendance_forbidden',403);
  if(['cross-site','same-site'].includes(req.headers?.['sec-fetch-site'])||(req.headers?.origin&&req.headers.origin!==String(process.env.SPACE_PUBLIC_BASE_URL||'https://plataforma.spaceschoolbr.com').replace(/\/$/,'')))fail('attendance_forbidden',403);
  const body=await readJsonBody(req);uuid(body.conversation_id);const cid=body.conversation_id;
  const fields={prepare:['upload_id','filename','mime','size','voice_note','duration'],send:['upload_id','caption'],assist:['mode','text'],replies:[],save_reply:['id','title','body','team_id','active']};
  if(!fields[body.action])fail('composer_invalid_action',422);only(body,['action','conversation_id',...fields[body.action]]);
  if(body.action==='prepare'||body.action==='send')uuid(body.upload_id);
  if((body.caption!==undefined && typeof body.caption!=='string')||(body.text!==undefined && typeof body.text!=='string')||body.caption?.length>4000||body.text?.length>4000)fail('composer_invalid_request',422);
  let result;
  if(['prepare','send','assist'].includes(body.action))result=await service[body.action](actor,cid,body);
  else{if(body.action==='save_reply'){
    if(actor.role!=='admin')fail('attendance_forbidden',403);
    await authenticate(req,'attendance.manage',undefined,{adminPermission:'attendance.inbox.reply'});
    if(typeof body.title!=='string'||!body.title.trim()||body.title.length>100||typeof body.body!=='string'||!body.body.trim()||body.body.length>4000)fail('composer_invalid_request',422);
    if(body.id)uuid(body.id);if(body.team_id)uuid(body.team_id);
   }
   const {action,conversation_id,...input}=body;result=await service.rpc(actor,cid,action,input);
  }
  return sendJson(res,200,result);
 }catch(error){const status=error.code==='42501'?403:['23505','PT409'].includes(error.code)?409:[400,401,403,409,422].includes(error.status)?error.status:503;
  const codes=new Set(['upload_invalid_file','upload_invalid_mime','upload_too_large','upload_size_mismatch','send_unconfirmed','assistant_unavailable','composer_empty_draft','voice_caption_not_supported','attendance_channel_disabled']);
  return sendJson(res,status,{error:codes.has(error.code)?error.code:status===403?'attendance_forbidden':'composer_unavailable'});
 }
};}
module.exports=createHandler();module.exports.createHandler=createHandler;
