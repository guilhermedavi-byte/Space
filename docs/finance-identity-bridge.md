# Identity Bridge Asaas ↔ Space

Somente criação de vínculos na Financial Foundation. Nenhuma alteração em Asaas, alunos, contratos ou cobranças; sem mensagens ou automações.

## Fontes e critérios

Primeiro consultados `n8n_alunos_financeiro_space`, `n8n_onboarding_alunos_space`, `n8n_cobrancas_financeiras_space` e `billing_accounts`: todos sem registros na consulta de produção. O bridge continua consultando esses vínculos explícitos, os vínculos financeiros existentes e referências canônicas de contratos.

Depois compara clientes Asaas e alunos verificados do Firestore. Prioridade: ID canônico; CPF/CNPJ exato com dígitos verificadores válidos; telefone exato após remoção de formatação; e-mail exato após trim e conversão de caixa. Não se inferem país/DDD, nono dígito, aliases de e-mail ou similaridade. Nome não é critério.

Documentos e contatos precisam ser únicos em ambos os lados. Mais de um aluno candidato, evidências divergentes ou identificador compartilhado produzem `AMBIGUOUS`, mesmo que outro identificador pareça único. Sem evidência confiável: `UNMATCHED`. Clientes históricos ausentes da lista são consultados individualmente por ID; 404 ou exclusão não geram vínculo automático.

## Persistência e execução

Modelo existente `finance_customer_student_links`: `asaas_customer_id`, `firestore_doc_id`, `verified_at`; `verified_by` contém JSON estruturado com `actor`, `method`, `source`, `bridge_version`. A auditoria da Foundation registra a criação na mesma transação. Métodos: `id`, `document`, `phone`, `email`. Não são armazenados documentos ou contatos no vínculo. Reexecução mantém o método original e não duplica o par canônico.

`GET /api/finance-identity-bridge`: proposta agregada. `POST` com `{"action":"apply"}`: até 20 vínculos elegíveis por execução. Sessão administrativa, origem da aplicação e flag Foundation obrigatórias. Conta Asaas verificada, cliente somente leitura, revalidação do cliente/aluno e consulta de conflitos preexistentes antes da gravação. Casos não resolvidos não são forçados.

Contexto Space já é consumido por ID canônico em Clientes/Recebíveis: ciclo de vida, aviso registrado, status, plano e CS quando presente. Cache de até cinco minutos. Ausências permanecem explícitas.

## Validação

Quatro testes novos e focados: critérios exatos, duplicidades/conflitos, procedência e idempotência do método, clientes excluídos e vínculos conflitantes. Nenhuma auditoria ou suíte anterior repetida.

## Resultado Production

655 clientes analisados (incluindo IDs históricos da carteira); 56 vinculados por e-mail exato e único; 0 por ID, CPF/CNPJ ou telefone; 4 AMBIGUOUS; 595 UNMATCHED. Aplicação em lotes de 20, 20 e 16, zero pendentes elegíveis. Contagem persistida confirmada: 56 clientes únicos, todos com método/origem e timestamp. Evidências sanitizadas em `artifacts/finance-identity-bridge/production.json` e `persisted.json`.

Clientes e Recebíveis exibiram contexto real Space no navegador; drawer mostrou ciclo de vida, status, plano, CS e aviso prévio, preservando ausências. Acesso temporário removido das variáveis Production e do código final. Nenhuma alteração de cadastro Space ou Asaas.
