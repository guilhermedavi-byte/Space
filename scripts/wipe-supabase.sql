-- Wipe de dados de teste do Supabase (projeto space-idiomas-n8n).
--
-- Como rodar:
-- 1. Abra o Supabase Dashboard do projeto correto.
-- 2. Vá em SQL Editor.
-- 3. Cole este arquivo inteiro.
-- 4. Revise se o projeto selecionado é o de teste/limpeza esperado.
-- 5. Execute.
--
-- Escopo:
-- - Remove dados operacionais/pedagógicos/financeiros de alunos, professores e aulas.
-- - Usa DELETE, não TRUNCATE, para evitar efeitos agressivos em sequences/permissões.
-- - Não inclui tabelas de Growth, Outbound, SDR, metas, copilot ou fontes auxiliares preservadas.
--
-- Observação:
-- - A ordem abaixo apaga tabelas dependentes antes das tabelas base.

begin;

delete from n8n_avaliacoes_aula_space;
delete from n8n_gravacoes_aula_space;
delete from n8n_registros_aula_space;
delete from n8n_ocorrencias_pedagogicas_space;
delete from n8n_satisfacao_alunos_space;
delete from n8n_flexge_evolucao_alunos_space;
delete from n8n_preferencias_alunos_pedagogico_space;
delete from n8n_relatorios_pedagogicos_space;
delete from n8n_logs_pedagogico_space;
delete from n8n_logs_cobranca_space;
delete from n8n_eventos_cobranca_space;
delete from n8n_pagamentos_asaas_space;
delete from n8n_cobrancas_financeiras_space;
delete from n8n_aulas_pedagogicas_space;
delete from n8n_onboarding_pedagogico_space;
delete from n8n_onboarding_alunos_space;
delete from n8n_professores_space;
delete from n8n_alunos_financeiro_space;

commit;
