# ALIAS RESTORATION

Status: **PASS**.

- Alias: space-guilhermedavi-4547s-projects.vercel.app
- Target before: dpl_FQfqbSn1NpHR7GJf3ebxBoXN4QPv — removido, confirmado por HTTP 404 na API.
- Target after / expected deployment: dpl_8mdX14yQz9tLYvbntnB1NFFNMGZo.
- URL canônica obtida por inspeção da API antes da operação: space-ce0zvkois-guilhermedavi-4547s-projects.vercel.app.
- Deployment original: READY, projeto prj_FcxsR8A6rXLVIo2DArdAFDlm7pq8.
- Main domain unchanged: YES — plataforma.spaceschoolbr.com permaneceu em dpl_8mdX14yQz9tLYvbntnB1NFFNMGZo.
- Unrelated aliases changed: 0.
- Uma operação alias set executada, somente no alias autorizado.
- HTTP do alias secundário após restauração: 302; sem erro de deployment deletado. A confirmação do destino foi feita pela API, não inferida apenas do HTTP.

| Alias após restauração | Deployment |
|---|---|
| plataforma.spaceschoolbr.com | dpl_8mdX14yQz9tLYvbntnB1NFFNMGZo |
| space-git-main-guilhermedavi-4547s-projects.vercel.app | dpl_8mdX14yQz9tLYvbntnB1NFFNMGZo |
| space-guilhermedavi-4547s-projects.vercel.app | dpl_8mdX14yQz9tLYvbntnB1NFFNMGZo |
| space-three-sand.vercel.app | dpl_8mdX14yQz9tLYvbntnB1NFFNMGZo |

Verificação: 2026-09-15T02:46:39.436Z. A pendência de restauração do relatório anterior foi resolvida.

# ENV RUN

Comando: vercel env run -e production --scope team_QFoYBpP3YUXGD4agYHZ7I6jV -- node -e PROBE.

Projeto vinculado confirmado: prj_FcxsR8A6rXLVIo2DArdAFDlm7pq8. Exit code: 0.

| Variável | Present | NonEmpty | Usable |
|---|---|---|---|
| CRM_API_BASE_URL | true | false | NO |
| CRM_API_KEY | true | false | NO |
| GOOGLE_SERVICE_ACCOUNT_JSON | true | false | NO |

**vercel env run production sensitive vars usable = NO**

O probe removeu essas três variáveis do ambiente herdado antes de iniciar a CLI, evitando confundir valores locais com os entregues pelo env run. O comando foi passado em memória; nenhum script de probe ou arquivo env foi gravado. A saída da CLI foi capturada em memória e somente os booleanos esperados foram exibidos e persistidos. Nenhum valor, prefixo, sufixo, hash, comprimento, header ou payload bruto foi registrado.

- Service account parseable: N/D; validação não executada porque a variável estava vazia.
- Datacrazy auth: não executada; requisito de credenciais falhou.
- Firestore auth/read: não executados; requisito de credenciais falhou.
- Secrets exposed: NO.
- Env files created: 0.

A falha é de disponibilidade das credenciais nesta execução. Não se afirma que Datacrazy ou Firestore recusaram autenticação, pois não houve tentativa.

# CERTIFICATION

**NOT EXECUTED**.

O cenário 2 foi atendido: variáveis presentes, mas vazias. Gates B2–B4 e certificação completa interrompidos conforme solicitado. Julho, agosto, setembro, semana 09–15/09, closer, SDR e snapshots não receberam nova reconciliação. Nenhum valor histórico foi tratado como resultado atual.

# WRITES

- Firestore writes attempted = 0
- Datacrazy mutations attempted = 0
- Snapshot writes attempted = 0

Esses zeros descrevem as operações desta tarefa: nenhum cliente de dados foi iniciado e nenhuma chamada de escrita foi feita. Não são contadores de uma certificação executada. A única mutação remota foi a restauração autorizada do alias.

# CLEANUP

- Novos deployments: 0.
- Runners novos: 0.
- Backfill: não executado.
- Arquivos env: 0 criados.
- Probe efêmero: executado inline; nenhum arquivo para remover.
- Resultados locais: somente result.json e relatorio.md nesta pasta, sanitizados antes de persistir.

# VEREDITO

**APTO PARA DEPLOY DO CÓDIGO CORRIGIDO = NÃO**

A execução futura precisa ser redesenhada sem usar novamente o production target deste projeto. Nenhum novo mecanismo remoto foi criado nesta tarefa.
