begin;
alter table public.student_health_daily
 add column if not exists health_score_effective integer generated always as ((data->>'health_score_effective')::integer) stored,
 add column if not exists health_cap integer generated always as ((data->>'health_cap')::integer) stored,
 add column if not exists health_cap_reason text generated always as (data->>'health_cap_reason') stored,
 add column if not exists health_recovery_started_at text generated always as (data->>'health_recovery_started_at') stored,
 add column if not exists health_recovery_type text generated always as (data->>'health_recovery_type') stored,
 add column if not exists pre_cancellation_health_score integer generated always as ((data->>'pre_cancellation_health_score')::integer) stored,
 add column if not exists pre_cancellation_health_tier text generated always as (data->>'pre_cancellation_health_tier') stored,
 add column if not exists pre_cancellation_health_at text generated always as (data->>'pre_cancellation_health_at') stored;
-- Immutable Health observation of canonical lifecycle events; no writes to lifecycle tables.
create table public.student_health_lifecycle_events (
 id uuid primary key references public.retention_events(id),student_id text not null,case_id uuid not null,
 subscription_id uuid not null,occurred_at timestamptz not null,state_before jsonb,state_after jsonb,
 pre_cancellation_health_score integer,pre_cancellation_health_tier text,pre_cancellation_health_at timestamptz,
 health_snapshot_before jsonb,created_at timestamptz not null default now()
);
create index health_lifecycle_student_time on public.student_health_lifecycle_events(student_id,occurred_at);
alter table public.student_health_lifecycle_events enable row level security;
revoke all on public.student_health_lifecycle_events from anon,authenticated;
grant select,insert on public.student_health_lifecycle_events to service_role;
revoke update,delete on public.student_health_lifecycle_events from service_role;
create function public.capture_health_lifecycle_event() returns trigger
language plpgsql security invoker set search_path=public as $$
declare sid text; h student_health_daily; is_request boolean;
begin
 if new.state_before->>'lifecycle_status' is not distinct from new.state_after->>'lifecycle_status' then return new; end if;
 select firestore_student_id into sid from students where id=new.student_id;
 if sid is null then return new; end if;
 is_request:=new.state_after->>'lifecycle_status'='cancellation_requested';
 if is_request then
  select * into h from student_health_daily where student_id=sid and updated_at<=new.occurred_at order by updated_at desc limit 1;
 end if;
 insert into student_health_lifecycle_events(id,student_id,case_id,subscription_id,occurred_at,state_before,state_after,
  pre_cancellation_health_score,pre_cancellation_health_tier,pre_cancellation_health_at,health_snapshot_before)
 values(new.id,sid,new.case_id,new.subscription_id,new.occurred_at,new.state_before,new.state_after,
  coalesce(h.health_score_effective,h.health_score),h.health_tier,h.updated_at,h.data)
 on conflict(id) do nothing;
 return new;
end $$;
revoke all on function public.capture_health_lifecycle_event() from public,anon,authenticated;
create trigger health_lifecycle_observation after insert on public.retention_events
 for each row execute function public.capture_health_lifecycle_event();
-- Existing events are projected exactly once; only surviving observations strictly before each event qualify.
-- Missing historical observations remain NULL, never reconstructed from post-request scores.
insert into public.student_health_lifecycle_events(id,student_id,case_id,subscription_id,occurred_at,state_before,state_after,
 pre_cancellation_health_score,pre_cancellation_health_tier,pre_cancellation_health_at,health_snapshot_before)
select e.id,s.firestore_student_id,e.case_id,e.subscription_id,e.occurred_at,e.state_before,e.state_after,
 coalesce(h.health_score_effective,h.health_score),h.health_tier,h.updated_at,h.data
from public.retention_events e join public.students s on s.id=e.student_id
left join lateral(select * from public.student_health_daily d where d.student_id=s.firestore_student_id
 and d.updated_at<=e.occurred_at and e.state_after->>'lifecycle_status'='cancellation_requested' order by d.updated_at desc limit 1) h on true
where s.firestore_student_id is not null and e.state_before->>'lifecycle_status' is distinct from e.state_after->>'lifecycle_status'
on conflict(id) do nothing;
commit;
