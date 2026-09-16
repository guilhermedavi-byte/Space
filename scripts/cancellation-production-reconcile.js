// Offline, read-only reconciliation. Never loads credentials or contacts a provider.
// node scripts/cancellation-production-reconcile.js input-manifest.json output-directory
// Manifest: { firestoreUsers: array|null, subscriptions: array, pedagogicalRows: array,
//             sourceMetadata: object }. Null users means incomplete, never an empty base.
const fs=require('node:fs');
const path=require('node:path');
const {createHash}=require('node:crypto');
const {buildLegacyRetentionImportSnapshot}=require('../api/_lib/retention-import');
const anon=id=>createHash('sha256').update(String(id)).digest('hex').slice(0,16);
function reconcile(input){
 const users=input.firestoreUsers;
 const records=[];
 const references=new Map();
 for(const row of input.pedagogicalRows||[]){if(!row.aluno_id)continue;const id=String(row.aluno_id);references.set(id,(references.get(id)||0)+1);}
 if(!Array.isArray(users)){
  for(const [id,count] of references)records.push({identifier:anon(id),source:'pedagogical_student_reference',classification:'AMBIGUOUS',reason:'firestore_export_unavailable',conflicting_data:{pedagogical_rows:count,canonical_subscriptions:(input.subscriptions||[]).filter(s=>s.firestore_student_id===id).length},manual_action:'Export Firestore users and dated lifecycle history; do not infer active status, notice or churn from lessons.'});
 }else{
  for(const user of users){
   const snapshot=buildLegacyRetentionImportSnapshot({users:[user],dryRun:true});
   if(!snapshot.payload.students.length && !snapshot.report.exceptions.length)continue;
   const reasons=snapshot.report.exceptions.map(e=>e.reason);
   const imported=snapshot.payload.students[0];
   const id=user.firestoreDocId||user.id;
   const canonical=(input.subscriptions||[]).filter(s=>s.firestore_student_id===id);
   if(imported && canonical.length===1 && canonical[0].lifecycle_status!==imported.lifecycle_status)reasons.push('conflicting_canonical_status');
   const classification=reasons.some(r=>/conflict/.test(r))?'CONFLICT':reasons.some(r=>/invalid|before_request/.test(r))?'INVALID':reasons.length?'AMBIGUOUS':imported?'SAFE':'AMBIGUOUS';
   records.push({identifier:anon(id),source:'firestore_user',classification,reason:reasons.join('|')||'deterministic_import_candidate',conflicting_data:snapshot.report.exceptions.map(e=>e.conflicting_data),manual_action:classification==='SAFE'?'Review deterministic dry-run payload before applying.':'Reconcile original dated history; no automatic backfill.'});
  }
 }
 const counts={total:records.length,SAFE:0,AMBIGUOUS:0,CONFLICT:0,INVALID:0};for(const row of records)counts[row.classification]++;
 return {records,summary:{...counts,complete:Array.isArray(users),scope:Array.isArray(users)?'Firestore lifecycle candidates':'Partial: distinct pedagogical student references; NOT a census of Firestore users',sourceMetadata:input.sourceMetadata||{},mutations:false}};
}
if(require.main===module){
 const [source,out]=process.argv.slice(2);if(!source||!out)throw Error('usage: input-manifest.json output-directory');
 const result=reconcile(JSON.parse(fs.readFileSync(source,'utf8')));fs.mkdirSync(out,{recursive:true});
 const columns=['identifier','source','classification','reason','conflicting_data','manual_action'];
 const cell=x=>'"'+String(typeof x==='object'?JSON.stringify(x):x??'').replaceAll('"','""')+'"';
 fs.writeFileSync(path.join(out,'reconciliation.csv'),[columns.join(','),...result.records.map(r=>columns.map(k=>cell(r[k])).join(','))].join('\n')+'\n');
 fs.writeFileSync(path.join(out,'reconciliation-summary.json'),JSON.stringify(result.summary,null,2)+'\n');console.log(JSON.stringify(result.summary));
}
module.exports={reconcile};
