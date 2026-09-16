// Operator runner, intentionally outside api/. No public processing/retry endpoint.
// Existing private production env is read explicitly; no .env file is written.
const {environment}=require('./attendance-production-validation');
const {createMetaStore}=require('../api/_lib/attendance-meta-store');
const {createMetaProcessor}=require('../api/_lib/attendance-meta-processor');
const {assertAttendanceTarget}=require('../_lib/attendance-environment');
async function main(args=process.argv.slice(2)){
 const [filename,eventId,limitText='25']=args;
 if(!filename||!eventId||args.length>3||!(eventId==='due'||/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(eventId)))throw Error('usage: private-env-file event-uuid|due [limit 1..100]');
 const limit=Number(limitText);if(!Number.isInteger(limit)||limit<1||limit>100)throw Error('meta_invalid_limit');
 const {env}=environment(filename);
 // CLI is an explicit operator action. It needs Supabase credentials, not Meta secrets.
 const request=async(route,{method,body})=>{
  assertAttendanceTarget(env);
  const response=await fetch(new URL('/rest/v1'+route,env.SUPABASE_URL),{method,redirect:'error',signal:AbortSignal.timeout(30000),
   headers:{apikey:env.SUPABASE_SERVICE_ROLE_KEY,Authorization:'Bearer '+env.SUPABASE_SERVICE_ROLE_KEY,'Content-Type':'application/json'},body:JSON.stringify(body)});
  if(!response.ok)throw Error('meta_database_request_failed');return {data:await response.json()};
 };
 const repository=createMetaStore({request,checkEnvironment:()=>assertAttendanceTarget(env)});
 const processEvent=createMetaProcessor({repository});
 for(let n=0;n<(eventId==='due'?limit:1);n++){
  const result=await processEvent(eventId==='due'?null:eventId);
  if(result.state==='not_claimed')break;
 }
}
if(require.main===module)main().catch(()=>{console.error('meta_operator_failed');process.exitCode=1;});
module.exports={main};
