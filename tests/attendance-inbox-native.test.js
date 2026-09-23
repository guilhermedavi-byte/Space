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
