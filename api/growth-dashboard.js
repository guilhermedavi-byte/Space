const { getSessionFromRequest } = require("../_lib/session");

const sendRedirect = (res, location) => {
  res.statusCode = 302;
  res.setHeader("Location", location);
  res.setHeader("Cache-Control", "no-store");
  res.end("");
};

const safeJsonForHtml = (value) => {
  // Prevent `</script>` injection when embedding JSON in HTML.
  return JSON.stringify(value ?? {}).replace(/</g, "\\u003c");
};

const roleToBasePath = (role) => {
  const raw = String(role || "").trim().toLowerCase();
  if (raw === "growth") return "/growth/dashboard";
  if (raw === "teacher") return "/app/professor";
  if (raw === "admin") return "/app/admin";
  return "/app/aluno";
};

module.exports = async (req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    res.statusCode = 405;
    res.end("Method Not Allowed");
    return;
  }

  const session = getSessionFromRequest(req);
  if (!session) {
    sendRedirect(res, "/");
    return;
  }

  const user = {
    id: String(session.sub || ""),
    role: String(session.role || ""),
    name: String(session.name || ""),
    email: String(session.email || ""),
  };

  if (String(user.role || "").trim().toLowerCase() !== "growth") {
    sendRedirect(res, roleToBasePath(user.role));
    return;
  }

  const sessionJson = safeJsonForHtml(user);

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Space | Growth</title>
    <meta name="robots" content="noindex, nofollow" />
    <base href="/" />
    <link rel="stylesheet" href="/styles.css" />
  </head>
  <body data-view="interno" data-page="growth" data-sidebar-expanded="false">
    <div class="page-glow page-glow-left" aria-hidden="true"></div>
    <div class="page-glow page-glow-right" aria-hidden="true"></div>
    <script>
      window.__SPACE_SESSION__ = ${sessionJson};
    </script>

    <div class="platform-shell" data-view="interno">
      <aside class="platform-sidebar" aria-label="Navegação">
        <div class="sidebar-topbar">
          <button
            class="sidebar-toggle"
            type="button"
            data-sidebar-toggle
            aria-expanded="false"
            aria-label="Abrir barra lateral"
          >
            <span class="sidebar-toggle-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="m14.5 5.5-6 6 6 6"></path>
              </svg>
            </span>
          </button>
        </div>

        <div class="sidebar-brand">
          <img src="/assets/space-symbol.png" alt="Símbolo da Space" />
          <div class="sidebar-brand-copy">
            <strong>Space</strong>
            <span>Growth Console</span>
          </div>
        </div>

        <nav class="sidebar-nav" aria-label="Seções Growth">
          <a class="sidebar-link is-active" href="/growth/dashboard" title="Dashboard">
            <span class="sidebar-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <rect x="3.5" y="3.5" width="7" height="7" rx="1.5"></rect>
                <rect x="13.5" y="3.5" width="7" height="7" rx="1.5"></rect>
                <rect x="3.5" y="13.5" width="7" height="7" rx="1.5"></rect>
                <rect x="13.5" y="13.5" width="7" height="7" rx="1.5"></rect>
              </svg>
            </span>
            <span class="sidebar-text">Dashboard</span>
          </a>

          <button class="sidebar-link" type="button" data-growth-logout title="Sair">
            <span class="sidebar-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M10 7.5H6.8c-1.1 0-2 .9-2 2v7c0 1.1.9 2 2 2H10"></path>
                <path d="M15 16.5 19 12l-4-4.5"></path>
                <path d="M19 12H10"></path>
              </svg>
            </span>
            <span class="sidebar-text">Sair</span>
          </button>
        </nav>
      </aside>

      <main class="platform-main" aria-label="Painel Growth">
        <div class="growth-shell">
          <header class="growth-header">
            <div class="growth-head-left">
              <div class="growth-kicker">GROWTH</div>
              <h1 class="growth-headline">Dashboard Comercial</h1>
              <div class="growth-subhead">Gestão à vista do mês</div>
            </div>

            <div class="growth-head-right">
              <div class="growth-user" aria-label="Usuário logado">
                <div class="growth-user-name" data-growth-user-name></div>
                <div class="growth-user-role">Acesso Growth</div>
              </div>
            </div>
          </header>

          <section class="growth-grid growth-grid-kpis" aria-label="KPIs principais">
            <article class="growth-card growth-card-kpi">
              <div class="growth-label">Meta do mês</div>
              <div class="growth-value">R$ 80.000</div>
            </article>

            <article class="growth-card growth-card-kpi">
              <div class="growth-label">Realizado do mês</div>
              <div class="growth-value is-accent">R$ 52.400</div>
            </article>

            <article class="growth-card growth-card-kpi">
              <div class="growth-label">% de atingimento</div>
              <div class="growth-value">65,5%</div>
              <div class="growth-meter" aria-hidden="true">
                <span class="growth-meter-fill" style="--meter: 65.5%;"></span>
              </div>
            </article>

            <article class="growth-card growth-card-kpi">
              <div class="growth-label">Receita do mês</div>
              <div class="growth-value is-accent">R$ 52.400</div>
            </article>
          </section>

          <section class="growth-grid growth-grid-perf" aria-label="Performance do mês">
            <article class="growth-card growth-card-mini">
              <div class="growth-label">Total de vendas</div>
              <div class="growth-value-sm">38</div>
            </article>
            <article class="growth-card growth-card-mini">
              <div class="growth-label">Conversão</div>
              <div class="growth-value-sm">27%</div>
            </article>
            <article class="growth-card growth-card-mini">
              <div class="growth-label">Ticket médio</div>
              <div class="growth-value-sm">R$ 1.379</div>
            </article>
            <article class="growth-card growth-card-mini">
              <div class="growth-label">Forecast</div>
              <div class="growth-value-sm">R$ 74.000</div>
            </article>
          </section>

          <section class="growth-grid growth-grid-bottom" aria-label="Ranking e execução">
            <article class="growth-card growth-card-ranking">
              <div class="growth-card-head">
                <h2 class="growth-card-title">Ranking do time</h2>
                <div class="growth-chip">Mês atual</div>
              </div>

              <div class="growth-ranking">
                <div class="growth-ranking-head" aria-hidden="true">
                  <span>#</span>
                  <span>Vendedor</span>
                  <span>Vendas</span>
                  <span>Valor</span>
                </div>

                <ol class="growth-ranking-list">
                  <li class="growth-rank-item is-top">
                    <div class="growth-rank-pos">1</div>
                    <div class="growth-rank-name">Guilherme</div>
                    <div class="growth-rank-sales">14</div>
                    <div class="growth-rank-value">R$ 19.800</div>
                    <div class="growth-rank-bar" aria-hidden="true"><span style="--bar: 100%;"></span></div>
                  </li>
                  <li class="growth-rank-item">
                    <div class="growth-rank-pos">2</div>
                    <div class="growth-rank-name">Matheus</div>
                    <div class="growth-rank-sales">10</div>
                    <div class="growth-rank-value">R$ 14.300</div>
                    <div class="growth-rank-bar" aria-hidden="true"><span style="--bar: 72%;"></span></div>
                  </li>
                  <li class="growth-rank-item">
                    <div class="growth-rank-pos">3</div>
                    <div class="growth-rank-name">Ana</div>
                    <div class="growth-rank-sales">8</div>
                    <div class="growth-rank-value">R$ 10.900</div>
                    <div class="growth-rank-bar" aria-hidden="true"><span style="--bar: 55%;"></span></div>
                  </li>
                  <li class="growth-rank-item">
                    <div class="growth-rank-pos">4</div>
                    <div class="growth-rank-name">Giovana</div>
                    <div class="growth-rank-sales">6</div>
                    <div class="growth-rank-value">R$ 7.400</div>
                    <div class="growth-rank-bar" aria-hidden="true"><span style="--bar: 37%;"></span></div>
                  </li>
                </ol>
              </div>
            </article>

            <aside class="growth-card growth-card-exec">
              <div class="growth-card-head">
                <h2 class="growth-card-title">Execução do dia</h2>
              </div>

              <div class="growth-exec-grid">
                <div class="growth-exec-item">
                  <div class="growth-label">Reuniões hoje</div>
                  <div class="growth-value-sm">11</div>
                </div>
                <div class="growth-exec-item">
                  <div class="growth-label">Calls hoje</div>
                  <div class="growth-value-sm">47</div>
                </div>
                <div class="growth-exec-item is-wide">
                  <div class="growth-label">Última venda</div>
                  <div class="growth-value-sm">há 18 minutos</div>
                </div>
              </div>
            </aside>
          </section>
        </div>
      </main>
    </div>

    <script src="/growth.js" defer></script>
  </body>
</html>`;

  res.statusCode = 200;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(html);
};
