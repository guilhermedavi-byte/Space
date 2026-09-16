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
  // Origin links can precede the reporting window. Read only explicitly linked
  // events not already present in the activity window, without inferring origins.
  const eventIds=new Set(sdrEvents.map(e=>e.firestoreDocId||e.id));
  for(const id of new Set(source.businesses.map(b=>b.sdrEventId).filter(Boolean))){
    if(eventIds.has(id))continue;
    if(!/^[A-Za-z0-9_-]{1,128}$/.test(id))throw Error('invalid_sdr_event_link');
    const event=await get('sdrActivityEvents/'+id);if(event){sdrEvents.push(event);eventIds.add(id);}
  }
  const current=await get('crmLiveCache/crm'),history=await list('crmLiveSnapshots');
  const snapshotRecords=[...history,current].filter(Boolean),snapshots={};
  for(const record of [...snapshotRecords].sort((a,b)=>String(a.generatedAt||'').localeCompare(String(b.generatedAt||'')))){const payload=record.payload;if(payload?.month?.period?.monthKey)snapshots[payload.month.period.monthKey]=payload;}
  const globalConfig=await get('growthConfig/crmLiveDefaults');onProgress('firestoreLoaded');
  const sdrAttribution=require('../../api/_lib/commercial-sdr-origin').buildSdrEvidence(source.businesses,sdrEvents,{sourceComplete:true,eventsComplete:true});
  return {businesses:source.businesses,recordPages:source.recordPages,source:source.metadata,identityKind:'dealId',users,growthPeople,goals,sdrEvents,sdrEventsComplete:true,sdrAttribution,globalConfig,snapshots,snapshotRecords,retries};
}
function adapters(){
  const {getDocumentAsAdmin,listCollectionAsAdmin}=require('../../api/_lib/firestore-admin');
  return {get:async path=>{try{return await getDocumentAsAdmin(path);}catch(e){if(e.status===404)return null;throw e;}},list:path=>path==='sdrActivityEvents'?require('./read-sdr.cjs').readSdrEvents({getToken:async()=>(await require('../../_lib/google-service-account').getGoogleAccessToken({scope:'https://www.googleapis.com/auth/datastore'})).accessToken,decode:require('../../_lib/firestore-rest').decodeFields}):listCollectionAsAdmin(path)};
}
module.exports={collect,adapters};
