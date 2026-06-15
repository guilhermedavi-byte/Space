create table if not exists public.n8n_logs_integracao_pedagogico_space (
  id text primary key default gen_random_uuid()::text,
  workflow text not null,
  origem text,
  aluno_id text,
  onboarding_id text,
  idempotency_key text not null unique,
  payload_enviado jsonb default '{}'::jsonb,
  resposta_recebida jsonb default '{}'::jsonb,
  status text not null default 'pendente'
    check (status in ('pendente', 'enviado', 'erro', 'sucesso')),
  erro text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_n8n_logs_integracao_pedagogico_workflow
  on public.n8n_logs_integracao_pedagogico_space (workflow);

create index if not exists idx_n8n_logs_integracao_pedagogico_status
  on public.n8n_logs_integracao_pedagogico_space (status);

create index if not exists idx_n8n_logs_integracao_pedagogico_created
  on public.n8n_logs_integracao_pedagogico_space (created_at desc);

create table if not exists public.n8n_onboarding_pedagogico_space (
  id text primary key default gen_random_uuid()::text,
  aluno_id text,
  contract_id text not null unique,
  aluno_nome text,
  telefone text,
  email text,
  plano text,
  valor numeric,
  status_contrato text,
  pagamento_status text,
  status_onboarding text default 'novo',
  etapa_atual text,
  grupo_vip text,
  professor_id text,
  professor_nome text,
  professor_telefone text,
  primeira_aula_em timestamptz,
  duracao_minutos integer default 60,
  observacoes_primeira_aula text,
  link_sala_jitsi text,
  score_risco numeric,
  flexge_user_id text,
  flexge_status text,
  flexge_course_id text,
  flexge_group_id text,
  flexge_academic_plan_id text,
  flexge_weekly_goal_minutes integer,
  flexge_total_study_minutes integer,
  flexge_weekly_study_minutes integer,
  flexge_progress_percentage numeric,
  flexge_lessons_completed integer,
  flexge_last_access_at timestamptz,
  flexge_average_score numeric,
  flexge_current_level text,
  origem text,
  metadata jsonb default '{}'::jsonb,
  assinou_em timestamptz,
  onboarding_disparado_em timestamptz,
  n8n_status text,
  n8n_payload jsonb default '{}'::jsonb,
  n8n_resposta jsonb default '{}'::jsonb,
  n8n_erro text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_n8n_onboarding_pedagogico_status
  on public.n8n_onboarding_pedagogico_space (status_onboarding);

create index if not exists idx_n8n_onboarding_pedagogico_aluno
  on public.n8n_onboarding_pedagogico_space (aluno_id);

create index if not exists idx_n8n_onboarding_pedagogico_updated
  on public.n8n_onboarding_pedagogico_space (updated_at desc);

create table if not exists public.n8n_ocorrencias_pedagogicas_space (
  id text primary key default gen_random_uuid()::text,
  aluno_id text,
  aluno_nome text,
  professor_id text,
  professor_nome text,
  onboarding_id text,
  aula_id text,
  tipo text,
  severidade text default 'media',
  status text default 'aberta',
  titulo text,
  descricao text,
  motivo text,
  score_risco numeric,
  metadata jsonb default '{}'::jsonb,
  observacao_resolucao text,
  resolvida_por text,
  resolvida_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_n8n_ocorrencias_pedagogicas_status
  on public.n8n_ocorrencias_pedagogicas_space (status);

create index if not exists idx_n8n_ocorrencias_pedagogicas_severidade
  on public.n8n_ocorrencias_pedagogicas_space (severidade);

create index if not exists idx_n8n_ocorrencias_pedagogicas_created
  on public.n8n_ocorrencias_pedagogicas_space (created_at desc);

alter table public.n8n_aulas_pedagogicas_space
  add column if not exists onboarding_id text;

alter table public.n8n_registros_aula_space
  add column if not exists onboarding_id text,
  add column if not exists desempenho_aluno text,
  add column if not exists humor_aluno text,
  add column if not exists estrelas integer,
  add column if not exists homework text,
  add column if not exists proxima_recomendacao text,
  add column if not exists responsavel_falta text,
  add column if not exists reposicao_necessaria boolean default false,
  add column if not exists nova_data_aula timestamptz,
  add column if not exists tipo_remarcacao text,
  add column if not exists motivo_remarcacao text;

create index if not exists idx_n8n_aulas_pedagogicas_onboarding
  on public.n8n_aulas_pedagogicas_space (onboarding_id);

create index if not exists idx_n8n_registros_aula_onboarding
  on public.n8n_registros_aula_space (onboarding_id);
