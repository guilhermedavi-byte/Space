begin;
do $$
declare bid uuid; mid uuid; duplicate_id uuid; result jsonb; uid text:='fixture-'||gen_random_uuid();
begin
 insert into commercial_bookings(calcom_booking_id,calcom_event_type_id,status,start_at,end_at,provider_updated_at,attendee_phone)
 values(uid,4640970,'confirmed','2098-01-01 12:00Z','2098-01-01 13:00Z',now(),'+12025550199') returning id into bid;
 insert into sdr_meetings(lead_phone,starts_at,ends_at,status,calcom_booking_id,reminders_enabled)
 values('+12025550199','2098-01-01 12:00Z','2098-01-01 13:00Z','scheduled',uid,false) returning id into mid;
 result:=space_resolve_booking_meeting(bid);
 assert result->>'meeting_id'=mid::text and result->>'match_method'='calcom_booking_uid','UID link';
 update sdr_meetings set status='no_show' where id=mid;
 assert space_resolve_booking_meeting(bid)->>'meeting_status'='no_show','No show excluded';
 update sdr_meetings set status='completed',completed_at='2098-01-01 13:00Z' where id=mid;
 result:=space_resolve_booking_meeting(bid);
 assert result->>'meeting_status'='completed' and result->>'meeting_completed_at' is not null,'Completed timestamp';
 update commercial_bookings set status='cancelled' where id=bid;
 assert space_resolve_booking_meeting(bid)->>'meeting_status'='cancelled','Cancelled excluded';
 update commercial_bookings set status='rescheduled' where id=bid;
 assert space_resolve_booking_meeting(bid)->>'meeting_status'='rescheduled','Rescheduled excluded';
 update commercial_bookings set status='confirmed' where id=bid;
 insert into sdr_meetings(lead_phone,starts_at,ends_at,status,calcom_booking_id,reminders_enabled)
 values('+12025550199','2098-01-01 12:00Z','2098-01-01 13:00Z','scheduled',uid,false) returning id into duplicate_id;
 assert space_resolve_booking_meeting(bid)->>'match_method'='ambiguous','Duplicate UID blocks';
 delete from sdr_meetings where id=duplicate_id;
 update sdr_meetings set calcom_booking_id=null,google_event_id=uid where id=mid;
 update commercial_bookings set meeting_external_id=uid where id=bid;
 assert space_resolve_booking_meeting(bid)->>'match_method'='external_event_id','External ID';
 update commercial_bookings set meeting_external_id=null where id=bid;
 assert space_resolve_booking_meeting(bid)->>'match_method'='persisted_relation','Persisted link';
 update commercial_bookings set meeting_id=null where id=bid;
 assert space_resolve_booking_meeting(bid)->>'match_method'='attendee_exact_time','Unique attendee + time';
 insert into sdr_meetings(lead_phone,starts_at,ends_at,status,reminders_enabled)
 values('+12025550199','2098-01-01 12:00Z','2098-01-01 13:00Z','scheduled',false) returning id into duplicate_id;
 assert space_resolve_booking_meeting(bid)->>'match_method'='ambiguous','New ambiguity invalidates previous fallback';
 assert not has_function_privilege('anon','public.space_resolve_booking_meeting(uuid)','execute'),'Anon denied';
 assert not has_function_privilege('authenticated','public.space_resolve_booking_meeting(uuid)','execute'),'Authenticated denied';
end $$;
select '12 SQL assertions PASS; fixtures rolled back' as certification;
rollback;
