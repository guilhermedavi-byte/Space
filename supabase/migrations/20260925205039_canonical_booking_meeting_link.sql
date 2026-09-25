-- Canonical evidence only: provider status is not attendance evidence.
alter table public.sdr_meetings add column if not exists calcom_booking_id text,
  add column if not exists completed_at timestamptz;
alter table public.commercial_bookings
  add column if not exists meeting_external_id text,
  add column if not exists meeting_id uuid references public.sdr_meetings(id),
  add column if not exists meeting_status text not null default 'unresolved'
    check (meeting_status in ('unresolved','confirmed','completed','no_show','cancelled','rescheduled')),
  add column if not exists meeting_completed_at timestamptz,
  add column if not exists match_method text;
create index if not exists sdr_meetings_calcom_uid_idx on public.sdr_meetings(calcom_booking_id) where calcom_booking_id is not null;
create index if not exists sdr_meetings_external_idx on public.sdr_meetings(google_event_id) where google_event_id is not null;
create index if not exists sdr_meetings_start_idx on public.sdr_meetings(starts_at);
create unique index if not exists commercial_bookings_meeting_idx on public.commercial_bookings(meeting_id) where meeting_id is not null;

create or replace function public.space_resolve_booking_meeting(p_booking_id uuid)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare b public.commercial_bookings; m public.sdr_meetings; ids uuid[]; method text; state text; completed timestamptz; reverse_count integer;
begin
 -- Serialize resolution so two bookings cannot claim a meeting concurrently.
 perform pg_advisory_xact_lock(591253119);
 select * into b from public.commercial_bookings where id=p_booking_id for update;
 if b.id is null then raise exception 'booking_not_found'; end if;
 if b.status in ('cancelled','rescheduled') or b.rescheduled_to is not null then
  state:=case when b.rescheduled_to is not null then 'rescheduled' else b.status end;
 else
  select array_agg(id) into ids from public.sdr_meetings where calcom_booking_id=b.calcom_booking_id;
  if cardinality(ids)>0 then method:='calcom_booking_uid';
  elsif nullif(b.meeting_external_id,'') is not null then
   select array_agg(id) into ids from public.sdr_meetings where google_event_id=b.meeting_external_id;
   if cardinality(ids)>0 then method:='external_event_id'; end if;
  end if;
  if coalesce(cardinality(ids),0)=0 and b.meeting_id is not null and b.match_method is distinct from 'attendee_exact_time' then
   select array_agg(id) into ids from public.sdr_meetings where id=b.meeting_id;
   if cardinality(ids)>0 then method:='persisted_relation'; end if;
  end if;
  if coalesce(cardinality(ids),0)=0 then
   select array_agg(id) into ids from public.sdr_meetings s where
    s.starts_at=b.start_at and s.ends_at=b.end_at and
    (nullif(s.calcom_booking_id,'') is null or s.calcom_booking_id=b.calcom_booking_id) and
    (nullif(b.meeting_external_id,'') is null or s.google_event_id=b.meeting_external_id) and
    (nullif(b.lead_id,'') is null or nullif(s.lead_id,'') is null or b.lead_id=s.lead_id) and
    (nullif(b.host_email,'') is null or nullif(s.consultant_email,'') is null or lower(b.host_email)=lower(s.consultant_email)) and
    ((nullif(b.lead_id,'') is not null and s.lead_id=b.lead_id) or
     (length(regexp_replace(coalesce(b.attendee_phone,''),'\D','','g'))>=10 and
      regexp_replace(s.lead_phone,'\D','','g')=regexp_replace(b.attendee_phone,'\D','','g')));
   if cardinality(ids)>0 then method:='attendee_exact_time'; end if;
  end if;
  state:='unresolved';
  if cardinality(ids)=1 then
   select * into m from public.sdr_meetings where id=ids[1];
   -- Persisted links must not survive contradictory IDs or a reschedule.
   if (nullif(m.calcom_booking_id,'') is not null and m.calcom_booking_id<>b.calcom_booking_id)
      or (nullif(b.meeting_external_id,'') is not null and m.google_event_id is distinct from b.meeting_external_id)
      or m.starts_at is distinct from b.start_at or m.ends_at is distinct from b.end_at then
    method:='conflicting_evidence'; m.id:=null;
   else
    select count(*) into reverse_count from public.commercial_bookings other where other.id<>b.id
     and other.status not in ('cancelled','rescheduled') and other.rescheduled_to is null
     and (other.meeting_id=m.id or other.calcom_booking_id=m.calcom_booking_id or
       (nullif(m.google_event_id,'') is not null and other.meeting_external_id=m.google_event_id) or
       (method='attendee_exact_time' and other.start_at=m.starts_at and other.end_at=m.ends_at and
        ((nullif(m.lead_id,'') is not null and other.lead_id=m.lead_id) or
         (length(regexp_replace(coalesce(m.lead_phone,''),'\D','','g'))>=10 and regexp_replace(other.attendee_phone,'\D','','g')=regexp_replace(m.lead_phone,'\D','','g')))));
    if reverse_count>0 then method:='ambiguous';m.id:=null;
    else
     state:=case lower(m.status) when 'attended' then 'completed' when 'completed' then 'completed' when 'show' then 'completed'
      when 'no_show' then 'no_show' when 'cancelled' then 'cancelled' when 'rescheduled' then 'rescheduled' when 'scheduled' then 'confirmed' else 'unresolved' end;
     if state='completed' then completed:=m.completed_at; end if;
    end if;
   end if;
  elsif cardinality(ids)>1 then method:='ambiguous';
  else method:='unresolved'; end if;
 end if;
 update public.commercial_bookings set meeting_id=m.id,meeting_status=state,
  meeting_completed_at=completed,match_method=method where id=b.id;
 return jsonb_build_object('booking_id',b.id,'meeting_id',m.id,'meeting_status',state,'meeting_completed_at',completed,'match_method',method);
end $$;
revoke all on function public.space_resolve_booking_meeting(uuid) from public,anon,authenticated;
grant execute on function public.space_resolve_booking_meeting(uuid) to service_role;
-- Existing table RLS and permissions are unchanged.
