// Only read adapters are handed to the collector. Engine code is not duplicated.
async function collect(reads,{env,onProgress=()=>{}}={}){
  if(!['CRM_API_BASE_URL','CRM_API_KEY','GOOGLE_SERVICE_ACCOUNT_JSON'].every(k=>env[k]))throw new Error('missing_credentials');
  const {collectBusinesses}=require('../../api/_lib/datacrazy-ingestion');
  const retries=[];
  const source=await collectBusinesses({base:env.CRM_API_BASE_URL,apiKey:env.CRM_API_KEY,logger:(event,data)=>{if(event==='request_retry')retries.push({page:data.page,attempt:data.attempt,status:data.status,retryAfterMs:data.retryAfterMs,waitMs:data.waitMs});}});
  onProgress('datacrazyLoaded',source.metadata);
  const get=async p=>{onProgress('read_'+p);return reads.get(p);};
  const list=async p=>{onProgress('read_'+p);return reads.list(p);};
  const goals={};for(const key of ['2026-06','2026-07','2026-08','2026-09','2026-10'])goals[key]=await get(`growthGoals/${key}`);
  const users=await list('users'),growthPeople=await list('growthPeople'),sdrEvents=await list('sdrActivityEvents');
  const current=await get('crmLiveCache/crm'),history=await list('crmLiveSnapshots');
  const snapshotRecords=[...history,current].filter(Boolean),snapshots={};
  for(const record of [...snapshotRecords].sort((a,b)=>String(a.generatedAt||'').localeCompare(String(b.generatedAt||'')))){const payload=record.payload;if(payload?.month?.period?.monthKey)snapshots[payload.month.period.monthKey]=payload;}
  const globalConfig=await get('growthConfig/crmLiveDefaults');onProgress('firestoreLoaded');
  // Only explicit absence is no_attribution. A non-null SDR requires an explicit
  // deal->event link and matching actor; meetings alone are NOT origin evidence.
  const evidence=[];
  const {getBusinessId}=require('../../api/_lib/commercial-sales');
  for(const b of source.businesses){
    const dealId=getBusinessId(b);
    if(Object.hasOwn(b,'sdrId')&&b.sdrId===null&&!b.sdrUid&&!b.sdr?.id)evidence.push({dealId,sdrId:null,source:'explicit_datacrazy_sdrId_null'});
    const linked=sdrEvents.filter(e=>(e.id||e.firestoreDocId)===b.sdrEventId&&(e.dealId||e.businessId)===dealId&&!e.deletedAt);
    if(b.sdrEventId&&linked.length===1){const e=linked[0];if((e.sdrUid||e.sdrId)===(b.sdrUid||b.sdrId||b.sdr?.id))evidence.push({dealId,sdrId:e.sdrUid||e.sdrId,source:'explicit_deal_event_link',eventId:b.sdrEventId,timestamp:e.time||e.createdAt});}
  }
  return {businesses:source.businesses,recordPages:source.recordPages,source:source.metadata,identityKind:'dealId',users,growthPeople,goals,sdrEvents,sdrEventsComplete:true,sdrAttribution:{status:'loaded',evidence},globalConfig,snapshots,snapshotRecords,retries};
}
function adapters(){
  const {getDocumentAsAdmin,listCollectionAsAdmin}=require('../../api/_lib/firestore-admin');
  return {get:async path=>{try{return await getDocumentAsAdmin(path);}catch(e){if(e.status===404)return null;throw e;}},list:path=>listCollectionAsAdmin(path,{maxPages:path==='sdrActivityEvents'?200:20})};
}
module.exports={collect,adapters};
