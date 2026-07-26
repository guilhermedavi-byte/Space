# ADR 0001 — Dono único por fato

## Contexto

A plataforma acumulou fatos iguais gravados e lidos em mais de uma fonte: agenda em Firestore e Supabase, status pedagógico já tendo passado por Firestore e Supabase, além de payloads misturados em `lessonLogs`.

## Decisão

Cada fato passa a ter um único owner de escrita:

- cadastro pedagógico: Firestore
- ocorrência agendada: Firestore até a migração do `occurrence_id`
- status pedagógico: Supabase
- comentários: domínio próprio em fase posterior
- remarcação/reposição rica: domínio próprio em fase posterior

Qualquer outra projeção passa a ser:

- adaptador em leitura; ou
- espelho unidirecional explícito e documentado

## Alternativas consideradas

1. Manter dual-write “controlado”
2. Deixar cada tela escolher a fonte mais conveniente

## Consequências

- reduz drift estrutural;
- aumenta clareza de debugging;
- exige migração gradual dos consumidores legados.
