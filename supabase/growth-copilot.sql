create table if not exists public.growth_sales_scripts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null,
  content text not null,
  examples text,
  when_to_use text,
  avoid text,
  active boolean default true,
  order_index integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.growth_sales_objections (
  id uuid primary key default gen_random_uuid(),
  objection text not null,
  category text not null,
  recommended_response text not null,
  deepening_question text,
  closing_phrase text,
  active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.growth_winning_phrases (
  id uuid primary key default gen_random_uuid(),
  phrase text not null,
  context text,
  stage text,
  closer text,
  usage_count integer default 0,
  positive_count integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.growth_copilot_sessions (
  id uuid primary key default gen_random_uuid(),
  lead_context jsonb default '{}'::jsonb,
  transcript text,
  summary jsonb default '{}'::jsonb,
  closer text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.growth_copilot_suggestions (
  id uuid primary key default gen_random_uuid(),
  lead_name text,
  closer text,
  stage text,
  cards jsonb default '[]'::jsonb,
  transcript_tail text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.growth_copilot_feedback (
  id uuid primary key default gen_random_uuid(),
  suggestion jsonb default '{}'::jsonb,
  feedback text not null,
  used_in_call boolean default false,
  saved_to_playbook boolean default false,
  closer text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
