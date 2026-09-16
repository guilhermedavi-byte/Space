## Estado atual — Firestore e Supabase

Atualização em 2026-09-15: n8n excluído do escopo por instrução explícita do usuário. O acesso ao Firestore foi recuperado via Cloud Shell autenticado; export completo de users (266 documentos) e inventário de subcoleções concluídos. Os 227 alunos da UI correspondem exatamente aos 227 users student. Ver `docs/cancellation-firestore-supabase-certification.md` e `artifacts/cancellation-production/canonical-reconciliation-v2-summary.json`. As referências abaixo a autenticação bloqueada, ausência de export ou exigência de n8n são históricas e estão superadas. A ativação permanece bloqueada por dados contratuais/planos, elegibilidade e conflitos; nenhum backfill foi aplicado.

# Cancellation V2 — censo e rastreabilidade, 2026-09-15

## Resultado e limites

Censo **parcial** obtido pelo botão `Exportar lista` da UI autenticada de produção. São 227 IDs únicos: 226 com flag exportada `ativo=sim`, 1 com `ativo=nao`; todos possuem email, sem emails normalizados duplicados nessa exportação. Há 56 registros sem plano exportado. Os 163 IDs distintos das 7.637 linhas pedagógicas anteriormente exportadas coincidem exatamente com IDs da UI; 64 IDs da UI não aparecem nesse conjunto. Nenhum vínculo foi feito por nome ou fuzzy matching.

Isto valida o vínculo UI↔referência pedagógica desse recorte. Não valida identidade Auth/Firestore completa, contrato, elegibilidade operacional, histórico financeiro ou cancelamento. Os registros pedagógicos são o snapshot da fase anterior; não se trata de snapshot simultâneo entre sistemas.

A CLI Firebase continua inválida. A conta selecionada é guilhermedavi@spaceschoolbr.com e o Google mantém o desafio “Confirme que é você”. Projeto previamente confirmado: `plataforma-space`, banco `(default)`. Nenhuma regra foi alterada.

## Origem exata do contador

Rota: `/app/admin/controle-pedagogico?modulo=usuarios`, aba Alunos.

1. `renderAdminControlePedagogicoPanel` carrega `fetchUserRowsFromFirestore("student")` e `/api/pedagogico/dashboard`.
2. Para admin, `fetchUserRowsFromFirestore` usa `/api/admin-data?collection=users&type=student&debug=1`. O backend lista `users` pelo REST Firestore com paginação e filtra `inferLegacyUserRole`.
3. O papel explícito usa `tipo/role/type/perfil`, aceitando `student/aluno`. Sem papel explícito reconhecido, marcadores de aluno sem marcadores de professor permitem inferência. Isso é regra de listagem, não prova de contrato.
4. Fallback do frontend, quando a API não fornece linhas: duas queries Firestore `users.where("tipo", "==", "student")` e `users.where("tipo", "==", "aluno")`, unidas por document ID. Esse fallback tem semântica diferente da inferência do backend.
5. `/api/pedagogico/dashboard` agrega onboarding (`n8n_onboarding_alunos_space`, com fallback legado), financeiro (`n8n_alunos_financeiro_space`) e preferências por admin. Aulas ao vivo enriquecem somente usuários existentes por UID. `opsStudents` é mesclado com o cadastro.
6. Na tela de Usuários, `mergePeople` usa aliases de `getAdminStudentMergeKeys`: email, telefone, sourceBusinessId, referência Firestore e IDs. Essa mesclagem de apresentação **não deve ser reutilizada como prova de identidade para o backfill**: não exige unicidade de todos os aliases.
7. `renderAdminPedagogicoStudentsPanel` calcula o estado via `getStudentLifecycleBadgeMeta/getStudentLifecycleState`, aplica status/professor/plano e busca. O contador é `rowsToRender.length`.
8. O status padrão é `active`, mas seu predicado é apenas `lifecycleState !== INACTIVE`: inclui aviso e suspensão. O estado legado INACTIVE pode decorrer de desfecho/data de efetivação, `ativo=false` ou datas legadas de desativação. O normalizador de `ativo` preserva booleanos e usa true para qualquer outro valor.
9. O botão CSV exporta **toda** `adminPedagogicoState.students`, independentemente do filtro visual; exporta apenas ID, nome, email, professor, plano e flag ativo.

Na observação atual: contador 226; CSV 227, com 226 flags sim e uma nao. Portanto são registros da lista mesclada após filtro de apresentação, **não uma contagem de subscriptions ACTIVE**. A contribuição quantitativa de cada datasource e os estados contratuais exatos ainda dependem dos payloads originais/Firestore completo. A exportação CSV não preserva provenance individual nem evidências de cancelamento.

Os cinco trechos críticos (fetchUserRowsFromFirestore, getStudentLifecycleState, getAdminStudentMergeKeys, renderAdminPedagogicoStudentsPanel e ADMIN_PED_STUDENT_FILTER_DEFAULTS) foram comparados com o `script.js` público em produção e são iguais ao checkout lido. SHA256 do script público: `189359dbb26e51fff32d4e1271b6f8693ec1f64d9f1fb5a23e0aeba44601a915`.

## Artefatos

- `artifacts/cancellation-production/student-census.csv`: 227 linhas pseudonimizadas, com status explicitamente identificado como flag da UI.
- `artifacts/cancellation-production/student-census-summary.json`: contagens, limites, timestamp e SHA256 do CSV original; `complete=false`.
- `artifacts/cancellation-production/canonical-reconciliation.csv`: 227 candidatos AMBIGUOUS para backfill por ausência de dados contratuais originais. Os 163 vínculos exatos são destacados em evidence. AMBIGUOUS aqui não significa que o ID pedagógico seja ambíguo.
- CSV original privado: `/tmp/space-cancellation-production/ui-students-2026-09-15.csv`, permissões 0600, contém IDs exatos e PII. A cópia original baixada pelo usuário permanece em Downloads. Não é backup recuperável dos sistemas.

Campos contratuais vazios significam **não disponíveis na exportação**, nunca ausência comprovada ou autorização para default. Nenhum registro foi classificado SAFE/SAFE_WITH_DEFAULT. Não é possível afirmar ORPHAN sem ler todas as fontes.

## Próximo gate

Concluir confirmação Google diretamente no Chrome → exportação completa paginada → conferir IDs, contratos e histórico → reconciliação completa → backfill silencioso determinístico e dry-run. Nenhuma migration, projeção, consumer, scheduler, canário ou flag deve avançar antes dos gates exigidos pelo usuário. Runtime público foi rechecado: `retentionV2Enabled=false`.
