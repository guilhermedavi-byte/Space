> Estado atual: V2 habilitado sob a política oficial de preservação legacy. Ver [rollout concluído](cancellation-legacy-rollout.md). Requisitos históricos anteriores não bloqueiam os 227 legados.

## Estado atual — Firestore e Supabase

Atualização em 2026-09-15: n8n excluído do escopo por instrução explícita do usuário. O acesso ao Firestore foi recuperado via Cloud Shell autenticado; export completo de users (266 documentos) e inventário de subcoleções concluídos. Os 227 alunos da UI correspondem exatamente aos 227 users student. Ver `docs/cancellation-firestore-supabase-certification.md` e `artifacts/cancellation-production/canonical-reconciliation-v2-summary.json`. As referências abaixo a autenticação bloqueada, ausência de export ou exigência de n8n são históricas e estão superadas. A ativação permanece bloqueada por dados contratuais/planos, elegibilidade e conflitos; nenhum backfill foi aplicado.

# Cancellation Lifecycle V2 — runbook de produção

## Estado desta execução

**Implementation PASS; Production certification BLOCKED; Deployment NOT DEPLOYED nesta fase; Lifecycle V2 DISABLED**, comprovado pelo runtime público. Nenhuma migration, fixture, backfill, regra, workflow, variável ou agendamento remoto foi alterado nesta fase. Consultas SQL foram `BEGIN READ ONLY ... ROLLBACK`.

Evidências: `artifacts/cancellation-production/preflight.json`, inventários SQL/REST, runtime, metadata Vercel, reconciliação parcial e testes. Os 479 testes da implementação continuam como baseline; esta fase repetiu os checks de política e testes locais com PostgreSQL 17, sem confundi-los com certificação externa.

## 1. Destinos identificados

| Sistema | Destino real / evidência |
|---|---|
| Vercel | equipe `guilhermedavi-4547s-projects`, projeto `space`, ID `prj_FcxsR8A6rXLVIo2DArdAFDlm7pq8` |
| Produção atual | `dpl_8mdX14yQz9tLYvbntnB1NFFNMGZo`, READY, `space-ce0zvkois-guilhermedavi-4547s-projects.vercel.app` |
| Domínio | `https://plataforma.spaceschoolbr.com` |
| Git | `guilhermedavi-byte/Space`, branch `main`; deployment baseline `f59d7d2fec0b484b6d3aa263aed3f76843cc9458` |
| Supabase | `space-idiomas-n8n`, `mlpojyvwyqcrelagtgkw`, `https://mlpojyvwyqcrelagtgkw.supabase.co`, branch main / PRODUCTION no painel |
| Banco | PostgreSQL 17.6, database postgres, schema public; sem tabela supabase_migrations.schema_migrations |
| Firestore | `plataforma-space`, database `(default)`, southamerica-east1; console autenticado, CLI expirada |
| n8n | Instância e IDs de workflows ainda não identificados; N8N_BASE_URL é sensitive/redacted |
| Scheduler | Vercel `crons.definitions=[]`; pg_cron ausente; scheduler externo não verificado |

**Sensitive não significa ausente.** O export Vercel devolveu valores vazios para variáveis sensíveis. A API de metadata confirmou `type=sensitive`, sem valor legível. Não substituir credenciais ou configurar valores vazios a partir desse export. Conta de serviço Google, segredo n8n e segredo de sessão podem existir no deployment; não foram validados pelo export. `RETENTION_CHURN_JOB_SECRET` não consta na lista de variáveis de produção consultada.

## 2. Preflight e divergências reais

- As oito tabelas afetadas consultadas no snapshot tinham zero registros: students, subscriptions, retention_cases, retention_events, outbox_events, charges, service_periods, n8n_cobrancas_financeiras_space. O REST também confirmou n8n_alunos_financeiro_space vazia.
- Schema ainda admite active/cancellation_scheduled/churned, sem cancellation_requested e sem as datas novas. A migration 202609150001 não está instalada.
- UI autenticada lista **226 alunos**. Dashboard exibe **145 ativos** por sua metodologia legada; esses totais não têm o mesmo escopo.
- Fonte pedagógica real contém **7.637 registros**, **163 IDs distintos de aluno** e **2.716 registros com data posterior ao dia de negócio do inventário**. Contagem de registros futuros inclui seus diferentes statuses; não equivale a aulas futuras válidas.
- Firestore publicado em 25/07/2026 ainda permite writes legados em users/aulas sem a guarda de lifecycle, nos blocos inspecionados.
- A API de export navegada diretamente foi bloqueada pelo cliente do navegador. Não foi contornado esse bloqueio.

**NO-GO para ativação global:** o serviço canônico recusa novos direitos quando não encontra o aluno/contrato. Não habilitar V2 com zero assinaturas diante de alunos e agenda existentes. Não deduzir que as 226 pessoas estejam ativas nem criar datas pelo histórico de aulas.

## 3. Reconciliação e export

`reconciliation.csv`: **163 AMBIGUOUS, SAFE 0, CONFLICT 0, INVALID 0**. É uma reconciliação **parcial de referências pedagógicas**, não o censo dos 226 alunos Firestore nem prova de ausência de conflitos nesses alunos. Cada referência tem hash estável, origem, motivo e ação manual. Nenhuma linha foi aplicada.

Próxima etapa necessária: concluir autenticação Firebase já aberta no Chrome, obter export completo de users com eventos originais e cruzar identidade por IDs comprovados. Não enviar senha/código na conversa. Depois, executar:

```sh
node scripts/cancellation-lifecycle-backfill-dry-run.js users-export.json saida-backfill
node scripts/cancellation-production-reconcile.js manifest-real.json artifacts/cancellation-production
```

O segundo script usa o importador existente para classificar users. Manifest contém `firestoreUsers`, `subscriptions`, `pedagogicalRows` e `sourceMetadata`. `firestoreUsers:null` significa indisponível e gera relatório incompleto; nunca vira base vazia certificada. Identidade de assinatura deve ser enriquecida com firestore_student_id a partir do join comprovado com students, não por nome/email aproximado.

SAFE exige revisão do payload determinístico; AMBIGUOUS/CONFLICT/INVALID ficam fora do backfill automático. Snapshot exportado sem contexto não autoriza substituição de estado vivo. Reexecutar o preflight antes do apply, porque este checkout e o ambiente têm outras frentes de trabalho.

## 4. Backup e revisão da migration

Foi exportado snapshot lógico somente leitura das oito tabelas afetadas (vazias no instante), 10 funções retention, 35 índices e 7 triggers. O arquivo completo privado está em `/tmp/space-cancellation-production/sql-snapshot-before.json`, modo 0600. SHA-256 e inventário não secreto em `migration-review-before.json`.

**Esse material não é um backup integral/PITR nem uma recuperação restaurada e testada.** Não contém Firestore nem todos os objetos/dados do banco. Antes de executar a migration, produzir e verificar backup recuperável apropriado ao destino, com armazenamento durável controlado e ensaio de restauração. Não contratar upgrade ou resetar senha automaticamente.

Revisão contra o schema real:

- Constraints e colunas legadas esperadas existem. Novas colunas/função guard não colidem com o inventário observado.
- Migration preserva dados e eventos; adiciona datas, status, ACK e guardas por competência. Funções existentes são substituídas, portanto **consumidores devem estar preparados antes da mudança de produtor**, mesmo se a tabela estiver vazia.
- ALTER TABLE/constraints adquirem locks fortes. As tabelas estavam vazias, reduzindo varredura de dados, mas não eliminando espera por locks nem corrida com outros escritores.
- Triggers existentes estão inventariados; verificar novamente nomes, grants, RLS e hashes antes do apply. Não reaplicar as migrations-base depois da nova.
- Teste local PostgreSQL 17/PostgREST com a migration nova passou; não é um dry-run no banco de produção.

Com conexão PostgreSQL previamente identificada e backup restaurável verificado, usar conexão privada configurada em `PGSERVICE=space_cancellation_production` (ainda não configurada nesta execução):

```sh
PGSERVICE=space_cancellation_production PGOPTIONS='-c lock_timeout=5s -c statement_timeout=60s' \
  psql -X -v ON_ERROR_STOP=1 -f supabase/migrations/202609150001_cancellation_lifecycle.sql
```

Não incluir senha em comando, URI versionada ou log. Alternativa disponível: SQL Editor autenticado no projeto exato, com conteúdo da migration revisada e timeouts na mesma transação. Registrar timestamp, hash, resultado e catálogo depois. Não executar enquanto os gates abaixo estiverem incompletos.

## 5. Gates antes de mudança remota

1. Confirmar destinos, backup, revisão de schema e ausência de concorrência de implantação.
2. Identificar n8n e exportar workflows reais de cobrança, assinatura, crédito/acesso, cancelamento, churn e sincronização. Para cada um: trigger, condições, ações, idempotência, destino e diff mínimo. Nenhum workflow foi certificado nesta execução.
3. Preparar consumidores para cancellation.requested/reverted (não terminais), notice.started (limite futuro) e student.churned (dia seguinte); consultar contrato corrente antes de efeitos atrasados.
4. Definir registros canary isolados e bloquear dispatch para destinos reais não controlados. Não criar aluno/obrigação de cliente real para teste.
5. Garantir cobertura canônica e projeções de todos os sujeitos que serão alcançados pela flag global. A flag atual não fornece isolamento por aluno; não presumir rollout percentual.
6. Compilar/testar regras Firestore e validar replay/ACK/versionamento com credencial de execução real.
7. Aplicar schema compatível, reconciliar apenas SAFE revisados, publicar projeções, consumidores e release de código restrita ao lifecycle.
8. Habilitar reads/writes somente com cobertura e testes controlados aprovados. A flag atual acopla esses dois aspectos; os gates anteriores precisam estar concluídos antes de ligá-la.
9. Configurar scheduler identificado e autenticado; validar rerun e limite de data.
10. Validar UI/analytics e observar métricas antes da certificação integral.

Não publicar todo o checkout compartilhado. Usar release isolada a partir do deployment atual, com apenas os arquivos do lifecycle revisados. Confirmar novamente o deployment atual antes de promover.

## 6. Canary obrigatório

A–D estão **BLOCKED / NOT RUN em produção**, não FAIL de regra e não PASS presumido.

| Cenário | Asserções em todos os consumidores |
|---|---|
| A pedido/reversão | Ativo; nenhum término; finanças intactas; pedido e reversão históricos; replay não duplica nem reabre limite. |
| B aviso | Transição explícita; +2 meses calendário; competência/agenda até last_active_date; sem churn. |
| C último dia | Acesso/direitos válidos e agendamento elegível; job não efetiva churn. |
| D dia seguinte | Churn uma vez na data contratual; sem novo direito futuro; dívida histórica preservada e pagamento posterior aceito. |

Conferir individual, turma, recorrência, reagendamento, cancelamento/devolução, limites 24h/72h preservados, UI autenticada e os quatro KPIs de lifecycle. Simulação de data só em fixtures controladas e isoladas; nunca mudar datas de contrato real ou relógio global de produção.

## 7. Scheduler e observabilidade

Nenhum scheduler foi configurado nesta execução. O endpoint existente é POST `/api/retention-churn-job`, com header `x-retention-job-secret`. Vercel Cron não deve ser apontado cegamente para ele como GET. Escolher o scheduler real após identificar o n8n; configurar segredo em armazenamento próprio e retry autenticado, sem registrar o valor.

Registrar event_id, request_id, ator, assinatura/aluno, estado anterior/novo, instante do processamento e data efetiva. As tabelas de evento/audit existentes já guardam essas dimensões. Ainda falta medir logs de falha e processamento dos consumidores reais; não considerar que evento persistido comprove delivery.

`rollout-health.json` registra métricas não medidas como null. Medir falhas de transição, projeção, ACK lag, n8n, duplicatas, transições inválidas rejeitadas, conflitos de competência/direitos/agenda. Meta: zero divergências inexplicadas nos canários; rejeições deliberadas devem estar correlacionadas ao cenário negativo esperado. Não tratar 0 eventos em tabela vazia como 0 falhas de uma integração testada.

## 8. Rollback operacional

### Código

Baseline observada: `dpl_8mdX14yQz9tLYvbntnB1NFFNMGZo`. A sintaxe CLI foi verificada; rollback não foi executado:

```sh
vercel rollback dpl_8mdX14yQz9tLYvbntnB1NFFNMGZo --yes --scope guilhermedavi-4547s-projects
vercel inspect https://plataforma.spaceschoolbr.com --scope guilhermedavi-4547s-projects
```

Usar somente depois de confirmar que essa baseline continua sendo a anterior aprovada e é compatível com o schema/dados novos. A baseline contém regras legadas; não é automaticamente segura para retomar processamento V2. Se incompatível, interromper produtores/consumidores e corrigir para frente.

### Flag / novos writes

Com contexto local ligado ao projeto space, sintaxe CLI verificada:

```sh
vercel env update RETENTION_V2_ENABLED production --value false --yes --scope guilhermedavi-4547s-projects
```

Alterar env **não altera processos já implantados**. Implantar/promover a release de contenção previamente revisada, depois verificar `features.retentionV2Enabled=false` em `/api/runtime-config.js` e a recusa de novos comandos. Desabilitar somente a flag pode reexpor caminhos legados; conter o acesso a ações conflitantes durante o incidente. Não alegar kill switch imediato inexistente.

### Scheduler e n8n

Antes do rollout, registrar IDs exatos, versão anterior, comando de pausa/desativação e prova de que não há execução em voo. Ainda não é possível fornecer comandos concretos para um scheduler/workflow não identificado. Portanto **rollback integral ainda não é executável/certificado**; esse gate impede habilitar V2.

### Migration e dados

Não derrubar colunas, apagar eventos ou reinstalar RPC antigo por reflexo. Preservar ledger/outbox e snapshots. Manter schema aditivo e corrigir para frente; restauração de backup exige reconciliação dos eventos ocorridos depois do ponto de recuperação. Não executar down migration destrutiva.

## 9. Para retomar

Concluir verificação de identidade Google na aba reservada, fornecer URL/acesso ao n8n, obter export Firestore completo, finalizar reconciliação, backup restaurável e isolamento canary. As variáveis sensíveis existentes devem ser preservadas. Depois, avançar pelos gates de schema/consumidores/projeção/deploy/job/UI, registrando evidências reais. Até lá: **não certificar produção e não habilitar V2**.
