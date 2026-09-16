# Provisionamento humano — commercial-production-certification-2026-09

Status: **Blocked by human credential provisioning = YES**.

Preparação local somente. Nenhuma identidade, chave, permissão, variável Vercel ou deployment foi criado/alterado nesta etapa. Nenhuma certificação com dados reais foi executada. O incidente anterior do alias está resolvido; não voltar ao projeto Vercel principal.

## FIRESTORE REQUIREMENTS

Projeto `plataforma-space`, banco `(default)`. Recursos efetivamente usados por `scripts/commercial-certification/collect.cjs`:

| Recurso relativo a documents/ | Operação REST | Finalidade |
|---|---|---|
| growthGoals/2026-06 a growthGoals/2026-10, cinco documentos | GET documento | Metas, competências, semanas, papéis por período e limites dos meses adjacentes |
| growthConfig/crmLiveDefaults | GET documento | Configuração canônica e defaults |
| users | GET listagem paginada | Identidades, tipo/role, estado ativo e correspondência com pessoas comerciais |
| growthPeople | GET listagem paginada | Roles comerciais, vínculos userUid/sdrUid e identificação dos responsáveis do CRM |
| sdrActivityEvents | GET listagem paginada | Eventos, atores, datas, exclusão lógica e vínculo explícito com negócios |
| crmLiveCache/crm | GET documento | Snapshot corrente |
| crmLiveSnapshots | GET listagem paginada | Snapshots históricos e conjuntos de negócios materializados |

Sem coleção separada de semanas ou roles: estão nos documentos acima. As listagens atuais percorrem integralmente as quatro coleções; o motor filtra períodos depois. Não prometer restrição de campos ou datas que o adaptador ainda não implementa. Payloads e PII transitam em memória; a saída contém apenas a projeção sanitizada. Nenhuma leitura de Firebase Authentication, Storage, Supabase, finanças, agenda, contratos ou conteúdo de mensagens é necessária. O filho recebe somente três variáveis e APP_ENV/NODE_ENV; flags de Retenção não são herdadas e sua decoração de usuários não faz leituras adicionais.

**Role customizada mínima:** `datastore.entities.get` e `datastore.entities.list`. GET documento exige get; listagem exige get + list. Não são necessárias transações, consultas estruturadas, descoberta de bancos ou de coleções. O scope OAuth `https://www.googleapis.com/auth/datastore` não concede escrita por si só: a autorização efetiva é IAM. [Mapa oficial de métodos e permissões](https://firebase.google.com/docs/firestore/security/iam).

Não conceder Owner, Editor, Firebase Admin, Datastore User, `datastore.entities.create/update/delete`, gestão de índices, import/export, backups, IAM, criação de chaves ou logs à identidade executora. O operador provisionador tem permissões administrativas próprias; elas não devem ser copiadas para a conta de auditoria.

**Limite de isolamento:** o binding condicional pode restringir ao banco `(default)`. Não é uma ACL IAM por coleção/documento para esta identidade de servidor; Firebase Security Rules não restringem essas chamadas IAM. O guard aplica os onze caminhos exatos acima (cinco metas, duas leituras individuais e quatro listagens), recusa outros documentos/subcoleções, writes e transportes fora da allowlist. Isso não equivale a IAM limitado a sete coleções. Se leitura IAM do banco inteiro for inaceitável, não provisionar esse binding: será necessário um proxy aprovado com allowlist externa ou outro desenho separado. [Condições por banco](https://cloud.google.com/firestore/docs/manage-databases#configure_per-database_access_permissions).

## CRM REQUIREMENTS

Código: `api/_lib/datacrazy-ingestion.js`, `collectBusinesses`.

- Único endpoint CRM: `GET <CRM_API_BASE_URL>/api/v1/businesses?skip=N&take=N`, com Bearer token.
- Paginação real atual: take 200, avanço por skip, verificação de completude e tratamento limitado de 429. Não pedir acesso a mutations para isso.
- Leitura necessária no mesmo tenant/conjunto comercial: UUID/referência, valor, estado/pipeline, timestamps de fechamento/ganho e dados de responsável/SDR efetivamente fornecidos no negócio.
- Closer é resolvido pelos campos do negócio e people/users do Firestore. Não há chamada separada a atendentes no coletor.
- Eventos SDR vêm de `sdrActivityEvents`. O código exige `sdrEventId` ligado ao mesmo negócio/ator ou ausência explícita `sdrId=null`. Mais privilégios não criam vínculo inexistente: evidência ausente deve continuar `not_loaded` e impedir PASS.
- Não são necessários POST/PATCH/PUT/DELETE, leads, conversas, anexos, agenda ou endpoints de atividades do CRM. Se o schema real exigir outro endpoint, parar e revisar antes de ampliar a credencial/guard.

A [documentação de geração de chave](https://docs.datacrazy.io/essencials/get-token) descreve nome, expiração e Bearer token, mas não documenta seleção de scopes read-only. A [operação de leitura](https://docs.datacrazy.io/api-reference/neg%C3%B3cios/buscar-neg%C3%B3cios) confirma o endpoint.

**Datacrazy API credential is technically write-capable = UNKNOWN**.

O operador deve confirmar no painel/suporte se há restrição a GET negócios e ao tenant necessário. Não afirmar que a chave é read-only porque só usaremos GET. Se não houver scopes, registrar explicitamente capacidade ampla e usar chave exclusiva, expiração e guards; não fazer uma mutation para testar permissões.

## CREDENCIAL RECOMENDADA

Firestore: conta dedicada `commercial-cert-202609@plataforma-space.iam.gserviceaccount.com`, display name `commercial-production-certification-2026-09`, sem reutilização administrativa. O launcher valida esse principal, projeto, tipo e chave RSA. Binding de leitura condicional ao banco e ao término da janela. Recomenda-se janela de 30 minutos, no máximo 1 hora, com operador disponível para revogar imediatamente após uso.

O caminho compatível com o helper atual usa JSON de uma chave nova dessa conta. **Chave JSON não vira temporária apenas pelo nome: chaves não expiram por padrão.** A expiração do binding limita acesso; chave/conta precisam ser revogadas ao final. Se a organização proíbe chaves, não relaxar a política: preferir impersonação/federação de curta duração, que exige adaptar o helper de autenticação antes de executar. Esse caminho keyless não está implementado no launcher atual. [Chaves e alternativas](https://cloud.google.com/iam/docs/keys-create-delete).

CRM: chave nova nomeada `commercial-production-certification-2026-09`, no tenant correto, escopo GET negócios se disponível, com menor expiração permitida dentro da janela e revogação manual ao final.

## EXECUTION ENVIRONMENT

**Escolha: local efêmero**, em estação autorizada, conta de SO restrita, sem gravação de terminal/debugger, com cópia limpa e revisada do código e sem processos concorrentes alterando o workspace. O coletor usa módulos locais/built-ins; não precisa de frontend, Vercel, acesso de usuário final ou herança do ambiente da aplicação.

O scanner percorre arquivos atuais do workspace, inclusive ignorados, binários, source e artifacts; recusa symlinks e arquivos especiais. Use uma cópia limpa sem node_modules com symlinks, exports antigos ou arquivos de credenciais. Não remova arquivos de trabalho de outras tarefas para satisfazer o scanner. Não copiar `.env`, chaves ou artifacts brutos para a cópia de execução.

Opção B, somente se A não for possível: ambiente inteiramente separado, com identidade própria e apenas código de auditoria, sem domínio/alias Space, sem vínculo com o production target principal e sem usuários finais. Destruir ambiente e credenciais ao final. Não foi criado nem autorizado agora.

## HUMAN ACTION REQUIRED — checklist operacional

### Firestore — operador IAM autorizado

1. Selecionar projeto `plataforma-space`; conferir banco `(default)` e a lista de recursos acima.
2. Em IAM e administração → Contas de serviço, criar `commercial-cert-202609`, com o display name da auditoria. Não associar roles administrativas.
3. Em IAM → Papéis, criar role customizada `commercialCertificationReader` contendo **somente** `datastore.entities.get` e `datastore.entities.list`.
4. Conceder essa role exclusivamente à conta dedicada, com condição equivalente a `resource.name == "projects/plataforma-space/databases/(default)" && request.time < timestamp("<FIM_UTC_DA_JANELA>")`. Substituir o marcador por horário UTC real de até uma hora adiante. Conferir ausência de outros bindings diretos/herdados para essa conta. Não usar a role Datastore User mostrada nos exemplos genéricos da documentação.
5. Confirmar que leitura IAM no banco inteiro, restringida em aplicação aos caminhos indicados, é aceitável. Caso contrário, parar neste ponto.
6. Criar uma chave nova só se a política permitir. Preferir ferramenta do operador que consuma a resposta de `serviceAccounts.keys.create` em memória e importe diretamente no cofre. Se usar o download JSON do console, a criação gera arquivo: usar área temporária criptografada, fora do workspace/Git/sincronização, importar no cofre e remover essa cópia antes da execução. Esse arquivo de provisionamento não é um arquivo env nem deve virar artifact de auditoria. Não alegar zero arquivos nessa variante.
7. Guardar no cofre o JSON completo como campo oculto. Registrar apenas identificadores não secretos da conta/binding e horários para revogação no controle administrativo restrito. Não enviar a chave à tarefa.

### CRM — administrador autorizado

1. Acessar Configurações → Chaves de API no tenant correto. Confirmar com painel/suporte scopes disponíveis e capacidade de escrita, sem alterar chave existente.
2. Criar nova chave com o nome da auditoria e expiração explícita. Selecionar leitura de negócios, se oferecida. Não substituir nem rotacionar a chave da aplicação.
3. Salvar o valor exibido uma única vez diretamente no cofre. Disponibilizar a base URL do tenant pelo mesmo canal. Registrar se a credencial é read-only, write-capable ou ainda desconhecida. Sem confirmação suficiente do tenant e acesso, não executar.
4. Antes de gerar a chave, identificar no painel/suporte a ação de revogação e confirmar que ela afeta somente essa chave. A documentação consultada não especifica o nome do botão de revogação; não presumir sua existência ou inventar endpoint DELETE.

## SECRET DELIVERY

Usar um cofre de senhas aprovado pelo operador, com integração de CLI desbloqueada pelo SO. Exemplo suportado se a organização usa 1Password: criar item exclusivo em cofre restrito; campos `crm-base`, `crm-key` e `service-account-json`. Sem valores reais em comandos, chat, Slack, código, Git, docs ou artifacts.

**Comando futuro, não executar nesta etapa** — somente referências do cofre aparecem na linha de comando:

```sh
CRM_API_BASE_URL='op://Audit/commercial-production-certification-2026-09/crm-base' \
CRM_API_KEY='op://Audit/commercial-production-certification-2026-09/crm-key' \
GOOGLE_SERVICE_ACCOUNT_JSON='op://Audit/commercial-production-certification-2026-09/service-account-json' \
op run -- node scripts/commercial-certification/local.cjs
```

Trocar nomes de cofre/item somente se necessário; essas referências não são os valores secretos. `op run` resolve referências para o environment do subprocesso; não usar env-file, `op inject`, `op read` no terminal, `echo`, `printenv`, shell xtrace, `--no-masking`, verbose ou redirecionamento do JSON da chave. Não se pressupõe que 1Password esteja instalado/configurado nesta máquina; o operador deve usar a integração aprovada equivalente se não estiver. [Injeção por environment](https://developer.1password.com/docs/cli/secrets-environment-variables).

Os valores existem na memória/environment dos processos autorizados; administradores do SO, depuradores e processos com permissão para inspecioná-los continuam uma fronteira de confiança. Environment não impede inspeção privilegiada. Evitar dumps e gravação de sessão; revogar ao encerrar.

## REVOCATION — imediatamente após sucesso, FAIL, timeout ou cancelamento

1. Encerrar o processo local e o injetor; não repetir automaticamente a certificação.
2. Desabilitar a **conta dedicada** no Google IAM e remover seu binding de leitura. Excluir sua chave recém-criada; verificar ausência de bindings e estado desabilitado. Excluir a conta após registrar os metadados necessários à auditoria. Não tocar em contas/chaves da aplicação.
3. Excluir chave isoladamente não revoga tokens OAuth já emitidos; desabilitar/excluir a conta é necessário para esse caso. Respeitar propagação de IAM e confirmar a negação em leitura mínima pelo operador, sem imprimir payloads. [Revogação de chaves e tokens](https://cloud.google.com/iam/docs/keys-create-delete#delete).
4. Revogar/excluir no CRM somente a chave nomeada para auditoria pelo mecanismo confirmado no provisionamento. Confirmar estado revogado; quando apropriado, uma leitura mínima deve ser recusada. Expiração é uma segunda barreira, não substitui a revogação imediata.
5. Remover os itens temporários do cofre e eventuais cópias de provisionamento; encerrar sessão de injeção. Não apagar artifacts sanitizados. Registrar horário, IDs administrativos não secretos e confirmação de revogação.

## CODE READINESS

Entrada adicionada: `scripts/commercial-certification/local.cjs`. Ajustes indispensáveis implementados:

- Apenas três credenciais no environment; argumentos CLI e opções de injeção de runtime rejeitados. Validação da identidade dedicada e chave RSA em memória, sem fallback para conta administrativa.
- Scanner antes de iniciar, antes de persistir e após persistir; recusa cópias das credenciais fornecidas em arquivos, inclusive variantes JSON escapadas/base64. Nenhum path, valor ou stack é emitido ao falhar.
- Um único worker, sem stdout/stderr herdados, ambiente mínimo, timeout, motor real e guards já testados. Nenhum comando Vercel no caminho local.
- Sanitização com os valores conhecidos antes de persistência, mais validação de PASS pelo persistidor; somente result.json e relatorio.md em artifacts/commercial-local-UUID, arquivos 0600.
- Allowlist Firestore reduzida aos onze caminhos exatos. Sanitização ampliada para rejeitar telefones em strings livres.

**Limites da detecção:** não é possível provar retrospectivamente que um valor nunca foi colocado em CLI/history, arquivo apagado, Git histórico, cofre externo, log do SO ou encoding arbitrário. O programa recusa argumentos, mas não consegue retirá-los de um histórico/process list anterior à sua inicialização. O scanner exclui `.git`, não cobre arquivos fora do workspace e não é monitor contínuo de outros processos. Erro/arquivo ilegível/symlink impede a execução. Por isso cópia limpa, ambiente confiável, injeção correta e revogação continuam obrigatórios. Não fazer promessa de detecção absoluta.

Testes locais sintéticos: 46 aprovados, zero falhas, incluindo 27 do mecanismo anterior e 19 novos. Cobrem ausência/argumentos/identidade incorreta, cópias no source/artifacts/env/binário, chaves escapadas, symlinks, Authorization/Bearer/private key/JSON/CRM key/cookie/email/telefone/stack, falha do filho sem vazamento e restrição dos caminhos Firestore. Nenhuma credencial real foi usada.

Pronto para receber **as novas credenciais desse perfil**, sujeito ao provisionamento e à autorização futura de execução. O caminho keyless exigiria ajuste explícito do adaptador OAuth. Credenciais válidas não garantem evidência SDR ou snapshots reconciliados; esses continuam gates da certificação.

## VEREDITO

**Blocked by human credential provisioning = YES**.
