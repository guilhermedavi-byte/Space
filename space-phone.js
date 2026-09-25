(function () {
  const esc = (value) => String(value == null ? "" : value).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  const domAlive = () => typeof document !== "undefined" && typeof document.querySelector === "function" && document.body;
  const root = () => domAlive() ? document.querySelector('[data-panel="space-phone"] [data-space-phone]') : null;
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
  const QUAL_FIELDS = [
    ['context', 'Contexto'],
    ['painGoal', 'Objetivo / Dor'],
    ['experience', 'Experiência'],
    ['urgency', 'Urgência'],
    ['decisionInvestment', 'Decisão / Investimento'],
    ['keyPoint', 'Ponto-chave'],
  ];
  const QUAL_REQUIRED = new Set(['context', 'painGoal', 'urgency', 'decisionInvestment', 'keyPoint']);
  const ACTIVE = new Set(["connecting", "ringing", "active", "hold", "ending"]);
  const POST = new Set(["ended", "failed"]);

  const PERIODS = new Set(['today', 'last7', 'last30']);
  const readPeriod = () => { try { const value = localStorage.getItem('spacePhonePeriod'); return PERIODS.has(value) ? value : 'last7'; } catch { return 'last7'; } };
  const setPeriod = value => { state.period = PERIODS.has(value) ? value : 'last7'; try { localStorage.setItem('spacePhonePeriod', state.period); } catch {} };
  const state = {
    period: readPeriod(),
    status: "",
    sdr: (() => { try { return localStorage.getItem("spacePhoneSdr") || "all"; } catch { return "all"; } })(),
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
    postCall: { id: "", polls: 0, status: "idle", call: null, savedOutcome: "", saveStatus: "", skipped: false },
    qualification: { voiceCallId: "", values: {}, ai: {}, finalSummary: "", status: "draft", saveStatus: "", error: "", datacrazy: {} },
    aiApply: { callId: "", pending: false, message: "" },
    qualificationTimers: new Map(),
    noteTimers: new Map(),
    lastTimerText: "",
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
  const liveTalkTimeSeconds = () => Number(state.data?.analytics?.talkTimeSeconds || 0) + (ACTIVE.has(state.call.status) ? callSeconds() : 0);
  const localNormalize = (value) => {
    const raw = String(value || "").trim();
    if (!raw) return "";
    return window.SpaceInternationalPhone?.normalizePhoneToE164(raw, { defaultCountry: 'US', preferCountry: true }) || adapter()?.normalizePhone?.(raw, 'US') || '';
  };
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
  const currentCallId = () => state.detail?.call?.id || state.postCall.id || state.call.id || state.qualification.voiceCallId || "";
  const normalizeQualification = (q = {}) => ({
    voiceCallId: q.voiceCallId || q.voice_call_id || currentCallId(),
    values: { context: q.context || "", painGoal: q.painGoal || "", experience: q.experience || "", urgency: q.urgency || "", decisionInvestment: q.decisionInvestment || "", keyPoint: q.keyPoint || "" },
    ai: q.ai || {},
    finalSummary: q.finalSummary || "",
    status: q.status || "draft",
    aiStatus: q.aiStatus || "pending",
    saveStatus: state.qualification?.saveStatus || "",
    error: "",
    datacrazy: q.datacrazy || {},
  });
  const mergeQualification = (q) => {
    if (!q) return;
    const values = { ...state.qualification.values };
    state.qualification = normalizeQualification(q);
    for (const field of state.qualificationTimers.keys()) {
      if (field === 'finalSummary') state.qualification.finalSummary = document.querySelector('[data-sp-final-summary]')?.value || state.qualification.finalSummary;
      else state.qualification.values[field] = values[field];
    }
  };
  let qualificationSaveQueue = Promise.resolve();
  const qualificationMissing = () => [...QUAL_REQUIRED].filter((field) => !String(state.qualification.values[field] || "").trim());
  const qualificationComplete = () => !qualificationMissing().length;
  const setQualificationStatus = (text, tone = "warn") => { state.qualification.saveStatus = text; const el = document.querySelector('[data-sp-qual-status]'); if (el) { el.textContent = text; el.className = `sphone-badge ${tone}`; } };

  const injectStyle = () => {
    if (document.getElementById("space-phone-style")) return;
    const s = document.createElement("style");
    s.id = "space-phone-style";
    s.textContent = `
body.sphone-detail-open{overflow:hidden}body[data-active-panel="space-phone"] .space-phone-shell{display:none!important}.sphone{max-width:1500px;margin:0 auto;padding:22px;color:#f7fbff}.sphone *,#sphone-detail-portal *{box-sizing:border-box}.sphone h1,.sphone h2,.sphone h3,.sphone p{margin:0}.sphone-shell{background:linear-gradient(180deg,#0b1119,#080d14);border:1px solid rgba(255,255,255,.08);border-radius:22px;box-shadow:0 24px 70px rgba(0,0,0,.34);overflow:hidden}.sphone-head{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:24px 26px 14px}.sphone-title h1{font-size:1.65rem;letter-spacing:-.03em;font-weight:900}.sphone-title span,.sphone-muted{color:rgba(247,251,255,.58);font-size:.84rem}.sphone-online{display:inline-flex;align-items:center;gap:8px;border:1px solid rgba(255,255,255,.09);border-radius:999px;padding:8px 12px;font-weight:850;font-size:.8rem;background:rgba(255,255,255,.045)}.sphone-dot{width:8px;height:8px;border-radius:999px;background:#7dd3a8;box-shadow:0 0 0 4px rgba(125,211,168,.11)}.sphone-dot[data-tone=warn]{background:#f8c76b;box-shadow:0 0 0 4px rgba(248,199,107,.11)}.sphone-dot[data-tone=bad]{background:#ff6b62;box-shadow:0 0 0 4px rgba(255,107,98,.11)}.sphone-kpis{display:flex;align-items:center;gap:8px;padding:0 26px 18px;flex-wrap:wrap}.sphone-kpi{border:1px solid rgba(255,255,255,.07);background:rgba(255,255,255,.035);border-radius:12px;padding:9px 12px;min-width:108px}.sphone-kpi span{display:block;color:rgba(247,251,255,.46);font-size:.68rem;font-weight:850}.sphone-kpi strong{display:block;margin-top:3px;font-size:1rem}.sphone-toolbar{display:flex;gap:10px;align-items:center;justify-content:space-between;padding:12px 26px;border-top:1px solid rgba(255,255,255,.06);border-bottom:1px solid rgba(255,255,255,.06)}.sphone-filters{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.sphone-btn,.sphone-icon,.sphone-input,.sphone-select,.sphone-textarea{border:1px solid rgba(255,255,255,.11);background:rgba(255,255,255,.055);color:#fff;border-radius:12px;font:inherit;outline:none}.sphone-btn:hover,.sphone-icon:hover{background:rgba(255,255,255,.09)}.sphone-btn:focus-visible,.sphone-icon:focus-visible,.sphone-input:focus-visible,.sphone-select:focus-visible,.sphone-textarea:focus-visible{box-shadow:0 0 0 3px rgba(255,93,85,.24);border-color:rgba(255,93,85,.7)}.sphone-btn{min-height:38px;padding:0 13px;font-weight:850;cursor:pointer}.sphone-btn.primary{background:#ff5d55;border-color:#ff756f;color:#190807}.sphone-btn.danger{background:#dc342e;border-color:#ef625d}.sphone-btn.ghost{background:transparent}.sphone-btn:disabled{opacity:.42;cursor:not-allowed}.sphone-icon{width:40px;height:40px;display:grid;place-items:center;cursor:pointer}.sphone-input,.sphone-select{height:40px;padding:0 12px}.sphone-textarea{width:100%;min-height:92px;padding:12px;resize:vertical}.sphone-qual{display:grid;gap:10px}.sphone-qual label{display:grid;gap:5px}.sphone-qual .sphone-textarea{min-height:58px}.sphone-qual-head{display:flex;align-items:center;justify-content:space-between;gap:10px}.sphone-ai-suggestion{border:1px solid rgba(125,211,168,.18);background:rgba(125,211,168,.07);border-radius:14px;padding:12px;display:grid;gap:8px}.sphone-warnline{color:#f8d48b;font-size:.8rem}.sphone-grid{display:grid;grid-template-columns:260px minmax(380px,1fr) 340px;min-height:590px}.sphone-pane{padding:20px;min-width:0}.sphone-pane+.sphone-pane{border-left:1px solid rgba(255,255,255,.06)}.sphone-pane h2{font-size:.72rem;color:rgba(247,251,255,.48);letter-spacing:.02em;font-weight:900;margin-bottom:12px;text-transform:uppercase}.sphone-dial-input{font-size:1.1rem;height:50px;width:100%;margin-bottom:10px}.sphone-dial-actions{display:flex;gap:8px;margin:14px 0}.sphone-list{display:grid;gap:8px;margin-top:14px}.sphone-chip{display:flex;align-items:center;justify-content:space-between;gap:8px;border:0;border-radius:12px;padding:10px 12px;background:rgba(255,255,255,.045);color:rgba(247,251,255,.8);font-size:.84rem;cursor:pointer;text-align:left}.sphone-chip:hover{background:rgba(255,255,255,.075)}.sphone-control-wrap{position:relative;display:inline-flex}.sphone-control-wrap .sphone-keypad-pop,.sphone-control-wrap .sphone-audio-pop{position:absolute;z-index:30;top:calc(100% + 8px);right:0;margin-top:0;border:1px solid rgba(255,255,255,.1);border-radius:16px;padding:12px;background:#101924;box-shadow:0 18px 44px rgba(0,0,0,.34);width:min(228px,calc(100vw - 32px))}.sphone-audio-pop{width:min(300px,calc(100vw - 32px));display:grid;gap:10px}.sphone-keypad{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.sphone-key{height:48px;border-radius:12px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.055);color:#fff;font-size:1.08rem;font-weight:850;cursor:pointer}.sphone-active{height:100%;display:grid;align-content:center;justify-items:center;text-align:center;gap:18px}.sphone-ready-icon{width:76px;height:76px;border-radius:24px;display:grid;place-items:center;background:rgba(255,255,255,.045);font-size:2rem}.sphone-call-name{font-size:1.42rem;font-weight:900;letter-spacing:-.02em}.sphone-call-number{font-size:.96rem;color:rgba(247,251,255,.62);margin-top:5px}.sphone-timer{font-size:4rem;font-weight:950;letter-spacing:-.06em;line-height:1}.sphone-call-actions{display:flex;gap:10px;justify-content:center;flex-wrap:wrap}.sphone-call-actions .sphone-icon{width:58px;height:58px;border-radius:18px;font-weight:900}.sphone-call-actions .danger{width:70px;background:#ed433b;border-color:#ff6f68}.sphone-context{display:grid;gap:12px}.sphone-card{border:1px solid rgba(255,255,255,.075);background:rgba(255,255,255,.035);border-radius:16px;padding:14px;display:grid;gap:10px}.sphone-coach-title{display:flex;align-items:center;justify-content:space-between;gap:10px}.sphone-coach-event{border-left:3px solid rgba(255,93,85,.8);padding:9px 0 9px 12px}.sphone-script{display:grid;gap:7px}.sphone-script span{display:flex;gap:8px;align-items:center;color:rgba(247,251,255,.7);font-size:.86rem}.sphone-progress{height:8px;border-radius:99px;background:rgba(255,255,255,.08);overflow:hidden}.sphone-progress b{display:block;height:100%;background:#7dd3a8}.sphone-post-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.sphone-ai-score{font-size:2.4rem;font-weight:950;letter-spacing:-.05em}.sphone-outcomes{display:grid;grid-template-columns:1fr 1fr;gap:8px}.sphone-outcome{min-height:36px;font-size:.78rem}.sphone-history{border-top:1px solid rgba(255,255,255,.06);padding:20px 26px 26px}.sphone-history-head{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:12px}.sphone-table-wrap{overflow:auto}.sphone-table{width:100%;border-collapse:separate;border-spacing:0 6px;min-width:880px}.sphone-table th,.sphone-table td{padding:10px 12px;text-align:left;font-size:.84rem}.sphone-table th{font-size:.68rem;color:rgba(247,251,255,.45);font-weight:900;text-transform:uppercase}.sphone-table tbody tr{background:rgba(255,255,255,.035)}.sphone-table tbody td:first-child{border-radius:12px 0 0 12px}.sphone-table tbody td:last-child{border-radius:0 12px 12px 0}.sphone-badge{display:inline-flex;align-items:center;gap:6px;border-radius:999px;padding:4px 9px;background:rgba(255,255,255,.08);font-weight:850;font-size:.74rem}.sphone-badge.ok{color:#8ee7bb;background:rgba(62,183,127,.13)}.sphone-badge.bad{color:#ffaaa5;background:rgba(255,93,85,.14)}.sphone-badge.warn{color:#f8d48b;background:rgba(248,199,107,.13)}.sphone-drawer{position:fixed;inset:0;z-index:10000}.sphone-backdrop{position:absolute;inset:0;background:rgba(0,0,0,.58)}.sphone-drawer-panel{position:absolute;right:0;top:0;width:min(620px,100vw);height:100dvh;overflow:hidden;background:#0c141e;border-left:1px solid rgba(255,255,255,.12);color:#fff;display:flex;flex-direction:column}.sphone-drawer-head{display:flex;justify-content:space-between;gap:12px;padding:20px 22px;border-bottom:1px solid rgba(255,255,255,.07)}.sphone-drawer-body{padding:18px 22px;overflow-y:auto;flex:1;min-height:0;display:flex;flex-direction:column;gap:14px}.sphone-drawer-head{flex-shrink:0}.sphone-drawer-body>*{flex-shrink:0}.sphone-tabs{flex-direction:row!important;align-items:center;flex-shrink:0}.sphone-tabs .sphone-btn{height:38px;flex:0 0 auto}.sphone-pane:last-child{max-height:calc(100dvh - 160px);overflow-y:auto}.sphone-shell .sphone-grid{align-items:stretch}.sphone-tabs{display:flex;gap:8px}.sphone-tabs .sphone-btn[aria-selected=true]{background:rgba(255,93,85,.18);border-color:rgba(255,93,85,.45)}.sphone-detail-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.sphone-detail-item{border:1px solid rgba(255,255,255,.075);border-radius:12px;padding:10px;background:rgba(255,255,255,.035)}.sphone-detail-item span{display:block;color:rgba(247,251,255,.48);font-size:.68rem;text-transform:uppercase;font-weight:900;margin-bottom:5px}.sphone-pre{white-space:pre-wrap;line-height:1.58;color:rgba(247,251,255,.78)}.sphone-empty{padding:26px;text-align:center;color:rgba(247,251,255,.55)}@media(max-width:1180px){.sphone-grid{grid-template-columns:1fr}.sphone-pane+.sphone-pane{border-left:0;border-top:1px solid rgba(255,255,255,.06)}}@media(max-width:720px){.sphone{padding:12px}.sphone-head,.sphone-toolbar,.sphone-history-head{display:grid}.sphone-kpis{padding:0 16px 16px}.sphone-post-grid,.sphone-detail-grid{grid-template-columns:1fr}.sphone-timer{font-size:3rem}}`;
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
      ${kpi("Calls", a.totalCalls || 0)}${kpi("Atendidas", a.connectedCalls || 0)}${kpi("Connect rate", `${Math.round((a.connectRate || 0) * 100)}%`)}<article class="sphone-kpi"><span>Talk time</span><strong data-sp-talk-time>${esc(fmtSec(liveTalkTimeSeconds()))}</strong></article>${kpi("Agendamentos", a.scheduledCalls == null ? "-" : a.scheduledCalls)}
    </section>`;
  };

  let conversionData=null, conversionError='', conversionFlight=false, conversionQueued=false, conversionRankingOpen=false;
  document.addEventListener('toggle', e => { if(e.target.matches?.('[data-sp-conversion-ranking]'))conversionRankingOpen=e.target.open; }, true);
  const pct = rate => rate?.percent == null ? '—' : `${Number(rate.percent).toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1})}%`;
  const renderConversion = () => {
    const c=conversionData;
    const labels=[['attendance','Taxa de atendimento'],['callToBooking','Ligação → Agendamento'],['answeredToBooking','Atendida → Agendamento'],['bookingToDone','Agendado → Feito']];
    return `<section class="sphone-conversion" data-sp-conversion><h2>Conversão <span tabindex="0" role="img" aria-label="Critério das taxas" title="Agendadas = resultado comercial da chamada. Chamadas pelo início da ligação; bookings pela data da reunião.">ⓘ</span></h2>${conversionError ? `<p role="status">${esc(conversionError)}</p>` : ''}<div class="sphone-conversion-grid">${labels.map(([key,label])=>`<article class="sphone-kpi"><span>${label}</span><strong>${c?pct(c[key]):'—'}</strong><small>${c?`${c[key].numerator} / ${c[key].denominator}`:'Carregando…'}</small></article>`).join('')}</div>${c?.unlinked?`<span class="sphone-pending" tabindex="0" title="Bookings aguardando vínculo único com a reunião; não contam como feitos.">⚠ ${c.unlinked} pendências</span>`:''}</section>`;
  };
  const renderRanking = () => { const c=conversionData; return `<section class="sphone-ranking" data-sp-ranking>${managerMode() ? `${c?.ranking?`<details data-sp-conversion-ranking ${conversionRankingOpen?'open':''}><summary>Ranking de Conversão por SDR</summary><div class="sphone-conversion-table"><table><thead><tr>${['SDR','Ligações','Atendidas','Agendadas','Feitas','Taxa atendimento','Call → Agendamento','Atendida → Agendamento','Agendado → Feito'].map(t=>`<th>${t}</th>`).join('')}</tr></thead><tbody>${c.ranking.map(r=>`<tr><td>${esc(r.displayName)}</td>${[r.calls,r.answered,r.scheduled,r.done,pct(r.attendance),pct(r.callToBooking),pct(r.answeredToBooking),pct(r.bookingToDone)].map(v=>`<td>${esc(v)}</td>`).join('')}</tr>`).join('')||'<tr><td colspan="9">Sem dados no período.</td></tr>'}</tbody></table></div></details>`:''}` : ''}</section>`; };
  const refreshConversion = async () => {
    if(!domAlive() || document.hidden || document.body.dataset.activePanel!=='space-phone')return;
    if(conversionFlight){conversionQueued=true;return;}
    conversionFlight=true;
    const period=state.period,sdr=state.sdr;
    try{
      const result=await api({view:'conversion',period,sdr});
      if(period!==state.period||sdr!==state.sdr){conversionQueued=true;return;}
      conversionData=result.conversion||null;conversionError='';
    }catch{conversionError='Conversão temporariamente indisponível. Tentaremos novamente.';conversionData=null;}
    finally{
      conversionFlight=false;
      if(!domAlive())return;
      const el=document.querySelector('[data-sp-conversion]');if(el)el.outerHTML=renderConversion();
      const ranking=document.querySelector("[data-sp-ranking]");if(ranking)ranking.outerHTML=renderRanking();
      if(conversionQueued){conversionQueued=false;void refreshConversion();}
    }
  };
  every(refreshConversion,10000);
  ['space-phone:call-updated','space-bookings:updated','online'].forEach(name=>window.addEventListener(name,refreshConversion));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshConversion();});

  const managerMode = () => state.data?.scope === 'admin';
  const operatorMode = () => state.data?.scope === 'growth';
  let filtersOpen = false;
  const renderKeypad = (mode) => `<div class="sphone-keypad">${["1","2","3","4","5","6","7","8","9","*","0","#"].map((key) => `<button class="sphone-key" data-${mode}="${esc(key)}">${esc(key)}</button>`).join("")}</div>`;
  const renderDialer = () => `
    <section class="sphone-pane">
      <h2>Discador</h2>
      <input class="sphone-input sphone-dial-input" data-sp-dial data-phone-country="US" value="${esc(state.dial)}" type="tel" autocomplete="tel" placeholder="+1 (___) ___-____" />
      <div class="sphone-muted" data-sp-normalized>${state.normalized ? `E.164 ${esc(state.normalized)}` : state.dialError ? esc(state.dialError) : "Digite ou cole um número com DDI."}</div>
      <div class="sphone-dial-actions">
        <button class="sphone-btn primary" data-sp-call ${ACTIVE.has(state.call.status) ? "disabled" : ""}>${state.call.status === "connecting" ? "Conectando..." : "Ligar"}</button>
        <span class="sphone-control-wrap"><button class="sphone-btn" data-sp-popover="dialpad">⌨ Keypad</button>${state.popover === "dialpad" ? `<div class="sphone-keypad-pop">${renderKeypad("sp-key")}</div>` : ""}</span>
        <button class="sphone-btn ghost" data-sp-backspace>⌫</button>
      </div>
      <div class="sphone-list"><h2>Recentes</h2>${state.recents.map((item) => `<button class="sphone-chip" data-sp-fill="${esc(item)}"><span>${esc(item)}</span><small>Redial</small></button>`).join("") || `<div class="sphone-muted">Nenhum número recente.</div>`}</div>
    </section>`;

  const renderCenter = () => {
    const op = operationState();
    if (op === "IDLE") return `<section class="sphone-pane"><div class="sphone-active"><div class="sphone-ready-icon">☎</div><div><div class="sphone-call-name">Pronto para ligar</div><div class="sphone-call-number">Escolha um lead no CRM ou use o discador.</div></div><span class="sphone-control-wrap"><button class="sphone-btn" data-sp-popover="audio">⚙ Audio</button>${state.popover === "audio" ? renderAudioPopover() : ""}</span></div></section>`;
    if (op === "POST_CALL") return `<section class="sphone-pane"><div class="sphone-active"><div><div class="sphone-call-name">Ligação encerrada</div><div class="sphone-call-number">${esc(state.call.name || state.call.number || "Última chamada")}</div></div><div class="sphone-timer">${fmtSec(callSeconds())}</div><div class="sphone-call-actions"><button class="sphone-btn" data-sp-popover="audio">⚙ Audio</button><button class="sphone-btn primary" data-sp-reset-call>Nova ligação</button></div></div></section>`;
    return `<section class="sphone-pane"><div class="sphone-active"><div><div class="sphone-call-name">${esc(state.call.name || "Chamada em andamento")}</div><div class="sphone-call-number">${esc(state.call.number || "-")}</div></div><div class="sphone-timer" data-sp-timer>${fmtSec(callSeconds())}</div><div class="sphone-muted">${esc(statusLabel(state.call.status))} · Caller ID ${esc(state.call.callerId || "-")}</div>${state.call.error ? `<div class="sphone-badge bad">${esc(state.call.error)}</div>` : ""}<div class="sphone-call-actions"><button class="sphone-icon" data-sp-mute title="Mute">${state.call.muted ? "🔊" : "🎙"}</button><button class="sphone-icon" data-sp-hold title="Hold">${state.call.held ? "▶" : "⏸"}</button><span class="sphone-control-wrap"><button class="sphone-icon" data-sp-popover="dtmf" data-sp-dtmf-toggle title="Keypad">⌨</button>${state.popover === "dtmf" ? `<div class="sphone-keypad-pop">${renderKeypad("sp-dtmf")}</div>` : ""}</span><span class="sphone-control-wrap"><button class="sphone-icon" data-sp-popover="audio" title="Audio">⚙</button>${state.popover === "audio" ? renderAudioPopover() : ""}</span><button class="sphone-icon danger" data-sp-hangup title="Hangup">✕</button></div></div></section>`;
  };

  const renderAudioPopover = () => `<div class="sphone-audio-pop"><label><span class="sphone-muted">Microfone</span><select class="sphone-select" data-sp-mic>${state.devices.microphones.map((d) => `<option value="${esc(d.deviceId)}" ${state.devices.micId === d.deviceId ? "selected" : ""}>${esc(d.label || "Microfone")}</option>`).join("")}</select></label><label><span class="sphone-muted">Saída</span><select class="sphone-select" data-sp-speaker>${[`<option value="">Default</option>`, ...state.devices.speakers.map((d) => `<option value="${esc(d.deviceId)}" ${state.devices.speakerId === d.deviceId ? "selected" : ""}>${esc(d.label || "Saída")}</option>`)].join("")}</select></label><button class="sphone-btn" data-sp-test-device>Testar dispositivo</button><span class="sphone-muted">Permissão: ${esc(state.devices.permission)}</span></div>`;

  const callbackBusy = new Set();
  let callbackItems = [], notificationItems = [];
  const dismissedCallbacks = new Map();
  try { for (const item of JSON.parse(sessionStorage.getItem("spaceCallbackDismissed") || "[]")) dismissedCallbacks.set(...item); } catch {}
  const callbackKey = c => `${c.id}:${c.callbackAt}`;
  let callbackError = '';
  let callbackPolling = false;
  const callbackLabel = c => {
    const seconds = Math.ceil((Date.parse(c.callbackAt) - Date.now()) / 1000);
    return seconds < -60 ? `Callback atrasado há ${Math.floor(-seconds / 60)} min` : seconds <= 0 ? 'Hora de retornar' : seconds < 86400 ? `Retornar em ${fmtSec(seconds)}` : fmtDate(c.callbackAt);
  };
  const callbackMenu = c => `<details class="sphone-callback-menu"><summary aria-label="Ações do retorno" title="Ações do retorno">⋯</summary><div><button class="sphone-btn" data-callback-action="10" data-callback-id="${esc(c.id)}">Adiar 10 min</button><button class="sphone-btn" data-callback-action="30" data-callback-id="${esc(c.id)}">Adiar 30 min</button><label>Novo horário<input class="sphone-input" type="datetime-local" aria-label="Novo horário do callback" data-callback-date="${esc(c.id)}"></label><button class="sphone-btn" data-callback-action="custom" data-callback-id="${esc(c.id)}">Salvar horário</button><button class="sphone-btn" data-callback-action="complete" data-callback-id="${esc(c.id)}">Concluir</button><button class="sphone-btn ghost" data-callback-action="cancel" data-callback-id="${esc(c.id)}">Cancelar retorno</button></div></details>`;
  const callbackRow = c => `<article class="sphone-callback-row" data-callback-row="${esc(c.id)}"><span class="sphone-badge" data-callback-clock="${esc(c.id)}">${esc(callbackLabel(c))}</span><div><strong>${esc(c.name || c.number)}</strong><small>${esc(c.number)} · ${esc(fmtDate(c.callbackAt))}</small></div><div class="sphone-call-actions"><button class="sphone-btn primary" data-callback-action="call" data-callback-id="${esc(c.id)}" ${ACTIVE.has(adapter()?.getState?.()?.status) || callbackBusy.has(c.id) ? 'disabled' : ''}>Ligar agora</button>${callbackMenu(c)}</div></article>`;
  const renderCallbacks = () => `<section class="sphone-card sphone-callbacks" data-callback-queue><h2>Callbacks</h2>${callbackError ? `<p role="status">${esc(callbackError)}</p>` : ''}${callbackItems.map(callbackRow).join('') || '<p class="sphone-muted">Nenhum callback pendente.</p>'}</section>`;
  const patchCallbacks = () => {
    if (!domAlive()) return;
    const queue = document.querySelector('[data-callback-queue]');
    // Do not replace a custom date being edited during background refresh.
    if (queue && !queue.contains(document.activeElement)) queue.outerHTML = renderCallbacks();
    tickCallbacks();
  };
  const refreshCallbacks = async () => {
    if (!domAlive() || callbackPolling || typeof window.fetchWithAuth !== 'function') return;
    callbackPolling = true;
    try {
      const selectedSdr=state.sdr;
      const [result, notifications] = await Promise.all([api({view:'callbacks',sdr:selectedSdr}),api({view:'callback-notifications'})]);
      notificationItems = notifications.callbacks || [];
      if(selectedSdr!==state.sdr)return;
      callbackItems = result.callbacks || []; callbackError = ''; patchCallbacks();
    } catch { callbackError = 'Não foi possível atualizar os retornos. Tentaremos novamente.'; }
    finally { callbackPolling = false; }
  };
  const tickCallbacks = () => {
    if (!domAlive()) return;
    document.querySelectorAll('[data-callback-clock]').forEach(node => {
      const c = [...callbackItems,...notificationItems].find(c => c.id === node.dataset.callbackClock);
      if (c) { node.textContent = callbackLabel(c); node.dataset.overdue = String(Date.parse(c.callbackAt) <= Date.now()); }
    });
    document.querySelectorAll('[data-callback-action="call"]').forEach(button=>{button.disabled=ACTIVE.has(adapter()?.getState?.()?.status)||callbackBusy.has(button.dataset.callbackId);});
    let alert = document.getElementById('space-callback-alert');
    const outside = document.body.dataset.activePanel !== 'space-phone';
    const due = notificationItems.filter(c => Date.parse(c.callbackAt) <= Date.now() && (dismissedCallbacks.get(callbackKey(c)) || 0) < Date.now());
    if (!outside || !due.length || managerMode() || window.__SPACE_SESSION__?.role === 'admin') { alert?.remove(); return; }
    if (!alert) { alert = document.createElement('aside'); alert.id='space-callback-alert'; alert.className='sphone-callback-alert'; document.body.appendChild(alert); }
    const active = ACTIVE.has(adapter()?.getState?.()?.status);
    const c=due[0], key=callbackKey(c);
    if (alert.dataset.callbackKey !== key) { alert.dataset.callbackKey=key; alert.innerHTML=`<button class="sphone-dismiss" data-callback-dismiss="${esc(key)}" aria-label="Fechar notificação">×</button><strong>${esc(c.name || c.number)}</strong><span role="status" data-callback-clock="${esc(c.id)}">${esc(callbackLabel(c))}</span><div class="sphone-call-actions"><button class="sphone-btn primary" data-callback-action="call" data-callback-id="${esc(c.id)}" ${active?'disabled':''}>Ligar agora</button>${callbackMenu(c)}</div>`; }

  };
  const renderCallbackPicker = (outcome = state.postCall.savedOutcome) => outcome === 'retornar_depois' ? `<div class="sphone-card"><strong>Quando retornar?</strong><div class="sphone-call-actions">${[[15,'15 min'],[30,'30 min'],[60,'1 hora'],[120,'2 horas'],['tomorrow','Amanhã']].map(([v,l])=>`<button class="sphone-btn" data-callback-schedule="${v}">${l}</button>`).join('')}</div><label>Escolher data/horário<input class="sphone-input" data-sp-callback type="datetime-local"></label><button class="sphone-btn" data-callback-schedule="custom">Salvar retorno</button><p role="status" data-callback-feedback></p></div>` : '';
  const renderIdleRight = () => `<section class="sphone-pane"><h2>Retornos programados</h2><p class="sphone-muted">${callbackItems.length} callback(s) na fila abaixo.</p></section>`;

  const hasSuggestion = value => typeof value === 'string' && Boolean(value.trim()) && !/^(não validado|precisa ser validado|não informado|não identificado|sem evidência na transcrição)[.!\s]*$/i.test(value.trim());
  const renderQualificationForm = ({ post = false, detail = false } = {}) => {
    if (state.detail && !detail) return "";
    const q = state.qualification;
    const ai = q.ai || {};
    const missing = qualificationMissing();
    const aiReadyFields = QUAL_FIELDS.some(([key]) => hasSuggestion(ai[key]));
    const correlationCall = state.detail?.call || state.postCall.call || {};
    const endedTime = Date.parse(correlationCall.endedAt || correlationCall.startedAt || '');
    const transcriptDelayed = !correlationCall.transcript && Number.isFinite(endedTime) && Date.now() - endedTime >= 600000;
    const aiProgress = aiReadyFields ? 'Sugestões IA disponíveis' : q.status === 'ai_processing' ? 'Gerando sugestões IA' : transcriptDelayed ? 'Transcrição ainda não disponível' : 'Aguardando transcrição';
    const fields = QUAL_FIELDS.map(([key, label]) => `<label><span class="sphone-muted">${esc(label)}${QUAL_REQUIRED.has(key) ? ' *' : ''}</span><textarea class="sphone-textarea" data-sp-qual="${esc(key)}" placeholder="${esc(label)}">${esc(q.values[key] || '')}</textarea>${missing.includes(key) && post ? `<small class="sphone-warnline">Campo obrigatório para agendado.</small>` : ''}</label>`).join('');
    return `<div class="sphone-card"><div class="sphone-qual-head"><strong>Qualificação</strong><span class="sphone-badge ${q.saveStatus === 'Salvo ✓' ? 'ok' : 'warn'}" data-sp-qual-status>${esc(q.saveStatus || (['complete','sent'].includes(q.status) ? 'Qualificação concluída ✓' : 'SDR preenchendo'))}</span></div><p class="sphone-muted" data-sp-ai-progress>${aiProgress}</p><div class="sphone-qual">${fields}</div>${aiReadyFields ? `<div class="sphone-ai-suggestion"><strong>Resumo sugerido pela IA</strong><p class="sphone-muted">Revise antes de enviar. Campos sem evidência ficam como “Precisa ser validado”.</p>${QUAL_FIELDS.map(([key,label]) => hasSuggestion(ai[key]) ? `<small><b>${esc(label)}:</b> ${esc(ai[key])}</small>` : '').join('')}<button class="sphone-btn" data-sp-apply-ai ${state.aiApply.pending && state.aiApply.callId === currentCallId() ? "disabled" : ""}>Aplicar sugestões da IA</button><p class="sphone-muted" data-sp-ai-feedback role="status" aria-live="polite">${state.aiApply.callId === currentCallId() ? esc(state.aiApply.message) : ""}</p></div>` : `<p class="sphone-muted">Nenhuma sugestão confiável encontrada na transcrição.</p><p class="sphone-muted">Análise disponível após a ligação, quando a transcrição real estiver disponível.</p>`}<p class="sphone-muted" data-sp-handoff>${['complete','sent'].includes(q.status) && q.datacrazy?.syncStatus !== 'sent' ? 'Handoff Datacrazy pendente' : ''}</p>${q.aiStatus === 'failed' ? '<p class="sphone-muted">Sugestões IA pendentes. Você pode continuar preenchendo e concluir manualmente.</p>' : ''}${(post || detail) && !aiReadyFields && (!['complete','sent'].includes(q.status) || correlationCall.analysisWarning || !correlationCall.transcriptionAvailable) ? `<button class="sphone-btn" data-sp-retry-ai>${transcriptDelayed ? 'Buscar novamente' : 'Buscar sugestões IA novamente'}</button>` : ''}${post ? `<textarea class="sphone-textarea" data-sp-final-summary placeholder="Resumo final para handoff">${esc(q.finalSummary || '')}</textarea>` : ''}</div>`;
  };
  const renderActiveRight = () => `<section class="sphone-pane"><h2>Qualificação</h2><div class="sphone-context">${renderQualificationForm()}</div></section>`;

  const renderPostCall = () => {
    const c = state.postCall.call?.id === state.postCall.id ? state.postCall.call : {};
    const ready = aiReady(c);
    const quick = new Set(["nao_atendeu", "agendado", "retornar_depois", "sem_interesse"]);
    const options = OUTCOMES.map(([value,label]) => `<button class="sphone-btn sphone-outcome ${state.postCall.savedOutcome === value ? "primary" : ""}" data-sp-outcome="${value}">${label}</button>`).join("");
    const status = state.postCall.saveStatus ? `<span class="sphone-badge ${state.postCall.saveStatus === "Salvo ✓" ? "ok" : "warn"}">${esc(state.postCall.saveStatus)}</span>` : "";
    return `<section class="sphone-pane"><div class="sphone-coach-title"><h2>Wrap-up</h2>${status || `<span class="sphone-badge ${ready ? "ok" : "warn"}">${ready ? "IA pronta" : "Aguardando transcript"}</span>`}</div><div class="sphone-context"><div class="sphone-card"><strong>Como terminou esta ligação?</strong><p class="sphone-muted">Marque o resultado comercial para atualizar o Painel SDR agora.</p><div class="sphone-outcomes">${OUTCOMES.filter(([v])=>quick.has(v)).map(([value,label]) => `<button class="sphone-btn sphone-outcome ${state.postCall.savedOutcome === value ? "primary" : ""}" data-sp-outcome="${value}">${label}</button>`).join("")}</div><details><summary class="sphone-muted" style="cursor:pointer">Mais opções</summary><div class="sphone-outcomes" style="margin-top:10px">${options}</div></details>${renderCallbackPicker()}<div class="sphone-call-actions"><button class="sphone-btn ghost" data-sp-skip-outcome>Pular por agora</button>${state.postCall.savedOutcome || state.postCall.skipped ? `<button class="sphone-btn primary" data-sp-reset-call>Nova ligação</button>` : ""}</div></div>${state.postCall.savedOutcome === "agendado" ? renderQualificationForm({ post: true }) : `<details><summary>Qualificação e sugestões IA</summary>${renderQualificationForm({ post: true })}</details>`}<div class="sphone-card">${ready ? `<div class="sphone-post-grid"><div><span class="sphone-muted">Score IA</span><div class="sphone-ai-score">${esc(c.score ?? "-")}</div></div><div><span class="sphone-muted">Status</span><p>${c.transcriptionAvailable ? "Transcrição pronta" : "Análise disponível"}</p></div></div><p>${esc(analysisText(c.analysis, ["summary", "resumo", "call_summary"]) || "Análise pronta no pipeline IA.")}</p><button class="sphone-btn" data-sp-detail="${esc(c.id || state.call.id)}">Ver análise completa</button>` : `<p class="sphone-muted">IA e gravação serão anexadas depois à mesma ligação. Você já pode marcar o resultado.</p>`}${state.postCall.savedOutcome === 'agendado' ? `<p class="sphone-muted">${esc(bookings.get(currentCallId())?.message || "Reunião ainda não confirmada na agenda")}</p><button class="sphone-btn" data-sp-booking>Agendar reunião</button><div class="sphone-call-actions"><button class="sphone-btn primary" data-sp-complete-qualification ${qualificationComplete() ? '' : 'disabled'}>Concluir qualificação</button></div><p class="sphone-muted">Salva a qualificação. O handoff será enviado quando estiver disponível.</p>` : `<p class="sphone-muted">Handoff automático só é habilitado quando o resultado for Agendado.</p>`}</div></div></section>`;
  };

  const renderRight = () => {
    const op = operationState();
    if (op === "ACTIVE" || op === "CALLING") return renderActiveRight();
    if (op === "POST_CALL") return renderPostCall();
    return renderIdleRight();
  };

  const aiBadge = c => `<span class="sphone-badge ${c.analysisStatus === 'completed' ? 'ok' : 'warn'}">${esc(({completed:'Pronta',analyzing:'Gerando IA',transcribing:'Transcrevendo',waiting_recording:'Aguardando gravação',failed:'Falhou'})[c.analysisStatus] || 'Aguardando gravação')}</span>`;
  const renderHistory = () => {
    const calls = state.data?.calls || [];
    return `<section class="sphone-history"><div class="sphone-history-head"><div><h2>Histórico</h2></div><button class="sphone-btn" data-sp-refresh aria-label="Atualizar histórico" title="Atualizar histórico">↻</button></div><div class="sphone-table-wrap"><table class="sphone-table"><thead><tr><th>Lead / número</th><th>SDR</th><th>Horário</th><th>Status</th><th>Duração</th><th>Resultado</th><th>IA</th><th></th></tr></thead><tbody>${calls.map((c) => `<tr><td><strong>${esc(c.leadName || c.number || "Lead")}</strong><br><span class="sphone-muted">${esc(c.number || "-")}</span></td><td>${esc(c.sdrName || "SDR")}</td><td>${esc(fmtDate(c.startedAt))}</td><td><span class="sphone-badge ${c.status === "connected" ? "ok" : c.status === "failed" ? "bad" : ""}">${esc(c.status)}</span></td><td>${fmtSec(c.durationSeconds)}</td><td>${esc(c.outcome || "-")}</td><td>${aiBadge(c)}</td><td><button class="sphone-btn" data-sp-detail="${esc(c.id)}">Detalhes</button></td></tr>`).join("") || `<tr><td colspan="8"><div class="sphone-empty">Nenhuma ligação encontrada no histórico.${state.status || state.q ? ' Há filtros ativos de status ou busca.' : ''}<br><button class="sphone-btn" data-sp-clear-filters>Limpar filtros</button></div></td></tr>`}</tbody></table></div>${state.data?.history?.hasMore ? `<div class="sphone-call-actions"><button class="sphone-btn" data-sp-load-more ${state.loading ? "disabled" : ""}>${state.loading ? "Carregando..." : "Carregar mais"}</button></div>` : ""}</section>`;
  };

  const renderDetailTab = (c) => {
    const analysis = parseAnalysis(c.analysis);
    if (state.detailTab === "transcript") return c.transcript ? `<div class="sphone-pre">${esc(c.transcript)}</div>` : `<p class="sphone-muted">Transcrição ainda não disponível.</p>`;
    if (state.detailTab === "scorecard" && c.score == null) return `<p class="sphone-muted">Scorecard ainda está sendo processado.</p>`;
    if (state.detailTab === "scorecard") return `<div class="sphone-context"><div class="sphone-card"><strong>Score</strong><div class="sphone-ai-score">${esc(c.score ?? "-")}/100</div></div><div class="sphone-card"><strong>Pontos fortes</strong><p class="sphone-muted">${esc(analysisText(analysis, ["strengths", "pontos_fortes", "positive_points"]) || "Aguardando scorecard estruturado.")}</p></div><div class="sphone-card"><strong>Melhorias</strong><p class="sphone-muted">${esc(analysisText(analysis, ["weaknesses", "improvements", "recommendations", "principal_melhoria"]) || "Aguardando recomendações.")}</p></div></div>`;
    return `<div class="sphone-detail-grid">${[["Telefone", c.number],["SDR", c.sdrName],["Status", c.status],["Duração", fmtSec(c.durationSeconds)],["Outcome", c.outcome || "-"],["Callback", fmtDate(c.callbackAt)]].map(([l,v]) => `<div class="sphone-detail-item"><span>${l}</span>${esc(v)}</div>`).join("")}</div>${renderCallbackPicker(c.outcome)}<div class="sphone-card"><strong>Resumo IA</strong>${c.analysisWarning ? `<p class="sphone-warnline">Análise inconsistente com o resultado informado. Verifique a gravação e a transcrição antes de usar sugestões.</p>` : ""}<p class="sphone-muted">${esc(analysisText(analysis, ["summary", "resumo", "call_summary"]) || c.analysisText || "Análise ainda não disponível.")}</p></div>${renderQualificationForm({ post: true, detail: true })}${c.outcome === 'agendado' ? `<p class="sphone-muted">${esc(bookings.get(c.id)?.message || 'Reunião ainda não confirmada na agenda')}</p><button class="sphone-btn" data-sp-booking>Agendar reunião</button><button class="sphone-btn primary" data-sp-complete-qualification ${qualificationComplete() ? '' : 'disabled'}>Concluir qualificação</button>` : ''}<div class="sphone-card"><strong>Notas</strong><textarea class="sphone-textarea" data-sp-detail-notes data-call-id="${esc(c.id)}">${esc(c.notes || "")}</textarea></div>`;
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
    const scrollPositions = [...document.querySelectorAll('*')].filter(node => node.scrollTop > 0 || node.scrollLeft > 0).map(node => ({node,top:node.scrollTop,left:node.scrollLeft,selector:node.classList.contains('sphone-drawer-body') ? '.sphone-drawer-body' : node.classList.contains('sphone-pane') ? '.sphone-pane:last-child' : null}));
    const focused = document.activeElement;
    const focusAttr = focused?.getAttributeNames?.().find(name => name.startsWith('data-sp-'));
    const focusValue = focusAttr ? focused.getAttribute(focusAttr) : '';
    const selection = [focused?.selectionStart, focused?.selectionEnd];
    const ps = phoneStatus();
    el.innerHTML = `<div class="sphone"><div class="sphone-shell"><header class="sphone-head"><div class="sphone-title"><h1>Ligações</h1></div>${operatorMode()?`<div class="sphone-online"><span class="sphone-dot" data-tone="${ps.tone}"></span>${esc(ps.label)}</div>`:""}</header>${renderKpis()}${renderConversion()}<div class="sphone-toolbar"><div class="sphone-filter-wrap"><button class="sphone-filter-trigger" data-sp-filter-toggle aria-label="Filtrar ligações" title="Filtrar ligações" aria-expanded="${filtersOpen}" aria-controls="sphone-filter-panel"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M3 5h18l-7 8v6l-4 2v-8z"/></svg>${[state.period!=='last7',managerMode()&&state.sdr!=='all',!!state.status,!!state.q].filter(Boolean).length || ''}</button><div id="sphone-filter-panel" class="sphone-filter-panel" ${filtersOpen?'':'hidden'}><label>Período<select class="sphone-select" data-sp-period aria-label="Período das ligações"><option value="today">Hoje</option><option value="last7">7 dias</option><option value="last30">30 dias</option></select></label>${state.data?.scope === "admin" ? `<label>SDR<select class="sphone-select" data-sp-sdr aria-label="SDR"><option value="all">Todos os SDRs</option>${(state.data.sdrs || []).map(sdr => `<option value="${esc(sdr.uid)}">${esc(sdr.displayName)}</option>`).join("")}</select></label>` : ""}<label>Status<select class="sphone-select" data-sp-status aria-label="Status"><option value="">Todos</option><option value="answered">Atendida</option><option value="unanswered">Não atendida</option><option value="scheduled">Agendada</option><option value="failed">Falhou</option></select></label><label>Buscar número<input class="sphone-input" type="search" data-sp-search placeholder="Buscar número" value="${esc(state.q)}" /></label><button class="sphone-btn" data-sp-clear-filters>Limpar filtros</button></div></div></div>${state.error ? `<div class="sphone-empty">${esc(state.error)}</div>` : ""}${operatorMode()?`<main class="sphone-grid">${renderDialer()}${renderCenter()}${renderRight()}</main>${renderCallbacks()}`:""}${renderHistory()}${renderRanking()}</div></div>`;
    let portal = document.getElementById('sphone-detail-portal');
    if (!portal) { portal = document.createElement('div'); portal.id = 'sphone-detail-portal'; document.body.appendChild(portal); }
    portal.innerHTML = renderDetail();
    const status = el.querySelector("[data-sp-status]");
    if (status) status.value = state.status;
    const period = el.querySelector("[data-sp-period]");
    if (period) period.value = state.period;
    const sdr = el.querySelector("[data-sp-sdr]");
    if (sdr) sdr.value = state.sdr;
    for (const item of scrollPositions) { const node = item.node.isConnected ? item.node : item.selector ? document.querySelector(item.selector) : null; if (node) { node.scrollTop = item.top; node.scrollLeft = item.left; } }
    document.body.classList.toggle('sphone-detail-open', Boolean(state.detail));
    if (focusAttr) { const next = [...document.querySelectorAll(`[${focusAttr}]`)].find(node => node.getAttribute(focusAttr) === focusValue); next?.focus({preventScroll:true}); if (typeof selection[0] === 'number') { try { next?.setSelectionRange(...selection); } catch {} } }
  };

  const patchDialDom = () => {
    const input = document.querySelector("[data-sp-dial]");
    const label = document.querySelector("[data-sp-normalized]");
    const button = document.querySelector("[data-sp-call]");
    if (input && input.value !== state.dial) input.value = state.dial;
    if (label) label.textContent = state.normalized ? `E.164 ${state.normalized}` : state.dialError || "Digite ou cole um número com DDI.";
    if (button) {
      button.disabled = ACTIVE.has(state.call.status);
      button.textContent = state.call.status === "connecting" ? "Conectando..." : "Ligar";
    }
  };
  const normalize = () => {
    const raw = state.dial.trim();
    state.normalized = raw ? localNormalize(raw) : "";
    state.dialError = raw && !state.normalized ? "Telefone inválido" : "";
    patchDialDom();
    return state.normalized;
  };
  let loadVersion = 0;
  const patchHistory = () => {
    const history = root()?.querySelector('.sphone-history');
    if (history) history.outerHTML = renderHistory();
  };
  const load = async ({ silent = false, patchOnly = false, analyticsOnly = false, appendHistory = false } = {}) => {
    const version = ++loadVersion;
    if (!silent) { state.loading = true; if (!patchOnly) render(); }
    try {
      const data = await api({ period: state.period, status: state.status, q: state.q, sdr: state.sdr, view: analyticsOnly ? "analytics" : appendHistory ? "history" : undefined, historyOffset: appendHistory ? state.data?.history?.nextOffset : 0 });
      if (version !== loadVersion) return;
      const selectionReset = data.scope === 'admin' && data.selectedSdr !== state.sdr;
      state.sdr = data.scope === 'admin' ? (data.selectedSdr || 'all') : 'all';
      if (data.scope === 'admin') { try { localStorage.setItem('spacePhoneSdr', state.sdr); } catch {} }
      if (selectionReset && (analyticsOnly || appendHistory)) return load({ silent });
      state.data = analyticsOnly ? { ...state.data, ...data, calls: state.data?.calls || [], history: state.data?.history } : appendHistory ? { ...state.data, ...data, callbacks: state.data?.callbacks || [], calls: [...new Map([...(state.data?.calls || []), ...(data.calls || [])].map(call => [call.id, call])).values()] } : data; void refreshConversion(); if (data.callbacks) { callbackItems = data.callbacks; tickCallbacks(); } state.error = '';
    } catch (error) { if (version === loadVersion) state.error = error.message || 'Não foi possível carregar ligações.'; }
    finally { if (version === loadVersion) { state.loading = false; if (patchOnly) patchHistory(); else render(); } }
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
    if (!state.normalized) normalize();
    const number = state.normalized || state.dial.trim();
    if (!/^\+[1-9]\d{7,14}$/.test(number)) { state.dialError = "Telefone inválido"; render(); return; }
    const a = adapter();
    if (!a || typeof (a.call || a.dial || a.startCall) !== "function") { state.call = { ...state.call, status: "failed", number, error: "Adapter Telnyx não disponível nesta sessão." }; render(); return; }
    state.call = { ...state.call, status: "connecting", number, muted: false, held: false, error: "" };
    state.postCall = { id: "", polls: 0, status: "idle", call: null, savedOutcome: "", saveStatus: "", skipped: false };
    state.qualification = normalizeQualification({});
    render();
    if (state.devices.permission !== "granted") await requestMic();
    if (state.devices.permission === "denied" || state.devices.permission === "missing") { state.call = { ...state.call, status: "ready" }; render(); return; }
    try { await a.call({ phoneNumber: number, source: "sdr_phone", micId: state.devices.micId, speakerId: state.devices.speakerId }); addRecent(number); syncFromCore(a.getState?.()); }
    catch (error) { state.call = { ...state.call, status: "failed", error: error?.message || "Falha ao iniciar ligação" }; }
    render();
  };
  const bookings = { get: id => { const b=window.SpaceAgenda?.get(id); return b ? {message:window.SpaceAgenda.message(b)} : null; } };
  const openBooking = async () => {
    window.SpaceAgenda?.forCall(currentCallId());
    state.detail = null;
    if (state.qualificationBeforeDetail) state.qualification = state.qualificationBeforeDetail;
    render();
    document.querySelector('button[data-panel-target="space-agenda"]')?.click();
  };
  window.addEventListener('space-bookings:updated', event => {
    if(event.detail?.callId===currentCallId()) render();
  });
  const callMethod = async (name, ...args) => {
    const a = adapter();
    if (typeof a?.[name] !== "function") { state.call.error = `Controle ${name} indisponível.`; render(); return false; }
    try { await a[name](...args); state.call.error = ""; syncFromCore(a.getState?.()); return true; }
    catch (error) { state.call.error = error?.message || `Falha ao executar ${name}.`; render(); return false; }
  };
  const pollPostCall = async (id) => {
    if (!id || state.postCall.id === id && state.postCall.status === "ready") return;
    state.postCall = { ...state.postCall, id, polls: 0, status: "processing", call: state.postCall.call?.id === id ? state.postCall.call : null };
    const delays = [5000, 10000, 20000, ...Array(40).fill(15000)];
    const run = async () => {
      if (state.postCall.id !== id || state.postCall.status === "ready" || state.postCall.polls >= delays.length) return;
      state.postCall.polls += 1;
      try {
        const detail = await api({ id });
        if (state.postCall.id !== id || detail.call?.id !== id) return;
        if (detail.call?.qualification && (!state.detail || state.detail.call?.id === id)) mergeQualification(detail.call.qualification);
        if (detail.call) state.postCall.call = detail.call;
        if (state.detail?.call?.id === id && detail.call) state.detail = detail;
        if (["review_required", "complete", "sent"].includes(detail.call?.qualification?.status)) { state.postCall = { ...state.postCall, status: "ready", call: detail.call }; render(); await load({ silent: true }); return; }
      } catch {}
      render();
      if (state.postCall.polls < delays.length) delay(run, delays[state.postCall.polls]);
    };
    void run();
  };
  const syncFromCore = (snap = {}) => {
    const previous = state.call.status;
    const context = snap.context || {};
    const record = snap.callRecord || {};
    if (snap.status === "idle" && POST.has(state.call.status)) return;
    if (snap.status === "idle" && ACTIVE.has(state.call.status) && !record.id && !context.phoneNumber) {
      state.call = { ...state.call, muted: Boolean(snap.muted), held: Boolean(snap.held), error: snap.error || "" };
      return;
    }
    state.call = { ...state.call, status: snap.status === "idle" ? "ready" : snap.held ? "hold" : (snap.status || state.call.status || "ready"), number: context.phoneNumber || record.to_number || state.call.number || "", name: context.leadName || record.lead_name || state.call.name || "", muted: Boolean(snap.muted), held: Boolean(snap.held), id: record.id || state.call.id || "", callerId: record.from_number || state.call.callerId || "", origin: context.source || state.call.origin || "Discador", error: snap.error || "" };
    if (!POST.has(previous) && POST.has(state.call.status) && state.call.id) { state.postCall = { ...state.postCall, id: state.call.id, status: "processing" }; pollPostCall(state.call.id); void load({ silent: true, patchOnly: true }); }
  };
  const saveCallPatch = async (id, patch) => {
    if (!id) return;
    const isOutcome = Object.prototype.hasOwnProperty.call(patch, "outcome");
    if (isOutcome) { state.postCall.savedOutcome = patch.outcome || ""; state.postCall.saveStatus = patch.outcome ? "Salvando..." : "Pendente"; render(); }
    try {
      const response = await api({}, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, ...patch }) });
      if (response.call?.qualification) mergeQualification(response.call.qualification);
      if (response.qualification) mergeQualification(response.qualification);
      if (state.postCall.id === id) state.postCall.call = response.call || state.postCall.call;
      if (isOutcome) { state.postCall.saveStatus = patch.outcome ? "Salvo ✓" : "Pendente"; state.postCall.skipped = !patch.outcome; try { window.dispatchEvent(new CustomEvent("space-phone:call-updated", { detail: { id, outcome: patch.outcome || null } })); } catch {} }
      await load({ silent: true });
    } catch (error) { state.error = error.message || "Não foi possível salvar."; if (isOutcome) state.postCall.saveStatus = "Erro ao salvar"; render(); }
  };


  const saveQualificationPatch = (field, value) => {
    const id = currentCallId();
    qualificationSaveQueue = qualificationSaveQueue.catch(() => {}).then(() => persistQualificationPatch(id, field, value));
    return qualificationSaveQueue;
  };
  const persistQualificationPatch = async (id, field, value) => {
    if (!id) return;
    state.qualification.voiceCallId = id;
    state.qualification.values[field] = value;
    setQualificationStatus('Salvando...', 'warn');
    try {
      const response = await api({}, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action: 'save_qualification', qualification: { [field]: value } }) });
      if (currentCallId() === id) {
        mergeQualification(response.qualification || response.call?.qualification);
        setQualificationStatus('Salvo ✓', 'ok');
      }
    } catch (error) {
      state.qualification.error = error.message || 'qualification_save_failed';
      setQualificationStatus('Erro ao salvar', 'bad');
      throw new Error('qualification_save_failed');
    }
  };
  const completeQualification = async () => {
    const id = currentCallId();
    if (!id) return;
    const buttons = [...document.querySelectorAll('[data-sp-complete-qualification]')];
    if (buttons.some(button => button.dataset.saving === 'true')) return;
    buttons.forEach(button => { button.dataset.saving = 'true'; button.disabled = true; button.textContent = 'Concluindo...'; });
    setQualificationStatus('Concluindo...', 'warn');
    try {
      const summary = document.querySelector('[data-sp-final-summary]')?.value || state.qualification.finalSummary || '';
      for (const timer of state.qualificationTimers.values()) clearTimeout(timer);
      state.qualificationTimers.clear();
      const values = { ...state.qualification.values };
      for (const [field, value] of Object.entries(values)) await saveQualificationPatch(field, value);
      if (summary) await saveQualificationPatch('finalSummary', summary);
      const response = await api({}, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action: 'complete_qualification' }) });
      mergeQualification(response.qualification || response.call?.qualification);
      setQualificationStatus('Qualificação concluída ✓', 'ok');
      try { window.dispatchEvent(new CustomEvent('space-phone:call-updated', { detail: { id, qualificationStatus: state.qualification.status, datacrazyStatus: state.qualification.datacrazy?.syncStatus || 'blocked' } })); } catch {}
      buttons.forEach(button => { button.textContent = 'Qualificação concluída ✓'; button.disabled = true; });
      document.querySelectorAll('[data-sp-handoff]').forEach(el => { el.textContent = state.qualification.datacrazy?.syncStatus === 'sent' ? '' : 'Handoff Datacrazy pendente'; });
      if (state.detail?.call?.id === id) state.detail.call.qualification = response.qualification || response.call?.qualification;
      await load({ silent: true, patchOnly: true });
    } catch (error) {
      state.qualification.error = error.message || 'Não foi possível concluir.';
      setQualificationStatus(error.message === 'qualification_incomplete' ? 'Campos obrigatórios pendentes' : 'Erro ao concluir', 'bad');
      buttons.forEach(button => { button.disabled = !qualificationComplete(); button.textContent = 'Concluir qualificação'; });
    } finally {
      buttons.forEach(button => { delete button.dataset.saving; });
    }
  };

  let detailRequest = 0;
  document.addEventListener("click", async (event) => {
    const filterToggle=event.target.closest?.('[data-sp-filter-toggle]');
    if(filterToggle){filtersOpen=!filtersOpen;render();if(filtersOpen)document.querySelector('[data-sp-period]')?.focus({preventScroll:true});return;}
    if(filtersOpen && !event.target.closest?.('.sphone-filter-wrap')){filtersOpen=false;render();}
    if (root() && state.popover && !event.target.closest?.(".sphone-control-wrap")) {
      state.popover = "";
      render();
    }
    const t = event.target.closest("[data-sp-booking],[data-sp-key],[data-sp-backspace],[data-sp-call],[data-sp-fill],[data-sp-refresh],[data-sp-period],[data-sp-detail],[data-sp-close-detail],[data-sp-mute],[data-sp-hold],[data-sp-hangup],[data-sp-popover],[data-sp-dtmf-toggle],[data-sp-dtmf],[data-sp-outcome],[data-sp-skip-outcome],[data-sp-reset-call],[data-sp-tab],[data-sp-test-device],[data-sp-apply-ai],[data-sp-complete-qualification],[data-sp-retry-ai],[data-sp-clear-filters],[data-sp-load-more]");
    if (!t || !root()) return;
    if (t.matches("[data-sp-key]")) { state.dial += t.dataset.spKey; normalize(); return; }
    if (t.matches("[data-sp-backspace]")) { state.dial = state.dial.slice(0, -1); normalize(); return; }
    if (t.matches("[data-sp-call]")) { await startCall(); return; }
    if (t.matches("[data-sp-fill]")) { state.dial = t.dataset.spFill || ""; normalize(); render(); return; }
    if (t.matches("[data-sp-load-more]")) { if (!state.loading) await load({ appendHistory: true }); return; }
    if (t.matches("[data-sp-clear-filters]")) { setPeriod("last7"); state.status = ""; state.q = ""; state.sdr = "all"; clearTimeout(state.searchTimer); await load(); return; }
    if (t.matches("[data-sp-refresh]")) { await load(); return; }
    if (t.matches("[data-sp-period]") && t.tagName !== "SELECT") { setPeriod(t.dataset.spPeriod); await load(); return; }
    if (t.matches("[data-sp-detail]")) { const version = ++detailRequest; const result = await api({ id: t.dataset.spDetail }); if (version !== detailRequest || result.call?.id !== t.dataset.spDetail) return; state.qualificationBeforeDetail = state.qualification; state.detail = result; window.SpaceAgenda?.refresh(result.call.id).catch(()=>{}); state.detailTab = "summary"; state.qualification = normalizeQualification(state.detail.call?.qualification || { voiceCallId: t.dataset.spDetail }); render(); return; }
    if (t.matches("[data-sp-close-detail]")) { detailRequest++; state.detail = null; if (state.qualificationBeforeDetail) state.qualification = state.qualificationBeforeDetail; render(); return; }
    if (t.matches("[data-sp-mute]")) { await callMethod(state.call.muted ? "unmute" : "mute"); render(); return; }
    if (t.matches("[data-sp-hold]")) { await callMethod(state.call.held ? "unhold" : "hold"); render(); return; }
    if (t.matches("[data-sp-hangup]")) { state.call.status = "ending"; render(); const ended = await callMethod("hangup"); state.call.status = ended ? "ended" : state.call.status; if (ended && state.call.id) pollPostCall(state.call.id); render(); await load({ silent: true }); return; }
    if (t.matches("[data-sp-popover]")) { state.popover = state.popover === t.dataset.spPopover ? "" : t.dataset.spPopover; render(); return; }
    if (t.matches("[data-sp-dtmf]")) { await callMethod("dtmf", t.dataset.spDtmf || ""); return; }
    if (t.matches("[data-sp-apply-ai]")) {
      const id = currentCallId();
      if (state.aiApply.pending) return;
      const ai = state.qualification.ai || {};
      const fieldValue = key => document.querySelector(`[data-sp-qual="${key}"]`)?.value ?? state.qualification.values[key] ?? '';
      const suggestions = QUAL_FIELDS.filter(([key]) => !String(fieldValue(key)).trim() && hasSuggestion(ai[key])).map(([key]) => [key, ai[key].trim()]);
      const feedback = message => {
        state.aiApply = { ...state.aiApply, callId: id, message };
        if (currentCallId() === id) document.querySelectorAll('[data-sp-ai-feedback]').forEach(el => { el.textContent = message; });
      };
      if (!suggestions.length) {
        feedback(QUAL_FIELDS.every(([key]) => String(fieldValue(key)).trim()) ? 'Todos os campos já estão preenchidos' : 'Nenhuma sugestão disponível para os campos vazios');
        return;
      }
      state.aiApply = { callId: id, pending: true, message: '' };
      t.disabled = true;
      feedback('Aplicando sugestões...');
      for (const [key, value] of suggestions) {
        state.qualification.values[key] = value;
        const el = document.querySelector(`[data-sp-qual="${key}"]`); if (el) el.value = value;
      }
      try {
        let applied = 0;
        for (const [key, value] of suggestions) {
          if (currentCallId() !== id) break;
          if (fieldValue(key) !== value) continue;
          await saveQualificationPatch(key, value);
          applied++;
        }
        feedback(`${applied} sugestões aplicadas ✓`);
      } catch { feedback('Sugestões preenchidas, mas não foi possível salvar. Tente novamente salvar os campos.'); }
      finally {
        state.aiApply.pending = false;
        t.disabled = false;
        if (currentCallId() === id) document.querySelectorAll('[data-sp-complete-qualification]').forEach(button => { button.disabled = !qualificationComplete(); });
      }
      return;
    }
    if (t.matches("[data-sp-booking]")) { await openBooking(); return; }
    if (t.matches("[data-sp-retry-ai]")) {
      const id = currentCallId(); if (!id || t.disabled) return;
      t.disabled = true; t.textContent = 'Buscando sugestões...';
      try {
        const result = await api({}, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action: 'retry_ai_qualification' }) });
        if (result.aiStatus === 'failed') throw Error('ai_failed');
        t.textContent = ({waiting_recording:'Aguardando gravação',transcribing:'Transcrevendo ligação'})[result.aiStatus] || 'Gerando sugestões IA';
        await pollPostCall(id);
      } catch { t.textContent = 'Não foi possível gerar agora. Tentar novamente'; }
      finally { t.disabled = false; }
      return;
    }
    if (t.matches("[data-sp-complete-qualification]")) { await completeQualification(); return; }
    if (t.matches("[data-sp-outcome]")) { await saveCallPatch(state.detail?.call?.id || state.postCall.id || state.call.id, { outcome: t.dataset.spOutcome }); return; }
    if (t.matches("[data-sp-skip-outcome]")) { await saveCallPatch(state.detail?.call?.id || state.postCall.id || state.call.id, { outcome: "" }); return; }
    if (t.matches("[data-sp-reset-call]")) { state.call = { ...state.call, status: "ready", number: "", name: "", id: "", error: "" }; state.postCall = { id: "", polls: 0, status: "idle", call: null, savedOutcome: "", saveStatus: "", skipped: false }; render(); return; }
    if (t.matches("[data-sp-tab]")) { state.detailTab = t.dataset.spTab || "summary"; render(); return; }
    if (t.matches("[data-sp-test-device]")) { await requestMic(); render(); return; }
  });
  document.addEventListener("input", (event) => {
    const t = event.target;
    if (!root() || !(t instanceof HTMLElement)) return;
    if (t.matches("[data-sp-dial]")) { state.dial = t.value; normalize(); }
    if (t.matches("[data-sp-search]")) { state.q = t.value; clearTimeout(state.searchTimer); state.searchTimer = setTimeout(() => load({ silent: true }), 350); }
    if (t.matches("[data-sp-qual]")) { const field = t.dataset.spQual; state.qualification.values[field] = t.value; const completeButton = document.querySelector('[data-sp-complete-qualification]'); if (completeButton) completeButton.disabled = !qualificationComplete(); clearTimeout(state.qualificationTimers.get(field)); state.qualificationTimers.set(field, setTimeout(() => { saveQualificationPatch(field, t.value).catch(() => {}).finally(() => state.qualificationTimers.delete(field)); }, 650)); return; }
    if (t.matches("[data-sp-final-summary]")) { state.qualification.finalSummary = t.value; clearTimeout(state.qualificationTimers.get('finalSummary')); state.qualificationTimers.set('finalSummary', setTimeout(() => { saveQualificationPatch('finalSummary', t.value).catch(() => {}).finally(() => state.qualificationTimers.delete('finalSummary')); }, 650)); return; }
    if (t.matches("[data-sp-notes],[data-sp-detail-notes]")) { const id = t.dataset.callId || state.detail?.call?.id || state.postCall.id || state.call.id; clearTimeout(state.noteTimers.get(t)); state.noteTimers.set(t, setTimeout(() => saveCallPatch(id, { notes: t.value }), 700)); }
  });
  document.addEventListener('click', async event => {
    const dismiss=event.target.closest('[data-callback-dismiss]');
    if(dismiss){dismissedCallbacks.set(dismiss.dataset.callbackDismiss,Date.now()+15*60000);try{sessionStorage.setItem('spaceCallbackDismissed',JSON.stringify([...dismissedCallbacks]));}catch{} tickCallbacks();return;}
    if (!event.target.closest('.sphone-callback-menu')) document.querySelectorAll('.sphone-callback-menu[open]').forEach(n=>n.open=false);
    const button = event.target.closest('[data-callback-action],[data-callback-schedule]');
    if (!button) return;
    const id = button.dataset.callbackId || currentCallId();
    if (!id || callbackBusy.has(id)) return;
    callbackBusy.add(id); button.disabled=true;
    try {
      const action = button.dataset.callbackAction;
      if (action === 'call') {
        if (ACTIVE.has(adapter()?.getState?.()?.status)) throw new Error('Conclua a ligação ativa antes de retornar.');
        const c = [...callbackItems,...notificationItems].find(c=>c.id===id);
        if (!c) throw new Error('Atualize a fila de retornos.');
        if (typeof adapter()?.call !== 'function') throw new Error('Space Phone ainda não está disponível.');
        await adapter().call({phoneNumber:c.number,leadName:c.name,leadId:c.leadId,opportunityId:c.opportunityId,callbackSourceCallId:c.id,source:'callback'});
      } else {
        const value = button.dataset.callbackSchedule || action;
        const date = value === 'custom' ? new Date(button.dataset.callbackSchedule ? document.querySelector('[data-sp-callback]')?.value : button.closest("details")?.querySelector(`[data-callback-date="${id}"]`)?.value) : new Date(Date.now() + Number(value) * 60000);
        if (value === 'tomorrow') { date.setTime(Date.now()); date.setDate(date.getDate()+1); }
        const terminal = ['complete','cancel'].includes(action);
        if (!terminal && (!Number.isFinite(date.getTime()) || date.getTime() <= Date.now())) throw new Error('Escolha uma data e horário futuros.');
        await api({}, {method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,action:terminal ? `callback_${action}` : button.dataset.callbackSchedule ? 'callback_schedule' : 'callback_snooze',...(!terminal ? {callbackAt:date.toISOString()} : {})})});
        const feedback=document.querySelector('[data-callback-feedback]'); if(feedback) feedback.textContent='Retorno salvo ✓';
      }
      callbackError=''; await refreshCallbacks();
    } catch { callbackError='Não foi possível concluir a ação. Verifique o horário ou a ligação ativa e tente novamente.'; patchCallbacks(); const feedback=document.querySelector('[data-callback-feedback]');if(feedback)feedback.textContent=callbackError; }
    finally { callbackBusy.delete(id); if(button.isConnected)button.disabled=false; tickCallbacks(); }
  });
  every(tickCallbacks,1000);
  every(refreshCallbacks,30000);
  window.addEventListener('online',refreshCallbacks);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshCallbacks();});
  delay(refreshCallbacks,1500);
  document.addEventListener("change", async (event) => {
    const t = event.target;
    if (!root() || !(t instanceof HTMLElement)) return;
    if (t.matches("[data-sp-sdr]") && state.data?.scope === 'admin') { state.sdr = t.value; conversionData=null; await load(); }
    if (t.matches("[data-sp-status]")) { state.status = t.value; await load(); }
    if (t.matches("[data-sp-period]")) { setPeriod(t.value); conversionData=null; await load(); }
    if (t.matches("[data-sp-mic]")) { state.devices.micId = t.value; saveLocal(); await adapter()?.setAudioInputDevice?.(t.value); }
    if (t.matches("[data-sp-speaker]")) { state.devices.speakerId = t.value; saveLocal(); await adapter()?.setAudioOutputDevice?.(t.value); }
  });
  document.addEventListener("keydown", async (event) => {
    if (event.key === "Escape") document.querySelectorAll(".sphone-callback-menu[open]").forEach(n=>n.open=false);
    if (!root() || !document.body.dataset.activePanel?.includes("space-phone")) return;
    const tag = String(event.target?.tagName || "").toLowerCase();
    if (event.key === "Enter" && tag === "input" && event.target.matches("[data-sp-dial]")) { event.preventDefault(); await startCall(); }
    if (event.key === "Escape") { state.popover = ""; filtersOpen=false; document.querySelectorAll(".sphone-callback-menu[open]").forEach(n=>n.open=false); render(); document.querySelector("[data-sp-filter-toggle]")?.focus({preventScroll:true}); }
    if (tag === "input" || tag === "textarea" || event.metaKey || event.ctrlKey) return;
    if (event.key.toLowerCase() === "m") document.querySelector("[data-sp-mute]")?.click();
    if (event.key.toLowerCase() === "h") document.querySelector("[data-sp-hold]")?.click();
  });
  const patchLiveDom = () => {
    try {
      if (!domAlive()) return;
      const seconds = callSeconds();
      const text = fmtSec(seconds);
      const timer = document.querySelector("[data-sp-timer]");
      if (timer && ["active", "hold", "ending"].includes(state.call.status) && timer.textContent !== text) timer.textContent = text;
      const talk = document.querySelector("[data-sp-talk-time]");
      if (talk) talk.textContent = fmtSec(liveTalkTimeSeconds());
      const online = document.querySelector(".sphone-online");
      if (online && ACTIVE.has(state.call.status)) {
        const ps = phoneStatus();
        const html = `<span class="sphone-dot" data-tone="${ps.tone}"></span>${esc(ps.label)}`;
        if (online.innerHTML !== html) online.innerHTML = html;
      }
    } catch {}
  };
  every(patchLiveDom, 250);
  navigator.mediaDevices?.addEventListener?.("devicechange", () => { if(operatorMode())loadDevices().then(render); });

  let unsub = null;
  const snapshotKey = (snap = {}) => JSON.stringify({ status: snap.status, muted: Boolean(snap.muted), held: Boolean(snap.held), error: snap.error || "", id: snap.callRecord?.id || "", to: snap.callRecord?.to_number || snap.context?.phoneNumber || "", from: snap.callRecord?.from_number || "", name: snap.context?.leadName || snap.callRecord?.lead_name || "", ready: Boolean(snap.clientReady) });
  let lastCoreKey = "";
  const subscribeCore = () => {
    if (unsub || typeof adapter()?.subscribe !== "function") return;
    unsub = adapter().subscribe((snap) => {
      const nextKey = snapshotKey(snap);
      syncFromCore(snap);
      if (nextKey === lastCoreKey) patchLiveDom();
      else { lastCoreKey = nextKey; render(); void refreshConversion(); }
    });
  };
  window.SpacePhoneModule = { open: async () => { window.SpaceAgenda?.refresh(currentCallId()).catch(()=>{}); state.period = readPeriod(); render(); await load({ silent: true }); if(operatorMode()){ subscribeCore(); await loadDevices(); syncFromCore(adapter()?.getState?.()); render(); } }, state };
  if (document.body?.dataset.initialPanel === "space-phone") window.SpacePhoneModule.open();
}());
