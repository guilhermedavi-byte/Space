# Base de Recuperação de Receita

## Escopo publicado

Sem régua, mensagens, WhatsApp, IA ou ações de recuperação. A UI Financeiro V1 permanece; contexto Space é acrescentado em Clientes/Recebíveis e no drawer.

## Assinaturas

Assinaturas reais projetadas em `finance_provider_objects`, `resource=subscriptions`, usando a identidade única `(connection_id, resource, external_object_id)` existente. Sincronização administrativa por páginas de até 20 objetos, com cursor retornado, verificação de conta, lease adquirido antes do GET individual, commit transacional e auditoria. Falhas não avançam o cursor da página; repetição usa a mesma identidade sem duplicar. Nunca se deduz exclusão a partir de ausência na listagem. A UI passa a consumir essas projeções. O receiver existente também suporta eventos de assinatura; esta tarefa não afirma entrega externa desses eventos.

`POST /api/finance-recovery-base`, admin e origem da aplicação, `action=sync_subscriptions`, `offset=0` e depois `next_offset`, até `has_more=false`. Não é automação de cobrança; nenhum write é feito no Asaas. O acesso temporário usado na implantação foi removido, inclusive do código publicado; o endpoint permanece restrito à sessão administrativa.

## Identidade

Referência externa exata do cliente/assinatura Asaas para ID de documento ou UID autenticado de aluno Space, ID Asaas explícito no aluno, ou ID externo exato de assinatura já associado a contrato Space. Um alias só é aceito se identificar um único aluno verificado no Firestore. Evidências divergentes ou conflitantes com vínculo prévio não são aplicadas. Nome, e-mail, telefone e similaridade não participam da decisão. IDs de clientes removidos não geram novos vínculos.

`GET /api/finance-recovery-base` apresenta contagens da proposta, sem dados pessoais. `POST` com `action=link_identifiers` aplica até 20 vínculos comprovados e retorna pendentes. Não altera alunos, contratos, cobranças nem vínculos preexistentes.

## Contexto Space

Leitura em lote de alunos Firestore e contratos canônicos Space por IDs exatos. Ciclo de vida utiliza a política existente; aviso prévio exibe somente datas registradas. Status do aluno e plano usam valores da origem. Responsável CS somente quando explicitamente informado no cadastro; não se confunde autor de evento ou responsável comercial com CS. Nenhum vínculo é inferido para mostrar contexto. Ausência de cadastro/contexto permanece explícita. Cache de cinco minutos; indisponibilidade de Space não impede consultar projeções financeiras.

## Validação

Testes focados somente nas mudanças: identidade exata/conflitos/UIDs, contexto canônico sem campos inventados, sincronização sob lease, consumo de projeções e enriquecimento exclusivamente por vínculo. Suítes anteriores não repetidas.

## Resultado em Production — 15/09/2026

- 172 assinaturas projetadas, em nove páginas (oito de 20 e uma de 12), encerrando com `has_more=false`. IDs e contagem persistida em `artifacts/finance-recovery-base/projection.json`.
- 624 clientes no diretório Asaas, 227 alunos Space e 652 clientes na visão financeira (união com IDs históricos de cobranças).
- Zero referências externas preenchidas em clientes/assinaturas Asaas; nenhum ID Asaas nos cadastros dos alunos ou correspondência por contrato externo/UID. Portanto, 0 vinculados e 652 **Não vinculados**. Nome e e-mail não foram usados. A falta de identificadores impede preencher contexto Space nesses clientes, sem impedir a operação financeira.
- Campos de ciclo de vida, aviso prévio, status, plano e responsável CS preparados no backend e UI; nenhum valor foi inventado ou copiado de um aluno sem vínculo.
- Cinco testes backend/dados e um teste de UI focados nas alterações passaram. Nenhuma suíte anterior, backfill de recebíveis ou auditoria Foundation repetidos.
