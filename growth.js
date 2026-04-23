const FIREBASE_CONFIG = {
  apiKey: "AIzaSyD0qyhYh6MWRPMRDN_SYqdDEeogS3thQPE",
  authDomain: "plataforma-space.firebaseapp.com",
  projectId: "plataforma-space",
  storageBucket: "plataforma-space.firebasestorage.app",
  messagingSenderId: "984031970274",
  appId: "1:984031970274:web:fff5da2fe5e318b04aefbb",
  measurementId: "G-X28MKDJPKE",
};

const session = window.__SPACE_SESSION__ && typeof window.__SPACE_SESSION__ === "object" ? window.__SPACE_SESSION__ : null;

const userNameEl = document.querySelector("[data-growth-user-name]");
const userAvatarEl = document.querySelector("[data-growth-avatar]");
const monthLabelEl = document.querySelector("[data-growth-month]");

const getInitials = (rawName) => {
  const name = String(rawName || "").trim();
  if (!name) return "GR";
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};

const capitalizeFirst = (value) => {
  const str = String(value || "").trim();
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
};

if (userNameEl instanceof HTMLElement) {
  const name = typeof session?.name === "string" ? session.name.trim() : "";
  userNameEl.textContent = name ? name : "Growth";
}

if (userAvatarEl instanceof HTMLElement) {
  userAvatarEl.textContent = getInitials(session?.name);
}

if (monthLabelEl instanceof HTMLElement) {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    month: "long",
    year: "numeric",
  });
  const formatted = capitalizeFirst(formatter.format(now));
  monthLabelEl.textContent = `Gestão à vista do mês · ${formatted}`;
}

const sidebarToggle = document.querySelector("[data-sidebar-toggle]");

let sidebarExpanded = false;

const setSidebarExpanded = (next) => {
  const expanded = Boolean(next);
  sidebarExpanded = expanded;
  document.body.dataset.sidebarExpanded = expanded ? "true" : "false";
  if (sidebarToggle instanceof HTMLButtonElement) {
    sidebarToggle.setAttribute("aria-expanded", String(expanded));
    sidebarToggle.setAttribute("aria-label", expanded ? "Fechar barra lateral" : "Abrir barra lateral");
  }
};

setSidebarExpanded(false);

if (sidebarToggle instanceof HTMLButtonElement) {
  sidebarToggle.addEventListener("click", () => {
    setSidebarExpanded(!sidebarExpanded);
  });
}

let firebaseAuthPromise = null;

const loadFirebaseAuth = () => {
  if (firebaseAuthPromise) return firebaseAuthPromise;

  firebaseAuthPromise = Promise.all([
    import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js"),
    import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js"),
  ]).then(([appMod, authMod]) => {
    const getOrInitApp = () => {
      try {
        return appMod.getApp();
      } catch (error) {
        return appMod.initializeApp(FIREBASE_CONFIG);
      }
    };

    const app = getOrInitApp();
    const auth = authMod.getAuth(app);

    return { auth, signOut: authMod.signOut, onAuthStateChanged: authMod.onAuthStateChanged };
  });

  return firebaseAuthPromise;
};

const waitForFirebaseAuthReady = async (api, timeoutMs = 3500) => {
  if (!api || !api.auth || typeof api.onAuthStateChanged !== "function") return null;
  if (api.auth.currentUser) return api.auth.currentUser;

  const safeTimeout = Number.isFinite(Number(timeoutMs)) && Number(timeoutMs) > 0 ? Number(timeoutMs) : 3500;

  return new Promise((resolve) => {
    let settled = false;
    let unsub = null;

    const finish = (user) => {
      if (settled) return;
      settled = true;
      try {
        if (typeof unsub === "function") unsub();
      } catch (error) {
        // ignore
      }
      resolve(user || null);
    };

    unsub = api.onAuthStateChanged(api.auth, (user) => finish(user));
    window.setTimeout(() => finish(null), safeTimeout);
  });
};

const waitForAuthToken = async (api, timeoutMs = 12000) => {
  if (!api || !api.auth || typeof api.onAuthStateChanged !== "function") {
    // eslint-disable-next-line no-console
    console.log("[waitForAuthToken] iniciado (firebase inválido)");
    throw new Error("not-authenticated");
  }

  const ms = Number(timeoutMs);
  const safeTimeout = Number.isFinite(ms) && ms > 0 ? ms : 12000;

  return new Promise((resolve, reject) => {
    // eslint-disable-next-line no-console
    console.log("[waitForAuthToken] iniciado");
    let settled = false;
    let unsub = null;

    const finish = (err, token) => {
      if (settled) return;
      settled = true;
      try {
        if (typeof unsub === "function") unsub();
      } catch (e) {
        // ignore
      }
      if (err) reject(err);
      else resolve(String(token || ""));
    };

    const timer = window.setTimeout(() => finish(new Error("not-authenticated"), ""), safeTimeout);

    unsub = api.onAuthStateChanged(api.auth, async (user) => {
      // eslint-disable-next-line no-console
      console.log("[waitForAuthToken] user:", user?.uid ?? "null");
      window.clearTimeout(timer);
      if (!user || typeof user.getIdToken !== "function") {
        finish(new Error("not-authenticated"), "");
        return;
      }
      try {
        const token = await user.getIdToken(true);
        finish(null, token);
      } catch (e) {
        finish(e, "");
      }
    });
  });
};

let cachedFirebaseIdToken = {
  uid: "",
  token: "",
  expiresAt: 0,
};

const getFirebaseIdTokenForApi = async (forceRefresh = false) => {
  try {
    const api = await loadFirebaseAuth();
    if (forceRefresh) {
      const token = await waitForAuthToken(api, 12000);
      const user = api?.auth?.currentUser;
      const uid = user ? String(user.uid || "") : "";
      const now = Date.now();
      cachedFirebaseIdToken = { uid, token: String(token || ""), expiresAt: now + 180_000 };
      return cachedFirebaseIdToken.token;
    }

    const user = await waitForFirebaseAuthReady(api, 3500);
    if (!user || typeof user.getIdToken !== "function") return "";

    const uid = String(user.uid || "");
    const now = Date.now();
    if (!forceRefresh && cachedFirebaseIdToken.uid === uid && cachedFirebaseIdToken.token && cachedFirebaseIdToken.expiresAt > now) {
      return cachedFirebaseIdToken.token;
    }

    const token = await user.getIdToken(false);
    cachedFirebaseIdToken = {
      uid,
      token: String(token || ""),
      expiresAt: now + 180_000,
    };
    return cachedFirebaseIdToken.token;
  } catch (error) {
    if (forceRefresh) throw error;
    return "";
  }
};

const fetchWithAuth = async (input, init = {}) => {
  const opts = init && typeof init === "object" ? init : {};
  const headers = new Headers(opts.headers || {});
  const force = Boolean(opts.forceRefreshIdToken);
  const token = await getFirebaseIdTokenForApi(force);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (Object.prototype.hasOwnProperty.call(opts, "forceRefreshIdToken")) delete opts.forceRefreshIdToken;
  return fetch(input, { ...opts, headers, credentials: opts.credentials || "include" });
};

const logoutButtons = Array.from(document.querySelectorAll("[data-growth-logout]")).filter(
  (el) => el instanceof HTMLButtonElement
);

const setLogoutButtonsDisabled = (isDisabled) => {
  logoutButtons.forEach((btn) => {
    btn.disabled = Boolean(isDisabled);
  });
};

logoutButtons.forEach((btn) => {
  btn.addEventListener("click", async () => {
    setLogoutButtonsDisabled(true);

    try {
      const api = await loadFirebaseAuth();
      await api.signOut(api.auth);
    } catch (error) {
      // Best-effort: if Firebase isn't available, still clear the session cookie below.
    }

    try {
      await fetch("/api/logout", { method: "POST", credentials: "include" });
    } catch (error) {
      // ignore
    }

    window.location.replace("/");
  });
});

/* =========================
   Métricas (Growth Dashboard)
   ========================= */

const dashboardRoot = document.querySelector("[data-growth-dashboard]");
const dashboardResultGrid = document.querySelector(
  '.growth-v2-section[aria-label="Resultado do mês"] .growth-v2-grid'
);
const dashboardIndicatorsPrimaryGrid = document.querySelector(
  '.growth-v2-section[aria-label="Indicadores comerciais"] .growth-v2-grid.growth-v2-grid-4'
);
const dashboardIndicatorsSecondaryGrid = document.querySelector(
  '.growth-v2-section[aria-label="Indicadores comerciais"] .growth-v2-grid.growth-v2-grid-3'
);

const parseMoneyLoose = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return NaN;
  const sanitized = raw.replace(/[^\d.,-]/g, "");
  let normalized = sanitized;
  if (normalized.includes(",")) {
    normalized = normalized.replace(/\./g, "").replace(/,/g, ".");
  } else if (normalized.includes(".")) {
    const parts = normalized.split(".");
    const last = parts[parts.length - 1] || "";
    if (parts.length > 2 || last.length === 3) normalized = parts.join("");
  }
  const n = Number(normalized);
  return Number.isFinite(n) ? n : NaN;
};

const formatPercentPtBr = (value, decimals = 1) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  const d = Number.isFinite(Number(decimals)) ? Number(decimals) : 1;
  return `${n.toFixed(Math.max(0, Math.min(d, 2))).replace(".", ",")}%`;
};

const formatMoneyNoCentsPtBr = (value) => {
  try {
    const n = Number(value);
    if (!Number.isFinite(n)) return "—";
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 0,
      minimumFractionDigits: 0,
    }).format(n);
  } catch (error) {
    return "—";
  }
};

const getInitialsShort = (rawName) => {
  const name = String(rawName || "").trim();
  if (!name) return "--";
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};

const planLabelForUi = (raw) => {
  const name = String(raw || "").toLowerCase();
  if (name.includes("diamond")) return "Diamond";
  if (name.includes("gold")) return "Gold";
  if (name.includes("turma")) return "Turma";
  return "Sem plano";
};

const buildPlansPieBackground = ({ turma = 0, gold = 0, diamond = 0 } = {}) => {
  const t = Math.max(0, Number(turma) || 0);
  const g = Math.max(0, Number(gold) || 0);
  const d = Math.max(0, Number(diamond) || 0);
  const total = t + g + d;
  if (total <= 0) {
    return "conic-gradient(rgba(255,255,255,0.06) 0deg 360deg)";
  }

  const tDeg = (t / total) * 360;
  const gDeg = (g / total) * 360;
  const a1 = tDeg;
  const a2 = tDeg + gDeg;

  // Keep the same palette used in CSS for the dashboard.
  const cTurma = "rgba(251, 191, 36, 0.92)";
  const cGold = "rgba(89, 144, 189, 0.92)";
  const cDiamond = "rgba(255, 78, 70, 0.92)";

  return `conic-gradient(${cTurma} 0deg ${a1}deg, ${cGold} ${a1}deg ${a2}deg, ${cDiamond} ${a2}deg 360deg)`;
};

const adjustGrowthDashboardLayout = () => {
  if (!(dashboardRoot instanceof HTMLElement)) return;

  // Move Forecast card to "Resultado do mês" to match the visual hierarchy (no backend changes).
  const forecastValue = document.querySelector('[data-growth-indicator="forecast"]');
  const forecastCard = forecastValue instanceof HTMLElement ? forecastValue.closest("article") : null;
  if (forecastCard instanceof HTMLElement && dashboardResultGrid instanceof HTMLElement) {
    if (!dashboardResultGrid.contains(forecastCard)) {
      dashboardResultGrid.appendChild(forecastCard);
    }
    forecastCard.classList.add("is-forecast");
    forecastCard.setAttribute("aria-label", "Forecast");
  }

  // Move Ticket card to the secondary indicators grid (No Show / Agendamento / Funil).
  const ticketValue = document.querySelector('[data-growth-indicator="ticket"]');
  const ticketCard = ticketValue instanceof HTMLElement ? ticketValue.closest("article") : null;
  if (ticketCard instanceof HTMLElement && dashboardIndicatorsSecondaryGrid instanceof HTMLElement) {
    if (!dashboardIndicatorsSecondaryGrid.contains(ticketCard)) {
      dashboardIndicatorsSecondaryGrid.appendChild(ticketCard);
    }
  }

  // Ensure the primary indicators grid only contains the two main cards visually.
  if (dashboardIndicatorsPrimaryGrid instanceof HTMLElement) {
    Array.from(dashboardIndicatorsPrimaryGrid.querySelectorAll("article")).forEach((el) => {
      const hasVendas = el.querySelector('[data-growth-indicator="vendas"]');
      const hasConversao = el.querySelector('[data-growth-indicator="conversao"]');
      if (!hasVendas && !hasConversao) el.style.display = "none";
    });
  }
};

const ensureRealizadoProgressUi = () => {
  if (!(dashboardRoot instanceof HTMLElement)) return;
  const realizedValueEl = document.querySelector('[data-growth-kpi="realizado"]');
  const realizedCard = realizedValueEl instanceof HTMLElement ? realizedValueEl.closest("article") : null;
  if (!(realizedCard instanceof HTMLElement)) return;

  if (!realizedCard.querySelector(".growth-v2-realizado-progress")) {
    const bar = document.createElement("div");
    bar.className = "growth-v2-realizado-progress";
    bar.setAttribute("aria-hidden", "true");
    bar.innerHTML = "<span></span>";
    realizedCard.appendChild(bar);
  }

  if (!realizedCard.querySelector(".growth-v2-realizado-sub")) {
    const sub = document.createElement("div");
    sub.className = "growth-v2-realizado-sub";
    sub.dataset.growthRealizadoSub = "true";
    realizedCard.appendChild(sub);
  }
};

const updateRealizadoProgressUi = ({ meta, realizado } = {}) => {
  const metaNum = Number(meta);
  const realizadoNum = Number(realizado);
  if (!Number.isFinite(metaNum) || metaNum <= 0 || !Number.isFinite(realizadoNum) || realizadoNum < 0) return;

  const realizedValueEl = document.querySelector('[data-growth-kpi="realizado"]');
  const realizedCard = realizedValueEl instanceof HTMLElement ? realizedValueEl.closest("article") : null;
  if (!(realizedCard instanceof HTMLElement)) return;

  const pct = Math.max(0, Math.min(100, (realizadoNum / metaNum) * 100));
  realizedCard.style.setProperty("--growth-realizado-progress", `${pct}%`);

  const remaining = Math.max(0, metaNum - realizadoNum);
  const sub = realizedCard.querySelector(".growth-v2-realizado-sub");
  if (sub instanceof HTMLElement) {
    const pctText = `${pct.toFixed(1).replace(".", ",")}%`;
    sub.textContent = `${pctText} da meta · faltam ${formatMoneyNoCentsPtBr(remaining)}`;
  }
};

const updateForecastMetaSub = () => {
  if (!(dashboardRoot instanceof HTMLElement)) return;
  const forecastValueEl = document.querySelector('[data-growth-indicator="forecast"]');
  const forecastCard = forecastValueEl instanceof HTMLElement ? forecastValueEl.closest("article") : null;
  if (!(forecastCard instanceof HTMLElement)) return;

  const metaEl = document.querySelector('[data-growth-kpi="meta"]');
  const meta = metaEl instanceof HTMLElement ? parseMoneyLoose(metaEl.textContent) : NaN;
  const forecast = forecastValueEl instanceof HTMLElement ? parseMoneyLoose(forecastValueEl.textContent) : NaN;
  if (!Number.isFinite(meta) || meta <= 0 || !Number.isFinite(forecast) || forecast < 0) return;

  const pct = Math.max(0, Math.min(100, (forecast / meta) * 100));
  const sub = forecastCard.querySelector(".growth-v2-card-sub");
  if (sub instanceof HTMLElement) {
    sub.classList.remove("is-yellow");
    sub.classList.add("is-green");
    sub.textContent = `${pct.toFixed(1).replace(".", ",")}% da meta`;
  }
};

const crmConnectedEls = () => {
  return {
    realizado: document.querySelector('[data-growth-kpi="realizado"]'),
    forecast: document.querySelector('[data-growth-indicator="forecast"]'),
    vendas: document.querySelector('[data-growth-indicator="vendas"]'),
    conversao: document.querySelector('[data-growth-indicator="conversao"]'),
    ticket: document.querySelector('[data-growth-indicator="ticket"]'),
    noshow: document.querySelector('[data-growth-rate="noshow"]'),
    agendamento: document.querySelector('[data-growth-rate="agendamento"]'),
    funil: document.querySelector('[data-growth-rate="funil"]'),
    planTurma: document.querySelector('[data-growth-plan="turma"]'),
    planGold: document.querySelector('[data-growth-plan="gold"]'),
    planDiamond: document.querySelector('[data-growth-plan="diamond"]'),
    ranking: document.querySelector("[data-growth-ranking]"),
    lastTime: document.querySelector("[data-growth-last-time]"),
    lastSub: document.querySelector("[data-growth-last-sub]"),
  };
};

const setGrowthCrmState = (state) => {
  if (!(dashboardRoot instanceof HTMLElement)) return;
  const next = String(state || "").trim().toLowerCase();
  dashboardRoot.dataset.growthCrmState = next || "";
};

const setSkeleton = (el, on) => {
  if (!(el instanceof HTMLElement)) return;
  el.classList.toggle("growth-v2-skeleton", Boolean(on));
};

const renderRankingSkeleton = () => {
  const { ranking } = crmConnectedEls();
  if (!(ranking instanceof HTMLElement)) return;
  ranking.innerHTML = Array.from({ length: 4 })
    .map(
      (_, idx) => `
        <div class="growth-v2-rank-row ${idx === 0 ? "is-top" : ""}">
          <div class="growth-v2-rank-pos">${idx + 1}</div>
          <div class="growth-v2-rank-vendor">
            <span class="growth-v2-rank-avatar ${idx === 0 ? "is-coral" : "is-blue"}" aria-hidden="true">--</span>
            <span class="growth-v2-rank-name growth-v2-skeleton">&nbsp;</span>
          </div>
          <div class="growth-v2-rank-sales growth-v2-skeleton">&nbsp;</div>
          <div class="growth-v2-rank-value growth-v2-skeleton">&nbsp;</div>
          <div class="growth-v2-rank-bar" aria-hidden="true"><span style="width: 0%"></span></div>
        </div>
      `
    )
    .join("");
};

const renderRankingError = () => {
  const { ranking } = crmConnectedEls();
  if (!(ranking instanceof HTMLElement)) return;
  ranking.innerHTML = `
    <div class="growth-v2-rank-row" style="padding: 18px 16px; opacity: 0.75;">
      <div class="growth-v2-rank-pos">—</div>
      <div class="growth-v2-rank-vendor">
        <span class="growth-v2-rank-avatar is-blue" aria-hidden="true">--</span>
        <span class="growth-v2-rank-name">—</span>
      </div>
      <div class="growth-v2-rank-sales">—</div>
      <div class="growth-v2-rank-value">—</div>
      <div class="growth-v2-rank-bar" aria-hidden="true"><span class="is-blue" style="width: 0%"></span></div>
    </div>
  `;
};

const applyCrmLoadingUi = () => {
  const els = crmConnectedEls();
  setGrowthCrmState("loading");

  // Replace any server-rendered mock values with neutral placeholders.
  [
    els.realizado,
    els.forecast,
    els.vendas,
    els.conversao,
    els.ticket,
    els.noshow,
    els.agendamento,
    els.funil,
    els.planTurma,
    els.planGold,
    els.planDiamond,
    els.lastTime,
    els.lastSub,
  ].forEach((el) => {
    if (!(el instanceof HTMLElement)) return;
    el.textContent = "—";
    setSkeleton(el, true);
  });

  renderRankingSkeleton();
};

const applyCrmErrorUi = () => {
  const els = crmConnectedEls();
  setGrowthCrmState("error");

  [
    els.realizado,
    els.forecast,
    els.vendas,
    els.conversao,
    els.ticket,
    els.noshow,
    els.agendamento,
    els.funil,
    els.planTurma,
    els.planGold,
    els.planDiamond,
    els.lastTime,
    els.lastSub,
  ].forEach((el) => {
    if (!(el instanceof HTMLElement)) return;
    el.textContent = "—";
    setSkeleton(el, false);
  });

  renderRankingError();
};

const clearCrmLoadingUi = () => {
  const els = crmConnectedEls();
  setGrowthCrmState("ready");

  [
    els.realizado,
    els.forecast,
    els.vendas,
    els.conversao,
    els.ticket,
    els.noshow,
    els.agendamento,
    els.funil,
    els.planTurma,
    els.planGold,
    els.planDiamond,
    els.lastTime,
    els.lastSub,
  ].forEach((el) => setSkeleton(el, false));
};

const renderGrowthRanking = (rows) => {
  const list = document.querySelector("[data-growth-ranking]");
  if (!(list instanceof HTMLElement)) return;

  const items = Array.isArray(rows) ? rows.filter(Boolean) : [];
  if (!items.length) {
    list.innerHTML = `
      <div class="growth-v2-rank-row" style="padding: 18px 16px; opacity: 0.7;">
        <div class="growth-v2-rank-pos">—</div>
        <div class="growth-v2-rank-vendor">
          <span class="growth-v2-rank-avatar is-blue" aria-hidden="true">--</span>
          <span class="growth-v2-rank-name">Nenhuma venda no período</span>
        </div>
        <div class="growth-v2-rank-sales">0</div>
        <div class="growth-v2-rank-value">${formatMoneyNoCentsPtBr(0)}</div>
        <div class="growth-v2-rank-bar" aria-hidden="true"><span class="is-blue" style="width: 0%"></span></div>
      </div>
    `;
    return;
  }

  const top = items[0];
  const topValue = Math.max(0, Number(top?.valor) || 0);
  const metaEl = document.querySelector('[data-growth-kpi="meta"]');
  const metaValue = metaEl instanceof HTMLElement ? parseMoneyLoose(metaEl.textContent) : NaN;
  const maxRows = 4;
  const palette = ["coral", "blue", "green", "yellow"];

  list.innerHTML = "";

  items.slice(0, maxRows).forEach((row, idx) => {
    const nome = String(row?.nome || "").trim() || "Sem vendedor";
    const vendas = Math.max(0, Number(row?.vendas) || 0);
    const valor = Math.max(0, Number(row?.valor) || 0);
    let width = 0;
    if (items.length === 1 && Number.isFinite(metaValue) && metaValue > 0) {
      // With a single vendor, use % of the monthly meta to avoid a misleading 100% bar.
      width = Math.round(Math.max(0, Math.min(1, valor / metaValue)) * 100);
    } else {
      const ratio = topValue > 0 ? Math.max(0, Math.min(1, valor / topValue)) : 0;
      width = Math.round(ratio * 100);
    }

    const colorKey = palette[Math.min(idx, palette.length - 1)];
    const rowClass = idx === 0 ? "growth-v2-rank-row is-top" : "growth-v2-rank-row";
    const avatarClass = idx === 0 ? "growth-v2-rank-avatar is-coral" : `growth-v2-rank-avatar is-${colorKey}`;
    const barClass = idx === 0 ? "" : `class="is-${colorKey}"`;

    const el = document.createElement("div");
    el.className = rowClass;
    el.innerHTML = `
      <div class="growth-v2-rank-pos">${idx + 1}</div>
      <div class="growth-v2-rank-vendor">
        <span class="${avatarClass}" aria-hidden="true">${getInitialsShort(nome)}</span>
        <span class="growth-v2-rank-name">${nome}</span>
      </div>
      <div class="growth-v2-rank-sales">${vendas}</div>
      <div class="growth-v2-rank-value">${formatMoneyNoCentsPtBr(valor)}</div>
      <div class="growth-v2-rank-bar" aria-hidden="true"><span ${barClass} style="width: ${width}%"></span></div>
    `;
    list.appendChild(el);
  });
};

const applyGrowthMetricsToDom = (payload) => {
  if (!payload || typeof payload !== "object") return;
  clearCrmLoadingUi();
  const summary = payload.summary && typeof payload.summary === "object" ? payload.summary : {};

  const realizadoEl = document.querySelector('[data-growth-kpi="realizado"]');
  if (realizadoEl instanceof HTMLElement) realizadoEl.textContent = formatMoneyNoCentsPtBr(summary.realizado);

  const forecastEl = document.querySelector('[data-growth-indicator="forecast"]');
  if (forecastEl instanceof HTMLElement) {
    const n = Number(summary.forecast);
    forecastEl.textContent = Number.isFinite(n) && n >= 0 ? formatMoneyNoCentsPtBr(n) : "—";
  }

  const metaEl = document.querySelector('[data-growth-kpi="meta"]');
  const metaValue = metaEl instanceof HTMLElement ? parseMoneyLoose(metaEl.textContent) : NaN;
  if (Number.isFinite(metaValue) && metaValue > 0) {
    ensureRealizadoProgressUi();
    updateRealizadoProgressUi({ meta: metaValue, realizado: Number(summary.realizado) });
  }

  const vendasEl = document.querySelector('[data-growth-indicator="vendas"]');
  if (vendasEl instanceof HTMLElement) vendasEl.textContent = String(Math.max(0, Number(summary.totalVendas) || 0));

  const conversaoEl = document.querySelector('[data-growth-indicator="conversao"]');
  if (conversaoEl instanceof HTMLElement) conversaoEl.textContent = formatPercentPtBr(summary.conversao, 1);

  const ticketEl = document.querySelector('[data-growth-indicator="ticket"]');
  if (ticketEl instanceof HTMLElement) ticketEl.textContent = formatMoneyNoCentsPtBr(summary.ticketMedio);

  const noShowEl = document.querySelector('[data-growth-rate="noshow"]');
  if (noShowEl instanceof HTMLElement) noShowEl.textContent = formatPercentPtBr(summary.noShowPercent, 1);

  const agendamentoEl = document.querySelector('[data-growth-rate="agendamento"]');
  if (agendamentoEl instanceof HTMLElement) agendamentoEl.textContent = formatPercentPtBr(summary.taxaAgendamento, 1);

  const funilEl = document.querySelector('[data-growth-rate="funil"]');
  if (funilEl instanceof HTMLElement) funilEl.textContent = formatPercentPtBr(summary.taxaFunil, 1);

  const planos = payload.planosVendidos && typeof payload.planosVendidos === "object" ? payload.planosVendidos : {};
  const turmaCount = Math.max(0, Number(planos.turma) || 0);
  const goldCount = Math.max(0, Number(planos.gold) || 0);
  const diamondCount = Math.max(0, Number(planos.diamond) || 0);

  const planTurma = document.querySelector('[data-growth-plan="turma"]');
  if (planTurma instanceof HTMLElement) planTurma.textContent = String(turmaCount);
  const planGold = document.querySelector('[data-growth-plan="gold"]');
  if (planGold instanceof HTMLElement) planGold.textContent = String(goldCount);
  const planDiamond = document.querySelector('[data-growth-plan="diamond"]');
  if (planDiamond instanceof HTMLElement) planDiamond.textContent = String(diamondCount);

  const pie = document.querySelector("[data-growth-plans-pie]");
  if (pie instanceof HTMLElement) {
    pie.style.background = buildPlansPieBackground({ turma: turmaCount, gold: goldCount, diamond: diamondCount });
  }

  renderGrowthRanking(payload.rankingTime);

  const lastTime = document.querySelector("[data-growth-last-time]");
  if (lastTime instanceof HTMLElement) {
    lastTime.textContent = payload?.ultimaVenda?.relativeTime ? String(payload.ultimaVenda.relativeTime) : "—";
  }
  const lastSub = document.querySelector("[data-growth-last-sub]");
  if (lastSub instanceof HTMLElement) {
    const plan = planLabelForUi(payload?.ultimaVenda?.plano);
    const value = formatMoneyNoCentsPtBr(payload?.ultimaVenda?.valor);
    lastSub.textContent = `${plan} · ${value}`;
  }

  try {
    const fb = payload?.forecastBreakdown && typeof payload.forecastBreakdown === "object" ? payload.forecastBreakdown : null;
    if (fb) {
      const parte1 = Number(fb.parte1_fechado) || 0;
      const parte2 = Number(fb.parte2_pipeline) || 0;
      const parte3 = Number(fb.parte3_novosLeads) || 0;
      const forecastTotal = Number.isFinite(Number(fb.total)) ? Number(fb.total) : Number(summary.forecast) || 0;
      const dbg = fb.debug && typeof fb.debug === "object" ? fb.debug : {};
      // eslint-disable-next-line no-console
      console.log({
        parte1_fechado: parte1,
        parte2_pipeline: parte2,
        parte3_novosLeads: parte3,
        forecast_total: forecastTotal,
        diasPassados: Number(dbg.diasPassados) || 0,
        diasRestantes: Number(dbg.diasRestantes) || 0,
        mediaDiariaLeads: Number(dbg.mediaDiariaLeads) || 0,
        novosLeadsEsperados: Number(dbg.novosLeadsEsperados) || 0,
        dealsPipeline_count: Number(dbg.deals_parte2) || 0,
      });
    }
  } catch (e) {
    // ignore debug log failures
  }

  updateForecastMetaSub();
};

const initGrowthDashboardMetrics = () => {
  if (!(dashboardRoot instanceof HTMLElement)) return;

  adjustGrowthDashboardLayout();
  ensureRealizadoProgressUi();
  updateForecastMetaSub();

  applyCrmLoadingUi();

  const loadGoal = async () => {
    const metaEl = document.querySelector('[data-growth-kpi="meta"]');
    if (!(metaEl instanceof HTMLElement)) return;
    try {
      const res = await fetchWithAuth("/api/growth-dashboard?api=growth-goals&mode=current", {
        method: "GET",
        forceRefreshIdToken: true,
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "request_failed");
      const goal = data?.goal && typeof data.goal === "object" ? data.goal : null;
      const valorMeta = goal && Number.isFinite(Number(goal.valorMeta)) ? Number(goal.valorMeta) : NaN;
      if (!Number.isFinite(valorMeta) || valorMeta <= 0) {
        metaEl.textContent = "Meta não definida";
        metaEl.dataset.tone = "muted";
        return;
      }
      metaEl.textContent = formatMoneyNoCentsPtBr(valorMeta);
      metaEl.dataset.tone = "";
      ensureRealizadoProgressUi();
      updateRealizadoProgressUi({ meta: valorMeta, realizado: parseMoneyLoose(document.querySelector('[data-growth-kpi="realizado"]')?.textContent) });
      updateForecastMetaSub();
    } catch (error) {
      // Keep the placeholder meta.
    }
  };

  const load = async () => {
    try {
      const res = await fetchWithAuth("/api/growth-metrics", { method: "GET" });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "request_failed");
      applyGrowthMetricsToDom(data);
      updateForecastMetaSub();
    } catch (error) {
      applyCrmErrorUi();
    }
  };

  loadGoal();
  load();
};

initGrowthDashboardMetrics();

/* =========================
   Contratos (Growth)
   ========================= */

const contractsRoot = document.querySelector("[data-growth-view=\"contracts\"]");

const digitsOnly = (value) => String(value || "").replace(/\D+/g, "");

const formatCpf = (value) => {
  const digits = digitsOnly(value).slice(0, 11);
  const p1 = digits.slice(0, 3);
  const p2 = digits.slice(3, 6);
  const p3 = digits.slice(6, 9);
  const p4 = digits.slice(9, 11);
  let out = p1;
  if (p2) out += `.${p2}`;
  if (p3) out += `.${p3}`;
  if (p4) out += `-${p4}`;
  return out;
};

const isValidCPF = (cpf) => {
  const cleaned = String(cpf || "").replace(/\D/g, "");
  if (cleaned.length !== 11) return false;
  if (/^(\d)\1+$/.test(cleaned)) return false; // 111.111.111-11 etc

  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(cleaned[i], 10) * (10 - i);
  let remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleaned[9], 10)) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(cleaned[i], 10) * (11 - i);
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  return remainder === parseInt(cleaned[10], 10);
};

const formatWhatsapp = (value) => {
  const digits = digitsOnly(value).slice(0, 11);
  if (!digits) return "";
  if (digits.length <= 2) return digits;
  const ddd = digits.slice(0, 2);
  const rest = digits.slice(2);
  if (rest.length <= 4) return `(${ddd}) ${rest}`;
  if (rest.length <= 8) return `(${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
  return `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5, 9)}`;
};

const isValidEmail = (value) => {
  const email = String(value || "").trim();
  if (!email) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

const parseMoneyPtBr = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return NaN;
  const sanitized = raw.replace(/[^\d.,-]/g, "");
  let normalized = sanitized;
  if (normalized.includes(",")) {
    normalized = normalized.replace(/\./g, "").replace(/,/g, ".");
  } else if (normalized.includes(".")) {
    const parts = normalized.split(".");
    const last = parts[parts.length - 1] || "";
    if (parts.length > 2 || last.length === 3) {
      normalized = parts.join("");
    }
  }
  const n = Number(normalized);
  return Number.isFinite(n) ? n : NaN;
};

const currencyPtBr = (value) => {
  try {
    const n = Number(value);
    if (!Number.isFinite(n)) return "—";
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
  } catch (error) {
    return "—";
  }
};

const datePtBr = (iso) => {
  if (!iso) return "—";
  try {
    const d = new Date(String(iso));
    if (!(d instanceof Date) || Number.isNaN(d.getTime())) return "—";
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = String(d.getFullYear());
    return `${dd}/${mm}/${yyyy}`;
  } catch (error) {
    return "—";
  }
};

const dateTimePtBr = (iso) => {
  if (!iso) return null;
  try {
    const d = new Date(String(iso));
    if (!(d instanceof Date) || Number.isNaN(d.getTime())) return null;
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    return `${dd}/${mm} às ${hh}:${min}`;
  } catch (error) {
    return null;
  }
};

const statusMeta = (status) => {
  const key = String(status || "").trim().toLowerCase();
  if (key === "assinado") return { label: "Assinado", cls: "is-signed" };
  if (key === "enviado") return { label: "Enviado", cls: "is-sent" };
  return { label: "Rascunho", cls: "is-draft" };
};

let contractsState = {
  status: "all",
  query: "",
  rows: [],
  byId: new Map(),
  isLoading: false,
};

let contractsSearchTimer = null;
let openActionsMenu = null;
let pendingDeleteId = "";

const contractsEls = {
  search: document.querySelector("[data-contract-search]"),
  list: document.querySelector("[data-contract-list]"),
  empty: document.querySelector("[data-contract-empty]"),
  tabs: Array.from(document.querySelectorAll("[data-contract-status]")).filter((el) => el instanceof HTMLButtonElement),
  newBtn: document.querySelector("[data-contract-new]"),
  createOverlay: document.querySelector("[data-contract-create-overlay]"),
  createForm: document.querySelector("[data-contract-create-form]"),
  createFeedback: document.querySelector("[data-contract-create-feedback]"),
  createClose: document.querySelector("[data-contract-create-close]"),
  createCancel: document.querySelector("[data-contract-create-cancel]"),
  createDraft: document.querySelector("[data-contract-create-draft]"),
  createSend: document.querySelector("[data-contract-create-send]"),
  detailsOverlay: document.querySelector("[data-contract-details-overlay]"),
  detailsBody: document.querySelector("[data-contract-details-body]"),
  detailsClose: document.querySelector("[data-contract-details-close]"),
  detailsOk: document.querySelector("[data-contract-details-ok]"),
  confirmOverlay: document.querySelector("[data-contract-confirm-overlay]"),
  confirmText: document.querySelector("[data-contract-confirm-text]"),
  confirmClose: document.querySelector("[data-contract-confirm-close]"),
  confirmCancel: document.querySelector("[data-contract-confirm-cancel]"),
  confirmOk: document.querySelector("[data-contract-confirm-ok]"),
};

const setModalOpen = (overlay, open) => {
  if (!(overlay instanceof HTMLElement)) return;
  overlay.hidden = !open;
  document.body.classList.toggle("is-modal-open", Boolean(open));
};

const closeAllActionsMenus = () => {
  if (openActionsMenu instanceof HTMLElement) {
    openActionsMenu.classList.remove("is-open");
  }
  openActionsMenu = null;
};

const getCreateCountry = () => document.querySelector('[data-contract-field="telefoneCountry"]');

const renderContracts = () => {
  if (!(contractsEls.list instanceof HTMLElement) || !(contractsEls.empty instanceof HTMLElement)) return;

  contractsEls.list.innerHTML = "";
  const rows = Array.isArray(contractsState.rows) ? contractsState.rows : [];

  if (!rows.length) {
    contractsEls.empty.hidden = false;
    return;
  }

  contractsEls.empty.hidden = true;

  rows.forEach((c) => {
    const row = document.createElement("div");
    row.className = "growth-contracts-row";
    row.setAttribute("role", "row");
    row.dataset.contractId = c.id;

    const status = statusMeta(c.status);
    const orig = typeof c.valorOriginal === "number" ? c.valorOriginal : NaN;
    const disc = typeof c.valorDesconto === "number" ? c.valorDesconto : NaN;
    const valorOriginal = currencyPtBr(orig);
    const valorDesconto = currencyPtBr(disc);
    const showDiscount = Number.isFinite(orig) && Number.isFinite(disc) && disc < orig;

    const actionSend =
      String(c.status || "").trim().toLowerCase() === "rascunho"
        ? `<button class="admin-action-item" type="button" data-contract-action="send" data-contract-id="${c.id}">Enviar para assinatura</button>`
        : "";
    const actionResend =
      String(c.status || "").trim().toLowerCase() === "enviado"
        ? `<button class="admin-action-item" type="button" data-contract-action="send" data-contract-id="${c.id}">Reenviar</button>`
        : "";

    row.innerHTML = `
      <div class="growth-contracts-name" role="cell">${c.nomeCompleto || "—"}</div>
      <div class="growth-contracts-cpf" role="cell">${formatCpf(c.cpf || "")}</div>
      <div class="growth-contracts-value" role="cell">
        <strong>${valorDesconto}</strong>
        ${showDiscount ? `<span class="growth-contracts-old">${valorOriginal}</span>` : ""}
      </div>
      <div role="cell">
        <span class="growth-contract-badge ${status.cls}">${status.label}</span>
      </div>
      <div class="growth-contracts-date" role="cell">${datePtBr(c.criadoEm)}</div>
      <div class="admin-row-actions" role="cell">
        <button class="admin-actions-trigger" type="button" aria-label="Ações" data-contract-menu-trigger>
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 5.5h.01"></path>
            <path d="M12 12h.01"></path>
            <path d="M12 18.5h.01"></path>
          </svg>
        </button>
        <div class="admin-actions-menu" role="menu">
          <button class="admin-action-item" type="button" data-contract-action="details" data-contract-id="${c.id}">Ver detalhes</button>
          ${actionSend}
          ${actionResend}
          <button class="admin-action-item is-danger" type="button" data-contract-action="delete" data-contract-id="${c.id}">Excluir</button>
        </div>
      </div>
    `;

    contractsEls.list.appendChild(row);
  });
};

const setActiveTab = (status) => {
  contractsEls.tabs.forEach((btn) => {
    const value = String(btn.dataset.contractStatus || "");
    btn.classList.toggle("is-active", value === status);
    btn.setAttribute("aria-selected", value === status ? "true" : "false");
  });
};

const loadContracts = async () => {
  if (contractsState.isLoading) return;
  if (!(contractsEls.list instanceof HTMLElement) || !(contractsEls.empty instanceof HTMLElement)) return;

  contractsState.isLoading = true;
  contractsEls.empty.hidden = true;
  contractsEls.list.innerHTML = `<div class="growth-contracts-loading">Carregando...</div>`;

  const statusParam = contractsState.status || "all";
  const q = contractsState.query || "";

  const params = new URLSearchParams();
  if (statusParam && statusParam !== "all") params.set("status", statusParam);
  if (q) params.set("q", q);

  try {
    const res = await fetchWithAuth(`/api/growth-contratos?${params.toString()}`, { method: "GET" });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error || "request_failed");

    const rows = Array.isArray(data?.contracts) ? data.contracts : [];
    contractsState.rows = rows;
    contractsState.byId = new Map(rows.map((c) => [c.id, c]));
    renderContracts();
  } catch (error) {
    contractsState.rows = [];
    contractsState.byId = new Map();
    contractsEls.list.innerHTML = "";
    contractsEls.empty.hidden = false;
    const label = contractsEls.empty.querySelector("strong");
    if (label instanceof HTMLElement) label.textContent = "Não foi possível carregar os contratos.";
  } finally {
    contractsState.isLoading = false;
  }
};

const clearCreateErrors = () => {
  document.querySelectorAll("[data-contract-error]").forEach((el) => {
    if (el instanceof HTMLElement) el.hidden = true;
  });
  document.querySelectorAll(".modal-input").forEach((el) => {
    if (el instanceof HTMLElement) el.classList.remove("is-error");
  });
  if (contractsEls.createFeedback instanceof HTMLElement) {
    contractsEls.createFeedback.hidden = true;
    contractsEls.createFeedback.textContent = "";
  }
};

const showCreateError = (fieldKey, message) => {
  const err = document.querySelector(`[data-contract-error="${fieldKey}"]`);
  if (err instanceof HTMLElement) {
    err.textContent = message;
    err.hidden = false;
  }
  const input = document.querySelector(`[data-contract-field="${fieldKey}"]`);
  if (input instanceof HTMLElement) input.classList.add("is-error");
};

const getCreateField = (key) => document.querySelector(`[data-contract-field="${key}"]`);

const openCreateModal = () => {
  clearCreateErrors();
  const dateField = getCreateField("data");
  if (dateField instanceof HTMLInputElement) {
    const now = new Date();
    const yyyy = String(now.getFullYear());
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    dateField.value = `${yyyy}-${mm}-${dd}`;
  }

  ["nomeCompleto", "email", "whatsapp", "cpf", "endereco", "valorOriginal", "valorDesconto"].forEach((k) => {
    const el = getCreateField(k);
    if (el instanceof HTMLInputElement) el.value = "";
  });
  const country = getCreateCountry();
  if (country instanceof HTMLSelectElement) country.value = "55";
  const contrato = getCreateField("contrato");
  if (contrato instanceof HTMLSelectElement) contrato.value = "";

  setModalOpen(contractsEls.createOverlay, true);
  applyCpfSendGate();

  const focus = getCreateField("nomeCompleto");
  if (focus instanceof HTMLInputElement) focus.focus();
};

const closeCreateModal = () => setModalOpen(contractsEls.createOverlay, false);
const closeDetailsModal = () => setModalOpen(contractsEls.detailsOverlay, false);
const closeConfirmModal = () => setModalOpen(contractsEls.confirmOverlay, false);

let isCreateBusy = false;

const clearCreateFieldError = (fieldKey) => {
  const err = document.querySelector(`[data-contract-error="${fieldKey}"]`);
  if (err instanceof HTMLElement) err.hidden = true;
  const input = document.querySelector(`[data-contract-field="${fieldKey}"]`);
  if (input instanceof HTMLElement) input.classList.remove("is-error");
};

const applyCpfSendGate = () => {
  const cpfEl = getCreateField("cpf");
  const digits = cpfEl instanceof HTMLInputElement ? digitsOnly(cpfEl.value) : "";
  const invalidMath = digits.length === 11 && !isValidCPF(cpfEl instanceof HTMLInputElement ? cpfEl.value : digits);
  if (contractsEls.createSend instanceof HTMLButtonElement) {
    contractsEls.createSend.disabled = Boolean(isCreateBusy || invalidMath);
  }
};

const setCreateButtonsDisabled = (disabled) => {
  const d = Boolean(disabled);
  isCreateBusy = d;
  [contractsEls.createDraft, contractsEls.createCancel].forEach((el) => {
    if (el instanceof HTMLButtonElement) el.disabled = d;
  });
  applyCpfSendGate();
};

const createContract = async (sendNow) => {
  clearCreateErrors();

  const nomeEl = getCreateField("nomeCompleto");
  const emailEl = getCreateField("email");
  const whatsappEl = getCreateField("whatsapp");
  const countryEl = getCreateCountry();
  const contratoEl = getCreateField("contrato");
  const cpfEl = getCreateField("cpf");
  const endEl = getCreateField("endereco");
  const origEl = getCreateField("valorOriginal");
  const discEl = getCreateField("valorDesconto");
  const dateEl = getCreateField("data");

  const nomeCompleto = nomeEl instanceof HTMLInputElement ? nomeEl.value.trim() : "";
  const email = emailEl instanceof HTMLInputElement ? emailEl.value.trim().toLowerCase() : "";
  const whatsapp = whatsappEl instanceof HTMLInputElement ? digitsOnly(whatsappEl.value) : "";
  const telefoneCountry = countryEl instanceof HTMLSelectElement ? String(countryEl.value || "55") : "55";
  const contrato = contratoEl instanceof HTMLSelectElement ? String(contratoEl.value || "").trim().toLowerCase() : "";
  const cpf = cpfEl instanceof HTMLInputElement ? digitsOnly(cpfEl.value) : "";
  const endereco = endEl instanceof HTMLInputElement ? endEl.value.trim() : "";
  const valorOriginalRaw = origEl instanceof HTMLInputElement ? origEl.value.trim() : "";
  const valorOriginal = valorOriginalRaw ? parseMoneyPtBr(valorOriginalRaw) : NaN;
  const valorDescontoRaw = discEl instanceof HTMLInputElement ? discEl.value.trim() : "";
  const valorDesconto = valorDescontoRaw ? parseMoneyPtBr(valorDescontoRaw) : valorOriginal;
  const data = dateEl instanceof HTMLInputElement ? dateEl.value : "";

  let ok = true;
  if (!nomeCompleto) {
    showCreateError("nomeCompleto", "Informe o nome completo.");
    ok = false;
  }
  if (!email || !isValidEmail(email)) {
    showCreateError("email", email ? "E-mail inválido." : "Informe o e-mail.");
    ok = false;
  }
  if (!whatsapp || whatsapp.length < 6) {
    showCreateError("whatsapp", "Informe um WhatsApp válido.");
    ok = false;
  }
  if (!contrato || !["diamond", "gold", "turma"].includes(contrato)) {
    showCreateError("contrato", "Selecione um contrato.");
    ok = false;
  }
  if (!cpf || cpf.length !== 11) {
    showCreateError("cpf", "CPF deve ter 11 dígitos.");
    ok = false;
  } else if (!isValidCPF(cpfEl instanceof HTMLInputElement ? cpfEl.value : cpf)) {
    showCreateError("cpf", "CPF inválido");
    ok = false;
  }
  if (!endereco) {
    showCreateError("endereco", "Informe o endereço.");
    ok = false;
  }
  if (!Number.isFinite(valorOriginal) || valorOriginal <= 0) {
    showCreateError("valorOriginal", "Informe o valor original.");
    ok = false;
  }
  if (!Number.isFinite(valorDesconto) || valorDesconto <= 0) {
    showCreateError("valorDesconto", "Informe o valor com desconto.");
    ok = false;
  } else if (valorDesconto > valorOriginal) {
    showCreateError("valorDesconto", "O desconto não pode ser maior que o valor original.");
    ok = false;
  }

  if (!ok) return;

  setCreateButtonsDisabled(true);

  try {
    const res = await fetchWithAuth("/api/growth-contratos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create",
        nomeCompleto,
        email,
        whatsapp,
        telefoneCountry,
        contrato,
        cpf,
        endereco,
        valorOriginal,
        valorDesconto,
        data,
        sendNow: Boolean(sendNow),
      }),
    });

    const dataRes = await res.json().catch(() => null);
      if (!res.ok) {
        const debugDetail =
          dataRes?.zapsignPayload && typeof dataRes.zapsignPayload === "object"
            ? String(dataRes.zapsignPayload.detail || dataRes.zapsignPayload.message || "").trim()
            : typeof dataRes?.zapsignPayload === "string"
              ? dataRes.zapsignPayload.trim()
            : "";
        const debugStatus = Number.isFinite(Number(dataRes?.zapsignStatus)) ? Number(dataRes.zapsignStatus) : 0;
        const msg =
          dataRes?.error === "invalid_cpf"
            ? "CPF inválido."
            : dataRes?.error === "invalid_email"
              ? "E-mail inválido."
              : dataRes?.error === "invalid_whatsapp"
                ? "WhatsApp inválido."
            : dataRes?.error === "invalid_contrato"
              ? "Selecione um contrato."
            : dataRes?.error === "invalid_discount"
              ? "O desconto não pode ser maior que o valor original."
              : dataRes?.error === "zapsign_failed"
                ? debugDetail
                  ? `Erro ao enviar para assinatura${debugStatus ? ` (${debugStatus})` : ""}: ${debugDetail}`
                  : "Erro ao enviar para assinatura. Tente novamente."
                : "Não foi possível salvar agora. Tente novamente.";

      if (contractsEls.createFeedback instanceof HTMLElement) {
        contractsEls.createFeedback.textContent = msg;
        contractsEls.createFeedback.hidden = false;
      }
      return;
    }

    closeCreateModal();
    await loadContracts();
  } catch (error) {
    if (contractsEls.createFeedback instanceof HTMLElement) {
      contractsEls.createFeedback.textContent = "Não foi possível salvar agora. Tente novamente.";
      contractsEls.createFeedback.hidden = false;
    }
  } finally {
    setCreateButtonsDisabled(false);
  }
};

const openDetailsModal = (contract) => {
  if (!(contractsEls.detailsBody instanceof HTMLElement)) return;

  const status = statusMeta(contract?.status);
  const history = [];
  const created = dateTimePtBr(contract?.criadoEm);
  const sent = dateTimePtBr(contract?.enviadoEm);
  const signed = dateTimePtBr(contract?.assinadoEm);
  if (created) history.push(`Criado em ${created}`);
  if (sent) history.push(`Enviado em ${sent}`);
  if (signed) history.push(`Assinado em ${signed}`);

  const links = [];
  if (contract?.zapsignSignUrl) {
    links.push(`
      <div class="modal-doc-row">
        <span class="upload-file-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M10 13a5 5 0 0 1 0-7l.7-.7a5 5 0 0 1 7.1 7.1l-1 1"></path>
            <path d="M14 11a5 5 0 0 1 0 7l-.7.7a5 5 0 0 1-7.1-7.1l1-1"></path>
          </svg>
        </span>
        <div>
          <a href="${contract.zapsignSignUrl}" target="_blank" rel="noreferrer">Visualizar/assinar documento</a>
          <span>Link da ZapSign</span>
        </div>
      </div>
    `);
  }
  if (contract?.documentoAssinado) {
    links.push(`
      <div class="modal-doc-row">
        <span class="upload-file-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M12 3v10"></path>
            <path d="M8 9l4 4 4-4"></path>
            <path d="M5 21h14"></path>
          </svg>
        </span>
        <div>
          <a href="${contract.documentoAssinado}" target="_blank" rel="noreferrer">Baixar documento assinado</a>
          <span>PDF assinado</span>
        </div>
      </div>
    `);
  }

  const country = contract?.telefoneCountry ? String(contract.telefoneCountry) : "55";
  const phoneDigits = digitsOnly(contract?.whatsapp || "");
  const phoneDisplay = phoneDigits ? `+${country} ${country === "55" ? formatWhatsapp(phoneDigits) : phoneDigits}` : "—";

  contractsEls.detailsBody.innerHTML = `
    <div class="modal-list-row"><strong>Nome</strong><span>${contract?.nomeCompleto || "—"}</span></div>
    <div class="modal-list-row"><strong>E-mail</strong><span>${contract?.email || "—"}</span></div>
    <div class="modal-list-row"><strong>WhatsApp</strong><span>${phoneDisplay}</span></div>
    <div class="modal-list-row"><strong>CPF</strong><span>${formatCpf(contract?.cpf || "")}</span></div>
    <div class="modal-list-row"><strong>Endereço</strong><span>${contract?.endereco || "—"}</span></div>
    <div class="modal-list-row"><strong>Valor original</strong><span>${currencyPtBr(contract?.valorOriginal)}</span></div>
    <div class="modal-list-row"><strong>Valor com desconto</strong><span>${currencyPtBr(contract?.valorDesconto)}</span></div>
    <div class="modal-list-row"><strong>Data</strong><span>${contract?.data || "—"}</span></div>
    <div class="modal-list-row"><strong>Status</strong><span class="growth-contract-badge ${status.cls}">${status.label}</span></div>
    ${links.length ? `<div class="modal-event-section"><h4>Links</h4>${links.join("")}</div>` : ""}
    ${history.length ? `<div class="modal-event-section"><h4>Histórico</h4><div class="growth-contract-history">${history
      .map((h) => `<div class="growth-contract-history-item">${h}</div>`)
      .join("")}</div></div>` : ""}
  `;

  setModalOpen(contractsEls.detailsOverlay, true);
};

const openConfirmDelete = (contractId) => {
  pendingDeleteId = String(contractId || "");
  if (contractsEls.confirmText instanceof HTMLElement) {
    const c = contractsState.byId.get(pendingDeleteId);
    const name = c?.nomeCompleto ? ` "${c.nomeCompleto}"` : "";
    contractsEls.confirmText.textContent = `Tem certeza que deseja excluir o contrato${name}? Esta ação não pode ser desfeita.`;
  }
  setModalOpen(contractsEls.confirmOverlay, true);
};

const deleteContract = async (contractId) => {
  const id = String(contractId || "").trim();
  if (!id) return;
  closeConfirmModal();
  try {
    const res = await fetchWithAuth(`/api/growth-contratos?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error || "delete_failed");
    await loadContracts();
  } catch (error) {
    // ignore for now
  }
};

const sendContractToZapSign = async (contractId) => {
  const id = String(contractId || "").trim();
  if (!id) return;
  try {
    await fetchWithAuth("/api/growth-contratos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "send", id }),
    });
    await loadContracts();
  } catch (error) {
    // ignore for now
  }
};

const initContracts = () => {
  if (!(contractsRoot instanceof HTMLElement)) return;

  if (contractsEls.newBtn instanceof HTMLButtonElement) {
    contractsEls.newBtn.addEventListener("click", () => openCreateModal());
  }

  if (contractsEls.search instanceof HTMLInputElement) {
    contractsEls.search.addEventListener("input", () => {
      const value = contractsEls.search.value.trim();
      contractsState.query = value;
      if (contractsSearchTimer) window.clearTimeout(contractsSearchTimer);
      contractsSearchTimer = window.setTimeout(() => {
        loadContracts();
      }, 240);
    });
  }

  contractsEls.tabs.forEach((btn) => {
    btn.addEventListener("click", () => {
      const value = String(btn.dataset.contractStatus || "all");
      contractsState.status = value || "all";
      setActiveTab(contractsState.status);
      loadContracts();
    });
  });

  // Modal wiring
  if (contractsEls.createClose instanceof HTMLButtonElement) contractsEls.createClose.addEventListener("click", closeCreateModal);
  if (contractsEls.createCancel instanceof HTMLButtonElement) contractsEls.createCancel.addEventListener("click", closeCreateModal);
  if (contractsEls.createDraft instanceof HTMLButtonElement)
    contractsEls.createDraft.addEventListener("click", () => createContract(false));
  if (contractsEls.createSend instanceof HTMLButtonElement) contractsEls.createSend.addEventListener("click", () => createContract(true));

  if (contractsEls.detailsClose instanceof HTMLButtonElement) contractsEls.detailsClose.addEventListener("click", closeDetailsModal);
  if (contractsEls.detailsOk instanceof HTMLButtonElement) contractsEls.detailsOk.addEventListener("click", closeDetailsModal);

  if (contractsEls.confirmClose instanceof HTMLButtonElement) contractsEls.confirmClose.addEventListener("click", closeConfirmModal);
  if (contractsEls.confirmCancel instanceof HTMLButtonElement) contractsEls.confirmCancel.addEventListener("click", closeConfirmModal);
  if (contractsEls.confirmOk instanceof HTMLButtonElement)
    contractsEls.confirmOk.addEventListener("click", () => deleteContract(pendingDeleteId));

  const cpfInput = getCreateField("cpf");
  if (cpfInput instanceof HTMLInputElement) {
    cpfInput.addEventListener("input", () => {
      cpfInput.value = formatCpf(cpfInput.value);
      const digits = digitsOnly(cpfInput.value);
      if (digits.length !== 11 || isValidCPF(cpfInput.value)) clearCreateFieldError("cpf");
      applyCpfSendGate();
    });
    cpfInput.addEventListener("blur", () => {
      const digits = digitsOnly(cpfInput.value);
      if (!digits) {
        clearCreateFieldError("cpf");
        applyCpfSendGate();
        return;
      }
      if (digits.length === 11 && !isValidCPF(cpfInput.value)) {
        showCreateError("cpf", "CPF inválido");
      } else if (digits.length !== 11) {
        showCreateError("cpf", "CPF deve ter 11 dígitos.");
      } else {
        clearCreateFieldError("cpf");
      }
      applyCpfSendGate();
    });
  }

  const whatsappInput = getCreateField("whatsapp");
  if (whatsappInput instanceof HTMLInputElement) {
    whatsappInput.addEventListener("input", () => {
      const countryEl = getCreateCountry();
      const country = countryEl instanceof HTMLSelectElement ? String(countryEl.value || "55") : "55";
      if (country === "55") whatsappInput.value = formatWhatsapp(whatsappInput.value);
    });
  }

  const countrySelect = getCreateCountry();
  if (countrySelect instanceof HTMLSelectElement && whatsappInput instanceof HTMLInputElement) {
    countrySelect.addEventListener("change", () => {
      const country = String(countrySelect.value || "55");
      if (country === "55") {
        whatsappInput.value = formatWhatsapp(whatsappInput.value);
      } else {
        whatsappInput.value = digitsOnly(whatsappInput.value);
      }
    });
  }

  document.addEventListener("keydown", (ev) => {
    if (ev.key !== "Escape") return;
    if (contractsEls.confirmOverlay instanceof HTMLElement && !contractsEls.confirmOverlay.hidden) closeConfirmModal();
    if (contractsEls.detailsOverlay instanceof HTMLElement && !contractsEls.detailsOverlay.hidden) closeDetailsModal();
    if (contractsEls.createOverlay instanceof HTMLElement && !contractsEls.createOverlay.hidden) closeCreateModal();
    closeAllActionsMenus();
  });

  document.addEventListener("click", (ev) => {
    const target = ev.target instanceof Element ? ev.target : null;
    if (!target) return;

    const trigger = target.closest("[data-contract-menu-trigger]");
    if (trigger) {
      const wrap = trigger.closest(".admin-row-actions");
      if (wrap instanceof HTMLElement) {
        const isOpen = wrap.classList.contains("is-open");
        closeAllActionsMenus();
        if (!isOpen) {
          wrap.classList.add("is-open");
          openActionsMenu = wrap;
        }
      }
      return;
    }

    const actionBtn = target.closest("[data-contract-action]");
    if (actionBtn instanceof HTMLElement) {
      const action = String(actionBtn.dataset.contractAction || "");
      const id = String(actionBtn.dataset.contractId || "");
      closeAllActionsMenus();

      if (action === "details") {
        const c = contractsState.byId.get(id);
        openDetailsModal(c);
        return;
      }

      if (action === "delete") {
        openConfirmDelete(id);
        return;
      }

      if (action === "send") {
        sendContractToZapSign(id);
        return;
      }
    }

    // Close menus when clicking outside.
    if (openActionsMenu && !target.closest(".admin-row-actions")) {
      closeAllActionsMenus();
    }
  });

  // Overlay click to close
  [contractsEls.createOverlay, contractsEls.detailsOverlay, contractsEls.confirmOverlay].forEach((overlay) => {
    if (!(overlay instanceof HTMLElement)) return;
    overlay.addEventListener("click", (ev) => {
      if (ev.target !== overlay) return;
      if (overlay === contractsEls.createOverlay) closeCreateModal();
      if (overlay === contractsEls.detailsOverlay) closeDetailsModal();
      if (overlay === contractsEls.confirmOverlay) closeConfirmModal();
    });
  });

  setActiveTab(contractsState.status);
  loadContracts();
};

initContracts();
