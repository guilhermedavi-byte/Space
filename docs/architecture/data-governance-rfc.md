# RFC — Governança Canônica de Dados da Space

Status: Aprovado para staging  
Parecer: READY_FOR_STAGING

## Contexto

A Space hoje distribui dados entre Firestore, Firebase Auth, Supabase, Asaas e n8n. O mesmo aluno pode aparecer com identidades e estados diferentes em mais de uma fonte, gerando inconsistências entre cadastro, operação pedagógica e financeiro.

Este RFC estabelece o modelo canônico aprovado para:

- separar identidade, aluno, professor e pagador;
- centralizar ownership por entidade;
- criar uma Central de Conciliação com decisão humana;
- preparar sincronização segura entre Firestore e Supabase via outbox;
- migrar com segurança em fases posteriores, sem apagar legado nesta etapa.

## Decisões arquiteturais

- Firestore é a fonte oficial de `accounts`, `students`, `teachers`, `enrollments` e agenda pedagógica.
- Firebase Auth continua como fonte oficial de autenticação.
- Supabase é a fonte oficial de `payers`, `financial_contracts`, `contract_items`, `asaas_customers`, `charges`, `charge_allocations` e `reconciliation_*`.
- Nome nunca é chave de identidade.
- Pagador e aluno são entidades diferentes.
- Uma cobrança pode representar um ou vários alunos.
- A sincronização Firestore → Supabase será feita via `integration_outbox`, nunca por dual write síncrono no mesmo request.

## Modelo aprovado

### Firestore

- `accounts`
- `students`
- `teachers`
- `enrollments`
- `account_profile_links`
- `integration_outbox`

### Supabase

- `payers`
- `financial_contracts`
- `contract_items`
- `asaas_customers`
- `charges`
- `charge_allocations`
- `reconciliation_items`
- `reconciliation_decisions`
- `reconciliation_audit_logs`

## Identidade

- `accounts` representa login, roles e permissões.
- `students` representa quem recebe aulas.
- `teachers` representa quem ministra aulas.
- `account_profile_links/{auth_user_id}` faz a reserva transacional do vínculo entre login e perfis.
- Um `auth_user_id` não pode apontar para dois students.
- Um `auth_user_id` não pode apontar para dois teachers.
- Exclusão do login não apaga `student` nem `teacher`.

## Status oficiais

### Enrollment

- `active`
- `notice`
- `paused`
- `ended`
- `cancelled_before_start`

Aluno ativo = existe pelo menos uma matrícula `active` ou `notice`.

### Contrato financeiro

- `draft`
- `active`
- `past_due`
- `suspended`
- `cancelled`
- `closed`

### Item de conciliação

- `pending_review`
- `matched`
- `created_new`
- `duplicate`
- `discarded_test`
- `financial_only`
- `ambiguous`
- `migrated`

## Segurança

- CPF/CNPJ, e-mail e telefone sensíveis devem ser armazenados com criptografia reversível em camada de aplicação.
- Matching usa `HMAC-SHA-256` normalizado:
  - `cpf_cnpj_match_key`
  - `email_match_key`
  - `phone_match_key`
- UI mostra apenas versões mascaradas.
- Logs não podem conter PII bruta.
- Leitura e alteração sensível devem ser auditadas.

## Outbox

Coleção: `integration_outbox/{event_id}`

Cada mutação relevante de `students`, `teachers` ou `enrollments` deve:

1. atualizar o documento de negócio;
2. criar o evento da outbox;
3. fazer ambos na mesma transação Firestore.

Campos mínimos:

- `event_id`
- `event_type`
- `aggregate_type`
- `aggregate_id`
- `aggregate_version`
- `payload_version`
- `payload`
- `occurred_at`
- `processing_status`
- `attempts`
- `next_attempt_at`
- `processed_at`
- `last_error`

## Central de Conciliação

Cada item mostra lado a lado:

- Coluna A: Firestore/pedagógico
- Coluna B: Supabase/Asaas/financeiro
- Coluna C: decisão humana

Ações:

- vincular ao aluno existente;
- criar novo aluno canônico;
- criar pagador separado;
- marcar como ex-aluno inadimplente;
- marcar como duplicado;
- marcar como teste;
- deixar pendente;
- desfazer decisão.

Nesta fase, decisões não alteram os dados legados.

## Migração

Fases futuras:

1. snapshots read-only;
2. Central de Conciliação;
3. decisões humanas;
4. migração de ativos;
5. migração de aviso prévio;
6. migração de ex-alunos inadimplentes;
7. validação de KPIs;
8. cutover;
9. arquivamento do legado;
10. exclusão apenas de testes confirmados.

## Riscos principais

- homônimos;
- pagador compartilhado;
- cobrança multi-aluno;
- dados legados incompletos;
- drift entre Firestore e Supabase;
- vazamento de PII em logs;
- concorrência na conciliação;
- staging mal isolado da produção.
