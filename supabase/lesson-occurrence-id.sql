alter table if exists public.n8n_aulas_pedagogicas_space
  add column if not exists occurrence_id text;

create index if not exists idx_n8n_aulas_pedagogicas_space_occurrence_id
  on public.n8n_aulas_pedagogicas_space (occurrence_id);

alter table if exists public.n8n_registros_aula_space
  add column if not exists occurrence_id text;

create index if not exists idx_n8n_registros_aula_space_occurrence_id
  on public.n8n_registros_aula_space (occurrence_id);
