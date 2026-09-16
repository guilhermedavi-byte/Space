# Auditoria de cancelamento, retenção e churn — Space

Data: 2026-09-14 (America/Sao_Paulo). Escopo: checkout local, consultas remotas somente leitura e PostgreSQL descartável. **Resultado de certificação transversal: FAIL.** Isso significa que a consistência em toda a plataforma ainda não está demonstrada; não significa que se executou uma migração em produção.

## 1. Arquitetura encontrada — antes das alterações

| Domínio | Persistência e escritores | Consumidores |
| --- | --- | --- |
| Cadastro/acesso | Firestore `users`: `ativo`, `cancelamento`, `cancelamentosAnteriores`, datas de desativação; administração em `script.js`, `api/admin/users.js`, `api/admin-data.js` | Login, perfil, listas de alunos, professores, pedagógico e agenda |
| Retenção V2 | Supabase `students`, `subscriptions`, `service_periods`, `retention_cases`; RPC `retention_apply_command` | `api/retention-cases.js`, filas e timeline em `script.js` |
| Histórico V2 | `retention_events`, `subscription_status_history`, `pause_status_history`, `financial_status_history`, `audit_logs`, `outbox_events` | Timeline/replay; eventos e históricos têm triggers append-only |
| Financeiro legado | `n8n_alunos_financeiro_space`, `n8n_cobrancas_financeiras_space`, pagamentos/logs/eventos n8n; Asaas | `api/financeiro-cobrancas.js`, `api/financeiro-dashboard.js`, sensores de retenção |
| Financeiro novo | `supabase/migrations/202609140002_finance_foundation.sql`, `api/_lib/finance-foundation.js`, `finance-domain.js`, `finance-store.js`, `asaas.js` | Webhooks e espelhos de payments/customers/subscriptions; não fornece encerramento remoto de assinatura por lifecycle |
| Financeiro V2 retenção | `billing_accounts`, `charges`, `payments`, MRR e `service_periods` | Snapshot da retenção; não é comprovadamente o escritor de cobranças Asaas/n8n |
| Agenda | Firestore `aulas`, `classes`, `events`; `api/schedule-events.js`, `api/schedule/events/*`, `api/schedule/book.js`, `script.js` | Aluno, professor, dashboards, sala |
| Pedagógico | Supabase `n8n_aulas_pedagogicas_space`, onboarding e ocorrências; Firestore `lessonLogs`, `pedagogico_pending_writes`; `pedagogico-service.js`, `live-lessons.js`, `pedagogico-action-handler.js` | Histórico, presença, progresso, relatórios, professores |
| Créditos | `script.js` possui `creditsPerCycle`, `creditsRemaining` e renovação de estado local | Não encontrado ledger transacional de créditos nos schemas SQL consultados; não se pode certificar concessão/consumo externos |
| Integrações | `api/_lib/pedagogico-n8n.js`, webhooks de Asaas/ZapSign, Flexge e salas | Definições executáveis dos workflows n8n não estão no checkout |
| Métricas executivas | Google Sheets, `api/growth-dashboard.js` | `/api/admin-sheets-metrics`, dashboard executivo |

A V2 é ativada por `RETENTION_V2_ENABLED`. Há flags distintas para importação, KPIs financeiros e churn involuntário. `api/retention-churn-job.js` usa a flag de churn **involuntário** para o job de cancelamentos agendados. `vercel.json` não contém cron para esse job. Não foi encontrado consumidor JavaScript de `outbox_events` da retenção.

As modificações locais pré-existentes em arquivos de CRM/reconciliação comercial pertencem a outra frente e não integram esta auditoria.

## 2. Fluxo legado comprovado no código

```
Firestore/UI:
ativo → registrar pedido → cancelamento com dataFimAviso → estado em_aviso
     → reverter → arquivar cancelamento em cancelamentosAnteriores
     → efetivar manualmente → ativo=false, datas, cascata de aulas/classes

Supabase V2:
active → register_formal_request → cancellation_scheduled / scheduled
       → retract_cancellation → active / saved
       → effectuate_churn (quando scheduled_service_end_at <= agora)
       → churned / lost
```

Pedido formal calcula imediatamente o fim: pedido + 2 meses; se o pedido estiver até 7 dias após a primeira aula, primeira aula + 1 mês. Isso está duplicado em `script.js`, `api/_lib/retention-domain.js` e `retention_compute_scheduled_end_at` no SQL. `confirm_cancellation_continuity` apenas reafirma o agendamento existente. `schedule_program_end` permite data arbitrária e tem fallback para agora. `churned_at` recebe o instante de processamento, não o primeiro dia fora da base. O job usa a mesma comparação de instante final.

O provisionamento cria competência mensal ancorada no dia de entrada, com fim no dia anterior ao próximo ciclo (`resolveCurrentMonthlyServicePeriod`). Essa regra **não** é usada pelo SQL legado para calcular cancelamento. A nova política de aviso não autoriza mudar essa competência nem descartar dívida já incorrida.

## 3. Fontes de verdade e divergências

| ID | Severidade | Evidência / impacto |
| --- | --- | --- |
| C01 | CRITICAL | Pedido agenda automaticamente fim no SQL e na UI; não há evento inicial de aviso distinto. |
| C02 | CRITICAL | Churn pode ocorrer no próprio último dia, e job atrasado registra mês/dia de processamento. |
| C03 | CRITICAL | Comando V2 atualiza Supabase e cache do navegador (`applyRetentionV2SnapshotToStudentCache`), mas não persiste a alteração em Firestore. Reabrir a tela pode restaurar outra realidade. Outbox sem consumidor encontrado. |
| C04 | CRITICAL | Cobranças/assinaturas externas não consultam a V2 neste checkout. Falta contrato de integração por competência. Cancelar por vencimento apagaria indevidamente dívida anterior. |
| C05 | HIGH | Agendamento e recorrências de 12 semanas não impõem limite de contrato via retenção; há várias rotas e escrita direta Firestore. |
| C06 | HIGH | Importação inventa data do pedido usando updatedAt/createdAt/agora e calcula fim ausente. `isClosed` produz lifecycle churned inclusive para saved; desfecho revertido pode virar lost. |
| C07 | HIGH | Provisionamento infere aviso da presença de qualquer `cancelamento` e churn de `ativo=false`, que também pode representar desativação administrativa. |
| C08 | HIGH | Regra de exceção de 7 dias/1 mês conflita com os 2 meses oficiais; aritmética usa timezone da sessão SQL, UTC no domínio JS e timezone do navegador na UI. |
| C09 | HIGH | V2 inicializa casos novos com pausa none e financeiro unknown, podendo sobrescrever estados independentes do contrato. Casos antigos/fechados podem modificar a assinatura. |
| C10 | HIGH | Não há prova de consumo/geração transacional de créditos integrada à data final. Acesso, grupo, Flexge e n8n dependem de outros estados. |
| C11 | HIGH | Dashboard executivo usa coluna Z da planilha; dashboard pedagógico usa desfechos Firestore. Não há reconciliação com churn V2. |
| C12 | MEDIUM | Job voluntário vinculado à flag de involuntary churn; ausência de agendamento no manifesto local. Não se pode inferir cron externo. |
| C13 | MEDIUM | Reversão V2 conserva scheduled_service_end_at; consumidores podem tratar limite antigo como vigente. |
| C14 | MEDIUM | Filas classificam formal/open e awaiting_customer como aviso mesmo sem início explícito. |

Não há prova de ocorrência dessas divergências em alunos reais nesta sessão; são caminhos reproduzíveis/inspecionáveis do código, não incidentes pessoais inventados.

## 4. Fórmulas atuais — denominadores preservados

`script.js/buildRetentionMetrics`:

- Pedidos: `dataPedido` dentro do mês e origem pedido.
- Revertidos: `dataEfetivacao` no mês e desfecho revertido.
- Churn: `dataEfetivacao` no mês e qualquer outro desfecho não vazio.
- Ativos atuais: ACTIVE, NOTICE e SUSPENDED do helper de lifecycle.
- Base inicial aproximada: `max(ativosAtuais, ativosAtuais + churnNoMes - novosNoMes)`.
- Pedido % e churn %: numerador / base inicial aproximada × 100.
- Reversal rate: revertidos / (revertidos + churn), casos fechados no mês; não é save rate por coorte de pedidos.

`api/growth-dashboard.js`:

- Ativos: coluna D exatamente `Ativo`.
- Churn mensal: coluna Z corresponde ao mês selecionado.
- Churn %: churn mensal / ativos atuais × 100.

As duas fórmulas diferem. Não há autorização para escolher silenciosamente outro denominador. Save rate por coorte, Request→Notice, Notice→Churn, Logo/Revenue Churn exigem definição de coorte/base/competência. MRR nulo significa dado incompleto; não zero. Não estimar perda de MRR de um pedido.

## 5. Gap analysis e estratégia mínima

| Tema | Regra atual | Regra oficial Space | Gap | Alteração necessária |
| --- | --- | --- | --- | --- |
| Pedido | agenda imediatamente | ativo em negociação | C01 | estado cancellation_requested e timestamp explícito |
| Reversão | saved; pode conservar fim | ativo, histórico preservado | C06/C13 | reutilizar saved_at/eventos; remover limite vigente |
| Aviso | derivado do pedido | início explícito, 2 meses | C01/C08 | adaptar confirm_cancellation_continuity e cálculo de data de negócio |
| Churn | instante final/processamento | dia seguinte ao último dia ativo | C02 | último dia date; efetivação à meia-noite SP do dia seguinte |
| Histórico | eventos V2 já existem | pedidos/reversões/aviso/churn atribuíveis | parcial | reutilizar eventos/atores/motivos e snapshots; não duplicar infraestrutura |
| Financeiro | múltiplos espelhos e Asaas | ativos até fim, dívida anterior permanece | C04 | consumidor externo validado por competência, vínculo explícito ao contrato |
| Pedagógico | Firestore e n8n | direitos válidos até fim | C03/C05/C10 | consumir limite canônico em todos os escritores, inclusive automações |
| Analytics | duas fórmulas legadas | distinguir eventos | C11 | publicar eventos canônicos, explicitar denominadores e reconciliar fontes |
| Histórico ambíguo | inferido por fallback | não inventar datas | C06/C07 | bloquear inferência e produzir exceções para revisão |

## 6. Dados reais e limites de verificação

Consultas GET com `limit=1` em students, subscriptions, retention_cases, retention_events, outbox_events e duas tabelas financeiras retornaram HTTP 200 com arrays vazios no endpoint configurado em `.env.local`. Isso **não** prova ausência de dados na produção nem supera eventual RLS/configuração de ambiente. Credenciais e registros pessoais não foram impressos.

Leitura de Firestore `users` via helper oficial falhou com `missing_service_account`. Workflows externos não estão disponíveis nesta sessão. Não há amostra reconciliada Banco→API→Frontend→métricas de um aluno real. Nenhum backfill ou chamada de escrita remota foi executado.

## 7. Critérios de entrega e implantação

Antes de PASS: validar A–G no banco isolado, consumidores da mesma verdade em todas as rotas e escrita direta; executar cenários controlados completos em staging; reconciliar dados reais; conferir jobs n8n/Asaas e acesso externo; então planejar ativação/migração. Uma suíte local verde sozinha não certifica a plataforma.

A implementação local e seus testes serão registrados abaixo. Não ativar a V2 nem publicar migrations isoladamente enquanto C03/C04/C05/C10/C11 estiverem pendentes.

## 8. Reprodução executada e matriz A–G

A auditoria do código alcançou o núcleo local. A auditoria integral solicitada permanece **bloqueada nas integrações externas**. Respeitando o pré-requisito “somente depois de compreender integralmente o comportamento legado”, **não alterei as regras de negócio nem criei uma migração parcial**. Os scripts novos são instrumentos de diagnóstico, não a implementação da nova regra.

### Verificações de conformidade novas

Execução: `node scripts/audit-cancellation-policy.js --postgres`.

Resultado: **13 verificações, 3 aprovadas, 10 falhas, 0 ignoradas**. O processo encerra com código 1 intencionalmente quando detecta descumprimento. Código 2 indica erro de execução ou incompletude, não aprovação. Evidência: [`policy-probes.json`](../artifacts/cancellation-audit/policy-probes.json).

| Caso obrigatório | Evidência obtida | Resultado / alcance |
| --- | --- | --- |
| A — pedido revertido | Replay volta a active sem churn; builder de importação converte desfecho revertido em lost/churned; RPC conserva fim na assinatura | FAIL. Pagamentos e acesso externos ainda não validados |
| B — pedido/aviso | Pedido vira cancellation_scheduled; confirmação não registra noticeStartedAt; formal/open entra na fila de avisos; RPC perde financeiro current e pausa billable | FAIL |
| C — fim/churn | Em PostgreSQL real isolado, fim configurado para início do dia corrente SP permite churn **nesse mesmo dia**; churned_at = now() | FAIL. Interrupção de futuras cobranças/créditos externos não validada |
| D — durante aviso | Replay mantém cancellation_scheduled e churnedAt nulo | Subverificação PASS; base ativa, financeiro e acesso ponta a ponta não comprovados |
| E — agendamento além do contrato | Booking core aceita agenda futura apenas com ID; o handler não carrega lifecycle/limite. O teste exercita core real sem consulta remota | FAIL no limite do core; não é tentativa de agendamento de aluno real nem teste da UI inteira |
| F — timezone | Entrada em 30/07/2026 às 23:30 SP corresponde a 31/07 UTC; helper legado soma 2 meses em UTC e resulta em **29/09 local**, em vez de 30/09 | FAIL. Não foi alterado relógio de produção |
| G — idempotência | Mesmo comando de churn duas vezes: replay idempotente, 1 evento; suíte SQL adicional executa o job duas vezes sem duplicata | PASS no RPC/job local; não prova ausência de duplicação de cobrança/crédito downstream |

Os 3 PASS são subverificações (reversão em projeção, aviso sem churn em projeção e retry SQL). **Nenhum deles constitui aprovação transversal de A, D ou G.** Não há testes completos implementados da nova regra A–G porque essa regra ainda não foi implementada.

### Suítes legadas executadas

| Execução | Total | Aprovados | Falhas | Ignorados |
| --- | ---: | ---: | ---: | ---: |
| Domínio, API, provisionamento, importação, job, métricas, flags e atomicidade | 47 | 46 | 0 | 1 |
| SQL com `RUN_RETENTION_SQL_INTEGRATION=1` | 1 | 1 | 0 | 0 |
| Backend inicialmente ignorado, reexecutado com `RUN_RETENTION_BACKEND_LOCAL=1` | 1 | 1 | 0 | 0 |

São **48 testes distintos aprovados**; houve uma execução inicial ignorada, posteriormente executada. A suíte SQL contém 30 cenários internos, com aplicação/reaplicação do schema, histórico append-only, rollback e reconciliação materializada. Não confundir teste antigo chamado “churn na data correta” com conformidade: ele coloca fim em uma data passada e verifica lost, sem afirmar a fronteira do último dia ativo. O probe novo cobre precisamente essa lacuna.

Artefatos: [`legacy-tests.tap`](../artifacts/cancellation-audit/legacy-tests.tap), [`legacy-postgres.tap`](../artifacts/cancellation-audit/legacy-postgres.tap), [`legacy-backend.tap`](../artifacts/cancellation-audit/legacy-backend.tap), [`legacy-postgres-summary.json`](../artifacts/cancellation-audit/legacy-postgres-summary.json).

Os containers usados foram descartáveis. O probe novo usa `--network=none`, sem porta publicada, e remove o container ao terminar. As suítes legadas também removem seus containers; não usam o banco remoto. Verificações `node --check` dos dois scripts e `git diff --check` passaram.

## 9. Inventário de leitura final e backfill

Reprodução: `node --env-file=.env.local scripts/audit-cancellation-lifecycle.js`.

- 19 tabelas consultadas por GET, `select=*`, `limit=1`.
- 18 retornaram listas vazias; `n8n_aulas_pedagogicas_space` retornou uma linha. Foram persistidos **somente nomes de colunas, status e quantidade amostrada**, sem valores da linha.
- A chave configurada declara `service_role` e não estava expirada; isso é metadado local do JWT, não validação criptográfica da implantação nem prova de que este é o ambiente completo de produção.
- A existência de aula no endpoint, sem subjects/cases visíveis na sondagem, reforça a necessidade de reconciliar fontes. **Não permite afirmar que essa aula é órfã**: faltam vínculos e a fonte Firestore.
- Firestore continua bloqueado por `missing_service_account`.
- Não houve login Asaas, execução de webhook n8n, alteração financeira, concessão de crédito ou escrita de contrato remoto.

Evidências: [`readonly-inventory.json`](../artifacts/cancellation-audit/readonly-inventory.json), [`backfill-exceptions.json`](../artifacts/cancellation-audit/backfill-exceptions.json). O segundo arquivo está explicitamente marcado `BLOCKED_FIRESTORE_READ` e `applied=false`: lista vazia **não** significa zero exceções. Não é possível enumerar registros inacessíveis, nem inferir datas com certeza.

## 10. Complementos da inspeção transversal

- **Login:** `api/login.js` rejeita `profile.active=false`; `_lib/firestore-user.js` deriva isso de `users.ativo`. Não lê Supabase lifecycle. Sessão já emitida e salas precisam de validação própria.
- **Sala:** `api/sala.js` renderiza uma sala pelo parâmetro room sem consultar sessão ou lifecycle. `api/aula.js` começa pela sessão e busca a aula, sem consumir limite contratual V2. A segurança efetiva do provedor de vídeo não foi inspecionada. **C15 — HIGH:** bloquear cadastro/login não comprova bloqueio de acesso futuro ao produto.
- **Financeiro manual:** `api/financeiro-cobrancas.js/handleSave` cria/atualiza registro da tabela n8n sem verificar contrato/lifecycle. O payload tem vencimento, mas não a competência necessária para distinguir dívida anterior e obrigação futura. Parte de C04 está, portanto, no código local, além da automação externa.
- **Flexge:** `api/pedagogico/flexge/action.js` aceita criar_aluno/vincular_curso/sync_progress via n8n; não consulta lifecycle. É necessário conhecer também o mecanismo externo de desativação.
- **Créditos:** `syncCreditCycle` usa ciclos de 6 dias úteis excluindo domingo e repõe `creditsRemaining` no localStorage. Não foram encontradas chamadas dessa função neste checkout; tratar como **candidato a código legado sem uso**, não como prova de como créditos reais são hoje gerados. Não mudar a regra de créditos por dedução.
- **CS Live:** `api/_lib/cs-live-provider.js/getCsLiveProvider` retorna provider de dados mock, incluindo pedidos de cancelamento em 4,2%. Não é evidência de KPI real nem reconciliado.
- **Assinatura selecionada:** `retention_resolve_subject_by_firestore_student_id` escolhe a assinatura mais recentemente criada (`order by sub.created_at desc limit 1`), e o comando replica estado diretamente no student. **C16 — HIGH:** verificar contratos simultâneos; churn de uma assinatura não pode desativar automaticamente direitos de outro contrato válido.
- **Regras Firestore:** administração escreve users/classes/groups diretamente e professores podem escrever aulas próprias. Uma guarda somente em uma API não cobre esses caminhos.
- **Datas:** a agenda tem helpers de dateKey com offset configurável; o cancelamento usa três aritméticas diferentes; o financeiro `nullableDate` converte timestamps para dia UTC. Definir a competência contratual exige conferir o dado de origem, não apenas escolher um timezone global para todos os timestamps.

### Superfícies a validar após a implementação

| Superfície | Pontos relevantes |
| --- | --- |
| Retenção | `api/retention-cases.js`, `api/retention-import.js`, `api/retention-churn-job.js`, helpers retention-* e os dois SQLs lifecycle |
| Cadastro/contrato | `api/admin-data.js`, `api/admin/users.js`, `_lib/firestore-user.js`, `api/_lib/student-mirror-sync.js`, `script.js` ficha e cadastro de aluno |
| Agenda individual/recorrente | `api/schedule/book.js`, `api/schedule/events/index.js`, `api/schedule/events/[id].js`, `api/schedule-events.js`, remarcações e escrita direta da UI |
| Operação pedagógica | `api/_lib/pedagogico-service.js`, `pedagogico-action-handler.js`, `pedagogico-n8n.js`, `live-lessons.js`, `api/pedagogico/lesson/action.js`, Flexge, salas |
| Financeiro | `api/financeiro-cobrancas.js`, `api/financeiro-dashboard.js`, helpers finance-* e asaas*, `api/asaas-webhook.js`, jobs n8n externos |
| Indicadores | `script.js/buildRetentionMetrics`, retenção e dashboard pedagógico; `api/growth-dashboard.js` Sheets; `api/_lib/cs-live-provider.js` |

## 11. Modelo alvo e plano mínimo concreto — ainda NÃO implementado

```
ACTIVE
  → CANCELLATION_REQUESTED
      → ACTIVE (pedido revertido, evento e caso preservados)
      → NOTICE_PERIOD (= cancellation_scheduled, se mantida a nomenclatura atual)
          → CHURNED (somente no dia seguinte ao último dia ativo)
```

| Informação | Origem proposta, a validar na implementação |
| --- | --- |
| Pedido | comando autenticado register_formal_request; evento existente + timestamp específico no caso; jamais created_at de aluno/importação por fallback |
| Reversão | saved_at existente + evento retract_cancellation com ator; manter o caso e eliminar apenas limite vigente na assinatura |
| Aviso | confirmação explícita do avanço; adaptar confirm_cancellation_continuity para registrar notice_started_at; nunca a partir do mero pedido |
| Último dia ativo | data de negócio do início do aviso + 2 meses calendários, preservando dia e limitando ao último dia do mês; competência mensal existente permanece independente |
| Churn previsto | último dia ativo + 1 dia de calendário SP, sem marcar churned antes disso |
| Churn efetivo | reaproveitar churned_at para a data efetiva; separar do horário de execução registrado no evento/created_at; job atrasado não muda o mês real da saída |
| Motivos e ator | reutilizar payload e ator em retention_events/audit_logs, separando motivo inicial e desfecho final |

Sequência mínima recomendada, após eliminar os bloqueios de auditoria:

1. Mapear vínculos reais e cardinalidade de aluno/contrato/pagador; obter workflows e determinar quem cria cada cobrança/direito.
2. Migração aditiva no modelo existente: estado inequívoco de pedido, timestamps de pedido e início de aviso, semântica date do último dia; reutilizar saved_at/churned_at/eventos. Não eliminar legado nem preencher datas ambíguas.
3. Adaptar a RPC existente com transições, bloqueio do contrato, proteção de casos encerrados, preservação de pausa/financeiro e idempotência. Proteger criação concorrente e impedir comando antigo de sobrescrever estado de caso novo.
4. Integrar consumidores ao contrato existente. Reutilizar outbox e identidade canônica, com entrega idempotente e reconciliação; guards devem funcionar mesmo se o job de materialização de churn atrasar. Não depender de cache de navegador.
5. Retenção, finanças e pedagógico devem consultar o mesmo limite de vigência. Validar guarda em criação e consumo, remarcações, recorrências/grupos, acesso externo e créditos. Preservar aulas/histórico e dívidas já competidas. Não simplesmente excluir todas as cobranças com vencimento após churn.
6. UI registra pedido, oferece início de aviso explícito e mostra datas do backend. Métricas distinguem eventos; fórmulas antigas só mudam mediante documentação da diferença de denominadores. Não converter aviso em perda de MRR.
7. Exercitar A–G ponta a ponta em staging; reconciliar amostras reais por ID; emitir exceções e somente então planejar rollout. Rollback deve desativar novos escritores mantendo campos/histórico; voltar ao código antigo depois de criar novos estados exige compatibilidade explícita.

## 12. Entrega, alterações e pendências

**Resultado: FAIL. Implementação da nova política: pendente. Nenhuma migration, campo, constraint, flag, fórmula, endpoint de negócio ou regra de produção foi alterado nesta tarefa.** A máquina de estados implantada continua sendo a descrita na seção 2. O diagrama da seção 11 é o alvo, não uma afirmação de conclusão.

Arquivos criados nesta tarefa:

- `docs/cancellation-retention-churn-audit.md`: arquitetura, evidências, fórmulas, severidades, gaps e plano de continuidade.
- `scripts/audit-cancellation-lifecycle.js`: inventário remoto somente leitura e diagnóstico de disponibilidade/exceções, sem dados pessoais nos artefatos.
- `scripts/audit-cancellation-policy.js`: 13 probes sintéticos contra o código real e RPCs PostgreSQL isoladas; emite FAIL enquanto a política não for atendida.
- `artifacts/cancellation-audit/readonly-inventory.json`: sondagem de 19 tabelas e falha de leitura Firestore.
- `artifacts/cancellation-audit/backfill-exceptions.json`: scan bloqueado, nenhum preenchimento aplicado.
- `artifacts/cancellation-audit/policy-probes.json`: esperado/observado de cada probe.
- `artifacts/cancellation-audit/legacy-tests.tap`: testes locais existentes.
- `artifacts/cancellation-audit/legacy-postgres.tap`: execução SQL existente.
- `artifacts/cancellation-audit/legacy-backend.tap`: execução explícita do teste backend inicialmente ignorado.
- `artifacts/cancellation-audit/legacy-postgres-summary.json`: 30 cenários internos e reconciliação sintética.
- `artifacts/cancellation-audit/source-hashes.json`: hashes dos arquivos centrais inspecionados; o workspace recebeu alterações concorrentes de outras frentes durante a auditoria, preservadas por esta tarefa.

Pendências para continuar:

1. **Acesso/evidência:** credencial ou sessão autorizada para ler Firestore; confirmação do ambiente Supabase alvo; exports/código dos workflows n8n e configuração dos escritores/assinaturas externos. Foi solicitada a localização dos workflows durante a tarefa.
2. **Dados:** reconciliação aluno→contrato→pagador→cobrança→aula→crédito→acesso→métrica. Não há evidência suficiente para backfill.
3. **Negócio:** definição de coortes/denominadores e tratamento de contratos históricos ambíguos; cardinalidade de contratos; competência/obrigações já devidas no encerramento. O prazo oficial de 2 meses e a distinção PEDIDO ≠ AVISO ≠ CHURN estão claros e não precisam ser reconfirmados.
4. **Execução:** implementar mudanças mínimas coordenadas e testes completos A–G depois de compreender os consumidores reais; certificar em staging. Não afirmar que a regra já está compartilhada entre módulos.

## Acompanhamento — implementação da política oficial

O resultado FAIL acima representa a auditoria original e foi preservado, assim como seus artefatos. A correção subsequente está detalhada em [Implementação do lifecycle](cancellation-lifecycle-implementation.md), com inventário arquivo por arquivo, migration aditiva, testes locais e limites de certificação. O [contrato de integração](cancellation-lifecycle-integrations.md) especifica as mudanças pendentes nos consumidores externos. Evidências novas ficam em `artifacts/cancellation-implementation/`; não substituem o baseline `artifacts/cancellation-audit/`.
