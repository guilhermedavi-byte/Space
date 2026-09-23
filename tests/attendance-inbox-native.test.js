const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {JSDOM}=require('jsdom');
const tick=()=>new Promise(r=>setTimeout(r,25));
test('Inbox presents person identity and preserves drafts across conversations and refresh',async()=>{
 const dom=new JSDOM('<body data-initial-panel="attendance-inbox"><div data-attendance-inbox></div>',{runScripts:'outside-only'});
 try{
 const row=id=>({conversation_id:id,contact:{name:'WhatsApp Name',phone:'+5534999999999'},connection:{provider:'evolution_whatsapp'},team:{name:'Suporte'},status:'open'});
 dom.window.fetchWithAuth=async url=>({ok:true,json:async()=>String(url).includes('conversation_id')?{conversation:row(new URL(url,'https://local').searchParams.get('conversation_id')),contact:{name:'Pessoa Space',phone:'+5534999999999',email:'pessoa@example.org',avatar_url:'https://example.org/photo.jpg',relationship:'Aluno'},participants:[],messages:[{direction:'inbound',content:{text:'Olá'},transport_status:'received'}],composer:{enabled:true,reason:'Responda à conversa pelo WhatsApp.'}}:{rows:[row('a'),row('b')],teams:[]}});
 dom.window.eval(fs.readFileSync('attendance-inbox.js','utf8'));await tick();
 const doc=dom.window.document;
 doc.querySelector('[data-ai-select="a"]').click();await tick();
 assert.match(doc.querySelector('.ai-contact').textContent,/Pessoa Space.*pessoa@example.org.*Aluno/);
 assert.match(doc.body.textContent,/Recebida/);assert.doesNotMatch(doc.body.textContent,/Evolution|Baileys|provider|webhook|Meta|JID/);
 const input=doc.querySelector('[data-ai-compose]');input.value='Meu rascunho';input.dispatchEvent(new dom.window.Event('input',{bubbles:true}));
 doc.querySelector('[data-ai-select="b"]').click();await tick();assert.equal(doc.querySelector('[data-ai-compose]').value,'');
 doc.querySelector('[data-ai-select="a"]').click();await tick();assert.equal(doc.querySelector('[data-ai-compose]').value,'Meu rascunho');
 doc.querySelector('[data-ai-refresh]').click();await tick();assert.equal(doc.querySelector('[data-ai-compose]').value,'Meu rascunho');
 const img=doc.querySelector('.ai-contact img');img.dispatchEvent(new dom.window.Event('error'));assert.equal(doc.querySelector('.ai-contact img'),null);assert.match(doc.querySelector('.ai-contact .ai-avatar').textContent,/PS/);
 }finally{dom.window.close();}
});
test('Workspace tabs, filters and collapsible panels preserve drafts without posting',async()=>{
 const dom=new JSDOM('<body data-initial-panel="attendance-inbox"><div data-attendance-inbox></div>',{runScripts:'outside-only'});
 try {
  const calls=[];
  const row={conversation_id:'a',contact:{name:'Pessoa Space'},status:'open',team:{name:'Suporte'}};
  dom.window.fetchWithAuth=async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>String(url).includes('conversation_id')?{conversation:row,contact:row.contact,messages:[],composer:{enabled:true},context:{student:{product:'Individual'},actions:{can_create_opportunity:true}}}:{rows:[row],teams:[]}}};
  dom.window.eval(fs.readFileSync('attendance-inbox.js','utf8'));await tick();
  const doc=dom.window.document;
  assert.equal(doc.querySelector('.ai-pane--contact'),null);
  doc.querySelector('[data-ai-select]').click();await tick();
  const input=doc.querySelector('[data-ai-compose]');input.value='Rascunho preservado';input.dispatchEvent(new dom.window.Event('input',{bubbles:true}));
  doc.querySelector('[data-ai-tab="journey"]').click();assert.match(doc.querySelector('[role="tabpanel"]').textContent,/Individual/);
  doc.querySelector('[data-ai-tab="finance"]').click();assert.match(doc.querySelector('[role="tabpanel"]').textContent,/Não disponível/);
  doc.querySelector('[data-ai-toggle-contact]').click();assert.equal(doc.querySelector('.ai-pane--contact'),null);
  doc.querySelector('[data-ai-toggle-contact]').click();assert.ok(doc.querySelector('.ai-pane--contact'));
  doc.querySelector('[data-ai-toggle-list]').click();assert.ok(doc.querySelector('.is-list-collapsed'));
  assert.equal(doc.querySelector('[data-ai-compose]').value,'Rascunho preservado');
  doc.querySelector('[data-ai-toggle-list]').click();
  assert.ok(doc.querySelector('[data-ai-filter="unassigned"]').closest('details'));
  assert.equal(calls.some(call=>call.options?.method==='POST'),false);
 }finally{dom.window.close();}
});
test('Ogg metadata with infinite browser duration keeps the declared duration',async()=>{
 const dom=new JSDOM('<body data-initial-panel="attendance-inbox"><div data-attendance-inbox></div>',{runScripts:'outside-only'});
 try{
 const row={conversation_id:'a',contact:{name:'Pessoa'},status:'open'};
 dom.window.fetchWithAuth=async url=>({ok:true,json:async()=>String(url).includes('conversation_id')?{conversation:row,contact:row.contact,messages:[{message_id:'audio',kind:'audio',content:{media:{mime_type:'audio/ogg; codecs=opus',duration:10}}}],composer:{enabled:false}}:{rows:[row],teams:[]}});
 dom.window.eval(fs.readFileSync('attendance-inbox.js','utf8'));await tick();dom.window.document.querySelector('[data-ai-select]').click();await tick();
 const audio=dom.window.document.querySelector('audio');Object.defineProperty(audio,'duration',{value:Infinity});audio.dispatchEvent(new dom.window.Event('loadedmetadata'));
 assert.equal(dom.window.document.querySelector('.ai-audio-time').textContent,'0:10');assert.doesNotMatch(dom.window.document.body.textContent,/Infinity|NaN/);
 }finally{dom.window.close();}
});
