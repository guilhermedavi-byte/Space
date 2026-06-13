create table if not exists public.n8n_avaliacoes_aula_space (
  id bigserial primary key,
  aula_id text not null,
  aluno_id text,
  aluno_nome text,
  professor_id text,
  professor_nome text,
  nota_professor integer not null check (nota_professor between 1 and 10),
  mensagem text,
  respondido_por text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_n8n_avaliacoes_aula_space_aula
  on public.n8n_avaliacoes_aula_space (aula_id);

create index if not exists idx_n8n_avaliacoes_aula_space_professor
  on public.n8n_avaliacoes_aula_space (professor_id);

create index if not exists idx_n8n_avaliacoes_aula_space_created
  on public.n8n_avaliacoes_aula_space (created_at);
