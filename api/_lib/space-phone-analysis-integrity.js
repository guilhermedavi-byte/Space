const { businessDisposition } = require('./business-disposition');
function analysisIntegrity(call, score) {
  const transcript = String(score?.transcript || '').trim();
  const voicemailOnly = transcript.length < 240 && /voicemail|caixa postal|não (?:foi )?atendida|forwarded to/i.test(transcript);
  const inconsistent = Boolean(score && businessDisposition(call).humanContact && call.outcome && voicemailOnly);
  return { inconsistent, reason: inconsistent ? 'outcome_transcript_inconsistent' : null };
}
function logIntegrity(call, score) {
  console.warn('[space-phone] analysis integrity', {
    callId: call.id, recordingId: score?.recording_id || null, correlationMethod: score?.correlationMethod || 'unknown',
    callLegMatch: Boolean(call.telnyx_call_leg_id && call.telnyx_call_leg_id === score?.call_leg_id),
    callSessionMatch: Boolean(call.telnyx_call_session_id && call.telnyx_call_session_id === score?.call_session_id),
    transcriptLength: String(score?.transcript || '').length, analysisRecordingId: score?.recording_id || null,
  });
}
module.exports = { analysisIntegrity, logIntegrity };
