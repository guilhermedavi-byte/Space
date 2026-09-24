'use strict';
const {supabaseFetch}=require('./supabase-rest');
const OUTCOMES=['resolved','contacted','no_response','needs_followup','student_recovered','escalated'];
const CATEGORIES=['teacher','schedule','pedagogical','service','financial','progress_perception','complaint','other'];
const SEVERITIES=['light','moderate','high','critical'];
const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
const invalid=code=>{throw Object.assign(Error(code),{status:400});};
function completionPatch(existing,patch,body,session) {
 const next={...existing,...patch};
 const relevant=Boolean(next.risk_case_id)||norm(next.tipo)==='retencao';
 const quality=norm(next.tipo)==='ligacao de qualidade';
 if((existing.risk_case_id||existing.qualityPulse)&&next.studentId!==existing.studentId)invalid('health_student_link_locked');
 if(next.status!=='Feito')return {};
 if(!relevant&&!quality)return {};
 if(!next.studentId)invalid('health_student_required');
 const outcome=body.outcome||existing.outcome;
 if(relevant&&!OUTCOMES.includes(outcome))invalid('retention_outcome_required');
 const result=outcome?{outcome}:{};
 if(quality) {
  if(existing.qualityPulse)return {...result,qualityPulse:existing.qualityPulse};
  const p=body.qualityPulse;
  if(!p)invalid('quality_pulse_required');
  const pulse={};
  for(const k of ['general_satisfaction','teacher_satisfaction','perceived_progress','schedule_fit','nps']) {
   if(!Number.isInteger(p[k])||p[k]<(k==='nps'?0:1)||p[k]>(k==='nps'?10:5))invalid('invalid_quality_pulse');
   pulse[k]=p[k];
  }
  if(!['normal','doubts','considering_exit','wants_to_cancel'].includes(p.continuation_intent))invalid('invalid_quality_intent');
  result.qualityPulse={...pulse,continuation_intent:p.continuation_intent,caller_id:session.sub,called_at:new Date().toISOString(),comment_id:p.comment_id||null};
 }
 return result;
}
async function projectQuality(activity,request=supabaseFetch) {
 if(activity.status!=='Feito'||!activity.qualityPulse||!activity.studentId)return;
 const p=activity.qualityPulse;
 await request('/student_quality_pulses?on_conflict=activity_id',{method:'POST',headers:{Prefer:'resolution=ignore-duplicates,return=minimal'},body:{...p,student_id:activity.studentId,activity_id:activity.id}});
}
async function markOccurrence({activity,comment,body,session},request=supabaseFetch) {
 if(!activity.studentId||!comment?.body||comment.deletedAt)invalid('occurrence_comment_required');
 if(!CATEGORIES.includes(body.category)||!SEVERITIES.includes(body.severity))invalid('invalid_occurrence');
 const {data}=await request('/student_occurrences?on_conflict=activity_id,comment_id',{method:'POST',headers:{Prefer:'resolution=ignore-duplicates,return=representation'},body:{
  student_id:activity.studentId,activity_id:activity.id,comment_id:comment.id,risk_case_id:activity.risk_case_id||null,
  category:body.category,severity:body.severity,description:comment.body,source:'activity_comment',opened_by:session.sub,
  metadata:{episode_id:activity.id+':'+comment.id}
 }});
 return data?.[0]||null;
}
module.exports={completionPatch,projectQuality,markOccurrence,OUTCOMES};
