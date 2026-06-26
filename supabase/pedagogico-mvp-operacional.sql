-- Space School / Plataforma Space
-- MVP operacional pedagógico: vínculo aluno-professor, aulas e registros.
-- Seguro para rodar mais de uma vez.

create extension if not exists pgcrypto;

create table if not exists public.student_teacher_assignments (
  id uuid primary key default gen_random_uuid(),
  student_id text not null,
  teacher_id text not null,
  status text not null default 'active' check (status in ('active', 'inactive', 'paused', 'ended')),
  plan_name text,
  meeting_room_slug text,
  meeting_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists student_teacher_assignments_one_active_student
  on public.student_teacher_assignments (student_id)
  where status = 'active';

create index if not exists student_teacher_assignments_teacher_status_idx
  on public.student_teacher_assignments (teacher_id, status);

create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  student_id text not null,
  teacher_id text not null,
  assignment_id uuid references public.student_teacher_assignments(id) on delete set null,
  starts_at timestamptz,
  ends_at timestamptz,
  timezone text not null default 'America/Sao_Paulo',
  status text not null default 'scheduled' check (status in ('scheduled', 'live', 'completed', 'canceled', 'no_show', 'rescheduled')),
  meeting_room_slug text,
  meeting_url text,
  plan_name text,
  recording_enabled boolean not null default false,
  recording_url text,
  transcript_url text,
  transcript_text text,
  metadata jsonb not null default '{}'::jsonb,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists classes_teacher_starts_idx
  on public.classes (teacher_id, starts_at);

create index if not exists classes_student_starts_idx
  on public.classes (student_id, starts_at);

create index if not exists classes_assignment_idx
  on public.classes (assignment_id);

create table if not exists public.lesson_records (
  id uuid primary key default gen_random_uuid(),
  class_id uuid references public.classes(id) on delete cascade,
  student_id text not null,
  teacher_id text not null,
  status text not null default 'realizada' check (status in ('realizada', 'falta', 'remarcada', 'cancelada')),
  engagement text,
  humor text,
  content_worked text,
  observations text,
  perceived_difficulties text,
  next_focus text,
  homework text,
  recording_url text,
  transcript_url text,
  transcript_text text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists lesson_records_one_per_class
  on public.lesson_records (class_id)
  where class_id is not null;

create index if not exists lesson_records_teacher_created_idx
  on public.lesson_records (teacher_id, created_at desc);

alter table if exists public.n8n_aulas_pedagogicas_space
  add column if not exists assignment_id uuid,
  add column if not exists deleted_at timestamptz,
  add column if not exists recording_enabled boolean not null default false,
  add column if not exists meeting_room_slug text,
  add column if not exists meeting_url text;

alter table if exists public.n8n_registros_aula_space
  add column if not exists dificuldades_percebidas text,
  add column if not exists proximo_foco text,
  add column if not exists recording_url text,
  add column if not exists transcript_url text,
  add column if not exists transcript_text text;

