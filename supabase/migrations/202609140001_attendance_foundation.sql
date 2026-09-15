-- Messaging foundation. No provider calls, credentials, legacy writes or dispatchers.
-- Apply only after validating the target environment; see docs/attendance-foundation.md.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- Same contract as retention-lifecycle-v2.sql; no dependency on enabling Retention.
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(), entity_type text not null,
  entity_id uuid, action text not null, actor_uid text, actor_name text,
  actor_role text, justification text, payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create table if not exists public.outbox_events (
  id uuid primary key default gen_random_uuid(), aggregate_type text not null,
  aggregate_id uuid, event_type text not null, payload jsonb not null default '{}'::jsonb,
  delivery_status text not null default 'pending'
    check (delivery_status in ('pending','processing','delivered','failed')),
  available_at timestamptz not null default now(), attempts integer not null default 0 check (attempts >= 0),
  last_error text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.audit_logs enable row level security;
alter table public.outbox_events enable row level security;

create or replace function public.attendance_metadata_safe(p_value jsonb)
returns boolean language plpgsql immutable set search_path = pg_catalog, public as $$
declare k text; v jsonb;
begin
  if p_value is null or jsonb_typeof(p_value) <> 'object' or octet_length(p_value::text) > 8192 then return false; end if;
  for k, v in select * from jsonb_each(p_value) loop
    if k ~* '(token|secret|password|authorization|credential|api.?key)' then return false; end if;
    if jsonb_typeof(v) = 'object' and not public.attendance_metadata_safe(v) then return false; end if;
    -- Metadata is deliberately flat or nested objects, not arbitrary provider envelopes.
    if jsonb_typeof(v) = 'array' then return false; end if;
  end loop;
  return true;
end $$;

create table if not exists public.connections (
  connection_id uuid primary key default gen_random_uuid(),
  provider text not null check (provider ~ '^[a-z][a-z0-9_]{0,63}$'),
  external_account_id text not null check (length(external_account_id) between 1 and 256),
  external_account_type text not null default 'account', display_name text not null,
  status text not null default 'pending' check (status in ('pending','active','disabled')),
  metadata jsonb not null default '{}' check (public.attendance_metadata_safe(metadata)),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(provider, external_account_type, external_account_id)
);
create table if not exists public.teams (
  team_id uuid primary key default gen_random_uuid(), name text not null unique check (length(name) between 1 and 100),
  active boolean not null default true, created_at timestamptz not null default now()
);
create table if not exists public.attendance_members (
  user_uid text primary key check (length(user_uid) between 1 and 128),
  enabled boolean not null default false, created_at timestamptz not null default now()
);
create table if not exists public.team_members (
  team_id uuid not null references public.teams, user_uid text not null references public.attendance_members,
  member_role text not null default 'agent' check (member_role in ('agent','supervisor')),
  active boolean not null default true, primary key(team_id, user_uid)
);
create table if not exists public.channels (
  channel_id uuid primary key default gen_random_uuid(), connection_id uuid not null references public.connections,
  external_channel_id text not null check (length(external_channel_id) between 1 and 256),
  display_name text not null, status text not null default 'pending' check(status in ('pending','active','disabled')),
  default_team_id uuid not null references public.teams,
  metadata jsonb not null default '{}' check(public.attendance_metadata_safe(metadata)),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(connection_id, external_channel_id), unique(channel_id, connection_id)
);
create table if not exists public.channel_teams (
  channel_id uuid not null references public.channels, team_id uuid not null references public.teams,
  primary key(channel_id, team_id)
);
-- Deferred only to allow inserting a channel and its default-team grant in one transaction.
do $$ begin
  if not exists(select 1 from pg_constraint where conrelid='public.channels'::regclass and conname='channels_default_team_grant_fk') then
    alter table public.channels add constraint channels_default_team_grant_fk
      foreign key(channel_id, default_team_id) references public.channel_teams(channel_id, team_id)
      deferrable initially deferred;
  end if;
end $$;
create table if not exists public.contacts (
  contact_id uuid primary key default gen_random_uuid(), display_name text,
  created_at timestamptz not null default now()
);
create table if not exists public.contact_identities (
  contact_identity_id uuid primary key default gen_random_uuid(), contact_id uuid not null references public.contacts,
  connection_id uuid not null references public.connections,
  identifier_type text not null check(length(identifier_type) between 1 and 64),
  external_identifier text not null check(length(external_identifier) between 1 and 256),
  phone_raw text, normalized_phone text check(normalized_phone ~ '^\+[1-9][0-9]{7,14}$'),
  phone_normalization_state text not null default 'absent'
    check(phone_normalization_state in ('absent','invalid','needs_country','format_only')),
  created_at timestamptz not null default now(),
  check((phone_normalization_state='format_only')=(normalized_phone is not null)),
  unique(connection_id, identifier_type, external_identifier), unique(contact_identity_id, contact_id)
);
create table if not exists public.channel_contact_state (
  channel_id uuid not null references public.channels, contact_id uuid not null references public.contacts,
  last_customer_message_at timestamptz, primary key(channel_id, contact_id)
);
create table if not exists public.conversations (
  conversation_id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.channels, contact_id uuid not null references public.contacts,
  team_id uuid not null, assigned_user_uid text,
  external_conversation_id text, origin text not null default 'external',
  status text not null default 'open' check(status in ('open','pending','resolved')),
  priority text not null default 'normal' check(priority in ('normal','high','urgent')),
  metadata jsonb not null default '{}' check(public.attendance_metadata_safe(metadata)),
  last_message_id uuid, last_message_at timestamptz, last_inbound_at timestamptz,
  message_sequence bigint not null default 0 check(message_sequence >= 0),
  version bigint not null default 1 check(version > 0),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), resolved_at timestamptz,
  foreign key(channel_id, team_id) references public.channel_teams,
  foreign key(team_id, assigned_user_uid) references public.team_members,
  unique(conversation_id, channel_id), unique(conversation_id, contact_id),
  check((status = 'resolved') = (resolved_at is not null))
);
create unique index if not exists conversations_one_active_contact_idx
  on public.conversations(channel_id, contact_id) where status <> 'resolved';
create index if not exists conversations_team_queue_idx
  on public.conversations(team_id, status, last_message_at desc nulls last, conversation_id desc);
create index if not exists conversations_assignee_queue_idx
  on public.conversations(assigned_user_uid, last_message_at desc nulls last, conversation_id desc)
  where assigned_user_uid is not null;

-- Internal links are contextual to this conversation, never inferred from a phone.
create table if not exists public.conversation_participants (
  participant_id uuid primary key default gen_random_uuid(), conversation_id uuid not null references public.conversations,
  contact_id uuid references public.contacts, user_uid text references public.attendance_members,
  participant_role text not null check(participant_role in ('external','agent')),
  internal_source text, internal_person_type text check(internal_person_type in ('lead','student')),
  internal_person_id text, resolution_state text not null default 'unidentified'
    check(resolution_state in ('unidentified','ambiguous','linked')),
  resolution_confidence text not null default 'unknown' check(resolution_confidence in ('unknown','manual')),
  resolution_origin text, linked_by_uid text references public.attendance_members, linked_at timestamptz,
  created_at timestamptz not null default now(),
  check((participant_role='external' and contact_id is not null and user_uid is null)
    or (participant_role='agent' and user_uid is not null and contact_id is null)),
  check((resolution_state='linked' and internal_source is not null and internal_person_type is not null
      and internal_person_id is not null and length(internal_person_id)>0 and resolution_confidence='manual'
      and linked_by_uid is not null and linked_at is not null and resolution_origin is not null)
    or (resolution_state<>'linked' and internal_source is null and internal_person_type is null
      and internal_person_id is null and linked_by_uid is null and linked_at is null and resolution_confidence='unknown')),
  check(participant_role='external' or resolution_state='unidentified'),
  foreign key(conversation_id, contact_id) references public.conversations(conversation_id, contact_id),
  unique(conversation_id, contact_id), unique(conversation_id, user_uid), unique(participant_id, conversation_id)
);
create table if not exists public.messages (
  message_id uuid primary key default gen_random_uuid(), conversation_id uuid not null, channel_id uuid not null,
  sequence bigint not null check(sequence>0), sender_participant_id uuid not null,
  direction text not null check(direction in ('inbound','outbound','internal')),
  kind text not null check(kind ~ '^[a-z][a-z0-9_]{0,63}$'),
  content jsonb not null check(jsonb_typeof(content)='object' and octet_length(content::text)<=65536),
  transport_status text not null check(transport_status in ('received','pending','sending','accepted','sent','delivered','read','failed','unknown','internal')),
  author_uid text references public.attendance_members, external_message_id text, external_event_id text,
  client_request_id text, fingerprint text not null,
  reply_to_message_id uuid, external_reply_to_id text,
  provider_timestamp timestamptz, received_at timestamptz not null default clock_timestamp(),
  metadata jsonb not null default '{}' check(public.attendance_metadata_safe(metadata)),
  foreign key(conversation_id,channel_id) references public.conversations(conversation_id,channel_id),
  foreign key(sender_participant_id,conversation_id) references public.conversation_participants(participant_id,conversation_id),
  unique(conversation_id, sequence), unique(message_id, conversation_id),
  unique(channel_id,external_message_id), unique(channel_id,external_event_id),
  unique(conversation_id,author_uid,client_request_id),
  check(external_message_id is null or length(external_message_id) between 1 and 256),
  check(external_event_id is null or length(external_event_id) between 1 and 512),
  check(client_request_id is null or length(client_request_id) between 1 and 128),
  check((direction='inbound' and author_uid is null and external_message_id is not null and transport_status='received' and client_request_id is null)
    or (direction='outbound' and author_uid is not null and client_request_id is not null and transport_status not in ('received','internal'))
    or (direction='internal' and author_uid is not null and client_request_id is not null and transport_status='internal' and external_message_id is null))
);
do $$ begin
  if not exists(select 1 from pg_constraint where conrelid='public.messages'::regclass and conname='messages_reply_same_conversation_fk') then
    alter table public.messages add constraint messages_reply_same_conversation_fk
      foreign key(reply_to_message_id,conversation_id) references public.messages(message_id,conversation_id);
  end if;
  if not exists(select 1 from pg_constraint where conrelid='public.conversations'::regclass and conname='conversations_last_message_fk') then
    alter table public.conversations add constraint conversations_last_message_fk
      foreign key(last_message_id,conversation_id) references public.messages(message_id,conversation_id);
  end if;
end $$;
-- (conversation_id,sequence) unique index also serves chronological keyset reads.
create table if not exists public.conversation_reads (
  conversation_id uuid not null references public.conversations,
  user_uid text not null references public.attendance_members,
  last_read_sequence bigint not null default 0 check(last_read_sequence>=0),
  read_at timestamptz not null default now(), primary key(conversation_id,user_uid)
);
create table if not exists public.conversation_events (
  conversation_event_id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations,
  event_type text not null, actor_uid text, source text not null,
  payload jsonb not null default '{}' check(public.attendance_metadata_safe(payload)),
  client_action_id text, fingerprint text, result jsonb,
  created_at timestamptz not null default clock_timestamp(),
  unique(conversation_id,actor_uid,client_action_id)
);
create index if not exists conversation_events_timeline_idx
  on public.conversation_events(conversation_id,created_at,conversation_event_id);
create index if not exists team_members_user_idx on public.team_members(user_uid,team_id) where active;

create or replace function public.attendance_check_sender()
returns trigger language plpgsql set search_path=pg_catalog,public as $$
declare sender public.conversation_participants;
begin
  select * into sender from public.conversation_participants where participant_id=new.sender_participant_id;
  if not found or sender.conversation_id<>new.conversation_id
    or (new.direction='inbound' and sender.participant_role<>'external')
    or (new.direction<>'inbound' and (sender.participant_role<>'agent' or sender.user_uid is distinct from new.author_uid)) then
    raise exception using errcode='23514',message='attendance_invalid_sender';
  end if;
  return new;
end $$;
drop trigger if exists attendance_messages_sender on public.messages;
create trigger attendance_messages_sender before insert or update on public.messages
  for each row execute function public.attendance_check_sender();

create or replace function public.attendance_event_immutable()
returns trigger language plpgsql set search_path=pg_catalog,public as $$
begin raise exception using errcode='23514', message='attendance_event_immutable'; end $$;
drop trigger if exists attendance_events_immutable on public.conversation_events;
create trigger attendance_events_immutable before update or delete on public.conversation_events
  for each row execute function public.attendance_event_immutable();

create or replace function public.attendance_normalize_phone(p_raw text, p_country text default null)
returns jsonb language plpgsql immutable set search_path=pg_catalog,public as $$
declare raw text:=btrim(coalesce(p_raw,'')); digits text; normalized text; state text:='invalid';
begin
  if raw='' then return jsonb_build_object('raw',null,'normalized',null,'state','absent'); end if;
  if length(raw)<=64 and raw ~ '^\+?[0-9 ().-]+$' then
    digits:=regexp_replace(raw,'[^0-9]','','g');
    if left(raw,1)='+' then normalized:='+'||digits;
    elsif p_country='55' and length(digits) in (10,11) and left(digits,1)<>'0' then normalized:='+55'||digits;
    elsif p_country='1' and length(digits)=10 and left(digits,1) between '2' and '9' then normalized:='+1'||digits;
    else state:='needs_country'; end if;
    if normalized is not null then
      if normalized ~ '^\+[1-9][0-9]{7,14}$' then state:='format_only'; else normalized:=null; end if;
    end if;
  end if;
  return jsonb_build_object('raw',raw,'normalized',normalized,'state',state);
end $$;

-- RPC caller is trusted backend only. Firebase authentication is never replaced by p_actor_uid.
create or replace function public.attendance_has_access(p_actor_uid text,p_team_id uuid,p_channel_id uuid,p_supervisor boolean default false)
returns boolean language sql stable security definer set search_path=pg_catalog,public as $$
  select exists(select 1 from public.attendance_members m
    join public.team_members tm on tm.user_uid=m.user_uid
    join public.teams t on t.team_id=tm.team_id
    join public.channel_teams ct on ct.team_id=t.team_id
    where m.user_uid=p_actor_uid and m.enabled and tm.active and t.active
      and t.team_id=p_team_id and ct.channel_id=p_channel_id
      and (not p_supervisor or tm.member_role='supervisor'));
$$;

create or replace function public.attendance_record_event(p_conversation uuid,p_type text,p_actor text,p_source text,p_payload jsonb,
  p_action_id text default null,p_fingerprint text default null,p_result jsonb default null)
returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
declare event_id uuid;
begin
  insert into public.conversation_events(conversation_id,event_type,actor_uid,source,payload,client_action_id,fingerprint,result)
    values(p_conversation,p_type,p_actor,p_source,p_payload,p_action_id,p_fingerprint,p_result)
    returning conversation_event_id into event_id;
  insert into public.audit_logs(entity_type,entity_id,action,actor_uid,payload)
    values('attendance.conversation',p_conversation,'attendance.'||p_type,p_actor,
      jsonb_build_object('event_id',event_id,'source',p_source)||p_payload);
  return event_id;
end $$;

-- One NORMALIZED inbound message. No HTTP ingress is exposed in this phase.
create or replace function public.attendance_ingest_message(p_event jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare
  ch public.channels; conn public.connections; conv public.conversations; existing public.messages;
  identity_row public.contact_identities; contact_uuid uuid; participant_uuid uuid; message_uuid uuid;
  event_id text:=nullif(p_event->>'external_event_id',''); msg_id text:=nullif(p_event->>'external_message_id','');
  ext_contact text:=nullif(p_event->>'external_contact_id',''); identity_type text:=coalesce(nullif(p_event->>'identifier_type',''),'provider_user');
  kind text:=coalesce(p_event->>'kind','text'); body jsonb:=p_event->'content';
  meta jsonb:=coalesce(p_event->'metadata','{}'); phone jsonb; stamp timestamptz; current_stamp timestamptz;
  fp text; result jsonb;
begin
  if msg_id is null or ext_contact is null or body is null then
    raise exception using errcode='22023',message='attendance_invalid_message'; end if;
  select * into ch from public.channels where channel_id=(p_event->>'channel_id')::uuid for share;
  if not found then raise exception using errcode='23503',message='attendance_channel_not_found'; end if;
  select * into conn from public.connections where connection_id=ch.connection_id for share;
  if conn.provider is distinct from p_event->>'provider' or conn.connection_id is distinct from (p_event->>'connection_id')::uuid then
    raise exception using errcode='22023',message='attendance_connection_mismatch'; end if;
  stamp:=(p_event->>'provider_timestamp')::timestamptz;
  fp:=encode(sha256(convert_to(jsonb_build_object('contact',ext_contact,'type',identity_type,'kind',kind,'content',body,
    'provider_timestamp',stamp,'reply',p_event->>'external_reply_to_id')::text,'UTF8')),'hex');
  perform pg_advisory_xact_lock(hashtextextended('attendance:message:'||ch.channel_id||':'||msg_id,0));
  select * into existing from public.messages where channel_id=ch.channel_id and external_message_id=msg_id;
  if found then
    if existing.fingerprint<>fp then raise exception using errcode='23505',message='attendance_idempotency_conflict'; end if;
    return jsonb_build_object('conversation_id',existing.conversation_id,'message_id',existing.message_id,'sequence',existing.sequence,'duplicate',true);
  end if;
  if ch.status<>'active' or conn.status<>'active' then raise exception using errcode='22023',message='attendance_channel_disabled'; end if;
  if not exists(select 1 from public.teams where team_id=ch.default_team_id and active) then
    raise exception using errcode='42501',message='attendance_team_disabled'; end if;
  -- Serialize external identity creation even across two channels of the same connection.
  perform pg_advisory_xact_lock(hashtextextended('attendance:contact:'||ch.connection_id||':'||identity_type||':'||ext_contact,0));
  select * into identity_row from public.contact_identities
    where connection_id=ch.connection_id and identifier_type=identity_type and external_identifier=ext_contact;
  if not found then
    insert into public.contacts(display_name) values(left(p_event->>'display_name',200)) returning contact_id into contact_uuid;
    phone:=public.attendance_normalize_phone(p_event->>'phone_raw',p_event->>'country_calling_code');
    insert into public.contact_identities(contact_id,connection_id,identifier_type,external_identifier,phone_raw,normalized_phone,phone_normalization_state)
      values(contact_uuid,ch.connection_id,identity_type,ext_contact,phone->>'raw',phone->>'normalized',phone->>'state') returning * into identity_row;
  end if;
  select * into conv from public.conversations where channel_id=ch.channel_id and contact_id=identity_row.contact_id and status<>'resolved' for update;
  if not found then
    insert into public.conversations(channel_id,contact_id,team_id,external_conversation_id)
      values(ch.channel_id,identity_row.contact_id,ch.default_team_id,p_event->>'external_conversation_id') returning * into conv;
    perform public.attendance_record_event(conv.conversation_id,'conversation.created',null,'provider',jsonb_build_object('team_id',conv.team_id));
  end if;
  if not exists(select 1 from public.teams where team_id=conv.team_id and active) then
    raise exception using errcode='42501',message='attendance_team_disabled'; end if;
  insert into public.conversation_participants(conversation_id,contact_id,participant_role)
    values(conv.conversation_id,conv.contact_id,'external') on conflict(conversation_id,contact_id) do nothing;
  select participant_id into participant_uuid from public.conversation_participants where conversation_id=conv.conversation_id and contact_id=conv.contact_id;
  current_stamp:=clock_timestamp();
  insert into public.messages(conversation_id,channel_id,sequence,sender_participant_id,direction,kind,content,transport_status,
    external_message_id,external_event_id,fingerprint,external_reply_to_id,provider_timestamp,received_at,metadata)
    values(conv.conversation_id,ch.channel_id,conv.message_sequence+1,participant_uuid,'inbound',kind,body,'received',msg_id,event_id,fp,
      p_event->>'external_reply_to_id',stamp,current_stamp,meta) returning message_id into message_uuid;
  update public.conversations set message_sequence=message_sequence+1,last_message_id=message_uuid,last_message_at=current_stamp,
    last_inbound_at=greatest(last_inbound_at,coalesce(stamp,current_stamp)),updated_at=current_stamp,version=version+1
    where conversation_id=conv.conversation_id;
  insert into public.channel_contact_state(channel_id,contact_id,last_customer_message_at)
    values(ch.channel_id,conv.contact_id,coalesce(stamp,current_stamp))
    on conflict(channel_id,contact_id) do update
      set last_customer_message_at=greatest(channel_contact_state.last_customer_message_at,excluded.last_customer_message_at);
  perform public.attendance_record_event(conv.conversation_id,'message.created',null,'provider',jsonb_build_object('message_id',message_uuid,'sequence',conv.message_sequence+1));
  insert into public.outbox_events(aggregate_type,aggregate_id,event_type,payload)
    values('attendance.message',message_uuid,'attendance.message.created',jsonb_build_object('message_id',message_uuid,'conversation_id',conv.conversation_id));
  result:=jsonb_build_object('conversation_id',conv.conversation_id,'message_id',message_uuid,'sequence',conv.message_sequence+1,'duplicate',false);
  return result;
end $$;

create or replace function public.attendance_append_message(p_actor_uid text,p_conversation_id uuid,p_message jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare conv public.conversations; existing public.messages; participant_uuid uuid; message_uuid uuid; stamp timestamptz;
  direction text:=coalesce(p_message->>'direction','outbound'); req_id text:=nullif(p_message->>'client_request_id','');
  fp text; event_name text;
begin
  select * into conv from public.conversations where conversation_id=p_conversation_id for update;
  if not found or not public.attendance_has_access(p_actor_uid,conv.team_id,conv.channel_id) then
    raise exception using errcode='42501',message='attendance_forbidden'; end if;
  if direction not in ('outbound','internal') or req_id is null or p_message->'content' is null then
    raise exception using errcode='22023',message='attendance_invalid_message'; end if;
  fp:=encode(sha256(convert_to((p_message-'client_request_id')::text,'UTF8')),'hex');
  select * into existing from public.messages where conversation_id=p_conversation_id and author_uid=p_actor_uid and client_request_id=req_id;
  if found then
    if existing.fingerprint<>fp then raise exception using errcode='23505',message='attendance_idempotency_conflict'; end if;
    return jsonb_build_object('message_id',existing.message_id,'conversation_id',p_conversation_id,'sequence',existing.sequence,'duplicate',true,'status',existing.transport_status);
  end if;
  if conv.status='resolved' then raise exception using errcode='22023',message='attendance_conversation_resolved'; end if;
  if direction='outbound' and not exists(select 1 from public.channels ch join public.connections c using(connection_id)
      where ch.channel_id=conv.channel_id and ch.status='active' and c.status='active') then
    raise exception using errcode='22023',message='attendance_channel_disabled'; end if;
  insert into public.conversation_participants(conversation_id,user_uid,participant_role)
    values(p_conversation_id,p_actor_uid,'agent') on conflict(conversation_id,user_uid) do nothing;
  select participant_id into participant_uuid from public.conversation_participants where conversation_id=p_conversation_id and user_uid=p_actor_uid;
  stamp:=clock_timestamp();
  insert into public.messages(conversation_id,channel_id,sequence,sender_participant_id,direction,kind,content,transport_status,author_uid,
    client_request_id,fingerprint,reply_to_message_id,received_at,metadata)
    values(p_conversation_id,conv.channel_id,conv.message_sequence+1,participant_uuid,direction,coalesce(p_message->>'kind','text'),p_message->'content',
      case when direction='internal' then 'internal' else 'pending' end,p_actor_uid,req_id,fp,(p_message->>'reply_to_message_id')::uuid,stamp,
      coalesce(p_message->'metadata','{}')) returning message_id into message_uuid;
  update public.conversations set message_sequence=message_sequence+1,last_message_id=message_uuid,last_message_at=stamp,updated_at=stamp,version=version+1
    where conversation_id=p_conversation_id;
  perform public.attendance_record_event(p_conversation_id,'message.created',p_actor_uid,'space',jsonb_build_object('message_id',message_uuid,'direction',direction));
  event_name:=case when direction='outbound' then 'attendance.message.pending' else 'attendance.message.created' end;
  insert into public.outbox_events(aggregate_type,aggregate_id,event_type,payload)
    values('attendance.message',message_uuid,event_name,jsonb_build_object('message_id',message_uuid,'conversation_id',p_conversation_id));
  return jsonb_build_object('message_id',message_uuid,'conversation_id',p_conversation_id,'sequence',conv.message_sequence+1,'duplicate',false,
    'status',case when direction='internal' then 'internal' else 'pending' end);
end $$;

create or replace function public.attendance_update_conversation(p_actor_uid text,p_conversation_id uuid,p_command jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare conv public.conversations; saved public.conversation_events; fp text; cmd text:=p_command->>'action';
  action_id text:=nullif(p_command->>'client_action_id',''); target_team uuid; target_uid text; result jsonb; delta jsonb; event_name text;
begin
  select * into conv from public.conversations where conversation_id=p_conversation_id for update;
  if not found or not public.attendance_has_access(p_actor_uid,conv.team_id,conv.channel_id) then
    raise exception using errcode='42501',message='attendance_forbidden'; end if;
  if action_id is null or length(action_id)>128 or cmd is null then raise exception using errcode='22023',message='attendance_invalid_command'; end if;
  fp:=encode(sha256(convert_to(p_command::text,'UTF8')),'hex');
  select * into saved from public.conversation_events where conversation_id=p_conversation_id and actor_uid=p_actor_uid and client_action_id=action_id;
  if found then
    if saved.fingerprint<>fp then raise exception using errcode='23505',message='attendance_idempotency_conflict'; end if;
    return saved.result||jsonb_build_object('duplicate',true);
  end if;
  if (p_command->>'expected_version')::bigint is distinct from conv.version then
    -- 40001 is retried by PostgREST/Hasql. This is an application version conflict,
    -- not a serialization failure: return 409 immediately instead of retrying forever.
    raise exception using errcode='PT409',message='attendance_version_conflict'; end if;
  if cmd='assignment' then
    target_team:=coalesce((p_command->>'team_id')::uuid,conv.team_id); target_uid:=nullif(p_command->>'assigned_user_uid','');
    -- Safest baseline: only supervisors may assign/transfer, and need access to both teams.
    if not public.attendance_has_access(p_actor_uid,conv.team_id,conv.channel_id,true)
       or not public.attendance_has_access(p_actor_uid,target_team,conv.channel_id,true)
       or (target_uid is not null and not public.attendance_has_access(target_uid,target_team,conv.channel_id)) then
      raise exception using errcode='42501',message='attendance_forbidden'; end if;
    update public.conversations set team_id=target_team,assigned_user_uid=target_uid where conversation_id=p_conversation_id;
    delta:=jsonb_build_object('previous_team_id',conv.team_id,'team_id',target_team,'previous_assignee',conv.assigned_user_uid,'assignee',target_uid);
    event_name:='assignment.changed';
  elsif cmd='status' then
    -- Reopening resolved episodes needs an explicit product decision; inbound creates a new one.
    if conv.status='resolved' and p_command->>'status'<>'resolved' then
      raise exception using errcode='22023',message='attendance_reopen_not_supported'; end if;
    update public.conversations set status=p_command->>'status',
      resolved_at=case when p_command->>'status'='resolved' then coalesce(resolved_at,clock_timestamp()) else null end
      where conversation_id=p_conversation_id;
    delta:=jsonb_build_object('previous_status',conv.status,'status',p_command->>'status'); event_name:='status.changed';
  elsif cmd='metadata' then
    if not public.attendance_metadata_safe(p_command->'metadata') then raise exception using errcode='22023',message='attendance_invalid_metadata'; end if;
    update public.conversations set metadata=metadata||(p_command->'metadata') where conversation_id=p_conversation_id;
    delta:=jsonb_build_object('previous',conv.metadata,'patch',p_command->'metadata'); event_name:='metadata.changed';
  elsif cmd='identity' then
    if not public.attendance_has_access(p_actor_uid,conv.team_id,conv.channel_id,true) then
      raise exception using errcode='42501',message='attendance_forbidden'; end if;
    if p_command->>'resolution_state' not in ('linked','unidentified','ambiguous') or p_command->>'resolution_state' is null then
      raise exception using errcode='22023',message='attendance_invalid_identity'; end if;
    select jsonb_build_object('state',resolution_state,'source',internal_source,'type',internal_person_type,'id',internal_person_id)
      into delta from public.conversation_participants where conversation_id=p_conversation_id and participant_role='external';
    update public.conversation_participants set resolution_state=p_command->>'resolution_state',
      internal_source=case when p_command->>'resolution_state'='linked' then nullif(p_command->>'internal_source','') end,
      internal_person_type=case when p_command->>'resolution_state'='linked' then p_command->>'internal_person_type' end,
      internal_person_id=case when p_command->>'resolution_state'='linked' then p_command->>'internal_person_id' end,
      resolution_confidence=case when p_command->>'resolution_state'='linked' then 'manual' else 'unknown' end,
      resolution_origin=case when p_command->>'resolution_state'='linked' then nullif(p_command->>'resolution_origin','') end,
      linked_by_uid=case when p_command->>'resolution_state'='linked' then p_actor_uid end,
      linked_at=case when p_command->>'resolution_state'='linked' then clock_timestamp() end
      where conversation_id=p_conversation_id and participant_role='external';
    delta:=jsonb_build_object('previous',delta,'state',p_command->>'resolution_state','source',p_command->>'internal_source',
      'type',p_command->>'internal_person_type','id',p_command->>'internal_person_id'); event_name:='identity.changed';
  else raise exception using errcode='22023',message='attendance_invalid_command'; end if;
  update public.conversations set version=version+1,updated_at=clock_timestamp() where conversation_id=p_conversation_id returning * into conv;
  result:=jsonb_build_object('conversation_id',p_conversation_id,'version',conv.version,'duplicate',false);
  perform public.attendance_record_event(p_conversation_id,event_name,p_actor_uid,'space',delta,action_id,fp,result);
  insert into public.outbox_events(aggregate_type,aggregate_id,event_type,payload)
    values('attendance.conversation',p_conversation_id,'attendance.conversation.changed',jsonb_build_object('conversation_id',p_conversation_id,'version',conv.version));
  return result;
end $$;

create or replace function public.attendance_mark_read(p_actor_uid text,p_conversation_id uuid,p_sequence bigint)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare conv public.conversations; cursor_value bigint;
begin
  select * into conv from public.conversations where conversation_id=p_conversation_id for share;
  if not found or not public.attendance_has_access(p_actor_uid,conv.team_id,conv.channel_id) then
    raise exception using errcode='42501',message='attendance_forbidden'; end if;
  if p_sequence is null or p_sequence<0 or p_sequence>conv.message_sequence then
    raise exception using errcode='22023',message='attendance_invalid_read_cursor'; end if;
  insert into public.conversation_reads(conversation_id,user_uid,last_read_sequence)
    values(p_conversation_id,p_actor_uid,p_sequence)
    on conflict(conversation_id,user_uid) do update set
      last_read_sequence=greatest(conversation_reads.last_read_sequence,excluded.last_read_sequence),read_at=clock_timestamp()
    returning last_read_sequence into cursor_value;
  return jsonb_build_object('last_read_sequence',cursor_value);
end $$;

create or replace function public.attendance_get_conversation(p_actor_uid text,p_conversation_id uuid,p_view text default 'detail',p_after bigint default 0,p_limit integer default 50)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare conv public.conversations; rows jsonb;
begin
  select * into conv from public.conversations where conversation_id=p_conversation_id for share;
  if not found or not public.attendance_has_access(p_actor_uid,conv.team_id,conv.channel_id) then
    raise exception using errcode='42501',message='attendance_forbidden'; end if;
  if p_limit is null or p_limit<1 or p_limit>100 or p_after is null or p_after<0 then raise exception using errcode='22023',message='attendance_invalid_page'; end if;
  if p_view='messages' then
    select coalesce(jsonb_agg(to_jsonb(m)-'fingerprint' order by sequence),'[]') into rows from
      (select * from public.messages where conversation_id=p_conversation_id and sequence>p_after order by sequence limit p_limit) m;
    return jsonb_build_object('rows',rows,'version',conv.version);
  elsif p_view='detail' then
    return jsonb_build_object('conversation',to_jsonb(conv),
      'permissions',jsonb_build_object('can_assign',public.attendance_has_access(p_actor_uid,conv.team_id,conv.channel_id,true)),
      'participants',
      (select coalesce(jsonb_agg(to_jsonb(p)),'[]') from public.conversation_participants p where conversation_id=p_conversation_id),
      'unread',(select count(*) from public.messages m where m.conversation_id=p_conversation_id and direction='inbound'
        and sequence>coalesce((select last_read_sequence from public.conversation_reads where conversation_id=p_conversation_id and user_uid=p_actor_uid),0)));
  else raise exception using errcode='22023',message='attendance_invalid_view'; end if;
end $$;

create or replace function public.attendance_list_conversations(p_actor_uid text,p_filters jsonb default '{}')
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare rows jsonb; take integer:=coalesce((p_filters->>'limit')::integer,50);
begin
  if take<1 or take>100 then raise exception using errcode='22023',message='attendance_invalid_page'; end if;
  if not exists(select 1 from public.attendance_members where user_uid=p_actor_uid and enabled) then
    raise exception using errcode='42501',message='attendance_forbidden'; end if;
  select coalesce(jsonb_agg(to_jsonb(c) order by c.last_message_at desc nulls last,c.conversation_id desc),'[]') into rows from (
    select c.* from public.conversations c
    where public.attendance_has_access(p_actor_uid,c.team_id,c.channel_id)
      and (p_filters->>'team_id' is null or c.team_id=(p_filters->>'team_id')::uuid)
      and (p_filters->>'assigned_user_uid' is null or c.assigned_user_uid=p_filters->>'assigned_user_uid')
      and (p_filters->>'status' is null or c.status=p_filters->>'status')
      and (p_filters->>'before_time' is null or (c.last_message_at,c.conversation_id)<((p_filters->>'before_time')::timestamptz,(p_filters->>'before_id')::uuid))
    order by c.last_message_at desc nulls last,c.conversation_id desc limit take
  ) c;
  return jsonb_build_object('rows',rows);
end $$;

-- No direct browser OR service_role table access: only the reviewed RPC surface.
-- Existing shared audit/outbox grants are intentionally left unchanged for Retention.
do $$ declare tbl text; fn record; begin
  foreach tbl in array array['connections','teams','attendance_members','team_members','channels','channel_teams','contacts',
    'contact_identities','channel_contact_state','conversations','conversation_participants','messages','conversation_reads','conversation_events'] loop
    execute format('alter table public.%I enable row level security',tbl);
    execute format('revoke all on table public.%I from public, anon, authenticated, service_role',tbl);
  end loop;
  for fn in select p.oid::regprocedure as signature,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname like 'attendance\_%' escape '\' loop
    execute format('revoke all on function %s from public, anon, authenticated, service_role',fn.signature);
    if fn.proname in ('attendance_ingest_message','attendance_append_message','attendance_update_conversation',
      'attendance_mark_read','attendance_get_conversation','attendance_list_conversations') then
      execute format('grant execute on function %s to service_role',fn.signature);
    end if;
  end loop;
end $$;
notify pgrst, 'reload schema';
commit;
