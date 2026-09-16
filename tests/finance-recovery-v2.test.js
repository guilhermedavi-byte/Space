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
 const list={meta:{read_at:'2026-09-16T12:00:00Z'},items:[{...row,aging:'8-15',operational_status:'Novo',next_action_date:null,next_action_label:'Acompanhar',approval_required_actions:1,pending_actions:1}],total:1,page:1,pages:1,page_size:30,kpis:{overdue:12345,customers:1,ticket:12345,average_days:15},linked:0,unlinked:1,charges:1,missing_values:0,aging:[],stages:[]};
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

test('recovery table approves selected historical rule actions',async()=>{
 const row={id:'pay_one',customer_id:'cus_one',name:'Cliente',student_ids:[],linked:false,status:'OVERDUE',status_label:'Vencido',group:'overdue',value:12345,due_date:'2026-09-01',days_overdue:15,method_label:'Pix',subscription_id:null,aging:'8-15',operational_status:'Novo',next_action_date:null,next_action_label:'Acompanhar',approval_required_actions:1,pending_actions:1};
 const list={meta:{read_at:'2026-09-16T12:00:00Z'},items:[row],total:1,page:1,pages:1,page_size:30,kpis:{overdue:12345,customers:1,ticket:12345,average_days:15},linked:0,unlinked:1,charges:1,missing_values:0,aging:[],stages:[]};
 const requests=[];
 const dom=new JSDOM('<body><div data-finance-v1></div></body>',{runScripts:'outside-only',url:'https://space.test/app/admin/financeiro?aba=recuperacao'});
 const w=dom.window;w.fetch=async(url,opts={})=>{requests.push([String(url),opts]);return {ok:true,json:async()=>String(url).includes('/api/finance-recovery-actions')?{approved:1}:list};};
 w.eval(fs.readFileSync('finance-v1.js','utf8'));await w.SpaceFinanceV1.open('recuperacao');await new Promise(r=>setImmediate(r));
 w.document.querySelector('[data-fv1-rule-select]').checked=true;
 w.document.querySelector('[data-fv1-approve-selected]').click();
 await new Promise(r=>setImmediate(r));await new Promise(r=>setImmediate(r));
 const post=requests.find(([url])=>url.includes('/api/finance-recovery-actions'));
 assert.deepEqual(JSON.parse(post[1].body),{action:'approve_rule_actions',payment_ids:['pay_one']});
 dom.window.close();
});

test('rule engine creates one pending internal event, pauses on promise, and stops when paid',async()=>{
 const previousActivation=process.env.FINANCE_RECOVERY_AUTOMATION_ACTIVATED_AT;
 process.env.FINANCE_RECOVERY_AUTOMATION_ACTIVATED_AT='2099-01-01T00:00:00.000Z';
 const {createRecoveryOperations}=require('../api/_lib/finance-recovery-operations');
 const store=new Map(),connectionId='589367ba-e7c4-4c26-af71-53f97eac31a4';
 const firestore={
  getDocumentAsAdmin:async p=>{const id=decodeURIComponent(p.split('/').pop());if(!store.has(id)){const e=new Error('missing');e.status=404;throw e;}return store.get(id);},
  listCollectionAsAdmin:async()=>[...store.values()],
  commitWritesAsAdmin:async({writes})=>{for(const w of writes){const id=decodeURIComponent(w.update.name.split('/').pop());const fields=w.update.fields;const decode=v=>{if('stringValue'in v)return v.stringValue;if('integerValue'in v)return Number(v.integerValue);if('doubleValue'in v)return v.doubleValue;if('booleanValue'in v)return v.booleanValue;if(v.arrayValue)return (v.arrayValue.values||[]).map(decode);if(v.mapValue)return Object.fromEntries(Object.entries(v.mapValue.fields||{}).map(([k,x])=>[k,decode(x)]));return null;};store.set(id,Object.fromEntries(Object.entries(fields).map(([k,v])=>[k,decode(v)])));}return {ok:true};},
 };
 const ops=createRecoveryOperations({connectionId,firestore,projectId:'space-test',request:async()=>({data:[{asaas_payment_id:'pay_one',asaas_customer_id:'cus_one'}]})});
 const row={id:'pay_one',group:'overdue',due_date:'2026-09-13',customer_id:'cus_one',student_ids:[]};
 let r=await ops.materializeRules([row],'2026-09-16');
 assert.equal(r.active,1);assert.equal(r.pending,1);
 r=await ops.materializeRules([row],'2026-09-16');
 assert.equal(r.pending,1);assert.equal(store.get('pay_one').executed_rule_steps.length,1);
 const pending=store.get('pay_one').pending_internal_events[0];
 assert.equal(pending.requires_manual_approval,true);
 assert.equal(pending.auto_dispatchable,false);
 assert.equal(pending.dispatch_contract,'attendance.finance_recovery_action.v1');
 assert.equal(pending.receivable.asaas_payment_id,'pay_one');
 assert.equal(pending.recovery_case.asaas_payment_id,'pay_one');
 const approved=await ops.recordAction({payment_ids:['pay_one'],action:'approve_rule_actions'},'tester');
 assert.equal(approved.approved,1);
 assert.equal(store.get('pay_one').pending_internal_events[0].status,'approved');
 assert.equal(store.get('pay_one').pending_internal_events[0].auto_dispatchable,false);
 await ops.recordAction({payment_id:'pay_one',action:'payment_promise',promised_payment_date:'2026-09-20',promised_amount:'100.00'},'tester');
 r=await ops.materializeRules([row],'2026-09-17');
 assert.equal(r.paused,1);assert.equal(store.get('pay_one').next_action_type,'promise_followup');
 r=await ops.materializeRules([{...row,group:'received'}],'2026-09-18');
 assert.equal(r.stopped,1);assert.equal(store.get('pay_one').status,'recovered');assert.equal(store.get('pay_one').pending_internal_events.length,0);
 if(previousActivation===undefined)delete process.env.FINANCE_RECOVERY_AUTOMATION_ACTIVATED_AT;else process.env.FINANCE_RECOVERY_AUTOMATION_ACTIVATED_AT=previousActivation;
});
