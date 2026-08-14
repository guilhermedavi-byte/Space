# DataCrazy incremental sync

## Estado atual

- Leituras de `/api/growth-metrics`, `/api/growth-goals`, `/api/crm-live-data` e `/api/crm-live-events` podem usar o espelho local no Supabase via `DATACRAZY_MIRROR_ENABLED=1`.
- O código legado do DataCrazy continua disponível para rollback imediato com a flag em `0`.

## Validação do `filter[lastMovedAfter]`

- A validação automatizada roda em `/api/datacrazy-sync?action=validate`.
- A conclusão registrada pelo código é deliberadamente conservadora:
  - o filtro foi validado apenas como limite inferior observado sobre `lastMovedAt` nas amostras;
  - não existe prova automática, nesta base, de que mudanças sem movimentação atualizam `lastMovedAt`;
  - por isso o corte definitivo depende de paridade e reconciliação full periódica.

## Tabelas novas

- `datacrazy_businesses`
- `datacrazy_sync_state`
- `datacrazy_sync_runs`

## Jobs

- Carga inicial / incremental:
  - `POST /api/datacrazy-sync?action=incremental`
- Validação do filtro:
  - `POST /api/datacrazy-sync?action=validate`
- Reconciliação full:
  - `POST /api/datacrazy-sync?action=reconcile`
- Paridade legado vs espelho:
  - `POST /api/datacrazy-sync?action=parity`

Todos aceitam `x-sync-secret: $DATACRAZY_SYNC_SECRET` ou sessão `admin/growth`.

## Agendamento sugerido

- Incremental: a cada `2` minutos
- Reconciliação full: `1x` por noite
- Validação/paridade: antes do corte e depois de mudanças na integração

## Variáveis novas

- `DATACRAZY_MIRROR_ENABLED`
- `DATACRAZY_SYNC_SECRET`
- `DATACRAZY_SYNC_OVERLAP_MS`

## Rollback

1. Definir `DATACRAZY_MIRROR_ENABLED=0`
2. Reimplantar
3. As rotas voltam a consultar o fluxo legado sem migration destrutiva
