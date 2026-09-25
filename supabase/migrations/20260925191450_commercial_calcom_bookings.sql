-- Commercial agenda only. Voice outcomes and legacy scheduling are unchanged.
create table public.commercial_booking_contexts (
  id uuid primary key default gen_random_uuid(),
  sdr_uid text not null,
  voice_call_id uuid references public.voice_calls(id),
  lead_id text,
  opportunity_id text,
  created_at timestamptz not null default now()
);
create table public.commercial_bookings (
  id uuid primary key default gen_random_uuid(),
  calcom_booking_id text not null unique,
  calcom_event_type_id bigint not null,
  status text not null check (status in ('confirmed','pending','cancelled','rescheduled')),
  start_at timestamptz not null,
  end_at timestamptz not null check (end_at > start_at),
  timezone text,
  attendee_name text,
  attendee_email text,
  attendee_phone text,
  host_name text,
  host_email text,
  sdr_uid text,
  voice_call_id uuid references public.voice_calls(id),
  lead_id text,
  opportunity_id text,
  booking_context_id uuid references public.commercial_booking_contexts(id),
  provider_updated_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  cancelled_at timestamptz,
  rescheduled_from text,
  rescheduled_to text
);
create index commercial_bookings_sdr_start_idx on public.commercial_bookings(sdr_uid,start_at desc);
create index commercial_bookings_call_idx on public.commercial_bookings(voice_call_id,updated_at desc);
create index commercial_booking_contexts_sdr_idx on public.commercial_booking_contexts(sdr_uid);
alter table public.commercial_bookings enable row level security;
alter table public.commercial_booking_contexts enable row level security;
revoke all on public.commercial_bookings,public.commercial_booking_contexts from anon,authenticated;
grant select,insert,update on public.commercial_bookings,public.commercial_booking_contexts to service_role;

-- A stale/duplicate delivery must never revert a newer provider snapshot or transfer ownership.
create function public.space_upsert_commercial_booking(p_booking jsonb)
returns public.commercial_bookings language plpgsql security invoker set search_path = public as $$
declare b public.commercial_bookings; result public.commercial_bookings;
begin
  b := jsonb_populate_record(null::public.commercial_bookings,p_booking);
  insert into public.commercial_bookings (
    calcom_booking_id,calcom_event_type_id,status,start_at,end_at,timezone,
    attendee_name,attendee_email,attendee_phone,host_name,host_email,sdr_uid,voice_call_id,
    lead_id,opportunity_id,booking_context_id,provider_updated_at,cancelled_at,rescheduled_from,rescheduled_to
  ) values (
    b.calcom_booking_id,b.calcom_event_type_id,b.status,b.start_at,b.end_at,b.timezone,
    b.attendee_name,b.attendee_email,b.attendee_phone,b.host_name,b.host_email,b.sdr_uid,b.voice_call_id,
    b.lead_id,b.opportunity_id,b.booking_context_id,b.provider_updated_at,b.cancelled_at,b.rescheduled_from,b.rescheduled_to
  ) on conflict(calcom_booking_id) do update set
    status=excluded.status,start_at=excluded.start_at,end_at=excluded.end_at,timezone=excluded.timezone,
    attendee_name=excluded.attendee_name,attendee_email=excluded.attendee_email,attendee_phone=excluded.attendee_phone,
    host_name=excluded.host_name,host_email=excluded.host_email,provider_updated_at=excluded.provider_updated_at,
    cancelled_at=excluded.cancelled_at,rescheduled_from=excluded.rescheduled_from,rescheduled_to=excluded.rescheduled_to,updated_at=now()
  where commercial_bookings.provider_updated_at < excluded.provider_updated_at
  returning * into result;
  if result.id is null then
    select * into result from public.commercial_bookings where calcom_booking_id=b.calcom_booking_id;
  end if;
  return result;
end $$;
revoke all on function public.space_upsert_commercial_booking(jsonb) from public,anon,authenticated;
grant execute on function public.space_upsert_commercial_booking(jsonb) to service_role;
