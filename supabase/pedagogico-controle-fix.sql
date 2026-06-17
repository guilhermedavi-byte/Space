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
  add column if not exists motivo_remarcacao text,
  add column if not exists gramatica_trabalhada text,
  add column if not exists vocabulario_trabalhado text,
  add column if not exists pronuncia_conversacao text,
  add column if not exists atividade_realizada text,
  add column if not exists materiais_usados text,
  add column if not exists confianca text;

alter table public.n8n_aulas_pedagogicas_space
  add column if not exists onboarding_id text;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conrelid = 'public.n8n_registros_aula_space'::regclass
      and conname = 'n8n_registros_aula_space_status_check'
  ) then
    alter table public.n8n_registros_aula_space
      drop constraint n8n_registros_aula_space_status_check;
  end if;
end $$;

alter table public.n8n_registros_aula_space
  add constraint n8n_registros_aula_space_status_check
  check (status in ('realizada', 'falta', 'remarcada', 'cancelada'));

create index if not exists idx_n8n_registros_aula_professor
  on public.n8n_registros_aula_space (professor_id, created_at desc);

create index if not exists idx_n8n_registros_aula_aluno
  on public.n8n_registros_aula_space (aluno_id, created_at desc);
