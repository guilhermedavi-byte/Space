-- Corrige o schema do espelho de aulas ao vivo da Space.
--
-- Contexto:
-- - O código de /api/schedule-events grava em n8n_aulas_pedagogicas_space
--   os campos firestore_doc_id, aluno_id, aluno_email e aluno_telefone.
-- - O schema real de produção está sem essas colunas, causando PGRST204
--   e deixando o espelho Supabase vazio.
--
-- Como rodar:
-- 1. Revisar este arquivo inteiro.
-- 2. Colar no SQL Editor do Supabase do projeto de PRODUÇÃO.
-- 3. Executar uma única vez.
-- 4. Depois, criar uma aula de teste e conferir se o insert no espelho funciona.
--
-- A migration é idempotente: usa IF NOT EXISTS e não apaga dados.

begin;

alter table if exists public.n8n_aulas_pedagogicas_space
  add column if not exists firestore_doc_id text,
  add column if not exists aluno_id text,
  add column if not exists aluno_email text,
  add column if not exists aluno_telefone text;

alter table if exists public.n8n_aulas_pedagogicas_space
  alter column professor_id type text using professor_id::text;

create index if not exists idx_n8n_aulas_pedagogicas_space_firestore_doc_id
  on public.n8n_aulas_pedagogicas_space (firestore_doc_id);

create index if not exists idx_n8n_aulas_pedagogicas_space_aluno
  on public.n8n_aulas_pedagogicas_space (aluno_id);

create index if not exists idx_n8n_aulas_pedagogicas_space_aluno_email
  on public.n8n_aulas_pedagogicas_space (lower(aluno_email));

commit;

-- Atualiza o cache de schema do PostgREST/Supabase quando permitido.
-- Se o SQL Editor não tiver permissão para NOTIFY, aguarde alguns segundos
-- ou acione reload do schema pelo painel/API do Supabase.
notify pgrst, 'reload schema';
