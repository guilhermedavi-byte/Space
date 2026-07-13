# Checklist manual — criação dos projetos de staging

## Firebase staging

- [ ] Criar projeto Firebase separado
- [ ] Criar Firestore vazio
- [ ] Criar Firebase Auth staging
- [ ] Confirmar que o `projectId` é diferente de `plataforma-space`
- [ ] Criar contas administrativas exclusivamente de teste
- [ ] Aplicar regras e índices de staging separadamente
- [ ] Não importar dados reais

## Supabase staging

- [ ] Criar projeto Supabase separado
- [ ] Confirmar URL exclusiva
- [ ] Confirmar `anon key` e `service role` exclusivas
- [ ] Habilitar RLS por padrão
- [ ] Não copiar produção automaticamente
- [ ] Garantir service role apenas no backend

## Vercel staging

- [ ] Criar branch/deployment de staging
- [ ] Configurar domínio separado
- [ ] Configurar variáveis exclusivas
- [ ] Habilitar Deployment Protection / Password Protection
- [ ] Confirmar banner `AMBIENTE DE TESTE`
- [ ] Confirmar título prefixado com `[TESTE]`

## Asaas

- [ ] Usar apenas sandbox
- [ ] Não cadastrar chave real
- [ ] Confirmar mensagem de “sem cobrança real” no painel

## n8n

- [ ] Usar instância de staging ou URLs desativadas
- [ ] Confirmar que nenhum webhook aponta para produção
- [ ] Confirmar segredo próprio de staging

## Mensageria

- [ ] E-mail em modo mock ou allowlist
- [ ] WhatsApp em modo mock ou allowlist
- [ ] Telefonia/SMS em modo mock ou allowlist

## Reset

- [ ] Validar `APP_ENV=staging`
- [ ] Rodar `node scripts/staging-reset.js --dry-run`
- [ ] Confirmar relatório antes/depois
- [ ] Confirmar preservação das contas administrativas de teste
