# Lifecycle canônico Space — implementação

**Implementation: PASS. Production certification: BLOCKED.** Validação final: 479/479 testes aprovados (24 novos de lifecycle e 455 testes existentes/demais regressões), zero falhas, zero ignorados; 13/13 probes de política. Baseline da auditoria: 3/13 probes e 48 testes legados de retenção aprovados. Sintaxe de 39 arquivos JavaScript e `npm run check` aprovados.

Implementação local baseada em `cancellation-retention-churn-audit.md`. O FAIL original e os artefatos da auditoria foram preservados como baseline. Nenhuma migration, importação ou alteração externa de produção foi executada nesta implementação.

## Domínio e persistência

`ACTIVE → CANCELLATION_REQUESTED → NOTICE_PERIOD → CHURNED`, com reversão de pedido para ACTIVE. Os nomes persistidos são `active`, `cancellation_requested`, `cancellation_scheduled`, `churned`. `financial_status` e `pause_status` continuam independentes. O saldo financeiro pode continuar pendente após churn.

A assinatura em `subscriptions` é a autoridade. `retention_cases` guarda o processo, `retention_events` e os históricos existentes guardam fatos imutáveis, `outbox_events` comunica alterações. O aluno com mais de uma assinatura permanece elegível enquanto algum contrato conceder o direito. Operações financeiras exigem contrato inequívoco; a UI permite selecioná-lo.

- `cancellation_requested_at`: instante do pedido; nenhum término é calculado.
- Reversão: `saved_at` e evento `retract_cancellation` (equivalentes de `cancellation_request_reverted_at`); não criar campo duplicado. Limites correntes são limpos; eventos anteriores permanecem.
- `notice_started_at`: transição explícita, nunca inferida do pedido. Não pode anteceder o pedido nem estar no futuro.
- `last_active_date`: data de negócio do início do aviso + **2 meses de calendário**, com ajuste ao último dia válido quando necessário.
- `churn_at`: `last_active_date + 1 dia`, em America/Sao_Paulo.
- `churned_at`: instante da meia-noite local de `churn_at`, mesmo quando o job executa atrasado. `occurred_at` preserva o processamento.
- `scheduled_service_end_at` continua como adapter legado do último dia, ao meio-dia local; consumidores novos usam `last_active_date/churn_at`, nunca esse instante para interromper direitos.

Exemplo: aviso em 20/09/2026 → último dia 20/11/2026 → churn 21/11/2026. 31/12/2026 → 28/02/2027; 31/12/2023 → 29/02/2024. Nenhuma regra de 24h/72h foi substituída.

## Arquivo por arquivo

| Arquivo | Alteração |
|---|---|
| `assets/student-lifecycle.js` | Política pura compartilhada Node/browser: datas, estados, elegibilidade, múltiplas assinaturas e adapter legado. |
| `api/_lib/student-lifecycle.js` | Leitura canônica, decoração de alunos e guardas de acesso, competência e agenda. |
| `assets/lifecycle-metrics.js` | Eventos distintos de pedido, reversão, aviso e churn; denominadores existentes preservados. |
| `api/_lib/lifecycle-metrics.js` | Exporta para Node o mesmo cálculo do browser. |
| `api/_lib/retention-domain.js` | Projeções, datas de aviso explícito, filas e normalização. |
| `api/_lib/retention-store.js` | Provisionamento conservador, métricas por eventos e publicação da projeção após comando. |
| `api/_lib/retention-import.js` | Classificação temporal, reversão ativa, identidade estável, eventos originais e exceções. |
| `api/_lib/lifecycle-projection.js` | Projeção transitória Supabase → Firestore com releitura, revisão, compare-and-set e retry. Eventos legados sem identidade não bloqueiam a fila nova. |
| `api/retention-cases.js` | Métricas canônicas nas filas e erros de transição inválida como conflito 409. |
| `api/retention-churn-job.js` | Flag V2, churn na data correta e drenagem de projeções pendentes. |
| `supabase/migrations/202609150001_cancellation_lifecycle.sql` | Persistência, RPCs, importador, job, outbox e guardas por competência. |
| `_lib/firestore-rest.js` | Valida todas as escritas de aulas/eventos, incluindo PATCH parcial. |
| `api/_lib/firestore-admin.js` | Decora leitores existentes com a assinatura canônica. |
| `_lib/scheduling-core.js` | Booking exige lifecycle e verifica elegibilidade. |
| `api/_lib/scheduling-core.js` | Mesma guarda no segundo ponto de entrada existente. |
| `api/schedule/book.js` | Carrega contratos e realiza escrita já autorizada com credencial do servidor. |
| `api/schedule-events.js` | Valida recorrências antes de qualquer escrita. |
| `api/schedule/events/index.js` | Valida cada data da criação recorrente. |
| `api/_lib/pedagogico-action-handler.js` | Impõe limite em reagendamento antes do comando externo. |
| `api/_lib/pedagogico-service.js` | Inclui lifecycle na ficha do aluno consumida por professores. |
| `api/pedagogico/flexge/action.js` | Valida criação/vínculo de direitos; sincronização de progresso histórico permanece disponível. |
| `api/login.js` | Valida período para sessão nova de aluno. |
| `api/me.js` | Revalida sessão existente; retorna somente contratos necessários à UI, sem histórico interno de retenção. |
| `api/app.js` | Revalida acesso ao HTML autenticado e carrega os dois helpers antes de script.js. |
| `api/aula.js` | Valida acesso do aluno antes de entrar na aula. |
| `api/sala.js` | Exige sessão e elegibilidade do aluno quando V2 está ativa. |
| `api/financeiro-cobrancas.js` | Criação exige contrato e período de serviço; vencimento não determina corte. |
| `api/growth-dashboard.js` | Numerador de churn e base ativa canônicos quando V2 está ativa; mantém denominador executivo. |
| `firestore.rules` | Protege projeções e impede novas aulas fora do período. Atualização histórica exige mesma alocação; escrita direta com lista de alunos deve passar pelo servidor. |
| `api/_templates/app.html` | Declara helpers comuns antes da UI. |
| `script.js` | Pedido separado de aviso, início explícito, datas e rótulos, seleção de contrato, métricas comuns, fim do escritor legado de lifecycle e guarda de renovação de créditos locais. |
| `scripts/audit-cancellation-policy.js` | Mantém os 13 checks e seus identificadores; executa contra implementação atual e migration nova, sem substituir evidências antigas. |
| `scripts/cancellation-lifecycle-backfill-dry-run.js` | CLI offline para export JSON fornecido explicitamente; gera payload revisável e CSV de exceções sem banco. |
| `tests/student-lifecycle.test.js` | Datas, direitos, importação, métricas, projeção idempotente e funções reais de UI. |
| `tests/cancellation-app.test.js` | Página real com sessão sintética: ordem dos scripts, lifecycle embutido, acesso encerrado e indisponibilidade. |
| `tests/cancellation-lifecycle-integration.test.js` | PostgreSQL/PostgREST reais descartáveis, migration repetida, comandos, dívida histórica, agenda individual/grupo, importação, projeção simulada e job. |
| `tests/retention-domain.test.js` | Corrige expectativas antigas que calculavam aviso a partir do pedido. |
| `tests/retention-import.test.js` | Terminal sem prova vira exceção; reversão não vira lost. |
| `tests/retention-cases-api.test.js` | Métricas e independência do churn voluntário em relação à flag involuntária. |
| `tests/retention-churn-job.test.js` | Job condicionado ao lifecycle V2 e drenagem de projeções. |
| `tests/retention-sql-integration.test.js` | Readiness PostgreSQL por TCP, evitando confundir o servidor temporário de inicialização com o banco pronto. |
| `tests/retention-backend-local.test.js` | Aplica migration nova; pedido é open; testa idempotência com contato, sem repetir transição inválida; readiness PostgreSQL por TCP. |

Outras alterações simultâneas no checkout (comercial, presença e infraestrutura financeira) não foram revertidas nem atribuídas a este trabalho.

## Migration e compatibilidade

Aplicar **depois** de `retention-lifecycle-v2.sql` e `retention-lifecycle-v2-provisioning.sql`. Não reaplicar os arquivos antigos depois da migration nova: eles reinstalam a política antiga.

Mudanças exatas de schema:

1. CHECK de `lifecycle_status` em students/subscriptions/retention_cases admite `cancellation_requested`.
2. subscriptions e retention_cases recebem `cancellation_requested_at timestamptz`, `notice_started_at timestamptz`, `last_active_date date`, `churn_at date`.
3. CHECKs de datas aceitam legado inteiramente nulo ou uma tupla completa coerente de +2 meses/+1 dia.
4. outbox_events recebe `projection_delivered_at timestamptz`, separado do ACK externo.
5. Se `n8n_cobrancas_financeiras_space` existir, recebe `subscription_id uuid` com FK, `service_period_start date`, `service_period_end date` e trigger de competência.
6. Triggers de competência também em service_periods e charges. Alterar status de dívida histórica sem alterar competência continua permitido.
7. Substitui funções `retention_compute_scheduled_end_at`, `retention_case_snapshot`, `retention_list_cases`, `retention_apply_command`, `retention_run_scheduled_churn`, `retention_import_legacy_snapshot` e `retention_resolve_subject_by_firestore_student_id`; acrescenta `retention_guard_service_period`.

Transação SQL, locks, controle de versão e idempotência mantidos. Nenhuma exclusão de registros, eventos, invoices, créditos ou progresso. Não há UPDATE de backfill histórico nesta migration. A assinatura SQL do cálculo permanece compatível, mas o primeiro parâmetro passa semanticamente a ser o início do aviso.

## Importação e backfill

Pedido + reversão datada → active/saved e dois fatos históricos. Aviso exige evidência explícita; data final legada isolada não comprova aviso. `ativo=false` isolado não comprova churn. Conflitos de datas ou desfechos geram exceção. Importar de novo não sobrescreve estado vivo nem duplica os eventos do mesmo registro.

Executar offline:

```sh
node scripts/cancellation-lifecycle-backfill-dry-run.js export-users.json diretorio-de-saida
```

O CSV contém identificador anonimizado estável, referência do registro, dados conflitantes, motivo e ação manual. O payload preserva a identidade original para reconciliação controlada. A evidência em `artifacts/cancellation-implementation/cancellation-lifecycle-backfill-exceptions.csv` é **sintética**, não um levantamento da base de produção. Registros já importados incorretamente precisam de reconciliação individual e eventos corretivos revisados; não são sobrescritos pelo replay do importador.

## Analytics e histórico

Pedidos usam register_formal_request; reversões retract_cancellation; aviso confirm_cancellation_continuity/schedule_program_end com início explícito; churn cancellation_effective na data contratual. Aluno em pedido ou aviso continua ativo.

A metodologia nova é identificada como `lifecycle_events_v1_existing_approximate_base`. O pedagógico mantém a base inicial aproximada `max(ativos, ativos + churn - novos)` e o executivo mantém churn/ativos atuais. Eventos legados permanecem; aviso ausente não é inventado e histórico externo ambíguo requer reconciliação. O dashboard executivo ainda depende de Sheets para métricas alheias ao lifecycle.

## Validação e alcance

Evidências em `artifacts/cancellation-implementation/`:

- `policy-probes.json`: 13/13; comparação auditável com `artifacts/cancellation-audit/` preservado.
- `full-suite-final.tap`: suíte completa final, incluindo flags opt-in SQL.
- `ui-domain-final.tap`: funções reais do frontend e página real com dependências sintéticas.
- `e2e.json`: cenários A–D no PostgreSQL/PostgREST descartável.
- `backfill-report.json` / CSV: classificação sintética, sem escrita externa.

A: pedido/reversão preservam finanças e histórico. B: aviso explícito mantém acesso e permite agenda até o fim. C: último dia ativo; cobranças e aulas posteriores rejeitadas no domínio e competências no SQL. D: job atrasado registra a data correta uma vez, bloqueia acesso futuro, preserva dívida e permite quitá-la.

Os testes SQL anteriores de retenção continuam exercitando também a instalação histórica de base; o teste novo e o backend local exercitam a migration oficial. Expectativas erradas antigas foram atualizadas, não preservadas: pedido agendado, exceção de um mês, falso churn em importação e flag involuntária para churn voluntário.

Comando da suíte completa:

```sh
RUN_RETENTION_SQL_INTEGRATION=1 RUN_RETENTION_BACKEND_LOCAL=1 RUN_CANCELLATION_INTEGRATION=1 RUN_FINANCE_SQL_INTEGRATION=1 RUN_ATTENDANCE_SQL_INTEGRATION=1 node --test --test-concurrency=2 tests/*.test.js
node scripts/audit-cancellation-policy.js --postgres
npm run check
```

**Limites da certificação:** Firestore foi simulado com adapter que verifica persistência/CAS. Não houve execução em navegador autenticado real nem emulador Firestore (Java runtime ausente). Não houve validação do provedor externo de salas/Flexge, concessão transacional de créditos n8n, Asaas ou workflows reais. Esses itens pertencem à certificação de integração/produção; não se apresentam como testes locais executados.

## Implantação, reconciliação e rollback

Ver contrato operacional em `cancellation-lifecycle-integrations.md`. Staging externo não foi identificado/validado nesta implementação. Não promover a flag isoladamente: preparar contratos canônicos e projeções de **todos os alunos elegíveis**, revisar exceções, aplicar migration e regras em ambiente identificado, testar integrações e somente então habilitar `RETENTION_V2_ENABLED`. Assunto canônico ausente bloqueia novo direito em vez de autorizar silenciosamente.

Rollback operacional: interromper novos comandos/job/consumidores, preservar eventos/outbox e snapshot de banco, corrigir para frente a projeção ou o consumidor. Reverter aplicação somente com compatibilidade revisada; desligar V2 expõe consumidores legados e não é rollback seguro da regra oficial. Não derrubar colunas, apagar eventos ou reinstalar RPC antigo automaticamente. Nenhum rollback de produção foi executado.
