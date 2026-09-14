# CRM Live: coleta completa e publicação de snapshots

## Incidente e fluxo confirmado

O cache de 14/09/2026 20:02:50 continha R$ 8.385 / 7 negócios, anterior à correção comercial. Três negócios de um responsável SDR eram descartados pelo ranking e um ganho após meia-noite era filtrado pela movimentação do dia anterior. A versão seguinte corrigiu as regras, mas passou a varrer o histórico completo. `/api/crm-live-data`, `/api/crm-live-events` (poll de 25 s) e o Comercial disparavam leituras independentes. HTTP 429 interrompia as leituras. O navegador mantinha `crmLive:lastGood` sem validar a versão e com indicação insuficiente de idade.

Não existe cron configurado em `vercel.json`. O caminho ativo é acionado pelos endpoints autenticados. Há um espelho Supabase opcional e endpoints manuais em `api/datacrazy-sync.js`, mas ele não estava habilitado em produção. As leituras financeiras agora usam explicitamente o snapshot completo Datacrazy/Firestore. O espelho legado não fornece garantia de publicação atômica; seus jobs manuais não devem ser executados simultaneamente à coleta de produção. Nenhuma migration Supabase é necessária.

## Arquitetura

`Datacrazy → páginas sequenciais → validação/deduplicação → staging imutável → manifesto completo → cálculo → quality gate → commit Firestore → frontend`

- `crmLiveSync/source`: lease global, última tentativa e ponteiro para o último dataset completo.
- `crmLiveSyncRuns/{snapshotId}`: tentativa de coleta PROCESSING / VALID / FAILED.
- `crmLiveDatasetChunks/{sha256}-{parte}`: JSON canônico comprimido, dividido em strings de até 500 KB. Nunca é acessado como fonte atual antes do commit do manifesto. Conteúdo idêntico reaproveita os mesmos chunks.
- `crmLiveSnapshots/{snapshotId}`: tentativa de cálculo e snapshot histórico. O snapshot legado também é preservado antes de sua primeira substituição.
- `crmLiveCache/crm`: payload compatível com o contrato anterior, acrescido de metadata. É atualizado no mesmo commit que o histórico VALID, após todos os gates. Precondição Firestore `updateTime` impede sobrescrita concorrente; ordem de início da coleta/cálculo impede publicação atrasada sobre fonte mais recente.

Leituras usam a mesma fonte completa por 5 minutos. Outras instâncias não iniciam varreduras enquanto a lease de 260 s estiver ativa. Em falha, há cooldown global de ao menos 120 s, respeitando um Retry-After maior. Um worker encerrado inesperadamente deixa PROCESSING até expirar sua lease; o próximo pode assumir, sem apagar o histórico. Durante coleta/falha, dados anteriores permanecem disponíveis como stale. Sem snapshot completo anterior, a resposta é indisponibilidade explícita.

O cálculo do CRM usa versão 3. SDRs e responsáveis sem linha configurada não reduzem a receita elegível: o total financeiro independe do ranking e existe destino agregado. A prioridade de campos de fechamento já adotada é preservada em `commercial-sales.js`; `lastMovedAt` é apenas fallback legado. O endpoint de auditoria informa o campo realmente selecionado em cada registro. Não há alteração de comissões/metas/negócios reais.

## Retry e qualidade

- Uma requisição por vez, espaçamento mínimo de 1 s entre inícios de requests.
- Até 5 tentativas por página, backoff exponencial de base 1 s, teto 30 s, jitter de 50%–100%.
- Espera nunca menor que Retry-After, aceitando segundos e HTTP-date.
- Timeout de 15 s por request (inclui leitura do corpo) e orçamento de 220 s para coleta; a lease e o limite serverless de 300 s incluem margem para processamento/publicação. Esperas que excederiam o orçamento invalidam a execução, sem request antecipado.
- Retry somente para erro de rede/timeout e HTTP 408, 429, 500, 502, 503, 504. Outros códigos e payload inválido falham imediatamente.
- Até 200 páginas de 200 negócios. Atingir o limite sem término é FAILED, nunca sucesso parcial.
- Total/expectedPages, quando informados, devem permanecer estáveis e bater com páginas, registros e IDs únicos. Sem total remoto, exige-se página terminal curta/vazia; não se inventa `expectedPages`.
- IDs ausentes, duplicatas conflitantes, integridade/hash inválidos, métricas não finitas e divergência entre ranking e total bloqueiam publicação.
- Contagens diárias são reconciliadas a partir do dataset completo, não incrementadas a partir de notificações reexecutáveis.

A API Datacrazy usa paginação por offset e não há garantia documentada de leitura transacional de todos os registros na origem. Mudanças detectáveis durante a leitura (total instável, duplicatas conflitantes, contagem incompleta) falham conservadoramente. Não se declara uma transação na origem que o fornecedor não oferece.

## Observabilidade e frontend

Logs JSON (`component=datacrazy-sync`) cobrem início, página, retry, conclusão, cálculo, gate, publicação e erro, sem tokens/headers/resposta bruta nem nomes de leads. Metadata contém IDs de execução/fonte, status, versão, datas da coleta/cálculo, data máxima da fonte, contagens, páginas, requests, retries e duração. Sucesso/falha são eventos agregáveis; não há novo serviço de métricas.

A TV mostra `Última atualização completa: DD/MM/YYYY HH:mm` em America/Sao_Paulo. Snapshot antigo, falha ou idade superior a 5 minutos produz `Atualização pendente`. Versão legada é identificada expressamente. A data é a conclusão da coleta CRM, nunca a atualização mais recente de SDRs. O fallback do navegador preserva a identidade da versão e sempre é rotulado como pendente.

## Auditoria real

Somente sessão admin/growth (cookie de TV/comercial não basta):

`GET /api/crm-live-data?auditFrom=2026-09-09&auditTo=2026-09-14`

Retorna a reconciliação da fonte completa, incluindo UUIDs reais, número quando disponibilizado, valor, stage/status, atendente, campo/data de ganho, movimento e motivo. Por padrão retorna os incluídos e contagens de exclusões. `&auditPage=0` e páginas seguintes expõem todos os registros em lotes de 200, sem exceder o limite de resposta serverless. Não substitui o snapshot atual por um período histórico e não modifica negócios. Em fonte incompleta/stale retorna erro, nunca uma validação artificial.

Referência da auditoria anterior: 11 negócios / R$ 12.646,00 entre 09/09 e 14/09. Essa referência não integra código de cálculo nem testes como constante de produção. O resultado real pós-implantação deve ser registrado separadamente, com snapshotId, período, IDs e logs.

## Testes e operação

`npm test` e `npm run check`. `tests/crm-source-pipeline.test.js` cobre paginação, retries, falhas definitivas, deadline, duplicação, worker expirado, commits atômicos, data do ganho, SDR e freshness. Respostas simuladas exercitam mecanismos de falha; não são evidência do total de produção.

Histórico e chunks não são apagados automaticamente nesta mudança. A retenção deve ser definida operacionalmente antes de crescimento prolongado; apagar chunks referenciados invalida o hash/manifesto. Rollback de código preserva os documentos anteriores e os novos metadados são aditivos. Reverter ao coletor antigo também reintroduz risco de 429.
