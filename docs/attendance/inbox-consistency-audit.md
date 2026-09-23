# Inbox: auditoria de consistência e correção

## Escopo

Auditoria do código local da Inbox, dos pontos de entrada da aplicação, wrapper de autenticação, API de detalhe/contexto e RPCs versionadas. Correção restrita ao JavaScript do front-end, testes e este relatório. CSS aprovado preservado integralmente; banco, contratos de API e transporte não alterados. Não foi realizada auditoria do schema remoto.

## Arquitetura e causas encontradas

A Inbox é uma IIFE em JavaScript, não React. Não existem React keys, effects, QueryClient, queryKeys ou subscriptions/realtime próprios neste módulo. A seleção já usava `conversation_id`, mas um objeto de detalhe global permanecia associado ao contato anterior durante carregamentos. A resposta de qualquer request podia substituir esse objeto, sem conferir o ID solicitado ou a seleção atual.

Reprodução determinística no código anterior: iniciar A, B e C; responder C, depois B e A. A lista permanece com C selecionada, enquanto o cabeçalho passa a mostrar Pessoa A. O teste automatizado reproduziu essa falha antes da correção.

Outras causas:

- `load()` removia a seleção se o ID não aparecesse no novo lote de 50 conversas.
- Carregamento manual/subsequente trocava nomes por skeletons.
- Falhas de refetch gravavam o mesmo erro usado para substituir a tela inteira.
- `root.innerHTML` recriava todos os nós a cada atualização: lista, imagens, mensagens, input, áudio e inspector.
- O intervalo de 7 segundos não aguardava o ciclo anterior; cliques e abertura da rota também iniciavam carregamentos.
- `loadDetail()` alterava a seleção inclusive quando acionado pelo polling.
- Leitura e atualização após ações usavam novamente o ID global depois de `await`.
- O envio removia o rascunho da seleção atual, não necessariamente da conversa que originou o envio.

## Inventário de atualizações

| Origem | Antes | Depois |
|---|---|---|
| Autoabertura pelo `data-initial-panel` e `SpaceAttendanceInbox.open()` da navegação | Podiam disparar carregamentos duplicados | Inicialização idempotente |
| Polling a cada 7 s | `setInterval`, com ciclos sobrepostos | Um `setTimeout` reagendado após conclusão |
| Atualizar | Novo loading e refetch da lista | Refetch de lista e detalhe selecionado, deduplicado |
| Busca | Debounce de 260 ms existente | Mantido; geração/abort descartam consultas obsoletas |
| Time/filtros | Limpavam seleção e detalhe | Preservam seleção explícita e dados enquanto buscam |
| Ações de atendimento | Refetch usando ID global mutável | ID capturado ao iniciar; invalidação por ID |
| Confirmação de leitura | Repetida por detalhe, bloqueando seu ciclo | Por ID e sequência, deduplicada e independente do GET |
| Metadados de áudio | Wiring em cada recriação de DOM | Elemento preservado, wiring uma vez por nó |
| Timeout | Sem limite próprio do front | GET cancelado após 20 s; sem retry de mutações |

O wrapper `fetchWithAuth` aguarda a autenticação e encaminha `signal` ao fetch. Há também proteção por geração e corrida com abort para encerrar a espera da UI mesmo antes do fetch. Um 403 pode atualizar permissões através do wrapper; nenhuma modificação desse fluxo foi necessária.

A API entrega mensagens, contato e contexto em um único envelope por `conversation_id`. Os resolvedores recebem o detalhe dessa conversa. Não existe cache genérico de contato/mensagens no front. A ordenação das RPCs versionadas é `last_message_at`, `updated_at`, `conversation_id`, todos descendentes; leitura/ações podem afetar estado/ordenação, mas a posição nunca é usada como identidade. A correção não muda a ordenação SQL.

## Invariantes e implementação

- `selectedConversationId` é a única seleção, alterada apenas por seleção explícita/voltar.
- `state.detail` é um getter do cache por ID; não pode ser gravado independentemente.
- Um envelope só é aceito quando seu `conversation.conversation_id` coincide com a requisição atual e a seleção atual.
- Gerações de lista e detalhe impedem a aplicação de respostas antigas, mesmo se o transporte não respeitar cancelamento.
- Lista, cabeçalho, mensagens e inspector são derivados da mesma seleção. Os painéis possuem `data-conversation-id` para verificar a invariável.
- Uma conversa selecionada ausente do lote/filtro permanece na lista com sua identidade já conhecida até o operador selecionar outra ou voltar.
- A reconciliação mantém os nós da interface. Linhas usam `conversation_id`; mensagens usam `message_id`. Não há índice, telefone ou timestamp como identidade de conversa/mensagem. O texto de data identifica somente separadores visuais.
- `loading` inicial e `isFetching` são separados. Erros transitórios preservam dados, foco, rascunho, scroll e painéis. Erro de tela inteira só ocorre sem carregamento anterior utilizável.
- O acknowledgement de leitura não bloqueia o polling. Mutações não são repetidas automaticamente.

## Diagnóstico seguro

Eventos detalhados são desativados por padrão. Em teste, `SpaceAttendanceInboxDebug=true` habilita eventos DOM `attendance-inbox-debug`: `conversation_clicked`, `selectedConversationId_changed`, início/fim da lista, mensagens e contato, descarte de resposta e `inbox_error`. Somente ID, nome do evento e código de erro; nunca texto, pessoa, telefone, token ou payload.

Erros mantêm um buffer em memória limitado a 30 entradas, acessível por `SpaceAttendanceInbox.getDiagnostics()`. Sem persistência ou logs de console de dados. Os traces foram usados na reprodução e nos testes de corrida.

## Validação

`node --test tests/attendance-inbox-consistency.test.js tests/attendance-inbox-native.test.js`

Cobertura: A→B→C e respostas invertidas; envelope de outra conversa; seleção durante refetch; reordenação/omissão do selecionado; respostas antigas de filtros; HTTP 500 e timeout; retry inicial; lista vazia; atualização repetida; abertura duplicada; 43 ciclos/301 segundos de polling com relógio simulado; mensagens novas na conversa aberta e em outra; leitura/atribuição/envio terminando após mudar seleção; rascunho, foco e referências de nós preservados. MutationObserver verifica IDs concordantes em cada snapshot observável durante as transições.

Envio, alteração de responsável e mensagens recebidas foram simulados com API controlada nos testes, sem alterações em conversas reais. Conferência visual no navegador com dados fictícios; CSS comparado com a versão anterior e idêntico. O período de cinco minutos foi simulado, não uma certificação de carga ou estabilidade do transporte real.
