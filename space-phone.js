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

  const OUTCOMES = [
    ["nao_atendeu", "Não atendeu"], ["ocupado", "Ocupado"], ["numero_invalido", "Número inválido"], ["caixa_postal", "Caixa postal"],
    ["sem_interesse", "Sem interesse"], ["retornar_depois", "Retornar"], ["interessado", "Interessado"], ["agendado", "Agendado"],
  ];
  const ACTIVE = new Set(["connecting", "ringing", "active", "hold", "ending"]);
  const POST = new Set(["ended", "failed"]);

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
    detailTab: "summary",
    detailLoading: false,
    popover: "",
    postCall: { id: "", polls: 0, status: "idle", call: null },
    noteTimers: new Map(),
  };

  const delay = (fn, ms) => {
    const id = setTimeout(fn, ms);
    if (id && typeof id.unref === "function") id.unref();
    return id;
  };
  const every = (fn, ms) => {
    const id = setInterval(fn, ms);
    if (id && typeof id.unref === "function") id.unref();
    return id;
  };
  const adapter = () => window.SpacePhone || window.SpacePhoneAdapter || null;
  const fmtSec = (sec) => {
    const n = Math.max(0, Number(sec) || 0);
    const h = Math.floor(n / 3600);
    const m = Math.floor((n % 3600) / 60);
    const s = Math.floor(n % 60);
    return h ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };
  const fmtDate = (value) => value ? new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "-";
  const callSeconds = () => adapter()?.getState?.()?.elapsedSeconds || 0;
  const operationState = () => ACTIVE.has(state.call.status) ? (state.call.status === "active" || state.call.status === "hold" ? "ACTIVE" : "CALLING") : POST.has(state.call.status) ? "POST_CALL" : "IDLE";
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

  const parseAnalysis = (analysis) => {
    if (!analysis) return {};
    if (typeof analysis === "object") return analysis;
    try { return JSON.parse(analysis); } catch { return { summary: String(analysis) }; }
  };
  const analysisText = (analysis, keys) => {
    const a = parseAnalysis(analysis);
    for (const key of keys) {
      const value = a?.[key];
      if (Array.isArray(value)) return value.filter(Boolean).join(" · ");
      if (value && typeof value === "object") return JSON.stringify(value);
      if (value) return String(value);
    }
    return "";
  };
  const aiReady = (call) => call && (call.score != null || call.transcript || call.analysis);

  const injectStyle = () => {
    if (document.getElementById("space-phone-style")) return;
    const s = document.createElement("style");
    s.id = "space-phone-style";
    s.textContent = `
.sphone{max-width:1500px;margin:0 auto;padding:22px;color:#f7fbff}.sphone *{box-sizing:border-box}.sphone h1,.sphone h2,.sphone h3,.sphone p{margin:0}.sphone-shell{background:linear-gradient(180deg,#0b1119,#080d14);border:1px solid rgba(255,255,255,.08);border-radius:22px;box-shadow:0 24px 70px rgba(0,0,0,.34);overflow:hidden}.sphone-head{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:24px 26px 14px}.sphone-title h1{font-size:1.65rem;letter-spacing:-.03em;font-weight:900}.sphone-title span,.sphone-muted{color:rgba(247,251,255,.58);font-size:.84rem}.sphone-online{display:inline-flex;align-items:center;gap:8px;border:1px solid rgba(255,255,255,.09);border-radius:999px;padding:8px 12px;font-weight:850;font-size:.8rem;background:rgba(255,255,255,.045)}.sphone-dot{width:8px;height:8px;border-radius:999px;background:#7dd3a8;box-shadow:0 0 0 4px rgba(125,211,168,.11)}.sphone-dot[data-tone=warn]{background:#f8c76b;box-shadow:0 0 0 4px rgba(248,199,107,.11)}.sphone-dot[data-tone=bad]{background:#ff6b62;box-shadow:0 0 0 4px rgba(255,107,98,.11)}.sphone-kpis{display:flex;align-items:center;gap:8px;padding:0 26px 18px;flex-wrap:wrap}.sphone-kpi{border:1px solid rgba(255,255,255,.07);background:rgba(255,255,255,.035);border-radius:12px;padding:9px 12px;min-width:108px}.sphone-kpi span{display:block;color:rgba(247,251,255,.46);font-size:.68rem;font-weight:850}.sphone-kpi strong{display:block;margin-top:3px;font-size:1rem}.sphone-toolbar{display:flex;gap:10px;align-items:center;justify-content:space-between;padding:12px 26px;border-top:1px solid rgba(255,255,255,.06);border-bottom:1px solid rgba(255,255,255,.06)}.sphone-filters{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.sphone-btn,.sphone-icon,.sphone-input,.sphone-select,.sphone-textarea{border:1px solid rgba(255,255,255,.11);background:rgba(255,255,255,.055);color:#fff;border-radius:12px;font:inherit;outline:none}.sphone-btn:hover,.sphone-icon:hover{background:rgba(255,255,255,.09)}.sphone-btn:focus-visible,.sphone-icon:focus-visible,.sphone-input:focus-visible,.sphone-select:focus-visible,.sphone-textarea:focus-visible{box-shadow:0 0 0 3px rgba(255,93,85,.24);border-color:rgba(255,93,85,.7)}.sphone-btn{min-height:38px;padding:0 13px;font-weight:850;cursor:pointer}.sphone-btn.primary{background:#ff5d55;border-color:#ff756f;color:#190807}.sphone-btn.danger{background:#dc342e;border-color:#ef625d}.sphone-btn.ghost{background:transparent}.sphone-btn:disabled{opacity:.42;cursor:not-allowed}.sphone-icon{width:40px;height:40px;display:grid;place-items:center;cursor:pointer}.sphone-input,.sphone-select{height:40px;padding:0 12px}.sphone-textarea{width:100%;min-height:92px;padding:12px;resize:vertical}.sphone-grid{display:grid;grid-template-columns:260px minmax(380px,1fr) 340px;min-height:590px}.sphone-pane{padding:20px;min-width:0}.sphone-pane+.sphone-pane{border-left:1px solid rgba(255,255,255,.06)}.sphone-pane h2{font-size:.72rem;color:rgba(247,251,255,.48);letter-spacing:.02em;font-weight:900;margin-bottom:12px;text-transform:uppercase}.sphone-dial-input{font-size:1.1rem;height:50px;width:100%;margin-bottom:10px}.sphone-dial-actions{display:flex;gap:8px;margin:14px 0}.sphone-list{display:grid;gap:8px;margin-top:14px}.sphone-chip{display:flex;align-items:center;justify-content:space-between;gap:8px;border:0;border-radius:12px;padding:10px 12px;background:rgba(255,255,255,.045);color:rgba(247,251,255,.8);font-size:.84rem;cursor:pointer;text-align:left}.sphone-chip:hover{background:rgba(255,255,255,.075)}.sphone-keypad-pop,.sphone-audio-pop{position:absolute;z-index:3;margin-top:8px;border:1px solid rgba(255,255,255,.1);border-radius:16px;padding:12px;background:#101924;box-shadow:0 18px 44px rgba(0,0,0,.34);width:228px}.sphone-audio-pop{width:300px;display:grid;gap:10px}.sphone-keypad{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.sphone-key{height:48px;border-radius:12px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.055);color:#fff;font-size:1.08rem;font-weight:850;cursor:pointer}.sphone-active{height:100%;display:grid;align-content:center;justify-items:center;text-align:center;gap:18px}.sphone-ready-icon{width:76px;height:76px;border-radius:24px;display:grid;place-items:center;background:rgba(255,255,255,.045);font-size:2rem}.sphone-call-name{font-size:1.42rem;font-weight:900;letter-spacing:-.02em}.sphone-call-number{font-size:.96rem;color:rgba(247,251,255,.62);margin-top:5px}.sphone-timer{font-size:4rem;font-weight:950;letter-spacing:-.06em;line-height:1}.sphone-call-actions{display:flex;gap:10px;justify-content:center;flex-wrap:wrap}.sphone-call-actions .sphone-icon{width:58px;height:58px;border-radius:18px;font-weight:900}.sphone-call-actions .danger{width:70px;background:#ed433b;border-color:#ff6f68}.sphone-context{display:grid;gap:12px}.sphone-card{border:1px solid rgba(255,255,255,.075);background:rgba(255,255,255,.035);border-radius:16px;padding:14px;display:grid;gap:10px}.sphone-coach-title{display:flex;align-items:center;justify-content:space-between;gap:10px}.sphone-coach-event{border-left:3px solid rgba(255,93,85,.8);padding:9px 0 9px 12px}.sphone-script{display:grid;gap:7px}.sphone-script span{display:flex;gap:8px;align-items:center;color:rgba(247,251,255,.7);font-size:.86rem}.sphone-progress{height:8px;border-radius:99px;background:rgba(255,255,255,.08);overflow:hidden}.sphone-progress b{display:block;height:100%;background:#7dd3a8}.sphone-post-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.sphone-ai-score{font-size:2.4rem;font-weight:950;letter-spacing:-.05em}.sphone-outcomes{display:grid;grid-template-columns:1fr 1fr;gap:8px}.sphone-outcome{min-height:36px;font-size:.78rem}.sphone-history{border-top:1px solid rgba(255,255,255,.06);padding:20px 26px 26px}.sphone-history-head{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:12px}.sphone-table-wrap{overflow:auto}.sphone-table{width:100%;border-collapse:separate;border-spacing:0 6px;min-width:880px}.sphone-table th,.sphone-table td{padding:10px 12px;text-align:left;font-size:.84rem}.sphone-table th{font-size:.68rem;color:rgba(247,251,255,.45);font-weight:900;text-transform:uppercase}.sphone-table tbody tr{background:rgba(255,255,255,.035)}.sphone-table tbody td:first-child{border-radius:12px 0 0 12px}.sphone-table tbody td:last-child{border-radius:0 12px 12px 0}.sphone-badge{display:inline-flex;align-items:center;gap:6px;border-radius:999px;padding:4px 9px;background:rgba(255,255,255,.08);font-weight:850;font-size:.74rem}.sphone-badge.ok{color:#8ee7bb;background:rgba(62,183,127,.13)}.sphone-badge.bad{color:#ffaaa5;background:rgba(255,93,85,.14)}.sphone-badge.warn{color:#f8d48b;background:rgba(248,199,107,.13)}.sphone-drawer{position:fixed;inset:0;z-index:10000}.sphone-backdrop{position:absolute;inset:0;background:rgba(0,0,0,.58)}.sphone-drawer-panel{position:absolute;right:0;top:0;width:min(860px,100vw);height:100dvh;overflow:hidden;background:#0c141e;border-left:1px solid rgba(255,255,255,.12);color:#fff;display:flex;flex-direction:column}.sphone-drawer-head{display:flex;justify-content:space-between;gap:12px;padding:20px 22px;border-bottom:1px solid rgba(255,255,255,.07)}.sphone-drawer-body{padding:18px 22px;overflow-y:auto;flex:1;display:grid;gap:14px}.sphone-tabs{display:flex;gap:8px}.sphone-tabs .sphone-btn[aria-selected=true]{background:rgba(255,93,85,.18);border-color:rgba(255,93,85,.45)}.sphone-detail-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.sphone-detail-item{border:1px solid rgba(255,255,255,.075);border-radius:12px;padding:10px;background:rgba(255,255,255,.035)}.sphone-detail-item span{display:block;color:rgba(247,251,255,.48);font-size:.68rem;text-transform:uppercase;font-weight:900;margin-bottom:5px}.sphone-pre{white-space:pre-wrap;line-height:1.58;color:rgba(247,251,255,.78)}.sphone-empty{padding:26px;text-align:center;color:rgba(247,251,255,.55)}@media(max-width:1180px){.sphone-grid{grid-template-columns:1fr}.sphone-pane+.sphone-pane{border-left:0;border-top:1px solid rgba(255,255,255,.06)}}@media(max-width:720px){.sphone{padding:12px}.sphone-head,.sphone-toolbar,.sphone-history-head{display:grid}.sphone-kpis{padding:0 16px 16px}.sphone-post-grid,.sphone-detail-grid{grid-template-columns:1fr}.sphone-timer{font-size:3rem}}`;
    document.head.appendChild(s);
  };

  const statusLabel = (status) => ({ ready: "Pronto", connecting: "Conectando", ringing: "Chamando", active: "Em ligação", hold: "Em espera", ending: "Encerrando", ended: "Encerrada", failed: "Falhou" }[status] || status || "Pronto");
  const phoneStatus = () => {
    if (ACTIVE.has(state.call.status)) return { label: `Em ligação · ${fmtSec(callSeconds())}`, tone: "warn" };
    const snap = adapter()?.getState?.() || {};
    if (state.devices.permission === "denied" || snap.devices?.permission === "denied") return { label: "Microfone bloqueado", tone: "bad" };
    if (state.devices.permission === "missing") return { label: "Sem microfone", tone: "bad" };
    if (snap.error || state.call.error) return { label: "Erro no telefone", tone: "bad" };
    if (snap.clientReady || adapter()) return { label: "Online", tone: "ok" };
    return { label: "Telnyx indisponível", tone: "bad" };
  };

  const kpi = (label, value) => `<article class="sphone-kpi"><span>${esc(label)}</span><strong>${esc(value)}</strong></article>`;
  const renderKpis = () => {
    const a = state.data?.analytics || {};
    return `<section class="sphone-kpis">
      ${kpi("Calls", a.totalCalls || 0)}${kpi("Atendidas", a.connectedCalls || 0)}${kpi("Connect rate", `${Math.round((a.connectRate || 0) * 100)}%`)}${kpi("Talk time", fmtSec(a.talkTimeSeconds || 0))}${kpi("Agendamentos", a.scheduledCalls == null ? "-" : a.scheduledCalls)}
    </section>`;
  };

  const renderKeypad = (mode) => `<div class="sphone-keypad">${["1","2","3","4","5","6","7","8","9","*","0","#"].map((key) => `<button class="sphone-key" data-${mode}="${esc(key)}">${esc(key)}</button>`).join("")}</div>`;
  const renderDialer = () => `
    <section class="sphone-pane">
      <h2>Discador</h2>
      <input class="sphone-input sphone-dial-input" data-sp-dial value="${esc(state.dial)}" type="tel" autocomplete="tel" placeholder="+1 (___) ___-____" />
      <div class="sphone-muted">${state.normalized ? `E.164 ${esc(state.normalized)}` : state.dialError ? esc(state.dialError) : "Digite ou cole um número com DDI."}</div>
      <div class="sphone-dial-actions">
        <button class="sphone-btn primary" data-sp-call ${ACTIVE.has(state.call.status) ? "disabled" : ""}>Ligar</button>
        <button class="sphone-btn" data-sp-popover="dialpad">⌨ Keypad</button>
        <button class="sphone-btn ghost" data-sp-backspace>⌫</button>
      </div>
      ${state.popover === "dialpad" ? `<div class="sphone-keypad-pop">${renderKeypad("sp-key")}</div>` : ""}
      <div class="sphone-list"><h2>Recentes</h2>${state.recents.map((item) => `<button class="sphone-chip" data-sp-fill="${esc(item)}"><span>${esc(item)}</span><small>Redial</small></button>`).join("") || `<div class="sphone-muted">Nenhum número recente.</div>`}</div>
    </section>`;

  const renderCenter = () => {
    const op = operationState();
    if (op === "IDLE") return `<section class="sphone-pane"><div class="sphone-active"><div class="sphone-ready-icon">☎</div><div><div class="sphone-call-name">Pronto para ligar</div><div class="sphone-call-number">Escolha um lead no CRM ou use o discador.</div></div><button class="sphone-btn" data-sp-popover="audio">⚙ Audio</button>${state.popover === "audio" ? renderAudioPopover() : ""}</div></section>`;
    if (op === "POST_CALL") return `<section class="sphone-pane"><div class="sphone-active"><div><div class="sphone-call-name">Ligação encerrada</div><div class="sphone-call-number">${esc(state.call.name || state.call.number || "Última chamada")}</div></div><div class="sphone-timer">${fmtSec(callSeconds())}</div><div class="sphone-call-actions"><button class="sphone-btn" data-sp-popover="audio">⚙ Audio</button><button class="sphone-btn primary" data-sp-reset-call>Nova ligação</button></div></div></section>`;
    return `<section class="sphone-pane"><div class="sphone-active"><div><div class="sphone-call-name">${esc(state.call.name || "Chamada em andamento")}</div><div class="sphone-call-number">${esc(state.call.number || "-")}</div></div><div class="sphone-timer" data-sp-timer>${fmtSec(callSeconds())}</div><div class="sphone-muted">${esc(statusLabel(state.call.status))} · Caller ID ${esc(state.call.callerId || "-")}</div>${state.call.error ? `<div class="sphone-badge bad">${esc(state.call.error)}</div>` : ""}<div class="sphone-call-actions"><button class="sphone-icon" data-sp-mute title="Mute">${state.call.muted ? "🔊" : "🎙"}</button><button class="sphone-icon" data-sp-hold title="Hold">${state.call.held ? "▶" : "⏸"}</button><button class="sphone-icon" data-sp-popover="dtmf" data-sp-dtmf-toggle title="Keypad">⌨</button><button class="sphone-icon" data-sp-popover="audio" title="Audio">⚙</button><button class="sphone-icon danger" data-sp-hangup title="Hangup">✕</button></div>${state.popover === "dtmf" ? `<div class="sphone-keypad-pop">${renderKeypad("sp-dtmf")}</div>` : ""}${state.popover === "audio" ? renderAudioPopover() : ""}</div></section>`;
  };

  const renderAudioPopover = () => `<div class="sphone-audio-pop"><label><span class="sphone-muted">Microfone</span><select class="sphone-select" data-sp-mic>${state.devices.microphones.map((d) => `<option value="${esc(d.deviceId)}" ${state.devices.micId === d.deviceId ? "selected" : ""}>${esc(d.label || "Microfone")}</option>`).join("")}</select></label><label><span class="sphone-muted">Saída</span><select class="sphone-select" data-sp-speaker>${[`<option value="">Default</option>`, ...state.devices.speakers.map((d) => `<option value="${esc(d.deviceId)}" ${state.devices.speakerId === d.deviceId ? "selected" : ""}>${esc(d.label || "Saída")}</option>`)].join("")}</select></label><button class="sphone-btn" data-sp-test-device>Testar dispositivo</button><span class="sphone-muted">Permissão: ${esc(state.devices.permission)}</span></div>`;

  const renderIdleRight = () => `<section class="sphone-pane"><h2>Contexto recente</h2><div class="sphone-context"><div class="sphone-card"><strong>Callbacks</strong>${(state.data?.callbacks || []).slice(0, 5).map((c) => `<button class="sphone-chip" data-sp-detail="${esc(c.id)}"><span>${esc(c.number)}</span><small>${esc(fmtDate(c.callbackAt))}</small></button>`).join("") || `<p class="sphone-muted">Nenhum callback pendente.</p>`}</div><div class="sphone-card"><strong>AI Coach</strong><p class="sphone-muted">O coaching live depende de transcript parcial em tempo real. O pipeline atual entrega análise pós-call.</p><span class="sphone-badge warn">Live transcript indisponível</span></div></div></section>`;

  const renderCoach = () => `<section class="sphone-pane"><div class="sphone-coach-title"><h2>AI Coach</h2><span class="sphone-badge warn">● Ouvindo</span></div><div class="sphone-context"><div class="sphone-card"><div class="sphone-coach-event"><strong>Próxima pergunta</strong><p class="sphone-muted">Live AI ainda não habilitado. Use notas rápidas durante a chamada.</p></div></div><div class="sphone-card"><strong>Script progress</strong><div class="sphone-script"><span>○ Contexto</span><span>○ Dor</span><span>○ Urgência</span><span>○ Consequência</span><span>○ Compromisso</span></div></div><div class="sphone-card"><strong>Talk ratio</strong><div class="sphone-progress"><b style="width:0%"></b></div><p class="sphone-muted">Aguardando transcript live real para calcular sem simular.</p></div><button class="sphone-btn" data-sp-toggle-notes>Notas</button><textarea class="sphone-textarea" data-sp-notes placeholder="Notas da ligação atual"></textarea></div></section>`;

  const renderPostCall = () => {
    const c = state.postCall.call || state.detail?.call || {};
    const ready = aiReady(c);
    return `<section class="sphone-pane"><div class="sphone-coach-title"><h2>AI Review</h2><span class="sphone-badge ${ready ? "ok" : "warn"}">${ready ? "Análise pronta" : "Processando análise"}</span></div><div class="sphone-context"><div class="sphone-card"><strong>Resultado</strong><div class="sphone-outcomes">${OUTCOMES.map(([value,label]) => `<button class="sphone-btn sphone-outcome" data-sp-outcome="${value}">${label}</button>`).join("")}</div><input class="sphone-input" data-sp-callback type="datetime-local" /></div><div class="sphone-card">${ready ? `<div class="sphone-post-grid"><div><span class="sphone-muted">Score IA</span><div class="sphone-ai-score">${esc(c.score ?? "-")}</div></div><div><span class="sphone-muted">Status</span><p>${c.transcriptionAvailable ? "Transcrição pronta" : "Análise disponível"}</p></div></div><p>${esc(analysisText(c.analysis, ["summary", "resumo", "call_summary"]) || "Análise pronta no pipeline IA.")}</p><p class="sphone-muted">${esc(analysisText(c.analysis, ["recommendation", "recommendations", "main_improvement", "principal_melhoria"]) || "Abra a análise completa para scorecard e transcrição.")}</p><button class="sphone-btn" data-sp-detail="${esc(c.id || state.call.id)}">Ver análise completa</button>` : `<p class="sphone-muted">Buscando correlação em sdr_call_scores por call_leg_id/call_session_id. A tela atualiza por alguns ciclos sem bloquear o telefone.</p>`}</div></div></section>`;
  };

  const renderRight = () => {
    const op = operationState();
    if (op === "ACTIVE" || op === "CALLING") return renderCoach();
    if (op === "POST_CALL") return renderPostCall();
    return renderIdleRight();
  };

  const aiBadge = (c) => c.analysisStatus === "completed" || c.score != null ? `<span class="sphone-badge ok">● Pronta</span>` : `<span class="sphone-badge warn">○ Processando</span>`;
  const renderHistory = () => {
    const calls = state.data?.calls || [];
    return `<section class="sphone-history"><div class="sphone-history-head"><div><h2>Histórico</h2><p class="sphone-muted">Ligações recentes e análise IA pós-call.</p></div><button class="sphone-btn" data-sp-refresh>Atualizar</button></div><div class="sphone-table-wrap"><table class="sphone-table"><thead><tr><th>Número / nome</th><th>Horário</th><th>Status</th><th>Duração</th><th>Outcome</th><th>IA</th><th></th></tr></thead><tbody>${calls.map((c) => `<tr><td><strong>${esc(c.sdrName || c.number || "Lead")}</strong><br><span class="sphone-muted">${esc(c.number || "-")}</span></td><td>${esc(fmtDate(c.startedAt))}</td><td><span class="sphone-badge ${c.status === "connected" ? "ok" : c.status === "failed" ? "bad" : ""}">${esc(c.status)}</span></td><td>${fmtSec(c.durationSeconds)}</td><td>${esc(c.outcome || "-")}</td><td>${aiBadge(c)}</td><td><button class="sphone-btn" data-sp-detail="${esc(c.id)}">Detalhes</button></td></tr>`).join("") || `<tr><td colspan="7"><div class="sphone-empty">Nenhuma ligação encontrada.</div></td></tr>`}</tbody></table></div></section>`;
  };

  const renderDetailTab = (c) => {
    const analysis = parseAnalysis(c.analysis);
    if (state.detailTab === "transcript") return c.transcript ? `<div class="sphone-pre">${esc(c.transcript)}</div>` : `<p class="sphone-muted">Transcrição ainda não disponível.</p>`;
    if (state.detailTab === "scorecard") return `<div class="sphone-context"><div class="sphone-card"><strong>Score</strong><div class="sphone-ai-score">${esc(c.score ?? "-")}/100</div></div><div class="sphone-card"><strong>Pontos fortes</strong><p class="sphone-muted">${esc(analysisText(analysis, ["strengths", "pontos_fortes", "positive_points"]) || "Aguardando scorecard estruturado.")}</p></div><div class="sphone-card"><strong>Melhorias</strong><p class="sphone-muted">${esc(analysisText(analysis, ["weaknesses", "improvements", "recommendations", "principal_melhoria"]) || "Aguardando recomendações.")}</p></div></div>`;
    return `<div class="sphone-detail-grid">${[["Telefone", c.number],["SDR", c.sdrName],["Status", c.status],["Duração", fmtSec(c.durationSeconds)],["Outcome", c.outcome || "-"],["Callback", fmtDate(c.callbackAt)]].map(([l,v]) => `<div class="sphone-detail-item"><span>${l}</span>${esc(v)}</div>`).join("")}</div><div class="sphone-card"><strong>Resumo IA</strong><p class="sphone-muted">${esc(analysisText(analysis, ["summary", "resumo", "call_summary"]) || c.analysisText || "Análise ainda não disponível.")}</p></div><div class="sphone-card"><strong>Notas</strong><textarea class="sphone-textarea" data-sp-detail-notes data-call-id="${esc(c.id)}">${esc(c.notes || "")}</textarea></div>`;
  };
  const renderDetail = () => {
    if (!state.detail) return "";
    const c = state.detail.call || {};
    const audioSrc = c.recordingId ? `/api/admin/sdr/calls/${encodeURIComponent(c.recordingId)}/audio` : "";
    return `<div class="sphone-drawer"><div class="sphone-backdrop" data-sp-close-detail></div><aside class="sphone-drawer-panel"><header class="sphone-drawer-head"><div><h2>${esc(c.sdrName || c.number || "Ligação")}</h2><p class="sphone-muted">${esc(fmtDate(c.startedAt))} · ${esc(fmtSec(c.durationSeconds))} · Nota ${esc(c.score ?? "-")}/100</p></div><button class="sphone-icon" data-sp-close-detail>×</button></header><div class="sphone-drawer-body">${audioSrc ? `<audio controls preload="none" src="${esc(audioSrc)}" style="width:100%"></audio>` : `<p class="sphone-muted">Gravação indisponível.</p>`}<div class="sphone-tabs"><button class="sphone-btn" data-sp-tab="summary" aria-selected="${state.detailTab === "summary"}">Resumo</button><button class="sphone-btn" data-sp-tab="scorecard" aria-selected="${state.detailTab === "scorecard"}">Scorecard</button><button class="sphone-btn" data-sp-tab="transcript" aria-selected="${state.detailTab === "transcript"}">Transcrição</button></div>${renderDetailTab(c)}</div></aside></div>`;
  };

  const render = () => {
    injectStyle();
    const el = root();
    if (!el) return;
    const ps = phoneStatus();
    el.innerHTML = `<div class="sphone"><div class="sphone-shell"><header class="sphone-head"><div class="sphone-title"><h1>Ligações</h1><span>Central de voz comercial</span></div><div class="sphone-online"><span class="sphone-dot" data-tone="${ps.tone}"></span>${esc(ps.label)}</div></header>${renderKpis()}<div class="sphone-toolbar"><div class="sphone-filters"><select class="sphone-select" data-sp-period><option value="today">Hoje</option><option value="last7">7 dias</option><option value="last30">30 dias</option></select><select class="sphone-select" data-sp-status><option value="">Todos</option><option value="answered">Atendida</option><option value="unanswered">Não atendida</option><option value="scheduled">Agendada</option><option value="failed">Falhou</option></select><input class="sphone-input" type="search" data-sp-search placeholder="Buscar número" value="${esc(state.q)}" /></div><button class="sphone-btn" data-sp-refresh>Atualizar</button></div>${state.error ? `<div class="sphone-empty">${esc(state.error)}</div>` : ""}<main class="sphone-grid">${renderDialer()}${renderCenter()}${renderRight()}</main>${renderHistory()}</div></div>${renderDetail()}`;
    const status = el.querySelector("[data-sp-status]");
    if (status) status.value = state.status;
    const period = el.querySelector("[data-sp-period]");
    if (period) period.value = state.period;
  };

  const normalize = async () => {
    if (!state.dial.trim()) { state.normalized = ""; state.dialError = ""; render(); return; }
    try {
      const res = await api({ normalize: state.dial, country: "US" });
      state.normalized = res.ok ? res.normalized : "";
      state.dialError = res.ok ? "" : "Telefone inválido";
    } catch { state.normalized = ""; state.dialError = "Não foi possível validar"; }
    render();
  };
  const load = async ({ silent = false } = {}) => {
    if (!silent) { state.loading = true; render(); }
    try { state.data = await api({ period: state.period, status: state.status, q: state.q, sdr: state.sdr }); state.error = ""; }
    catch (error) { state.error = error.message || "Não foi possível carregar ligações."; }
    finally { state.loading = false; render(); }
  };
  const loadDevices = async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try {
      const coreDevices = await adapter()?.refreshDevices?.().catch(() => null);
      const devices = coreDevices?.inputs ? [...coreDevices.inputs, ...coreDevices.outputs.map((d) => ({ ...d, kind: "audiooutput" }))] : await navigator.mediaDevices.enumerateDevices();
      state.devices.microphones = coreDevices?.inputs || devices.filter((d) => d.kind === "audioinput");
      state.devices.speakers = coreDevices?.outputs || devices.filter((d) => d.kind === "audiooutput");
      state.devices.permission = state.devices.microphones.length ? "granted" : "missing";
    } catch { state.devices.permission = "denied"; }
  };
  const requestMic = async () => {
    try { const stream = await navigator.mediaDevices.getUserMedia({ audio: state.devices.micId ? { deviceId: { exact: state.devices.micId } } : true }); stream.getTracks().forEach((track) => track.stop()); state.devices.permission = "granted"; await loadDevices(); }
    catch { state.devices.permission = "denied"; }
  };
  const startCall = async () => {
    if (!state.normalized) await normalize();
    const number = state.normalized || state.dial.trim();
    if (!/^\+[1-9]\d{7,14}$/.test(number)) { state.dialError = "Telefone inválido"; render(); return; }
    await requestMic();
    if (state.devices.permission === "denied" || state.devices.permission === "missing") { render(); return; }
    const a = adapter();
    if (!a || typeof (a.call || a.dial || a.startCall) !== "function") { state.call = { ...state.call, status: "failed", number, error: "Adapter Telnyx não disponível nesta sessão." }; render(); return; }
    state.call = { ...state.call, status: "connecting", number, muted: false, held: false, error: "" };
    state.postCall = { id: "", polls: 0, status: "idle", call: null };
    render();
    try { await a.call({ phoneNumber: number, source: "sdr_phone", micId: state.devices.micId, speakerId: state.devices.speakerId }); addRecent(number); syncFromCore(a.getState?.()); }
    catch (error) { state.call = { ...state.call, status: "failed", error: error?.message || "Falha ao iniciar ligação" }; }
    render();
  };
  const callMethod = async (name, ...args) => {
    const a = adapter();
    if (typeof a?.[name] !== "function") { state.call.error = `Controle ${name} indisponível.`; render(); return false; }
    try { await a[name](...args); state.call.error = ""; syncFromCore(a.getState?.()); return true; }
    catch (error) { state.call.error = error?.message || `Falha ao executar ${name}.`; render(); return false; }
  };
  const pollPostCall = async (id) => {
    if (!id || state.postCall.id === id && state.postCall.status === "ready") return;
    state.postCall = { id, polls: 0, status: "processing", call: null };
    const delays = [5000, 10000, 20000, 40000];
    const run = async () => {
      if (state.postCall.id !== id || state.postCall.status === "ready" || state.postCall.polls >= delays.length) return;
      state.postCall.polls += 1;
      try {
        const detail = await api({ id });
        if (aiReady(detail.call)) { state.postCall = { ...state.postCall, status: "ready", call: detail.call }; render(); await load({ silent: true }); return; }
      } catch {}
      render();
      if (state.postCall.polls < delays.length) delay(run, delays[state.postCall.polls]);
    };
    delay(run, delays[0]);
  };
  const syncFromCore = (snap = {}) => {
    const previous = state.call.status;
    const context = snap.context || {};
    const record = snap.callRecord || {};
    if (snap.status === "idle" && ACTIVE.has(state.call.status) && !record.id && !context.phoneNumber) {
      state.call = { ...state.call, muted: Boolean(snap.muted), held: Boolean(snap.held), error: snap.error || "" };
      return;
    }
    state.call = { ...state.call, status: snap.status === "idle" ? "ready" : snap.held ? "hold" : (snap.status || state.call.status || "ready"), number: context.phoneNumber || record.to_number || state.call.number || "", name: context.leadName || record.lead_name || state.call.name || "", muted: Boolean(snap.muted), held: Boolean(snap.held), id: record.id || state.call.id || "", callerId: record.from_number || state.call.callerId || "", origin: context.source || state.call.origin || "Discador", error: snap.error || "" };
    if (!POST.has(previous) && POST.has(state.call.status) && state.call.id) pollPostCall(state.call.id);
  };
  const saveCallPatch = async (id, patch) => {
    if (!id) return;
    try { const response = await api({}, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, ...patch }) }); if (state.postCall.id === id) state.postCall.call = response.call || state.postCall.call; await load({ silent: true }); }
    catch (error) { state.error = error.message || "Não foi possível salvar."; render(); }
  };

  document.addEventListener("click", async (event) => {
    const t = event.target.closest("[data-sp-key],[data-sp-backspace],[data-sp-call],[data-sp-fill],[data-sp-refresh],[data-sp-period],[data-sp-detail],[data-sp-close-detail],[data-sp-mute],[data-sp-hold],[data-sp-hangup],[data-sp-popover],[data-sp-dtmf-toggle],[data-sp-dtmf],[data-sp-outcome],[data-sp-reset-call],[data-sp-tab],[data-sp-test-device]");
    if (!t || !root()) return;
    if (t.matches("[data-sp-key]")) { state.dial += t.dataset.spKey; await normalize(); return; }
    if (t.matches("[data-sp-backspace]")) { state.dial = state.dial.slice(0, -1); await normalize(); return; }
    if (t.matches("[data-sp-call]")) { await startCall(); return; }
    if (t.matches("[data-sp-fill]")) { state.dial = t.dataset.spFill || ""; await normalize(); return; }
    if (t.matches("[data-sp-refresh]")) { await load(); return; }
    if (t.matches("[data-sp-period]")) { state.period = t.dataset.spPeriod || "today"; await load(); return; }
    if (t.matches("[data-sp-detail]")) { state.detail = await api({ id: t.dataset.spDetail }); state.detailTab = "summary"; render(); return; }
    if (t.matches("[data-sp-close-detail]")) { state.detail = null; render(); return; }
    if (t.matches("[data-sp-mute]")) { await callMethod(state.call.muted ? "unmute" : "mute"); render(); return; }
    if (t.matches("[data-sp-hold]")) { await callMethod(state.call.held ? "unhold" : "hold"); render(); return; }
    if (t.matches("[data-sp-hangup]")) { state.call.status = "ending"; render(); const ended = await callMethod("hangup"); state.call.status = ended ? "ended" : state.call.status; if (ended && state.call.id) pollPostCall(state.call.id); render(); await load({ silent: true }); return; }
    if (t.matches("[data-sp-popover]")) { state.popover = state.popover === t.dataset.spPopover ? "" : t.dataset.spPopover; render(); return; }
    if (t.matches("[data-sp-dtmf]")) { await callMethod("dtmf", t.dataset.spDtmf || ""); return; }
    if (t.matches("[data-sp-outcome]")) { await saveCallPatch(state.detail?.call?.id || state.postCall.id || state.call.id, { outcome: t.dataset.spOutcome, callbackAt: root().querySelector("[data-sp-callback]")?.value || null }); return; }
    if (t.matches("[data-sp-reset-call]")) { state.call = { ...state.call, status: "ready", number: "", name: "", id: "", error: "" }; state.postCall = { id: "", polls: 0, status: "idle", call: null }; render(); return; }
    if (t.matches("[data-sp-tab]")) { state.detailTab = t.dataset.spTab || "summary"; render(); return; }
    if (t.matches("[data-sp-test-device]")) { await requestMic(); render(); return; }
  });
  document.addEventListener("input", (event) => {
    const t = event.target;
    if (!root() || !(t instanceof HTMLElement)) return;
    if (t.matches("[data-sp-dial]")) { state.dial = t.value; clearTimeout(state.normalizeTimer); state.normalizeTimer = setTimeout(normalize, 250); }
    if (t.matches("[data-sp-search]")) { state.q = t.value; clearTimeout(state.searchTimer); state.searchTimer = setTimeout(() => load({ silent: true }), 350); }
    if (t.matches("[data-sp-notes],[data-sp-detail-notes]")) { const id = t.dataset.callId || state.detail?.call?.id || state.postCall.id || state.call.id; clearTimeout(state.noteTimers.get(t)); state.noteTimers.set(t, setTimeout(() => saveCallPatch(id, { notes: t.value }), 700)); }
  });
  document.addEventListener("change", async (event) => {
    const t = event.target;
    if (!root() || !(t instanceof HTMLElement)) return;
    if (t.matches("[data-sp-status]")) { state.status = t.value; await load(); }
    if (t.matches("[data-sp-period]")) { state.period = t.value; await load(); }
    if (t.matches("[data-sp-mic]")) { state.devices.micId = t.value; saveLocal(); await adapter()?.setAudioInputDevice?.(t.value); }
    if (t.matches("[data-sp-speaker]")) { state.devices.speakerId = t.value; saveLocal(); await adapter()?.setAudioOutputDevice?.(t.value); }
  });
  document.addEventListener("keydown", async (event) => {
    if (!root() || !document.body.dataset.activePanel?.includes("space-phone")) return;
    const tag = String(event.target?.tagName || "").toLowerCase();
    if (event.key === "Enter" && tag === "input" && event.target.matches("[data-sp-dial]")) { event.preventDefault(); await startCall(); }
    if (event.key === "Escape") { state.popover = ""; render(); }
    if (tag === "input" || tag === "textarea" || event.metaKey || event.ctrlKey) return;
    if (event.key.toLowerCase() === "m") document.querySelector("[data-sp-mute]")?.click();
    if (event.key.toLowerCase() === "h") document.querySelector("[data-sp-hold]")?.click();
  });
  every(() => { try { const timer = document.querySelector("[data-sp-timer]"); if (timer && ["active", "hold"].includes(state.call.status)) timer.textContent = fmtSec(callSeconds()); const online = document.querySelector(".sphone-online"); if (online && ACTIVE.has(state.call.status)) { const ps = phoneStatus(); online.innerHTML = `<span class="sphone-dot" data-tone="${ps.tone}"></span>${esc(ps.label)}`; } } catch {} }, 1000);
  navigator.mediaDevices?.addEventListener?.("devicechange", () => loadDevices().then(render));

  let unsub = null;
  const subscribeCore = () => {
    if (unsub || typeof adapter()?.subscribe !== "function") return;
    unsub = adapter().subscribe((snap) => { syncFromCore(snap); render(); });
  };
  window.SpacePhoneModule = { open: async () => { subscribeCore(); await loadDevices(); syncFromCore(adapter()?.getState?.()); render(); await load({ silent: true }); }, state };
  if (document.body?.dataset.initialPanel === "space-phone") window.SpacePhoneModule.open();
}());
