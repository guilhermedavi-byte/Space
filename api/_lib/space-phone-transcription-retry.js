const { businessDisposition } = require('./business-disposition');

const clean = value => String(value ?? '').trim();
const rows = response => Array.isArray(response?.data) ? response.data : [];
const NO_CONTACT = new Set(['nao_atendeu', 'ocupado', 'caixa_postal', 'numero_invalido']);
const HUMAN_CONTACT = new Set(['sem_interesse', 'retornar_depois', 'interessado', 'agendado']);
const WRAPUP_WINDOW_MS = 5 * 60 * 1000;

const retryGate = ({ call = {}, score = null, now = new Date() } = {}) => {
  if (clean(score?.transcript)) return { allowed: false, skipped: true, aiStatus: 'ready', reason: 'transcript_exists' };
  const outcome = clean(call.outcome);
  const rawStatus = clean(call.status).toLowerCase();
  if (['failed', 'error', 'erro'].includes(rawStatus)) return { allowed: false, skipped: true, aiStatus: 'not_required', reason: 'call_failed' };
  if (NO_CONTACT.has(outcome)) return { allowed: false, skipped: true, aiStatus: 'not_required', reason: 'no_human_contact' };
  if (!outcome) {
    const endedAt = Date.parse(call.ended_at || call.endedAt || '');
    const withinWrapup = Number.isFinite(endedAt) && now.getTime() - endedAt < WRAPUP_WINDOW_MS;
    return { allowed: false, skipped: true, aiStatus: withinWrapup ? 'waiting_outcome' : 'waiting_outcome', reason: withinWrapup ? 'wrapup_window' : 'outcome_required' };
  }
  if (!HUMAN_CONTACT.has(outcome) && !businessDisposition(call).humanContact) return { allowed: false, skipped: true, aiStatus: 'not_required', reason: 'non_commercial_outcome' };
  return { allowed: true };
};

// The existing scoring workflow remains the transcription producer; this only re-exposes
// the canonical recording URL after an explicit human retry, without schema-only queue columns.
async function requeueTranscription({ call = {}, score, request, fetchImpl = global.fetch, now = new Date() }) {
  const gate = retryGate({ call, score, now });
  if (!gate.allowed) return gate;
  if (!score?.recording_id) return { skipped: true, aiStatus: 'waiting_recording' };
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
  const updated = rows(await request(`/sdr_call_scores?recording_id=eq.${encodeURIComponent(score.recording_id)}`, {
    method: 'PATCH', headers: { Prefer: 'return=representation' }, body: { recording_url: url },
  }));
  return { ok: true, queued: updated.length > 0, aiStatus: 'transcribing' };
}
module.exports = { requeueTranscription, retryGate };
