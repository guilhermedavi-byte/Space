# Arquitetura Oficial de Dados — Space Platform

Status: proposta oficial da Fase 2  
Escopo: diagnóstico consolidado + arquitetura-alvo + plano de execução  
Última revisão: 2026-07-26

## 1. Objetivo

Este documento formaliza a arquitetura de dados da Space para sair do fim de semana com:

- um dono único por fato;
- identidade canônica estável para ocorrência de aula;
- regras explícitas de leitura/escrita por domínio;
- convenções de schema;
- estratégia de ambientes que tira produção do papel de bancada de teste;
- rotina permanente de reconciliação para detectar drift antes de virar bug.

## 2. Princípios inegociáveis

1. **Dono único por fato.** Cada fato nasce e é editado em uma única fonte.
2. **Dual-write proibido.** Nenhum request de produto escreve o mesmo fato em dois bancos.
3. **Identidade canônica estável.** Toda ocorrência de aula terá `occurrence_id` imutável.
4. **Contrato no repo.** Toda decisão estrutural fica documentada em `docs/`.
5. **Convenção única para schema novo.** Tabelas novas em inglês, `snake_case`, sem prefixo de ferramenta.
6. **Preview antes de produção.** Mudança estrutural passa por preview deployment + base isolada.
7. **Erro silencioso vira alarme.** Divergência e órfão deixam de ser invisíveis.

## 3. Resumo executivo do diagnóstico

### 3.1 Fontes ativas em produção hoje

**Firestore**

- `users`: 202 docs
- `aulas`: 5.836 docs
- `classes`: 149 docs
- `lessonLogs`: 2 docs
- `leads`: 1 doc
- `pedagogico_pending_writes`: 433 docs
- Demais coleções pedagógicas mapeadas no código (`groups`, `plans`, `surveys`, `teacherAlerts`, `pedagogicalFeedbacks`, `onboardingContents`, `onboardingQuizzes`, `teacherOnboardingProgress`, `teacherQuizSubmissions`, `avisos`, `reagendamentos`, `avaliacoes`, `recomendacoes`, `nps`, `trocaProfessor`, `activities`): 0 docs no snapshot atual

**Supabase**

- `n8n_aulas_pedagogicas_space`: 6.294 linhas
- `n8n_registros_aula_space`: 59 linhas
- Demais tabelas pedagógicas/financeiras atualmente mapeadas no código: 0 linhas no snapshot atual

### 3.2 Descobertas confirmadas na Fase 0

1. **O bug da Claudiane confirma a causa estrutural.** O painel cruza `event.id` do Firestore (`aula_...`) com `aula_id` numérico do Supabase; sem uma ponte canônica, o casamento é frágil por definição.
2. **`video_room_id` é a melhor ponte oficial do legado hoje.** O sufixo do `video_room_id` em `n8n_aulas_pedagogicas_space` bate com o hash final do `eventId` Firestore e, quando validado por data/horário local, resolve a maior parte do histórico com segurança.
3. **Existem registros órfãos reais.** Os cases `3994` e `4006` provam que há registers apontando para ocorrências que não existem mais na agenda atual, provavelmente por regeneração com novo `eventId`.

### 3.3 Cobertura real do mapeamento legado

Auditoria em produção sobre os 59 registers atuais:

- `suffix(video_room_id) + tuple(local_date,start,end,student,teacher)`: **52/59 = 88,1%**
- fallback por tuple `(student, teacher, local_date, start, end)`: **3/59 = 5,1%**
- sem match confiável: **4/59 = 6,8%**

Casos adicionais identificados:

- **4 registers** entram em conflito/manual review (duas ocorrências plausíveis para o mesmo evento lógico)
- **4 registers órfãos** hoje, sem ocorrência correspondente na agenda atual

### 3.4 Limitação operacional atual

`loadAdminDashboard()` ainda lê aulas e registers com `limit=1000` em `api/_lib/pedagogico-service.js:435-444`. Isso não estoura no snapshot atual de registers, mas já é insuficiente para a tabela de aulas ao vivo (`6.294` linhas no Supabase).

## 4. Matriz oficial de donos por domínio

| Domínio | Fato | Dono atual aprovado | Leitura derivada permitida | Observações |
| --- | --- | --- | --- | --- |
| Identidade e cadastro | aluno, professor, vínculo pedagógico cadastral | Firestore (`users`, `classes`) | Supabase pode receber espelho unidirecional quando necessário | Continua em Firestore nesta fase |
| Agenda / ocorrência de aula | ocorrência agendada | Firestore `aulas` **até a migração canônica** | Supabase `lesson` mirror só leitura/telemetria | Toda ocorrência passará a ter `occurrence_id` |
| Operação de aula | status pedagógico (`realizada`, `falta`, `cancelada`, `remarcada`) | Supabase `n8n_registros_aula_space` | Adaptadores em memória/consulta podem projetar para UI | Firestore deixa de ser dono deste fato |
| Comentários pedagógicos | comentários/timeline manual | **A definir na Fase 2b** | Hoje vivem em `lessonLogs` | Não muda nesta fase |
| Remarcação / reposição | payload operacional da remarcação | **A definir na Fase 2b** | Hoje fragmentado entre register, `lessonLogs` e agenda | Requer separação explícita |
| Retenção / risco | score, alertas, avisos coordenação | Supabase operacional + enriquecimento derivado | UI pode compor a partir de mais de uma fonte | Regra de ownership precisa ser endurecida em fase posterior |
| Financeiro / cobrança | alunos financeiros, cobranças, pagamentos | Supabase | Firestore não deve escrever esses fatos | Prefixo legado `n8n_` permanece só nas tabelas antigas |
| Comunicação | leads, Chatwoot, CRM/WhatsApp | Misto; ainda sem contrato único | Apenas leitura/adaptação enquanto não houver consolidação | Domínio de risco médio/alto fora do escopo de segunda |

## 5. Estratégia oficial de identidade canônica

### 5.1 Novo contrato

Toda ocorrência de aula terá um `occurrence_id` estável, imutável e reaproveitado em qualquer reprocessamento de agenda.

Regras:

- `occurrence_id` passa a ser a identidade oficial de toda ocorrência.
- `aula_id`, em schema novo, passa a significar **sempre** o `occurrence_id`.
- IDs legados (`aula_...` do Firestore, `id` numérico de live lesson, `aula_id` numérico em register) viram apenas chaves históricas.
- Regenerar agenda deixa de ser `delete + recreate`; vira `upsert` preservando `occurrence_id`.

### 5.2 Estratégia de transição

Enquanto a agenda ainda nasce em Firestore:

1. Firestore `aulas` continua dono do agendamento.
2. Cada doc de `aulas` recebe `occurrence_id`.
3. O espelho operacional no Supabase passa a gravar o mesmo `occurrence_id`.
4. Registers passam a referenciar `occurrence_id`, não mais o `id` local da live lesson.
5. Uma tabela de mapeamento legado cobre o histórico até o corte completo.

### 5.3 Ponte de legado aprovada

Método primário de backfill:

1. extrair o sufixo do `video_room_id`;
2. cruzar com o hash do `eventId` Firestore;
3. validar com data/horário local de Brasília;
4. aceitar match somente se o tuple também bater.

Fallback:

- `(student, teacher, local_date, start_time, end_time)`

Se ainda houver mais de um candidato plausível:

- **não resolver automaticamente**;
- registrar como conflito/manual review.

### 5.4 Política de órfãos e duplicatas

Regras permanentes:

- uma ocorrência canônica pode ter **no máximo um** register válido;
- registers sem ocorrência correspondente viram categoria formal de reconciliação: `orphan_register`;
- múltiplos registers plausíveis para a mesma ocorrência viram `ambiguous_register_match`;
- nada disso é autoapagado sem trilha explícita de revisão.

## 6. Convenções de schema novo

### 6.1 Língua

**Decisão:** schema novo em **inglês**.

Justificativa:

- integra melhor com Supabase/Postgres, tooling e APIs futuras;
- evita drift bilíngue já visível hoje (`aluno_id`, `teacherId`, `statusAula`, `tipo_evento`);
- simplifica contratos compartilhados entre frontend, backend e jobs.

Observação:

- docs do produto permanecem em PT-BR;
- nomes legados atuais não serão renomeados de forma destrutiva no curto prazo.

### 6.2 Regras

- tabelas novas: `snake_case`, sem prefixo `n8n_`
- colunas novas: `snake_case`
- IDs: `<entity>_id`
- timestamps: `created_at`, `updated_at`
- datas locais derivadas: `local_date`
- horários locais derivados: `start_time_local`, `end_time_local`

Exemplos-alvo:

- `lesson_occurrences`
- `lesson_registers`
- `student_comments`
- `reschedule_requests`
- `reconciliation_issues`
- `occurrence_id`, `student_id`, `teacher_id`, `register_id`

## 7. Estratégia de ambientes

### 7.1 Vercel

- todo branch relevante gera preview deployment;
- validação funcional acontece primeiro na URL de preview;
- produção recebe somente o que passou por preview e revisão.

### 7.2 Supabase

**Recomendação:** usar **um projeto persistente de staging** como baseline, com branches efêmeros opcionais para experimentos curtos.

Por quê:

- previsibilidade maior para seed/backfill/retestes de fim de semana;
- ambiente estável para validação com frontend preview;
- branching isolado continua útil para migrações de risco, mas não substitui um staging persistente.

### 7.3 Firebase / Firestore

**Recomendação:** segundo projeto Firebase para staging compartilhado.

Uso do emulator:

- ótimo para teste local de rules e fluxos básicos;
- insuficiente como substituto do staging, porque não replica auth real, dados reais reduzidos e integrações completas.

Resumo:

- **staging compartilhado:** segundo projeto Firebase
- **desenvolvimento local:** emulator

## 8. Rotina oficial de reconciliação

Deve existir um endpoint/job de leitura com execução recorrente (ou manual sob demanda) que gere alertas para:

1. `orphan_register`
   - register sem ocorrência correspondente
2. `missing_register`
   - aula passada acima da tolerância sem registro
3. `mirror_divergence`
   - enquanto existir espelho, campos críticos divergentes entre Firestore e Supabase
4. `ambiguous_register_match`
   - dois ou mais registers plausíveis para a mesma ocorrência
5. `schedule_regeneration_id_break`
   - ocorrência “nova” reaparecendo sem preservar o `occurrence_id`

Saída mínima:

- tipo do problema
- severidade
- ocorrência/register afetado
- chaves legadas envolvidas
- timestamps
- ação sugerida

## 9. Fase 1 — inventário consolidado por domínio

### 9.1 Sobreposições e risco

| Domínio | Sobreposição atual | Fontes | Risco | Motivo |
| --- | --- | --- | --- | --- |
| Aluno/professor | cadastro misturado entre Firestore e espelhos Supabase | `users`, `classes`, `n8n_onboarding_*`, `n8n_alunos_financeiro_space` | Médio | Pode gerar divergência de nome/plano/professor |
| Aula/agenda | mesma ocorrência existe com IDs diferentes | `aulas` + `n8n_aulas_pedagogicas_space` | **Alto** | Já causou status errado e perda de vínculo |
| Status pedagógico | histórico já existiu em `lessonLogs` e hoje vive em `n8n_registros_aula_space` | Firestore + Supabase | **Alto** | Já causou presença zerada |
| Comentários | timeline em `lessonLogs` misturada com outros conceitos | Firestore | Médio | Schema poluído, difícil de migrar |
| Remarcação/reposição | dados espalhados em register, `lessonLogs` e agenda | Firestore + Supabase | **Alto** | Afeta operação e futura remuneração |
| Retenção/risco | parte operacional em Supabase, parte rica ainda misturada | Supabase + Firestore derivado | Médio | Pode produzir score inconsistente |
| Financeiro/cobrança | legado com prefixo `n8n_`, integra Asaas e Chatwoot | Supabase + integrações | **Alto** | Toca dinheiro e atendimento |
| Comunicação/CRM | leads em Firestore, CRM/Growth e Chatwoot à parte | Firestore + APIs externas | Médio | Ainda sem contrato único |

## 10. Fase 3(a) — mínimo seguro antes de segunda

### Item 1 — `occurrence_id` canônico

- adicionar `occurrence_id` à agenda e ao espelho operacional
- impedir regeneração destrutiva
- validar em preview: criar/editar agenda, confirmar preservação do ID
- rollback: Instant Rollback Vercel + remoção do uso do campo novo; dados ficam aditivos

### Item 2 — backfill legado

- gerar tabela/arquivo de mapeamento legado
- aplicar método `video_room_id suffix + tuple`, depois fallback tuple
- separar automaticamente:
  - matches seguros
  - órfãos
  - ambiguidades
- validar em preview/staging com casos reais (Claudiane, Naira, Renata, etc.)
- rollback: desfazer apenas o backfill da tabela de mapeamento, sem tocar agenda origem

### Item 3 — leitura unificada no painel de presença

- trocar lookup frágil por resolução via `occurrence_id`/mapa legado
- validar na URL de preview com casos reais conhecidos
- rollback: Instant Rollback Vercel

### Item 4 — reconciliação básica

- endpoint/job read-only com órfãos, faltantes e ambiguidades
- publicar saída para revisão humana
- rollback: remoção do job/endpoint sem impacto transacional

## 11. Fase 3(b) — roadmap incremental (strangler fig)

1. **Aposentar `lessonLogs` como mistura de domínios**
   - separar comentários
   - separar remarcação/reposição rica
2. **Encerrar drift de cadastro pedagógico**
   - endurecer dono por domínio entre Firestore e Supabase
3. **Consolidar retenção/risco**
   - definir owner explícito para score, alertas e coordenação
4. **Normalizar financeiro legado**
   - remover dependência semântica do prefixo `n8n_`
5. **Modularizar frontend/admin**
   - reduzir acoplamento do `script.js`

Ordem sugerida:

1. identidade canônica
2. reconciliação
3. comentários/remarcação
4. retenção
5. financeiro
6. modularização

## 12. Decisões vinculadas

- `docs/decisions/0001-single-owner-per-fact.md`
- `docs/decisions/0002-canonical-occurrence-id.md`
- `docs/decisions/0003-schema-language-and-naming.md`
- `docs/decisions/0004-environment-strategy.md`
- `docs/decisions/0005-reconciliation-and-orphan-policy.md`
