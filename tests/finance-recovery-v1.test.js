const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {recovery,stage}=require('../api/_lib/finance-recovery-view');
const {createReader}=require('../api/_lib/finance-v1-read');
const {JSDOM}=require('jsdom');
const C='11111111-1111-4111-8111-111111111111';
test('Recovery uses only overdue open projections; exact boundaries, customer KPIs, filters and fresh payment exclusion',async()=>{
 const offsets=[1,3,4,7,8,15,16,30,31];
 const rows=offsets.map((n,i)=>({id:i,asaas_payment_id:'pay_'+i,asaas_customer_id:i%2?'cus_two':'cus_one',status:'PENDING',value:'10.10',due_date:new Date(Date.UTC(2026,8,16-n)).toISOString().slice(0,10),snapshot:{}}));
 rows.push(...['RECEIVED','CONFIRMED','DELETED','REFUNDED','CANCELLED'].map((status,i)=>({...rows[0],id:100+i,asaas_payment_id:'pay_excluded'+i,status})),{...rows[0],id:200,asaas_payment_id:'pay_today',due_date:'2026-09-16'},{...rows[0],id:201,asaas_payment_id:'pay_deleted_flag',deleted:true});
 const reader=createReader({connectionId:C,today:()=> '2026-09-16',verify:async()=>{},spaceLoader:async()=>({users:[],students:[],contracts:[]}),client:{pages:async function*(){yield{data:[{id:'cus_one',name:'One'},{id:'cus_two',name:'Two'}]};}},request:async path=>({data:path.includes('/finance_receivables?')?rows:path.includes('/finance_customer_student_links?')?[{asaas_customer_id:'cus_one',firestore_doc_id:'student'}]:[]})});
 const r=await reader.get('recovery');assert.equal(r.total,9);assert.equal(r.kpis.overdue,9090);assert.equal(r.kpis.customers,2);assert.equal(r.kpis.ticket,4545);assert.equal(r.kpis.average_days,12.8);assert.equal(r.linked,1);assert.equal(r.unlinked,1);assert.deepEqual(r.aging.map(b=>b.count),[2,2,2,2,1]);
 assert.equal((await reader.get('recovery',{aging:'30+'})).total,1);assert.equal((await reader.get('recovery',{link:'unlinked'})).total,4);assert.equal((await reader.get('recovery',{stage:'Intervenção humana'})).total,3);assert.equal((await reader.get('recovery',{q:'Two'})).total,4);
 rows[0].status='RECEIVED';assert.equal((await reader.get('recovery',{fresh:'1'})).total,8);
 assert.deepEqual([-3,-1,0,1,3,7,16].map(stage),['D-3','D-1','D0','D+1','D+3','D+7','Intervenção humana']);assert.equal(recovery([]).kpis.overdue,0);
});
test('Recovery renders navigation, source context and aging filter; opens existing financial drawer',async()=>{
 const dom=new JSDOM('<body><div data-finance-v1></div></body>',{runScripts:'outside-only',url:'https://space.test'}),w=dom.window,urls=[];
 const row={id:'pay_one',customer_id:'cus_one',name:'Client',student_ids:[],linked:false,space_students:[],group:'overdue',value:1010,days_overdue:4,due_date:'2026-09-12'};
 const data={...recovery([row]),meta:{read_at:'2026-09-16T12:00:00Z'},total:1,page:1,pages:1,page_size:30};
 w.fetch=async url=>{urls.push(url);return {ok:true,json:async()=>url.includes('view=receivable&')?{item:row,details:{},links:[],audit:[]}:data};};w.eval(fs.readFileSync('finance-v1.js','utf8'));await w.SpaceFinanceV1.open('recuperacao');assert.equal(w.document.querySelector('h1').textContent,'Recuperação');assert.equal(w.document.querySelectorAll('.fv1-kpi').length,4);assert.ok(w.document.body.textContent.includes('Não vinculado'));
 const sel=w.document.querySelector('[data-fv1-filter=aging]');sel.value='4-7';sel.dispatchEvent(new w.Event('change',{bubbles:true}));await new Promise(setImmediate);assert.ok(urls.at(-1).includes('aging=4-7'));w.document.querySelector('button[data-fv1-open]').click();await new Promise(setImmediate);assert.ok(w.document.querySelector('[role=dialog]').textContent.includes('Histórico da cobrança'));dom.window.close();
 assert.ok(fs.readFileSync('api/_templates/app.html','utf8').includes('data-finance-tab="recuperacao"'));
});
