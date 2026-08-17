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
  if (["comercial", "closer", "sales"].includes(raw)) return "commercial";
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
        --success: #31d69b;
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
        padding: 3.2vh 4.5vw 3.6vh;
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
        display: block;
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
        gap: 1.8vh;
      }
      .crm-live-head {
        display: block;
        padding-top: .4vh;
      }
      .crm-live-title {
        margin: 0;
        font-size: 3.4vh;
        line-height: 1.1;
        letter-spacing: -.03em;
        font-weight: 400;
        color: var(--text-secondary);
      }
      .crm-live-body {
        min-height: 0;
        display: grid;
        align-items: stretch;
      }
      .crm-live-center {
        height: 100%;
        display: grid;
        align-content: center;
        gap: 3.6vh;
      }
      .crm-live-center.is-spread {
        align-content: stretch;
      }
      .crm-live-stack {
        display: grid;
        gap: 3.2vh;
      }
      .crm-live-metric-block { display: grid; gap: 1.2vh; }
      .crm-live-metric-label {
        color: var(--text-tertiary);
        font-size: 2vh;
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
        font-size: clamp(20vh, 22vh, 26vh);
        line-height: .88;
        letter-spacing: -.08em;
        font-weight: 500;
      }
      .crm-live-metric-value.is-medium { font-size: clamp(12vh, 14vh, 16vh); }
      .crm-live-metric-value.is-small-hero { font-size: clamp(15vh, 17vh, 20vh); }
      .crm-live-metric-side {
        display: grid;
        gap: .55vh;
        padding-bottom: 1.1vh;
      }
      .crm-live-metric-side strong {
        color: var(--text-secondary);
        font-size: 5vh;
        font-weight: 500;
      }
      .crm-live-metric-side span {
        color: var(--text-tertiary);
        font-size: 3.2vh;
        font-weight: 400;
      }
      .crm-live-progress {
        width: min(62vw, 100%);
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
        gap: 2vw;
      }
      .crm-live-support-item { display: grid; gap: .8vh; }
      .crm-live-support-item strong {
        font-size: 5.2vh;
        line-height: .95;
        letter-spacing: -.05em;
        font-weight: 500;
      }
      .crm-live-support-item span {
        color: var(--text-secondary);
        font-size: 3vh;
        line-height: 1.35;
        font-weight: 400;
      }
      .crm-live-state-pill {
        display: inline-flex;
        align-items: center;
        gap: .7vw;
        width: fit-content;
        padding: 1vh 1.4vw;
        border-radius: 999px;
        background: rgba(255,255,255,.04);
        color: var(--text-secondary);
        font-size: 3vh;
        line-height: 1;
        font-weight: 400;
      }
      .crm-live-state-pill strong {
        font-weight: 500;
      }
      .crm-live-state-pill.is-success {
        color: var(--success);
        background: rgba(49, 214, 155, .12);
      }
      .crm-live-state-pill.is-danger {
        color: var(--accent);
        background: rgba(255, 86, 79, .12);
      }
      .crm-live-week-grid,
      .crm-live-highlight-grid,
      .crm-live-last-sale-grid {
        height: 100%;
        display: grid;
        align-items: center;
      }
      .crm-live-week-grid {
        grid-template-columns: minmax(0, 1fr);
        justify-content: center;
        gap: 3vh;
      }
      .crm-live-highlight-grid,
      .crm-live-last-sale-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 6vw;
      }
      .crm-live-column {
        height: 100%;
        display: grid;
        align-content: center;
        gap: 2.4vh;
        min-width: 0;
      }
      .crm-live-column-right {
        justify-items: start;
        text-align: left;
      }
      .crm-live-ranking {
        height: 100%;
        display: grid;
        align-content: center;
        gap: 2.2vh;
      }
      .crm-live-ranking.is-tight {
        gap: 2.2vh;
      }
      .crm-live-ranking.is-fill {
        min-height: 100%;
        grid-auto-rows: 1fr;
        align-content: stretch;
      }
      .crm-live-ranking.has-three-rows {
        gap: 1.6vh;
      }
      .crm-live-ranking-row {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr) auto;
        align-items: center;
        gap: 2vw;
        min-height: 0;
      }
      .crm-live-avatar {
        position: relative;
        flex: 0 0 auto;
        width: 10vh;
        height: 10vh;
        border-radius: 999px;
        overflow: hidden;
        background: rgba(255,255,255,.08);
        color: var(--text);
        display: grid;
        place-items: center;
        font-size: 2.8vh;
        font-weight: 500;
        letter-spacing: .04em;
      }
      .crm-live-avatar-icon {
        width: 62%;
        height: 62%;
        display: block;
      }
      .crm-live-avatar-icon svg {
        width: 100%;
        height: 100%;
        display: block;
        fill: currentColor;
      }
      .crm-live-avatar img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        object-position: center top;
        display: block;
      }
      .crm-live-avatar.is-photo { filter: grayscale(1) brightness(1.12) contrast(.88); }
      .crm-live-avatar.is-aggregate {
        color: rgba(255,255,255,.55);
        background: rgba(255,255,255,.08);
      }
      .crm-live-avatar.is-leader {
        width: 12vh;
        height: 12vh;
        border: .35vh solid var(--accent);
        box-shadow: 0 0 0 .55vh var(--leader-ring);
      }
      .crm-live-avatar.is-leader.is-photo { filter: none; }
      .crm-live-avatar.is-leader.is-aggregate {
        color: var(--accent);
        background: rgba(255,255,255,.12);
      }
      .crm-live-ranking-copy {
        min-width: 0;
        display: grid;
        gap: 1vh;
      }
      .crm-live-ranking-name {
        font-size: 6.4vh;
        line-height: .95;
        letter-spacing: -.05em;
        font-weight: 500;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .crm-live-ranking-row.is-leader .crm-live-ranking-name { font-size: 8vh; }
      .crm-live-ranking.has-three-rows .crm-live-ranking-name { font-size: 5.3vh; }
      .crm-live-ranking.has-three-rows .crm-live-ranking-row.is-leader .crm-live-ranking-name { font-size: 6.4vh; }
      .crm-live-ranking-sub {
        color: var(--text-secondary);
        font-size: 3.4vh;
        line-height: 1.35;
        font-weight: 400;
      }
      .crm-live-ranking.has-three-rows .crm-live-ranking-sub { font-size: 2.9vh; }
      .crm-live-ranking-chase {
        color: var(--text-tertiary);
        font-size: 2.6vh;
        line-height: 1.35;
        font-weight: 400;
      }
      .crm-live-ranking.has-three-rows .crm-live-ranking-chase { font-size: 2.2vh; }
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
        justify-items: end;
      }
      .crm-live-ranking-pct {
        font-size: 9vh;
        line-height: .88;
        letter-spacing: -.08em;
        font-weight: 500;
      }
      .crm-live-ranking-row.is-leader .crm-live-ranking-pct { color: var(--accent); font-size: 12vh; }
      .crm-live-ranking.has-three-rows .crm-live-ranking-pct { font-size: 7.2vh; }
      .crm-live-ranking.has-three-rows .crm-live-ranking-row.is-leader .crm-live-ranking-pct { font-size: 9.4vh; }
      .crm-live-highlight-person {
        display: grid;
        justify-items: start;
        gap: 1.8vh;
      }
      .crm-live-highlight-person.is-center {
        justify-items: center;
        text-align: center;
      }
      .crm-live-highlight-person.is-center .crm-live-avatar {
        width: 30vh;
        height: 30vh;
        font-size: 7vh;
      }
      .crm-live-highlight-person.is-center .crm-live-avatar.is-leader {
        width: 34vh;
        height: 34vh;
      }
      .crm-live-highlight-title {
        font-size: 6.8vh;
        line-height: .95;
        letter-spacing: -.05em;
        font-weight: 500;
        text-align: center;
      }
      .crm-live-highlight-person.is-right {
        justify-items: end;
        text-align: right;
      }
      .crm-live-highlight-name {
        font-size: 8.6vh;
        line-height: .92;
        letter-spacing: -.06em;
        font-weight: 500;
      }
      .crm-live-highlight-value {
        font-size: clamp(16vh, 18vh, 22vh);
        line-height: .9;
        letter-spacing: -.08em;
        font-weight: 500;
      }
      .crm-live-highlight-note {
        color: var(--text-secondary);
        font-size: 3vh;
        line-height: 1.35;
      }
      .crm-live-news {
        height: 100%;
        display: grid;
        grid-template-columns: minmax(22vw, 26vw) minmax(0, 1fr);
        align-items: center;
        gap: 5vw;
      }
      .crm-live-news.is-no-photo {
        grid-template-columns: minmax(0, 1fr);
      }
      .crm-live-news-media {
        display: grid;
        place-items: center;
      }
      .crm-live-news-media .crm-live-avatar {
        width: 24vh;
        height: 24vh;
        font-size: 5.2vh;
      }
      .crm-live-news-copy {
        display: grid;
        gap: 2vh;
        align-content: center;
      }
      .crm-live-news-kicker {
        color: var(--text-tertiary);
        font-size: 2vh;
        letter-spacing: .28em;
        text-transform: uppercase;
        font-weight: 500;
      }
      .crm-live-news-phrase {
        font-size: clamp(7vh, 8vh, 9vh);
        line-height: .98;
        letter-spacing: -.06em;
        font-weight: 500;
        color: var(--text);
        max-width: 48vw;
      }
      .crm-live-news-phrase strong {
        color: var(--text);
        font-weight: 500;
      }
      .crm-live-news-context {
        color: var(--text-secondary);
        font-size: 3.2vh;
        line-height: 1.35;
        font-weight: 400;
        max-width: 44vw;
      }
      .crm-live-duel {
        height: 100%;
        display: grid;
        grid-template-columns: minmax(17vw, 20vw) minmax(32vw, 1fr) minmax(17vw, 20vw);
        align-items: center;
        gap: 7vw;
      }
      .crm-live-duel-side {
        display: grid;
        justify-items: center;
        align-content: center;
        gap: 1vh;
        text-align: center;
      }
      .crm-live-duel-side .crm-live-avatar {
        width: 18vh;
        height: 18vh;
        font-size: 4.2vh;
      }
      .crm-live-duel-side.is-leader .crm-live-avatar {
        border: .45vh solid var(--accent);
        box-shadow: 0 0 0 .7vh var(--leader-ring);
        filter: none;
      }
      .crm-live-duel-name {
        font-size: 5.8vh;
        line-height: .95;
        letter-spacing: -.06em;
        font-weight: 500;
      }
      .crm-live-duel-sub {
        color: var(--text-secondary);
        font-size: 3vh;
        line-height: 1.35;
      }
      .crm-live-duel-center {
        display: grid;
        justify-items: center;
        align-content: center;
        gap: 1.8vh;
        text-align: center;
      }
      .crm-live-duel-center .crm-live-metric-label {
        justify-self: center;
      }
      .crm-live-duel-message {
        font-size: clamp(18vh, 20vh, 24vh);
        line-height: .88;
        letter-spacing: -.08em;
        font-weight: 500;
        max-width: 34vw;
        white-space: nowrap;
      }
      .crm-live-duel-context {
        color: var(--text-secondary);
        font-size: 3.4vh;
        line-height: 1.4;
        max-width: 26vw;
      }
      .crm-live-duel-delta {
        color: var(--text);
      }
      .crm-live-week-countdown {
        display: grid;
        gap: 2.2vh;
        justify-items: center;
      }
      .crm-live-week-countdown .crm-live-metric-value {
        font-size: min(16vw, 22vh);
      }
      .crm-live-week-countdown-main {
        display: flex;
        align-items: baseline;
        justify-content: center;
        gap: 1vw;
        line-height: .9;
        flex-wrap: nowrap;
      }
      .crm-live-week-countdown-number {
        font-size: clamp(20vh, 22vh, 26vh);
        letter-spacing: -.08em;
        font-weight: 500;
        color: inherit;
      }
      .crm-live-week-countdown-unit {
        font-size: 5vh;
        color: var(--text-secondary);
        letter-spacing: -.03em;
        font-weight: 400;
      }
      .crm-live-week-countdown-progress {
        width: min(72vw, 100%);
        height: .9vh;
        border-radius: 999px;
        background: var(--track);
        overflow: hidden;
      }
      .crm-live-week-countdown-progress > span {
        display: block;
        height: 100%;
        width: 0;
        border-radius: inherit;
        background: rgba(255,255,255,.55);
      }
      .crm-live-week-countdown-scale {
        width: min(72vw, 100%);
        display: flex;
        justify-content: space-between;
        gap: 2vw;
        color: var(--text-tertiary);
        font-size: 2.2vh;
        line-height: 1.35;
      }
      .crm-live-week-rails {
        display: grid;
        gap: 2.4vh;
      }
      .crm-live-week-rail {
        display: grid;
        gap: 1vh;
      }
      .crm-live-week-rail-head {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        gap: 2vw;
      }
      .crm-live-week-rail-name {
        font-size: 2.2vh;
        color: var(--text-secondary);
        font-weight: 500;
      }
      .crm-live-week-rail-gap {
        font-size: 2.4vh;
        line-height: 1;
        letter-spacing: -.04em;
        font-weight: 500;
      }
      .crm-live-week-rail-sub {
        color: var(--text-tertiary);
        font-size: 1.55vh;
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
        font-size: 3vh;
        line-height: 1.35;
      }
      .crm-live-last-sale-list {
        display: grid;
        gap: 2.4vh;
        width: min(24vw, 100%);
      }
      .crm-live-last-sale-row {
        display: grid;
        gap: .5vh;
      }
      .crm-live-last-sale-row span {
        color: var(--text-tertiary);
        font-size: 2vh;
        letter-spacing: .24em;
        text-transform: uppercase;
        font-weight: 500;
      }
      .crm-live-last-sale-row strong {
        font-size: 3.6vh;
        line-height: 1.05;
        letter-spacing: -.04em;
        font-weight: 500;
      }
      .crm-live-team-progress {
        height: 100%;
        display: grid;
        align-content: center;
        justify-items: center;
        gap: 1.4vh;
        text-align: center;
      }
      .crm-live-team-progress-hero {
        font-size: clamp(20vh, 22vh, 24vh);
        line-height: .88;
        letter-spacing: -.08em;
        font-weight: 500;
      }
      .crm-live-team-progress-sub {
        color: var(--text-secondary);
        font-size: 3.2vh;
        line-height: 1.35;
      }
      .crm-live-team-progress .crm-live-progress {
        width: min(56vw, 100%);
      }
      .crm-live-pipeline {
        height: 100%;
        display: grid;
        align-content: center;
        gap: 3.6vh;
      }
      .crm-live-pipeline-hero {
        display: flex;
        align-items: baseline;
        gap: 1.2vw;
        flex-wrap: wrap;
      }
      .crm-live-pipeline-total {
        color: var(--accent);
        font-size: clamp(20vh, 22vh, 24vh);
        line-height: .88;
        letter-spacing: -.08em;
        font-weight: 500;
      }
      .crm-live-pipeline-total-note {
        color: var(--text-secondary);
        font-size: 5vh;
        line-height: 1.2;
        font-weight: 400;
      }
      .crm-live-pipeline-sub {
        color: var(--text-secondary);
        font-size: 3vh;
        line-height: 1.35;
        white-space: nowrap;
        margin-bottom: 2.6vh;
      }
      .crm-live-pipeline-list {
        display: grid;
        gap: 2.2vh;
      }
      .crm-live-pipeline-row {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr) auto;
        align-items: center;
        gap: 2vw;
      }
      .crm-live-pipeline-row .crm-live-avatar {
        width: 10vh;
        height: 10vh;
        font-size: 2.8vh;
      }
      .crm-live-pipeline-row.is-leader .crm-live-avatar {
        border: .35vh solid var(--accent);
        box-shadow: 0 0 0 .55vh var(--leader-ring);
      }
      .crm-live-pipeline-row.is-leader strong {
        color: var(--text);
      }
      .crm-live-pipeline-row:not(.is-leader) strong,
      .crm-live-pipeline-row:not(.is-leader) span {
        color: var(--text-secondary);
      }
      .crm-live-pipeline-row strong {
        flex: 1 1 auto;
        font-size: 7.2vh;
        line-height: .95;
        letter-spacing: -.05em;
        font-weight: 500;
      }
      .crm-live-pipeline-row span {
        flex: 0 0 auto;
        color: var(--text);
        font-size: 6.4vh;
        line-height: .95;
        letter-spacing: -.05em;
        font-weight: 500;
        text-align: right;
      }
      .crm-live-footer {
        position: absolute;
        left: 4.5vw;
        right: 4.5vw;
        bottom: 2.4vh;
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 2vw;
        color: var(--text-tertiary);
        font-size: 1.8vh;
        line-height: 1.2;
      }
      .crm-live-footer [data-crm-live-status][data-tone="warning"] {
        color: var(--accent);
      }
      .crm-live-footer [data-crm-live-status][data-tone="critical"] {
        color: var(--accent);
        font-size: 2.6vh;
        letter-spacing: .04em;
      }
      .crm-live-dots {
        display: flex;
        align-items: center;
        gap: .55vw;
      }
      .crm-live-dot {
        width: clamp(1.6vh, 1.8vw, 2.4vh);
        max-width: 2.8vh;
        min-width: 1.4vh;
        height: .35vh;
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
        font-size: 3.2vh;
        line-height: 1.45;
      }
      .crm-live-empty strong {
        display: block;
        margin-bottom: 1.6vh;
        color: var(--text);
        font-size: 6vh;
        line-height: 1;
        letter-spacing: -.04em;
        font-weight: 500;
      }
      .crm-live-interruption {
        position: absolute;
        inset: 0;
        z-index: 20;
        display: none;
      }
      .crm-live-interruption.is-visible {
        display: block;
      }
      .crm-live-interruption-screen {
        width: 100%;
        height: 100%;
        padding: 3.6vh 4.5vw;
        display: grid;
        grid-template-rows: 1fr auto;
      }
      .crm-live-interruption-screen.is-sale {
        background: var(--accent);
        color: #fff6f5;
      }
      .crm-live-interruption-screen.is-generic {
        background:
          radial-gradient(circle at top left, rgba(255,255,255,.08), transparent 26%),
          var(--bg);
        color: var(--text);
      }
      .crm-live-interruption-main {
        display: grid;
        align-content: center;
        justify-items: center;
        text-align: center;
        gap: 0;
      }
      .crm-live-interruption-kicker {
        font-size: 2vh;
        letter-spacing: .28em;
        text-transform: uppercase;
        font-weight: 500;
        opacity: .78;
        color: rgba(13, 16, 20, .72);
        margin-bottom: 7vh;
      }
      .crm-live-interruption-avatar {
        width: 20vh;
        height: 20vh;
        border-radius: 999px;
        overflow: hidden;
        background: rgba(255,255,255,.92);
        display: grid;
        place-items: center;
        font-size: 6.5vh;
        letter-spacing: .04em;
        color: var(--accent);
        margin-bottom: 2.2vh;
      }
      .crm-live-interruption-avatar.is-aggregate {
        color: rgba(13, 16, 20, .58);
      }
      .crm-live-interruption-avatar img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        object-position: center top;
        display: block;
      }
      .crm-live-interruption-name {
        font-size: 6vh;
        line-height: .94;
        letter-spacing: -.06em;
        font-weight: 500;
        margin-bottom: 1.6vh;
      }
      .crm-live-interruption-hero {
        font-size: clamp(20vh, 22vh, 26vh);
        line-height: .86;
        letter-spacing: -.08em;
        font-weight: 500;
        color: #ffffff;
      }
      .crm-live-interruption-plan {
        font-size: 3.4vh;
        line-height: 1.35;
        opacity: .82;
        margin-top: 6.2vh;
      }
      .crm-live-interruption-footer {
        align-self: end;
        min-height: 0;
        padding-top: 2.6vh;
        border-top: 1px solid rgba(255,255,255,.24);
        display: grid;
        gap: 1.2vh;
        justify-items: center;
        text-align: center;
      }
      .crm-live-interruption-footer strong {
        font-size: 3.6vh;
        line-height: 1.08;
        letter-spacing: -.05em;
        font-weight: 500;
      }
      .crm-live-interruption-footer span {
        font-size: 1.8vh;
        line-height: 1.35;
        color: rgba(255,255,255,.74);
        letter-spacing: .24em;
        text-transform: uppercase;
      }
      @media (max-width: 1200px) {
        .crm-live { padding: 4.4vh 5vw 4vh; }
        .crm-live-week-grid,
        .crm-live-highlight-grid,
        .crm-live-last-sale-grid,
        .crm-live-duel,
        .crm-live-news {
          grid-template-columns: 1fr;
          gap: 3vh;
        }
        .crm-live-column-right,
        .crm-live-highlight-person.is-right {
          justify-items: start;
          text-align: left;
        }
        .crm-live-last-sale-list { width: 100%; }
        .crm-live-news-phrase,
        .crm-live-news-context { max-width: none; }
      }
      @media (max-aspect-ratio: 1/1) {
        .crm-live { padding: 4vh 5vw; }
        .crm-live-screen { gap: 2.2vh; }
      }
    </style>
  </head>
  <body>
    <div class="crm-live">
      <div class="crm-live-stage" data-crm-live-root>
        <div class="crm-live-empty" data-crm-live-empty>Carregando CRM Live…</div>
      </div>
      <div class="crm-live-interruption" data-crm-live-interruption></div>
      <div class="crm-live-footer">
        <div data-crm-live-status>Atualizando…</div>
        <div class="crm-live-dots" data-crm-live-dots></div>
      </div>
    </div>
    <script>
      (() => {
        const root = document.querySelector('[data-crm-live-root]');
        const interruptionEl = document.querySelector('[data-crm-live-interruption]');
        const statusEl = document.querySelector('[data-crm-live-status]');
        const dotsEl = document.querySelector('[data-crm-live-dots]');
        const emptyEl = document.querySelector('[data-crm-live-empty]');
        const ROTATE_MS = 10000;
        const POLL_MS = 120000;
        const EVENT_POLL_MS = 25000;
        const EVENT_SCREEN_MS = 20000;
        let payload = null;
        let active = 0;
        let rotateTimer = null;
        let pollTimer = null;
        let eventPollTimer = null;
        let interruptionTimer = null;
        let imageCache = new Map();
        let screenKeys = [];
        let eventQueue = [];
        let activeInterruption = null;

        console.log('[crm-live] viewport', {
          innerWidth: window.innerWidth,
          innerHeight: window.innerHeight,
          devicePixelRatio: window.devicePixelRatio,
        });

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
        const parseDateKeyAtEnd = (dateKey) => {
          const raw = String(dateKey || '').trim();
          if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(raw)) return null;
          const date = new Date(raw + 'T23:59:59-03:00');
          return Number.isNaN(date.getTime()) ? null : date;
        };
        const parseDateKeyAtStart = (dateKey) => {
          const raw = String(dateKey || '').trim();
          if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(raw)) return null;
          const date = new Date(raw + 'T00:00:00-03:00');
          return Number.isNaN(date.getTime()) ? null : date;
        };
        const startOfSaoPauloDay = (date) => {
          const key = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'America/Sao_Paulo',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
          }).format(date);
          return parseDateKeyAtStart(key);
        };
        const getSaoPauloWeekday = (date) => {
          const label = new Intl.DateTimeFormat('en-US', {
            timeZone: 'America/Sao_Paulo',
            weekday: 'short',
          }).format(date);
          const map = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
          return map[label] ?? -1;
        };
        const businessDaysBetween = (startDate, endDate) => {
          if (!(startDate instanceof Date) || !(endDate instanceof Date)) return 0;
          if (endDate.getTime() < startDate.getTime()) return 0;
          let count = 0;
          let cursor = new Date(startDate.getTime());
          while (cursor.getTime() <= endDate.getTime()) {
            const weekday = getSaoPauloWeekday(cursor);
            if (weekday >= 1 && weekday <= 5) count += 1;
            cursor.setUTCDate(cursor.getUTCDate() + 1);
          }
          return count;
        };
        const formatWeekCountdown = (endDate) => {
          if (!(endDate instanceof Date)) return { primaryNumber: '0', primaryUnit: 'horas', secondaryNumber: '00', secondaryUnit: 'min' };
          const diff = Math.max(0, endDate.getTime() - Date.now());
          const totalMinutes = Math.floor(diff / 60000);
          const totalHours = Math.floor(totalMinutes / 60);
          if (totalHours < 24) {
            const hours = Math.floor(totalMinutes / 60);
            const minutes = totalMinutes % 60;
            return {
              primaryNumber: String(hours),
              primaryUnit: 'horas',
              secondaryNumber: String(minutes).padStart(2, '0'),
              secondaryUnit: 'min',
            };
          }
          const days = Math.floor(totalHours / 24);
          const hours = totalHours % 24;
          return {
            primaryNumber: String(days),
            primaryUnit: 'dias',
            secondaryNumber: String(hours),
            secondaryUnit: 'horas',
          };
        };
        const weekElapsedProgress = (startDateKey, endDateKey) => {
          const startDate = parseDateKeyAtStart(startDateKey);
          const endDate = parseDateKeyAtEnd(endDateKey);
          if (!(startDate instanceof Date) || !(endDate instanceof Date)) return 0;
          const total = Math.max(1, endDate.getTime() - startDate.getTime());
          const elapsed = Math.max(0, Math.min(total, Date.now() - startDate.getTime()));
          return (elapsed / total) * 100;
        };
        const weekdayDateLabel = (dateKey, options = {}) => {
          const date = parseDateKeyAtStart(dateKey);
          if (!(date instanceof Date)) return dateKey || '—';
          const includeTime = !!options.includeTime;
          const weekday = new Intl.DateTimeFormat('pt-BR', {
            timeZone: 'America/Sao_Paulo',
            weekday: 'long',
          }).format(date);
          const formatted = weekday + ', ' + dateLabel(dateKey);
          return includeTime ? formatted + ' · 23:59' : formatted;
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
        const isAggregateRow = (row) => !!(row && row.isAggregate);
        const aggregateAvatarSvg = () =>
          '<span class="crm-live-avatar-icon" aria-hidden="true">' +
            '<svg viewBox="0 0 64 64" focusable="false">' +
              '<path d="M32 33c7.4 0 13-5.8 13-13S39.4 7 32 7 19 12.8 19 20s5.6 13 13 13Z"></path>' +
              '<path d="M14 36c4.7 0 8.5-3.7 8.5-8.5S18.7 19 14 19s-8.5 3.8-8.5 8.5S9.3 36 14 36Z" opacity=".72"></path>' +
              '<path d="M50 36c4.7 0 8.5-3.7 8.5-8.5S54.7 19 50 19s-8.5 3.8-8.5 8.5S45.3 36 50 36Z" opacity=".72"></path>' +
              '<path d="M32 37c-9.7 0-17.5 5.9-20.3 14.2-.6 1.8.8 3.8 2.8 3.8h35c2 0 3.4-2 2.8-3.8C49.5 42.9 41.7 37 32 37Z"></path>' +
              '<path d="M14 39c-5.8 0-10.7 3.2-13 8.1-.7 1.6.5 3.4 2.2 3.4H17c.6-4.1 2.1-7.9 4.4-11.5-1.9-.7-4.4 0-7.4 0Z" opacity=".72"></path>' +
              '<path d="M50 39c-3 0-5.5-.7-7.4 0 2.3 3.6 3.8 7.4 4.4 11.5h13.8c1.7 0 2.9-1.8 2.2-3.4-2.3-4.9-7.2-8.1-13-8.1Z" opacity=".72"></path>' +
            '</svg>' +
          '</span>';
        const avatarHtml = (row, options = {}) => {
          const leader = !!options.leader;
          const state = personImageState(row);
          const name = getDisplayName(row) || 'Sem nome';
          const aggregate = isAggregateRow(row);
          const classes = ['crm-live-avatar', leader ? 'is-leader' : '', aggregate ? 'is-aggregate' : '', state.usable ? 'is-photo' : ''].filter(Boolean).join(' ');
          if (aggregate) {
            return '<span class="' + classes + '">' + aggregateAvatarSvg() + '</span>';
          }
          if (state.usable) {
            return '<span class="' + classes + '"><img src="' + escapeHtml(state.src) + '" alt="" onerror="this.parentElement.innerHTML=\\\'' +
              '<span>' + escapeHtml(initials(name)) + '</span>' +
            '\\\'" /></span>';
          }
          return '<span class="' + classes + '"><span>' + escapeHtml(initials(name)) + '</span></span>';
        };
        const interruptionAvatarHtml = (row) => {
          const state = personImageState(row);
          const name = getDisplayName(row) || 'Sem nome';
          if (isAggregateRow(row)) {
            return '<span class="crm-live-interruption-avatar is-aggregate">' + aggregateAvatarSvg() + '</span>';
          }
          if (state.usable) {
            return '<span class="crm-live-interruption-avatar"><img src="' + escapeHtml(state.src) + '" alt="" onerror="this.parentElement.innerHTML=\\\'' +
              '<span>' + escapeHtml(initials(name)) + '</span>' +
            '\\\'" /></span>';
          }
          return '<span class="crm-live-interruption-avatar"><span>' + escapeHtml(initials(name)) + '</span></span>';
        };
        const preloadImages = (rows = []) => {
          safeArray(rows).forEach((row) => {
            const url = getPhotoUrl(row);
            if (!url || imageCache.has(url)) return;
            const img = new Image();
            imageCache.set(url, 'loading');
            img.onload = () => {
              imageCache.set(url, 'loaded');
              if (payload && !activeInterruption) requestAnimationFrame(() => render());
            };
            img.onerror = () => {
              imageCache.set(url, 'error');
              if (payload && !activeInterruption) requestAnimationFrame(() => render());
            };
            img.src = url;
          });
        };
        const preloadFromPayload = (data) => {
          const rows = [];
          rows.push.apply(rows, safeArray(getNested(data, ['weekly', 'closers'], [])));
          rows.push.apply(rows, safeArray(getNested(data, ['weekly', 'sdrs'], [])));
          if (getNested(data, ['highlights', 'closer'], null)) rows.push(data.highlights.closer);
          if (getNested(data, ['highlights', 'sdr'], null)) rows.push(data.highlights.sdr);
          rows.push.apply(rows, safeArray(getNested(data, ['news'], [])).filter(Boolean));
          preloadImages(rows);
        };
        const preloadFromEvents = (events = []) => {
          const rows = safeArray(events).map((event) => ({
            displayName: getNested(event, ['payload', 'displayName'], '') || getNested(event, ['payload', 'closerName'], ''),
            photoURL: getNested(event, ['payload', 'photoURL'], ''),
          }));
          preloadImages(rows);
        };
        const renderDots = () => {
          dotsEl.innerHTML = safeArray(screenKeys).map((_, index) => '<span class="crm-live-dot ' + (index === active ? 'is-active' : '') + '"></span>').join('');
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
            const chaseCopy = role === 'closer'
              ? ((Number(row.missingToGoal || 0) > 0)
                  ? 'faltam ' + moneyShort(row.missingToGoal || 0) + ' para bater a meta'
                  : 'meta individual batida')
              : (leader
                  ? (limited[1] && Number(row.leaderPressureUnits || 0) > 0
                      ? 'pressão de ' + String(row.leaderPressureUnits || 0) + ' reuniões de ' + String(row.leaderPressureFromName || limited[1].displayName || 'quem vem atrás')
                      : 'liderança isolada')
                  : 'faltam ' + String(row.missingToLead || 0) + ' reuniões para ultrapassar ' + String(row.leaderName || 'a liderança'));
            return '<div class="crm-live-ranking-row ' + (leader ? 'is-leader' : '') + '">' +
              avatarHtml(row, { leader }) +
              '<div class="crm-live-ranking-copy">' +
                '<div class="crm-live-ranking-name">' + escapeHtml(row.displayName || '—') + '</div>' +
                '<div class="crm-live-ranking-sub">' + escapeHtml(abbreviateProgress(roleRow)) + '</div>' +
                '<div class="crm-live-ranking-bar"><span style="width:' + clampPercent(row.progressPct || 0).toFixed(1) + '%"></span></div>' +
                '<div class="crm-live-ranking-chase">' + escapeHtml(chaseCopy) + '</div>' +
              '</div>' +
              '<div class="crm-live-ranking-metric">' +
                '<div class="crm-live-ranking-pct">' + escapeHtml(percent(row.progressPct || 0)) + '</div>' +
              '</div>' +
            '</div>';
          }).join('');
        };
        const renderHighlight = (row, options = {}) => {
          const role = options.role || '';
          const alignRight = !!options.alignRight;
          const alignCenter = !!options.alignCenter;
          const hasRow = !!row;
          const person = row || { displayName: 'Sem destaque' };
          const leader = true;
          const metricRow = Object.assign({}, person, { role, actualValue: hasRow ? (row.dailyValue || 0) : 0 });
          return '<div class="crm-live-highlight-person ' + (alignCenter ? 'is-center' : (alignRight ? 'is-right' : '')) + '">' +
            avatarHtml(person, { leader }) +
            '<div class="crm-live-highlight-name">' + escapeHtml(person.displayName || 'Sem destaque') + '</div>' +
            '<div class="crm-live-highlight-value">' + escapeHtml(hasRow ? metricMain(metricRow) : '—') + '</div>' +
            '<div class="crm-live-highlight-note">' + escapeHtml(hasRow ? 'ontem: ' + percent(row.dailyProgressPct || 0) + ' da meta individual' : (role === 'closer' ? 'Sem fechamento' : 'Sem reunião')) + '</div>' +
          '</div>';
        };
        const renderPaceState = (period, summary) => {
          const endDate = parseDateKeyAtEnd(period.endDateKey);
          const startDate = parseDateKeyAtStart(period.startDateKey);
          const todayStart = startOfSaoPauloDay(new Date());
          const totalDays = businessDaysBetween(startDate, endDate);
          const elapsedDays = businessDaysBetween(startDate, todayStart);
          const remainingDays = businessDaysBetween(todayStart, endDate);
          const meta = Number(summary.targetValue || 0);
          const realized = Number(summary.actualValue || 0);
          const missing = Math.max(0, Number(summary.missingValue != null ? summary.missingValue : (meta - realized)));
          const shouldHave = totalDays > 0 ? meta * Math.min(1, elapsedDays / totalDays) : 0;
          const delta = realized - shouldHave;
          const requiredPerDay = remainingDays > 0 ? missing / remainingDays : missing;
          return {
            remainingDays,
            requiredPerDay,
            abovePace: delta >= 0,
            delta,
          };
        };
        const renderGoalScreen = (weekly) => {
          const team = getNested(weekly, ['team', 'closers'], {});
          const period = getNested(weekly, ['commercialWeek'], {});
          const pace = renderPaceState(period, team);
          return '<section class="crm-live-screen">' +
            '<div class="crm-live-shell">' +
              '<div class="crm-live-head">' +
                '<h1 class="crm-live-title">Falta para a meta da semana</h1>' +
              '</div>' +
              '<div class="crm-live-body">' +
                '<div class="crm-live-center">' +
                  renderMetric({
                    label: 'Faltam',
                    value: moneyShort(team.missingValue || 0),
                    sideTitle: moneyShort(team.actualValue || 0) + ' realizado',
                    sideText: percent(team.progressPct || 0),
                    progress: team.progressPct || 0,
                  }) +
                  '<div class="crm-live-support-grid">' +
                    '<div class="crm-live-support-item"><strong>' + escapeHtml(moneyShort(pace.requiredPerDay || 0)) + '</strong><span>Ritmo necessário por dia</span></div>' +
                    '<div class="crm-live-support-item"><strong>' + escapeHtml(moneyShort(team.targetValue || 0)) + '</strong><span>Meta da semana</span></div>' +
                    '<div class="crm-live-support-item"><div class="crm-live-state-pill ' + (pace.abovePace ? 'is-success' : 'is-danger') + '"><strong>' + escapeHtml(pace.abovePace ? 'ACIMA' : 'ABAIXO') + '</strong><span>do ritmo</span></div><span>' + escapeHtml((pace.abovePace ? '+' : '') + moneyShort(pace.delta || 0) + ' vs esperado hoje') + '</span></div>' +
                  '</div>' +
                '</div>' +
              '</div>' +
            '</div>' +
          '</section>';
        };
        const renderWeekScreen = (weekly) => {
          const startDateKey = getNested(weekly, ['commercialWeek', 'startDateKey'], '');
          const endDateKey = getNested(weekly, ['commercialWeek', 'endDateKey'], '');
          const countdown = formatWeekCountdown(parseDateKeyAtEnd(endDateKey));
          const progress = weekElapsedProgress(startDateKey, endDateKey);
          const barColor = progress > 85 ? 'var(--accent)' : progress >= 60 ? 'var(--accent)' : 'rgba(255,255,255,.55)';
          const countColor = progress > 85 ? 'var(--accent)' : 'var(--text-primary)';
          return '<section class="crm-live-screen">' +
          '<div class="crm-live-shell">' +
            '<div class="crm-live-head">' +
              '<h1 class="crm-live-title">Relógio da semana</h1>' +
            '</div>' +
            '<div class="crm-live-body crm-live-week-grid">' +
              '<div class="crm-live-center">' +
                '<div class="crm-live-metric-label">A semana termina em</div>' +
                '<div class="crm-live-week-countdown-main" style="color:' + escapeHtml(countColor) + '">' +
                  '<span class="crm-live-week-countdown-number">' + escapeHtml(countdown.primaryNumber) + '</span>' +
                  '<span class="crm-live-week-countdown-unit">' + escapeHtml(countdown.primaryUnit) + '</span>' +
                  '<span class="crm-live-week-countdown-number">' + escapeHtml(countdown.secondaryNumber) + '</span>' +
                  '<span class="crm-live-week-countdown-unit">' + escapeHtml(countdown.secondaryUnit) + '</span>' +
                '</div>' +
                '<div class="crm-live-week-countdown-progress"><span style="width:' + clampPercent(progress).toFixed(1) + '%; background:' + escapeHtml(barColor) + '"></span></div>' +
                '<div class="crm-live-week-countdown-scale"><span>' + escapeHtml(weekdayDateLabel(startDateKey)) + '</span><span>' + escapeHtml(weekdayDateLabel(endDateKey, { includeTime: true })) + '</span></div>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</section>';
        };
        const renderClosersScreen = (weekly) => {
          const rows = safeArray(weekly.closers).filter((row) => !row.isAggregate).slice(0, 2);
          if (rows.length < 2) {
            return '<section class="crm-live-screen"><div class="crm-live-shell"><div class="crm-live-head"><h1 class="crm-live-title">Duelo dos closers</h1></div><div class="crm-live-body"><div class="crm-live-empty"><div><strong>Sem duelo</strong><div>Cadastre ao menos dois closers com meta nesta semana.</div></div></div></div></div></section>';
          }
          const leader = rows[0];
          const challenger = rows[1];
          const needed = Math.max(0, Number(challenger.missingToLead || 0));
          return '<section class="crm-live-screen">' +
            '<div class="crm-live-shell">' +
              '<div class="crm-live-head">' +
                '<h1 class="crm-live-title">Duelo dos closers</h1>' +
              '</div>' +
              '<div class="crm-live-body">' +
                '<div class="crm-live-duel">' +
                  '<div class="crm-live-duel-side is-leader">' +
                    avatarHtml(leader, { leader: true }) +
                    '<div class="crm-live-duel-name">' + escapeHtml(leader.displayName || '—') + '</div>' +
                    '<div class="crm-live-duel-sub">' + escapeHtml(abbreviateProgress({ ...leader, role: 'closer' })) + '</div>' +
                    '<div class="crm-live-duel-sub">' + escapeHtml(percent(leader.progressPct || 0)) + '</div>' +
                  '</div>' +
                  '<div class="crm-live-duel-center">' +
                    '<div class="crm-live-metric-label">Distância para a virada</div>' +
                    '<div class="crm-live-duel-message"><span class="crm-live-duel-delta">' + escapeHtml(moneyShort(needed)) + '</span></div>' +
                    '<div class="crm-live-duel-context">' + escapeHtml('para ' + String(challenger.displayName || 'o desafiante') + ' assumir a liderança') + '</div>' +
                  '</div>' +
                  '<div class="crm-live-duel-side">' +
                    avatarHtml(challenger, { leader: false }) +
                    '<div class="crm-live-duel-name">' + escapeHtml(challenger.displayName || '—') + '</div>' +
                    '<div class="crm-live-duel-sub">' + escapeHtml(abbreviateProgress({ ...challenger, role: 'closer' })) + '</div>' +
                    '<div class="crm-live-duel-sub">' + escapeHtml(percent(challenger.progressPct || 0)) + '</div>' +
                  '</div>' +
                '</div>' +
              '</div>' +
            '</div>' +
          '</section>';
        };
        const renderRankingScreen = ({ title, rows, role }) => '<section class="crm-live-screen">' +
          '<div class="crm-live-shell">' +
            '<div class="crm-live-head">' +
              '<h1 class="crm-live-title">' + escapeHtml(title) + '</h1>' +
            '</div>' +
            '<div class="crm-live-body"><div class="crm-live-ranking ' + ((role === 'closer' && safeArray(rows).length <= 2) ? '' : 'is-fill') + ' ' + ((role === 'closer' && safeArray(rows).length >= 3) ? 'has-three-rows' : '') + '">' + renderRankingRows(rows, { role: role }) + '</div></div>' +
          '</div>' +
        '</section>';
        const renderTeamProgressScreen = ({ title, actual, target, noun }) => {
          const progress = target > 0 ? (Number(actual || 0) / Number(target || 0)) * 100 : 0;
          return '<section class="crm-live-screen">' +
            '<div class="crm-live-shell">' +
              '<div class="crm-live-head">' +
                '<h1 class="crm-live-title">' + escapeHtml(title) + '</h1>' +
              '</div>' +
              '<div class="crm-live-body">' +
                '<div class="crm-live-center">' +
                  '<div class="crm-live-team-progress-hero">' + escapeHtml(String(actual || 0)) + ' / ' + escapeHtml(String(target || 0)) + '</div>' +
                  '<div class="crm-live-team-progress-sub">' + escapeHtml(noun) + '</div>' +
                  '<div class="crm-live-progress"><span style="width:' + clampPercent(progress).toFixed(1) + '%"></span></div>' +
                '</div>' +
              '</div>' +
            '</div>' +
          '</section>';
        };
        const renderPipelineScreen = (pipeline) => {
          const rows = safeArray(pipeline?.rows).slice(0, 5);
          if (!rows.length) return '';
          const totalValue = rows.reduce((sum, row) => sum + (Number(row.value || 0) || 0), 0);
          return '<section class="crm-live-screen">' +
            '<div class="crm-live-shell">' +
              '<div class="crm-live-body">' +
                '<div class="crm-live-center">' +
                  '<div class="crm-live-pipeline">' +
                    '<div class="crm-live-metric-label">Dinheiro na mesa</div>' +
                    '<div class="crm-live-pipeline-hero">' +
                      '<div class="crm-live-pipeline-total">' + escapeHtml(moneyShort(totalValue)) + '</div>' +
                      '<div class="crm-live-pipeline-total-note">esperando fechamento</div>' +
                    '</div>' +
                    '<div class="crm-live-pipeline-sub">aberto em Forecast e Pagamento Parcial · movimentado nos últimos 10 dias</div>' +
                    '<div class="crm-live-pipeline-list">' +
                      rows.map((row, index) =>
                        '<div class="crm-live-pipeline-row ' + (index === 0 ? 'is-leader' : '') + '">' +
                          avatarHtml(row, { leader: false }) +
                          '<strong>' + escapeHtml(row.displayName || 'Sem responsável') + '</strong>' +
                          '<span>' + escapeHtml(moneyShort(row.value || 0)) + '</span>' +
                        '</div>'
                      ).join('') +
                    '</div>' +
                  '</div>' +
                '</div>' +
              '</div>' +
            '</div>' +
          '</section>';
        };
        const renderHighlightScreen = ({ title, row, role }) => '<section class="crm-live-screen">' +
          '<div class="crm-live-shell">' +
            '<div class="crm-live-body">' +
              '<div class="crm-live-center">' +
                '<div class="crm-live-highlight-title">' + escapeHtml(title) + '</div>' +
                renderHighlight(row, { role, alignCenter: true }) +
              '</div>' +
            '</div>' +
          '</div>' +
        '</section>';
        const renderNewsScreen = (item) => {
          if (!item || typeof item !== 'object' || !item.type) return '';
          const media = item.personName ? '<div class="crm-live-news-media">' + avatarHtml({ displayName: item.personName, photoURL: item.photoURL || '' }, { leader: true }) + '</div>' : '';
          const withPhoto = !!item.personName;
          let title = 'Notícia';
          let phrase = '';
          let context = '';
          if (item.type === 'pressure_leader') {
            title = 'Pressão no líder';
            phrase = '<strong>' + escapeHtml(item.personName || 'Líder') + '</strong>, mais ' + escapeHtml(moneyShort(item.leaderPressureUnits || 0)) + ' e ' + escapeHtml(item.challengerName || 'o vice') + ' te passa.';
            context = 'A vantagem atual está no percentual da meta individual, não no valor bruto.';
          } else if (item.type === 'week_projection') {
            title = 'Projeção da semana';
            phrase = item.beatsTarget
              ? 'No ritmo de hoje, a semana fecha em <strong>' + escapeHtml(moneyShort(item.projected || 0)) + '</strong>. Meta batida.'
              : 'No ritmo de hoje, a semana fecha em <strong>' + escapeHtml(moneyShort(item.projected || 0)) + '</strong>. A meta é ' + escapeHtml(moneyShort(item.target || 0)) + '.';
            context = 'Média diária projetada até terça 23:59.';
          } else if (item.type === 'sales_to_lead') {
            title = 'Faltam vendas';
            phrase = 'Faltam <strong>' + escapeHtml(String(item.salesNeeded || 0)) + ' ' + ((Number(item.salesNeeded || 0) === 1) ? 'venda' : 'vendas') + '</strong> para ' + escapeHtml(item.personName || 'o closer') + ' assumir a liderança.';
            context = 'Conta baseada no ticket médio real do período: ' + escapeHtml(moneyShort(item.ticketMedio || 0)) + '.';
          } else if (item.type === 'personal_best') {
            title = 'Recorde pessoal';
            phrase = '<strong>' + escapeHtml(item.personName || 'Pessoa') + '</strong> está a ' + escapeHtml(String(item.remaining || 0)) + ' ' + ((Number(item.remaining || 0) === 1) ? 'reunião' : 'reuniões') + ' do melhor dele na semana.';
            context = 'Melhor marca anterior: ' + escapeHtml(String(item.historicalBest || 0)) + ' reuniões.';
          } else {
            return '';
          }
          const kicker = '';
          return '<section class="crm-live-screen">' +
            '<div class="crm-live-shell">' +
              '<div class="crm-live-head"><h1 class="crm-live-title">' + escapeHtml(title) + '</h1></div>' +
              '<div class="crm-live-body">' +
                '<div class="crm-live-news ' + (withPhoto ? '' : 'is-no-photo') + '">' +
                  (withPhoto ? media : '') +
                  '<div class="crm-live-news-copy">' +
                    (kicker ? '<div class="crm-live-news-kicker">' + escapeHtml(kicker) + '</div>' : '') +
                    '<div class="crm-live-news-phrase">' + phrase + '</div>' +
                    '<div class="crm-live-news-context">' + escapeHtml(context) + '</div>' +
                  '</div>' +
                '</div>' +
              '</div>' +
            '</div>' +
          '</section>';
        };
        const renderInterruption = (event) => {
          if (!interruptionEl || !event) return;
          const type = String(event.type || '').trim();
          if (type === 'sale_closed') {
            const payload = event.payload || {};
            const gapText = moneyShort(Math.max(0, Number(payload.weekGap || 0)));
            interruptionEl.innerHTML =
              '<div class="crm-live-interruption-screen is-sale">' +
                '<div class="crm-live-interruption-main">' +
                  '<div class="crm-live-interruption-kicker">Venda fechada</div>' +
                  interruptionAvatarHtml({ displayName: payload.closerName || 'Closer', photoURL: payload.photoURL || '', isAggregate: !!payload.isAggregate }) +
                  '<div class="crm-live-interruption-name">' + escapeHtml(payload.closerName || 'Sem responsável') + '</div>' +
                  '<div class="crm-live-interruption-hero">' + escapeHtml(moneyShort(payload.value || 0)) + '</div>' +
                '</div>' +
                '<div class="crm-live-interruption-footer">' +
                  '<span>Próximo alvo da semana</span>' +
                  '<strong>' + escapeHtml(payload.planName || 'Plano não informado') + ' · Faltam ' + escapeHtml(gapText) + ' para bater a semana</strong>' +
                '</div>' +
              '</div>';
            interruptionEl.classList.add('is-visible');
            return;
          }
          const payload = event.payload || {};
          const titleMap = {
            individual_goal_hit: 'Meta individual batida',
            leader_changed: 'Virada de liderança',
            team_goal_hit: 'Meta da semana batida',
          };
          const subtitleMap = {
            individual_goal_hit: percent(payload.progressPct || 0) + ' da meta individual',
            leader_changed: 'novo líder do ranking ' + (event.leaderboard === 'sdrs' ? 'dos SDRs' : 'dos closers'),
            team_goal_hit: (payload.team === 'sdrs' ? 'Time de SDRs' : 'Time de closers') + ' bateu a meta semanal',
          };
          interruptionEl.innerHTML =
            '<div class="crm-live-interruption-screen is-generic">' +
              '<div class="crm-live-interruption-main">' +
                '<div class="crm-live-interruption-kicker">' + escapeHtml(titleMap[type] || 'Evento do CRM Live') + '</div>' +
                interruptionAvatarHtml({ displayName: payload.displayName || payload.team || 'Time', photoURL: payload.photoURL || '', isAggregate: !!payload.isAggregate }) +
                '<div class="crm-live-interruption-name">' + escapeHtml(payload.displayName || (payload.team === 'sdrs' ? 'Time de SDRs' : payload.team === 'closers' ? 'Time de closers' : 'Atualização do placar')) + '</div>' +
                '<div class="crm-live-interruption-hero">' + escapeHtml(type === 'leader_changed' || type === 'individual_goal_hit' ? percent(payload.progressPct || 0) : (payload.team === 'sdrs' ? String(payload.actualValue || 0) : moneyShort(payload.actualValue || 0))) + '</div>' +
                '<div class="crm-live-interruption-plan">' + escapeHtml(subtitleMap[type] || '') + '</div>' +
              '</div>' +
              '<div class="crm-live-interruption-footer">' +
                '<span>Atualização automática</span>' +
                '<strong>O placar volta em instantes</strong>' +
              '</div>' +
            '</div>';
          interruptionEl.classList.add('is-visible');
        };
        const clearInterruption = () => {
          if (!interruptionEl) return;
          interruptionEl.classList.remove('is-visible');
          interruptionEl.innerHTML = '';
          activeInterruption = null;
        };
        const pauseRotation = () => {
          if (rotateTimer) {
            clearInterval(rotateTimer);
            rotateTimer = null;
          }
        };
        const playNextInterruption = () => {
          if (activeInterruption || !eventQueue.length) return;
          activeInterruption = eventQueue.shift();
          pauseRotation();
          renderInterruption(activeInterruption);
          if (interruptionTimer) clearTimeout(interruptionTimer);
          interruptionTimer = setTimeout(() => {
            clearInterruption();
            if (eventQueue.length) {
              playNextInterruption();
            } else if (payload) {
              render();
              scheduleRotation();
            }
          }, EVENT_SCREEN_MS);
        };
        const enqueueEvents = (events = []) => {
          const currentIds = new Set([activeInterruption?.id, ...eventQueue.map((event) => event?.id)].filter(Boolean));
          safeArray(events).forEach((event) => {
            if (!event || !event.id || currentIds.has(event.id)) return;
            currentIds.add(event.id);
            eventQueue.push(event);
          });
          if (!activeInterruption) playNextInterruption();
        };
        const buildScreenKeys = (currentPayload) => {
          const keys = ['closers', 'sdrs', 'goal', 'week'];
          if (Number(getNested(currentPayload, ['weekly', 'team', 'sdrs', 'targetValue'], 0)) > 0) keys.push('team_sdr');
          if (safeArray(getNested(currentPayload, ['pipeline', 'rows'], [])).length) keys.push('pipeline');
          safeArray(getNested(currentPayload, ['news'], [])).forEach((item, index) => {
            if (item && item.type) keys.push('news_' + index);
          });
          const closerHighlight = getNested(currentPayload, ['highlights', 'closer'], null);
          const sdrHighlight = getNested(currentPayload, ['highlights', 'sdr'], null);
          if (closerHighlight && Number(closerHighlight.dailyValue || 0) > 0) keys.push('highlight_closer');
          if (sdrHighlight && Number(sdrHighlight.dailyValue || 0) > 0) keys.push('highlight_sdr');
          keys.push('duel');
          return keys;
        };
        const render = () => {
          if (!payload) return;
          const month = payload.month || {};
          const weekly = payload.weekly || {};
          const highlight = payload.highlights || {};
          const pipeline = payload.pipeline || {};
          const news = safeArray(payload.news);
          screenKeys = buildScreenKeys(payload);
          if (!screenKeys.length) screenKeys = ['goal'];
          if (active >= screenKeys.length) active = 0;
          const screens = {
            goal: renderGoalScreen(weekly),
            week: renderWeekScreen(weekly),
            closers: renderRankingScreen({ title: 'Ranking dos closers', rows: weekly.closers, role: 'closer' }),
            sdrs: renderRankingScreen({ title: 'Ranking dos SDRs', rows: weekly.sdrs, role: 'sdr' }),
            duel: renderClosersScreen(weekly),
            team_sdr: renderTeamProgressScreen({
              title: 'Meta de reuniões do time',
              actual: getNested(weekly, ['team', 'sdrs', 'actualValue'], 0),
              target: getNested(weekly, ['team', 'sdrs', 'targetValue'], 0),
              noun: 'reuniões feitas na semana',
            }),
            pipeline: renderPipelineScreen(pipeline),
            highlight_closer: renderHighlightScreen({ title: 'Closer destaque de ontem', row: highlight.closer, role: 'closer' }),
            highlight_sdr: renderHighlightScreen({ title: 'SDR destaque de ontem', row: highlight.sdr, role: 'sdr' }),
          };
          news.forEach((item, index) => {
            screens['news_' + index] = renderNewsScreen(item);
          });
          root.innerHTML = safeArray(screenKeys).map((key, index) => screens[key].replace('<section class="crm-live-screen">', '<section class="crm-live-screen ' + (index === active ? 'is-active' : '') + '">')).join('');
          renderDots();
          if (emptyEl) emptyEl.remove();
        };
        const setStatus = (text, tone) => {
          if (!statusEl) return;
          statusEl.textContent = text;
          statusEl.dataset.tone = tone || 'default';
        };
        const staleTimestampLabel = (value) => {
          const date = value ? new Date(String(value)) : null;
          if (!date || Number.isNaN(date.getTime())) return '';
          const now = new Date();
          const sameYear = now.getFullYear() === date.getFullYear();
          const sameMonth = now.getMonth() === date.getMonth();
          const sameDate = now.getDate() === date.getDate();
          const yesterday = new Date(now);
          yesterday.setDate(now.getDate() - 1);
          const isYesterday = yesterday.getFullYear() === date.getFullYear() && yesterday.getMonth() === date.getMonth() && yesterday.getDate() === date.getDate();
          const time = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(date);
          if (sameDate && sameMonth && sameYear) return 'dados de ' + time;
          if (isYesterday) return 'dados de ' + time + ' de ontem';
          return 'dados de ' + new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(date);
        };
        const buildStatusText = (data, fallbackMode) => {
          const staleAgeMinutes = Math.max(0, Number(getNested(data, ['staleAgeMinutes'], 0) || 0));
          const snapshotGeneratedAt = getNested(data, ['snapshotGeneratedAt'], '') || getNested(data, ['generatedAt'], '');
          if (fallbackMode) {
            if (staleAgeMinutes > 180) {
              return {
                text: staleTimestampLabel(snapshotGeneratedAt) || ('dados defasados · ' + String(staleAgeMinutes) + ' min'),
                tone: 'critical',
              };
            }
            if (staleAgeMinutes > 30) {
              return {
                text: 'Sem atualização nova · mantendo última tela boa',
                tone: 'warning',
              };
            }
            return {
              text: 'Sem atualização nova · mantendo última tela boa',
              tone: 'default',
            };
          }
          if (data.stale) {
            if (staleAgeMinutes > 180) {
              return {
                text: staleTimestampLabel(snapshotGeneratedAt) || ('Exibindo último snapshot útil · ' + String(staleAgeMinutes) + ' min'),
                tone: 'critical',
              };
            }
            if (staleAgeMinutes > 30) {
              return {
                text: 'Exibindo último snapshot útil · ' + String(staleAgeMinutes) + ' min',
                tone: 'warning',
              };
            }
            return {
              text: 'Exibindo último snapshot útil · ' + String(staleAgeMinutes) + ' min',
              tone: 'default',
            };
          }
          return {
            text: 'Atualizado ' + dateTimeLabel(data.generatedAt),
            tone: 'default',
          };
        };
        const rotate = () => {
          if (!payload) return;
          active = (active + 1) % screenKeys.length;
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
            const status = buildStatusText(data, false);
            setStatus(status.text, status.tone);
          } catch (error) {
            const fallback = loadLastGood();
            if (fallback) {
              payload = fallback;
              preloadFromPayload(fallback);
              render();
              if (!activeInterruption) scheduleRotation();
              const status = buildStatusText(fallback, true);
              setStatus(status.text, status.tone);
              return;
            }
            const explained = explainError(error && error.status, error && error.errorCode, error && error.message);
            showError(explained.title, explained.body);
            setStatus(((error && error.status) ? 'Erro ' + String(error.status) + ' · ' : '') + ((error && error.errorCode) || 'sem snapshot'), 'critical');
          }
        };
        const loadEvents = async () => {
          try {
            const res = await fetch('/api/crm-live-events', { credentials: 'include', cache: 'no-store' });
            const data = await res.json().catch(() => null);
            if (!res.ok || !data) return;
            if (data.coldStart) return;
            preloadFromEvents(data.events || []);
            enqueueEvents(data.events || []);
          } catch (error) {
          }
        };
        loadData();
        pollTimer = setInterval(loadData, POLL_MS);
        loadEvents();
        eventPollTimer = setInterval(loadEvents, EVENT_POLL_MS);
        document.addEventListener('visibilitychange', () => {
          if (!document.hidden) {
            loadData();
            loadEvents();
          }
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
  const cookieViewer = role === "admin" || role === "growth" || role === "commercial" ? { ok: true } : await validateCookieViewer(req);
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
