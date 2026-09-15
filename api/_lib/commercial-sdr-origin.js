// Historical absence is a valid state only after both sources have loaded.
function buildSdrEvidence(businesses,events,{sourceComplete=false,eventsComplete=false}={}){
 if(!sourceComplete||!eventsComplete)return {status:'not_loaded',evidence:[]};
 const byEvent=new Map(),byDeal=new Map();
 for(const e of events){byEvent.set(e.firestoreDocId||e.id,e);const id=e.dealId||e.businessId;if(id&&!e.deletedAt){if(!byDeal.has(id))byDeal.set(id,[]);byDeal.get(id).push(e);}}
 const evidence=businesses.map(b=>{
  const dealId=require('./commercial-sales').getBusinessId(b),sdrId=b.sdrUid||b.sdrId||b.sdr?.id||null,linked=byDeal.get(dealId)||[];
  if(!sdrId&&!b.sdrEventId&&!linked.length)return {dealId,sdrId:null,source:'historical_origin_absent_after_complete_read'};
  const e=byEvent.get(b.sdrEventId);
  if(e&&!e.deletedAt&&(e.dealId||e.businessId)===dealId&&(e.sdrUid||e.sdrId)===sdrId)return {dealId,sdrId,source:'explicit_deal_event_link',eventId:b.sdrEventId,timestamp:e.time||e.createdAt};
  return {dealId,sdrId,status:'source_error',source:'unresolved_explicit_origin'};
 });
 return {status:'loaded',evidence};
}
module.exports={buildSdrEvidence};
