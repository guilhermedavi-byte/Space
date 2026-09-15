# CRM Live — recordes e ranking SDR

Correção implementada no workspace e validada localmente em Chrome. Não publicada em produção nesta etapa. Os dados da validação visual são simulados, com estrutura semelhante à resposta da aplicação; não representam resultados comerciais reais.

## Causas confirmadas

- A frase “do melhor dele na semana” estava duplicada no backend e no renderer, sem tratar empate/superação.
- `buildPersonalBestHeadline` retornava apenas o candidato com menor distância da marca histórica. Descartava empates e recordes superados. Não havia nome hardcoded: o carrossel recebia apenas essa pessoa. A rotação existente já avançava corretamente pelos itens recebidos.
- O ranking distribuía todos os itens em linhas de altura flexível, mas usava nomes de 6,4–8vh, percentuais de 9–12vh e legendas multilinha. O conteúdo excedia as linhas. No modo lateral havia regras adicionais de tipografia; no vertical, o avatar do líder também exigiu ajuste.

## Mudanças

- Uma função compartilhada gera a copy usada no backend e na TV. Distingue abaixo, igual e acima do recorde, com singular/plural e sem referência a gênero. Com 10 reuniões e melhor marca 17, faltam **8 para bater** (7 apenas igualam).
- Todos os SDRs elegíveis com meta positiva e marca histórica positiva recebem um slide, deduplicados por `personId` e ordenados de forma estável. Preservados os filtros comerciais existentes e a exclusão da semana atual do histórico. Zero atual é válido. Sem histórico positivo não se inventa um recorde; o helper também oferece copy segura para payload sem histórico.
- Ranking SDR em páginas de até quatro pessoas, preservando ordem, valores e posição global do líder. Todas as páginas integram a mesma rotação e mostram indicador de página.
- Grid com coluna reservada ao percentual, barras alinhadas, tipografia limitada, espaçamento explícito e uma linha para texto auxiliar. Nomes/legendas extensos usam ellipsis e mantêm texto completo no atributo `title`. Avatar por iniciais continua disponível sem foto. Ajustes incluem modo lateral e vertical; closers mantêm o layout existente.

## Arquivos de código alterados

- `api/_lib/crm-live.js`: seleção de todos os recordes elegíveis.
- `api/_lib/crm-live-presentation.js` (novo): copy compartilhada e paginação SDR.
- `api/crm-live.js`: renderização, inclusão das páginas na rotação e CSS.
- `tests/crm-live-news.test.js`: estados do recorde, empates, zero, ausência de histórico/foto, nomes longos, deduplicação, rotação e paginação.

Documentação: este arquivo. Evidências e verificador visual: `artifacts/crm-live-presentation/`.

## Validação

- **56 testes aprovados, zero falhas**, nos nove arquivos de testes relacionados ao CRM e metas. Após acrescentar a asserção específica de empate múltiplo, o arquivo de notícias foi executado novamente: quatro testes aprovados. Verificação de sintaxe dos três arquivos de código e `git diff --check` aprovadas.
- Chrome real, HTML e JavaScript reais da rota, respostas locais interceptadas com nove SDRs: nome longo, ausência de foto, zero, 250%, marca anterior 17, pessoas abaixo/empatando/superando.
- Sete configurações: 1920×1080, 1366×768 e 1280×720 com/sem painel lateral, mais 1080×1920 vertical. O relógio de teste ativa o modo lateral pelo fluxo real de prazo.
- Avanço automático verificado com relógio controlado; navegação percorreu as três páginas e os nove slides de recorde em cada configuração. Teste unitário percorreu os recordes pelo timer do controlador.
- Medições DOM verificaram separação entre linhas, textos, avatar, percentual e rodapé, alinhamento das barras e permanência do conteúdo dentro do slide. **Zero violações** nas sete configurações; sem erros de JavaScript. Capturas também inspecionadas visualmente.

Capturas: `1280x720-split-1-3.png`, `1280x720-split-record.png`, `1920x1080-full-1-3.png` e `1080x1920-full-1-3.png`. Os resultados estruturados estão em `layout-results.json` e os testes em `regression-tests.log`.

Para repetir o verificador, disponibilize o pacote Playwright no Node e execute `node artifacts/crm-live-presentation/visual-check.cjs`. Ele usa Chrome instalado no macOS; `CHROME_PATH` pode indicar outro executável. O navegador é isolado e as requisições são interceptadas localmente, sem consultar ou modificar produção.
