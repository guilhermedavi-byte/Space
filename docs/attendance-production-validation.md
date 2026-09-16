# Atendimento — homologação da foundation no ambiente principal

Data: 15/09/2026 UTC (14/09 à noite em America/Sao_Paulo). **Foundation APPROVED**, no escopo de persistência PostgreSQL/PostgREST solicitado. A aprovação não representa integração Meta, deploy da API nem login Firebase ponta a ponta.

## 1. Production target validado

`space-idiomas-n8n`, ref mascarado `mlp…gkw`, AWS us-west-1, Healthy. Endpoint local confirmado contra a referência conhecida e contra Vercel Production; service role local igual à configuração Vercel e aceita em leitura autenticada pelo projeto. Preflight passou em 02:20:38 UTC.

A Space optou temporariamente por usar o ambiente principal como ambiente de desenvolvimento/homologação do módulo Atendimento porque não há usuários ativos na plataforma neste momento, segundo decisão executiva. `space-staging` deixa de ser pré-requisito desta fase.

Guard Attendance: `APP_ENV=production`, scope production, `ATTENDANCE_ALLOW_PRODUCTION_MUTATIONS=true`, ref exato, URL canônica, fingerprint da credencial independente da env e sinais coerentes. Desconhecidos/mismatches continuam negados. O runner SQL também requer confirmação de produção e fingerprint da senha quando usa conexão direta. A flag não relaxa guard de outro domínio.

Reutilizada `.env.local` explicitamente, sem copiar valores para outra env e sem mudar conteúdo; permissão restringida para 0600. Nenhuma chave criada/resetada. A autorização foi ativada no processo de certificação; a flag HTTP `ATTENDANCE_FOUNDATION_ENABLED` não foi habilitada na Vercel.

## 2. Backup/recovery

Painel Backups confirmou plano Free sem backup agendado; PITR não contratado. Não foi comprado plano/add-on. Timestamp pré-migration: anúncio em **02:26:15.434 UTC**; revisão anterior em [review](evidence/attendance-production-review-2026-09-15.json).

**Não existe recovery point completo comprovado.** Catálogo exportado é evidência de estrutura, não backup de dados. Antes do commit, a migration transacional permite rollback por falha. Depois do commit, rollback operacional consiste em manter Atendimento desligado, interromper seu tráfego e aplicar correção aditiva revisada; não apagar objetos ou dados legados. Não há down migration destrutiva. A falta de recuperação integral é risco residual conhecido desta decisão temporária.

## 3. Schema inventory

PostgreSQL **17.6**. Antes: 141 relações public, 48 funções, 1.532 colunas, 284 índices, 229 constraints e 20 triggers. Nenhuma das 14 tabelas de domínio ou função `attendance_*` existia. Schemas/owners/roles/heranças, extensions, colunas/defaults, constraints, índices, triggers, RLS, ACL/default privileges e publicações inspecionados.

[Antes](evidence/attendance-production-before-2026-09-15.json) e [depois](evidence/attendance-production-after-2026-09-15.json). Inventário fresco pré-apply coincidiu integralmente com a baseline coletada nesta execução.

## 4. Migration review

Somente `202609140001_attendance_foundation.sql`. Colunas, defaults e constraints de audit/outbox coincidiram com referência PostgreSQL 17. Ambas já tinham RLS e grants apenas de postgres/service_role. Nenhum objeto legado apagado ou substituído. Seus catálogos anteriores/posteriores foram comparados e preservados.

Adaptação restrita: helper privado `attendance_enqueue_outbox` reconhece conexões administrativas do provider sintético `attendance_validation` com `validation_run_id` válido e grava seus eventos em namespace `attendance.validation.*`, status `failed`, disponibilidade `infinity`, marcador `dispatch_disabled`. Outros providers conservam o contrato pending anterior. Não habilita dispatcher nem cria segunda outbox.

## 5. Migration aplicada

Aplicada pelo SQL Editor autenticado no mesmo projeto principal validado pelo guard, após o anúncio pré-apply. Esse transporte administrativo reutilizou o acesso existente, sem exigir senha PostgreSQL local e sem expor token da sessão. A migration concluiu com sucesso; verificação independente do catálogo capturada às **02:29:49 UTC**.

O painel alertou genericamente sobre DROP de triggers e RLS não reconhecida no SQL dinâmico. Foi executado o SQL revisado, com enable RLS e REVOKE próprios; não foi aceita transformação automática da migration pelo painel. Nenhuma outra migration foi aplicada por esta tarefa.

## 6. Objetos criados

14 tabelas permanentes: connections, teams, attendance_members, team_members, channels, channel_teams, contacts, contact_identities, channel_contact_state, conversations, conversation_participants, messages, conversation_reads e conversation_events.

Comparação exata contra PostgreSQL 17 local: **111 colunas, 99 constraints (incluindo FKs/checks/uniques), 36 índices, 2 triggers e 13 funções**. RLS ativa nas 14 tabelas, owner postgres, sem grants diretos para anon/authenticated/service_role. Objetos legados e tabelas compartilhadas preservados.

## 7. RPCs

Seis RPCs backend-only: attendance_ingest_message, attendance_append_message, attendance_update_conversation, attendance_mark_read, attendance_get_conversation e attendance_list_conversations. Assinaturas, resultados, bodies por hash, owners, grants e search_path comparados com a referência. Helpers não expostos às roles de aplicação.

## 8. Testes de persistence

Nove cenários HTTP remotos passaram, além de consultas diretas de invariantes. Connection/canais/times/memberships, contato, conversas, participantes, inbound, intenção outbound pending, timeline, cursor, status, last_message, audit e outbox persistiram corretamente. [Resultados HTTP](evidence/attendance-production-http-2026-09-15.json).

Run exclusivo: `attendance-prod-validation-20260915022406289-44047af3`.

## 9. Idempotência

**duplicate_persistence_count = 0**, medido em registros persistidos por chave externa, comando outbound e conversa ativa. Replay após commit retorna o mesmo ID; payload conflitante na mesma chave retorna 409. Vinte entradas idênticas concorrentes produzem uma mensagem e um conjunto de efeitos. [Métricas](evidence/attendance-production-metrics-2026-09-15.json).

## 10. Concorrência

Dois lotes de 20 requests HTTP simultâneos no Supabase: dedupe da mesma inbound e criação da mesma conversa com mensagens diferentes. Pico medido no cliente: 20 requests em voo. Uma conversa, sequências 1–20 e last_message da sequência 20. Assignment com mesma versão produziu um vencedor e um 409. **concurrency_integrity_failure = 0**. Não foi aplicado stress test pesado; contagem de waiters SQL foi medida na suíte local, não alegada como medição remota.

## 11. Team isolation

A acessa A, B acessa B; detalhe, mensagens e append cruzados negados. Membro habilitado sem time negado. Listagens contêm apenas time permitido. **cross_team_unauthorized_success = 0**.

## 12. Permission matrix

36 probes reais em PostgreSQL: quatro principais × nove operações (conversation/messages read, inbound, outbound intent, assignment, status, identity, audit e outbox). Cada probe de mutação foi desfeito em subtransação, e a sessão inteira encerrou em rollback.

| Principal | Nove operações |
| --- | --- |
| anon | Negadas |
| authenticated sem membership | Negadas |
| authenticated com membership | Negadas no acesso SQL direto, conforme arquitetura backend-only |
| service_role | Permitidas com ator autorizado |

Também negado acesso HTTP direto service_role às tabelas de domínio e ao helper privado. A matriz usa `SET LOCAL ROLE` e claims sintéticas na sessão SQL; não é teste de emissão de JWT Supabase nem de login Firebase. A identidade real de atendentes continua responsabilidade da API autenticada. [Matriz completa](evidence/attendance-production-permissions-2026-09-15.json).

## 13. SECURITY DEFINER

Oito funções definer, owner postgres, search_path `pg_catalog, public`; helpers restantes invoker. RPCs aceitas apenas pela role autorizada. Entradas inválidas, cursor fora de faixa, paginação inválida, ator sem membership e acesso cruzado negados em runtime. Agente comum não consegue vincular identidade; supervisor autorizado consegue. CREATE público não concedido a anon/authenticated/service_role. Nenhuma escalada observada nos cenários testados.

## 14. Identity safety

Três identidades normalizadas para telefone **sintético reservado a exemplos**; formato separado de prova de titularidade. Conversa funciona sem Lead/Aluno e sem associação automática. Associação manual gravou source/type/id/autor/timestamp, com evento/audit. Vínculo na conversa A não alterou participante da conversa B para o mesmo contato. IDs de pessoa foram sintéticos, sem escrita em Firestore/DataCrazy.

## 15. Outbox/consumer safety

Inventário SQL: sem pg_cron; função Retenção apenas grava outbox; trigger existente apenas atualiza updated_at. No repo, consumer de projeção lifecycle filtra aggregate_type=retention_case; nenhum dispatcher Atendimento. Auditoria de todas as automações fora do repositório **não é completa**.

Mitigação aplicada antes de qualquer fixture: provider e canal sintéticos, nenhum destino/credencial Meta, helper de isolamento antes do commit. **27 eventos** ficaram failed/infinity/dispatch_disabled, todos com attempts=0; zero avanço de transporte ou evento elegível para despacho. Nenhuma chamada a provedor externo foi feita pelos testes. **unexpected_external_side_effects = 0 observados**, limitado a esses controles/evidências; não é auditoria universal de sistemas externos.

## 16. Performance

Sete EXPLAIN ANALYZE SELECT limitados, timeout 5s: inbox por time/status, assignee, abertas, ordenação last_message_at, timeline, external message e external contact. Tempos: **0,058 / 0,047 / 0,027 / 0,065 / 0,087 / 0,051 / 0,056 ms**. Dataset de apenas 24 mensagens; esses números não representam SLA sob carga. Nenhum índice adicional criado por extrapolação. [Planos completos](evidence/attendance-production-performance-2026-09-15.json).

## 17. Cleanup

147 registros enumerados antes da exclusão, restritos ao run e às relações exatas. Referências externas invalidam o cleanup. Lock exclusivo somente na tabela nova de eventos; trigger próprio temporariamente suspenso e restaurado na mesma transação. Não utilizado session_replication_role nem script wipe.

| Tabela | Removidos do run | Restantes do run |
| --- | ---: | ---: |
| `teams` | 2 | 0 |
| `channels` | 2 | 0 |
| `contacts` | 3 | 0 |
| `messages` | 24 | 0 |
| `audit_logs` | 31 | 0 |
| `connections` | 1 | 0 |
| `team_members` | 3 | 0 |
| `channel_teams` | 2 | 0 |
| `conversations` | 4 | 0 |
| `outbox_events` | 27 | 0 |
| `attendance_members` | 4 | 0 |
| `contact_identities` | 3 | 0 |
| `conversation_reads` | 1 | 0 |
| `conversation_events` | 31 | 0 |
| `channel_contact_state` | 4 | 0 |
| `conversation_participants` | 5 | 0 |

**remaining_test_records_after_cleanup = 0**. As 14 tabelas permanecem. Leitura independente pós-commit às **02:35:00 UTC** confirmou zero registros nas entidades consultadas, audit/outbox de volta à baseline zero e trigger habilitado. [Cleanup](evidence/attendance-production-cleanup-2026-09-15.json), [pós-commit](evidence/attendance-production-post-cleanup-2026-09-15.json).

## 18. Testes automatizados

51 testes dedicados aprovados em PostgreSQL 17/PostgREST, sem falhas/skips; inclui guard e quarentena outbox. Mais dois testes do executor principal, incluindo 36 probes SQL locais e cleanup com sentinela fora do run preservada. Artefatos de logs locais em `/tmp/attendance-production-sql-tests.log` e `/tmp/attendance-production-operator-tests.log`.

Suíte geral final: **446 testes, 439 aprovados, 0 falhas, 7 skips opt-in**. A integração do executor principal foi executada separadamente: 2/2 aprovados. Uma repetição local encontrou indisponibilidade transitória da imagem Docker; após confirmar o digest da imagem já instalada, a repetição final passou. Nenhum teste remoto roda automaticamente por npm test.

Verificação adicional dos artefatos: zero ocorrências literais dos secrets conhecidos da env nas evidências produzidas. `git diff --check` sem erros.

## 19. Regressões

Nenhuma falha na suíte geral executada. Comparação do catálogo não encontrou alteração de coluna/constraint/índice/trigger/função/relação/policy legada. Nenhum dado legado apagado por este trabalho. A árvore compartilhada contém trabalho simultâneo financeiro/comercial; esses resultados não equivalem à revisão de todas as alterações desses módulos.

## 20. Riscos restantes

- Ausência de backup/PITR e uso temporário do principal para desenvolvimento.
- Service role compartilhada continua privilegiada e pode impersonar p_actor_uid; nunca deve sair do backend. Produção autorizada exige a flag explícita e fingerprint conhecido.
- Inventário de consumidores externos incompleto; quarentena desta certificação não substitui auditoria antes de um dispatcher real.
- Auth Firebase/API Vercel ponta a ponta, credenciais Meta, webhook e transporte não foram homologados nesta fase de banco. API nova continua desligada por padrão.
- Dataset pequeno não certifica capacidade; identidade por telefone não é prova de pessoa.

## 21. Foundation APPROVED

Todos os cinco KPIs solicitados resultaram zero no escopo medido. Foundation PostgreSQL/PostgREST **APPROVED** para a próxima implementação. Staging não bloqueia o desenvolvimento. [Gate consolidado](evidence/attendance-production-gate-2026-09-15.json).

## 22. Próxima fase

1. Meta webhook verification.
2. Raw/durable webhook ingestion.
3. Idempotent inbound processing.
4. Status/event processing.
5. Outbound dispatcher somente depois desses componentes e da revisão dos consumidores reais.

Inbox UI permanece posterior a essa infraestrutura. Nenhum webhook, worker, UI, conexão Meta ou deploy foi executado nesta homologação.
