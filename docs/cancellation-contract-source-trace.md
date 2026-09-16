## Estado atual — Firestore e Supabase

Atualização em 2026-09-15: n8n excluído do escopo por instrução explícita do usuário. O acesso ao Firestore foi recuperado via Cloud Shell autenticado; export completo de users (266 documentos) e inventário de subcoleções concluídos. Os 227 alunos da UI correspondem exatamente aos 227 users student. Ver `docs/cancellation-firestore-supabase-certification.md` e `artifacts/cancellation-production/canonical-reconciliation-v2-summary.json`. As referências abaixo a autenticação bloqueada, ausência de export ou exigência de n8n são históricas e estão superadas. A ativação permanece bloqueada por dados contratuais/planos, elegibilidade e conflitos; nenhum backfill foi aplicado.

# Cancellation V2 — fontes contratuais localizadas

Data: 2026-09-15. Escopo: rastreamento de código e consultas REST somente leitura. Não certifica uma venda real ponta a ponta.

## Caminho implementado

1. `api/growth-dashboard.js` cria documentos `contratos/{id}` no Firestore. Campos incluem email, plano (`contrato`), valores, `data`, status, criadoEm/enviadoEm/assinadoEm, zapsignToken e documentoAssinado.
2. `callZapSignCreateDoc` utiliza `ZAPSIGN_API_TOKEN` e templates Diamond/Gold/Turma para criar documento no serviço ZapSign. Os campos enviados não provam, por si, início de vigência, duração, competência ou periodicidade financeira. Não converter data de criação/assinatura em início contratual automaticamente.
3. O handler de assinatura atualiza o contrato e chama `triggerContractSignedOnboarding` com contract_id, student_id, plano e metadados. Existe também a entrada `api/pedagogico/zapsign.js`.
4. `api/_lib/pedagogico-n8n.js` grava `n8n_onboarding_alunos_space` por contract_id e despacha para `N8N_PEDAGOGICO_ONBOARDING_WEBHOOK_URL` ou `N8N_PEDAGOGICO_ONBOARDING_URL`. Logs usam `n8n_logs_pedagogico_space`; chave de disparo `pedagogico:onboarding:contract_signed:<id>`.
5. `api/asaas-webhook.js` seleciona caminho financeiro conforme feature flag. O handler legado atualiza cobrança por `id_cobranca_externa` usando dados de payment recebido do Asaas. A ligação contrato → customer → subscription → parcela não foi demonstrada para nenhum dos 227 alunos.

## Risco de identidade a tratar na reconciliação

O handler contratual pode preencher student_id com alunoId, studentId, email, whatsapp ou contract ID. `upsertOnboardingFromContract` também aceita student_id como fallback de firestore_doc_id. Logo, o nome da coluna firestore_doc_id não basta para provar um UID real. Exigir existência do documento, referências consistentes e unicidade. Não classificar SAFE apenas porque uma coluna está preenchida.

## Evidência real desta etapa

Supabase `mlpojyvwyqcrelagtgkw`, via serviço autorizado, retornou count exato zero para students, subscriptions, n8n_onboarding_alunos_space, n8n_alunos_financeiro_space e n8n_cobrancas_financeiras_space. As respostas e timestamp estão no status dos gates. Isso comprova apenas que essas tabelas estão vazias, não ausência de contratos/cobranças externos.

Os documentos de `contratos`, documentos assinados e metadados relacionados ainda não foram exportados porque a CLI Firebase continua sem credencial válida. URL/sessão do n8n não foram disponibilizadas. Cobertura contratual por aluno: desconhecida.

## Créditos

O código local contém `syncCreditCycle` e persistência do estado em storage do navegador; ciclo de seis dias excluindo domingo e quantidades por plano. O caminho possui guarda lifecycle quando a sessão fornece lifecycle. Esse mecanismo não comprova que seja o gerador operacional real de toda a escola, nem substitui inventário de backend/n8n. Não usar seu default Gold ou datas de inicialização para preencher contratos.

## Continuação

Ler integralmente users + contratos + referências/subcollections relevantes após autenticação; confrontar documentos assinados e IDs externos com os 227 IDs privados. Depois rastrear um pagamento real no provedor/n8n. Somente após essas fontes estarem disponíveis produzir a reconciliação V2 exigida pelo gate 6. Nenhuma mudança de arquitetura, negócio, schema, workflow ou dados foi feita.
