const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');const {JSDOM}=require('jsdom');
const row={id:'pay_one',customer_id:'cus_one',name:'<script>unsafe</script>',student_ids:[],linked:false,status:'PENDING',status_label:'A vencer',group:'upcoming',value:12345,due_date:'2026-09-30',days_overdue:0,method_label:'Pix',subscription_id:null};
const base={meta:{read_at:'2026-09-15T12:00:00Z',warning:null},items:[row],total:1,page:1,pages:1,page_size:30,methods:[],counts:{all:1,upcoming:1,overdue:0,received:0,closed:0}};
const tick=()=>new Promise(r=>setImmediate(r));
test('workspace preserves one table, sends filters, escapes names and opens/closes accessible side drawer',async()=>{
 const dom=new JSDOM('<body><div data-finance-v1></div></body>',{runScripts:'outside-only',url:'https://space.test'});const w=dom.window,requests=[];w.fetch=async(url)=>{requests.push(url);return {ok:true,json:async()=>url.includes('view=receivable&')?{...base,item:row,details:{},links:[],audit:[]}:base};};w.eval(fs.readFileSync('finance-v1.js','utf8'));await w.SpaceFinanceV1.open('recebiveis');
 assert.equal(w.document.querySelectorAll('table').length,1);assert.equal(w.document.querySelector('tbody script'),null);assert.ok(w.document.body.textContent.includes('Não vinculado'));
 w.document.querySelector('[data-fv1-status="overdue"]').click();await tick();assert.ok(requests.at(-1).includes('status=overdue'));w.document.querySelector('button[data-fv1-open]').click();await tick();assert.equal(w.document.querySelector('[role=dialog]').getAttribute('aria-modal'),'true');assert.ok(w.document.querySelector('.fv1-drawer').textContent.includes('R$'));
 w.document.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert.equal(w.document.querySelector('[role=dialog]'),null);dom.window.close();
});
test('new finance navigation contains exactly four workspaces and legacy global actions are absent',()=>{
 const html=fs.readFileSync('api/_templates/app.html','utf8'),dom=new JSDOM(html);const nav=dom.window.document.querySelector('#sidebar-financeiro-items');assert.deepEqual([...nav.querySelectorAll('[data-finance-tab]')].map(x=>x.dataset.financeTab),['overview','recebiveis','assinaturas','clientes']);const panel=dom.window.document.querySelector('[data-panel=financeiro]');assert.ok(panel.querySelector('[data-finance-v1]'));assert.equal(panel.querySelector('[data-finance-new-student],[data-finance-new-global],[data-finance-refresh],[role=tablist]'),null);
 const script=fs.readFileSync('script.js','utf8');assert.ok(script.includes('return window.SpaceFinanceV1.open(financeState.activeTab)'));assert.equal((script.match(/\["overview", "recebiveis", "assinaturas", "clientes"\]\.includes\(tab\)/g)||[]).length,2);dom.window.close();
});
