const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM } = require('jsdom');
const source = fs.readFileSync(process.env.INBOX_TEST_SOURCE || 'attendance-inbox.js', 'utf8');
const flush = async () => { for (let i=0;i<12;i++) await Promise.resolve(); };
const row = id => ({conversation_id:id,contact:{name:`Pessoa ${id}`,phone:`Telefone ${id}`},status:'open',last_message:{content:{text:`Preview ${id}`}}});
const detail = (id, extra={}) => ({conversation:row(id),contact:row(id).contact,messages:[{message_id:`m-${id}`,direction:'inbound',content:{text:`Mensagem ${id}`}}],composer:{enabled:true},...extra});
function setup(t) {
 const dom = new JSDOM('<body data-initial-panel="attendance-inbox"><div data-attendance-inbox></div>', {runScripts:'outside-only'});
 t.after(()=>dom.window.close());
 const w=dom.window, doc=w.document, requests=[], logs=[], timers=new Map();let timerId=0,now=0;
 Object.defineProperty(doc,'hidden',{value:false,configurable:true});
 w.setTimeout=(fn,ms)=>{const id=++timerId;timers.set(id,{fn,at:now+ms});return id;};w.clearTimeout=id=>timers.delete(id);
 // Capture obsolete interval polling as well when demonstrating the pre-fix failure.
 w.setInterval=(fn,ms)=>{const id=++timerId;timers.set(id,{fn,at:now+ms,interval:ms});return id;};w.clearInterval=w.clearTimeout;
 w.SpaceAttendanceInboxDebug=true;
 doc.querySelector('[data-attendance-inbox]').addEventListener('attendance-inbox-debug',e=>logs.push(e.detail));
 w.fetchWithAuth=(url,options={})=>new Promise((resolve,reject)=>requests.push({url:String(url),options,resolve,reject,done:false}));
 w.eval(source);
 const pending=()=>requests.filter(r=>!r.done);
 const respond=async(r,payload,status=200)=>{assert.ok(r,'Expected request');r.done=true;r.resolve({ok:status<400,status,json:async()=>payload});await flush();};
 const nextList=()=>pending().find(r=>!r.options.method&&!r.url.includes('conversation_id'));
 const nextDetail=id=>pending().find(r=>!r.options.method&&new URL(r.url,'https://local').searchParams.get('conversation_id')===id);
 const click=async selector=>{const el=doc.querySelector(selector);assert.ok(el,selector);el.click();await flush();};
 const advance=async ms=>{now+=ms;for(const [id,timer] of [...timers])if(timer.at<=now){timers.delete(id);timer.fn();if(timer.interval)timers.set(id,{...timer,at:now+timer.interval});}await flush();};
 return {w,doc,logs,requests,pending,respond,nextList,nextDetail,click,advance,timers,async init(){await respond(nextList(),{rows:['A','B','C'].map(row),teams:[]});},async choose(id){await click(`[data-ai-select="${id}"]`);await respond(nextDetail(id),detail(id));}};
}
function invariant(h,id) {
 assert.match(h.doc.querySelector('.ai-chat-head').textContent,new RegExp(`Pessoa ${id}`));
 assert.equal(h.doc.querySelector('.ai-item.is-active')?.dataset.aiSelect,id);
 for(const selector of ['.ai-chat','.ai-chat-head','.ai-messages','.ai-pane--contact']) {
  const el=h.doc.querySelector(selector);if(el) assert.equal(el.dataset.conversationId,id,selector);
 }
 assert.match(h.doc.querySelector('.ai-chat-head').textContent,new RegExp(`Pessoa ${id}`));
 assert.match(h.doc.querySelector('.ai-pane--contact').textContent,new RegExp(`Pessoa ${id}`));
}
test('late A and B cannot overwrite C; mismatched server identity is rejected atomically',async t=>{
 const h=setup(t);await h.init();
 await h.click('[data-ai-select="A"]');const a=h.nextDetail('A');
 await h.click('[data-ai-select="B"]');const b=h.nextDetail('B');
 await h.click('[data-ai-select="C"]');const c=h.nextDetail('C');
 await h.respond(c,detail('C'));await h.respond(b,detail('B'));await h.respond(a,detail('A'));
 invariant(h,'C');assert.match(h.doc.querySelector('.ai-messages').textContent,/Mensagem C/);
 assert.doesNotMatch(h.doc.querySelector('.ai-chat').textContent,/Mensagem [AB]/);
 await h.click('[data-ai-refresh]');await h.respond(h.nextDetail('C'),detail('A'));
 invariant(h,'C');assert.ok(h.logs.some(l=>l.code==='identity_mismatch'));
});
test('list refresh ordering and omission preserve selection and DOM, even when opened during refetch',async t=>{
 const h=setup(t);await h.init();await h.click('[data-ai-refresh]');const list=h.nextList();
 await h.choose('B');const shell=h.doc.querySelector('.ai-shell'),listNode=h.doc.querySelector('.ai-list'),b=h.doc.querySelector('[data-ai-select="B"]'),messages=h.doc.querySelector('.ai-messages');
 await h.respond(list,{rows:['C','A'].map(row),teams:[]});invariant(h,'B');
 assert.equal(h.doc.querySelector('.ai-shell'),shell);assert.equal(h.doc.querySelector('.ai-list'),listNode);assert.equal(h.doc.querySelector('[data-ai-select="B"]'),b);assert.equal(h.doc.querySelector('.ai-messages'),messages);
 await h.click('[data-ai-refresh]');await h.respond(h.nextList(),{rows:['A','C','B'].map(row),teams:[]});invariant(h,'B');assert.equal(h.doc.querySelector('[data-ai-select="B"]'),b);
});
test('temporary 500 and timeout retain names, selected detail, focused draft and mounted elements',async t=>{
 const h=setup(t);await h.init();await h.choose('A');
 const input=h.doc.querySelector('[data-ai-compose]'),shell=h.doc.querySelector('.ai-shell');input.value='Rascunho';input.dispatchEvent(new h.w.Event('input',{bubbles:true}));input.focus();
 await h.click('[data-ai-refresh]');await h.respond(h.nextList(),{},500);await h.respond(h.nextDetail('A'),{},500);
 invariant(h,'A');assert.equal(h.doc.querySelector('.ai-shell'),shell);assert.equal(h.doc.querySelector('[data-ai-compose]'),input);assert.equal(input.value,'Rascunho');assert.equal(h.doc.activeElement,input);assert.equal(h.doc.querySelector('.ai-error'),null);
 await h.click('[data-ai-refresh]');await h.advance(20000);invariant(h,'A');assert.equal(h.doc.querySelector('.ai-error'),null);assert.ok(h.logs.some(l=>l.code==='list_timeout'));
});
test('initial failure can retry, whereas an empty successful list stays usable after a failed refetch',async t=>{
 const h=setup(t);await h.respond(h.nextList(),{},500);assert.ok(h.doc.querySelector('.ai-error'));
 await h.click('[data-ai-refresh]');await h.respond(h.nextList(),{rows:[],teams:[]});const shell=h.doc.querySelector('.ai-shell');
 await h.click('[data-ai-refresh]');await h.respond(h.nextList(),{},500);assert.equal(h.doc.querySelector('.ai-error'),null);assert.equal(h.doc.querySelector('.ai-shell'),shell);
});
test('repeated refresh/open calls deduplicate requests and 5 minutes of polling never remount or overlap',async t=>{
 const h=setup(t);await h.init();await h.choose('A');const input=h.doc.querySelector('[data-ai-compose]'),shell=h.doc.querySelector('.ai-shell');
 for(let i=0;i<10;i++){h.w.SpaceAttendanceInbox.open();await h.click('[data-ai-refresh]');}
 assert.equal(h.pending().length,2);
 await h.respond(h.nextList(),{rows:['C','A','B'].map(row),teams:[]});await h.respond(h.nextDetail('A'),detail('A'));
 for(let i=0;i<43;i++){
  await h.advance(7000);assert.equal(h.pending().length,2);
  const rows=['B','C','A'].map(row);rows[0].last_message.content.text=`Nova em B ${i}`;
  await h.respond(h.nextList(),{rows,teams:[]});
  await h.respond(h.nextDetail('A'),detail('A',{messages:[...detail('A').messages,{message_id:`new-${i}`,direction:'inbound',content:{text:`Nova em A ${i}`}}]}));
  invariant(h,'A');assert.equal(h.doc.querySelector('.ai-shell'),shell);assert.equal(h.doc.querySelector('[data-ai-compose]'),input);
 }
 assert.equal(h.logs.filter(l=>l.event==='conversation_list_refetch_finished').length,45);
});
test('read and assignment completion stay bound to their originating conversation',async t=>{
 const h=setup(t);await h.init();await h.click('[data-ai-select="A"]');
 await h.respond(h.nextDetail('A'),detail('A',{messages:[{message_id:'a',sequence:7,content:{text:'A'}}]}));
 const read=h.pending().find(r=>r.options.method==='POST');assert.equal(JSON.parse(read.options.body).conversation_id,'A');
 await h.choose('B');await h.respond(read,{});invariant(h,'B');
 await h.click('[data-ai-op="assign"]');const assign=h.pending().find(r=>r.options.method==='POST');assert.equal(JSON.parse(assign.options.body).conversation_id,'B');
 await h.choose('C');await h.respond(assign,{});await h.respond(h.nextList(),{rows:['C','A','B'].map(row),teams:[]});invariant(h,'C');assert.equal(h.nextDetail('C'),undefined);
});
test('send completion removes only original draft and cannot erase another conversation draft',async t=>{
 const h=setup(t);await h.init();await h.choose('A');
 const type=text=>{const input=h.doc.querySelector('[data-ai-compose]');input.value=text;input.dispatchEvent(new h.w.Event('input',{bubbles:true}));};
 type('Enviar em A');await h.click('[data-ai-send]');const send=h.pending().find(r=>r.options.method==='POST');assert.equal(JSON.parse(send.options.body).conversation_id,'A');
 await h.choose('B');type('Rascunho B');await h.respond(send,{});await h.respond(h.nextList(),{rows:['A','B','C'].map(row),teams:[]});invariant(h,'B');assert.equal(h.doc.querySelector('[data-ai-compose]').value,'Rascunho B');
});
test('superseded list query is discarded and every observable render has matching conversation IDs',async t=>{
 const h=setup(t);await h.init();const snapshots=[];
 const observer=new h.w.MutationObserver(()=>{
  const selected=h.doc.querySelector('.ai-item.is-active')?.dataset.aiSelect;
  if(selected) snapshots.push({selected,ids:[...h.doc.querySelectorAll('[data-conversation-id]')].map(el=>el.dataset.conversationId)});
 });observer.observe(h.doc.querySelector('[data-attendance-inbox]'),{subtree:true,childList:true,attributes:true});t.after(()=>observer.disconnect());
 await h.choose('A');await h.click('[data-ai-refresh]');const oldList=h.nextList();
 await h.click('[data-ai-filter="mine"]');const newList=h.pending().find(r=>r.url.includes('filter=mine'));
 await h.choose('B');await h.respond(newList,{rows:[row('B')],teams:[]});await h.respond(oldList,{rows:[row('C')],teams:[]});invariant(h,'B');assert.equal(h.doc.querySelector('[data-ai-select="C"]'),null);
 await h.choose('B');
 assert.ok(snapshots.length>3);for(const snapshot of snapshots)assert.ok(snapshot.ids.every(id=>id===snapshot.selected),JSON.stringify(snapshot));
});
