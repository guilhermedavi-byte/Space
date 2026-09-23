const {getSessionFromRequest}=require('../_lib/session');
const {canAccessFinance}=require('./_lib/finance-integrations');
const {requireAdminPermission}=require('./_lib/admin-permissions');
const {createReader}=require('./_lib/finance-v1-read');
const {createPerformanceTimer}=require('./_lib/performance-observer');
const crypto=require('crypto');
function createHandler({session=getSessionFromRequest,reader,env=process.env}={}){
 let service=reader;
 return async(req,res)=>{
  const perf=createPerformanceTimer({req,route:'/api/finance-v1',operation:'finance_overview'});
  res.setHeader('Cache-Control','private, max-age=0, must-revalidate');res.setHeader('Content-Type','application/json');
  const etagOf=data=>'\"finance-v1-'+crypto.createHash('sha1').update(JSON.stringify({month:data?.month||null,snapshot_at:data?.snapshot_at||data?.meta?.snapshot_at||null,ledger_version:data?.meta?.ledger_version||null,read_model:data?.meta?.overview_read_model_version||data?.meta?.overview_snapshot_schema||null,stale:Boolean(data?.stale)})).digest('hex')+'\"';
  const send=(status,data)=>{if(status===200&&data&&view==='overview'){const etag=etagOf(data);res.setHeader('ETag',etag);if(String(req.headers?.['if-none-match']||'')===etag){perf.finish(res,{not_modified:true});res.statusCode=304;return res.end();}}perf.finish(res,data);res.statusCode=status;res.end(JSON.stringify(data));};
  const user=await perf.measure('auth',()=>Promise.resolve(session(req)));if(!user)return send(401,{error:'unauthorized'});if(!canAccessFinance(user))return send(403,{error:'forbidden'});
  if(req.method!=='GET'){res.setHeader('Allow','GET');return send(405,{error:'read_only'});}
  if(env.FINANCE_FOUNDATION_ENABLED!=='true')return send(503,{error:'finance_foundation_disabled'});
  const q=Object.fromEntries(new URL(req.url||'/', 'https://space.invalid').searchParams);const view=q.view||'overview';
  if(String(user.role||'')==='admin'){
    const map={overview:'overview',receivables:'receivables',subscriptions:'subscriptions',customers:'customers',receivable:'receivables',recovery:'recovery',reconciliation:'pending',reconciliation_movement:'pending',exceptions:'pending',closing:'closing'};
    const perm=`financeiro.${map[view]||'overview'}.view`;
    const guard=await requireAdminPermission(req,perm);if(!guard.ok)return send(guard.status,guard.body);
  }
  perf.set('operation',`finance_${view}`);
  if(view==='receivable'&&!/^pay_[A-Za-z0-9_-]+$/.test(q.id||''))return send(400,{error:'finance_filter_invalid'});
  if(view==='reconciliation_movement'&&!/^mov_pay_[A-Za-z0-9_-]+$/.test(q.id||''))return send(400,{error:'finance_filter_invalid'});
  if(!['overview','receivables','subscriptions','customers','receivable','recovery','reconciliation','reconciliation_movement','exceptions','closing'].includes(view)||Object.values(q).some(v=>v.length>160)||q.month&&!/^\d{4}-(0[1-9]|1[0-2])$/.test(q.month)||q.page&&(!/^\d{1,4}$/.test(q.page)||Number(q.page)<1)||['from','to'].some(k=>q[k]&&(!/^\d{4}-\d{2}-\d{2}$/.test(q[k])||Number.isNaN(Date.parse(q[k]))||new Date(q[k]).toISOString().slice(0,10)!==q[k]))||q.from&&q.to&&q.from>q.to)return send(400,{error:'finance_filter_invalid'});
  try{const activeReader=reader||(service ||= createReader({overviewReadModelRequired:true}));const result=await perf.measure('financeRead',()=>activeReader.get(view,q));return send(result.not_found?404:200,result);}
  catch(error){console.warn('[finance-v1] read_failed',JSON.stringify({view,error:error?.message||'finance_read_unavailable'}));return send(503,{error:'finance_read_unavailable'});}
 };
}
module.exports=createHandler();module.exports.createHandler=createHandler;
