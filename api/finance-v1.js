const {getSessionFromRequest}=require('../_lib/session');
const {canAccessFinance}=require('./_lib/finance-integrations');
const {createReader}=require('./_lib/finance-v1-read');
const {createPerformanceTimer}=require('./_lib/performance-observer');
function createHandler({session=getSessionFromRequest,reader,env=process.env}={}){
 let service=reader;
 return async(req,res)=>{
  const perf=createPerformanceTimer({req,route:'/api/finance-v1',operation:'finance_overview'});
  res.setHeader('Cache-Control','private, no-store');res.setHeader('Content-Type','application/json');
  const send=(status,data)=>{perf.finish(res,data);res.statusCode=status;res.end(JSON.stringify(data));};
  const user=await perf.measure('auth',()=>Promise.resolve(session(req)));if(!user)return send(401,{error:'unauthorized'});if(!canAccessFinance(user))return send(403,{error:'forbidden'});
  if(req.method!=='GET'){res.setHeader('Allow','GET');return send(405,{error:'read_only'});}
  if(env.FINANCE_FOUNDATION_ENABLED!=='true')return send(503,{error:'finance_foundation_disabled'});
  const q=Object.fromEntries(new URL(req.url||'/', 'https://space.invalid').searchParams);const view=q.view||'overview';
  perf.set('operation',`finance_${view}`);
  if(view==='receivable'&&!/^pay_[A-Za-z0-9_-]+$/.test(q.id||''))return send(400,{error:'finance_filter_invalid'});
  if(view==='reconciliation_movement'&&!/^mov_pay_[A-Za-z0-9_-]+$/.test(q.id||''))return send(400,{error:'finance_filter_invalid'});
  if(!['overview','receivables','subscriptions','customers','receivable','recovery','reconciliation','reconciliation_movement'].includes(view)||Object.values(q).some(v=>v.length>160)||q.month&&!/^\d{4}-(0[1-9]|1[0-2])$/.test(q.month)||q.page&&(!/^\d{1,4}$/.test(q.page)||Number(q.page)<1)||['from','to'].some(k=>q[k]&&(!/^\d{4}-\d{2}-\d{2}$/.test(q[k])||Number.isNaN(Date.parse(q[k]))||new Date(q[k]).toISOString().slice(0,10)!==q[k]))||q.from&&q.to&&q.from>q.to)return send(400,{error:'finance_filter_invalid'});
  try{service ||= createReader();const result=await perf.measure('financeRead',()=>service.get(view,q));return send(result.not_found?404:200,result);}
  catch{return send(503,{error:'finance_read_unavailable'});}
 };
}
module.exports=createHandler();module.exports.createHandler=createHandler;
