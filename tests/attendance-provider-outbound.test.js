const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {Readable}=require('node:stream');
const {createHandler}=require('../api/attendance/evolution/webhook');
const {remoteIdentity,transportStatus}=require('../api/_lib/attendance-provider-message');
const channel='20000000-0000-0000-0000-000000000001',connection='10000000-0000-0000-0000-000000000001';
async function webhook(data,event='messages.upsert'){
 const calls=[];const secret='local-test-not-a-production-secret';
 const handler=createHandler({env:{EVOLUTION_WEBHOOK_SECRET:secret},refresh:async()=>{},request:async(path,opts)=>{calls.push({path,body:opts.body});return {data:path.includes('resolve_instance')?{found:true,connection_id:connection,channel_id:channel}: {outcome:'inserted'}};}});
 const req=Readable.from([JSON.stringify({instance:'space-suporte',event,data})]);req.method='POST';req.headers={'x-space-evolution-secret':secret};
 const res={setHeader(){},end(v){this.body=v;}};await handler(req,res);return {res,calls};
}
test('inbound and companion outbound use the same normalized domain RPC',async()=>{
 for(const fromMe of [false,true]){const {res,calls}=await webhook({key:{id:'id',remoteJid:'123456789012345@lid',remoteJidAlt:'5534999999999@s.whatsapp.net',fromMe},pushName:'Space operator',messageTimestamp:1700000000,message:{conversation:'hello'}});assert.equal(res.statusCode,200);const e=calls[1].body.p_event;assert.equal(e.direction,fromMe?'outbound':'inbound');assert.equal(e.external_contact_id,'5534999999999@s.whatsapp.net');assert.equal(e.provider_timestamp,'2023-11-14T22:13:20.000Z');if(fromMe)assert.notEqual(e.display_name,'Space operator');}
});
test('outbound media preserve captions, voice note metadata, decryption envelope and quoted id',async()=>{
 for(const kind of ['image','audio','video','document','sticker']){const {calls}=await webhook({key:{id:kind,remoteJid:'5534999999999@s.whatsapp.net',fromMe:true},messageTimestamp:1700000000,message:{[kind+'Message']:{mimetype:kind==='audio'?'audio/ogg; codecs=opus':'image/jpeg',caption:'caption',ptt:true,seconds:10,mediaKey:{type:'Buffer',data:[1,2,3]},contextInfo:{stanzaId:'quoted'}}}});const e=calls[1].body.p_event;assert.equal(e.kind,kind);assert.equal(e.direction,'outbound');assert.equal(e.content.media.duration,10);assert.equal(e.external_reply_to_id,'quoted');assert.equal(e.metadata.evolution_message.key.fromMe,true);}
});
test('LID without phone stays opaque; groups ignored; numeric transport updates supported',async()=>{
 assert.equal(remoteIdentity({remoteJid:'123456789012345@lid'}).phone,null);assert.equal(remoteIdentity({remoteJid:'123456789@g.us'}),null);
 const r=await webhook({keyId:'external-id',status:3},'MESSAGES_UPDATE');assert.equal(r.calls[1].body.p_status,'delivered');assert.equal(transportStatus(4),'read');
});

test('SQL: companion creation, alias reuse, unread, chronology, exact ID reconciliation and both race orders', {skip:!process.env.ATTENDANCE_PGLITE_MODULE},async()=>{
 const {PGlite}=require(process.env.ATTENDANCE_PGLITE_MODULE);const db=new PGlite();
 const rpc=async(name,arg)=> (await db.query(`select public.${name}($1::jsonb) as result`,[JSON.stringify(arg)])).rows[0].result;
 const get=async(sql,args=[])=> (await db.query(sql,args)).rows;
 const e=(id,patch={})=>({provider:'evolution_whatsapp',connection_id:connection,channel_id:channel,direction:'outbound',external_message_id:id,external_event_id:id,external_contact_id:'5534999999999@s.whatsapp.net',identity_aliases:['5534999999999@s.whatsapp.net','123456789012345@lid'],identifier_type:'whatsapp_jid',phone_raw:'+5534999999999',display_name:'Remote',kind:'text',content:{text:id},provider_timestamp:'2026-09-25T15:00:00Z',metadata:{},...patch});
 try{
 await db.exec('create role anon;create role authenticated;create role service_role bypassrls;');
 for(const name of ['202609140001_attendance_foundation.sql','20260925201704_attendance_provider_outbound.sql'])await db.exec(fs.readFileSync('supabase/migrations/'+name,'utf8'));
 await db.exec(`begin;insert into public.teams(team_id,name) values('30000000-0000-0000-0000-000000000001','test');
 insert into public.connections(connection_id,provider,external_account_id,external_account_type,display_name,status) values('${connection}','evolution_whatsapp','fixture','instance','fixture','active');
 insert into public.channels(channel_id,connection_id,external_channel_id,display_name,default_team_id,status) values('${channel}','${connection}','fixture','fixture','30000000-0000-0000-0000-000000000001','active');
 insert into public.channel_teams values('${channel}','30000000-0000-0000-0000-000000000001');
 insert into public.attendance_members(user_uid,enabled) values('operator',true);insert into public.team_members(team_id,user_uid,member_role) values('30000000-0000-0000-0000-000000000001','operator','agent');commit;`);
 const first=await rpc('attendance_ingest_provider_message',e('phone-first'));const conv=first.conversation_id;
 let rows=await get('select * from messages');assert.equal(rows.length,1);assert.equal(rows[0].direction,'outbound');assert.equal(rows[0].author_uid,null);assert.equal(rows[0].transport_status,'sent');
 assert.equal((await rpc('attendance_ingest_provider_message',e('phone-first'))).duplicate,true);
 const inbound=await rpc('attendance_ingest_provider_message',e('in',{direction:'inbound',external_contact_id:'123456789012345@lid',phone_raw:null,identity_aliases:[],provider_timestamp:'2026-09-25T15:00:01Z'}));assert.equal(inbound.conversation_id,conv);
 const space=async id=>(await db.query('select attendance_append_message($1,$2,$3) as result',['operator',conv,JSON.stringify({direction:'outbound',kind:'text',content:{text:'same'},client_request_id:id,metadata:{origin:'space_inbox'}})])).rows[0].result;
 const bind=async(id,ext,status='sent')=>db.query('select attendance_set_message_transport($1,$2,$3,$4)',[id,status,ext,'{}']);
 const pending=await space('racing');const echo=await rpc('attendance_ingest_provider_message',e('space-echo',{content:{text:'same'}}));assert.equal(echo.deferred,true);
 const other=await rpc('attendance_ingest_provider_message',e('phone-during-send'));assert.equal(other.outcome,'inserted');
 await db.query('select attendance_set_transport_by_external($1,$2,$3)',[channel,'space-echo','read']);
 await bind(pending.message_id,'space-echo');
 rows=await get('select * from messages where external_message_id=$1',['space-echo']);assert.equal(rows.length,1);assert.equal(rows[0].message_id,pending.message_id);assert.equal(rows[0].author_uid,'operator');assert.equal(rows[0].transport_status,'read');
 assert.equal((await get("select count(*)::int n from messages where external_message_id='phone-during-send'"))[0].n,1);
 const sentFirst=await space('normal');await bind(sentFirst.message_id,'normal-id');await rpc('attendance_ingest_provider_message',e('normal-id'));await rpc('attendance_ingest_provider_message',e('normal-id'));
 assert.equal((await get("select count(*)::int n from messages where external_message_id='normal-id'"))[0].n,1);
 for(const kind of ['audio','image'])await rpc('attendance_ingest_provider_message',e(kind,{kind,content:{media:{duration:10,mime_type:kind==='audio'?'audio/ogg; codecs=opus':'image/jpeg'}},provider_timestamp:'2026-09-25T15:00:02Z'}));
 await db.query('select attendance_set_transport_by_external($1,$2,$3)',[channel,'audio','delivered']);await db.query('select attendance_set_transport_by_external($1,$2,$3)',[channel,'audio','sent']);assert.equal((await get("select transport_status from messages where external_message_id='audio'"))[0].transport_status,'delivered');
 assert.equal((await get("select count(*)::int n from messages where direction='inbound'"))[0].n,1);assert.equal((await get('select count(*)::int n from conversation_reads'))[0].n,0);
 assert.equal((await get('select count(*)::int n from contacts'))[0].n,1);
 await rpc('attendance_ingest_provider_message',e('older',{provider_timestamp:'2020-01-01T00:00:00Z'}));assert.notEqual((await get('select last_message_id from conversations'))[0].last_message_id,(await get("select message_id from messages where external_message_id='older'"))[0].message_id);
 assert.equal((await get('select count(*)::int n from attendance_provider_receipts where event is not null'))[0].n,0);
 }finally{await db.close();}
});
