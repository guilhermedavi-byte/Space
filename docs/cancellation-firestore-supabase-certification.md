# Cancellation Lifecycle V2 — certificação Firestore/Supabase

> Atualização: a decisão oficial de preservar o estado operacional dos 227 substitui os bloqueios históricos abaixo. Resultado do rollout atual em [cancellation-legacy-rollout.md](cancellation-legacy-rollout.md). Contrato, plano e datas inexistentes não são requisitos de ativação.

## Resultado da etapa anterior — superado pela decisão oficial legacy

2026-09-15. Production certification: BLOCKED. Lifecycle V2 permanece DISABLED. Nenhuma mudança de dados, migration, rules, workflow, scheduler ou flag foi feita nesta etapa. Nenhuma regra de negócio foi alterada. n8n está fora do escopo por confirmação explícita do usuário; nomes legados de tabelas não criam uma dependência n8n.

## Credenciais e acesso

- Supabase: credencial técnica persistente disponível nos arquivos de environment; service role permitiu leituras REST de produção.
- Google: nenhuma service account JSON, chave separada ou ADC utilizável no processo/arquivos locais verificados. Nova exportação Vercel manteve GOOGLE_SERVICE_ACCOUNT_JSON redigida; isso não demonstra ausência no servidor. CLI Firebase local continua inválida.
- Usada a sessão Google já aberta pelo usuário, com Cloud Shell autorizado como guilhermedavi@spaceschoolbr.com. A leitura gcloud confirmou `projects/plataforma-space/databases/(default)`, `southamerica-east1`. Não foi criada chave nova.
- O transporte Python urllib teve falha DNS. O transporte HTTPS curl funcionou; credencial OAuth foi mantida em memória e passada ao subprocesso por stdin, sem impressão ou inclusão em argumento de processo.

## Export de Firestore

Arquivo privado local: `/tmp/space-cancellation-production/firestore-real-export.json`, 464.306 bytes, chmod 0600. JSON legível, com início/fim de coleta, metadata do banco, documentos com updateTime, raízes e inventário de subcoleções. SHA256: `991760194b3658027b864449d9360c1188771668534add27c31e5b1e7d828419`.

266 users: 227 student, 21 teacher, 6 admin, 11 growth, 1 financeiro. Todos os 227 IDs do CSV da UI correspondem exatamente ao document ID de um user student; não há aluno adicional em users fora desse conjunto. 226 também têm uid e authUserId iguais ao document ID. Isso verifica referências persistidas, não a existência atual das contas no serviço Firebase Authentication.

Listagem paginada até ausência de nextPageToken; subcoleções consultadas para os 266 users, nenhuma retornada. As raízes listadas não incluem contratos, contracts, subscriptions, plans ou enrollments. Não alegar backup integral do Firestore: outras coleções não foram exportadas e a leitura não é uma transação simultânea entre documentos/sistemas.

O CSV/JSON público contém referências pseudonimizadas, sem nomes, emails, CPF ou notas de cancelamento. As tentativas iniciais do formulário de download retornaram arquivo de diretório em vez do JSON selecionado; esses arquivos foram removidos sem inspeção. A transferência final usou o comando cloudshell download com confirmação do caminho exato do JSON.

## Estado observado e denominador

| Categoria observada | Quantidade |
| --- | ---: |
| OPERATIONAL_ACTIVE | 201 |
| OPERATIONAL_SUSPENDED | 15 |
| OPERATIONAL_NOTICE_PERIOD isolado | 0 |
| CHURNED com evidência legada de saída | 1 |
| HISTORICAL / NON_STUDENT adicionais | 0 |
| UNKNOWN | 10 |

Suspensão tem precedência na tabela: há aviso dentro dos casos suspensos. Esses rótulos descrevem evidências, não estados canônicos certificados. Os dez UNKNOWN têm origem legado `abandono_confirmado` sem encerramento efetivado e ainda ativo=true. Não inferir churn a partir do rótulo.

`canonical_eligible_students = null`: ainda não há denominador oficial. Os dez UNKNOWN não foram excluídos silenciosamente. Há 56 sem plano em ambos aliases e nenhum vínculo/início contratual confirmado no conjunto exportado. Um documento informa tempoContrato=12, insuficiente para estabelecer vigência. As datas criadoEm/createdAt e o source admin_student_import não foram usados como início de contrato.

## Reconciliação V2

227 registros: SAFE 0, SAFE_WITH_DEFAULT 0, AMBIGUOUS 220, CONFLICT 7. ORPHAN/INVALID/NOT_ELIGIBLE 0 neste levantamento; isso não representa certificação de fontes ainda não localizadas.

Seis conflitos: fim de aviso passado, ativo=true e nenhuma efetivação. Um conflito: efetivação anterior ao fim de aviso registrado e status legado ativo. Nenhuma data foi corrigida ou convertida automaticamente em churn. Os sete exigem resolução com evidência histórica.

A planilha diagnóstica V2 foi gerada mesmo com contrato pendente para permitir revisão; `contract_reconciliation_complete=false` e `full_certification_complete=false`. Não é um payload de backfill aprovado.

## Supabase e financeiro

REST confirmou zero students/subscriptions/charges/payments/billing_accounts e tabelas financeiras centrais consultadas. Porém existem 99 registros em space_financeiro_cpf_sources, todos snapshots de customer com source_system=asaas e synced_at em 2026-06-23, mais uma linha em space_financeiro_cpf_identity. Não foi acessado o provedor externo.

Os 99 registros não têm platform_student_id; 65 não têm email. Há 12 matches por email normalizado único nos dois conjuntos e nenhuma externalReference igual aos document IDs. Esses matches são evidência de customer armazenado no Supabase, não contrato, assinatura ou recebimento. As tabelas públicas expostas pela API não esgotam possíveis schemas privados. Contagens e campos estão em source-tables-counts.json.

## Próximos gates

O próximo bloqueio é informação: localizar dentro de Firestore/Supabase a fonte de vigência/vínculo contratual, ou obter a regra já aprovada para matrícula sem contrato formal. Foi solicitado ao usuário o local/regra. Resolver 56 planos ausentes, dez elegibilidades e sete conflitos sem inventar dados. Depois preparar diff/dry-run silencioso e revisão, backup recuperável, migration, backfill idempotente, projeção e consumers reais, scheduler único e canários.

O snapshot de users não substitui backup recuperável do Supabase. Rollback integral ainda não certificado. Não aplicar backfill parcial nem habilitar a feature com a informação atual.

## Verificação e aceite

Quatro verificações offline passaram: ativo sem contrato não vira SAFE; abandono não vira churn automaticamente; aviso vencido vira conflito; efetivação antecipada exige revisão. Inputs não foram alterados e duas gerações do CSV produziram SHA256 idêntico. Isso não prova idempotência de backfill nem substitui canários.

Matriz atual: Supabase, API, Firestore, Retenção, Financeiro, Pedagógico, Agenda e Analytics × A/B/C/D = 32 células após exclusão de n8n. 0 executadas, 0 certificadas. Divergência, erros de projeção/eventos, duplicações e transições inválidas ainda não medidos.

**DO NOT ENABLE.**
