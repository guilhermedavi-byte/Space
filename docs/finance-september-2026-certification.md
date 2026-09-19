# Certificação financeira — Setembro/2026

Data da execução: 2026-09-19. Ambiente: Production. Escopo: read-only para certificação gerencial de setembro/2026. Nenhuma fórmula do dashboard foi alterada nesta certificação.

## Definição oficial usada

**Faturamento gerencial do mês = soma única dos pagamentos reais de clientes reconhecidos em setembro pela data real de pagamento/confirmação**, independentemente do caminho do dinheiro.

- `RECEIVED`: pagamento de cliente recebido via Asaas, pela data real do pagamento.
- `CONFIRMED`: pagamento de cliente confirmado, pela data de confirmação.
- `RECEIVED_IN_CASH`: cobrança real de cliente marcada como recebida fora do Asaas, pela data registrada do pagamento externo.
- Repasse PF posterior, Tap Tap sem conciliação, reembolso, aporte, mútuo, transferência interna e pendência sem vínculo confiável ficam fora de receita.

## A. Recebimentos de clientes reconhecidos

| Natureza | Quantidade | Valor |
|---|---:|---:|
| CUSTOMER_PAYMENT / RECEIVED via Asaas | 90 | R$ 87.850,81 |
| CUSTOMER_PAYMENT / CONFIRMED | 12 | R$ 11.389,22 |
| CUSTOMER_PAYMENT_EXTERNAL / RECEIVED_IN_CASH | 12 | R$ 13.213,00 |
| CUSTOMER_PAYMENT_UNALLOCATED / Tap Tap | 1 | R$ 1.275,03 |
| **Faturamento oficial reconhecido** | **115** | **R$ 113.728,06** |

## B. Movimentação financeira Asaas

| Bloco do extrato Asaas setembro | Quantidade | Valor |
|---|---:|---:|
| Créditos/entradas brutas relevantes no Asaas | 102 | R$ 108.402,27 |
| Recebimentos de clientes via Asaas reconhecidos | 90 | R$ 87.850,81 |
| Repasses PF | 5 | R$ 11.887,66 |
| Tap Tap/remessa reconhecida como CUSTOMER_PAYMENT_UNALLOCATED | 1 | R$ 1.275,03 |
| Refunds/estornos no extrato | 4 | R$ 5.068,77 |
| Itens antes pendentes resolvidos | 2 | R$ 2.320,00 |

## C. Ponte de reconciliação

| Ponte | Valor |
|---|---:|
| Faturamento oficial reconhecido | R$ 113.728,06 |
| (-) CONFIRMED ainda sem entrada de caixa Asaas | -R$ 11.389,22 |
| (-) RECEIVED_IN_CASH recebido fora do Asaas | -R$ 13.213,00 |
| (+) Repasses PF no Asaas, não receita | R$ 11.887,66 |
| Tap Tap já incluído no faturamento oficial e no extrato Asaas | R$ 0,00 |
| (+) Refunds/estornos no extrato Asaas | R$ 5.068,77 |
| (+) Itens resolvidos fora de receita/competência | R$ 2.320,00 |
| **Movimentação Asaas explicada** | **R$ 108.402,27** |
| **Diferença final de reconciliação** | **R$ 0,00** |

## Totais obrigatórios

| Indicador | Valor |
|---|---:|
| Total bruto Asaas | R$ 108.402,27 |
| Total de recebimentos de clientes | R$ 113.728,06 |
| Total RECEIVED reconhecido | R$ 87.850,81 |
| Total CONFIRMED | R$ 11.389,22 |
| Total RECEIVED_IN_CASH | R$ 13.213,00 |
| Total repasses PF | R$ 11.887,66 |
| Total Tap Tap conciliado | R$ 0,00 |
| Total Tap Tap reconhecido não alocado | R$ 1.275,03 |
| Total Tap Tap pendente | R$ 0,00 |
| Total outras não-receitas | R$ 0,00 |
| Total refunds/estornos | R$ 5.068,77 |
| Total UNCLASSIFIED | 0 / R$ 0,00 |
| Diferença final de reconciliação | R$ 0,00 |

## Pendências

Setembro está certificado: o Tap Tap de R$ 1.275,03 foi definido pela regra permanente como `CUSTOMER_PAYMENT_UNALLOCATED`, com natureza econômica conhecida e alocação ainda pendente; quando for vinculado a uma cobrança, não altera o valor já reconhecido nem duplica `RECEIVED_IN_CASH`. O item de R$ 1.200,00 é refund/estorno, fora de receita; o item de R$ 1.120,00 foi pago em 2026-08-31, fora da competência de setembro. Saldo não classificado: R$ 0,00.
