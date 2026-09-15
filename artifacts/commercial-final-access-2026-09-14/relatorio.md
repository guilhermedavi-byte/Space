# Último gate — acesso autenticado a Comercial > Metas

## RESULTADO

**FAIL — autenticação necessária não disponível para executar o motor local.** Nenhuma alteração funcional, novo teste, deploy, backfill ou escrita de produção foi realizada nesta etapa. A ausência de dados permanece explícita; nenhum replay foi usado como certificação real.

## AUTENTICAÇÃO

- Datacrazy: **FAIL para execução autenticada local**.
- Firestore: **FAIL para execução autenticada local**.
- Secrets expostos: **NÃO**.
- Writes de produção executados: **0**.

### Vercel: teste efetivo, não apenas leitura de arquivos antigos

Projeto: `space` — `prj_FcxsR8A6rXLVIo2DArdAFDlm7pq8`.

Scope/team: `team_QFoYBpP3YUXGD4agYHZ7I6jV`, conforme vínculo `.vercel/repo.json` e consulta autenticada HTTP 200.

| Variável | Production | Preview | Development | Disponível para executar localmente |
|---|---|---|---|---|
| `CRM_API_BASE_URL` | SIM, sensitive | SIM, sensitive | NÃO | NÃO; pull retorna vazio |
| `CRM_API_KEY` | SIM, sensitive | SIM, sensitive | NÃO | NÃO; pull retorna vazio |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | SIM, sensitive | NÃO | NÃO | NÃO; pull de Production retorna vazio |

Executei **`vercel env pull` nos três ambientes**, com project/team explícitos. Os três comandos retornaram exit code 0: a autenticação permite o pull, mas ele não entrega valores utilizáveis dessas variáveis. Isso não prova que os valores usados pelo servidor estejam vazios; prova que o pull local não os disponibiliza. Não tentei contornar a proteção `sensitive`.

O inventário completo dos nomes, tipos e ambientes das 47 entradas retornadas está em `vercel-environments.json`, sem valores. O resultado de cada pull está em `environment-pull.json`. Os arquivos temporários de environment foram criados sob regra gitignore, com umask restritivo, lidos sem logs de valores e removidos no bloco de limpeza. Não há caminho nem conteúdo desses arquivos neste relatório.

### Firestore

A configuração Firebase CLI existe. Uma nova tentativa de usar essa identidade foi rejeitada antes de conseguir a leitura do documento de metas. Resultado seguro em `firestore-access.json`: `identityValid=false`, `readable=false`. Não foi alterada/renovada a credencial nesta tarefa.

Não apareceram aliases locais utilizáveis `FIREBASE_SERVICE_ACCOUNT_JSON`, `GOOGLE_CLIENT_EMAIL`/`GOOGLE_PRIVATE_KEY` nos pulls. A conta de staging, quando configurada em Preview, não foi usada para acessar produção.

### Scripts e execução remota

Os scripts de auditoria existentes são locais: usam export fornecido ou a autenticação administrativa do mesmo ambiente. Não fornecem um runner remoto com as credenciais do servidor. A árvore inspecionada não contém `.github/workflows`; `package.json` oferece testes e verificações de sintaxe. A configuração de rotas/serviços e a documentação de pipeline não demonstraram um mecanismo existente para executar arbitrariamente o código novo no servidor em modo read-only.

Não acionei endpoints que possam sincronizar cache ou publicar snapshots. Não chamei o deployment antigo para certificar o algoritmo novo. Não procurei segredos em histórico Git. Supabase não foi usado nem consultado como fallback nesta etapa.

## FONTE REAL

| Métrica | Resultado desta tentativa |
|---|---|
| Páginas Datacrazy coletadas | Não iniciado |
| Deals carregados | Não carregados; quantidade real desconhecida |
| Completude | Não comprovada |
| Erros de coleta / 429 / Retry-After | Não avaliados; nenhuma coleta autenticada iniciada |
| Retries de coleta | Não executados |
| Proveniência por página | Não disponível sem coleta |

Não registrar `deals=0` como se a fonte estivesse vazia: o estado correto é **not_loaded**.

## JULHO

Monthly revenue, weekly revenue, financial delta, dealId delta, duplicate revenue, unallocated revenue e snapshot status: **indisponíveis para certificação autenticada**.

## AGOSTO

As mesmas métricas permanecem indisponíveis. Os dealIds dos três negócios anteriormente associados aos R$ 2.728 não foram obtidos. A regra de calendário já testada não substitui a prova sobre os IDs reais do dia 11; **o gate de produção permanece FAIL**.

## SETEMBRO

As mesmas métricas permanecem indisponíveis para certificação autenticada. Não se reapresenta R$ 28.188 como resultado de uma coleta nova que não ocorreu.

## 09–15/09

Referência **da auditoria anterior**, sem nova leitura: stored snapshot R$ 8.385; replay canônico R$ 12.646; diferença R$ 4.261. A classificação STALE foi demonstrada na etapa anterior sobre essas observações.

Nesta etapa não foram obtidos os UUIDs, timestamps brutos ou estados SDR reais de #11396, #11296, #8895 e #7580. Portanto, resultado atual autenticado e classificação do snapshot atual: **não certificados**. Não se presume que o snapshot atual ainda tenha o mesmo valor.

A definição definitiva do Revenue Recognition Timestamp na origem — inclusive o ganho de R$ 961 após a movimentação anterior — continua dependente desse export real. Nenhuma nova escolha de campo ou alteração do motor foi feita para compensar a ausência de evidência.

## CLOSER

Coverage, unassigned revenue, Outros e financial reconciliation delta reais: **indisponíveis**. A regra local preservando os R$ 3.300 de Felipe continua documentada na etapa anterior, mas não recebeu nova certificação transacional. **FAIL**.

## SDR

Coverage, source error rate, no-attribution revenue, not-loaded revenue e reconciliation delta reais: **indisponíveis**. A fonte não foi carregada. Não transformar falta de autenticação em source error rate 0%, no_attribution ou realizado zero. **FAIL**.

## SNAPSHOTS

| Competência/semana | Stored atual | Canônico autenticado | Delta atual | Status de certificação |
|---|---:|---:|---:|---|
| Julho/2026 | Não lido | Não calculado | — | Não carregado |
| Agosto/2026 | Não lido | Não calculado | — | Não carregado |
| Setembro/2026 | Não lido | Não calculado | — | Não carregado |
| 09–15/09 | Não lido | Não calculado | — | Não carregado |

RECONCILED/STALE/INCOMPLETE/INVALID classificam um snapshot disponível para análise. Sem leitura atual, não atribuí um desses estados arbitrariamente.

## BACKFILL NECESSÁRIO

**Não determinado nem executado.** O usuário condicionou o plano definitivo à certificação aprovada. A semana 09–15/09 é candidata conhecida pela evidência anterior, mas o valor atual, os IDs afetados e os demais snapshots históricos precisam ser lidos antes de fechar o plano. Não foi preparada uma lista fictícia de atualizações.

## TESTES

**Nenhum teste reexecutado nesta etapa:** não houve certificação real concluída, alteração funcional ou bug novo revelado. Último resultado previamente entregue: 385 testes, 380 aprovados, 5 ignorados, 0 falhos; 173 relacionados aprovados; 49 do motor; 64 explicitamente auditados exercitando runtime. Esses números são referência anterior, não execução nova.

## PRODUÇÃO

Contadores das ações realizadas **por esta tentativa**, antes e depois:

```text
Firestore writes = 0
Datacrazy mutations = 0
Snapshot writes = 0
Production deploys = 0
```

Foram executadas consultas de configuração Vercel/pull e tentativa de autenticação Firebase. Não foi executada a coleta financeira, publicação, backfill, migration ou endpoint com efeitos de sincronização. Os contadores não pretendem representar atividades globais de outros operadores da plataforma.

## VEREDITO E AÇÃO HUMANA MÍNIMA

**APTO PARA DEPLOY CONTROLADO = NÃO.**

O responsável que possui os valores originais precisa disponibilizar, por canal seguro no ambiente autorizado de execução deste workspace:

1. `CRM_API_BASE_URL` e `CRM_API_KEY` válidos para a leitura de produção Datacrazy;
2. `GOOGLE_SERVICE_ACCOUNT_JSON` de identidade autorizada a ler o Firestore de produção, ou uma identidade equivalente válida adaptada ao coletor.

Não enviar esses valores no chat. Reautenticar apenas o Vercel CLI **não resolve**: o pull já está autorizado e os valores sensíveis não são entregues. Reautenticar apenas o Firebase também **não resolve o acesso Datacrazy**.

Se os valores originais só existem no runtime protegido do Vercel e não podem ser disponibilizados legitimamente, a alternativa mínima exige **autorização humana prévia para uma execução administrativa isolada**: runner/job privado com o código novo, credenciais existentes e bloqueio de operações de escrita, produzindo um export mínimo por dealId para cálculo local ou o relatório do mesmo motor. Isso não é um mecanismo existente comprovado neste projeto; precisa ser definido e autorizado antes de ser criado/executado. Não fiz deploy nem criei essa execução remota automaticamente.

Após disponibilizar o acesso legítimo, a próxima etapa é exclusivamente fonte real → motor novo → reconciliação; a feature pública e os snapshots permanecem sem alteração durante a certificação.
