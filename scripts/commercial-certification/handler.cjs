// Template ONLY: no route exists in the normal application.
const {fork}=require('node:child_process');
const path=require('node:path');
const {sanitize,failure}=require('./output.cjs');
function createHandler({manifest,env=process.env,spawn=fork,clock=Date.now}){
  let started=false;
  return async(req,res)=>{
    res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json');
    const host=String(req.headers.host||'').split(':')[0];
    if(req.headers.origin||req.method!=='POST'||req.url!=='/api/certify'||env.VERCEL_ENV!=='production'||!env.VERCEL_URL||host!==env.VERCEL_URL||clock()>Date.parse(manifest.expiresAt)||!Number.isFinite(Date.parse(manifest.expiresAt))){res.statusCode=404;return res.end('{"error":"unavailable"}');}
    if(started){res.statusCode=409;return res.end('{"error":"already_started"}');}started=true;
    const cleanEnv=Object.fromEntries(['CRM_API_BASE_URL','CRM_API_KEY','GOOGLE_SERVICE_ACCOUNT_JSON'].filter(k=>env[k]).map(k=>[k,env[k]]));
    cleanEnv.APP_ENV='production';cleanEnv.NODE_ENV='production';
    const child=spawn(path.join(__dirname,'worker.cjs'),[],{env:cleanEnv,stdio:['ignore','ignore','ignore','ipc'],execArgv:[]});
    const zero={firestoreWritesAttempted:0,datacrazyMutationsAttempted:0,snapshotWritesAttempted:0,blockedRequests:0};
    const unknown=code=>({...failure(zero,{},code),writesAttempted:null,counters:Object.fromEntries(Object.keys(zero).map(k=>[k,null])),countersVerified:false});
    let finished=false;
    const done=(report,status=200)=>{if(finished)return;finished=true;clearTimeout(timer);child.kill();res.statusCode=status;res.end(JSON.stringify(report));};
    const timer=setTimeout(()=>done(unknown('execution_timeout'),504),280000);
    child.once('message',message=>{try{done(sanitize(message,new Set(Object.values(cleanEnv))));}catch{done(unknown('unsafe_output'),500);}});
    child.once('error',()=>done(unknown('worker_failed'),500));
    child.once('exit',()=>{if(!finished)done(unknown('worker_failed'),500);});
  };
}
module.exports={createHandler};
