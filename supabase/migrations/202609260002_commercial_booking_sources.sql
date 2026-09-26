-- Manual/external booking provenance for Space Phone handoff context.
alter table public.commercial_bookings
  add column if not exists source_type text not null default 'internal_booking'
    check (source_type in ('internal_booking','manual_booking','external_booking','call_only')),
  add column if not exists source_id text,
  add column if not exists context_payload jsonb not null default '{}'::jsonb;

create index if not exists commercial_bookings_source_idx
  on public.commercial_bookings(source_type,source_id)
  where source_id is not null;

create or replace function public.space_upsert_commercial_booking(p_booking jsonb)
returns public.commercial_bookings language plpgsql security invoker set search_path = public as $$
declare b public.commercial_bookings; result public.commercial_bookings;
begin
  b := jsonb_populate_record(null::public.commercial_bookings,p_booking);
  insert into public.commercial_bookings (
    calcom_booking_id,calcom_event_type_id,status,start_at,end_at,timezone,
    attendee_name,attendee_email,attendee_phone,host_name,host_email,sdr_uid,voice_call_id,
    lead_id,opportunity_id,booking_context_id,provider_updated_at,cancelled_at,rescheduled_from,rescheduled_to,
    source_type,source_id,context_payload
  ) values (
    b.calcom_booking_id,b.calcom_event_type_id,b.status,b.start_at,b.end_at,b.timezone,
    b.attendee_name,b.attendee_email,b.attendee_phone,b.host_name,b.host_email,b.sdr_uid,b.voice_call_id,
    b.lead_id,b.opportunity_id,b.booking_context_id,b.provider_updated_at,b.cancelled_at,b.rescheduled_from,b.rescheduled_to,
    coalesce(b.source_type,'internal_booking'),b.source_id,coalesce(b.context_payload,'{}'::jsonb)
  ) on conflict(calcom_booking_id) do update set
    status=excluded.status,start_at=excluded.start_at,end_at=excluded.end_at,timezone=excluded.timezone,
    attendee_name=excluded.attendee_name,attendee_email=excluded.attendee_email,attendee_phone=excluded.attendee_phone,
    host_name=excluded.host_name,host_email=excluded.host_email,provider_updated_at=excluded.provider_updated_at,
    cancelled_at=excluded.cancelled_at,rescheduled_from=excluded.rescheduled_from,rescheduled_to=excluded.rescheduled_to,
    source_type=excluded.source_type,source_id=excluded.source_id,context_payload=excluded.context_payload,updated_at=now()
  where commercial_bookings.provider_updated_at < excluded.provider_updated_at
  returning * into result;
  if result.id is null then
    select * into result from public.commercial_bookings where calcom_booking_id=b.calcom_booking_id;
  end if;
  return result;
end $$;
revoke all on function public.space_upsert_commercial_booking(jsonb) from public,anon,authenticated;
grant execute on function public.space_upsert_commercial_booking(jsonb) to service_role;
