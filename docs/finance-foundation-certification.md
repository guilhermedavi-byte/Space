# Financial Foundation — relatório de homologação

**Data:** 14/09/2026, America/Sao_Paulo; execuções em 15/09/2026 UTC.  
**Decisão:** **NO-GO — Foundation ainda não certificada operacionalmente.**  
**Motivo:** não foi identificado Supabase staging aprovado nem credencial Asaas sandbox disponível. Nenhum cenário financeiro real foi executado. Os resultados locais não substituem homologação externa.

## 1. Escopo e limites da execução

Foram lidos integralmente [finance-architecture-audit.md](finance-architecture-audit.md) e [finance-foundation.md](finance-foundation.md), e revisada a [migration](../supabase/migrations/202609140002_finance_foundation.sql). A migration não foi modificada nesta etapa.

Houve inspeção local de configuração por presença/ausência e identificadores não secretos, e consultas de metadados da Vercel: `vercel env ls preview` e `vercel list space --environment preview --limit 5`, no projeto vinculado `space`. Nenhum valor secreto foi solicitado à Vercel. Não houve chamada a Asaas, Supabase remoto, endpoint do Preview ou aplicação de produção; não houve deploy, alteração de variável remota, registro de webhook ou mudança de flag remota.

Credenciais Supabase encontradas nos arquivos de produção não foram usadas para autenticar nenhuma chamada. Não foram consultados registros pessoais/financeiros remotos. Nenhum cliente, cobrança, pagamento ou aluno externo foi criado. Não há objeto sandbox a limpar.

[Evidência sanitizada dos ambientes](../artifacts/finance-foundation-certification-2026-09-14/environment-evidence.json) registra fontes locais, presença de variáveis, resumo de metadados Preview, health sem credencial e manifesto vazio de objetos externos.

## 2. Mapeamento dos ambientes

| AMBIENTE | SUPABASE | ASAAS | WEBHOOK | FOUNDATION FLAG | SEGURO PARA TESTE? |
| --- | --- | --- | --- | --- | --- |
| Produção identificada nas configurações locais | `https://mlpojyvwyqcrelagtgkw.supabase.co`; ref `mlpojyvwyqcrelagtgkw` | Base/chave Asaas ausentes nas cópias inspecionadas | Token dedicado e connection ID ausentes | Ausente nas cópias; estado do deploy não consultado | **Não; proibido nesta tarefa** |
| Processo da tarefa | URL/chave Supabase ausentes | Base/chave/scope ausentes | Token e connection ID ausentes | Ausente | **Não** |
| Arquivo privado de homologação | `.env.finance-sandbox`, `.env.staging`, `.env.staging.local`, `.env.preview` e `.env` ausentes | Não disponível | Não disponível | Não disponível | **Não** |
| Template `scripts/finance-sandbox.env.example` | URLs/credenciais vazias | Base sandbox; chave vazia; scope sandbox | Token vazio; URL exemplo | false; inline true | **Não; exemplo não é ambiente** |
| Vercel Preview do projeto `space` | Nomes SUPABASE_URL/SPACE_STAGING_SUPABASE_URL cadastrados; valores não consultados nesta tarefa; service role não consta da listagem Preview | ASAAS_BASE_URL/ASAAS_KEY_SCOPE cadastrados; ASAAS_API_KEY ausente da listagem | ASAAS_WEBHOOK_TOKEN e FINANCE_CONNECTION_ID ausentes da listagem | FINANCE_FOUNDATION_ENABLED/FINANCE_WEBHOOK_PROCESS_INLINE ausentes da listagem | **Não; isolamento/configuração insuficientemente comprovados** |
| Docker local descartável | PostgreSQL 16 + PostgREST 12; sem acesso a URL externa de banco | Respostas simuladas em testes | Handler invocado localmente | Injetada nos testes | **Sim para testes locais; não é homologação sandbox** |

As cópias `.env.local`, `.env.vercel.pull` e `.vercel/.env.production.local` concordam em `VERCEL_ENV=production` e na URL Supabase acima. A presença de service role foi verificada sem exibir seu valor. Não afirmamos que essas cópias comprovem todo o estado atual do deploy de produção.

O Preview mais recente retornado como **Ready** foi [space-gl1nwvqlk](https://space-gl1nwvqlk-guilhermedavi-4547s-projects.vercel.app), com idade aproximada de duas horas na consulta. **Ele não foi selecionado como ambiente de teste nem acessado.** Não foi comprovado qual commit/configuração financeira está implantado. O domínio está registrado aqui como evidência de descoberta, não como autorização.

A listagem Preview contém variáveis compartilhadas com Production, incluindo SPACE_PUBLIC_BASE_URL, SPACE_AUTH_SECRET e integrações n8n/Chatwoot/CRM/ZapSign. Isso impede inferir isolamento pelo rótulo Preview. O documento de Atendimento relata valores Preview vazios em sua auditoria anterior; essa observação histórica não foi tratada como verificação atual dos valores.

Não há CLI Supabase nem SUPABASE_ACCESS_TOKEN no processo da tarefa. Isso limita a descoberta: não prova inexistência de staging em outra organização/conta. Foi solicitada ao usuário apenas a localização de configuração privada e o alvo autorizado, sem pedir secrets no chat; nenhum alvo adicional estava disponível até o fechamento deste relatório.

## 3. Safeguards de homologação

O guard anterior comparava URL com variável staging, mas não tinha uma allowlist independente de domínio/credenciais nem confirmação adicional de apply. Foi reforçado somente o executor administrativo desta etapa, sem mudar a lógica financeira de projeção ou a API de produção.

Arquivos: [guard](../_lib/finance-certification-environment.js), [política](../config/finance-staging-targets.json), [CLI](../scripts/finance-foundation.js), [template](../scripts/finance-sandbox.env.example).

Controles offline, anteriores a chamadas externas:

- APP_ENV e SUPABASE_ENV_SCOPE devem ser staging; sinais de ambiente contraditórios são recusados. NODE_ENV não prova isolamento.
- Base exata `https://api-sandbox.asaas.com/v3`, ASAAS_KEY_SCOPE=sandbox e ausência de sinal Asaas production.
- URL Supabase HTTPS canônica, ref igual à referência staging e FINANCE_STAGING_PROJECT_REF; aliases conflitantes são recusados.
- Referência de produção conhecida em denylist SHA-256; esse ref nunca pode ser alvo, mesmo se erroneamente acrescentado à allowlist.
- Exatamente uma entrada previamente revisada em `config/finance-staging-targets.json`. **A lista staging está vazia. Não foi autorizado nenhum projeto por inferência.**
- Domínio staging exato, distinto das origens de produção revisadas, e webhook exatamente nesse domínio em `/api/asaas-webhook`.
- Hashes revisados de service role, chave Asaas sandbox e token webhook; aliases de credenciais conflitantes são recusados. JWT Supabase também deve declarar role/ref/validade coerentes. Não se usa decodificação JWT como prova isolada de origem.
- Chave Asaas explicitamente identificada como production é recusada mesmo se incluída por engano na política.
- Apply exige simultaneamente `--apply`, `--actor` e `FINANCE_STAGING_APPLY=YES`. Não há bypass.
- Health com connection ID também exige apply porque persiste telemetria. Dry-run e health sem conexão continuam protegidos contra uso de credenciais de produção.
- `preflight` é offline: configuração válida não equivale a ambiente homologado.

Para aprovar uma entrada futura, um operador deve obter ref/domínios e a procedência das credenciais pelo ambiente administrativo de staging. Campos da entrada: `projectRef`, `appOrigin`, `productionOrigins`, `serviceRoleKeySha256`, `asaasSandboxKeySha256`, `webhookTokenSha256`. Usar segredos fortes; nunca versionar os valores. Copiar hashes do mesmo arquivo de execução sem comprovar sua procedência não constitui revisão.

Execução real no processo disponível: `node scripts/finance-foundation.js preflight` retornou exit 1 com `finance_certification_staging_required`, sem rede. Os testes adicionais comprovam rejeição de domínios/refs/credenciais indevidos, aliases conflitantes, ausência de allowlist e ausência de confirmação, incluindo invocação real da CLI com fetch instrumentado para detectar qualquer tentativa de rede.

## 4. Migration e inventário

**Supabase staging: BLOCKED. Migration não aplicada; inventários anterior/posterior remotos não produzidos.** Não foi reaproveitada evidência de produção para preencher essa lacuna.

A mesma migration foi aplicada/reaplicada em PostgreSQL Docker descartável. Foram verificados localmente constraints, uniqueness, RLS, restrições de service role/anon/authenticated, RPC transacional, auditoria imutável e coexistência com a migration de Atendimento. Esse último teste não comprova que todo schema legado de um staging ainda desconhecido está intacto.

[Inventário esperado local](../artifacts/finance-foundation-certification-2026-09-14/expected-local-schema.json): tabelas/RLS/ACL, constraints, índices, funções/configuração/ACL e triggers, com hash SHA-256 da migration. **É baseline local; não é inventário Supabase staging.** Antes de aplicar externamente, comparar catálogo real com essa referência, revisar objetos homônimos, consumidores e estruturas legadas. `IF NOT EXISTS` não certifica compatibilidade de objetos preexistentes.

O inventário local contém 10 tabelas (connections + nove finance_*), 38 constraints, 22 índices e duas funções.

## 5. Connection health

Health do cliente no processo disponível, sem chave e sem chamada remota:

```json
{
  "configured": false,
  "reachable": false,
  "authenticated": false,
  "account_accessible": false,
  "environment": null,
  "error": { "code": "asaas_not_configured", "status": 0, "retryable": false }
}
```

`reachable=false` aqui significa que a API não foi consultada por falta de configuração; não é uma falha de disponibilidade medida no Asaas. Não há connection record externo validado. Último webhook recebido/processado, backlog e reconciliação reais são **desconhecidos**, não zero.

## 6. Matriz de certificação externa

Os status abaixo se referem exclusivamente a **Asaas sandbox + Supabase staging + webhook Space implantado**. Falta de pré-requisito é BLOCKED, não FAIL funcional nem PASS por mock.

| CENÁRIO | RESULTADO | EVIDÊNCIA | STATUS |
| --- | --- | --- | --- |
| Connection | Autenticação/account access não executados | Chave sandbox e alvo staging ausentes; health local asaas_not_configured | BLOCKED |
| PAYMENT_CREATED | Nenhuma cobrança real criada; cadeia webhook/inbox/projeção não observada | Sem customer/payment/event ID real | BLOCKED |
| Duplicate delivery | Cinco reentregas reais não executadas | Nenhum evento real capturado | BLOCKED |
| PAYMENT_UPDATED | Alteração remota e before/after não observados | Sem cobrança sandbox criada | BLOCKED |
| PAYMENT_OVERDUE | Evento real não observado | Falta ambiente; não se atribui bloqueio a limitação comprovada do sandbox | BLOCKED |
| PAYMENT_CONFIRMED | Sequência real não observada | Sem liquidação sandbox | BLOCKED |
| PAYMENT_RECEIVED | Sequência/datas reais não observadas | Sem liquidação sandbox | BLOCKED |
| PAYMENT_DELETED | Exclusão e GET posterior não executados | Não há evidência real de deleted=true versus 404 | BLOCKED |
| PAYMENT_REFUNDED | Formato real não capturado | Falta ambiente; suporte do fluxo não foi testado | BLOCKED |
| Backfill | Dry-run/apply/paginação externos não executados | Sem conta, staging e allowlist | BLOCKED |
| Reconciliation | Divergência staging não provocada | Nenhuma escrita remota autorizável | BLOCKED |
| Repair | ID real e inexistente não consultados externamente | Sem cliente remoto validado | BLOCKED |
| Retry | Falha/recuperação e limite não executados no staging | Somente evidência local separada abaixo | BLOCKED |
| Webhook auth | Endpoint implantado não testado | Nenhum domínio de homologação aprovado | BLOCKED |
| Ordering | Não há payload real para reordenar | Somente fixtures locais existentes | BLOCKED |

Os cenários críticos obrigatórios continuam bloqueados. A tolerância prevista para refund/overdue não autoriza GO porque os demais fluxos reais também não foram comprovados.

## 7. Testes locais finais — evidência complementar

| Escopo local | Resultado | Evidência | Status local |
| --- | --- | --- | --- |
| Foundation, guard de homologação e testes relacionados de ambiente/identidade/Retenção | 65 testes, sem falhas/skips | [TAP](../artifacts/finance-foundation-certification-2026-09-14/related-tests.tap) | PASS |
| PostgreSQL 16/PostgREST 12 reais, Asaas simulado | 20 testes/subtestes, sem falhas/skips | [TAP](../artifacts/finance-foundation-certification-2026-09-14/postgres-tests.tap) | PASS |
| Sintaxe JavaScript e diff | Verificação final registrada junto aos artefatos | [Checks](../artifacts/finance-foundation-certification-2026-09-14/checks.txt) | PASS |

```sh
RUN_RETENTION_BACKEND_LOCAL=1 node --test \
  tests/finance-asaas.test.js tests/finance-foundation.test.js \
  tests/finance-certification-environment.test.js tests/staging-env.test.js \
  tests/student-ownership.test.js tests/retention-domain.test.js \
  tests/retention-cases-api.test.js tests/retention-backend-local.test.js

RUN_FINANCE_SQL_INTEGRATION=1 node --test tests/finance-sql-integration.test.js
```

O teste HTTP local cobre token ausente, Bearer indevido, token errado, método incorreto, JSON inválido, corpo excessivo e evento aceito; verifica zero persistências antes da primeira requisição válida. Testes SQL cobrem CREATED, 20 reenvios concorrentes, UPDATED/OVERDUE, CONFIRMED/RECEIVED sem duplicação, exclusão/estorno/restauração simulados, ordering, atomicidade/rollback, retries/limite, backfill paginado, reconciliação, repair e permissões. Não são evidência de entrega Asaas ou deploy Vercel.

Uma execução intermediária da suíte relacionada teve 64 PASS/1 FAIL por indisponibilidade do socket PostgreSQL durante a inicialização do harness de Retenção. [Log preservado](../artifacts/finance-foundation-certification-2026-09-14/related-tests-initial-startup-failure.tap). A repetição completa, sem alteração nesse harness, terminou em 65 PASS/0 FAIL/0 skipped. Essa instabilidade local não foi atribuída ao Asaas.

## 8. Divergências e arquivos alterados

**Nenhuma divergência entre payload real e mock foi avaliada**, pois não houve payload real capturado. Nenhuma fixture foi rotulada como proveniente do sandbox. Normalização, processador, cliente Asaas e SQL não foram corrigidos nesta etapa por hipótese.

Alterações restritas aos controles solicitados e evidência:

- Criados `_lib/finance-certification-environment.js`, `config/finance-staging-targets.json` e `tests/finance-certification-environment.test.js`.
- Alterados `scripts/finance-foundation.js`, `scripts/finance-sandbox.env.example` e `tests/finance-foundation.test.js` para safeguard e cobertura HTTP exigida.
- Atualizado `docs/finance-foundation.md` para documentar os novos requisitos de execução.
- Criado este relatório e os artefatos em `artifacts/finance-foundation-certification-2026-09-14/`.

Nenhuma mudança de UI, produto financeiro, Atendimento, Recuperação, Chatwoot, Firestore ou infraestrutura externa foi executada. Nenhum commit/deploy foi disparado por esta tarefa; o checkout pode receber commits automáticos de outras rotinas.

## 9. IDs, limpeza e riscos

**Manifesto de objetos sandbox criados: vazio.** Nenhum customer/payment/webhook/connection ID real existe para esta execução. IDs das fixtures locais são sintéticos; bancos/containers criados pelo harness foram removidos pelo próprio harness. Nenhuma limpeza remota foi executada.

Riscos ainda abertos: configuração e procedência do ambiente, versão implantada, grants/schema reais, entrega e latência de webhook, formato real de refund/parciais, semântica de exclusão/404, sequência CONFIRMED/RECEIVED, quota/Retry-After, limites serverless e cobertura de paginação sob alterações simultâneas. Ausência de evidência de falha não equivale a aprovação.

## 10. Desbloqueio e decisão

Para retomar, disponibilizar por mecanismo privado:

1. Supabase staging dedicado: URL/ref, credencial backend própria e meio administrativo SQL staging, com comprovação de isolamento e referências de produção para bloqueio.
2. Conta e chave Asaas sandbox, token webhook dedicado e domínio Space staging aprovado, sem integrações/creds produtivas herdadas.
3. Entrada da allowlist revisada independentemente, arquivo privado baseado no template e confirmação explícita para cada apply.
4. Verificação do deploy staging: commit correto, variáveis efetivas, foundation flag e processamento de inbox; aplicar migration após inventário/comparação e validar conta antes de criar dados.

Depois executar os cenários solicitados com identificador `SPACE_FINANCE_SANDBOX_TEST`, manifestar os IDs/timestamps reais e capturar evidências sanitizadas. Para paginação, usar limite pequeno em execução controlada para demonstrar mais de uma página sem criar volume desnecessário. Reentregas manuais de payloads capturados devem ser identificadas como replay de evento real, distinguindo-as de reentrega pelo próprio Asaas.

**NO-GO para iniciar a Fase 1 — Financeiro V1.** Os controles locais estão verificados; a certificação operacional depende dos fluxos críticos reais. Este relatório não autoriza produção, não habilita flags remotas e não inicia a nova UI.
