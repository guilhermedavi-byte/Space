const {readJsonBody,sendJson}=require('../_lib/http');
const {resolveAdminRequestAuth}=require('./_lib/admin-request-auth');
const {requireResolvedAdminPermission}=require('./_lib/admin-permissions');
const {supabaseFetch}=require('./_lib/supabase-rest');
const fields='id,professor_nome,email,status,bot_enabled,audit_enabled,aliases,created_at,updated_at';
const allowed=['professor_nome','email','status','bot_enabled','audit_enabled','aliases'];
const fail=(message,status=422)=>Object.assign(new Error(message),{status});
function validate(input,create){
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!allowed.includes(k)))throw fail('invalid_fields');
 const p={...input};
 for(const k of ['professor_nome','email'])if(k in p){if(typeof p[k]!=='string')throw fail('invalid_fields');p[k]=p[k].trim();}
 if('email' in p){p.email=p.email.toLowerCase();if(p.email.length>254||!/^\S+@[^\s@]+\.[^\s@]+$/.test(p.email))throw fail('invalid_email');}
 if('professor_nome' in p&&(!p.professor_nome||p.professor_nome.length>150))throw fail('invalid_name');
 if('status' in p&&!['ativo','inativo'].includes(p.status))throw fail('invalid_status');
 for(const k of ['bot_enabled','audit_enabled'])if(k in p&&typeof p[k]!=='boolean')throw fail('invalid_fields');
 if('aliases' in p){if(!Array.isArray(p.aliases)||p.aliases.length>30||p.aliases.some(a=>typeof a!=='string'||a.length>150))throw fail('invalid_aliases');p.aliases=[...new Set(p.aliases.map(a=>a.trim()).filter(Boolean))];}
 if(create&&(!p.professor_nome||!p.email))throw fail('required_fields');
 if(!Object.keys(p).length)throw fail('required_fields');
 return p;
}
const createHandler=({authenticate=resolveAdminRequestAuth,authorize=requireResolvedAdminPermission,request=supabaseFetch}={})=>async(req,res)=>{
 res.setHeader('Cache-Control','no-store');
 if(!['GET','POST','PATCH'].includes(req.method))return sendJson(res,405,{error:'method_not_allowed'});
 try{
  const auth=await authenticate(req);if(!auth.ok)return sendJson(res,auth.status,auth.body);
  if(auth.session?.role!=='admin')return sendJson(res,403,{error:'forbidden'});
  const permission='pedagogico.users.'+(req.method==='GET'?'view':req.method==='POST'?'create':'update');
  const guard=await authorize(auth,permission);if(!guard.ok)return sendJson(res,guard.status,guard.body);
  if(req.method==='GET'){
   let teachers=[];for(let offset=0;;offset+=500){const {data}=await request(`/n8n_professores_space?select=${fields}&order=professor_nome.asc,id.asc&limit=500&offset=${offset}`);if(!Array.isArray(data))throw fail('unavailable',503);teachers.push(...data);if(data.length<500)break;}
   const [edit,create]=await Promise.all(['update','create'].map(p=>authorize(auth,'pedagogico.users.'+p)));
   return sendJson(res,200,{teachers,permissions:{edit:edit.ok,create:create.ok}});
  }
  const origin=req.headers.origin;
  if(origin&&new URL(origin).host!==req.headers.host)return sendJson(res,403,{error:'origin_forbidden'});
  const body=await readJsonBody(req);
  if(Object.keys(body).some(k=>!['id','expectedUpdatedAt','changes'].includes(k)))throw fail('invalid_fields');
  const changes=validate(body.changes,req.method==='POST');
  if(req.method==='PATCH'&&(!/^\d+$/.test(String(body.id))||!Object.hasOwn(body,'expectedUpdatedAt')))throw fail('invalid_fields');
  if(changes.status==='inativo'){
   const deactivate=await authorize(auth,'pedagogico.users.deactivate');if(!deactivate.ok)return sendJson(res,deactivate.status,deactivate.body);
  }
  const {data}=await request('/rpc/space_growth_control_write',{method:'POST',body:{p_id:req.method==='POST'?null:String(body.id),p_patch:changes,p_expected_updated_at:body.expectedUpdatedAt??null,p_actor_uid:auth.session.sub}});
  return sendJson(res,req.method==='POST'?201:200,{teacher:data});
 }catch(e){
  const code=['duplicate_email','edit_conflict','teacher_not_found','invalid_fields','required_fields','invalid_email','invalid_name','invalid_status','invalid_aliases'].find(c=>String(e.message).includes(c));
  return sendJson(res,code?(code==='duplicate_email'||code==='edit_conflict'?409:code==='teacher_not_found'?404:422):503,{error:code||'temporarily_unavailable'});
 }
};
module.exports=createHandler();module.exports.createHandler=createHandler;module.exports.validate=validate;
