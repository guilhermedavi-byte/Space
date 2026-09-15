// Temporary audit boundary. Install only inside the dedicated child process.
const {AsyncLocalStorage}=require('node:async_hooks');
const Module=require('node:module');
function createGuard({env,fetchImpl=global.fetch}){
  const counts={firestoreWritesAttempted:0,datacrazyMutationsAttempted:0,snapshotWritesAttempted:0,blockedRequests:0};
  const secrets=new Set(Object.entries(env).filter(([k,v])=>/KEY|TOKEN|SECRET|ACCOUNT_JSON/.test(k)&&v).map(([,v])=>v));
  try{Object.values(JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_JSON||'{}')).filter(v=>typeof v==='string'&&v.length>8).forEach(v=>secrets.add(v));}catch{}
  const crm=new URL(env.CRM_API_BASE_URL);if(crm.protocol!=='https:'||crm.username||crm.password||crm.search||crm.hash)throw new Error('invalid_crm_base');
  const firestorePrefix='/v1/projects/plataforma-space/databases/(default)/documents/';
  const readPaths=new Set(['growthPeople','users','sdrActivityEvents','crmLiveSnapshots','growthConfig/crmLiveDefaults','crmLiveCache/crm',...['06','07','08','09','10'].map(m=>'growthGoals/2026-'+m)]);
  const context=new AsyncLocalStorage();
  const deny=(kind='blockedRequests')=>{counts[kind]++;throw new Error('audit_write_or_network_blocked');};
  const fetchReadOnly=async(input,options={})=>{
    // Request objects are rejected so their method/body cannot bypass inspection.
    if(typeof input!=='string'&&!(input instanceof URL))return deny();
    const url=new URL(input),method=String(options.method||'GET').toUpperCase();
    if(url.username||url.password||url.hash)return deny();
    const firestore=url.origin==='https://firestore.googleapis.com';
    const datacrazy=url.origin===crm.origin;
    if(firestore&&method!=='GET'){
      counts.firestoreWritesAttempted++;
      if(/crmLive|:commit|:batchWrite/.test(url.pathname)||/crmLive/.test(String(options.body||'')))counts.snapshotWritesAttempted++;
      throw new Error('audit_write_or_network_blocked');
    }
    if(datacrazy&&method!=='GET')return deny('datacrazyMutationsAttempted');
    if(method==='GET'&&options.body!==undefined)return deny();
    const oauth=url.href==='https://oauth2.googleapis.com/token'&&method==='POST';
    const crmRead=datacrazy&&method==='GET'&&url.pathname===crm.pathname.replace(/\/$/,'')+'/api/v1/businesses'&&[...url.searchParams.keys()].every(k=>['skip','take'].includes(k));
    const fsRead=firestore&&method==='GET'&&url.pathname.startsWith(firestorePrefix)&&readPaths.has(decodeURIComponent(url.pathname.slice(firestorePrefix.length)))&&[...url.searchParams.keys()].every(k=>['pageSize','pageToken','mask.fieldPaths'].includes(k));
    if(!(oauth||crmRead||fsRead))return deny();
    if(oauth){const form=new URLSearchParams(options.body);if(form.get('grant_type')!=='urn:ietf:params:oauth:grant-type:jwt-bearer')return deny();}
    const response=await context.run(true,()=>fetchImpl(url.href,{...options,redirect:'error'}));
    if(oauth&&response.ok){const body=await response.clone().json();if(body.access_token)secrets.add(body.access_token);}
    return response;
  };
  const wrapReads=reads=>new Proxy(Object.freeze({...reads}),{get(target,key){if(key in target)return target[key];if(['set','update','delete','add','create','batch','commit','transaction','publish'].includes(key))return ()=>deny('firestoreWritesAttempted');return undefined;}});
  function install(){
    Object.defineProperty(global,'fetch',{value:fetchReadOnly,writable:false,configurable:false});
    // Direct transports cannot evade the fetch allowlist. Only the original fetch's
    // async context may open sockets; callers never receive that capability.
    for(const [name,methods] of Object.entries({http:['request','get'],https:['request','get'],net:['connect','createConnection'],tls:['connect'],http2:['connect']})){
      const mod=require('node:'+name);for(const key of methods){const original=mod[key];mod[key]=function(...args){if(!context.getStore())return deny();return original.apply(this,args);};}
    }
    const socket=require('node:net').Socket.prototype;const connect=socket.connect;
    socket.connect=function(...args){if(!context.getStore())return deny();return connect.apply(this,args);};
    const fs=require('node:fs');for(const name of ['writeFile','writeFileSync','appendFile','appendFileSync','createWriteStream','unlink','unlinkSync','rm','rmSync','rename','renameSync'])fs[name]=()=>deny();
    for(const name of ['writeFile','appendFile','unlink','rm','rename'])fs.promises[name]=async()=>deny();
    const load=Module._load;
    Module._load=function(request,parent,isMain){
      if(['child_process','node:child_process','worker_threads','node:worker_threads'].includes(request))return new Proxy({},{get:()=>()=>deny()});
      const result=load.apply(this,arguments);
      if(typeof result!=='object'||!result)return result;
      const names=/crm-snapshot-publish/.test(request)?['publishCrmSnapshot','runCrmSnapshot']:/crm-source-snapshot/.test(request)?['getCompleteCrmSource','createSourceService']:/firestore-admin/.test(request)?['commitWritesAsAdmin']:[];
      if(!names.length)return result;
      return new Proxy(result,{get(target,key){if(names.includes(key))return ()=>deny(/snapshot/.test(request)?'snapshotWritesAttempted':'firestoreWritesAttempted');return target[key];}});
    };
  }
  return {counts,secrets,fetchReadOnly,wrapReads,install};
}
module.exports={createGuard};
