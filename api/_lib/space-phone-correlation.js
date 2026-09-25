const clean = value => String(value ?? '').trim();
const rows = response => Array.isArray(response?.data) ? response.data : [];
const enc = value => encodeURIComponent(clean(value));
const select = 'recording_id,call_leg_id,call_session_id,connection_id,from_number,to_number,started_at,duration_seconds,transcript,score,analysis,recording_url,created_at';
const digits = value => clean(value).replace(/\D/g, '');

const isCandidate = (call, score) => {
  if (!digits(call.from_number) || !digits(call.to_number)) return false;
  if (digits(call.from_number) !== digits(score.from_number) || digits(call.to_number) !== digits(score.to_number)) return false;
  const start = Date.parse(call.started_at);
  const recorded = Date.parse(score.started_at);
  if (!Number.isFinite(start) || !Number.isFinite(recorded) || Math.abs(start - recorded) > 90000) return false;
  if (call.duration_seconds == null || score.duration_seconds == null) return false;
  const a = Number(call.duration_seconds), b = Number(score.duration_seconds);
  return Number.isFinite(a) && Number.isFinite(b) && a >= 0 && b >= 0 && Math.abs(a - b) <= 5;
};

const getCorrelatedScore = async (call, request) => {
  for (const [field, id] of [['call_leg_id', call.telnyx_call_leg_id], ['call_session_id', call.telnyx_call_session_id]]) {
    if (!clean(id)) continue;
    const matches = rows(await request(`/sdr_call_scores?select=${select}&${field}=eq.${enc(id)}&limit=2`, { timeoutMs: 8000 }));
    if (matches.length > 1) return null; // Multiple recordings/legs require explicit resolution.
    if (matches.length === 1) return matches[0];
  }
  const start = Date.parse(call.started_at);
  if (!Number.isFinite(start) || !digits(call.from_number) || !digits(call.to_number)) return null;
  // Bound by call time, not the most recent N recordings; late transcripts remain discoverable.
  const matches = rows(await request(`/sdr_call_scores?select=${select}&started_at=gte.${enc(new Date(start - 90000).toISOString())}&started_at=lte.${enc(new Date(start + 90000).toISOString())}&order=created_at.desc&limit=101`, { timeoutMs: 8000 }));
  if (matches.length > 100) return null; // Never claim uniqueness from truncated results.
  const candidates = matches.filter(score => isCandidate(call, score));
  if (candidates.length !== 1) return null;
  const score = candidates[0];
  const patch = {};
  for (const field of ['call_leg_id', 'call_session_id']) {
    const key = `telnyx_${field}`;
    if (!clean(call[key]) && clean(score[field])) patch[key] = clean(score[field]);
  }
  if (call.id && Object.keys(patch).length) {
    // Compare the original IDs so a concurrent SDK update is never overwritten.
    const guard = ['telnyx_call_leg_id', 'telnyx_call_session_id'].map(key => `${key}=${call[key] == null ? 'is.null' : `eq.${enc(call[key])}`}`).join('&');
    await request(`/voice_calls?id=eq.${enc(call.id)}&${guard}`, { method: 'PATCH', body: patch, timeoutMs: 8000 });
  }
  return score;
};
module.exports = { getCorrelatedScore, isCandidate };
