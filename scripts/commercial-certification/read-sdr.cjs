const shared=require('../../api/_lib/sdr-activity-read');
const range={from:'2026-06-01',to:'2026-10-31'};
const PREFIX='projects/plataforma-space/databases/(default)/documents';
const query=cursor=>shared.query(cursor,range);
function isAllowedQuery(body){
  try{
    const b=typeof body==='string'?JSON.parse(body):body,s=b.structuredQuery,c=s.startAt;
    if(c&&(!/^2026-\d{2}-\d{2}$/.test(c.values?.[0]?.stringValue)||!c.values?.[1]?.referenceValue?.startsWith(PREFIX+'/sdrActivityEvents/')))return false;
    return JSON.stringify(b)===JSON.stringify(query(c?{dateKey:c.values[0].stringValue,name:c.values[1].referenceValue}:null));
  }catch{return false;}
}
const readSdrEvents=options=>shared.readSdrEvents({...options,...range,base:'https://firestore.googleapis.com/v1/'+PREFIX});
module.exports={query,isAllowedQuery,readSdrEvents};
