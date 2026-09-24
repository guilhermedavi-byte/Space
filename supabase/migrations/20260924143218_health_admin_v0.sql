begin;
alter table public.student_health_daily
 add column if not exists model_version text generated always as (data->>'model_version') stored,
 add column if not exists health_score_raw integer generated always as ((data->>'health_score_raw')::integer) stored,
 add column if not exists health_tier_raw text generated always as (data->>'health_tier_raw') stored,
 add column if not exists health_tier_effective text generated always as (data->>'health_tier_effective') stored,
 add column if not exists dimension_scores jsonb generated always as (data->'dimension_scores') stored,
 add column if not exists hard_rules_applied jsonb generated always as (data->'hard_rules_applied') stored;
create table public.retention_risk_cases (
 id uuid primary key default gen_random_uuid(),student_id text not null,type text not null,
 status text not null default 'open' check(status in ('open','monitoring','resolved')),
 severity text not null check(severity in ('attention','high','critical')),opened_at timestamptz not null default now(),
 resolved_at timestamptz,recovery_started_at timestamptz,current_streak integer not null default 0,
 source text not null default 'admin_v0',dedup_key text not null unique,metadata jsonb not null default '{}',
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create unique index retention_risk_active_sequence on public.retention_risk_cases(student_id,type) where status='open';
create table public.retention_risk_actions (
 id uuid primary key default gen_random_uuid(),risk_case_id uuid not null references public.retention_risk_cases,
 kind text not null check(kind in ('whatsapp','check_response','call','close_no_response')),
 state text not null default 'claimed' check(state in ('claimed','sent','done','failed','unknown','skipped')),
 result jsonb not null default '{}',created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(risk_case_id,kind)
);
create table public.student_occurrences (
 id uuid primary key default gen_random_uuid(),student_id text not null,activity_id text,comment_id text,
 risk_case_id uuid references public.retention_risk_cases,
 category text not null check(category in ('teacher','schedule','pedagogical','service','financial','progress_perception','complaint','other')),
 severity text not null check(severity in ('light','moderate','high','critical')),
 status text not null default 'open' check(status in ('open','resolved')),
 description text not null,source text not null default 'activity_comment',opened_by text not null,opened_at timestamptz not null default now(),
 resolved_by text,resolved_at timestamptz,recovery_status text,metadata jsonb not null default '{}',
 unique(activity_id,comment_id)
);
create index student_occurrences_student on public.student_occurrences(student_id,opened_at desc);
create table public.student_quality_pulses (
 id uuid primary key default gen_random_uuid(),student_id text not null,activity_id text not null unique,caller_id text not null,
 called_at timestamptz not null,general_satisfaction integer not null check(general_satisfaction between 1 and 5),
 teacher_satisfaction integer not null check(teacher_satisfaction between 1 and 5),
 perceived_progress integer not null check(perceived_progress between 1 and 5),schedule_fit integer not null check(schedule_fit between 1 and 5),
 nps integer check(nps between 0 and 10),continuation_intent text not null check(continuation_intent in ('normal','doubts','considering_exit','wants_to_cancel')),
 comment_id text,created_at timestamptz not null default now()
);
create index student_quality_pulses_student on public.student_quality_pulses(student_id,called_at desc);
create table public.retention_health_settings (
 id text primary key check(id='admin_v0'),absence_message text not null check(length(absence_message) between 1 and 2000),
 updated_by text,updated_at timestamptz not null default now()
);
insert into public.retention_health_settings(id,absence_message) values('admin_v0','Oi, {primeiro_nome}! Sentimos sua falta nas últimas aulas. Está tudo bem? Se precisar de ajuda com horários ou com alguma outra questão, pode responder por aqui.');
create function public.retention_risk_observe(p_student text,p_sequence text,p_streak integer,p_observed_at date)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare c retention_risk_cases;
begin
 perform pg_advisory_xact_lock(hashtext('risk:'||p_student));
 if p_streak<0 or p_observed_at is null then raise exception 'invalid_observation'; end if;
 if p_streak=0 then
  update retention_risk_cases set status='monitoring',current_streak=0,recovery_started_at=coalesce(recovery_started_at,now()),updated_at=now(),metadata=metadata||jsonb_build_object('last_observed_at',p_observed_at)
   where student_id=p_student and type='consecutive_absences' and status='open' and coalesce((metadata->>'last_observed_at')::date,p_observed_at)<=p_observed_at;
  select * into c from retention_risk_cases where student_id=p_student and type='consecutive_absences' order by created_at desc limit 1;
 elsif p_streak>=2 and nullif(p_sequence,'') is not null then
  update retention_risk_cases set status='monitoring',recovery_started_at=coalesce(recovery_started_at,now()),updated_at=now()
   where student_id=p_student and type='consecutive_absences' and status='open' and dedup_key<>p_student||':'||p_sequence and coalesce((metadata->>'last_observed_at')::date,p_observed_at)<=p_observed_at;
  insert into retention_risk_cases(student_id,type,severity,current_streak,dedup_key,metadata)
   values(p_student,'consecutive_absences',case when p_streak>=4 then 'critical' else 'high' end,p_streak,p_student||':'||p_sequence,jsonb_build_object('last_observed_at',p_observed_at))
   on conflict(dedup_key) do update set current_streak=excluded.current_streak,severity=excluded.severity,updated_at=now(),metadata=retention_risk_cases.metadata||excluded.metadata
   where coalesce((retention_risk_cases.metadata->>'last_observed_at')::date,p_observed_at)<=p_observed_at returning * into c;
 end if;
 return to_jsonb(c);
end $$;
-- Claims are never leased/reclaimed: uncertain sends require an operator, never automatic resend.
create function public.retention_risk_claim(p_case uuid,p_kind text) returns jsonb
language plpgsql security invoker set search_path=public as $$
declare a retention_risk_actions;
begin
 insert into retention_risk_actions(risk_case_id,kind) values(p_case,p_kind) on conflict do nothing returning * into a;
 return jsonb_build_object('claimed',a.id is not null,'action',to_jsonb(a));
end $$;
do $$ declare t text; begin
 foreach t in array array['retention_risk_cases','retention_risk_actions','student_occurrences','student_quality_pulses','retention_health_settings'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from anon,authenticated',t);
  execute format('grant select,insert,update on public.%I to service_role',t);
 end loop;
end $$;
revoke all on function public.retention_risk_observe(text,text,integer,date),public.retention_risk_claim(uuid,text) from public,anon,authenticated;
grant execute on function public.retention_risk_observe(text,text,integer,date),public.retention_risk_claim(uuid,text) to service_role;
commit;
