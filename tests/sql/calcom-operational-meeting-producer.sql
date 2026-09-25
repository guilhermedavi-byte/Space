begin;
do $$
declare bid uuid; mid uuid; result jsonb; uid text:='producer-fixture-'||gen_random_uuid(); n integer;
begin
 insert into commercial_bookings(calcom_booking_id,calcom_event_type_id,status,start_at,end_at,provider_updated_at,attendee_phone,sdr_uid,host_email)
 values(uid,4640970,'confirmed','2098-02-01 12:00Z','2098-02-01 13:00Z',now(),'+12025550199','fixture-sdr','closer@example.test') returning id into bid;
 result:=space_produce_calcom_meeting(bid,'event-'||uid,'https://meet.google.com/abc-defg-hij');
 mid:=(result->>'meeting_id')::uuid;
 assert mid is not null and result->>'meeting_status'='confirmed','Creates scheduled meeting';
 assert result->>'match_method'='calcom_booking_uid','Canonical UID link';
 assert exists(select from sdr_meetings where id=mid and google_event_id='event-'||uid and reminders_enabled=false),'Explicit event and no duplicate reminders';
 perform space_produce_calcom_meeting(bid,'event-'||uid);
 select count(*) into n from sdr_meetings where calcom_booking_id=uid;
 assert n=1,'Replay idempotent';
 update sdr_meetings set status='completed',completed_at='2098-02-01 13:00Z' where id=mid;
 assert space_produce_calcom_meeting(bid)->>'meeting_status'='completed','Replay preserves completed';
 update commercial_bookings set start_at='2098-02-02 12:00Z',end_at='2098-02-02 13:00Z' where id=bid;
 assert space_produce_calcom_meeting(bid)->>'meeting_status'='unresolved','Occurrence conflict blocked';
 update commercial_bookings set start_at='2098-02-01 12:00Z',end_at='2098-02-01 13:00Z' where id=bid;
 update sdr_meetings set status='no_show' where id=mid;
 assert space_produce_calcom_meeting(bid)->>'meeting_status'='no_show','No show preserved/excluded';
 update commercial_bookings set status='cancelled' where id=bid;
 assert space_produce_calcom_meeting(bid)->>'meeting_status'='cancelled','Cancellation synchronized';
 assert exists(select from sdr_meetings where id=mid and status='cancelled'),'Operational cancellation';
 insert into commercial_bookings(calcom_booking_id,calcom_event_type_id,status,start_at,end_at,provider_updated_at)
 values(uid||'-missing',4640970,'confirmed','2098-02-03 12:00Z','2098-02-03 13:00Z',now()) returning id into bid;
 assert space_produce_calcom_meeting(bid)->>'reason'='missing_operational_context','No invented lead/closer/SDR';
 assert not exists(select from sdr_meetings where calcom_booking_id=uid||'-missing'),'Missing context creates nothing';
 assert not has_function_privilege('anon','public.space_produce_calcom_meeting(uuid,text,text)','execute'),'Anon denied';
 assert not has_function_privilege('authenticated','public.space_produce_calcom_meeting(uuid,text,text)','execute'),'Authenticated denied';
end $$;
select '13 producer assertions PASS; rollback' as certification;
rollback;
