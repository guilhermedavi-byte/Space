# PR 3 — Ambiente de Staging da Space

Este documento descreve a preparação do ambiente isolado de staging aprovada para a Fase 2 do RFC de Governança Canônica de Dados.

## Objetivo

Garantir que staging:

- não use Firebase de produção;
- não use Supabase de produção;
- não use chave real do Asaas;
- não chame workflows reais do n8n;
- não envie e-mail, WhatsApp ou telefonia para clientes reais;
- exiba banner fixo e explícito de ambiente de teste.

## Variáveis obrigatórias

### Ambiente

- `APP_ENV`
- `SPACE_APP_ENV`
- `SPACE_PUBLIC_BASE_URL`
- `SPACE_AUTH_SECRET`

### Firebase público

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID`

### Firebase service account

- `GOOGLE_SERVICE_ACCOUNT_JSON_STAGING`

Em Preview/Staging, o backend deve usar somente a service account de staging. A variável de produção `GOOGLE_SERVICE_ACCOUNT_JSON` continua exclusiva de Production e não deve ser configurada no ambiente Preview.

### Supabase

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

### Asaas

- `ASAAS_BASE_URL`
- `ASAAS_API_KEY`
- `ASAAS_KEY_SCOPE`

### n8n

- `N8N_BASE_URL`
- `N8N_ENV_SCOPE`
- `N8N_WEBHOOK_SECRET`
- `N8N_PEDAGOGICO_ONBOARDING_WEBHOOK_URL`
- `N8N_PEDAGOGICO_PROFESSOR_PRIMEIRA_AULA_WEBHOOK_URL`
- `N8N_PEDAGOGICO_REGISTRO_AULA_WEBHOOK_URL`
- `N8N_PEDAGOGICO_REGISTRO_FALTA_WEBHOOK_URL`
- `N8N_PEDAGOGICO_REMARCACAO_AULA_WEBHOOK_URL`

### Referências de isolamento

- `SPACE_PRODUCTION_FIREBASE_PROJECT_ID`
- `SPACE_PRODUCTION_SUPABASE_URL`
- `SPACE_PRODUCTION_N8N_BASE_URL`
- `SPACE_PRODUCTION_ASAAS_BASE_URL`
- `SPACE_STAGING_FIREBASE_PROJECT_ID`
- `SPACE_STAGING_SUPABASE_URL`
- `SPACE_STAGING_N8N_BASE_URL`
- `SPACE_STAGING_ASAAS_BASE_URL`
- `FIREBASE_ENV_SCOPE`
- `SUPABASE_ENV_SCOPE`

### Comunicação

- `CHATWOOT_BASE_URL`
- `CHATWOOT_ACCOUNT_ID`
- `CHATWOOT_INBOX_ID`
- `CHATWOOT_API_TOKEN`
- `STAGING_EMAIL_ALLOWLIST`
- `STAGING_WHATSAPP_ALLOWLIST`
- `STAGING_SMS_ALLOWLIST`

### Reset seguro

- `STAGING_ADMIN_EMAIL_ALLOWLIST`
- `STAGING_RESET_WRITE_ENABLED`

## Regras de isolamento aplicadas

- `APP_ENV=staging` falha se o Firebase apontar para `SPACE_PRODUCTION_FIREBASE_PROJECT_ID`.
- `APP_ENV=staging` falha se o Supabase apontar para `SPACE_PRODUCTION_SUPABASE_URL`.
- `APP_ENV=staging` falha se o Asaas não estiver em sandbox.
- `APP_ENV=staging` falha se o n8n usar URL de produção.
- `APP_ENV=production` falha se usar referências marcadas como staging.

## Reset seguro

Existe um script de reset em `scripts/staging-reset.js` que:

- só aceita `APP_ENV=staging`;
- valida referências de ambiente antes de qualquer ação;
- oferece `--dry-run`;
- exige `--confirm`;
- preserva contas administrativas de teste;
- recusa execução caso detecte credenciais de produção;
- nesta fase permanece em modo seguro, sem execução automática em produção.

## Seed sintético

Existe um seed sintético em `scripts/staging-seed.js` com:

- alunos fictícios;
- professores fictícios;
- matrículas `active`, `notice`, `paused`, `ended`;
- pagador diferente do aluno;
- um pagador para dois alunos;
- contrato com dois itens;
- cobrança compartilhada;
- ex-aluno inadimplente;
- registros ambíguos de conciliação.

## Checklist manual

Ver `docs/staging/manual-checklist.md`.

## Fluxo definitivo de trabalho

1. Criar uma branch de teste a partir de `main`.
2. Fazer push da branch para o GitHub.
3. Aguardar a Vercel gerar uma Preview URL com as variáveis de ambiente Preview.
4. Abrir a Preview URL e confirmar o banner `AMBIENTE DE TESTE`.
5. Rodar o seed sintético em dry-run contra staging.
6. Executar o seed real somente após o dry-run confirmar `APP_ENV=staging`.
7. Validar que os dados fictícios aparecem apenas no Firebase/Supabase de staging.
8. Abrir PR/merge para `main` somente depois da validação.
9. Publicar produção a partir de `main` com `vercel --prod` manual enquanto o gatilho automático não estiver confiável.
