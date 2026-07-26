# ADR 0003 — Língua e convenções do schema novo

## Contexto

O schema atual mistura:

- português e inglês;
- `camelCase`, `snake_case` e nomes legados;
- prefixos de ferramenta como `n8n_`.

Essa mistura já gerou ambiguidade semântica e bugs de coluna/campo.

## Decisão

Para todo schema novo:

- língua: **inglês**
- colunas: **`snake_case`**
- tabelas novas: sem prefixo de ferramenta
- IDs: `<entity>_id`
- timestamps: `created_at`, `updated_at`

Exemplos:

- `lesson_occurrences`
- `lesson_registers`
- `student_comments`
- `reschedule_requests`
- `reconciliation_issues`

## Alternativas consideradas

1. Padronizar tudo em português
2. Aceitar bilinguismo por domínio
3. Continuar criando tabelas com `n8n_`

## Consequências

- reduz drift entre backend, SQL e integrações;
- exige disciplina para não estender o legado com novos nomes híbridos;
- permite conviver com nomes antigos sem reescrita destrutiva imediata.
