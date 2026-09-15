const test=require('node:test');
const assert=require('node:assert/strict');
test('real Firestore adapter sends cache and history in ONE commit with version precondition',async()=>{
  const authPath=require.resolve('../_lib/google-service-account');
  const storePath=require.resolve('../api/_lib/crm-snapshot-store');
  const auth=require(authPath),originalToken=auth.getGoogleAccessToken,originalFetch=global.fetch;
  const calls=[];
  const savedEnv={APP_ENV:process.env.APP_ENV,NEXT_PUBLIC_FIREBASE_PROJECT_ID:process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID};
  try{
    process.env.APP_ENV='test';process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID='commercial-test-only';
    auth.getGoogleAccessToken=async()=>({accessToken:'test-only'});
    delete require.cache[storePath];
    global.fetch=async(url,options)=>{calls.push({url,options});return {ok:true,status:200,json:async()=>({writeResults:[{updateTime:'next'},{updateTime:'next'}]})};};
    const store=require(storePath).createFirestoreStore();
    await store.commit([{path:'crmLiveCache/crm',data:{payload:{value:210}},version:'2026-09-14T01:00:00Z'},
      {path:'crmLiveSnapshots/new',data:{payload:{value:210}},version:null}]);
    assert.equal(calls.length,1);assert.ok(calls[0].url.endsWith(':commit'));assert.equal(calls[0].options.method,'POST');
    const writes=JSON.parse(calls[0].options.body).writes;
    assert.equal(writes.length,2);assert.equal(writes[0].currentDocument.updateTime,'2026-09-14T01:00:00Z');
    assert.equal(writes[1].currentDocument.exists,false);
    assert.ok(writes[0].update.name.endsWith('/crmLiveCache/crm'));
    assert.ok(writes[1].update.name.endsWith('/crmLiveSnapshots/new'));
  }finally{for(const [key,value] of Object.entries(savedEnv)){if(value===undefined)delete process.env[key];else process.env[key]=value;}global.fetch=originalFetch;auth.getGoogleAccessToken=originalToken;delete require.cache[storePath];}
});
