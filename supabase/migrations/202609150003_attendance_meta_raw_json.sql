-- Preserve signed JSON containing escaped Unicode that jsonb cannot represent.
-- Raw capture must not depend on domain/jsonb compatibility. No stored data changes.
begin;
set local lock_timeout='5s';
create or replace function public.attendance_meta_capture(p_raw_body text,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare e public.attendance_provider_events; payload json; digest text;
begin
 if p_request_id is null or p_raw_body is null or octet_length(p_raw_body) not between 1 and 1048576 then
  raise exception using errcode='22023',message='meta_invalid_envelope'; end if;
 payload:=p_raw_body::json;
 -- Envelope fields are checked by the signed ingress and again by the worker.
 -- JSON field extraction would decode NUL/surrogate escapes before raw capture.
 if json_typeof(payload) is distinct from 'object' then
  raise exception using errcode='22023',message='meta_invalid_envelope'; end if;
 digest:=encode(sha256(convert_to(p_raw_body,'UTF8')),'hex');
 insert into public.attendance_provider_events(raw_body,body_sha256,request_id,last_request_id)
 values(p_raw_body,digest,p_request_id,p_request_id)
 on conflict(provider,body_sha256) do update set delivery_count=attendance_provider_events.delivery_count+1,
  last_received_at=clock_timestamp(),last_request_id=excluded.last_request_id
 returning * into e;
 return jsonb_build_object('raw_event_id',e.raw_event_id,'duplicate',e.delivery_count>1,'state',e.state);
end $$;

commit;
