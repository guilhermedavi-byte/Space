const test=require('node:test'),assert=require('node:assert/strict');
const {query,isAllowedQuery,readSdrEvents}=require('../scripts/commercial-certification/read-sdr.cjs');
const {createGuard}=require('../scripts/commercial-certification/guard.cjs');
const {decodeFields,encodeFields}=require('../_lib/firestore-rest');
test('SDR query uses an exclusive cursor and proves completion with an empty page',async()=>{
 const calls=[];const doc=i=>({name:'projects/plataforma-space/databases/(default)/documents/sdrActivityEvents/e'+i,fields:encodeFields({dateKey:'2026-09-10',sdrUid:'synthetic',eventType:'meeting',outcome:'show'}).fields});
 const rows=await readSdrEvents({getToken:async()=>'synthetic',decode:decodeFields,fetchImpl:async(url,o)=>{calls.push(JSON.parse(o.body));return new Response(JSON.stringify(calls.length<3?[{document:doc(calls.length)}]:[]));}});
 assert.equal(rows.length,2);assert.equal(calls.length,3);assert.equal(calls[1].structuredQuery.startAt.before,false);assert.equal(calls[1].structuredQuery.startAt.values[1].referenceValue,doc(1).name);assert.equal(calls.every(isAllowedQuery),true);
});
test('repeated cursor fails instead of duplicating events',async()=>{
 await assert.rejects(readSdrEvents({getToken:async()=>'synthetic',decode:()=>({dateKey:'2026-09-10'}),fetchImpl:async()=>new Response(JSON.stringify([{document:{name:'projects/plataforma-space/databases/(default)/documents/sdrActivityEvents/e1'}}]))}),/cursor_repeated/);
});
test('guard permits only the exact bounded read query, with zero mutation counters',async()=>{
 let requests=0;const g=createGuard({env:{CRM_API_BASE_URL:'https://crm.example.test'},fetchImpl:async()=>{requests++;return new Response('[]');}}),url='https://firestore.googleapis.com/v1/projects/plataforma-space/databases/(default)/documents:runQuery';
 await g.fetchReadOnly(url,{method:'POST',body:JSON.stringify(query())});
 for(const edit of [q=>q.structuredQuery.from[0].collectionId='users',q=>q.structuredQuery.limit=10000,q=>q.structuredQuery.where.compositeFilter.filters[0].fieldFilter.value.stringValue='2000-01-01']){const q=query();edit(q);await assert.rejects(g.fetchReadOnly(url,{method:'POST',body:JSON.stringify(q)}));}
 assert.equal(requests,1);assert.equal(g.counts.firestoreWritesAttempted,0);assert.equal(g.counts.blockedRequests,3);
});
