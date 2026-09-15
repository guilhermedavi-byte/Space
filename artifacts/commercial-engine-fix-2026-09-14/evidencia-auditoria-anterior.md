# Auditoria real — CRM Live — 14/09/2026

**Total Datacrazy: R$ 12.646,00 (11 negócios). Snapshot exibido: R$ 8.385,00 (7 negócios). Divergência: R$ 4.261,00.**

Fonte: sessão autenticada da empresa Space Online LTDA no Datacrazy, fichas/históricos de cada negócio; console Firestore do projeto plataforma-space; logs reais da Vercel; página CRM Live em produção. Nenhum fixture foi usado. Nenhuma regra, meta ou negócio foi alterado por esta auditoria.

## Período e precisão

Datacrazy selecionado de 09/09 a 14/09/2026; CRM Live na semana de 09/09 a 15/09/2026, ainda em andamento. Fuso America/Sao_Paulo. Os números abaixo são o campo **Número** do negócio mostrado pelo Datacrazy, não UUIDs inventados. Datas são transcritas da UI/histórico com precisão de minuto. A coluna “Snapshot” reconstitui os sete negócios a partir das regras da versão anterior, das datas reais e dos valores/contagens efetivamente persistidos.

## Negócio por negócio

Todos os 11 estão em Conversão, Ganho/Fechado e entram no total de ganhos do Datacrazy no período.

| Número | Negócio/lead | Closer/atendente | Valor | Status/etapa | Último ganho (UTC−3) | Snapshot exibido | Motivo |
|---|---|---|---:|---|---|---|---|
| #11421 | Marcelo Augusto Vieira | Matheus Afonso Rodrigues | R$ 1.475,00 | Ganho/Fechado | 2026-09-11 21:10 | Incluído | Ganho no período; responsável está entre os closers da configuração; movimentação dentro da semana. |
| #11420 | Leticia Ferreira de Souza | Matheus Afonso Rodrigues | R$ 1.275,00 | Ganho/Fechado | 2026-09-10 22:43 | Incluído | Ganho no período; responsável está entre os closers da configuração; movimentação dentro da semana. |
| #11401 | Livia Moreira Martins Roberto | Luis Eduardo | R$ 1.120,00 | Ganho/Fechado | 2026-09-11 22:18 | Incluído | Ganho no período; responsável está entre os closers da configuração; movimentação dentro da semana. |
| #11396 | Samuel Luiz da Silva | Felipe Santos | R$ 1.275,00 | Ganho/Fechado | 2026-09-10 22:46 | Excluído | Snapshot anterior somava somente os closers configurados; Felipe consta como SDR, sem linha de closer/Outros para receber a venda. |
| #11372 | Michelle Quintão Ferreira Luna | Matheus Afonso Rodrigues | R$ 1.125,00 | Ganho/Fechado | 2026-09-14 11:58 | Incluído | Ganho no período; responsável está entre os closers da configuração; movimentação dentro da semana. |
| #11296 | Michael | Felipe Santos | R$ 1.075,00 | Ganho/Fechado | 2026-09-09 21:51 | Excluído | Snapshot anterior somava somente os closers configurados; Felipe consta como SDR, sem linha de closer/Outros para receber a venda. |
| #11287 | Kennedy Lacerda Andrade | Luis Eduardo | R$ 970,00 | Ganho/Fechado | 2026-09-09 22:13 | Incluído | Ganho no período; responsável está entre os closers da configuração; movimentação dentro da semana. |
| #11274 | Joyce Ferreira de Lima | Luis Eduardo | R$ 1.475,00 | Ganho/Fechado | 2026-09-10 16:59 | Incluído | Ganho no período; responsável está entre os closers da configuração; movimentação dentro da semana. |
| #10873 | Jackeline Dutra da Silva | Luis Eduardo | R$ 945,00 | Ganho/Fechado | 2026-09-14 14:57 | Incluído | Ganho no período; responsável está entre os closers da configuração; movimentação dentro da semana. |
| #8895 | Maikel Alvarenga | Felipe Santos | R$ 950,00 | Ganho/Fechado | 2026-09-11 19:18 | Excluído | Snapshot anterior somava somente os closers configurados; Felipe consta como SDR, sem linha de closer/Outros para receber a venda. |
| #7580 | Eduardo Nunes Moreira | Luis Eduardo | R$ 961,00 | Ganho/Fechado | 2026-09-09 00:00 | Excluído | Snapshot anterior filtrava lastMovedAt: entrada em Fechado em 08/09/2026 23:58, antes da semana; restaurado 08/09 23:59 e ganho novamente 09/09 00:00. |

Soma dos sete incluídos no snapshot: **R$ 8.385,00**. Soma das quatro vendas excluídas: **R$ 4.261,00**. Soma das onze vendas reais: **R$ 12.646,00**.

| Responsável | Total real | Snapshot | Diferença |
|---|---:|---:|---:|
| Luis Eduardo | R$ 5.471,00 | R$ 4.510,00 | R$ 961,00 |
| Matheus Afonso Rodrigues | R$ 3.875,00 | R$ 3.875,00 | R$ 0,00 |
| Felipe Santos | R$ 3.300,00 | R$ 0,00 | R$ 3.300,00 |

## Causa identificada

1. **Snapshot anterior à correção:** Firestore `crmLiveCache/crm`, gerado em 14/09/2026 às 20:02:50 (23:02:50.843Z), persiste `weekly.team.closers.actualValue = 8385` e `count = 7`. Luis: 4510/4; Matheus: 3875/3. A leitura anterior usava 754 negócios em quatro páginas, com lastMovedAfter de 01/09.
2. **Três vendas de Felipe omitidas na regra antiga:** a semana configurava Felipe como SDR. A agregação antiga criava linhas apenas para closer/both e descartava negócios sem linha de destino. O total do time vinha da soma dessas linhas. Isso explica #11396, #11296 e #8895, somando R$ 3.300,00.
3. **Eduardo na virada do dia:** o histórico de #7580 mostra movimento Agendado → Fechado em 08/09 às 23:58, restauração às 23:59 e novo ganho em 09/09 às 00:00. O filtro semanal antigo era lastMovedAt, excluindo R$ 961,00 da semana iniciada em 09/09. O fechamento/status é posterior à movimentação.
4. **Correção implantada, mas sem novo snapshot:** a implantação atual usa o commit 2f79e1a (criada às 20:03:55, pronta às 20:04:11); a anterior era fcb6f22. O caminho financeiro atual solicita todo o histórico, sem filtro de movimento/status, em páginas de 200. Os logs mostram HTTP 429 / Too many requests do Datacrazy antes de concluir a paginação — inclusive página 25 (skip 4800) no payload e página 44 (skip 8600) no detector. Não há recuperação/backoff nessa paginação. As consultas periódicas do payload e do detector repetem a busca.
5. **Tela mantém valor antigo:** a página mostrou “R$ 8,4k realizado”, “MODO DEGRADADO”, HTTP 429 e “Sem atualização nova · mantendo última tela boa”. O frontend recarrega `crmLive:lastGood` no erro, sem validar a versão do modelo; `sanitizeLastGoodPayload` remove buildId. Assim, a invalidação do cache backend não impede o snapshot antigo do navegador de continuar visível.

A diferença de R$ 4.261,00 está integralmente reconciliada com quatro negócios reais. Não é diferença de arredondamento: apenas R$ 12.646,00 → R$ 12,65 mil é arredondamento de apresentação.

## Fonte de produção e caminhos de código

Produção utiliza integração direta Datacrazy: GET `CRM_API_BASE_URL/api/v1/businesses`, Bearer `CRM_API_KEY`. O projeto Vercel é space; DATACRAZY_MIRROR_ENABLED não consta das variáveis de produção listadas. Firestore guarda configuração/cache, não é a origem das vendas.

- `api/_lib/crm-live.js`: fetchCrmBusinessesLegacy, fetchCrmWindow, buildCrmLiveCrmSlice, buildWeeklyTeamSummary.
- `api/_lib/growth-people.js`: summarizeWeeklyCloserProgress; comparar fcb6f22 com 2f79e1a.
- `api/_lib/commercial-sales.js`: prioridade de datas e agregação atual. Log financeiro real anterior registra statusChangedAt para os 368 fechados examinados no mês.
- `api/crm-live-data.js`: cache, invalidação por readModelVersion e propagação do erro.
- `api/crm-live-events.js`: leitura integral e detector periódico.
- `api/crm-live.js`: loadData, loadLastGood e sanitizeLastGoodPayload.

## Limites da validação

Foi possível validar o valor real do Datacrazy e explicar integralmente a diferença do snapshot visível. **Não foi possível validar uma resposta nova e completa do cálculo corrigido em produção:** a API está respondendo 429. Não executei o script de auditoria com fixtures ou com uma reconstrução artificial do payload. Não fiz varredura de todos os negócios históricos abertos/perdidos; “excluídos” nesta tabela refere-se às quatro vendas que faltam entre os onze ganhos do período.

Para concluir a auditoria integral do novo cálculo, falta uma resposta paginada completa e bem-sucedida da API Datacrazy (ou export real equivalente, com IDs, valores, stage/pipeline, atendente, statusChangedAt e demais campos de fechamento/movimento), seguida de um novo payload CRM Live. Credenciais de CRM/Firestore não são exportadas com valor nos arquivos locais; as sessões reais de Datacrazy, Firestore e Vercel permitiram esta reconciliação. Não é necessário enviar segredos em mensagem.

## Evidências preservadas

- observacoes-reais.json: valores transcritos e resumo do cache.
- erros-producao.jsonl: logs reais HTTP 429 da Vercel.
- auditoria-financeira-producao.jsonl: logs reais anteriores de growth-metrics (período mensal, não confundir R$ 28.188,00 mensais com a semana).
- implantacoes.json: commits e horários verificados pela API Vercel.
