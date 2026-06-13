create table if not exists public.n8n_gravacoes_aula_space (
  id bigserial primary key,
  aula_id text not null,
  aluno_id text,
  aluno_nome text,
  professor_id text,
  professor_nome text,
  status text not null default 'requested',
  video_provider text,
  video_room_id text,
  storage_provider text default 'GOOGLE_DRIVE',
  pasta_drive_nome text,
  drive_folder_id text,
  drive_file_id text,
  recording_url text,
  transcript_url text,
  transcricao_texto text,
  transcricao_status text,
  solicitado_por text,
  started_at timestamptz,
  stopped_at timestamptz,
  processed_at timestamptz,
  raw_payload jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_n8n_gravacoes_aula_space_aula
  on public.n8n_gravacoes_aula_space (aula_id);

create index if not exists idx_n8n_gravacoes_aula_space_aluno
  on public.n8n_gravacoes_aula_space (aluno_nome);

create index if not exists idx_n8n_gravacoes_aula_space_professor
  on public.n8n_gravacoes_aula_space (professor_id);

create index if not exists idx_n8n_gravacoes_aula_space_status
  on public.n8n_gravacoes_aula_space (status);

create index if not exists idx_n8n_gravacoes_aula_space_created
  on public.n8n_gravacoes_aula_space (created_at desc);
