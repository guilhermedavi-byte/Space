# ADR 0002 — `occurrence_id` canônico para aula

## Contexto

Hoje a mesma aula pode existir como:

- `eventId` Firestore (`aula_...`);
- `id` numérico em `n8n_aulas_pedagogicas_space`;
- `aula_id` numérico em `n8n_registros_aula_space`.

Essa divergência já causou bug real de presença zerada e status incorreto.

## Decisão

Introduzir `occurrence_id` como identidade canônica estável de toda ocorrência de aula.

Durante a transição:

- Firestore `aulas` recebe `occurrence_id`;
- o espelho de live lesson grava o mesmo `occurrence_id`;
- registers passam a referenciar `occurrence_id`;
- IDs antigos permanecem apenas como legado/mapeamento.

Backfill legado:

1. `video_room_id` suffix + tuple local (`student`, `teacher`, `date`, `start`, `end`);
2. fallback por tuple;
3. conflitos viram revisão manual;
4. órfãos viram categoria permanente de reconciliação.

## Alternativas consideradas

1. Manter lookup heurístico no frontend
2. Escolher Firestore `eventId` como identidade definitiva
3. Escolher `liveLessonId` numérico como identidade definitiva sem camada canônica

## Consequências

- elimina dependência de lookup frágil tela a tela;
- permite regenerar agenda com `upsert`, não `delete + recreate`;
- exige backfill explícito do legado antes da unificação total.
