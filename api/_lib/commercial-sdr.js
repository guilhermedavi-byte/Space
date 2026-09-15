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
module.exports={summarizeSdrEvents};
