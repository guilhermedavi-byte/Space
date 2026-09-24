(function () {
  const esc = (value) => String(value == null ? "" : value).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  const root = () => document.querySelector('[data-panel="space-phone"] [data-space-phone]');
  const api = async (params = {}, options = {}) => {
    const url = new URL("/api/space-phone", window.location.origin);
    Object.entries(params).forEach(([key, value]) => {
      if (value != null && String(value) !== "") url.searchParams.set(key, value);
    });
    const res = await window.fetchWithAuth(url.pathname + url.search, options);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.message || json.error || "space_phone_failed");
    return json;
  };

  const state = {
    period: "today",
    status: "",
    sdr: "all",
    q: "",
    data: null,
    loading: false,
    error: "",
    dial: "",
    normalized: "",
    dialError: "",
    recents: JSON.parse(localStorage.getItem("spacePhoneRecents") || "[]").slice(0, 8),
    favorites: JSON.parse(localStorage.getItem("spacePhoneFavorites") || "[]").slice(0, 16),
    call: { status: "ready", number: "", name: "", startedAt: 0, muted: false, held: false, id: "", callerId: "", origin: "Discador", error: "" },
    devices: { microphones: [], speakers: [], micId: localStorage.getItem("spacePhoneMicId") || "", speakerId: localStorage.getItem("spacePhoneSpeakerId") || "", permission: "unknown" },
    detail: null,
    detailLoading: false,
    noteTimers: new Map(),
  };

  const adapter = () => window.SpacePhone || window.SpacePhoneAdapter || null;
  const fmtSec = (sec) => {
    const n = Math.max(0, Number(sec) || 0);
    const m = Math.floor(n / 60);
    const s = Math.floor(n % 60);
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };
  const fmtDate = (value) => value ? new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "-";
  const callSeconds = () => state.call.startedAt ? Math.round((Date.now() - state.call.startedAt) / 1000) : 0;
  const saveLocal = () => {
    localStorage.setItem("spacePhoneRecents", JSON.stringify(state.recents.slice(0, 8)));
    localStorage.setItem("spacePhoneFavorites", JSON.stringify(state.favorites.slice(0, 16)));
    if (state.devices.micId) localStorage.setItem("spacePhoneMicId", state.devices.micId);
    if (state.devices.speakerId) localStorage.setItem("spacePhoneSpeakerId", state.devices.speakerId);
  };
  const addRecent = (phone) => {
    const normalized = String(phone || "").trim();
    if (!normalized) return;
    state.recents = [normalized, ...state.recents.filter((item) => item !== normalized)].slice(0, 8);
    saveLocal();
  };

  const injectStyle = () => {
    if (document.getElementById("space-phone-style")) return;
    const s = document.createElement("style");
    s.id = "space-phone-style";
    s.textContent = `
.sphone{max-width:1480px;margin:0 auto;padding:24px;color:#f7fbff}.sphone *{box-sizing:border-box}.sphone h1,.sphone h2,.sphone h3,.sphone p{margin:0}.sphone-shell{background:#0b1118;border:1px solid rgba(255,255,255,.1);border-radius:14px;box-shadow:0 18px 48px rgba(0,0,0,.32);overflow:hidden}.sphone-head{display:flex;align-items:flex-end;justify-content:space-between;gap:18px;padding:22px 24px;border-bottom:1px solid rgba(255,255,255,.08);background:#0f1721}.sphone-title h1{font-size:1.55rem;letter-spacing:0;font-weight:900}.sphone-title span,.sphone-muted{color:rgba(247,251,255,.58);font-size:.82rem}.sphone-online{display:inline-flex;align-items:center;gap:8px;border:1px solid rgba(255,255,255,.1);border-radius:999px;padding:8px 11px;font-weight:850;font-size:.78rem;background:rgba(255,255,255,.04)}.sphone-dot{width:8px;height:8px;border-radius:999px;background:#7dd3a8}.sphone-dot[data-tone=warn]{background:#f8c76b}.sphone-dot[data-tone=bad]{background:#ff6b62}.sphone-kpis{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:1px;background:rgba(255,255,255,.08)}.sphone-kpi{background:#0b1118;padding:14px 16px;min-width:0}.sphone-kpi span{display:block;color:rgba(247,251,255,.48);font-size:.68rem;text-transform:uppercase;font-weight:900}.sphone-kpi strong{display:block;margin-top:6px;font-size:1.25rem}.sphone-toolbar,.sphone-filters{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.sphone-toolbar{justify-content:space-between;padding:14px 18px;border-bottom:1px solid rgba(255,255,255,.08)}.sphone-btn,.sphone-icon,.sphone-input,.sphone-select,.sphone-textarea{border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.055);color:#fff;border-radius:8px;font:inherit}.sphone-btn{min-height:36px;padding:0 12px;font-weight:850;cursor:pointer}.sphone-btn.primary{background:#ff5d55;border-color:#ff756f;color:#160807}.sphone-btn.danger{background:#dc342e;border-color:#ef625d}.sphone-btn:disabled{opacity:.45;cursor:not-allowed}.sphone-icon{width:40px;height:40px;display:grid;place-items:center;cursor:pointer}.sphone-input,.sphone-select{height:38px;padding:0 11px}.sphone-textarea{width:100%;min-height:96px;padding:11px;resize:vertical}.sphone-grid{display:grid;grid-template-columns:310px minmax(360px,1fr) 360px;min-height:560px}.sphone-pane{padding:18px;border-right:1px solid rgba(255,255,255,.08);min-width:0}.sphone-pane:last-child{border-right:0}.sphone-pane h2{font-size:.82rem;text-transform:uppercase;color:rgba(247,251,255,.56);letter-spacing:0;font-weight:900;margin-bottom:12px}.sphone-dial-display{display:flex;gap:8px;margin-bottom:12px}.sphone-dial-display input{flex:1;height:46px;font-size:1.05rem}.sphone-keypad{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:14px 0}.sphone-key{height:54px;border-radius:10px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.04);color:#fff;font-size:1.2rem;font-weight:850;cursor:pointer}.sphone-list{display:grid;gap:7px;margin-top:14px}.sphone-chip{display:flex;align-items:center;justify-content:space-between;gap:8px;border:1px solid rgba(255,255,255,.08);border-radius:8px;padding:8px 10px;background:rgba(255,255,255,.035);color:rgba(247,251,255,.76);font-size:.82rem}.sphone-active{display:grid;place-items:center;text-align:center;height:100%;gap:18px}.sphone-status-ring{width:176px;height:176px;border-radius:50%;border:1px solid rgba(255,255,255,.13);display:grid;place-items:center;background:radial-gradient(circle,rgba(255,93,85,.18),rgba(255,255,255,.03));box-shadow:inset 0 0 0 18px rgba(255,255,255,.02)}.sphone-status-ring strong{font-size:2rem}.sphone-call-number{font-size:1.35rem;font-weight:900}.sphone-call-actions{display:flex;gap:10px;justify-content:center;flex-wrap:wrap}.sphone-context{display:grid;gap:12px}.sphone-field{display:grid;gap:6px}.sphone-field span{font-size:.68rem;text-transform:uppercase;color:rgba(247,251,255,.46);font-weight:900}.sphone-post{border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.035);border-radius:10px;padding:12px;display:grid;gap:10px}.sphone-outcomes{display:grid;grid-template-columns:1fr 1fr;gap:7px}.sphone-outcome{min-height:34px;font-size:.75rem}.sphone-history{border-top:1px solid rgba(255,255,255,.08);padding:18px}.sphone-table-wrap{overflow:auto}.sphone-table{width:100%;border-collapse:collapse;min-width:980px}.sphone-table th,.sphone-table td{padding:11px 10px;border-bottom:1px solid rgba(255,255,255,.07);text-align:left;font-size:.82rem}.sphone-table th{font-size:.68rem;text-transform:uppercase;color:rgba(247,251,255,.48)}.sphone-badge{display:inline-flex;border-radius:999px;padding:4px 8px;background:rgba(255,255,255,.08);font-weight:850;font-size:.72rem}.sphone-badge.ok{color:#8ee7bb;background:rgba(62,183,127,.13)}.sphone-badge.bad{color:#ffaaa5;background:rgba(255,93,85,.14)}.sphone-drawer{position:fixed;inset:0;z-index:10000}.sphone-backdrop{position:absolute;inset:0;background:rgba(0,0,0,.58)}.sphone-drawer-panel{position:absolute;right:0;top:0;width:min(720px,100vw);height:100%;overflow:auto;background:#0c141e;border-left:1px solid rgba(255,255,255,.12);padding:22px;color:#fff}.sphone-drawer-head{display:flex;justify-content:space-between;gap:12px;margin-bottom:16px}.sphone-detail-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.sphone-detail-item{border:1px solid rgba(255,255,255,.08);border-radius:8px;padding:10px;background:rgba(255,255,255,.035)}.sphone-detail-item span{display:block;color:rgba(247,251,255,.48);font-size:.68rem;text-transform:uppercase;font-weight:900;margin-bottom:5px}.sphone-pre{white-space:pre-wrap;line-height:1.55;color:rgba(247,251,255,.78)}.sphone-empty{padding:26px;text-align:center;color:rgba(247,251,255,.55)}@media(max-width:1180px){.sphone-kpis{grid-template-columns:repeat(3,1fr)}.sphone-grid{grid-template-columns:1fr}.sphone-pane{border-right:0;border-bottom:1px solid rgba(255,255,255,.08)}}@media(max-width:720px){.sphone{padding:12px}.sphone-head,.sphone-toolbar{display:grid}.sphone-kpis{grid-template-columns:1fr 1fr}.sphone-detail-grid{grid-template-columns:1fr}}`;
    document.head.appendChild(s);
  };

  const statusLabel = (status) => ({ ready: "Pronto", connecting: "Conectando", ringing: "Chamando", active: "Em ligação", hold: "Em espera", ending: "Encerrando", ended: "Encerrada", failed: "Falhou" }[status] || status || "Pronto");
  const phoneStatus = () => {
    const a = adapter();
    if (state.devices.permission === "denied") return { label: "Microfone bloqueado", tone: "bad" };
    if (state.devices.permission === "missing") return { label: "Sem microfone", tone: "bad" };
    if (a?.ready === true || a?.isReady === true || a?.status === "ready" || a?.status === "online") return { label: "Telefone online", tone: "ok" };
    if (a) return { label: "Telefone conectando", tone: "warn" };
    return { label: "Telnyx indisponível", tone: "bad" };
  };

  const kpi = (label, value) => `<article class="sphone-kpi"><span>${esc(label)}</span><strong>${esc(value)}</strong></article>`;
  const renderKpis = () => {
    const a = state.data?.analytics || {};
    return `<section class="sphone-kpis">
      ${kpi("Total", a.totalCalls || 0)}
      ${kpi("Atendidas", a.connectedCalls || 0)}
      ${kpi("Connect rate", `${Math.round((a.connectRate || 0) * 100)}%`)}
      ${kpi("Talk time", fmtSec(a.talkTimeSeconds || 0))}
      ${kpi("Avg talk", fmtSec(a.averageTalkTimeSeconds || 0))}
      ${kpi("Não atendidas", a.unansweredCalls || 0)}
      ${kpi("Agendamentos", a.scheduledCalls == null ? "-" : a.scheduledCalls)}
    </section>`;
  };

  const renderDialer = () => `
    <section class="sphone-pane">
      <h2>Discador</h2>
      <div class="sphone-dial-display">
        <input class="sphone-input" data-sp-dial value="${esc(state.dial)}" type="tel" autocomplete="tel" placeholder="(617) 555-1212" />
        <button class="sphone-icon" data-sp-backspace aria-label="Apagar">⌫</button>
      </div>
      <div class="sphone-muted">${state.normalized ? `E.164 ${esc(state.normalized)}` : state.dialError ? esc(state.dialError) : "US default. Aceita +55, +1 e colar número."}</div>
      <div class="sphone-keypad">${["1","2","3","4","5","6","7","8","9","*","0","#"].map((key) => `<button class="sphone-key" data-sp-key="${esc(key)}">${esc(key)}</button>`).join("")}</div>
      <button class="sphone-btn primary" data-sp-call ${state.call.status === "active" || state.call.status === "connecting" ? "disabled" : ""}>Ligar</button>
      <div class="sphone-list">
        <h2>Recentes</h2>
        ${state.recents.map((item) => `<button class="sphone-chip" data-sp-fill="${esc(item)}"><span>${esc(item)}</span><small>preencher</small></button>`).join("") || `<div class="sphone-muted">Nenhum número recente.</div>`}
      </div>
    </section>`;

  const renderActive = () => `
    <section class="sphone-pane">
      <h2>Call ativa</h2>
      <div class="sphone-active">
        <div>
          <div class="sphone-call-number">${esc(state.call.name || state.call.number || "Nenhuma chamada")}</div>
          <div class="sphone-muted">${esc(state.call.number || "Discador pronto")}</div>
        </div>
        <div class="sphone-status-ring"><div><strong data-sp-timer>${fmtSec(callSeconds())}</strong><div class="sphone-muted">${esc(statusLabel(state.call.status))}</div></div></div>
        <div class="sphone-muted">Caller ID ${esc(state.call.callerId || "-")} · Origem ${esc(state.call.origin || "Discador")}</div>
        ${state.call.error ? `<div class="sphone-badge bad">${esc(state.call.error)}</div>` : ""}
        <div class="sphone-call-actions">
          <button class="sphone-btn" data-sp-mute>${state.call.muted ? "Unmute" : "Mute"}</button>
          <button class="sphone-btn" data-sp-hold>${state.call.held ? "Resume" : "Hold"}</button>
          <button class="sphone-btn" data-sp-dtmf-toggle>Keypad</button>
          <button class="sphone-btn danger" data-sp-hangup>Hangup</button>
        </div>
        <div class="sphone-keypad" data-sp-dtmf hidden>${["1","2","3","4","5","6","7","8","9","*","0","#"].map((key) => `<button class="sphone-key" data-sp-dtmf="${esc(key)}">${esc(key)}</button>`).join("")}</div>
      </div>
    </section>`;

  const renderContext = () => `
    <section class="sphone-pane">
      <h2>Contexto / Call</h2>
      <div class="sphone-context">
        <label class="sphone-field"><span>Microfone</span><select class="sphone-select" data-sp-mic>${state.devices.microphones.map((d) => `<option value="${esc(d.deviceId)}" ${state.devices.micId === d.deviceId ? "selected" : ""}>${esc(d.label || "Microfone")}</option>`).join("")}</select></label>
        <label class="sphone-field"><span>Saída</span><select class="sphone-select" data-sp-speaker>${[`<option value="">Default</option>`, ...state.devices.speakers.map((d) => `<option value="${esc(d.deviceId)}" ${state.devices.speakerId === d.deviceId ? "selected" : ""}>${esc(d.label || "Saída")}</option>`)].join("")}</select></label>
        <label class="sphone-field"><span>Notas em tempo real</span><textarea class="sphone-textarea" data-sp-notes placeholder="Anotações da ligação atual">${esc(state.detail?.call?.notes || "")}</textarea></label>
        <div class="sphone-post">
          <strong>Resultado da ligação</strong>
          <div class="sphone-outcomes">${[
            ["nao_atendeu","Não atendeu"],["ocupado","Ocupado"],["numero_invalido","Número inválido"],["caixa_postal","Caixa postal"],["sem_interesse","Sem interesse"],["retornar_depois","Retornar depois"],["interessado","Interessado"],["agendado","Agendado"],
          ].map(([value,label]) => `<button class="sphone-btn sphone-outcome" data-sp-outcome="${value}">${label}</button>`).join("")}</div>
          <input class="sphone-input" data-sp-callback type="datetime-local" />
        </div>
        <div>
          <h2>Callbacks futuros</h2>
          <div class="sphone-list">${(state.data?.callbacks || []).map((c) => `<button class="sphone-chip" data-sp-detail="${esc(c.id)}"><span>${esc(c.number)}</span><small>${esc(fmtDate(c.callbackAt))}</small></button>`).join("") || `<div class="sphone-muted">Nenhum callback futuro.</div>`}</div>
        </div>
      </div>
    </section>`;

  const renderHistory = () => {
    const calls = state.data?.calls || [];
    return `<section class="sphone-history">
      <h2>Histórico de ligações</h2>
      <div class="sphone-table-wrap"><table class="sphone-table"><thead><tr><th>Direção</th><th>Número</th><th>SDR</th><th>Horário</th><th>Status</th><th>Duração</th><th>Outcome</th><th>Gravação</th><th></th></tr></thead><tbody>
      ${calls.map((c) => `<tr>
        <td>${esc(c.direction)}</td><td><button class="sphone-btn" data-sp-fill="${esc(c.number)}">${esc(c.number || "-")}</button></td><td>${esc(c.sdrName || "-")}</td><td>${esc(fmtDate(c.startedAt))}</td>
        <td><span class="sphone-badge ${c.status === "connected" ? "ok" : c.status === "failed" ? "bad" : ""}">${esc(c.status)}</span></td><td>${fmtSec(c.durationSeconds)}</td><td>${esc(c.outcome || "-")}</td>
        <td>${c.recordingAvailable ? "Disponível" : c.transcriptionAvailable ? "Transcrição" : "Processando"}</td><td><button class="sphone-btn" data-sp-detail="${esc(c.id)}">Detalhe</button></td>
      </tr>`).join("") || `<tr><td colspan="9"><div class="sphone-empty">Nenhuma ligação encontrada.</div></td></tr>`}
      </tbody></table></div>
    </section>`;
  };

  const renderDetail = () => {
    if (!state.detail) return "";
    const c = state.detail.call || {};
    return `<div class="sphone-drawer"><div class="sphone-backdrop" data-sp-close-detail></div><aside class="sphone-drawer-panel">
      <header class="sphone-drawer-head"><div><h2>${esc(c.number || "Ligação")}</h2><p class="sphone-muted">${esc(c.sdrName || "-")} · ${esc(fmtDate(c.startedAt))}</p></div><button class="sphone-icon" data-sp-close-detail>×</button></header>
      <div class="sphone-detail-grid">
        ${[["Telefone", c.number],["SDR", c.sdrName],["Status", c.status],["Duração", fmtSec(c.durationSeconds)],["Outcome", c.outcome || "-"],["Callback", fmtDate(c.callbackAt)]].map(([l,v]) => `<div class="sphone-detail-item"><span>${l}</span>${esc(v)}</div>`).join("")}
      </div>
      <h2 style="margin-top:18px">Notas</h2><textarea class="sphone-textarea" data-sp-detail-notes data-call-id="${esc(c.id)}">${esc(c.notes || "")}</textarea>
      <h2 style="margin-top:18px">CRM</h2><p class="sphone-muted">${c.crm?.found ? `${esc(c.crm.name || "Lead")} · ${esc(c.crm.owner || "sem owner")}` : "Número não associado a um lead da Space"}</p>
      <h2 style="margin-top:18px">Recording / transcript / IA</h2>
      <p class="sphone-muted">${c.recordingAvailable ? "Recording disponível no pipeline atual." : c.transcriptionAvailable ? "Transcrição disponível." : "Processando gravação ou transcrição..."}</p>
      ${c.transcript ? `<div class="sphone-pre">${esc(c.transcript)}</div>` : ""}
      ${c.score != null ? `<p class="sphone-badge ok">IA score ${esc(c.score)}</p>` : ""}
      ${c.analysis ? `<div class="sphone-pre">${esc(typeof c.analysis === "string" ? c.analysis : JSON.stringify(c.analysis, null, 2))}</div>` : ""}
    </aside></div>`;
  };

  const render = () => {
    injectStyle();
    const el = root();
    if (!el) return;
    const ps = phoneStatus();
    el.innerHTML = `<div class="sphone"><div class="sphone-shell">
      <header class="sphone-head"><div class="sphone-title"><h1>Ligações</h1><span>Central de telefonia comercial nativa da Space</span></div><div class="sphone-online"><span class="sphone-dot" data-tone="${ps.tone}"></span>${esc(ps.label)}</div></header>
      ${renderKpis()}
      <div class="sphone-toolbar"><div class="sphone-filters">
        <button class="sphone-btn" data-sp-period="today">Hoje</button><button class="sphone-btn" data-sp-period="last7">7 dias</button><button class="sphone-btn" data-sp-period="last30">30 dias</button>
        <select class="sphone-select" data-sp-status><option value="">Todos</option><option value="answered">Atendida</option><option value="unanswered">Não atendida</option><option value="scheduled">Agendada</option><option value="failed">Falhou</option></select>
        <input class="sphone-input" type="search" data-sp-search placeholder="Buscar número" value="${esc(state.q)}" />
      </div><button class="sphone-btn" data-sp-refresh>Atualizar</button></div>
      ${state.error ? `<div class="sphone-empty">${esc(state.error)}</div>` : ""}
      <main class="sphone-grid">${renderDialer()}${renderActive()}${renderContext()}</main>
      ${renderHistory()}
    </div></div>${renderDetail()}`;
    const status = el.querySelector("[data-sp-status]");
    if (status) status.value = state.status;
  };

  const normalize = async () => {
    if (!state.dial.trim()) { state.normalized = ""; state.dialError = ""; render(); return; }
    try {
      const res = await api({ normalize: state.dial, country: "US" });
      state.normalized = res.ok ? res.normalized : "";
      state.dialError = res.ok ? "" : "Telefone inválido";
    } catch {
      state.normalized = "";
      state.dialError = "Não foi possível validar";
    }
    render();
  };

  const load = async ({ silent = false } = {}) => {
    if (!silent) { state.loading = true; render(); }
    try {
      state.data = await api({ period: state.period, status: state.status, q: state.q, sdr: state.sdr });
      state.error = "";
    } catch (error) {
      state.error = error.message || "Não foi possível carregar ligações.";
    } finally {
      state.loading = false;
      render();
    }
  };

  const loadDevices = async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      state.devices.microphones = devices.filter((d) => d.kind === "audioinput");
      state.devices.speakers = devices.filter((d) => d.kind === "audiooutput");
      state.devices.permission = state.devices.microphones.length ? "granted" : "missing";
    } catch {
      state.devices.permission = "denied";
    }
  };

  const requestMic = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: state.devices.micId ? { deviceId: { exact: state.devices.micId } } : true });
      stream.getTracks().forEach((track) => track.stop());
      state.devices.permission = "granted";
      await loadDevices();
    } catch {
      state.devices.permission = "denied";
    }
  };

  const startCall = async () => {
    if (!state.normalized) await normalize();
    const number = state.normalized || state.dial.trim();
    if (!/^\+[1-9]\d{7,14}$/.test(number)) { state.dialError = "Telefone inválido"; render(); return; }
    await requestMic();
    if (state.devices.permission === "denied" || state.devices.permission === "missing") { render(); return; }
    const a = adapter();
    if (!a || typeof (a.call || a.dial || a.startCall) !== "function") {
      state.call = { ...state.call, status: "failed", number, error: "Adapter Telnyx não disponível nesta sessão." };
      render();
      return;
    }
    state.call = { ...state.call, status: "connecting", number, startedAt: Date.now(), muted: false, held: false, error: "" };
    render();
    try {
      const fn = a.call || a.dial || a.startCall;
      const active = await fn.call(a, { destinationNumber: number, to: number, audio: { inputDeviceId: state.devices.micId, outputDeviceId: state.devices.speakerId } });
      state.call = { ...state.call, status: "active", id: active?.id || active?.callId || active?.call_leg_id || "", callerId: active?.callerId || active?.from || "", active };
      addRecent(number);
    } catch (error) {
      state.call = { ...state.call, status: "failed", error: error?.message || "Falha ao iniciar ligação" };
    }
    render();
  };

  const callMethod = async (names, fallback) => {
    const active = state.call.active || adapter()?.activeCall || adapter()?.call;
    const target = active || adapter();
    const name = names.find((item) => typeof target?.[item] === "function");
    if (!name) {
      state.call.error = fallback;
      render();
      return false;
    }
    await target[name]();
    state.call.error = "";
    return true;
  };

  const saveCallPatch = async (id, patch) => {
    if (!id) return;
    try {
      await api({}, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, ...patch }) });
      await load({ silent: true });
    } catch (error) {
      state.error = error.message || "Não foi possível salvar.";
      render();
    }
  };

  document.addEventListener("click", async (event) => {
    const t = event.target.closest("[data-sp-key],[data-sp-backspace],[data-sp-call],[data-sp-fill],[data-sp-refresh],[data-sp-period],[data-sp-detail],[data-sp-close-detail],[data-sp-mute],[data-sp-hold],[data-sp-hangup],[data-sp-dtmf-toggle],[data-sp-dtmf],[data-sp-outcome]");
    if (!t || !root()) return;
    if (t.matches("[data-sp-key]")) { state.dial += t.dataset.spKey; await normalize(); return; }
    if (t.matches("[data-sp-backspace]")) { state.dial = state.dial.slice(0, -1); await normalize(); return; }
    if (t.matches("[data-sp-call]")) { await startCall(); return; }
    if (t.matches("[data-sp-fill]")) { state.dial = t.dataset.spFill || ""; await normalize(); return; }
    if (t.matches("[data-sp-refresh]")) { await load(); return; }
    if (t.matches("[data-sp-period]")) { state.period = t.dataset.spPeriod || "today"; await load(); return; }
    if (t.matches("[data-sp-detail]")) { state.detail = await api({ id: t.dataset.spDetail }); render(); return; }
    if (t.matches("[data-sp-close-detail]")) { state.detail = null; render(); return; }
    if (t.matches("[data-sp-mute]")) { if (await callMethod(state.call.muted ? ["unmute", "setMuted"] : ["mute", "setMuted"], "Mute não suportado pelo SDK instalado.")) state.call.muted = !state.call.muted; render(); return; }
    if (t.matches("[data-sp-hold]")) { if (await callMethod(state.call.held ? ["resume", "unhold"] : ["hold"], "Hold não suportado pelo SDK instalado.")) { state.call.held = !state.call.held; state.call.status = state.call.held ? "hold" : "active"; } render(); return; }
    if (t.matches("[data-sp-hangup]")) { state.call.status = "ending"; render(); const ended = await callMethod(["hangup", "disconnect", "end"], "Hangup não suportado pelo SDK instalado."); state.call.status = ended ? "ended" : state.call.status; render(); await load({ silent: true }); return; }
    if (t.matches("[data-sp-dtmf-toggle]")) { const pad = root().querySelector("[data-sp-dtmf]"); if (pad) pad.hidden = !pad.hidden; return; }
    if (t.matches("[data-sp-dtmf]")) { const digit = t.dataset.spDtmf || ""; const active = state.call.active || adapter()?.activeCall; const fn = ["dtmf", "sendDtmf", "sendDigits"].find((name) => typeof active?.[name] === "function"); if (fn) active[fn](digit); else { state.call.error = "DTMF não suportado pelo SDK instalado."; render(); } return; }
    if (t.matches("[data-sp-outcome]")) { await saveCallPatch(state.detail?.call?.id || state.call.id, { outcome: t.dataset.spOutcome, callbackAt: root().querySelector("[data-sp-callback]")?.value || null }); return; }
  });

  document.addEventListener("input", (event) => {
    const t = event.target;
    if (!root() || !(t instanceof HTMLElement)) return;
    if (t.matches("[data-sp-dial]")) { state.dial = t.value; clearTimeout(state.normalizeTimer); state.normalizeTimer = setTimeout(normalize, 250); }
    if (t.matches("[data-sp-search]")) { state.q = t.value; clearTimeout(state.searchTimer); state.searchTimer = setTimeout(() => load({ silent: true }), 350); }
    if (t.matches("[data-sp-notes],[data-sp-detail-notes]")) {
      const id = t.dataset.callId || state.detail?.call?.id || state.call.id;
      clearTimeout(state.noteTimers.get(t));
      state.noteTimers.set(t, setTimeout(() => saveCallPatch(id, { notes: t.value }), 700));
    }
  });
  document.addEventListener("change", async (event) => {
    const t = event.target;
    if (!root() || !(t instanceof HTMLElement)) return;
    if (t.matches("[data-sp-status]")) { state.status = t.value; await load(); }
    if (t.matches("[data-sp-mic]")) { state.devices.micId = t.value; saveLocal(); }
    if (t.matches("[data-sp-speaker]")) { state.devices.speakerId = t.value; saveLocal(); }
  });
  document.addEventListener("keydown", async (event) => {
    if (!root() || !document.body.dataset.activePanel?.includes("space-phone")) return;
    const tag = String(event.target?.tagName || "").toLowerCase();
    if (event.key === "Enter" && tag === "input" && event.target.matches("[data-sp-dial]")) { event.preventDefault(); await startCall(); }
    if (event.key === "Escape") { const pad = root().querySelector("[data-sp-dtmf]"); if (pad) pad.hidden = true; }
    if (tag === "input" || tag === "textarea" || event.metaKey || event.ctrlKey) return;
    if (event.key.toLowerCase() === "m") document.querySelector("[data-sp-mute]")?.click();
    if (event.key.toLowerCase() === "h") document.querySelector("[data-sp-hold]")?.click();
  });

  setInterval(() => {
    const timer = document.querySelector("[data-sp-timer]");
    if (timer && ["active", "hold", "connecting"].includes(state.call.status)) timer.textContent = fmtSec(callSeconds());
  }, 1000);
  navigator.mediaDevices?.addEventListener?.("devicechange", () => loadDevices().then(render));

  window.SpacePhoneModule = {
    open: async () => {
      await loadDevices();
      render();
      await load({ silent: true });
    },
    state,
  };
  if (document.body?.dataset.initialPanel === "space-phone") window.SpacePhoneModule.open();
}());
