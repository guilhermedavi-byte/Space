const test = require('node:test');
const assert = require('node:assert/strict');
const { createHandler } = require('../api/attendance');
const { requireAttendanceAuth, requireAssignableAttendanceUser } = require('../api/_lib/attendance-auth');
const { assertAttendanceEnvironment, validateMessage, validateCommand, metadata } = require('../api/_lib/attendance-domain');
const { createAttendanceStore } = require('../api/_lib/attendance-store');

const conversationId = '11111111-1111-1111-1111-111111111111';
const makeReq = (body, method = 'POST') => ({ method, url: '/api/attendance', headers: {},
  on(event, fn) { if (event === 'data') fn(Buffer.from(JSON.stringify(body))); if (event === 'end') fn(); } });
const makeRes = () => ({ headers: {}, setHeader(k,v) { this.headers[k]=v; }, end(s) { this.body=JSON.parse(s); } });
const auth = () => ({ ok:true, decoded:{uid:'firebase-uid'}, session:{sub:'firebase-uid',role:'admin'},
  profile:{active:true,user:{id:'firebase-uid'}} });

test('autenticação existente: perfil atual ativo, UID consistente, role interna elegível', async () => {
  assert.equal((await requireAttendanceAuth({},'attendance.view',async()=>auth())).uid,'firebase-uid');
  for (const build of [
    () => ({ok:false}), () => ({...auth(),profile:{active:false,user:{id:'firebase-uid'}}}),
    () => ({...auth(),profile:undefined}), () => ({...auth(),session:{sub:'firebase-uid',role:'student'}}),
    () => ({...auth(),decoded:{uid:'different'}}),
  ]) await assert.rejects(requireAttendanceAuth({},'attendance.view',async()=>build()));
});

test('gate de ambiente falha fechado: produção/ausência de staging/flag desligada', () => {
  assert.throws(()=>assertAttendanceEnvironment({}),/attendance_foundation_disabled/);
  for (const env of [
    { APP_ENV:'production' }, { APP_ENV:'staging',SUPABASE_URL:'https://prod.test',SPACE_STAGING_SUPABASE_URL:'https://prod.test',SPACE_PRODUCTION_SUPABASE_URL:'https://prod.test',SUPABASE_ENV_SCOPE:'staging' },
    { APP_ENV:'staging',SUPABASE_URL:'https://stage.test',SUPABASE_ENV_SCOPE:'staging' },
  ]) assert.throws(()=>assertAttendanceEnvironment({ATTENDANCE_FOUNDATION_ENABLED:'true',...env}),/attendance_staging_not_verified|attendance_environment_production_authorization_required/);
});

test('assignment revalida existência/papel/ativo do destinatário no Firestore', async () => {
  await requireAssignableAttendanceUser('target',async()=>({tipo:'growth',ativo:true}));
  for (const user of [null,{tipo:'student',ativo:true},{tipo:'growth',ativo:false}]) {
    await assert.rejects(requireAssignableAttendanceUser('target',async()=>user),/attendance_invalid_assignee/);
  }
});

test('mensagens/metadata/commands rejeitam injeção de ator, secrets, inbound público e identity HTTP', () => {
  assert.throws(()=>validateMessage({client_request_id:'1',direction:'inbound',content:{text:'no'}}));
  assert.throws(()=>validateMessage({client_request_id:'1',author_uid:'other',content:{text:'no'}}));
  assert.throws(()=>validateMessage({client_request_id:'1',content:{text:''}}));
  assert.throws(()=>metadata({nested:{access_token:'no'}}));
  assert.throws(()=>metadata({data:[{secret:'no'}]}));
  assert.throws(()=>validateCommand({action:'identity',client_action_id:'1',expected_version:1}));
  assert.throws(()=>validateCommand({action:'status',client_action_id:'1',expected_version:1,status:'invalid'}));
  assert.equal(validateMessage({client_request_id:'1',content:{text:'hi'}}).direction,'outbound');
});

test('POST usa somente UID autenticado e retorna intenção pending, sem envio externo', async () => {
  let received;
  const handler=createHandler({checkEnvironment:()=>{},authenticate:async()=>({uid:'verified-user'}),
    repository:{appendMessage:async(args)=>{received=args; return {status:'pending'};}}});
  const res=makeRes();
  await handler(makeReq({action:'message',conversation_id:conversationId,message:{client_request_id:'x',content:{text:'hello'}}}),res);
  assert.equal(res.statusCode,202); assert.equal(received.actorUid,'verified-user'); assert.equal(res.body.status,'pending');
  const bad=makeRes();
  await handler(makeReq({action:'message',actor_uid:'forged',conversation_id:conversationId,message:{}}),bad);
  assert.equal(bad.statusCode,422);
});

test('API não expõe ingestão/provider/identity e autenticação falha antes do store', async () => {
  let calls=0;
  const handler=createHandler({checkEnvironment:()=>{},authenticate:async()=>{throw Object.assign(new Error('unauthenticated'),{status:401});},
    repository:{appendMessage:async()=>{calls++;}}});
  const res=makeRes(); await handler(makeReq({action:'message'}),res);
  assert.equal(res.statusCode,401); assert.equal(calls,0);
  const other=createHandler({checkEnvironment:()=>{},authenticate:async()=>({uid:'verified'}),repository:{}});
  const no=makeRes(); await other(makeReq({action:'ingest'}),no); assert.equal(no.statusCode,422);
});

test('agente sem supervisão não consulta identidade do destinatário ao tentar atribuir', async () => {
  let lookups=0;
  const handler=createHandler({checkEnvironment:()=>{},authenticate:async()=>({uid:'agent'}),
    validateAssignee:async()=>{lookups++;},repository:{getConversation:async()=>({permissions:{can_assign:false}})}});
  const res=makeRes();
  await handler(makeReq({action:'update',conversation_id:conversationId,
    command:{action:'assignment',assigned_user_uid:'target',client_action_id:'assignment',expected_version:1}}),res);
  assert.equal(res.statusCode,403); assert.equal(lookups,0);
});

test('erros SQL mapeiam conflito/isolamento sem retornar payload upstream', async () => {
  for (const [code,status] of [['40001',409],['23505',409],['42501',403],['23503',422],['XX000',503]]) {
    const handler=createHandler({checkEnvironment:()=>{},authenticate:async()=>({uid:'verified'}),repository:{listConversations:async()=>{
      throw Object.assign(new Error('upstream contains private payload'),{code,details:'private'});
    }}});
    const res=makeRes(); await handler(makeReq({},'GET'),res);
    assert.equal(res.statusCode,status); assert.deepEqual(res.body,{error:'attendance_request_failed'});
  }
});

test('store usa RPC parametrizada e checa ambiente em cada operação', async () => {
  let checked=0; const calls=[];
  const repository=createAttendanceStore({checkEnvironment:()=>{checked++;},request:async(path,args)=>{calls.push({path,args});return {data:{ok:true}};}});
  await repository.appendMessage({actorUid:'verified',conversationId,message:{client_request_id:'x',content:{text:'hello'}}});
  assert.equal(checked,1); assert.equal(calls[0].path,'/rpc/attendance_append_message');
  assert.equal(calls[0].args.body.p_actor_uid,'verified'); assert.equal(calls[0].args.method,'POST');
});
