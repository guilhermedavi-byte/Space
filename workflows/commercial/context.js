// Executed inside n8n with data from authenticated Vexa/CRM read nodes.
function resolveContext(key, appointments, businesses) {
 const clean=v=>String(v??'').trim();const email=v=>clean(v).toLowerCase();const phone=v=>clean(v).replace(/\D/g,'');
 const scheduled=key.vexa_data?.scheduled_at||key.starts_at;
 const rows=appointments.filter(r=>Date.parse(r.starts_at)===Date.parse(scheduled)&&r.meet_link===key.meet_link);
 const appointment=rows.length===1?rows[0]:null;
 const attendees=key.vexa_attendees||[];
 const candidates=businesses.filter(b=>{
  if(appointment?.lead_id)return clean(b.leadId||b.lead?.id)===clean(appointment.lead_id);
  const emails=[b.lead?.email,...(b.lead?.contacts||[]).filter(c=>c.platform==='EMAIL').map(c=>c.contactId)].map(email).filter(Boolean);
  const phones=[b.lead?.phone,...(b.lead?.contacts||[]).filter(c=>['PHONE','WHATSAPP','SMS'].includes(c.platform)).map(c=>c.contactId)].map(phone).filter(x=>x.length>=8);
  return attendees.some(a=>(a.email&&emails.includes(email(a.email)))||(a.phone&&phones.includes(phone(a.phone))));
 });
 const people=[...new Set(candidates.map(b=>clean(b.leadId||b.lead?.id)).filter(Boolean))];
 const open=candidates.filter(b=>b.status==='in_process'&&(b.stage?.pipeline?.id||b.stage?.pipelineId||b.pipelineId)==='8838d57c-6fd8-417d-8b55-dad46fec87f1');
 // Do not select an arbitrary business when several records are eligible.
 const business=people.length===1&&open.length===1?open[0]:null;
 return {...key,sdr_meeting:appointment,appointment_id:appointment?.id||null,sdr_found:!!appointment,
  starts_at:scheduled||null,lead_id:people.length===1?people[0]:null,business_id:business?.id||null,
  business_found:!!business,business_stage_id:business?.stageId||business?.stage?.id||null,
  business_status:business?.status||null,lead_name:business?.lead?.name||null,lead_phone:business?.lead?.phone||null,
  consultant_email:appointment?.consultant_email||null,consultant_name:appointment?.consultant_name||null,
  closer_name_planned:appointment?.consultant_name||'Não confirmado',closer_name_resolved:'Não confirmado',
  current_attendant_id:business?.attendantId||null,attendant_id_target:null,conversation_id:appointment?.conversation_id||null,
  fallback_match:false,fallback_match_score:null,can_auto_stage:false};
}
