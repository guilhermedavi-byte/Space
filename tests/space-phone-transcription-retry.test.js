const { test } = require('node:test');
const assert = require('node:assert/strict');
const { requeueTranscription } = require('../api/_lib/space-phone-transcription-retry');
const now = new Date('2026-09-25T20:00:00Z');
const call = { telnyx_call_leg_id: 'leg', telnyx_call_session_id: 'session', outcome: 'agendado', ended_at: '2026-09-25T19:59:00Z' };
const score = { recording_id: 'rec', status: 'complete', updated_at: '2026-09-25T19:00:00Z' };
const recording = { id: 'rec', call_leg_id: 'leg', call_session_id: 'session', download_urls: { mp3: 'https://audio.example/rec' } };
test('retry transcription is isolated, fresh and idempotent', async t => {
 const old = process.env.TELNYX_API_KEY; process.env.TELNYX_API_KEY = ' Bearer KEY-test \n';
 try {
  await t.test('no recording waits without network', async()=>assert.equal((await requeueTranscription({call,now,request:()=>assert.fail()})).aiStatus,'waiting_recording'));
  await t.test('no-contact outcome does not pay for transcription', async()=>{ const result=await requeueTranscription({call:{...call,outcome:'caixa_postal'},score,now,request:()=>assert.fail()}); assert.equal(result.reason,'no_human_contact'); assert.equal(result.aiStatus,'not_required'); });
  await t.test('missing outcome waits for wrap-up instead of transcribing', async()=>{ const result=await requeueTranscription({call:{...call,outcome:''},score,now,request:()=>assert.fail()}); assert.equal(result.reason,'wrapup_window'); });
  await t.test('existing transcript never duplicates provider work', async()=>assert.equal((await requeueTranscription({call,score:{...score,transcript:'ok'},now})).reason,'transcript_exists'));
  await t.test('mismatched recording never writes', async()=>assert.equal((await requeueTranscription({call,score,now,fetchImpl:async()=>({ok:true,json:async()=>({data:{...recording,call_leg_id:'other'}})}),request:()=>assert.fail()})).reason,'recording_identity_mismatch'));
  await t.test('fresh URL queues only the selected version', async()=>{
   let writes=0;
   const result=await requeueTranscription({call,score,now,fetchImpl:async(url,opts)=>{assert.ok(url.endsWith('/rec'));assert.equal(opts.headers.Authorization,'Bearer KEY-test');return {ok:true,json:async()=>({data:recording})};},request:async(path,opts)=>{writes++;assert.equal(path,'/sdr_call_scores?recording_id=eq.rec');assert.deepEqual(opts.body,{recording_url:recording.download_urls.mp3});return {data:[{recording_id:'rec'}]};}});
   assert.equal(result.queued,true);assert.equal(writes,1);assert.equal(JSON.stringify(result).includes('https:'),false);
  });
  await t.test('lost CAS does not claim queued', async()=>assert.equal((await requeueTranscription({call,score,now,fetchImpl:async()=>({ok:true,json:async()=>({data:recording})}),request:async()=>({data:[]})})).queued,false));
 } finally { if(old===undefined) delete process.env.TELNYX_API_KEY; else process.env.TELNYX_API_KEY=old; }
});
test('recovery clears compromised AI without reopening human completion', async () => {
 const {requestAiQualification}=require('../api/_lib/space-phone-n8n');
 const patches=[];
 const q={status:'complete',updated_at:now.toISOString(),context:'Human context',final_summary:'Human final'};
 const request=async(path,options={})=>{
  if(options.method==='PATCH'){patches.push({path,body:options.body});return {data:[q]};}
  if(path.startsWith('/voice_call_qualifications'))return {data:[q]};
  return {data:[{...score,call_leg_id:'leg',call_session_id:'session',status:'processing',updated_at:now.toISOString(),transcript:'Your call has been forwarded to voicemail.'}]};
 };
 await requestAiQualification({call:{...call,id:'call',outcome:'agendado'},retry:true,now,request,dispatch:()=>assert.fail()});
 assert.equal(patches.length,1);
 assert.deepEqual(Object.keys(patches[0].body).sort(),['ai_context','ai_decision_investment','ai_experience','ai_key_point','ai_pain_goal','ai_urgency']);
 assert.ok(Object.values(patches[0].body).every(v=>v===null));
});
test('existing WebRTC key is tried only after rejected legacy authentication', async()=>{
 const legacy=process.env.TELNYX_API_KEY,web=process.env.TELNYX_WEBRTC_API_KEY;
 process.env.TELNYX_API_KEY='KEY-legacy';process.env.TELNYX_WEBRTC_API_KEY='KEY-webrtc';
 try{const keys=[];const result=await requeueTranscription({call,score,now,fetchImpl:async(url,opts)=>{keys.push(opts.headers.Authorization);return keys.length===1?{status:401,ok:false}:{status:200,ok:true,json:async()=>({data:recording})};},request:async()=>({data:[score]})});assert.deepEqual(keys,['Bearer KEY-legacy','Bearer KEY-webrtc']);assert.equal(result.queued,true);
 }finally{if(legacy===undefined)delete process.env.TELNYX_API_KEY;else process.env.TELNYX_API_KEY=legacy;if(web===undefined)delete process.env.TELNYX_WEBRTC_API_KEY;else process.env.TELNYX_WEBRTC_API_KEY=web;}
});
