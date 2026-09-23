# Atendimento 360 — vínculo com operação Space

Data: 2026-09-23.

## Domínio existente mapeado

| Informação | Fonte canônica atual | Observação |
| --- | --- | --- |
| Contato externo do canal | Postgres Attendance: `contacts`, `contact_identities` | Guarda identidade WhatsApp/JID, telefone bruto e telefone normalizado de formato. Não é pessoa mestre. |
| Conversa e atendimento | Postgres Attendance: `conversations`, `conversation_participants`, `messages`, `conversation_events` | Fonte de status, time, responsável, mensagens, leituras e auditoria de vínculo/desvínculo. |
| Pessoas/alunos/usuários | Firestore `users` | Cadastro mestre operacional de alunos, professores, admins e usuários. Lifecycle pode estar projetado no documento. |
| CRM contatos | Firestore `crmContacts` | Cadastro comercial do lead/contato do CRM. Não deve ser copiado para Attendance. |
| CRM oportunidades | Firestore `crmOpportunities` | Fonte de pipeline, etapa, responsável, valor e próxima atividade projetada. |
| CRM atividades/eventos | Firestore `crmActivities`, `crmEvents` | Atividades profundas continuam no CRM. A Inbox só mostra próximo passo resumido. |
| Lifecycle | Supabase Retention v2 + projeção em Firestore `users.lifecycle*` | A leitura da Inbox usa projeção/cadastro já existente; não recalcula lifecycle no frontend. |
| Times e permissões Attendance | Postgres Attendance: `teams`, `attendance_members`, `team_members`, `channel_teams` | RBAC efetivo continua validado em RPCs de Attendance. |

## Identificadores confiáveis

- Telefone normalizado: `contact_identities.normalized_phone` e normalização equivalente de CRM/users. É ponte/candidato, não prova de titularidade.
- Email: usado como complemento quando já existe no cadastro mestre/CRM.
- `internal_person_id`: gravado em `conversation_participants` quando há vínculo explícito.
- `student_id`: Firestore `users/{id}` quando a pessoa é aluno.
- `opportunity_id`: Firestore `crmOpportunities/{id}` para navegação profunda no CRM.

## Fluxo implementado

```text
Evolution/Meta
→ Attendance ingest
→ contact_identities
→ resolveAttendanceContext()
→ Firestore users / CRM / lifecycle projection
→ painel 360 da Inbox
```

O webhook não consulta CRM nem aluno. A Inbox chama um endpoint agregador (`GET /api/attendance-inbox?conversation_id=...`) que devolve mensagens, conversa e `context` em uma resposta.

## Vínculo e duplicidade

- Match único por telefone pode ser persistido automaticamente apenas quando o tipo cabe no schema atual (`student` ou `lead`) e o comando `attendance_update_conversation` aceita a operação.
- Mais de uma pessoa compatível vira `Possíveis correspondências`; o operador escolhe manualmente.
- Responsáveis ou relações ainda não representáveis não são forçadas para `student/lead`.
- O normalizador considera variações comuns de telefone BR: DDI 55, com/sem nono dígito e dígitos puros. Não faz merge destrutivo.
- WhatsApp JID/LID continua identidade do provedor em `contact_identities`; telefone é campo de apoio.

## Painel e ações

O painel direito mostra blocos somente quando houver dados:

- Pessoa: nome, telefone, email, relação.
- CRM: oportunidade aberta, pipeline, etapa, responsável, valor, próxima/última atividade.
- Aluno: status, professor, plano/produto e lifecycle.
- Atendimento: responsável, time, início, última atividade e status.

Ações rápidas:

- Abrir pessoa/aluno/CRM por navegação profunda.
- Criar oportunidade quando não houver aberta e o usuário tiver permissão comercial.
- Vincular/desvincular pessoa por comando Attendance auditado.

## Auditoria

Vínculo e desvínculo usam `attendance_update_conversation` com `action='identity'`, `expected_version` e `client_action_id`. O resultado entra em `conversation_events`/auditoria como `identity.changed`, com antes/depois.

## Performance

O frontend não faz N consultas para CRM/aluno. O endpoint de detalhe agrega o contexto no backend e retorna uma carga única. Leituras profundas e mutações de pipeline permanecem nas telas de CRM/aluno.
