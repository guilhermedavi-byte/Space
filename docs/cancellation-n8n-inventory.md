# Atualização de escopo

O usuário confirmou que n8n não integra esta arquitetura. Sua identificação e certificação deixam de ser gates. Considerar somente Firestore e Supabase. O texto abaixo é histórico e não representa pendência atual.

# Cancellation V2 — inventário n8n

Status em 2026-09-15: **BLOCKED / inventário não obtido**.

A variável Vercel `N8N_BASE_URL` existe como sensitive/redacted. O valor não está disponível na exportação local; isso não significa que a configuração esteja vazia em produção. Não há aba n8n no inventário atual do Chrome. Foi solicitada a URL e sessão autenticada ao operador. Nenhum workflow foi alterado.

| Item | Evidência atual |
| --- | --- |
| Instância/URL | Não identificada |
| Acesso | Não validado |
| Workflows encontrados | Não enumerados; quantidade desconhecida |
| Workflows alterados | 0 |
| Workflows certificados | 0 |
| Credentials references | Não enumeradas |
| Webhooks ativos e scheduler existente | Não enumerados |

Não existem nomes/IDs de workflows verificados para preencher a tabela individual. Após acesso, inventariar nome, ID, ativo, trigger, inputs, outputs, sistemas, impacto e mudança necessária, buscando aluno, cobrança, pagamento, assinatura, cancelamento, churn, crédito, plano, agenda, Firestore e Supabase.

Contrato exigido: `cancellation.requested` não encerra direitos nem billing; `cancellation.reverted` atualiza retenção/analytics; `notice.started` informa encerramento futuro quando necessário; somente `student.churned` permite encerramento efetivo. Consumers precisam de idempotência por event ID. Backfill deve permanecer silencioso. Nenhuma dessas condições está certificada em workflows reais.
