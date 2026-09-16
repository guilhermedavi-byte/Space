# Contrato de integração — lifecycle Space v1

## Autoridade e transporte

Autoridade: Supabase `subscriptions`. Comandos devem passar por `retention_apply_command` via API autenticada, que grava agregado, evento e outbox na mesma transação. Não escrever status diretamente no Firestore nem inferir término de `cancelamento`, `ativo`, atraso ou vencimento de boleto.

O repositório passa a consumir a outbox para a projeção Firestore. **Não há dispatcher n8n/Asaas implementado ou certificado**, pois seus workflows executáveis não estão disponíveis no checkout. O consumidor externo precisa ser implementado/configurado no ambiente identificado conforme este contrato. Nenhum webhook externo foi disparado nesta entrega.

## Eventos

| Evento outbox | Efeito permitido |
|---|---|
| `cancellation.requested` | Registrar intenção; sem cancelamento financeiro, mudança de acesso, retirada de crédito ou data final. |
| `cancellation.reverted` | Remover intenção e limites vigentes da projeção; preservar pedido/reversão no histórico. |
| `notice.started` | Registrar limite futuro de prestação: aluno ativo inclusive em last_active_date. |
| `student.churned` | Impedir novos direitos futuros a partir de churn_at; preservar recebíveis e histórico. |

Envelope: `outbox_events.id`, `event_type`, `created_at`, `payload`. Payload v1 efetivamente produzido pela migration:

```json
{
  "schema_version": 1,
  "event_id": "UUID do retention_event",
  "case_id": "UUID",
  "subscription_id": "UUID",
  "student_id": "UUID",
  "firestore_student_id": "ID do aluno",
  "billing_account_id": "UUID ou null",
  "external_subscription_key": "identificador externo ou null",
  "plan_name": "plano ou null",
  "mrr_brl": null,
  "notice_started_at": "2026-09-20T15:00:00Z",
  "last_active_date": "2026-11-20",
  "churn_at": "2026-11-21",
  "lifecycle_status": "cancellation_scheduled",
  "financial_status": "current"
}
```

As três datas de aviso são nulas no pedido/reversão de pedido. Reversão operacional de um aviso, quando autorizada pela regra legada mantida, também remove seu limite futuro. Identificador externo ausente é exceção de conciliação, nunca autorização para escolher outro customer por nome. MRR null é desconhecido, não zero. Eventos de outros comandos de retenção não são ordens financeiras.

## Requisitos para o consumidor n8n

1. Consumir por ID da outbox com credencial restrita do servidor. Registrar ACK por **consumidor + event_id**; reutilizar delivery_status/delivered_at existentes quando houver um único dispatcher. `projection_delivered_at` é exclusivamente o ACK Firestore e não indica entrega financeira.
2. Aplicar idempotência transacional; retry com atraso progressivo; reprocessar falhas sem duplicar cobrança ou crédito. Não confirmar antes do efeito persistido.
3. Recarregar a assinatura corrente e sua versão antes de executar efeito. Aviso antigo entregue depois de reversão não pode restaurar um encerramento. Serializar efeitos por subscription_id e verificar novamente antes da chamada ao provedor.
4. Usar America/Sao_Paulo. A meia-noite de 21/11/2026 é 03:00 UTC; 20/11 inteiro permanece elegível.
5. Na cobrança, persistir `subscription_id`, `service_period_start` e `service_period_end`. Rejeitar competência que inclua dia posterior a last_active_date. Se um ciclo cruza o limite, aplicar a política contratual de proporcionalidade existente/revisada; não inventar preço.
6. **Não cancelar pelo vencimento**. Uma cobrança de competência válida vencendo após churn continua legítima. Preservar pagamentos, estornos, dívida anterior e trilha de auditoria. Rows legadas sem vínculo de assinatura não podem receber vínculo especulativo; a trigger as preserva e a integração deve reconciliá-las antes de novas gerações.
7. Na concessão de créditos, cessar novas concessões futuras em churn_at; créditos já válidos podem ser consumidos até last_active_date. Cancelamento/devolução histórico não reativa contrato nem gera direito fora dele. Preservar saldo e histórico para auditoria, aplicando regras vigentes de 24h/72h.
8. Em agenda de grupo, conferir cada membro e cada ocorrência. O servidor do repositório valida arrays de alunos; escritas diretas de arrays no Firestore são recusadas pelas novas regras. Ocorrências individuais de turma carregam alunoId. Não usar a turma administrativa como concessão independente de direitos.
9. Não desligar Flexge/sala/estudo no pedido ou início do aviso. Programar término para churn_at e conferir estado corrente antes de executá-lo.

## Job e projeção

Agendador externo deve enviar POST `/api/retention-churn-job`, header `x-retention-job-secret` com `RETENTION_CHURN_JOB_SECRET`, body `{ "limit": 50 }`, somente no ambiente destinado. A V2 deve estar habilitada. A rotina calcula elegibilidade por data contratual e tolera processamento atrasado sem duplicar evento. Não há cron configurado pelo presente trabalho.

A mesma rotina drena projeções pendentes. Monitorar `projections.failed`, idade da fila e exceções; HTTP 200 do job não prova sucesso de todas as projeções. A escrita usa compare-and-set no Firestore e relê a versão mais recente. Eventos antigos sem firestore_student_id ficam para conciliação e são excluídos da fila automática nova. Esse processo não muda delivery_status do consumidor externo.

As APIs consultam a autoridade em cada nova operação. As regras Firestore usam projeção protegida e limite temporal; preparar a projeção inicial de todos os alunos antes do rollout é obrigatório. Guardas do servidor não dependem da pontualidade do job para reconhecer o dia de churn.

## Checklist de certificação ainda não executado

- Identificar Development/Preview/Staging real e confirmar destinos/credenciais Supabase, Firestore e provedores.
- Revisar migration aditiva, aplicar em staging e repetir os testes A–D com alunos sintéticos.
- Fazer dry-run do export real, revisar CSV de exceções e aprovar correções determinísticas; provisionar todos os contratos e projeções necessários.
- Compilar e testar regras em emulador/staging; verificar criação, reagendamento, turma, último dia e dia seguinte com papéis reais.
- Implantar/configurar consumidor n8n e testar duplicação, ordem invertida, retry, indisponibilidade e reconciliação Asaas/créditos.
- Configurar job e monitorar projeções/ACKs; conferir UI autenticada real, salas e Flexge.
- Revisar plano de rollback e aprovar promoção. Não executar migration ou backfill de produção sem ambiente identificado e revisão.

Ausência desses acessos bloqueia **certificação de produção**, não a implementação verificável localmente entregue.
