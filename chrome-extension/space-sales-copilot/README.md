# Space Sales Copilot Extension

Extensão Chrome Manifest V3 para testar o Copilot da Space em cima do Google Meet.

## Como carregar no Chrome

1. Abra `chrome://extensions`.
2. Ative `Modo do desenvolvedor`.
3. Clique em `Carregar sem compactação`.
4. Selecione a pasta `chrome-extension/space-sales-copilot`.
5. Entre no Growth em `https://space-three-sand.vercel.app/app/growth/copilot-vendas`.
6. Clique em `Conectar extensão` no Copilot da plataforma. O token será copiado.
7. Abra o popup da extensão, cole o token em `Token da extensão` e clique em `Salvar`.
8. Abra uma reunião em `https://meet.google.com`.

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
- Se o painel mostrar `Erro`, gere um novo token em `Conectar extensão`, cole no popup e tente novamente.

## Próximos passos

- Automatizar o envio do token para a extensão sem copiar e colar.
- Ativar `chrome.tabCapture` em uma etapa posterior para capturar áudio da aba do Meet.
- Adicionar botão "Salvar no CRM" depois da confirmação do closer.
