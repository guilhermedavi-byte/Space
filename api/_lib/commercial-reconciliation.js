// Pure, deterministic reconciliation. Never reads/writes a database or calls CRM.
const { summarizeClosedSales, getBusinessClosingDate, getBusinessId, getCommercialDealValue } = require('./commercial-sales');
const { resolveCommercialPeriod } = require('./commercial-period');
const { resolveCommercialWeek, partitionCommercialPeriod } = require('./commercial-week');
const { containsInstant } = require('./commercial-time');
const { buildGrowthPeopleIndexes, resolveCloserBucketForBusiness, resolveWeeklyGoalConfig } = require('./growth-people');
const money = n => Math.round((n + Number.EPSILON) * 100) / 100;
const sum = rows => money(rows.reduce((s,r) => s+r.value,0));
const canonicalKeys = ['value','dateKey','dateField','weekKey','competencia','status','responsibleId','role'];
const attributionKeys = ['sourceResponsibleId','sourceSdrId','resolvedPersonId','closingDate'];
function compareDealLedgers(expected, observed, {fields=canonicalKeys, attribution=true}={}) {
  if (!Array.isArray(observed)) return { available:false, pass:false, differences:[], snapshot_reconciliation_rate:null, snapshot_delta:null };
  const exp = new Map(expected.map(r=>[r.id,r])), actual = new Map(), differences=[];
  for (const r of observed) { if(actual.has(r.id)) differences.push({id:r.id,type:'duplicate_deal',value:r.value}); else actual.set(r.id,r); }
  const matched = new Set();
  for (const [id,e] of exp) {
    const a=actual.get(id);
    if(!a){differences.push({id,type:'missing_deal',expected:e});continue;}
    const keys=[...fields,...(attribution?attributionKeys.filter(k=>e[k]!==undefined):[])];
    const missingFields=keys.filter(k=>a[k]===undefined);
    if(missingFields.length) differences.push({id,type:'unverifiable_fields',fields:missingFields});
    let same=!missingFields.length;
    for(const key of keys) if(a[key]!==undefined && e[key]!==a[key]) {same=false;differences.push({id,type:key==='weekKey'?'wrong_week':`${key}_difference`,expected:e[key],actual:a[key]});}
    if(same && !differences.some(d=>d.id===id && d.type==='duplicate_deal')) matched.add(id);
  }
  for(const [id,a] of actual)if(!exp.has(id))differences.push({id,type:'unexpected_deal',actual:a});
  const denominator=new Set([...exp.keys(),...actual.keys()]).size;
  return {available:true,pass:differences.length===0,differences,
    snapshot_reconciliation_rate:denominator?matched.size/denominator*100:100,
    snapshot_delta:money(sum(observed)-sum(expected))};
}
function buildCommercialLedger({competencia,goal,globalConfig=null,people=[],businesses=[],goals={},periodOverride=null,recordPages={}}){
  const period=periodOverride || resolveCommercialPeriod({now:new Date(`${competencia}-15T12:00:00-03:00`),periodStart:goal?.periodStart,periodEnd:goal?.periodEnd});
  const partitions=partitionCommercialPeriod(period);
  const sales=summarizeClosedSales({businesses,period});
  const months=Object.entries({...goals,[competencia]:goal}).map(([key,g])=>({key,...resolveCommercialPeriod({now:new Date(`${key}-15T12:00:00-03:00`),periodStart:g?.periodStart,periodEnd:g?.periodEnd})}));
  const indexByWeek=new Map();
  const rows=sales.sales.map(s=>{
    const week=resolveCommercialWeek({now:s.dateKey});
    if(!indexByWeek.has(week.weekKey)){
      const ownerMonth=week.startDateKey.slice(0,7),weekGoal=goals[ownerMonth] ?? (ownerMonth===competencia?goal:null);
      const config=resolveWeeklyGoalConfig({goal:weekGoal,globalConfig,week,people}).weeklyGoal;
      const roles=new Map((config?.people||[]).map(r=>[r.personId,r.role]));
      indexByWeek.set(week.weekKey,{ indexes:buildGrowthPeopleIndexes(people.map(p=>({...p,roles:roles.has(p.personId)?[roles.get(p.personId)]:p.roles}))), closers:new Set((config?.people||[]).filter(r=>r.role==='closer'||r.role==='both').map(r=>r.personId)) });
    }
    const attribution=indexByWeek.get(week.weekKey);
    const bucket=resolveCloserBucketForBusiness(s.business,attribution.indexes);
    if(!attribution.closers.has(bucket.bucketPersonId)){bucket.bucketPersonId='outros';bucket.bucketIsAggregate=true;}
    const memberships=months.filter(p=>containsInstant(getBusinessClosingDate(s.business).date,p)).map(p=>p.key);
    const slices=partitions.filter(p=>s.dateKey>=p.startDateKey&&s.dateKey<=p.endDateKey);
    const rawValue=s.business.total??s.business.value;
    return {id:s.id,number:s.business.number??s.business.code??null,name:s.business.lead?.name||s.business.name||'',value:s.value,
      dateKey:s.dateKey,dateField:s.dateField,closingDate:getBusinessClosingDate(s.business).date.toISOString(),createdAt:s.business.createdAt??null,
      status:String(s.business.stage?.name||s.business.stageName||s.business.stage||''),competencia:memberships.length===1?memberships[0]:competencia,weekKey:week.weekKey,
      responsibleId:bucket.bucketPersonId,role:bucket.bucketIsAggregate?'aggregate':'closer',
      sourceResponsibleId:bucket.crmAttendantId||null,sourceResponsibleName:bucket.attendantName||null,
      resolvedPersonId:bucket.resolvedPersonId||null,attributionMethod:bucket.method||'explicit_others_fallback',
      // No inferred SDR from attendant or free-text tags. Credit requires an explicit source link.
      sourceSdrId:s.business.sdrUid||s.business.sdrId||s.business.sdr?.id||null,
      sourceSdrName:s.business.sdr?.name||null,
      sourcePages:recordPages[s.id]||[],competenciaMemberships:memberships,weekMemberships:slices.map(p=>p.weekKey),
      valuation:rawValue===null||rawValue===undefined||rawValue===''||!Number.isFinite(Number(rawValue))?'legacy_estimate':'source_value'};
  }).sort((a,b)=>a.id.localeCompare(b.id,'en'));
  const weekly=partitions.map(w=>({...w,competencia,rows:rows.filter(r=>r.weekKey===w.weekKey),actualValue:sum(rows.filter(r=>r.weekKey===w.weekKey))}));
  const unallocated=rows.filter(r=>r.weekMemberships.length===0||r.competenciaMemberships.length===0||!r.responsibleId);
  const multiple=rows.filter(r=>r.weekMemberships.length>1||r.competenciaMemberships.length>1);
  const gaps=partitions.slice(1).filter((p,i)=>p.start!==partitions[i].end).length;
  const overlaps=partitions.slice(1).filter((p,i)=>p.start<partitions[i].end).length;
  const byId=new Map();const sourceDuplicates=[];
  for(const b of businesses){const id=getBusinessId(b);if(byId.has(id))sourceDuplicates.push({id,value:getCommercialDealValue(b)});else byId.set(id,b);}
  const weeklyTotal=money(weekly.reduce((s,w)=>s+w.actualValue,0));
  return {competencia,period,rows,weekly,excluded:sales.excluded,sourceDuplicates,
    metrics:{monthly_realized:sales.actualValue,weekly_realized:weeklyTotal,monthly_weekly_delta:money(sales.actualValue-weeklyTotal),
      unverified_revenue_dates:rows.filter(r=>['lastMovedAt','stageChangedAt','finishedAt'].includes(r.dateField)).length,
      invalid_financial_deals:sales.excluded.filter(r=>r.reason==='missing_business_id'||r.reason==='missing_closing_date').length,
      deals:rows.length,overlapping_periods:overlaps,improper_gaps:gaps,orphan_deals:unallocated.length,
      unallocated_revenue:sum(unallocated),duplicate_attribution_revenue:sum(multiple),duplicate_attributions:multiple.length,
      source_duplicate_deals:sourceDuplicates.length,unmatched_source_responsibles:rows.filter(r=>!r.resolvedPersonId).length,
      unknown_sdr_links:rows.filter(r=>!r.sourceSdrId).length,estimated_value_deals:rows.filter(r=>r.valuation!=='source_value').length}};
}
module.exports={buildCommercialLedger,compareDealLedgers};
