const test=require('node:test'),assert=require('node:assert/strict');
const {createHarness}=require('./helpers/finance-postgres');
const {createFinanceStore}=require('../api/_lib/finance-store');
const {createFinanceFoundation}=require('../api/_lib/finance-foundation');
const {createAsaasClient}=require('../api/_lib/asaas');
const {normalizePayment}=require('../api/_lib/finance-domain');
const {createHandler}=require('../api/asaas-webhook');
const {Readable}=require('node:stream');
const fixture=(id,patch={})=>({id,customer:'cus_test',status:'PENDING',value:120,dueDate:'2026-10-01',billingType:'PIX',...patch});
const invoke=async(handler,body)=>{
  const req=Readable.from([JSON.stringify(body)]);req.method='POST';req.headers={'asaas-access-token':'test-secret'};
  const res={setHeader(){},end(b){this.body=JSON.parse(b)}};await handler(req,res);return{status:res.statusCode,...res.body};
};
test('Finance: real PostgreSQL/PostgREST transactional foundation with simulated Asaas',
  {skip:process.env.RUN_FINANCE_SQL_INTEGRATION!=='1',timeout:180000},async t=>{
    const h=await createHarness();
    try{
      const store=createFinanceStore({request:h.request});
      const {connection_id}=await store.rpc('configure',{environment:'sandbox',account_reference:'0001:123:4'});
      const scope={connection_id};
      const remote=new Map();const calls=[];let fault=null,hold=null;
      const client=createAsaasClient({config:()=>({baseUrl:'https://api-sandbox.asaas.com/v3',apiKey:'test-secret'}),fetchImpl:async(u,o)=>{
        const url=new URL(u);const path=url.pathname.replace('/v3','');calls.push(path+url.search);
        if(path==='/myAccount/accountNumber')return new Response('{"agency":"0001","account":"123","accountDigit":"4"}');
        if(fault)return new Response('private remote error',{status:fault});
        const resource=path.split('/')[1],id=path.split('/')[2];
        if(id){const value=remote.get(id);const snapshot=value&&structuredClone(value);if(hold){const fn=hold;hold=null;await fn();}
          return snapshot?new Response(JSON.stringify(snapshot)):new Response('{}',{status:404});}
        const values=[...remote.values()].filter(p=>resource==='payments'?p.id.startsWith('pay_'):resource==='customers'?p.id.startsWith('cus_'):p.id.startsWith('sub_'));
        const offset=Number(url.searchParams.get('offset')||0),limit=Number(url.searchParams.get('limit')||100);
        return new Response(JSON.stringify({data:values.slice(offset,offset+limit),hasMore:offset+limit<values.length}));
      }});
      const service=createFinanceFoundation({store,client,connectionId:connection_id,logger:()=>{}});
      const handler=createHandler({env:{FINANCE_FOUNDATION_ENABLED:'true',FINANCE_WEBHOOK_PROCESS_INLINE:'true',ASAAS_WEBHOOK_TOKEN:'test-secret'},service:()=>service});
      let seq=0;
      const ingest=async(type,p,extra={})=>service.ingestWebhook({id:`evt_${++seq}`,event:type,payment:p,...extra});
      const project=async(type,p)=>{remote.set(p.id,p);const e=await ingest(type,p);await service.processWebhookEvent(e.event_id);return e;};
      const scalar=sql=>h.sql(sql);
      const get=id=>store.rpc('get',{...scope,resource:'payments',external_object_id:id});
      let first;
      await t.test('PAYMENT_CREATED enters real inbox, creates unmatched projection; 20 replays do not duplicate',async()=>{
        const p=fixture('pay_created');remote.set(p.id,p);
        const body={id:'evt_created',event:'PAYMENT_CREATED',payment:p};
        first=await invoke(handler,body);assert.equal(first.status,200);
        assert.equal((await get(p.id)).status,'PENDING');assert.deepEqual((await get(p.id)).student_refs,[]);
        const count=scalar('select count(*) from finance_audit_events');
        const replays=await Promise.all(Array.from({length:20},()=>invoke(handler,body)));
        assert.ok(replays.every(r=>r.status===200&&r.duplicate));
        assert.equal(scalar('select count(*) from finance_receivables'),'1');
        assert.equal(scalar('select count(*) from finance_webhook_events'),'1');assert.equal(scalar('select count(*) from finance_audit_events'),count);
        assert.equal((await invoke(handler,{...body,payment:fixture(p.id,{value:999})})).status,409);
      });
      await t.test('20 simultaneous first deliveries and processors: one inbox and one business effect',async()=>{
        const p=fixture('pay_concurrent');remote.set(p.id,p);
        const receipts=await Promise.all(Array.from({length:20},()=>service.ingestWebhook({id:'evt_concurrent',event:'PAYMENT_CREATED',payment:p})));
        assert.equal(new Set(receipts.map(r=>r.event_id)).size,1);assert.equal(receipts.filter(r=>!r.duplicate).length,1);
        const results=await Promise.all(Array.from({length:10},()=>service.processWebhookEvent(receipts[0].event_id)));
        assert.equal(results.filter(r=>r.processed).length,1);
        assert.equal(scalar("select count(*) from finance_receivables where asaas_payment_id='pay_concurrent'"),'1');
        assert.equal(scalar("select count(*) from finance_audit_events where object_type='payments' and external_object_id='pay_concurrent'"),'1');
      });
      await t.test('UPDATE/OVERDUE/CONFIRMED/RECEIVED update one settlement, preserving distinctions',async()=>{
        await project('PAYMENT_UPDATED',fixture('pay_created',{value:140,dueDate:'2026-11-01'}));
        assert.equal(Number((await get('pay_created')).value),140);
        await project('PAYMENT_OVERDUE',fixture('pay_created',{status:'OVERDUE'}));assert.equal((await get('pay_created')).status,'OVERDUE');
        await project('PAYMENT_CONFIRMED',fixture('pay_created',{status:'CONFIRMED',confirmedDate:'2026-10-02'}));
        assert.equal(scalar("select status from finance_payments where asaas_payment_id='pay_created'"),'CONFIRMED');
        await project('PAYMENT_RECEIVED',fixture('pay_created',{status:'RECEIVED',confirmedDate:'2026-10-02',paymentDate:'2026-10-03'}));
        assert.equal(scalar('select count(*) from finance_payments'),'1');
        assert.equal(scalar("select payment_date from finance_payments where asaas_payment_id='pay_created'"),'2026-10-03');
      });
      await t.test('late UPDATED PENDING cannot downgrade RECEIVED; GET current state wins',async()=>{
        const e=await ingest('PAYMENT_UPDATED',fixture('pay_created'),{dateCreated:'2020-01-01 10:00:00'});
        await service.processWebhookEvent(e.event_id);assert.equal((await get('pay_created')).status,'RECEIVED');
      });
      await t.test('refund, chargebacks, deletion and restoration preserve audit and one payment',async()=>{
        for(const status of ['REFUNDED','CHARGEBACK_REQUESTED','CHARGEBACK_DISPUTE']){
          await project(`PAYMENT_${status}`,fixture('pay_created',{status,paymentDate:'2026-10-03'}));
          assert.equal((await get('pay_created')).status,status);
        }
        await project('PAYMENT_DELETED',fixture('pay_created',{deleted:true,status:'PENDING'}));assert.equal((await get('pay_created')).deleted,true);
        await project('PAYMENT_RESTORED',fixture('pay_created'));assert.equal((await get('pay_created')).deleted,false);
        assert.equal(scalar('select count(*) from finance_payments'),'1');
        assert.ok(Number(scalar("select count(*) from finance_audit_events where source='ASAAS_WEBHOOK' and object_type='payments'"))>=8);
      });
      await t.test('explicit verified customer link; unknown customer stays unmatched without name/email heuristics',async()=>{
        remote.set('cus_test',{id:'cus_test',name:'Test'});
        await service.linkCustomer('cus_test','fs_student',{actor:'admin',resolveStudent:async()=>({tipo:'student'})});
        assert.deepEqual((await get('pay_created')).student_refs,['fs_student']);
        await project('PAYMENT_CREATED',fixture('pay_unmatched',{customer:'cus_unknown',name:'Test',email:'same@example.com'}));
        assert.deepEqual((await get('pay_unmatched')).student_refs,[]);
        await assert.rejects(service.linkCustomer('cus_test','fs_other',{actor:'admin',resolveStudent:async()=>({tipo:'teacher'})}),/identity_unverified/);
      });
      await t.test('transaction rollback if audit insertion fails: no partial projection/payment',async()=>{
        h.sql("create function fail_finance_audit_test() returns trigger language plpgsql as $$ begin if new.external_object_id='pay_rollback' then raise exception 'synthetic_failure'; end if; return new; end $$; create trigger fail_finance_audit_test before insert on finance_audit_events for each row execute function fail_finance_audit_test();");
        const p=fixture('pay_rollback',{status:'RECEIVED',paymentDate:'2026-10-01'});remote.set(p.id,p);const e=await ingest('PAYMENT_RECEIVED',p);
        await assert.rejects(service.processWebhookEvent(e.event_id));
        assert.equal(await get(p.id),null);assert.equal(scalar("select count(*) from finance_payments where asaas_payment_id='pay_rollback'"),'0');
        h.sql('drop trigger fail_finance_audit_test on finance_audit_events; drop function fail_finance_audit_test();');
        // A failure while recording failure leaves a processing lease. It is recoverable after expiry.
        h.sql("update finance_object_leases set expires_at=now()-interval '1 second';update finance_webhook_events set lease_until=now()-interval '1 second',available_at=now()-interval '1 second' where external_object_id='pay_rollback';");
        await service.retryWebhookEvent(e.event_id);assert.equal((await get(p.id)).status,'RECEIVED');
      });
      await t.test('retry records failed state, backoff and hard attempt limit',async()=>{
        const p=fixture('pay_retry');remote.set(p.id,p);const e=await ingest('PAYMENT_CREATED',p);fault=503;
        for(let i=0;i<5;i++){
          await assert.rejects(service.retryWebhookEvent(e.event_id));
          h.sql(`update finance_webhook_events set available_at=now()-interval '1 second' where id='${e.event_id}';`);
        }
        assert.equal((await service.retryWebhookEvent(e.event_id)).exhausted,true);
        const row=await store.rpc('event',{...scope,event_id:e.event_id});assert.equal(row.attempt_count,5);assert.equal(row.last_error,'asaas_remote_error');
        assert.equal(row.processing_status,'failed');fault=null;
      });
      await t.test('permanent 404 never fabricates a deletion; event remains failed visible',async()=>{
        const e=await ingest('PAYMENT_DELETED',fixture('pay_missing',{deleted:true}));
        await assert.rejects(service.processWebhookEvent(e.event_id));
        assert.equal(await get('pay_missing'),null);
        const row=await store.rpc('event',{...scope,event_id:e.event_id});assert.equal(row.processing_status,'failed');assert.equal(row.retryable,false);
      });
      await t.test('stale worker cannot commit after lease expires and newer worker repairs',async()=>{
        const id='pay_fenced';remote.set(id,fixture(id));let unblock,started;
        const ready=new Promise(r=>started=r),blocked=new Promise(r=>unblock=r);
        hold=async()=>{started();await blocked;};
        const old=service.repairPaymentById(id,{dryRun:false}).then(v=>({v}),e=>({e}));await ready;
        h.sql("update finance_object_leases set expires_at=now()-interval '1 second' where external_object_id='pay_fenced';");
        remote.set(id,fixture(id,{status:'RECEIVED',paymentDate:'2026-10-01'}));
        await service.repairPaymentById(id,{dryRun:false});unblock();assert.ok((await old).e);
        assert.equal((await get(id)).status,'RECEIVED');
      });
      await t.test('dry-run paginates, reports divergence and makes no database mutation; repeated apply upserts',async()=>{
        const before=scalar('select count(*) from finance_audit_events'),runs=scalar('select count(*) from finance_sync_runs');
        remote.set('pay_backfill',fixture('pay_backfill'));
        const preview=await service.sync({dryRun:true,limit:2});assert.ok(preview.counts.MISSING_LOCAL>=1);assert.ok(preview.counts.UNMATCHED_CUSTOMER>=1);
        assert.ok(calls.some(x=>x.includes('offset=2')));assert.equal(await get('pay_backfill'),null);
        assert.equal(scalar('select count(*) from finance_audit_events'),before);assert.equal(scalar('select count(*) from finance_sync_runs'),runs);
        await service.sync({dryRun:false,limit:2});const count=scalar('select count(*) from finance_receivables'),audits=scalar('select count(*) from finance_audit_events');
        await service.sync({dryRun:false,limit:2});assert.equal(scalar('select count(*) from finance_receivables'),count);assert.equal(scalar('select count(*) from finance_audit_events'),audits);
      });
      await t.test('reconciliation detects typed-column drift; repair restores Asaas state with source audit',async()=>{
        h.sql("update finance_receivables set status='OVERDUE',value=999,due_date='2027-01-01' where asaas_payment_id='pay_backfill';");
        const r=await service.sync({source:'ASAAS_RECONCILIATION',dryRun:true,limit:2});
        for(const i of ['STATUS_MISMATCH','VALUE_MISMATCH','DUE_DATE_MISMATCH'])assert.ok(r.counts[i]>=1);
        await service.repairPaymentById('pay_backfill',{dryRun:false,actor:'support'});
        assert.equal((await get('pay_backfill')).status,'PENDING');assert.equal(Number((await get('pay_backfill')).value),120);
        assert.ok(Number(scalar("select count(*) from finance_audit_events where source='ASAAS_REPAIR' and actor='support'"))>0);
        await service.sync({source:'ASAAS_RECONCILIATION',dryRun:false,limit:2});
        assert.ok((await store.rpc('health',scope)).last_reconciliation);
      });
      await t.test('deleted local projection in disposable DB is detected and rebuilt by repair',async()=>{
        h.sql("delete from finance_receivables where asaas_payment_id='pay_backfill';");
        const report=await service.sync({source:'ASAAS_RECONCILIATION',dryRun:true});
        assert.ok(report.issues.find(x=>x.external_object_id==='pay_backfill').issues.includes('MISSING_LOCAL'));
        await service.repairPaymentById('pay_backfill',{dryRun:false,actor:'support'});
        assert.equal(Number((await get('pay_backfill')).value),120);
      });
      await t.test('crash on final attempt becomes failed after lease expiration',async()=>{
        const p=fixture('pay_crashed');const e=await ingest('PAYMENT_CREATED',p);
        h.sql(`update finance_webhook_events set processing_status='processing',attempt_count=5,lease_until=now()-interval '1 second' where id='${e.event_id}';`);
        await store.rpc('pending',{...scope,limit:20});
        const row=await store.rpc('event',{...scope,event_id:e.event_id});
        assert.equal(row.processing_status,'failed');assert.equal(row.last_error,'finance_attempts_exhausted');
      });
      await t.test('account/environment binding prevents projection into another connection',async()=>{
        const other=await store.rpc('configure',{environment:'sandbox',account_reference:'0001:999:4'});
        const wrong=createFinanceFoundation({store,client,connectionId:other.connection_id,logger:()=>{}});
        await assert.rejects(wrong.repairPaymentById('pay_created',{dryRun:false}),/account_mismatch/);
        assert.equal(scalar(`select count(*) from finance_receivables where connection_id='${other.connection_id}'`),'0');
      });
      await t.test('customer/subscription projections do not invent academic identities',async()=>{
        remote.set('sub_test',{id:'sub_test',customer:'cus_test',status:'ACTIVE',value:120,cycle:'MONTHLY',billingType:'PIX',nextDueDate:'2026-11-01'});
        await service.sync({resource:'customers',dryRun:false});await service.sync({resource:'subscriptions',dryRun:false});
        assert.equal(scalar('select count(*) from finance_provider_objects'),'2');
      });
      await t.test('privileges/constraints: browser cannot call RPC, service cannot mutate tables, audit immutable',async()=>{
        for(const role of ['anon','authenticated']){
          const r=await fetch(h.url+'/rpc/finance_rpc',{method:'POST',headers:{Authorization:`Bearer ${h.token(role)}`,'Content-Type':'application/json'},body:JSON.stringify({p_action:'health',p_args:scope})});
          assert.ok([401,403].includes(r.status));
        }
        const res=await fetch(h.url+'/finance_receivables',{method:'POST',headers:{Authorization:`Bearer ${h.token('service_role')}`,'Content-Type':'application/json'},body:'{}'});assert.equal(res.status,403);
        assert.throws(()=>h.sql("update finance_audit_events set action='changed';"),/finance_audit_immutable/);
        assert.throws(()=>h.sql("insert into finance_receivables select * from finance_receivables limit 1;"));
      });
      await t.test('shared connections coexist with Attendance migration without changing financial ownership',async()=>{
        const fs=require('node:fs'),path=require('node:path');
        h.sql(fs.readFileSync(path.join(__dirname,'../supabase/migrations/202609140001_attendance_foundation.sql'),'utf8'));
        h.migrate();assert.equal((await service.verifyConnection()).connection_id,connection_id);
        assert.equal((await get('pay_created')).status,'PENDING');
      });
      await t.test('unknown events stored then ignored visibly; migration replay preserves records',async()=>{
        const e=await service.ingestWebhook({id:'evt_unknown',event:'UNKNOWN_EVENT'});await service.processWebhookEvent(e.event_id);
        assert.equal((await store.rpc('event',{...scope,event_id:e.event_id})).processing_status,'ignored');
        const count=scalar('select count(*) from finance_receivables');h.migrate();assert.equal(scalar('select count(*) from finance_receivables'),count);
      });
    }finally{h.cleanup();}
  });
