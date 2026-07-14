-- Wipe escopado do aluno Aluno Teste 01 (43YgxBac7gPzIViJyrrWj3o9CjU2) no Supabase.
-- DRY-RUN: rode primeiro apenas os SELECTs gerados/inspecione as contagens se desejar.
-- APPLY MANUAL: cole este arquivo no SQL Editor do Supabase somente depois de validar o dry-run Firestore/Auth.
-- Segurança: cada DELETE usa somente firestore_doc_id/id exato e fallback exato por e-mail/nome quando a coluna existir.

begin;

do $$
declare
  target_firestore_doc_id text := '43YgxBac7gPzIViJyrrWj3o9CjU2';
  target_email text := 'guilhermedavi@hotmail.com';
  target_name text := 'Aluno Teste 01';
  target_table text;
  predicate text;
  deleted_count integer;
begin
  foreach target_table in array array[
    'n8n_onboarding_alunos_space',
    'n8n_onboarding_pedagogico_space',
    'n8n_aulas_pedagogicas_space',
    'n8n_registros_aula_space',
    'n8n_ocorrencias_pedagogicas_space',
    'n8n_satisfacao_alunos_space',
    'n8n_flexge_evolucao_alunos_space',
    'n8n_professores_space',
    'n8n_relatorios_pedagogicos_space',
    'n8n_preferencias_alunos_pedagogico_space',
    'n8n_logs_pedagogico_space',
    'n8n_alunos_financeiro_space',
    'n8n_cobrancas_financeiras_space',
    'n8n_logs_cobranca_space',
    'n8n_eventos_cobranca_space',
    'n8n_pagamentos_asaas_space',
    'n8n_avaliacoes_aula_space',
    'n8n_gravacoes_aula_space'
  ] loop
    predicate := '';

    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = target_table and column_name = 'firestore_doc_id') then
      predicate := predicate || format('firestore_doc_id = %L', target_firestore_doc_id);
    end if;
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = target_table and column_name = 'student_id') then
      predicate := predicate || case when predicate = '' then '' else ' or ' end || format('student_id = %L', target_firestore_doc_id);
    end if;
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = target_table and column_name = 'aluno_id') then
      predicate := predicate || case when predicate = '' then '' else ' or ' end || format('aluno_id = %L', target_firestore_doc_id);
    end if;

    if target_email <> '' then
      if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = target_table and column_name = 'email') then
        predicate := predicate || case when predicate = '' then '' else ' or ' end || format('lower(trim(email::text)) = lower(trim(%L))', target_email);
      end if;
      if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = target_table and column_name = 'aluno_email') then
        predicate := predicate || case when predicate = '' then '' else ' or ' end || format('lower(trim(aluno_email::text)) = lower(trim(%L))', target_email);
      end if;
    end if;

    if target_name <> '' then
      if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = target_table and column_name = 'nome') then
        predicate := predicate || case when predicate = '' then '' else ' or ' end || format('lower(trim(nome::text)) = lower(trim(%L))', target_name);
      end if;
      if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = target_table and column_name = 'aluno_nome') then
        predicate := predicate || case when predicate = '' then '' else ' or ' end || format('lower(trim(aluno_nome::text)) = lower(trim(%L))', target_name);
      end if;
      if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = target_table and column_name = 'nome_aluno') then
        predicate := predicate || case when predicate = '' then '' else ' or ' end || format('lower(trim(nome_aluno::text)) = lower(trim(%L))', target_name);
      end if;
    end if;

    if predicate <> '' then
      execute format('delete from public.%I where %s', target_table, predicate);
      get diagnostics deleted_count = row_count;
      raise notice 'deleted % from %', deleted_count, target_table;
    else
      raise notice 'skipped %, no known matching columns', target_table;
    end if;
  end loop;
end $$;

-- Revise os NOTICEs antes de confirmar.
commit;
