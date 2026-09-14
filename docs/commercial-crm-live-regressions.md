# Comercial / CRM Live: investigação e correção

## Evidências e limites da investigação

A investigação rastreou o código da listagem, modal, API de metas, API do CRM Live, eventos, cache, integração DataCrazy e espelho Supabase. Não houve alteração de dados de produção.

Não foi possível consultar os registros reais: `GOOGLE_SERVICE_ACCOUNT_JSON`, `CRM_API_KEY` e `CRM_API_BASE_URL` estão vazios nos arquivos locais de ambiente. A consulta de leitura ao Supabase configurado retornou 404 para `public.datacrazy_businesses`. A semana do exemplo relatado também não foi informada.

Portanto, **não foram identificados os negócios reais que compõem R$ 12.650 nem comprovada a decomposição real da diferença de R$ 4.250**. Os testes equivalentes abaixo são sintéticos e não devem ser tratados como uma auditoria dos clientes da plataforma.

## 1. Nomes internos e SDR ausente

`/api/crm-live-data` chama `loadGrowthPeople`, que antes lia somente `growthPeople`. A correção anterior havia alterado apenas o carregamento do modal em `/api/growth-dashboard?api=growth-goals&includePeople=1`.

O modal podia salvar metas usando o UID de um usuário sem configuração comercial. No CRM Live, `summarizeWeeklySdrProgress` criava linhas a partir das chaves da meta, e `attachPersonMeta` usava `personId` como nome quando não encontrava a pessoa. Isso explica estruturalmente os UIDs exibidos e a ausência do nome real do usuário. Havia ainda um limite de cinco linhas no frontend.

Agora os dois fluxos usam `buildActiveCommercialPeople`: usuários reais do Comercial, `ativo !== false`, nome do cadastro e vínculo por UID ou e-mail legado confiável. Configurações do mesmo usuário são reconciliadas como aliases; nomes iguais não são usados para fundir pessoas. Metas em UID e em personId são reconciliadas antes da aplicação da precedência global → competência → semana. O papel efetivo vem dessa configuração do período. Participantes com meta configurada e resultado zero continuam presentes. Órfãos, inativos e cadastros sem nome válido não criam linhas de ranking.

O ranking passou a disponibilizar todas as linhas retornadas pelo backend, com rolagem quando necessário. Caches de versões anteriores do modelo deixam de ser reutilizados, inclusive como fallback em caso de falha.

## 2. Outros

O filtro introduzido anteriormente partia corretamente de `users`, mas removeu também o bucket sintético `outros`.

`getGrowthGoalBuckets` agora fornece esse bucket separadamente em `goalBuckets`. O modal mostra uma seção de meta não atribuída, fixa o papel Closer e reutiliza a configuração já salva para a semana/competência. O backend também força Closer para esse bucket, independentemente do valor enviado pelo cliente.

O bucket não pertence à lista de usuários, não é SDR e não cria documento em `users` ou `growthPeople`. A abertura do modal continua somente leitura. O POST existente salva pessoas e bucket, preservando metas ocultas e outras semanas. A meta da equipe mantém a precedência do `teamTarget` explícito já existente; sem ele, soma as metas individuais dos closers e de Outros.

## 3. Realizado semanal

Fluxo anterior: `/api/crm-live-data` → `buildCrmLiveCrmSlice` → `buildWeeklyGoalsReadModel` → soma das linhas dos closers em `buildWeeklyTeamSummary`.

Foram confirmados no código três mecanismos de exclusão:

- A venda não era contabilizada se o bucket do responsável não possuísse linha na meta, inclusive `outros`.
- O cálculo semanal usava somente `lastMovedAt`, enquanto o dashboard já priorizava data de fechamento.
- A consulta do CRM Live filtrava previamente por movimentação recente, podendo nem carregar uma venda com fechamento no período e movimentação antiga/ausente. A semana também fixava o pipeline Conversão, enquanto o dashboard usava a preferência Funil principal com fallback Conversão.

`commercial-sales.js` centraliza a seleção e soma. O total financeiro é independente dos participantes, metas e vínculos. O ranking apenas distribui o resultado; vendas sem pessoa elegível vão para Outros.

Regras preservadas do dashboard:

- Estágio financeiro: `Fechado`; o status `won` sozinho não substitui essa regra.
- Pipeline: Funil principal quando presente no conjunto consultado; caso contrário, Conversão.
- Data: `wonAt`, `wonDate`, `gainedAt`, `gainAt`, `soldAt`, `soldDate`, `saleAt`, `closedAt`, `finishedAt`, `statusChangedAt`, `stageChangedAt` e, por último, `lastMovedAt`.
- Período inclusivo em America/Sao_Paulo; semana comercial calculada pelo helper existente.
- Valor: `getDealValue`, que usa `total`/`value` positivo e mantém os fallbacks de ticket por produto ou geral existentes. Esses fallbacks não foram alterados.
- Cada negócio identificado entra uma vez. Negócios sem identificador, fora do período, fora do pipeline ou sem fechamento válido são discriminados pela auditoria.

As consultas financeiras ao espelho incluem negócios fechados mesmo sem movimentação recente. Na integração legada, a leitura financeira omite o filtro restritivo de movimentação e usa paginação; a janela e os fechamentos são selecionados localmente. Essa leitura pode carregar mais dados do que antes. O histórico carregado é reutilizado na comparação mensal para evitar uma segunda leitura equivalente.

Dashboard, resumo mensal/semanal do CRM Live, comparação mensal e total do detector de eventos reutilizam a soma compartilhada. O cursor de novas notificações continua seguindo o fluxo de movimentações existente. Na virada do mês, a configuração semanal é carregada da competência em que a semana começa.

## 4. Negócios faltantes e auditoria

Fixture sintético dos testes, na semana de 09 a 15/09/2026:

| Identificador de teste | Valor | Exclusão reproduzida no código anterior |
| --- | ---: | --- |
| fixture-configured | R$ 8.400 | Nenhuma |
| fixture-unmapped | R$ 2.250 | Responsável sem vínculo e sem linha de Outros na meta |
| fixture-closing-date | R$ 2.000 | Fechamento dentro da semana, movimentação anterior à semana; sem linha correspondente na meta |
| Total | R$ 12.650 | R$ 4.250 recuperados no cenário sintético |

Para identificar os registros reais, executar a ferramenta somente leitura com um export do período informado:

```sh
node scripts/audit-commercial-closings.js /caminho/snapshot.json
```

Formato do snapshot: `{ "now": "data do exemplo", "users": [], "growthPeople": [], "goal": {}, "globalConfig": {}, "businesses": [] }`. Metas podem usar a representação já decodificada da API ou seus mapas de configuração. A saída discrimina cada venda, data utilizada, valor, bucket anterior e motivo da exclusão anterior. A ferramenta não faz requisições nem grava dados.

## 5. Arquivos alterados

- `api/_lib/growth-people.js`: identidade, nomes, aliases, bucket e participantes por papel/período.
- `api/_lib/commercial-sales.js`: seleção, deduplicação e soma de fechamentos.
- `api/_lib/crm-live.js`: fonte de usuários, total independente do ranking e competência semanal.
- `api/_lib/datacrazy-mirror.js`: consultas financeiras incluem fechamentos sem movimento recente.
- `api/growth-dashboard.js`: regra financeira compartilhada e bucket separado no modal.
- `api/crm-live-data.js`: invalidação de caches incompatíveis.
- `api/crm-live-events.js`: total do detector usa os mesmos fechamentos.
- `api/crm-live.js`: ranking sem truncar após a quinta pessoa.
- `script.js`: seção separada para Outros, papel fixo e preservação dos inputs.
- `scripts/audit-commercial-closings.js`: auditoria somente leitura de exports.
- `tests/growth-goals-people.test.js` e `tests/commercial-regressions.test.js`: regressões de usuários, metas, ranking, API, datas e valores.
- Este relatório.

## 6. Validação

- Suíte relacionada: 97 testes passaram, nenhum falhou.
- Suíte completa: 246 testes, 243 passaram, dois foram ignorados e um falhou no teste preexistente `retention-store-provisioning.test.js`, que espera agosto e recebe setembro. O mesmo problema já foi reproduzido no código original na investigação anterior.
- Verificações de sintaxe e `git diff --check`.
- Testes do modal usam um adaptador DOM e executam o código do modal; testes de APIs usam fontes simuladas. Não representam uma validação visual ou financeira em produção.

## 7. Dados legados

Não foram apagados, migrados ou alterados registros históricos. Quando o export real estiver disponível, revisar configurações sem vínculo confiável, metas em aliases distintos com valores conflitantes e cadastros cujo nome contenha um identificador/e-mail. A ferramenta lista candidatos para revisão; um vínculo não resolvido pode corresponder a usuário inativo e não deve ser automaticamente excluído. Qualquer migração deve preservar as competências e exigir identidade comprovada.
