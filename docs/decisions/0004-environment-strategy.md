# ADR 0004 — Estratégia de ambientes

## Contexto

Produção foi usada como ambiente de descoberta durante a semana, inclusive para validar correções de alto impacto.

## Decisão

O fluxo oficial passa a ser:

- branch/PR → preview deployment no Vercel
- staging persistente para Supabase
- segundo projeto Firebase para staging compartilhado
- emulator Firebase apenas para desenvolvimento local/rules

## Alternativas consideradas

1. Produção como principal ambiente de validação
2. Só preview Vercel, sem banco isolado
3. Só emulator Firebase, sem projeto de staging

## Consequências

- previews ficam realmente úteis, porque apontam para base segura;
- staging ganha custo operacional próprio;
- reduz drasticamente risco de repetir incidentes em produção.
