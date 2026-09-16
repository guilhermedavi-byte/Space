// User-approved legacy policy: preserve operational state, never infer historical dates.
const fs = require('node:fs');
const crypto = require('node:crypto');
const policy = require('../assets/student-lifecycle');
function prepare(users) {
  const selected = users.filter(row => row.tipo === 'student');
  if (selected.length !== 227 || new Set(selected.map(r=>r._document_id)).size!==227) throw Error('legacy_population_changed');
  const students=[], subscriptions=[];
  for (const row of selected) {
    const id=row._document_id, c=row.cancelamento || {};
    const active=row.ativo !== false;
    const evidence={legacy_backfill:true,legacy_needs_review:true,mode:'backfill',policy:'preserve_current_20260915',firestore_student_id:id,
      original_active:row.ativo,original_status:row.status??null,original_plan:row.plano||row.plan||null,original_cancellation:c,
      firestore_update_time:row._update_time||null,unknown_historical_dates:true};
    const student={firestore_student_id:id,full_name:row.nome||row.nomeCompleto||row.name||'Aluno',email:row.email||null,
      lifecycle_status:active?'active':'churned',pause_status:'none',source_system:'legacy_backfill',legacy_source:evidence,legacy_confidence:'high'};
    const sub={firestore_student_id:id,external_subscription_key:`legacy-preserved:${id}`,plan_name:row.plano||row.plan||null,billing_cycle:null,
      lifecycle_status:student.lifecycle_status,pause_status:'none',legacy_operational_suspended:!!c.aulasSuspensas,financial_status:'unknown',
      source_system:'legacy_backfill',legacy_source:evidence,legacy_confidence:'high',started_at:null,ended_at:null,scheduled_service_end_at:null,
      cancellation_requested_at:null,notice_started_at:null,last_active_date:null,churn_at:null};
    if (policy.isActiveOn(sub)!==active) throw Error('legacy_access_changed');
    if (active && !!c.aulasSuspensas === policy.canScheduleFor(sub,new Date())) throw Error('legacy_suspension_changed');
    students.push(student);subscriptions.push(sub);
  }
  return {mode:'backfill',dry_run:true,students,subscriptions,cases:[],events:[]};
}
if (require.main===module) {
  const [input,output]=process.argv.slice(2);const payload=prepare(JSON.parse(fs.readFileSync(input,'utf8')));
  fs.writeFileSync(output,JSON.stringify(payload),{mode:0o600});
  console.log(JSON.stringify({mode:payload.mode,students:payload.students.length,subscriptions:payload.subscriptions.length,
    active:payload.subscriptions.filter(r=>r.lifecycle_status==='active').length,
    preserved_inactive:payload.subscriptions.filter(r=>r.lifecycle_status==='churned').length,
    active_suspended:payload.subscriptions.filter(r=>r.lifecycle_status==='active'&&r.legacy_operational_suspended).length,
    plan_null:payload.subscriptions.filter(r=>r.plan_name===null).length,events:0,cases:0,
    sha256:crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex')}));
}
module.exports={prepare};
