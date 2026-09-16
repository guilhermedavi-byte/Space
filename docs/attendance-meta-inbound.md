# Atendimento — Meta Inbound

Data: 15/09/2026 UTC. **META INBOUND: BLOCKED para certificação completa.** Implementação e homologação sintética no PostgreSQL/PostgREST principal concluídas; Vercel/Meta ponta a ponta e SLO de ACK permanecem pendentes. A foundation mantém a aprovação registrada em [attendance-production-validation.md](attendance-production-validation.md).

## 1. Arquitetura e escopo

```text
Meta → GET/POST público → validação → RPC capture → raw durável → ACK
                                      ↓
                       CLI operador / futuro worker agendado
                                      ↓
                  claim com lease → normalização → RPC complete
                                      ↓
                  mensagens / recibos / auditoria / outbox interno
```

O POST não inicia trabalho em background nem espera o processamento de domínio. Não há dispatcher, cliente Graph outbound, download de mídia, UI, realtime ou IA nesta entrega. A aplicação usa Node/CommonJS na Vercel, sem Next.js. O desenvolvimento no projeto principal continua autorizado com guard restrito; staging não é requisito.

## 2. Endpoint e exposição

Implementado: `GET|POST /api/attendance/meta/webhook`, em [webhook.js](../api/attendance/meta/webhook.js). Outros métodos retornam 405. Respostas são texto, sem cache. Não usa Firebase Auth: a autenticação do POST é a assinatura Meta. O GET usa verify token.

Não foi criado endpoint HTTP de processamento ou administração. O runner fica em `scripts/`. Raw e itens não são acessíveis a `anon` ou `authenticated`; mesmo `service_role` não recebe acesso direto às duas tabelas, apenas às quatro RPCs. As autorizações por time da foundation continuam vigentes.

Sondagem pública somente leitura em `https://plataforma.spaceschoolbr.com`: webhook **404**, `/api/attendance` **409** pelo guard, `/api/attendance/meta/process` **404**. O novo handler **não foi implantado na Vercel nesta execução**. Não houve login Firebase E2E. Ver [evidência HTTP pública](evidence/attendance-meta-vercel-2026-09-15.json).

## 3. Webhook verification

Exige exatamente um `hub.mode=subscribe`, um `hub.verify_token` e um `hub.challenge` numérico de até 128 caracteres. Compara hashes de tamanho fixo com `timingSafeEqual`. Sucesso retorna o challenge original com 200; token incorreto retorna 403, parâmetros inválidos 400. Não registra query string nem token.

O contrato challenge/verify token e o uso de App Secret na assinatura estão documentados no [material oficial Meta do SDK Node](https://whatsapp.github.io/WhatsApp-Nodejs-SDK/api-reference/webhooks/start/). Esse SDK está arquivado e **não foi instalado**; a referência foi usada apenas para o protocolo.

## 4. Assinatura e bytes originais

POST exige JSON, encoding ausente/identity e `X-Hub-Signature-256: sha256=<64 hex>`. Calcula HMAC-SHA256 sobre os bytes, compara em tempo constante e só então interpreta JSON. Assinatura ausente, forjada ou de um corpo diferente retorna 401 antes da RPC. Limite de 1 MiB, leitura de até 10 s, UTF-8 válido; payload malformado retorna 400, tamanho excessivo 413.

O runtime Node da Vercel possui getter lazy de `req.body` e restaura o stream. O handler lê esse stream sem invocar o getter; nunca usa `JSON.stringify(req.body)` para autenticar. Se receber apenas um objeto já interpretado, falha fechado. Ver [código oficial do runtime](https://github.com/vercel/vercel/blob/main/packages/node/src/serverless-functions/helpers.ts) e [guia de raw body da Vercel](https://vercel.com/kb/guide/how-do-i-get-the-raw-body-of-a-serverless-function). Teste local reproduz o getter lazy; a comprovação no deployment real ainda falta.

## 5. Captura bruta durável e ACK

`attendance_meta_capture` confirma a transação antes de o handler responder 200. Uma falha de persistência resulta em 503. Se houver commit e a resposta se perder, a nova entrega encontra o mesmo hash e não duplica o raw. Timeout HTTP da captura: 10 s; demais RPCs: 30 s.

Guarda texto UTF-8 original, SHA-256 dos bytes, provider, UUIDs de correlação, datas, contagem de entregas, estado, lease, tentativas, resultado e erro sanitizado. Não guarda headers, assinatura ou credenciais. O ingress rejeita campos explícitos de secret e valores conhecidos dos secrets de configuração. O payload continua sendo dado privado de atendimento, sujeito a controle de acesso e política de retenção.

Uma correção adicional separa validação sintática `json` de compatibilidade `jsonb`: JSON com `\u0000` pode ser preservado em raw mesmo quando o domínio não pode representar esse texto. O adaptador o classifica como `unhandled`, sem apagar o payload. Testado local e remotamente.

## 6. Schema e migrations

Aplicadas ao PostgreSQL 17.6 principal `mlp…gkw`, pelo SQL Editor administrativo já autenticado, após preflight REST com credencial existente e vinculada ao projeto:

- [202609150002_attendance_meta_inbound.sql](../supabase/migrations/202609150002_attendance_meta_inbound.sql): duas tabelas, índices, quatro RPCs, RLS/grants e extensão da quarentena de fixtures.
- [202609150003_attendance_meta_raw_json.sql](../supabase/migrations/202609150003_attendance_meta_raw_json.sql): substitui somente a implementação da captura para preservar JSON bruto com escapes não representáveis em `jsonb`.

| Objeto | Responsabilidade |
| --- | --- |
| `attendance_provider_events` | Raw único por provider/hash; entregas, fila, lease de 60 s, até 8 tentativas, estado/resultados |
| `attendance_provider_event_items` | Ledger único por provider/WABA/phone/category/chave semântica; normalizado, fingerprint, estado, tentativas e IDs do domínio |
| `attendance_meta_capture` | Persistir raw e contabilizar replay |
| `attendance_meta_claim` | Reservar um evento elegível com `FOR UPDATE SKIP LOCKED` |
| `attendance_meta_complete` | Executar efeitos de domínio e registrar resultado na mesma transação |
| `attendance_meta_fail` | Liberar lease, sanitizar erro e agendar retry limitado |

RPCs SECURITY DEFINER: owner `postgres`, `search_path=pg_catalog,public`, EXECUTE somente `postgres/service_role`. Os catálogos mostraram duas tabelas adicionais e somente `attendance_enqueue_outbox` alterada entre as funções preexistentes comparadas: ela reconhece o marcador administrativo de fixture também em conexões `meta_whatsapp`. Nenhuma tabela/coluna legada foi removida ou migrada em massa. [Inventário reproduzível](../scripts/attendance-meta-inventory.sql).

## 7. Processamento

[processMetaWebhookEvent(eventId)](../api/_lib/attendance-meta-processor.js) pode receber um UUID ou buscar o próximo elegível. Claim é durável; completar requer o mesmo lease ainda válido. Um worker antigo não conclui após perder a reserva.

Normaliza todos os `entry[]`, `changes[]`, `messages[]` e `statuses[]`, até 500 itens. O SQL ordena as chaves antes de adquirir locks. Cada item usa um bloco transacional: erro de domínio desfaz seus efeitos; itens válidos e o resultado do raw são confirmados juntos. Replay de item já processado não repete domínio/auditoria/outbox.

A captura não depende de worker ativo para ACK. Há runner operacional mínimo, sem endpoint público; não foi configurado um scheduler permanente. Antes de habilitar tráfego real, é necessário definir a execução recorrente e monitorar a fila.

## 8. Text inbound

Textos válidos são normalizados e entregues à `attendance_ingest_message` existente. Preserva ID externo, remetente opaco, timestamp do provedor, texto e referência externa de resposta. Metadado interno inclui apenas a correlação com o raw. Não recebe `connection_id`, `channel_id`, `team_id` ou identidade interna do provider.

Textos não representáveis em Postgres ou fora do limite ficam `unhandled` com o raw preservado. Imagens, áudio, vídeo, documento, localização, contatos, interactive, reaction e sticker são reconhecidos, mas não geram download ou processamento de mídia nesta fase.

## 9. Conversation resolution e roteamento

Mapeamento somente por configuração confiável: conexão ativa `provider=meta_whatsapp`, `external_account_type=waba`, `external_account_id=entry.id`; canal ativo com `external_channel_id=metadata.phone_number_id` pertencente à conexão. O default team vem desse canal. Falta de vínculo fica retryable, sem provisionamento automático.

A foundation resolve contato por namespace da conexão e cria/reutiliza uma conversa ativa por canal/contato. Locks e constraints existentes mantêm sequência, última mensagem e versão consistentes em concorrência. IDs internos injetados em metadata foram ignorados nos testes; identificadores de outra conexão não redirecionaram mensagens.

## 10. Identity handling

Remetente desconhecido vira contato externo não identificado. Nome de perfil é apenas apresentação. Telefone só é considerado quando um `contacts[].wa_id` correspondente contém formato internacional plausível; não comprova pessoa. Não há associação automática com lead, aluno, usuário Firebase ou outro cadastro.

Identificadores opacos são conservados. Mudanças de contrato como usernames/BSUID exigem confirmação dos payloads efetivos do app antes de ampliar suporte; formas desconhecidas permanecem no raw, sem inventar campos de identidade.

## 11. Status e eventos fora de ordem

Aceita `sent`, `delivered`, `read`, `failed`. Busca mensagem **outbound já conhecida** no canal mapeado. Não cria mensagem artificial para um recibo órfão. IDs desconhecidos ficam retryable/investigáveis.

Projeção monotônica: `read` prevalece sobre `delivered`, que prevalece sobre `sent`. `failed` só substitui pending/sending/accepted/unknown. Recibos são preservados no ledger com timestamp e códigos numéricos de erro mesmo quando não alteram a projeção. Só uma mudança efetiva gera evento, audit log e outbox interno. No teste remoto, `read → sent → delivered → failed → read` manteve `read` e gerou uma única auditoria de mudança.

O [exemplo oficial de status da Meta no Postman](https://www.postman.com/meta/whatsapp-business-platform/request/rgtfq23/message-status-update-notifications) documenta o envelope e alerta para entrega fora de ordem. As páginas atuais de referência em developers.facebook.com responderam 429 durante a consulta; não foram tratadas como conteúdo lido. Não há chamada Graph nesta fase, portanto não foi escolhido um API version nem solicitado access token para outbound.

## 12. Idempotência

Camadas: hash do raw; chave semântica do item; unicidade de mensagem por canal/ID externo na foundation; constraints de conversa ativa; ledger de status. Status usa hash de ID/status/timestamp/códigos. Corpo bruto reformatado pode gerar outro raw, mas encontra o mesmo item de domínio.

Fingerprint diferente para a mesma chave marca conflito terminal no resultado do novo raw e conserva o item original. O resultado do raw referencia os IDs dos itens, inclusive em replay entre raw events. Não usa apenas memória para deduplicação.

## 13. Retry e recovery

Lease de 60 s; oito tentativas no máximo; backoff de `2^attempt` segundos com teto de 900 s. Uma reserva expirada na oitava tentativa é encerrada como terminal. Falhas de transporte não registram texto original de exceção. Raw nunca é apagado automaticamente por esgotamento.

Runner com arquivo privado **já existente**, sem sobrescrever `.env`:

```sh
ATTENDANCE_ALLOW_PRODUCTION_MUTATIONS=true node scripts/attendance-meta-process.js .env.local EVENT_UUID
ATTENDANCE_ALLOW_PRODUCTION_MUTATIONS=true node scripts/attendance-meta-process.js .env.local due 25
```

Esses comandos são operacionais para o projeto principal fixado pelo guard. `due` respeita disponibilidade/lease e processa no máximo 100 eventos por invocação. Não exigem App Secret nem senha PostgreSQL, pois usam as RPCs com service role existente.

Depois de corrigir configuração, eventos retryable voltam pela fila. Para terminal/unhandled, o operador deve investigar o raw, corrigir código/configuração e revisar uma transação restrita ao UUID: reabrir o raw e somente itens malsucedidos pertinentes, preservando itens processados e chaves semânticas. Não existe reset em massa ou retry infinito automático. A recuperação remota comprovada usou o mesmo raw, após corrigir o vínculo sintético, e criou uma mensagem na tentativa 2.

## 14. Failure states e unhandled

Estados do raw: received, processing, processed, retryable_failed, terminal_failed, unhandled. Itens guardam estado próprio; lote misto pode ter sucessos confirmados e um irmão pendente. Eventos/tipos desconhecidos, identificadores insuficientes e textos incompatíveis permanecem investigáveis.

Um envelope inválido/assinatura inválida não recebe ACK de sucesso nem entra no banco. Um envelope válido capturado que exceda a capacidade do normalizador permanece terminal com raw recuperável; aprovação de capacidade para lotes grandes não foi inferida de fixtures pequenas.

## 15. Concorrência e evidência remota

Run sintético: `attendance-prod-validation-20260915030312743-c82d54a1`.

- 20 entregas HTTP assinadas concorrentes: um raw, 20 deliveries.
- 20 processadores concorrentes do mesmo raw: uma mensagem criada.
- Duas mensagens distintas do mesmo contato em paralelo: uma conversa e sequências consistentes.
- Ao final: 31 deliveries, 11 raws, 9 processed e 2 unhandled; 6 mensagens incluindo preparação/intent interno. Nenhum envio Meta.
- Zero duplicatas, vínculos internos inesperados, última mensagem inconsistente ou outbox apto a dispatch.

O transporte remoto medido foi **HTTP localhost assinado → PostgREST principal**; não é Meta/Vercel E2E. Pico observado: 20 requisições HTTP; não é medição de waiters simultâneos no PostgreSQL.

## 16. Observabilidade e ACK

Logs estruturados contêm request/raw/item IDs, provider, tentativa, estado, IDs de conexão/conversa/mensagem quando disponíveis e hashes de IDs externos. Não incluem texto da mensagem, telefone, headers, token, assinatura ou exceções brutas.

Counters: `webhook_received_total`, `webhook_signature_invalid_total`, `webhook_duplicate_total`, `event_processing_success_total`, `event_processing_failure_total`, `event_retry_total`, `unhandled_event_total`, `inbound_message_created_total`. Latências: `webhook_ack_latency`, `event_processing_latency`. `duplicate_persistence_count` é verificado por consulta de invariantes; não é um zero emitido artificialmente a cada request. Sem nova plataforma de métricas instalada.

ACK p95: **2101,25 ms**, 20 amostras concorrentes, origem local e Supabase principal. Meta operacional `<500 ms` **não atingida nesse ensaio**; latência real Vercel ainda não medida. Não responder antes do commit para aparentar cumprir o SLO. Reavaliar região, cold start, pool e contenção com deployment real e amostras suficientes.

## 17. Secrets e configuração

Nenhum secret foi exibido, criado para a Meta ou escrito em `.env`. Secrets sintéticos de assinatura existiram apenas na memória dos testes locais. A credencial Supabase existente foi reutilizada; migrations usaram a sessão administrativa já autenticada. Não foi necessária senha PostgreSQL.

| Nome | Origem verificada | Presente |
| --- | --- | --- |
| `SUPABASE_URL` | `.env.local` / Vercel Production | Sim |
| `SUPABASE_SERVICE_ROLE_KEY` | `.env.local` / Vercel Production | Sim |
| `META_APP_SECRET` | arquivos locais inspecionados / Vercel Production | Não |
| `META_WEBHOOK_VERIFY_TOKEN` | arquivos locais inspecionados / Vercel Production | Não |
| `META_APP_ID` | Vercel Production | Não; informativo, não usado pelo HMAC |
| `META_INBOUND_ENABLED`, `META_OUTBOUND_ENABLED` | Vercel Production | Não |
| `APP_ENV`, `SUPABASE_ENV_SCOPE`, `SPACE_PRODUCTION_SUPABASE_URL` | Vercel Production | Não |
| `ATTENDANCE_PRODUCTION_PROJECT_REF`, `ATTENDANCE_ALLOW_PRODUCTION_MUTATIONS` | Vercel Production | Não |
| `ATTENDANCE_FOUNDATION_ENABLED` | Vercel Production | Não |

O App Secret deve vir das configurações do app Meta com seu administrador. O verify token é o segredo escolhido para verificar o callback, normalmente guardado no gerenciador de secrets/configuração da integração e reutilizado na configuração Meta; não é um Graph access token. Não foi encontrado valor reutilizável nessas fontes. Também é preciso vincular WABA e phone number ID reais às conexões/canais confiáveis. Esses IDs não substituem os secrets.

O guard do webhook exige inbound habilitado, outbound ausente/false, ambiente principal explícito, project ref e hash da service role vinculados pela política existente. As flags de autorização usadas no processo operador não foram publicadas na Vercel. Mudanças de configuração global devem ser coordenadas com os demais módulos. [Inventário de presença, sem valores](evidence/attendance-meta-config-presence-2026-09-15.json).

## 18. Testes e evidências

[Testes dedicados](../tests/attendance-meta-inbound.test.js): verification, HMAC/bytes, limites, getter lazy, HTTP ACK durável, indisponibilidade, normalização, injeção de IDs, PostgreSQL/PostgREST, concorrência, replay, status, recovery, terminal, ACL, Unicode e cleanup com sentinela alheia.

Resultado final: **15/15 testes dedicados passaram**, sem skips. Regressão geral: **485 testes, 477 passaram, zero falhas, 8 skips** de suítes opt-in. O número global inclui trabalho de outros módulos presente na árvore compartilhada; não representa 485 testes novos de Atendimento. Uma execução intermediária encontrou a imagem Docker indisponível no cache; após restaurar a mesma imagem oficial, a execução dedicada final passou integralmente.

```sh
ATTENDANCE_SQL_INTEGRATION=true ATTENDANCE_TEST_POSTGRES_MAJOR=17 node --test tests/attendance-meta-inbound.test.js
npm test
```

Evidências sanitizadas:

- [Antes](evidence/attendance-meta-before-2026-09-15.json) e [após extensão](evidence/attendance-meta-after-2026-09-15.json).
- [HTTP sintético remoto](evidence/attendance-meta-http-results-2026-09-15.json), [recovery](evidence/attendance-meta-recovery-2026-09-15.json), [Unicode](evidence/attendance-meta-unicode-2026-09-15.json).
- [Métricas SQL finais](evidence/attendance-meta-metrics-2026-09-15.json).
- [Catálogo final](evidence/attendance-meta-catalog-final-2026-09-15.json), [cleanup](evidence/attendance-meta-cleanup-2026-09-15.json) e [conferência independente pós-commit](evidence/attendance-meta-post-cleanup-2026-09-15.json).
- [Gates e testes finais](evidence/attendance-meta-gate-2026-09-15.json).

Os scripts de preparação/execução ficam em [attendance-meta-validation.js](../scripts/attendance-meta-validation.js). Fixtures usam conexão marcada pelo operador, provider real do adaptador, IDs sintéticos e outbox `failed`, `available_at=infinity`, `dispatch_disabled=true`, `attempts=0`. Não representam destinatários Meta reais.

## 19. Segurança, cleanup e riscos

`sendMetaMessage()` sempre lança `meta_outbound_not_implemented`, inclusive se alguém tentar habilitar uma flag. Não existe código de envio no novo adaptador. A foundation pode gerar intents internos; nenhuma rotina Meta os consome nesta entrega. Consumidores externos legados não foram auditados exaustivamente; os testes remotos usaram quarentena explícita.

O ambiente principal não possui PITR/backup agendado conforme a auditoria da foundation. As mudanças são aditivas; rollback operacional consiste em desabilitar ingress/runner e preservar raw/schema para investigação. Não há down destrutivo.

A primeira tentativa de cleanup falhou na geração do delimitador SQL, sem commit. O gerador foi corrigido e recebeu teste de preservação de sentinela. A limpeza é restrita aos UUIDs do manifesto e à conexão com o marcador da execução; mensagens/eventos reais não integram esse escopo. A verificação pós-commit é obrigatória e registrada em evidência própria.

Conferência independente final: **zero raw events, zero itens e zero conexão da fixture remanescentes**, 14 tabelas da foundation e duas tabelas Meta preservadas, trigger de eventos imutáveis habilitado. O catálogo final encontrou zero conexões/canais Meta reais configurados. As migrations desta fase foram aplicadas em ordem; reaplicar a migration histórica da foundation isoladamente não é procedimento de atualização dessa extensão.

Persistem: implantação/configuração do webhook, tráfego Meta controlado, autenticação Firebase E2E, SLO de ACK, execução recorrente do worker, política operacional de retenção/acesso aos raws e validação dos formatos efetivos dos ativos Meta. Não há aprovação de carga ou resiliência ilimitada baseada neste volume sintético.

## 20. Gates e próximos passos

Os seis indicadores de integridade/segurança foram zero nos cenários executados; o gate global continua **BLOCKED**, pois a API Vercel real não está validada funcionalmente, não houve tráfego Meta e o ensaio de ACK excedeu 500 ms. Os zeros são observações dos testes e das consultas SQL, não garantia universal de ausência de perda.

Próxima fase: concluir **Meta Inbound**, reaproveitando os secrets do app quando disponibilizados, configurando os ativos e guards, implantando somente esta entrega, operando o runner e repetindo verification/HMAC/recovery/latência na Vercel real. Depois de aprovar esse gate, planejar outbound separadamente. Não avançar para dispatcher ou Inbox UI para contornar esta pendência.
