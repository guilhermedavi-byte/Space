# Comercial > Metas — correção do motor e limites da certificação

Data: 14/09/2026. Escopo: patch local e consultas somente leitura. Nenhum deploy, backfill, atualização de metas ou publicação de snapshot foi executado.

## RESULTADO

**FAIL para certificação de produção.** O patch e os testes locais passaram. O replay das observações anteriores reconcilia os valores, mas não substitui o dry-run transacional por `dealId` exigido. A tentativa de coleta foi bloqueada por credenciais indisponíveis; o Firebase CLI também tinha autenticação expirada. A confirmação de identidade solicitada ao usuário permanece pendente.

Evidências reproduzíveis:

- `observed-replay.json`: resultado do motor atual sobre observações DOM da auditoria anterior; contém limitações explícitas.
- `replay-observed.cjs`: reprodução local, sem rede nem escritas externas.
- `production-attempt.log`: tentativa de coleta real que falhou antes da coleta; **não há dry-run de produção concluído**.
- `evidencia-auditoria-anterior.md`: cópia da auditoria anterior, com histórico dos quatro negócios e cronologia do snapshot/deploy. Não constitui nova consulta.
- `tests-engine.log` e `tests-full.log`: verificações locais finais.
- Originais preservados em `../commercial-goals-production-audit-2026-09-14/`.

## CAUSA RAIZ

### R$ 4.261 ausentes

O código anterior (`fcb6f22`, `api/_lib/growth-people.js`, `summarizeWeeklyCloserProgress`) filtrava a semana por `lastMovedAt` e descartava a venda quando `bucketPersonId` não tinha linha em `rowsByPerson`. O consolidado era a soma das linhas restantes. O mensal não sofria essa mesma exclusão por linha de closer.

| Negócio | Criação observada | Ganho no histórico anterior* | Valor | Responsável CRM | Destino correto no ranking | Causa da exclusão semanal antiga |
|---|---|---|---:|---|---|---|
| #11396 Samuel Luiz da Silva | 10/09/2026 | 10/09/2026 22:46 | R$ 1.275 | Felipe Santos | Outros | Felipe configurado como SDR; inexistia linha de closer/Outros para receber a receita |
| #11296 Michael | 03/09/2026 | 09/09/2026 21:51 | R$ 1.075 | Felipe Santos | Outros | Mesmo descarte por atribuição |
| #8895 Maikel Alvarenga | 13/07/2026 | 11/09/2026 19:18 | R$ 950 | Felipe Santos | Outros | Mesmo descarte; criação antiga não deve excluir ganho atual |
| #7580 Eduardo Nunes Moreira | 29/05/2026 | 09/09/2026 00:00 | R$ 961 | Luis Eduardo | Luis Eduardo | `lastMovedAt` em 08/09 às 23:58; restauração 23:59; ganho 09/09 00:00 |

\* Horários transcritos na auditoria anterior, não timestamps brutos exportados com offset nesta execução. O replay usa somente o dia observado. A meia-noite normalizada no JSON de replay é uma representação computacional da data civil, não evidência do horário real.

Todos foram observados como Ganho/Fechado no funil Conversão. A receita deve entrar pela data de ganho, no primeiro snapshot completo calculado depois desse evento, independentemente da criação. Os três de Felipe somam R$ 3.300; Eduardo acrescenta R$ 961. O mensal de setembro já incluía os quatro porque todos pertencem à competência comercial de setembro.

**SDR de origem dos quatro: não certificado.** O fato de Felipe ter role SDR não demonstra que ele originou a oportunidade. Não foi inferido SDR a partir do vendedor, tags ou nome do cliente. Fonte original consultada na auditoria anterior: fichas/histórico Datacrazy; materialização comparada: Firestore `crmLiveCache/crm`.

**Página/lote individual e primeiro snapshot elegível exato: desconhecidos.** O snapshot antigo informou 754 negócios em quatro páginas, mas não registrou mapa negócio→página. A nova ingestão registra essa proveniência para coletas futuras. Não é possível reconstruir o lote dos quatro a partir dos agregados antigos.

### Cache e 429

O snapshot de R$ 8.385 foi gerado em 14/09 às 20:02:50, antes do deploy anterior `2f79e1a` (criado 20:03:55, pronto 20:04:11). Essa correção anterior já compartilhava a seleção financeira e preservava Outros. As novas buscas de histórico falharam com 429, inclusive nas páginas 25 e 44 de caminhos distintos; o cache antigo permaneceu visível. Isso explica a persistência da divergência após aquele deploy. Não há evidência para afirmar que os quatro negócios estavam nessas páginas, nem para atribuir a diferença a uma race condition específica. As proteções atuais de ingestão e publicação foram mantidas e testadas.

### Agosto

Uma exceção comercial estabelecia 11–18/08; a semana regular anterior continuava 05–11/08, com os dois fins inclusivos. O dia 11 pertencia às duas.

| Negócio observado em 11/08 | Valor | Semana A antiga | Semana B antiga | Regra corrigida |
|---|---:|---|---|---|
| Edi Carlos da Silva | R$ 1.110 | 05–11/08 | 11–18/08 | Somente 11–18/08 |
| Liliam Teixeira Godinho Silva | R$ 1.110 | 05–11/08 | 11–18/08 | Somente 11–18/08 |
| Maria Leal | R$ 508 | 05–11/08 | 11–18/08 | Somente 11–18/08 |

Total repetido antigo: **R$ 2.728**. UUIDs, números e horários desses três não foram exportados. A semana anterior passa a 05–10/08: `[05/08 00:00,11/08 00:00)`. A especial permanece `[11/08 00:00,19/08 00:00)`, em São Paulo. Não houve edição das metas salvas.

### SDR

Identificada uma falha de confiabilidade: erro de leitura de eventos era convertido em `[]`, aparentando realizado zero. Esse fallback foi removido. Duplicatas de eventos agora são tratadas por ID; conflitos falham; eventos sem atribuição/ID são expostos. Não foi comprovada divergência numérica SDR em produção porque os eventos reais não foram obtidos.

## ALTERAÇÕES

Arquivos de código e testes desta correção, relativos à raiz do projeto:

| Arquivo | Papel |
|---|---|
| `api/_lib/commercial-time.js` (novo) | Datas civis, validação, fuso e limites semiabertos; histórico de horário de verão |
| `api/_lib/commercial-week.js` | Semanas canônicas e partição completa da competência; corrige 11/08 |
| `api/_lib/commercial-period.js` | Competência usa o mesmo motor de instantes, independente do fuso do processo |
| `api/_lib/commercial-sales.js` | Data de ganho prioritária, valor zero preservado e rejeição de IDs com fatos conflitantes |
| `api/_lib/commercial-reconciliation.js` (novo) | Ledger por negócio, diferenças por ID/campo e invariantes |
| `api/_lib/commercial-sdr.js` (novo) | Reconciliação de eventos SDR, deduplicação e atribuição explícita |
| `api/_lib/commercial-goals.js` | Expõe ledger/reconciliação no modelo de Metas |
| `api/_lib/growth-people.js` | Progresso SDR usa o motor de eventos e expõe reconciliação |
| `api/_lib/crm-live.js` | Ledgers mensal/semanal, metas vizinhas, versão 4, falhas SDR propagadas |
| `api/_lib/crm-snapshot-publish.js` | Gate por IDs, contagens, valores, atribuição e invariantes antes de publicar |
| `api/_lib/crm-snapshot-freshness.js` | Invalidação lógica pela versão 4, sem reescrever dados antigos |
| `api/_lib/datacrazy-ingestion.js` | Registra páginas por negócio após leitura bem-sucedida |
| `api/_lib/crm-source-snapshot.js` | Leitura estrita sem sincronização; proveniência comprimida e verificada |
| `api/_lib/firestore-admin.js` | Limite de paginação com continuação passa a falhar, não retornar parcial |
| `api/growth-dashboard.js` | Mesma proteção contra listas parciais no acesso autenticado |
| `scripts/reconcile-commercial-metrics.js` (novo) | Coletor read-only e auditoria offline por ID; saída FAIL quando incompleta |
| `tests/commercial-engine-reconciliation.test.js` (novo) | 43 regressões do motor, atribuição e leitura sem escritas |
| `tests/crm-source-pipeline.test.js` | Fixtures de publicação v4 e invariantes financeiras |
| `tests/growth-commercial-period.test.js` | Expectativas dos campos temporais aditivos |
| `tests/growth-weekly-goals.test.js` | Expectativas canônicas das semanas |

Artefatos criados neste diretório: `relatorio.md`, `replay-observed.cjs`, `observed-replay.json`, `evidencia-auditoria-anterior.md`, `production-attempt.log`, `tests-engine.log`, `tests-full.log`, `replay-summary.json`. Alterações concorrentes de Financeiro/Atendimento e ambientes não pertencem a esta entrega.

## ARQUITETURA FINAL

Datacrazy transacional → coleta completa com retry/backoff/Retry-After → normalização de ID, status, valor e data → cálculo canônico/ledger → gate e publicação atômica de materialização → reconciliação por ID → CRM Live/Metas.

O snapshot é cache versionado. A fonte autoritativa de receita é o negócio transacional elegível; metas e vínculos vêm do Firestore. Eventos `meeting/show` são a fonte de realizado SDR. Receita e quantidade de reuniões mantêm unidades distintas.

O motor mantém os campos legados `startDateKey/endDateKey` inclusivos para apresentação e acrescenta `start/end`, `endExclusiveDateKey`, `timezone`. O cálculo usa `[start,end)`. Frontend `commercial-goals.js` já apresenta datas com `America/Sao_Paulo`; backend passa a centralizar conversões no mesmo fuso. Instantes com offset são convertidos; datas sem horário são dias civis; strings com horário sem offset não são aceitas como instantes inequívocos. O fuso configurado na origem Datacrazy permanece não certificado por API.

Às 00:00 do início o negócio entra; às 23:59:59.999 do último dia permanece; às 00:00 do próximo sai. Semanas contábeis são recortadas nos limites da competência, cobrindo também parcelas iniciais/finais. Metas semanais continuam pertencendo ao mês de início da semana e não são rateadas. Julho encerra em 01/08 conforme configuração real; agosto começa em 02/08. Setembro é aberto: seus valores representam a observação de 14/09, sem projetar receita futura.

Paginação existente: sequencial, com pacing, retry/backoff, Retry-After, contagens estáveis e verificação de fim. Erro, timeout, conflito ou coleta incompleta impedem publicação. Staging e commit atômico mantêm a materialização anterior íntegra; controle de versão/cronologia impede que coleta antiga sobrescreva nova. Negócios fechados sem ID ou data utilizável são contabilizados em `invalid_financial_deals` e impedem certificação/publicação; não podem desaparecer como zero válido. Nenhuma correção depende dos números dos quatro negócios.

## JULHO

**Replay de 54 linhas históricas DOM; não certificado por dealId.** Meta R$ 60.000; mensal **R$ 56.173**; soma semanal **R$ 56.173**; delta **R$ 0**. Duplicidade de alocação temporal R$ 0; não alocado temporal R$ 0. Unicidade transacional e snapshot delta: não certificados.

Partições: 01–07/07 R$ 9.460; 08–14 R$ 7.851; 15–21 R$ 9.847; 22–28 R$ 17.425; 29/07–01/08 R$ 11.590. Os cinco ganhos de 01/08, R$ 6.110, pertencem a julho. Não havia metas semanais salvas em julho; isso não elimina receita da partição contábil.

## AGOSTO

**Replay de 44 linhas históricas DOM; não certificado por dealId.** Meta R$ 70.000; mensal **R$ 50.320**; semanal **R$ 50.320**; delta **R$ 0**. Receita duplicada pela alocação temporal **R$ 0** após o patch; não alocado temporal **R$ 0**. Snapshot delta e unicidade transacional: não certificados.

Partições: 02–04 R$ 4.300; 05–10 R$ 6.134; 11–18 R$ 16.415; 19–25 R$ 15.720; 26–31 R$ 7.751. O recorte de 01/09 pertence à competência seguinte.

## SETEMBRO

**Replay por número de ficha de 26 negócios, não UUID transacional.** Meta R$ 60.000; mensal **R$ 28.188**; semanal **R$ 28.188**; delta **R$ 0**. Duplicados no replay 0; não alocados 0; receita duplicada/não alocada R$ 0. Atingimento 46,98%. CRM Live vs Metas: delta agregado R$ 0 no replay. O snapshot mensal anteriormente observado também era R$ 28.188: delta agregado observado R$ 0; igualdade por dealId permanece não certificada.

Partições: 01/09 R$ 2.305; 02–08 R$ 13.237; 09–15 R$ 12.646; demais parcelas R$ 0 na observação. A soma de semanas contábeis inclui 01/09 mesmo sem meta semanal própria em setembro.

## SEMANA 09–15/09

Snapshot antigo: **R$ 8.385 / 7 negócios**. Replay canônico: **R$ 12.646 / 11 negócios**. Diferença: **R$ 4.261** (33,69% do realizado). `snapshot_delta`, na convenção snapshot menos canônico: **−R$ 4.261**.

Os quatro aparecem automaticamente no ledger: #11396 R$ 1.275, #11296 R$ 1.075, #8895 R$ 950 em Outros; #7580 R$ 961 em Luis Eduardo. Consolidado semanal: Matheus R$ 3.875/3, Luis Eduardo R$ 5.471/5, Outros R$ 3.300/3. Total R$ 12.646/11. Nenhum snapshot de produção foi recalculado ou sobrescrito.

## SDR

**FAIL de certificação end-to-end: eventos reais indisponíveis.** Testes locais passam para meetings/show, deleted, duplicatas, conflitos, identidade ausente, inativo e não configurado. O replay não contém vínculo SDR de origem para os 26 negócios. Ausência de vínculo não significa realizado SDR zero. Eventos sem destinatário são expostos como não alocados e impedem PASS da auditoria completa.

## CLOSER

**PASS local; FAIL de certificação end-to-end.** O ranking semanal fecha com o consolidado no replay. O cadastro observado tem 8 comerciais ativos e 3 inativos excluídos. IDs/vínculos explícitos têm prioridade; aliases são compatibilidade legada e o método é registrado. Roles semanais salvas prevalecem para configuração histórica; pessoa inativa/removida, SDR sem papel closer e ausência de linha de destino preservam receita em Outros. `sourceResponsibleId/name` preservam o vendedor original quando disponível; Outros é destino contábil, não identidade inventada.

Não existe prova de SDR originador nos quatro. Fábio, observado em julho/agosto e ausente da lista comercial atual, não pode ser declarado removido de toda a coleção users sem export completo. A reatribuição histórica segundo cadastro atual permanece um limite de certificação até confrontar as identidades reais.

## INVARIANTES

| Invariante | Código/testes/replay | Certificação completa de produção |
|---|---|---|
| Zero overlaps | PASS | FAIL — export ausente |
| Zero gaps indevidos | PASS | FAIL — export ausente |
| Zero orphan deals | PASS local; histórico somente cobertura temporal | FAIL — identidades ausentes |
| Zero negócios duplicados | PASS local; setembro por número | FAIL — histórico sem dealId |
| Zero receita não alocada | PASS no replay temporal | FAIL — integração incompleta |
| Zero receita duplicada | PASS no replay temporal | FAIL — integração incompleta |
| Mensal = soma semanal | PASS nos três replays | FAIL — export ausente |
| Snapshot = canônico | Gate local PASS; snapshot semanal antigo diverge | **FAIL — −R$ 4.261 observado** |
| CRM Live = Metas | PASS local/setembro observado | FAIL end-to-end |

Métricas disponíveis no ledger/relatório: `overlapping_periods`, `improper_gaps`, `orphan_deals`, `unallocated_revenue`, `duplicate_attribution_revenue`, `monthly_weekly_delta`, `estimated_value_deals`, `invalid_financial_deals`, `source_duplicate_deals`, `unknown_sdr_links`. Comparação por negócio reporta faltantes, extras, duplicados, semana errada e diferenças de valor/data/campo de data/status/role/responsável/competência. `snapshot_reconciliation_rate` é indisponível quando falta o ledger persistido; não é fabricado como 100% pela igualdade de somas.

## TESTES

- Motor novo: **43 aprovados, 0 falhos**.
- Suíte completa final (`npm test`): **370 testes; 365 aprovados, 5 ignorados, 0 falhos**. Inclui testes de outros módulos presentes no workspace.
- `git diff --check`: sem erros.
- Regressões: limites de semana, mês/ano, fevereiro comum/bissexto, meses 30/31, quatro fusos do processo, horário de verão histórico, ganho posterior à criação, zero explícito, inativo/removido/Outros/role histórico, dealId duplicado/conflitante, paginação 429/retry/falha/completude, snapshot íntegro preservado e publicação completa, SDR e closer.
- Durante a implementação quatro testes de igualdade estrutural precisaram incluir os novos campos temporais aditivos. A verificação final passou sem retirar as expectativas existentes.
- Não executado com sucesso: coleta autenticada completa dos negócios, eventos e snapshots reais; reconciliação de produção por dealId; certificação SDR end-to-end.

## DADOS DE PRODUÇÃO

**Produção foi alterada: NÃO.** O coletor criado só usa GET/list. A rotina read-only da fonte não adquire lease, sincroniza ou publica. Os artefatos são locais.

## DEPLOY

**Deploy executado: NÃO.** Não houve backfill, migration ou sobrescrita de snapshot em produção.

## VEREDITO

**Tecnicamente apto para deploy controlado: NÃO.** Falta satisfazer o critério principal: reconciliação determinística com os negócios reais, seus IDs, eventos SDR e snapshots autenticados.

### Plano de validação e publicação futura — não executado

1. Restabelecer acesso read-only autenticado ao Datacrazy e Firestore por credenciais do ambiente autorizado. Não incluir segredos no repositório.
2. Executar `node scripts/reconcile-commercial-metrics.js --production-read-only --output /caminho/local/seguro/report.json`, ou fornecer export completo ao modo `--input`. O processo retorna código não zero quando não certificado. O modo não escreve no CRM/Firestore.
3. Auditar os três meses por dealId e os eventos SDR. Snapshots legados sem ledger são marcados não verificáveis; igualdade de totais não dá PASS. Comparar a materialização candidata local e explicitar as divergências do cache antigo antes de propor publicação.
4. Somente após revisão e autorização explícita futura, preparar publicação/recomputação pelo caminho normal com versão 4 e gates. Nenhum script de backfill foi executado. Metas, usuários e histórico permanecem preservados.
5. Campos são aditivos; não é necessária migração destrutiva do Firestore. Versões antigas de materialização tornam-se desatualizadas logicamente. Preservar snapshots antigos e hashes; rollback exige seleção/recomputação controlada da versão compatível, sem apagar histórico nem reativar silenciosamente cache antigo como certificado.

Limitação adicional: esta entrega não apresenta PASS para snapshot antigo divergente. O próximo dry-run deve separar comparação com o cache antigo da validação da materialização candidata, e continuar relatando o delta histórico até haver publicação autorizada.
