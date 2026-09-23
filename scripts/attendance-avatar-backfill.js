#!/usr/bin/env node
// Run with existing server environment. Never writes env files or prints credentials.
async function backfill({baseUrl=process.env.SPACE_BASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SERVICE_KEY,fetchImpl=fetch}={}){
 const url=new URL(baseUrl || 'https://plataforma.spaceschoolbr.com');
 if(url.protocol!=='https:' || url.username || url.password || !key)throw Error('avatar_backfill_config_missing');
 let after=null,total=0;
 do{
  const r=await fetchImpl(new URL('/api/attendance-inbox/avatar-backfill',url),{method:'POST',redirect:'error',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({after}),signal:AbortSignal.timeout(240000)});
  if(!r.ok)throw Error('avatar_backfill_http_'+r.status);
  const data=await r.json();for(const row of data.results||[]){console.log(JSON.stringify({contact_id:row.contact_id,status:row.status,code:row.code,cached:row.cached}));total++;}
  after=data.next_cursor;
 }while(after);
 console.log(JSON.stringify({processed:total}));
}
module.exports={backfill};
if(require.main===module)backfill().catch(e=>{console.error(/^avatar_backfill_/.test(e.message)?e.message:'avatar_backfill_failed');process.exitCode=1;});
