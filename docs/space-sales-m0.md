# Space Sales Intelligence — M0

## Execução local

1. Copie `.env.example` para `.env.local` e preencha as três variáveis da seção Space Sales Intelligence.
2. Execute `npm install`.
3. Execute `npm run dev` e abra `http://localhost:3000/dashboard`.
4. Verifique `GET /health`; `environment` informa se a configuração server-side está completa sem revelar valores.

## Limites deste milestone

M0 contém somente o shell de engenharia e páginas placeholder. Não consulta tabelas de inteligência, não chama workflows n8n, não cria schemas e não implementa funcionalidades de M1 ou posteriores. A camada de banco é server-only e valida a configuração somente quando usada, permitindo builds herméticos sem secrets.
