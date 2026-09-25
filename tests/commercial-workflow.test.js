const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('fs');const vm=require('vm');
const {build}=require('../workflows/commercial/build-protected-workflow.cjs');
const source=require('./fixtures/commercial-v7-structure.json');
test('all ten CRM/status sinks use the protected action engine with no continue-on-error',()=>{
 const w=build(source,'test-only-secret');const sinks=w.nodes.filter(n=>n.parameters.url==='https://plataforma.spaceschoolbr.com/api/integrations/n8n/commercial-action'&&!n.name.startsWith('Action Engine'));
 assert.equal(sinks.length,10);for(const n of sinks){assert.equal(n.parameters.method,'POST');assert.equal(n.continueOnFail,undefined);assert.equal(n.onError,undefined);}
});
test('all generated Code nodes are syntactically valid',()=>{for(const n of build(source,'test-only-secret').nodes){if(n.type==='n8n-nodes-base.code')assert.doesNotThrow(()=>new Function('$','$json','$input',n.parameters.jsCode));}});
test('transcript labels are preserved and left_alone never establishes presence/absence',()=>{
 const code=fs.readFileSync('workflows/commercial/transcript.js','utf8');const context=vm.createContext({});vm.runInContext(code,context);
 const out=context.transcriptEvidence({lead_name:'Nerio',vexa_completion_reason:'left_alone'}, {segments:[{speaker:'Amanda Frossard',text:'Hello'}]});
 assert.match(out.transcript,/Amanda Frossard/);assert.doesNotMatch(out.transcript,/Lead \(Nerio\)/);assert.equal(out.no_show_confirmed,false);assert.equal(out.attendance_confirmed,false);
});
test('resolver cannot use title/name/phone suffix or different recurring date',()=>{
 const ctx=vm.createContext({});vm.runInContext(fs.readFileSync('workflows/commercial/context.js','utf8'),ctx);
 const output=ctx.resolveContext({call_title:'Aula Nerio Marçal',meet_link:'meet',vexa_data:{scheduled_at:'2026-09-25T12:00:00Z'}},[{id:'a',lead_id:'lead',meet_link:'meet',starts_at:'2026-09-24T12:00:00Z'}],[{id:'deal',leadId:'lead',lead:{name:'Nerio Marçal'}}]);
 assert.equal(output.business_found,false);assert.equal(output.sdr_found,false);
});
test('RLS and database-level unique claims protect concurrency',()=>{
 const sql=fs.readFileSync('supabase/migrations/20260925131619_commercial_action_engine.sql','utf8');assert.match(sql,/action_key text PRIMARY KEY/);assert.match(sql,/ON CONFLICT DO NOTHING/);assert.match(sql,/ENABLE ROW LEVEL SECURITY/);assert.match(sql,/REVOKE ALL.*FROM PUBLIC, anon, authenticated/);
});
