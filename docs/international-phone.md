# Telefones internacionais

## Contrato

`src/international-phone/core.js` centraliza parsing, validação, comparação e apresentação com `libphonenumber-js/max` (dependência já existente). `normalizePhoneToE164()` retorna E.164 ou vazio; `inspectPhone()` distingue vazio, incompleto, inválido, ambíguo e válido. `requirePhone()` rejeita novas gravações inválidas com HTTP 400. País só é detectado para números válidos; não há recuperação de DDD ou inserção do nono dígito.

`InternationalPhoneInput` melhora os controles existentes, mantendo seu nome, atributos e contrato de eventos. O controle original contém E.164; o editor visível contém o número nacional. O seletor busca nomes em português/inglês e DDI, tem navegação por teclado e nomes acessíveis. Campos novos usam Brasil, exceto o discador comercial que conserva seu contexto explícito EUA. O `PhoneDisplay` compartilha o formatter e usa `tel:E.164`.

## Cobertura

- Fichas de alunos e professores, perfil, usuários/acessos, responsável quando cadastrado em users.
- CRM: criação/edição/detalhes/listas, validação API, identidade, busca por dígitos.
- Landing/leads, contratos e adaptação para o contrato de assinatura (país/número nacional).
- Financeiro: editores, detalhes, matching de identidade.
- Agenda e discador: campos internacionais, parser compartilhado; sem iniciar chamadas nos smokes.
- Inbox: painel contextual, contato compartilhado, busca, matching; o adapter de envio continua removendo o `+` na fronteira de transporte.
- Pedagógico: telefone do professor usa diálogo com o mesmo editor; matching de acesso e deduplicação usam E.164 válido.
- Resolver de lead: removida a equivalência por apenas oito dígitos. Não há auto-merge nem reatribuição de identidades.

JIDs/LIDs, IDs Meta, mensagens históricas, payloads brutos, filas externas e identificadores de deduplicação de webhooks não são números editáveis de cadastro. Não foram reescritos: isso invalidaria chaves de transporte/replay. Números históricos inválidos continuam legíveis sem inventar país. Cadastros oficiais e originais têm precedência sobre qualquer representação visual.

## Auditoria e backfill — 25/09/2026

38 tabelas Supabase com colunas de telefone e as coleções Firestore `users`, `crmContacts`, `leads`, `contratos` foram examinadas. A tabela privada `contact_identities` foi lida por SQL administrativo, sem alterar grants/RLS.

Na leitura usada pelo backfill: **5.982 valores preenchidos** (conta campos, não pessoas): 2.504 já E.164 válidos, 2.264 normalizáveis, 6 ambíguos, 1.207 inválidos e 1 incompleto. A base recebe eventos durante a auditoria; não se trata de snapshot transacional entre os dois bancos. Entre as 37 identidades da Inbox, 30 têm telefone válido e 7 não passam na validação internacional atual.

**10 campos mestres normalizados**, com leitura de confirmação após cada atualização. Zero colisões ou merges. Apenas Firestore e `students.phone` elegíveis foram atualizados. Nenhuma migration/coluna foi necessária. Originais e exceções estão em backup privado fora do repositório, em `~/.codex/private/phone-normalization-20260925/`, com diretório 0700 e arquivos 0600. Nenhum dado pessoal da auditoria foi incluído neste documento ou no commit.

`scripts/international-phone-audit.js` é dry-run por padrão; `--apply` modifica somente valores válidos sem outro registro com a mesma identidade no cadastro. Firestore usa precondição updateTime; Supabase usa comparação do valor anterior. Credenciais devem vir do ambiente existente. O relatório privado preserva o valor original. Eventos e espelhos externos são somente auditados; uma futura revisão dessas fontes deve respeitar o contrato de cada integração.

## Verificação

Testes cobrem BR/EUA/PT, espaços, hífens, país, DDI desconhecido, ambiguidade, opcionais vazios, canonical FormData, eventos dos editores inline, seleção de país, rejeição server-side e matching sem sufixos. Regressões direcionadas exercitam CRM, cadastros, Inbox/envio com adapter simulado, financeiro e ligações.

O backfill verifica persistência em registros reais. Smokes visuais de Production não enviam WhatsApp, não iniciam chamadas e não criam leads artificiais. Evolution, Meta, WABA, sessões, infraestrutura e secrets não foram alterados.
