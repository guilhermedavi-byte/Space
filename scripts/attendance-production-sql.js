const q=v=>`'${String(v).replace(/'/g,"''")}'`;
const domain=['connections','teams','attendance_members','team_members','channels','channel_teams','contacts','contact_identities','channel_contact_state','conversations','conversation_participants','messages','conversation_reads','conversation_events'];
function scope(m){
 return `create temp table av_connections as select connection_id from public.connections where connection_id=${q(m.connection)} and provider='attendance_validation' and metadata->>'validation_run_id'=${q(m.run)};
create temp table av_channels as select channel_id from public.channels where connection_id in(select * from av_connections);
create temp table av_contacts as select distinct contact_id from public.contact_identities where connection_id in(select * from av_connections);
create temp table av_conversations as select conversation_id from public.conversations where channel_id in(select * from av_channels);
create temp table av_messages as select message_id from public.messages where conversation_id in(select * from av_conversations);
create temp table av_events as select conversation_event_id from public.conversation_events where conversation_id in(select * from av_conversations);
create temp table av_audit as select id from public.audit_logs where entity_id in(select * from av_conversations) and entity_type='attendance.conversation' and action like 'attendance.%';
create temp table av_outbox as select id from public.outbox_events where payload->>'validation_run_id'=${q(m.run)} and event_type like 'attendance.validation.%' and ((aggregate_type='attendance.message' and aggregate_id in(select * from av_messages)) or (aggregate_type='attendance.conversation' and aggregate_id in(select * from av_conversations)));
do $$ begin
 if (select count(*) from av_connections)<>1 then raise exception 'attendance_scope_missing';end if;
 if exists(select 1 from public.conversations where contact_id in(select * from av_contacts) and conversation_id not in(select * from av_conversations))
 or exists(select 1 from public.contact_identities where contact_id in(select * from av_contacts) and connection_id not in(select * from av_connections))
 or exists(select 1 from public.outbox_events where ((aggregate_type='attendance.message' and aggregate_id in(select * from av_messages)) or (aggregate_type='attendance.conversation' and aggregate_id in(select * from av_conversations))) and id not in(select * from av_outbox))
 then raise exception 'attendance_scope_external_reference';end if;
end $$;`;
}
function selectors(m){return {
 connections:'connection_id in(select * from av_connections)',channels:'channel_id in(select * from av_channels)',
 teams:`team_id in(${q(m.teamA)},${q(m.teamB)}) and name in(${q(m.run+' A')},${q(m.run+' B')})`,
 attendance_members:`user_uid in(${[m.agentA,m.agentB,m.supervisor,m.outsider].map(q).join(',')})`,
 team_members:`team_id in(${q(m.teamA)},${q(m.teamB)}) and user_uid in(${[m.agentA,m.agentB,m.supervisor].map(q).join(',')})`,
 channel_teams:'channel_id in(select * from av_channels)',contacts:'contact_id in(select * from av_contacts)',contact_identities:'connection_id in(select * from av_connections)',
 channel_contact_state:'channel_id in(select * from av_channels)',conversations:'conversation_id in(select * from av_conversations)',
 conversation_participants:'conversation_id in(select * from av_conversations)',messages:'message_id in(select * from av_messages)',
 conversation_reads:'conversation_id in(select * from av_conversations)',conversation_events:'conversation_event_id in(select * from av_events)',
 audit_logs:'id in(select * from av_audit)',outbox_events:'id in(select * from av_outbox)'};}
const counts=m=>`jsonb_build_object(${Object.entries(selectors(m)).map(([t,s])=>`${q(t)},(select count(*) from public.${t} where ${s})`).join(',')})`;
function cleanup(m){return `begin; set local lock_timeout='5s';set local statement_timeout='15s';
${scope(m)}
select jsonb_build_object('phase','before_cleanup','validation_run_id',${q(m.run)},'counts',${counts(m)});
lock table public.conversation_events in access exclusive mode;
do $$ begin
 if exists(select 1 from public.team_members where team_id in(${q(m.teamA)},${q(m.teamB)}) and user_uid not in(${[m.agentA,m.agentB,m.supervisor].map(q).join(',')})) then raise exception 'attendance_scope_membership_mismatch';end if;
end $$;
alter table public.conversation_events disable trigger attendance_events_immutable;
update public.conversations set last_message_id=null where conversation_id in(select * from av_conversations);
update public.messages set reply_to_message_id=null where message_id in(select * from av_messages);
${['outbox_events','audit_logs','conversation_reads','conversation_events','messages','conversation_participants','conversations','channel_contact_state','contact_identities','contacts','channel_teams','channels','connections','team_members','teams','attendance_members'].map(t=>`delete from public.${t} where ${selectors(m)[t]};`).join('\n')}
alter table public.conversation_events enable trigger attendance_events_immutable;
do $$ declare remaining bigint;begin select sum(value::text::bigint) into remaining from jsonb_each(${counts(m)}); if remaining<>0 then raise exception 'attendance_cleanup_incomplete';end if;end $$;
select jsonb_build_object('phase','after_cleanup','validation_run_id',${q(m.run)},'counts',${counts(m)},'remaining_test_records_after_cleanup',0,'permanent_domain_tables',(select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relname=any(array[${domain.map(q).join(',')}])));
commit;`;
}
function verify(m){return `begin;set local statement_timeout='10s';
${scope(m)}
select jsonb_build_object('validation_run_id',${q(m.run)},'counts',${counts(m)},
 'duplicate_persistence_count',(select coalesce(sum(n-1),0) from (select count(*) n from public.messages where message_id in(select * from av_messages) group by channel_id,external_message_id having external_message_id is not null and count(*)>1 union all select count(*) n from public.messages where message_id in(select * from av_messages) group by conversation_id,author_uid,client_request_id having client_request_id is not null and count(*)>1 union all select count(*) n from public.conversations where conversation_id in(select * from av_conversations) and status<>'resolved' group by channel_id,contact_id having count(*)>1) d),
 'audit_event_mismatch',(select abs((select count(*) from av_audit)-(select count(*) from av_events))),
 'outbox_unsafe_count',(select count(*) from public.outbox_events where id in(select * from av_outbox) and (delivery_status<>'failed' or available_at<>'infinity'::timestamptz or attempts<>0 or payload->>'dispatch_disabled'<>'true')),
 'transport_side_effect_count',(select count(*) from public.messages where message_id in(select * from av_messages) and transport_status not in('received','pending','internal')),
 'normalized_identity_count',(select count(*) from public.contact_identities where contact_id in(select * from av_contacts) and normalized_phone='+12025550100' and phone_normalization_state='format_only'),
 'missing_last_message_count',(select count(*) from public.conversations c where c.conversation_id in(select * from av_conversations) and not exists(select 1 from public.messages mm where mm.message_id=c.last_message_id and mm.sequence=c.message_sequence)));
rollback;`;
}
function matrix(m){
 const conv=`(select conversation_id from public.conversations where channel_id=${q(m.channelA)} order by created_at limit 1)`;
 // Resolve IDs/version as postgres before impersonating the application role.
 return `begin;set local statement_timeout='15s';create temp table attendance_matrix(principal text,operation text,allowed boolean,error_code text);
do $matrix$ declare role_name text; principal text; actor text; cid uuid; version_now bigint; entry record; permitted boolean; code text; begin
select conversation_id,version into cid,version_now from public.conversations where conversation_id=${conv};
foreach principal in array array['anon','authenticated_no_membership','authenticated_with_membership','service_role'] loop
 role_name:=case when principal like 'authenticated%' then 'authenticated' else principal end;
 actor:=case when principal='authenticated_no_membership' then ${q(m.outsider)} else ${q(m.supervisor)} end;
 perform set_config('request.jwt.claims',jsonb_build_object('role',role_name,'sub',actor)::text,true);
 for entry in select * from (values
 ('conversation_read',format('select public.attendance_get_conversation(%L,%L)',actor,cid)),
 ('messages_read',format('select public.attendance_get_conversation(%L,%L,%L)',actor,cid,'messages')),
 ('inbound',format('select public.attendance_ingest_message(%L::jsonb)',jsonb_build_object('provider','attendance_validation','connection_id',${q(m.connection)},'channel_id',${q(m.channelA)},'external_message_id',${q(m.run+'-matrix')},'external_contact_id',${q(m.run+'-main')},'content',jsonb_build_object('text','matrix')))),
 ('outbound_intent',format('select public.attendance_append_message(%L,%L,%L::jsonb)',actor,cid,jsonb_build_object('client_request_id',${q(m.run+'-matrix-out')},'content',jsonb_build_object('text','matrix')))),
 ('assignment',format('select public.attendance_update_conversation(%L,%L,%L::jsonb)',actor,cid,jsonb_build_object('action','assignment','client_action_id',${q(m.run+'-matrix-assign')},'expected_version',version_now,'assigned_user_uid',actor))),
 ('status',format('select public.attendance_update_conversation(%L,%L,%L::jsonb)',actor,cid,jsonb_build_object('action','status','client_action_id',${q(m.run+'-matrix-status')},'expected_version',version_now,'status','pending'))),
 ('identity_link',format('select public.attendance_update_conversation(%L,%L,%L::jsonb)',actor,cid,jsonb_build_object('action','identity','client_action_id',${q(m.run+'-matrix-identity')},'expected_version',version_now,'resolution_state','linked','internal_source','synthetic_validation','internal_person_type','lead','internal_person_id',${q(m.run)},'resolution_origin','manual_test'))),
 ('audit','select id from public.audit_logs limit 0'),('outbox','select id from public.outbox_events limit 0')
 ) entries(operation,statement) loop
 permitted:=false;code:=null;
 begin
  execute format('set local role %I',role_name);execute entry.statement;permitted:=true;
  raise exception using errcode='Z0001',message='rollback_permission_probe';
 exception when sqlstate 'Z0001' then null;when others then code:=sqlstate;end;
 reset role;
 insert into attendance_matrix values(principal,entry.operation,permitted,code);
 end loop;
end loop;end $matrix$;
select jsonb_agg(to_jsonb(m) order by principal,operation) as permission_matrix from attendance_matrix m;
rollback;`;
}
function performance(m){return `begin;set local statement_timeout='5s';create temp table attendance_plans(ordinal integer,plan jsonb);
${[
 `select * from public.conversations where team_id=${q(m.teamA)} and status='open' order by last_message_at desc nulls last,conversation_id desc limit 50`,
 `select * from public.conversations where assigned_user_uid=${q(m.agentA)} order by last_message_at desc nulls last,conversation_id desc limit 50`,
 `select * from public.conversations where team_id=${q(m.teamA)} and status='open' limit 50`,
 `select * from public.conversations where team_id=${q(m.teamA)} order by last_message_at desc nulls last,conversation_id desc limit 50`,
 `select * from public.messages where conversation_id=(select conversation_id from public.conversations where channel_id=${q(m.channelA)} order by created_at limit 1) order by sequence limit 50`,
 `select * from public.messages where channel_id=${q(m.channelA)} and external_message_id=${q(m.run+'-first')}`,
 `select * from public.contact_identities where connection_id=${q(m.connection)} and identifier_type='provider_user' and external_identifier=${q(m.run+'-main')}`
 ].map((s,i)=>`do $plan$ declare p jsonb;begin execute ${q('explain (analyze,buffers,format json) '+s)} into p;insert into attendance_plans values(${i+1},p);end $plan$;`).join('\n')}
select jsonb_agg(to_jsonb(p) order by ordinal) as performance from attendance_plans p;
rollback;`;}
module.exports={cleanup,verify,matrix,performance};
