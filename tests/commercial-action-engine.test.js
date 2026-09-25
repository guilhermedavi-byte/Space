const {test}=require('node:test');const assert=require('node:assert/strict');
const {executeCommercialAction}=require('../api/_lib/commercial-action-engine');
const {STAGES,SALES_PIPELINE}=require('../api/_lib/commercial-action-policy');
function setup(){
 const id='11111111-1111-4111-8111-111111111111';
 const business={id,leadId:'lead',status:'in_process',stageId:STAGES.scheduled,pipelineId:SALES_PIPELINE,lead:{id:'lead',email:'lead@test.example'}};
 const appointment={id:'22222222-2222-4222-8222-222222222222',lead_id:'lead',starts_at:'2026-09-25T15:00:00Z',google_event_id:'event',meet_link:'https://meet.google.com/abc-defg-hij',consultant_email:'closer@test.example'};
 const audit=[],writes=[],claims=new Set();let unavailable=false,changed=false,timeout=false;
 const request=async(path,o={})=>{
  if(path.startsWith('/sdr_meetings?')&&o.method!=='PATCH')return {data:[appointment]};
  if(path==='/rpc/commercial_student_evidence'){if(unavailable)throw new Error('down');return {data:{student_found:false,student_lookup_complete:true}};}
  if(path==='/rpc/claim_commercial_action'){
   audit.push(o.body.p_decision);let claimed=o.body.p_decision.action_allowed===true&&!claims.has(o.body.p_key);if(claimed)claims.add(o.body.p_key);return {data:{claimed}};
  }
  if(path.startsWith('/commercial_action_claims?'))return {data:[o.body]};
  throw Error(path);
 };
 const crm=async(path,o={})=>{
  if(o.method){writes.push(o);if(timeout)throw Object.assign(new Error('timeout'),{code:'CRM_TRANSPORT_FAILED'});business.stageId=o.body.stageId;return business;}
  if(path.startsWith('/businesses?'))return {data:[business]};
  return changed?{...business,stageId:STAGES.studying}:business;
 };
 const body={action:'attended',business_id:id,meeting:{id:'meeting',scheduled_at:appointment.starts_at,calendar_uid:'event',meet_link:appointment.meet_link},evidence:{capture_health_confirmed:true,transcript:'Conversation '.repeat(30),attendance:{source:'participant_events',complete:true,meeting_id:'meeting',lead_id:'lead',closer_email:appointment.consultant_email,lead_joined:true,closer_joined:true}}};
 return {body,business,audit,writes,claims,deps:{request,crm,now:()=>Date.parse('2026-09-25T15:30:00Z')},failSource:()=>unavailable=true,changeState:()=>changed=true,timeout:()=>timeout=true};
}
test('audit precedes CRM side effect; duplicate event never writes twice',async()=>{const x=setup();assert.equal((await executeCommercialAction(x.body,x.deps)).performed,true);assert.equal(x.audit.length,1);assert.equal(x.writes.length,1);await executeCommercialAction(x.body,x.deps);assert.equal(x.writes.length,1);});
test('concurrent duplicate deliveries claim exactly once',async()=>{const x=setup();await Promise.all([executeCommercialAction(x.body,x.deps),executeCommercialAction(x.body,x.deps)]);assert.equal(x.writes.length,1);});
test('state changed to Cursando between read and write is blocked',async()=>{const x=setup();x.changeState();assert.equal((await executeCommercialAction(x.body,x.deps)).performed,false);assert.equal(x.writes.length,0);});
test('source failure never writes and records fail-closed audit',async()=>{const x=setup();x.failSource();await assert.rejects(executeCommercialAction(x.body,x.deps));assert.equal(x.writes.length,0);assert.deepEqual(x.audit[0].block_reasons,['BLOCKED_SOURCE_UNAVAILABLE']);});
test('uncertain remote timeout is never automatically retried',async()=>{const x=setup();x.timeout();await assert.rejects(executeCommercialAction(x.body,x.deps));await executeCommercialAction(x.body,x.deps);assert.equal(x.writes.length,1);});
test('preview records decision but cannot claim or mutate',async()=>{const x=setup();await executeCommercialAction({...x.body,preview:true},x.deps);assert.equal(x.writes.length,0);assert.equal(x.claims.size,0);});
test('existing student blocks all CRM writes',async()=>{const x=setup();x.business.lead.tags=['ALUNO ATIVO'];assert.equal((await executeCommercialAction(x.body,x.deps)).performed,false);assert.equal(x.writes.length,0);});
