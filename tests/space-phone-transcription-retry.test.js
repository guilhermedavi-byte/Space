const { test } = require('node:test');
const assert = require('node:assert/strict');
const { requeueTranscription } = require('../api/_lib/space-phone-transcription-retry');
const now = new Date('2026-09-25T20:00:00Z');
const call = { telnyx_call_leg_id: 'leg', telnyx_call_session_id: 'session' };
const score = { recording_id: 'rec', status: 'complete', updated_at: '2026-09-25T19:00:00Z' };
const recording = { id: 'rec', call_leg_id: 'leg', call_session_id: 'session', download_urls: { mp3: 'https://audio.example/rec' } };
test('retry transcription is isolated, fresh and idempotent', async t => {
 const old = process.env.TELNYX_API_KEY; process.env.TELNYX_API_KEY = ' Bearer KEY-test \n';
 try {
  await t.test('no recording waits without network', async()=>assert.equal((await requeueTranscription({call,now,request:()=>assert.fail()})).aiStatus,'waiting_recording'));
  await t.test('recent processing does not duplicate', async()=>assert.equal((await requeueTranscription({call,score:{...score,status:'processing',updated_at:now.toISOString()},now})).skipped,true));
  await t.test('mismatched recording never writes', async()=>assert.equal((await requeueTranscription({call,score,now,fetchImpl:async()=>({ok:true,json:async()=>({data:{...recording,call_leg_id:'other'}})}),request:()=>assert.fail()})).reason,'recording_identity_mismatch'));
  await t.test('fresh URL queues only the selected version', async()=>{
   let writes=0;
   const result=await requeueTranscription({call,score,now,fetchImpl:async(url,opts)=>{assert.ok(url.endsWith('/rec'));assert.equal(opts.headers.Authorization,'Bearer KEY-test');return {ok:true,json:async()=>({data:recording})};},request:async(path,opts)=>{writes++;assert.match(path,/recording_id=eq.rec&updated_at=eq/);assert.equal(opts.body.status,'transcription_retry_pending');assert.equal(opts.body.recording_url,recording.download_urls.mp3);return {data:[{recording_id:'rec'}]};}});
   assert.equal(result.queued,true);assert.equal(writes,1);assert.equal(JSON.stringify(result).includes('https:'),false);
  });
  await t.test('lost CAS does not claim queued', async()=>assert.equal((await requeueTranscription({call,score,now,fetchImpl:async()=>({ok:true,json:async()=>({data:recording})}),request:async()=>({data:[]})})).queued,false));
 } finally { if(old===undefined) delete process.env.TELNYX_API_KEY; else process.env.TELNYX_API_KEY=old; }
});
