# Remoção do Painel SDR

## Escopo

Removidas as interfaces exclusivas `admin-sdr.js` e o painel legado Growth no
`script.js`: menus, link da Visão Geral, carregadores, estado, gráficos, ações
manuais e listeners. Removido `tests/admin-sdr-ui.test.js` e o teste exclusivo
do envio manual legado. Os estilos exclusivos foram eliminados.

As rotas antigas `/admin/sdr`, `/app/{admin,growth}/sdr` e
`/app/{admin,growth}/comercial/{pre-vendas/,}painel-sdr` redirecionam para
Comercial do respectivo perfil. Não há novo produto ou renomeação do painel.

## Recursos compartilhados preservados

- Pré-Vendas, Visão Geral, CRM, CRM Live, Metas, Usuários, Ligações e Agenda.
- `api/admin-sdr.js`, `api/sdr-metrics.js`, endpoint de áudio e seus testes:
  mantidos para histórico e reutilização. Sem remoção de APIs.
- A chave `comercial.sdrPanel` continua válida para análises/gravações e para
  compatibilidade com permissões existentes de Ligações. Retirada a associação
  à interface e à rota removidas; rótulo descritivo: Análises de ligações.
- `sdr-panel`, `sdr-card`, sparklines e estilos ainda usados em Pré-Vendas e
  Visão Geral permanecem compartilhados. Termos SDR de papéis, atribuições e
  coaching CRM não representam o submódulo removido.
- Nenhuma migration, alteração de banco, dados, storage, chamadas, gravações,
  transcrições, coaching, snapshots, providers, webhooks ou infraestrutura.

## Verificação

91 testes direcionados aprovados: navegação/redirect sem loop, ausência da UI,
permissões compartilhadas, sidebar por perfil, métricas, Pré-Vendas e Ligações.
Busca global: nomes antigos restantes somente em redirects, backend histórico,
permissões compatíveis, testes/documentação e estilos compartilhados.
