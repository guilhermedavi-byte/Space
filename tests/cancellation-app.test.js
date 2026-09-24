const test=require('node:test');
const assert=require('node:assert/strict');
test('app real carrega domínio antes da UI e revalida acesso de sessão existente',async()=>{
 const sessionPath=require.resolve('../_lib/session'), servicePath=require.resolve('../api/_lib/student-lifecycle'), appPath=require.resolve('../api/app');
 const original=[sessionPath,servicePath,appPath].map(p=>require.cache[p]);
 const prior=process.env.RETENTION_V2_ENABLED;
 let active=true,unavailable=false;
 try {
  process.env.RETENTION_V2_ENABLED='1';
  require.cache[sessionPath]={id:sessionPath,filename:sessionPath,loaded:true,exports:{getSessionFromRequest:()=>({sub:'synthetic',role:'student',name:'Aluno',email:'test@example.invalid'})}};
  require.cache[servicePath]={id:servicePath,filename:servicePath,loaded:true,exports:{getForStudent:async()=>{if(unavailable)throw new Error('unavailable');return {subscriptions:[{lifecycle_status:active?'cancellation_requested':'churned'}]};},isActiveOn:()=>active}};
  delete require.cache[appPath];const handler=require('../api/app');
  const invoke=async()=>{const res={headers:{},setHeader(k,v){this.headers[k]=v;},end(body){this.body=body;}};await handler({method:'GET',headers:{host:'localhost'},url:'/api/app?path=aluno'},res);return res;};
  let res=await invoke();assert.equal(res.statusCode,200);
  assert.ok(res.body.indexOf('/assets/student-lifecycle.js')<res.body.indexOf('src="script.js?v=6"'));
  assert.match(res.body,/"lifecycle":\{"subscriptions"/);
  active=false;res=await invoke();assert.equal(res.statusCode,403);
  unavailable=true;res=await invoke();assert.equal(res.statusCode,503);
 } finally {
  [sessionPath,servicePath,appPath].forEach((p,i)=>{if(original[i])require.cache[p]=original[i];else delete require.cache[p];});
  if(prior===undefined)delete process.env.RETENTION_V2_ENABLED;else process.env.RETENTION_V2_ENABLED=prior;
 }
});
