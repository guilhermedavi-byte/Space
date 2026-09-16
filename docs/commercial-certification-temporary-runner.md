# Revisão do mecanismo temporário de certificação comercial

## MECANISMO ESCOLHIDO

Uma única Vercel Function temporária, em **deployment isolado do projeto `space`**, direcionado ao ambiente Production, **sem promover/atribuir domínios**. O pacote usa Build Output API v3 e contém somente `/api/certify`; não contém frontend, arquivos estáticos, cron ou rotas normais. Todos os outros caminhos retornam 404.

A função recebe os secrets de Production no runtime, inicia um processo filho dedicado, coleta somente leituras, executa os módulos reais copiados byte a byte do workspace e devolve apenas JSON sanitizado. Um programa local valida novamente esse JSON antes de persistir `result.json` e `relatorio.md`.

**Nesta tarefa: preparação e simulação local somente. Nenhum deploy, invocação remota, backfill ou escrita de produção.** A inspeção CLI usou exclusivamente `deploy --dry`, que não envia/cria deployment.

## POR QUE É O MAIS SEGURO DISPONÍVEL

Alternativas avaliadas na ordem solicitada:

1. Job administrativo existente: não encontrado. Não há workflow remoto configurado; os scripts administrativos encontrados executam localmente.
2. Função existente: não escolhida. Os caminhos CRM podem sincronizar/publicar dados, e o deployment existente não prova o motor novo.
3. Execução isolada sem HTTP: não foi identificado um runner já configurado que herde automaticamente os secrets protegidos deste projeto. Não presumimos essa capacidade de Sandbox/Workflow.
4. Função serverless temporária: escolhida com um único deployment não promovido.
5. Entrada HTTP temporária: necessária para invocar essa função; protegida na infraestrutura, sem endpoint adicionado ao fluxo normal.

O Vercel documenta deployments Production sem atribuição de domínio via `--skip-domain`, e funções prebuilt via Build Output API. A infraestrutura consultada tem `ssoProtection.deploymentType=all_except_custom_domains`, Fluid Compute e nenhuma definição de cron. Evidência sanitizada: `artifacts/commercial-audit-mechanism/platform.json`.

Fontes oficiais: [deployments pela CLI](https://vercel.com/docs/cli/deploying-from-cli), [primitivas Build Output API](https://vercel.com/docs/build-output-api/primitives), [Deployment Protection](https://vercel.com/docs/deployment-protection), [vercel curl](https://vercel.com/docs/cli/curl).

## ARQUIVOS

### Temporários — não fazem parte do motor nem das rotas públicas

Todos em `scripts/commercial-certification/`:

| Arquivo | Função |
|---|---|
| `prepare.cjs` | Gera offline o pacote prebuilt; coleta dependências locais por require; grava hashes e expiração |
| `verify.cjs` | Compara hashes do pacote/workspace e verifica rota única/ausência de estáticos |
| `preflight.cjs` | Consulta somente metadados Vercel e exige proteção adequada, zero cron e pacote válido |
| `handler.cjs` | Template sem rota na aplicação; verifica host, ambiente, método, origem e expiração; inicia filho |
| `worker.cjs` | Instala guard, carrega fontes, invoca auditor real, projeta/sanitiza saída; não grava arquivos |
| `guard.cjs` | Allowlist de rede, bloqueio de writes/transporte direto e contadores |
| `collect.cjs` | Adaptadores get/list; pipeline Datacrazy real; fontes Firestore e evidências explícitas SDR |
| `output.cjs` | Projeção mínima, métricas, classificação de diferenças e sanitização |
| `persist.cjs` | Programa local; sanitiza antes de salvar JSON/Markdown com permissão 0600 |
| `clean.cjs` | Remove apenas arquivos conhecidos do pacote gerado; recusa symlinks/arquivos desconhecidos |

Gerados: `.commercial-certification-bundle/.vercel/output/config.json` e exatamente uma função `functions/api/certify.func/`, com `index.js`, `.vc-config.json`, manifesto privado e 32 arquivos de dependência. Não existem arquivos em `output/static`. O pacote está gitignored. O manifesto completo com os hashes está em `artifacts/commercial-audit-mechanism/bundle-manifest.json`.

### Permanentes

**Nenhuma mudança permanente no motor comercial é necessária.** Esta documentação e as evidências podem permanecer como registro. A entrada temporária `.commercial-certification-bundle/` acrescentada a `.gitignore` pode ser removida ao encerrar o mecanismo. Foi criado `.vercelignore`, preservando as regras de ignore existentes e excluindo os scripts, testes/documentação e artifacts deste mecanismo de deployments normais; restaurar o estado anterior desse arquivo ao remover o mecanismo.

### Somente testes

`tests/commercial-certification-mechanism.test.js`: fixtures sintéticas e testes locais da fronteira de segurança/execução. Não é enviado no pacote remoto. Pode ser removido junto com os scripts temporários após a certificação e preservação das evidências.

### Runtime reutilizado, sem alterações nesta tarefa

`commercial-time`, `commercial-week`, `commercial-period`, `commercial-sales`, `commercial-reconciliation`, `commercial-sdr`, `commercial-goals`, `growth-people`, `crm-live`, `datacrazy-ingestion` e dependências reais. O auditor existente `scripts/reconcile-commercial-metrics.js` é importado como módulo, sem executar seu modo CLI de escrita local/exportação. Funções de publicação carregadas transitivamente ficam bloqueadas no filho. A lista exata, incluindo dependências transitivas de alterações concorrentes, consta no manifesto.

## ACESSO A SECRETS

Projeto: `prj_FcxsR8A6rXLVIo2DArdAFDlm7pq8`; team: `team_QFoYBpP3YUXGD4agYHZ7I6jV`.

O futuro deployment deve usar **Production**, porque `CRM_API_BASE_URL`, `CRM_API_KEY` e `GOOGLE_SERVICE_ACCOUNT_JSON` estão configurados nesse ambiente. Os valores são recebidos por `process.env` no servidor. Não existe env pull, secret no bundle, parâmetro de URL, header de autenticação caseiro ou cópia desses valores para o workspace.

O filho recebe somente essas três variáveis, mais marcadores não secretos de ambiente. Nenhum outro secret do projeto é encaminhado. Token OAuth é obtido em memória usando o helper real da conta de serviço. Conta de serviço de projeto diferente não permite acesso fora do endpoint Firestore fixado para `plataforma-space`; uma permissão insuficiente resulta em FAIL.

Não foi comprovado remotamente nesta tarefa que o deployment futuro terá esses valores: essa verificação ocorrerá na execução autorizada. Ausência gera FAIL com contadores zero antes da coleta.

## PROTEÇÃO DE ACESSO

Vercel Authentication na URL gerada é a autenticação principal. Permissão da aplicação — aluno, professor, Growth, Comercial ou admin da aplicação — não concede permissão Vercel. Operadores com acesso ao deployment/team ou ao bypass de infraestrutura já autorizado podem iniciar. Não se afirma exclusividade a uma única pessoa: detentores de bypass/compartilhamento Vercel também precisam ser considerados.

O handler exige POST no caminho exato, host igual à URL única do deployment, ambiente Production e expiração válida. Rejeita requisições com `Origin` de browser, GET, query string, host de domínio da aplicação e ambiente Preview. Não recebe configuração, IDs ou filtros do request. Não envia CORS permissivo. Respostas usam `no-store`.

**Não confiar somente nos checks do handler como autenticação.** Eles não substituem Vercel Authentication. O preflight verifica a configuração antes da implantação futura; depois dela é obrigatório testar acesso anônimo com GET (que nunca inicia coleta). Se a URL não estiver efetivamente protegida, não invocar e remover imediatamente o deployment.

Não criar Sharable Link ou exceção pública. A CLI `vercel curl` gerencia o bypass de Deployment Protection sem exigir imprimir/copiar o segredo. Não usar modo verbose nem registrar headers. Caso a CLI crie credencial adicional de bypass, identificar/remover somente essa credencial ao encerrar; nunca revogar um bypass preexistente compartilhado sem revisão.

## PROTEÇÃO READ-ONLY

**Camada 1:** o coletor recebe somente `get` e `list`, não Firestore SDK completo, writer, batch ou publisher. O Datacrazy usa exatamente `collectBusinesses`, sem serviço de sincronização/persistência de source snapshots. Mesmo chamadas indevidas a métodos como set/delete/batch no proxy lançam erro.

**Camada 2, no processo filho isolado:**

- fetch imutável com allowlist de GET para `/api/v1/businesses` e coleções Firestore necessárias;
- único POST permitido: endpoint OAuth Google, com grant de conta de serviço; não é escrita Firestore;
- PATCH/POST/DELETE Firestore e mutations CRM bloqueados antes do transporte;
- redirects de rede rejeitados;
- transportes HTTP/HTTPS/sockets diretos fora do fetch autorizado bloqueados;
- funções conhecidas de publish/sync/commit substituídas por erro;
- subprocessos adicionais, workers e gravações de arquivo bloqueados no filho;
- stdout/stderr do filho descartados; apenas IPC sanitizado retorna ao handler.

Contadores: `firestoreWritesAttempted`, `datacrazyMutationsAttempted`, `snapshotWritesAttempted`, além de `blockedRequests`. Qualquer tentativa bloqueada impede PASS, mesmo que não tenha havido write efetivo. Categorias podem se sobrepor, por exemplo um commit Firestore de snapshot; `writesAttempted` é a soma conservadora dos contadores de escrita, não um contador de requests únicos.

Essas são barreiras de código/processo sobre módulos auditados, **não IAM de leitura nem sandbox de sistema operacional contra código arbitrário malicioso**. A conta existente pode ter permissões maiores. Por isso o manifesto, o pacote imutável revisado, a proteção de infraestrutura e a ausência de inputs executáveis são requisitos. Se houver necessidade de garantia externa contra comprometimento do processo, será necessária uma identidade IAM read-only/proxy externo, fora desta preparação.

## OUTPUT

Raiz do JSON:

```text
certification, authenticatedSourceLoaded, firestoreLoaded, datacrazyLoaded,
financialDelta, dealIdDelta, duplicateRevenue, unallocatedRevenue,
sdrCertified, closerCertified, writesAttempted, counters,
source, months, snapshots, historicalTargets
```

Falhas antes do cálculo mantêm métricas desconhecidas como `null` e incluem código estático `failure`; não retornam message/stack de exceção. Timeout/saída abrupta sem relatório completo resultam em FAIL e contadores desconhecidos, `countersVerified=false`, nunca zero presumido.

`source`: páginas, páginas esperadas, registros carregados, retries, 429, completude e detalhes numéricos de Retry-After/wait por página. O mapa negócio→página aparece em `sourcePages` dos registros sanitizados.

Cada mês de julho/agosto/setembro:

```text
sourceDealCount, sourceRevenue, monthlyDealCount, monthlyRevenue,
weeklyDealCount, weeklyRevenue, monthlyWeeklyFinancialDelta,
monthlyWeeklyDealIdDelta, duplicateDealCount, duplicateRevenue,
unallocatedDealCount, unallocatedRevenue,
overlappingPeriods, duplicateAttributionRevenue
```

`sets`: source elegível à competência, canonicalMonthly, canonicalWeekly, crmLive, commercialGoals, storedSnapshot. Não se exporta a coleção bruta inteira. Registros contêm somente dealId, amount, revenueRecognitionTimestamp, month, week, status, closerId, sdrId e sourcePages; campos não fornecidos por uma visão ficam null. `comparisons` contém disponibilidade, pass, delta de IDs e classificações missing/extra/duplicated/wrong_week/wrong_amount/wrong_closer/wrong_sdr/wrong_status/wrong_revenue_timestamp. Campos sem evidência são `unverifiable`, nunca coincidência presumida.

SDR por mês:

```text
sdrTotalDeals, sdrAttributedDeals, sdrNoAttributionDeals,
sdrSourceErrorDeals, sdrNotLoadedDeals, sdrAttributionCoverage,
sdrSourceErrorRate, sdrAttributedRevenue, sdrNoAttributionRevenue,
sdrNotLoadedRevenue, sdrFinancialDelta, certified, records
```

Cada registro SDR tem dealId, state, amount, expectedSdrId, calculatedSdrId, eventId e timestamp. O adaptador só aceita ausência explícita `sdrId=null` como no_attribution; campo ausente não é ausência comprovada. Atribuição exige vínculo explícito deal→sdrEventId e evento com mesmo deal/ator, sem deletedAt. Não se infere origem a partir de vendedor, tags ou simples reunião. **Esse vínculo não foi comprovado na fonte real anterior:** se o schema real não o oferecer, retorna not_loaded e FAIL. Isso é uma limitação conhecida de evidência, não permissão para inventar vínculo.

Closer por mês:

```text
closerTotalDeals, closerAttributedDeals, closerOtherDeals,
closerUnassignedDeals, closerAttributedRevenue, closerOtherRevenue,
closerUnassignedRevenue, closerFinancialDelta, certified
```

Snapshots relevantes: snapshotId, scope, period, generatedAt, storedDealCount, storedRevenue, canonicalDealCount, canonicalRevenue, dealIdDelta, financialDelta, status. Estados: RECONCILED/STALE/INCOMPLETE/INVALID. Períodos não cobertos ou sem limites válidos ficam INVALID, sem cálculo parcial apresentado como completo. Comparação não modifica materialização; snapshots antigos divergentes continuam sinalizados.

`historicalTargets`: negócios observados em 11/08; semana 09–15/09 com referências anteriores 8385/12646/4261 e valores atuais; registros encontrados pelos números 11396/11296/8895/7580. Esses números são alvos de auditoria, nunca exceções no cálculo. `unresolvedBusinessNumbers` lista os não encontrados e impede PASS quando algum dos quatro alvos estiver ausente.

## SANITIZAÇÃO

A projeção não serializa inputs, headers, objetos de erro ou o resultado bruto do motor. Não inclui nomes, emails, telefones, endereços ou documentos pessoais. IDs e valores necessários ficam preservados.

Sanitização adicional rejeita chaves sensíveis/PII, strings com email, URL, JWT/Bearer, private key, caracteres/tamanho inesperados e valores iguais/contendo os secrets conhecidos. O token OAuth recém-obtido também entra na lista de rejeição em memória. Qualquer detecção produz FAIL, não um relatório parcialmente limpo com PASS.

Antes de IPC e HTTP há sanitização; o processo local repete a validação antes de persistir. Limite de 3 MB; excedê-lo gera FAIL sem retornar fonte bruta. `persist.cjs` escreve somente abaixo de artifacts, com flag `wx` para não sobrescrever relatórios. Nenhum header/log verbose deve ser anexado ao artifact.

## ROLLBACK / REMOÇÃO

O deployment não deve receber alias/domínio nem ser promovido. Não há rollback de dados: dados não são escritos. Se algo falhar, remover o deployment específico; a aplicação continua no deployment anterior.

Após uma chamada, remover imediatamente a URL temporária. Expiração local padrão: 30 minutos após gerar pacote, máximo 1 hora; depois disso o handler retorna 404 mesmo em nova instância. A flag de execução única é por processo: não há exactly-once distribuído sem gravação compartilhada. Não habilitar retries HTTP automáticos nem chamadas paralelas.

Provar remoção por: consulta do deployment removido/não disponível, GET da URL não executável, ausência de aliases atribuídos, aplicação ainda no alias anterior. Remover eventual bypass criado exclusivamente para esta execução. Limpar pacote via `clean.cjs`; depois retirar diretório temporário de scripts, teste específico e linha do gitignore, preservando relatório e manifesto.

## RISCOS RESIDUAIS

| Severidade | Risco | Controle/limite |
|---|---|---|
| Alta | Promover acidentalmente pacote incompleto ao domínio da aplicação | Comando fixo com --skip-domain; nunca promote/alias; revisão dos aliases antes/depois |
| Alta | Proteção Vercel ausente/exceção/bypass compartilhado indevido | Preflight + prova anônima após deployment; não invocar se falhar |
| Alta | Credencial administrativa com write e comprometimento arbitrário do processo | Guard não é IAM; somente código revisado/hash, processo separado, sem inputs executáveis |
| Média | Múltiplas instâncias/chamadas, 429 e custo | Uma chamada sem retry, janela curta, remoção; não há lease/write distribuído |
| Média | Dados mudam durante coleta entre Datacrazy e Firestore | Metadados de coleta, validação de completude; não promete snapshot transacional entre sistemas |
| Média | Vínculo SDR insuficiente na origem | not_loaded e FAIL explícitos; não presumir ausência |
| Média | 300s, payload/memória insuficientes | Budget de coleta, timeout do filho 280s, limite 3 MB; FAIL sem resultado parcial |
| Baixa | Exposição de IDs operacionais a quem tem bypass | Relatório mínimo, proteção Vercel, retenção local restrita |

## TESTES E VALIDAÇÃO DESTA PREPARAÇÃO

**27 testes específicos aprovados, zero falhas**: API read-only; Firestore/mutations/snapshot bloqueados antes da rede; transporte direto; sanitização secret/PII; host/ambiente/expiração/origin; credencial ausente; coleta incompleta antes de Firestore; filho com env mínimo; execução por instância; simulação completa do worker com collector, OAuth, adaptador Firestore e motor reais.

Somente transporte/OAuth/dados externos foram simulados na prova completa. O teste usa chaves RSA efêmeras de teste em memória; nenhuma credencial real. A preparação não realizou auditoria remota.

O verificador também detectou alteração concorrente em `student-lifecycle.js` após uma geração e recusou o pacote, como esperado; foi necessária nova preparação.

Suíte completa observada: **439 testes, 432 aprovados, 6 ignorados, 1 falho**. A falha está em `tests/attendance-api.test.js`, expectativa `attendance_staging_not_verified` versus `attendance_environment_production_authorization_required`, associada a alterações concorrentes fora do mecanismo. Não foi alterada nesta tarefa. Não se afirma que a suíte completa está verde.

Bundle: 32 arquivos de dependência, hashes iguais ao workspace na verificação; inventário `deploy --dry --prebuilt --prod --skip-domain` concluído com exit code 0, sem upload/deployment. Isso verifica preparação e inventário, **não substitui aceitação/execução real pela plataforma**.

## PRÓXIMO PASSO — SOMENTE APÓS AUTORIZAÇÃO

Comandos a executar na raiz do projeto; **os comandos abaixo de deployment/chamada/remoção remota não foram executados**.

1. Regenerar pacote com janela nova, verificar hashes e proteção:

```sh
node scripts/commercial-certification/clean.cjs
node scripts/commercial-certification/prepare.cjs
node scripts/commercial-certification/preflight.cjs
```

Se preflight falhar, parar. Registrar o deployment atualmente associado ao domínio principal. Se houver cron novo no projeto, parar e revisar isolamento.

2. Implantar **apenas o pacote prebuilt**, não a raiz da aplicação:

```sh
vercel deploy --prebuilt --prod --skip-domain --cwd .commercial-certification-bundle --scope team_QFoYBpP3YUXGD4agYHZ7I6jV
```

Guardar a URL única retornada em `AUDIT_DEPLOYMENT_URL` (não contém secret). Confirmar ausência de aliases e proteção. Antes de invocar, fazer GET anônimo, sem seguir redirects e sem imprimir headers:

```sh
curl --silent --output /dev/null --write-out '%{http_code}' "$AUDIT_DEPLOYMENT_URL/api/certify"
```

Esperado bloqueio de infraestrutura (login/401/403/redirect de autenticação). Se a resposta chegar ao handler, inclusive 404 do handler, **não chamar POST**: remover e revisar proteção.

3. Uma única chamada protegida, sem retry, para o deployment explícito, salvando só após sanitização local:

```sh
vercel curl /api/certify --deployment "$AUDIT_DEPLOYMENT_URL" --cwd .commercial-certification-bundle --scope team_QFoYBpP3YUXGD4agYHZ7I6jV -- --request POST --retry 0 --max-time 290 --silent --show-error --fail | node scripts/commercial-certification/persist.cjs artifacts/commercial-production-certification-YYYY-MM-DD
```

Substituir a data pelo dia real. Não usar `-v`, `--verbose`, `-i` ou salvar headers. Erro HTTP/parser/sanitização não deve produzir certificado. Resultado FAIL deve ser preservado como FAIL, sem repetição automática.

4. Remover o deployment específico, conferir a remoção e preservar os artifacts sanitizados:

```sh
vercel remove "$AUDIT_DEPLOYMENT_URL" --scope team_QFoYBpP3YUXGD4agYHZ7I6jV --yes
node scripts/commercial-certification/clean.cjs
```

Não remover projeto, deployment principal ou secrets preexistentes. Nenhuma autorização para deploy/backfill da feature está implícita na aprovação deste mecanismo temporário.
