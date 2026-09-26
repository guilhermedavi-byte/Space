'use strict';
const {createHash}=require('node:crypto');
const {supabaseFetch}=require('./supabase-rest');
const {sendInboxText}=require('./attendance-send-text');
const {dateKey,addDays}=require('./retention-health-engine');
const key=(id,kind)=>'risk_'+createHash('sha256').update(id+':'+kind).digest('hex').slice(0,40);
const phone=value=>require('../../src/international-phone/core').normalizePhoneToE164(value,{defaultCountry:'BR',preferCountry:true});
// Use the Activity module's same CAS/event writer, with deterministic IDs. No student/lifecycle mutation.
async function activityWrite({riskCase,student,kind,complete=false}) {
 const api=require('../activities');
 const id=key(riskCase.id,kind), document=await api.internal.readDocument('activities',id);
 if(complete) {
  if(!document || document.row.status==='Feito' || document.row.isArchived) return id;
 } else if(document) return id;
 const patch=complete?{status:'Feito',outcome:'no_response'}:{
  titulo:kind==='check_response'?`Conferir resposta de ${student.nome}`:`Ligar para ${student.nome} — 3 faltas consecutivas`,
  tipo:'Retenção',studentId:student.student_id,risk_case_id:riskCase.id,status:'Pendente',
  prioridade:kind==='call'?'Alta':'Média',prazo:addDays(dateKey(new Date()),1),
  descricao:'Ação de acompanhamento do caso de faltas. A conclusão da ação não encerra o caso.',criadoPor:'retention-health-job',criadoEm:new Date().toISOString(),responsavelId:null};
 try {await api.internal.commitActivity({id,document,patch,session:{sub:'retention-health-job',name:'Retenção automática'}});}
 catch(e){if(e.status!==409)throw e;const existing=await api.internal.readDocument('activities',id);if(!existing || (complete&&existing.row.status!=='Feito'))throw e;}
 return id;
}
function createAutomation({request=supabaseFetch,send=sendInboxText,writeActivity=activityWrite}={}) {
 const rpc=async(name,body)=>(await request('/rpc/'+name,{method:'POST',body})).data;
 const finish=(id,state,result)=>request('/retention_risk_actions?id=eq.'+id,{method:'PATCH',body:{state,result,updated_at:new Date().toISOString()}});
 async function action(c,kind,fn,{retrySafe=false}={}) {
  const claim=await rpc('retention_risk_claim',{p_case:c.id,p_kind:kind});
  let a=claim.action;
  if(!claim.claimed) {
   if(!retrySafe)return;
   a=(await request(`/retention_risk_actions?risk_case_id=eq.${c.id}&kind=eq.${kind}&select=*`)).data?.[0];
   if(!a||['done','sent','skipped'].includes(a.state))return;
  }
  try {const result=await fn();await finish(a.id,result.status==='sent'?'sent':result.skipped?'skipped':'done',result);}
  catch(e){await finish(a.id,e.uncertain?'unknown':'failed',{error:String(e.code||e.message||'failed').slice(0,120),message_id:e.message_id||null,conversation_id:e.conversation_id||null});}
 }
 async function sendFor(student,c,users,template) {
  const user=users.find(u=>(u.firestoreDocId||u.id)===student.student_id);
  const canonicalPhone=phone(user?.telefone||user?.phone||user?.whatsapp||user?.celular);
  if(!/^\+[1-9]\d{7,14}$/.test(canonicalPhone))throw Error('canonical_phone_missing');
  const links=(await request('/conversation_participants?select=conversation_id&resolution_state=eq.linked&internal_person_type=eq.student&internal_person_id=eq.'+encodeURIComponent(student.student_id))).data||[];
  const ids=[...new Set(links.map(l=>l.conversation_id))];
  if(!ids.length)throw Error('inbox_conversation_not_linked');
  const convs=(await request(`/conversations?select=*&conversation_id=in.(${ids.join(',')})&status=neq.resolved&order=last_message_at.desc.nullslast`)).data||[];
  if(convs.length!==1)throw Error(convs.length?'inbox_conversation_ambiguous':'inbox_conversation_unavailable');
  const conv=convs[0];
  const members=(await request('/team_members?select=user_uid&active=eq.true&team_id=eq.'+conv.team_id)).data||[];
  // Choose an existing enabled team member with a verified admin profile. Never invent an auth principal.
  const enabled=(await request('/attendance_members?select=user_uid&enabled=eq.true')).data||[];
  const admin=users.find(u=>['admin','administrador','coord','coordenacao'].includes(String(u.tipo||u.role).toLowerCase()) && members.some(m=>m.user_uid===(u.firestoreDocId||u.id)) && enabled.some(m=>m.user_uid===(u.firestoreDocId||u.id)));
  if(!admin)throw Error('inbox_authorized_operator_unavailable');
  const result=await send({actor:{uid:admin.firestoreDocId||admin.id,role:'admin'},conversationId:conv.conversation_id,canonicalPhone,
   text:template.replaceAll('{primeiro_nome}',student.nome.split(/\s+/)[0]),clientRequestId:key(c.id,'whatsapp')});
  if(result.status!=='sent')throw Object.assign(Error('send_unconfirmed'),{uncertain:true,message_id:result.message_id,conversation_id:conv.conversation_id});
  return result;
 }
 return async function run({rows,users}) {
  const stats={observed:0,errors:0};
  const eligible=rows.filter(r=>r.is_active&&r.signals.latest_observed_at);
  if(!eligible.length)return stats;
  const template=(await request('/retention_health_settings?select=absence_message&id=eq.admin_v0')).data?.[0]?.absence_message;
  for(const student of eligible) {
   try {
    const s=student.signals;
    const c=await rpc('retention_risk_observe',{p_student:student.student_id,p_sequence:s.absence_sequence_id,p_streak:s.student_absence_streak,p_observed_at:s.latest_observed_at});
    if(!c?.id)continue;
    stats.observed++;
    if(c.status!=='open')continue;
    if(c.current_streak===2) {
     await action(c,'whatsapp',()=>sendFor(student,c,users,template));
     await action(c,'check_response',async()=>({activity_id:await writeActivity({riskCase:c,student,kind:'check_response'})}),{retrySafe:true});
    }
    if(c.current_streak>=3) {
     await action(c,'close_no_response',async()=>{
      const sent=(await request(`/retention_risk_actions?risk_case_id=eq.${c.id}&kind=eq.whatsapp&select=*`)).data?.[0];
      // An unavailable conversation is unknown, never proof that a student did not reply.
      if(!sent?.result?.conversation_id || sent.state!=='sent')return {skipped:true,reason:'no_confirmed_contact'};
      const conv=(await request('/conversations?select=last_inbound_at&conversation_id=eq.'+sent.result.conversation_id)).data?.[0];
      if(!conv)throw Error('reply_state_unavailable');
      if(conv.last_inbound_at && new Date(conv.last_inbound_at)>=new Date(sent.created_at))return {skipped:true,reason:'student_replied'};
      return {activity_id:await writeActivity({riskCase:c,student,kind:'check_response',complete:true}),outcome:'no_response'};
     },{retrySafe:true});
     await action(c,'call',async()=>({activity_id:await writeActivity({riskCase:c,student,kind:'call'})}),{retrySafe:true});
    }
   }catch(e){stats.errors++;console.warn('[retention-risk]',{code:String(e.code||e.message).slice(0,80)});}
  }
  return stats;
 };
}
module.exports={createAutomation,runAbsenceAutomation:createAutomation(),key,phone};
