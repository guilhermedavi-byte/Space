const { handleLiveTvPageRequest } = require("./_lib/live-tv-route");
const { createLiveTvLoopController } = require("./_lib/live-tv-rotation");
const { createLiveTvBuildReloadCoordinator } = require("./_lib/live-tv-runtime");
const { renderToggleIcon } = require("./_lib/crm-live-toggle");
const { getCsLiveBuildId } = require("./_lib/cs-live-build");
const {
  buildCookie,
  buildReadCookie,
  clearCookie,
  isSecureRequest,
  validateEntryToken,
  validateCookieViewer,
  CS_LIVE_COOKIE_NAME,
} = require("./_lib/cs-live-auth");

const normalizeRole = (value) => {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "admin" || raw === "administrador") return "admin";
  if (raw === "teacher" || raw === "professor") return "teacher";
  if (raw === "pedagogico" || raw === "pedagógico") return "pedagogico";
  return "";
};

const buildHtml = ({ buildId = "dev-local" } = {}) => `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>CS Live | Space</title>
    <meta name="robots" content="noindex,nofollow" />
    <meta name="cs-live-build-id" content="${buildId}" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500&display=swap" rel="stylesheet" />
    <style>
      :root {
        color-scheme: dark;
        --bg: #0d1014;
        --accent: rgb(255,86,79);
        --success: #31d69b;
        --text: #f5f5f4;
        --text-secondary: #a8a8a4;
        --text-tertiary: #6b7280;
        --track: #1c2027;
      }
      * { box-sizing: border-box; }
      html, body { margin: 0; width: 100%; min-height: 100%; overflow: hidden; background: var(--bg); color: var(--text); font-family: "Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif; }
      .crm-live { position: relative; width: 100vw; height: 100vh; padding: 3.2vh 4.5vw 3.6vh; background: radial-gradient(circle at top left, rgba(255,86,79,.14), transparent 28%), radial-gradient(circle at 78% 18%, rgba(255,255,255,.04), transparent 26%), var(--bg); }
      .crm-live-stage { position: relative; width: 100%; height: 100%; overflow: hidden; }
      .crm-live-sidepanel { display: none; }
      .crm-live.is-deadline-mode .crm-live-stage { width: calc(62% - 1.8vw); }
      .crm-live.is-deadline-mode .crm-live-sidepanel { position: absolute; top: 0; right: 0; bottom: 0; width: 38%; display: grid; align-items: stretch; padding-left: 2.2vw; }
      .crm-live.is-deadline-mode .crm-live-sidepanel::before { content: ""; position: absolute; top: 0; bottom: 0; left: 0; width: 1px; background: rgba(255,255,255,.09); }
      .crm-live-controls { position: absolute; top: 2.4vh; right: 4.5vw; z-index: 26; display: flex; align-items: center; gap: .9vh; }
      .crm-live-control { width: 5.6vh; height: 5.6vh; border: 0; border-radius: 999px; background: rgba(255,255,255,.05); color: rgba(245,245,244,.78); opacity: .36; display: grid; place-items: center; padding: 0; cursor: pointer; transition: opacity .2s ease, background .2s ease, transform .2s ease; }
      .crm-live-control:hover, .crm-live-control:focus-visible, .crm-live-control:active { opacity: .88; background: rgba(255,255,255,.11); outline: none; }
      .crm-live-control svg { width: 2.1vh; height: 2.1vh; display: block; fill: currentColor; }
      .crm-live-control.is-toggle[data-state="paused"] { opacity: .88; color: rgba(255,255,255,.96); background: rgba(255,255,255,.1); }
      .crm-live-screen { position: absolute; inset: 0; display: block; opacity: 0; pointer-events: none; transition: opacity .4s ease; }
      .crm-live-screen.is-active { opacity: 1; pointer-events: auto; }
      .crm-live-shell { width: 100%; height: 100%; display: grid; grid-template-rows: auto 1fr; gap: 1.8vh; }
      .crm-live-head { display: grid; gap: 1.4vh; padding-top: .4vh; }
      .crm-live-title { margin: 0; font-size: 3.4vh; line-height: 1.1; letter-spacing: -.03em; font-weight: 400; color: var(--text-secondary); }
      .crm-live-demo-flag { display: inline-flex; width: fit-content; align-items: center; gap: .8vh; padding: .7vh 1.3vh; border-radius: 999px; background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.12); color: rgba(255,255,255,.84); font-size: 1.65vh; letter-spacing: .08em; text-transform: uppercase; }
      .crm-live-demo-flag strong { color: var(--accent); font-weight: 500; }
      .crm-live-body { min-height: 0; display: grid; align-items: stretch; }
      .crm-live-center { height: 100%; display: grid; align-content: center; gap: 3.6vh; }
      .crm-live-metric-block { display: grid; gap: 1.2vh; }
      .crm-live-metric-label { color: var(--text-tertiary); font-size: 2vh; letter-spacing: .28em; text-transform: uppercase; font-weight: 500; }
      .crm-live-metric-line { display: flex; align-items: flex-end; gap: 1.4vw; flex-wrap: wrap; }
      .crm-live-metric-value { font-size: clamp(20vh, 22vh, 26vh); line-height: .88; letter-spacing: -.08em; font-weight: 500; }
      .crm-live-metric-side { display: grid; gap: .4vh; padding-bottom: 1.6vh; }
      .crm-live-metric-side strong { color: var(--text); font-size: 3.1vh; font-weight: 500; }
      .crm-live-metric-side span { color: var(--text-secondary); font-size: 2.2vh; }
      .crm-live-progress { width: min(56vw, 88vh); height: 1.2vh; border-radius: 999px; background: var(--track); overflow: hidden; }
      .crm-live-progress > span { display: block; height: 100%; border-radius: inherit; background: var(--accent); }
      .crm-live-support-grid { display: grid; gap: 1.8vh; grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .crm-live-support-item { display: grid; gap: .8vh; }
      .crm-live-support-item strong { font-size: 3.2vh; font-weight: 500; color: var(--text); }
      .crm-live-support-item span { font-size: 2.2vh; color: var(--text-secondary); }
      .crm-live-footer { position: absolute; right: 4.5vw; bottom: 3.2vh; left: 4.5vw; display: flex; align-items: center; justify-content: space-between; color: var(--text-secondary); font-size: 1.9vh; }
      .crm-live-footer [data-crm-live-status][data-tone="warning"] { color: rgba(255, 207, 119, .92); }
      .crm-live-footer [data-crm-live-status][data-tone="critical"] { color: rgba(255, 146, 140, .98); }
      .crm-live-dots { display: flex; align-items: center; gap: .9vh; }
      .crm-live-dot { width: 1vh; height: 1vh; border-radius: 999px; background: rgba(255,255,255,.18); }
      .crm-live-dot.is-active { background: var(--accent); }
      .crm-live-empty, .crm-live-degraded { height: 100%; display: grid; place-items: center; text-align: center; }
      .crm-live-empty strong { display: block; margin-bottom: 1.2vh; font-size: 3.4vh; font-weight: 500; }
      .crm-live-degraded-card { width: min(74vw, 92vh); padding: 3.8vh 3vw; border-radius: 3.4vh; background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.08); display: grid; gap: 1.8vh; }
      .crm-live-degraded-kicker { color: var(--accent); text-transform: uppercase; letter-spacing: .2em; font-size: 1.8vh; }
      .crm-live-degraded-title { font-size: 5vh; line-height: 1; letter-spacing: -.04em; }
      .crm-live-degraded-body, .crm-live-degraded-meta { color: var(--text-secondary); font-size: 2.2vh; line-height: 1.5; }
      .crm-live-deadline { position: relative; height: 100%; display: grid; place-items: center; transform: translate(var(--crm-live-drift-x, 0px), var(--crm-live-drift-y, 0px)); }
      .crm-live-deadline-shell { display: grid; gap: 2.8vh; justify-items: center; text-align: center; }
      .crm-live-deadline-kicker { color: rgba(255,255,255,.58); text-transform: uppercase; letter-spacing: .22em; font-size: 1.7vh; }
      .crm-live-deadline-ring { --deadline-accent: rgba(255, 86, 79, .76); width: min(31vw, 60vh); aspect-ratio: 1; border-radius: 50%; display: grid; place-items: center; background: radial-gradient(circle at center, transparent 57.5%, var(--deadline-accent) 57.5%, var(--deadline-accent) 66%, transparent 66%); }
      .crm-live-deadline-center { display: grid; justify-items: center; gap: 1.2vh; }
      .crm-live-deadline-label, .crm-live-deadline-note { color: rgba(255, 188, 184, .78); font-size: 2vh; letter-spacing: .12em; text-transform: uppercase; }
      .crm-live-deadline-value { display: flex; align-items: flex-end; gap: .8vh; font-size: 10vh; line-height: .88; letter-spacing: -.06em; color: rgba(255, 210, 207, .78); }
      .crm-live-deadline-seconds { font-size: 5vh; padding-bottom: 1.4vh; }
    </style>
  </head>
  <body>
    <div class="crm-live">
      <div class="crm-live-controls" aria-label="Controles da rotação">
        <button class="crm-live-control" type="button" data-crm-live-prev aria-label="Tela anterior">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
        </button>
        <button class="crm-live-control" type="button" data-crm-live-next aria-label="Próxima tela">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8.59 16.59 1.41 1.41 6-6-6-6-1.41 1.41L13.17 12z"/></svg>
        </button>
        <button class="crm-live-control is-toggle" type="button" data-crm-live-toggle data-state="running" aria-label="Pausar rotação">
          <span data-crm-live-toggle-icon>${renderToggleIcon(false)}</span>
        </button>
      </div>
      <div class="crm-live-stage" data-crm-live-root>
        <div class="crm-live-empty" data-crm-live-empty>Carregando CS Live…</div>
      </div>
      <aside class="crm-live-sidepanel" data-crm-live-sidepanel aria-hidden="true"></aside>
      <div class="crm-live-footer">
        <div data-crm-live-status>Atualizando…</div>
        <div class="crm-live-dots" data-crm-live-dots></div>
      </div>
    </div>
    <script>
      (() => {
        const root = document.querySelector('[data-crm-live-root]');
        const crmLiveEl = document.querySelector('.crm-live');
        const sidePanelEl = document.querySelector('[data-crm-live-sidepanel]');
        const statusEl = document.querySelector('[data-crm-live-status]');
        const dotsEl = document.querySelector('[data-crm-live-dots]');
        const prevButton = document.querySelector('[data-crm-live-prev]');
        const nextButton = document.querySelector('[data-crm-live-next]');
        const toggleButton = document.querySelector('[data-crm-live-toggle]');
        const toggleIconEl = document.querySelector('[data-crm-live-toggle-icon]');
        const createLoopController = ${createLiveTvLoopController.toString()};
        const createBuildReloadCoordinator = ${createLiveTvBuildReloadCoordinator.toString()};
        const pageBuildId = ${JSON.stringify(buildId)};
        const requestedScreen = new URLSearchParams(window.location.search).get('screen') || '';
        const ROTATE_MS = 10000;
        const POLL_MS = 120000;
        const EVENT_POLL_MS = 25000;
        let payload = null;
        let screenKeys = [];
        let active = 0;
        const escapeHtml = (value) => String(value == null ? '' : value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\\"/g, '&quot;').replace(/'/g, '&#39;');
        const safeArray = (value) => Array.isArray(value) ? value : [];
        const getNested = (rootValue, keys, fallback) => {
          let current = rootValue;
          for (const key of safeArray(keys)) {
            if (!current || typeof current !== 'object' || !(key in current)) return fallback;
            current = current[key];
          }
          return current == null ? fallback : current;
        };
        const percent = (value) => {
          const n = Number(value || 0);
          if (!Number.isFinite(n)) return '0,0%';
          return n.toFixed(1).replace('.', ',') + '%';
        };
        const clampPercent = (value) => Math.max(0, Math.min(100, Number(value || 0) || 0));
        const parseDateKeyAtEnd = (dateKey) => {
          const raw = String(dateKey || '').trim();
          if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(raw)) return null;
          const date = new Date(raw + 'T23:59:59-03:00');
          return Number.isNaN(date.getTime()) ? null : date;
        };
        const computeDeadlineState = () => {
          const endDateKey = getNested(payload, ['weekly', 'commercialWeek', 'endDateKey'], '');
          const endDate = parseDateKeyAtEnd(endDateKey);
          if (!(endDate instanceof Date)) return { splitActive: false, hours: '00', minutes: '00', seconds: '00', label: 'janela indisponível', statusText: 'sem previsão' };
          const diff = endDate.getTime() - Date.now();
          const splitActive = diff <= 24 * 60 * 60 * 1000;
          const totalSeconds = Math.max(0, Math.floor(diff / 1000));
          const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
          const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
          const seconds = String(totalSeconds % 60).padStart(2, '0');
          return {
            splitActive,
            hours,
            minutes,
            seconds,
            label: diff <= 0 ? 'aguardando nova janela' : 'para fechar a janela',
            statusText: diff <= 0 ? 'janela encerrada' : 'últimas 24 horas',
          };
        };
        const renderDeadlinePanel = () => {
          if (!payload) return;
          const state = computeDeadlineState();
          crmLiveEl.classList.toggle('is-deadline-mode', state.splitActive);
          if (!state.splitActive) {
            sidePanelEl.innerHTML = '';
            sidePanelEl.setAttribute('aria-hidden', 'true');
            return;
          }
          sidePanelEl.setAttribute('aria-hidden', 'false');
          sidePanelEl.innerHTML =
            '<div class="crm-live-deadline">' +
              '<div class="crm-live-deadline-shell">' +
                '<div class="crm-live-deadline-kicker">Últimas 24 horas</div>' +
                '<div class="crm-live-deadline-ring">' +
                  '<div class="crm-live-deadline-center">' +
                    '<div class="crm-live-deadline-label">' + escapeHtml(state.label) + '</div>' +
                    '<div class="crm-live-deadline-value"><span>' + escapeHtml(state.hours) + '</span><span>:</span><span>' + escapeHtml(state.minutes) + '</span><span class="crm-live-deadline-seconds">' + escapeHtml(state.seconds) + '</span></div>' +
                    '<div class="crm-live-deadline-note">' + escapeHtml(state.statusText) + '</div>' +
                  '</div>' +
                '</div>' +
              '</div>' +
            '</div>';
        };
        const renderMetricScreen = (metric) => {
          const worseWhenHigher = String(metric.direction || '') !== 'higher_is_better';
          const urgent = worseWhenHigher ? Number(metric.actualValue || 0) > Number(metric.targetValue || 0) : Number(metric.actualValue || 0) < Number(metric.targetValue || 0);
          const delta = worseWhenHigher
            ? Number(metric.actualValue || 0) - Number(metric.targetValue || 0)
            : Number(metric.targetValue || 0) - Number(metric.actualValue || 0);
          const supportTone = urgent ? 'rgba(255,86,79,.98)' : 'rgba(49,214,155,.96)';
          const progress = worseWhenHigher
            ? clampPercent((Number(metric.targetValue || 0) / Math.max(0.1, Number(metric.actualValue || 0))) * 100)
            : clampPercent((Number(metric.actualValue || 0) / Math.max(0.1, Number(metric.targetValue || 0))) * 100);
          const context = urgent
            ? (worseWhenHigher ? 'Acima do alvo em ' : 'Abaixo do alvo em ') + percent(Math.abs(delta))
            : 'Dentro do alvo definido';
          return '<section class="crm-live-screen">' +
            '<div class="crm-live-shell">' +
              '<div class="crm-live-head">' +
                '<div class="crm-live-demo-flag"><strong>Dados de exemplo</strong><span>mock visível</span></div>' +
                '<h1 class="crm-live-title">' + escapeHtml(metric.label || 'CS Live') + '</h1>' +
              '</div>' +
              '<div class="crm-live-body">' +
                '<div class="crm-live-center">' +
                  '<div class="crm-live-metric-block">' +
                    '<div class="crm-live-metric-label">Agora</div>' +
                    '<div class="crm-live-metric-line">' +
                      '<div class="crm-live-metric-value" style="color:' + escapeHtml(urgent ? 'var(--accent)' : 'var(--text)') + ';">' + escapeHtml(percent(metric.actualValue || 0)) + '</div>' +
                      '<div class="crm-live-metric-side">' +
                        '<strong style="color:' + escapeHtml(supportTone) + '">Alvo ' + escapeHtml(percent(metric.targetValue || 0)) + '</strong>' +
                        '<span>' + escapeHtml(worseWhenHigher ? 'Quanto menor, melhor' : 'Quanto maior, melhor') + '</span>' +
                      '</div>' +
                    '</div>' +
                  '</div>' +
                  '<div class="crm-live-progress"><span style="width:' + progress.toFixed(1) + '%; background:' + escapeHtml(urgent ? 'var(--accent)' : 'var(--success)') + '"></span></div>' +
                  '<div class="crm-live-support-grid">' +
                    '<div class="crm-live-support-item"><strong>' + escapeHtml(context) + '</strong><span>' + escapeHtml(metric.context || '') + '</span></div>' +
                    '<div class="crm-live-support-item"><strong>' + escapeHtml(urgent ? 'Atenção' : 'Saudável') + '</strong><span>' + escapeHtml(urgent ? 'Faixa coral segue a direção certa desta métrica.' : 'Indicador alinhado com a direção esperada.') + '</span></div>' +
                  '</div>' +
                '</div>' +
              '</div>' +
            '</div>' +
          '</section>';
        };
        const renderSourceStatusScreen = (message) => '<section class="crm-live-screen"><div class="crm-live-shell"><div class="crm-live-body"><div class="crm-live-degraded"><div class="crm-live-degraded-card"><div class="crm-live-degraded-kicker">Modo degradado</div><div class="crm-live-degraded-title">CS Live em fallback</div><div class="crm-live-degraded-body">' + escapeHtml(message) + '</div></div></div></div></div></section>';
        const renderDots = () => {
          dotsEl.innerHTML = safeArray(screenKeys).map((_, index) => '<span class="crm-live-dot ' + (index === active ? 'is-active' : '') + '"></span>').join('');
        };
        const syncToggle = (paused) => {
          toggleButton.dataset.state = paused ? 'paused' : 'running';
          toggleButton.setAttribute('aria-label', paused ? 'Retomar rotação' : 'Pausar rotação');
          toggleIconEl.innerHTML = ${renderToggleIcon.toString()}(paused);
        };
        const setStatus = (text, tone) => {
          statusEl.textContent = text;
          statusEl.dataset.tone = tone || 'default';
        };
        const storage = (() => { try { return window.sessionStorage; } catch { return null; } })();
        const reloadCoordinator = createBuildReloadCoordinator({
          buildId: pageBuildId,
          reload: () => window.location.reload(),
          storage,
          storageTargetKey: 'csLive:lastReloadTargetBuildId',
          storageTimeKey: 'csLive:lastReloadAtMs',
        });
        const rotationController = createLoopController({
          rotateMs: ROTATE_MS,
          eventScreenMs: 20000,
          buildKeys: (currentPayload) => safeArray(currentPayload?.metrics).map((metric) => metric.key),
          onScreenChange: (state) => {
            active = state.activeIndex;
            screenKeys = state.screenKeys;
            render();
            syncToggle(state.paused);
            reloadCoordinator.setPaused(state.paused);
            reloadCoordinator.noteTransition();
          },
        });
        const render = (fallbackMessage = '') => {
          if (!payload) return;
          const metrics = safeArray(payload.metrics);
          const screens = metrics.map((metric, index) => renderMetricScreen(metric).replace('<section class="crm-live-screen">', '<section class="crm-live-screen ' + (index === active ? 'is-active' : '') + '">'));
          root.innerHTML = screens.join('') || renderSourceStatusScreen(fallbackMessage || 'Sem telas disponíveis.');
          renderDots();
          renderDeadlinePanel();
        };
        const explainError = (status, message) => {
          if (status === 401) return 'Abra a URL completa com token uma vez para ativar o cookie da TV. Depois disso, use /tv/cs-live sem o token.';
          return message || 'O backend não conseguiu montar os dados do CS Live agora.';
        };
        const saveLastGood = (data) => {
          try { localStorage.setItem('csLive:lastGood', JSON.stringify(data)); } catch {}
        };
        const loadLastGood = () => {
          try { const raw = localStorage.getItem('csLive:lastGood'); return raw ? JSON.parse(raw) : null; } catch { return null; }
        };
        const loadData = async () => {
          try {
            const res = await fetch('/api/cs-live-data', { credentials: 'include', cache: 'no-store' });
            const data = await res.json().catch(() => null);
            if (!res.ok || !data) {
              const error = new Error(explainError(res.status, data && data.message));
              error.status = res.status;
              throw error;
            }
            payload = data;
            saveLastGood(data);
            rotationController.setPayload(data);
            if (requestedScreen) {
              const desiredIndex = safeArray(data.metrics).findIndex((metric) => String(metric && metric.key || '') === requestedScreen);
              if (desiredIndex > 0) {
                for (let index = 0; index < desiredIndex; index += 1) rotationController.step(1);
              }
            }
            reloadCoordinator.queueReloadIfNeeded(String(data.buildId || ''));
            setStatus('Atualizado agora · mock ativo', 'default');
          } catch (error) {
            const fallback = loadLastGood();
            if (fallback) {
              payload = fallback;
              rotationController.setPayload(fallback);
              render('Mantendo o último snapshot de exemplo salvo localmente.');
              setStatus('Sem atualização nova · mantendo último snapshot', 'warning');
              return;
            }
            root.innerHTML = renderSourceStatusScreen(explainError(error.status, error.message));
            setStatus('Erro ao carregar o CS Live', 'critical');
          }
        };
        const loadEvents = async () => {
          try {
            await fetch('/api/cs-live-events', { credentials: 'include', cache: 'no-store' });
          } catch {}
        };
        prevButton.addEventListener('click', () => rotationController.step(-1));
        nextButton.addEventListener('click', () => rotationController.step(1));
        toggleButton.addEventListener('click', () => rotationController.togglePaused());
        document.addEventListener('keydown', (event) => {
          if (event.key === 'ArrowLeft') rotationController.step(-1);
          if (event.key === 'ArrowRight') rotationController.step(1);
          if (event.key === ' ' || event.key === 'Enter') rotationController.togglePaused();
        });
        loadData();
        loadEvents();
        setInterval(loadData, POLL_MS);
        setInterval(loadEvents, EVENT_POLL_MS);
        setInterval(() => renderDeadlinePanel(), 1000);
      })();
    </script>
  </body>
</html>`;

module.exports = async (req, res) => handleLiveTvPageRequest(req, res, {
  routePath: "/tv/cs-live",
  cookiePath: "/",
  invalidTokenMessage: "Token inválido ou revogado.",
  unauthorizedMessage: "Acesso CS Live não autorizado.",
  normalizeRole,
  sessionRoles: ["admin", "teacher", "pedagogico"],
  isSecureRequest,
  validateEntryToken,
  validateCookieViewer,
  clearCookie,
  buildReadCookie,
  buildCookie,
  cookieName: CS_LIVE_COOKIE_NAME,
  buildHtml,
  buildId: getCsLiveBuildId(),
});

module.exports.buildHtml = buildHtml;
