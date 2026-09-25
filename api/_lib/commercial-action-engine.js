const crypto=require('node:crypto');
const {supabaseFetch}=require('./supabase-rest');
const {evaluateCommercialAction,STAGES,leadId,stageId,studentEvidence}=require('./commercial-action-policy');
const clean=v=>String(v??'').trim(); const enc=v=>encodeURIComponent(clean(v));
const rows=r=>Array.isArray(r?.data)?r.data:[];
const uuid=v=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clean(v));
const error=code=>Object.assign(new Error(code),{code});
async function crmRequest(path,options={}) {
 const base=clean(process.env.CRM_API_BASE_URL).replace(/\/+$/,'');const key=clean(process.env.CRM_API_KEY).replace(/^Bearer\s+/i,'');
 if(!base.startsWith('https://')||!key||key==='[SENSITIVE]')throw error('CRM_NOT_CONFIGURED');
 const r=await fetch(`${base}/api/v1${path}`,{method:options.method||'GET',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:options.body?JSON.stringify(options.body):undefined,redirect:'error',signal:AbortSignal.timeout(12000)}).catch(()=>{throw error('CRM_TRANSPORT_FAILED');});
 if(!r.ok)throw error(`CRM_HTTP_${r.status}`);
 const text=await r.text();try{return text?JSON.parse(text):{};}catch{throw error('CRM_INVALID_RESPONSE');}
}
async function allBusinesses(crm){
 const out=[];const seen=new Set();
 for(let skip=0;skip<50000;skip+=500){
  const r=await crm(`/businesses?take=500&skip=${skip}`);
  const page=Array.isArray(r)?r:r.data||r.businesses||r.items;
  if(!Array.isArray(page))throw error('CRM_INCOMPLETE_LOOKUP');
  for(const b of page){if(!b?.id||seen.has(b.id))throw error('CRM_PAGINATION_UNRELIABLE');seen.add(b.id);out.push(b);}
  if(page.length<500)return out;
 }
 throw error('CRM_LOOKUP_LIMIT');
}
async function executeCommercialAction(body,{request=supabaseFetch,crm=crmRequest,now=Date.now}={}){
 const meeting=body.meeting||{}; const action=clean(body.action); const businessId=clean(body.business_id);
 if(!/^[\w-]{1,128}$/.test(clean(meeting.id))||!action)throw error('INVALID_EVENT');
 const key=crypto.createHash('sha256').update(`vexa:${meeting.id}:${action}`).digest('hex');
 let decision;
 const record=async d=>(await request('/rpc/claim_commercial_action',{method:'POST',body:{p_key:key,p_event:clean(body.event_id)||null,p_meeting:clean(meeting.id),p_business:uuid(businessId)?businessId:null,p_action:action,p_decision:d}})).data;
 try{
  const businesses=await allBusinesses(crm);
  let appointment=null;
  const scheduled=Date.parse(meeting.scheduled_at||'');
  if(Number.isFinite(scheduled)){
   const explicit=clean(meeting.calcom_booking_id)?`calcom_booking_id=eq.${enc(meeting.calcom_booking_id)}`:clean(meeting.calendar_uid)?`google_event_id=eq.${enc(meeting.calendar_uid)}`:clean(meeting.meet_link)?`meet_link=eq.${enc(meeting.meet_link)}`:null;
   if(explicit){const candidates=rows(await request(`/sdr_meetings?select=*&${explicit}&starts_at=eq.${enc(new Date(scheduled).toISOString())}&limit=2`));if(candidates.length===1)appointment=candidates[0];}
  }
  const business=businesses.find(b=>clean(b.id)===businessId)||null;
  const contact=business?.lead||{};
  const emails=[contact.email,...(contact.contacts||[]).filter(c=>c.platform==='EMAIL').map(c=>c.contactId)].map(v=>clean(v).toLowerCase()).filter(Boolean);
  const phones=[contact.phone,...(contact.contacts||[]).filter(c=>['PHONE','SMS','WHATSAPP'].includes(c.platform)).map(c=>c.contactId)].map(v=>clean(v).replace(/\D/g,'')).filter(v=>v.length>=8);
  const {data:student}=await request('/rpc/commercial_student_evidence',{method:'POST',body:{p_person:leadId(business),p_emails:emails,p_phones:phones,p_room:clean(meeting.meet_link),p_start:Number.isFinite(scheduled)?new Date(scheduled).toISOString():null}});
  const evidence={...(body.evidence||{}),...student,crm_lookup_complete:true};
  decision=evaluateCommercialAction({meeting,appointment,business,businesses,evidence,action,explicitLeadId:body.lead_id},now());
  decision.event_id=clean(body.event_id)||null;decision.workflow_version=clean(body.workflow_version)||'VEXACOMV7SPACE01';
  if(body.preview===true){await record({...decision,action_allowed:false,preview:true});return {ok:true,preview:true,decision};}
  const claim=await record(decision);
  if(!decision.action_allowed||claim?.claimed!==true)return {ok:true,performed:false,decision,claim};
  const finish=async(status,code,finalStage)=>request(`/commercial_action_claims?action_key=eq.${key}`,{method:'PATCH',body:{status,result_code:code,final_stage:finalStage||null,updated_at:new Date(now()).toISOString()}});
  try{
   // Re-read immediately before the side effect. Never reuse the decision snapshot for a write.
   const freshRaw=await crm(`/businesses/${enc(businessId)}`);const fresh=freshRaw?.data?.id?freshRaw.data:freshRaw;
   if(studentEvidence([fresh])||clean(fresh.id)!==businessId||stageId(fresh)!==decision.previous_stage||clean(fresh.status)!==clean(business.status)||leadId(fresh)!==leadId(business)){
    await finish('blocked','BLOCKED_STATE_CONFLICT',stageId(fresh));return {ok:true,performed:false,decision:{...decision,action_allowed:false,block_reasons:['BLOCKED_STATE_CONFLICT']}};
   }
   let result={};
   if(['attended','no_show'].includes(action))result=await crm(`/businesses/${enc(businessId)}`,{method:'PATCH',body:{stageId:decision.proposed_stage}});
   else if(action==='note'){
    if(!clean(body.note)||clean(body.note).length>50000)throw error('INVALID_NOTE');
    result=await crm(`/leads/${enc(decision.lead_id)}/notes`,{method:'POST',body:{note:body.note}});
   }else if(action==='attachment'){
    const url=new URL(body.attachment?.url||'');if(url.protocol!=='https:'||!['drive.google.com','docs.google.com'].includes(url.hostname))throw error('INVALID_ATTACHMENT');
    result=await crm(`/leads/${enc(decision.lead_id)}/attachments`,{method:'POST',body:{attachmentUrl:url.href,fileName:clean(body.attachment.name),fileSize:Number(body.attachment.size)||0,description:'Relatório da reunião comercial'}});
   }else if(action==='no_show_note'){
    if(!uuid(appointment.conversation_id))throw error('MISSING_CONVERSATION');
    result=await crm(`/conversations/${enc(appointment.conversation_id)}/messages`,{method:'POST',body:{body:'Ausência verificada por evidências de participação. Decisão auditada pela Space.',isInternal:true}});
   }else if(['meeting_attended','meeting_no_show','meeting_completed'].includes(action)){
    result=(await request(`/sdr_meetings?id=eq.${enc(appointment.id)}`,{method:'PATCH',body:{status:action.replace('meeting_',''),...(['meeting_attended','meeting_completed'].includes(action)?{completed_at:new Date(now()).toISOString()}:{}),updated_at:new Date(now()).toISOString()}})).data;
   }else throw error('UNSUPPORTED_ACTION');
   await finish('sent','SUCCESS',['attended','no_show'].includes(action)?decision.proposed_stage:decision.previous_stage);
   return {ok:true,performed:true,decision,result};
  }catch(e){await finish('uncertain',/^[A-Z0-9_]+$/.test(e.code||'')?e.code:'REMOTE_RESULT_UNKNOWN',null);throw e;}
 }catch(e){
  if(!decision){await record({action_allowed:false,block_reasons:['BLOCKED_SOURCE_UNAVAILABLE'],workflow_version:body.workflow_version||null,timestamp:new Date(now()).toISOString()});}
  throw e;
 }
}
module.exports={executeCommercialAction,allBusinesses,crmRequest};
