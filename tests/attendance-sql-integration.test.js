const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { createHarness, delay } = require('./helpers/attendance-postgres');
const { createAttendanceStore } = require('../api/_lib/attendance-store');

const ids = {
  connection: '10000000-0000-0000-0000-000000000001', otherConnection: '10000000-0000-0000-0000-000000000002',
  channel: '20000000-0000-0000-0000-000000000001', otherChannel: '20000000-0000-0000-0000-000000000002',
  team: '30000000-0000-0000-0000-000000000001', otherTeam: '30000000-0000-0000-0000-000000000002',
};
const quote = (value) => `'${String(value).replace(/'/g, "''")}'`;

test('Atendimento: PostgreSQL + PostgREST reais, constraints, isolamento e concorrência',
  { skip: process.env.RUN_ATTENDANCE_SQL_INTEGRATION !== '1', timeout: 180000 }, async (t) => {
    const h = await createHarness();
    const store = createAttendanceStore({ request: h.request, checkEnvironment: () => {} });
    const summary = { engine: `PostgreSQL ${process.env.ATTENDANCE_TEST_POSTGRES_MAJOR === '17' ? '17' : '16'} / PostgREST 12`, externalDatabase: false, scenarios: [], raceWaiters: [] };
    const scenario = async (name, fn) => t.test(name, async () => { await fn(); summary.scenarios.push(name); });
    const event = (id, contact = 'external-user', patch = {}) => ({
      provider: 'test_provider', connection_id: ids.connection, channel_id: ids.channel,
      external_message_id: id, external_contact_id: contact, content: { text: `message ${id}` },
      phone_raw: '(55) 99999-1234', country_calling_code: '55', ...patch,
    });
    const detail = (id, actorUid = 'agent-a') => store.getConversation({ conversationId: id, actorUid });
    const scalar = (sql) => JSON.parse(h.sql(sql));
    const update = async (conversationId, command, actorUid = 'supervisor', allowIdentity = false) => {
      const current = await detail(conversationId, actorUid);
      return store.updateConversation({ actorUid, conversationId, allowIdentity,
        command: { client_action_id: `cmd-${Math.random()}`, expected_version: current.conversation.version, ...command } });
    };
    // Hold the SAME database advisory lock used by the RPC. Concurrent HTTP requests
    // must appear as actual waiting Postgres backends before the gate is released.
    const race = async (key, calls) => {
      let ready;
      const gateReady = new Promise((resolve) => { ready = resolve; });
      const gate = h.sqlAsync(`begin; select pg_advisory_xact_lock(hashtextextended(${quote(key)},0));
        select 'gate_ready'; select pg_sleep(2); commit;`, (out) => { if (out.includes('gate_ready')) ready(); });
      await Promise.race([gateReady, gate]);
      const work = calls.map((call) => call());
      await delay(250);
      const waiting = Number(h.sql("select count(*) from pg_stat_activity where wait_event='advisory' and query like '%attendance_ingest_message%';"));
      summary.raceWaiters.push(waiting);
      assert.ok(waiting >= 2, `expected real overlapping PostgreSQL sessions, got ${waiting}`);
      const result = await Promise.all(work);
      await gate;
      return result;
    };
    const conversationRace = async (id, calls) => {
      let ready;
      const started = new Promise((resolve) => { ready=resolve; });
      const gate=h.sqlAsync(`begin; select conversation_id from public.conversations where conversation_id='${id}' for update;
        select 'gate_ready'; select pg_sleep(2); commit;`,(out)=>{if(out.includes('gate_ready')) ready();});
      await Promise.race([started,gate]);
      const pending=Promise.allSettled(calls.map((call)=>call()));
      await delay(250);
      const waiters=Number(h.sql("select count(*) from pg_stat_activity where wait_event_type='Lock' and query like '%attendance_%';"));
      assert.ok(waiters>=2,`row-lock race needs overlapping sessions, got ${waiters}`);
      summary.raceWaiters.push(waiters);
      const results=await pending;
      await gate;
      return results;
    };
    try {
      h.sql(`begin;
        insert into public.connections(connection_id,provider,external_account_id,display_name,status) values
          ('${ids.connection}','test_provider','account-a','Test A','active'),('${ids.otherConnection}','test_provider','account-b','Test B','active');
        insert into public.teams(team_id,name) values('${ids.team}','Team A'),('${ids.otherTeam}','Team B');
        insert into public.attendance_members(user_uid,enabled) values('agent-a',true),('agent-b',true),('supervisor',true),('disabled',false),('unassigned',true);
        insert into public.team_members(team_id,user_uid,member_role) values
          ('${ids.team}','agent-a','agent'),('${ids.otherTeam}','agent-b','agent'),
          ('${ids.team}','supervisor','supervisor'),('${ids.otherTeam}','supervisor','supervisor'),('${ids.team}','disabled','agent');
        insert into public.channels(channel_id,connection_id,external_channel_id,display_name,status,default_team_id) values
          ('${ids.channel}','${ids.connection}','endpoint-a','Channel A','active','${ids.team}'),
          ('${ids.otherChannel}','${ids.otherConnection}','endpoint-b','Channel B','active','${ids.otherTeam}');
        insert into public.channel_teams(channel_id,team_id) values('${ids.channel}','${ids.team}'),('${ids.channel}','${ids.otherTeam}'),('${ids.otherChannel}','${ids.otherTeam}');
        commit;`);
      let first;
      await scenario('persistência, inbound/outbound/nota, reply e last_message em ordem de ingestão', async () => {
        first = await store.ingestMessage(event('first', 'main', { provider_timestamp: '2026-09-10T12:00:00Z' }));
        const second = await store.ingestMessage(event('second', 'main', { provider_timestamp: '2026-09-09T12:00:00Z' }));
        assert.equal(second.conversation_id, first.conversation_id);
        assert.equal(second.sequence, 2);
        let d = await detail(first.conversation_id);
        assert.equal(d.conversation.last_message_id, second.message_id);
        assert.equal(d.conversation.last_inbound_at, '2026-09-10T12:00:00+00:00');
        assert.equal(d.unread, 2);
        const outbound = await store.appendMessage({ actorUid: 'agent-a', conversationId: first.conversation_id,
          message: { client_request_id: 'out-1', content: { text: 'Hello' }, reply_to_message_id: first.message_id } });
        assert.equal(outbound.status, 'pending');
        const note = await store.appendMessage({ actorUid: 'agent-a', conversationId: first.conversation_id,
          message: { client_request_id: 'note-1', direction: 'internal', content: { text: 'Internal' } } });
        d = await detail(first.conversation_id);
        assert.equal(d.conversation.last_message_id, note.message_id);
        assert.equal(d.conversation.message_sequence, 4);
        assert.equal(d.unread, 2);
        const page = await store.getConversation({ actorUid: 'agent-a', conversationId: first.conversation_id, view: 'messages', after: 1, limit: 2 });
        assert.deepEqual(page.rows.map((m) => m.sequence), [2, 3]);
        assert.equal(page.rows[1].reply_to_message_id, first.message_id);
        assert.equal(h.sql(`select count(*) from public.outbox_events where aggregate_id='${outbound.message_id}' and event_type='attendance.message.pending';`), '1');
      });
      await scenario('replay idempotente sequencial, conflito de payload e escopo por canal', async () => {
        const one = await store.ingestMessage(event('repeat'));
        const two = await store.ingestMessage(event('repeat'));
        assert.equal(one.message_id, two.message_id); assert.equal(two.duplicate, true);
        assert.equal((await detail(one.conversation_id)).unread, 1);
        await assert.rejects(store.ingestMessage(event('repeat', 'external-user', { content: { text: 'changed' } })), /attendance_idempotency_conflict/);
        const other = await store.ingestMessage(event('repeat', 'external-user', { connection_id: ids.otherConnection, channel_id: ids.otherChannel }));
        assert.notEqual(other.message_id, one.message_id);
        const args = { actorUid: 'agent-a', conversationId: one.conversation_id, message: { client_request_id: 'repeated-out', content: { text: 'send once' } } };
        const out = await store.appendMessage(args);
        assert.equal((await store.appendMessage(args)).message_id, out.message_id);
        await assert.rejects(store.appendMessage({ ...args, message: { ...args.message, content: { text: 'other' } } }), /attendance_idempotency_conflict/);
      });
      await scenario('20 requests concorrentes da mesma mensagem: um único efeito persistido', async () => {
        const input = event('race-duplicate', 'race-contact');
        const results = await race(`attendance:message:${ids.channel}:race-duplicate`, Array.from({ length: 20 }, () => () => store.ingestMessage(input)));
        assert.equal(new Set(results.map((r) => r.message_id)).size, 1);
        assert.equal(results.filter((r) => !r.duplicate).length, 1);
        const id = results[0].conversation_id;
        assert.equal((await detail(id)).unread, 1);
        assert.equal(h.sql(`select count(*) from public.conversation_events where conversation_id='${id}';`), '2');
        assert.equal(h.sql(`select count(*) from public.outbox_events where aggregate_id='${results[0].message_id}';`), '1');
      });
      await scenario('20 mensagens distintas concorrentes: uma conversa, sequência e last_message consistentes', async () => {
        const results = await race(`attendance:contact:${ids.connection}:provider_user:race-new-conversation`,
          Array.from({ length: 20 }, (_, n) => () => store.ingestMessage(event(`race-${n}`, 'race-new-conversation'))));
        assert.equal(new Set(results.map((r) => r.conversation_id)).size, 1);
        assert.deepEqual(results.map((r) => r.sequence).sort((a,b) => a-b), Array.from({ length: 20 }, (_, i) => i+1));
        const d = await detail(results[0].conversation_id);
        assert.equal(d.conversation.message_sequence, 20); assert.equal(d.unread, 20);
        assert.equal(d.conversation.last_message_id, results.find((r) => r.sequence === 20).message_id);
      });
      await scenario('metadata e assignment concorrentes usam versão: um vencedor, retry sem perda', async () => {
        const id = first.conversation_id;
        const version = (await detail(id)).conversation.version;
        const cmds = ['left','right'].map((k) => ({ action: 'metadata', client_action_id: k, expected_version: version, metadata: { [k]: true } }));
        const outcomes = await conversationRace(id,cmds.map((command) => () => store.updateConversation({ actorUid: 'agent-a', conversationId: id, command })));
        assert.equal(outcomes.filter((r) => r.status === 'fulfilled').length, 1);
        const failedIndex = outcomes.findIndex((r) => r.status === 'rejected');
        assert.match(outcomes[failedIndex].reason.message, /attendance_version_conflict/);
        await update(id, { ...cmds[failedIndex], expected_version: (await detail(id)).conversation.version }, 'agent-a');
        assert.deepEqual((await detail(id)).conversation.metadata, { left: true, right: true });
        const current = (await detail(id)).conversation.version;
        const assignments = await conversationRace(id,['agent-a','supervisor'].map((uid) => () => store.updateConversation({ actorUid: 'supervisor', conversationId: id,
          command: { action: 'assignment', client_action_id: `assign-${uid}`, expected_version: current, assigned_user_uid: uid } })));
        assert.equal(assignments.filter((r) => r.status === 'fulfilled').length, 1);
        assert.match(assignments.find((r) => r.status === 'rejected').reason.message, /attendance_version_conflict/);
      });
      await scenario('metadata concorrente com nova mensagem não perde last_message nem campos', async () => {
        const created=await store.ingestMessage(event('mixed-first','mixed'));
        const current=(await detail(created.conversation_id)).conversation.version;
        const command={action:'metadata',client_action_id:'mixed-edit',expected_version:current,metadata:{label:'updated'}};
        const results=await conversationRace(created.conversation_id,[
          ()=>store.ingestMessage(event('mixed-second','mixed')),
          ()=>store.updateConversation({actorUid:'agent-a',conversationId:created.conversation_id,command}),
        ]);
        assert.equal(results[0].status,'fulfilled');
        if(results[1].status==='rejected') {
          assert.match(results[1].reason.message,/attendance_version_conflict/);
          await update(created.conversation_id,{...command,expected_version:(await detail(created.conversation_id)).conversation.version},'agent-a');
        }
        const d=await detail(created.conversation_id);
        assert.equal(d.conversation.last_message_id,results[0].value.message_id);
        assert.equal(d.conversation.message_sequence,2);
        assert.equal(d.conversation.metadata.label,'updated');
      });
      await scenario('time A não lê/escreve B; nem admin lógico/participante antigo ignora membership', async () => {
        const other = await store.ingestMessage(event('private', 'private', { connection_id: ids.otherConnection, channel_id: ids.otherChannel }));
        await assert.rejects(detail(other.conversation_id), /attendance_forbidden/);
        assert.equal((await detail(other.conversation_id,'agent-b')).conversation.team_id, ids.otherTeam);
        assert.equal((await store.listConversations({ actorUid: 'agent-a', filters: { team_id: ids.otherTeam } })).rows.length, 0);
        await assert.rejects(detail(first.conversation_id,'disabled'), /attendance_forbidden/);
        await assert.rejects(detail(first.conversation_id,'unassigned'), /attendance_forbidden/);
        await assert.rejects(store.appendMessage({ actorUid: 'agent-a', conversationId: other.conversation_id,
          message: { client_request_id: 'denied', content: { text: 'no' } } }), /attendance_forbidden/);
        await assert.rejects(update(first.conversation_id, { action: 'assignment', assigned_user_uid: 'agent-b' }), /attendance_forbidden/);
        await assert.rejects(update(first.conversation_id, { action: 'assignment', assigned_user_uid: 'agent-a' },'agent-a'), /attendance_forbidden/);
        await update(first.conversation_id, { action: 'assignment', team_id: ids.otherTeam, assigned_user_uid: 'agent-b' });
        await assert.rejects(detail(first.conversation_id), /attendance_forbidden/);
        assert.equal((await detail(first.conversation_id,'agent-b')).conversation.assigned_user_uid,'agent-b');
      });
      await scenario('constraints reais: referências, estados, sender/reply e secrets', async () => {
        await assert.rejects(store.ingestMessage(event('bad-channel','bad', { channel_id: '99999999-9999-9999-9999-999999999999' })), /attendance_channel_not_found/);
        await assert.rejects(store.ingestMessage(event('bad-connection','bad', { connection_id: ids.otherConnection })), /attendance_connection_mismatch/);
        const id = first.conversation_id;
        assert.throws(() => h.sql(`update public.conversations set status='invalid' where conversation_id='${id}';`), /check constraint/);
        assert.throws(() => h.sql(`update public.conversations set assigned_user_uid='missing' where conversation_id='${id}';`), /foreign key constraint/);
        assert.throws(() => h.sql(`update public.connections set metadata='{"nested":{"access_token":"forbidden"}}';`), /check constraint/);
        const other = await store.ingestMessage(event('reply-other','reply-other'));
        await assert.rejects(store.appendMessage({ actorUid: 'agent-b', conversationId: id,
          message: { client_request_id: 'cross-reply', content: { text: 'no' }, reply_to_message_id: other.message_id } }), /foreign key constraint/);
        assert.throws(() => h.sql(`update public.conversations set last_message_id='${other.message_id}' where conversation_id='${id}';`), /foreign key constraint/);
        assert.throws(() => h.sql(`update public.messages set sender_participant_id=(select participant_id from public.conversation_participants
          where conversation_id='${id}' and participant_role='agent' limit 1) where message_id='${first.message_id}';`),/attendance_invalid_sender/);
        const direct = event('event-id-1','event-dedupe',{ external_event_id: 'normalized-item-1' });
        await store.ingestMessage(direct);
        await assert.rejects(store.ingestMessage({ ...direct, external_message_id: 'event-id-2' }), /unique constraint/);
        assert.equal(h.sql("select count(*) from public.messages where external_message_id='event-id-2';"), '0');
      });
      await scenario('telefone não resolve pessoa; vínculo manual posterior e remoção auditados', async () => {
        const input = await store.ingestMessage(event('identity','identity'));
        let d = await detail(input.conversation_id);
        assert.equal(d.participants[0].resolution_state,'unidentified');
        assert.equal(d.participants[0].internal_person_id,null);
        assert.equal(h.sql(`select normalized_phone from public.contact_identities where external_identifier='identity';`),'+5555999991234');
        await update(input.conversation_id,{ action:'identity',resolution_state:'linked',internal_source:'firestore',
          internal_person_type:'student',internal_person_id:'test-document-id',resolution_origin:'manual_verified_reference' },'supervisor',true);
        d=await detail(input.conversation_id);
        assert.equal(d.participants[0].resolution_confidence,'manual');
        assert.equal(d.participants[0].internal_person_id,'test-document-id');
        await update(input.conversation_id,{ action:'identity',resolution_state:'unidentified' },'supervisor',true);
        assert.equal((await detail(input.conversation_id)).participants[0].internal_person_id,null);
        for (const [raw,country,expected,state] of [
          ['(11) 99999-1234','55','+5511999991234','format_only'], ['+1 (202) 555-0123',null,'+12025550123','format_only'],
          ['2025550123','1','+12025550123','format_only'], ['11999991234',null,null,'needs_country'],
          ['0012025550123',null,null,'needs_country'], ['+5511999991234 ext 9',null,null,'invalid'],
          ['+123',null,null,'invalid'], ['',null,null,'absent'] ]) {
          const phone=scalar(`select public.attendance_normalize_phone(${quote(raw)},${country ? quote(country) : 'null'});`);
          assert.equal(phone.normalized,expected); assert.equal(phone.state,state);
        }
      });
      await scenario('cursor unread individual, monotônico; resolução e replay não criam episódio extra', async () => {
        const input=await store.ingestMessage(event('read-one','read-state'));
        await store.ingestMessage(event('read-two','read-state'));
        await store.markRead({ actorUid:'agent-a',conversationId:input.conversation_id,sequence:2 });
        await store.markRead({ actorUid:'agent-a',conversationId:input.conversation_id,sequence:1 });
        assert.equal((await detail(input.conversation_id)).unread,0);
        assert.equal((await detail(input.conversation_id,'supervisor')).unread,2);
        const beforeEvents=h.sql(`select count(*) from public.conversation_events where conversation_id='${input.conversation_id}';`);
        const pendingCmd={action:'status',status:'pending',client_action_id:'pending-idempotent',expected_version:(await detail(input.conversation_id)).conversation.version};
        await store.updateConversation({actorUid:'agent-a',conversationId:input.conversation_id,command:pendingCmd});
        const pendingAgain=await store.updateConversation({actorUid:'agent-a',conversationId:input.conversation_id,command:pendingCmd});
        assert.equal(pendingAgain.duplicate,true);
        assert.equal(Number(h.sql(`select count(*) from public.conversation_events where conversation_id='${input.conversation_id}';`)),Number(beforeEvents)+1);
        await assert.rejects(store.markRead({ actorUid:'agent-a',conversationId:input.conversation_id,sequence:3 }),/attendance_invalid_read_cursor/);
        await update(input.conversation_id,{ action:'status',status:'resolved' });
        const duplicate=await store.ingestMessage(event('read-one','read-state'));
        assert.equal(duplicate.conversation_id,input.conversation_id);
        const next=await store.ingestMessage(event('read-three','read-state'));
        assert.notEqual(next.conversation_id,input.conversation_id);
        await assert.rejects(store.appendMessage({ actorUid:'agent-a',conversationId:input.conversation_id,
          message:{ client_request_id:'resolved-send',content:{ text:'blocked' } } }),/attendance_conversation_resolved/);
      });
      await scenario('RLS/grants bloqueiam tabelas e RPCs de browser; helpers não expostos ao service role', async () => {
        for (const role of ['anon','authenticated','service_role']) {
          assert.throws(() => h.sql(`set role ${role}; select * from public.messages;`), /permission denied/);
          assert.throws(() => h.sql(`set role ${role}; select public.attendance_record_event(null,'test',null,'test','{}');`), /permission denied/);
        }
        for (const role of ['anon','authenticated']) {
          const res=await fetch(h.url+'/rpc/attendance_list_conversations',{ method:'POST',headers:{ Authorization:`Bearer ${h.token(role)}`,'Content-Type':'application/json' },body:JSON.stringify({p_actor_uid:'supervisor'}) });
          assert.equal(res.ok,false);
        }
        assert.throws(() => h.sql('update public.conversation_events set source=\'tampered\';'),/attendance_event_immutable/);
        assert.throws(() => h.sql('delete from public.conversation_events;'),/attendance_event_immutable/);
      });
      await scenario('falha na outbox desfaz contato, conversa, mensagem e auditoria atomicamente', async () => {
        const counts=() => scalar(`select json_build_object('messages',(select count(*) from public.messages),'contacts',(select count(*) from public.contacts),
          'conversations',(select count(*) from public.conversations),'events',(select count(*) from public.conversation_events),'audit',(select count(*) from public.audit_logs));`);
        const before=counts();
        h.sql(`create function public.attendance_test_failure() returns trigger language plpgsql as $$ begin raise exception 'forced_outbox_failure'; end $$;
          create trigger attendance_fail_outbox before insert on public.outbox_events for each row
          when(new.aggregate_type='attendance.message') execute function public.attendance_test_failure();`);
        await assert.rejects(store.ingestMessage(event('atomic-failure','atomic-failure')),/forced_outbox_failure/);
        assert.deepEqual(counts(),before);
        h.sql('drop trigger attendance_fail_outbox on public.outbox_events; drop function public.attendance_test_failure();');
        const retry=await store.ingestMessage(event('atomic-failure','atomic-failure'));
        assert.equal(retry.duplicate,false);
      });
      await scenario('fixture de certificação persiste outbox isolada antes do commit', async () => {
        h.sql(`update public.connections set provider='attendance_validation',metadata='{"validation_run_id":"attendance-prod-validation-local"}' where connection_id='${ids.connection}';`);
        const inbound = await store.ingestMessage(event('quarantined','quarantined',{provider:'attendance_validation'}));
        const outbound = await store.appendMessage({actorUid:'agent-a',conversationId:inbound.conversation_id,
          message:{client_request_id:'quarantined-out',content:{text:'Synthetic'}}});
        for (const id of [inbound.message_id,outbound.message_id]) {
          const row = scalar(`select row_to_json(x) from (select delivery_status,available_at::text,payload,event_type,attempts from public.outbox_events where aggregate_id='${id}') x;`);
          assert.equal(row.delivery_status,'failed'); assert.equal(row.available_at,'infinity');
          assert.equal(row.payload.dispatch_disabled,true); assert.equal(row.attempts,0);
          assert.match(row.event_type,/^attendance.validation\./);
        }
        h.sql(`update public.connections set provider='test_provider',metadata='{}' where connection_id='${ids.connection}';`);
      });
      await scenario('migration reaplicável preserva dados; compatibilidade com SQL de Retenção existente', async () => {
        const before=h.sql('select count(*) from public.messages;');
        h.migrate();
        assert.equal(h.sql('select count(*) from public.messages;'),before);
        // Apply existing SQL afterwards: common tables must remain contract-compatible.
        h.sql(fs.readFileSync(require.resolve('../supabase/retention-lifecycle-v2.sql'),'utf8'));
        h.migrate();
        assert.equal(h.sql('select count(*) from public.messages;'),before);
        assert.equal(h.sql("select count(*) from public.audit_logs where action like 'attendance.%';"),h.sql('select count(*) from public.conversation_events;'));
      });
    } finally {
      h.cleanup();
      summary.cleanedUp=true;
      if (process.env.ATTENDANCE_TEST_SUMMARY_PATH) fs.writeFileSync(process.env.ATTENDANCE_TEST_SUMMARY_PATH,JSON.stringify(summary,null,2));
    }
  });
