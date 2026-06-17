create table if not exists public.n8n_aulas_pedagogicas_space (
  id text primary key default gen_random_uuid()::text,
  onboarding_id text,
  aluno_id text,
  aluno_nome text,
  professor_id text,
  professor_nome text,
  titulo text,
  status_aula text not null default 'agendada'
    check (status_aula in ('agendada', 'aguardando_inicio', 'ao_vivo', 'realizada', 'falta', 'remarcada', 'cancelada', 'pendente_registro')),
  inicio timestamptz,
  fim timestamptz,
  timezone text default 'America/Sao_Paulo',
  video_provider text default 'mock',
  video_room_id text,
  video_room_url text,
  video_join_url_aluno text,
  video_join_url_professor text,
  video_status text,
  google_calendar_id text,
  google_event_id text,
  google_meet_link_fallback text,
  origem text default 'n8n',
  plano text,
  briefing_pedagogico text,
  objetivo_aluno text,
  nivel_declarado text,
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_n8n_aulas_pedagogicas_space_inicio
  on public.n8n_aulas_pedagogicas_space (inicio);

create index if not exists idx_n8n_aulas_pedagogicas_space_status
  on public.n8n_aulas_pedagogicas_space (status_aula);

create index if not exists idx_n8n_aulas_pedagogicas_space_aluno
  on public.n8n_aulas_pedagogicas_space (aluno_id);

create index if not exists idx_n8n_aulas_pedagogicas_space_professor
  on public.n8n_aulas_pedagogicas_space (professor_id);

create table if not exists public.n8n_registros_aula_space (
  id text primary key default gen_random_uuid()::text,
  aula_id text references public.n8n_aulas_pedagogicas_space(id) on delete cascade,
  aluno_id text,
  aluno_nome text,
  professor_id text,
  professor_nome text,
  status text not null default 'realizada'
    check (status in ('realizada', 'falta', 'remarcada', 'cancelada')),
  onboarding_id text,
  conteudo_trabalhado text,
  gramatica_trabalhada text,
  vocabulario_trabalhado text,
  pronuncia_conversacao text,
  atividade_realizada text,
  materiais_usados text,
  desempenho_aluno text,
  observacoes text,
  engajamento text,
  confianca text,
  humor text,
  humor_aluno text,
  estrelas integer,
  homework text,
  dificuldades_percebidas text,
  proximo_foco text,
  proxima_recomendacao text,
  motivo_falta text,
  responsavel_falta text,
  reposicao_necessaria boolean default false,
  nova_data timestamptz,
  nova_data_aula timestamptz,
  tipo_remarcacao text,
  motivo_remarcacao text,
  registrado_por text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_n8n_registros_aula_space_aula
  on public.n8n_registros_aula_space (aula_id);

create index if not exists idx_n8n_registros_aula_space_created
  on public.n8n_registros_aula_space (created_at);
