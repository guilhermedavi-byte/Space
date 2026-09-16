const test=require('node:test'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
test('audit can finish beyond twenty Firestore pages; default and exhaustion still fail closed',()=>{
 const script=`
 const assert=require('node:assert/strict');
 const oauth=require('./_lib/google-service-account');oauth.getGoogleAccessToken=async()=>({accessToken:'synthetic'});
 const rest=require('./api/_lib/firestore-rest');let pages=0;
 rest.requestJson=async()=>{pages++;return {ok:true,data:{documents:[{name:'projects/test/databases/(default)/documents/sdrActivityEvents/event-'+pages,fields:{}}],...(pages<21?{nextPageToken:'next-'+pages}:{})}};};
 const {listCollectionAsAdmin}=require('./api/_lib/firestore-admin');
 (async()=>{
 await assert.rejects(listCollectionAsAdmin('sdrActivityEvents'),/firestore_pagination_incomplete/);assert.equal(pages,20);
 pages=0;const rows=await listCollectionAsAdmin('sdrActivityEvents',{maxPages:200});assert.equal(pages,21);assert.equal(rows.length,21);assert.equal(new Set(rows.map(r=>r.id)).size,21);
 pages=0;await assert.rejects(listCollectionAsAdmin('sdrActivityEvents',{maxPages:2}),/firestore_pagination_incomplete/);assert.equal(pages,2);
 await assert.rejects(listCollectionAsAdmin('sdrActivityEvents',{maxPages:201}),/invalid_firestore_page_limit/);
 console.log('PASS');})().catch(()=>process.exit(1));`;
 assert.equal(execFileSync(process.execPath,['-e',script],{cwd:require('node:path').resolve(__dirname,'..'),env:{},encoding:'utf8'}).trim(),'PASS');
});
