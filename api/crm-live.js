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
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500&display=swap" rel="stylesheet" />
    <style>
      :root {
        color-scheme: dark;
        --bg: #0d1014;
        --accent: #ff564f;
        --text: #f5f5f4;
        --text-secondary: #a8a8a4;
        --text-tertiary: #6b7280;
        --track: #1c2027;
        --row: rgba(255,255,255,.03);
        --leader-ring: rgba(255, 86, 79, .28);
      }
      * { box-sizing: border-box; }
      html, body {
        margin: 0;
        width: 100%;
        min-height: 100%;
        overflow: hidden;
        background: var(--bg);
        color: var(--text);
        font-family: "Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif;
      }
      body { display: block; }
      .crm-live {
        position: relative;
        width: 100vw;
        height: 100vh;
        padding: 5.4vh 4.4vw 4.4vh;
        background:
          radial-gradient(circle at top left, rgba(255,86,79,.14), transparent 28%),
          radial-gradient(circle at 78% 18%, rgba(255,255,255,.04), transparent 26%),
          var(--bg);
      }
      .crm-live-stage {
        position: relative;
        width: 100%;
        height: 100%;
        overflow: hidden;
      }
      .crm-live-screen {
        position: absolute;
        inset: 0;
        display: grid;
        grid-template-rows: auto 1fr;
        gap: 3.2vh;
        opacity: 0;
        pointer-events: none;
        transition: opacity .4s ease;
      }
      .crm-live-screen.is-active {
        opacity: 1;
        pointer-events: auto;
      }
      .crm-live-shell {
        width: 100%;
        height: 100%;
        display: grid;
        grid-template-rows: auto 1fr;
        gap: 3.2vh;
      }
      .crm-live-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 3vw;
      }
      .crm-live-kicker {
        margin: 0 0 1.2vh;
        color: var(--text-tertiary);
        font-size: 1.35vh;
        line-height: 1;
        letter-spacing: .34em;
        text-transform: uppercase;
        font-weight: 500;
      }
      .crm-live-title {
        margin: 0;
        font-size: 4.2vh;
        line-height: .98;
        letter-spacing: -.04em;
        font-weight: 500;
      }
      .crm-live-sub {
        margin-top: 1.2vh;
        color: var(--text-secondary);
        font-size: 1.9vh;
        line-height: 1.35;
        font-weight: 400;
      }
      .crm-live-status-pill {
        display: inline-flex;
        align-items: center;
        gap: .75vw;
        min-height: 3.8vh;
        color: var(--text-secondary);
        font-size: 1.45vh;
        line-height: 1;
        white-space: nowrap;
      }
      .crm-live-status-pill::before {
        content: "";
        width: .7vh;
        height: .7vh;
        border-radius: 999px;
        background: var(--text-tertiary);
      }
      .crm-live-status-pill.is-live::before { background: var(--accent); }
      .crm-live-status-pill.is-stale::before { background: #f59e0b; }
      .crm-live-body {
        min-height: 0;
        display: grid;
      }
      .crm-live-stack {
        height: 100%;
        display: grid;
        align-content: space-between;
        gap: 3vh;
      }
      .crm-live-metric-block { display: grid; gap: 1.5vh; }
      .crm-live-metric-label {
        color: var(--text-tertiary);
        font-size: 1.45vh;
        letter-spacing: .28em;
        text-transform: uppercase;
        font-weight: 500;
      }
      .crm-live-metric-line {
        display: flex;
        align-items: flex-end;
        gap: 1.4vw;
        flex-wrap: wrap;
      }
      .crm-live-metric-value {
        font-size: min(12vw, 18vh);
        line-height: .88;
        letter-spacing: -.08em;
        font-weight: 500;
      }
      .crm-live-metric-value.is-medium { font-size: min(8vw, 11.6vh); }
      .crm-live-metric-side {
        display: grid;
        gap: .55vh;
        padding-bottom: 1.1vh;
      }
      .crm-live-metric-side strong {
        color: var(--text-secondary);
        font-size: 2.1vh;
        font-weight: 500;
      }
      .crm-live-metric-side span {
        color: var(--text-tertiary);
        font-size: 1.6vh;
        font-weight: 400;
      }
      .crm-live-progress {
        width: min(72vw, 100%);
        height: .7vh;
        border-radius: 999px;
        background: var(--track);
        overflow: hidden;
      }
      .crm-live-progress > span {
        display: block;
        height: 100%;
        width: 0;
        border-radius: inherit;
        background: var(--accent);
      }
      .crm-live-support-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 2.2vw;
      }
      .crm-live-support-item { display: grid; gap: .8vh; }
      .crm-live-support-item strong {
        font-size: 3.4vh;
        line-height: .95;
        letter-spacing: -.05em;
        font-weight: 500;
      }
      .crm-live-support-item span {
        color: var(--text-secondary);
        font-size: 1.7vh;
        line-height: 1.35;
        font-weight: 400;
      }
      .crm-live-week-grid,
      .crm-live-highlight-grid,
      .crm-live-last-sale-grid {
        height: 100%;
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 3vw;
      }
      .crm-live-column {
        height: 100%;
        display: grid;
        align-content: center;
        gap: 2vh;
        min-width: 0;
      }
      .crm-live-column-right {
        justify-items: end;
        text-align: right;
      }
      .crm-live-column-right .crm-live-progress { justify-self: end; }
      .crm-live-mini-note {
        color: var(--text-secondary);
        font-size: 1.8vh;
        line-height: 1.35;
        font-weight: 400;
      }
      .crm-live-ranking {
        height: 100%;
        display: grid;
        gap: 2vh;
        align-content: start;
      }
      .crm-live-ranking-row {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr) auto;
        align-items: center;
        gap: 1.6vw;
        min-height: 10.5vh;
      }
      .crm-live-ranking-row.is-leader { min-height: 13.8vh; }
      .crm-live-avatar {
        position: relative;
        flex: 0 0 auto;
        width: 5.6vh;
        height: 5.6vh;
        border-radius: 999px;
        overflow: hidden;
        background: rgba(255,255,255,.08);
        color: var(--text);
        display: grid;
        place-items: center;
        font-size: 1.55vh;
        font-weight: 500;
        letter-spacing: .04em;
      }
      .crm-live-avatar img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }
      .crm-live-avatar.is-photo { filter: grayscale(1); }
      .crm-live-avatar.is-leader {
        width: 7.6vh;
        height: 7.6vh;
        border: .35vh solid var(--accent);
        box-shadow: 0 0 0 .55vh var(--leader-ring);
      }
      .crm-live-avatar.is-leader.is-photo { filter: none; }
      .crm-live-ranking-copy {
        min-width: 0;
        display: grid;
        gap: .7vh;
      }
      .crm-live-ranking-name {
        font-size: 3vh;
        line-height: .95;
        letter-spacing: -.05em;
        font-weight: 500;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .crm-live-ranking-row.is-leader .crm-live-ranking-name { font-size: 4.3vh; }
      .crm-live-ranking-sub {
        color: var(--text-secondary);
        font-size: 1.65vh;
        line-height: 1.35;
        font-weight: 400;
      }
      .crm-live-ranking-bar {
        width: 100%;
        height: .7vh;
        border-radius: 999px;
        background: var(--track);
        overflow: hidden;
      }
      .crm-live-ranking-bar > span {
        display: block;
        height: 100%;
        width: 0;
        border-radius: inherit;
        background: rgba(255,255,255,.28);
      }
      .crm-live-ranking-row.is-leader .crm-live-ranking-bar > span { background: var(--accent); }
      .crm-live-ranking-metric {
        text-align: right;
        display: grid;
        gap: .8vh;
        justify-items: end;
      }
      .crm-live-ranking-pct {
        font-size: 6.2vh;
        line-height: .88;
        letter-spacing: -.08em;
        font-weight: 500;
      }
      .crm-live-ranking-row.is-leader .crm-live-ranking-pct { color: var(--accent); font-size: 8.6vh; }
      .crm-live-ranking-actual {
        color: var(--text-secondary);
        font-size: 1.7vh;
        font-weight: 400;
      }
      .crm-live-highlight-person {
        display: grid;
        justify-items: start;
        gap: 1.4vh;
      }
      .crm-live-highlight-person.is-right {
        justify-items: end;
        text-align: right;
      }
      .crm-live-highlight-name {
        font-size: 5.2vh;
        line-height: .92;
        letter-spacing: -.06em;
        font-weight: 500;
      }
      .crm-live-highlight-value {
        font-size: min(9vw, 12vh);
        line-height: .9;
        letter-spacing: -.08em;
        font-weight: 500;
      }
      .crm-live-highlight-note {
        color: var(--text-secondary);
        font-size: 1.8vh;
        line-height: 1.35;
      }
      .crm-live-last-sale-client {
        font-size: min(8vw, 10.5vh);
        line-height: .9;
        letter-spacing: -.07em;
        font-weight: 500;
      }
      .crm-live-last-sale-plan {
        color: var(--text-secondary);
        font-size: 2vh;
        line-height: 1.35;
      }
      .crm-live-last-sale-list {
        display: grid;
        gap: 1.6vh;
        width: min(26vw, 100%);
      }
      .crm-live-last-sale-row {
        display: grid;
        gap: .5vh;
      }
      .crm-live-last-sale-row span {
        color: var(--text-tertiary);
        font-size: 1.45vh;
        letter-spacing: .24em;
        text-transform: uppercase;
        font-weight: 500;
      }
      .crm-live-last-sale-row strong {
        font-size: 2.5vh;
        line-height: 1.05;
        letter-spacing: -.04em;
        font-weight: 500;
      }
      .crm-live-footer {
        position: absolute;
        left: 4.4vw;
        right: 4.4vw;
        bottom: 3.2vh;
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 2vw;
        color: var(--text-tertiary);
        font-size: 1.45vh;
        line-height: 1.2;
      }
      .crm-live-dots {
        display: flex;
        align-items: center;
        gap: .55vw;
      }
      .crm-live-dot {
        width: 1.2vw;
        max-width: 28px;
        min-width: 14px;
        height: 3px;
        border-radius: 999px;
        background: rgba(255,255,255,.16);
        transition: background .25s ease, transform .25s ease;
      }
      .crm-live-dot.is-active {
        background: var(--accent);
        transform: scaleX(1.08);
      }
      .crm-live-empty {
        height: 100%;
        display: grid;
        place-items: center;
        text-align: center;
        color: var(--text-secondary);
        font-size: 2.4vh;
        line-height: 1.45;
      }
      .crm-live-empty strong {
        display: block;
        margin-bottom: 1.6vh;
        color: var(--text);
        font-size: 4vh;
        line-height: 1;
        letter-spacing: -.04em;
        font-weight: 500;
      }
      @media (max-width: 1200px) {
        .crm-live { padding: 4.2vh 4vw 4vh; }
        .crm-live-week-grid,
        .crm-live-highlight-grid,
        .crm-live-last-sale-grid {
          grid-template-columns: 1fr;
          gap: 2.8vh;
        }
        .crm-live-column-right,
        .crm-live-highlight-person.is-right {
          justify-items: start;
          text-align: left;
        }
        .crm-live-column-right .crm-live-progress { justify-self: start; }
        .crm-live-last-sale-list { width: 100%; }
      }
      @media (max-aspect-ratio: 1/1) {
        .crm-live { padding: 4vh 4vw; }
        .crm-live-screen { gap: 2.2vh; }
        .crm-live-ranking-row { min-height: 9.6vh; }
        .crm-live-ranking-row.is-leader { min-height: 11.6vh; }
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
        const SCREENS = ['month', 'week', 'closers', 'sdrs', 'highlights', 'last-sale'];
        const ROTATE_MS = 10000;
        const POLL_MS = 120000;
        let payload = null;
        let active = 0;
        let rotateTimer = null;
        let pollTimer = null;
        let imageCache = new Map();

        const escapeHtml = (value) => String(value == null ? '' : value)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/\"/g, '&quot;')
          .replace(/'/g, '&#39;');

        const moneyShort = ${formatMoneyShort.toString()};
        const percent = (value) => {
          const n = Number(value || 0);
          if (!Number.isFinite(n)) return '0%';
          return n.toFixed(1).replace('.', ',') + '%';
        };
        const clampPercent = (value) => Math.max(0, Math.min(100, Number(value || 0) || 0));
        const dateLabel = (dateKey) => {
          const raw = String(dateKey || '');
          const [y, m, d] = raw.split('-');
          if (!y || !m || !d) return raw;
          return d + '/' + m;
        };
        const dateTimeLabel = (iso) => {
          if (!iso) return '—';
          try {
            return new Intl.DateTimeFormat('pt-BR', {
              timeZone: 'America/Sao_Paulo',
              day: '2-digit',
              month: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
            }).format(new Date(iso));
          } catch (error) {
            return '—';
          }
        };
        const safeArray = (value) => Array.isArray(value) ? value : [];
        const getPhotoUrl = (row) => {
          if (!row || typeof row !== 'object') return '';
          return String(row.photoURL || row.photoUrl || '').trim();
        };
        const getDisplayName = (row) => {
          if (!row || typeof row !== 'object') return '';
          return String(row.displayName || '').trim();
        };
        const getNested = (rootValue, keys, fallback) => {
          let current = rootValue;
          for (const key of safeArray(keys)) {
            if (!current || typeof current !== 'object' || !(key in current)) return fallback;
            current = current[key];
          }
          return current == null ? fallback : current;
        };
        const initials = (value) => {
          const words = String(value || '').trim().split(/\\s+/).filter(Boolean);
          if (!words.length) return 'SP';
          return words.slice(0, 2).map((part) => part[0] || '').join('').toUpperCase();
        };
        const abbreviateProgress = (row) => {
          if (!row) return '0 de 0';
          if (row.role === 'closer') return moneyShort(row.actualValue || 0) + ' de ' + moneyShort(row.targetValue || 0);
          return String(row.actualValue || 0) + ' de ' + String(row.targetValue || 0);
        };
        const metricMain = (row) => {
          if (!row) return '0';
          return row.role === 'closer' ? moneyShort(row.actualValue || 0) : String(row.actualValue || 0);
        };
        const personImageState = (row) => {
          const url = getPhotoUrl(row);
          if (!url) return { usable: false, src: '' };
          const cached = imageCache.get(url);
          if (cached === 'loaded') return { usable: true, src: url };
          if (cached === 'error') return { usable: false, src: '' };
          return { usable: false, src: '' };
        };
        const avatarHtml = (row, options = {}) => {
          const leader = !!options.leader;
          const state = personImageState(row);
          const name = getDisplayName(row) || 'Sem nome';
          const classes = ['crm-live-avatar', leader ? 'is-leader' : '', state.usable ? 'is-photo' : ''].filter(Boolean).join(' ');
          if (state.usable) {
            return '<span class="' + classes + '"><img src="' + escapeHtml(state.src) + '" alt="" onerror="this.parentElement.innerHTML=\\\'' +
              '<span>' + escapeHtml(initials(name)) + '</span>' +
            '\\\'" /></span>';
          }
          return '<span class="' + classes + '"><span>' + escapeHtml(initials(name)) + '</span></span>';
        };
        const preloadImages = (rows = []) => {
          safeArray(rows).forEach((row) => {
            const url = getPhotoUrl(row);
            if (!url || imageCache.has(url)) return;
            const img = new Image();
            imageCache.set(url, 'loading');
            img.onload = () => { imageCache.set(url, 'loaded'); };
            img.onerror = () => { imageCache.set(url, 'error'); };
            img.src = url;
          });
        };
        const preloadFromPayload = (data) => {
          const rows = [];
          rows.push.apply(rows, safeArray(getNested(data, ['weekly', 'closers'], [])));
          rows.push.apply(rows, safeArray(getNested(data, ['weekly', 'sdrs'], [])));
          if (getNested(data, ['highlights', 'closer'], null)) rows.push(data.highlights.closer);
          if (getNested(data, ['highlights', 'sdr'], null)) rows.push(data.highlights.sdr);
          preloadImages(rows);
        };
        const footerStatusClass = () => {
          if (!payload) return '';
          return payload.stale ? 'crm-live-status-pill is-stale' : 'crm-live-status-pill is-live';
        };
        const renderDots = () => {
          dotsEl.innerHTML = SCREENS.map((_, index) => '<span class="crm-live-dot ' + (index === active ? 'is-active' : '') + '"></span>').join('');
        };
        const renderMetric = ({ label, value, sideTitle = '', sideText = '', progress = null, valueClass = '' }) =>
          '<div class="crm-live-metric-block">' +
            '<div class="crm-live-metric-label">' + escapeHtml(label) + '</div>' +
            '<div class="crm-live-metric-line">' +
              '<div class="crm-live-metric-value ' + escapeHtml(valueClass) + '">' + escapeHtml(value) + '</div>' +
              ((sideTitle || sideText)
                ? '<div class="crm-live-metric-side">' +
                    (sideTitle ? '<strong>' + escapeHtml(sideTitle) + '</strong>' : '') +
                    (sideText ? '<span>' + escapeHtml(sideText) + '</span>' : '') +
                  '</div>'
                : '') +
            '</div>' +
            (progress == null ? '' : '<div class="crm-live-progress"><span style="width:' + clampPercent(progress).toFixed(1) + '%"></span></div>') +
          '</div>';
        const renderRankingRows = (rows, options = {}) => {
          const role = options.role || '';
          const limited = safeArray(rows).slice(0, 5);
          if (!limited.length) {
            return '<div class="crm-live-empty"><div><strong>Sem dados</strong><div>Nenhuma pessoa com meta nessa semana.</div></div></div>';
          }
          return limited.map((row, index) => {
            const leader = index === 0;
            const roleRow = Object.assign({}, row || {}, { role });
            return '<div class="crm-live-ranking-row ' + (leader ? 'is-leader' : '') + '">' +
              avatarHtml(row, { leader }) +
              '<div class="crm-live-ranking-copy">' +
                '<div class="crm-live-ranking-name">' + escapeHtml(row.displayName || '—') + '</div>' +
                '<div class="crm-live-ranking-sub">' + escapeHtml(abbreviateProgress(roleRow)) + '</div>' +
                '<div class="crm-live-ranking-bar"><span style="width:' + clampPercent(row.progressPct || 0).toFixed(1) + '%"></span></div>' +
              '</div>' +
              '<div class="crm-live-ranking-metric">' +
                '<div class="crm-live-ranking-pct">' + escapeHtml(percent(row.progressPct || 0)) + '</div>' +
                '<div class="crm-live-ranking-actual">' + escapeHtml(metricMain(roleRow)) + '</div>' +
              '</div>' +
            '</div>';
          }).join('');
        };
        const renderHighlight = (row, options = {}) => {
          const role = options.role || '';
          const alignRight = !!options.alignRight;
          const hasRow = !!row;
          const person = row || { displayName: 'Sem destaque' };
          const leader = true;
          const metricRow = Object.assign({}, person, { role, actualValue: hasRow ? (row.dailyValue || 0) : 0 });
          return '<div class="crm-live-highlight-person ' + (alignRight ? 'is-right' : '') + '">' +
            avatarHtml(person, { leader }) +
            '<div class="crm-live-highlight-name">' + escapeHtml(person.displayName || 'Sem destaque') + '</div>' +
            '<div class="crm-live-highlight-value">' + escapeHtml(hasRow ? metricMain(metricRow) : '—') + '</div>' +
            '<div class="crm-live-highlight-note">' + escapeHtml(hasRow ? percent(row.dailyProgressPct || 0) + ' da meta semanal em um dia' : (role === 'closer' ? 'Nenhum fechamento ontem' : 'Nenhuma reunião feita ontem')) + '</div>' +
          '</div>';
        };
        const renderMonthScreen = (month) => {
          const summary = month.summary || {};
          return '<section class="crm-live-screen">' +
            '<div class="crm-live-shell">' +
              '<div class="crm-live-head">' +
                '<div>' +
                  '<div class="crm-live-kicker">CRM Live</div>' +
                  '<h1 class="crm-live-title">Placar do mês</h1>' +
                  '<div class="crm-live-sub">Janela ' + escapeHtml(dateLabel(getNested(month, ['period', 'startDateKey'], ''))) + ' a ' + escapeHtml(dateLabel(getNested(month, ['period', 'endDateKey'], ''))) + '</div>' +
                '</div>' +
                '<div class="' + footerStatusClass() + '">' + (payload.stale ? 'Cache ' + escapeHtml(String(payload.staleAgeMinutes || 0)) + ' min' : 'Ao vivo') + '</div>' +
              '</div>' +
              '<div class="crm-live-body">' +
                '<div class="crm-live-stack">' +
                  renderMetric({
                    label: 'Receita vendida',
                    value: moneyShort(summary.realizado || 0),
                    sideTitle: percent(summary.percentAtingimento || 0),
                    sideText: 'Gap ' + moneyShort(summary.gap || 0),
                    progress: summary.percentAtingimento || 0,
                  }) +
                  '<div class="crm-live-support-grid">' +
                    '<div class="crm-live-support-item"><strong>' + escapeHtml(moneyShort(summary.meta || 0)) + '</strong><span>Meta do mês</span></div>' +
                    '<div class="crm-live-support-item"><strong>' + escapeHtml(String(summary.totalVendas || 0)) + '</strong><span>Vendas fechadas</span></div>' +
                    '<div class="crm-live-support-item"><strong>' + escapeHtml(String(month.windowCount || 0)) + '</strong><span>Negócios lidos na janela</span></div>' +
                  '</div>' +
                '</div>' +
              '</div>' +
            '</div>' +
          '</section>';
        };
        const renderWeekScreen = (weekly) => '<section class="crm-live-screen">' +
          '<div class="crm-live-shell">' +
            '<div class="crm-live-head">' +
              '<div>' +
                '<div class="crm-live-kicker">Semana comercial</div>' +
                '<h1 class="crm-live-title">Meta da semana</h1>' +
                '<div class="crm-live-sub">' + escapeHtml(dateLabel(getNested(weekly, ['commercialWeek', 'startDateKey'], ''))) + ' a ' + escapeHtml(dateLabel(getNested(weekly, ['commercialWeek', 'endDateKey'], ''))) + '</div>' +
              '</div>' +
              '<div class="' + footerStatusClass() + '">' + (payload.stale ? 'Snapshot mantido' : 'Atualização automática') + '</div>' +
            '</div>' +
            '<div class="crm-live-body crm-live-week-grid">' +
              '<div class="crm-live-column">' +
                renderMetric({
                  label: 'Closers',
                  value: moneyShort(getNested(weekly, ['team', 'closers', 'actualValue'], 0) || 0),
                  sideTitle: percent(getNested(weekly, ['team', 'closers', 'progressPct'], 0) || 0),
                  sideText: 'Meta ' + moneyShort(getNested(weekly, ['team', 'closers', 'targetValue'], 0) || 0),
                  progress: getNested(weekly, ['team', 'closers', 'progressPct'], 0) || 0,
                  valueClass: 'is-medium',
                }) +
              '</div>' +
              '<div class="crm-live-column crm-live-column-right">' +
                renderMetric({
                  label: 'SDRs',
                  value: String(getNested(weekly, ['team', 'sdrs', 'actualValue'], 0) || 0),
                  sideTitle: percent(getNested(weekly, ['team', 'sdrs', 'progressPct'], 0) || 0),
                  sideText: 'Meta ' + String(getNested(weekly, ['team', 'sdrs', 'targetValue'], 0) || 0) + ' reuniões',
                  progress: getNested(weekly, ['team', 'sdrs', 'progressPct'], 0) || 0,
                  valueClass: 'is-medium',
                }) +
              '</div>' +
            '</div>' +
          '</div>' +
        '</section>';
        const renderClosersScreen = (weekly) => '<section class="crm-live-screen">' +
          '<div class="crm-live-shell">' +
            '<div class="crm-live-head">' +
              '<div>' +
                '<div class="crm-live-kicker">Ranking semanal</div>' +
                '<h1 class="crm-live-title">Closers</h1>' +
                '<div class="crm-live-sub">Ordenado por percentual da meta individual</div>' +
              '</div>' +
              '<div class="' + footerStatusClass() + '">' + escapeHtml(String(safeArray(weekly.closers).length)) + ' participantes</div>' +
            '</div>' +
            '<div class="crm-live-body"><div class="crm-live-ranking">' + renderRankingRows(weekly.closers, { role: 'closer' }) + '</div></div>' +
          '</div>' +
        '</section>';
        const renderSdrsScreen = (weekly) => '<section class="crm-live-screen">' +
          '<div class="crm-live-shell">' +
            '<div class="crm-live-head">' +
              '<div>' +
                '<div class="crm-live-kicker">Ranking semanal</div>' +
                '<h1 class="crm-live-title">SDRs</h1>' +
                '<div class="crm-live-sub">Ordenado por percentual da meta individual</div>' +
              '</div>' +
              '<div class="' + footerStatusClass() + '">' + escapeHtml(String(safeArray(weekly.sdrs).length)) + ' participantes</div>' +
            '</div>' +
            '<div class="crm-live-body"><div class="crm-live-ranking">' + renderRankingRows(weekly.sdrs, { role: 'sdr' }) + '</div></div>' +
          '</div>' +
        '</section>';
        const renderHighlightsScreen = (highlight) => '<section class="crm-live-screen">' +
          '<div class="crm-live-shell">' +
            '<div class="crm-live-head">' +
              '<div>' +
                '<div class="crm-live-kicker">Ontem</div>' +
                '<h1 class="crm-live-title">Destaques do dia anterior</h1>' +
                '<div class="crm-live-sub">Quem mais avançou na meta em ' + escapeHtml(dateLabel(highlight.dayKey)) + '</div>' +
              '</div>' +
              '<div class="' + footerStatusClass() + '">' + escapeHtml(highlight.dayKey || '') + '</div>' +
            '</div>' +
            '<div class="crm-live-body crm-live-highlight-grid">' +
              '<div class="crm-live-column">' + renderHighlight(highlight.closer, { role: 'closer' }) + '</div>' +
              '<div class="crm-live-column">' + renderHighlight(highlight.sdr, { role: 'sdr', alignRight: true }) + '</div>' +
            '</div>' +
          '</div>' +
        '</section>';
        const renderLastSaleScreen = (latestSale) => '<section class="crm-live-screen">' +
          '<div class="crm-live-shell">' +
            '<div class="crm-live-head">' +
              '<div>' +
                '<div class="crm-live-kicker">Fechamento mais recente</div>' +
                '<h1 class="crm-live-title">Última venda</h1>' +
                '<div class="crm-live-sub">Movimento mais recente da janela comercial</div>' +
              '</div>' +
              '<div class="' + footerStatusClass() + '">' + escapeHtml(getNested(latestSale, ['closer'], 'Sem closer') || 'Sem closer') + '</div>' +
            '</div>' +
            '<div class="crm-live-body">' +
              (latestSale
                ? '<div class="crm-live-last-sale-grid">' +
                    '<div class="crm-live-column">' +
                      '<div class="crm-live-metric-label">Cliente</div>' +
                      '<div class="crm-live-last-sale-client">' + escapeHtml(latestSale.cliente || '—') + '</div>' +
                      '<div class="crm-live-last-sale-plan">Plano ' + escapeHtml(latestSale.plano || '—') + '</div>' +
                    '</div>' +
                    '<div class="crm-live-column crm-live-column-right">' +
                      renderMetric({
                        label: 'Valor',
                        value: moneyShort(latestSale.valor || 0),
                        sideTitle: latestSale.closer || 'Sem closer',
                        sideText: dateTimeLabel(latestSale.when),
                        valueClass: 'is-medium',
                      }) +
                      '<div class="crm-live-last-sale-list">' +
                        '<div class="crm-live-last-sale-row"><span>Closer</span><strong>' + escapeHtml(latestSale.closer || '—') + '</strong></div>' +
                        '<div class="crm-live-last-sale-row"><span>Quando</span><strong>' + escapeHtml(dateTimeLabel(latestSale.when)) + '</strong></div>' +
                      '</div>' +
                    '</div>' +
                  '</div>'
                : '<div class="crm-live-empty"><div><strong>Sem venda</strong><div>Nenhuma venda fechada na janela atual.</div></div></div>') +
            '</div>' +
          '</div>' +
        '</section>';
        const render = () => {
          if (!payload) return;
          const month = payload.month || {};
          const weekly = payload.weekly || {};
          const highlight = payload.highlights || {};
          const latestSale = payload.latestSale || null;
          const screens = {
            month: renderMonthScreen(month),
            week: renderWeekScreen(weekly),
            closers: renderClosersScreen(weekly),
            sdrs: renderSdrsScreen(weekly),
            highlights: renderHighlightsScreen(highlight),
            'last-sale': renderLastSaleScreen(latestSale),
          };
          root.innerHTML = SCREENS.map((key, index) => screens[key].replace('<section class="crm-live-screen">', '<section class="crm-live-screen ' + (index === active ? 'is-active' : '') + '">')).join('');
          renderDots();
          if (emptyEl) emptyEl.remove();
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
        const showError = (title, body) => {
          root.innerHTML = '<div class="crm-live-empty"><div><strong>' + escapeHtml(title) + '</strong><div>' + escapeHtml(body) + '</div></div></div>';
          if (dotsEl) dotsEl.innerHTML = '';
        };
        const explainError = (status, errorCode, message) => {
          const code = String(errorCode || '').trim();
          if (status === 401 || code === 'missing_cookie' || code === 'invalid_token' || code === 'token_not_found' || code === 'token_revoked' || code === 'unauthorized') {
            return {
              title: 'Acesso não autorizado',
              body: 'Abra a URL completa com token uma vez para ativar o cookie da TV. Depois disso, use /tv/crm-live sem o token.',
            };
          }
          if (code === 'crm_live_payload_failed' || code === 'missing_crm_env' || String(message || '').includes('crm')) {
            return {
              title: 'Dados do CRM indisponíveis',
              body: 'O backend não conseguiu montar os dados do CRM Live agora. Se houver snapshot anterior, ele será mantido; se este for o primeiro acesso, a TV precisa de uma nova tentativa quando o CRM responder.',
            };
          }
          return {
            title: 'Falha ao carregar o CRM Live',
            body: message || 'O backend respondeu com erro e ainda não existe um snapshot anterior para exibir.',
          };
        };
        const loadData = async () => {
          try {
            const res = await fetch('/api/crm-live-data', { credentials: 'include', cache: 'no-store' });
            let data = null;
            try {
              data = await res.json();
            } catch (parseError) {
              data = null;
            }
            if (!res.ok || !data) {
              const err = new Error(getNested(data, ['message'], 'crm_live_fetch_failed') || 'crm_live_fetch_failed');
              err.status = res.status;
              err.errorCode = getNested(data, ['error'], '') || '';
              throw err;
            }
            payload = data;
            preloadFromPayload(data);
            saveLastGood(data);
            render();
            scheduleRotation();
            setStatus(data.stale ? 'Exibindo último snapshot útil · ' + String(data.staleAgeMinutes || 0) + ' min' : 'Atualizado ' + dateTimeLabel(data.generatedAt));
          } catch (error) {
            const fallback = loadLastGood();
            if (fallback) {
              payload = fallback;
              preloadFromPayload(fallback);
              render();
              scheduleRotation();
              setStatus('Sem atualização nova · mantendo última tela boa');
              return;
            }
            const explained = explainError(error && error.status, error && error.errorCode, error && error.message);
            showError(explained.title, explained.body);
            setStatus(((error && error.status) ? 'Erro ' + String(error.status) + ' · ' : '') + ((error && error.errorCode) || 'sem snapshot'));
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
