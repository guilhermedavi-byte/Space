begin;
create table if not exists public.student_health_daily (
 student_id text not null, snapshot_date date not null,
 health_score integer check(health_score between 0 and 100),
 health_tier text not null check(health_tier in ('healthy','attention','risk','critical','unknown')),
 score_coverage_pct integer not null check(score_coverage_pct between 0 and 100),
 engagement_score numeric, attendance_score numeric, learning_score numeric, financial_score numeric, relationship_score numeric,
 missing_dimensions jsonb not null default '[]', risk_factors jsonb not null default '[]', signals jsonb not null default '{}',
 data jsonb not null, updated_at timestamptz not null default now(), primary key(student_id,snapshot_date)
);
create index if not exists student_health_daily_date_idx on public.student_health_daily(snapshot_date desc);
create table if not exists public.retention_population_snapshots (
 snapshot_date date primary key, month_key text not null, active_students integer not null,
 active_mrr numeric, requested integer not null, notice_period integer not null, churned integer not null,
 healthy integer not null, attention integer not null, risk integer not null, critical integer not null,
 data jsonb not null, updated_at timestamptz not null default now()
);
create table if not exists public.retention_alerts (
 id uuid primary key default gen_random_uuid(), student_id text not null, type text not null,
 severity text not null check(severity in ('info','attention','high','critical')),
 status text not null default 'open' check(status in ('open','acknowledged','resolved','dismissed')),
 opened_at timestamptz not null default now(), resolved_at timestamptz, updated_at timestamptz not null default now(),
 reason text not null, metric_value numeric, threshold numeric, activity_id text,
 deduplication_key text not null unique, condition_active boolean not null default true,
 resolved_by text, data jsonb not null default '{}'
);
create index if not exists retention_alerts_student_idx on public.retention_alerts(student_id);
create table if not exists public.retention_health_events (
 id uuid primary key default gen_random_uuid(), student_id text not null, snapshot_date date not null,
 from_tier text not null, to_tier text not null, from_score integer, to_score integer,
 occurred_at timestamptz not null default now(), data jsonb not null,
 unique(student_id,snapshot_date,from_tier,to_tier)
);
create or replace function public.retention_health_snapshot(p_date date,p_rows jsonb,p_population jsonb)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare r jsonb; f jsonb; previous public.student_health_daily; k text; seen text[]; count_rows integer:=0;
begin
 if p_date <> (now() at time zone 'America/Sao_Paulo')::date then raise exception 'current_date_required'; end if;
 perform pg_advisory_xact_lock(hashtext('retention_health_snapshot'));
 for r in select value from jsonb_array_elements(p_rows) loop
  select * into previous from student_health_daily where student_id=r->>'student_id' and snapshot_date<=p_date order by snapshot_date desc limit 1;
  if found and previous.health_tier <> r->>'health_tier' and previous.health_tier <> 'unknown' and r->>'health_tier' <> 'unknown' then
   insert into retention_health_events(student_id,snapshot_date,from_tier,to_tier,from_score,to_score,data)
   values(r->>'student_id',p_date,previous.health_tier,r->>'health_tier',previous.health_score,(r->>'health_score')::integer,r)
   on conflict(student_id,snapshot_date,from_tier,to_tier) do nothing;
  end if;
  insert into student_health_daily(student_id,snapshot_date,health_score,health_tier,score_coverage_pct,engagement_score,attendance_score,learning_score,financial_score,relationship_score,missing_dimensions,risk_factors,signals,data)
  values(r->>'student_id',p_date,(r->>'health_score')::integer,r->>'health_tier',(r->>'score_coverage_pct')::integer,(r->>'engagement_score')::numeric,(r->>'attendance_score')::numeric,(r->>'learning_score')::numeric,(r->>'financial_score')::numeric,(r->>'relationship_score')::numeric,r->'missing_dimensions',r->'risk_factors',r->'signals',r)
  on conflict(student_id,snapshot_date) do update set health_score=excluded.health_score,health_tier=excluded.health_tier,score_coverage_pct=excluded.score_coverage_pct,engagement_score=excluded.engagement_score,attendance_score=excluded.attendance_score,learning_score=excluded.learning_score,financial_score=excluded.financial_score,relationship_score=excluded.relationship_score,missing_dimensions=excluded.missing_dimensions,risk_factors=excluded.risk_factors,signals=excluded.signals,data=excluded.data,updated_at=now();
  seen:='{}';
  for f in select value from jsonb_array_elements(r->'risk_factors') loop
   if not coalesce((r->>'is_active')::boolean,false) then continue; end if;
   k:=(r->>'student_id')||':'||(f->>'type'); seen:=array_append(seen,k);
   insert into retention_alerts(student_id,type,severity,reason,metric_value,threshold,deduplication_key,data)
   values(r->>'student_id',f->>'type',f->>'severity',f->>'label',(f->>'current_value')::numeric,(f->>'threshold')::numeric,k,f)
   on conflict(deduplication_key) do update set severity=excluded.severity,reason=excluded.reason,metric_value=excluded.metric_value,threshold=excluded.threshold,data=excluded.data,
    status=case when not retention_alerts.condition_active then 'open' else retention_alerts.status end,
    opened_at=case when not retention_alerts.condition_active then now() else retention_alerts.opened_at end,
    resolved_at=case when not retention_alerts.condition_active then null else retention_alerts.resolved_at end,
    condition_active=true,updated_at=now();
  end loop;
  update retention_alerts set condition_active=false,status=case when status in ('open','acknowledged') then 'resolved' else status end,resolved_at=coalesce(resolved_at,now()),updated_at=now()
  where student_id=r->>'student_id' and condition_active and not(deduplication_key=any(seen))
    and ((r->'monitored_alert_types') ? type or not coalesce((r->>'is_active')::boolean,false));
  count_rows:=count_rows+1;
 end loop;
 -- Only a successfully read full roster can resolve alerts for students no longer operational.
 update retention_alerts set condition_active=false,status=case when status in ('open','acknowledged') then 'resolved' else status end,resolved_at=coalesce(resolved_at,now()),updated_at=now()
 where condition_active and student_id not in (select value->>'student_id' from jsonb_array_elements(p_rows));
 insert into retention_population_snapshots(snapshot_date,month_key,active_students,active_mrr,requested,notice_period,churned,healthy,attention,risk,critical,data)
 values(p_date,to_char(p_date,'YYYY-MM'),(p_population->>'active_students')::integer,(p_population->>'active_mrr')::numeric,(p_population->>'requested')::integer,(p_population->>'notice_period')::integer,(p_population->>'churned')::integer,(p_population->>'healthy')::integer,(p_population->>'attention')::integer,(p_population->>'risk')::integer,(p_population->>'critical')::integer,p_population)
 on conflict(snapshot_date) do update set active_students=excluded.active_students,active_mrr=excluded.active_mrr,requested=excluded.requested,notice_period=excluded.notice_period,churned=excluded.churned,healthy=excluded.healthy,attention=excluded.attention,risk=excluded.risk,critical=excluded.critical,data=excluded.data,updated_at=now();
 return jsonb_build_object('snapshot_date',p_date,'students',count_rows);
end $$;
alter table public.student_health_daily enable row level security;
alter table public.retention_population_snapshots enable row level security;
alter table public.retention_alerts enable row level security;
alter table public.retention_health_events enable row level security;
revoke all on public.student_health_daily,public.retention_population_snapshots,public.retention_alerts,public.retention_health_events from anon,authenticated;
grant select,insert,update on public.student_health_daily,public.retention_population_snapshots,public.retention_alerts to service_role;
grant select,insert on public.retention_health_events to service_role;
revoke update,delete on public.retention_health_events from service_role;
revoke all on function public.retention_health_snapshot(date,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.retention_health_snapshot(date,jsonb,jsonb) to service_role;
commit;
