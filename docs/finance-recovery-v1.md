# Recuperação V1

Workspace de leitura de `finance_receivables`, com vínculos canônicos e contexto Space existentes. Uma linha por cobrança vencida; detalhes e auditoria usam o drawer de recebíveis. Sem escritas financeiras, mensagens ou automações.

- Elegibilidade: classificação `overdue` do read model da Foundation (aberta, não excluída, vencimento anterior ao dia corrente em São Paulo). Recebidas, confirmadas, canceladas e estornadas ficam fora.
- Valor vencido em centavos; clientes distintos por Asaas Customer ID; ticket = valor / clientes; aging médio = média de dias por cobrança.
- Buckets exclusivos: 1–3, 4–7, 8–15, 16–30, acima de 30 dias.
- Etapas visuais: D-3 (-3/-2), D-1 (-1), D0 (0), D+1 (1/2), D+3 (3–6), D+7 (7–15), intervenção humana (16+). Critério inicial de exibição, sem agendamento. Etapas anteriores ao atraso aparecem na legenda, não na carteira inadimplente.
- KPIs/distribuição representam toda a carteira; busca, aging, etapa e vínculo filtram a tabela paginada.
- Identidades incertas continuam não vinculadas; dados Space ausentes não são inferidos.
- Atualizações da Foundation respeitam cache existente de 20 segundos; não há cópia persistida de inadimplentes.

Validação focada: `tests/finance-recovery-v1.test.js` (cálculos, fronteiras, exclusão de pagos/cancelados, atualização, filtros, render e drawer).
