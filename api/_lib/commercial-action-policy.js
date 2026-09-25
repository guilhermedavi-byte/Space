// Shared deterministic policy. Never accepts AI output as authorization.
const VERSION = 'commercial-actions-v1';
const STAGES = Object.freeze({ scheduled: 'f3c1b001-dc4a-4ce4-9b04-b9f64ee86ba4', attended: '8c7ff174-03db-4fea-b531-ba2df4558f95', no_show: '34883136-e08c-450e-b92e-6c760ea1627f', studying: '04161143-69fd-40a9-b217-b532e1f9c414' });
const SALES_PIPELINE = '8838d57c-6fd8-417d-8b55-dad46fec87f1';
const clean = v => String(v ?? '').trim();
const norm = v => clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const phone = v => clean(v).replace(/\D/g, '');
const list = v => Array.isArray(v) ? v : [];
const leadId = b => clean(b?.leadId || b?.lead?.id);
const stageId = b => clean(b?.stageId || b?.stage?.id);
const pipelineId = b => clean(b?.pipelineId || b?.stage?.pipelineId || b?.stage?.pipeline?.id || b?.pipeline?.id);
const emails = b => [b?.lead?.email, ...list(b?.lead?.contacts).filter(c => norm(c.platform)==='email').map(c=>c.contactId)].map(norm).filter(Boolean);
const phones = b => [b?.lead?.phone, ...list(b?.lead?.contacts).filter(c=>['phone','whatsapp','sms'].includes(norm(c.platform))).map(c=>c.contactId)].map(phone).filter(p=>p.length>=8);
function exactPeople({ businesses, appointment, attendees = [], explicitLeadId }) {
  const expectedId = clean(appointment?.lead_id || explicitLeadId);
  const attendeeEmails = list(attendees).map(a=>norm(typeof a==='string' ? a : a.email)).filter(v=>v.includes('@'));
  const attendeePhones = list(attendees).map(a=>phone(a?.phone)).filter(v=>v.length>=8);
  const matches = businesses.filter(b => expectedId ? leadId(b)===expectedId :
    emails(b).some(e=>attendeeEmails.includes(e)) || phones(b).some(p=>attendeePhones.includes(p)));
  return [...new Set(matches.map(leadId).filter(Boolean))];
}
function studentEvidence(businesses) {
  return businesses.some(b => {
    const tags = list(b?.lead?.tags).concat(list(b?.tags)).map(t=>norm(typeof t==='string'?t:t.name));
    const stage = norm(b?.stage?.name || b?.stageName);
    return norm(b.status)==='won' || stageId(b)===STAGES.studying ||
      /cursando|onboarding|aluno ativo|retencao|cancelamento|venda ganha|fechado/.test(stage) ||
      tags.some(t=>/aluno ativo|aluno novo|matriculado/.test(t));
  });
}
function evaluateCommercialAction(input, now = Date.now()) {
  const { meeting = {}, appointment = null, business = null, businesses = [], evidence = {} } = input;
  const reasons = [];
  const people = exactPeople({ businesses, appointment, attendees: meeting.attendees, explicitLeadId: input.explicitLeadId });
  const unique = people.length===1 && (!input.explicitLeadId || people[0]===clean(input.explicitLeadId));
  const related = unique ? businesses.filter(b=>leadId(b)===people[0]) : [];
  const existingStudent = studentEvidence(related) || studentEvidence(business ? [business] : []) || evidence.student_found===true;
  const checkedStudent = evidence.student_lookup_complete===true && evidence.crm_lookup_complete===true;
  const scheduled = Date.parse(appointment?.starts_at || '');
  const sameOccurrence = appointment && Number.isFinite(scheduled) && scheduled===Date.parse(meeting.scheduled_at || '') &&
    ((clean(appointment.calcom_booking_id) && clean(appointment.calcom_booking_id)===clean(meeting.calcom_booking_id)) ||
     (clean(appointment.google_event_id) && clean(appointment.google_event_id)===clean(meeting.calendar_uid)) ||
      (clean(appointment.meet_link) && clean(appointment.meet_link)===clean(meeting.meet_link)));
  // Negative classifications override the existence of any sales record.
  const declaredType = ['lesson','internal','support'].includes(meeting.type) ? meeting.type : null;
  const meetingType = evidence.lesson_found===true ? 'lesson' : declaredType || (sameOccurrence ? 'sales' : 'unknown');
  const transcriptStatus = evidence.transcription_failed===true ? 'failed' :
    typeof evidence.transcript==='string' && evidence.transcript.trim().length>=120 ? 'available' : 'unavailable';
  const technical = evidence.technical_failure===true || evidence.transcription_failed===true;
  const attendance = evidence.attendance || {};
  // Participant identity must come from an authoritative attendance feed, not speaker names or invitation lists.
  const attendanceReliable = attendance.source==='participant_events' && attendance.complete===true &&
    clean(attendance.meeting_id)===clean(meeting.id) && clean(attendance.lead_id)===people[0] &&
    clean(attendance.closer_email)===clean(appointment?.consultant_email) && Boolean(clean(attendance.closer_email));
  const attended = attendanceReliable && attendance.lead_joined===true && attendance.closer_joined===true;
  const absent = attendanceReliable && attendance.lead_joined===false && attendance.closer_joined===true &&
    attendance.observation_complete===true && Date.parse(attendance.observed_until || '') >= scheduled+15*60000 &&
    now >= scheduled+15*60000;
  const action = clean(input.action);
  const noShow = ['no_show','meeting_no_show','no_show_note'].includes(action);
  const allowedActions = ['attended','no_show','note','attachment','no_show_note','meeting_attended','meeting_completed','meeting_no_show'];
  const target = noShow ? STAGES.no_show : STAGES.attended;
  const initial = stageId(business);
  // Only scheduled -> attended/no_show. Child effects require the resulting stage already persisted.
  const stageAction = ['attended','no_show'].includes(action);
  const stageAllowed = stageAction ? initial===STAGES.scheduled : initial===target;
  if (existingStudent) reasons.push('BLOCKED_EXISTING_STUDENT');
  if (!checkedStudent) reasons.push('BLOCKED_INCOMPLETE_STUDENT_CHECK');
  if (!unique || !business || leadId(business)!==people[0] || related.filter(b=>norm(b.status)==='in_process'&&pipelineId(b)===SALES_PIPELINE).length!==1) reasons.push('BLOCKED_AMBIGUOUS_IDENTITY');
  if (meetingType!=='sales') reasons.push('BLOCKED_NON_SALES_MEETING');
  if (!sameOccurrence || !clean(appointment?.id)) reasons.push('BLOCKED_UNCONFIRMED_APPOINTMENT');
  if (!clean(meeting.id)) reasons.push('BLOCKED_MISSING_MEETING_ID');
  if (pipelineId(business)!==SALES_PIPELINE || norm(business?.status)!=='in_process' || !stageAllowed) reasons.push('BLOCKED_PROTECTED_TRANSITION');
  if (!allowedActions.includes(action)) reasons.push('BLOCKED_UNSUPPORTED_ACTION');
  if (technical || evidence.capture_health_confirmed!==true) reasons.push('BLOCKED_TECHNICAL_FAILURE');
  if (transcriptStatus!=='available' && !noShow) reasons.push('TRANSCRIPTION_UNAVAILABLE');
  if (!(noShow ? absent : attended)) reasons.push(noShow ? 'BLOCKED_ABSENCE_NOT_PROVEN' : 'BLOCKED_ATTENDANCE_NOT_PROVEN');
  if (!Number.isFinite(scheduled) || now<scheduled) reasons.push('BLOCKED_BEFORE_SCHEDULE');
  return { policy_version: VERSION, meeting_id: clean(meeting.id), recording_id: clean(meeting.recording_id)||null,
    person_id: unique?people[0]:null, lead_id: unique?people[0]:null, student_id: evidence.student_id||null,
    appointment_id: appointment?.id||null, meeting_type: meetingType, identity_confidence: unique?'exact':'ambiguous',
    identity_evidence: { method: appointment?.lead_id?'persisted_appointment':'exact_contact', candidates:people },
    is_existing_student: existingStudent ? true : checkedStudent ? false : null,
    sales_meeting_confirmed: Boolean(sameOccurrence), attendance_confirmed: attended, absence_confirmed: absent,
    transcript_status: transcriptStatus, technical_failure_detected: technical,
    previous_stage: initial||null, current_stage: initial||null, proposed_stage: target, final_stage: initial||null,
    proposed_action:action, action_allowed:reasons.length===0, commercial_action_allowed:reasons.length===0,
    block_reasons:[...new Set(reasons)], attendance_evidence: attendance, timestamp:new Date(now).toISOString() };
}
module.exports={VERSION,STAGES,SALES_PIPELINE,evaluateCommercialAction,exactPeople,studentEvidence,leadId,stageId,pipelineId};
