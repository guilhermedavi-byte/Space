const { isValidDateKey } = require('./commercial-time');
// SDR performance is activity (meeting/show), not deal revenue. Never infer
// a selling SDR from a closer, a tag, or a customer name.
function summarizeSdrEvents({events=[],indexes,week,eligiblePersonIds=[]}) {
  const eligible=new Set(eligiblePersonIds), seen=new Map(),included=[],excluded=[];
  for(const e of events){
    const id=String(e.id||e.firestoreDocId||'');
    const facts=JSON.stringify([e.dateKey,e.eventType,e.outcome,Boolean(e.deletedAt),e.sdrUid||'',String(e.sdrEmail||'').toLowerCase()]);
    if(id&&seen.has(id)){
      if(seen.get(id)!==facts)throw new Error('conflicting_duplicate_sdr_event');
      excluded.push({id,reason:'duplicate_event'});continue;
    }
    if(id)seen.set(id,facts);
    const reason=e.deletedAt?'deleted':e.eventType!=='meeting'||e.outcome!=='show'?'not_meeting_show':!isValidDateKey(e.dateKey)?'invalid_date':e.dateKey<week.startDateKey||e.dateKey>week.endDateKey?'outside_period':'';
    if(reason){excluded.push({id,reason});continue;}
    const personId=indexes.bySdrUid.get(e.sdrUid)||indexes.bySdrEmail.get(String(e.sdrEmail||'').toLowerCase())||null;
    included.push({id:id||null,personId:personId&&eligible.has(personId)?personId:null,resolvedPersonId:personId,dateKey:e.dateKey,
      reason:!personId?'unknown_or_inactive_sdr':!eligible.has(personId)?'sdr_not_configured':'attributed',value:1});
  }
  return {included,excluded,metrics:{total_meeting_shows:included.length,attributed:included.filter(r=>r.personId).length,
    unallocated_events:included.filter(r=>!r.personId).length,missing_event_ids:included.filter(r=>!r.id).length,duplicate_events:excluded.filter(r=>r.reason==='duplicate_event').length}};
}
// Certification requires explicit evidence per sale. Reading activity counts does
// not prove which SDR originated a sale; absent evidence is never inferred zero.
function reconcileSdrAttribution(rows, { status='not_loaded', evidence=[] }={}) {
  const byId=new Map(evidence.map(e=>[e.dealId,e]));
  const duplicateEvidence=new Set(evidence.filter((e,i)=>evidence.findIndex(x=>x.dealId===e.dealId)!==i).map(e=>e.dealId));
  const records=rows.map(row=>{
    const e=byId.get(row.id);
    const validEvidence=e&&typeof e.source==='string'&&e.source.length>0&&(e.sdrId===null||(typeof e.sdrId==='string'&&e.sdrId.length>0&&e.eventId&&Number.isFinite(Date.parse(e.timestamp))));
    const readStatus=status==='source_error'?'source_error':status!=='loaded'||!validEvidence?'not_loaded'
      :duplicateEvidence.has(row.id)?'source_error':e.sdrId===null?'no_attribution':'value';
    return {dealId:row.id,value:row.value,expectedSdr:e?.sdrId??null,calculatedSdr:row.sourceSdrId??null,
      origin:e?.source??null,event:e?.eventId??null,timestamp:e?.timestamp??null,status:readStatus,
      match:['value','no_attribution'].includes(readStatus)?(e.sdrId??null)===(row.sourceSdrId??null):null};
  });
  const loaded=status==='loaded'&&records.every(r=>r.match!==null);
  return {records,status:loaded?'loaded':status==='source_error'?'source_error':'not_loaded',
    coverage:loaded?(records.length?records.filter(r=>r.expectedSdr!==null).length/records.length*100:100):null,
    source_error_rate:status==='not_loaded'||records.some(r=>r.status==='not_loaded')?null:records.length?records.filter(r=>r.status==='source_error').length/records.length*100:status==='source_error'?100:0,
    unassigned_revenue:loaded?records.filter(r=>r.status==='no_attribution').reduce((s,r)=>s+r.value,0):null,
    reconciliation_delta:loaded?records.filter(r=>!r.match).reduce((s,r)=>s+Math.abs(r.value),0):null,
    pass:loaded&&records.every(r=>r.match)};
}
module.exports={summarizeSdrEvents,reconcileSdrAttribution};
