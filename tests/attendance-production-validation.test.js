const test=require('node:test');
const assert=require('node:assert/strict');
const {createHarness}=require('./helpers/attendance-postgres');
const {makeRun,seed,environment}=require('../scripts/attendance-production-validation');
const sql=require('../scripts/attendance-production-sql');
test('certificação principal exige autorização antes de ler qualquer arquivo',()=>{
 const old=process.env.ATTENDANCE_ALLOW_PRODUCTION_MUTATIONS;
 try{delete process.env.ATTENDANCE_ALLOW_PRODUCTION_MUTATIONS;assert.throws(()=>environment('/does-not-exist'),/authorization_required/);}
 finally{if(old===undefined)delete process.env.ATTENDANCE_ALLOW_PRODUCTION_MUTATIONS;else process.env.ATTENDANCE_ALLOW_PRODUCTION_MUTATIONS=old;}
});
test('matriz real, consultas e cleanup restrito preservam sentinela e trigger',{
 skip:process.env.RUN_ATTENDANCE_SQL_INTEGRATION!=='1',timeout:90000,
},async()=>{
 const h=await createHarness();
 try{
  const m=makeRun();h.sql('grant all on public.audit_logs,public.outbox_events to service_role;');h.sql(seed(m));
  h.sql("insert into public.connections(provider,external_account_id,display_name) values('sentinel','outside-run','outside-run');");
  await h.request('/rpc/attendance_ingest_message',{method:'POST',body:{p_event:{provider:'attendance_validation',connection_id:m.connection,
   channel_id:m.channelA,external_message_id:m.run+'-first',external_contact_id:m.run+'-main',content:{text:'synthetic'}}}});
  const matrix=JSON.parse(h.sql(sql.matrix(m)));assert.equal(matrix.length,36);
  for(const r of matrix)assert.equal(r.allowed,r.principal==='service_role',JSON.stringify(r));
  h.sql(sql.verify(m));h.sql(sql.performance(m));
  assert.match(h.sql(sql.cleanup(m)),/remaining_test_records_after_cleanup/);
  assert.equal(h.sql('select count(*) from public.connections;'),'1');
  assert.equal(h.sql("select tgenabled from pg_trigger where tgname='attendance_events_immutable';"),'O');
 }finally{h.cleanup();}
});
