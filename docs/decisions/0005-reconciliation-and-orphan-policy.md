# ADR 0005 — Reconciliação e política de órfãos

## Contexto

A auditoria atual já encontrou:

- registers órfãos;
- conflitos em que mais de um register pode apontar para a mesma ocorrência;
- espelhos que podem divergir durante a transição.

## Decisão

Criar uma rotina oficial de reconciliação com categorias explícitas:

- `orphan_register`
- `missing_register`
- `mirror_divergence`
- `ambiguous_register_match`
- `schedule_regeneration_id_break`

Regras:

- uma ocorrência canônica aceita no máximo um register válido;
- conflitos não são auto-resolvidos;
- a reconciliação produz fila permanente para revisão humana;
- erro silencioso deixa de ser aceitável.

## Alternativas consideradas

1. Corrigir cada bug pontualmente quando surgir
2. Apagar órfãos automaticamente
3. Aceitar espelho divergente “temporariamente” sem auditoria

## Consequências

- aumenta observabilidade do legado;
- evita que bugs de identidade reapareçam escondidos;
- adiciona uma etapa operacional de revisão para casos ambíguos.
