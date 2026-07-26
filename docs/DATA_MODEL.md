# Inventário de Dados — Space Platform

Status: leitura consolidada da Fase 1  
Data do snapshot: 2026-07-26

## Leitura do documento

Campos desta tabela:

- **Owner atual:** quem é o dono de escrita hoje
- **Status:** `active`, `legacy`, `empty`, `dead-code-candidate`
- **Writers:** pontos de escrita encontrados no repo (`arquivo:linha`)
- **Readers:** pontos de leitura encontrados no repo (`arquivo:linha`)
- **Observações:** sobreposição, risco e notas práticas

## 1. Firestore

| Objeto | Count | Owner atual | Status | Guarda | Writers | Readers | Observações |
| --- | ---: | --- | --- | --- | --- | --- | --- |
| `users` | 202 | Firestore | `active` | cadastro principal de aluno/professor/admin | `api/admin-create-user.js`, `api/admin/users.js`, `script.js:19376`, `api/_lib/student-mirror-sync.js` | `api/admin-data.js:139`, `api/_lib/pedagogico-service.js:188`, `api/pedagogico/student.js`, `script.js` (múltiplas telas) | dono atual de cadastro; alto acoplamento com UI |
| `aulas` | 5.836 | Firestore | `active` | agenda recorrente materializada / schedule events | `api/schedule-events.js`, `api/schedule/events/index.js`, `api/schedule/events/[id].js`, `api/schedule/book.js` | `api/schedule-events.js:1444`, `script.js:22820`, `script.js:27559`, `api/schedule/my-lessons.js` | fonte oficial atual da agenda; identidade ainda frágil |
| `classes` | 149 | Firestore | `active` | cadastro mestre de recorrência | `script.js:19376`, `script.js:28874`, `script.js:32862`, scripts de cleanup | `api/admin-data.js:139`, `api/_lib/pedagogico-service.js:829`, `script.js` admin/alunos | base viva de recorrência; não é histórico |
| `lessonLogs` | 2 | Firestore | `legacy-active` | comentários e resíduos de payload rico | `script.js:19577`, `script.js:24105`, `api/schedule-events.js` (`/api/lesson-logs`) | `script.js:19431`, `script.js:22887`, `api/_lib/pedagogico-service.js:834` | não deve mais ser dono de status pedagógico |
| `pedagogico_pending_writes` | 433 | Firestore | `active` | fallback durável de payload antes do insert Supabase | `api/_lib/live-lessons.js:441` | leitura operacional indireta / reconciliação futura | coleção de segurança; operacional, não produto |
| `leads` | 1 | Firestore | `active` | leads de landing | `landing.js`, `firestore.rules:106` | growth / CRM indireto | domínio comercial separado |
| `groups` | 0 | Firestore | `empty` | turmas/grupos | sem writer ativo encontrado | `api/admin-data.js:139`, `script.js`, `exports/controle-pedagogico/script.js:422` | código consumidor existe, dado ausente hoje |
| `plans` | 0 | Firestore | `empty` | catálogo de planos pedagógicos | sem writer ativo encontrado | `api/admin-data.js:139`, `script.js`, `exports/controle-pedagogico/script.js:363` | consumido na UI; dataset zerado |
| `surveys` | 0 | Firestore | `empty` | respostas NPS/CSAT legadas | sem writer ativo encontrado | `api/admin-data.js:139`, `script.js`, `exports/controle-pedagogico/script.js:747` | pode estar substituído por Supabase no futuro |
| `teacherAlerts` | 0 | Firestore | `empty` | alertas administrativos a professores | `script.js:30322` | `api/admin-data.js:139`, `script.js:21656` | schema existe e regras permitem; sem dados atuais |
| `pedagogicalFeedbacks` | 0 | Firestore | `empty` | feedbacks pedagógicos | `script.js:30036`, `script.js:30180` | `api/admin-data.js:139`, `script.js:21973` | sem dados atuais |
| `onboardingContents` | 0 | Firestore | `empty` | conteúdo de onboarding | sem writer ativo encontrado | `api/admin-data.js:139` | baixo risco imediato |
| `onboardingQuizzes` | 0 | Firestore | `empty` | quizzes de onboarding | sem writer ativo encontrado | `api/admin-data.js:139` | baixo risco imediato |
| `teacherOnboardingProgress` | 0 | Firestore | `empty` | progresso de onboarding do professor | sem writer ativo encontrado | `api/admin-data.js:139` | baixo risco imediato |
| `teacherQuizSubmissions` | 0 | Firestore | `empty` | submissões de quiz do professor | sem writer ativo encontrado | `api/admin-data.js:139` | baixo risco imediato |
| `avisos` | 0 | Firestore | `dead-code-candidate` | legado indefinido | nenhum uso operacional atual | referências apenas em scripts/backups | provável morto |
| `reagendamentos` | 0 | Firestore | `dead-code-candidate` | legado de remarcação | nenhum uso operacional atual | referências apenas em scripts/backups | provável morto |
| `avaliacoes` | 0 | Firestore | `dead-code-candidate` | legado de avaliações | nenhum uso operacional atual | referências apenas em scripts/backups | provável morto |
| `recomendacoes` | 0 | Firestore | `dead-code-candidate` | legado de recomendações | nenhum uso operacional atual | referências apenas em scripts/backups | provável morto |
| `nps` | 0 | Firestore | `dead-code-candidate` | legado de satisfação | nenhum uso operacional atual | referências apenas em scripts/backups | provável morto |
| `trocaProfessor` | 0 | Firestore | `dead-code-candidate` | legado de troca de professor | nenhum uso operacional atual | referências apenas em scripts/backups | provável morto |
| `activities` | 0 | Firestore | `dead-code-candidate` | legado de tarefas/atividades | `api/activities.js` potencialmente | sem uso relevante confirmado | revisar antes de remover |

## 2. Supabase — pedagógico e agenda

| Tabela | Count | Owner atual | Status | Guarda | Writers | Readers | Observações |
| --- | ---: | --- | --- | --- | --- | --- | --- |
| `n8n_aulas_pedagogicas_space` | 6.294 | Supabase espelhado do Firestore | `active-overlap` | espelho operacional da agenda/live lesson | `api/schedule-events.js:232`, `api/_lib/live-lessons.js:413`, remarcações | `api/_lib/pedagogico-service.js:437`, `api/_lib/live-lessons.js:368`, `api/live-lessons/index.js` | mesma ocorrência existe também em `aulas`; alto risco |
| `n8n_registros_aula_space` | 59 | Supabase | `active` | registro operacional de status pedagógico | `api/_lib/live-lessons.js:435`, `api/live-lessons/[id]/register.js`, `api/pedagogico/registro-aula.js` | `api/_lib/pedagogico-service.js:438`, `api/_lib/live-lessons.js:398`, `script.js` via dashboard | dono aprovado do status de aula |
| `n8n_onboarding_alunos_space` | 0 | Supabase | `empty` | onboarding atual | `api/_lib/pedagogico-n8n.js`, `api/_lib/student-mirror-sync.js` | `api/_lib/pedagogico-service.js:436` | sem dados atuais |
| `n8n_onboarding_pedagogico_space` | 0 | Supabase | `legacy-empty` | onboarding legado | migração SQL apenas | `api/_lib/pedagogico-service.js:62` fallback | legado explícito |
| `n8n_ocorrencias_pedagogicas_space` | 0 | Supabase | `empty` | alertas/ocorrências pedagógicas | `api/_lib/pedagogico-n8n.js` | `api/_lib/pedagogico-service.js:439` | sem dados atuais |
| `n8n_satisfacao_alunos_space` | 0 | Supabase | `empty` | satisfação/NPS/CSAT | integrações futuras | `api/_lib/pedagogico-service.js:440` | sem dados atuais |
| `n8n_flexge_evolucao_alunos_space` | 0 | Supabase | `empty` | evolução Flexge | integrações futuras | `api/_lib/pedagogico-service.js:441` | sem dados atuais |
| `n8n_professores_space` | 0 | Supabase | `empty` | catálogo de professores no operacional | integração futura | `api/_lib/pedagogico-service.js:442` | sem dados atuais |
| `n8n_relatorios_pedagogicos_space` | 0 | Supabase | `empty` | relatórios pedagógicos | integração futura | `api/_lib/pedagogico-service.js:443` | sem dados atuais |
| `n8n_preferencias_alunos_pedagogico_space` | 0 | Supabase | `empty` | preferências/admin prefs | `script.js` admin prefs | `api/_lib/pedagogico-service.js:445` | schema existe; sem produção |
| `n8n_logs_pedagogico_space` | 0 | Supabase | `empty` | logs de integração pedagógica | `api/_lib/pedagogico-n8n.js` | `api/space-office.js:34` | candidato a canal de auditoria futura |
| `n8n_avaliacoes_aula_space` | 0 | Supabase | `empty` | feedback de aula | `api/live-lessons/[id]/feedback.js:85` | `api/live-lessons/feedbacks.js:76` | separado de register |
| `n8n_gravacoes_aula_space` | 0 | Supabase | `empty` | gravações | integração live classroom | `api/_lib/live-recordings.js:3` | sem dados atuais |

## 3. Supabase — financeiro e comunicação

| Tabela | Count | Owner atual | Status | Guarda | Writers | Readers | Observações |
| --- | ---: | --- | --- | --- | --- | --- | --- |
| `n8n_alunos_financeiro_space` | 0 | Supabase | `empty-active` | cadastro financeiro do aluno | `api/financeiro-dashboard.js`, integrações | `api/_lib/pedagogico-service.js:444`, `api/_lib/finance-integrations.js:4` | domínio de dinheiro; risco alto |
| `n8n_cobrancas_financeiras_space` | 0 | Supabase | `empty-active` | cobranças | integrações/Asaas | `api/_lib/finance-integrations.js:5`, `script.js:12665` | domínio de dinheiro; risco alto |
| `n8n_logs_cobranca_space` | 0 | Supabase | `empty-active` | logs de cobrança | integrações | `api/_lib/finance-integrations.js:6` | apoio operacional |
| `n8n_eventos_cobranca_space` | 0 | Supabase | `empty-active` | eventos de cobrança | integrações | `api/_lib/finance-integrations.js:7` | apoio operacional |
| `n8n_pagamentos_asaas_space` | 0 | Supabase | `empty-active` | pagamentos Asaas | `api/asaas-webhook.js`, integrações | `api/_lib/finance-integrations.js:8` | domínio de dinheiro; risco alto |

## 4. Consumidores críticos por domínio

### 4.1 Agenda / ocorrência

- leitura admin da agenda Firestore: `api/admin-data.js:139`
- leitura frontend schedule-events: `script.js:22820`, `script.js:27559`
- espelho no Supabase ao criar evento: `api/schedule-events.js:232-270`
- leitura live lesson para professor/admin: `api/_lib/live-lessons.js:368-395`

### 4.2 Status pedagógico

- escrita principal: `api/_lib/live-lessons.js:435-484`
- projeção para logs do professor: `api/_lib/pedagogico-service.js:534-555`
- dashboard admin: `api/_lib/pedagogico-service.js:417-504`
- dataset do painel de registros: `script.js:23004-23090`

### 4.3 Comentários / timeline

- leitura de comentários: `script.js:19431-19484`
- escrita de comentário admin: `script.js:19577-19600`
- ficha professor (somente leitura): `api/_lib/pedagogico-service.js:834-838`

### 4.4 Remarcação / reposição

- fluxo de resolução no frontend admin: `script.js:24059-24125`
- registros operacionais em aula: `api/_lib/live-lessons.js:458-462`
- criação/edição de eventos agenda: `api/schedule-events.js`, `api/schedule/events/[id].js`

## 5. Sobreposições por domínio e risco

| Domínio | Fontes | Sinal de overlap | Severidade | Ação arquitetural |
| --- | --- | --- | --- | --- |
| aluno/professor | Firestore `users` + espelhos Supabase | mesmo aluno existe em shapes diferentes | Médio | manter Firestore como dono e explicitar espelhos |
| agenda | Firestore `aulas` + Supabase `n8n_aulas_pedagogicas_space` | mesma ocorrência com IDs diferentes | Alto | introduzir `occurrence_id` |
| status de aula | `lessonLogs` legado + `n8n_registros_aula_space` | já houve divergência real | Alto | Supabase como dono único |
| comentários | `lessonLogs` mistura comentário com payload operacional | schema poluído | Médio | separar em domínio próprio |
| remarcação/reposição | register + `lessonLogs` + agenda | fluxo espalhado | Alto | separar para contrato explícito |
| retenção/risco | registros e metadados em fontes distintas | cálculos parciais | Médio | owner explícito posterior |
| financeiro | várias tabelas `n8n_*` + Asaas + Chatwoot | integrações sensíveis | Alto | documentar e preservar isolamento |
| comunicação/CRM | Firestore leads + Growth + Chatwoot | sem contrato único | Médio | consolidação posterior |

## 6. Cobertura do mapeamento legado agenda ↔ registers

Auditoria atual sobre `n8n_registros_aula_space`:

| Método | Registros | % |
| --- | ---: | ---: |
| `video_room_id` suffix + tuple local | 52 | 88,1% |
| fallback tuple | 3 | 5,1% |
| sem match | 4 | 6,8% |

Categorias formais abertas:

- `orphan_register`: 4
- `ambiguous_register_match`: 4 rows em 2 conflitos lógicos

Exemplos observados:

- **Claudiane**: registers `3994` e `4006` sem ocorrência atual correspondente
- **Claudiane**: duplicidade sobre o mesmo match (`5638`)
- **Naira**: dois registers plausíveis para a mesma ocorrência (`5518` e `5578`)

## 7. Conclusões do inventário

1. O sistema já opera, de fato, com **duas identidades para a mesma aula**.
2. O status pedagógico já migrou operacionalmente para Supabase, mas a identidade não migrou junto.
3. `lessonLogs` praticamente não tem produção viva para status, o que facilita aposentá-lo como dono desse fato.
4. O maior risco antes de segunda está em **agenda ↔ register ↔ painel**, não em onboarding/financeiro.
5. O inventário justifica a estratégia aprovada: **`occurrence_id` canônico + backfill + leitura unificada + reconciliação**.
