# Cancellation Lifecycle V2 — rollout legacy

## Decisão aplicada em 15/09/2026

Preservar acesso e suspensão atuais dos 227 alunos. Campos históricos desconhecidos ficam NULL; `legacy_backfill` e `legacy_needs_review` ficam em `legacy_source`. Esses marcadores não bloqueiam operação. Firestore e Supabase compõem a integração; n8n não participa.

## Resultado

V2 habilitado em produção em 15/09/2026, deployment `dpl_JC3XpiMbPDqE6SSfueoZLswgmGt1`, domínio `plataforma.spaceschoolbr.com`. Runtime confirmou flag true; execução autenticada do job retornou HTTP 200, zero processados e zero falhas. Leitura dos 227 pelo loader canônico da aplicação confirmou zero mudanças de acesso. Não houve impersonação/login individual dos alunos nem escrita de projeção Firestore no backfill.

## Backfill concluído

- 227 students e 227 subscriptions canônicas; 226 com acesso ativo e 1 já inativo preservado.
- Os 15 alunos ativos suspensos mantêm acesso e suspensão de aulas, registrada em `legacy_operational_suspended`; não se presume a modalidade financeira da pausa.
- Os 10 registros de abandono ainda ativos permanecem ACTIVE. Os 6 avisos vencidos não geram aviso canônico nem churn retroativo. O conflito antecipado preserva o estado inativo existente, com revisão.
- 56 planos NULL. Datas de início/fim, aviso, último dia e churn históricos permanecem NULL.
- Sem cases, eventos, outbox ou escrita no Firestore durante o backfill.
- Segunda execução: zero inserções; linhas e versões idênticas. Comparação dos 227: zero alterações de acesso.

## Validação mínima

Migration testada localmente e aplicada em produção. Os canários SQL de pedido/reversão, aviso de dois meses, bloqueio antecipado e job idempotente passaram em uma transação revertida, sem persistir alunos fictícios. A política da aplicação concede acesso no último dia e nega no seguinte. Não houve staging nem nova auditoria histórica.

Evidências: `artifacts/cancellation-production/legacy-production-backfill.json`, `legacy-essential-canaries.json`, `legacy-live-access-check.json` e `legacy-activation.json` (estado final da publicação).

## Operação futura e contenção

Novas transições seguem ACTIVE → CANCELLATION_REQUESTED → NOTICE_PERIOD → CHURNED. NOTICE_PERIOD usa o valor persistido `cancellation_scheduled`; dois meses de calendário, churn no dia seguinte ao último dia ativo, fuso America/Sao_Paulo.

Job `/api/retention-churn-job`, diariamente às 00:05 de São Paulo (03:05 UTC), autenticado pelo CRON_SECRET existente. O agendamento de presença já existente foi preservado. Com V2 desligado, GET autenticado retorna skipped sem executar job.

Versão compatível com flag OFF: `dpl_GqcpcvoMGSURKE8iEpWE8pyKfyWb`. Para contenção, desligar RETENTION_V2_ENABLED e publicar versão compatível. Não apagar as subscriptions nem reverter eventos reais criados após go-live. A alteração de environment exige nova publicação; não é um interruptor instantâneo.

Backup pré-migration local privado: `/tmp/space-cancellation-production/pre-legacy-sql-backup.json`; inclui as quatro tabelas de lifecycle então vazias, funções retention, constraints e colunas afetadas. Não é backup integral do banco. Hash registrado nos canários. Snapshot atual de users também está preservado em diretório privado.
