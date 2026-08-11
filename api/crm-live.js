const { getSessionFromRequest } = require("../_lib/session");
const {
  buildCookie,
  buildCrmLiveReadCookie,
  clearCookie,
  validateEntryToken,
  validateCookieViewer,
  isSecureRequest,
  CRM_LIVE_COOKIE_NAME,
} = require("./_lib/crm-live");

const normalizeRole = (value) => {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "admin" || raw === "administrador") return "admin";
  if (raw === "growth") return "growth";
  return "";
};

const formatMoneyShort = (value) => {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount)) return "R$ 0";
  const abs = Math.abs(amount);
  if (abs >= 1_000_000) return `R$ ${(amount / 1_000_000).toFixed(1).replace(".", ",")}M`;
  if (abs >= 1_000) return `R$ ${(amount / 1_000).toFixed(1).replace(".", ",")}k`;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(amount);
};

const sendRedirect = (res, location, cookie) => {
  res.statusCode = 302;
  if (cookie) res.setHeader("Set-Cookie", cookie);
  res.setHeader("Location", location);
  res.setHeader("Cache-Control", "no-store");
  res.end("");
};

const buildHtml = () => `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>CRM Live | Space</title>
    <meta name="robots" content="noindex,nofollow" />
    <style>
      :root {
        color-scheme: dark;
        --bg: #07101d;
        --card: rgba(17, 28, 46, 0.9);
        --card-soft: rgba(255,255,255,0.04);
        --stroke: rgba(255,255,255,0.08);
        --text: #f7f3ed;
        --muted: rgba(247,243,237,0.64);
        --accent: #ff5b4d;
        --accent-soft: rgba(255,91,77,0.16);
        --blue: #76a7ff;
        --green: #3fd6a4;
        --amber: #f5b64b;
      }
      * { box-sizing: border-box; }
      html, body { margin: 0; min-height: 100%; background: radial-gradient(circle at top left, rgba(255,91,77,0.18), transparent 32%), radial-gradient(circle at top right, rgba(118,167,255,0.18), transparent 30%), var(--bg); color: var(--text); font-family: Inter, ui-sans-serif, system-ui, sans-serif; overflow: hidden; }
      body { display: grid; place-items: stretch; }
      .crm-live { position: relative; width: 100vw; height: 100vh; padding: 48px; }
      .crm-live-stage { position: relative; width: 100%; height: 100%; border-radius: 32px; border: 1px solid var(--stroke); background: linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.015)); overflow: hidden; }
      .crm-live-screen { position: absolute; inset: 0; padding: 42px 48px; display: grid; gap: 28px; opacity: 0; transform: translateY(14px); pointer-events: none; transition: opacity .45s ease, transform .45s ease; }
      .crm-live-screen.is-active { opacity: 1; transform: translateY(0); pointer-events: auto; }
      .crm-live-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 24px; }
      .crm-live-title { font-size: clamp(26px, 2vw, 36px); line-height: 1; font-weight: 700; letter-spacing: -.03em; }
      .crm-live-sub { margin-top: 10px; font-size: clamp(16px, 1.2vw, 22px); color: var(--muted); }
      .crm-live-badge { display: inline-flex; align-items: center; gap: 10px; padding: 12px 16px; border-radius: 999px; background: var(--card-soft); color: var(--muted); font-size: 14px; }
      .crm-live-badge-dot { width: 10px; height: 10px; border-radius: 999px; background: var(--green); box-shadow: 0 0 0 6px rgba(63,214,164,.12); }
      .crm-live-badge.is-stale .crm-live-badge-dot { background: var(--amber); box-shadow: 0 0 0 6px rgba(245,182,75,.12); }
      .crm-live-hero { display: grid; grid-template-columns: 1.4fr .8fr; gap: 24px; min-height: 0; }
      .crm-live-card { background: var(--card); border: 1px solid var(--stroke); border-radius: 28px; padding: 28px; box-shadow: 0 20px 50px rgba(0,0,0,.16); }
      .crm-live-label { font-size: 16px; letter-spacing: .16em; text-transform: uppercase; color: var(--muted); }
      .crm-live-value { margin-top: 14px; font-size: clamp(64px, 6vw, 108px); line-height: .92; font-weight: 800; letter-spacing: -.06em; }
      .crm-live-meta { display: flex; gap: 18px; flex-wrap: wrap; align-items: center; margin-top: 18px; font-size: clamp(18px, 1.4vw, 24px); color: var(--muted); }
      .crm-live-progress { margin-top: 24px; height: 18px; border-radius: 999px; background: rgba(255,255,255,.08); overflow: hidden; }
      .crm-live-progress > span { display: block; height: 100%; background: linear-gradient(90deg, var(--accent), #ff8666); border-radius: inherit; }
      .crm-live-grid-two { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 22px; }
      .crm-live-kpi-big { font-size: clamp(44px, 4vw, 72px); line-height: .95; font-weight: 800; margin-top: 10px; }
      .crm-live-kpi-sub { margin-top: 10px; font-size: clamp(16px, 1.2vw, 22px); color: var(--muted); }
      .crm-live-ranking { display: grid; gap: 16px; }
      .crm-live-row { display: grid; grid-template-columns: 72px 1fr auto; gap: 18px; align-items: center; padding: 18px 20px; border-radius: 22px; background: rgba(255,255,255,.035); border: 1px solid rgba(255,255,255,.05); }
      .crm-live-row-pos { font-size: 32px; font-weight: 800; color: var(--muted); text-align: center; }
      .crm-live-row-name { font-size: clamp(26px, 2vw, 38px); font-weight: 700; letter-spacing: -.03em; }
      .crm-live-row-sub { margin-top: 6px; font-size: clamp(16px, 1.1vw, 20px); color: var(--muted); }
      .crm-live-row-main { text-align: right; }
      .crm-live-row-value { font-size: clamp(30px, 2.4vw, 46px); font-weight: 800; }
      .crm-live-row-pct { margin-top: 6px; font-size: clamp(16px, 1.1vw, 20px); color: var(--muted); }
      .crm-live-highlight-grid { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 24px; }
      .crm-live-highlight-name { margin-top: 14px; font-size: clamp(32px, 2.5vw, 46px); font-weight: 800; }
      .crm-live-highlight-value { margin-top: 14px; font-size: clamp(52px, 4vw, 80px); line-height: .95; font-weight: 800; }
      .crm-live-last-sale { display: grid; grid-template-columns: 1.2fr .8fr; gap: 24px; align-items: stretch; }
      .crm-live-last-sale-name { margin-top: 18px; font-size: clamp(40px, 3vw, 60px); line-height: .95; font-weight: 800; }
      .crm-live-list { display: grid; gap: 14px; }
      .crm-live-list-row { display: flex; justify-content: space-between; gap: 18px; padding: 16px 0; border-bottom: 1px solid rgba(255,255,255,.06); font-size: clamp(18px,1.3vw,24px); }
      .crm-live-footer { position: absolute; left: 48px; right: 48px; bottom: 24px; display: flex; justify-content: space-between; align-items: center; gap: 20px; font-size: 15px; color: var(--muted); }
      .crm-live-dots { display: flex; gap: 10px; align-items: center; }
      .crm-live-dot { width: 10px; height: 10px; border-radius: 999px; background: rgba(255,255,255,.2); transition: transform .25s ease, background .25s ease; }
      .crm-live-dot.is-active { background: var(--accent); transform: scale(1.35); }
      .crm-live-empty { display: grid; place-items: center; text-align: center; font-size: clamp(22px, 1.8vw, 30px); color: var(--muted); }
      @media (max-width: 980px) {
        .crm-live { padding: 22px; }
        .crm-live-screen { padding: 28px; }
        .crm-live-hero, .crm-live-highlight-grid, .crm-live-last-sale, .crm-live-grid-two { grid-template-columns: 1fr; }
      }
    </style>
  </head>
  <body>
    <div class="crm-live">
      <div class="crm-live-stage" data-crm-live-root>
        <div class="crm-live-empty" data-crm-live-empty>Carregando CRM Live…</div>
      </div>
      <div class="crm-live-footer">
        <div data-crm-live-status>Atualizando…</div>
        <div class="crm-live-dots" data-crm-live-dots></div>
      </div>
    </div>
    <script>
      (() => {
        const root = document.querySelector('[data-crm-live-root]');
        const statusEl = document.querySelector('[data-crm-live-status]');
        const dotsEl = document.querySelector('[data-crm-live-dots]');
        const emptyEl = document.querySelector('[data-crm-live-empty]');
        const SCREENS = ['month','week','closers','sdrs','highlights','last-sale'];
        const ROTATE_MS = 5000;
        const POLL_MS = 120000;
        let payload = null;
        let active = 0;
        let rotateTimer = null;
        let pollTimer = null;

        const escapeHtml = (value) => String(value == null ? '' : value)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/\"/g, '&quot;')
          .replace(/'/g, '&#39;');

        const moneyShort = (value) => ${formatMoneyShort.toString()}(value);
        const percent = (value) => {
          const n = Number(value || 0);
          if (!Number.isFinite(n)) return '0%';
          return n.toFixed(1).replace('.', ',') + '%';
        };
        const dateLabel = (dateKey) => {
          const raw = String(dateKey || '');
          const [y,m,d] = raw.split('-');
          if (!y || !m || !d) return raw;
          return d + '/' + m;
        };
        const dateTimeLabel = (iso) => {
          if (!iso) return '—';
          try {
            return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
          } catch { return '—'; }
        };
        const safeArray = (value) => Array.isArray(value) ? value : [];

        const renderDots = () => {
          dotsEl.innerHTML = SCREENS.map((_, index) => '<span class=\"crm-live-dot ' + (index === active ? 'is-active' : '') + '\"></span>').join('');
        };

        const rowHtml = (row, index, formatter) => {
          const extra = formatter(row);
          return '<div class=\"crm-live-row\">' +
            '<div class=\"crm-live-row-pos\">' + String(index + 1) + '</div>' +
            '<div><div class=\"crm-live-row-name\">' + escapeHtml(row.displayName || '—') + '</div><div class=\"crm-live-row-sub\">Meta ' + escapeHtml(extra.target) + ' · Realizado ' + escapeHtml(extra.actual) + '</div></div>' +
            '<div class=\"crm-live-row-main\"><div class=\"crm-live-row-value\">' + escapeHtml(extra.main) + '</div><div class=\"crm-live-row-pct\">' + escapeHtml(percent(row.progressPct || 0)) + '</div></div>' +
          '</div>';
        };

        const render = () => {
          if (!payload) return;
          const month = payload.month || {};
          const weekly = payload.weekly || {};
          const highlight = payload.highlights || {};
          const latestSale = payload.latestSale || null;
          const screens = {
            month: '<section class=\"crm-live-screen\"><div class=\"crm-live-head\"><div><div class=\"crm-live-title\">Placar do mês</div><div class=\"crm-live-sub\">Janela ' + escapeHtml(dateLabel(month.period?.startDateKey)) + ' → ' + escapeHtml(dateLabel(month.period?.endDateKey)) + '</div></div><div class=\"crm-live-badge ' + (payload.stale ? 'is-stale' : '') + '\"><span class=\"crm-live-badge-dot\"></span>' + (payload.stale ? 'Cache ' + escapeHtml(String(payload.staleAgeMinutes || 0)) + ' min' : 'Ao vivo') + '</div></div><div class=\"crm-live-hero\"><article class=\"crm-live-card\"><div class=\"crm-live-label\">Receita vendida</div><div class=\"crm-live-value\">' + escapeHtml(moneyShort(month.summary?.realizado || 0)) + '</div><div class=\"crm-live-meta\"><span>Meta ' + escapeHtml(moneyShort(month.summary?.meta || 0)) + '</span><span>' + escapeHtml(percent(month.summary?.percentAtingimento || 0)) + '</span><span>Gap ' + escapeHtml(moneyShort(month.summary?.gap || 0)) + '</span></div><div class=\"crm-live-progress\"><span style=\"width:' + Math.max(0, Math.min(100, Number(month.summary?.percentAtingimento || 0))).toFixed(1) + '%\"></span></div></article><article class=\"crm-live-card\"><div class=\"crm-live-label\">Fechamentos do mês</div><div class=\"crm-live-kpi-big\">' + escapeHtml(String(month.summary?.totalVendas || 0)) + '</div><div class=\"crm-live-kpi-sub\">' + escapeHtml(String(month.windowCount || 0)) + ' movimentações lidas na janela</div><div class=\"crm-live-kpi-sub\">Cache CRM: ' + escapeHtml(String(payload.cacheDebug?.crm?.pages || 0)) + ' páginas · ' + escapeHtml(String(payload.cacheDebug?.crm?.totalFetched || 0)) + ' negócios</div></article></div></section>',
            week: '<section class=\"crm-live-screen\"><div class=\"crm-live-head\"><div><div class=\"crm-live-title\">Meta da semana</div><div class=\"crm-live-sub\">Semana comercial ' + escapeHtml(dateLabel(weekly.commercialWeek?.startDateKey)) + ' → ' + escapeHtml(dateLabel(weekly.commercialWeek?.endDateKey)) + '</div></div><div class=\"crm-live-badge\"><span class=\"crm-live-badge-dot\"></span>Time</div></div><div class=\"crm-live-grid-two\"><article class=\"crm-live-card\"><div class=\"crm-live-label\">Closers</div><div class=\"crm-live-kpi-big\">' + escapeHtml(moneyShort(weekly.team?.closers?.actualValue || 0)) + '</div><div class=\"crm-live-kpi-sub\">Meta ' + escapeHtml(moneyShort(weekly.team?.closers?.targetValue || 0)) + ' · ' + escapeHtml(percent(weekly.team?.closers?.progressPct || 0)) + '</div><div class=\"crm-live-progress\"><span style=\"width:' + Math.max(0, Math.min(100, Number(weekly.team?.closers?.progressPct || 0))).toFixed(1) + '%\"></span></div></article><article class=\"crm-live-card\"><div class=\"crm-live-label\">SDRs</div><div class=\"crm-live-kpi-big\">' + escapeHtml(String(weekly.team?.sdrs?.actualValue || 0)) + '</div><div class=\"crm-live-kpi-sub\">Meta ' + escapeHtml(String(weekly.team?.sdrs?.targetValue || 0)) + ' reuniões · ' + escapeHtml(percent(weekly.team?.sdrs?.progressPct || 0)) + '</div><div class=\"crm-live-progress\"><span style=\"width:' + Math.max(0, Math.min(100, Number(weekly.team?.sdrs?.progressPct || 0))).toFixed(1) + '%\"></span></div></article></div></section>',
            closers: '<section class=\"crm-live-screen\"><div class=\"crm-live-head\"><div><div class=\"crm-live-title\">Ranking dos closers</div><div class=\"crm-live-sub\">Ordenado por % da meta individual da semana</div></div><div class=\"crm-live-badge\"><span class=\"crm-live-badge-dot\"></span>' + escapeHtml(String(safeArray(weekly.closers).length)) + ' participantes</div></div><div class=\"crm-live-ranking\">' + (safeArray(weekly.closers).length ? safeArray(weekly.closers).map((row, index) => rowHtml(row, index, (entry) => ({ target: moneyShort(entry.targetValue || 0), actual: moneyShort(entry.actualValue || 0), main: moneyShort(entry.actualValue || 0) }))).join('') : '<div class=\"crm-live-card crm-live-empty\">Nenhum closer com meta nesta semana.</div>') + '</div></section>',
            sdrs: '<section class=\"crm-live-screen\"><div class=\"crm-live-head\"><div><div class=\"crm-live-title\">Ranking dos SDRs</div><div class=\"crm-live-sub\">Ordenado por % da meta individual da semana</div></div><div class=\"crm-live-badge\"><span class=\"crm-live-badge-dot\"></span>' + escapeHtml(String(safeArray(weekly.sdrs).length)) + ' participantes</div></div><div class=\"crm-live-ranking\">' + (safeArray(weekly.sdrs).length ? safeArray(weekly.sdrs).map((row, index) => rowHtml(row, index, (entry) => ({ target: String(entry.targetValue || 0) + ' reuniões', actual: String(entry.actualValue || 0) + ' feitas', main: String(entry.actualValue || 0) }))).join('') : '<div class=\"crm-live-card crm-live-empty\">Nenhum SDR com meta nesta semana.</div>') + '</div></section>',
            highlights: '<section class=\"crm-live-screen\"><div class=\"crm-live-head\"><div><div class=\"crm-live-title\">Destaque do dia anterior</div><div class=\"crm-live-sub\">Quem mais avançou na meta em ' + escapeHtml(dateLabel(highlight.dayKey)) + '</div></div><div class=\"crm-live-badge\"><span class=\"crm-live-badge-dot\"></span>' + escapeHtml(highlight.dayKey || '') + '</div></div><div class=\"crm-live-highlight-grid\"><article class=\"crm-live-card\"><div class=\"crm-live-label\">Closer</div><div class=\"crm-live-highlight-name\">' + escapeHtml(highlight.closer?.displayName || 'Sem destaque') + '</div><div class=\"crm-live-highlight-value\">' + escapeHtml(highlight.closer ? moneyShort(highlight.closer.dailyValue || 0) : '—') + '</div><div class=\"crm-live-kpi-sub\">' + escapeHtml(highlight.closer ? percent(highlight.closer.dailyProgressPct || 0) + ' da meta semanal em um dia' : 'Nenhum fechamento ontem') + '</div></article><article class=\"crm-live-card\"><div class=\"crm-live-label\">SDR</div><div class=\"crm-live-highlight-name\">' + escapeHtml(highlight.sdr?.displayName || 'Sem destaque') + '</div><div class=\"crm-live-highlight-value\">' + escapeHtml(highlight.sdr ? String(highlight.sdr.dailyValue || 0) : '—') + '</div><div class=\"crm-live-kpi-sub\">' + escapeHtml(highlight.sdr ? percent(highlight.sdr.dailyProgressPct || 0) + ' da meta semanal em um dia' : 'Nenhuma reunião feita ontem') + '</div></article></div></section>',
            'last-sale': '<section class=\"crm-live-screen\"><div class=\"crm-live-head\"><div><div class=\"crm-live-title\">Última venda</div><div class=\"crm-live-sub\">Movimento mais recente do mês comercial</div></div><div class=\"crm-live-badge\"><span class=\"crm-live-badge-dot\"></span>' + escapeHtml(latestSale?.closer || 'Sem closer') + '</div></div><div class=\"crm-live-last-sale\">' + (latestSale ? '<article class=\"crm-live-card\"><div class=\"crm-live-label\">Cliente</div><div class=\"crm-live-last-sale-name\">' + escapeHtml(latestSale.cliente || '—') + '</div><div class=\"crm-live-meta\"><span>Plano ' + escapeHtml(latestSale.plano || '—') + '</span><span>' + escapeHtml(dateTimeLabel(latestSale.when)) + '</span></div></article><article class=\"crm-live-card\"><div class=\"crm-live-label\">Valor</div><div class=\"crm-live-value\" style=\"font-size:clamp(56px,5vw,88px)\">' + escapeHtml(moneyShort(latestSale.valor || 0)) + '</div><div class=\"crm-live-list\"><div class=\"crm-live-list-row\"><span>Closer</span><strong>' + escapeHtml(latestSale.closer || '—') + '</strong></div><div class=\"crm-live-list-row\"><span>Quando</span><strong>' + escapeHtml(dateTimeLabel(latestSale.when)) + '</strong></div></div></article>' : '<div class=\"crm-live-card crm-live-empty\">Nenhuma venda fechada na janela atual.</div>') + '</div></section>',
          };
          root.innerHTML = SCREENS.map((key, index) => screens[key].replace('<section class=\"crm-live-screen\"', '<section class=\"crm-live-screen ' + (index === active ? 'is-active' : '') + '\"')).join('');
          renderDots();
          emptyEl?.remove();
        };

        const setStatus = (text) => { if (statusEl) statusEl.textContent = text; };

        const rotate = () => {
          if (!payload) return;
          active = (active + 1) % SCREENS.length;
          render();
        };

        const scheduleRotation = () => {
          if (rotateTimer) clearInterval(rotateTimer);
          rotateTimer = setInterval(rotate, ROTATE_MS);
        };

        const saveLastGood = (data) => {
          try { localStorage.setItem('crmLive:lastGood', JSON.stringify(data)); } catch {}
        };
        const loadLastGood = () => {
          try {
            const raw = localStorage.getItem('crmLive:lastGood');
            return raw ? JSON.parse(raw) : null;
          } catch { return null; }
        };

        const loadData = async () => {
          try {
            const res = await fetch('/api/crm-live-data', { credentials: 'include', cache: 'no-store' });
            const data = await res.json().catch(() => null);
            if (!res.ok || !data) throw new Error('crm_live_fetch_failed');
            payload = data;
            saveLastGood(data);
            render();
            scheduleRotation();
            setStatus(data.stale ? 'Exibindo último snapshot útil · ' + String(data.staleAgeMinutes || 0) + ' min' : 'Atualizado ' + dateTimeLabel(data.generatedAt));
          } catch (error) {
            const fallback = loadLastGood();
            if (fallback) {
              payload = fallback;
              render();
              scheduleRotation();
              setStatus('Sem atualização nova · mantendo última tela boa');
              return;
            }
            setStatus('Aguardando primeiro snapshot');
          }
        };

        loadData();
        pollTimer = setInterval(loadData, POLL_MS);
        document.addEventListener('visibilitychange', () => {
          if (!document.hidden) loadData();
        });
      })();
    </script>
  </body>
</html>`;

module.exports = async (req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    res.statusCode = 405;
    res.end("Method Not Allowed");
    return;
  }

  const host = String(req.headers.host || "localhost");
  const url = new URL(req.url || "/tv/crm-live", `https://${host}`);
  const token = String(url.searchParams.get("token") || "").trim();
  const secure = isSecureRequest(req);

  if (token) {
    const result = await validateEntryToken(token);
    if (!result.ok) {
      res.statusCode = result.status || 401;
      res.setHeader("Set-Cookie", clearCookie({ secure }));
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.end("Token inválido ou revogado.");
      return;
    }
    const cookieToken = buildCrmLiveReadCookie({ tokenId: result.tokenId });
    sendRedirect(res, "/tv/crm-live", buildCookie(CRM_LIVE_COOKIE_NAME, cookieToken, { secure }));
    return;
  }

  const session = getSessionFromRequest(req);
  const role = normalizeRole(session?.role);
  const cookieViewer = role === "admin" || role === "growth" ? { ok: true } : await validateCookieViewer(req);
  if (!cookieViewer?.ok) {
    res.statusCode = 401;
    res.setHeader("Set-Cookie", clearCookie({ secure }));
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.end("Acesso CRM Live não autorizado.");
    return;
  }

  res.statusCode = 200;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(buildHtml());
};
