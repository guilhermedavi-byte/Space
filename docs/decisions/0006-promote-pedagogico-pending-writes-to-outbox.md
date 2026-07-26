# ADR 0006 — Promover `pedagogico_pending_writes` a outbox real

## Contexto

A auditoria da Fase 3(a) confirmou que `pedagogico_pending_writes`:

- impediu perda invisível de registros de aula quando o write primário no Supabase falhou;
- hoje cria um documento por tentativa, sem transição de estado confiável;
- acumula duplicatas porque ainda não é chaveado pela identidade lógica da ocorrência.

Também confirmamos 5 aulas reais registradas por professor que não chegaram ao Supabase, mas permaneceram auditáveis por causa dessa coleção.

Essas 5 aulas entram no plano do backfill como `proposed_recovery`: inserts apenas propostos, nunca automáticos. Quando o `occurrence_id` ainda não puder ser resolvido com segurança, o caso permanece explícito no relatório como `proposed_recovery_pending_occurrence`.

## Decisão

`pedagogico_pending_writes` **não será aposentado**. Ele será promovido na Fase 3(b) a um **outbox de verdade**, com estas regras:

- chave lógica por `occurrence_id`;
- transição de estado confiável (`pending`, `saved`, `failed`, `replayed`, `discarded`);
- sem engolir erro silenciosamente ao atualizar estado;
- replay manual exposto via rotina oficial de reconciliação;
- dedupe por ocorrência lógica, não por clique/tentativa.

Escopo da Fase 3(a):

- nenhuma mudança operacional no mecanismo atual;
- apenas documentação da decisão e uso da coleção como evidência de recuperação manual.

## Alternativas consideradas

1. **Aposentar a coleção**
   - rejeitada porque removeria o único rastro durável dos payloads perdidos em falhas de escrita;
   - aumentaria o risco de perda invisível para professor e operação.
2. **Manter como está**
   - rejeitada porque o formato atual não distingue backlog real de tentativas repetidas;
   - o estado não é confiável e não serve como outbox operacional.

## Consequências

- preserva um trilho durável para incidentes de escrita;
- desloca a coleção do papel de “fallback informal” para “outbox explícito”;
- permite replay manual auditável quando a reconciliação identificar casos recuperáveis;
- adia a implementação técnica para a Fase 3(b), sem bloquear o deploy do `occurrence_id`.
