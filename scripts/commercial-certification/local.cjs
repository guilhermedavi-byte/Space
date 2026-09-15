// Local-only entry point. No CLI arguments, dotenv, Vercel or credential files.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {fork}=require('node:child_process');
const {Readable}=require('node:stream');
const {sanitize}=require('./output.cjs');
const KEYS=['CRM_API_BASE_URL','CRM_API_KEY','GOOGLE_SERVICE_ACCOUNT_JSON'];
const ROOT=path.resolve(__dirname,'../..');
function credentials(env,args=[],execArgs=[]){
  if(args.length||execArgs.length||env.NODE_OPTIONS||env.NODE_PATH)throw Error('arguments_or_runtime_injection_forbidden');
  if(!KEYS.every(k=>typeof env[k]==='string'&&env[k].trim()))throw Error('missing_credentials');
  const base=new URL(env.CRM_API_BASE_URL);
  if(base.protocol!=='https:'||base.username||base.password||base.search||base.hash)throw Error('invalid_base');
  const sa=JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_JSON);
  if(sa.type!=='service_account'||sa.project_id!=='plataforma-space'||sa.client_email!=='commercial-cert-202609@plataforma-space.iam.gserviceaccount.com'||!sa.private_key_id||!sa.private_key)throw Error('dedicated_audit_identity_required');
  if(crypto.createPrivateKey(sa.private_key.replace(/\\n/g,'\n')).asymmetricKeyType!=='rsa')throw Error('invalid_key');
  const values=[...KEYS.map(k=>env[k]),sa.private_key,sa.private_key.replace(/\\n/g,'\n'),sa.private_key_id];
  const secrets=new Set(values.flatMap(v=>[v,JSON.stringify(v).slice(1,-1),Buffer.from(v).toString('base64')]));
  return {env:{...Object.fromEntries(KEYS.map(k=>[k,env[k]])),APP_ENV:'production',NODE_ENV:'production'},secrets};
}
// Scan current files, including ignored files, binary files and artifacts. Git's
// object database is excluded; historical/encoded copies cannot be proven absent.
function scanWorkspace(root,secrets){
  const needles=[...secrets].filter(Boolean).map(s=>Buffer.from(s));
  const overlap=Math.max(0,...needles.map(b=>b.length))-1;
  function visit(dir){
    for(const n of fs.readdirSync(dir)){
      if(dir===root&&n==='.git')continue;
      const file=path.join(dir,n),stat=fs.lstatSync(file);
      if(stat.isSymbolicLink())throw Error('workspace_symlink_forbidden');
      if(stat.isDirectory()){visit(file);continue;}
      if(!stat.isFile())throw Error('workspace_special_file_forbidden');
      const fd=fs.openSync(file,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW);
      try{
        const chunk=Buffer.alloc(65536);let tail=Buffer.alloc(0),size;
        while((size=fs.readSync(fd,chunk,0,chunk.length,null))>0){
          const bytes=Buffer.concat([tail,chunk.subarray(0,size)]);
          if(needles.some(b=>bytes.includes(b)))throw Error('credential_on_disk');
          tail=Buffer.from(bytes.subarray(Math.max(0,bytes.length-overlap)));
        }
      }finally{fs.closeSync(fd);}
    }
  }
  visit(root);
}
function runWorker(cleanEnv,spawn=fork){
  return new Promise((resolve,reject)=>{
    const child=spawn(path.join(__dirname,'worker.cjs'),[],{env:cleanEnv,stdio:['ignore','ignore','ignore','ipc'],execArgv:[]});
    let finished=false;
    const finish=(error,value)=>{if(finished)return;finished=true;clearTimeout(timer);child.kill();error?reject(Error('worker_failed')):resolve(value);};
    const timer=setTimeout(()=>finish(true),280000);
    child.once('message',v=>finish(false,v));
    child.once('error',()=>finish(true));
    child.once('exit',()=>finish(true));
  });
}
async function main(){
  const c=credentials(process.env,process.argv.slice(2),process.execArgv);
  scanWorkspace(ROOT,c.secrets);
  const report=sanitize(await runWorker(c.env),c.secrets);
  scanWorkspace(ROOT,c.secrets);
  const destination=path.join(ROOT,'artifacts','commercial-local-'+crypto.randomUUID());
  // persist repeats sanitization and validates PASS evidence before writing.
  await require('./persist.cjs').persist(Readable.from([JSON.stringify(report)]),destination);
  scanWorkspace(ROOT,c.secrets);
  process.stdout.write('Certification '+report.certification+'; sanitized artifacts saved.\n');
  if(report.certification!=='PASS')process.exitCode=1;
}
// Never forward exception messages, stack traces, paths or child output.
if(require.main===module){
  const fail=()=>{process.stderr.write('Local certification blocked or failed; no diagnostic payload emitted.\n');process.exitCode=1;};
  process.on('uncaughtException',()=>{fail();process.exit(1);});
  main().catch(fail);
}
module.exports={credentials,scanWorkspace,runWorker};
