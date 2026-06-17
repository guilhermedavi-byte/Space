-- Space School — operação pedagógica + n8n
-- Migration idempotente. Mantém as tabelas legadas e copia os dados conhecidos.

create extension if not exists pgcrypto;

create table if not exists public.n8n_aulas_pedagogicas_space (
  id text primary key default gen_random_uuid()::text,
  onboarding_id text,
  aluno_id text,
  aluno_nome text,
  professor_id text,
  professor_nome text,
  titulo text,
  status_aula text default 'agendada',
  inicio timestamptz,
  fim timestamptz,
  timezone text default 'America/Sao_Paulo',
  video_provider text,
  video_room_id text,
  video_room_url text,
  video_join_url_aluno text,
  video_join_url_professor text,
  video_status text,
  google_meet_link_fallback text,
  plano text,
  briefing_pedagogico text,
  objetivo_aluno text,
  nivel_declarado text,
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.n8n_registros_aula_space (
  id text primary key default gen_random_uuid()::text,
  aula_id text,
  onboarding_id text,
  aluno_id text,
  aluno_nome text,
  professor_id text,
  professor_nome text,
  status text default 'realizada',
  conteudo_trabalhado text,
  desempenho_aluno text,
  humor_aluno text,
  estrelas integer,
  homework text,
  observacoes text,
  motivo_falta text,
  responsavel_falta text,
  reposicao_necessaria boolean default false,
  nova_data_aula timestamptz,
  tipo_remarcacao text,
  motivo_remarcacao text,
  registrado_por text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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

create table if not exists public.n8n_onboarding_alunos_space (
  id text primary key default gen_random_uuid()::text,
  aluno_id text,
  contract_id text unique,
  aluno_nome text,
  telefone text,
  email text,
  plano text,
  valor numeric,
  closer text,
  status_contrato text,
  status_financeiro text,
  pagamento_status text,
  status_onboarding text default 'novo',
  etapa_atual text,
  professor_id text,
  professor_nome text,
  professor_email text,
  professor_telefone text,
  primeira_aula_em timestamptz,
  duracao_minutos integer default 60,
  observacoes_primeira_aula text,
  horario_fixo_texto text,
  coordenacao_nome text,
  grupo_vip_id text,
  grupo_vip_nome text,
  briefing_pedagogico text,
  objetivo_ingles text,
  nivel_declarado text,
  pais text,
  estado text,
  disponibilidade_aluno text,
  risco_score numeric,
  risco_nivel text,
  asaas_customer_id text,
  asaas_subscription_id text,
  id_conversa_chatwoot text,
  origem_onboarding text,
  flexge_user_id text,
  flexge_status text,
  flexge_course_id text,
  flexge_course_name text,
  flexge_group_id text,
  flexge_group_name text,
  flexge_academic_plan_id text,
  flexge_academic_plan_name text,
  flexge_weekly_goal_minutes integer,
  flexge_enrollment_id text,
  flexge_enrollment_status text,
  flexge_total_study_minutes integer,
  flexge_weekly_study_minutes integer,
  flexge_lessons_completed integer,
  flexge_progress_percentage numeric,
  flexge_last_access_at timestamptz,
  flexge_current_level text,
  flexge_average_score numeric,
  flexge_streak_days integer,
  flexge_last_sync_at timestamptz,
  flexge_alerta_status text,
  metadata jsonb default '{}'::jsonb,
  n8n_status text,
  n8n_payload jsonb default '{}'::jsonb,
  n8n_resposta jsonb default '{}'::jsonb,
  n8n_erro text,
  assinou_em timestamptz,
  onboarding_disparado_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.n8n_onboarding_alunos_space
  add column if not exists aluno_id text,
  add column if not exists contract_id text,
  add column if not exists aluno_nome text,
  add column if not exists telefone text,
  add column if not exists email text,
  add column if not exists plano text,
  add column if not exists valor numeric,
  add column if not exists closer text,
  add column if not exists status_contrato text,
  add column if not exists status_financeiro text,
  add column if not exists pagamento_status text,
  add column if not exists status_onboarding text default 'novo',
  add column if not exists etapa_atual text,
  add column if not exists professor_id text,
  add column if not exists professor_nome text,
  add column if not exists professor_email text,
  add column if not exists professor_telefone text,
  add column if not exists primeira_aula_em timestamptz,
  add column if not exists duracao_minutos integer default 60,
  add column if not exists observacoes_primeira_aula text,
  add column if not exists horario_fixo_texto text,
  add column if not exists coordenacao_nome text,
  add column if not exists grupo_vip_id text,
  add column if not exists grupo_vip_nome text,
  add column if not exists briefing_pedagogico text,
  add column if not exists objetivo_ingles text,
  add column if not exists nivel_declarado text,
  add column if not exists pais text,
  add column if not exists estado text,
  add column if not exists disponibilidade_aluno text,
  add column if not exists risco_score numeric,
  add column if not exists risco_nivel text,
  add column if not exists asaas_customer_id text,
  add column if not exists asaas_subscription_id text,
  add column if not exists id_conversa_chatwoot text,
  add column if not exists origem_onboarding text,
  add column if not exists flexge_user_id text,
  add column if not exists flexge_status text,
  add column if not exists flexge_course_id text,
  add column if not exists flexge_course_name text,
  add column if not exists flexge_group_id text,
  add column if not exists flexge_group_name text,
  add column if not exists flexge_academic_plan_id text,
  add column if not exists flexge_academic_plan_name text,
  add column if not exists flexge_enrollment_id text,
  add column if not exists flexge_enrollment_status text,
  add column if not exists flexge_weekly_goal_minutes integer,
  add column if not exists flexge_weekly_study_minutes integer,
  add column if not exists flexge_total_study_minutes integer,
  add column if not exists flexge_lessons_completed integer,
  add column if not exists flexge_progress_percentage numeric,
  add column if not exists flexge_last_access_at timestamptz,
  add column if not exists flexge_average_score numeric,
  add column if not exists flexge_current_level text,
  add column if not exists flexge_streak_days integer,
  add column if not exists flexge_last_sync_at timestamptz,
  add column if not exists flexge_alerta_status text,
  add column if not exists metadata jsonb default '{}'::jsonb,
  add column if not exists n8n_status text,
  add column if not exists n8n_payload jsonb default '{}'::jsonb,
  add column if not exists n8n_resposta jsonb default '{}'::jsonb,
  add column if not exists n8n_erro text,
  add column if not exists assinou_em timestamptz,
  add column if not exists onboarding_disparado_em timestamptz,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

alter table public.n8n_aulas_pedagogicas_space
  add column if not exists onboarding_id text,
  add column if not exists aluno_id text,
  add column if not exists aluno_nome text,
  add column if not exists professor_id text,
  add column if not exists professor_nome text,
  add column if not exists professor_email text,
  add column if not exists aluno_email text,
  add column if not exists link_aula text,
  add column if not exists data_aula date,
  add column if not exists registro_pendente boolean default false,
  add column if not exists status_aula text default 'agendada',
  add column if not exists inicio timestamptz,
  add column if not exists fim timestamptz,
  add column if not exists video_room_url text,
  add column if not exists video_join_url_professor text,
  add column if not exists google_meet_link_fallback text,
  add column if not exists briefing_pedagogico text,
  add column if not exists objetivo_aluno text,
  add column if not exists nivel_declarado text,
  add column if not exists observacoes text,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

alter table public.n8n_registros_aula_space
  add column if not exists aula_id text,
  add column if not exists onboarding_id text,
  add column if not exists aluno_id text,
  add column if not exists aluno_nome text,
  add column if not exists professor_id text,
  add column if not exists professor_nome text,
  add column if not exists professor_email text,
  add column if not exists status text default 'realizada',
  add column if not exists conteudo_trabalhado text,
  add column if not exists conteudo_aula text,
  add column if not exists gramatica_trabalhada text,
  add column if not exists vocabulario_trabalhado text,
  add column if not exists pronuncia_conversacao text,
  add column if not exists atividade_realizada text,
  add column if not exists materiais_usados text,
  add column if not exists desempenho_aluno text,
  add column if not exists observacoes text,
  add column if not exists engajamento text,
  add column if not exists confianca text,
  add column if not exists humor text,
  add column if not exists humor_aluno text,
  add column if not exists estrelas integer,
  add column if not exists homework text,
  add column if not exists dificuldades_percebidas text,
  add column if not exists proximo_foco text,
  add column if not exists proxima_recomendacao text,
  add column if not exists proxima_aula_recomendada text,
  add column if not exists motivo_falta text,
  add column if not exists responsavel_falta text,
  add column if not exists reposicao_necessaria boolean default false,
  add column if not exists observacoes_falta text,
  add column if not exists nova_data timestamptz,
  add column if not exists nova_data_aula timestamptz,
  add column if not exists tipo_remarcacao text,
  add column if not exists tipo_movimento text,
  add column if not exists motivo_remarcacao text,
  add column if not exists registrado_por text,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

create table if not exists public.n8n_professores_space (
  id text primary key default gen_random_uuid()::text,
  professor_id text unique,
  nome text,
  email text,
  telefone text,
  status text default 'ativo',
  timezone text default 'America/Sao_Paulo',
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.n8n_satisfacao_alunos_space (
  id text primary key default gen_random_uuid()::text,
  aluno_id text,
  aluno_nome text,
  onboarding_id text,
  aula_id text,
  tipo text,
  nota numeric,
  mensagem text,
  respondido_em timestamptz,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.n8n_relatorios_pedagogicos_space (
  id text primary key default gen_random_uuid()::text,
  aluno_id text,
  aluno_nome text,
  onboarding_id text,
  professor_id text,
  periodo_inicio date,
  periodo_fim date,
  status text default 'pendente',
  titulo text,
  conteudo jsonb default '{}'::jsonb,
  url_relatorio text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.n8n_logs_pedagogico_space (
  id text primary key default gen_random_uuid()::text,
  workflow text not null,
  origem text,
  aluno_id text,
  onboarding_id text,
  idempotency_key text not null unique,
  payload_enviado jsonb default '{}'::jsonb,
  resposta_recebida jsonb default '{}'::jsonb,
  status text not null default 'pendente',
  erro text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.n8n_contatos_internos_space (
  id text primary key default gen_random_uuid()::text,
  nome text,
  email text,
  telefone text,
  area text,
  cargo text,
  status text default 'ativo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.n8n_flexge_mapeamento_planos_space (
  id text primary key default gen_random_uuid()::text,
  plano_space text unique,
  flexge_course_id text,
  flexge_course_name text,
  flexge_group_id text,
  flexge_group_name text,
  flexge_academic_plan_id text,
  flexge_academic_plan_name text,
  weekly_goal_minutes integer,
  status text default 'ativo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.n8n_flexge_evolucao_alunos_space (
  id text primary key default gen_random_uuid()::text,
  aluno_id text,
  aluno_nome text,
  onboarding_id text,
  flexge_user_id text,
  flexge_status text,
  flexge_enrollment_id text,
  flexge_enrollment_status text,
  flexge_weekly_goal_minutes integer,
  flexge_weekly_study_minutes integer,
  flexge_total_study_minutes integer,
  flexge_lessons_completed integer,
  flexge_progress_percentage numeric,
  flexge_last_access_at timestamptz,
  flexge_average_score numeric,
  flexge_current_level text,
  flexge_streak_days integer,
  flexge_last_sync_at timestamptz,
  flexge_alerta_status text,
  raw_payload jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.n8n_satisfacao_alunos_space
  add column if not exists aluno_id text,
  add column if not exists aluno_nome text,
  add column if not exists onboarding_id text,
  add column if not exists tipo text,
  add column if not exists nota numeric,
  add column if not exists created_at timestamptz default now();

alter table public.n8n_relatorios_pedagogicos_space
  add column if not exists aluno_id text,
  add column if not exists aluno_nome text,
  add column if not exists onboarding_id text,
  add column if not exists created_at timestamptz default now();

alter table public.n8n_flexge_evolucao_alunos_space
  add column if not exists aluno_id text,
  add column if not exists aluno_nome text,
  add column if not exists onboarding_id text,
  add column if not exists flexge_last_sync_at timestamptz,
  add column if not exists created_at timestamptz default now();

do $$
begin
  if to_regclass('public.n8n_onboarding_pedagogico_space') is not null then
    execute $copy$
      insert into public.n8n_onboarding_alunos_space
      select (jsonb_populate_record(
        null::public.n8n_onboarding_alunos_space,
        to_jsonb(legacy)
      )).*
      from public.n8n_onboarding_pedagogico_space legacy
      on conflict do nothing
    $copy$;

    execute $map$
      update public.n8n_onboarding_alunos_space target
      set
        risco_score = coalesce(target.risco_score, legacy.score_risco),
        status_financeiro = coalesce(target.status_financeiro, legacy.pagamento_status),
        pagamento_status = coalesce(target.pagamento_status, legacy.pagamento_status)
      from public.n8n_onboarding_pedagogico_space legacy
      where target.id = legacy.id
    $map$;
  end if;

  if to_regclass('public.n8n_logs_integracao_pedagogico_space') is not null then
    execute $copylogs$
      insert into public.n8n_logs_pedagogico_space
      select (jsonb_populate_record(
        null::public.n8n_logs_pedagogico_space,
        to_jsonb(legacy)
      )).*
      from public.n8n_logs_integracao_pedagogico_space legacy
      on conflict do nothing
    $copylogs$;
  end if;
end $$;

create index if not exists idx_ped_onboarding_status
  on public.n8n_onboarding_alunos_space (status_onboarding);
create unique index if not exists idx_ped_onboarding_contract
  on public.n8n_onboarding_alunos_space (contract_id);
create index if not exists idx_ped_onboarding_professor
  on public.n8n_onboarding_alunos_space (professor_id);
create index if not exists idx_ped_onboarding_professor_email
  on public.n8n_onboarding_alunos_space (lower(professor_email));
create index if not exists idx_ped_onboarding_risco
  on public.n8n_onboarding_alunos_space (risco_nivel, risco_score desc);
create index if not exists idx_ped_aulas_professor_email
  on public.n8n_aulas_pedagogicas_space (lower(professor_email));
create index if not exists idx_ped_aulas_inicio_status
  on public.n8n_aulas_pedagogicas_space (inicio desc, status_aula);
create index if not exists idx_ped_ocorrencias_abertas
  on public.n8n_ocorrencias_pedagogicas_space (status, created_at desc);
create index if not exists idx_ped_satisfacao_tipo
  on public.n8n_satisfacao_alunos_space (tipo, created_at desc);
create index if not exists idx_ped_flexge_aluno
  on public.n8n_flexge_evolucao_alunos_space (aluno_id, flexge_last_sync_at desc);
