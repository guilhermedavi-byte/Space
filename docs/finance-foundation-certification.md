# Financial Foundation — certificação de produção

**Atualizado em 15/09/2026 UTC. Decisão: NO-GO para a Fase 1.**

O código financeiro está integrado à `main` e permanece no deploy automático do projeto Vercel `space`. Backfill, reconciliação, repair e processamento interno de eventos históricos reais passaram. O novo webhook está configurado no Asaas, mas **a entrega externa ainda não foi observada**. `FINANCE_FOUNDATION_ENABLED=false`; ingresso durável habilitado para capturar essa primeira entrega.

Este relatório substitui os estados anteriores de credencial ausente e staging obrigatório. A execução usa **produção autorizada**, Asaas `https://api.asaas.com/v3` e Supabase `space-idiomas-n8n` (`mlpojyvwyqcrelagtgkw`). Nenhuma cobrança, pagamento, estorno ou exclusão foi provocado no Asaas para testar. A migration e os testes anteriores não foram repetidos nesta retomada. Nenhuma UI foi iniciada.

## Gate externo — verificação isolada em 15/09/2026, 17:33 UTC

O painel Asaas, filtrado exclusivamente por `SPACE Financial Foundation Production`, não apresenta nenhuma entrega. A inbox contém sete eventos, todos correlacionados aos replays internos já registrados, e nenhum evento externo novo. Não houve processamento adicional, backfill, repair, teste extra ou alteração da flag. **Gate não comprovado; Foundation desabilitada; NO-GO.** [Evidência mínima sanitizada](../artifacts/finance-production-2026-09-15/external-webhook-gate-recheck.json).

## Delta da retomada

- Backfill concluído: **2.074 projeções iniciais**. O run `b8ad79c0-c863-491c-9096-07deddb25d73` terminou em 15/09 às 04:56:10 UTC. A retomada após rate limit inseriu 1.936; 138 já estavam persistidas. [Resultado](../artifacts/finance-production-2026-09-15/backfill-apply.json).
- A conferência posterior encontrou duas cobranças novas e mudanças reais durante a pausa. Foram executados **16 repairs por ID**, com backup privado antes de cada mutação. Dois eventos reais históricos também atualizaram projeções: vencimento e exclusão. Total atual: **2.076 recebíveis e 1.635 registros de pagamento**, sem IDs Asaas duplicados. [Métricas](../artifacts/finance-production-2026-09-15/final-metrics.json).
- Corrigida uma lacuna da reconciliação: cobranças excluídas não apareciam na listagem, mas GET por ID retornava `deleted=true`. Agora essa consulta é normalizada e comparada; um 404 continua sendo apenas evidência de visibilidade local, sem inferir exclusão. IDs fora da listagem são observados; repair permanece explícito e protegido por snapshot.
- Reconciliação final em `2026-09-15T17:18:20.995Z`: **2.072 itens da listagem + quatro GETs individuais; nenhuma divergência financeira, nenhum ID duplicado ou LOCAL_ONLY por 404**. Há **2.076 UNMATCHED_CUSTOMER**, mantidos sem vínculo heurístico com alunos. [Resultado](../artifacts/finance-production-2026-09-15/reconciliation-final.json).
- Novo webhook `2cd1c07d-3563-4f9d-97f6-3894a562d128`, URL `https://plataforma.spaceschoolbr.com/api/asaas-webhook`, v3, habilitado, fila não interrompida, envio sequencial e token próprio. Os três webhooks preexistentes foram preservados. [Configuração sanitizada](../artifacts/finance-production-2026-09-15/resume-setup-webhook.json).

## Publicação e permanência do receiver

Integração financeira: commit `5c978365b2a97a56ee0960fab4291a932beb7342`. Correção da reconciliação: `cbd64f651b41abf5e26784aea7cbb58e5cc98ad8`. Ambos foram integrados à `main` por avanço normal, preservando as alterações concorrentes de outros módulos.

Deploy automático da correção: [https://space-peypctzcc-guilhermedavi-4547s-projects.vercel.app](https://space-peypctzcc-guilhermedavi-4547s-projects.vercel.app), READY, originado de GitHub `main`. URL estável: [plataforma.spaceschoolbr.com](https://plataforma.spaceschoolbr.com). [Metadados](../artifacts/finance-production-2026-09-15/final-deployment.json).

Após esse deploy automático, o receiver novo aceitou a sexta entrega interna do mesmo evento e retornou a **mesma entrada lógica já processada**, com `duplicate=true`. Isso verifica a permanência do código e totaliza **cinco reentregas**, sem novo efeito financeiro. [Evidência](../artifacts/finance-production-2026-09-15/post-automatic-deploy-idempotency.json). Deploys futuros devem continuar usando a `main`; publicação arbitrária de código antigo ainda poderia reverter a rota.

## Matriz de certificação

**PASS de replay** significa payload histórico real do painel Asaas enviado internamente ao endpoint público, persistido no Supabase real e processado com GET autenticado do estado atual no Asaas. **Não significa entrega externa pelo provedor.** Nenhum mock é apresentado como PASS remoto.

| CENÁRIO | RESULTADO | EVIDÊNCIA | STATUS |
| --- | --- | --- | --- |
| Health e conexão | Autenticação, acesso à conta e vínculo production validados; chave permaneceu na Vercel | [Health real](../artifacts/finance-production-2026-09-15/asaas-production-health.json), [conexão](../artifacts/finance-production-2026-09-15/connection.json) | PASS |
| Receiver após deploy automático | GitHub main → Vercel Production READY; replay reconhecido pelo receiver novo | [Deploy](../artifacts/finance-production-2026-09-15/final-deployment.json), [reentrega](../artifacts/finance-production-2026-09-15/post-automatic-deploy-idempotency.json) | PASS |
| Webhook configurado | Endpoint exclusivo, token dedicado, v3, sequencial; integrações anteriores preservadas | [Configuração](../artifacts/finance-production-2026-09-15/resume-setup-webhook.json) | PASS |
| Entrega externa Asaas → Space | Nenhuma tentativa encontrada no filtro exclusivo do novo webhook; entradas atuais são replays internos conhecidos | [Observação do painel](../artifacts/finance-production-2026-09-15/external-webhook-observation.json) | BLOCKED |
| Ativação Foundation | Flag principal permanece false enquanto falta o gate externo; ingestão durável true | [Configuração de rollout](../artifacts/finance-production-2026-09-15/foundation-env-configuration.json) | BLOCKED |
| PAYMENT_CREATED | Projeção real via backfill; evento histórico entrou na inbox e foi processado | `pay_5snorexsqacbdpae`; [replays](../artifacts/finance-production-2026-09-15/real-event-replays.json) | PASS |
| Idempotência | Seis entregas totais do mesmo evento, uma entrada lógica, uma tentativa de processamento, sem receivable duplicado | [Inicial](../artifacts/finance-production-2026-09-15/real-event-replays.json), [após deploy](../artifacts/finance-production-2026-09-15/post-automatic-deploy-idempotency.json) | PASS |
| PAYMENT_UPDATED | Replay real atualizou vencimento de 14/09 para 15/09 usando GET atual | `pay_foxs2lbj00tk4g3m`; [before/after](../artifacts/finance-production-2026-09-15/real-event-replays.json) | PASS |
| PAYMENT_OVERDUE | Evento histórico real, projeção OVERDUE e nenhuma liquidação indevida | `pay_0m8p1i31knyx8sua`; [replay](../artifacts/finance-production-2026-09-15/real-event-replays-additional.json) | PASS |
| PAYMENT_CONFIRMED | Replay de confirmação real; um pagamento preservado, sem duplicação | `pay_8fgj137p8gbkr603`; [replay](../artifacts/finance-production-2026-09-15/real-event-replays-additional.json) | PASS |
| PAYMENT_RECEIVED | Replay de recebimento real; um recebível e um pagamento preservados | `pay_8yt9ocb41sbw1jgb`; [replay](../artifacts/finance-production-2026-09-15/real-event-replays.json) | PASS |
| PAYMENT_DELETED | Evento histórico real + GET atual com deleted=true; projeção PENDING → DELETED, histórico mantido | `pay_609d66hc68thtmjk`; [payload sanitizado](../artifacts/finance-production-2026-09-15/deleted-payload-sanitized.json), [replay](../artifacts/finance-production-2026-09-15/real-event-replays-deleted.json) | PASS |
| Projeções de refund | Sete projeções REFUNDED convergentes; seis retornadas no filtro e uma confirmada individualmente e na listagem geral | [Filtro](../artifacts/finance-production-2026-09-15/refund-projections.json), [GET adicional](../artifacts/finance-production-2026-09-15/refund-individual-lookup.json), reconciliação final | PASS |
| Evento PAYMENT_REFUNDED | Estornos observados ocorreram entre janeiro e julho, fora da retenção de 14 dias dos logs; não foi inventado evento | Mesmas evidências de refund; nenhum replay de PAYMENT_REFUNDED | NOT OBSERVED |
| Backfill | Paginação concluída e projeções persistidas; execução e retomada auditadas | [Apply](../artifacts/finance-production-2026-09-15/backfill-apply.json), métricas last_backfill completed | PASS |
| Reconciliation | Detectou divergências reais; após correção e repair, 2.076 objetos sem divergência financeira | [Antes](../artifacts/finance-production-2026-09-15/reconciliation-after.json), [final](../artifacts/finance-production-2026-09-15/reconciliation-final.json) | PASS |
| Repair por ID | 16 repairs reais, snapshots anteriores, auditoria e comparação posterior; sem writes no Asaas | [13 repairs](../artifacts/finance-production-2026-09-15/real-repairs.json), [3 excluídos](../artifacts/finance-production-2026-09-15/deleted-repairs.json) | PASS |
| Retry failed → processed | Nenhuma inbox com falha recuperável observada: sete eventos processados, attempt_count=1 | [Métricas](../artifacts/finance-production-2026-09-15/final-metrics.json) | NOT OBSERVED |
| Retomada de backfill após 429 | Continuação a partir do cursor salvo, com limitação de frequência; concluída sem duplicatas | Apply e run anterior preservados; não equivale ao teste de retry de inbox | PASS |
| Segurança do webhook | Token ausente/incorreto/Bearer: 401; token correto com corpo inválido: 400 do receiver novo | [Sondas HTTP](../artifacts/finance-production-2026-09-15/production-webhook-security.json) | PASS |
| Event ordering | Evento de 11/09 entregue após UPDATED de 15/09 não regrediu vencimento atual de 15/09 para 14/09 | Dois IDs reais de `pay_foxs2lbj00tk4g3m`; [before/after](../artifacts/finance-production-2026-09-15/real-event-replays.json) | PASS |

## Divergência comprovada e regressão

A listagem geral não incluía quatro cobranças excluídas; GET por ID retornava HTTP 200 com status anterior e `deleted=true`. O normalizador existente já convertia corretamente isso em DELETED. A lacuna estava no scan de reconciliação: GET bem-sucedido fora da lista era descartado sem comparação.

Evidência antes da correção: [quatro respostas individuais e seus mismatches](../artifacts/finance-production-2026-09-15/reconciliation-final-before-local-only-repair.json). Após a correção, a execução remota passou a reportar **quatro STATUS_MISMATCH**: [resultado](../artifacts/finance-production-2026-09-15/reconciliation-regression-remote-before.json). Um replay histórico de exclusão e três repairs corrigiram as projeções; a execução final não encontrou mismatch.

`tests/finance-reconciliation-existing-outside-list.test.js` reproduz a estrutura observada com IDs/valores sintéticos, e cobre respostas 401/429 e ID divergente sem inferir exclusão. O teste anterior de lookup local-only foi ajustado para retornar um objeto válido. **Três testes focados passaram**: [TAP](../artifacts/finance-production-2026-09-15/reconciliation-regression.tap). Não foi necessário alterar a normalização por hipótese.

## Segurança, backup e limites da evidência

- Supabase service role utilizado apenas no operador privado; Asaas API key permaneceu exclusivamente no runtime Vercel Production. Não houve env pull, cópia da chave ou valores secretos nos artefatos publicados.
- Connection ID `589367ba-e7c4-4c26-af71-53f97eac31a4` vem da configuração de ambiente, sem hardcode na aplicação. Scope/base/conta são conferidos pelo cliente remoto e binding antes das operações.
- Snapshots reais anteriores às mutações estão em `/Users/spaceonline/.codex/finance-production-backups/2026-09-15`, diretório 0700 e arquivos 0600. Não foram publicados no Git. Auditoria transacional preserva os efeitos: 3728 registros na observação final.
- `FINANCE_WEBHOOK_INGEST_ENABLED=true`, `FINANCE_FOUNDATION_ENABLED=false`, `FINANCE_WEBHOOK_PROCESS_INLINE=true` e `FINANCE_LEGACY_WEBHOOK_COMPAT=true`. O token dedicado entra somente no caminho canônico; credenciais legadas distintas continuam no receiver legado. Eventos externos futuros podem ficar pendentes até ativação/processamento autorizado.
- Os sete eventos atualmente processados são replays internos identificados. `last_webhook_received` e `last_webhook_processed` da telemetria, portanto, **não comprovam entrega pelo Asaas**.
- Reconciliação foi executada em dry-run real, com snapshot de leitura do Supabase e paginação Asaas. O relatório foi persistido como artefato; `last_reconciliation` no banco permanece null porque não houve run de reconciliação apply. Repairs separados atualizaram `last_repair`.
- Asaas é um sistema em movimento: a reconciliação é uma observação temporal, não um snapshot atômico entre os dois serviços. Novos eventos ainda precisam de processamento contínuo após o gate de ativação.
- Os 2.076 vínculos ausentes com alunos são explícitos. Nenhum nome/e-mail foi usado para associar alunos. As projeções financeiras estão convergentes; a identidade acadêmica não foi certificada.
- As sete projeções de refund estão validadas por leitura real, mas não houve evento de refund disponível no período dos logs. A [retenção documentada pelo Asaas](https://docs.asaas.com/docs/logs-de-webhooks) é de até 14 dias.
- Endpoints financeiros legados permanecem. Writes locais de status/valor sobre cobranças com `id_cobranca_externa` agora são recusados pelo guard de ownership; operações manuais sem ownership Asaas continuam no legado.
- Suítes anteriores já concluídas: 26 testes de código e 21 testes/subtestes SQL, sem repetição nesta retomada. [Código](../artifacts/finance-production-2026-09-15/isolated-production-unit.tap), [SQL](../artifacts/finance-production-2026-09-15/production-final-sql-2.tap). Esses testes locais são complementares, não prova de webhook remoto.

## Arquivos desta retomada

Correção: `api/_lib/finance-foundation.js`, `tests/finance-production-environment.test.js` e `tests/finance-reconciliation-existing-outside-list.test.js`. Relatório: este arquivo. Evidências sanitizadas: `artifacts/finance-production-2026-09-15/`. As ferramentas temporárias ficaram fora do código normal de deploy; os seis deployments temporários foram removidos após verificar ausência de aliases, conforme [registro de limpeza](../artifacts/finance-production-2026-09-15/temporary-bridges-cleanup.json).

A integração do receiver, guards, CLI, snapshot e ownership já concluída no commit `5c978365` foi preservada; nenhuma migration, UI ou inventário arquitetural foi repetido.

## Pendência exata para GO

**NO-GO.** Falta observar uma entrega real originada no novo webhook Asaas, correlacionar o ID no painel com a inbox, processar esse evento com sucesso e verificar o estado atual. Só então habilitar a Foundation exclusivamente em Production e confirmar o deploy automático e o processamento subsequente.

A ausência de evento externo observado não é erro de autenticação comprovado nem PASS por replay. Não foram criadas transações artificiais para contornar esse gate. Retry de inbox permanece NOT OBSERVED; deve ser validado quando houver falha recuperável real. Refund histórico indisponível permanece explicitamente separado das projeções reais já verificadas.
