const test = require('node:test');
const assert = require('node:assert/strict');
const { extractTelnyxIds } = require('../src/space-phone/core');
const { getCorrelatedScore } = require('../api/_lib/space-phone-correlation');
const call = { id: 'c1', from_number: '+15551112222', to_number: '+15553334444', started_at: '2026-09-24T12:00:00Z', duration_seconds: 60 };
const score = { ...call, recording_id: 'r1', call_leg_id: 'l1', call_session_id: 's1', transcript: 'Real pipeline fixture' };
test('extract SDK telnyxIDs, snake/camel and nested notifications without inventing IDs', () => {
  for (const payload of [
    {call:{call_leg_id:'l1',call_session_id:'s1',call_control_id:'c1'}},
    {call:{callLegId:'l1',callSessionId:'s1',callControlId:'c1'}},
    {call:{get telnyxIDs(){return {telnyxLegId:'l1',telnyxSessionId:'s1',telnyxCallControlId:'c1'};}}},
    {data:{call_leg_id:'l1',call_session_id:'s1',call_control_id:'c1'}},
    {params:{callLegId:'l1',callSessionId:'s1',callControlId:'c1'}},
  ]) assert.deepEqual(extractTelnyxIds(payload), {telnyx_call_control_id:'c1',telnyx_call_leg_id:'l1',telnyx_call_session_id:'s1'});
  assert.deepEqual(extractTelnyxIds({id:'dialog',call_leg_id:' '}), {});
});
test('exact leg wins over session; no cross-field ID matching', async () => {
  const paths=[];
  const found=await getCorrelatedScore({...call,telnyx_call_leg_id:'l1',telnyx_call_session_id:'s2'},async p=>{paths.push(p);return {data:[score]};});
  assert.equal(found.recording_id,'r1');assert.equal(paths.length,1);assert.match(paths[0], /call_leg_id=eq.l1/);
});
test('fallback heals missing IDs only after unique phones/time/duration match', async () => {
  const writes=[];
  const result=await getCorrelatedScore(call,async (p,o={})=>{if(o.method==='PATCH'){writes.push({p,...o});return {data:[]};}return {data:[{...score,from_number:'15551112222'}]};});
  assert.equal(result.recording_id,'r1'); assert.equal(writes.length,1);
  assert.deepEqual(writes[0].body,{telnyx_call_leg_id:'l1',telnyx_call_session_id:'s1'});
  assert.match(writes[0].p,/telnyx_call_leg_id=is.null/);
});
test('ambiguous, mismatched duration or absent transcript remain unmatched/pending without writes', async()=>{
  for(const data of [[score,{...score,recording_id:'r2',started_at:'2026-09-24T12:00:20Z'}],[{...score,duration_seconds:160}],[]]) {
    let writes=0;const result=await getCorrelatedScore(call,async(p,o={})=>{if(o.method)writes++;return {data};});
    assert.equal(result,null);assert.equal(writes,0);
  }
});
