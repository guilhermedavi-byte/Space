const test=require('node:test'),assert=require('node:assert/strict');
test('management serves only a complete published source without attempting refresh writes',async()=>{
 const source=require('../api/_lib/crm-source-snapshot'),old=source.createSourceService;
 let reads=0;source.createSourceService=()=>({readOnly:async()=>{reads++;return {businesses:[{id:'certified'}],pagination:{fetchCompleted:true},metadata:{fetchCompletedAt:'2026-09-15T12:00:00Z'},stale:true};},get:()=>{throw Error('refresh_not_allowed');}});
 try{const r=await require('../api/growth-dashboard').__private.fetchAllCrmBusinesses({readOnly:true});assert.equal(r.ok,true);assert.equal(reads,1);assert.equal(r.businesses[0].id,'certified');assert.equal(r.sourceStale,true);assert.equal(r.sourceUpdatedAt,'2026-09-15T12:00:00Z');}finally{source.createSourceService=old;}
});
