# Comercial > Metas

## 1. Auditoria e arquitetura encontrada

A implementação foi investigada antes das alterações: template e roteamento do app, modal e listagem antiga, API `growth-goals`, armazenamento Firestore, resolução de identidades e papéis, semana comercial, resumo financeiro do CRM Live, testes e tokens CSS.

- **Mensal:** `growthGoals/{YYYY-MM}.valorMeta`. O documento também pode ter `periodStart`, `periodEnd`, `defaultWeeklyConfig`, `createdAt`, `updatedAt`, autores e nomes dos autores.
- **Semanal:** `growthGoals/{YYYY-MM}.weeklyGoals[weekKey]`, com datas, `teamTarget` e metas individuais. A escrita usa `individualMonthlyGoals`; leitores também aceitam representações legadas, inclusive `people` como array.
- **Pessoas:** `buildActiveCommercialPeople` concilia usuários reais do Comercial e configurações `growthPeople` por identidade confiável. Órfãos não viram pessoas. Nomes inválidos e identificadores internos não são apresentados.
- **Papéis/metas efetivos:** precedência global → competência → semana, usando o resolvedor existente. Zero é um valor válido para SDR. Exclusões explícitas são preservadas.
- **Outros:** bucket sintético `outros`, sempre Closer. Não se cria usuário para ele.
- **Semana:** `resolveCommercialWeek`, quarta a terça, mantendo a exceção histórica de agosto de 2026. A competência de armazenamento é o mês do início da semana; datas não são truncadas na virada do mês.
- **Financeiro:** `commercial-sales`, `buildMonthSummary` e `buildWeeklyTeamSummary` do CRM Live.
- **Permissões existentes:** GET para admin/growth; POST somente admin. Competências anteriores são somente leitura.
- **Design:** Plus Jakarta Sans; superfícies, cores, bordas e raios CSS existentes; botões `button`, campos `auth-input` e estrutura `admin-students-drawer`.

## 2. Arquitetura final

Nova rota `/app/admin/comercial/metas`, dentro do Comercial. `commercial-goals.js` controla apresentação e rascunhos locais. O novo helper `api/_lib/commercial-goals.js` agrega a competência reutilizando os cálculos oficiais. O frontend formata os valores retornados; não recalcula vendas, metas da equipe, calendário comercial ou papéis por identidade.

O GET agrega meta mensal, semanas, existência explícita, configuração herdada, pessoas elegíveis, resultados oficiais, status, cópia da semana anterior e planejamento. Uma falha na leitura financeira não é apresentada como realizado zero.

## 3. Arquivos criados

- `api/_lib/commercial-goals.js`: modelo de leitura do módulo.
- `commercial-goals.js`: página, navegação, drawers, rascunhos, salvamento e toast.
- `tests/commercial-goals.test.js`: testes do modelo e execução da UI em DOM.
- `docs/commercial-goals-management.md`: este relatório.
- `artifacts/commercial-goals-desktop.png`, `commercial-goals-drawer.png`, `commercial-goals-mobile.png` e `commercial-goals-mobile-drawer.png`: capturas de QA com dados sintéticos.

## 4. Arquivos alterados

- `api/_templates/app.html`: item Metas, painel, carregamento do controlador e retirada do botão de metas de Usuários.
- `api/app.js`: painel inicial da nova rota.
- `script.js`: roteamento, grupo Comercial e redirecionamento dos acionadores legados para Metas.
- `styles.css`: layout responsivo usando tokens existentes.
- `api/growth-dashboard.js`: leitura agregada, ação por entidade e preservação de campos legados ao salvar.
- `api/_lib/crm-live.js`: exportação de `buildMonthSummary`, sem alterar seu cálculo.
- `tests/growth-goals-people.test.js`: testes adicionais da API e compatibilidade.
- `package.json` e `package-lock.json`: jsdom como dependência de desenvolvimento dos testes de interface.
- `.gitignore`: dependências instaladas não rastreadas não entram no diff; arquivos já rastreados não foram removidos.

## 5. Endpoints

- **Reutilizado/ampliado:** `GET /api/growth-dashboard?api=growth-goals&mode=management&competencia=YYYY-MM`.
- **Reutilizado:** `POST /api/growth-dashboard?api=growth-goals`, com payload mensal ou semanal separado.
- GETs e aliases antigos continuam disponíveis. Nenhuma nova coleção, migração ou endpoint de escrita foi criado.

## 6. UI

Header com competência, quatro KPIs, card permanente da meta mensal, tabela de semanas, destaque da semana atual e reconciliação do planejamento. Drawer mensal separado do semanal; SDRs, Closers e Outros separados. Skeleton, estados vazios/erro, retry, labels específicos, feedback de sucesso, foco de teclado e fechamento por Escape.

Semanas concluídas abrem consulta. Quando a competência ainda permite alterações, a consulta oferece uma ação explícita de edição. Meses anteriores não oferecem gravação. A tabela rola dentro do card em telas pequenas e o drawer possui rolagem própria.

## 7. CREATE vs EDIT

- Mensal: existência do campo mensal decodificado, independentemente de haver semanas no documento.
- Semanal: existência da chave no mapa de semanas, mesmo com metas zero ou configuração vazia.
- Defaults herdados são identificados como base; não são apresentados como uma semana explicitamente salva.
- Abrir, navegar, consultar e copiar não escrevem. Copiar transfere somente configuração ao rascunho, sem resultados nem IDs de documentos.
- POST retorna `created`/`updated` pela entidade salva, não apenas pela existência do documento da competência.
- Após sucesso, os dados são relidos e o estado de existência é atualizado. Erros preservam o rascunho.

## 8. Histórico e planejamento

A competência selecionada controla os dados carregados. Papéis históricos já configurados continuam vindo do resolvedor por período; não são substituídos pelo cargo atual.

O total semanal usa a precedência existente de `teamTarget`. Sem total explícito/efetivo positivo, utiliza a soma das linhas de Closers e Outros, exatamente como o CRM Live. O planejamento soma semanas explicitamente definidas; bases herdadas ainda não salvas aparecem identificadas na tabela. Semanas que atravessam meses entram integralmente no mês em que começam, sem rateio artificial.

**Limites históricos preexistentes:** não existe snapshot completo do cadastro de usuários por mês. A lista continua baseada em usuários ativos reais; pessoas atualmente inativas não são recriadas a partir de metas órfãs. Quando não há papel histórico configurado, mantém-se o fallback existente. `updatedAt` pertence ao documento inteiro: por isso a UI informa “Competência atualizada”, sem atribuir uma edição semanal à meta mensal. Datas/autores ausentes não são inventados.

## 9. Compatibilidade

Nenhum registro existente foi apagado ou migrado. Salvamentos preservam a meta mensal quando só a semana é alterada, outras semanas, participantes ocultos/inativos, exclusões, campos adicionais de semana/pessoa e o bucket Outros. Arrays legados de pessoas são sincronizados durante uma edição porque o leitor original lhes dá precedência.

A edição mantém padrões herdados como padrões quando o administrador não altera explicitamente o total da equipe. O cache existente continua sendo invalidado pelo mesmo fluxo de gravação.

O modal antigo permanece como código legado sem acionadores ativos; a gestão acessível passa pela página Metas. Usuários, CRM Live, ranking e dashboard mantêm seus fluxos.

## 10. Validação

- **Suíte focada:** 56 testes aprovados, zero falhas, cobrindo novo módulo, API, metas semanais e regressões comerciais.
- **Suíte completa:** 266 testes; 263 aprovados, dois ignorados e uma falha preexistente em `retention-store-provisioning.test.js`.
- A falha foi reproduzida com os arquivos do `HEAD` original em diretório temporário isolado: espera `2026-08-10`, recebe `2026-09-10`. O módulo de retenção não foi alterado.
- `npm run check`, verificações de sintaxe dos novos arquivos/backend e `git diff --check`.
- Chrome headless, desktop 1440 px e celular 390 px, com os arquivos reais de UI/CSS e dados sintéticos: nenhum erro JavaScript; sem transbordamento horizontal da página após correção. Capturas verificadas visualmente.
- DOM: competência inicial, navegação/picker, concorrência de respostas, criar/editar, abertura sem gravação, cópia local, salvar/refletir estado, erros, histórico, consulta de semana concluída e foco/Escape.
- API/modelo: SDR zero/Luis Perdigão, usuários ativos, aliases, órfãos, nomes internos, Outros, regras semanais, papéis históricos, fonte oficial de vendas, preservação de campos e representações legadas.

Os testes usam fontes simuladas; a conferência visual do módulo não substitui um teste autenticado de ponta a ponta em produção. Não houve deploy ou escrita em bases reais.

## 11. Inconsistências e limites da auditoria de dados

Nenhuma inconsistência de registros reais foi confirmada: esta entrega auditou código e fixtures, sem leitura do banco de produção. Foram tratados casos estruturais relevantes: documento com semanas mas sem meta mensal; semanas herdadas sem registro explícito; aliases e exclusões; múltiplas representações legadas; metadados do documento compartilhados entre edições mensais e semanais.

A ausência de snapshots completos de usuários e a impossibilidade de inventar metadados históricos permanecem explícitas. Nenhuma correção automática de dados históricos foi realizada.
