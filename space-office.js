(function () {
  const session = window.__SPACE_SESSION__ || {};
  if (String(session.role || "").toLowerCase() !== "admin") return;

  const root = document.querySelector("[data-space-office-root]");
  if (!(root instanceof HTMLElement)) return;

  const escapeHtml = (value) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const formatTime = (value) => {
    const date = value ? new Date(value) : null;
    if (!date || Number.isNaN(date.getTime())) return "agora";
    return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(date);
  };

  const statusLabel = (status) => {
    const normalized = String(status || "").toLowerCase();
    if (["pendente", "enviado", "processando"].includes(normalized)) return "Executando";
    if (normalized === "sucesso") return "Concluído";
    if (normalized === "erro") return "Atenção";
    return "Disponível";
  };

  const css = `
    .space-office{min-height:100vh;background:#f5f7fb;color:#182033;padding:28px 32px 44px;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
    .space-office *{box-sizing:border-box}
    .space-office-head{display:flex;align-items:flex-start;justify-content:space-between;gap:24px;max-width:1480px;margin:0 auto 22px}
    .space-office-kicker{display:flex;align-items:center;gap:9px;margin:0 0 8px;color:#6f7a91;font-size:12px;font-weight:900;letter-spacing:.16em;text-transform:uppercase}
    .space-office-live{width:8px;height:8px;border-radius:50%;background:#58d49b;box-shadow:0 0 0 5px rgba(88,212,155,.13);animation:soPulse 2s infinite}
    .space-office h1{margin:0;color:#172033;font-size:30px;line-height:1.1;letter-spacing:-.04em}
    .space-office-sub{margin:8px 0 0;color:#7d879b;font-size:14px}
    .space-office-actions{display:flex;align-items:center;gap:10px}
    .space-office-sync{display:flex;align-items:center;gap:8px;border:1px solid #e4e8f0;border-radius:999px;background:#fff;padding:9px 13px;color:#627086;font-size:12px;font-weight:800;box-shadow:0 8px 24px rgba(31,42,68,.05)}
    .space-office-sync i{width:7px;height:7px;border-radius:50%;background:#58d49b}
    .space-office-button{border:0;border-radius:12px;background:#172033;color:#fff;padding:11px 15px;font-weight:850;cursor:pointer;box-shadow:0 10px 22px rgba(23,32,51,.16);transition:transform .2s,box-shadow .2s}
    .space-office-button:hover{transform:translateY(-2px);box-shadow:0 14px 26px rgba(23,32,51,.2)}
    .space-office-button:disabled{opacity:.55;cursor:wait;transform:none}
    .space-office-layout{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:20px;max-width:1480px;margin:0 auto}
    .space-office-world{position:relative;min-height:720px;overflow:hidden;border:1px solid #e6eaf1;border-radius:28px;background:radial-gradient(circle at 50% 18%,#fff 0,#fafbfe 44%,#edf1f7 100%);box-shadow:0 24px 70px rgba(31,42,68,.09)}
    .space-office-world:before{content:"";position:absolute;inset:0;background-image:linear-gradient(rgba(123,137,166,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(123,137,166,.035) 1px,transparent 1px);background-size:28px 28px;mask-image:linear-gradient(to bottom,black,transparent 80%)}
    .space-office-stats{position:absolute;z-index:12;top:18px;left:18px;right:18px;display:grid;grid-template-columns:repeat(4,minmax(110px,1fr));gap:10px}
    .space-office-stat{border:1px solid rgba(226,231,240,.9);border-radius:16px;background:rgba(255,255,255,.88);padding:12px 14px;backdrop-filter:blur(12px);box-shadow:0 10px 28px rgba(31,42,68,.06)}
    .space-office-stat span{display:block;color:#8a94a7;font-size:10px;font-weight:900;letter-spacing:.1em;text-transform:uppercase}
    .space-office-stat strong{display:block;margin-top:4px;color:#202a40;font-size:22px;line-height:1}
    .space-office-stat.is-alert strong{color:#ff6a5f}
    .space-office-scene{position:absolute;left:50%;top:54%;width:810px;height:540px;transform:translate(-50%,-50%)}
    .space-office-floor{position:absolute;left:106px;top:82px;width:600px;height:390px;transform:rotate(30deg) skewX(-30deg) scaleY(.86);border-radius:8px;background:linear-gradient(135deg,#eef2f5 0 49.5%,#e8edf1 49.5% 50.5%,#f6f8fa 50.5%);box-shadow:25px 34px 45px rgba(50,63,88,.18)}
    .space-office-floor:after{content:"";position:absolute;inset:0;border-radius:8px;background-image:linear-gradient(90deg,rgba(140,151,170,.09) 1px,transparent 1px),linear-gradient(rgba(140,151,170,.09) 1px,transparent 1px);background-size:70px 70px}
    .space-office-wall-left,.space-office-wall-right{position:absolute;z-index:1;filter:drop-shadow(0 12px 16px rgba(42,54,78,.08))}
    .space-office-wall-left{left:98px;top:26px;width:319px;height:240px;clip-path:polygon(0 24%,100% 0,100% 75%,0 100%);background:linear-gradient(145deg,#fff,#f0f3f7)}
    .space-office-wall-right{right:96px;top:25px;width:319px;height:240px;clip-path:polygon(0 0,100% 24%,100% 100%,0 75%);background:linear-gradient(210deg,#fff,#edf1f6)}
    .space-office-window{position:absolute;z-index:2;left:245px;top:62px;width:156px;height:96px;transform:skewY(-8deg);border:8px solid #fff;border-radius:6px;background:linear-gradient(155deg,#dff2ff,#b7d9f3 55%,#f5fbff);box-shadow:0 9px 18px rgba(70,103,137,.12)}
    .space-office-window:before,.space-office-window:after{content:"";position:absolute;background:rgba(255,255,255,.85)}
    .space-office-window:before{left:50%;top:0;bottom:0;width:4px}.space-office-window:after{left:0;right:0;top:50%;height:4px}
    .space-office-sign{position:absolute;z-index:3;right:235px;top:69px;color:#56627a;font-size:18px;font-weight:950;letter-spacing:-.04em;transform:skewY(8deg)}
    .space-office-sign b{color:#ff6a5f}
    .space-office-rug{position:absolute;z-index:3;left:305px;top:294px;width:225px;height:126px;transform:rotate(29deg) skewX(-30deg) scaleY(.83);border-radius:50%;background:radial-gradient(ellipse,#ffe0dc 0 16%,#ff8a7d 17% 19%,#f5f7fb 20% 31%,#b8d8f5 32% 35%,#f7f8fb 36%);opacity:.82}
    .space-office-desk{position:absolute;z-index:5;width:142px;height:83px}
    .space-office-desk.one{left:176px;top:212px}.space-office-desk.two{right:166px;top:210px}.space-office-desk.three{left:260px;bottom:60px}.space-office-desk.four{right:252px;bottom:57px}
    .space-office-desk-top{position:absolute;left:7px;top:7px;width:124px;height:62px;transform:rotate(30deg) skewX(-30deg) scaleY(.82);border-radius:6px;background:linear-gradient(145deg,#fff,#e7ebf1);box-shadow:11px 14px 15px rgba(40,52,75,.18)}
    .space-office-desk-top:before{content:"";position:absolute;inset:8px 31px 24px 27px;border-radius:3px;background:#263248;box-shadow:0 0 0 3px #d9dfe8}
    .space-office-desk-top:after{content:"";position:absolute;left:84px;top:35px;width:18px;height:13px;border-radius:50%;background:#ff8a7d}
    .space-office-plant{position:absolute;z-index:5;right:120px;top:150px;width:58px;height:90px}
    .space-office-pot{position:absolute;bottom:0;left:14px;width:35px;height:38px;clip-path:polygon(10% 0,90% 0,75% 100%,25% 100%);background:linear-gradient(90deg,#f2b267,#cf8240)}
    .space-office-leaf{position:absolute;width:20px;height:45px;border-radius:100% 0 100% 0;background:#67b98c;transform-origin:bottom}
    .space-office-leaf.a{left:19px;top:10px;transform:rotate(-28deg)}.space-office-leaf.b{left:31px;top:2px;transform:rotate(15deg)}.space-office-leaf.c{left:8px;top:16px;transform:rotate(-56deg)}
    .space-office-sofa{position:absolute;z-index:5;right:122px;bottom:86px;width:128px;height:72px}
    .space-office-sofa-back{position:absolute;left:12px;top:0;width:103px;height:43px;border-radius:18px 18px 8px 8px;background:#bcdcf4;box-shadow:8px 10px 16px rgba(44,66,90,.14)}
    .space-office-sofa-seat{position:absolute;left:5px;top:31px;width:118px;height:34px;transform:skewY(12deg);border-radius:8px;background:#d7eafa}
    .space-office-agent{position:absolute;z-index:9;width:86px;border:0;background:transparent;padding:0;cursor:pointer;text-align:center;color:#273249;transition:filter .2s,transform .2s;animation:soFloat 3.2s ease-in-out infinite}
    .space-office-agent:hover{filter:drop-shadow(0 12px 10px rgba(32,47,73,.18));transform:translateY(-4px)}
    .space-office-agent.maia{left:224px;top:235px}.space-office-agent.nilo{right:217px;top:235px;animation-delay:-.7s}.space-office-agent.luna{left:312px;bottom:76px;animation-delay:-1.4s}.space-office-agent.theo{right:305px;bottom:73px;animation-delay:-2.1s}
    .space-office-bubble{position:absolute;left:50%;bottom:91px;min-width:128px;max-width:180px;transform:translateX(-50%);border:1px solid #e6eaf0;border-radius:13px 13px 13px 4px;background:#fff;padding:8px 10px;color:#667087;font-size:10px;font-weight:750;line-height:1.25;box-shadow:0 10px 22px rgba(31,42,68,.12);opacity:0;pointer-events:none;transition:opacity .2s,transform .2s}
    .space-office-agent.is-busy .space-office-bubble,.space-office-agent:hover .space-office-bubble{opacity:1;transform:translate(-50%,-5px)}
    .space-office-avatar{position:relative;width:52px;height:70px;margin:0 auto;filter:drop-shadow(5px 8px 6px rgba(46,58,80,.18))}
    .space-office-avatar:after{content:"";position:absolute;left:8px;bottom:-5px;width:40px;height:12px;border-radius:50%;background:rgba(55,66,88,.14);z-index:-1}
    .space-office-head-shape{position:absolute;z-index:3;left:14px;top:0;width:28px;height:30px;border-radius:48% 48% 43% 43%;background:#e8b88e}
    .space-office-hair{position:absolute;z-index:4;left:12px;top:-2px;width:32px;height:16px;border-radius:18px 18px 8px 8px;background:#273249}
    .space-office-body-shape{position:absolute;z-index:2;left:10px;top:26px;width:37px;height:35px;clip-path:polygon(15% 0,85% 0,100% 100%,0 100%);border-radius:8px;background:var(--agent-color,#ff7a70)}
    .space-office-leg{position:absolute;z-index:1;top:56px;width:10px;height:15px;border-radius:2px;background:#344159}.space-office-leg.left{left:16px}.space-office-leg.right{left:31px}
    .space-office-status-dot{position:absolute;right:5px;top:2px;width:12px;height:12px;border:3px solid #fff;border-radius:50%;background:#58d49b;box-shadow:0 2px 7px rgba(37,50,74,.18)}
    .space-office-agent.is-busy .space-office-status-dot{background:#ffbc5c;animation:soPulse 1.3s infinite}.space-office-agent.is-error .space-office-status-dot{background:#ff6a5f}
    .space-office-agent-name{display:block;margin-top:4px;font-size:11px;font-weight:950}.space-office-agent-role{display:block;margin-top:1px;color:#8892a5;font-size:9px;font-weight:800}
    .space-office-side{display:flex;flex-direction:column;min-height:720px;border:1px solid #e6eaf1;border-radius:28px;background:#fff;box-shadow:0 24px 70px rgba(31,42,68,.07);overflow:hidden}
    .space-office-side-head{padding:21px 22px 16px;border-bottom:1px solid #eef1f5}
    .space-office-side-head-row{display:flex;align-items:center;justify-content:space-between;gap:12px}
    .space-office-side h2{margin:0;color:#222c40;font-size:16px;letter-spacing:-.02em}.space-office-side-head p{margin:5px 0 0;color:#919aad;font-size:12px}
    .space-office-count{display:inline-flex;align-items:center;justify-content:center;min-width:28px;height:28px;border-radius:9px;background:#f0f3f8;color:#677289;font-size:11px;font-weight:900}
    .space-office-feed{flex:1;overflow:auto;padding:8px 15px 18px}
    .space-office-event{display:grid;grid-template-columns:34px 1fr;gap:11px;padding:13px 7px;border-bottom:1px solid #f0f2f6}
    .space-office-event:last-child{border-bottom:0}
    .space-office-event-icon{display:flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:11px;background:#edf5ff;color:#4a86c5;font-size:13px;font-weight:950}
    .space-office-event.is-success .space-office-event-icon{background:#eafaf2;color:#40a875}.space-office-event.is-error .space-office-event-icon{background:#fff0ee;color:#e15d53}.space-office-event.is-running .space-office-event-icon{background:#fff6e8;color:#d79130}
    .space-office-event strong{display:block;color:#354057;font-size:12px;line-height:1.35}.space-office-event p{margin:4px 0 0;color:#8a94a8;font-size:11px;line-height:1.4}.space-office-event time{display:block;margin-top:6px;color:#b0b7c5;font-size:10px;font-weight:800}
    .space-office-empty{padding:44px 18px;text-align:center;color:#919aad;font-size:12px}.space-office-empty span{display:block;margin:0 auto 12px;width:42px;height:42px;border-radius:14px;background:#f1f4f8}
    .space-office-drawer{position:absolute;z-index:30;top:0;right:0;width:min(390px,92%);height:100%;padding:25px;background:rgba(255,255,255,.96);backdrop-filter:blur(18px);box-shadow:-22px 0 55px rgba(28,39,62,.16);transform:translateX(105%);transition:transform .28s ease}
    .space-office-drawer.is-open{transform:translateX(0)}
    .space-office-drawer-close{position:absolute;right:18px;top:18px;width:34px;height:34px;border:1px solid #e8ebf1;border-radius:11px;background:#fff;color:#667087;font-size:18px;cursor:pointer}
    .space-office-drawer-avatar{display:flex;align-items:center;justify-content:center;width:54px;height:54px;border-radius:17px;background:#ff7a70;color:#fff;font-size:17px;font-weight:950;box-shadow:0 10px 25px rgba(255,106,95,.2)}
    .space-office-drawer h3{margin:15px 0 4px;color:#1f293d;font-size:22px}.space-office-drawer-sub{margin:0;color:#8b95a8;font-size:12px}.space-office-drawer-state{display:inline-flex;margin-top:15px;border-radius:999px;background:#fff4e3;padding:7px 10px;color:#b97822;font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:.08em}
    .space-office-drawer-section{margin-top:24px;padding-top:20px;border-top:1px solid #eceff4}.space-office-drawer-section span{display:block;color:#a0a8b7;font-size:10px;font-weight:900;letter-spacing:.11em;text-transform:uppercase}.space-office-drawer-section strong{display:block;margin-top:8px;color:#334058;font-size:13px;line-height:1.5}
    @keyframes soFloat{0%,100%{margin-top:0}50%{margin-top:-4px}}@keyframes soPulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(.78);opacity:.65}}
    .space-office-layout{grid-template-columns:minmax(0,1fr) 310px}
    .space-office-world{min-height:720px;background:#ebe9e5;border-color:#dedfe3}
    .space-office-world:before{display:none}
    .space-office-stats{top:16px;left:16px;right:16px;gap:8px}
    .space-office-stat{border-color:rgba(255,255,255,.7);background:rgba(25,31,43,.78);box-shadow:0 12px 35px rgba(20,25,35,.18);backdrop-filter:blur(16px)}
    .space-office-stat span{color:#aeb8c9}.space-office-stat strong{color:#fff}.space-office-stat.is-alert strong{color:#ff8075}
    .space-office-scene{left:0;top:0;width:100%;height:100%;transform:none}
    .space-office-room-image{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center 54%;filter:saturate(.94) contrast(1.02)}
    .space-office-3d-frame{position:absolute;inset:0;width:100%;height:100%;border:0;background:#000c1e}
    .space-office-3d-hint{position:absolute;z-index:14;left:50%;bottom:15px;transform:translateX(-50%);border:1px solid rgba(255,255,255,.15);border-radius:999px;background:rgba(7,24,44,.76);padding:7px 12px;color:rgba(255,255,255,.72);font-size:9px;font-weight:850;letter-spacing:.08em;text-transform:uppercase;pointer-events:none;backdrop-filter:blur(12px)}
    .space-office-scene:after{content:"";position:absolute;inset:0;pointer-events:none;background:linear-gradient(180deg,rgba(17,23,34,.16),transparent 20%,transparent 76%,rgba(17,23,34,.08))}
    .space-office-wall-left,.space-office-wall-right,.space-office-floor,.space-office-window,.space-office-sign,.space-office-rug,.space-office-desk,.space-office-plant,.space-office-sofa{display:none}
    .space-office-agent{z-index:10;width:150px;height:112px;margin:0!important;border-radius:18px;animation:none;color:#fff}
    .space-office-agent:hover{transform:translateY(-3px);filter:none;background:rgba(255,255,255,.08)}
    .space-office-agent.maia{left:18%;top:39%}.space-office-agent.nilo{left:42%;top:24%;right:auto}.space-office-agent.luna{left:42%;top:61%;bottom:auto}.space-office-agent.theo{left:68%;top:42%;right:auto;bottom:auto}
    .space-office-avatar{display:none}
    .space-office-agent-name,.space-office-agent-role{position:absolute;left:50%;transform:translateX(-50%);white-space:nowrap;text-shadow:0 2px 8px rgba(13,18,28,.45)}
    .space-office-agent-name{bottom:14px;padding:7px 11px;border:1px solid rgba(255,255,255,.7);border-radius:999px;background:rgba(24,30,43,.78);font-size:11px;box-shadow:0 8px 22px rgba(16,21,31,.2);backdrop-filter:blur(12px)}
    .space-office-agent-role{bottom:-5px;color:rgba(255,255,255,.9);font-size:9px}
    .space-office-bubble{bottom:70px;min-width:160px;max-width:210px;border-color:rgba(255,255,255,.8);background:rgba(255,255,255,.94);color:#445067;box-shadow:0 12px 30px rgba(20,28,42,.18)}
    .space-office-agent.is-busy .space-office-bubble{opacity:1}
    .space-office-side{min-height:720px;border-color:#e1e3e8;border-radius:24px}
    @media(max-width:1180px){.space-office-layout{grid-template-columns:1fr}.space-office-side{min-height:420px}.space-office-world{min-height:660px}.space-office-agent.maia{left:16%}.space-office-agent.theo{left:67%}}
    @media(max-width:760px){.space-office{padding:20px 14px 34px}.space-office-head{display:block}.space-office-actions{margin-top:16px}.space-office-world{min-height:520px;border-radius:20px}.space-office-stats{grid-template-columns:1fr 1fr}.space-office-scene{top:0;transform:none}.space-office-side{border-radius:20px}.space-office-agent{transform:scale(.72)}.space-office-agent:hover{transform:scale(.72) translateY(-3px)}.space-office-agent.maia{left:8%;top:40%}.space-office-agent.nilo{left:36%;top:24%}.space-office-agent.luna{left:36%;top:62%}.space-office-agent.theo{left:65%;top:43%}}
  `;

  const agents = [
    { id: "maia", initials: "MA", name: "Maia", role: "Pedagógico", color: "#ff7a70" },
    { id: "nilo", initials: "NI", name: "Nilo", role: "Automações n8n", color: "#6ca9dc" },
    { id: "luna", initials: "LU", name: "Luna", role: "Financeiro", color: "#8e7bd2" },
    { id: "theo", initials: "TH", name: "Theo", role: "Growth", color: "#56b88a" },
  ];

  const state = { loading: false, loaded: false, data: null, selectedAgent: null, timer: null };

  const ensureStyle = () => {
    if (document.querySelector("[data-space-office-style]")) return;
    const style = document.createElement("style");
    style.setAttribute("data-space-office-style", "true");
    style.textContent = css;
    document.head.appendChild(style);
  };

  const getAgentState = (agent) => {
    const data = state.data || {};
    const logs = Array.isArray(data.logs) ? data.logs : [];
    const alerts = Array.isArray(data.alerts) ? data.alerts : [];
    const onboarding = Array.isArray(data.onboarding) ? data.onboarding : [];
    const running = logs.filter((row) => ["pendente", "enviado", "processando"].includes(String(row.status || "").toLowerCase()));
    const errors = logs.filter((row) => String(row.status || "").toLowerCase() === "erro");

    if (agent.id === "nilo") {
      const current = running[0] || errors[0] || logs[0];
      return {
        tone: running.length ? "busy" : errors.length ? "error" : "idle",
        activity: current ? `${current.workflow || "Workflow"} · ${statusLabel(current.status)}` : "Monitorando os workflows",
        detail: current?.erro || current?.resposta_recebida?.raw || "Conectado ao orquestrador n8n.",
      };
    }
    if (agent.id === "maia") {
      const current = alerts[0] || onboarding[0];
      return {
        tone: alerts.length ? "error" : onboarding.length ? "busy" : "idle",
        activity: alerts[0]?.titulo || (onboarding[0] ? `Onboarding de ${onboarding[0].aluno_nome || "aluno"}` : "Operação pedagógica em dia"),
        detail: current ? `Última atualização às ${formatTime(current.updated_at || current.created_at)}` : "Sem pendências pedagógicas.",
      };
    }
    if (agent.id === "luna") return { tone: "idle", activity: "Aguardando eventos financeiros", detail: "Pronta para receber cobranças e pagamentos do n8n." };
    return { tone: "idle", activity: "Aguardando novas oportunidades", detail: "Pronto para receber leads e tarefas comerciais." };
  };

  const renderAgent = (agent) => {
    const agentState = getAgentState(agent);
    return `
      <button class="space-office-agent ${escapeHtml(agent.id)} ${agentState.tone === "busy" ? "is-busy" : ""} ${agentState.tone === "error" ? "is-error" : ""}" type="button" data-space-office-agent="${escapeHtml(agent.id)}" style="--agent-color:${escapeHtml(agent.color)}">
        <span class="space-office-bubble">${escapeHtml(agentState.activity)}</span>
        <span class="space-office-avatar">
          <span class="space-office-head-shape"></span><span class="space-office-hair"></span>
          <span class="space-office-body-shape"></span><span class="space-office-leg left"></span><span class="space-office-leg right"></span>
          <span class="space-office-status-dot"></span>
        </span>
        <span class="space-office-agent-name">${escapeHtml(agent.name)}</span>
        <span class="space-office-agent-role">${escapeHtml(agent.role)}</span>
      </button>`;
  };

  const getEvents = () => {
    const data = state.data || {};
    const logs = (Array.isArray(data.logs) ? data.logs : []).map((row) => ({
      type: "workflow",
      title: row.workflow || "Workflow n8n",
      description: row.erro || `Execução ${statusLabel(row.status).toLowerCase()}`,
      status: String(row.status || ""),
      date: row.updated_at || row.created_at,
    }));
    const alerts = (Array.isArray(data.alerts) ? data.alerts : []).map((row) => ({
      type: "alert",
      title: row.titulo || row.tipo || "Alerta pedagógico",
      description: row.aluno_nome || row.professor_nome || "Requer atenção da equipe",
      status: "erro",
      date: row.created_at || row.updated_at,
    }));
    return [...logs, ...alerts]
      .sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime())
      .slice(0, 12);
  };

  const renderFeed = () => {
    const events = getEvents();
    if (!events.length) {
      return `<div class="space-office-empty"><span></span>Nenhum evento ainda.<br/>A equipe está conectada e aguardando o n8n.</div>`;
    }
    return events
      .map((event) => {
        const status = String(event.status || "").toLowerCase();
        const tone = status === "erro" ? "error" : ["pendente", "enviado", "processando"].includes(status) ? "running" : "success";
        const icon = event.type === "alert" ? "!" : tone === "success" ? "✓" : tone === "error" ? "×" : "↻";
        return `
          <article class="space-office-event is-${tone}">
            <div class="space-office-event-icon">${icon}</div>
            <div><strong>${escapeHtml(event.title)}</strong><p>${escapeHtml(event.description)}</p><time>${escapeHtml(formatTime(event.date))}</time></div>
          </article>`;
      })
      .join("");
  };

  const render = () => {
    const summary = state.data?.summary || {};
    root.innerHTML = `
      <div class="space-office">
        <header class="space-office-head">
          <div>
            <p class="space-office-kicker"><span class="space-office-live"></span>operação ao vivo</p>
            <h1>Space Office</h1>
            <p class="space-office-sub">Sua equipe de agentes trabalhando junto com os fluxos do n8n.</p>
          </div>
          <div class="space-office-actions">
            <div class="space-office-sync"><i></i>${state.loaded ? `Sincronizado às ${formatTime(state.data?.generatedAt)}` : "Conectando ao n8n"}</div>
            <button class="space-office-button" type="button" data-space-office-refresh ${state.loading ? "disabled" : ""}>${state.loading ? "Atualizando…" : "Atualizar operação"}</button>
          </div>
        </header>
        <div class="space-office-layout">
          <section class="space-office-world">
            <div class="space-office-stats">
              <div class="space-office-stat"><span>Em execução</span><strong>${Number(summary.running || 0)}</strong></div>
              <div class="space-office-stat"><span>Concluídos</span><strong>${Number(summary.completed || 0)}</strong></div>
              <div class="space-office-stat is-alert"><span>Alertas</span><strong>${Number(summary.alerts || 0)}</strong></div>
              <div class="space-office-stat"><span>Onboardings</span><strong>${Number(summary.onboarding || 0)}</strong></div>
            </div>
            <div class="space-office-scene" aria-label="Escritório isométrico dos agentes Space">
              <iframe class="space-office-3d-frame" src="/space-office-3d/" title="Space Office 3D" loading="eager"></iframe>
              <div class="space-office-3d-hint">Arraste para girar · use o scroll para aproximar</div>
            </div>
            <aside class="space-office-drawer" data-space-office-drawer></aside>
          </section>
          <aside class="space-office-side">
            <div class="space-office-side-head"><div class="space-office-side-head-row"><h2>Atividade da equipe</h2><span class="space-office-count">${getEvents().length}</span></div><p>Eventos reais recebidos pela plataforma</p></div>
            <div class="space-office-feed">${renderFeed()}</div>
          </aside>
        </div>
      </div>`;
    if (state.selectedAgent) openAgent(state.selectedAgent);
  };

  const openAgent = (id) => {
    const agent = agents.find((item) => item.id === id);
    const drawer = root.querySelector("[data-space-office-drawer]");
    if (!agent || !(drawer instanceof HTMLElement)) return;
    const agentState = getAgentState(agent);
    state.selectedAgent = id;
    drawer.innerHTML = `
      <button class="space-office-drawer-close" type="button" data-space-office-drawer-close aria-label="Fechar">×</button>
      <div class="space-office-drawer-avatar" style="background:${escapeHtml(agent.color)}">${escapeHtml(agent.initials)}</div>
      <h3>${escapeHtml(agent.name)}</h3><p class="space-office-drawer-sub">${escapeHtml(agent.role)} · Agente Space</p>
      <span class="space-office-drawer-state">${escapeHtml(agentState.tone === "busy" ? "Trabalhando agora" : agentState.tone === "error" ? "Precisa de atenção" : "Disponível")}</span>
      <div class="space-office-drawer-section"><span>Atividade atual</span><strong>${escapeHtml(agentState.activity)}</strong></div>
      <div class="space-office-drawer-section"><span>Contexto</span><strong>${escapeHtml(agentState.detail)}</strong></div>
      <div class="space-office-drawer-section"><span>Integração</span><strong>Space Plataforma → n8n → Supabase → Space Office</strong></div>`;
    requestAnimationFrame(() => drawer.classList.add("is-open"));
  };

  const closeAgent = () => {
    state.selectedAgent = null;
    const drawer = root.querySelector("[data-space-office-drawer]");
    if (drawer instanceof HTMLElement) drawer.classList.remove("is-open");
  };

  const load = async () => {
    if (state.loading) return;
    state.loading = true;
    render();
    try {
      const response = await fetch("/api/space-office", { credentials: "include" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "space_office_failed");
      state.data = data;
      state.loaded = true;
    } catch (error) {
      console.error("[space-office] load failed", error);
      state.data = state.data || { summary: {}, logs: [], onboarding: [], alerts: [] };
    } finally {
      state.loading = false;
      render();
    }
  };

  ensureStyle();
  render();

  root.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    const refresh = target.closest("[data-space-office-refresh]");
    if (refresh) {
      load();
      return;
    }
    const agent = target.closest("[data-space-office-agent]");
    if (agent instanceof HTMLElement) {
      openAgent(agent.getAttribute("data-space-office-agent") || "");
      return;
    }
    if (target.closest("[data-space-office-drawer-close]")) closeAgent();
  });

  window.addEventListener("space-office:open", () => {
    load();
    clearInterval(state.timer);
    state.timer = window.setInterval(() => {
      if (document.body.dataset.activePanel === "space-office") load();
    }, 15000);
  });

  if (document.body.dataset.activePanel === "space-office") load();
})();
