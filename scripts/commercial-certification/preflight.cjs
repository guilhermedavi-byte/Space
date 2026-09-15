// READ-ONLY Vercel metadata check. No env pull, deployment or function invocation.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {verify}=require('./verify.cjs');
(async()=>{
 const local=verify();if(local.expired)throw new Error('expired');
 const auth=JSON.parse(fs.readFileSync(path.join(os.homedir(),'Library/Application Support/com.vercel.cli/auth.json')));
 const res=await fetch('https://api.vercel.com/v9/projects/prj_FcxsR8A6rXLVIo2DArdAFDlm7pq8?teamId=team_QFoYBpP3YUXGD4agYHZ7I6jV',{headers:{Authorization:`Bearer ${auth.token}`},redirect:'error'});
 if(!res.ok)throw new Error('unavailable');const p=await res.json();
 if(!['all_except_custom_domains','all'].includes(p.ssoProtection?.deploymentType)||p.crons?.definitions?.length)throw new Error('protection_or_cron_gate');
 console.log(JSON.stringify({preflight:'PASS',...local,protection:p.ssoProtection.deploymentType,crons:0,requiresUnauthenticatedProbeAfterDeployment:true}));
})().catch(()=>{process.stderr.write('Preflight failed; do not deploy or invoke.\n');process.exitCode=1;});
