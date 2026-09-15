const {pickPayment,inspect}=require('./inspect.cjs');
const PICK={customers:['id','deleted','dateCreated','name','email'],subscriptions:['id','deleted','dateCreated','customer','status','value','cycle','billingType','nextDueDate']};
async function readBridge(req,client,env){
  if(req.query?.mode!=='read')return inspect(client,env);
  const path=req.query.path;if(typeof path!=='string'||path.length>1200)throw Error();
  const url=new URL(path,'https://api.asaas.com');
  const match=url.pathname.match(/^\/(payments|customers|subscriptions)(?:\/([A-Za-z0-9_-]{1,256}))?$/);
  const allowed=new Set(['offset','limit','status','customer','subscription','dateCreated[ge]','dateCreated[le]','paymentDate[ge]','paymentDate[le]','dueDate[ge]','dueDate[le]']);
  if(url.origin!=='https://api.asaas.com'||!match||url.hash||[...url.searchParams.keys()].some(k=>!allowed.has(k))||(!match[2]&&(!/^\d+$/.test(url.searchParams.get('offset')||'0')||!/^\d+$/.test(url.searchParams.get('limit')||'100')||Number(url.searchParams.get('limit')||100)>100)))throw Error();
  const scrub=p=>match[1]==='payments'?pickPayment(p):Object.fromEntries(PICK[match[1]].filter(k=>Object.hasOwn(p,k)).map(k=>[k,p[k]]));
  try{const r=await client.request(url.pathname+url.search);return {status:'PASS',stage:'read',rate_limits:client.rateLimits?.()||null,data:match[2]?scrub(r):{totalCount:r.totalCount,hasMore:r.hasMore,offset:r.offset,limit:r.limit,data:r.data.map(scrub)}};}
  catch(e){return {status:'FAIL',stage:'read',error:{code:/^asaas_[a-z_]+$/.test(e.code)?e.code:'asaas_error',status:Number(e.status)||0,retryable:e.retryable===true,rate_limits:client.rateLimits?.()||null}};}
}
function clientWithLimits(asaas){let limits=null;const client=asaas.createAsaasClient({readOnly:true,fetchImpl:async(...args)=>{const r=await fetch(...args);limits={};for(const name of ['RateLimit-Limit','RateLimit-Remaining','RateLimit-Reset','Retry-After']){const raw=r.headers.get(name);if(raw!==null&&/^\d+(?:\.\d+)?$/.test(raw)&&Number(raw)<=86400)limits[name]=Number(raw);}return r;}});return {...client,rateLimits:()=>limits};}
module.exports={readBridge,clientWithLimits};
