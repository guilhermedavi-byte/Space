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
4. **`pedagogico_pending_writes` não é um outbox confiável no estado atual.** Hoje ele cria um documento por tentativa de gravação, mas a transição de estado para `supabase_saved` / `supabase_failed` é best-effort e silenciosa em caso de falha. O resultado prático é acúmulo de pendências “presas” que não representam backlog real processável.

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
- formato oficial: `occ_<ulid>`.
- é cunhado pelo backend de agenda na primeira criação da ocorrência lógica.
- `aula_id`, em schema novo, passa a significar **sempre** o `occurrence_id`.
- IDs legados (`aula_...` do Firestore, `id` numérico de live lesson, `aula_id` numérico em register) viram apenas chaves históricas.
- Regenerar agenda deixa de ser `delete + recreate`; vira `upsert` preservando `occurrence_id`.
- cancelamento preserva o mesmo `occurrence_id`; nunca há reuso para outra ocorrência.

### 5.2 Estratégia de transição

Enquanto a agenda ainda nasce em Firestore:

1. Firestore `aulas` continua dono do agendamento.
2. Cada doc de `aulas` recebe `occurrence_id`.
3. O espelho operacional no Supabase passa a gravar o mesmo `occurrence_id`.
4. Registers passam a referenciar `occurrence_id`, não mais o `id` local da live lesson.
5. Uma tabela de mapeamento legado cobre o histórico até o corte completo.

Local aprovado para o mapa legado:

- artefato explícito do backfill oficial / reconciliação (`legacy_occurrence_map`);
- guarda `occurrence_id`, `firestore_event_id`, `live_lesson_id`, `legacy_register_aula_id` e `match_method`;
- não substitui a ocorrência atual; serve só para costurar o legado com rastreabilidade.

### 5.3 Ponte de legado aprovada

Método primário de backfill:

1. extrair o sufixo do `video_room_id`;
2. cruzar com o hash do `eventId` Firestore;
3. validar com data/horário local de Brasília, **sempre derivados dos campos da aula/ocorrência** (`aulas`, live lesson ou aula espelhada no payload);
4. aceitar match somente se o tuple também bater.

Fallback:

- `(student, teacher, local_date, start_time, end_time)`

Observação obrigatória:

- `created_at` / timestamp de criação do register **não entra no matching principal**;
- ele é apenas metadado auxiliar de desempate e auditoria.

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
- registrar no plano que `scripts/backfill-live-lessons.js` precisa virar `occurrence_id`-aware ou ser aposentado quando o backfill oficial entrar
- rollback: desfazer apenas o backfill da tabela de mapeamento, sem tocar agenda origem

### Item 3 — leitura unificada no painel de presença

- trocar lookup frágil por resolução via `occurrence_id`/mapa legado
- validar na URL de preview com casos reais conhecidos
- rollback: Instant Rollback Vercel

### Item 3 — desenho do backfill legado

Pré-condições:

- deploy conjunto dos itens 1+2 validado;
- backup fresco de `n8n_aulas_pedagogicas_space` e `n8n_registros_aula_space`;
- execução começa em **dry-run read-only**, sob comando explícito.

Pipeline de normalização:

1. normalizar todas as comparações para `America/Sao_Paulo`;
2. derivar `local_date`, `start_time_local` e `end_time_local` **a partir dos campos da aula/ocorrência**, nunca do timestamp do register;
3. usar timestamp do register apenas como metadado de desempate/auditoria.

Buckets do relatório:

- `safe_match`: 1 register ↔ 1 ocorrência, com evidência suficiente;
- `orphan_register`: register sem ocorrência correspondente;
- `ambiguous_register_match`: mais de um candidato plausível;
- `proposed_recovery`: pendência sem register atual, mas com payload durável suficiente para propor recuperação manual;
- `proposed_recovery_pending_occurrence`: payload recuperável cujo `occurrence_id` ainda não foi resolvido e que precisa de revisão manual.

Regra de dedupe:

- uma `occurrence_id` aceita no máximo um register válido;
- conflito entre dois registers plausíveis para a mesma ocorrência nunca é auto-resolvido.

Decisão de escrita aprovada para a fase posterior:

- além de gerar `legacy_occurrence_map`, a fase de escrita **carimba `occurrence_id` nos dados existentes**:
  - Firestore `aulas`
  - `n8n_aulas_pedagogicas_space`
  - `n8n_registros_aula_space` nos `safe_match`

Impacto em backup / rollback:

- backup obrigatório antes de escrever nas 3 superfícies acima;
- rollback de código: Instant Rollback do deploy;
- rollback de dado: usar o backup para desfazer carimbos e restaurar valores anteriores, porque o backfill passa a mutar tabelas/coleções existentes;
- `legacy_occurrence_map` permanece como trilha auditável mesmo em rollback.

Cobertura esperada da execução:

- base atual: `52/59` por `video_room_id suffix + tuple`;
- `3/59` por fallback tuple;
- `4/59` permanecem em `orphan_register` / `ambiguous_register_match`;
- `5` aulas perdidas entram como `proposed_recovery`, sem insert automático.

Casos de recuperação manual já conhecidos:

- `Adriano Lippi` / `Fausto` / `2026-07-23` / `20:00–20:30`
- `Adriano Lippi` / `David C.` / `2026-07-23` / `20:30–21:00`
- `Carlos Eduardo` / `Sophia Rodrigues` / `2026-07-23` / `10:00–10:30`
- `Diego` / `Anny` / `2026-07-23` / `11:00–11:30`
- `Matheus Davidson` / `João Luiz` / caso com resolução pendente de ocorrência após normalização de timezone

Saída esperada do dry-run:

- contagem por bucket;
- `legacy_occurrence_map` em modo relatório;
- lista dos `safe_match` a carimbar;
- lista dos `orphan_register`;
- lista dos `ambiguous_register_match`;
- lista dos `proposed_recovery`;
- lista dos `proposed_recovery_pending_occurrence`.

Observação operacional:

- o dry-run fica pronto para execução assim que houver sua ordem, mas não deve rodar antes da validação do deploy 1+2 e do backup das tabelas.

#### Operacional do dry-run (copy-paste, não executar sem ordem)

Pré-check manual:

1. confirmar deploy conjunto dos itens 1+2 já validado;
2. confirmar backup fresco de:
   - `n8n_aulas_pedagogicas_space`
   - `n8n_registros_aula_space`
3. confirmar que o modo é `read-only` / `dry-run`.

Comando-alvo:

```bash
node --env-file=.env.local scripts/backfill-occurrence-id.js \
  --mode=dry-run \
  --timezone=America/Sao_Paulo \
  --report=./tmp/occurrence-backfill-dry-run-$(date +%Y%m%d-%H%M%S).json
```

Saída esperada para revisão:

- resumo de cobertura (`safe_match`, `orphan_register`, `ambiguous_register_match`, `proposed_recovery`, `proposed_recovery_pending_occurrence`);
- amostras por bucket;
- lista dos `safe_match` elegíveis a carimbo;
- lista dos 5 `proposed_recovery`;
- lista das ocorrências pendentes de resolução manual;
- caminho do artefato JSON gerado.

Critérios para seguir depois:

- nenhuma escrita executada;
- contagem total reconciliável bate com a base esperada;
- buckets problemáticos ficam explicitamente listados para revisão humana.

#### Operacional do write posterior (não executar agora)

Pré-check manual:

1. reaproveitar o relatório do dry-run aprovado;
2. gerar novo backup imediatamente antes da escrita;
3. congelar a versão exata do código/backfill aprovada.

Etapas previstas:

1. carimbar `occurrence_id` em `aulas` (Firestore) dos `safe_match`;
2. carimbar `occurrence_id` em `n8n_aulas_pedagogicas_space`;
3. carimbar `occurrence_id` em `n8n_registros_aula_space`;
4. gerar/persistir `legacy_occurrence_map`;
5. emitir relatório final de escrita + pendências manuais.

Rollback previsto:

- Instant Rollback do deploy se necessário;
- restore das duas tabelas Supabase e dos docs Firestore a partir do backup pré-write;
- preservação do relatório e do `legacy_occurrence_map` como trilha auditável.

### Item 4 — reconciliação básica

- endpoint/job read-only com órfãos, faltantes e ambiguidades
- publicar saída para revisão humana
- rollback: remoção do job/endpoint sem impacto transacional

### Item 4 — painel Registros de Aulas após `occurrence_id`

Objetivo:

- fazer o painel ler status por `occurrence_id` como chave primária;
- usar `legacy_occurrence_map` apenas como fallback explícito para legado ainda não carimbado;
- eliminar lookup heurístico local por `eventId`/`aula_id`.

Contrato de leitura:

1. a linha da aula no painel nasce da ocorrência da agenda;
2. o join principal busca register por `occurrence_id`;
3. se a ocorrência ainda não tiver `occurrence_id` materializado na leitura histórica, a resolução passa pelo `legacy_occurrence_map`;
4. se nem assim houver vínculo, a linha cai em `sem_registro` ou em categoria de reconciliação apropriada.

Fontes:

- agenda/ocorrência: Firestore `aulas` e/ou espelho live já carimbado;
- status operacional: `n8n_registros_aula_space`;
- fallback legado: `legacy_occurrence_map`.

Regras:

- nenhum consumidor de UI monta casamento por heurística ad hoc;
- todo join usa a mesma camada de resolução (`occurrence_id` -> register, com fallback map);
- o painel não inventa status a partir de ausência de match sem antes passar pelo mapa legado.

Validação esperada:

- casos conhecidos (presença, falta, remarcada, cancelada) aparecem corretos no período;
- cards agregados batem com a soma dos registers reconciliados;
- após o backfill, o uso do fallback tende a zero para a janela histórica coberta.

Rollback:

- Instant Rollback do deploy de leitura;
- nenhuma mutação de dado no item 4.

### Item 5 — spec do endpoint/job de reconciliação

Objetivo:

- publicar uma visão única e revisável das divergências entre agenda, live lessons, registers e outbox;
- servir tanto para auditoria quanto para replay/manual review no pós-migração.

Formato sugerido:

- `GET /api/pedagogico/reconciliation`
- parâmetros opcionais:
  - `from`
  - `to`
  - `teacher_id`
  - `severity`
  - `category`
  - `limit`
  - `cursor`
- modo alternativo batch/job:
  - execução agendada diária
  - execução manual sob demanda

Categorias mínimas:

1. `orphan_register`
   - register sem ocorrência correspondente, mesmo após `legacy_occurrence_map`
2. `orphan_lesson`
   - ocorrência passada ou espelho live sem register correspondente após a tolerância definida
3. `missing_register`
   - aula que deveria ter registro operacional e ainda não tem
4. `ambiguous_match`
   - mais de um candidato plausível no casamento register ↔ ocorrência
5. `manual_review`
   - fila explícita dos casos que não podem ser auto-resolvidos (`proposed_recovery_pending_occurrence`, conflitos de dedupe, etc.)

Payload mínimo por item:

- `category`
- `severity`
- `occurrence_id` (quando existir)
- chaves legadas envolvidas:
  - `firestore_event_id`
  - `live_lesson_id`
  - `legacy_register_aula_id`
- `student_id` / `student_name`
- `teacher_id` / `teacher_name`
- `local_date`
- `start_time_local`
- `end_time_local`
- `evidence`
- `suggested_action`
- `requires_manual_review`
- `detected_at`

Saídas derivadas:

- resumo agregado por categoria e severidade;
- lista paginada para revisão;
- export JSON/CSV para operação manual;
- insumo para replay manual do outbox no futuro.

Regras operacionais:

- o endpoint/job é read-only;
- nenhuma categoria faz auto-correção;
- qualquer replay ou recuperação continua sendo ação separada e explícita.

Validação esperada:

- os 4 órfãos já conhecidos aparecem;
- os 4 conflitos/ambiguidades já conhecidos aparecem;
- os 5 `proposed_recovery` aparecem na lista de revisão manual até decisão humana;
- depois do item 3 executado, o volume de `orphan_register` e `ambiguous_match` vira métrica observável do sistema.

Rollback:

- remover endpoint/job sem impacto transacional;
- nenhum dado mutado pelo item 5.

### Item 6 — auditoria do pseudo-outbox (`pedagogico_pending_writes`)

- explicar a duplicação de pendings por retry/tentativa repetida;
- agrupar pendings sem register por aula lógica (`student`, `teacher`, `local_date`, `start`, `end`);
- decidir entre:
  - promover a coleção a outbox real, com estado confiável + consumidor; ou
  - aposentar a coleção após estabilizar a escrita primária no Supabase;
- não usar a coleção atual como backlog operacional até essa decisão acontecer.

### Validação sacrificial de domingo

1. criar aula teste e confirmar o mesmo `occurrence_id` nas 3 camadas;
2. alterar o horário recorrente e confirmar preservação do `occurrence_id`;
3. confirmar que nenhuma ocorrência passada foi tocada;
4. confirmar que slot removido virou cancelamento lógico, sem delete físico;
5. rodar no Supabase:

```sql
select occurrence_id, count(*)
from n8n_aulas_pedagogicas_space
where occurrence_id is not null
group by occurrence_id
having count(*) > 1;
```

Resultado esperado: vazio. O mirror deve atualizar a linha existente, nunca criar uma segunda live lesson para o mesmo `occurrence_id`.

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
