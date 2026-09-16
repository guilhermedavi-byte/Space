# Atendimento — Messaging Foundation implementada

## Política vigente — decisão executiva de 15/09/2026 UTC

**A Space optou temporariamente por usar o ambiente principal como ambiente de desenvolvimento/homologação do módulo Atendimento porque não há usuários ativos na plataforma neste momento**, conforme informado pelo responsável.

A ausência de staging deixou de ser requisito de bloqueio. Produção é permitida somente para o projeto principal conhecido, com credencial vinculada e `ATTENDANCE_ALLOW_PRODUCTION_MUTATIONS=true`; sem isso, o guard continua fail-closed. Os guards dos demais módulos não são relaxados por essa flag.

**Foundation aprovada no PostgreSQL/PostgREST principal:** migration aplicada, catálogo conferido, testes remotos concluídos e fixtures removidas. Relatório vigente: [homologação em produção](attendance-production-validation.md). As referências a staging obrigatório, produção proibida ou homologação pendente no registro abaixo descrevem fases anteriores e foram substituídas por esta decisão.

---

## Registro histórico da fase anterior

Data: 14/09/2026. Repositório: `/Users/spaceonline/Documents/New project`.

**Situação:** implementação local com migration e testes reais de PostgreSQL/PostgREST. Homologação no Supabase staging **bloqueada por ausência de configuração verificável**. Nenhuma migration externa, chamada Meta ou alteração de dado de produção foi executada. A API nova permanece desabilitada por padrão e recusa produção nesta fase.

Este documento complementa [a auditoria original](attendance-whatsapp-architecture.md), que permanece preservada. O pedido desta fase reduziu o escopo de jobs/realtime: implementamos persistência e contratos, sem worker ou transporte externo.

## 1. Arquitetura encontrada e divergências confirmadas

- Backend CommonJS na Vercel, handlers em `api/`; Firebase Auth e perfil em Firestore `users/{uid}`; Supabase por PostgREST em `api/_lib/supabase-rest.js`.
- `resolveAdminRequestAuth` autentica e carrega perfil, mas não verifica sozinho `active` nem restringe a admin. A camada nova acrescenta essas verificações e não altera o helper compartilhado.
- Papéis globais determinam elegibilidade; não existia membership por time de atendimento no código auditado. `growthPeople` é configuração comercial, não cadastro de autenticação.
- O catálogo OpenAPI do Supabase já configurado foi consultado com **GET somente de schema**, sem leitura de linhas. Esse ambiente está marcado `VERCEL_ENV=production` nos dois arquivos locais disponíveis. Nenhuma consulta SQL/migration foi enviada a ele.
- O catálogo revelou legados adicionais: `datacrazy_conversas`, `n8n_status_atendimento`, `n8n_fila_mensagens`, `n8n_historico_mensagens`, `n8n_chatwoot_contatos_space`, `n8n_contatos_internos_space` e `n8n_sales_team_space`. A auditoria inicial, estática, não havia confirmado essas tabelas.
- Os schemas desses legados usam telefone/session_id ou registros de pessoas comerciais. `n8n_sales_team_space` contém `team_member_id`, nome, aliases, email e ativo; não é uma entidade time com UID Firebase e memberships. Não é seguro usá-los como ACL ou identidade canônica.
- Não houve colisão dos nomes finais das 14 tabelas de domínio no catálogo consultado. `audit_logs` e `outbox_events` existem com o mesmo contrato de colunas declarado na Retenção v2; foram reutilizados, sem criar outro log/fila genérico.

Limites dessa inspeção: OpenAPI não demonstra todas as constraints, policies, jobs externos ou grants instalados. O inventário SQL de staging continua obrigatório antes do rollout. Legados e automações existentes não foram migrados/removidos.

## 2. Arquitetura implementada

```text
Navegador autenticado (ainda sem Inbox)
  → /api/attendance (flag + staging obrigatório)
  → Firebase ID token + perfil atual ativo + capability
  → attendance-store → supabaseFetch → RPC Postgres
  → membership habilitado + time/canal permitido
  → mensagem/conversa/evento/audit/outbox na mesma transação

Futuro adapter externo confiável
  → store.ingestMessage(evento normalizado)
  → attendance_ingest_message
  → contato externo não identificado + conversa + mensagem + eventos
```

Fonte de verdade do Atendimento: Postgres. Cadastros de alunos/leads e usuários continuam nos sistemas atuais. Meta é um futuro adapter; o schema usa `provider`, IDs opacos e content type extensível. Nenhuma conta Meta é criada ou configurada pelo código.

Foi implementado um endpoint compacto compatível com o padrão existente, sem framework, SDK novo ou alteração do frontend. Todas as chamadas ao banco são parametrizadas via JSON de RPC.

## 3. ERD textual

```text
connections 1──N channels N──N teams
teams N──N attendance_members ──referência textual──> Firestore users/{uid}
connections 1──N contact_identities N──1 contacts
channels + contacts 1──N conversations
  └─ no máximo uma conversa open/pending por canal + contato
conversations N──1 teams; responsável opcional pertence a esse time
conversations 1──N conversation_participants
  ├─ external → contact_id; vínculo interno opcional e contextual
  └─ agent → user_uid
conversations 1──N messages → sender_participant / reply na mesma conversa
conversations 1──N conversation_events / conversation_reads
channels + contacts → channel_contact_state (última inbound entre episódios)
conversation_events → audit_logs
messages / commands → outbox_events (somente namespace attendance.*)
```

Não há FK para aluno/lead ou para `auth.users` do Supabase. UID Firebase é texto, não UUID.

## 4. Tabelas criadas e compartilhadas

| Tabela | Responsabilidade |
| --- | --- |
| `connections` | Provider, IDs/tipo da conta externa, nome, status, metadata não secreta |
| `channels` | Endpoint externo dentro da conexão, time padrão, status e nome |
| `teams` | Time operacional com nome/ativo |
| `attendance_members` | Habilitação local por UID Firebase; não replica senha/perfil |
| `team_members` | Associação usuário/time, ativo e papel `agent/supervisor` |
| `channel_teams` | Times autorizados a operar em cada canal |
| `contacts` | Contato externo mínimo e nome apresentado |
| `contact_identities` | Identificador externo por conexão/tipo; telefone original/candidato normalizado separado |
| `channel_contact_state` | Última mensagem do usuário por canal/contato, preservada entre conversas |
| `conversations` | Canal, contato, time, responsável, estado, prioridade, metadata, sequência, versão e última mensagem |
| `conversation_participants` | Participante externo ou usuário interno; resolução opcional da identidade contextual |
| `messages` | Direção, content type, conteúdo JSON, remetente, reply/context, IDs externos, estado e timestamps |
| `conversation_reads` | Última sequência lida por UID/conversa |
| `conversation_events` | Eventos append-only e resultado idempotente dos comandos |
| `audit_logs` — compartilhada | Espelho de auditoria de ações/eventos, usando estrutura já existente |
| `outbox_events` — compartilhada | Efeitos posteriores por referência, sem conteúdo integral e sem dispatcher nesta fase |

As duas tabelas compartilhadas são criadas somente quando ausentes, com o contrato da Retenção. A migration não aplica toda a Retenção nem altera seus consumidores. As 14 tabelas de domínio são novas; os nomes sem prefixo de ferramenta seguem ADR 0003.

## 5. Índices e access patterns

| Índice/constraint indexado | Consulta/garantia |
| --- | --- |
| `connections(provider,external_account_type,external_account_id)` unique | Conta externa inequívoca |
| `channels(connection_id,external_channel_id)` unique | Encontrar endpoint dentro da conexão |
| `contact_identities(connection_id,identifier_type,external_identifier)` unique | Encontrar contato sem lookup por telefone |
| `conversations_one_active_contact_idx` parcial | Uma conversa não resolvida por canal/contato |
| `conversations_team_queue_idx` | Fila por time/estado, última atividade de mensagem e ID como desempate |
| `conversations_assignee_queue_idx` parcial | Fila do responsável, sem indexar responsável nulo |
| `messages(conversation_id,sequence)` unique | Timeline cronológica de ingestão com keyset; o mesmo índice atende leitura reversa |
| `messages(channel_id,external_message_id)` unique | Dedupe por endpoint externo |
| `messages(channel_id,external_event_id)` unique | Dedupe opcional de item normalizado externo |
| `messages(conversation_id,author_uid,client_request_id)` unique | Intenção outbound/nota repetida |
| `conversation_events_timeline_idx` | Eventos por conversa/instante/ID |
| `conversation_events(conversation_id,actor_uid,client_action_id)` unique | Comando idempotente |
| `team_members_user_idx` parcial | Memberships ativos por UID |
| PKs de `channel_teams`, `channel_contact_state`, `conversation_reads` | ACL de canal/time, janela entre episódios e cursor individual |

FKs compostas também exigem uniques auxiliares para garantir referência à mesma conversa. Não foi criado índice de telefone: esta fase não consulta identidade por telefone. Não há busca vetorial, partição ou duplicação de índice de timeline sem necessidade.

## 6. Constraints e integridade

- UUIDs locais, identificadores externos não vazios/limitados; provider e kind com formato delimitado.
- FKs entre conexão/canal, time/membership, canal/time, contato/conversa, mensagem/conversa e participante/conversa.
- Time padrão de canal deve constar em `channel_teams`; FK diferida permite provisionar ambos na mesma transação.
- Responsável deve pertencer ao time da conversa por FK composta. A RPC verifica também membro habilitado/ativo, time ativo e grant de canal.
- `reply_to_message_id` e `last_message_id` devem apontar para mensagens da mesma conversa.
- Trigger de sender verifica papel externo para inbound, agente para outbound/internal e igualdade entre autor e participante.
- Estados de conversa: `open`, `pending`, `resolved`; `resolved_at` coerente com estado. Prioridade: `normal/high/urgent`.
- Mensagens: `inbound/outbound/internal`; inbound requer ID externo/estado received; outbound requer autor/chave local; nota interna não recebe ID externo.
- Tipos são strings extensíveis (`text/image/audio/video/document/location/template/interactive` cabem no mesmo contrato). Não há processamento de cada mídia implementado.
- Content JSON com limite de tamanho; metadata objeto limitado, sem arrays/envelopes arbitrários e com rejeição recursiva de chaves de credenciais. Isso não é detector universal de segredo inserido sob nome enganoso; credenciais não pertencem a esses campos.
- `normalized_phone` obedece formato internacional candidato e estado `format_only`. Vínculo interno é opcional; linked requer origem, tipo, ID, autor e momento da associação manual.
- Cursor não pode ser negativo; a RPC também limita à sequência persistida e avança monotonicamente.

## 7. RPCs e service layer

Somente seis RPCs são executáveis por `service_role`:

| RPC | Contrato |
| --- | --- |
| `attendance_ingest_message(p_event)` | Ingestão atômica de uma mensagem externa normalizada, com conexão/provider/canal conferidos |
| `attendance_append_message(p_actor_uid,p_conversation_id,p_message)` | Intenção outbound `pending` ou nota `internal` com chave idempotente |
| `attendance_update_conversation(p_actor_uid,p_conversation_id,p_command)` | Assignment/time, status, patch de metadata ou vínculo manual interno, com versão e chave do comando |
| `attendance_mark_read(p_actor_uid,p_conversation_id,p_sequence)` | Cursor individual monotônico |
| `attendance_get_conversation(...)` | Detalhe/participantes/unread ou página de mensagens autorizada |
| `attendance_list_conversations(p_actor_uid,p_filters)` | Fila limitada por ACL, filtros e cursor de última mensagem/ID |

Helpers de normalização, metadata, ACL, auditoria e triggers são privados por grants. Funções `SECURITY DEFINER` têm `search_path` fixo. A autenticação não ocorre pelo argumento `p_actor_uid`: só o backend com service role pode executar e ele o extrai do token verificado. Quem possui service role continua sendo um principal privilegiado; não é uma credencial de navegador.

API atual:

- `GET /api/attendance`: lista. Filtros `team_id`, `assigned_user_uid`, `status`, `before_time` + `before_id`, `limit` (máximo 100).
- `GET /api/attendance?conversation_id=<uuid>&view=detail`: detalhe; `view=messages&after=<sequence>&limit=50`: página cronológica.
- `POST /api/attendance`: `action=message`, `update` ou `read`. Ator nunca vem do body. `message` retorna `202` com pending/internal; não representa entrega externa.
- `update` suporta status/assignment/metadata pelo HTTP. O comando identity é permitido somente pela interface interna explícita do store/RPC, preparando associação futura. Não existe endpoint público de resolver/associação nesta fase.
- Inbound **não tem endpoint HTTP**, nem endpoint de fixtures. O futuro adapter poderá chamar o método interno `ingestMessage`.

## 8. Fluxo inbound futuro suportado

```text
adapter valida assinatura/origem/lote e produz um item normalizado
  → connection_id + provider + channel_id consistentes
  → lock de mensagem externa e comparação idempotente
  → lock da identidade externa da conexão
  → obter/criar contato sem resolver pessoa
  → lock/obter/criar conversa ativa
  → participante externo + mensagem + sequência
  → last_message / last_inbound / channel_contact_state
  → conversation_event + audit_log + outbox
  → commit e retorno do ID persistido
```

Qualquer falha desfaz todos os efeitos. Canal desconhecido/desabilitado ou time desabilitado causa erro. Future adapter deverá colocar esses casos em inbox/quarentena durável antes de confirmar webhook; a inbox de entregas não está implementada aqui.

`external_event_id`, quando usado, identifica **um item normalizado**, não o envelope inteiro de um lote. Dois itens diferentes não podem compartilhar essa chave; o futuro adapter deve compô-la com o ID de mensagem quando o provedor só dá ID de entrega.

## 9. Fluxo outbound futuro suportado

```text
Firebase + perfil ativo + capability + membership do time/canal
  → validar intenção/chave/reply/conversa
  → mensagem pending + last_message + auditoria + outbox na mesma transação
  → retornar ID local
  → [fase posterior] dispatcher reivindica intenção
       → revalida autorização/canal/janela/template/opt-out
       → provider → recibos e reconciliação
```

`outbox_events.event_type=attendance.message.pending` é um contrato durável de intenção, não uma instrução já consumida por worker. O payload guarda IDs, sem token ou conteúdo integral. Notas usam `attendance.message.created` e nunca devem ser enviadas ao provedor.

Nenhum claim/lease/retry scheduler foi criado. Antes de habilitar tráfego externo, implementar dispatcher que reivindique apenas seus tipos de evento, preserve ordem por conversa e trate aceitação sem resposta como `unknown`, sem reenviar cegamente. A janela de 24h e templates não são validados nesta fase porque não há envio externo.

## 10. Idempotência

- Uniques de banco são a barreira final; aplicação não decide por SELECT/INSERT separados.
- Inbound usa ID oficial no escopo do canal, que pertence a uma conexão/provider. Repetir a mesma mensagem retorna o ID/sequência originais sem atualizar contador, timestamps, auditoria ou outbox.
- Fingerprint SHA-256 calculado no banco sobre conteúdo canônico, contato/tipo, kind, timestamp do provedor e reply externo. Mesmo ID com esses campos conflitantes retorna conflito; metadata/display name não altera retroativamente a primeira mensagem.
- Replay após conversa resolvida encontra primeiro a mensagem original e não cria episódio vazio.
- Outbound/nota: chave por conversa/ator + fingerprint do comando normalizado. Retry de um comando idêntico devolve o resultado anterior; conteúdo diferente com a mesma chave é rejeitado.
- Comandos de status/assignment/metadata/identity: chave por conversa/ator, fingerprint e resultado gravados no evento append-only.
- Dois IDs oficiais distintos com conteúdo igual são duas mensagens legítimas; não deduplicar texto, telefone ou hash do corpo sozinho.

## 11. Concorrência

Locks transacionais de advisory por ID de mensagem e identidade externa serializam criações conflitantes; constraints mantêm unicidade. Bloqueio `FOR UPDATE` na conversa protege sequência, last_message, status, time e metadata. Ordem interna de locks: mensagem → identidade → conversa. IDs não vêm de contador em memória.

Comandos humanos carregam `expected_version`. Um vence; o concorrente recebe `409` e deve recarregar/reavaliar. **Usamos SQLSTATE `PT409`, não `40001`**: o teste real demonstrou que PostgREST/Hasql repete erros de serialização, o que não é apropriado para conflito otimista de negócio.

Última mensagem é a de maior sequência de ingestão. Provider timestamp permanece independente; inbound atrasada não retrocede `last_inbound_at` nem janela por canal/contato. Metadata usa merge sob lock com controle de versão, não substituição de objeto desatualizado no navegador.

Os testes de corrida criam requests HTTP simultâneos, seguram locks reais e verificam múltiplos backends esperando em `pg_stat_activity`. Não são chamadas sequenciais encapsuladas em Promise.all.

## 12. Autorização

1. Flag `ATTENDANCE_FOUNDATION_ENABLED=true` e ambiente staging verificável.
2. Firebase ID token Bearer pelo helper existente; UID consistente entre token, sessão derivada e perfil.
3. `profile.active === true`; aluno é negado. `admin/growth/financeiro/teacher` são elegíveis às capacidades do módulo.
4. No banco, `attendance_members.enabled`, `team_members.active`, `teams.active` e vínculo em `channel_teams`.
5. Assignment/transferência/identity exigem supervisor. Transferência requer supervisor com acesso aos times de origem **e destino**; destinatário precisa de membership habilitado no destino.
6. HTTP de assignment também reconsulta o destinatário no Firestore para existência, papel interno e ativo. FKs locais não podem validar o estado remoto do Firebase.

Não há acesso global automático para admin; essa escolha restritiva registra a decisão de negócio ainda pendente. Supervisores/membros/canais são provisionados por operador confiável em staging; não foi criada API para conceder privilégios a si mesmo.

## 13. Isolamento por time e realtime

- RLS habilitada nas novas tabelas. Sem policy pública, sem leitura/escrita direta por `anon`, `authenticated` **ou service_role** nas 14 tabelas de domínio. Apenas RPCs específicas recebem EXECUTE.
- Cada RPC de usuário verifica UID/time/canal antes de ler ou escrever. Listagens filtram ACL; consulta direta a conversa inacessível recebe forbidden. Participar historicamente não mantém autorização após transferência.
- Shared audit/outbox mantêm grants existentes para não quebrar Retenção. O backend deve permanecer a única fronteira de acesso a essa infraestrutura. `conversation_events`, protegido contra update/delete e sem grants diretos, é o histórico autoritativo do domínio.
- Identidade manual é contextual ao participante externo da conversa. Associar identidade num time não altera todas as conversas do contato em outros times. Não existe lookup global público por telefone.
- Revogação vale nas próximas requisições; não há transação distribuída entre alteração do Firestore e autorização Postgres. Revalidar perfil por request e bloquear membership local cobre o fluxo atual; política de revogação instantânea de streams é decisão futura.

Modelo compatível com Supabase Realtime por PKs locais, timestamps, versão, eventos e outbox. Estratégia futura: notificação mínima por UID e fetch pela API com ACL atual. Tabelas candidatas a emissão: `conversation_events`/`conversations`, via outbox; **não publicar mensagens brutas, contato, audit/outbox ou metadados de conexão indiscriminadamente**.

Firebase third-party trust, custom claim técnica, policies de canal, renovação de JWT e cache de autorização Realtime continuam pendentes. Cookie Space não é token Supabase. Nenhuma publication/subscription/realtime policy foi habilitada.

## 14. Auditoria

Eventos: `conversation.created`, `message.created`, `assignment.changed` (inclui time), `status.changed`, `metadata.changed`, `identity.changed`. Guardam ID, ator humano ou source provider, instante de banco e dados necessários do antes/depois. Entrada de provider não fabrica UID humano.

Evento e `audit_logs` são gravados na mesma transação. Auditoria não copia conteúdo de mensagem, telefone ou credenciais. Mensagens/outbox se referenciam por ID. Logs da API retornam erros sanitizados e não imprimem corpo upstream.

Read cursors são estado individual, não log de cada leitura. Exportação e auditoria de consulta a conteúdo sensível ficam para a fase de Inbox/privacidade.

## 15. Identidade e telefone

`contact_identities` usa `(connection_id, identifier_type, external_identifier)`; número não é chave universal. O identificador pode ser telefone ou outro ID opaco, inclusive sem número visível. Nome do contato não substitui o cadastro.

Normalizador SQL único nesta fase:

- conserva original;
- aceita número com `+` explícito como candidato de formato internacional;
- BR nacional só recebe `55` com country calling code explícito e 10/11 dígitos; DDD 55 não é confundido com DDI;
- NANP nacional de 10 dígitos admite `1` explícito;
- demais nacionais/`00` sem interpretação segura ficam `needs_country`;
- ramais/caracteres estranhos/formatos muito curtos ficam invalid;
- nunca insere/remove nono dígito, busca sufixo ou cria link de pessoa.

`format_only` não afirma existência, titularidade, WhatsApp ativo nem validação completa de planos nacionais. Ampliar validação internacional requer biblioteca/contrato específico futuro; evitar falsa certeza hoje.

`conversation_participants` suporta `unidentified/ambiguous/linked`. O vínculo posterior requer fonte, tipo `lead/student`, ID, confiança manual, origem, ator e data. RPC suporta associação/desassociação e auditoria; a interface interna só deve ser usada por serviço confiável após verificação do cadastro de origem. O teste usa IDs sintéticos no PostgreSQL real para provar integridade opcional, não para afirmar que existe um aluno no Firestore.

## 16. Decisões adiadas

- Credenciais: nenhuma coluna de token criada. Alternativas: secret manager com referência ou schema privado com ciphertext e chave fora do banco. Nenhuma foi improvisada.
- Isolamento de empresas: uma instalação Space; times/números não são tenants. Multiempresa requer decisão e migration antes de uso por terceiros.
- Reabertura: resolved não reabre por comando nesta fase; inbound nova cria episódio novo. Pending permanece pending ao receber mensagem. Regras automáticas de reabertura/snooze precisam de decisão de produto.
- Assignment: supervisor-only; assumir livremente, acesso global admin e supervisor de múltiplos times precisam de definição explícita.
- Identity resolver global, normalização internacional completa, propagação de vínculos entre times e validação de ID DataCrazy ficam para fase própria.
- Modelo completo de anexos, recibos de entrega, ingestão de envelopes webhook e retenção de raw payload serão adicionados pelo adapter; schema de mensagens já acomoda conteúdo tipado/contexto.
- Dispatcher e operações de receipt/status do transporte ainda não existem. Outbound permanece pending. Nenhum código deve promovê-lo a sent por timer ou pela resposta HTTP local.

## 17. Riscos e limites

1. **Staging remoto indisponível:** não há homologação de projeto Supabase/Firebase reais, grants instalados, quotas ou deploy Vercel. Validação local não deve ser descrita como validação em produção/staging cloud.
2. **Shared outbox:** revisar consumidores externos antes do rollout; devem filtrar seus namespaces e não processar `attendance.*` prematuramente. A auditoria de código não comprova automações fora do repo.
3. **Service role privilegiada:** quem a possui pode invocar RPC com outro UID. Não há bypass permitido ao navegador; nunca publicar essa chave.
4. **Identidade remota:** Postgres não valida uma FK Firestore. Manual linking permanece interface interna; não é resolver de identidade implementado.
5. **Telefone não é prova de pessoa:** associação automática ausente por escolha; pode haver contato repetido entre conexões até futuro merge explícito.
6. **Sem semântica de entrega externa:** pending prova persistência da intenção; não prova que WhatsApp receberá mensagem. Unknown/reconciliation e regras Meta continuam obrigatórias antes do envio real.
7. **Timestamp externo não confiável:** adapter futuro deve validar payload/autenticidade e timestamps anômalos. Sequência local continua independente.
8. **Metadata é informação não secreta:** bloqueio de chaves comuns reduz erro acidental, não autoriza guardar secrets sob chaves alternativas.

## 18. Migration e aplicação segura

[202609140001_attendance_foundation.sql](../supabase/migrations/202609140001_attendance_foundation.sql) é transacional, aditiva e reaplicável; não remove dados ou tabelas legadas. Reaplicação preserva dados e reinstala somente seus triggers/funções/grants. PostgreSQL 14+ e roles Supabase `anon`, `authenticated`, `service_role` são pré-requisitos; testes usam PostgreSQL 16.

**Aplicação externa não realizada.** Os únicos arquivos reais de ambiente disponíveis (`.env.local`, `.env.vercel.pull`) indicam produção e não definem `SPACE_STAGING_SUPABASE_URL`. `.env.staging.example` é exemplo vazio, não credencial de staging. Não há permissão para inferir staging a partir do nome de arquivo, hostname parecido ou APP_ENV isolado.

Antes de aplicar remotamente:

1. Obter Supabase e Firebase de staging identificados, URL de staging e referência distinta de produção.
2. Inventariar schema/grants, funções, nomes e consumidores outbox no destino. Validar estrutura das tabelas compartilhadas.
3. Aplicar migration na conexão de staging confirmada, usando runner/SQL editor desse projeto e registro de versão. Este repo não possuía pipeline uniforme de migrations; não foi improvisado um comando de aplicação automática em produção.
4. Provisionar conexão/canal/times/memberships de teste em transação; só UIDs reais de teste no Firestore. Channel e channel_teams devem ser criados juntos por conta da FK diferida.
5. Configurar `ATTENDANCE_FOUNDATION_ENABLED=true`, `APP_ENV=staging`, `SUPABASE_ENV_SCOPE=staging`, `SPACE_STAGING_SUPABASE_URL` exatamente igual a `SUPABASE_URL`, `SPACE_PRODUCTION_SUPABASE_URL` distinto, mais requisitos normais de `_lib/runtime-env.js`.
6. Reexecutar testes/homologação com fixture explicitamente de teste. Validar Firebase/Auth e API Vercel no ambiente real antes de promover.

Rollback operacional: manter flag desligada e interromper consumo do namespace Atendimento. Não apagar tabelas/dados compartilhados. Não foi criada down migration destrutiva.

## 19. Arquivos criados e alterados

Criados nesta implementação:

- [migration](../supabase/migrations/202609140001_attendance_foundation.sql)
- [attendance-domain.js](../api/_lib/attendance-domain.js)
- [attendance-auth.js](../api/_lib/attendance-auth.js)
- [attendance-store.js](../api/_lib/attendance-store.js)
- [api/attendance.js](../api/attendance.js)
- [attendance-api.test.js](../tests/attendance-api.test.js)
- [attendance-sql-integration.test.js](../tests/attendance-sql-integration.test.js)
- [harness PostgreSQL/PostgREST](../tests/helpers/attendance-postgres.js)
- este documento.

Arquivos existentes alterados: **nenhum**. `package.json`, lockfile, Firebase rules, módulos legados, frontend e auditoria original preservados. Alterações paralelas no workspace não pertencem a esta entrega.

## 20. Testes e resultados

Há duas camadas, com propósitos distintos:

- Unitários de fronteira: autenticação, gate staging, validação, ator do token, ausência de endpoint inbound, erros sanitizados e uso de RPC. Stubs nessas fronteiras não validam banco.
- Integração real: containers descartáveis PostgreSQL 16 + PostgREST 12, JWTs de teste locais, grants, SQL e requests HTTP concorrentes. Não usa banco em memória ou simulação de constraints. Não recebe URL/credencial de banco externo. Containers/rede próprios são removidos ao terminar; porta HTTP publicada somente em loopback e banco sem porta publicada.

Cenários cobertos: persistência inbound/outbound/nota, replies, paginação/last_message, replay, conflitos, dois canais, 20 duplicates concorrentes, 20 criações concorrentes de mesma conversa, metadata/assignment concorrentes, metadata versus nova mensagem, times, membro desabilitado, transferências, referências inválidas, sender/estado/secrets, vínculo manual posterior, normalização sem resolver, leitura individual, resolução/replay, grants/RLS, evento imutável, rollback por falha outbox, reaplicação e compatibilidade com SQL de Retenção.

Resultados finais nesta máquina:

| Execução | Resultado |
| --- | --- |
| Suite dedicada com SQL habilitado | **23 testes aprovados, 0 falhas, 0 skips** (inclui teste agregador e 13 cenários reais de banco) |
| `npm test` | **289 testes: 286 aprovados, 0 falhas, 3 skips**; a integração Atendimento opt-in foi executada separadamente acima |
| Sintaxe dos quatro arquivos JS de produção novos | Aprovada com `node --check` |
| Corridas medidas em `pg_stat_activity` | 20 sessões aguardando no dedupe; 20 na criação de identidade/conversa; 2 em metadata; 2 em assignment; 2 em metadata versus mensagem |
| Cleanup de integração | Containers e rede do harness removidos |

Não há certificação de Firebase real ou Supabase cloud enquanto o blocker de staging persistir. Os cenários de banco usam payloads sintéticos em PostgreSQL/PostgREST reais; testes unitários de autenticação verificam o contrato do helper e não substituem um login real no staging.

## 21. Comandos utilizados

Na raiz `/Users/spaceonline/Documents/New project`:

```sh
node --test tests/attendance-api.test.js
RUN_ATTENDANCE_SQL_INTEGRATION=1 node --test tests/attendance-api.test.js tests/attendance-sql-integration.test.js
npm test
node --check api/attendance.js
node --check api/_lib/attendance-store.js
```

O harness exige Docker ativo e imagens locais `postgres:16-alpine` e `postgrest/postgrest:v12.2.8`; usa `--pull=never`, sem instalar dependências da aplicação. Ambas já estavam disponíveis nesta máquina. A suíte SQL é opt-in na suíte geral, como o padrão de integração SQL da Retenção; ausência de execução não equivale a teste aprovado.

Para guardar resumo sem PII/secrets, opção utilizada:

```sh
RUN_ATTENDANCE_SQL_INTEGRATION=1 ATTENDANCE_TEST_SUMMARY_PATH=/tmp/space-attendance-test-summary.json node --test tests/attendance-api.test.js tests/attendance-sql-integration.test.js
```

Também foram usados `git status`, `rg`, leitura integral da auditoria, leitura de helpers/SQL/testes existentes, inventário apenas de chaves/markers dos envs e GET OpenAPI somente de schema do banco configurado. Nenhum token, URL privada com credencial ou linha cadastral foi incluído neste documento.

## 22. Próximos passos e aceite

1. Desbloquear e homologar staging real, incluindo auth Firebase e grants/membership. A etapa não deve ser declarada homologada em staging enquanto isso não ocorrer.
2. Revisar regras de acesso/reabertura, credenciais e consumidores da outbox antes de habilitar canais reais.
3. Próxima implementação: adapter Meta oficial, verificação de webhook sobre bytes, inbox durável de entregas/recibos e dispatcher/outbox com claim/recovery, mantendo as RPCs como núcleo. Só depois implementar Inbox.

Não implementado: Meta/Embedded Signup, token de provedor, webhook público, WhatsApp Web/QR, IA, Inbox, realtime, worker/scheduler, pipeline de anexos, resolver automático ou migração de legado. Não houve escrita remota.

Aceite local exige migration reproduzível, constraints, testes de concorrência/isolamento passando e documentação. Aceite de staging permanece bloqueado e explicitamente separado do resultado local.
