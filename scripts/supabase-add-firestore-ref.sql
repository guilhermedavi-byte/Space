alter table if exists n8n_alunos_financeiro_space
  add column if not exists firestore_doc_id text;

create index if not exists idx_n8n_alunos_financeiro_space_firestore_doc_id
  on n8n_alunos_financeiro_space (firestore_doc_id);

alter table if exists n8n_cobrancas_financeiras_space
  add column if not exists firestore_doc_id text;

create index if not exists idx_n8n_cobrancas_financeiras_space_firestore_doc_id
  on n8n_cobrancas_financeiras_space (firestore_doc_id);

alter table if exists n8n_onboarding_alunos_space
  add column if not exists firestore_doc_id text;

create index if not exists idx_n8n_onboarding_alunos_space_firestore_doc_id
  on n8n_onboarding_alunos_space (firestore_doc_id);

alter table if exists n8n_aulas_pedagogicas_space
  add column if not exists firestore_doc_id text;

create index if not exists idx_n8n_aulas_pedagogicas_space_firestore_doc_id
  on n8n_aulas_pedagogicas_space (firestore_doc_id);

alter table if exists n8n_registros_aula_space
  add column if not exists firestore_doc_id text;

create index if not exists idx_n8n_registros_aula_space_firestore_doc_id
  on n8n_registros_aula_space (firestore_doc_id);

alter table if exists n8n_avaliacoes_aula_space
  add column if not exists firestore_doc_id text;

create index if not exists idx_n8n_avaliacoes_aula_space_firestore_doc_id
  on n8n_avaliacoes_aula_space (firestore_doc_id);

alter table if exists n8n_gravacoes_aula_space
  add column if not exists firestore_doc_id text;

create index if not exists idx_n8n_gravacoes_aula_space_firestore_doc_id
  on n8n_gravacoes_aula_space (firestore_doc_id);
