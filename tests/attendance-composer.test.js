const test=require('node:test'),assert=require('node:assert/strict');
const {uploadSpec,validateBytes}=require('../api/_lib/attendance-upload-validation');
const {createComposerService}=require('../api/_lib/attendance-composer');
const {createHandler}=require('../api/attendance-inbox/composer');
const {Readable}=require('node:stream');
const cid='11111111-1111-4111-8111-111111111111',uid='22222222-2222-4222-8222-222222222222';
const actor={uid:'user',role:'growth'};
test('upload allowlist enforces extension, MIME, bytes and content',async()=>{
 assert.throws(()=>uploadSpec({filename:'x.exe',mime:'image/png',size:1}));
 assert.throws(()=>uploadSpec({filename:'x.png',mime:'text/html',size:1}));
 assert.throws(()=>uploadSpec({filename:'x.png',mime:'image/png',size:9*1024*1024}));
 assert.throws(()=>uploadSpec({filename:'../x.txt',mime:'text/plain',size:1}));
 const text=Buffer.from('<html><script>alert(1)</script>');await assert.rejects(()=>validateBytes(text,uploadSpec({filename:'x.txt',mime:'text/plain',size:text.length})));
 const fake=Buffer.from('MZ executable');await assert.rejects(()=>validateBytes(fake,uploadSpec({filename:'x.png',mime:'image/png',size:fake.length})));
 const plain=Buffer.from('Documento de teste');await validateBytes(plain,uploadSpec({filename:'teste.txt',mime:'text/plain',size:plain.length}));
 assert.equal(uploadSpec({filename:'voz.webm',mime:'audio/webm;codecs=opus',size:12,voice_note:true}).kind,'audio');
});
test('unauthorized uploads and Growth quick-reply writes never reach services',async()=>{
 let n=0;const handler=createHandler({authenticate:async()=>actor,service:{rpc:async()=>n++}});
 const req=Readable.from([JSON.stringify({action:'save_reply',conversation_id:cid,title:'A',body:'B'})]);req.method='POST';req.headers={};let status;await handler(req,{setHeader(){},end(){status=this.statusCode;}});assert.equal(status,403);assert.equal(n,0);
});
test('media send is scoped, uses private storage and never repeats an ambiguous send',async()=>{
 const bytes=Buffer.from('Arquivo de teste');const spec=uploadSpec({filename:'teste.txt',mime:'text/plain',size:bytes.length});
 let state='prepared',providerCalls=0;const request=async(path,opts)=>{
  if(path==='/rpc/attendance_composer'){const a=opts.body.p_action;if(a==='get')return {data:{state,spec}};if(a==='claim'){state='sending';return {data:{claimed:true,message_id:cid,state,spec}};}if(a==='finish'){state=opts.body.p_input.state;return {data:{state}};}}
  if(path==='/rpc/attendance_inbox_detail')return {data:{conversation:{status:'open',channel:{status:'active'},connection:{provider:'evolution_whatsapp',status:'active',instance_name:'space-test'}},contact:{phone:'+5511999999999'}}};
  return {data:{}};
 };
 const service=createComposerService({request,env:{SUPABASE_URL:'https://db.example',SUPABASE_SERVICE_ROLE_KEY:'SERVER',EVOLUTION_API_URL:'https://evo.example',EVOLUTION_API_KEY:'KEY'},fetchImpl:async(url,opts)=>{if(url.includes('/object/authenticated/'))return new Response(bytes);if(url.includes('/message/')){providerCalls++;assert.equal(JSON.parse(opts.body).mediatype,'document');throw Error('connection reset');}return new Response('{}');}});
 await assert.rejects(()=>service.send(actor,cid,{upload_id:uid,caption:'Olá'}),{code:'send_unconfirmed'});assert.equal(state,'unknown');await assert.rejects(()=>service.send(actor,cid,{upload_id:uid,caption:'Olá'}),{code:'send_unconfirmed'});assert.equal(providerCalls,1);
});
test('voice notes use dedicated PTT endpoint and encoding, with cached audio',async()=>{
 const bytes=Buffer.from('524946462800000057415645666d74201000000001000100401f0000803e000002001000646174610400000000000000','hex');
 const spec=uploadSpec({filename:'voz.wav',mime:'audio/wav',size:bytes.length,voice_note:true,duration:1});let sent;
 const service=createComposerService({env:{SUPABASE_URL:'https://db.example',SUPABASE_SERVICE_ROLE_KEY:'SERVER',EVOLUTION_API_URL:'https://evo.example',EVOLUTION_API_KEY:'KEY'},request:async(path,opts)=>{
  if(path==='/rpc/attendance_composer')return {data:opts.body.p_action==='get'?{state:'prepared',spec}:opts.body.p_action==='claim'?{claimed:true,message_id:cid}:{}};
  if(path==='/rpc/attendance_inbox_detail')return {data:{conversation:{status:'open',channel:{status:'active'},connection:{provider:'evolution_whatsapp',status:'active',instance_name:'space-test'}},contact:{phone:'+5511999999999'}}};return {data:{}};
 },fetchImpl:async(url,opts)=>{if(url.includes('authenticated'))return new Response(bytes);if(url.includes('/message/')){sent={url,payload:JSON.parse(opts.body)};return new Response(JSON.stringify({key:{id:'external-1'}}));}return new Response('{}');}});
 const result=await service.send(actor,cid,{upload_id:uid});assert.equal(result.status,'sent');assert.match(sent.url,/sendWhatsAppAudio\/space-test$/);assert.equal(sent.payload.encoding,true);assert.ok(sent.payload.audio);assert.equal(sent.payload.media,undefined);
});
test('AI sends only bounded recent context and returns a draft, never a provider message',async()=>{
 let target,body;const service=createComposerService({env:{OPENAI_API_KEY:'SECRET',OPENAI_COPILOT_MODEL:'gpt-4o-mini'},request:async()=>({data:{messages:[{role:'user',content:'Meu email a@example.com e telefone +5511999999999'}]}}),fetchImpl:async(url,opts)=>{target=url;body=JSON.parse(opts.body);return new Response(JSON.stringify({choices:[{message:{content:'Olá! Como posso ajudar?'}}]}));}});
 const result=await service.assist(actor,cid,{mode:'suggest'});assert.equal(result.text,'Olá! Como posso ajudar?');assert.equal(target,'https://api.openai.com/v1/chat/completions');assert.ok(!JSON.stringify(body).includes('a@example.com'));assert.equal(body.store,false);
});
test('composer tools insert at the cursor and denied microphone keeps text usable',async()=>{
 const {JSDOM}=require('jsdom'),fs=require('fs');const dom=new JSDOM('<body data-initial-panel="attendance-inbox"><div data-attendance-inbox></div>',{runScripts:'outside-only',url:'https://plataforma.spaceschoolbr.com'});const w=dom.window;
 const row={conversation_id:cid,status:'open',team:{name:'Atendimento',team_id:uid},contact:{name:'Teste'}};
 w.fetchWithAuth=async(url,opts)=>({ok:true,json:async()=>url.includes('/composer')?{items:[{id:uid,title:'Saudação',body:'Olá!'}],can_manage:false}:url.includes('conversation_id')?{conversation:row,contact:row.contact,messages:[],composer:{enabled:true}}:{rows:[row],teams:[]}});
 Object.defineProperty(w.navigator,'mediaDevices',{value:{getUserMedia:async()=>{throw new w.DOMException('Denied','NotAllowedError');}}});w.MediaRecorder=function(){};
 w.eval(fs.readFileSync('attendance-inbox.js','utf8'));const tick=()=>new Promise(r=>setTimeout(r,0));await tick();await tick();w.document.querySelector('[data-ai-select]').click();await tick();await tick();
 const field=w.document.querySelector('[data-ai-compose]');field.value='Oi mundo';field.dispatchEvent(new w.Event('input',{bubbles:true}));field.setSelectionRange(3,3);
 const emoji=w.document.querySelector('[data-composer-tool="emoji"]');emoji.dispatchEvent(new w.Event('pointerdown',{bubbles:true}));emoji.click();const button=w.document.querySelector('[data-insert-emoji]');const glyph=button.dataset.insertEmoji;button.click();assert.equal(w.document.querySelector('[data-ai-compose]').value,'Oi '+glyph+'mundo');
 w.document.querySelector('[data-composer-tool="mic"]').click();await tick();assert.match(w.document.body.textContent,/Permissão do microfone não concedida/);assert.equal(w.document.querySelector('[data-ai-compose]').disabled,false);assert.equal(w.document.querySelector('[data-ai-send]').disabled,false);
 w.document.querySelector('[data-composer-tool="quick"]').click();await tick();w.document.querySelector('[data-insert-quick]').click();assert.match(w.document.querySelector('[data-ai-compose]').value,/Olá!/);dom.window.close();
});
