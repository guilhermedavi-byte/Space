# CERTIFICATION

**FAIL — Gate 3: alias de produção alterado automaticamente.**

O comando autorizado com --prod --skip-domain criou um único runner. A Vercel atribuiu a ele um alias existente. A certificação foi interrompida antes de qualquer POST ou coleta. Nenhum retry, backfill ou deploy do produto foi executado.

## TEMPORARY DEPLOYMENT

- Deployment ID: dpl_FQfqbSn1NpHR7GJf3ebxBoXN4QPv
- Generated URL: space-ctdmp0knn-guilhermedavi-4547s-projects.vercel.app
- Production target: YES
- Custom domain assigned: NO
- Production alias assigned: YES — space-guilhermedavi-4547s-projects.vercel.app
- Promoted: nenhuma chamada promote executada; houve atribuição automática do alias acima.
- Removed: YES — consulta do deployment HTTP 404 e GET anônimo /api/certify HTTP 404.

## MAIN APPLICATION

- Before: dpl_8mdX14yQz9tLYvbntnB1NFFNMGZo
- After: dpl_8mdX14yQz9tLYvbntnB1NFFNMGZo
- Commit: f59d7d2fec0b484b6d3aa263aed3f76843cc9458
- Domínio plataforma.spaceschoolbr.com: deployment preservado.
- Production alias changed: YES

| Alias | Baseline | Depois da remoção |
|---|---|---|
| plataforma.spaceschoolbr.com | dpl_8mdX14yQz9tLYvbntnB1NFFNMGZo | dpl_8mdX14yQz9tLYvbntnB1NFFNMGZo |
| space-git-main-guilhermedavi-4547s-projects.vercel.app | dpl_8mdX14yQz9tLYvbntnB1NFFNMGZo | dpl_8mdX14yQz9tLYvbntnB1NFFNMGZo |
| space-guilhermedavi-4547s-projects.vercel.app | dpl_8mdX14yQz9tLYvbntnB1NFFNMGZo | dpl_FQfqbSn1NpHR7GJf3ebxBoXN4QPv — removido, referência residual |
| space-three-sand.vercel.app | dpl_8mdX14yQz9tLYvbntnB1NFFNMGZo | dpl_8mdX14yQz9tLYvbntnB1NFFNMGZo |

Baseline: 2026-09-15T02:36:14.233Z. Após deploy: 2026-09-15T02:37:50.196Z. Após remoção: 2026-09-15T02:38:38.218Z.

A remoção do runner não restaurou automaticamente o alias secundário. O mecanismo revisado não definiu procedimento de restauração de alias. Foi solicitada autorização específica, sem executar alteração manual.

## GATES LOCAIS

Bundle regenerado do zero. 32 dependências, 39 arquivos totais conhecidos, hashes iguais ao manifesto revisado e ao workspace, 27 testes aprovados, zero falhas. Preflight PASS, proteção all_except_custom_domains, zero cron. Inventário sem .env, credenciais, secrets embutidos ou arquivos inesperados. Somente uma função /api/certify, fallback 404 e nenhum frontend estático. Os módulos transitivos contêm funções de escrita, mas os adaptadores e guards revisados impedem seu uso; não se afirma ausência física dessas definições. A inspeção inicial por nome teve falso positivo no módulo google-service-account.js; a verificação corrigida confirmou que é código esperado, não um arquivo de credenciais. Nenhum código foi alterado nesta execução.

Gate 4 não executado antes da remoção, pois Gate 3 falhou. O GET 404 posterior serve apenas como prova da remoção, não de proteção anterior. Gates 5–17 não executados. Gate 18 e 19 concluídos. Gate 20 falhou pela mudança do alias secundário.

## AUTHENTICATION

- Datacrazy loaded: NO
- Firestore loaded: NO
- Secrets exposed: NO
- CRM_API_BASE_URL: não verificada no runtime
- CRM_API_KEY: não verificada no runtime
- GOOGLE_SERVICE_ACCOUNT_JSON: não verificada no runtime

O preflight interno do worker, que verifica as três variáveis antes da coleta, não foi alcançado. Usuários, roles, metas, semanas, snapshots e registros SDR não foram lidos nesta execução.

## SOURCE

| Métrica | Resultado |
|---|---|
| Pages expected | N/D |
| Pages loaded | N/D |
| Source deals | N/D |
| Source revenue | N/D |
| Retries / 429 | N/D |
| Completeness | Não comprovada — coleta não iniciada |

N/D significa não apurado; não significa zero.

## JULHO

Não executado.

| Métrica | Resultado |
|---|---|
| sourceDealCount | N/D |
| sourceRevenue | N/D |
| monthlyDealCount | N/D |
| monthlyRevenue | N/D |
| weeklyDealCount | N/D |
| weeklyRevenue | N/D |
| monthlyWeeklyFinancialDelta | N/D |
| monthlyWeeklyDealIdDelta | N/D |
| duplicateDealCount | N/D |
| duplicateRevenue | N/D |
| unallocatedDealCount | N/D |
| unallocatedRevenue | N/D |
| snapshotDelta | N/D |
| snapshotStatus | N/D |
| overlappingPeriods | N/D |
| duplicateAttributionRevenue | N/D |

## AGOSTO

Não executado.

| Métrica | Resultado |
|---|---|
| sourceDealCount | N/D |
| sourceRevenue | N/D |
| monthlyDealCount | N/D |
| monthlyRevenue | N/D |
| weeklyDealCount | N/D |
| weeklyRevenue | N/D |
| monthlyWeeklyFinancialDelta | N/D |
| monthlyWeeklyDealIdDelta | N/D |
| duplicateDealCount | N/D |
| duplicateRevenue | N/D |
| unallocatedDealCount | N/D |
| unallocatedRevenue | N/D |
| snapshotDelta | N/D |
| snapshotStatus | N/D |
| overlappingPeriods | N/D |
| duplicateAttributionRevenue | N/D |

Os UUIDs dos antigos R$ 2.728 e a atribuição única de 11/08 não foram certificados.

## SETEMBRO

Não executado.

| Métrica | Resultado |
|---|---|
| sourceDealCount | N/D |
| sourceRevenue | N/D |
| monthlyDealCount | N/D |
| monthlyRevenue | N/D |
| weeklyDealCount | N/D |
| weeklyRevenue | N/D |
| monthlyWeeklyFinancialDelta | N/D |
| monthlyWeeklyDealIdDelta | N/D |
| duplicateDealCount | N/D |
| duplicateRevenue | N/D |
| unallocatedDealCount | N/D |
| unallocatedRevenue | N/D |
| snapshotDelta | N/D |
| snapshotStatus | N/D |
| overlappingPeriods | N/D |
| duplicateAttributionRevenue | N/D |

## 09–15/09

Snapshot real, cálculo canônico e delta: N/D. Os valores históricos não foram reutilizados como evidência atual.

| Referência | dealId | Amount | Revenue timestamp | Canonical week | Closer | SDR | Included | Razão |
|---|---|---|---|---|---|---|---|---|
| #11396 | N/D | N/D | N/D | N/D | N/D | N/D | N/D | Coleta não iniciada |
| #11296 | N/D | N/D | N/D | N/D | N/D | N/D | N/D | Coleta não iniciada |
| #8895 | N/D | N/D | N/D | N/D | N/D | N/D | N/D | Coleta não iniciada |
| #7580 | N/D | N/D | N/D | N/D | N/D | N/D | N/D | Coleta não iniciada |

Revenue Recognition Timestamp e sua consistência entre mensal, semanal, CRM Live e Metas não foram certificados com dados reais. O negócio de R$ 961 permanece sem nova validação.

## CLOSER

Todas as métricas abaixo são N/D para julho, agosto e setembro. Felipe/Outros e os R$ 3.300 históricos não foram certificados.

- closerTotalDeals = N/D
- closerAttributedDeals = N/D
- closerOtherDeals = N/D
- closerUnassignedDeals = N/D
- closerAttributedRevenue = N/D
- closerOtherRevenue = N/D
- closerUnassignedRevenue = N/D
- closerFinancialDelta = N/D

## SDR

Todas as métricas abaixo são N/D para julho, agosto e setembro. Nenhum negócio foi classificado como value, no_attribution, source_error ou not_loaded. A coleta não iniciada não permite atribuir estados individuais.

- sdrTotalDeals = N/D
- sdrAttributedDeals = N/D
- sdrNoAttributionDeals = N/D
- sdrSourceErrorDeals = N/D
- sdrNotLoadedDeals = N/D
- sdrAttributionCoverage = N/D
- sdrSourceErrorRate = N/D
- sdrAttributedRevenue = N/D
- sdrNoAttributionRevenue = N/D
- sdrNotLoadedRevenue = N/D
- sdrFinancialDelta = N/D

## SNAPSHOTS

| Período | Stored deals | Canonical deals | Stored revenue | Canonical revenue | dealId delta | Financial delta | Status |
|---|---:|---:|---:|---:|---:|---:|---|

Nenhuma linha: snapshots não lidos. Nenhuma classificação RECONCILED, STALE, INCOMPLETE ou INVALID foi presumida.

## WRITES

- Chamadas de escrita feitas pela tarefa: Firestore 0; Datacrazy 0; snapshots 0.
- Invocações autorizadas do worker: 0.
- Contadores firestoreWritesAttempted, datacrazyMutationsAttempted e snapshotWritesAttempted do worker: N/D, pois ele não foi invocado.

Os contadores de runtime permanecem null em result.json e countersVerified=false. Não se apresenta zero presumido como medição dos guards.

## BACKFILL

Nenhum backfill executado. Sem leitura autenticada, não há base para listar documentos ou períodos exatos que exigem correção. Primeiro é necessário resolver o incidente do alias, revisar o isolamento e concluir uma certificação autenticada futura, com nova autorização. Só então será possível definir backfill pelos snapshots efetivamente classificados, preservando a separação entre certificação e escrita.

## CLEANUP

- Runner removed: YES
- Bundle local cleaned: YES
- Temp environment files: nenhum criado
- Domínio principal unchanged: YES
- Todos os production aliases unchanged: NO
- Bypass criado para invocação: nenhum; vercel curl não foi executado.

Persistidos somente result.json e relatorio.md nesta pasta. Dados sanitizados antes da gravação; sem respostas brutas, headers ou credenciais.

## RESTAURAÇÃO PROPOSTA — NÃO EXECUTADA

Restaurar somente o alias afetado para a URL original registrada no baseline:

```sh
vercel alias set space-ce0zvkois-guilhermedavi-4547s-projects.vercel.app space-guilhermedavi-4547s-projects.vercel.app --scope team_QFoYBpP3YUXGD4agYHZ7I6jV
```

Depois, consultar novamente o domínio principal e os quatro aliases; verificar que todos apontam ao deployment original e que o runner permanece removido. Essa ação está pendente de autorização específica. Não inclui novo deploy ou invocação.

## VEREDITO DE RELEASE

**APTO PARA DEPLOY DO CÓDIGO CORRIGIDO = NÃO**
