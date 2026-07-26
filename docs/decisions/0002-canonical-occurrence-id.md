# ADR 0002 — `occurrence_id` canônico para aula

## Contexto

Hoje a mesma aula pode existir como:

- `eventId` Firestore (`aula_...`);
- `id` numérico em `n8n_aulas_pedagogicas_space`;
- `aula_id` numérico em `n8n_registros_aula_space`.

Essa divergência já causou bug real de presença zerada e status incorreto.

## Decisão

Introduzir `occurrence_id` como identidade canônica estável de toda ocorrência de aula.

Formato aprovado:

- `occ_<ulid>`

Responsável por cunhar:

- o backend de agenda, no instante da primeira criação da ocorrência lógica

Invariantes:

- nasce uma única vez por ocorrência lógica;
- nunca é regenerado em edição de recorrência ou reprocessamento;
- nunca é reutilizado para outra aula;
- cancelamento lógico preserva o mesmo `occurrence_id`;
- qualquer espelho operacional ou register referencia esse mesmo ID.

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

Mapa legado:

- vive como artefato explícito do backfill/reconciliação, não como verdade embutida na aula atual;
- primeira forma aprovada: `legacy_occurrence_map` (arquivo/tabela de backfill), com `occurrence_id`, chaves legadas e `match_method`;
- `scripts/backfill-live-lessons.js` precisa virar `occurrence_id`-aware ou ser aposentado quando o backfill oficial entrar.

## Alternativas consideradas

1. **Manter lookup heurístico no frontend**
   - rejeitada porque trata só o sintoma em telas específicas;
   - perpetua a divergência estrutural entre agenda, live lesson e register;
   - exige novo remendo a cada consumidor.
2. **Escolher o `eventId` Firestore como identidade definitiva**
   - rejeitada porque o `eventId` atual é identidade de documento/materialização do Firestore, não identidade lógica neutra do sistema;
   - ele já foi recriado historicamente em regenerações de agenda;
   - manteria o acoplamento ao store de origem exatamente onde queremos desacoplar.
3. **Escolher o `liveLessonId` numérico como identidade definitiva sem camada canônica**
   - rejeitada porque esse ID pertence ao espelho operacional do Supabase, não à ocorrência lógica;
   - não resolve o legado Firestore;
   - manteria a necessidade de tradução reversa em qualquer reprocessamento.

## Consequências

- elimina dependência de lookup frágil tela a tela;
- permite regenerar agenda com `upsert`, não `delete + recreate`;
- exige backfill explícito do legado antes da unificação total.
