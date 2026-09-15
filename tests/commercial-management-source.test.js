const test=require('node:test'),assert=require('node:assert/strict');
const {loadSdrActivityEvents}=require('../api/growth-dashboard').__private;
const {encodeFields}=require('../_lib/firestore-rest');
test('management loads all SDR pages for the visible period, including beyond the old 20-page cutoff',async()=>{
 const original=global.fetch;let pages=0;
 try{
  global.fetch=async(url,options)=>{
   assert.ok(String(url).endsWith(':runQuery'));assert.equal(options.method,'POST');
   const q=JSON.parse(options.body).structuredQuery;
   assert.deepEqual(q.where.compositeFilter.filters.map(f=>f.fieldFilter.value.stringValue),['2026-08-26','2026-10-06']);
   pages++;return new Response(JSON.stringify(pages<=21?[{document:{name:'projects/plataforma-space/databases/(default)/documents/sdrActivityEvents/e'+pages,fields:encodeFields({dateKey:'2026-09-10',eventType:'meeting',outcome:'show',sdrUid:'fixture'}).fields}}]:[]));
  };
  const rows=await loadSdrActivityEvents({accessToken:'synthetic',from:'2026-08-26',to:'2026-10-06'});
  assert.equal(rows.length,21);assert.equal(pages,22);assert.equal(rows.at(-1).id,'e21');
 }finally{global.fetch=original;}
});
test('management SDR source failure remains an error, never a successful zero',async()=>{
 const original=global.fetch;
 try{global.fetch=async()=>new Response('{}',{status:403});await assert.rejects(loadSdrActivityEvents({accessToken:'synthetic',from:'2026-09-01',to:'2026-09-30'}),e=>e.message==='firestore_audit_query_failed'&&e.status===403);}finally{global.fetch=original;}
});
