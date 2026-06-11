(function () {
  if (window.__spaceSalesCopilotInjected) return;
  window.__spaceSalesCopilotInjected = true;

  const state = {
    status: "Parado",
    stage: "abertura",
    transcript: "",
    snippets: [],
    cards: [],
    summary: null,
    minimized: false,
    timer: 0,
    leadContext: {},
    sessionState: {},
    leadTemperature: "frio",
    lastError: "",
  };

  const el = document.createElement("section");
  el.className = "space-sales-copilot";
  el.innerHTML = `
    <header class="ssc-head" data-ssc-drag>
      <div>
        <strong>Space Sales Copilot</strong>
        <span data-ssc-status>Parado</span>
      </div>
      <div class="ssc-head-actions">
        <button type="button" data-ssc-minimize>_</button>
        <button type="button" data-ssc-open-platform>↗</button>
      </div>
    </header>
    <div class="ssc-body">
      <div class="ssc-stage"><span>Etapa</span><b data-ssc-stage>abertura</b></div>
      <div class="ssc-auth" data-ssc-auth>Conecte abrindo o Growth logado antes da call.</div>
      <div class="ssc-actions">
        <button type="button" data-ssc-start>Iniciar</button>
        <button type="button" data-ssc-pause>Pausar</button>
        <button type="button" data-ssc-end>Encerrar</button>
        <button type="button" data-ssc-suggest>Gerar</button>
      </div>
      <textarea data-ssc-manual placeholder="Cole um trecho manualmente se a transcrição não funcionar..."></textarea>
      <div class="ssc-transcript" data-ssc-transcript>Sem transcrição.</div>
      <div class="ssc-cards" data-ssc-cards><div class="ssc-empty">Aguardando conversa.</div></div>
      <div class="ssc-summary" data-ssc-summary hidden></div>
      <p class="ssc-consent">Use apenas em calls autorizadas e com ciência dos participantes quando necessário.</p>
    </div>
  `;
  document.documentElement.appendChild(el);

  const $ = (selector) => el.querySelector(selector);
  const setStatus = (status) => {
    state.status = status;
    const node = $("[data-ssc-status]");
    if (node) node.textContent = status;
  };

  const render = () => {
    const stage = $("[data-ssc-stage]");
    if (stage) stage.textContent = state.stage || "abertura";
    const transcript = $("[data-ssc-transcript]");
    if (transcript) {
      transcript.innerHTML = state.snippets.length ? state.snippets.slice(-5).map((t) => `<p>${escapeHtml(t)}</p>`).join("") : "Sem transcrição.";
    }
    const cards = $("[data-ssc-cards]");
    if (cards) {
      cards.innerHTML = state.cards.length
        ? state.cards
            .map(
              (card, index) => `
                <article class="ssc-card is-${escapeHtml(card.priority || "media")}">
                  <span>${escapeHtml(card.type || "sugestão")} · ${escapeHtml(card.priority || "média")}</span>
                  <strong>${escapeHtml(card.title || "Sugestão")}</strong>
                  <p>${escapeHtml(card.content || "")}</p>
                  <button type="button" data-ssc-copy="${index}">Copiar</button>
                </article>
              `
            )
            .join("")
        : `<div class="ssc-empty">Aguardando conversa.</div>`;
    }
    const auth = $("[data-ssc-auth]");
    if (auth) {
      const suffix = state.lastError ? ` ${state.lastError}` : "";
      auth.textContent = state.leadTemperature ? `Temperatura: ${state.leadTemperature}.${suffix}` : `Conecte abrindo o Growth logado antes da call.${suffix}`;
    }
    el.classList.toggle("is-minimized", state.minimized);
  };

  const escapeHtml = (value) =>
    String(value || "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[ch]));

  const appendTranscript = (text) => {
    const clean = String(text || "").trim();
    if (!clean) return;
    state.snippets.push(clean);
    state.transcript = `${state.transcript}\n${clean}`.trim();
    render();
    window.clearTimeout(state.timer);
    state.timer = window.setTimeout(generateSuggestion, 6500);
  };

  const transcriber = window.SpaceCopilotAudio.createMicTranscriber({
    onFinal: appendTranscript,
    onStatus: setStatus,
    onError: (error) => {
      const code = String(error?.message || error || "");
      if (code === "no-speech") {
        setStatus("Ouvindo");
        return;
      }
      if (code === "network") {
        state.lastError = "Microfone instável. Use o campo manual se precisar.";
        render();
        setStatus("Pausado");
        return;
      }
      console.warn("[Space Copilot] audio error", error);
      setStatus("Erro");
    },
  });

  const getTranscript = () => {
    const manual = $("[data-ssc-manual]");
    return [state.transcript, manual && manual.value].filter(Boolean).join("\n").trim();
  };

  async function generateSuggestion() {
    const fullTranscript = getTranscript();
    if (!fullTranscript) {
      state.cards = [{ type: "alerta", title: "Sem conversa ainda", content: "Cole um trecho ou inicie a escuta antes de pedir sugestão.", priority: "média" }];
      render();
      return;
    }
    setStatus("Gerando sugestão");
    try {
      const data = await window.SpaceCopilotApi.suggest({ leadContext: state.leadContext, fullTranscript, transcriptChunk: state.snippets.slice(-1)[0] || "" });
      state.stage = data.stage || state.stage;
      state.sessionState = data.updatedState || state.sessionState || {};
      state.leadTemperature = data.leadTemperature || state.leadTemperature || "morno";
      state.cards = Array.isArray(data.cards) ? data.cards : [];
      state.lastError = "";
      setStatus("Ouvindo");
    } catch (error) {
      console.warn("[Space Copilot] suggest failed", error);
      const isAuth = error?.status === 401 || error?.status === 403 || /unauthorized|forbidden/.test(String(error?.message || ""));
      state.lastError = isAuth ? "Token ausente, expirado ou sem permissão Growth." : `Erro: ${error?.message || "falha na API"}.`;
      state.cards = [
        {
          type: "alerta",
          title: isAuth ? "Extensão sem token válido" : "Falha ao gerar sugestão",
          content: isAuth
            ? "Abra o Growth logado pelo acesso Growth ou Admin, espere 2 segundos, abra o popup da extensão e confirme Token salvo. Depois recarregue esta reunião."
            : "A API respondeu com erro. Abra o popup da extensão ou tente novamente em alguns segundos.",
          priority: "alta",
        },
      ];
      setStatus("Erro");
    }
    render();
  }

  async function generateSummary() {
    const fullTranscript = getTranscript();
    if (!fullTranscript) return;
    setStatus("Gerando resumo");
    try {
      const data = await window.SpaceCopilotApi.summary({ leadContext: state.leadContext, fullTranscript });
      const box = $("[data-ssc-summary]");
      if (box) {
        box.hidden = false;
        box.innerHTML = `<strong>Resumo</strong><p>${escapeHtml(data.summary || "")}</p><p><b>Próximo passo:</b> ${escapeHtml(data.nextStep || "")}</p>`;
      }
      setStatus("Parado");
    } catch (error) {
      setStatus("Erro");
    }
  }

  el.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest("[data-ssc-start]")) transcriber.start();
    if (target.closest("[data-ssc-pause]")) transcriber.stop();
    if (target.closest("[data-ssc-end]")) {
      transcriber.stop();
      generateSummary();
    }
    if (target.closest("[data-ssc-suggest]")) generateSuggestion();
    if (target.closest("[data-ssc-minimize]")) {
      state.minimized = !state.minimized;
      render();
    }
    if (target.closest("[data-ssc-open-platform]")) window.open("https://space-three-sand.vercel.app/app/growth/copilot-vendas", "_blank", "noopener");
    const copy = target.closest("[data-ssc-copy]");
    if (copy) {
      const card = state.cards[Number(copy.getAttribute("data-ssc-copy"))];
      if (card?.content) navigator.clipboard.writeText(card.content).catch(() => {});
    }
  });

  const drag = $("[data-ssc-drag]");
  let dragging = null;
  drag.addEventListener("mousedown", (event) => {
    dragging = { startX: event.clientX, startY: event.clientY, left: el.offsetLeft, top: el.offsetTop };
    event.preventDefault();
  });
  window.addEventListener("mousemove", (event) => {
    if (!dragging) return;
    el.style.left = `${Math.max(10, dragging.left + event.clientX - dragging.startX)}px`;
    el.style.top = `${Math.max(10, dragging.top + event.clientY - dragging.startY)}px`;
    el.style.right = "auto";
  });
  window.addEventListener("mouseup", () => {
    dragging = null;
  });

  render();
})();
