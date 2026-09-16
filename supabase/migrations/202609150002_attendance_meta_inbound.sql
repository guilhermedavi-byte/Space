-- Additive Meta inbox. Apply only after the certified attendance foundation.
-- No provider network calls, dispatcher, destructive DDL, or legacy data migration.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';

create table public.attendance_provider_events (
 raw_event_id uuid primary key default gen_random_uuid(),
 provider text not null default 'meta_whatsapp' check(provider='meta_whatsapp'),
 raw_body text not null check(octet_length(raw_body) between 1 and 1048576),
 body_sha256 text not null check(length(body_sha256)=64),
 request_id uuid not null, last_request_id uuid not null,
 delivery_count integer not null default 1 check(delivery_count>0),
 received_at timestamptz not null default clock_timestamp(),
 last_received_at timestamptz not null default clock_timestamp(),
 state text not null default 'received' check(state in ('received','processing','processed','retryable_failed','terminal_failed','unhandled')),
 attempt_count integer not null default 0 check(attempt_count between 0 and 8),
 available_at timestamptz not null default now(), lease_id uuid, lease_until timestamptz,
 processed_at timestamptz, last_error text,
 result jsonb not null default '{}',
 unique(provider,body_sha256),
 check((state='processing')=(lease_id is not null and lease_until is not null))
);
create index attendance_provider_events_queue on public.attendance_provider_events(available_at,received_at)
 where state in ('received','retryable_failed','processing');
create table public.attendance_provider_event_items (
 item_id uuid primary key default gen_random_uuid(),
 raw_event_id uuid not null references public.attendance_provider_events,
 provider text not null default 'meta_whatsapp' check(provider='meta_whatsapp'),
 waba_id text not null check(length(waba_id)<=256), phone_number_id text not null check(length(phone_number_id)<=256),
 category text not null check(category in ('message','status','unhandled')),
 semantic_key text not null check(length(semantic_key) between 1 and 256),
 fingerprint text not null, normalized jsonb not null,
 state text not null default 'received' check(state in ('received','processed','retryable_failed','terminal_failed','unhandled')),
 attempt_count integer not null default 0 check(attempt_count between 0 and 8),
 result jsonb not null default '{}', last_error text,
 created_at timestamptz not null default now(), processed_at timestamptz,
 unique(provider,waba_id,phone_number_id,category,semantic_key)
);
create index attendance_provider_event_items_raw on public.attendance_provider_event_items(raw_event_id);
alter table public.attendance_provider_events enable row level security;
alter table public.attendance_provider_event_items enable row level security;
revoke all on public.attendance_provider_events,public.attendance_provider_event_items from public,anon,authenticated,service_role;

create function public.attendance_meta_capture(p_raw_body text,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare e public.attendance_provider_events; payload jsonb; digest text;
begin
 if p_request_id is null or p_raw_body is null or octet_length(p_raw_body) not between 1 and 1048576 then
  raise exception using errcode='22023',message='meta_invalid_envelope'; end if;
 payload:=p_raw_body::jsonb;
 if payload->>'object' is distinct from 'whatsapp_business_account' or jsonb_typeof(payload->'entry') is distinct from 'array' then
  raise exception using errcode='22023',message='meta_invalid_envelope'; end if;
 digest:=encode(sha256(convert_to(p_raw_body,'UTF8')),'hex');
 insert into public.attendance_provider_events(raw_body,body_sha256,request_id,last_request_id)
 values(p_raw_body,digest,p_request_id,p_request_id)
 on conflict(provider,body_sha256) do update set delivery_count=attendance_provider_events.delivery_count+1,
  last_received_at=clock_timestamp(),last_request_id=excluded.last_request_id
 returning * into e;
 return jsonb_build_object('raw_event_id',e.raw_event_id,'duplicate',e.delivery_count>1,'state',e.state);
end $$;

create function public.attendance_meta_claim(p_event_id uuid default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare e public.attendance_provider_events;
begin
 -- A worker that crashed on its last attempt must not leave an immortal lease.
 update public.attendance_provider_events set state='terminal_failed',lease_id=null,lease_until=null,last_error='retry_exhausted'
 where (p_event_id is null or raw_event_id=p_event_id) and state='processing' and lease_until<=now() and attempt_count=8;
 select * into e from public.attendance_provider_events
 where (p_event_id is null or raw_event_id=p_event_id) and attempt_count<8
 and ((state in ('received','retryable_failed') and available_at<=now()) or (state='processing' and lease_until<=now()))
 order by received_at for update skip locked limit 1;
 if not found then return jsonb_build_object('state','not_claimed'); end if;
 update public.attendance_provider_events set state='processing',attempt_count=attempt_count+1,
  lease_id=gen_random_uuid(),lease_until=now()+interval '60 seconds',last_error=null
 where raw_event_id=e.raw_event_id returning * into e;
 return jsonb_build_object('raw_event_id',e.raw_event_id,'raw_body',e.raw_body,'lease_id',e.lease_id,
  'request_id',e.request_id,'attempt_count',e.attempt_count);
end $$;

create function public.attendance_meta_fail(p_event_id uuid,p_lease_id uuid,p_error_code text,p_retryable boolean)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare e public.attendance_provider_events;
begin
 select * into e from public.attendance_provider_events where raw_event_id=p_event_id for update;
 if not found or e.state<>'processing' or e.lease_id is distinct from p_lease_id or e.lease_until<=now() then
  return jsonb_build_object('state','lease_lost'); end if;
 update public.attendance_provider_events set
 state=case when p_retryable and attempt_count<8 then 'retryable_failed' else 'terminal_failed' end,
 last_error=case when p_error_code in ('invalid_envelope','processor_unavailable') then p_error_code else 'processor_unavailable' end,
 available_at=now()+make_interval(secs=>least(900,power(2,attempt_count)::integer)),lease_id=null,lease_until=null
 where raw_event_id=p_event_id returning * into e;
 return jsonb_build_object('state',e.state);
end $$;

create function public.attendance_meta_complete(p_event_id uuid,p_lease_id uuid,p_items jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare e public.attendance_provider_events; i jsonb; ledger public.attendance_provider_event_items;
 ch public.channels; conn public.connections; msg public.messages; conv public.conversations;
 fp text; outcome jsonb; summaries jsonb:='[]'; new_state text; code text; retry boolean;
 pending integer:=0; terminal integer:=0; unhandled integer:=0; created integer:=0; changed boolean;
begin
 select * into e from public.attendance_provider_events where raw_event_id=p_event_id for update;
 if not found or e.state<>'processing' or e.lease_id is distinct from p_lease_id or e.lease_until<=now() then
  return jsonb_build_object('state','lease_lost'); end if;
 if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) not between 1 and 500 then
  raise exception using errcode='22023',message='meta_invalid_items'; end if;
 -- Deterministic lock order across overlapping multi-item deliveries.
 for i in select value from jsonb_array_elements(p_items)
  order by value->>'waba_id',value->>'phone_number_id',value->>'category',value->>'semantic_key'
 loop
  fp:=encode(sha256(convert_to(i::text,'UTF8')),'hex');
  insert into public.attendance_provider_event_items(raw_event_id,waba_id,phone_number_id,category,semantic_key,fingerprint,normalized)
  values(p_event_id,i->>'waba_id',i->>'phone_number_id',i->>'category',i->>'semantic_key',fp,i)
  on conflict(provider,waba_id,phone_number_id,category,semantic_key) do nothing;
  select * into ledger from public.attendance_provider_event_items
   where provider='meta_whatsapp' and waba_id=i->>'waba_id' and phone_number_id=i->>'phone_number_id'
   and category=i->>'category' and semantic_key=i->>'semantic_key' for update;
  if ledger.fingerprint<>fp then
   terminal:=terminal+1;
   summaries:=summaries||jsonb_build_array(jsonb_build_object('item_id',ledger.item_id,'state','terminal_failed','code','semantic_conflict'));
   continue;
  end if;
  if ledger.state in ('received','retryable_failed') and ledger.attempt_count<8 then
   outcome:='{}';code:=null;new_state:='processed';
   -- A caught item error rolls back ALL of that item's domain changes.
   begin
    if i->>'category'='unhandled' then new_state:='unhandled';code:='unsupported_event';
    else
     select * into conn from public.connections where provider='meta_whatsapp' and external_account_type='waba'
      and external_account_id=i->>'waba_id' and status='active' for share;
     if not found then raise exception using errcode='P0002',message='meta_mapping_missing'; end if;
     select * into ch from public.channels where connection_id=conn.connection_id
      and external_channel_id=i->>'phone_number_id' and status='active' for share;
     if not found then raise exception using errcode='P0002',message='meta_mapping_missing'; end if;
     if i->>'category'='message' then
      outcome:=public.attendance_ingest_message(jsonb_build_object(
       'provider','meta_whatsapp','connection_id',conn.connection_id,'channel_id',ch.channel_id,
       'external_message_id',i->>'external_message_id','external_contact_id',i->>'external_contact_id',
       'identifier_type','provider_user','kind','text','content',i->'content','phone_raw',i->>'phone_raw',
       'display_name',i->>'display_name','provider_timestamp',i->>'provider_timestamp',
       'external_reply_to_id',i->>'external_reply_to_id','metadata',jsonb_build_object('raw_event_id',p_event_id)));
      if not (outcome->>'duplicate')::boolean then created:=created+1; end if;
     elsif i->>'category'='status' then
      select * into msg from public.messages where channel_id=ch.channel_id and external_message_id=i->>'external_message_id' and direction='outbound';
      if not found then raise exception using errcode='P0002',message='meta_message_missing'; end if;
      -- Same order as foundation: conversation before message. Serialize concurrent receipts.
      select * into conv from public.conversations where conversation_id=msg.conversation_id for update;
      select * into msg from public.messages where message_id=msg.message_id for update;
      if i->>'status' not in ('sent','delivered','read','failed') then raise exception using errcode='22023',message='meta_invalid_status'; end if;
      changed:=case i->>'status'
       when 'read' then msg.transport_status<>'read'
       when 'delivered' then msg.transport_status not in ('delivered','read')
       when 'sent' then msg.transport_status not in ('sent','delivered','read')
       when 'failed' then msg.transport_status in ('pending','sending','accepted','unknown') else false end;
      if changed then
       update public.messages set transport_status=i->>'status' where message_id=msg.message_id;
       perform public.attendance_record_event(msg.conversation_id,'message.status.changed',null,'provider',
        jsonb_build_object('message_id',msg.message_id,'status',i->>'status','provider_timestamp',i->>'provider_timestamp','raw_event_id',p_event_id));
       perform public.attendance_enqueue_outbox(msg.conversation_id,'attendance.message',msg.message_id,'attendance.message.status.changed',
        jsonb_build_object('message_id',msg.message_id,'conversation_id',msg.conversation_id,'status',i->>'status'));
      end if;
      outcome:=jsonb_build_object('message_id',msg.message_id,'conversation_id',msg.conversation_id,'status_changed',changed);
     else raise exception using errcode='22023',message='meta_invalid_category'; end if;
     outcome:=outcome||jsonb_build_object('connection_id',conn.connection_id);
    end if;
   exception when others then
    retry:=sqlstate in ('P0002','40001','40P01','55P03','57014','42501');
    new_state:=case when retry and ledger.attempt_count+1<8 and e.attempt_count<8 then 'retryable_failed' else 'terminal_failed' end;
    code:=case when sqlstate='P0002' then 'mapping_or_message_missing' when sqlstate='23505' then 'semantic_conflict'
     when retry then 'domain_temporarily_unavailable' else 'invalid_domain_event' end;
    outcome:='{}';
   end;
   update public.attendance_provider_event_items set state=new_state,attempt_count=attempt_count+1,result=outcome,last_error=code,
    processed_at=case when new_state in ('processed','unhandled','terminal_failed') then clock_timestamp() else null end
    where item_id=ledger.item_id returning * into ledger;
  end if;
  if ledger.state='retryable_failed' then pending:=pending+1; end if;
  if ledger.state='terminal_failed' then terminal:=terminal+1; end if;
  if ledger.state='unhandled' then unhandled:=unhandled+1; end if;
  summaries:=summaries||jsonb_build_array(jsonb_build_object('item_id',ledger.item_id,'state',ledger.state)||ledger.result);
 end loop;
 new_state:=case when pending>0 and e.attempt_count<8 then 'retryable_failed' when terminal>0 or pending>0 then 'terminal_failed'
  when unhandled>0 then 'unhandled' else 'processed' end;
 outcome:=jsonb_build_object('state',new_state,'inbound_created',created,'unhandled_count',unhandled,'items',summaries);
 update public.attendance_provider_events set state=new_state,lease_id=null,lease_until=null,result=outcome,
 available_at=now()+make_interval(secs=>least(900,power(2,attempt_count)::integer)),
 processed_at=case when new_state<>'retryable_failed' then clock_timestamp() else null end,
 last_error=case when new_state in ('retryable_failed','terminal_failed') then 'item_processing_failed' else null end
 where raw_event_id=p_event_id;
 return outcome;
end $$;

-- Extend the existing operator-only fixture marker to Meta synthetic connections.
-- Real connections without this marker retain the existing outbox behavior.
create or replace function public.attendance_enqueue_outbox(p_conversation uuid,p_aggregate_type text,p_aggregate_id uuid,p_event_type text,p_payload jsonb)
returns uuid language plpgsql set search_path=pg_catalog,public as $$
declare run_id text; result_id uuid;
begin
 select c.metadata->>'validation_run_id' into run_id from public.conversations v join public.channels ch using(channel_id)
 join public.connections c using(connection_id) where v.conversation_id=p_conversation
 and c.provider in ('attendance_validation','meta_whatsapp')
 and c.metadata->>'validation_run_id' ~ '^attendance-prod-validation-[a-zA-Z0-9-]+$';
 insert into public.outbox_events(aggregate_type,aggregate_id,event_type,payload,delivery_status,available_at,last_error)
 values(p_aggregate_type,p_aggregate_id,case when run_id is null then p_event_type else 'attendance.validation.'||p_event_type end,
 p_payload||case when run_id is null then '{}'::jsonb else jsonb_build_object('validation_run_id',run_id,'dispatch_disabled',true) end,
 case when run_id is null then 'pending' else 'failed' end,case when run_id is null then now() else 'infinity'::timestamptz end,
 case when run_id is null then null else 'attendance_validation_dispatch_disabled' end) returning id into result_id;
 return result_id;
end $$;
revoke all on function public.attendance_meta_capture(text,uuid),public.attendance_meta_claim(uuid),
 public.attendance_meta_complete(uuid,uuid,jsonb),public.attendance_meta_fail(uuid,uuid,text,boolean) from public,anon,authenticated;
grant execute on function public.attendance_meta_capture(text,uuid),public.attendance_meta_claim(uuid),
 public.attendance_meta_complete(uuid,uuid,jsonb),public.attendance_meta_fail(uuid,uuid,text,boolean) to service_role;
notify pgrst,'reload schema';
commit;
