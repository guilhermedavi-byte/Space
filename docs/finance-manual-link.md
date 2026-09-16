# Vínculo financeiro manual e novos cadastros

Clientes sem vínculo têm a ação **Vincular aluno**. O drawer mostra o cliente, candidatos por identificadores exatos e busca na base Space por nome/e-mail/telefone. A busca nunca grava nem seleciona automaticamente. A escolha abre revisão dos dois IDs e exige checkbox de confirmação antes do POST. Casos AMBIGUOUS mostram candidatos e continuam sem vínculo até escolha humana. Vínculo já existente diferente é recusado; não há substituição automática.

Somente admin/FINANCE, sessão válida, origem da aplicação e Foundation habilitada. O aluno e o cliente são verificados novamente no servidor; a operação utiliza o lease existente de cliente e persiste método `manual`, ator, origem e timestamp no modelo financeiro existente. Após salvar, as projeções e o contexto Space são relidos sem aguardar o cache: ciclo de vida, aviso, status, plano e CS disponível. Ausências não são inventadas. Nenhum write no Asaas.

## Novos cadastros controlados pela Space

- `admin-users` com `role=student`, `uid` e `asaas_customer_id`: registra o par canônico verificado.
- `financeiro-dashboard`, `save_aluno` com cliente Asaas: exige `firestore_doc_id` real antes de salvar o espelho.
- Onboarding de contrato com `asaas_customer_id`: exige aluno canônico antes da gravação.
- Integração: `POST /api/finance-customer-registration`, header `x-webhook-secret` da integração existente, corpo `{ "asaas_customer_id": "cus_...", "firestore_doc_id": "..." }`. ID ausente/inválido retorna erro; o produtor deve aguardar 200 e repetir falhas transitórias. Repetição do mesmo par é idempotente.

O repositório não cria clientes no Asaas. A chamada do callback pelo produtor externo ainda precisa ser conectada ao fluxo real de criação. Não foi feita alteração de workflow externo nem no Asaas. Aluno sem cliente Asaas conhecido não recebe vínculo inventado; continua pendente para cadastro integrado ou escolha manual.

## Validação

Testes novos focados: permissões/origem/confirmação, IDs obrigatórios na criação, conflito e liberação de lease; UI de candidatos, escolha, confirmação e refresh. Nenhuma suíte Foundation anterior repetida. A prova visual em produção não escolhe nem salva aluno real em nome do operador.
