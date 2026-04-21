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
      <div class="platform-backdrop" aria-hidden="true"></div>
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
        <div class="growth-v2" data-growth-dashboard>
          <header class="growth-v2-header" aria-label="Cabeçalho do dashboard Growth">
            <div class="growth-v2-head-left">
              <div class="growth-v2-eyebrow">GROWTH</div>
              <div class="growth-v2-title">Dashboard Comercial</div>
              <div class="growth-v2-subtitle" data-growth-month>Gestão à vista do mês · Abril 2026</div>
            </div>

            <div class="growth-v2-head-right" aria-label="Usuário logado">
              <div class="growth-v2-usercard">
                <div class="growth-v2-user-name" data-growth-user-name></div>
                <div class="growth-v2-user-role">Acesso Growth</div>
              </div>
              <div class="growth-v2-avatar" data-growth-avatar aria-label="Avatar do usuário">GR</div>
            </div>
          </header>

          <section class="growth-v2-section" aria-label="Resultado do mês">
            <div class="growth-v2-section-label">RESULTADO DO MÊS</div>

            <div class="growth-v2-grid growth-v2-grid-4">
              <article class="growth-v2-card">
                <div class="growth-v2-icon is-blue" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none">
                    <path d="M4 13.5h3l2.2-6.2 3.2 12.7 2.4-6.5H20"></path>
                  </svg>
                </div>
                <div class="growth-v2-card-label">Meta do mês</div>
                <div class="growth-v2-card-value" data-growth-kpi="meta">R$ 80.000</div>
              </article>

              <article class="growth-v2-card is-realizado">
                <div class="growth-v2-icon is-coral" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none">
                    <path d="M5 18V9"></path>
                    <path d="M10 18V6"></path>
                    <path d="M15 18v-7"></path>
                    <path d="M20 18V4"></path>
                  </svg>
                </div>
                <div class="growth-v2-card-label is-coral">Realizado</div>
                <div class="growth-v2-card-value is-coral" data-growth-kpi="realizado">R$ 52.400</div>
              </article>

              <article class="growth-v2-card">
                <div class="growth-v2-icon is-yellow" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="8"></circle>
                    <path d="M12 7v5l3 2"></path>
                  </svg>
                </div>
                <div class="growth-v2-card-label">% de atingimento</div>
                <div class="growth-v2-card-value" data-growth-kpi="atingimento">65,5%</div>
                <div class="growth-v2-progress" aria-hidden="true">
                  <span class="growth-v2-progress-fill" style="width: 65.5%"></span>
                </div>
              </article>

              <article class="growth-v2-card is-receita">
                <div class="growth-v2-icon is-green" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none">
                    <path d="M20 6 9 17l-5-5"></path>
                  </svg>
                </div>
                <div class="growth-v2-card-label is-green">Receita do mês</div>
                <div class="growth-v2-card-value is-green" data-growth-kpi="receita">R$ 52.400</div>
              </article>
            </div>
          </section>

          <section class="growth-v2-section" aria-label="Indicadores comerciais">
            <div class="growth-v2-section-label">INDICADORES COMERCIAIS</div>

            <div class="growth-v2-grid growth-v2-grid-4">
              <article class="growth-v2-card">
                <div class="growth-v2-icon is-blue" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none">
                    <rect x="4.5" y="6.5" width="15" height="13" rx="2"></rect>
                    <path d="M7.5 10h9"></path>
                    <path d="M7.5 13.5h6.5"></path>
                  </svg>
                </div>
                <div class="growth-v2-card-label">Total de vendas</div>
                <div class="growth-v2-card-value" data-growth-indicator="vendas">38</div>
                <div class="growth-v2-card-sub is-green">+12 vs mês anterior</div>
              </article>

              <article class="growth-v2-card">
                <div class="growth-v2-icon is-green" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none">
                    <path d="M7 14.5 11 10.5l3 3 5-5"></path>
                    <path d="M19 14.5v5H4.5V5h5"></path>
                  </svg>
                </div>
                <div class="growth-v2-card-label">Conversão</div>
                <div class="growth-v2-card-value" data-growth-indicator="conversao">27%</div>
                <div class="growth-v2-card-sub is-green">+3% vs mês anterior</div>
              </article>

              <article class="growth-v2-card">
                <div class="growth-v2-icon is-yellow" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none">
                    <path d="M8 8h8"></path>
                    <path d="M8 12h8"></path>
                    <path d="M8 16h6"></path>
                    <path d="M6 4.5h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-11a2 2 0 0 1 2-2Z"></path>
                  </svg>
                </div>
                <div class="growth-v2-card-label">Ticket médio</div>
                <div class="growth-v2-card-value" data-growth-indicator="ticket">R$ 1.379</div>
                <div class="growth-v2-card-sub">Plano médio: Gold</div>
              </article>

              <article class="growth-v2-card">
                <div class="growth-v2-icon is-yellow" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none">
                    <path d="M4.5 18.5V6.5"></path>
                    <path d="M4.5 6.5h15"></path>
                    <path d="M7.5 16 11 12.5l3 3 4-4"></path>
                  </svg>
                </div>
                <div class="growth-v2-card-label">Forecast</div>
                <div class="growth-v2-card-value" data-growth-indicator="forecast">R$ 74.000</div>
                <div class="growth-v2-card-sub is-yellow">Projeção de fechamento</div>
              </article>
            </div>
          </section>

          <section class="growth-v2-section" aria-label="Ranking e execução">
            <div class="growth-v2-two-col">
              <article class="growth-v2-card growth-v2-card-ranking" aria-label="Ranking do time">
                <div class="growth-v2-card-head">
                  <div class="growth-v2-card-title">Ranking do time</div>
                  <div class="growth-v2-pill is-coral">Mês atual</div>
                </div>

                <div class="growth-v2-table-head" aria-hidden="true">
                  <span>#</span>
                  <span>VENDEDOR</span>
                  <span>VENDAS</span>
                  <span>VALOR</span>
                </div>

                <div class="growth-v2-rank-list">
                  <div class="growth-v2-rank-row is-top">
                    <div class="growth-v2-rank-pos">1</div>
                    <div class="growth-v2-rank-vendor">
                      <span class="growth-v2-rank-avatar is-coral" aria-hidden="true">GD</span>
                      <span class="growth-v2-rank-name">Guilherme</span>
                    </div>
                    <div class="growth-v2-rank-sales">14</div>
                    <div class="growth-v2-rank-value">R$ 19.800</div>
                    <div class="growth-v2-rank-bar" aria-hidden="true"><span style="width: 100%"></span></div>
                  </div>

                  <div class="growth-v2-rank-row">
                    <div class="growth-v2-rank-pos">2</div>
                    <div class="growth-v2-rank-vendor">
                      <span class="growth-v2-rank-avatar is-blue" aria-hidden="true">MT</span>
                      <span class="growth-v2-rank-name">Matheus</span>
                    </div>
                    <div class="growth-v2-rank-sales">10</div>
                    <div class="growth-v2-rank-value">R$ 14.300</div>
                    <div class="growth-v2-rank-bar" aria-hidden="true"><span class="is-blue" style="width: 72%"></span></div>
                  </div>

                  <div class="growth-v2-rank-row">
                    <div class="growth-v2-rank-pos">3</div>
                    <div class="growth-v2-rank-vendor">
                      <span class="growth-v2-rank-avatar is-green" aria-hidden="true">AN</span>
                      <span class="growth-v2-rank-name">Ana</span>
                    </div>
                    <div class="growth-v2-rank-sales">8</div>
                    <div class="growth-v2-rank-value">R$ 10.900</div>
                    <div class="growth-v2-rank-bar" aria-hidden="true"><span class="is-green" style="width: 55%"></span></div>
                  </div>

                  <div class="growth-v2-rank-row">
                    <div class="growth-v2-rank-pos">4</div>
                    <div class="growth-v2-rank-vendor">
                      <span class="growth-v2-rank-avatar is-yellow" aria-hidden="true">GI</span>
                      <span class="growth-v2-rank-name">Giovana</span>
                    </div>
                    <div class="growth-v2-rank-sales">6</div>
                    <div class="growth-v2-rank-value">R$ 7.400</div>
                    <div class="growth-v2-rank-bar" aria-hidden="true"><span class="is-yellow" style="width: 37%"></span></div>
                  </div>
                </div>
              </article>

              <div class="growth-v2-stack">
                <article class="growth-v2-card" aria-label="Execução do dia">
                  <div class="growth-v2-card-head">
                    <div class="growth-v2-card-title">Execução do dia</div>
                  </div>

                  <div class="growth-v2-exec-grid">
                    <div class="growth-v2-mini-card">
                      <div class="growth-v2-mini-label">REUNIÕES HOJE</div>
                      <div class="growth-v2-mini-value">11</div>
                    </div>
                    <div class="growth-v2-mini-card">
                      <div class="growth-v2-mini-label">CALLS HOJE</div>
                      <div class="growth-v2-mini-value">47</div>
                    </div>
                  </div>

                  <div class="growth-v2-last-sale">
                    <div class="growth-v2-mini-label">ÚLTIMA VENDA</div>
                    <div class="growth-v2-last-value">há 18 minutos</div>
                    <div class="growth-v2-last-sub">Plano Diamond · R$ 2.400</div>
                  </div>
                </article>

                <article class="growth-v2-card" aria-label="Leads pendentes">
                  <div class="growth-v2-card-head">
                    <div class="growth-v2-card-title">Leads pendentes</div>
                    <div class="growth-v2-pill is-danger">12</div>
                  </div>

                  <div class="growth-v2-leads">
                    <button class="growth-v2-lead-row is-danger" type="button">
                      <div>
                        <div class="growth-v2-lead-title">5 sem contato há +48h</div>
                        <div class="growth-v2-lead-sub">Requer ação urgente</div>
                      </div>
                      <span class="growth-v2-chevron" aria-hidden="true">
                        <svg viewBox="0 0 24 24" fill="none">
                          <path d="M9.5 7.5 14 12l-4.5 4.5"></path>
                        </svg>
                      </span>
                    </button>

                    <button class="growth-v2-lead-row is-warn" type="button">
                      <div>
                        <div class="growth-v2-lead-title">7 em negociação</div>
                        <div class="growth-v2-lead-sub">Follow-up programado</div>
                      </div>
                      <span class="growth-v2-chevron" aria-hidden="true">
                        <svg viewBox="0 0 24 24" fill="none">
                          <path d="M9.5 7.5 14 12l-4.5 4.5"></path>
                        </svg>
                      </span>
                    </button>
                  </div>
                </article>
              </div>
            </div>
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
