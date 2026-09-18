# CRM Live — implementação local e pendência de dados

Status: **validação de produção pendente**. Commit e push solicitados pelo usuário após ciência do bloqueio; falta integrar a fonte real de reuniões por Closer e reconciliar as novas métricas em produção. Nenhuma meta, negócio, ligação ou agendamento foi alterado.

## Investigação

A TV de produção em 17/09/2026 mostrou Guilherme Davi e Tarcísio Gomes no ranking SDR com `0 de 0`, além de quatro slides de recorde (Ayres, Felipe, Luis Perdigão e Luana). O ranking recebia pessoas com meta zero e o modelo de notícias produzia um slide por SDR. Os recordes antigos usavam comparecimentos SDR; os históricos financeiros não são uma fonte válida de quantidade de vendas.

Fontes identificadas:

- Pessoas: `loadGrowthPeople` / `buildActiveCommercialPeople`, usuários ativos do Comercial relacionados a `growthPeople`.
- Meta relevante: configuração semanal efetiva em `buildWeeklyGoalsReadModel`, por papel; ausência/null/NaN/zero não confere elegibilidade.
- Vendas: dataset compartilhado Datacrazy, classificador `commercial-sales`, estágio `Fechado`, pipeline canônico e data de fechamento canônica, atribuição por ID do atendente. Quantidade semanal vem de `weekly.closers[].count`, sem substituir faturamento.
- Ligações: `sdrActivityEvents`, `eventType=call`, outcomes `nao_atendeu`, `atendeu`, `agendou`, `double`. A definição existente é tentativa registrada, não somente ligação atendida.
- Agendamentos: os outcomes `agendou` e `double` geram **um** agendamento cada, conforme métrica existente. Deduplicação por ID e atribuição via UID/email do SDR; eventos inválidos/futuros não entram.
- Reuniões por Closer: código do CRM interno possui `crmCloserReviews`, `meetingOutcome=held`, status `completed` e `completedAt`. **A coleção está vazia em produção**, confirmado no Console Firebase. Os eventos `meeting/show` dos SDRs não contêm o Closer responsável. Não é possível inferir essa relação sem dados adicionais, nem assumir cobertura entre o CRM interno e o Datacrazy.

A competência semanal segue `resolveCommercialWeek` (quarta a terça, com a regra histórica inicial existente). Histórico SDR é recalculado a partir de agendamentos, e histórico Closer a partir de quantidade de negócios ganhos. Rollups antigos de comparecimento/faturamento não são reinterpretados.

## Implementação local

- Elegibilidade central de apresentação: pessoa não inativa, não agregada, meta relevante finita e >0. Totais financeiros preservados.
- Um único slot de recorde no carrossel; round-robin determinístico por pessoa ao completar a volta. Quem tem dois papéis mantém uma vez por rodada e alterna o papel entre rodadas. Sem histórico, mostra construção da primeira marca.
- Recordes SDR usam agendamentos; Closers usam quantidade de vendas; singular/plural, empate e superação cobertos.
- Duas telas de conversão, até quatro pessoas por página, percentual e amostra; ausência de denominador mostra `—` e indisponibilidade explícita.
- Ordenação: taxa, numerador, denominador e ID estável.
- Métricas e SDR incorporados ao snapshot financeiro antes da publicação. Gate rejeita geração/período divergentes e taxas inválidas. Leitor usa o SDR da mesma geração quando disponível.
- Endpoint diagnóstico `auditPerformance=1` restrito a sessão admin/growth, somente leitura, com ledger de eventos incluídos e amostra limitada de exclusões.
- Ajustado overflow do ranking Closer em orientação vertical.

## Arquivos de código e testes

- `api/_lib/crm-live-eligibility.js` (novo)
- `api/_lib/crm-live-performance.js` (novo)
- `api/_lib/crm-live-presentation.js`
- `api/_lib/crm-live-refresh.js`
- `api/_lib/crm-live.js`
- `api/_lib/crm-snapshot-publish.js`
- `api/_lib/live-tv-rotation.js`
- `api/crm-live-data.js`
- `api/crm-live.js`
- `tests/crm-live-performance.test.js` (novo)
- `tests/crm-live-boot.test.js`
- `tests/crm-live-news.test.js`
- `tests/crm-source-pipeline.test.js`

## Performance

Pelo fluxo de código: antes **uma coleta compartilhada** do Datacrazy por renovação da fonte; depois **a mesma coleta**, sem chamadas adicionais por métrica. Leitores não iniciam varredura. Quantidade de páginas continua dependente do dataset. Esta comparação ainda não foi medida em produção com o novo código.

Firestore: a leitura de eventos usada pelo SDR passa a abranger o histórico disponível e é reutilizada para ranking, conversão e recordes. Isso amplia documentos lidos nessa consulta; não equivale a custo inalterado. A leitura de rollups históricos a cada request do CRM Live foi removida.

## Testes

Focados em CRM/Comercial: **251 passed, 0 failed, 0 skipped** (`focused-tests.tap`).
Suíte completa final: **652 passed, 2 failed, 8 skipped**, 662 testes (`full-tests.tap`).
As duas falhas também foram reproduzidas no HEAD anterior (`a9d08f0`) sem estas alterações:

1. `attendance-api.test.js`: `requireAttendanceAuth` recebe fixture sem `headers`, erro ao ler cookie.
2. `finance-v1-ui.test.js`: asserção textual de duas ocorrências em `script.js` encontra zero.

Cobertura nova: elegibilidade, estados/singular/plural dos dois recordes, seis ciclos com cinco pessoas, dois papéis da mesma pessoa, conversão 4/10 e 20/100, ausência/zero de denominador, ordenação, duplicação conflitante, publicação atômica com geração/período/taxa inválidos. Fixtures são exclusivamente testes locais; não comprovam números de produção.

## Visual

Prévia local no navegador real, 1920×1080, 1366×768, 1280×720 e 1080×1920. Foram percorridas 48 telas, incluindo paginação e quatro voltas com um único recorde por volta. A única ocorrência inicial de overflow era o ranking Closer vertical; após o ajuste, as 12 telas verticais passaram na nova verificação. Console sem erros na prévia. Dimensões temporárias do navegador restauradas.

Evidências: `layout-results.json`, `portrait-recheck.json`, screenshots das conversões e recordes por resolução, `1080x1920-ranking-fixed.png`. `local-preview.cjs` é estritamente uma prévia sintética, não conecta produção.

Evidência real do bloqueio: `production-closer-source-empty.png` e `production-closer-source.txt`.

## O que falta para concluir

1. Identificar a fonte operacional que registra reunião efetivamente realizada, data e Closer responsável; confirmar vínculo com os negócios Datacrazy e sua cobertura. A pergunta está pendente ao usuário.
2. Implementar adaptador dessa fonte e reconciliar os denominadores reais. O parâmetro normalizado de reuniões existe, mas nenhum adaptador de produção foi inventado.
3. Credenciais locais Google/CRM estão vazias; acesso programático real precisa ocorrer no ambiente autorizado de produção ou por credenciais configuradas, sem expô-las. O navegador autenticado permitiu apenas a investigação registrada.
4. Após integração e testes, publicar e verificar as tabelas reais de todos os elegíveis e pelo menos três ciclos reais. **Ainda não há tabelas de conversão reconciliadas, evidência de ciclos da nova versão em produção ou deployment validado.**

Não declarar a definição de done cumprida com base nesta prévia.
