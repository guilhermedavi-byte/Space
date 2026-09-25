-- Only canonical provider snapshots may produce operational appointments.
create or replace function public.space_produce_calcom_meeting(p_booking_id uuid,p_google_event_id text default null,p_meet_link text default null)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare b commercial_bookings; m sdr_meetings; ids uuid[]; link jsonb; phone text;
begin
 perform pg_advisory_xact_lock(591253119);
 select * into b from commercial_bookings where id=p_booking_id for update;
 if b.id is null then raise exception 'booking_not_found'; end if;
 if nullif(p_google_event_id,'') is not null then
  update commercial_bookings set meeting_external_id=p_google_event_id where id=b.id;
 end if;
 select array_agg(id) into ids from sdr_meetings where calcom_booking_id=b.calcom_booking_id;
 if cardinality(ids)>1 then return space_resolve_booking_meeting(b.id); end if;
 if cardinality(ids)=1 then select * into m from sdr_meetings where id=ids[1];
 else
  link:=space_resolve_booking_meeting(b.id);
  if link->>'match_method' in ('ambiguous','conflicting_evidence') then return link; end if;
  if link->>'meeting_id' is not null then select * into m from sdr_meetings where id=(link->>'meeting_id')::uuid; end if;
 end if;
 if m.id is not null and nullif(p_google_event_id,'') is not null and nullif(m.google_event_id,'') is not null and m.google_event_id<>p_google_event_id then
  return space_resolve_booking_meeting(b.id);
 end if;
 if b.status in ('cancelled','rescheduled') or b.rescheduled_to is not null then
  if m.id is not null then update sdr_meetings set status=case when b.rescheduled_to is not null then 'rescheduled' else b.status end,updated_at=now() where id=m.id; end if;
 elsif b.status='confirmed' then
  phone:=nullif(b.attendee_phone,'');
  if phone is null and b.voice_call_id is not null then select to_number into phone from voice_calls where id=b.voice_call_id and space_user_uid=b.sdr_uid; end if;
  if m.id is null then
   if b.sdr_uid is null or length(regexp_replace(coalesce(phone,''),'\D','','g'))<10 or nullif(b.host_email,'') is null then
    return jsonb_build_object('state','unresolved','reason','missing_operational_context');
   end if;
   insert into sdr_meetings(calcom_booking_id,google_event_id,lead_id,lead_name,lead_phone,consultant_name,consultant_email,starts_at,ends_at,status,meet_link,source,reminders_enabled)
   values(b.calcom_booking_id,nullif(p_google_event_id,''),b.lead_id,b.attendee_name,phone,b.host_name,b.host_email,b.start_at,b.end_at,'scheduled',nullif(p_meet_link,''),'space_calcom',false) returning * into m;
  else
   -- A replay cannot erase a real attendance decision or move it to another occurrence.
   if m.status in ('attended','completed','show','no_show') and (m.starts_at<>b.start_at or m.ends_at is distinct from b.end_at) then
    return space_resolve_booking_meeting(b.id);
   end if;
   update sdr_meetings set calcom_booking_id=b.calcom_booking_id,
    google_event_id=coalesce(nullif(p_google_event_id,''),google_event_id),meet_link=coalesce(nullif(p_meet_link,''),meet_link),
    starts_at=b.start_at,ends_at=b.end_at,updated_at=now() where id=m.id;
  end if;
 end if;
 return space_resolve_booking_meeting(b.id);
end $$;
revoke all on function public.space_produce_calcom_meeting(uuid,text,text) from public,anon,authenticated;
grant execute on function public.space_produce_calcom_meeting(uuid,text,text) to service_role;
