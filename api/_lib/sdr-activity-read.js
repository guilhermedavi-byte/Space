const SELECT=['id','sdrUid','sdrId','sdrEmail','dateKey','eventType','outcome','deletedAt','time','createdAt','dealId','businessId'];
const PREFIX='projects/plataforma-space/databases/(default)/documents';
function query(cursor,{from,to}){
  return {structuredQuery:{select:{fields:SELECT.map(fieldPath=>({fieldPath}))},from:[{collectionId:'sdrActivityEvents'}],
    where:{compositeFilter:{op:'AND',filters:[['GREATER_THAN_OR_EQUAL',from],['LESS_THAN_OR_EQUAL',to]].map(([op,stringValue])=>({fieldFilter:{field:{fieldPath:'dateKey'},op,value:{stringValue}}}))}},
    orderBy:[{field:{fieldPath:'dateKey'},direction:'ASCENDING'},{field:{fieldPath:'__name__'},direction:'ASCENDING'}],limit:1000,
    ...(cursor?{startAt:{before:false,values:[{stringValue:cursor.dateKey},{referenceValue:cursor.name}]}}:{})}};
}
async function readSdrEvents({fetchImpl=global.fetch,getToken,decode,from,to,base}={}){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(from||'')||!/^\d{4}-\d{2}-\d{2}$/.test(to||'')||from>to)throw Error('invalid_sdr_date_range');
  const token=await getToken();const out=[],seen=new Set();let cursor;
  for(let page=0;page<200;page++){
    const response=await fetchImpl((base||require('./firestore-rest').FIRESTORE_BASE)+':runQuery',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(query(cursor,{from,to})),signal:AbortSignal.timeout(15000)});
    if(!response.ok)throw Object.assign(Error('firestore_audit_query_failed'),{status:response.status});
    const body=await response.json();if(!Array.isArray(body))throw Error('firestore_audit_query_invalid');
    const docs=body.filter(r=>r.document).map(r=>r.document);
    if(!docs.length)return out;
    for(const doc of docs){if(seen.has(doc.name))throw Error('firestore_audit_cursor_repeated');seen.add(doc.name);const fields=decode(doc),firestoreDocId=doc.name.split('/').pop();out.push({...fields,id:fields.id||firestoreDocId,firestoreDocId});}
    const last=docs.at(-1);cursor={dateKey:decode(last).dateKey,name:last.name};
    // Empty next page proves completion even when the service returns a short page.
  }
  throw Error('firestore_pagination_incomplete');
}
module.exports={query,readSdrEvents};
