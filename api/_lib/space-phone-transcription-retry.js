const clean = value => String(value ?? '').trim();
const rows = response => Array.isArray(response?.data) ? response.data : [];
// The existing scoring workflow consumes this state; it is not another transcription producer.
async function requeueTranscription({ call, score, request, fetchImpl = global.fetch, now = new Date() }) {
  if (!score?.recording_id) return { skipped: true, aiStatus: 'waiting_recording' };
  const age = now.getTime() - Date.parse(score.updated_at || score.created_at);
  if (['transcription_retry_pending', 'processing'].includes(score.status) && age >= 0 && age < 10 * 60 * 1000) return { skipped: true, aiStatus: 'transcribing' };
  const keys = ['TELNYX_API_KEY', 'TELNYX_WEBRTC_API_KEY'].map(name => ({ name, key: clean(process.env[name]).replace(/^(?:Bearer\s+)+/i, '').trim() })).filter(item => item.key);
  if (!keys.length) return { ok: false, aiStatus: 'failed', reason: 'transcription_retry_unavailable' };
  let response;
  for (const {name, key} of keys) {
    response = await fetchImpl(`https://api.telnyx.com/v2/recordings/${encodeURIComponent(score.recording_id)}`, {
      headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' }, redirect: 'error', signal: AbortSignal.timeout(15000),
    });
    console.info('[space-phone] recording lookup', { recordingId: score.recording_id, credentialSource: name, httpStatus: response.status });
    if (![401, 403].includes(response.status)) break;
  }
  const recording = (await response.json().catch(() => ({})))?.data;
  if (!response.ok || !recording) return { ok: false, aiStatus: 'failed', reason: 'recording_lookup_failed' };
  if (String(recording.id) !== String(score.recording_id) || ['call_leg_id', 'call_session_id'].some(field => call[`telnyx_${field}`] && String(recording[field] || '') !== String(call[`telnyx_${field}`]))) return { ok: false, aiStatus: 'failed', reason: 'recording_identity_mismatch' };
  const url = clean(recording.download_urls?.mp3);
  if (!/^https:\/\//.test(url)) return { skipped: true, aiStatus: 'waiting_recording' };
  const version = score.updated_at ? `&updated_at=eq.${encodeURIComponent(score.updated_at)}` : '&updated_at=is.null';
  const updated = rows(await request(`/sdr_call_scores?recording_id=eq.${encodeURIComponent(score.recording_id)}${version}`, {
    method: 'PATCH', headers: { Prefer: 'return=representation' }, body: { status: 'transcription_retry_pending', recording_url: url, updated_at: now.toISOString() },
  }));
  return { ok: true, queued: updated.length > 0, aiStatus: 'transcribing' };
}
module.exports = { requeueTranscription };
