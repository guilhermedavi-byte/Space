const getNotFoundHtml = () => {
  return `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Space | Página não encontrada</title>
    <meta name="robots" content="noindex, nofollow" />
    <link rel="icon" href="/favicon.ico" sizes="any" />
    <link rel="icon" type="image/png" sizes="32x32" href="/assets/favicon-32.png" />
    <link rel="apple-touch-icon" href="/assets/apple-touch-icon.png" />
    <style>
      :root{color-scheme:dark}*{box-sizing:border-box}html,body{min-height:100%;margin:0}body{display:grid;place-items:stretch;background:#02040a;color:#fff;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;overflow:hidden}.space-404{position:relative;min-height:100vh;background:linear-gradient(90deg,rgba(2,4,10,.28),rgba(2,4,10,.02)),url("/assets/space-404.png") center/cover no-repeat}.space-404-actions{position:fixed;left:clamp(24px,6vw,96px);bottom:clamp(24px,6vw,72px);z-index:2;display:flex;flex-wrap:wrap;gap:12px}.space-404-button{display:inline-flex;align-items:center;justify-content:center;min-height:46px;padding:0 18px;border:1px solid rgba(255,255,255,.16);border-radius:999px;background:rgba(255,255,255,.08);box-shadow:0 18px 50px rgba(0,0,0,.25);color:#fff;font-size:14px;font-weight:900;letter-spacing:.02em;text-decoration:none;backdrop-filter:blur(14px)}.space-404-button.primary{border-color:#ff4d46;background:#ff4d46}.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}@media(max-width:760px){body{overflow:auto}.space-404{min-height:100svh;background-position:62% center}.space-404:after{content:"";position:absolute;inset:auto 0 0;height:34vh;background:linear-gradient(180deg,rgba(2,4,10,0),rgba(2,4,10,.92))}.space-404-actions{left:18px;right:18px;bottom:18px}.space-404-button{flex:1 1 150px}}
    </style>
  </head>
  <body>
    <main class="space-404" aria-labelledby="space-404-title">
      <h1 class="sr-only" id="space-404-title">Erro 404: página não encontrada</h1>
      <p class="sr-only">Parece que você saiu da órbita e essa página foi para outra galáxia.</p>
      <nav class="space-404-actions" aria-label="Ações da página não encontrada">
        <a class="space-404-button primary" href="/">Voltar para o início</a>
        <a class="space-404-button" href="/app">Ir para a plataforma</a>
      </nav>
    </main>
  </body>
</html>`;
};

const sendNotFoundPage = (res) => {
  res.statusCode = 404;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(getNotFoundHtml());
};

module.exports = {
  getNotFoundHtml,
  sendNotFoundPage,
};
