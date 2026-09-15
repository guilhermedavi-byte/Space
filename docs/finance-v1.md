# Financeiro V1 — produção

## Escopo

Quatro workspaces: Visão Geral, Recebíveis, Assinaturas e Clientes. Navegação única na sidebar; recebíveis com filtros e drawer lateral. Sem edição financeira, criação de cobranças, confirmação manual, Recuperação, automações ou novo Atendimento.

## Fontes e acesso

`GET /api/finance-v1?view=overview|receivables|subscriptions|customers|receivable` permite somente admin e FINANCE, exige a flag Foundation e usa a conexão configurada no servidor. Nenhum parâmetro escolhe outra conta. Respostas privadas, sem cache HTTP; métodos de escrita recusados.

- Valores, status, recebimentos, auditoria, IDs de cobranças e vínculos acadêmicos: novas projeções `finance_*` da Financial Foundation. Nenhuma tabela financeira legada é fonte do novo frontend.
- Nomes de clientes e assinaturas: consultas GET pelo cliente central Asaas, com verificação do vínculo da conta, cache de cinco minutos e paginação completa. Essas consultas complementam a Foundation sem gravar objetos nem executar novo backfill. O cache financeiro é de 20 segundos.
- Se o diretório Asaas estiver indisponível, o backend utiliza apenas as projeções disponíveis, informa a cobertura incompleta e preserva os dados financeiros. Não inventa nomes, assinaturas ou vínculos.
- Cliente sem vínculo explícito: **Não vinculado**. Quando existe, mostra o ID acadêmico verificado; não há resolução heurística por nome/e-mail.
- Drawer expõe somente links HTTPS existentes do domínio Asaas e campos financeiros selecionados da auditoria. Não entrega payload bruto, ator, e-mail, credenciais ou tokens de integrações.

## Métricas

Valores calculados no backend em centavos inteiros. Fuso do calendário: America/Sao_Paulo.

- Recebido no mês: valor bruto dos registros únicos de pagamento, pela data do pagamento, para cobranças RECEIVED, RECEIVED_IN_CASH ou DUNNING_RECEIVED. Não inclui CONFIRMED nem cobranças canceladas/estornadas. Não é receita contábil líquida de taxas.
- A receber no mês: valor das cobranças em aberto com vencimento no mês, inclusive vencidas. Em aberto: PENDING, OVERDUE e DUNNING_REQUESTED não excluídas.
- Vencido: valor em aberto com vencimento anterior ao dia atual, em toda a carteira.
- Inadimplência: vencido / total em aberto da carteira. Sem denominador, mostra traço, não percentual inventado.
- Previsto × recebido: mesmas cobranças com vencimento no mês; exclui cancelamentos/estornos. É uma comparação de carteira por vencimento, distinta do KPI recebido por data de pagamento.
- Aging: diferença em dias corridos entre hoje e vencimento. Recebimentos sem data e cobranças sem valor são apontados, sem inventar datas/valores.

## Limites explícitos

Não foram executadas novas projeções de customers/subscriptions; o diretório real Asaas complementa essas lacunas por leitura. Alunos vinculados são identificados pelo ID Space disponível, sem consulta heurística ao Firestore. Não há ações de alteração financeira. Histórico exibe as 20 alterações mais recentes da cobrança; a auditoria completa permanece armazenada. O backend interrompe leituras acima de 20 mil registros por tabela ou do limite de 100 páginas Asaas, sem publicar agregados parciais como completos. Cache e leituras não constituem snapshot atômico entre Asaas e Supabase.

## Validação focada

Seis testes em `tests/finance-v1.test.js` e `tests/finance-v1-ui.test.js`: valores/competência/aging, filtros e identidade, links/auditoria sanitizados e fallback, permissões e somente leitura, tabela/drawer e navegação. Evidência em `artifacts/finance-v1/focused-tests.tap`. Nenhuma suíte ou certificação anterior da Foundation foi repetida.

## Publicação e operação — 15/09/2026

Implementação integrada à `main` em `a329ec32b4bc4a4f96ce8ad6e49e69fe63d387ce`, publicada pelo deploy automático GitHub/Vercel em Production, READY no domínio `https://plataforma.spaceschoolbr.com`.

Verificação autenticada no navegador: quatro workspaces carregados; 2.076 recebíveis, filtro de vencidos com 199 resultados, 172 assinaturas e 652 clientes na união do diretório com os IDs financeiros existentes. Os números refletem o instante da consulta, não valores fixos do produto. Drawer abriu detalhes, link Asaas e histórico real; Escape fechou sem mudar de página. Atalhos por assinatura e cliente filtraram respectivamente três e cinco cobranças existentes. Busca sem correspondência mostrou estado vazio. Nenhum erro de console observado na conferência.

KPIs observados em setembro: recebido R$ 77.154,80; a receber R$ 131.443,00; vencido R$ 186.870,00; inadimplência 41,65%. Fórmulas e períodos definidos acima. Evidências sanitizadas em `artifacts/finance-v1/production-ui.json` e `deployment.json`.

Lacuna de identificação: alguns IDs históricos de clientes não retornam nome no diretório atual; a interface informa “Nome não disponível”. Ausência de vínculo acadêmico explícito aparece como “Não vinculado”. A implantação não criou vínculos, transações ou novas projeções de diretório. Assinaturas são consultadas diretamente na API real enquanto sua projeção dedicada permanece incompleta.
