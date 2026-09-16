# Atendimento Space — auditoria técnica e arquitetura WhatsApp

## Política vigente — decisão executiva de 15/09/2026 UTC

**A Space optou temporariamente por usar o ambiente principal como ambiente de desenvolvimento/homologação do módulo Atendimento porque não há usuários ativos na plataforma neste momento**, conforme informado pelo responsável.

A ausência de staging deixou de ser requisito de bloqueio. Produção é permitida somente para o projeto principal conhecido, com credencial vinculada e `ATTENDANCE_ALLOW_PRODUCTION_MUTATIONS=true`; sem isso, o guard continua fail-closed. Os guards dos demais módulos não são relaxados por essa flag.

**Foundation aprovada no PostgreSQL/PostgREST principal:** migration aplicada, catálogo conferido, testes remotos concluídos e fixtures removidas. Relatório vigente: [homologação em produção](attendance-production-validation.md). As referências a staging obrigatório, produção proibida ou homologação pendente no registro abaixo descrevem fases anteriores e foram substituídas por esta decisão.

---

## Registro histórico da fase anterior

Data: 14/09/2026. Status: **discovery e proposta; módulo não implementado**.

## Leitura rápida

1. **Banco recomendado: Supabase/Postgres.** Mensagens, conversas, atribuições, recibos e idempotência precisam de transações, unicidade e histórico consistente. O projeto já usa PostgREST e funções SQL transacionais. Firestore permanece dono dos cadastros; DataCrazy permanece dono do CRM externo.
2. **Reutilizável:** handlers Node/Vercel, Firebase Auth, leitura de perfis Firestore, cliente REST Supabase, capacidades por domínio, modelos de RPC/auditoria/outbox da Retenção, organização visual de Configurações e testes `node:test`. Reutilizar padrões não significa que estejam provisionados ou completos para Atendimento.
3. **Novo:** domínio de mensagens, autorização por time/conversa, identidade de contato, adaptador Meta, ingestão assinada e idempotente, envio durável, armazenamento privado de anexos, realtime autenticado, conexões e inbox.
4. **Maior risco:** associação incorreta entre telefone e pessoa, agravada por permissões amplas ou desatualizadas. Um match errado pode expor dados de um aluno a outro contato. Não há hoje resolver confiável de ponta a ponta.
5. **Decisões antes da implementação:** aceitar Postgres como dono do domínio; definir escopo de acesso por time; escolher operação do worker durável e ponte de autenticação do realtime; estabelecer regras de identidade ambígua, retenção e credenciais; validar modalidade/versionamento da integração Meta no ambiente que será usado.
6. **Primeiro bloco:** Messaging Foundation em staging: transação de recebimento com contato não identificado, mensagem única, conversa única ativa e evento durável, protegida por autenticação/autorização e exercitada por testes de concorrência e retry. Primeiro provar persistência e isolamento; a conexão real entra na fase seguinte.

### Escopo e grau de evidência

- Foi lido o código da árvore de trabalho, inclusive alterações locais já existentes em arquivos comerciais. Esta auditoria adiciona somente este documento e não incorpora, reverte ou aprova essas alterações.
- Foram inspecionados handlers, helpers, frontend, rules, SQL e testes existentes. Não foram feitas consultas a bancos remotos, chamadas autenticadas a provedores, alterações de dados, instalação, migrations ou deploy.
- **Encontrado** significa demonstrável no código; **proposto** significa trabalho futuro; **não confirmado** significa que requer inspeção do ambiente ou dados.
- Números de registros de `docs/DATA_MODEL.md` e `docs/ARCHITECTURE.md` são snapshots de julho, não evidência do estado de setembro. Arquivo SQL presente não prova migration aplicada. Flags declaradas não provam funcionalidade habilitada.
- As referências abaixo usam arquivo, símbolo e, em pontos críticos, linha da árvore auditada. Linhas podem mudar em alterações posteriores.
- Documentação externa foi consultada apenas para validar capacidades dos provedores. Não substitui a leitura do repositório. Requisitos operacionais Meta que dependem da conta devem ser revalidados na fase 2.

## 1. Arquitetura atual encontrada

Frontend HTML/CSS/JavaScript sem framework de aplicação declarado. `script.js` concentra navegação, estado, cadastro, pedagógico, financeiro e configurações. `api/_templates/app.html` fornece o shell; `api/app.js` resolve o acesso e serve HTML. Há páginas e scripts específicos de Growth, financeiro, salas e TVs.

O backend é formado por funções CommonJS `module.exports = async (req, res)` em `api/`. Helpers ficam em `api/_lib/` e `_lib/`; parte é reexportada e parte duplicada. Não há Express, Next.js ou ORM declarado em `package.json`; prefixos `NEXT_PUBLIC_*` em envs não tornam a aplicação Next.js.

`vercel.json` define rewrites para `/app`, dashboards e rotas API, além de headers `no-store`, proteção de MIME e framing. **Destino de deploy configurado: Vercel**, com Firebase/Firestore e Supabase externos. `firebase.json` aponta regras Firestore. `docs/staging/` e `_lib/runtime-env.js` definem separação local/staging/produção. Não foram confirmados região, plano, duração máxima das funções, projetos efetivamente ativos, cron externo ou migrations aplicadas. `vercel.json` não declara cron.

```text
Navegador → HTML/JS Space → /api/* Vercel
          ├─ Firebase Auth e algumas leituras/escritas Firestore diretas
          └─ backend → Firestore REST / conta de serviço
                     → Supabase PostgREST / service_role
                     → DataCrazy, Asaas, ZapSign, n8n e outros adaptadores
```

**Evidências:** [package.json](../package.json), [vercel.json](../vercel.json), [api/app.js](../api/app.js), [runtime-env](../_lib/runtime-env.js), [staging](staging/README.md).

## 2. Bancos e responsabilidades atuais

| Persistência | Responsabilidades encontradas | Limite relevante |
| --- | --- | --- |
| Firestore `(default)` | `users`, `classes`, `aulas`, `lessonLogs`; leads da landing; `contratos`; `growthPeople`, `growthConfig`, metas e atividade SDR; estados de TVs | Cadastro e operação comercial local; não existe schema relacional comum de identidade |
| Supabase/Postgres legado | `n8n_aulas_pedagogicas_space`, `n8n_registros_aula_space`, onboarding, preferências e outras tabelas pedagógicas; `n8n_alunos_financeiro_space`, cobranças, pagamentos e logs financeiros | Espelhos cadastrais e operação possuem responsabilidades diferentes; nome `n8n_` não significa que apenas n8n escreve |
| Supabase/Postgres CRM | `datacrazy_businesses`, `datacrazy_sync_state`, `datacrazy_sync_runs` | Espelho condicionado a `DATACRAZY_MIRROR_ENABLED`; `external_id` é ID de negócio, não ID universal de pessoa |
| Supabase/Postgres Retenção v2 | `students`, `billing_accounts`, `subscriptions`, `retention_cases`, históricos, `charges`, `payments`, `audit_logs`, `outbox_events` etc. | APIs/RPC existem; ativação depende de flags e provisioning; cadastro continua referenciado ao Firestore |
| Supabase/Postgres Growth | `growth_sales_*`, `growth_copilot_sessions`, sugestões/feedback | Domínio específico de treinamento/copiloto, não mensageria |
| Firebase Storage | Fluxos de foto/arquivos usados pelo frontend | Não foi demonstrado bucket privado adequado para anexos de atendimento |
| JSON local | Seeds em `_lib/users.js`, artefatos e adaptadores legados | Não deve ser fonte de usuários nem banco de mensagens |

`api/_lib/supabase-rest.js` usa `SUPABASE_URL` (fallback `NEXT_PUBLIC_SUPABASE_URL`) e `SUPABASE_SERVICE_ROLE_KEY` (fallback `SUPABASE_SERVICE_KEY`). Faz HTTP para `/rest/v1`, inclusive RPC. Cada `supabaseFetch` separado é uma requisição independente: sequência de POST/PATCH não equivale a transação.

`api/_lib/retention-store.js:190` já demonstra RPC. `supabase/retention-lifecycle-v2.sql` contém transações de domínio, histórico e RLS. A recomendação é seguir essa direção, sem reusar tabelas de retenção como cadastro de mensagens.

**Decisão proposta:** Atendimento integralmente no Postgres; nenhum espelho de mensagens no Firestore. Não migrar usuários/alunos nem CRM nesta iniciativa. Antes da primeira migration, inventariar schema instalado e privilégios com leitura em staging.

**Evidências:** [Supabase REST](../api/_lib/supabase-rest.js), [Firestore REST](../_lib/firestore-rest.js), [Retenção SQL](../supabase/retention-lifecycle-v2.sql), [store Retenção](../api/_lib/retention-store.js), [mirror DataCrazy](../supabase/datacrazy-mirror.sql), [Growth SQL](../supabase/growth-copilot.sql).

## 3. Modelo atual de usuários/RBAC

- Firebase Auth autentica; `users/{uid}` fornece perfil. `_lib/firebase-id-token.js` verifica assinatura RSA, `aud`, `iss`, `sub`, expiração e email. Não há consulta de revogação de usuário nesse verificador.
- `api/login.js` recebe ID token, consulta perfil e `ativo`, e cria `space_session`. Login legado só é aceito com `ALLOW_LEGACY_LOGIN=true`.
- `_lib/session.js` cria JWT HS256 com `sub`, `role`, nome e email, duração de 12 horas. Cookie `HttpOnly`, `SameSite=Lax`, `Secure` conforme proxy HTTPS. `api/me.js` lê esse snapshot, sem recarregar permissões. Logout limpa cookie, não constitui revogação central dos tokens emitidos.
- Há APIs por cookie, APIs por Bearer Firebase e APIs que exigem ambos com igualdade de UID, como `api/admin-users.js`. `resolveAdminRequestAuth` verifica token e perfil, **não restringe sozinho a admin** e **não testa `profile.active`**; o caller precisa autorizar.
- Papéis aparecem como `admin/administrador`, `teacher/professor`, `student/aluno`, `growth`, `FINANCE/finance/financeiro`. TVs também aceitam aliases específicos. Não há normalizador único aplicado a todas as entradas.
- Firestore rules usam sobretudo `tipo`; admin tem acesso amplo. `isAdmin`, `isGrowth` e `isTeacher` não verificam `ativo`. São regras para acesso Firestore, não políticas Postgres.
- Retenção já tem mapa de capacidades, mas por papel e específico daquele domínio. `isSuperAdmin` controla área de acessos em Configurações; ocultar navegação não autoriza uma API.
- Comercial usa usuários `tipo=growth`; `growthPeople` acrescenta aliases e funções `closer/sdr/both`. Um registro de metas ou `personId=outros` não é um atendente autenticável.

**Identidade interna proposta:** UID Firebase como texto. Não converter para UUID de `auth.users` do Supabase. Memberships do Atendimento referenciam esse UID lógico; não existe FK possível para Firestore. Revalidar perfil atual e habilitação ao autorizar ações. Falta de perfil ou indisponibilidade da verificação deve negar acesso, não cair em seed/role do navegador.

**Evidências:** [login](../api/login.js), [sessão](../_lib/session.js), [verificador Firebase](../_lib/firebase-id-token.js), [perfil](../_lib/firestore-user.js), [auth de API](../api/_lib/admin-request-auth.js), [rules](../firestore.rules), [capacidades](../api/_lib/retention-capabilities.js), [growth people](../api/_lib/growth-people.js).

## 4. Modelo atual de Leads

Não há uma entidade Lead única cobrindo landing, CRM e contratos.

| Campo/conceito | Encontrado |
| --- | --- |
| Fonte da landing | Firestore `leads`, via `api/leads.js`; existe fallback direto em `landing.js` permitido pelas rules |
| ID local | ID do documento criado; não é automaticamente lead ID DataCrazy |
| Nome/telefone/WhatsApp | `nome`, `email`, `whatsapp`; sem distinção entre telefone e WhatsApp verificado |
| Origem | API fixa `origem="landing_page"`, `criadoEm`; sem SDR/closer/etapa no payload cadastrado |
| CRM operacional | API DataCrazy `/businesses`; `api/growth-dashboard.js` e `api/_lib/crm-live.js` consomem negócios, ou espelho quando habilitado |
| ID de negócio | `id`, `_id`, `uuid` ou `businessId` → `datacrazy_businesses.external_id` |
| Nome CRM | `lead.name`, `leadName`, `clientName`, `customerName`, `name` conforme adaptador |
| Etapa/pipeline | `stage.name`/`stageName`/`stage`; `stage.pipeline.name`/`pipeline.name`/`pipelineName`; colunas derivadas no mirror |
| Responsável/closer | `attendantId`, `attendant.id/_id/uuid`, `responsibleId`; nomes equivalentes. Vínculo com usuário Space por `growthPeople.crmAttendantIds`, aliases e `userUid` |
| SDR | Eventos em `sdrActivityEvents` com `sdrUid`, `sdrName`, `sdrEmail`, resultado e data. Esses eventos não comprovam atribuição de um lead específico |
| Origem CRM | Não há coluna canônica de origem do lead no mirror; `payload` preserva negócio bruto. Não confundir `source="mirror"` com origem comercial |
| Telefone/WhatsApp CRM | Não extraído nem indexado no schema/adaptador de mirror lido. Não é seguro inventar um campo do payload nem afirmar que todos os negócios contêm telefone |

`growthPeople` é uma ponte de pessoas comerciais, não de clientes. Contratos têm nome e WhatsApp, mas representam contratação; não podem virar leads por heurística. Não foi encontrado vínculo automático garantido `leads/{id} → DataCrazy lead → users/{uid}`.

**Fonte de verdade proposta:** DataCrazy para fatos do CRM externo; Firestore `leads` para captação local até existir conversão explícita. Resolver guarda referências com namespace. Confirmar o contrato de API de contato/lead DataCrazy, seu ID e a cardinalidade lead → negócios antes da integração 360.

**Evidências:** [leads](../api/leads.js), [landing](../landing.js), [mirror/adaptadores](../api/_lib/datacrazy-mirror.js) (`extractBusinessId`, `extractLeadName`, `buildMirrorRow`), [schema](../supabase/datacrazy-mirror.sql), [SDR](../api/sdr-metrics.js), [pessoas comerciais](../api/_lib/growth-people.js).

## 5. Modelo atual de Alunos

| Conceito | Representação no código |
| --- | --- |
| Fonte cadastral | Firestore `users`, filtrado por `tipo/role/type` de aluno |
| ID canônico de cadastro | ID real do documento, exposto como `firestoreDocId`, `docId`, `documentId`; UI o usa como `id` |
| Outros IDs | `uid`, `authUserId`, `userId`, `studentId`, `alunoId`, `sourceBusinessId`; aliases históricos não necessariamente iguais ao document ID |
| Nome | `nome`, `nomeCompleto`, `fullName`, `displayName`, `name`; normalizadores possuem fallbacks |
| Telefone | `telefone`, fallback `phone`/`telefoneWhatsapp` |
| BR/internacional | Um campo de telefone no cadastro auditado; `pais/country`, `estadoEua/estadoEUA/usState` contextualizam endereço, sem contrato robusto de DDI |
| Professor | `professorId`, `teacherId`, `teacher_id`; nome separado em `professorNome/teacherNome/teacherName`; `classes` contém vínculos pedagógicos adicionais |
| Status | `ativo`, `status`, `cancelamento`, `canceladoEm`, `desativadoEm`, histórico; não equivalem a status financeiro ou status de conversa |
| Plano | `plano/plan`; outros campos incluem `valorMensalidade` e `tempoContrato` |
| Financeiro legado | Supabase `n8n_alunos_financeiro_space` e cobranças; referências `firestore_doc_id`, `aluno_id`, `aluno_chave`, email e telefone conforme fluxo; IDs externos Asaas e `id_conversa_chatwoot` |
| Retenção v2 | `students.id` UUID operacional + `firestore_student_id` único; `lifecycle_status`, `pause_status`; contas, assinatura, cobranças e pagamentos separados |
| Contratação | Firestore `contratos`: `nomeCompleto`, email, CPF, `whatsapp`, `telefoneCountry`, referências ZapSign e eventualmente `alunoId/studentId` |

`normalizeAdminFirestoreUserRow` em `script.js:18396` preserva aliases mas dá precedência ao documento real. `api/_lib/student-mirror-sync.js` atualiza espelhos por `firestore_doc_id` ou email; recusa múltiplos candidatos, mas operações entre bancos não são atômicas. `api/_lib/retention-store.js` provisiona sujeito operacional a partir do Firestore quando necessário.

`api/admin-students-import.js:119` importa nome/email e cria telefone vazio: existir aluno não significa existir telefone. `api/growth-dashboard.js:2564` pode identificar onboarding por aluno, email, WhatsApp ou contrato; esses identificadores não são intercambiáveis.

Atendimento não deve consultar `students` da Retenção como substituto universal de `users`. Deve carregar cadastro pelo document ID e enriquecer financeiro apenas pelo vínculo explícito e permissão própria.

## 6. Como telefones são armazenados atualmente

| Entrada/leitura | Regra encontrada | Risco |
| --- | --- | --- |
| Landing API | Remove caracteres fora de dígitos/`+`; aceita `+` opcional e 10–15 dígitos | Aceita número nacional sem país; não normaliza para E.164 |
| Alunos/professores | String com `trim`; aliases no normalizador | Formatos livres; campos divergentes e DDI ausente |
| Contratos Growth | `whatsapp` só dígitos; `telefoneCountry` separado, default `55`; validação de 6–15 dígitos no backend | Número nacional e internacional podem ser confundidos |
| Link de WhatsApp de contrato | `growth.js:939` evita prefixar país se número já começa com ele | `startsWith(country)` não prova presença de DDI; DDD 55 é contraexemplo brasileiro |
| Configurações/perfil | UI exibe prefixo `+55`, salva `telefone` sem impor normalização equivalente | Prefixo visual não prova telefone internacional correto |
| Financeiro/pedagógico | Diversos matches removem não dígitos; há fallbacks por email/nome | Números equivalentes podem não casar; homônimos e números compartilhados podem casar indevidamente |
| Mirror DataCrazy | Payload bruto, sem coluna de telefone | Não há busca exata indexada confiável para identity resolution |

**Resposta:** não existe hoje caminho comprovadamente confiável `telefone WhatsApp → Lead ou Aluno`. Há heurísticas locais, não uma identidade global validada.

Duplicidades **possíveis pelo código**: captação repetida sem constraint por telefone; aliases com números divergentes; pessoa simultaneamente lead e aluno; familiar pagador compartilhando número; múltiplos negócios para o mesmo lead. **Não foi medida duplicidade real nos bancos.** Backups históricos não comprovam a distribuição atual.

Próxima auditoria de dados deve ser read-only, paginada e produzir apenas contagens: campos vazios, formato/país, candidatos E.164, colisões por fonte e entre fontes, alunos sem UID Auth correspondente e freshness do mirror. Sem corrigir registros automaticamente nem exportar PII para Git.

Normalização futura: conservar original e campo/fonte; derivar E.164 apenas com país explícito ou contexto BR confiável; não impor `55` a desconhecidos; não inserir/remover nono dígito nem comparar só sufixo como prova. Tratar prefixo `00`, tronco `0`, ramal, DDI `1` e números inválidos/curtos. Telefone identifica um ponto de contato, não comprova identidade civil.

**Evidências adicionais:** `script.js:19004` (vínculos financeiros), `script.js:20916` (chaves de telefone), `script.js:33398` (perfil), [serviço pedagógico](../api/_lib/pedagogico-service.js) (`buildStudentKey`/uso de `onlyDigits`), [Growth](../growth.js).

## 7. Infraestrutura atual de webhooks

- `POST /api/asaas-webhook`: segredo compartilhado, parse JSON e PATCH por `id_cobranca_externa`. Não persiste um ledger único do evento recebido; reprocessamento pode reaplicar estado.
- `POST /api/zapsign-webhook`: rewrite para `api/growth-dashboard.js?api=zapsign-webhook`; valida segredo, encontra contrato por token e atualiza assinatura. Disparo de onboarding usa promise não aguardada antes da resposta; não é exemplo de execução durável em serverless.
- `api/_lib/security.js` compara segredos em tempo constante, mas aceita headers, Bearer e query `token/secret`. Não implementa assinatura Meta sobre bytes.
- `_lib/http.js` lê corpo em string e devolve JSON; não disponibiliza raw bytes para HMAC. Novo handler precisa controlar leitura bruta e limite, verificar assinatura antes do parse e confirmar comportamento do runtime Vercel.
- DataCrazy tem sync incremental, watermark/overlap e lock SQL; é sincronização pull, não engine de webhook WhatsApp.
- Adaptadores usam `fetch`, env server-side e tradução de erros. n8n já usa `AbortController`/timeout e logs persistidos. Não há política universal de retry seguro, rate limit distribuído ou redaction de payload.

Reutilizar comparação segura, respostas HTTP, cliente REST e padrão de RPC. Construir inbox durável de eventos e assinatura Meta. Não reaproveitar segredo n8n para Meta nem verificar assinatura sobre `JSON.stringify(req.body)`.

**Evidências:** [Asaas webhook](../api/asaas-webhook.js), [ZapSign handler](../api/growth-dashboard.js) (`handleZapSignWebhook`), [security](../api/_lib/security.js), [HTTP](../_lib/http.js), [sync](../api/datacrazy-sync.js), [n8n](../api/_lib/pedagogico-n8n.js).

## 8. Infraestrutura atual de realtime

Não foram encontrados assinantes de `onSnapshot`, `EventSource`, `postgres_changes` ou SSE nos arquivos JS de aplicação pesquisados. `api/crm-live.js:2822` e `api/cs-live.js:352` usam `setInterval`: dados a cada 120 segundos e eventos a cada 25 segundos. Os endpoints `*-live-events` retornam JSON; CS retorna atualmente eventos vazios.

Firestore suporta listeners, mas isso não é uma camada realtime já implementada aqui. Não há Supabase Realtime configurado no código auditado, nem servidor WebSocket próprio. O produto exige trabalho novo nessa área.

**Recomendação:** Supabase Realtime para notificação de alterações após commit, mantendo leituras autorizadas na API Space. Não adicionar polling por segundo nem espelhar mensagens em Firestore só para notificá-las.

## 9. Legados relacionados a WhatsApp/Chatwoot encontrados

- `api/chatwoot/conversation.js`: GET de mensagens e POST de resposta/nota privada; usa token server-side e acesso financeiro por cookie.
- `api/_lib/finance-integrations.js`: configuração Chatwoot, URL, account/inbox com defaults e normalizador de conversation ID.
- `script.js:12421` em diante: financeiro, vínculo `id_conversa_chatwoot`, indicadores “sem Chatwoot”, URLs, drawer e composer da conversa.
- URLs `wa.me` de contratos são atalhos, não integração oficial inbound/outbound.
- `n8n` participa de integrações existentes; não será dono do novo domínio.

**Tratamento:** preservar todo o legado nesta etapa. Nova arquitetura não usa seus IDs como chaves primárias, não depende de seu inbox, não encaminha novas mensagens por ele. Uma futura transição por número deve definir qual engine recebe/envia naquele canal e evitar duas automações respondendo. Migração de histórico legado é um projeto opcional posterior, com origem explícita; não está incluída como requisito da foundation.

## 10. Arquitetura proposta do novo Atendimento

```text
Meta Cloud API oficial
   ↕ webhook / envio server-side
Vercel API Space ── autenticação Firebase + perfil atual + ACL Atendimento
   ↕ RPC transacional
Supabase/Postgres
   ├─ conexões, canais, contatos, conversas, mensagens e eventos
   ├─ inbox webhook e outbox duráveis → worker → Meta / tarefas de mídia
   ├─ storage privado de anexos (bucket Supabase proposto)
   └─ notificação realtime após commit → navegador → leitura na API Space

Contact → Space Identity Resolver → referências Lead / Aluno / desconhecido
                                     ↳ Firestore / DataCrazy / espelho autorizado
```

Não criar microserviço de CRM, banco de usuários paralelo, servidor WebSocket ou barramento Kafka. Handlers finos, regras testáveis em `api/_lib/attendance-*`, persistência transacional via RPC, adaptação Meta em helper próprio. Anexos em object storage; Postgres guarda metadados.

**Donos dos fatos:**

| Fato | Fonte de verdade proposta | Derivações permitidas |
| --- | --- | --- |
| Contato de atendimento | `contacts` + identidades externas de contato | Nome apresentado pelo provedor separado de nome cadastral |
| Mensagem e sua intenção local | `messages` | Meta fornece ID/recibos externos; UI e contadores são projeções |
| Conversa | `conversations` | Inbox, filas e métricas derivadas |
| Usuário/atendente | Firebase Auth + Firestore `users` | Habilitação e memberships locais, sem cópia integral do perfil |
| Lead | Firestore landing ou DataCrazy, com namespace | Índice de identidade apenas derivado |
| Aluno | Firestore `users/{documentId}` | Referências para financeiro/Retenção; nenhum cadastro concorrente |
| Atribuição/time atual | `conversations` | Histórico em `conversation_assignments` atualizado na mesma transação |
| Status/prioridade da conversa | `conversations` | Não sobrepor status CRM, financeiro ou lifecycle |
| Canal e roteamento local | `channels` | IDs/estado Meta sincronizados; capacidades externas continuam governadas pela Meta |
| Template aprovado | Meta | Cache versionado em `whatsapp_templates`; Space não declara aprovação própria |

**Escopo organizacional:** o código auditado não demonstra multiempresa. Começar com uma instalação Space e múltiplos canais/times. Não adicionar SaaS multitenant implicitamente. Se houver exigência de outras empresas, decidir antes da primeira migration: `workspace_id` deve então integrar FKs, uniques e todas as políticas; filtro de UI não é isolamento.

## 11. Diagrama textual do fluxo inbound

```text
GET /api/webhooks/whatsapp
  → validar hub.mode e verify token → devolver challenge em texto

POST /api/webhooks/whatsapp
  → limitar corpo e capturar Buffer original
  → HMAC SHA-256 com app secret + comparação timing-safe
  → parse/validar envelope e versão suportada
  → percorrer TODAS as entries / changes / messages / statuses
  → identificar integração e canal por IDs externos verificados
  → persistir entrega + itens normalizados em webhook_events [commit]
  → 200 somente após aceitação durável

Worker (execução curta, retomável)
  → claim com lease; verificar canal e schema
  → RPC atômica por item:
       deduplicar identidade oficial da mensagem
       obter/criar identidade externa de contato
       obter/criar conversa ativa sob lock
       inserir mensagem e atribuir sequência da conversa
       atualizar última atividade / última inbound / versão
       registrar evento + trabalho de mídia/notificação
       marcar item processado
     [commit único]
  → notificar realtime após commit
  → resolver Lead/Aluno de forma assíncrona ou por leitura posterior
```

Ingestão não deve depender de DataCrazy/Firestore responder: contato desconhecido é válido. Item válido de canal ainda não cadastrado fica em quarentena durável, com alerta; não adivinhar canal default. Assinatura inválida é rejeitada; falha de persistência retorna erro para retry. Evento desconhecido é registrado como ignorado/unsupported, sem quebrar lote válido. Mídia indisponível não perde a mensagem.

Workers precisam existir antes de aceitar tráfego real. Proposta operacional mínima: endpoint interno Vercel acionado por scheduler durável, por exemplo Supabase Cron com chamada HTTP autenticada, sujeito a validação de disponibilidade/limites no staging. Um disparo imediato pode reduzir latência, mas o agendamento de recuperação deve recolher pendências. Não usar `setTimeout` ou promise abandonada após resposta como garantia de entrega.

A verificação de challenge e assinatura corresponde ao protocolo documentado pela [Meta no material de webhooks](https://whatsapp.github.io/WhatsApp-Nodejs-SDK/api-reference/webhooks/start/). Usar `crypto` nativo; esse material não é recomendação de instalar o SDK histórico.

## 12. Diagrama textual do fluxo outbound e API server-side

```text
POST /api/attendance/conversations/:id/messages + Idempotency-Key
  → Bearer Firebase válido + perfil atual ativo
  → capability + acesso a canal/time/conversa
  → validar destinatário persistido, estado do canal, conteúdo/anexos
  → validar janela/template/opt-out
  → RPC grava intenção pending + outbox + ator [commit]
  → 202 com message_id e estado pending

Worker
  → claim exclusivo / ordem por conversa
  → revalidar canal, cancelamento, janela e autorização para despacho
  → Meta Cloud API, token somente server-side
  → persistir ID oficial e aceitação ou erro
  → webhook de status reconcilia sent/delivered/read/failed
  → notificação após commit → UI refaz leitura autorizada
```

Persistir intenção **antes** da chamada externa evita mensagem invisível quando o processo cai. Não há transação distribuída com Meta. Timeout após envio pode significar aceitação sem resposta; marcar `unknown`, reconciliar recibos/correlação e não reenviar cegamente. Chave idempotente Space não deve ser apresentada como garantia idempotente do endpoint Meta.

Janela: usar o instante da última mensagem do usuário no **par canal + contato**, nunca o horário de abrir a tela, envio outbound ou troca de status da conversa. Revalidar no despacho. Fora de 24h, aceitar apenas template aprovado e aplicável; envio de template sozinho não renova essa janela. Opt-out bloqueia os envios proativos correspondentes. A regra base vem da [política oficial de mensagens WhatsApp](https://business.whatsapp.com/policy); capacidade/versionamento e eventuais extensões precisam de verificação na integração.

Contrato inicial proposto (sem criação de rotas nesta etapa):

| Método/rota | Responsabilidade |
| --- | --- |
| `GET /api/attendance/conversations` | Fila filtrada por ACL, cursor, time, status, responsável e prioridade |
| `GET /api/attendance/conversations/:id` | Resumo permitido e versão |
| `GET /api/attendance/conversations/:id/messages` | Paginação por sequência, mensagens e notas permitidas |
| `POST .../:id/messages` | Intenção outbound idempotente; body não escolhe token nem destinatário arbitrário |
| `POST .../:id/notes` | Nota interna, sem envio Meta |
| `POST .../:id/assignment` | Transferência/assumir, versão esperada, motivo, validação de destino |
| `POST .../:id/status` | Aberta/pendente/adiada/resolvida e `snoozed_until` |
| `POST .../:id/read` | Avançar cursor de leitura daquele UID até sequência realmente exibida |
| `POST /api/attendance/attachments` | Upload autorizado limitado; vínculo posterior com mesma conversa |
| `GET /api/attendance/attachments/:id/download` | Revalidar ACL e emitir URL curta ou transmitir mídia |
| `GET /api/attendance/contacts/:id/identity` | Resolver com fontes, freshness, confiança e máscara por permissão |
| `POST /api/attendance/contacts/:id/identity-links` | Vinculação/desvinculação manual auditada |
| `GET /api/attendance/teams`, `GET /api/attendance/channels` | Somente itens acessíveis |
| `POST /api/attendance/internal/jobs` | Worker autenticado por credencial de máquina exclusiva |

Paginação limitada e estável; `401/403` para auth, `404` para entidade inacessível quando necessário evitar enumeração, `409` para concorrência/chave reutilizada com conteúdo diferente, `422` para regra de domínio, `429` para limitação. Erros não retornam payload/token upstream.

Mapear rotas físicas para funções dinâmicas Vercel ou rewrites como já existe no projeto; `:id` acima é contrato conceitual, não arquivo literal. Usar `attendance` nas APIs, “Atendimento” na UI.

## 13. Modelo de dados proposto

Convenção: inglês, `snake_case`, IDs `<entity>_id`, sem prefixo de ferramenta, conforme [ADR 0003](decisions/0003-schema-language-and-naming.md). UUID para entidades novas; UID Firebase e identificadores Meta/DataCrazy como texto opaco. Horários `timestamptz` UTC; UI localiza. Abaixo é desenho, não SQL/migration.

| Entidade | Campos/restrições centrais |
| --- | --- |
| `connections` | `connection_id`, provider, label, status, account reference, config não secreta, credential reference, timestamps, created_by_uid |
| Credenciais privadas | Secret manager por referência ou tabela em schema privado não exposto no PostgREST: connection_id, ciphertext, nonce/tag, key_version e timestamps de rotação; sem SELECT de usuários/browser |
| `channels` | `channel_id`, connection_id FK, provider, external_phone_number_id, account identifiers tipados, display_number, capabilities, status, default_team_id; unicidade do endpoint externo no escopo de instalação |
| `contacts` | `contact_id`, display_name, display_name_source, locale, created_at; contato comunicável, sem copiar plano/financeiro/CRM |
| `contact_identities` | `contact_identity_id`, contact_id, provider, scope_id, identifier_type, external_identifier; unique(provider, scope_id, identifier_type, external_identifier); telefone bruto/E.164 opcional, proveniência e validade |
| `contact_identity_links` | `identity_link_id`, contact_id, source_system, entity_type, source_entity_id, confidence, evidence, verified_by_uid, valid_from/to, source_updated_at; sem FK fictícia para banco externo |
| `identity_phone_index` | Índice derivado por fonte/entidade/campo: telefone original protegido, E.164 candidato, país, método, versão do normalizador, atualização e colisão. Não é cadastro mestre nem exige telefone globalmente único |
| `conversations` | `conversation_id`, channel_id, contact_id, status, priority, assigned_user_uid, team_id, snoozed_until, last_message_id, last_activity_at, last_inbound_at, next_sequence, version; unique parcial(channel_id, contact_id) para status != resolved |
| `channel_contact_state` | Chave(channel_id, contact_id), last_customer_message_at; preserva janela de serviço entre encerramento e nova conversa |
| `messages` | `message_id`, conversation_id, channel_id, sequence, direction, visibility, kind, author_uid, external_message_id, client_request_id, content/payload normalizado, transport_status, provider_timestamp, received_at, timestamps; unique(channel_id, external_message_id) quando não nulo; unique(conversation_id, sequence) |
| `message_attachments` | `attachment_id`, message_id, provider_media_id, private_storage_path, MIME detectado, filename sanitizado, bytes, checksum, status, expires_at; sem URL pública permanente |
| `message_status_events` | `message_status_event_id`, channel_id, external_message_id, status, provider_timestamp, dedupe_key, error_code; permite recibo chegar antes da correlação da mensagem |
| `conversation_reads` | PK(conversation_id, user_uid), last_read_sequence, read_at; cursor monotônico |
| `conversation_assignments` | `assignment_id`, conversation_id, from/to user e team, actor_uid, motivo, sequence/event reference; histórico append-only de transições |
| `conversation_events` | `conversation_event_id`, conversation_id, event_type, actor_uid ou origem externa, payload mínimo, version, created_at; eventos de status, prioridade, nota, vínculo e operação |
| `attendance_members` | user_uid PK textual, enabled, permissões do domínio, profile_checked_at; referências a usuários existentes, sem senha/email/cadastro paralelo |
| `teams`, `team_members`, `channel_teams` | team_id, nome, ativo; PK(team_id,user_uid), função no time; quais canais cada time pode usar |
| `webhook_events` | webhook_event_id, provider/app scope, delivery hash, item dedupe key, channel reference opcional, envelope protegido, event_type, state, attempts, available_at, lease_until/token, last_error_code, received_at, processed_at |
| `quick_replies` | quick_reply_id, team_id opcional, owner_uid opcional, title, body, active; texto rápido não equivale a template aprovado |
| `whatsapp_templates` | template_id local, connection/account scope, external_template_id, name, language, category, approval_status, components, synced_at; unique no escopo da conta/template/idioma |

A coluna `direction` distingue inbound/outbound/internal; `visibility` distingue comunicação externa e nota interna, com CHECK impedindo combinações inválidas. `author_uid` obrigatório para ações humanas; inbound usa identidade do provedor. ID externo de mensagem jamais é fabricado.

**Auditoria e outbox existentes:** `public.audit_logs` e `public.outbox_events` já estão declaradas na Retenção v2. Preferir evoluí-las como infraestrutura compartilhada com eventos namespaced (`attendance.*`) e worker que selecione apenas seu domínio. Verificar provisioning antes: não executar toda a Retenção só para obter duas tabelas. Extrair/provisionar infraestrutura compartilhada em migration compatível e independente, se necessário. Outbox atual precisa de claim atômico, lease/token, timeout, dedupe key, classificação de falha e índices. Não criar segunda fila genérica concorrente por conveniência.

Índices mínimos: mensagens por `(conversation_id, sequence desc)`; conversa por fila `(team_id,status,last_activity_at desc,conversation_id)` e por responsável; identidade externa unique e E.164 não unique; eventos por conversa/data; outbox/webhook por estado/disponibilidade. FKs entre entidades locais, checks de estados e ownership coerente entre mensagem/canal/conversa. Não iniciar particionamento, busca vetorial ou full event sourcing sem volume medido.

## 14. Relacionamentos entre entidades e invariantes

```text
connections 1──N channels N──N teams N──N users(Firestore UID)
contacts 1──N contact_identities
contacts 1──N contact_identity_links ──> Firestore lead / DataCrazy lead / aluno
channels + contacts 1──N conversations (no máximo uma não resolvida por par)
conversations 1──N messages 1──N message_attachments
conversations 1──N conversation_assignments / conversation_events / conversation_reads
channels + contacts 1──1 channel_contact_state
webhook_events ──processamento──> messages / message_status_events / outbox_events
```

- Atribuição atual vive em `conversations`; histórico é inserido na mesma RPC. Não dois writers atualizando dono independentemente.
- Transferência usa lock ou comparação de `version`. Duas pessoas tentando assumir geram um vencedor e um `409`. Usuário de destino deve estar ativo, habilitado e pertencer ao time permitido no canal.
- Aberta → pendente/adiada/resolvida; pendente/adiada → aberta/resolvida. Adiada exige horário futuro e job durável para reabrir. Proposta: inbound novo reabre pendente/adiada; após resolvida, cria novo episódio no mesmo par, preservando histórico. Confirmar essa regra de produto antes da UI.
- Prioridade `normal/high/urgent` independe de status. Times iniciais: Comercial, CS, Financeiro e Pedagógico; não são novos papéis globais de autenticação.
- Unread é por atendente: contar inbound com sequência maior que cursor. Abrir a conversa numa aba não zera leitura dos demais. Retry de mensagem não incrementa sequência nem unread. Badge global, se desejado, precisa de definição separada.
- Última atividade ordena ingestão; timestamp do provedor permanece para exibição. Evento atrasado não deve mover relógio de janela para trás. Receipt `read` não pode regredir para `sent` por atraso.
- `transport_status` usa máquina de estados explícita: pending → sending → accepted/sent → delivered → read, com failed/unknown tratados como ramos de reconciliação. Erro tardio não apaga evidência de entrega/leitura; conservar todos os recibos e decidir a projeção pela semântica do provedor, não apenas pelo último webhook recebido.
- Notas internas compartilham timeline, mas não chegam à Meta nem à exportação externa por padrão. Histórico de outra equipe exige autorização própria; ser o mesmo contato não abre todo o histórico.

## 15. Estratégia de Identity Resolution Lead/Aluno

```text
Identificador recebido → identidade de contato no escopo do provedor
  → vínculo explícito válido já revisado?
  → telefone verificável disponível? → índice derivado por fonte
  → candidato único e evidência suficiente? → associação rastreável
  → múltiplos candidatos / país incerto / sem telefone → não identificado ou ambíguo
```

Ordem recomendada: vínculo explícito ativo; ID externo já correlacionado; telefone completo validado com candidato único e sem conflito; revisão humana. Nunca resolver por nome, sufixo de telefone, email não confirmado ou primeiro resultado. Match por telefone é evidência de contato, não autorização para divulgar dados cadastrais ao interlocutor.

Resposta do resolver: `status=linked|unidentified|ambiguous|stale`, links tipados, método/confiança, fonte, última sincronização e motivo. Um contato pode ter vínculos de lead e aluno simultâneos. Exibir ambos quando explícitos; não criar dois cadastros nem escolher “aluno vence” silenciosamente. Números familiares exigem confirmação contextual e podem permanecer ambíguos.

O índice é reconstituível, unidirecional e versionado. Atualizações/deleções de origem invalidam links candidatos; vínculo manual guarda autor, justificativa e validade. Não sobrescrever `users.telefone`, criar aluno ou alterar CRM ao receber mensagem. O caminho crítico inbound sempre funciona sem resolver.

DataCrazy: primeiro confirmar endpoint e shape de contatos/leads reais. Não usar `datacrazy_businesses.external_id` como identidade da pessoa. Extração futura pode usar payload se o contrato demonstrar o campo, ou adapter de consulta de lead; salvar freshness e contabilizar ausências. A integração 360 não é requisito para receber as primeiras mensagens.

**Evolução do provedor:** materiais oficiais recentes da Meta apresentam usernames e BSUID como identificadores que podem substituir telefone para alguns usuários. Por isso a proposta usa identificador externo opaco, escopo e telefone opcional. Isso é preparação de schema, não afirmação de que a conta Space já recebe esse payload. Confirmar rollout e versão na fase 2. [Meta — WhatsApp Usernames](https://developers.meta.com/resources/videos/whatsapp-usernames/).

## 16. Estratégia de idempotência

| Camada | Chave/controle | Efeito |
| --- | --- | --- |
| Entrega HTTP | Hash do corpo + escopo do app | Economiza processamento de entrega idêntica; não substitui dedupe de item |
| Mensagem inbound | Unique(channel_id, external_message_id oficial) | Um registro e um efeito de unread/evento por mensagem |
| Receipt | Canal + ID mensagem + status + timestamp/campos discriminadores documentados | Mesmo ID pode receber sent, delivered, read e failed; dedupe só por ID destruiria updates |
| Eventos sem ID próprio | Chave determinística por tipo/entidade/versão e conteúdo relevante normalizado | Contrato específico por tipo, sem perder eventos distintos do mesmo lote |
| Comando frontend | Conversation + actor UID + client_request_id; hash do comando | Mesmo comando retorna resultado original; chave com outro conteúdo retorna conflito |
| Jobs/outbox | Dedupe por efeito; claim com lease/token; conclusão compare-and-set | Concorrência e crash não executam simultaneamente o mesmo trabalho |

RPC deve inserir a mensagem com constraint e só alterar conversa/eventos se a inserção efetivamente for nova. `SELECT` seguido de `INSERT` em requisições independentes não resolve corrida. Contato e conversa também precisam de uniques e locks. A conclusão do item webhook pertence à mesma transação dos efeitos; rollback deixa item retomável.

Entrega é pelo menos uma vez; efeitos locais são idempotentes. Retry exponencial com jitter, limite, erro sanitizado e fila de falhas para reprocessamento manual auditado. Manter tombstones/chaves de dedupe pelo horizonte de replay definido, mesmo depois de expirar payload bruto.

Assinatura autentica origem/integridade, não prova que a entrega é inédita. Não descartar automaticamente eventos antigos apenas pelo relógio: retries legítimos existem. HMAC mais ledger durável controla replay; política de timestamp anômalo encaminha a revisão.

Outbound tem fronteira não atômica: timeout ou queda após envio → `unknown`, sem resend automático até reconciliar. Se o provedor oferecer correlação de payload opaco na versão usada, incluir ID local e validar em staging. Não depender dela sem confirmação. Guardar receipts órfãos e correlacionar depois; não criar mensagem outbound fictícia só porque chegou status.

## 17. Estratégia de realtime

**Escolha proposta:** Supabase Realtime privado, notificações pequenas por UID, com API Space fornecendo conteúdo autorizado. A documentação do Supabase recomenda Broadcast para maior controle e escala em [mudanças de banco](https://supabase.com/docs/guides/realtime/subscribing-to-database-changes). Isso é capacidade do provedor, ainda não configuração Space.

1. Manter Firebase Auth. Validar integração third-party Firebase/Supabase em staging: trust no projeto correto, claim técnica `role=authenticated`, refresh de tokens e políticas usando `auth.jwt()->>'sub'` como texto. Não reutilizar cookie HS256 Space como JWT Supabase nem confundir role Postgres com `growth/admin`. [Supabase — Firebase Auth](https://supabase.com/docs/guides/auth/third-party/firebase-auth).
2. Navegador recebe apenas URL/chave pública apropriada e token do próprio usuário. Service role nunca sai do backend. Mudança de custom claims exige rollout nos emissores/usuários existentes; não está pronta hoje.
3. Canal privado `attendance:user:<uid>` com RLS de assinatura limitada ao próprio UID e membership habilitado. Publicação durável calculada server-side após commit; cliente não publica mensagens de domínio.
4. Payload de notificação preferencialmente só `inbox_changed` e identificador opaco do evento, sem conteúdo, nome, telefone, prévia, valor financeiro ou IDs de outras pessoas. Em mudança de dono/time, notificar também quem precisa remover o item da tela. Worker calcula audiência a partir da ACL atual.
5. Navegador faz fetch autorizado ao receber sinal, com coalescência de bursts. Ao reconectar, busca estado/cursor novamente. Realtime não é ledger, não garante replay de toda notificação e não substitui persistência.

Políticas Broadcast são avaliadas na conexão/renovação de JWT e podem ficar em cache. Não prometer revogação imediata só porque alterou membership. Notificações sem conteúdo + API revalidando perfil/ACL evitam entrega de mensagens sensíveis por conexão antiga. Renovação/reconexão e bloqueio devem ser testados; nenhum nome de tópico deve servir como segredo. [Supabase — autorização Realtime](https://supabase.com/docs/guides/realtime/authorization).

Alternativa simples para staging: Postgres Changes em tabela mínima de notificações com RLS por destinatário. Não habilitar publicação indiscriminada de `messages`, `webhook_events`, credenciais ou tabelas financeiras. SSE próprio exigiria validar conexão longa na Vercel e infraestrutura adicional; não há implementação existente superior a reaproveitar.

## 18. Estratégia de RBAC, segurança e privacidade

Criar capacidades do domínio: `attendance.view`, `attendance.reply`, `attendance.note`, `attendance.assign`, `attendance.transfer`, `attendance.resolve`, `attendance.manage_teams`, `attendance.manage_connections`, `attendance.manage_templates`, `attendance.link_identity`, `attendance.export`.

| Perfil no Atendimento | Acesso proposto |
| --- | --- |
| Administrador habilitado | Gestão conforme capabilities; acesso global explicitamente concedido e auditado |
| Supervisor do time | Conversas dos times/canais vinculados; transferir e acompanhar o time |
| Atendente | Ler/responder no time/canal autorizado; assumir conforme regra; ações administrativas negadas |
| Professor/financeiro/growth | Elegibilidade pelo cadastro, mas acesso só após habilitação e membership; perfil global não dá acesso a todos os times |
| Aluno | Nenhum acesso à inbox interna |
| Worker | Principal de máquina separado; executa somente efeitos persistidos, sem confiar em actor vindo do cliente |

Aplicar checagens na listagem, busca, conversa individual, mensagem, upload/download, templates, realtime e resolver. Endpoint de identidade deve filtrar também informações financeiras/pedagógicas: poder responder WhatsApp não implica poder ver financeiro. Não herdar automaticamente o `finance.view` amplo da Retenção.

A API autentica com helper existente acrescido de verificação explícita de `active`, habilitação e membership atual. Client body nunca escolhe actor/role. Ao aceitar cookie para alguma mutação, adicionar defesa CSRF/origin; recomendação inicial é Bearer Firebase nas APIs novas. CORS não substitui autorização.

Postgres: RLS habilitada, grants mínimos; tabelas de domínio sem escrita de `anon/authenticated`. RPCs internas revogadas de `PUBLIC`; se `SECURITY DEFINER`, fixar `search_path`, validar argumentos e restringir executor. Service role ignora RLS, então testes da autorização server-side são obrigatórios. ACL do módulo é local; perfil/identidade continua no Firestore.

Segredos por referência ou ciphertext com criptografia autenticada (ex.: AES-GCM), chave fora do banco e versionamento/rotação. Não guardar token no JSON público de conexão, HTML, storage do navegador, erro ou log. Não registrar authorization headers ou payload integral por padrão. Logs operacionais: request/event/message IDs locais, código sanitizado, latência e contagens; auditar leitura/exportação sensível, envio, nota, transferência, identidade e mudanças de conexão.

Anexos: bucket privado, tamanho/tipo permitido, MIME detectado, nome sanitizado, checksum, quarentena/validação, URL curta após ACL. Download Meta somente por media ID e destinos oficiais validados; impedir SSRF por URL arbitrária do payload e não repassar token ao browser. `file-type`/`sharp` já estão em `package.json`, mas não equivalem a pipeline pronto de mídia ou antivírus.

**Privacidade/LGPD — requisitos técnicos propostos:** minimizar dados; acesso por necessidade; trilha de consulta/exportação; prazos configuráveis para conteúdo, mídia, bruto webhook e logs; processo de eliminação/anonimização com exceções de retenção justificadas; backups e logs entram no ciclo de descarte. Evitar PII em fixtures, Git e ferramentas de IA. Guardar opt-in/opt-out e finalidade quando necessários, sem tratar todo recebimento como autorização de marketing. Prazos, base legal, atendimento a titulares e transferências entre provedores precisam de definição do responsável por privacidade; esta auditoria não certifica conformidade jurídica.

## 19. Estratégia para Configurações > Conexões

**Hoje:** `api/_templates/app.html:1544` já lista Integrações e Conexões. `renderAdminSettingsPanel` (`script.js:33697`) implementa perfil e acessos para super admin; demais seções usam `renderAdminSettingsPlaceholder`. Não foi encontrado CRUD de conexões com credenciais. Integrações usam helpers/envs específicas.

**Proposta:** entidade `connections` para metadados e ciclo de vida, configuração global server-side para app/secrets de infraestrutura e credenciais por conexão em secret manager ou armazenamento cifrado privado. Não escolher entre “só tabela” e “só env”: metadados relacionais e segredos isolados têm papéis distintos.

Uma conexão WhatsApp pode ter vários canais/números; uma instalação pode ter várias conexões/contas. Webhook resolve pelos IDs do payload validado, nunca pelo primeiro número configurado. Sem `WHATSAPP_PHONE_NUMBER_ID` global como design definitivo. Asaas/DataCrazy podem aparecer depois como conexões legadas gerenciadas por env; não migrar seus writers/tokens nesta etapa.

APIs futuras: `GET /api/connections` (resumo sanitizado), `POST /api/connections/whatsapp/signup/start`, `POST .../signup/complete`, `POST /api/connections/:id/disconnect`, `POST .../:id/validate`, leitura/sync de canais e templates. Alteração de segredo nunca retorna valor antigo. Desconectar bloqueia despacho e mantém histórico, com auditoria e tratamento explícito da revogação externa.

**Embedded Signup:** admin autorizado inicia sessão de onboarding curta e single-use no backend; UI abre fluxo oficial com app/config IDs públicos. Backend valida state/nonce, usuário, origem e código retornado, troca código por credencial server-side, verifica ativos/contas/números autorizados, persiste referência cifrada, conclui assinatura/registro exigidos pela versão e só marca canal conectado após teste. Não confiar em WABA/phone IDs postados pelo navegador sem verificação externa. Não persistir token no browser. Erro deixa conexão `pending/failed`, sem canal falsamente operacional.

O material oficial consultado anuncia evolução de Embedded Signup e modelo de contas, portanto não congelar v2/v3, WABA como único tipo de conta ou scopes supostos no schema. Usar IDs de conta tipados e adaptador versionado; confirmar API, permissões/revisão do app e modalidade de onboarding para ativos próprios versus de terceiros antes da fase 2. [Meta — Unified Onboarding](https://developers.meta.com/resources/videos/unified-onboarding-whatsapp/), [Meta — Account Model Evolution](https://developers.meta.com/resources/videos/whatsapp-account-model-evolution/). As páginas detalhadas tradicionais de developers.facebook.com não ficaram acessíveis nesta consulta; nenhuma habilitação real foi verificada.

## 20. Variáveis de ambiente necessárias futuramente

Nomes novos são proposta, não envs criadas. Valores não pertencem ao documento nem ao frontend.

| Grupo | Nomes e destino |
| --- | --- |
| Existentes a reutilizar | `APP_ENV`, `SPACE_PUBLIC_BASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, Firebase public config e service account conforme `_lib/runtime-env.js`; `SPACE_AUTH_SECRET` continua restrita à sessão Space |
| Flags | `ATTENDANCE_ENABLED`, `WHATSAPP_INBOUND_ENABLED`, `WHATSAPP_OUTBOUND_ENABLED`; padrão desabilitado até validação |
| App Meta | `META_APP_ID`, `META_APP_SECRET`, `META_GRAPH_API_VERSION`, `META_EMBEDDED_SIGNUP_CONFIG_ID`, `META_OAUTH_REDIRECT_URI` se exigida pelo fluxo escolhido |
| Webhook | `WHATSAPP_WEBHOOK_VERIFY_TOKEN`; app secret valida POST, verify token valida GET; sem fallback n8n |
| Credenciais | `CONNECTIONS_ENCRYPTION_KEY` + versão/key ID, ou referência/config do secret manager escolhido; tokens por conexão ficam fora de config pública |
| Worker | `ATTENDANCE_JOB_SECRET`, limites de lote/retry/tempo; scheduler armazena sua cópia em cofre server-side |
| Mídia | `ATTENDANCE_MEDIA_BUCKET`, limites e TTL; URL assinada criada server-side |
| Realtime | URL/chave publishable/anon apropriada explicitamente allowlisted em runtime-config; trust Firebase configurado no Supabase, não segredo compartilhado entregue ao cliente |
| Operação | Prazos de retenção, limites por canal e allowlist de números de teste; app/conta/números permitidos por ambiente |

`_lib/runtime-env.js` já tem guardas para Firebase, Supabase, Asaas e n8n; **não valida isolamento Meta/DataCrazy de forma equivalente**. Adicionar verificações próprias antes de habilitar envio. Ambiente `local` tem defaults públicos de Firebase produção: não assumir que execução local é isolada. Nenhum teste de Atendimento deve atingir defaults reais.

A auditoria identificou `.env.local` e `.env.vercel.pull` no diretório; não leu nem reproduziu seus valores. `.gitignore` ignora `.env*` e `.vercel`; exemplos já versionados permanecem. Conferir distribuição/rotação e conteúdo publicado em processo específico, sem expor secrets em relatórios.

## 21. Riscos técnicos encontrados

| Prioridade | Evidência | Consequência/ação necessária |
| --- | --- | --- |
| Crítica | Normalização e vínculos fragmentados, §§4–6 | Associação errada e exposição de cadastro; resolver conservador e ACL separada |
| Alta | Cookie com role por 12h; helper auth não checa active; roles divergentes | Usuário removido pode manter acesso em caminhos existentes; novo módulo deve revalidar |
| Alta | Service role em PostgREST | RLS não salva handler com autorização incorreta; negar por padrão e testar acessos cruzados |
| Alta | Webhooks existentes sem ledger e efeito ZapSign não aguardado | Não copiar padrão para mensagens; inbox/outbox/worker duráveis obrigatórios |
| Alta | Envio externo sem transação distribuída | Duplicação após timeout; estado unknown, correlação e revisão |
| Alta | Ausência de realtime autenticado | Não lançar canal público ou usar service key no browser; provar isolamento primeiro |
| Alta | Schema SQL local ≠ deploy; flags e bases não verificadas | Inventário read-only de staging antes das migrations; não acoplar às tabelas não provisionadas |
| Média/alta | Logs de integrações preservam payload/resposta e erros brutos | Redaction e TTL para conteúdo, mídia e secrets |
| Média/alta | Backups de produção presentes entre arquivos versionados | Material cadastral histórico exige governança; não copiar a prática para conversas |
| Média | Configurações de canal/provedor globais nos helpers legados | Multi-número exige connection/channel explícitos, sem fallback para canal default |
| Média | Metadata recente de identidade/conta Meta em evolução | Telefone opcional e IDs opacos/escopados; validar versão e rollout |

Esses riscos derivam de fluxos e configurações no repositório; não afirmam incidente ocorrido nem exploração confirmada.

## 22. Dívidas técnicas que podem impactar o módulo

1. `script.js` monolítico e páginas backend grandes: extrair somente componentes do Atendimento para arquivos dedicados, sem refatoração global como pré-requisito.
2. Helpers duplicados entre `_lib`/`api/_lib`, inclusive sessão: escolher entrada canônica nas novas rotas para não ampliar divergência.
3. Migrações SQL soltas com contratos de schema parcialmente compatíveis e flags: prever verificação/versionamento do schema do módulo e rollback por desabilitação de tráfego.
4. Mistura de UID Auth/document ID/IDs financeiros: namespace explícito, nenhuma FK por email/telefone como identidade mestre.
5. Mirror DataCrazy sem telefone e dependente de sincronização: não bloquear inbound esperando CRM; medir freshness e cobertura.
6. Mirror cadastral best-effort entre Firestore e Supabase: reads 360 devem declarar origem/freshness, não copiar campos e eleger novo cadastro.
7. Outbox da Retenção já existe, mas presença de tabela não demonstra dispatcher genérico operante. Evoluir claim/recovery com compatibilidade; não consumir eventos de outros domínios inadvertidamente.
8. `pedagogico_pending_writes` e logs n8n não equivalem a fila de mensagens. Histórico de problemas documentado em `docs/ARCHITECTURE.md` é precedente a evitar.
9. Rate limiting em `Map` em login/leads é por instância. Para tráfego real de Atendimento, usar limitação compartilhada por usuário/canal e limites do provedor.
10. Revogação, grants e retenção não são políticas uniformes hoje. Criar contrato do novo módulo e testes sem prometer corrigir todo o sistema nesta iniciativa.

## 23. Plano de implementação dividido em fases

Todos os caminhos abaixo são **prováveis/futuros**. Cada fase exige revisão, staging isolado e evidência dos testes. Não executar migrations ou conectar Meta nesta auditoria.

### Fase 1 — Messaging Foundation

- **Escopo:** contratos do domínio; auth com perfil ativo; habilitação/ACL mínima; contatos desconhecidos, canais, conversa e mensagem; inbox webhook normalizado; transação idempotente; eventos, outbox e recuperação; cursor de leitura; confirmação de viabilidade do realtime em staging.
- **Arquivos/componentes:** `api/_lib/attendance-auth.js`, `attendance-domain.js`, `attendance-store.js`, `attendance-worker.js`, `api/attendance/internal/jobs.js`; contratos/fixtures sintéticas em `tests/attendance-*.test.js`.
- **Migrations:** infraestrutura compartilhada de audit/outbox compatível com Retenção; contacts/identities, connections/channels, conversations/messages, webhook/status/events/reads, membership/teams mínimos; constraints, RPCs, índices, RLS e grants. Nenhuma migration de CRM/cadastro.
- **APIs:** leitura interna autorizada de conversa; comando de intenção e processor de eventos sintéticos somente em teste/staging; worker protegido. Não publicar ingressão anônima de fixtures.
- **Dependências:** decisão Postgres, inventário real de schema, IDs e acesso por time, scheduler/worker viável, ambiente Firebase/Supabase isolado.
- **Testes:** mesma mensagem em 20 chamadas concorrentes → 1 mensagem, 1 conversa, 1 evento lógico, unread 1; rollback/crash; locks e expiração de lease; dois atendentes; 401/403; tentativa de ler outro time; acesso direto anon negado; worker não consome eventos de Retenção.
- **Riscos:** transação fragmentada, grant excessivo, dependência acidental da Retenção habilitada. **Saída:** persistência e isolamento demonstrados sem Meta real.

### Fase 2 — Meta WhatsApp Connection

- **Escopo:** conexão oficial, Embedded Signup ou bootstrap server-side autorizado para conta própria conforme modalidade validada; webhook assinado; texto inbound/outbound; status; template/janela; anexos privados; retry e unknown.
- **Arquivos/componentes:** `api/webhooks/whatsapp.js`, `api/_lib/whatsapp-cloud.js`, `whatsapp-webhook.js`, `connections-store.js`, `connections-secrets.js`, `attendance-media.js`, `api/connections/*`, integrações do worker; ajustes allowlist em runtime-config/env.
- **Migrations:** credenciais/referências privadas, sessões signup curtas, templates, attachments, campos de capacidade/conta/correlação, bucket/políticas privadas; complementar foundation sem copiar CRM.
- **APIs:** challenge/POST webhook, signup start/complete, validate/disconnect, listar canais/templates, envio de mensagem e mídia.
- **Dependências:** app/ativos/número teste, permissões e aprovação exigidas, versão Meta fixada, credential store, scheduler durável, regras de conteúdo/opt-in.
- **Testes:** raw bytes com Unicode; assinatura errada; replay/lote misto; canal desconhecido; status fora de ordem e antes da resposta; 24h no limite; opt-out; template rejeitado; token revogado; timeout após aceite; anexo incorreto/SSRF; duas conexões sem cruzamento; revisão de ausência de segredo no browser.
- **Riscos:** conta não habilitada, mudança de contrato externo, resposta duplicada por legado, retry inseguro. **Saída:** integração de teste observável e recuperável ponta a ponta.

### Fase 3 — Inbox UI

- **Escopo:** shell Atendimento, filas e timeline paginadas, composer, pending/unknown/failed, notas, anexos, leitura por usuário, busca autorizada e realtime sem polling de segundo; conteúdo de Conexões.
- **Arquivos/componentes:** `attendance.js`, `attendance-realtime.js`, estilos dedicados, integração pontual em `api/_templates/app.html`, `api/app.js`, rotas de `script.js`; render de Conexões.
- **Migrations:** políticas realtime/notificações e índices comprovadamente necessários para a inbox; sem tabela espelho de mensagens no Firestore.
- **APIs:** list/detail/messages/read/notes/attachments e dados sanitizados de conexões.
- **Dependências:** fase 2 funcional, ponte Firebase/Supabase e renovação de token validadas, ACL da fase 1.
- **Testes:** duas abas, reconnect com evento perdido, ordenação/paginação, unread individual, XSS em conteúdo, notas internas, remoção de acesso, falhas de envio e recuperação visual, mobile e teclado.
- **Riscos:** duplicar estado como fonte de verdade no frontend, vazamento em notificações/cache, regressão do shell. **Saída:** fluxo utilizável em preview com usuários de teste.

### Fase 4 — Multiatendimento

- **Escopo:** gestão dos quatro times, responsáveis, assumir/transferir, filas compartilhadas, prioridade, pendente/adiada/resolvida, SLA operacional inicial e auditoria completa.
- **Arquivos/componentes:** `attendance-assignment.js`, `attendance-teams.js`, RPCs de transição, rotas assignment/status, drawer de gestão e jobs de snooze.
- **Migrations:** ampliar campos/regras de equipes já introduzidos; índices de filas, histórico, constraints e jobs de snooze; não criar outro cadastro de atendentes.
- **APIs:** CRUD autorizado de times/memberships, transferência, assumir, status/prioridade, auditoria.
- **Dependências:** política de escopo acordada, revalidação de perfil, concorrência/versionamento da foundation.
- **Testes:** duas pessoas assumindo simultaneamente; remoção de membro com tela aberta; transferência entre canais/times proibidos; envio em disputa; snooze vencido/inbound reabrindo; auditoria de antes/depois.
- **Riscos:** confundir papel global com time, reatribuição silenciosa, acesso ao histórico indevido. **Saída:** responsabilidade única e verificável em operação simultânea.

### Fase 5 — Space Identity / visão 360

- **Escopo:** auditoria read-only de qualidade, normalizador testado, índice derivado, links explícitos/revisão de colisões, enriquecimento Lead/Aluno com origem e freshness; nenhuma sincronização bidirecional de cadastro.
- **Arquivos/componentes:** `api/_lib/space-identity-resolver.js`, `identity-phone.js`, adaptadores Firestore/DataCrazy, job de indexação, painel de vínculo/contexto.
- **Migrations:** `identity_phone_index`, `contact_identity_links` se ainda não provisionada, índices e histórico de revisão; sem alterações destrutivas nos cadastros existentes.
- **APIs:** identity read, candidates autorizados, link/unlink/review, job interno de atualização.
- **Dependências:** shape e ID de lead/telefone DataCrazy comprovados, paginação completa e freshness, regras BR/internacional, política de acesso ao financeiro/pedagógico.
- **Testes:** DDD 55, +55 duplicado, DDI 1, nono dígito, familiar compartilhado, múltiplos negócios, lead convertido, troca/reutilização de número, origem fora do ar, vínculo inválido, BSUID sem telefone.
- **Riscos:** falso positivo de identidade. **Saída:** ambiguidade explícita e auditável; nenhuma associação perigosa automática.

### Fase 6 — Automação, métricas e IA

- **Escopo:** automações idempotentes sobre eventos, respostas rápidas, métricas derivadas de mensagens/atribuições, SLA, sugestões IA com revisão humana inicial e limites de dados.
- **Arquivos/componentes:** `attendance-automation.js`, `attendance-metrics.js`, worker/event consumers, UI de quick replies e sugestões; adapter de IA apenas após política de privacidade definida.
- **Migrations:** quick_replies se pendente, regras/versionamento, logs de execução idempotentes e agregados; novas tabelas de IA só com caso de uso aprovado.
- **APIs:** quick replies, regras, métricas e sugestões; todo envio automático passa pelo mesmo comando/autorização/janela/outbox.
- **Dependências:** operação estável, qualidade de identidade medida, privacidade/retenção, definição de métricas e orçamento/limites.
- **Testes:** loop de automação, evento repetido, bot versus humano, opt-out, janela vencida, redaction, acesso por time, métricas reprocessáveis, sugestão sem envio automático.
- **Riscos:** envio indevido/duplicado, dados expostos à IA, métricas contando tentativas como mensagens. **Saída:** automações desligáveis e auditáveis, sem nova fonte concorrente de mensagens.

### Decisões de entrada e primeiro bloco exato

Registrar antes de codificar: Postgres como owner; UID textual; uma instalação/múltiplos times e números; uma conversa não resolvida por canal/contato; política de histórico e atribuição; modo de scheduler; Firebase third-party para realtime; guarda de credenciais; prazos de retenção; modalidade Meta. As recomendações acima permitem uma decisão objetiva, não exigem redesenhar a plataforma.

**Entrega inicial recomendada:** uma RPC testável `attendance_ingest_message` e seu store com constraint por ID externo, lock de conversa, contato desconhecido e evento/outbox na mesma transação, mais autorização mínima e worker recuperável em staging. O teste de aceite é replay/concorrência sem duplicação e sem acesso cruzado. Isso prova o núcleo que o webhook oficial, a UI e o multiatendimento usarão. Não começar pela tela, pelo cadastro de aluno duplicado nem por um token Meta no frontend.

### Validação deste documento

Auditoria estática de código e configuração; referências locais e cobertura das 23 seções revisadas. Sem execução de suíte que possa acessar integrações, sem consulta/mutação de dados remotos e sem implementação. Validar comportamento real de schema, permissões, credenciais e plataformas no staging integra o plano, não uma alegação de resultado já obtido.
