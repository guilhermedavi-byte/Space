# Space Sales Copilot Extension

Extensão Chrome Manifest V3 para testar o Copilot da Space em cima do Google Meet.

## Como carregar no Chrome

1. Abra `chrome://extensions`.
2. Ative `Modo do desenvolvedor`.
3. Clique em `Carregar sem compactação`.
4. Selecione a pasta `chrome-extension/space-sales-copilot`.
5. Entre no Growth em `https://space-three-sand.vercel.app/app/growth/copilot-vendas`.
6. Abra uma reunião em `https://meet.google.com`.

## MVP atual

- Injeta popup flutuante no Google Meet.
- Popup arrastável e minimizável.
- Captura/transcreve pelo microfone do navegador quando o Chrome suportar Web Speech API.
- Permite colar trecho manualmente.
- Chama as APIs seguras da plataforma:
  - `/api/growth/copilot-vendas/suggest`
  - `/api/growth/copilot-vendas/summary`
- Não contém chave da OpenAI.
- Não grava áudio.

## Próximos passos

- Melhorar autenticação extension -> plataforma com token efêmero.
- Ativar `chrome.tabCapture` em uma etapa posterior para capturar áudio da aba do Meet.
- Adicionar botão "Salvar no CRM" depois da confirmação do closer.
