# Space — execução local

Requer Node.js 24 e npm (ambiente validado com Node 24.20.0).

```sh
npm ci
npm run dev
```

Abra http://localhost:3000. Para encerrar, pressione Ctrl+C. Para outra porta:
`PORT=3001 npm run dev` (ajuste também `SPACE_PUBLIC_BASE_URL`).

## Configuração

O comando lê `.env.local`, ignorado pelo Git. Neste ambiente, o arquivo já foi
criado com uma chave de sessão aleatória e configuração Firebase demonstrativa.
Login e serviços externos exigem credenciais de desenvolvimento válidas.

Em um novo clone, copie `.env.example` para `.env.local`, configure
`SPACE_PUBLIC_BASE_URL=http://localhost:3000` e gere `SPACE_AUTH_SECRET` com
`node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`.
Preencha todas as variáveis `NEXT_PUBLIC_FIREBASE_*` com os valores do projeto
de desenvolvimento: a configuração existente usa defaults de produção quando
esses campos ficam vazios em modo local. Configure as credenciais privadas de
Firebase, Supabase e demais integrações apenas conforme os recursos necessários.
Não versione segredos.

O servidor local atende arquivos estáticos, executa os handlers Node de `api/`
e aplica os rewrites de `vercel.json`. É um adaptador de desenvolvimento, não
uma emulação completa da Vercel (não executa cron nem replica limites da plataforma).
Reinicie após alterar APIs, configuração ou `.env.local`; arquivos estáticos
são lidos a cada requisição.

```sh
npm run check
npm test
```
