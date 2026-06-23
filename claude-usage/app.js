(() => {
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const modelNames = ["Haiku", "Sonnet", "Opus", "Fable"];
  const demo = {
    status: "allowed", usage5: 41, usage7: 16,
    reset5: Date.now() / 1000 + 6000, reset7: Date.now() / 1000 + 442800,
    claim: "five_hour", overage: "unavailable",
    models: { Haiku: true, Sonnet: true, Opus: true, Fable: false },
    incident: null
  };
  const state = {
    screen: 0, provider: "claude", interval: 60, elapsed: 0, timezone: "America/Sao_Paulo",
    token: sessionStorage.getItem("claude_usage_token") || "", live: false,
    openaiKey: sessionStorage.getItem("openai_admin_key") || "", openaiLive: false,
    history5: [18,20,23,24,28,31,30,34,36,38,41],
    history7: [10,10,11,11,12,13,13,14,15,15,16],
    data: { ...demo }
  };
  const openaiDemo = {
    inputTokens: 1820000, outputTokens: 660000, cachedTokens: 710000,
    requests: 1284, cost: 18.42,
    days: [28,34,31,45,41,38,52,48,59,61,55,68,74,66,73,80,77,88,72,91,86,84,93,89,95,82,98,92,100,96],
    models: [{ name: "gpt-5.4", tokens: 1120000 }, { name: "gpt-5.4-mini", tokens: 780000 }, { name: "gpt-5.3-codex", tokens: 410000 }, { name: "outros", tokens: 170000 }]
  };
  state.openai = { ...openaiDemo };
  const heatValues = [10,7,5,4,3,5,9,18,33,48,55,42,50,66,83,94,88,72,61,49,39,29,20,14];

  function init() {
    buildDots();
    buildModels();
    buildHeatmap();
    bindEvents();
    $("#tokenInput").value = state.token;
    $("#openaiKeyInput").value = state.openaiKey;
    render();
    setInterval(tick, 1000);
  }

  function buildDots() {
    $$(".screen").forEach((screen, index) => {
      const dot = document.createElement("button");
      dot.className = "dot";
      dot.type = "button";
      dot.title = screen.dataset.title;
      dot.setAttribute("aria-label", `Ir para ${screen.dataset.title}`);
      dot.addEventListener("click", () => showScreen(index));
      $("#dots").appendChild(dot);
    });
  }

  function modelMarkup(name, up, large = false) {
    return `<div class="${large ? "model-large" : "model-small"} ${up ? "" : "offline"}"><div class="mascot" aria-hidden="true"></div><div><strong>${name}</strong><span>${up ? "online" : "offline"}</span></div></div>`;
  }

  function buildModels() {
    $("#modelsRow").innerHTML = modelNames.map(name => modelMarkup(name, state.data.models[name])).join("");
    $("#modelGrid").innerHTML = modelNames.map(name => modelMarkup(name, state.data.models[name], true)).join("");
  }

  function buildHeatmap() {
    const current = new Date().getHours();
    $("#heatmap").innerHTML = heatValues.map((value, hour) =>
      `<div class="heat-bar ${hour === current ? "current" : ""}" style="--value:${value}" data-label="${hour}h · intensidade ${value}%"></div>`
    ).join("");
  }

  function bindEvents() {
    $("#settingsButton").addEventListener("click", () => $("#settingsDialog").showModal());
    $("#refreshButton").addEventListener("click", refresh);
    $("#refreshTrack").addEventListener("click", refresh);
    $("#previousScreen").addEventListener("click", () => showScreen(state.screen - 1));
    $("#nextScreen").addEventListener("click", () => showScreen(state.screen + 1));
    $("#connectButton").addEventListener("click", connect);
    $("#connectOpenAIButton").addEventListener("click", connectOpenAI);
    $("#demoButton").addEventListener("click", useDemo);
    $$(".provider-button").forEach(button => button.addEventListener("click", () => setProvider(button.dataset.provider)));
    $("#intervalSelect").addEventListener("change", (event) => { state.interval = Number(event.target.value); state.elapsed = 0; });
    $("#timezoneSelect").addEventListener("change", (event) => { state.timezone = event.target.value; render(); });
    let startX = 0;
    $("#screens").addEventListener("pointerdown", event => { startX = event.clientX; });
    $("#screens").addEventListener("pointerup", event => {
      const delta = event.clientX - startX;
      if (Math.abs(delta) > 55) showScreen(state.screen + (delta < 0 ? 1 : -1));
    });
    document.addEventListener("keydown", event => {
      if (event.key === "ArrowRight") showScreen(state.screen + 1);
      if (event.key === "ArrowLeft") showScreen(state.screen - 1);
    });
  }

  function showScreen(index) {
    const screens = $$(".screen");
    const next = (index + screens.length) % screens.length;
    screens.forEach((screen, i) => screen.classList.toggle("active", i === next));
    $$(".dot").forEach((dot, i) => dot.classList.toggle("active", i === next));
    state.screen = next;
  }

  function tick() {
    state.elapsed += 1;
    $("#refreshProgress").style.width = `${Math.min(100, state.elapsed / state.interval * 100)}%`;
    if (state.elapsed >= state.interval && state.live) refresh();
    updateCountdowns();
  }

  async function connect() {
    const token = $("#tokenInput").value.trim();
    if (!token.startsWith("sk-ant-")) {
      setConnection("Esse token não parece válido. Ele deve começar com sk-ant-.", true);
      return;
    }
    state.token = token;
    sessionStorage.setItem("claude_usage_token", token);
    await refresh(true);
  }

  async function refresh(closeOnSuccess = false) {
    if (state.provider === "openai") return refreshOpenAI(closeOnSuccess);
    state.elapsed = 0;
    $("#refreshButton").classList.add("spinning");
    if (!state.token) {
      state.data = { ...demo, reset5: Date.now() / 1000 + 6000, reset7: Date.now() / 1000 + 442800 };
      render();
      toast("Dados de demonstração atualizados");
      $("#refreshButton").classList.remove("spinning");
      return;
    }
    try {
      const response = await fetch("/api/claude-usage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: state.token })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "Não foi possível consultar o Claude.");
      state.data = { ...state.data, ...payload.usage, models: payload.models || state.data.models, incident: payload.incident || null };
      state.live = true;
      state.history5.push(state.data.usage5);
      state.history7.push(state.data.usage7);
      state.history5 = state.history5.slice(-12);
      state.history7 = state.history7.slice(-12);
      setConnection("Conectado. Os dados estão vindo da sua conta.");
      if (closeOnSuccess) $("#settingsDialog").close();
      render();
      toast("Uso atualizado");
    } catch (error) {
      state.live = false;
      setConnection(error.message, true);
      toast("Falha ao conectar");
    } finally {
      $("#refreshButton").classList.remove("spinning");
    }
  }

  async function connectOpenAI() {
    const key = $("#openaiKeyInput").value.trim();
    if (!key.startsWith("sk-admin-")) {
      setConnection("Use uma chave administrativa da organização, iniciada por sk-admin-.", true);
      return;
    }
    state.openaiKey = key;
    sessionStorage.setItem("openai_admin_key", key);
    setProvider("openai");
    await refreshOpenAI(true);
  }

  async function refreshOpenAI(closeOnSuccess = false) {
    state.elapsed = 0;
    if (!state.openaiKey) {
      state.openai = { ...openaiDemo };
      renderOpenAI();
      toast("Demonstração OpenAI atualizada");
      return;
    }
    try {
      const response = await fetch("/api/openai-usage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: state.openaiKey })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "Não foi possível consultar a OpenAI.");
      state.openai = payload;
      state.openaiLive = true;
      setConnection("OpenAI conectada. Tokens e custos são da sua organização.");
      if (closeOnSuccess) $("#settingsDialog").close();
      renderOpenAI();
      toast("Uso OpenAI atualizado");
    } catch (error) {
      state.openaiLive = false;
      setConnection(error.message, true);
      toast("Falha ao conectar à OpenAI");
    }
  }

  function useDemo() {
    state.token = "";
    state.live = false;
    state.openaiLive = false;
    sessionStorage.removeItem("claude_usage_token");
    sessionStorage.removeItem("openai_admin_key");
    $("#tokenInput").value = "";
    $("#openaiKeyInput").value = "";
    state.data = { ...demo, reset5: Date.now() / 1000 + 6000, reset7: Date.now() / 1000 + 442800 };
    setConnection("Você está vendo dados de demonstração.");
    $("#settingsDialog").close();
    render();
    renderOpenAI();
  }

  function setProvider(provider) {
    state.provider = provider;
    const openai = provider === "openai";
    $("#screens").hidden = openai;
    $("#footerNav").hidden = openai;
    $("#openaiDashboard").hidden = !openai;
    $$(".provider-button").forEach(button => button.classList.toggle("active", button.dataset.provider === provider));
    $("#updatedAt").textContent = openai ? (state.openaiLive ? "OpenAI ao vivo" : "modo demo") : (state.live ? "atualizado agora" : "modo demo");
    if (openai) renderOpenAI();
  }

  function renderOpenAI() {
    const d = state.openai;
    const total = d.inputTokens + d.outputTokens;
    setText("#openaiTotalTokens", compactNumber(total));
    setText("#openaiInputTokens", compactNumber(d.inputTokens));
    setText("#openaiOutputTokens", compactNumber(d.outputTokens));
    setText("#openaiCost", new Intl.NumberFormat("pt-BR", { style: "currency", currency: "USD" }).format(d.cost));
    setText("#openaiRequests", `${new Intl.NumberFormat("pt-BR").format(d.requests)} requisições`);
    const status = $("#openaiStatus");
    status.textContent = state.openaiLive ? "Ao vivo" : "Demonstração";
    status.className = `status-chip ${state.openaiLive ? "good" : "warning"}`;
    const max = Math.max(...d.days, 1);
    $("#openaiChart").innerHTML = d.days.map((value, index) => {
      const inputHeight = Math.max(5, value / max * 100);
      const outputHeight = Math.max(3, inputHeight * (0.25 + (index % 4) * 0.03));
      return `<div class="openai-day" title="Dia ${index + 1}"><i style="--height:${inputHeight}%"></i><i style="--height:${outputHeight}%"></i></div>`;
    }).join("");
    const modelMax = Math.max(...d.models.map(model => model.tokens), 1);
    $("#openaiModels").innerHTML = d.models.slice(0, 4).map(model =>
      `<div class="openai-model-row"><strong>${escapeHtml(model.name || "sem modelo")}</strong><span>${compactNumber(model.tokens)}</span><div><i style="width:${model.tokens / modelMax * 100}%"></i></div></div>`
    ).join("");
  }

  function render() {
    const d = state.data;
    setText("#usage5Value", Math.round(d.usage5));
    setText("#usage7Value", Math.round(d.usage7));
    $("#usage5Bar").style.width = `${Math.min(100, d.usage5)}%`;
    $("#usage7Bar").style.width = `${Math.min(100, d.usage7)}%`;
    setText("#reset5Chip", `${Math.round(d.usage5)}% usado`);
    setText("#reset7Chip", `${Math.round(d.usage7)}% usado`);
    setText("#representativeClaim", d.claim === "seven_day" ? "7 DIAS" : "5 HORAS");
    setText("#detailsSub", `${Math.max(0, 100 - Math.round(d.claim === "seven_day" ? d.usage7 : d.usage5))}% ainda disponível nesta janela`);
    setText("#overageStatus", d.overage && d.overage !== "unavailable" ? `Uso extra: ${d.overage}` : "Uso extra indisponível");
    const status = $("#overallStatus");
    const statusMap = { allowed: ["Permitido", "good"], allowed_warning: ["Atenção", "warning"], rejected: ["Limite atingido", "danger"] };
    const statusValue = statusMap[d.status] || statusMap.allowed;
    status.textContent = statusValue[0];
    status.className = `status-chip ${statusValue[1]}`;
    $("#updatedAt").textContent = state.live ? "atualizado agora" : "modo demo";
    setText("#overviewInsight", insight(d.usage5, d.usage7));
    buildModels();
    renderIncident();
    renderChart();
    updateCountdowns();
    showScreen(state.screen);
  }

  function renderIncident() {
    const banner = $("#incidentBanner");
    if (state.data.incident) {
      banner.className = "incident alert";
      banner.innerHTML = `<span>!</span><div><strong>Incidente ativo</strong><p>${escapeHtml(state.data.incident)}</p></div>`;
    } else {
      banner.className = "incident ok";
      banner.innerHTML = "<span>✓</span><div><strong>Todos os modelos operando</strong><p>Nenhum incidente ativo no momento.</p></div>";
    }
  }

  function renderChart() {
    const points = values => values.map((value, i) => `${i * (420 / (values.length - 1))},${180 - value * 1.7}`).join(" ");
    const p5 = points(state.history5), p7 = points(state.history7);
    $("#trend5").setAttribute("points", p5);
    $("#trend7").setAttribute("points", p7);
    $("#trendArea").setAttribute("d", `M ${p5.replaceAll(" ", " L ")} L 420,180 L 0,180 Z`);
    const values = state.history5;
    const rate = values.length > 1 ? values.at(-1) - values.at(-2) : 0;
    if (rate > 4) {
      setText("#burnTitle", "Consumo acelerando");
      setText("#burnText", `A janela de 5 horas subiu ${Math.round(rate)} pontos desde a última leitura.`);
    } else {
      setText("#burnTitle", "Uso estável agora");
      setText("#burnText", "Neste ritmo, você não deve atingir o limite de 5 horas.");
    }
  }

  function updateCountdowns() {
    const d = state.data;
    const c5 = countdown(d.reset5), c7 = countdown(d.reset7);
    setText("#usage5Reset", `reinicia em ${c5}`);
    setText("#usage7Reset", `reinicia em ${c7}`);
    setText("#reset5Big", c5);
    setText("#reset7Big", c7);
    setText("#reset5At", formatDate(d.reset5));
    setText("#reset7At", formatDate(d.reset7));
  }

  function countdown(epoch) {
    if (!epoch) return "--";
    let seconds = Math.max(0, Math.floor(epoch - Date.now() / 1000));
    const days = Math.floor(seconds / 86400); seconds %= 86400;
    const hours = Math.floor(seconds / 3600); seconds %= 3600;
    const minutes = Math.floor(seconds / 60);
    if (days) return `${days}d ${hours}h`;
    if (hours) return `${hours}h ${minutes}min`;
    return `${minutes}min`;
  }

  function formatDate(epoch) {
    if (!epoch) return "horário indisponível";
    return new Intl.DateTimeFormat("pt-BR", { weekday: "short", hour: "2-digit", minute: "2-digit", timeZone: state.timezone }).format(new Date(epoch * 1000));
  }

  function insight(five, seven) {
    const highest = Math.max(five, seven);
    if (highest >= 90) return "Você está muito perto do limite. Vale desacelerar ou esperar o próximo reset.";
    if (highest >= 70) return "Uma das janelas entrou na zona de atenção. Fique de olho no ritmo.";
    return "Você tem bastante espaço nas duas janelas. Bom momento para tarefas maiores.";
  }

  function setConnection(message, error = false) {
    const element = $("#connectionMessage");
    element.textContent = message;
    element.style.color = error ? "var(--red)" : "var(--muted)";
  }
  function setText(selector, text) { $(selector).textContent = text; }
  function compactNumber(value) {
    return new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 2 }).format(value);
  }
  function escapeHtml(value) { const div = document.createElement("div"); div.textContent = value; return div.innerHTML; }
  let toastTimer;
  function toast(message) {
    const element = $("#toast");
    element.textContent = message;
    element.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => element.classList.remove("show"), 2200);
  }
  init();
})();
