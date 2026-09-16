# Validação pós-deploy — CRM Live

**Resultado geral: parcialmente validado.** Os cenários reais disponíveis passaram. Empate, superação, singular e uma nova recuperação de HTTP 429 não ocorreram durante esta auditoria; não recebem PASS de produção.

## Deploy

- Commit: `f59d7d2fec0b484b6d3aa263aed3f76843cc9458`, branch `main`.
- Deployment: `dpl_8mdX14yQz9tLYvbntnB1NFFNMGZo`, target production, status **READY**.
- Criado em 14/09/2026 23:16:46; pronto às **23:17:05**, America/Sao_Paulo.
- Domínio confirmado: `plataforma.spaceschoolbr.com`.
- As alterações já haviam sido publicadas pelo fluxo GitHub conectado quando esta auditoria começou. Não disparei outro deploy nem criei staging. O commit publicado reúne outros trabalhos do projeto; portanto não afirmo que esse deploy existente continha exclusivamente os quatro arquivos da correção. Conferi e salvei seu diff específico. Os arquivos do pipeline/cálculo listados em `pipeline-diff-check.json` não mudaram nesse commit.

## Recorde pessoal

| Pessoa elegível | Atual | Recorde anterior | Atual − recorde | Para bater | Estado |
|---|---:|---:|---:|---:|---|
| Ayres André | 18 | 44 | −26 | 27 | Abaixo |
| Felipe Santos | 11 | 27 | −16 | 17 | Abaixo |
| Luana Mendonça | 10 | 17 | −7 | 8 | Abaixo |

**3 elegíveis, 3 slides gerados, 3 pessoas vistas realmente: PASS para seleção e rotação atuais.**

Fonte histórica conferida no console Firestore, coleção `crmLiveWeeklyRollups`: 11/08, 19/08, 26/08 (sem linhas SDR) e 02/09. A semana atual 09/09 fica fora do recorde anterior. Máximos encontrados: 44, 27 e 17, correspondentes à TV.

Luis Perdigão aparece no ranking com 6/20, mas não está nas semanas históricas consultadas. Guilherme Davi e Tarcísio Gomes aparecem com 0/0, sem meta positiva. Esses três não são elegíveis pela regra preservada.

Copy real: “Faltam 27/17/8 reuniões para [nome] bater seu recorde pessoal da semana”, com subtítulo da marca anterior. A contagem está correta: igualar e bater são estados distintos. Sem ambiguidade de gênero ou overflow. **Empate, superação, singular e nomes excepcionalmente longos: não validados com dados reais nesta execução**; cobertos pelos testes locais. Não alterei registros para produzir esses estados.

## Ranking SDR

- **6 SDRs em 2 slides (4 + 2): PASS.**
- Página 1: Ayres André, Felipe Santos, Luana Mendonça, Luis Perdigão.
- Página 2: Guilherme Davi, Tarcísio Gomes.
- Navegação, barras, percentuais, avatares, textos e rodapé: **PASS**, sem sobreposição medida ou observada.
- Fotos reais e fallback por iniciais observados. Os nomes atuais couberam; nomes extremos permanecem validação local.
- Observação de conteúdo preservado: pessoas sem meta exibem “faltam 0 reuniões para ultrapassar…”. A auditoria não alterou essa regra/texto preexistente.

## Responsividade

| Navegador real de produção | Resultado |
|---|---|
| 1920×1080 | PASS |
| 1366×768 | PASS |
| 1280×720 | PASS |
| Vertical 1080×1920 | PASS |

Três recordes e duas páginas SDR avaliados em cada resolução, com dimensões efetivas medidas. O arquivo contém 25 observações (inclui uma repetição em 1920×1080), **zero violações**. Verificados avatar/nome, nome/percentual, textos/linhas, limites do card, barras e rodapé; capturas também inspecionadas visualmente. O override foi restaurado. O painel lateral não estava ativo no horário; não foi forçado em produção. Foi validado o formato vertical como estado adicional.

## Regressão

- **CRM financeiro: PASS no snapshot observado.** R$ 15.151,00 / 13 negócios, reconciliados por UUID e valor no log `snapshot_validated`; TV mostra R$ 15,2k. Nenhuma regra financeira, negócio ou meta foi editada nesta auditoria.
- **Sincronização: PASS.** 9.907/9.907 registros, 50/50 páginas, 50 requests, 54,726 segundos. Coleta 14/09 23:17:15–23:18:10. Fonte `7b73d1c4-392d-477f-8381-6a8ca2ee46cf`.
- Snapshot VALID/publicado: `013cd7a5-ac04-4d32-87d6-31987ef7c149`.
- Freshness: observada atualização pendente com coleta antiga; depois “Última atualização completa: 14/09/2026, 23:18”, sem pendência.
- **Retry: não validado novamente em produção.** Zero 429 e zero retries nesta coleta. Código preservado e testes aprovados; não foi provocado rate limit.
- **Carrossel: PASS.** Anterior/próximo, ciclo completo e demais slides renderizaram. Autoplay observado sem cliques entre Ayres e Felipe. Uma segunda observação, reposicionada manualmente em Felipe antes de retomar, capturou Luana após avanço automático. O log distingue reposicionamento de avanço automático.

## Testes

Suíte relevante executada novamente sobre o código final publicado:

- Passed: **56**
- Failed: **0**
- Skipped: **0**

## Evidências

Todos os arquivos nesta pasta:

- `deployment.json`, `deployed-presentation.diff`, `pipeline-diff-check.json`.
- `elegibilidade-real.json`: atuais/metas/recordes, elegíveis e motivos.
- `historico-firestore.json`: valores históricos lidos no console, sem tokens/cookies.
- `layout-producao.json`, `navegacao-manual.json`, `autoplay-producao.json`.
- `pipeline-events.json`, `financial-reconciliation.json`, `tests.log`.
- `1920x1080-recorde-ayres.png`, `1920x1080-recorde-felipe.png`, `1920x1080-recorde-luana.png`.
- `1920x1080-ranking-1.png`, `1920x1080-ranking-2.png`.
- Capturas equivalentes com prefixos `1366x768-`, `1280x720-`, `1080x1920-`.
- `autoplay-luana.png`.

A navegação direta ao endpoint JSON foi bloqueada pelo Chrome (`ERR_BLOCKED_BY_CLIENT`). A alternativa foi conferir a fonte histórica real no Firestore, os dados efetivamente renderizados pela TV autenticada e os logs reais de produção. O diagnóstico salvo não se apresenta como export bruto da API. Nenhum fixture foi usado como evidência de produção.
