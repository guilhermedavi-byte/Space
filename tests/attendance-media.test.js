const test=require('node:test'),assert=require('node:assert/strict');
const {safeMime,safeFilename,createMediaService,MAX_BYTES,evolutionMediaBody}=require('../api/_lib/attendance-media');
const {compactEvolutionMessage}=require('../api/_lib/attendance-media-envelope');
const {createHandler}=require('../api/attendance-inbox/media');
const id='88e068a9-75a8-4a8e-a6ee-11aef37ec1c2';
const message={message_id:id,external_message_id:'provider-message',kind:'image',content:{media:{mime_type:'image/jpeg'}}};
const connection={provider:'evolution_whatsapp',instance_name:'space-suporte'};
function harness({asset={},providerStatus=200,providerMime='image/jpeg',base64=Buffer.from('media-bytes').toString('base64'),storageFail=false,claim=true}={}){
 const writes=[],calls=[];let row={...asset};
 const request=async(path,{body})=>{writes.push(body.p_asset);row={...row,...body.p_asset};return {data:{claimed:claim,asset:row}};};
 const fetchImpl=async(url,opts={})=>{
  calls.push({url,opts});
  if(url.includes('getBase64'))return new Response(JSON.stringify(providerStatus===200?{base64,mimetype:providerMime}:{message:'provider unavailable'}),{status:providerStatus});
  if(opts.method==='POST')return new Response('',{status:storageFail?500:200});
  return new Response(Buffer.from('cached-bytes'),{status:storageFail?500:200});
 };
 const service=createMediaService({request,fetchImpl,env:{EVOLUTION_API_URL:'https://provider.example',EVOLUTION_API_KEY:'test-only',SUPABASE_URL:'https://storage.example',SUPABASE_SERVICE_ROLE_KEY:'test-only'},sleep:async()=>{}});
 return {service,writes,calls,run:args=>service.resolveMedia({message,connection,asset,...args})};
}
test('MIME validation accepts safe codec parameters and rejects arbitrary inline types/headers',()=>{
 assert.equal(safeMime('audio','audio/ogg; codecs=opus'),'audio/ogg; codecs="opus"');
 for(const mime of ['audio/mpeg','audio/mp4','audio/aac','audio/wav','audio/webm'])assert.equal(safeMime('audio',mime),mime);
 for(const mime of ['image/jpeg','image/png','image/webp','image/gif'])assert.equal(safeMime('image',mime),mime);
 for(const mime of ['video/mp4','video/webm','video/quicktime'])assert.equal(safeMime('video',mime),mime);
 assert.equal(safeMime('image','text/html'),'');assert.equal(safeMime('audio','audio/ogg\r\nx: y'),'');
 assert.equal(safeMime('image','image/svg+xml'),'');assert.doesNotMatch(safeFilename('a"\r\n/é.jpg'),/["\r\n/]/);
});
test('existing message without asset: claim → ID lookup → Storage → ready',async()=>{
 const h=harness();const result=await h.run();assert.equal(result.source,'provider');
 assert.deepEqual(JSON.parse(h.calls[0].opts.body).message,{key:{id:'provider-message'}});
 assert.match(h.calls[1].url,/storage\/v1\/object\/attendance-media/);assert.equal(h.calls[1].opts.method,'POST');
 assert.deepEqual(h.writes.map(w=>w.fetch_status),['fetching','ready']);assert.equal(h.writes[1].size_bytes,11);
});
test('ready asset reads Storage without provider or writes',async()=>{
 const h=harness({asset:{fetch_status:'ready',mime_type:'image/jpeg',storage_path:`attendance/88/${id}.jpg`,filename:'photo.jpg'}});
 assert.equal((await h.run()).source,'storage');assert.equal(h.calls.length,1);assert.equal(h.writes.length,0);
});
test('temporary Storage failure preserves ready cache without provider calls or writes',async()=>{
 const h=harness({storageFail:true,asset:{fetch_status:'ready',mime_type:'image/jpeg',storage_path:`attendance/88/${id}.jpg`}});
 await assert.rejects(h.run(),{code:'storage_download_failed'});
 assert.equal(h.calls.length,1);assert.equal(h.writes.length,0);
});
for(const [name,options,code] of [
 ['provider failure',{providerStatus:500},'provider_fetch_failed'],
 ['Storage failure',{storageFail:true},'storage_upload_failed'],
 ['invalid MIME',{providerMime:'text/html'},'unsupported_mime'],
 ['invalid base64',{base64:'invalid!'},'invalid_base64']
])test(name,async()=>{const h=harness(options);await assert.rejects(h.run(),{code});assert.equal(h.writes.at(-1).error_code,code);});
test('file above the limit is rejected before download',async()=>{
 const h=harness();await assert.rejects(h.run({message:{...message,content:{media:{size:MAX_BYTES+1}}}}),{code:'media_too_large'});assert.equal(h.calls.length,0);
});
test('incomplete old envelope is not preferred over external message ID',async()=>{
 assert.deepEqual(evolutionMediaBody({...message,metadata:{evolution_message:{message:{imageMessage:{url:'https://not-used.example'}}}}}),{key:{id:'provider-message'}});
 const h=harness();await h.run({message:{...message,metadata:{evolution_message:{key:{id:'old'},message:{imageMessage:{url:'https://not-used.example'}}}}}});assert.equal(h.calls.length,2);
});
test('complete preserved envelope is tried only after ID lookup fails',async()=>{
 let calls=0;const bodies=[];
 const service=createMediaService({env:{EVOLUTION_API_URL:'https://provider.example',EVOLUTION_API_KEY:'test',SUPABASE_URL:'https://storage.example',SUPABASE_SERVICE_ROLE_KEY:'test'},
 request:async()=>({data:{claimed:true}}),fetchImpl:async(url,opts)=>{
 if(!url.includes('getBase64'))return new Response('');bodies.push(JSON.parse(opts.body).message);return ++calls===1?new Response('message not found',{status:404}):new Response(JSON.stringify({base64:'eA==',mimetype:'image/jpeg'}));}});
 const stored={key:{id:'provider-message'},message:{imageMessage:{mediaKey:'AQ==',directPath:'/media'}}};
 await service.resolveMedia({message:{...message,metadata:{evolution_message:stored}},connection});assert.equal(bodies.length,2);assert.deepEqual(bodies[1],stored);
});
test('concurrent requests coalesce; another worker observes ready without fetching provider',async()=>{
 const h=harness();const [a,b]=await Promise.all([h.run(),h.run()]);assert.equal(a,b);assert.equal(h.calls.filter(c=>c.url.includes('getBase64')).length,1);
 const other=harness({claim:false});const r=await other.run({reloadAsset:async()=>({fetch_status:'ready',mime_type:'image/jpeg',storage_path:`attendance/88/${id}.jpg`})});assert.equal(r.source,'storage');assert.equal(other.calls.filter(c=>c.url.includes('getBase64')).length,0);
});
test('binary envelope preserves bounded Buffer-like values, ptt and Long length',()=>{
 const src={mediaKey:{type:'Buffer',data:[1,2,3]},fileSha256:{0:4,1:5},fileEncSha256:Buffer.from([6]),ptt:true,fileLength:{low:25165,high:0},seconds:10,mimetype:'audio/ogg; codecs=opus'};
 const output=compactEvolutionMessage({key:{id:'id',remoteJid:'contact'}},{audioMessage:src}).message.audioMessage;
 assert.equal(output.mediaKey,'AQID');assert.equal(output.fileSha256,'BAU=');assert.equal(output.fileEncSha256,'Bg==');assert.equal(output.fileLength,25165);assert.equal(output.ptt,true);
});
async function invoke(options={},messageId=id){const headers={};let result;await createHandler(options)({method:'GET',url:`/api/attendance-inbox/media?message_id=${messageId}`,headers:{}},{setHeader(k,v){headers[k]=v},end(body){result={status:this.statusCode,headers,body}}});return result;}
test('proxy denies unauthorized access and rejects invalid message ID before any download',async()=>{
 let downloads=0;const mediaResolver=async()=>{downloads++;};
 assert.equal((await invoke({authenticate:async()=>{throw Object.assign(Error('denied'),{status:403});},mediaResolver})).status,403);
 assert.equal((await invoke({authenticate:async()=>({uid:'u',role:'admin'}),mediaResolver},'bad')).status,422);
 assert.equal((await invoke({authenticate:async()=>({uid:'u',role:'growth'}),request:async()=>{throw Object.assign(Error('denied'),{code:'42501'});},mediaResolver})).status,403);
 assert.equal(downloads,0);
});
test('proxy returns authenticated inline bytes with safe private headers',async()=>{
 const r=await invoke({authenticate:async()=>({uid:'u',role:'admin'}),request:async()=>({data:{message,connection}}),mediaResolver:async()=>({buffer:Buffer.from('abc'),mime:'image/jpeg',filename:'a"\r\n.jpg',source:'storage'})});
 assert.equal(r.status,200);assert.equal(r.headers['Content-Length'],3);assert.equal(r.headers['Content-Type'],'image/jpeg');assert.match(r.headers['Cache-Control'],/private/);assert.match(r.headers['Content-Disposition'],/^inline/);assert.doesNotMatch(r.headers['Content-Disposition'],/[\r\n]/);
});
test('audio byte ranges support metadata/seek and invalid ranges return 416',async()=>{
 const handler=createHandler({authenticate:async()=>({uid:'u',role:'admin'}),request:async()=>({data:{message:{...message,kind:'audio'},connection}}),mediaResolver:async()=>({buffer:Buffer.from('abcdefghij'),mime:'audio/ogg; codecs="opus"',filename:'audio.ogg',source:'storage'})});
 const call=async range=>{const headers={};let result;await handler({method:'GET',url:`/?message_id=${id}`,headers:{range}},{setHeader(k,v){headers[k]=v},end(body){result={status:this.statusCode,headers,body}}});return result;};
 const r=await call('bytes=3-5');assert.equal(r.status,206);assert.equal(r.body.toString(),'def');assert.equal(r.headers['Content-Range'],'bytes 3-5/10');assert.equal(r.headers['Content-Length'],3);assert.equal((await call('bytes=30-')).status,416);
});
