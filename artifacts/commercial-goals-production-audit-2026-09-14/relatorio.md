# Auditoria de produção — Comercial > Metas

## RESULTADO: FAIL

**É seguro fazer deploy da funcionalidade Comercial > Metas agora? NÃO.**

O mensal de setembro fecha com os negócios observados, mas há divergência semanal no snapshot persistido, sobreposição real do calendário de agosto e lacunas de integração que impedem aprovar a validação solicitada. FAIL é o resultado do gate de auditoria; não significa que todos os cálculos da implementação estejam errados.

Auditoria em **14/09/2026**, concluída aproximadamente às 21h10, America/Sao_Paulo. Snapshot de referência: `2026-09-14T23:02:50.843Z` (20h02 local). Fontes mudam independentemente desta auditoria: não foi obtido um snapshot transacional simultâneo dos três serviços.

**Nenhum dado de produção alterado por esta tarefa. Nenhum deploy executado.** Foram lidos consoles autenticados e metadados. Nenhum formulário de produção salvo. Endpoints capazes de renovar/gravar snapshots não foram executados. Nenhum patch de produto aplicado nesta auditoria.

## PRODUÇÃO

| Competência | Período comercial salvo | Meta | Realizado observado | Atingimento | Ganhos |
| --- | --- | ---: | ---: | ---: | ---: |
| Setembro/2026 | 01–30/09 | R$ 60.000,00 | R$ 28.188,00 | 46,98% | 26 |
| Agosto/2026 | **02–31/08** | R$ 70.000,00 | R$ 50.320,00 | 71,8857% | 44 |
| Julho/2026 | **01/07–01/08** | R$ 60.000,00 | R$ 56.173,00 | 93,6217% | 54 |

Setembro: **8 comerciais ativos**, 3 usuários comerciais inativos excluídos. “Outros” é um agrupamento, não uma nona pessoa. Três responsáveis têm ganhos no mês: Luis Eduardo, Matheus Afonso e Felipe Santos. Ticket geral R$ 1.084,15; falta R$ 31.812,00. Os totais históricos foram somados linha a linha no Datacrazy; não certificados por UUID contra a API de management.

## 1. Fontes e regras encontradas

| Dado/regra | Fonte real e código |
| --- | --- |
| Meta mensal | Firestore `growthGoals/{YYYY-MM}.valorMeta`; documentos 2026-07, 08 e 09 lidos. |
| Competência | ID e campo `competencia` no formato `YYYY-MM`. Período pode diferir do calendário por `periodStart`/`periodEnd`. |
| Metas semanais | `growthGoals/{competencia}.weeklyGoals.wk_YYYY-MM-DD`. Setembro usa `individualMonthlyGoals`; agosto mistura esse mapa e o array legado `people`. O nome individualMonthlyGoals **não prova meta financeira mensal individual**: nesse local representa configuração da semana. |
| Padrões | Código lê `growthConfig/crmLiveDefaults.defaultWeeklyConfig`, depois padrão da competência e override semanal. A coleção growthConfig não apareceu na listagem raiz; nenhum padrão global foi comprovado por GET autenticado. Replay utiliza ausência de padrão, coerente com o documento e cache observados; esse limite permanece explícito. |
| Pessoas | `users` determina elegibilidade: tipo/role/type/perfil normalizado `growth`; `ativo !== false`. Projeção DOM da página Comercial > Usuários trouxe 11 registros. |
| Identidades e funções | `growthPeople` complementa `users` por UID e, no legado sem UID, e-mail confiável. Cinco configurações de pessoas ligadas a usuários reais + registro agregado Outros. Sem vinculação por simples nome. `buildActiveCommercialPeople`, em `api/_lib/growth-people.js`. |
| SDR/Closer | Papel salvo na semana tem precedência no cálculo semanal; fallback de configuração atual. Pessoas sem papel podem aparecer no drawer como SDR por fallback do código, sem prova de função histórica. |
| Realizado mensal | `buildCommercialGoalsModel` chama `buildMonthSummary`; este chama `summarizeClosedSales`, também usado pelo CRM Live. Não há uma fórmula mensal independente. |
| Fonte de negócios | Datacrazy. Código local atual usa `getCompleteCrmSource` e manifests/chunks Firestore; snapshot de CRM Live lido diretamente em `crmLiveCache/crm`. A nova origem não foi executada contra produção nesta tarefa. |
| Filtro de vendas | ID obrigatório; pipeline Funil principal se existir no conjunto, senão Conversão; etapa normalizada Fechado; data de ganho/fechamento válida dentro do intervalo inclusivo em São Paulo; deduplicação por ID. Não há exclusão da receita geral por usuário inativo ou desconhecido. |
| Data de venda | Prioridade: wonAt, wonDate, gainedAt, gainAt, soldAt, soldDate, saleAt, closedAt, finishedAt, statusChangedAt, stageChangedAt, lastMovedAt. Criação não determina a venda. |
| Valor | `_lib/forecast-service.js:getDealValue`: total/value positivo; se ausente/zero/negativo usa ticket de produto ou fallback 1057. Não foi observado ganho zero nos 124 ganhos dos três recortes. |
| Outros | Vendas sem closer elegível/configurado, inclusive as de Felipe com papel SDR, são atribuídas ao agrupamento. Mantêm responsável no breakdown. |
| SDR realizado | `sdrActivityEvents`, tipo meeting, outcome show, dentro da semana, não deletado, identidade UID/e-mail. Eventos não extraídos nesta auditoria: realizado e atingimento SDR **não validados**. |
| Meta da equipe | teamTarget positivo explícito/herdado; sem ele, soma metas dos closers e Outros. Metas SDR são quantidades, nunca somadas a reais. |
| Semana | Quarta–terça; exceção 11–18/08/2026. Vínculo ao mês de início; intervalos completos. Problema de sobreposição descrito em P1-02. |
| Histórico | Competência anterior é read-only na UI e no POST. O cadastro de pessoas consultado é o atual, sem snapshot histórico de elegibilidade. Configurações semanais explícitas preservam papel salvo. |

Referências locais: `api/_lib/commercial-goals.js`, `api/_lib/commercial-sales.js`, `api/_lib/commercial-period.js`, `api/_lib/commercial-week.js`, `api/_lib/growth-people.js`, `api/_lib/crm-live.js`, `api/growth-dashboard.js`, `commercial-goals.js`.

## 2. Pessoas e metas de setembro

**Não existe meta mensal financeira individual separada nas fontes auditadas.** Assim, meta mensal individual, atingimento mensal individual e diferença mensal individual versus semanas são N/A para todos. A soma semanal abaixo não foi renomeada como meta mensal. “—” é configuração ausente, diferente de zero explícito. Semanas 16–22/09, 23–29/09 e 30/09–06/10 não estão configuradas para ninguém.

| userId | Nome | Papel/origem | Status | 02–08/09 | 09–15/09 | Soma semanas salvas |
| --- | --- | --- | --- | --- | --- | --- |
| kwfTVEVa8gYUnQM0IK0DIzIneUR2 | Ayres André | sdr | Ativo | 35 | 30 | 65 |
| i17smULTFHh9dAjEicoBsv3Cz7s2 | Felipe Santos | sdr | Ativo | 25 | 20 | 45 |
| AQtLQSgx4xP3oZAzkOF4znUxO5f1 | Guilherme Davi | não comprovado no cadastro; SDR salvo em 09–15 | Ativo | — | 0 | 0 |
| Iu45TJz4zbfezGYpgZnfzYwEW4Z2 | Luana Mendonça | sdr | Ativo | 25 | 20 | 45 |
| wK6aokqvdIQpYetQ49xPohunMK53 | Luis Eduardo | closer | Ativo | 9000 | 9000 | 18000 |
| hTbH5IuPzNW4rLiR851Uh7R6F6E3 | Luis Eduardo Ferreira Jorge | não auditado | Inativo/excluído | — | — | — |
| LafuFrHf9XanTC9SRniRMV2aJbN2 | Luis Perdigão | não comprovado no cadastro; SDR salvo em 09–15 | Ativo | — | 20 | 20 |
| RBxojfKaYEcoUNtWgoLxEH1Webb2 | Matheus Afonso | closer | Ativo | 9000 | 9000 | 18000 |
| egJKI57bbnYqFi0WTeRB1uVfHev2 | Tarcísio Filho | não auditado | Inativo/excluído | — | — | — |
| uzxsw8oMZafKa6kSCKRdl4x00Rv1 | Tarcísio Filho | não auditado | Inativo/excluído | — | — | — |
| XA9g1pzEYQgD3i9C5NzZguFSVK32 | Tarcísio Gomes | não comprovado no cadastro; SDR salvo em 09–15 | Ativo | — | 0 | 0 |

Origens: IDs, nomes e ativo do DOM de `users`; papéis base de `growthPeople`; papéis e metas por semana dos mapas Firestore. Guilherme, Luis Perdigão e Tarcísio Gomes não têm documento complementar em growthPeople, mas são usuários ativos reais e têm papel SDR salvo na segunda semana. Os três inativos são excluídos pelo cadastro atual, não por ausência de meta. Não foi inferida função histórica para eles.

Outros: meta 2.000 em 02–08/09, entrada **ausente** em 09–15/09 (valor efetivo 0), soma 2.000. Não tem userId.

### Receita por responsável real — setembro

| Responsável | Realizado BRL | Negócios | Ticket BRL | Atingimento mensal individual |
| --- | --- | --- | --- | --- |
| Matheus Afonso Rodrigues | 10.725,00 | 9 | 1.191,67 | N/A — sem meta mensal individual |
| Luis Eduardo | 9.951,00 | 9 | 1.105,67 | N/A — sem meta mensal individual |
| Felipe Santos | Space | 7.512,00 | 8 | 939,00 | N/A — sem meta mensal individual |

Demais cinco comerciais ativos: nenhum ganho atribuído na lista de setembro; receita 0 e quantidade 0 neste recorte; ticket N/A. Isso **não** implica zero de reuniões/atividade SDR. Não se somam novamente as vendas de Felipe quando apresentadas no agrupamento Outros.

### Semana 09–15/09 — atribuição financeira do helper atual

| Agrupamento | Meta BRL | Realizado BRL | Ganhos | Ticket BRL | Atingimento |
| --- | --- | --- | --- | --- | --- |
| Luis Eduardo | 9.000,00 | 5.471,00 | 5 | 1.094,20 | 60.7889% |
| Matheus Afonso | 9.000,00 | 3.875,00 | 3 | 1.291,67 | 43.0556% |
| Outros | 0,00 | 3.300,00 | 3 | 1.100,00 | N/A matemático; API retorna 0% |

Total da semana: meta 18.000, realizado 12.646, 11 negócios, 70,2556%, falta 5.354. Outros contém três vendas de Felipe. A ausência de meta em Outros não pode excluir receita.

Planejamento: duas semanas definidas, 20.000 + 18.000 = **38.000**; diferença para meta mensal **22.000**. A primeira semana realizou **13.237**, 13 negócios. As duas vendas de 01/09 (2.305) pertencem ao mensal de setembro e à semana iniciada em agosto; por isso o mensal não é a soma das linhas semanais de setembro.

## 3. RECONCILIAÇÃO A / B / C

| Comparação | Mensal setembro | Semana 09–15/09 | Evidência |
| --- | ---: | ---: | --- |
| A — helper de management local | 28.188 / 26 | 12.646 / 11 | Executado com transcrição real normalizada. **Não** é resposta da API autenticada de produção. |
| B — helpers atuais do CRM Live | 28.188 / 26 | 12.646 / 11 | Mesmo conjunto transcrito. Diferença A–B: **0 / 0%**. Não certifica ingestão/HTTP. |
| B — snapshot persistido de produção | 28.188 / 26 | **8.385 / 7** | `crmLiveCache/crm` às 20h02. |
| C — ganhos Datacrazy observados | 28.188 / 26 | **12.646 / 11** | 26 linhas e 26 fichas individuais. |

Mensal cache–fonte: **R$ 0,00 / 0%**. Semanal cache abaixo da fonte em **R$ 4.261,00**, ou **33,6944% do realizado real**; inversamente, a fonte é 50,8169% maior que o cache. O atingimento passa de 46,5833% para 70,2556%, diferença de 23,6722 pontos percentuais.

### Negócios que explicam a diferença semanal

| Número real Datacrazy | Nome | Responsável | Valor BRL | Ganho local | Status/pipeline | Motivo identificado |
| --- | --- | --- | ---: | --- | --- | --- |
| #11396 | Samuel Luiz da Silva | Felipe Santos | 1.275,00 | 10/09/2026 | Ganho / Conversão | Venda do SDR deve integrar receita geral e Outros; cache tem somente Luis e Matheus. |
| #11296 | Michael | Felipe Santos | 1.075,00 | 09/09/2026 | Ganho / Conversão | Mesmo caso; incluído pelo helper atual em Outros. |
| #8895 | Maikel Alvarenga | Felipe Santos | 950,00 | 11/09/2026 | Ganho / Conversão | Mesmo caso; criado em julho, ganho em setembro. |
| #7580 | Eduardo Nunes Moreira | Luis Eduardo | 961,00 | 09/09/2026 | Ganho / Conversão | Histórico observado mostra restauração em 08/09 e ganho em 09/09; usar movimento anterior desloca a venda para a semana errada. |

Origem de todas as quatro: Datacrazy, linha do Dashboard e ficha Informações do Negócio. Os números acima não são UUIDs da API. UUID bruto indisponível para estes quatro. Eduardo foi criado em 29/05; a data de criação também não justifica excluir a venda de setembro.

**Limite causal:** a diferença de 4.261 fecha exatamente com as quatro vendas e com os valores por responsável. O payload bruto consumido pelo cache não foi exportado; não é possível provar nesta tarefa, para cada UUID, qual campo o produtor antigo efetivamente escolheu. O diagnóstico prévio em `/tmp/space-production-audit.y2hm4M/diagnostico/auditoria-crm-live.md` registrava o mesmo conjunto e problemas de paginação/429. É evidência anterior complementar, não uma nova execução da ingestão.

A igualdade dos dois helpers locais não substitui A/B/C em produção. A API nova não foi chamada porque a origem atual pode adquirir lease, renovar e gravar cache. Isso violaria a restrição read-only desta tarefa.

## 4. Histórico e casos reais

Agosto distribui 60.000 em três semanas salvas; gap 10.000. Semana 11–18 usa `people` legado e meta explícita 20.000; semana 19–25 usa `people` legado e teamTarget 0; 26/08–01/09 usa mapa individual. Julho possui meta mensal, mas nenhuma semana salva. Cinco vendas de 01/08 totalizam **6.110**, corretamente pertencentes ao período mensal de julho salvo: Evaldo 1.125, Leonilda 500, Rosana 1.775, Claís 1.320, Alan 1.390.

| Caso solicitado | Evidência real | Comportamento / conclusão |
| --- | --- | --- |
| Meta zero | Guilherme e Tarcísio Gomes: SDR 0 em 09–15/09; teamTarget 0 | Drawer conserva 0. TeamTarget 0 aciona fallback, não zera meta financeira. |
| Meta inexistente | Outros sem entrada na segunda semana | Drawer exibe efetivo 0; receita de Felipe continua em Outros. Ausência e zero não ficam distinguidos por pessoa. |
| Pessoa em Outros | Felipe: 8 vendas / 7.512 no mês; 3 / 3.300 na semana | Papel SDR provoca agrupamento financeiro; não criar usuário Outros. |
| Sem role base | Guilherme, Luis Perdigão, Tarcísio Gomes sem growthPeople | Papel semanal explícito em 09–15; nas outras semanas drawer infere SDR. |
| Inativo | Luis Eduardo Ferreira Jorge e dois Tarcísio Filho | Os três excluídos da lista ativa. Não correspondem ao Luis Eduardo ativo por simples nome. |
| Mudança de função | Nenhum caso comprovado | Regra foi lida/testada, mas não existe evidência real suficiente para certificar esta situação. |
| Mês sem meta | Junho não apareceu entre os cinco documentos growthGoals listados | Indício de ausência; sem GET 404/autorizado, não tratado como ausência certificada nem replay de dados reais. |
| Semana sem configuração | 16, 23 e 30/09; todas as de julho | “Não definida”; setembro permite Definir; histórico permite apenas Ver. |
| Algumas semanas configuradas | Setembro 2/5; agosto 3/4 geradas | Valores salvos mantidos; sem distribuir automaticamente a diferença. |
| Configuração antiga | Agosto `people` versus mapas | Decoder preserva metas/roles observados. |
| Meses anteriores | Julho e agosto | UI read-only confirmada. Seleção histórica por UUID e elegibilidade passada não certificadas. |
| Negócio sem responsável | Douglas Covali da Silva, 1.112, aberto; Mirela Nogueira dos Santos, 0, aberta | Observados fora da lista de ganhos; excluídos pela etapa, antes da atribuição. Fichas/IDs não auditados. |
| Responsável fora da lista comercial atual | Fábio Camargo: agosto 1.895/2 e julho 5.570/5 | Ausente dos 11 comerciais exibidos, não prova exclusão de toda a coleção users; sem closer elegível vai para Outros. |
| Negócio zero | Cleusa Jader e Mirela, abertos; Mauro Petter, perdido | Não entram nos ganhos. Nenhum ganho zero nos 124 ganhos observados. Fallback monetário do código merece regra explícita antes de certificar ganho zero. |
| Possível duplicado | Enderson João de Souza Vieira em julho 501 e agosto 504 | Mesmo nome, produto Premium versus Upgrade; não é prova de duplicação. Sem UUIDs não é possível decidir. Em setembro, 26 números distintos. |
| Criado em outro mês | #7580 maio→setembro; #8895 julho→setembro; outros 7 casos agosto→setembro | Inclusão pelo ganho observada, não pela criação. |
| Status histórico reaberto | Rogério apareceu junto da listagem de julho, mas Em aberto | Excluído da soma dos 54 ganhos. Linha apresentou valores diferentes em leituras distintas; nenhum valor foi usado como ganho. |

## 5. INCONSISTÊNCIAS

### P0

Nenhuma identificada nas evidências acessíveis. Isso não certifica áreas sem acesso.

### P1-01 — Snapshot semanal divergente (produção/preexistente)

- **Esperado:** total semanal e negócios fecham com fonte e agrupamentos.
- **Encontrado:** cache 8.385/7 versus 12.646/11; quatro negócios listados acima.
- **Impacto:** subestimação de 4.261; acompanhamento de meta e ritmo incorretos.
- **Causa:** ausência de receita de SDR/Outros e diferença de data explicam o delta; ingestão/cache bruto não exportado para confirmação final. Auditoria prévia documentou coleta incompleta/429.
- **Recomendação:** validar o snapshot novo com IDs incluídos/excluídos, completude e data de fechamento; só depois liberar. Não renovar cache em auditoria read-only.

### P1-02 — Dia 11/08 contado em duas semanas (comportamento de código reproduzido)

- **Esperado:** períodos semanais consecutivos sem sobreposição, preservando a semana histórica salva 11–18/08.
- **Encontrado:** `listCompetenciaWeeks('2026-08')` gera 05–11 e 11–18. O resolvedor compartilhado produz os mesmos limites na leitura.
- **Impacto real:** Edi Carlos 1.110 + Liliam 1.110 + Maria Leal 508 = **2.728** entram nos dois intervalos. Não altera o KPI mensal nem a meta distribuída, mas duplica receita entre linhas semanais.
- **Causa raiz:** exceção aplicada apenas quando a data de referência já está entre 11 e 18; a semana anterior mantém término em 11. Teste atual confere fim da semana especial, não a interseção.
- **Recomendação:** corrigir o calendário compartilhado/enumeração e o intervalo efetivamente usado no cálculo; testar interseção vazia e estes três negócios. Não alterar Firestore. Nenhum patch aplicado para não impor uma nova regra histórica sem fechar a fonte.

### P1-03 — Validação integrada incompleta (limitação de acesso)

- **Esperado:** resposta A autenticada + snapshot B bruto + fonte C completa com UUIDs, mesmos instantes, três competências e eventos SDR.
- **Encontrado:** Firebase CLI expirado, renovação aguardando identidade Google; variáveis protegidas Vercel vieram vazias; tabela Supabase datacrazy_businesses inexistente no projeto consultado (404/PGRST205). Leitura via console possível, export completo não obtido.
- **Impacto:** impossível certificar ingestão, filtros globais de pipeline, deduplicação por UUID, todos os eventos SDR e todos os responsáveis históricos. Totais corretos por DOM não fecham esse gate.
- **Recomendação:** concluir autenticação pendente e obter export/snapshot estritamente de leitura; não usar o endpoint que atualiza origem como atalho.

### P2-01 — Papel e elegibilidade histórica dependem do cadastro atual

- **Esperado:** distinguir configuração salva no passado da lista de usuários de hoje.
- **Encontrado:** drawer de agosto mostra também Guilherme, Luis Perdigão e Tarcísio Gomes com 0 e fallback SDR, apesar de não constarem daquela configuração semanal. Usuários atualmente inativos são removidos mesmo em competências anteriores.
- **Impacto:** apresentação pode sugerir participação/função passada sem evidência. Não foi comprovada perda financeira histórica de usuário específico; receita geral segue independente.
- **Causa:** lista ativa atual usada em todas as competências e fallback de papel no drawer.
- **Recomendação:** indicar claramente ausência de configuração histórica e considerar snapshot de identidade/role ao salvar semanas futuras; conservar referências antigas para consulta.

### P2-02 — Período comercial especial não aparece junto do KPI mensal

- **Esperado:** explicar o intervalo real do valor mensal.
- **Encontrado:** UI informa Julho/2026, mas realizado inclui 01/08; agosto começa em 02/08. Período está no modelo, sem exibição explícita ao lado do mensal.
- **Impacto:** comparação com export de mês calendário parece divergente em 6.110 só no limite de julho.
- **Causa:** rótulo usa somente competência.
- **Recomendação:** exibir início/fim efetivos quando diferentes do calendário.

### P3-01 — Zero versus configuração ausente por pessoa

- **Esperado:** diferenciar zero salvo de ausência quando auditando o histórico.
- **Encontrado:** ambos viram 0 no input; Outros sem meta tem receita 3.300 e API progressPct 0.
- **Impacto:** não há divisão por zero, mas 0% pode sugerir desempenho nulo; distinção de proveniência se perde no drawer.
- **Causa:** `targetValue || 0` e percentuais zero para denominador zero.
- **Recomendação:** usar estado “sem meta/sem configuração” e atingimento N/A para denominador zero, mantendo 0 explícito editável.

## 6. UI local contra dados auditados

Aberta em Chrome usando **o arquivo implementado commercial-goals.js e styles.css**. Servidor local `replay.cjs` só aceita GET; não contém credenciais e não consulta produção.

- Setembro: meta 60.000, realizado 28.188, atingimento visual **47,0%** (46,98 arredondado a uma casa), gap 31.812; semanas 13.237/66,2% e 12.646/70,3%; distribuição 38.000/gap 22.000.
- EDIT mensal: drawer “Editar meta mensal” abriu com 60.000, sem salvar.
- EDIT: semana 09–15 mostrou os oito usuários + agrupamento Outros, metas 30/20/0/20/20/0/9.000/9.000/0. Zero explícito preservado.
- CREATE: semana 16–22 mostrou “Definir metas”, “sem configuração”, opção Copiar semana anterior e botão salvar. Nenhum save executado.
- Histórico: agosto 70.000/50.320/71,9%; julho 60.000/56.173/93,6%. Agosto 11–18 preservou metas 40/30/30 SDR, 8.000/8.000 closers e 4.000 Outros. Todos os inputs desabilitados, nenhum botão Salvar.
- Julho: cinco semanas Não definida, planejamento 0 e diferença 60.000.
- CREATE de meta mensal em competência futura inexistente **não validado com fonte real**; nenhuma competência futura inexistente foi certificada. Testes automatizados cobrem comportamento funcional.

**Escopo da reprodução:** setembro executa os helpers atuais com os 26 números reais, valores e dias observados; a adaptação usa marcador de horário local apenas para manter o dia lido, sem alegar hora de fechamento observada. Não valida precedência dos campos brutos nem fusos de fronteira. Julho/agosto usam somas independentes dos dados observados para conferir renderização; IDs não inventados. Eventos SDR não foram preenchidos com zeros para alegar produção: permanecem não validados. A estrutura completa da aplicação autenticada não foi exercitada.

## 7. CÓDIGO E TESTES

Implementação inicial de Metas: commit `152550b`. Durante a auditoria outro trabalho incorporou `1f8fce0` (ingestão/snapshot) e `4389bdd` (reconciliação em snapshots). HEAD verificado: `{head}`. Esses patches **não foram produzidos por esta auditoria** e não são apresentados como correções realizadas aqui. Havia ainda arquivos não rastreados de Atendimento/Financeiro de outro trabalho; não foram alterados.

Arquivos produzidos aqui: relatório, transcrições JSON, anexos tabulares, reprodução local e logs na pasta desta auditoria. **Nenhum arquivo de produto corrigido; nenhum commit/deploy nesta tarefa.**

| Execução | Registrados | Aprovados | Ignorados | Falhos | Observação |
| --- | ---: | ---: | ---: | ---: | --- |
| Focados Metas + regressões comerciais | 56 | 56 | 0 | 0 | tests-focused.log |
| Primeira suíte completa | 276 | 273 | 2 | 1 | Falha de retenção dependente da data corrente; logs preservados. |
| Suíte completa intermediária | 280 | 277 | 3 | 0 | Após congelamento da data do teste por trabalho paralelo. |
| Relacionados Comercial/CRM/Growth finais | 111 | 111 | 0 | 0 | tests-related-final.log |
| Suíte completa final | 288 | 285 | 3 | 0 | tests-full-final.log |

As linhas são execuções distintas, com testes sobrepostos; não somar como cobertura única. Primeira falha: `tests/retention-store-provisioning.test.js`, esperava 2026-08-10, recebeu 2026-09-10; o diff do trabalho paralelo fixa Date em agosto. **Preexistente e dependente do relógio**, não atribuída a Metas; não classificada arbitrariamente como flaky. Os três skips finais são integrações PostgreSQL/PostgREST dependentes de ambiente. Nenhuma falha nova atribuída a Metas na suíte; o problema de calendário escapou aos testes existentes.

## 8. VEREDITO DE DEPLOY

**NÃO.** Antes da liberação, corrigir e testar a sobreposição de agosto, reconciliar o snapshot efetivo com os quatro negócios e completar a validação autenticada read-only (incluindo eventos SDR e IDs históricos). A nova implementação local reproduz corretamente o mensal de setembro e o semanal quando recebe as observações corretas, mas isso não elimina a divergência de produção nem certifica a origem dos dados.

A confirmação de identidade Google solicitada anteriormente é necessária para renovar o acesso existente do Firebase CLI; não é autorização de deploy. Nenhuma senha deve ser enviada no chat.

## Anexos

- [Transcrição das fontes e 26 negócios de setembro](observations.json)
- [98 ganhos históricos observados, sem UUIDs](history-observations.json)
- [Comparação dos helpers e cache](reconciliation.json)
- [Modelos usados na reprodução visual](replay-models.json)
- [Negócios de setembro, número a número](negocios-setembro.md)
- [Histórico: negócios e responsáveis](negocios-historicos.md)
- [Script local de reprodução](replay.cjs)
- [Testes focados](tests-focused.log), [primeira suíte com falha](tests-full-first.log), [relacionados finais](tests-related-final.log), [suíte final](tests-full-final.log)
