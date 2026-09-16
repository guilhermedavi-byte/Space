const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {JSDOM}=require('jsdom');
const {recovery}=require('../api/_lib/finance-recovery-view');

test('recovery read model adds operational status and next action without changing eligibility',()=>{
 const rows=[
  {id:'pay_one',group:'overdue',days_overdue:5,value:10000,customer_id:'cus_a',linked:true},
  {id:'pay_paid',group:'received',days_overdue:0,value:10000,customer_id:'cus_b',linked:true},
 ];
 const cases=new Map([['pay_one',{status_label:'Promessa de pagamento',promised_payment_date:'2026-09-20',last_action_label:'Promessa de pagamento'}]]);
 const result=recovery(rows,cases);
 assert.equal(result.items.length,1);
 assert.equal(result.items[0].operational_status,'Promessa de pagamento');
 assert.equal(result.items[0].next_action_date,'2026-09-20');
});

test('recovery drawer posts a payment promise and refreshes the active case',async()=>{
 const row={id:'pay_one',customer_id:'cus_one',name:'Cliente',student_ids:[],linked:false,status:'OVERDUE',status_label:'Vencido',group:'overdue',value:12345,due_date:'2026-09-01',days_overdue:15,method_label:'Pix',subscription_id:null};
 const list={meta:{read_at:'2026-09-16T12:00:00Z'},items:[{...row,aging:'8-15',operational_status:'Novo',next_action_date:null,next_action_label:'Acompanhar'}],total:1,page:1,pages:1,page_size:30,kpis:{overdue:12345,customers:1,ticket:12345,average_days:15},linked:0,unlinked:1,charges:1,missing_values:0,aging:[],stages:[]};
 const detail={...list,item:row,details:{},links:[],audit:[],recovery_case:null,recovery_events:[]};
 const requests=[];
 const dom=new JSDOM('<body><div data-finance-v1></div></body>',{runScripts:'outside-only',url:'https://space.test/app/admin/financeiro?aba=recuperacao'});
 const w=dom.window;w.fetch=async(url,opts={})=>{requests.push([String(url),opts]);return {ok:true,json:async()=>String(url).includes('/api/finance-recovery-actions')?{refresh:true}:String(url).includes('view=receivable')?detail:list};};
 w.eval(fs.readFileSync('finance-v1.js','utf8'));await w.SpaceFinanceV1.open('recuperacao');await new Promise(r=>setImmediate(r));
 w.document.querySelector('[data-fv1-open]').click();await new Promise(r=>setImmediate(r));
 w.document.querySelector('[data-fv1-recovery-action="payment_promise"]').click();
 w.document.querySelector('[name=promised_payment_date]').value='2026-09-20';
 w.document.querySelector('[name=promised_amount]').value='123.45';
 w.document.querySelector('[name=responsible]').value='CS';
 w.document.querySelector('[name=note]').value='Combinado por telefone';
 w.document.querySelector('[data-fv1-recovery-form]').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
 await new Promise(r=>setImmediate(r));await new Promise(r=>setImmediate(r));
 const post=requests.find(([url])=>url.includes('/api/finance-recovery-actions'));
 assert.ok(post);
 assert.deepEqual(JSON.parse(post[1].body),{payment_id:'pay_one',action:'payment_promise',promised_payment_date:'2026-09-20',promised_amount:'123.45',responsible:'CS',note:'Combinado por telefone'});
 dom.window.close();
});
