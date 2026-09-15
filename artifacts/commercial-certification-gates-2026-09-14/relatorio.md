# Certificação final — gates de Comercial > Metas

## RESULTADO

**FAIL. APTO PARA DEPLOY CONTROLADO = NÃO.** Há implementação real de runtime e os testes locais passam. Não foi possível concluir a reconciliação autenticada por dealId nem certificar SDR/closer com dados transacionais completos.

Esta entrega não substitui ausência de dados por zero. `production-certification.json` contém os conjuntos e métricas solicitados como `null`, com estado `not_loaded`, nos três meses. O replay permanece identificado separadamente.

## IMPLEMENTAÇÃO REAL — Gate 1

O resumo visual de arquivos editados não é inventário completo das alterações: parte dos arquivos foi escrita por comandos de edição, além de `apply_patch`. A prova independente está em `runtime-vs-deployed.patch` e `runtime-proof.json`, com SHA-256 dos módulos e comparação com o commit da implantação consultada.

No início da execução o patch estava no working tree. Durante a execução, um commit concorrente `bb3dad3` incorporou esses arquivos. Não fiz esse commit. A consulta GET ao Vercel retornou implantação READY `dpl_EBDjuRQpb696c8cGuwGNRGciWxsU`, commit **470a80ad1a816bfbb1f9de1b1a26b9e19c540e06**. Portanto, prova-se presença no código executável local/repositório, **não implantação das novas correções em produção**. Nenhum deploy foi realizado nesta tarefa.

| Alteração | Arquivo de runtime | Função/módulo | Antes | Depois |
|---|---|---|---|---|
| Calendário comum | `api/_lib/commercial-time.js` | `periodBounds`, `parseCommercialDate`, `containsInstant` | Conversões distribuídas | Fuso São Paulo, datas civis e intervalos `[start,end)` |
| Semanas | `api/_lib/commercial-week.js` | `resolveCommercialWeek`, `partitionCommercialPeriod` | Dia 11/08 compartilhado; falta de partição integral | 05–10/08 e 11–18/08; recortes contíguos nos limites mensais |
| Competência | `api/_lib/commercial-period.js` | `resolveCommercialPeriod` | Aritmética dependente de Date local | Motor temporal comum, campos legados preservados |
| Seleção financeira | `api/_lib/commercial-sales.js` | `getBusinessClosingDate`, `summarizeClosedSales` | Seleção compartilhada já existia em 470a80a; zero e duplicatas conflitantes insuficientemente protegidos | Zero explícito; data civil correta; conflito por ID rejeitado; campo temporal identificado |
| Reconciliação | `api/_lib/commercial-reconciliation.js` | `buildCommercialLedger`, `compareDealLedgers` | Sem ledger completo por competência | IDs, semanas, valores, responsáveis, SDR de origem, campos/datas, métricas de integridade |
| SDR | `api/_lib/commercial-sdr.js` | `summarizeSdrEvents`, `reconcileSdrAttribution` | Contagem sem reconciliação detalhada | Duplicatas/conflitos, não alocados; evidência de origem e estados explícitos de leitura |
| Metas | `api/_lib/commercial-goals.js` | `buildCommercialGoalsModel` | Modelo sem ledger | Expõe reconciliação do motor real |
| Atribuição | `api/_lib/growth-people.js` | `summarizeWeeklyCloserProgress`, `resolveCloserBucketForBusiness`, modelo SDR | Outros já preservado em 470a80a; eventos SDR sem reconciliação | Outros mantido; eventos usam módulo canônico e expõem exceções |
| CRM Live | `api/_lib/crm-live.js` | `buildMonthSummary`, slices CRM/SDR, `loadSdrEventsRange` | Sem todos os ledgers; erro SDR podia virar array vazio | IDs mensais expostos; ledger mensal/semanal; versão 4; erro de leitura propagado |
| Publicação | `api/_lib/crm-snapshot-publish.js` | `validateCrmSnapshot`, `publishCrmSnapshot`, `assessStoredSnapshot` | Gate agregado | Gate por negócio/atribuição/invariantes; classificação automática RECONCILED/STALE/INCOMPLETE/INVALID |
| Freshness | `api/_lib/crm-snapshot-freshness.js` | `describeSnapshot` | Versão 3 | Versão 4; materializações legadas não parecem atuais |
| Proveniência | `api/_lib/datacrazy-ingestion.js` | `collectBusinesses` | Sem mapa por negócio | `recordPages`; mantém retry/backoff/Retry-After e paginação sequencial completa |
| Fonte materializada | `api/_lib/crm-source-snapshot.js` | `createSourceService`, `readOnly` | Leitura podia sincronizar | Caminho estritamente read-only; proveniência comprimida/hash; staging preservado |
| Paginação Firestore | `api/_lib/firestore-admin.js` | `listCollectionAsAdmin` | Limite podia retornar parcial | Continuação após limite falha explicitamente |
| Endpoint Metas | `api/growth-dashboard.js` | Leituras autenticadas e `buildCommercialGoalsModel` | Lista limitada podia parecer completa | Erro para paginação incompleta; utiliza o modelo real |
| Commit atômico existente | `api/_lib/crm-snapshot-store.js` | `createFirestoreStore().commit` | Commit único com precondições | Implementação mantida; novo teste verifica a requisição efetiva |

Ligação real: `api/growth-dashboard.js` → `buildCommercialGoalsModel` → cálculo mensal/semana e ledger. `api/crm-live-data.js` → `buildCrmLiveCrmSlice` → seleção/ledger → `runCrmSnapshot`/gate → store. Nenhum desses módulos importa `tests/` ou `artifacts/`.

As correções originais de R$ 3.300 e R$ 961 já estavam parcialmente no runtime de 470a80a, após fcb6f22; esta entrega não reivindica tê-las criado só agora. O hardening adicional e o calendário corrigido estão documentados no diff.

## TESTES DO MOTOR — Gate 2

Os **43 testes originais importam runtime real**, sem importar replay/artifacts. Agora são 49. O teste cria dados de entrada e resultados esperados; não contém uma segunda seleção financeira.

| Grupo original | Runtime efetivamente exercitado |
|---|---|
| Limites de semana, agosto e ano | `resolveCommercialWeek`, `containsInstant` |
| Meses 28/29/30/31, cobertura e fuso | `partitionCommercialPeriod`, `periodBounds`, `resolveCommercialPeriod` |
| Datas civis, ambiguidades e horário de verão | `parseCommercialDate`, `isValidDateKey`, `periodBounds` |
| Criação versus ganho, zero e ID conflitante | `summarizeClosedSales`, `buildCommercialLedger` |
| Inativo/removido/SDR/Outros e role histórico | `buildWeeklyGoalsReadModel`, `buildCommercialLedger`, resolvedores reais de pessoas |
| Mensal/semanal/CRM/Metas | `buildMonthSummary`, `buildWeeklyTeamSummary`, `buildCommercialGoalsModel` |
| Diferenças por campo e troca de IDs com soma igual | `compareDealLedgers` |
| SDR | `buildWeeklyGoalsReadModel` → `summarizeSdrEvents` |
| Fonte read-only | `createSourceService().readOnly` |
| Bloqueio de publicação sem ledger | `validateCrmSnapshot` |

Limite encontrado: o replay histórico somava e filtrava linhas manualmente depois de chamar o calendário. Esse trecho foi removido. Julho/agosto, sem UUID/número, agora retornam `not_loaded: missing_dealId`; nenhum ID foi inventado. Setembro chama o auditor, que chama os módulos reais. O arquivo de observações anterior foi preservado; o novo resultado está neste diretório.

Alguns testes antigos de publicação usam payload pronto para isolar o gate. Eles não bastavam para provar a cadeia inteira. Acrescentei o cenário de três páginas com coleta real, ledger real e publicação real; apenas rede, relógio e armazenamento externos são simulados. Outro teste inspeciona o POST gerado pelo adaptador Firestore real.

## AUTENTICAÇÃO — Gates 3 e 4

Auditoria feita sem imprimir/copiar segredos e sem mudar credenciais.

| Recurso | Necessário | Encontrado | Conclusão |
|---|---|---|---|
| Datacrazy | `CRM_API_BASE_URL` + `CRM_API_KEY`, Bearer | Presentes no Vercel como `sensitive`; valores vazios nas cópias locais e ausentes no processo | Servidor possui configuração, mas a auditoria local não recebe esses valores |
| Firestore Admin | Conta de serviço com acesso datastore; runtime aceita JSON e aliases/split fields | `GOOGLE_SERVICE_ACCOUNT_JSON` existe como `sensitive` em production; aliases e chaves privadas locais ausentes | Falta identidade de serviço utilizável localmente |
| Firebase CLI | OAuth válido com permissão de leitura | Configuração OAuth existe, mas tentativa atual retornou “credentials are no longer valid” | Sessão de CLI inválida; não foi renovada/modificada nesta tarefa |
| Vercel CLI/API | Token de gerenciamento | GET de ambiente e deployment retornou HTTP 200 | Permite metadados; não entrega valores das variáveis sensíveis |
| Supabase | URL + service role e espelho completo | Credenciais locais existem; GET `datacrazy_businesses?…limit=0` retornou 404/PGRST205 | Relação não disponível no schema cache acessível; não é fonte alternativa certificada |
| ADC/impersonation | ADC ou configuração de impersonation | Sem ADC local; gcloud não encontrado; sem caminho de impersonation no runtime auditado | Nenhum mecanismo já configurado utilizável identificado |
| Browser | Sessão autenticada capaz de exportar fonte completa | Abas de Plataforma/Firebase presentes; inventário não mostrou Datacrazy | A presença de aba não prova exportação completa por ID; não extraí tokens do navegador |

Foram inspecionados `.env.local`, `.env.vercel.pull`, `.vercel/.env.production.local`, exemplos, cópia temporária anterior de production, variáveis do processo, configurações locais Firebase/Vercel, runtime de autenticação e scripts `audit-commercial-closings.js`/`audit-sdr-activity.js`. Não foram encontrados service accounts alternativos utilizáveis nesses locais. Não se afirma que esses segredos não existam fora do ambiente auditado.

**Recursos faltantes exatos:** acesso local autorizado a `CRM_API_BASE_URL` e `CRM_API_KEY`; e identidade Firestore válida para leitura de `growthGoals`, `growthPeople`, `users`, `sdrActivityEvents`, configuração e snapshots de `plataforma-space` — por exemplo uma credencial de serviço autorizada ou OAuth válido de auditoria. Os valores sensíveis existentes no Vercel não são exportáveis pela consulta realizada. Não tentei contornar essa restrição nem alterar o servidor para expor segredos.

**Certificação autenticada realizada: NÃO.** Os GET de metadados Vercel e a tentativa Supabase são consultas reais de diagnóstico de acesso, não certificação de vendas. Nenhum endpoint que possa sincronizar/publicar foi acionado para tentar contornar o bloqueio.

## JULHO / AGOSTO / SETEMBRO — Gates 4 e 5

| Métrica de certificação atual | Julho | Agosto | Setembro |
|---|---|---|---|
| Fonte transacional autenticada completa | Não carregada | Não carregada | Não carregada |
| Realizado mensal/semanal certificado | Indisponível | Indisponível | Indisponível |
| Delta financeiro / dealId | Indisponível | Indisponível | Indisponível |
| Snapshot delta por ID | Indisponível | Indisponível | Indisponível |
| Duplicados / não alocados certificados | Indisponível | Indisponível | Indisponível |

Referência histórica, sem nova certificação: replay anterior de julho R$ 56.173; agosto R$ 50.320; setembro R$ 28.188. Não são marcados PASS neste gate.

O auditor agora materializa `SOURCE_DEALS` (entrada transacional, podendo incluir negócios inelegíveis), `CANONICAL_MONTHLY_DEALS`, `CANONICAL_WEEKLY_DEALS`, `CRM_LIVE_DEALS`, `GOALS_DEALS` e `SNAPSHOT_DEALS`. Compara mensal/semanal por ID e campos; CRM/Metas por ID, valor e data, a partir dos IDs expostos pelo helper real de CRM. Responsáveis/SDR/closer são confrontados no ledger quando disponíveis. Snapshots ausentes ficam `null`, nunca `[]` representando fonte vazia. Esses conjuntos só poderão constituir evidência de produção após export completo.

## 09–15/09 — Gates 8 e 9

Sobre observações anteriores: stored snapshot **R$ 8.385/7**; canônico **R$ 12.646/11**; delta stored−canonical **−R$ 4.261**. Os quatro números #11396, #11296, #8895 e #7580 continuam incluídos pelo motor, sem exceção por número. O classificador retorna **STALE** automaticamente, conforme `stored-snapshot-detection.json`. Não houve leitura nova dos UUIDs nem alteração do snapshot.

### Revenue Recognition Timestamp

`Revenue Recognition Timestamp = getBusinessClosingDate(business).date`, com o campo escolhido sempre registrado em `dateField`. Prioridade real: `wonAt`, `wonDate`, `gainedAt`, `gainAt`, `soldAt`, `soldDate`, `saleAt`, `closedAt`, `finishedAt`, `statusChangedAt`, `stageChangedAt`, `lastMovedAt`. A seleção contabiliza apenas negócios Fechado do pipeline comercial; `createdAt`/`updatedAt` não são campos de receita.

`statusChangedAt` é o fallback usado para negócio atualmente Fechado quando faltam campos explícitos de ganho. É o equivalente observado na análise de restauração; a correspondência completa com o evento transacional da origem ainda exige o export. `finishedAt`, `stageChangedAt` e `lastMovedAt` permanecem somente como compatibilidade legada, **explicitamente não certificados**: geram `unverified_revenue_dates` e impedem publicação/certificação. Assim, movimentação genérica não recebe PASS financeiro silencioso. Não foi escolhido arbitrariamente um campo que a origem não demonstrou fornecer.

### Outros

Negócio cujo responsável não resolve para closer ativo/configurado, ou cuja linha nominal não existe na semana, vai para Outros. A receita permanece no consolidado e no ranking semanal de CRM Live/Metas. O ledger preserva o vendedor original e o método de resolução. Felipe configurado como SDR tem as três vendas alocadas a Outros: R$ 3.300. Luis Eduardo recebe R$ 961 pelo ganho da nova semana. Inativos/removidos não ganham linha nominal ativa; a receita continua em Outros. Roles semanais salvos são considerados, mas não se presume cadastro histórico completo quando ele não está disponível.

## SDR — Gate 6

**FAIL de certificação real.** Coverage, source error rate, unassigned revenue e financial delta: **indisponíveis**, não zero.

O helper distingue `value` (inclusive venda de valor zero), `no_attribution`, `source_error`, `not_loaded`. Exige evidência por dealId contendo origem; SDR atribuído exige evento e timestamp. Evidência ausente/incompleta não produz delta zero. Evidência explícita sem SDR gera `no_attribution` e receita não atribuída, sem simular erro. Conflitos/duplicação de evidência falham. Divergência de identidade falha inclusive em venda zero, mesmo quando o delta monetário é zero.

`sdrActivityEvents` mede reuniões/show; obter essa coleção não prova automaticamente a origem SDR de cada venda. O coletor não inventa vínculo entre reunião e negócio. Esse vínculo de origem ainda precisa ser exportado/confirmado no domínio real. O runtime continua propagando falha de leitura de eventos, sem fallback silencioso para zero.

## CLOSER — Gate 7

**PASS local; FAIL de certificação real.** Coverage e delta financeiro reais indisponíveis. No replay de setembro os 26 números têm destino contábil; na semana Matheus R$ 3.875, Luis Eduardo R$ 5.471, Outros R$ 3.300 = R$ 12.646. Isso prova a regra sobre as observações, não sobre UUIDs exportados.

## SNAPSHOTS — Gates 10 e 11

- Incomplete publication protection: **PASS local**. Páginas 1/2 OK, página 3 429 por cinco tentativas; snapshot antigo preservado; source attempt FAILED; tentativa de materialização FAILED.
- Recuperação: **PASS local**. Três páginas completas, cinco negócios, R$ 210 de fixture calculados pelo motor real; uma publicação de cache e histórico.
- Atomic publication: **PASS no código/testes**. O adaptador real gera um único POST `:commit` com ambos os documentos e precondição de versão. Não houve teste de escrita contra Firestore de produção.
- Reconciliation detection: **PASS local**. R$ 8.385 versus R$ 12.646 classificado STALE; delta −R$ 4.261. Para o snapshot legado observado, completude, expected pages e ledger persistido são desconhecidos nesta leitura; não foram inventados.

`assessStoredSnapshot` retorna generated_at, source completeness, páginas, páginas esperadas, quantidade, revenue, canonical revenue, delta e status. Se faltam campos obrigatórios/ledger não há RECONCILED; soma igual sozinha não certifica IDs.

## TESTES — Gate 12

- Motor: **49/49 PASS**; todos importam/exercitam runtime; inclui os 43 originais.
- Subconjunto com prova explícita de execução de runtime (motor, pipeline e adaptador): **64/64 PASS**. Esse é um número verificado, não uma afirmação de que apenas 64 testes da suíte total usam runtime.
- Relacionados Comercial/Metas/CRM/Datacrazy/SDR/closer/snapshots: **173/173 PASS**, zero ignorados.
- Suíte completa final: **385 executados, 380 aprovados, 5 ignorados, 0 falhos**.
- `git diff --check`: sem erros.

Ocorrências intermediárias: uma corrida com alterações concorrentes de Financeiro gerou falha em `finance-foundation.test.js`, preservada em `full-suite-first.log`; a execução final passou. O novo teste de transporte inicialmente omitia APP_ENV; o fixture foi corrigido para ambiente de teste e projeto fictício, mantendo o adaptador real. Nenhuma falha final permanece nos logs entregues.

## PRODUÇÃO — Gate 13

**Produção alterada por esta tarefa: NÃO.** Somente GET de diagnóstico de acesso e trabalho local. Nenhum snapshot/backfill/meta/credencial alterado.

## DEPLOY

**Deploy realizado por esta tarefa: NÃO.** O commit concorrente é registrado como contexto, não como ação desta tarefa ou prova de implantação.

## VEREDITO FINAL

**APTO PARA DEPLOY CONTROLADO = NÃO.** Gates locais de runtime, testes, Outros, detecção e publicação estão comprovados. Gates de fonte autenticada, dealId real, SDR e closer end-to-end permanecem FAIL por falta de evidência.

Para retomar: disponibilizar os recursos read-only identificados acima por um mecanismo seguro do ambiente, sem colar segredos no chat; executar o coletor read-only, obter a evidência de origem SDR por venda e comparar todos os conjuntos. Não é necessário nem autorizado publicar snapshots para fazer essa auditoria. O snapshot antigo divergente deve continuar reportado separadamente da validação da materialização candidata local.
