const test=require('node:test'),assert=require('node:assert/strict');
const {createAvatarService,profileUrl,canonicalAvatar}=require('../api/_lib/attendance-avatar');
const {createHandler}=require('../api/attendance-inbox/avatar');
const identity={contact_identity_id:'62cab875-8fa9-4c0d-b934-554c06dba52d',contact_id:'73c7d733-537b-4003-9abb-11afaaf45e34',connection_id:'c',identifier_type:'whatsapp_jid',external_identifier:'jid',normalized_phone:'+5534999999999'};
const path=`profiles/${identity.contact_identity_id}.jpg`;
const env={EVOLUTION_API_URL:'https://transport.example',EVOLUTION_API_KEY:'test',SUPABASE_URL:'https://storage.example',SUPABASE_SERVICE_ROLE_KEY:'test'};
function harness({asset={},noPhoto=false,providerStatus=200,storageStatus=200}={}){
 const calls=[],writes=[];let saved=asset;
 const request=async(_,{body})=>{writes.push(body.p_asset);if(body.p_asset.op==='claim')return {data:{claimed:true}};saved={...saved,...body.p_asset,expires_at:new Date(Date.now()+86400000).toISOString()};return {data:{asset:saved}};};
 const fetchImpl=async(url,opts={})=>{calls.push(url);if(url.includes('fetchProfile'))return new Response(JSON.stringify(noPhoto?{}:{profilePictureUrl:'https://pps.whatsapp.net/photo'}),{status:providerStatus});return new Response(Buffer.from('image'),{status:url.includes('storage.example')?storageStatus:200});};
 const service=createAvatarService({env,request,fetchImpl,image:async b=>b});
 const context={identity,connection:{instance_name:'space-suporte'},asset};
 return {service,context,calls,writes};
}
test('profile URLs require HTTPS and approved photo CDN; canonical API has one avatar property',()=>{
 for(const u of ['http://pps.whatsapp.net/p','https://127.0.0.1/p','https://pps.whatsapp.net.evil.org/p','https://x:pass@pps.whatsapp.net/p'])assert.throws(()=>profileUrl(u));
 assert.equal(profileUrl('https://pps.whatsapp.net/p'),'https://pps.whatsapp.net/p');
 const c=canonicalAvatar({contact_id:identity.contact_id,photo_url:'a',whatsapp_avatar_url:'b',avatar:{url:'c'}});assert.equal(c.photo_url,undefined);assert.match(c.avatar_url,/\/api\/attendance-inbox\/avatar/);
});
test('missing avatar downloads once, caches and serves bytes',async()=>{
 const h=harness();const result=await h.service.resolve(h.context);assert.equal(result.mime,'image/jpeg');assert.equal(result.source,'storage');assert.equal(h.writes.at(-1).fetch_status,'ready');assert.equal(h.writes.at(-1).storage_path,path);
});
test('valid cache and negative cache never call Evolution',async()=>{
 for(const status of ['ready','absent','failed']){const h=harness({asset:{fetch_status:status,expires_at:new Date(Date.now()+60000).toISOString(),storage_path:status==='ready'?path:null}});await h.service.resolve(h.context);assert.equal(h.calls.some(u=>u.includes('fetchProfile')),false);assert.equal(h.writes.length,0);}
});
test('expired cache refreshes after TTL and is idempotent on the next backfill',async()=>{
 const h=harness({asset:{fetch_status:'ready',expires_at:'2000-01-01',storage_path:path}});const fresh=await h.service.ensure(h.context);await h.service.ensure(fresh);assert.equal(h.calls.filter(u=>u.includes('fetchProfile')).length,1);
});
test('absence is recorded separately from provider failure',async()=>{
 const absent=harness({noPhoto:true});const a=await absent.service.resolve(absent.context);assert.equal(a.status,'absent');assert.equal(absent.writes.at(-1).error_code,'avatar_no_photo');
 const failure=harness({providerStatus:503});await failure.service.resolve(failure.context);assert.equal(failure.writes.at(-1).fetch_status,'failed');assert.equal(failure.writes.at(-1).error_code,'avatar_provider_failed');
});
test('failed refresh preserves previous usable cached image',async()=>{
 const h=harness({providerStatus:503,asset:{storage_path:path,fetch_status:'ready',expires_at:'2000-01-01'}});const r=await h.service.resolve(h.context);assert.ok(r.buffer);assert.equal(r.source,'storage');
});
test('simultaneous avatar refresh is coalesced',async()=>{
 const h=harness();await Promise.all([h.service.ensure(h.context),h.service.ensure(h.context)]);assert.equal(h.calls.filter(u=>u.includes('fetchProfile')).length,1);
});
function response(){return {headers:{},setHeader(k,v){this.headers[k]=v;},end(b){this.body=b;}};}
test('avatar authorization runs before storage or provider; forbidden contact is denied',async()=>{
 let reads=0;const handler=createHandler({authenticate:async()=>({uid:'outsider',role:'growth'}),request:async()=>{throw Object.assign(Error(),{code:'42501'});},resolveAvatar:async()=>{reads++;}});const res=response();await handler({method:'GET',url:'/?contact_id='+identity.contact_id,headers:{}},res);assert.equal(res.statusCode,403);assert.equal(reads,0);
});
test('official Space avatar takes priority and avoids provider lookup',async()=>{
 let calls=0;const handler=createHandler({authenticate:async()=>({uid:'admin',role:'admin'}),request:async()=>({data:{participants:[]}}),resolveProfile:async()=>({avatar_url:'https://space.example/photo.jpg'}),resolveAvatar:async()=>{calls++;}});const res=response();await handler({method:'GET',url:'/?contact_id='+identity.contact_id,headers:{}},res);assert.equal(res.statusCode,302);assert.equal(calls,0);
});
test('backfill endpoint rejects missing credentials before reading contacts',async()=>{
 let reads=0;const handler=require('../api/attendance-inbox/avatar-backfill').createHandler({env,request:async()=>{reads++;}});const res=response();await handler({method:'POST',headers:{}},res);assert.equal(res.statusCode,401);assert.equal(reads,0);
});
