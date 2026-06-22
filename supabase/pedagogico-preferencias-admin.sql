-- Status pedagógico por acesso administrativo.
-- Marcar um aluno como inativo aqui não altera o cadastro financeiro,
-- o onboarding ou a visualização de outro administrador.

create table if not exists public.n8n_preferencias_alunos_pedagogico_space (
  id text primary key default gen_random_uuid()::text,
  admin_id text not null,
  admin_email text,
  aluno_chave text not null,
  status text not null default 'ativo'
    check (status in ('ativo', 'inativo')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (admin_id, aluno_chave)
);

create index if not exists idx_ped_preferencias_admin
  on public.n8n_preferencias_alunos_pedagogico_space (admin_id, status);
