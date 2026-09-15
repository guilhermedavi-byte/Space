// Runs against an expiring, authenticated deployment. Asaas key stays in Vercel.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {AsaasError}=require('../../api/_lib/asaas');
async function connect({deployment,stateFile='/tmp/space-finance-preflight-private.json'}){
  const state=JSON.parse(fs.readFileSync(stateFile));
  if(Date.now()>Date.parse(state.expiresAt))throw Error('bridge_expired');
  const auth=JSON.parse(fs.readFileSync(path.join(os.homedir(),'Library/Application Support/com.vercel.cli/auth.json')));
  const team='team_QFoYBpP3YUXGD4agYHZ7I6jV',project='prj_FcxsR8A6rXLVIo2DArdAFDlm7pq8';
  const metadata=async route=>{const r=await fetch('https://api.vercel.com'+route+'?teamId='+team,{headers:{Authorization:'Bearer '+auth.token},redirect:'error'});if(!r.ok)throw Error('metadata_failed');return r.json();};
  const d=await metadata('/v13/deployments/'+deployment);const p=await metadata('/v9/projects/'+project);
  if(d.projectId!==project||d.target!=='production'||d.readyState!=='READY'||d.alias.length||!['all_except_custom_domains','all'].includes(p.ssoProtection?.deploymentType))throw Error('bridge_target_invalid');
  const bypass=Object.keys(p.protectionBypass||{}).find(k=>p.protectionBypass[k].scope==='automation-bypass');if(!bypass)throw Error('bridge_protection_unavailable');
  let nextRequestAt=0,lastRateLimits=null;
  const call=async(mode,query={})=>{const url='https://'+d.url+'/api/finance-production-preflight?'+new URLSearchParams({mode,...query});const r=await fetch(url,{method:'POST',redirect:'error',signal:AbortSignal.timeout(35000),headers:{'x-vercel-protection-bypass':bypass,'x-finance-certification-token':state.token}});let j;try{j=await r.json();}catch{throw new AsaasError('asaas_bridge_response_invalid',r.status);}
    if(!r.ok||j.status==='FAIL'){const e=new AsaasError(j.error?.code||'asaas_bridge_failed',j.error?.status||r.status,j.error?.retryable===true);e.rate_limits=j.error?.rate_limits||null;throw e;}return j;};
  const checkAsaasConnection=()=>call('account');
  const request=async(resource,options={})=>{if(options.method&&options.method!=='GET'||options.body!==undefined)throw new AsaasError('asaas_read_only');const start=Math.max(Date.now(),nextRequestAt);nextRequestAt=start+800;const delay=start-Date.now();if(delay>0)await new Promise(resolve=>setTimeout(resolve,delay));const result=await call('read',{path:resource});lastRateLimits=result.rate_limits;if(lastRateLimits?.['RateLimit-Remaining']===0)nextRequestAt=Math.max(nextRequestAt,Date.now()+(lastRateLimits['RateLimit-Reset']||60)*1000);return result.data;};
  async function* pages(resource,{filters={},offset=0,limit=100,maxPages=10000}={}){if(!['payments','customers','subscriptions'].includes(resource)||!Number.isInteger(offset)||offset<0||!Number.isInteger(limit)||limit<1||limit>100)throw new AsaasError('asaas_pagination_invalid');for(let page=0;page<maxPages;page++){const r=await request('/'+resource+'?'+new URLSearchParams({...filters,offset:String(offset),limit:String(limit)}));if(!Array.isArray(r.data)||typeof r.hasMore!=='boolean'||r.data.length>limit||(r.hasMore&&!r.data.length))throw new AsaasError('asaas_pagination_invalid');const nextOffset=offset+r.data.length;yield {data:r.data,offset,nextOffset,hasMore:r.hasMore};if(!r.hasMore)return;offset=nextOffset;}throw new AsaasError('asaas_page_limit');}
  const client={checkAsaasConnection,request,pages,rateLimits:()=>lastRateLimits};const h=await checkAsaasConnection();if(!h.authenticated||!h.account_accessible||h.environment!=='production')throw Error('health_required');
  return {client,health:h,deployment:d.url};
}
module.exports={connect};
