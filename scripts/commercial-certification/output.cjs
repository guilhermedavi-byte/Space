// Explicit output projection: never serialize raw input, errors or engine objects.
const sum=(rows,key='value')=>Math.round(rows.reduce((s,r)=>s+(Number(r[key])||0),0)*100)/100;
const DIFF={missing_deal:'missing',unexpected_deal:'extra',duplicate_deal:'duplicated',wrong_week:'wrong_week',value_difference:'wrong_amount',responsibleId_difference:'wrong_closer',resolvedPersonId_difference:'wrong_closer',sourceResponsibleId_difference:'wrong_closer',sourceSdrId_difference:'wrong_sdr',status_difference:'wrong_status',dateKey_difference:'wrong_revenue_timestamp',dateField_difference:'wrong_revenue_timestamp',closingDate_difference:'wrong_revenue_timestamp',role_difference:'wrong_closer',competencia_difference:'wrong_week',unverifiable_fields:'unverifiable'};
const rows=r=>(r||[]).map(d=>({dealId:d.id,reference:d.number==null?null:String(d.number),amount:d.value,revenueRecognitionTimestamp:d.closingDate||null,revenueRecognitionField:d.dateField||null,month:d.competencia||null,week:d.weekKey||null,status:d.status||null,closerId:d.responsibleId||null,sdrId:d.sourceSdrId||null,sourcePages:d.sourcePages||[]}));
const comparison=c=>({available:c?.available===true,pass:c?.pass===true,dealIdDelta:c?.available?new Set((c.differences||[]).map(d=>d.id)).size:null,differences:(c?.differences||[]).map(d=>({dealId:d.id,classification:DIFF[d.type]||'unverifiable'}))});
function project(audit,input,counts){
  const months={};
  const {summarizeClosedSales,getBusinessClosingDate}=require('../../api/_lib/commercial-sales');
  for(const [key,m] of Object.entries(audit.months)){
    const l=m.ledger,metric=m.metrics,sdr=m.sdrAttribution,ss=sdr.records;
    const sourceSales=summarizeClosedSales({businesses:input.businesses,period:l.period});
    const sourceRows=sourceSales.sales.map(s=>({id:s.id,value:s.value,closingDate:getBusinessClosingDate(s.business).date.toISOString(),dateKey:s.dateKey,dateField:s.dateField}));
    const sourceComparison=require('../../api/_lib/commercial-reconciliation').compareDealLedgers(sourceRows,l.rows,{fields:['value','dateKey','dateField'],attribution:false});
    const states=Object.fromEntries(['value','no_attribution','source_error','not_loaded'].map(k=>[k,ss.filter(r=>r.status===k)]));
    const other=l.rows.filter(r=>r.responsibleId==='outros'),named=l.rows.filter(r=>r.responsibleId&&r.responsibleId!=='outros'),none=l.rows.filter(r=>!r.responsibleId);
    const closerCertified=metric.orphan_deals===0&&sum(named)+sum(other)===metric.monthly_realized;
    months[key]={sourceDealCount:sourceSales.count,sourceRevenue:sourceSales.actualValue,monthlyDealCount:metric.deals,monthlyRevenue:metric.monthly_realized,weeklyDealCount:l.weekly.reduce((s,w)=>s+w.rows.length,0),weeklyRevenue:metric.weekly_realized,monthlyWeeklyFinancialDelta:metric.monthly_weekly_delta,monthlyWeeklyDealIdDelta:comparison(m.monthlyWeekly).dealIdDelta,duplicateDealCount:metric.duplicate_attributions,duplicateRevenue:metric.duplicate_attribution_revenue,unallocatedDealCount:metric.orphan_deals,unallocatedRevenue:metric.unallocated_revenue,
      period:{start:l.period.startDateKey,end:l.period.endDateKey},snapshotStatus:m.snapshotAssessment.status,snapshotFinancialDelta:m.snapshotAssessment.delta,snapshotDealIdDelta:comparison(m.snapshotComparison).dealIdDelta,overlappingPeriods:metric.overlapping_periods,duplicateAttributionRevenue:metric.duplicate_attribution_revenue,
      sets:{source:rows(sourceRows),canonicalMonthly:rows(l.rows),canonicalWeekly:rows(l.weekly.flatMap(w=>w.rows)),crmLive:rows(m.sets.CRM_LIVE_DEALS),commercialGoals:rows(m.sets.GOALS_DEALS),storedSnapshot:m.sets.SNAPSHOT_DEALS?rows(m.sets.SNAPSHOT_DEALS):null},
      comparisons:{sourceMonthly:comparison(sourceComparison),monthlyWeekly:comparison(m.monthlyWeekly),crmLiveGoals:comparison(m.crmGoals),goals:comparison(m.managementComparison),storedSnapshot:comparison(m.snapshotComparison)},
      sdr:{sdrTotalDeals:ss.length,sdrAttributedDeals:states.value.length,sdrNoAttributionDeals:states.no_attribution.length,sdrSourceErrorDeals:states.source_error.length,sdrNotLoadedDeals:states.not_loaded.length,sdrAttributionCoverage:sdr.coverage,sdrSourceErrorRate:sdr.source_error_rate,sdrAttributedRevenue:sum(states.value),sdrNoAttributionRevenue:sum(states.no_attribution),sdrNotLoadedRevenue:sum(states.not_loaded),sdrFinancialDelta:sdr.reconciliation_delta,certified:sdr.pass,records:ss.map(r=>({dealId:r.dealId,state:r.status,amount:r.value,expectedSdrId:r.expectedSdr,calculatedSdrId:r.calculatedSdr,eventId:r.event,timestamp:r.timestamp}))},
      closer:{closerTotalDeals:l.rows.length,closerAttributedDeals:named.length,closerOtherDeals:other.length,closerUnassignedDeals:none.length,closerAttributedRevenue:sum(named),closerOtherRevenue:sum(other),closerUnassignedRevenue:sum(none),closerFinancialDelta:Math.round((metric.monthly_realized-sum(named)-sum(other)-sum(none))*100)/100,certified:closerCertified}};
  }
  const {assessStoredSnapshot}=require('../../api/_lib/crm-snapshot-publish');
  const snapshots=[];
  for(const record of input.snapshotRecords||[]){
    const p=record.payload,key=p?.month?.period?.monthKey;if(!months[key])continue;
    for(const scope of ['month','week']){
      const period=scope==='month'?audit.months[key].ledger.period:p.weekly?.commercialWeek;
      if(!period?.startDateKey||!period?.endDateKey){snapshots.push({scope,period:key,status:'INVALID'});continue;}
      // Existing snapshots are compared to canonical rows from the matching period.
      const periods=Object.values(audit.months).map(m=>m.ledger.period);
      if(period.startDateKey<periods[0].startDateKey||period.endDateKey>periods.at(-1).endDateKey){snapshots.push({scope,period:key,status:'INVALID'});continue;}
      const canonical=Object.values(audit.months).flatMap(m=>m.ledger.rows).filter(d=>d.dateKey>=period.startDateKey&&d.dateKey<=period.endDateKey);
      const unique=[...new Map(canonical.map(r=>[r.id,r])).values()];
      const assessment=assessStoredSnapshot(p,unique,scope);
      snapshots.push({snapshotId:record.firestoreDocId||record.id||p.snapshot?.snapshotId||null,scope,period:period.startDateKey+'_'+period.endDateKey,generatedAt:assessment.generated_at,storedDealCount:assessment.deal_count,storedRevenue:assessment.revenue,canonicalDealCount:unique.length,canonicalRevenue:assessment.canonical_revenue,dealIdDelta:comparison(assessment.comparison).dealIdDelta,financialDelta:assessment.delta,status:assessment.status});
    }
  }
  const auditNumbers=['11396','11296','8895','7580'];
  const unresolvedBusinessNumbers=auditNumbers.filter(n=>!audit.weekly.rows.some(r=>String(r.number)===n));
  const all=Object.values(months),writesAttempted=counts.firestoreWritesAttempted+counts.datacrazyMutationsAttempted+counts.snapshotWritesAttempted;
  const sdrCertified=all.every(m=>m.sdr.certified&&m.sdr.sdrNotLoadedDeals===0&&m.sdr.sdrSourceErrorDeals===0),closerCertified=all.every(m=>m.closer.certified);
  const result={certification:audit.certified&&unresolvedBusinessNumbers.length===0&&all.every(m=>m.comparisons.sourceMonthly.pass)&&sdrCertified&&closerCertified&&writesAttempted===0&&counts.blockedRequests===0?'PASS':'FAIL',authenticatedSourceLoaded:audit.sourceComplete,firestoreLoaded:true,datacrazyLoaded:audit.sourceComplete,financialDelta:sum(all,'monthlyWeeklyFinancialDelta'),dealIdDelta:all.every(m=>m.monthlyWeeklyDealIdDelta!==null)?sum(all,'monthlyWeeklyDealIdDelta'):null,duplicateRevenue:sum(all,'duplicateRevenue'),unallocatedRevenue:sum(all,'unallocatedRevenue'),sdrCertified,closerCertified,writesAttempted,counters:{...counts},
    source:{pages:input.source.pagesFetched,expectedPages:input.source.expectedPages,dealCount:input.source.recordsFetched,retries:input.source.retryCount,rateLimits:input.source.datacrazy429Count,complete:input.source.fetchCompleted&&input.source.paginationCompleted,retryDetails:input.retries||[]},months,snapshots,
    historicalTargets:{august11:rows(audit.months['2026-08'].ledger.rows.filter(r=>r.dateKey==='2026-08-11')),septemberWeek:{previousStored:8385,previousExpected:12646,previousDelta:4261,currentCanonical:audit.weekly.actualValue,currentStored:audit.weekly.oldSnapshotValue,unresolvedBusinessNumbers,targets:auditNumbers.map(reference=>{const row=audit.weekly.rows.find(r=>String(r.number)===reference);return row?{...rows([row])[0],included:true,reason:'canonical_closed_sale_in_week',sdrState:months['2026-09'].sdr.records.find(r=>r.dealId===row.id)?.state||'not_loaded'}:{reference,dealId:null,included:false,reason:'not_found_in_canonical_week'};})}}};
  result.firestore={users:input.users.length,growthPeople:input.growthPeople.length,sdrActivityEvents:input.sdrEvents.length,snapshotRecords:(input.snapshotRecords||[]).length};
  result.sdrEvidence={businessesWithExplicitNull:input.businesses.filter(b=>Object.hasOwn(b,'sdrId')&&b.sdrId===null).length,businessesWithEventLink:input.businesses.filter(b=>!!b.sdrEventId).length,eventsWithBusinessLink:input.sdrEvents.filter(e=>!!(e.dealId||e.businessId)).length,verifiedEvidence:input.sdrAttribution?.evidence?.length??0};
  return result;
}
function sanitize(value,secrets=new Set()){
  const walk=v=>{
    if(v===null||typeof v==='boolean')return v;
    if(typeof v==='number'){if(!Number.isFinite(v))throw new Error('unsafe_output');return v;}
    if(typeof v==='string'){
      if(/^[+\d () .-]+$/.test(v)&&(v.match(/\d/g)||[]).length>=10)throw new Error('unsafe_output');
      if(v.length>160||/@|https?:|Bearer\s|PRIVATE KEY|eyJ[A-Za-z0-9_-]+\./i.test(v)||[...secrets].some(s=>s.length>=8&&v.includes(s)))throw new Error('unsafe_output');
      if(!/^[\p{L}\p{N}_.:+\- /]*$/u.test(v))throw new Error('unsafe_output');return v;
    }
    if(Array.isArray(v))return v.map(walk);
    if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).map(([k,val])=>{if(/email|phone|address|cookie|authorization|private.?key|access.?token|refresh.?token|password|secret|fullName|displayName|^name$|headers|^raw$|^lead$/i.test(k))throw new Error('unsafe_output');return [k,walk(val)];}));
    throw new Error('unsafe_output');
  };
  return walk(value);
}
function failure(counts,loaded={},code='audit_failed'){
  return {certification:'FAIL',authenticatedSourceLoaded:false,firestoreLoaded:!!loaded.firestoreLoaded,datacrazyLoaded:!!loaded.datacrazyLoaded,financialDelta:null,dealIdDelta:null,duplicateRevenue:null,unallocatedRevenue:null,sdrCertified:false,closerCertified:false,writesAttempted:counts.firestoreWritesAttempted+counts.datacrazyMutationsAttempted+counts.snapshotWritesAttempted,counters:{...counts},failure:code};
}
module.exports={project,sanitize,failure};
