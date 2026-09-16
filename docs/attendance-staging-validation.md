# Atendimento — auditoria de staging e gate para Meta

## Política vigente — decisão executiva de 15/09/2026 UTC

**A Space optou temporariamente por usar o ambiente principal como ambiente de desenvolvimento/homologação do módulo Atendimento porque não há usuários ativos na plataforma neste momento**, conforme informado pelo responsável.

A ausência de staging deixou de ser requisito de bloqueio. Produção é permitida somente para o projeto principal conhecido, com credencial vinculada e `ATTENDANCE_ALLOW_PRODUCTION_MUTATIONS=true`; sem isso, o guard continua fail-closed. Os guards dos demais módulos não são relaxados por essa flag.

**Foundation aprovada no PostgreSQL/PostgREST principal:** migration aplicada, catálogo conferido, testes remotos concluídos e fixtures removidas. Relatório vigente: [homologação em produção](attendance-production-validation.md). As referências a staging obrigatório, produção proibida ou homologação pendente no registro abaixo descrevem fases anteriores e foram substituídas por esta decisão.

---

## Registro histórico da fase anterior

Data: 14/09/2026, America/Sao_Paulo (execuções finais em 15/09 UTC).

**Decisão atual: NO-GO para iniciar a integração Meta — configuração externa de credenciais e homologação pendentes.** Na fase seguinte, autorizada pelo usuário, foi encontrado o projeto separado **space-staging (`uac…xgm`)**, retomado de paused para **Healthy**, e executado o inventário remoto read-only. PostgreSQL 17.6, schema public vazio. Produção permanece sem alterações por esta tarefa. A migration ainda não foi aplicada; faltam credenciais SQL/API vinculadas ao guard, Vercel e testes remotos do domínio.

**Atualização de identificação/provisionamento:** [attendance-environments.md](attendance-environments.md). Evidência exportada do catálogo: [JSON remoto](evidence/attendance-staging-inventory-2026-09-14.json). Os §§1–23 abaixo preservam o registro da auditoria anterior e seu runbook; afirmações de staging não identificado/nenhum SQL remoto descrevem aquela execução anterior, não o estado atualizado acima. O novo pedido autoriza identificar/provisionar staging, superando a restrição administrativa do runbook anterior.

Esta revisão leu integralmente [a arquitetura](attendance-whatsapp-architecture.md), [a foundation](attendance-foundation.md) e [a migration](../supabase/migrations/202609140001_attendance_foundation.sql). Preserva esses documentos e a migration; acrescenta segurança de ambiente e preparação operacional. Validação local não equivale à homologação cloud.

## 1. Environments encontrados

Inspeções realizadas: arquivos `.env*` apenas com nomes/presença/identificadores mascarados, variáveis do processo, `_lib/runtime-env.js`, cliente Supabase, scripts, configuração Vercel, metadados locais de vínculo e variáveis remotas do projeto Vercel `space`.

| Fonte | Evidência | Conclusão |
| --- | --- | --- |
| `.env.local` | `VERCEL_ENV=production`; URL e service role presentes; ref do JWT coincide com URL | Produção, apesar do nome local |
| `.env.vercel.pull` | Mesmos marcadores e mesmo projeto de `.env.local` | Produção |
| `.env.example` | `APP_ENV=local`, Supabase vazio | Exemplo, sem isolamento provisionado |
| `.env.staging.example` | `APP_ENV=staging`, URLs e credenciais Supabase vazias | Exemplo, não ambiente |
| `.env`, `.env.development`, `.env.production`, `.env.preview`, `.env.staging`, `.env.staging.local` | Ausentes na raiz inspecionada | Nenhuma configuração adicional identificada |
| Processo da tarefa | Sem variáveis Supabase/staging/Vercel de destino | Nenhum alvo herdado identificado |
| Vercel Production | `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` presentes; mesmo projeto local | Produção confirmada por configuração |
| Vercel Preview | `SUPABASE_URL`, `SPACE_STAGING_SUPABASE_URL` e `APP_ENV` cadastrados, **valores vazios**; service role ausente | Preview não comprova staging |
| Vercel Development | Nenhuma variável de projeto cadastrada; pull retornou somente metadado de sistema | Não provisionado |

`vercel env ls` encontrou 40 cadastros Preview e 33 Production, sem variáveis específicas de branch nessa listagem. A leitura GET do endpoint de pull usado pela CLI confirmou os valores efetivos em memória, sem gravar secrets em arquivo. Listar o nome de uma variável como “Encrypted” não comprova que tenha valor. A resposta de listagem não foi usada como evidência de conteúdo; o pull foi necessário para confirmar os vazios.

`.vercel/repo.json` identifica o projeto/organização; `.vercel/project.json` contém settings de build, sem alvo de banco. Não há `.github`/GitHub Actions, `supabase/config.toml` ou pipeline npm de migrations nesta árvore. `package.json` executa testes e checagem de sintaxe. `vercel.json` não declara cron. Há script local `.codex/auto-git-push.sh` de sincronização Git, sem guard de banco; não foi executado. Scripts históricos `wipe-*` não são runners aprovados para Atendimento e não foram executados.

## 2. Classificação dos ambientes

| Ambiente | Supabase project | Vercel env | Status | Seguro para migration? |
| --- | --- | --- | --- | --- |
| Local de testes | Containers descartáveis PostgreSQL/PostgREST, sem Supabase remoto | Nenhum | Isolado pelo harness | Sim, somente no harness local |
| Local usando `.env.local` | `mlp…gkw` | production | Produção | **Não** |
| Development | Não identificado | development | Sem configuração de projeto | **Não** |
| Preview | URL vazia | preview | Incompleto e integrações compartilhadas | **Não** |
| Staging | Não identificado/verificado | Não há vínculo utilizável comprovado | Bloqueado | **Não** |
| Production | `mlp…gkw` | production | Existente | **Não nesta fase** |

O runtime geral trata Preview como staging e permite defaults públicos de Firebase produção em local. Portanto, nome de arquivo, banner, `NODE_ENV` e `VERCEL_ENV=preview` não são provas suficientes. Dúvida é classificada como produção para autorização operacional.

## 3. Environment guards implementados

[Guard](../_lib/attendance-environment.js), [allowlist](../config/attendance-staging-targets.json), [runner](../scripts/attendance-staging.js) e [template](../scripts/attendance-staging.env.example).

O guard exige simultaneamente:

1. `APP_ENV=staging` e `SUPABASE_ENV_SCOPE=staging`; sinais opcionais `SPACE_ENV`, `SPACE_APP_ENV`, `VERCEL_ENV`, `VERCEL_TARGET_ENV` não podem contradizer staging. `NODE_ENV=production` é permitido em build staging, sem servir como identidade.
2. URLs HTTPS canônicas Supabase, sem userinfo, porta alternativa, path, query ou fragmento; URL efetiva igual à referência staging e ao `ATTENDANCE_STAGING_PROJECT_REF`.
3. Referência de produção conhecida por SHA-256 no arquivo versionado. Renomear produção na env não contorna a lista de bloqueio.
4. Exatamente uma entrada staging aprovada na allowlist. **Ela está vazia nesta entrega**; nenhum projeto foi implicitamente autorizado.
5. Hash SHA-256 da service role igual ao aprovado fora da env de execução. Aceita chave opaca `sb_secret_` ou JWT; neste último confere também role, ref e validade. Decodificar JWT não valida sua assinatura; a vinculação administrativa pelo hash é independente dessa inspeção.
6. Fallbacks de URL/chave, quando presentes, devem coincidir.
7. Para comandos: `--environment=staging`, `--confirm-staging` e `ATTENDANCE_STAGING_CONFIRM=staging:<ref>`.
8. URL de banco direta `db.<ref>.supabase.co:5432/postgres`, usuário postgres, sem parâmetros libpq; senha deve coincidir com hash aprovado. Pooler/custom domain/branch sem ref próprio são recusados até revisão explícita.

O handler e store existentes agora passam também pelo guard novo em `attendance-domain.js`. A flag HTTP continua desligada por padrão. O runner não carrega `.env.local` implicitamente: exige arquivo explícito, rejeita chaves duplicadas e conflitos com variáveis relevantes herdadas. O processo psql recebe ambiente mínimo, conexão TLS `verify-full`, trust store do sistema, timeout e senha fora de argv; não recebe `PGSERVICE`, `PGHOSTADDR`, `PGOPTIONS` ou configuração herdada de destino.

Guard inválido retorna erro sanitizado e **exit 1 antes de conexão SQL**. O preflight válido é estritamente offline: significa configuração consistente, não disponibilidade ou aprovação cloud. O próprio `.env.local` foi testado no preflight e bloqueado com `attendance_environment_requires_staging`.

Limite de confiança: um administrador capaz de mudar a allowlist, a revisão e o código pode contornar controles locais; esses arquivos precisam de revisão e execução em checkout confiável. Não se trata de isolamento contra administrador hostil. Nenhum shell arbitrário ou arquivo SQL escolhido pelo caller é aceito pelo runner. Os guards novos cobrem Atendimento; não certificam os scripts destrutivos históricos.

## 4. Staging identificado

**Nenhum staging utilizável foi identificado.** Isso não prova que inexista projeto em alguma organização Supabase não conectada à tarefa. Não há CLI/token de administração Supabase disponível nem configuração local que comprove outro projeto. Não foram criados projeto, branch, usuário, credencial, deploy ou integração externa.

Faltam ref/URL verificáveis, credenciais específicas, destino direto do banco, Firebase de teste validado e configuração Vercel coerente. Na Vercel Preview faltam também as referências de produção e scopes necessários ao guard. Não houve tentativa de usar produção como substituto.

## 5. Project ref mascarado

- Projeto conhecido de produção: `mlp…gkw`; hostname `mlp…gkw.supabase.co`.
- Staging: indisponível; nenhum ref inventado.
- O arquivo de política guarda apenas o hash da referência de produção. A allowlist de staging não contém entradas. Não há segredo ou URL com credencial nos artefatos entregues.

## 6. Schema drift

**Bloqueado remotamente.** O catálogo de produção consultado na fase anterior não é evidência de staging e não foi consultado novamente nesta fase.

[Inventário preparado](../scripts/attendance-schema-inventory.sql): versão do servidor, schemas/owners/ACLs, roles e heranças, extensions, relações/RLS, colunas/tipos/nullability/default hashes, constraints, índices/validade, assinaturas/owners/definer/search_path/ACL/body hashes de funções, triggers, policies, default privileges e publicações. Executa em transação read-only com timeout, após o guard. Não lê conteúdo das tabelas, senhas de roles ou corpos de funções legadas.

Comparar com schema esperado produzido pela mesma migration em banco local limpo. Ausência de novas tabelas é esperada numa primeira aplicação; objeto homônimo inesperado não é automaticamente compatível. `IF NOT EXISTS` não adapta tipos, índices, policies ou constraints existentes. Bodies/expressões com hashes diferentes precisam de revisão privada no staging por operador autorizado; o hash detecta diferença, não explica nem aprova compatibilidade.

Não aplicar se houver colisão nas 14 tabelas, overload inesperado de `attendance_*`, estrutura incompatível em audit/outbox, role ausente, grants herdados indevidos ou consumidores compartilhados não isolados. O runner exige uma revisão vinculada ao hash do catálogo atual e da migration, ref exato e validade máxima de 24h. Alteração de catálogo invalida a revisão. Esse registro é evidência de revisão humana, não comparador semântico automático.

## 7. Migration risk report

**SAFE** = operação prevista em namespace novo compatível, após confirmação do destino; **REVIEW** = exige catálogo/consumidores reais; **BLOCKED** = aplicação proibida nas condições atuais.

| Operação da migration | Classe | Motivo/condição |
| --- | --- | --- |
| `BEGIN`, timeouts, `COMMIT` | SAFE | Transação única; lock timeout 5s, statement timeout 60s por statement |
| Criar as 14 tabelas de domínio | REVIEW | Aditivo quando ausentes; nomes genéricos precisam de inventário para excluir colisões |
| UUID, checks, FKs simples/compostas, uniques e índices | SAFE | Preservam integridade no schema novo; validados localmente; tamanho/locks remotos pendentes |
| FKs adicionais condicionadas ao nome | REVIEW | Constraint com mesmo nome e definição diferente pode ser mantida por `IF NOT EXISTS` |
| `CREATE TABLE IF NOT EXISTS audit_logs/outbox_events` | REVIEW | Reutiliza contrato Retenção; não compara colunas, defaults, constraints ou owners existentes |
| Habilitar RLS em audit/outbox | REVIEW | **Altera estado de tabelas compartilhadas existentes**; pode interromper consumidores que dependam de grants sem policies |
| Funções `CREATE OR REPLACE` | REVIEW | Substitui bodies existentes; verificar ownership, assinatura e origem das funções homônimas |
| SECURITY DEFINER + search_path fixo | REVIEW | Tabelas schema-qualified; exige dono confiável e schema public sem CREATE para usuários não confiáveis |
| DROP/CREATE dos dois triggers `attendance_*` | REVIEW | Não remove dados, mas substitui proteção existente; somente names próprios nas tabelas esperadas |
| Enable RLS + REVOKE nas 14 tabelas | SAFE | Nega acesso direto no modelo novo; herança/default ACL/publications precisam de inspeção remota |
| REVOKE por prefixo `attendance_*` | REVIEW | Loop alcança qualquer função homônima no namespace, inclusive overload não esperado |
| GRANT EXECUTE por seis nomes | REVIEW | Aplicação fresca concede seis assinaturas; overload com mesmo nome também seria alcançado pelo loop |
| Preservar grants compartilhados audit/outbox | REVIEW | Evita refatorar Retenção, mas não comprova que grants instalados sejam adequados |
| `NOTIFY pgrst, 'reload schema'` | SAFE | Solicita refresh de catálogo, não prova que PostgREST já recarregou |
| Aplicação em alvo desconhecido/produção | BLOCKED | Regra absoluta desta tarefa |
| Aplicação remota atual | BLOCKED | Falta staging, catálogo e revisão de consumidores |

Não há DROP de tabela/schema/coluna, TRUNCATE, seed, UPDATE/DELETE de legado ou criação de extension. O DML dos corpos das RPCs só ocorre quando invocadas. PostgreSQL 14+ fornece as funções nativas usadas; são pré-requisitos roles Supabase e permissão de criação/alteração pelo operador. Os testes usam PostgreSQL 16.

Reaplicabilidade **local** foi novamente testada, inclusive coexistência com SQL Retenção. Não é garantia contra schema remoto desconhecido. Não foi alterada a migration para “corrigir” legados não inspecionados.

## 8. Migration aplicada ou bloqueada

**Não aplicada remotamente.** Timestamp de aplicação, resultado SQL remoto e warnings remotos: não aplicável. Nenhuma operação foi enviada a Supabase.

Runner preparado com três modos:

- `preflight`: somente validação offline.
- `inventory`: somente catálogo read-only, arquivo privado novo com modo 0600.
- `apply`: inventário fresco → revisão exata → somente migration fixa → novo inventário → verifica 14 tabelas com RLS e seis RPCs SECURITY DEFINER/search_path. Salva evidência pós-apply e informa contagem de warnings. A verificação de objetos não substitui testes de privilégios/isolamento.

Saída bem-sucedida de apply diz explicitamente que homologação remota ainda é necessária. Falha/timeout após iniciar apply não prova rollback: consultar catálogo e registro privado antes de repetir. Não usar retry cego. Ausência de `psql` ou falta de suporte TLS/trust store causa erro fechado; não instalar nem baixar cliente para conectar a alvo indefinido.

## 9. Testes remotos e validação local

**Testes remotos: não executados, bloqueados.** Login Firebase e API Vercel de staging também não homologados.

Validação local desta fase:

| Execução | Resultado |
| --- | --- |
| Guard + API + SQL foundation + inventário real | **49 aprovados, zero falhas, zero skips** |
| `npm test` na árvore compartilhada | **320 testes: 316 aprovados, zero falhas, 4 skips** |
| Preflight com `.env.local` | Bloqueio esperado antes de SQL; exit 1 |
| Sintaxe do guard e runner | Aprovada |

Comando dedicado:

```sh
RUN_ATTENDANCE_SQL_INTEGRATION=1 node --test tests/attendance-api.test.js tests/attendance-environment.test.js tests/attendance-staging-sql.test.js tests/attendance-sql-integration.test.js
```

Evidência local: `/tmp/space-attendance-staging-tests.log`. A primeira tentativa falhou por indisponibilidade transitória de imagem no Docker; após conferir/revalidar as imagens locais, a execução completa acima passou. Imagens PostgreSQL 16 e PostgREST 12; sem dependência nova no package/lockfile. O inventário executou e foi estável entre duas leituras sem mudança de schema.

Regressão registrada em `/tmp/space-attendance-staging-regression.log`. Os quatro skips gerais são integrações opt-in: duas da Retenção e duas do Atendimento. As duas de Atendimento foram executadas com SQL habilitado na suíte dedicada acima; não são evidência remota. A árvore compartilhada recebeu testes de outros trabalhos, por isso o total geral difere dos 289 testes da fase anterior.

Os testes novos cobrem os seis casos de ambiente solicitados e ainda conflitos Vercel/SPACE, URL pública divergente, host adulterado, senha/credencial divergente, parâmetros de conexão, allowlist vazia/duplicada, denylist, JWT inconsistente/expirado, duplicidade de env, herança, argumentos arbitrários, ausência/expiração/drift da revisão, ausência de SQL no bloqueio e exigência de verificação pós-apply. Testes do runner usam executor injetado para provar ordem de autorização; o teste SQL separado usa Postgres real para validar o inventário.

## 10. Concorrência

Remota: bloqueada. Local: reexecutados os cenários da foundation com requests PostgREST reais, locks reais, verificação de múltiplos backends aguardando, 20 replays simultâneos, 20 mensagens/criação de conversa, disputa de assignment, metadata/version e mensagem versus comando. Não extrapolar latências locais para Supabase cloud.

Na execução remota futura registrar 20 resultados da mesma inbound, IDs retornados, número de representações persistidas, eventos/outbox e duração. Para assignment concorrente, mesmo `expected_version`, comandos distintos: um sucesso e um `409`; nunca dois vencedores. Aguardar todas as operações antes de cleanup.

## 11. Idempotência

Remota: bloqueada. Invariantes locais aprovadas: unique(channel, external_message_id), conflito de fingerprint, replay após resolução, external_event_id por item normalizado e intenção/comando com chave por conversa/ator. Vinte duplicatas devem gerar uma mensagem, uma conversa ativa e um conjunto lógico de efeitos; dois IDs externos distintos com conteúdo igual continuam mensagens legítimas.

A suíte remota deverá comparar também contadores, unread, last_message, audit e outbox antes/depois do replay, não apenas o HTTP 200. Fingerprint não substitui ID oficial nem deduplicação do envelope futuro.

## 12. Isolamento

Remoto: bloqueado. Local: testes de times/transferência/revogação e autorização passaram.

Fixture remota obrigatória: Team A e B, User A e B, supervisor com grants explícitos, admin sem membership. A lê A/B lê B; A não lê B/B não lê A; admin sem membership negado. Repetir em GET detalhe, timeline, listagem, append e update; testar também acesso HTTP com Firebase real, além das RPCs. Não inventar UID de administrador existente.

Confirme contato inicialmente `unidentified`, telefone `format_only`, ausência de lookup automático de Lead/Aluno e vínculo manual contextual auditado. Vínculo de um time não deve alterar identidade contextual do outro. O SQL não verifica existência real de pessoa Firestore/DataCrazy; essa validação é responsabilidade da interface confiável de associação.

## 13. Privilege review

| Principal/superfície | Contrato estático/local | Remoto |
| --- | --- | --- |
| PUBLIC, anon, authenticated | Sem acesso direto às 14 tabelas; sem EXECUTE em funções Attendance | Não verificado |
| service_role, tabelas Attendance | REVOKE ALL; BYPASSRLS não substitui GRANT de tabela | Não verificado |
| service_role, RPCs | Seis pontos de entrada; ator humano exige membership/time/canal; ingest exige conexão/provider/canal coerentes | Não verificado |
| Helpers de ACL/audit/triggers/normalização | Sem EXECUTE direto para roles de aplicação | Não verificado |
| audit_logs/outbox_events | Grants existentes preservados; RLS habilitada | Revisão obrigatória |
| Operador/dono do schema | Poder administrativo sobre DDL/RPCs | Credencial de operação não pode ir à Vercel/browser |

Seis RPCs: `attendance_ingest_message`, `attendance_append_message`, `attendance_update_conversation`, `attendance_mark_read`, `attendance_get_conversation`, `attendance_list_conversations`. As cinco de usuário não aceitam papel do body como autorização. Assignment e identity exigem supervisor; transferência exige origem/destino. Ingest não possui endpoint HTTP público nesta fase.

Todas as oito funções SECURITY DEFINER (seis RPCs, helper ACL e gravação de evento) fixam `search_path=pg_catalog,public`; as relações usadas são qualificadas por schema. Revisar CREATE em public, owners, heranças de role, overloads, default grants e funções preexistentes. O path não explicita `pg_temp`; não foram encontradas relações temporárias não qualificadas nos corpos, mas não aprovar extensões futuras desse padrão sem revisão. Não declarar ausência de privilege escalation remoto sem catálogo e testes reais.

## 14. Service role: uso e blast radius

**Risco HIGH.** A chave compartilhada permite chamar RPC como qualquer `p_actor_uid` e ingerir eventos como backend. A identidade do usuário depende da autenticação Firebase antes da RPC. Vazamento permite impersonação e acesso a outros domínios que concedam privilégios à mesma role. Não existe credencial service role exclusiva do Atendimento nesta arquitetura.

Leitura direta das envs: `api/_lib/supabase-rest.js` é o cliente canônico; `api/health.js` testa presença; `scripts/backfill-live-lessons.js` e `scripts/wipe-production-data.js` possuem acesso próprio. O guard novo inspeciona a chave, mas não a transmite. O runner usa credencial SQL administrativa distinta, somente fora da aplicação.

Mapa estático de handlers com cadeia de imports até `supabase-rest` (capacidade potencial, execução efetiva depende de branch/flags/auth):

```text
api/admin-students-import.js           api/admin-users.js
api/asaas-webhook.js                  api/attendance.js
api/aula-encerramento.js              api/aula.js
api/datacrazy-sync.js                 api/financeiro-cobrancas.js
api/financeiro-dashboard.js           api/growth-dashboard.js
api/growth/copilot-vendas/data.js     api/growth/copilot-vendas/training.js
api/live-lessons/index.js             api/live-lessons/feedbacks.js
api/live-lessons/[id]/feedback.js     api/live-lessons/[id]/recording.js
api/live-lessons/[id]/register.js     api/live-lessons/[id]/status.js
api/pedagogico/alerts.js              api/pedagogico/dashboard.js
api/pedagogico/flexge/action.js       api/pedagogico/iniciar-onboarding.js
api/pedagogico/lesson/action.js       api/pedagogico/onboarding/first-lesson.js
api/pedagogico/onboarding.js          api/pedagogico/professor-primeira-aula.js
api/pedagogico/reconciliation.js      api/pedagogico/registro-aula.js
api/pedagogico/registro-falta.js       api/pedagogico/remarcacao-aula.js
api/pedagogico/student.js             api/pedagogico/teacher-students.js
api/pedagogico/zapsign.js             api/retention-cases.js
api/retention-churn-job.js            api/retention-import.js
api/schedule-events.js               api/space-office.js
```

Os helpers intermediários incluem retention-store, datacrazy-mirror, live-lessons/recordings, growth-copilot, pedagogico-service/reconciliation/n8n, student-mirror-sync e attendance-store. Este inventário é snapshot da árvore compartilhada durante a revisão, não certificação de todo o backend.

Não foi encontrada chave service role exposta pelo frontend/runtime-config nos caminhos inspecionados; a ocorrência do nome em `script.js` é texto de erro orientando uso **no backend**, sem valor. A configuração pública é allowlist de Firebase/features, não dump de `process.env`. Isso não substitui inspeção de artefatos e responses no deploy de staging; se houver exposição, passa a blocker crítico.

Redução futura sem redesenho global: credencial própria de executor restrita às RPCs necessárias, separar ingestão de comandos humanos, restringir secrets por projeto Vercel, rotação e monitoramento. Chave service_role diferente do mesmo projeto, sozinha, não cria papel menos privilegiado. Não foi alterada a arquitetura de autenticação nesta fase.

## 15. Performance baseline

**EXPLAIN/EXPLAIN ANALYZE remoto não executado.** Nenhuma métrica cloud estimada ou inventada. Preparar somente SELECT com limites em transação read-only, `statement_timeout=5s`, usando fixture do run e `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` quando o operador confirmar volume pequeno.

| Consulta representativa | Índice esperado/ponto de atenção |
| --- | --- |
| `conversations WHERE team_id=:team AND status='open' ORDER BY last_message_at DESC NULLS LAST, conversation_id DESC LIMIT 50` | `conversations_team_queue_idx` cobre time+status+ordem |
| `conversations WHERE assigned_user_uid=:uid ORDER BY last_message_at DESC NULLS LAST, conversation_id DESC LIMIT 50` | Parcial `conversations_assignee_queue_idx` |
| Time com todos os estados, mesma ordenação | Coluna status entre time e timestamp pode exigir sort; medir |
| Abertas em todos os times autorizados | Não há índice global status/ordem; avaliar plano e seletividade da ACL |
| `messages WHERE conversation_id=:id AND sequence>:cursor ORDER BY sequence LIMIT 50` | Unique `(conversation_id,sequence)` |
| `messages WHERE channel_id=:channel AND external_message_id=:external` | Unique `(channel_id,external_message_id)` |
| `contact_identities WHERE connection_id=:connection AND identifier_type=:type AND external_identifier=:external` | Unique composto de identidade |

Examinar também a query interna da RPC de listagem com `attendance_has_access`; um Function Scan da chamada da RPC não comprova que a consulta interna usa índice. Verificar custo da checagem ACL por linha, sorts, buffers, estimativa versus linhas reais e keyset. Dataset minúsculo pode corretamente usar Seq Scan; não desabilitar seqscan nem criar índices sem evidência. Sem benchmark de carga ou EXPLAIN de DML.

## 16. Observabilidade e correlação

| Identificador | Estado atual | Contrato para próxima fase |
| --- | --- | --- |
| `request_id` | Não gerado automaticamente pelo handler | Gerar UUID no backend no ingresso; validar/limitar header recebido, usar como correlação operacional; não como autorização ou dedupe |
| `external_event_id` | Mensagem normalizada, escopo de canal | Um ID por item; não compartilhar entre mensagens de um mesmo envelope |
| `external_message_id` | Persistido/unique por canal | Preservar ID oficial; incluir canal/conexão na pesquisa protegida |
| `message_id`, `conversation_id` | Retornados pela RPC; presentes em eventos/outbox | Eixo de correlação persistente entre ingestão e efeitos |
| `connection_id` | Canal referencia conexão; ingest confere par/provider | Registrar ID local em logs, nunca token da conexão |
| `conversation_event_id` | Evento append-only; `audit_logs.payload.event_id` | Correlaciona evento lógico e auditoria |
| `outbox_event_id` | Coluna existente `outbox_events.id` | Dispatcher futuro deve logar esse ID e message/conversation IDs ao reivindicar/terminar |

Caminho disponível: ID externo + canal → message_id → conversation_id → evento (payload.message_id) → audit (event_id) → outbox (aggregate_id/payload.message_id ou conversation_id) → canal → conexão. Comandos usam também client_action_id; intenções client_request_id. O retorno atual da RPC não contém IDs de audit/outbox; não simular esses IDs no adapter. Lookup protegido pelo serviço/operador ou evolução explícita do contrato resolve essa necessidade.

Para o futuro ingresso/dispatcher, log estruturado mínimo: timestamp, request_id, operação, connection/channel IDs, IDs local/externo aplicáveis, outbox ID, resultado sanitizado, duração, duplicate/retry. Não logar conteúdo, telefone, perfil, headers Authorization, credenciais, URL de banco ou corpo upstream. Nesta fase a correlação está definida; não foi implementado webhook, dispatcher ou stack de logs.

## 17. Riscos

| Risco | Nível | Tratamento |
| --- | --- | --- |
| Alvo remoto ambíguo/ausente | CRITICAL para execução | Bloqueado pelo guard e NO-GO |
| Credenciais n8n/Chatwoot/CRM/ZapSign compartilhadas Preview/Production | HIGH | Isolar/desabilitar antes de testes via aplicação; não chamar integrações reais |
| Service role compartilhada e impersonação por RPC | HIGH | Backend confiável + ACL, revisão e redução de privilégios futura |
| RLS/grants/consumidores audit/outbox desconhecidos | HIGH | Revisão do catálogo e consumidores antes de apply/fixtures |
| Overloads/prefixo attendance e colisões genéricas | HIGH | Bloquear divergências; revisão de assinaturas exatas |
| Mudança concorrente de DDL após snapshot | MEDIUM | Janela sem DDL concorrente durante revisão/apply; hash não é lock global |
| Cleanup versus eventos imutáveis | HIGH | Plano restritivo revisado antes de criar fixtures |
| Índice de fila sem filtro status/ACL por linha | MEDIUM | EXPLAIN real antes de crescer carga |
| Request ID não integrado ao ingresso | MEDIUM | Contrato definido; implementar com o futuro adapter após gate |

## 18. Blockers

1. Supabase staging não identificado com URL/ref/DB/credenciais verificáveis.
2. Preview sem valores essenciais de staging, com variáveis externas compartilhadas com produção.
3. Sem catálogo remoto, schema drift e review real de privilégios/consumidores.
4. Migration não aplicada nem objetos remotos verificados.
5. Persistência, idempotência, concorrência, isolamento, identidade/auditoria/outbox e auth não homologados remotamente.
6. Plano/executor remoto de fixtures e cleanup ainda deve ser fechado com o schema e janela de manutenção reais, antes de qualquer seed.

## 19. Dados de teste criados

Nenhuma linha remota criada; nenhum UID Firebase remoto criado; **test_run_id remoto: não aplicável**. As fixtures locais vivem somente nos containers descartáveis do harness.

Na homologação futura, gerar `test_run_id=attendance-staging-<UUID>`; usar external_account_id, external_channel_id, nomes de times e IDs externos prefixados pelo run. Metadados de conexão/canal devem conter `test_run_id`. Persistir manifesto privado com ref, run, timestamps e UUIDs exatos de connection, channels, teams, members, contacts, conversations, messages, events, audits e outbox; atualizar inclusive quando uma etapa falhar. Não usar telefone real/contato cliente como fixture.

## 20. Cleanup

Nenhum cleanup remoto necessário ou executado. Containers/redes criados pelos testes locais são removidos pelo `finally` do harness. Nenhum script `wipe-*` foi utilizado.

Procedimento remoto a concluir/revisar **antes** do seed:

1. Confirmar novamente guard, project ref e manifesto do run. Parar novas requisições do teste e aguardar as concorrentes terminarem.
2. Recuperar IDs por connection/channel pertencentes ao run para cobrir falhas anteriores à gravação completa do manifesto. Verificar todos os relacionamentos e contagens; qualquer referência fora do run bloqueia cleanup.
3. Remover audit/outbox somente por IDs exatos do manifesto **e** namespace `attendance.*`/aggregate correspondente. Nunca por prefixo temporal ou todas as linhas de Atendimento.
4. Em transação, desfazer referências circulares de mensagens/conversa somente nos UUIDs do run; remover reads, eventos, mensagens, participantes e conversas em ordem compatível com FKs; depois channel_contact_state, identities/contacts, grants/canais, conexão e memberships/times exclusivos do run. Filtros restritivos são obrigatórios em cada statement.
5. `conversation_events` bloqueia DELETE por trigger. Não improvisar `session_replication_role` ou remoção geral de triggers. A exclusão de eventos requer procedimento administrativo excepcional, em janela controlada, com lock exclusivo, restrição por IDs e proteção restaurada na **mesma transação**, ou descarte de um projeto de testes dedicado previamente autorizado. Sem esse procedimento aprovado/testado, não começar fixtures persistentes.
6. Verificar zero registros do run e preservação de registros sentinela fora dele; registrar contagens por tabela e resultado. Se falhar, manter manifesto e blocker, sem ampliar escopo de DELETE.

Não foi exposta uma RPC de cleanup nem relaxada a imutabilidade do domínio para facilitar testes. O runner desta entrega aceita preflight/inventory/apply; não aceita SQL arbitrário, seed ou cleanup. A suite Docker não deve ser redirecionada a cloud: inclui falhas/locks administrativos e testes próprios de ambiente descartável.

## 21. Decisão GO / CONDITIONAL GO / NO-GO

**NO-GO.** A integração Meta não está liberada.

| Gate | Estado |
| --- | --- |
| Guard fail-closed e testes locais | PASS |
| Produção sem alterações por esta tarefa | PASS |
| Staging inequivocamente isolado | BLOCKED |
| Migration aplicada e schema remoto validado | BLOCKED |
| Testes remotos de persistência/idempotência/concorrência/isolamento | BLOCKED |
| Privilégios remotos e ausência de risco crítico | BLOCKED |
| Decisão final para Meta | **NO-GO** |

## 22. Justificativa

Os critérios de GO exigem evidência remota que não existe nesta execução. Os testes locais são positivos e a segurança operacional foi reforçada; ambos são insuficientes para classificar risco de ambiente e permissões cloud como resolvido. CONDITIONAL GO não se aplica porque os pendentes são bloqueantes, não riscos residuais menores.

Escopo desta tarefa concluído pelo caminho de bloqueio seguro previsto no pedido: inventário, guard testado, configuração/scripts/runbook preparados e aplicação remota recusada. A fundação permanece sem liberação para tráfego Meta.

## 23. Próximos passos e runbook de desbloqueio

### A. Provisionamento administrativo necessário

Operador autorizado deve identificar ou criar **Supabase dedicado de staging**, sem dados reais e sem consumidores de produção; fornecer ref/URL, credencial backend própria e conexão SQL direta TLS com senha aleatória forte. Deve também preparar Firebase/Auth/Firestore de teste e seus usuários internos ativos, e isolar Vercel Preview de n8n/Chatwoot/CRM/ZapSign reais. Esta tarefa não autoriza criação automática dessas infraestruturas nem a cópia de produção.

Rever e preencher `config/attendance-staging-targets.json` com uma entrada `projectRef`, `serviceRoleKeySha256`, `databasePasswordSha256`, derivados da configuração administrativa de staging, não simplesmente do arquivo que o comando pretende executar. Usar hashes de credenciais de alta entropia; nunca versionar valores. A denylist contém o hash de produção conhecido; acrescentar outros projetos de produção conhecidos antes de autorizar novos alvos.

Copiar `scripts/attendance-staging.env.example` para arquivo privado fora do Git, permissão 0600. Preencher URLs/referências/credenciais e confirmação. A URL PostgreSQL deve URL-encode a senha e não conter query parameters. O cliente psql precisa suportar `PGSSLROOTCERT=system`/`sslmode=verify-full`; não reduzir TLS para contornar falha. Configurar Vercel de staging separadamente; o runner não altera envs remotas.

### B. Preflight e catálogo

Exemplos a executar **somente após A**, na raiz do repositório:

```sh
node scripts/attendance-staging.js --mode=preflight --env-file=/private/path/attendance.env --environment=staging --confirm-staging
node scripts/attendance-staging.js --mode=inventory --env-file=/private/path/attendance.env --environment=staging --confirm-staging --output=/private/path/attendance-before.json
```

Revisar metadata/schema e consumidores conforme §§6–7/13. Examinar também jobs SQL/cron, triggers externos e consumidores fora do repositório no painel de staging. Confirmar suporte de versão, permissões para DDL e ausência de CREATE no public para roles não confiáveis. Se qualquer diferença for inesperada, parar e registrar NO-GO; não editar automaticamente o legado.

### C. Revisão vinculada e aplicação

Após revisão real, operador escreve arquivo privado de aprovação:

```json
{
  "approved": true,
  "outboxConsumersIsolated": true,
  "projectRef": "REF_REAL_DO_STAGING",
  "reviewedAt": "TIMESTAMP_UTC_ISO_DA_REVISAO",
  "inventorySha256": "HASH_EXATO_RETORNADO_PELO_INVENTORY",
  "migrationSha256": "SHA256_DOS_BYTES_DA_MIGRATION_REVISADA"
}
```

Isso não é uma aprovação já concedida. Manter janela sem mudanças concorrentes de schema. O runner reconsulta o catálogo e bloqueia se hash/ref/data divergir.

```sh
node scripts/attendance-staging.js --mode=apply --env-file=/private/path/attendance.env --environment=staging --confirm-staging --review-file=/private/path/attendance-review.json --output=/private/path/attendance-after.json
```

Guardar a saída JSON com timestamp/ref mascarado/hash/warnings no registro privado de execução. Confirmar catálogo, assinaturas, grants e schema reload de PostgREST; objetos presentes não significam autorização testada. Falha após apply requer inspeção antes de repetir.

### D. Homologação e gate

Fechar/testar procedimento de fixture/cleanup restrito do §20; preparar executor remoto específico usando guard, endpoint PostgREST do mesmo ref, TLS, redaction e manifesto. Executar os cenários dos §§9–12 com dados sintéticos, sem qualquer provider/dispatcher. Validar chamadas HTTP Vercel com tokens Firebase de staging e checar inexistência de segredo em responses/assets.

Coletar EXPLAINs do §15, revisar privilégios efetivos, audit/outbox e isolamento de consumidores. Limpar somente o run e confirmar sentinelas preservadas. Anexar relatório remoto com projeto mascarado, timestamps, resultados por cenário e contagens; então reavaliar GO/CONDITIONAL GO/NO-GO. Somente GO, ou CONDITIONAL GO com riscos realmente não bloqueantes, permite iniciar a fase Meta.

### Arquivos desta entrega

- Criados: `_lib/attendance-environment.js`, `config/attendance-staging-targets.json`, `scripts/attendance-staging.js`, `scripts/attendance-schema-inventory.sql`, `scripts/attendance-staging.env.example`, `tests/attendance-environment.test.js`, `tests/attendance-staging-sql.test.js`, este documento.
- Alterado: `api/_lib/attendance-domain.js` para exigir o guard adicional.
- Migration, arquitetura original, package/lockfile, frontend e configurações externas preservados por esta tarefa. Mudanças simultâneas nos domínios financeiro/comercial da árvore compartilhada não fazem parte desta entrega.
