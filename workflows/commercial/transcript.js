function transcriptEvidence(ctx, raw) {
 const candidates=raw?.segments||raw?.transcript?.segments||raw?.data?.segments||[];
 const segments=Array.isArray(candidates)?candidates.filter(s=>s&&s.completed!==false&&String(s.text||s.transcript||s.content||'').trim()):[];
 const seen=new Set();const unique=segments.filter(s=>{const k=s.segment_id||JSON.stringify([s.speaker,s.start,s.text]);if(seen.has(k))return false;seen.add(k);return true;});
 // Preserve the source label; a non-closer speaker is NOT automatically a lead.
 const transcript=unique.map(s=>`${String(s.speaker||s.speaker_name||'Participante não identificado')}: ${String(s.text||s.transcript||s.content).trim()}`).join('\n');
 const outcome=String(ctx.vexa_transcription_outcome||ctx.vexa_data?.transcription_outcome||raw?.transcription_outcome||'').toLowerCase();
 const failed=!!raw?.error||['failed','error'].includes(outcome)||['failed','error'].includes(ctx.vexa_status);
 // No invitation or transcript-derived roster is accepted as observed attendance.
 // The current Vexa output does not certify an observed roster. Keep unknown.
 const attendance={source:'unavailable',complete:false,meeting_id:String(ctx.meeting_id||ctx.vexa_meeting_id||'')};
 return {...ctx,transcript,transcript_chars:transcript.length,transcript_segments_count:unique.length,
  transcript_status:failed?'TRANSCRIPTION_FAILED':transcript.length>=120?'AVAILABLE':'TRANSCRIPTION_UNAVAILABLE',
  evidence:{transcript,transcription_failed:failed,technical_failure:failed,capture_health_confirmed:!failed&&['completed','success','succeeded'].includes(outcome),attendance},
  detected_speakers:[...new Set(unique.map(s=>s.speaker||s.speaker_name).filter(Boolean))],detected_closers:[],
  internal_speakers:[],external_speakers:[],actual_closer:'Não confirmado',attendant_id_target:null,
  attendance_confirmed:false,no_show_confirmed:false,attendance_status:'pending',can_auto_stage:false,
  attendance_reason:'Aguardando evidência independente de participação; transcrição não autoriza alteração comercial.'};
}
