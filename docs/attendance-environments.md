# Atendimento — identificação de staging, configuração e gate

## Política vigente — decisão executiva de 15/09/2026 UTC

**A Space optou temporariamente por usar o ambiente principal como ambiente de desenvolvimento/homologação do módulo Atendimento porque não há usuários ativos na plataforma neste momento**, conforme informado pelo responsável.

A ausência de staging deixou de ser requisito de bloqueio. Produção é permitida somente para o projeto principal conhecido, com credencial vinculada e `ATTENDANCE_ALLOW_PRODUCTION_MUTATIONS=true`; sem isso, o guard continua fail-closed. Os guards dos demais módulos não são relaxados por essa flag.

**Foundation aprovada no PostgreSQL/PostgREST principal:** migration aplicada, catálogo conferido, testes remotos concluídos e fixtures removidas. Relatório vigente: [homologação em produção](attendance-production-validation.md). As referências a staging obrigatório, produção proibida ou homologação pendente no registro abaixo descrevem fases anteriores e foram substituídas por esta decisão.

---

## Registro histórico da fase anterior

Data: 14/09/2026 America/Sao_Paulo; evidências técnicas em 15/09/2026 UTC.

**NO-GO — configuração externa de credenciais e homologação necessárias.** O projeto staging separado foi encontrado e retomado com sucesso; não é mais correto dizer que não existe staging. O bloqueio atual é a falta de credenciais utilizáveis pelo runner, vínculo Vercel e homologação do domínio.

## 1. Arquitetura e capacidade administrativa

Foram relidos integralmente os três documentos exigidos antes de alterar arquivos. A sessão local não possui `supabase` nem `psql` no PATH, token administrativo Supabase nos caminhos convencionais ou variáveis de administração/DB no processo e envs examinados. Há Vercel CLI e sessão administrativa Vercel.

O painel Supabase inicialmente exigiu login. O login GitHub já existente permitiu acessar a organização e confirmou papel **Owner**. A organização mostrou dois projetos separados: `space-idiomas-n8n` e `space-staging`. Não foi necessário criar projeto, organização ou contratar plano. A retomada de staging foi executada dentro da autorização expressa deste pedido; nenhum pedido de nova autorização foi necessário para essa ação.

```text
Produção Vercel → Supabase space-idiomas-n8n (mlp…gkw)
Preview Vercel  → vínculo ainda incompleto; não habilitado para Atendimento
Staging        → Supabase space-staging (uac…xgm), projeto próprio, Healthy
Testes locais  → PostgreSQL/PostgREST Docker descartáveis
```

Não foi usado schema, prefixo ou dataset dentro de produção como staging. O indicador `main / PRODUCTION` do painel é o rótulo da branch principal exibido por projeto; a identificação de ambiente Space usa projeto/ref/binding, não esse rótulo. A documentação oficial confirma que esse indicador aparece nos projetos no modo de branching pelo painel. [Supabase: dashboard branching](https://supabase.com/docs/guides/deployment/branching/dashboard).

## 2. Production target

Projeto `space-idiomas-n8n`, ref mascarado `mlp…gkw`, região visível `us-west-1`. Coincide com a URL de Production na Vercel e com os envs locais marcados production, verificados na auditoria anterior. O hash do ref continua na lista de bloqueio.

Nenhuma configuração, SQL, migration, grant, RLS, dado ou teste desta execução foi enviado ao projeto de produção. Nenhuma variável Vercel Production foi alterada. As consultas Vercel desta fase foram GET de configuração em memória, com saída limitada à presença de variáveis.

## 3. Staging target e retomada

| Item | Evidência |
| --- | --- |
| Nome | `space-staging` |
| Ref/hostname mascarados | `uac…xgm` / `uac…xgm.supabase.co` |
| Região | AWS `us-west-2`, West US (Oregon) |
| Plano/compute exibidos | Organização Free, NANO |
| Estado inicial | Paused; Connect/Database/SQL Editor desabilitados |
| Ação autorizada | Project Settings → Resume project → Resume |
| Estado confirmado após retomada | **Healthy**, Connect/Database/SQL Editor disponíveis |
| PostgreSQL após restauração | **17.6**, confirmado por SQL de catálogo |
| Repositório/migrations no overview | No repository connected / No migrations |

A restauração foi aceita, passou por “Coming up...” e terminou em Healthy. O Supabase avisou que a restauração atualiza PostgreSQL; o catálogo confirmou a versão resultante. Não redefinimos a senha do banco, não criamos chaves e não executamos DDL/DML de aplicação. O editor guardou uma consulta privada de inventário, sem secrets ou dados pessoais.

## 4. Vercel bindings

Leitura remota em **2026-09-15T01:32:29Z**, projeto Vercel `space`:

| Vercel | Estado real | Binding desejado | Liberação |
| --- | --- | --- | --- |
| Production | URL/service role presentes; APP_ENV ausente | Manter projeto `mlp…gkw` | Nenhuma alteração nesta fase |
| Preview | URL, service role, anon key, APP_ENV, scope e referência staging vazios/ausentes | `uac…xgm`, APP_ENV=staging e scopes explícitos | Bloqueado |
| Development | Mesmas variáveis essenciais ausentes | Local isolado; ou staging explicitamente configurado em fluxo revisado | Bloqueado para cloud |

Não foi presumido Preview=staging. Nenhuma variável foi preenchida com valor inventado ou copiada de Production. As integrações externas compartilhadas de Preview documentadas na auditoria anterior precisam ser isoladas/desabilitadas antes de deploy de teste. A existência do banco separado não resolve por si só Firebase e integrações da aplicação.

## 5. Guards e preparação de apply

O guard existente foi preservado. A allowlist executável continua vazia: saber o ref não é suficiente para autorizar escrita sem fingerprints de credenciais confirmados. Produção nunca entrou na allowlist. O novo projeto está formalmente identificado neste relatório; promoção à allowlist fica condicionada à entrega segura das credenciais de staging.

Para Atendimento, Vercel Production é negada mesmo com APP_ENV=staging; Preview com URL Production também é negada. Comandos usam somente o arquivo de env explícito, checks de ref/hostname/credenciais/denylist e confirmação. Development não recebe permissão cloud implícita pelo guard atual.

O runner agora emite, **após guard e revisão, antes da migration**, JSON com `SPACE_ENV=staging`, ref/hostname mascarados, migration e `productionGuardPassed=true`. Teste verifica a ordem antes de qualquer escrita e ausência de senha, chave ou ref completo no anúncio. Não é declaração de guard remoto aprovado nesta execução: a aplicação continua bloqueada.

## 6. Secrets/configuração: ação administrativa necessária

| Variável real | Destino | Presença atual | Finalidade |
| --- | --- | --- | --- |
| `APP_ENV`, `SPACE_APP_ENV` | Preview/backend | Ausentes/vazias | Definir staging explicitamente |
| `SPACE_ENV` | CLI/backend opcional | Não configurada | Sinal adicional, deve concordar com staging |
| `SUPABASE_URL` | Preview/backend e runner | Vazia/ausente no Preview | Endpoint do projeto staging |
| `ATTENDANCE_STAGING_PROJECT_REF` | Preview/backend e runner | Ausente | Ref esperado pelo guard existente |
| `SUPABASE_ENV_SCOPE` | Preview/backend e runner | Ausente | Scope staging |
| `SPACE_STAGING_SUPABASE_URL` | Preview/backend e runner | Vazia | Referência positiva |
| `SPACE_PRODUCTION_SUPABASE_URL` | Preview/backend e runner | Ausente | Referência de bloqueio |
| `SUPABASE_SERVICE_ROLE_KEY` | Somente Preview/backend e runner | Ausente no Preview | RPCs do projeto staging |
| `SUPABASE_ANON_KEY` | Executor de testes remotos; configuração pública somente se necessária | Ausente no Preview | Testar role anon; não é service role |
| `ATTENDANCE_STAGING_DATABASE_URL` | **Runner privado, nunca Vercel/browser** | Não localizada | Conexão administrativa TLS para catálogo/migration |
| `ATTENDANCE_STAGING_CONFIRM` | Runner privado | Ausente | Confirmação exata do ref |
| `ATTENDANCE_FOUNDATION_ENABLED` | Backend | Não habilitada por esta tarefa | Continuar false até homologação |

Não foi introduzido `SUPABASE_PROJECT_REF` redundante: o nome real usado pelo guard é `ATTENDANCE_STAGING_PROJECT_REF`. Os exemplos existentes continuam disponíveis em `scripts/attendance-staging.env.example` e `.env.staging.example`.

**Próxima ação manual precisa:** localizar no cofre a senha PostgreSQL existente de **space-staging (`uac…xgm`)** e colocá-la em arquivo privado de env conforme template, com permissão 0600. Informar à tarefa somente o caminho. Foi solicitada essa informação durante o trabalho; não foi recebido caminho até esta conclusão. Não colar senha, JWT ou chave na conversa.

O painel Connect → Direct confirmou host próprio, porta 5432, database/user postgres e **placeholder `[YOUR-PASSWORD]`**, sem recuperar a senha existente. A conexão direta usa IPv6 por padrão; antes do runner verificar conectividade IPv6. Não habilitar add-on pago nem trocar por pooler sem revisar a validação de destino. A aba foi deixada aberta nesse ponto para continuação.

Se a senha não estiver recuperável, o proprietário deve redefini-la **somente nesse projeto staging** e guardar a URL direta com senha URL-encoded em arquivo privado. Alteração de credencial pelo navegador exige que o usuário execute a entrada e submissão da nova senha conforme a política da ferramenta de navegação; não foi iniciada redefinição nem solicitado reset de produção.

Depois: obter as chaves de API do mesmo staging pelo painel, preencher env privado, calcular fingerprints a partir dessas credenciais administrativas, atualizar a allowlist revisada e configurar somente Preview. Não colocar senha SQL/PAT/fingerprints de senha em env pública. Instalar/configurar cliente psql com suporte ao TLS exigido quando houver alvo/credencial prontos; a ausência do binário é resolvível, mas instalar não resolveria a falta de senha.

## 7. Service role review e hardening

**Risco residual HIGH.** Continua sendo uma role privilegiada do projeto, capaz de impersonar `p_actor_uid` nas RPCs. Separação real de projeto impede que a chave staging opere como chave do projeto de produção. Isso ainda precisa ser comprovado pelos testes remotos quando as chaves estiverem disponíveis.

O mapa completo de handlers/imports consta do §14 de `attendance-staging-validation.md`. Operações incluem GET de dados pedagógicos/financeiros/comerciais, POST/PATCH via helpers e RPCs transacionais; cada endpoint autoriza conforme seu domínio. Attendance usa somente seis RPCs via store e revalida Firebase/perfil/membership. `health` verifica presença da chave; scripts administrativos históricos também a leem, mas não foram executados.

Problemas de defesa em profundidade encontrados no cliente compartilhado: fetch permitia redirects com header customizado `apikey`; erros de transporte e conteúdo upstream eram propagados sem remover uma possível chave refletida. Não há evidência de incidente ou vazamento real por esses caminhos.

Correções em `api/_lib/supabase-rest.js`:

- `redirect: error` impede encaminhar a chave por redirects inesperados.
- Falha de transporte passa a erro fixo, sem anexar cause/headers/URL upstream.
- Credencial exata removida de resposta bruta e JSON decodificado, inclusive valores/chaves aninhados, arrays, sucesso e erro. Cobertura inclui escapes JSON.
- Códigos SQL/status úteis continuam preservados, salvo quando contiverem a própria credencial.

A inspeção exata da service role conhecida em **284 arquivos de código/configuração rastreados** não encontrou ocorrências do seu valor. O nome da variável no frontend é orientação de erro, não segredo. Essa amostra exclui backups/exports/artefatos e não certifica todo o histórico Git ou o deploy. Runtime-config continua com allowlist pública, sem dump de env. Os testes usam credenciais sintéticas e nenhum endpoint real.

## 8. Schema inventory remoto

**Executado com sucesso em staging**, pelo SQL Editor autenticado após conferir projeto/ref/estado. A conexão administrativa da sessão do painel permitiu leitura sem recuperar a senha SQL. Não houve uso do runner CLI nem declaração de que seus guards de credencial passaram.

Foi utilizado o conteúdo de `scripts/attendance-schema-inventory.sql`: `BEGIN READ ONLY`, timeout 10s, consulta de catálogo e `ROLLBACK`. Resultado: uma linha JSON. Um timeout da ferramenta de clique foi seguido de inspeção do resultado, sem repetir a query cegamente; o painel mostrou a linha completa. Export CSV confirmado e convertido para [evidência JSON](evidence/attendance-staging-inventory-2026-09-14.json), com timestamp, hash do SQL e identificador da consulta.

| Item | Resultado remoto |
| --- | --- |
| Server version | PostgreSQL 17.6 |
| Database | postgres |
| Owner de public | pg_database_owner |
| Tabelas/views/sequences em public | **0** |
| Funções/constraints/índices/triggers/policies em public | **0** |
| `audit_logs`, `outbox_events` | Ausentes |
| Publicações de tabelas public | Nenhuma |
| Extensions | pg_stat_statements 1.11; pgcrypto 1.3; plpgsql 1.0; supabase_vault 0.3.1; uuid-ossp 1.1 |
| Roles | anon/authenticated/authenticator/postgres/service_role presentes |
| BYPASSRLS | postgres e service_role true; anon/authenticated false |
| CREATE em public | ACL não concede CREATE a PUBLIC/anon/authenticated/service_role |
| Default ACL de postgres/public | Grants amplos a anon/authenticated/service_role para objetos futuros |

Esse inventário cobre public e metadados administrativos previstos no SQL; não afirma que schemas internos estejam vazios nem audita automações externas.

## 9. Schema drift gate

| Evidência | Classificação | Efeito |
| --- | --- | --- |
| Public vazio, nomes da foundation ausentes | ACCEPTABLE | Baseline de primeira aplicação sem colisões |
| audit/outbox ausentes | ACCEPTABLE | Serão criadas pela migration; nenhuma tabela compartilhada existente a modificar neste snapshot |
| Roles/extensions necessárias disponíveis | ACCEPTABLE | Pré-requisitos de catálogo presentes |
| PostgreSQL remoto 17.6 versus suíte local 16 | REVIEW | Revalidar migration/comportamento nessa versão; não afirmar teste remoto realizado |
| Default ACLs amplas | REVIEW | Confirmar REVOKE de domínio e comportamento de audit/outbox depois do apply; não confundir defaults com privilégio efetivo aprovado |
| Credenciais CLI/allowlist/binding ausentes | BLOCKER operacional | Não aplicar nem criar fixtures |

Não foi encontrado conflito de nome/tipo em public. Não há body SECURITY DEFINER preexistente em public para colidir. Aprovação final exige catálogo fresco pelo runner, revisão de consumidores e credenciais, pois o snapshot pode mudar.

## 10. Migration/dry-run

**Migration não aplicada remotamente.** Nenhum DDL/DML de Attendance executado. As validações locais anteriores são baseline de compatibilidade, não dry-run remoto. Não foi improvisada alteração de COMMIT/ROLLBACK nem aplicada a migration pelo painel para contornar o guard do runner.

Mantém-se a revisão de operações do §7 do runbook: aditiva em schema novo, dois triggers próprios recriados, functions substituídas, REVOKE por prefixo, grants por nome, RLS em audit/outbox. Neste snapshot essas tabelas não existem, reduzindo o risco específico de alterar tabelas legadas, mas defaults/grants e owners reais pós-apply precisam ser testados.

## 11. Homologação/testes

Testes remotos do **domínio**: **0**, bloqueados. A única execução SQL remota foi o inventário read-only; Healthy e catálogo vazio não provam persistência, RPCs, auth ou isolamento.

Validação local desta fase: **37 testes de guard/API/credenciais aprovados**. Regressão da árvore compartilhada: **382 testes, 377 aprovados, zero falhas, 5 skips**. Outros trabalhos adicionaram testes nesta árvore; não atribuir todo o crescimento à presente tarefa. Logs: `/tmp/space-attendance-provisioning-unit.log` e `/tmp/space-attendance-provisioning-regression.log`. A suíte SQL de foundation da fase anterior tinha 49 aprovados; não foi recontada como execução remota ou desta fase.

Antes do GO executar o runbook: persistência, participants/timeline/last_message, replay/fingerprint, 20 requests simultâneos do mesmo inbound, criação concorrente de conversa, assignment/version, A/B/admin sem membership, identity contextual, audit/outbox e Firebase/API Vercel reais. Sem dispatcher, provider ou mensagens reais.

## 12. Permission matrix

Não inventar resultados: os objetos ainda não existem no staging. A matriz abaixo registra **não executado (NE)**, e não permissão presumida.

| Operation | anon | authenticated | backend/service | RPC |
| --- | --- | --- | --- | --- |
| Read conversation | NE | NE | NE | Ausente |
| Create inbound | NE | NE | NE | Ausente |
| Change assignee | NE | NE | NE | Ausente |
| Link identity | NE | NE | NE | Ausente |
| Acesso direto às tabelas Attendance | NE | NE | NE | Tabelas ausentes |

O catálogo comprova presença de roles/default ACL, não comportamento de autorização das RPCs. A matriz real deve ser preenchida por chamadas remotas após apply, inclusive tentativas negativas e memberships desabilitados/cruzados.

## 13. SECURITY DEFINER: revisão por função

No staging há **zero funções em public**; logo proprietário remoto e comportamento executado das oito funções abaixo são **não aplicáveis antes do apply**. A revisão a seguir é estática da migration. Todas usam `search_path=pg_catalog,public`, referências de relação qualificadas, parâmetros tipados/JSON e SQL estático, sem EXECUTE de SQL derivado do usuário.

| Função | Parâmetros principais | Autorização interna / risco |
| --- | --- | --- |
| attendance_has_access | actor UID, team UUID, channel UUID, supervisor bool | Membership habilitado/ativo, time ativo e canal; helper privado |
| attendance_record_event | conversation UUID, type, actor, source, payload e idempotência | Sem ACL própria; chamado dentro de RPC autorizada; **não pode receber EXECUTE público** |
| attendance_ingest_message | event JSON | Conexão/provider/canal/time coerentes e ativos; entrada de máquina, não autentica usuário Firebase |
| attendance_append_message | actor UID, conversation UUID, message JSON | ACL, estado da conversa/canal, idempotência; service role pode impersonar ator |
| attendance_update_conversation | actor UID, conversation UUID, command JSON | ACL, versão, supervisor para assignment/identity, origem/destino; link não comprova pessoa remota |
| attendance_mark_read | actor UID, conversation UUID, sequence bigint | ACL e cursor limitado/monotônico |
| attendance_get_conversation | actor UID, conversation UUID, view, after, limit | ACL e paginação limitada |
| attendance_list_conversations | actor UID, filters JSON | Membro habilitado + ACL por linha + limite |

Nenhuma injeção de SQL derivada de parâmetro foi identificada nesses corpos estáticos. Permanecem REVIEW: owner efetivo, overloads, grants herdados/defaults, search_path com public confiável e helper de evento sem acesso direto. O catálogo atual não permite CREATE público não confiável. Não afirmar ausência de privilege escalation remoto antes de testar as funções instaladas.

## 14. Performance

EXPLAIN/ANALYZE dos access patterns: não executados porque tabelas/RPCs não foram criadas. Não há índice do domínio instalado a medir. Manter as sete consultas e critérios do §15 do runbook; não criar índices adicionais sem evidência. O tempo de consulta do catálogo não é benchmark da Inbox.

## 15. Cleanup

Nenhuma fixture de domínio remota criada; run ID de homologação não aplicável. Não houve DELETE/TRUNCATE. A consulta privada de inventário e o projeto retomado permanecem como evidência/preparação. Não apagar projeto para “limpar” esta fase.

A execução futura deve usar manifesto exclusivo e cleanup por UUIDs/namespace, respeitando eventos imutáveis conforme §20 do runbook. Concluir/testar esse procedimento antes do seed. Nenhum cleanup genérico foi exposto pelo runner.

## 16. Blockers objetivos

1. Senha/URL PostgreSQL de staging não localizada; caminho privado solicitado e pendente.
2. Service role/anon de staging não vinculadas à configuração local e Preview; allowlist operacional incompleta.
3. Binding Vercel/Firebase e isolamento de integrações compartilhadas pendentes.
4. Migration/objetos remotos/permission matrix/testes de domínio/concurrency/performance/cleanup ainda não executados.

O antigo blocker “staging não identificado” foi resolvido. Acesso Owner e retomada foram comprovados, mas acesso pelo painel não equivale à posse da credencial SQL necessária ao runner.

## 17. Gate

**NO-GO.** Projeto separado: confirmado. Healthy: confirmado. Catálogo: coletado. Produção sem alterações: confirmado para esta tarefa. Configuração executável, migration e homologação: bloqueadas. CONDITIONAL GO não se aplica a ausência de prova de integridade/isolamento remoto.

## 18. Próxima fase e arquivos

Não criar outro Supabase nem pagar upgrade para resolver um problema de credencial. Usar **space-staging já retomado**. Completar o arquivo privado, validar fingerprints/allowlist, configurar somente Preview, executar preflight/inventory fresco/revisão/apply e homologação com cleanup. Seguir §§23A–D de `attendance-staging-validation.md`, com a autorização administrativa atual e as evidências deste relatório.

Arquivos desta fase: este relatório; `docs/evidence/attendance-staging-inventory-2026-09-14.json`; atualização de `docs/attendance-staging-validation.md`; hardening em `api/_lib/supabase-rest.js`; anúncio pré-apply em `scripts/attendance-staging.js`; teste em `tests/supabase-credential-safety.test.js` e extensão do teste em `tests/attendance-environment.test.js`. Migration, política de allowlist e variáveis remotas preservadas. Nenhum deploy, commit ou push executado por esta tarefa.
