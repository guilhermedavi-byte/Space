# Financial Foundation — infraestrutura de staging

**Resultado: STAGING BLOCKED.** Trabalho iniciado em 14/09/2026 (America/Sao_Paulo); verificações finais em 15/09 UTC. O banco staging foi comprovado e recebeu a migration. O projeto Vercel separado foi criado e recebeu 16 variáveis não secretas em Preview. Faltam credenciais Asaas Sandbox, configuração de identidade, deploy e webhook público validado.

Esta tarefa não publicou código, alterou variáveis de produção, acessou dados financeiros de produção nem iniciou Financeiro V1. O checkout é compartilhado com outras tarefas: esta afirmação descreve as ações desta tarefa, não certifica alterações concorrentes de terceiros. Não foi executada a certificação financeira completa.

## 1. Arquitetura e matriz de isolamento

```text
Space staging — projeto Vercel space-staging (criado; deploy pendente)
  ├─ Supabase space-staging (confirmado; migration aplicada)
  ├─ Firebase space-platform-staging (confirmado; login/admin pendente)
  ├─ Asaas api-sandbox.asaas.com/v3 (credencial pendente)
  └─ POST /api/asaas-webhook (publicação/entrega pendentes)
```

Classificação: `CONFIRMED_STAGING` comprova o recurso indicado, não a prontidão de todas as suas integrações. `UNKNOWN`/`MISSING` impedem operações dependentes. A existência de uma branch Preview, um nome staging ou uma declaração de escopo isoladamente não prova isolamento.

| Recurso | Produção | Staging | Status do staging | Evidência |
| --- | --- | --- | --- | --- |
| App URL | `https://plataforma.spaceschoolbr.com`; `https://space-three-sand.vercel.app` | Sem URL publicada nesta tarefa | MISSING | Nenhum deployment criado no projeto separado |
| Vercel projeto/ambiente | `space`, ID `prj_Fcx…7pq8`; ambientes compartilhados | `space-staging`, ID `prj_9Dd…thHz`; Preview | CONFIRMED_STAGING para o projeto; MISSING para deploy | CLI autenticada: project add, project inspect, env ls Preview |
| Preview anterior do projeto space | Não considerado staging seguro | Não utilizado | UNKNOWN | Variáveis de integrações compartilhadas entre Preview e Production; Preview não é prova |
| Domínio próprio | `spaceschoolbr.com` na equipe Vercel | Candidato `staging.spaceschoolbr.com` | UNKNOWN | Consulta CNAME sem resposta; isso não comprova disponibilidade nem ausência de A/AAAA |
| Supabase projeto/ref | `mlp…gkw` | `space-staging`, `uac…xgm` | CONFIRMED_STAGING | Projeto autenticado no painel, ref e URL distintos; schema vazio antes da migration |
| Supabase URL | `https://mlpojyvwyqcrelagtgkw.supabase.co` | `https://uacxsjitygrraggkbxgm.supabase.co` | CONFIRMED_STAGING | Painel Connect e SQL Editor do projeto staging |
| Firebase | `plataforma-space` | `space-platform-staging`, app `space-staging-web` | CONFIRMED_STAGING para projeto; credenciais/login ainda não validados | Console Firebase autenticado com projeto separado |
| Asaas base URL | `https://api.asaas.com/v3` | `https://api-sandbox.asaas.com/v3` | CONFIRMED_STAGING como destino oficial; autenticação MISSING | Base configurada localmente e no Preview separado |
| Asaas key scope | Configuração local anterior de produção; não reutilizada | Declaração sandbox; chave ausente | MISSING | Login Sandbox aberto sem sessão; chave sandbox não disponível no ambiente local |
| Webhook | Nenhum destino de produção alterado | `https://<origem-staging-comprovada>/api/asaas-webhook` | MISSING | Contrato da rota existe; ainda sem domínio/deploy/registro |
| n8n e mensagens | Integrações existentes no projeto original | `N8N_ENV_SCOPE=disabled`, sem URLs/segredos de envio | CONFIRMED_STAGING para a configuração desabilitada | Novo projeto não herdou credenciais; allowlists locais vazias |

Refs estão mascarados no texto; URLs completas identificam o destino verificável e não são segredos. Referências `SPACE_PRODUCTION_*` são valores não secretos usados para rejeitar destinos de produção; não autorizam acesso a produção.

### Inventário de acesso

- **Vercel CLI 55.0.0:** autenticada; Node 22.22.3 local. Equipe `guilhermedavi-4547s-projects`. Permitiu listar recursos, criar `space-staging` e configurar Preview. O projeto novo está em Framework Other/Node 24.x, sem deploy. Usou diretório temporário ligado exclusivamente a esse projeto; o vínculo `.vercel` do checkout original não foi trocado.
- **Supabase:** sessão Chrome autenticada na organização `guilhermedavi-byte's Org`; consulta e execução SQL disponíveis no projeto staging. Acesso usado foi pelo painel, sem depender de autenticação da CLI ou de chave service role local.
- **Firebase:** console Chrome autenticado; projeto staging e app web encontrados. CLI Firebase não encontrada no PATH. A existência de credencial em cache foi identificada sem imprimir/usar seu token e não comprova autenticação CLI atual.
- **Asaas Sandbox:** página de login sem sessão; precisa de ação do titular. Nenhuma API Asaas foi chamada nesta tarefa.
- **DNS:** domínio listado na equipe, registrador/nameservers externos. Nenhum registro DNS nem alias de produção alterado.

O rótulo `main PRODUCTION` no cabeçalho Supabase descreve a branch principal **do projeto separado space-staging**. A prova de separação é o projeto/ref distintos do Supabase da Space em produção, corroborada pelo inventário inicial vazio; não é uma branch do banco de produção.

## 2. Supabase: migration e inventário real

Projeto staging saudável, Free/Nano, região West US (Oregon). Antes: zero tabelas, funções e triggers no schema public; roles anon/authenticated/service_role presentes. Não houve cópia de usuários, cobranças ou dados pessoais.

Migration aplicada: `supabase/migrations/202609140002_finance_foundation.sql`, por SQL Editor autenticado exclusivamente no ref staging. O conteúdo foi comparado ao SQL local após normalizar comentários/espaços antes da execução. Duas proteções foram incorporadas:

1. Ativação explícita de RLS em `connections`, para a instalação financeira independente de Atendimento.
2. Revogação explícita de EXECUTE de `finance_audit_immutable()` para anon/authenticated/service_role, porque defaults reais do Supabase concediam permissões diretamente às roles. Revogar apenas PUBLIC não removia esses grants. O ajuste final foi executado e confirmado por nova consulta.

[Consulta da instalação](https://supabase.com/dashboard/project/uacxsjitygrraggkbxgm/sql/de9e32ed-52a3-43e5-9277-e57dd244e266) e [consulta de inventário pós-migration](https://supabase.com/dashboard/project/uacxsjitygrraggkbxgm/sql/be444024-52aa-4461-a89b-1f3f69948571). A aplicação foi via SQL Editor, **sem registrar a migration no ledger do Supabase CLI**. Antes de adotar `db push`, reconciliar esse histórico de forma explícita; não apontar o checkout para produção.

| Item | Resultado remoto |
| --- | --- |
| Tabelas | 10: connections + nove finance_* |
| RLS | 10/10 habilitadas |
| Índices | 22 |
| Constraints | 38 |
| Funções | finance_rpc e finance_audit_immutable |
| Trigger de auditoria imutável | 1 |
| Conexões financeiras / recebíveis | 0 / 0 |
| RPC | SECURITY DEFINER; search_path fixo; somente service_role entre as roles da API pode executar |
| finance_* | anon/authenticated sem SELECT; service_role com SELECT, sem INSERT/UPDATE/DELETE direto |
| Função de trigger | EXECUTE revogado de anon/authenticated/service_role |

A tabela compartilhada `connections` mantém os grants nativos de tabela, mas tem RLS habilitada, sem políticas liberando browser. As restrições de mutação exclusiva pela RPC acima se referem às nove tabelas finance_*. Não foi inventado um account_reference nem FINANCE_CONNECTION_ID.

O inventário sanitizado completo, com colunas/índices/constraints por tabela, permissões e hashes do SQL, está em `artifacts/finance-staging-environment-2026-09-14/supabase-schema-inventory.json`.

## 3. Configuração já preparada e contrato pendente

Arquivo privado local **`.env.finance-staging`**, ignorado pelo Git e criado com modo **0600**. Contém os refs comprovados e segredos aleatórios exclusivos para SPACE_AUTH_SECRET e ASAAS_WEBHOOK_TOKEN. Segredos não foram impressos nem publicados. O arquivo não importa `.env.local` e não tem chaves Asaas/Supabase/Firebase copiadas de produção.

| Variáveis | Estado |
| --- | --- |
| APP_ENV, SPACE_APP_ENV | staging — local e Preview separado |
| SUPABASE_URL, SPACE_STAGING_SUPABASE_URL, SUPABASE_ENV_SCOPE, FINANCE_STAGING_PROJECT_REF | Projeto comprovado — local e Preview |
| SPACE_PRODUCTION_SUPABASE_URL | Referência de bloqueio — local e Preview |
| ASAAS_BASE_URL, ASAAS_KEY_SCOPE | Base oficial sandbox e scope sandbox — local e Preview |
| NEXT_PUBLIC_FIREBASE_PROJECT_ID, SPACE_STAGING_FIREBASE_PROJECT_ID, SPACE_PRODUCTION_FIREBASE_PROJECT_ID, FIREBASE_ENV_SCOPE | IDs separados — local e Preview |
| N8N_ENV_SCOPE | disabled — local e Preview |
| FINANCE_FOUNDATION_ENABLED | **false** — local e Preview |
| FINANCE_WEBHOOK_PROCESS_INLINE | true — local e Preview; sem efeito de ativação sozinho |
| SPACE_PUBLIC_BASE_URL, FINANCE_SANDBOX_WEBHOOK_URL | Vazias localmente, não configuradas no Preview; dependem do destino publicado |
| SPACE_PRODUCTION_PUBLIC_BASE_URL | Referência conhecida no arquivo privado; adicionar ao Preview na conclusão |
| SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY | Não configuradas no arquivo privado/Preview |
| ASAAS_API_KEY | Não configurada |
| ASAAS_WEBHOOK_TOKEN, SPACE_AUTH_SECRET | Gerados apenas no arquivo privado; publicação pendente |
| FINANCE_CONNECTION_ID | Vazia; será o ID retornado por init após health real |
| GOOGLE_SERVICE_ACCOUNT_JSON_STAGING e demais NEXT_PUBLIC_FIREBASE_* | Pendentes de configuração do app/login staging |
| STAGING_EMAIL_ALLOWLIST, STAGING_WHATSAPP_ALLOWLIST, STAGING_SMS_ALLOWLIST, STAGING_ADMIN_EMAIL_ALLOWLIST | Vazias localmente; ausentes no Preview, portanto nenhum destinatário aprovado |
| FINANCE_STAGING_APPLY | Vazia; YES somente por operação intencional com --apply e --actor |

O bootstrap remoto foi verificado por `vercel env ls preview`; nomes/resultados em `vercel-bootstrap.json`. Nenhuma variável do projeto Vercel original foi modificada nesta tarefa. Não foi feito deploy do checkout, que contém mudanças concorrentes de outros módulos.

## 4. Guards e allowlists

- Isolamento de runtime exige referência Supabase staging/produção e correspondência do destino ativo; rejeita Asaas fora da base sandbox oficial.
- n8n desabilitado/mock rejeita URL/segredo ativo. Se futuramente usado, exige refs separados e origem/caminho de webhook compatíveis com o staging conhecido.
- Service account Firebase de staging deve ter project_id consistente; produção rejeita referências/scopes staging quando configurados.
- Guard financeiro mantém allowlist independente de projeto/domínio, hashes de credenciais com procedência verificada, confirmação de escrita e actor. JWT decodificado ou variável declarada não são prova suficiente.
- Certificação financeira exige n8n desabilitado e rejeita credenciais de integrações de envio previstas pelo guard.
- `_lib/staging-channel-policy.js` valida email/admin exatos, telefones E.164 e recusa curingas. Lista vazia significa nenhum destinatário. Todo futuro sender deve chamar `assertStagingRecipientAllowed` antes de enviar; o helper **não foi retroativamente conectado a todos os senders legados**. Nenhum desses canais foi habilitado neste staging.
- `config/finance-staging-targets.json` permanece sem entrada staging: faltam origem publicada e procedência das chaves. Não se afrouxou a política para obter um preflight verde.

Verificação offline com as referências reais preparadas: runtime **PASS**. Substituições por Supabase de produção, Asaas de produção e URL n8n em modo desabilitado: **BLOCK**. Registro em `isolation-guard.json`.

Preflight financeiro da configuração real ainda incompleta: **BLOCK**, erro `finance_certification_target_not_allowlisted`, antes de qualquer chamada remota. Isso é funcionamento correto do safeguard, não uma certificação positiva do ambiente.

## 5. Testes e limites da evidência

- Testes de guards, isolamento, cliente Asaas e foundation: **33 passaram**, zero falhas; integração SQL deliberadamente skipped nesse primeiro comando.
- Execução específica `RUN_FINANCE_SQL_INTEGRATION=1`: **20 passaram**, zero falhas/skip. PostgreSQL 16/PostgREST locais descartáveis, API Asaas simulada. O harness reproduziu default privileges reais do Supabase para testar as revogações e RLS standalone.
- Supabase remoto: instalação e inventário de schema/permissões confirmados pelo SQL Editor.
- Health Asaas real: **não executado**, chave ausente.
- Boot/login/admin do deploy: **não executados**, deploy ausente.
- Registro/entrega/401 do webhook publicado: **não executados**, origem ausente.
- Connection e flag: **não ativadas**. Nenhum seed financeiro nem certificação completa remota nesta tarefa.

Logs: `artifacts/finance-staging-environment-2026-09-14/tests.tap`, `sql-integration.tap`, `remote-preflight.json`, `isolation-guard.json`.

## 6. Ações operacionais para desbloquear

### A. Asaas — ação necessária do titular agora

1. Abra [Asaas Sandbox](https://sandbox.asaas.com/login/auth?customerSignUpOriginChannel=HOME). Autentique-se na conta de testes; se ainda não existe, crie uma conta de testes com identificação **Space Staging**, concluindo pessoalmente os termos/verificações solicitados. Não use a conta de produção.
2. Como administrador, abra **Integrações → Chaves de API** e crie uma chave chamada **space-financial-foundation-staging**. Escolha uma validade que cubra a homologação e guarde a chave no gerenciador de segredos.
3. Insira o valor diretamente em **ASAAS_API_KEY** do arquivo privado `.env.finance-staging`. Preserve **ASAAS_BASE_URL=https://api-sandbox.asaas.com/v3** e **ASAAS_KEY_SCOPE=sandbox**. Posteriormente esse mesmo segredo irá somente ao Preview do projeto Vercel **space-staging**.
4. Avise apenas que o login/configuração foi concluído. **Não envie senha, código de verificação, API key, service-role key, token de webhook ou JSON de service account na conversa.**

O Asaas informa que a chave é criada pela interface, exibida uma única vez e exclusiva do ambiente correspondente. [Documentação oficial de chaves](https://docs.asaas.com/docs/chaves-de-api).

### B. Supabase — projeto já existe; não criar outro

Abra **space-staging** no [painel](https://supabase.com/dashboard/project/uacxsjitygrraggkbxgm), confira o ref **uac…xgm**, e entre em **Project Settings → API Keys**. Para a configuração atual, use as chaves legadas anon/service_role desse projeto, caso disponíveis na aba de chaves legadas:

- anon → **SUPABASE_ANON_KEY**;
- service_role → **SUPABASE_SERVICE_ROLE_KEY**, apenas server-side/arquivo privado/Preview separado;
- Project URL já está preenchida em **SUPABASE_URL**.

Não rotacione chaves nem copie valores de `mlp…gkw`. Se o projeto oferecer somente `sb_secret_`/publishable, registrar a origem e validar a compatibilidade do cliente antes de ativar. [Referência oficial Supabase](https://supabase.com/docs/guides/getting-started/api-keys).

### C. Firebase — reaproveitar o projeto de testes existente

Para health/normalização/projeção financeira básica não é necessário criar aluno nem fazer write no Firestore. O runtime atual ainda exige um project_id staging válido. Para provar login/admin e executar link-customer, precisa da identidade separada:

1. Abra [Firebase space-platform-staging](https://console.firebase.google.com/u/0/project/space-platform-staging/overview), **Configurações do projeto → Geral → space-staging-web**.
2. Copie a configuração web para as variáveis **NEXT_PUBLIC_FIREBASE_API_KEY**, **AUTH_DOMAIN**, **PROJECT_ID**, **STORAGE_BUCKET**, **MESSAGING_SENDER_ID**, **APP_ID** e, se existente, **MEASUREMENT_ID**, todas com o prefixo completo `NEXT_PUBLIC_FIREBASE_`. PROJECT_ID deve continuar **space-platform-staging**.
3. Configure uma service account exclusiva desse projeto em **GOOGLE_SERVICE_ACCOUNT_JSON_STAGING**. Não use as variáveis genéricas que contêm a conta de produção. Se precisar criar credencial nova, faça isso no projeto staging e guarde o JSON privadamente.
4. Habilite o método de login usado pela Space e uma identidade de teste autorizada; adicione somente seu email de teste exato a **STAGING_ADMIN_EMAIL_ALLOWLIST**. Conferir também a autorização admin real do app, pois a allowlist por si só não concede role.
5. Quando a URL estiver definida, inclua apenas o hostname staging nos domínios autorizados do Firebase Auth desse projeto.

### D. Vercel e domínio — recursos já separados, publicação pendente

Abra a equipe **guilhermedavi-4547s-projects → space-staging**. Configure os valores privados acima em **Settings → Environment Variables → Preview**, sem selecionar Production nem o projeto `space`.

O candidato é **staging.spaceschoolbr.com**. Antes de usar, confirmar A/AAAA/CNAME e propriedade/uso existente; em seguida vincular somente o subdomínio ao projeto separado e configurar exatamente o registro DNS solicitado pelo painel. Não trocar apex, nameservers ou aliases da aplicação de produção. Uma URL Preview estável comprovada também é aceitável se satisfizer os guards e o webhook.

O build deve partir de checkout/bundle revisado para esta infraestrutura, sem publicar automaticamente as alterações concorrentes do workspace. Depois de provar a origem, preencher **SPACE_PUBLIC_BASE_URL** e **FINANCE_SANDBOX_WEBHOOK_URL=<origem>/api/asaas-webhook**. Publicar inicialmente com Foundation **false**; validar boot/configuração antes de ativar.

### E. Webhook — contrato definido, ainda não registrar

- URL final: **https://<origem-staging-comprovada>/api/asaas-webhook**.
- Método: **POST**, JSON.
- Autenticação: segredo dedicado de **ASAAS_WEBHOOK_TOKEN**, configurado como authToken no Asaas; recebido pela aplicação no header **asaas-access-token**.
- Nome sugerido no Sandbox: **space-financial-foundation-staging**; usar apenas os eventos cobertos pela foundation.
- Só registrar depois de provar HTTPS, deployment, origem, rota e rejeição de token inválido. Entrega externa precisa chegar ao endpoint com sua autenticação própria. [Contrato oficial de entrega Asaas](https://docs.asaas.com/docs/receba-eventos-do-asaas-no-seu-endpoint-de-webhook).

**Deployment Protection é uma dependência de arquitetura a resolver no projeto separado.** Uma Preview com login Vercel na frente da rota não comprova webhook acessível pelo Asaas. Não usar query token de bypass, não desabilitar proteções para forçar o teste e não usar URL de produção. Configurar um ingresso apropriado para essa rota, preservando a autenticação da aplicação e o token do webhook; qualquer alteração de exposição deve ser revisada antes de publicação. [Referência Vercel sobre proteção e integrações](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection).

## 7. Como continuar após configurar o acesso

1. Confirmar procedência da chave Asaas no Sandbox, service role no Supabase staging e origem no projeto Vercel separado. Preencher a entrada revisada em `config/finance-staging-targets.json` com projectRef, appOrigin, productionOrigins e os três hashes de credenciais; não cadastrar automaticamente os valores recebidos pelo comando como prova.
2. Rodar o preflight offline com arquivo privado. Ele não prova acesso remoto:

   ```sh
   node --env-file=.env.finance-staging scripts/finance-foundation.js preflight
   ```

3. Com FINANCE_CONNECTION_ID ainda vazio, rodar health real somente no Sandbox:

   ```sh
   node --env-file=.env.finance-staging scripts/finance-foundation.js health
   ```

4. Após health válido, criar a connection no staging com confirmação explícita por operação:

   ```sh
   FINANCE_STAGING_APPLY=YES node --env-file=.env.finance-staging scripts/finance-foundation.js init --apply --actor infra-staging
   ```

   `init` usa o account_reference real retornado pelo Asaas e devolve connection_id. Colocar esse retorno em **FINANCE_CONNECTION_ID**, sem inventar ID. O schema registra provider Asaas e environment sandbox. Health posterior com ID persiste telemetria e requer `--apply`, actor e YES.

5. Completar variáveis/URL, publicar somente staging, validar boot/login/admin, checar connection, registrar webhook Sandbox e executar smoke controlado. Habilitar **FINANCE_FOUNDATION_ENABLED=true** somente nesse staging após os gates de configuração; comprovar o webhook com a Foundation ativa. Se qualquer gate falhar, manter/desativar a flag no staging.
6. Só declarar **STAGING READY** com deploy, Supabase, health Sandbox, connection, webhook acessível e guards comprovados. Depois seguir `docs/finance-foundation-certification.md` para a certificação completa em outra passagem. Não existe um único comando que substitua toda essa certificação; preflight ou testes locais não bastam.

**Bloqueio atual concreto:** login/chave do Asaas Sandbox e configuração segura dos demais acessos, origem e ingresso público. A migration remota já está aplicada; não precisa repetir sua instalação para retomar.
