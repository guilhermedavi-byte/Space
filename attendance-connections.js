(() => {
  const root = document.querySelector('[data-attendance-connections]');
  if (!root) return;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let data, loading = false, metaConnecting = false;
  const style = document.createElement('style');
  style.textContent = `
.ac{width:100%;max-width:1280px;margin:0 auto;padding:28px;color:#fff}.ac *{box-sizing:border-box}.ac p,.ac h1,.ac h2,.ac h3{margin:0}.ac-shell{border-radius:16px;padding:32px 40px;background:radial-gradient(circle at 18% 8%,rgba(89,144,189,.16),transparent 42%),radial-gradient(circle at 86% 0%,rgba(255,78,70,.12),transparent 40%),linear-gradient(160deg,#0b1620 0%,#132436 42%,#102033 72%,#0b1620 100%);border:1px solid rgba(89,144,189,.13);box-shadow:0 18px 50px rgba(0,0,0,.34)}.ac-head{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;margin-bottom:26px}.ac-kicker{color:rgba(89,144,189,.72);font-size:11px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;margin-bottom:7px}.ac-title{font-size:clamp(1.85rem,3vw,2.35rem);font-weight:850;letter-spacing:-.04em;line-height:1.05}.ac-sub{margin-top:8px;color:rgba(255,255,255,.52);font-size:.92rem;line-height:1.5}.ac-primary,.ac-secondary,.ac-ghost,.ac-icon-btn{appearance:none;border:0;font:inherit;display:inline-flex;align-items:center;justify-content:center;gap:9px;cursor:pointer;transition:transform .16s ease,box-shadow .16s ease,background .16s ease,border-color .16s ease,color .16s ease}.ac-primary{min-height:42px;padding:0 18px;border-radius:999px;background:linear-gradient(180deg,#ff6a60,#f04a44);color:#fff;font-size:.86rem;font-weight:800;box-shadow:0 12px 28px rgba(255,86,79,.26);white-space:nowrap}.ac-primary:hover,.ac-primary:focus-visible{transform:translateY(-1px);box-shadow:0 16px 34px rgba(255,86,79,.34);outline:0}.ac-secondary,.ac-ghost{min-height:38px;padding:0 14px;border-radius:999px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.05);color:rgba(255,255,255,.82);font-size:.8rem;font-weight:750}.ac-secondary:hover,.ac-secondary:focus-visible,.ac-ghost:hover,.ac-ghost:focus-visible{background:rgba(255,255,255,.09);border-color:rgba(255,255,255,.18);color:#fff;outline:0}.ac button:disabled{cursor:not-allowed;opacity:.45;transform:none;box-shadow:none}.ac-statusline{min-height:18px;color:rgba(255,255,255,.48);font-size:.8rem;margin:-8px 0 12px}.ac-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:16px}.ac-card{position:relative;overflow:visible;padding:20px;border:1px solid rgba(89,144,189,.12);border-radius:18px;background:rgba(255,255,255,.045);box-shadow:0 12px 30px rgba(0,0,0,.24);transition:transform .18s ease,border-color .18s ease,background .18s ease,box-shadow .18s ease}.ac-card:hover{transform:translateY(-1px);border-color:rgba(89,144,189,.22);background:rgba(255,255,255,.06);box-shadow:0 18px 42px rgba(0,0,0,.3)}.ac-card-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.ac-provider{display:flex;align-items:center;gap:12px;min-width:0}.ac-provider-icon,.ac-empty-icon{width:44px;height:44px;border-radius:16px;display:grid;place-items:center;background:rgba(37,211,102,.12);border:1px solid rgba(37,211,102,.24);color:#25d366;flex:none}.ac-provider-icon svg,.ac-empty-icon svg,.ac-plus svg{width:20px;height:20px;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;fill:none}.ac-card-title{font-size:1.02rem;font-weight:850;letter-spacing:-.02em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ac-card-provider{margin-top:3px;color:rgba(255,255,255,.46);font-size:.78rem;font-weight:650}.ac-badge{display:inline-flex;align-items:center;gap:7px;padding:6px 10px;border-radius:999px;border:1px solid rgba(89,144,189,.18);background:rgba(89,144,189,.12);color:#d9e8f4;font-size:.72rem;font-weight:800;white-space:nowrap}.ac-badge:before{content:'';width:7px;height:7px;border-radius:50%;background:currentColor}.ac-badge--active{border-color:rgba(93,202,165,.25);background:rgba(93,202,165,.1);color:#5dcaa5}.ac-badge--pending{border-color:rgba(251,191,36,.25);background:rgba(251,191,36,.1);color:#fbbf24}.ac-badge--disabled{border-color:rgba(255,255,255,.12);background:rgba(255,255,255,.05);color:rgba(255,255,255,.56)}.ac-badge--error{border-color:rgba(255,78,70,.28);background:rgba(255,78,70,.12);color:#ff6a60}.ac-card-body{display:grid;gap:12px;margin-top:18px}.ac-info-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.ac-info{padding:12px;border-radius:14px;background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.07);min-width:0}.ac-info-label{font-size:.66rem;font-weight:850;letter-spacing:.12em;text-transform:uppercase;color:rgba(89,144,189,.72)}.ac-info-value{margin-top:5px;color:rgba(255,255,255,.88);font-size:.86rem;font-weight:750;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ac-callout{display:flex;gap:10px;align-items:flex-start;padding:12px 13px;border-radius:14px;background:rgba(251,191,36,.08);border:1px solid rgba(251,191,36,.16);color:#ffe6a3;font-size:.8rem;line-height:1.45}.ac-actions{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:18px}.ac-menu{position:relative}.ac-menu summary{list-style:none}.ac-menu summary::-webkit-details-marker{display:none}.ac-icon-btn{width:38px;height:38px;border-radius:999px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.05);color:rgba(255,255,255,.75);font-size:20px;line-height:1}.ac-icon-btn:hover,.ac-icon-btn:focus-visible{background:rgba(255,255,255,.1);color:#fff;outline:0}.ac-menu-panel{position:absolute;right:0;top:44px;z-index:20;min-width:174px;padding:6px;border-radius:14px;border:1px solid rgba(255,255,255,.12);background:rgba(12,18,30,.98);box-shadow:0 18px 44px rgba(0,0,0,.42);display:grid;gap:4px}.ac-menu-panel button{appearance:none;border:0;background:transparent;color:rgba(255,255,255,.82);text-align:left;border-radius:10px;padding:10px 11px;font:inherit;font-size:.8rem;font-weight:750;cursor:pointer}.ac-menu-panel button:hover,.ac-menu-panel button:focus-visible{background:rgba(255,255,255,.08);color:#fff;outline:0}.ac-empty{min-height:360px;display:grid;place-items:center;text-align:center;border:1px dashed rgba(89,144,189,.18);border-radius:22px;background:rgba(255,255,255,.03);padding:34px 18px}.ac-empty-card{max-width:460px;display:grid;place-items:center;gap:14px}.ac-empty-icon{width:62px;height:62px;border-radius:22px}.ac-empty-title{font-size:1.25rem;font-weight:850;letter-spacing:-.02em}.ac-empty-text{color:rgba(255,255,255,.52);line-height:1.55}.ac-error{color:#ffaaa5}.ac-loading{min-height:260px;display:grid;place-items:center;color:rgba(255,255,255,.58);font-weight:750}.ac-spinner{width:18px;height:18px;border-radius:50%;border:2px solid rgba(255,255,255,.14);border-top-color:#ff6a60;animation:ac-spin .8s linear infinite}@keyframes ac-spin{to{transform:rotate(360deg)}}.ac-dialog{width:min(580px,calc(100vw - 28px));border:1px solid rgba(255,255,255,.12);border-radius:24px;padding:0;background:linear-gradient(160deg,#111b2a,#0d1422);color:#fff;box-shadow:0 30px 100px rgba(0,0,0,.62);overflow:hidden}.ac-dialog::backdrop{background:rgba(4,7,13,.72);backdrop-filter:blur(8px)}.ac-dialog form{margin:0}.ac-dialog-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:24px 26px 18px;border-bottom:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.025)}.ac-dialog-title{font-size:1.22rem;font-weight:850;letter-spacing:-.03em}.ac-dialog-sub{margin-top:6px;color:rgba(255,255,255,.52);font-size:.86rem;line-height:1.45}.ac-dialog-close{appearance:none;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.05);color:rgba(255,255,255,.78);width:38px;height:38px;border-radius:13px;cursor:pointer;font-size:18px}.ac-dialog-close:hover,.ac-dialog-close:focus-visible{background:rgba(255,255,255,.1);color:#fff;outline:0}.ac-dialog-body{display:grid;gap:16px;padding:22px 26px}.ac-provider-card{display:flex;gap:13px;align-items:center;padding:14px;border-radius:18px;border:1px solid rgba(37,211,102,.2);background:rgba(37,211,102,.07)}.ac-provider-card strong{display:block;font-size:.94rem}.ac-provider-card span{display:block;margin-top:3px;color:rgba(255,255,255,.52);font-size:.78rem}.ac-field{display:grid;gap:8px}.ac-field span{font-size:.74rem;font-weight:850;color:rgba(255,255,255,.68)}.ac-input,.ac-select{width:100%;appearance:none;border:1px solid rgba(255,255,255,.1);border-radius:14px;background:rgba(255,255,255,.05);color:#fff;padding:12px 13px;font:inherit;font-size:.88rem;outline:0}.ac-select{background-image:linear-gradient(45deg,transparent 50%,rgba(255,255,255,.65) 50%),linear-gradient(135deg,rgba(255,255,255,.65) 50%,transparent 50%);background-position:calc(100% - 18px) 50%,calc(100% - 13px) 50%;background-size:5px 5px;background-repeat:no-repeat;padding-right:36px}.ac-input:focus,.ac-select:focus{border-color:rgba(255,106,96,.52);box-shadow:0 0 0 3px rgba(255,106,96,.12)}.ac-meta-row{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}.ac-meta-row .ac-callout{flex:1;min-width:240px}.ac-dialog-foot{display:flex;justify-content:flex-end;gap:10px;padding:18px 26px 24px;border-top:1px solid rgba(255,255,255,.08)}@media(max-width:760px){.ac{padding:18px}.ac-shell{padding:24px 18px}.ac-head,.ac-actions,.ac-dialog-foot{align-items:stretch;flex-direction:column}.ac-primary,.ac-secondary,.ac-ghost{width:100%}.ac-info-grid{grid-template-columns:1fr}.ac-grid{grid-template-columns:1fr}.ac-dialog-head{padding:20px}.ac-dialog-body,.ac-dialog-foot{padding-left:20px;padding-right:20px}}`;
  style.textContent += `
.ac-dialog{max-height:calc(100dvh - 32px);margin:auto;color-scheme:dark}.ac-dialog form{display:flex;flex-direction:column;max-height:calc(100dvh - 34px)}.ac-dialog-head,.ac-dialog-foot{flex-shrink:0}.ac-dialog-body{overflow-y:auto;min-height:0}.ac-dialog button:disabled{opacity:.45;cursor:not-allowed}.ac-grid{grid-template-columns:repeat(auto-fit,minmax(min(360px,100%),1fr))}.ac-card{background:linear-gradient(145deg,rgba(255,255,255,.06),rgba(13,20,34,.65));border-color:rgba(255,255,255,.09)}.ac-card-head{flex-wrap:wrap}.ac-provider>div:last-child{min-width:0}.ac-card-title{max-width:280px}.ac-steps{list-style:none;display:flex;gap:8px;padding:0;margin:0 0 6px;font-size:.75rem;color:#8996a9}.ac-steps li{flex:1;padding:9px 0;border-bottom:2px solid #2a3445}.ac-steps .is-current{color:#ff8178;border-color:#ff6a60}.ac-steps .is-done{color:#5dcaa5;border-color:#5dcaa5}.ac-provider-choice{cursor:pointer;text-align:left;color:inherit;font:inherit;width:100%}.ac-provider-choice:disabled{opacity:.45;cursor:not-allowed}.ac-provider-choice input{accent-color:#ff6a60}.ac-qr-box{width:280px;max-width:100%;aspect-ratio:1;margin:4px auto;background:#fff;border-radius:20px;padding:16px;display:grid;place-items:center}.ac-qr-box img{display:block;width:100%;height:100%;object-fit:contain}.ac-qr-state{text-align:center;font-weight:800;color:#dce5f2}.ac-qr-timer{text-align:center;font-size:.78rem;color:#aab4c5;min-height:18px}.ac-qr-instructions{padding-left:24px;color:#bbc6d6;line-height:1.8;font-size:.88rem;margin:0}.ac-connected-mark{font-size:90px;color:#249a6c}.ac-detail-actions{display:flex;gap:8px;flex-wrap:wrap}.ac-dialog button:focus-visible{outline:2px solid #ff8178;outline-offset:3px}@media(prefers-reduced-motion:reduce){.ac *{transition:none!important}.ac-spinner{animation:none}}`;
  document.head.append(style);
  const icon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.5 15.5c3.5 2.8 7.6 3.4 9 .8l.5-.9a1.2 1.2 0 0 0-.4-1.6l-1.7-1a1.2 1.2 0 0 0-1.5.2l-.6.6c-.3.3-.7.3-1.1.1a8 8 0 0 1-2.4-2.4c-.2-.4-.2-.8.1-1.1l.6-.6c.4-.4.5-1 .2-1.5l-1-1.7A1.2 1.2 0 0 0 7.6 6l-.9.5c-2.6 1.4-2 5.5.8 9Z"></path><path d="M4.3 19.7 5.6 16A8.7 8.7 0 1 1 8 18.4l-3.7 1.3Z"></path></svg>';
  const plus = '<span class="ac-plus" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 5v14"></path><path d="M5 12h14"></path></svg></span>';
  const team = id => data.teams.find(t => t.team_id === id)?.name || 'Sem time disponível';
  const isEvolution = c => c.provider === 'evolution_whatsapp';
  const status = c => isEvolution(c) ? (c.status==='disabled'?['Desativado','disabled']:({open:['Conectado','active'],connecting:['Conectando','pending'],disconnected:['Desconectado','disabled'],failed:['Falha','error'],pending:['Aguardando QR','pending']}[c.connection_state]||['Aguardando QR','pending'])) : c.status === 'disabled' ? ['Desativado','disabled'] : c.setup_pending ? ['Configuração da Meta pendente','pending'] : c.status === 'active' ? ['Conectado','active'] : c.status === 'error' ? ['Erro','error'] : ['Aguardando configuração','pending'];
  const provider = c => isEvolution(c) ? 'WhatsApp via QR · Evolution' : c.provider === 'meta_whatsapp' ? 'WhatsApp Oficial' : c.provider;
  const metaPendingMessage = 'Configuração da Meta pendente';
  const metaPendingDescription = 'Conecte a conta e o número do WhatsApp Business pela Meta.';
  const metaAppId = '1026298976506797';
  const metaConfigId = '3735710229912086';
  const api = async body => {
    const res = await fetchWithAuth('/api/attendance-connections', body ? { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) } : {});
    const result = await res.json();
    if (!res.ok) throw new Error(res.status === 401 ? 'Sua sessão expirou. Entre novamente.' : res.status === 403 ? 'Você não tem permissão para esta ação.' : body?.action === 'status' && body?.status === 'active' && res.status === 409 ? metaPendingMessage : res.status === 422 ? 'Revise os campos informados.' : 'Conexões indisponíveis no momento. Tente novamente.');
    return result;
  };

  const loadMetaSdk = () => new Promise((resolve, reject) => {
    if (window.FB?.login) return resolve(window.FB);
    const existing = document.getElementById('facebook-jssdk');
    window.fbAsyncInit = () => {
      try { window.FB.init({ appId: metaAppId, cookie: true, xfbml: false, version: 'v21.0' }); resolve(window.FB); }
      catch (error) { reject(error); }
    };
    if (existing) return;
    const script = document.createElement('script');
    script.id = 'facebook-jssdk'; script.async = true; script.defer = true; script.crossOrigin = 'anonymous';
    script.src = 'https://connect.facebook.net/pt_BR/sdk.js';
    script.onerror = () => reject(new Error('Não foi possível carregar o SDK da Meta.'));
    document.head.append(script);
  });
  const createMetaSessionWaiter = () => {
    let cleanup = () => {};
    const promise = new Promise((resolve, reject) => {
      const allowed = new Set(['https://www.facebook.com', 'https://web.facebook.com']);
      const listener = event => {
        if (!allowed.has(event.origin)) return;
        let payload = event.data;
        if (typeof payload === 'string') { try { payload = JSON.parse(payload); } catch { return; } }
        if (!payload || payload.type !== 'WA_EMBEDDED_SIGNUP') return;
        const eventName = String(payload.event || '').toUpperCase();
        if (eventName === 'FINISH') { cleanup(); resolve(payload); }
        if (eventName === 'CANCEL' || eventName === 'ERROR') { cleanup(); reject(new Error('Configuração Meta cancelada. Nenhuma alteração foi feita.')); }
      };
      const timer = setTimeout(() => { cleanup(); reject(new Error('Não foi possível confirmar a seleção na Meta. Tente novamente.')); }, 120000);
      cleanup = () => { clearTimeout(timer); window.removeEventListener('message', listener); };
      window.addEventListener('message', listener);
    });
    return { promise, cancel: cleanup };
  };
  const startMetaSignup = async (connection, sourceButton) => {
    if (!connection?.setup_pending || metaConnecting) return;
    metaConnecting = true;
    const previous = sourceButton?.textContent;
    if (sourceButton) { sourceButton.disabled = true; sourceButton.textContent = 'Conectando à Meta...'; }
    const statusEl = root.querySelector('[data-ac-message]');
    if (statusEl) statusEl.textContent = 'Conectando à Meta...';
    try {
      const state = crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
      sessionStorage.setItem('space_meta_signup_state', state);
      const FB = await loadMetaSdk();
      const sessionWaiter = createMetaSessionWaiter();
      const login = await new Promise((resolve, reject) => {
        FB.login(response => {
          const code = response?.authResponse?.code;
          if (!code) { sessionWaiter.cancel(); return reject(new Error('Configuração Meta cancelada. Nenhuma alteração foi feita.')); }
          resolve({ code });
        }, {
          config_id: metaConfigId,
          response_type: 'code',
          override_default_response_type: true,
          state,
          extras: { feature: 'whatsapp_embedded_signup', sessionInfoVersion: '3', setup: {} },
        });
      });
      const session = await sessionWaiter.promise;
      await fetchWithAuth('/api/attendance-connections/meta-embedded-signup', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connection_id: connection.connection_id, code: login.code, state, session }),
      }).then(async res => {
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(payload?.error === 'attendance_request_rejected' ? 'A Meta não retornou ativos válidos para esta conexão.' : 'Não foi possível concluir a configuração Meta agora.');
      });
      if (statusEl) statusEl.textContent = 'WhatsApp conectado';
      await open();
    } catch (error) {
      if (statusEl) statusEl.textContent = error.message || 'Configuração Meta cancelada. Nenhuma alteração foi feita.';
    } finally {
      metaConnecting = false;
      if (sourceButton) { sourceButton.disabled = false; sourceButton.textContent = previous || 'Concluir configuração Meta'; }
    }
  };

  const date = v => v ? new Date(v).toLocaleString('pt-BR') : '—';
  const numberText = c => isEvolution(c) ? (c.phone || 'Aguardando leitura do QR') : c.channels[0]?.external_channel_id || 'Aguardando número';
  const defaultTeam = c => c.channels[0]?.default_team_id || c.draft_team_id;
  function renderEmpty() {
    return `<div class="ac-empty"><div class="ac-empty-card"><div class="ac-empty-icon">${icon}</div><h2 class="ac-empty-title">Nenhuma conexão configurada</h2><p class="ac-empty-text">Crie uma conexão para preparar os canais de atendimento da Space.</p><button class="ac-primary" data-ac-new ${data.permissions.create?'':'disabled'}>${plus}Nova conexão</button>${!data.permissions.create?'<p class="ac-sub">É necessário ter um time ativo e permissão de gestão para criar.</p>':''}</div></div>`;
  }
  function renderCard(c) {
    const [text, tone] = status(c);
    const pending = c.setup_pending && !isEvolution(c);
    return `<article class="ac-card"><div class="ac-card-head"><div class="ac-provider"><div class="ac-provider-icon">${icon}</div><div><h2 class="ac-card-title">${esc(c.name)}</h2><p class="ac-card-provider">${esc(provider(c))}</p></div></div><span class="ac-badge ac-badge--${tone}">${esc(text)}</span></div><div class="ac-card-body"><div class="ac-info-grid"><div class="ac-info"><p class="ac-info-label">Número / canal</p><p class="ac-info-value">${esc(numberText(c))}</p></div><div class="ac-info"><p class="ac-info-label">Time padrão</p><p class="ac-info-value">${esc(team(defaultTeam(c)))}</p></div></div>${isEvolution(c)&&c.can_edit&&c.connection_state!=='open'?`<button class="ac-primary" data-ac-qr="${esc(c.connection_id)}">${c.status==='disabled'?'Reconectar':'Conectar WhatsApp'}</button>`:''}${pending?`<div class="ac-meta-row"><div class="ac-callout"><strong>${esc(metaPendingMessage)}.</strong><span>${esc(metaPendingDescription)}</span></div><button class="ac-primary" data-ac-meta="${esc(c.connection_id)}">Concluir configuração Meta</button></div>`:''}</div><div class="ac-actions"><button class="ac-secondary" data-ac-details="${esc(c.connection_id)}">Detalhes</button><details class="ac-menu"><summary class="ac-icon-btn" aria-label="Ações da conexão">•••</summary><div class="ac-menu-panel"><button data-ac-edit="${esc(c.connection_id)}" ${c.can_edit?'':'disabled'}>Editar</button><button data-ac-toggle="${esc(c.connection_id)}" ${c.can_edit && (isEvolution(c) || c.status !== 'disabled' || c.can_activate)?'':'disabled'}>${c.status === 'disabled'?(isEvolution(c)?'Reconectar':'Ativar'):'Desativar'}</button>${isEvolution(c)&&c.can_edit?`<button data-ac-disconnect="${esc(c.connection_id)}">Desconectar</button>`:''}</div></details></div></article>`;
  }
  function render() {
    root.innerHTML = `<div class="ac"><div class="ac-shell"><header class="ac-head"><div><p class="ac-kicker">Atendimento</p><h1 class="ac-title">Conexões</h1><p class="ac-sub">Gerencie os canais de atendimento da Space.</p></div><button class="ac-primary" data-ac-new ${data.permissions.create?'':'disabled'}>${plus}Nova conexão</button></header><p class="ac-statusline" role="status" data-ac-message></p>${data.permissions.adopt?'<div class="ac-callout"><span>Já existe uma instância operacional na Evolution? Vincule-a sem reiniciar a sessão.</span><button class="ac-secondary" data-ac-adopt>Vincular instância existente</button></div>':''}${data.items.length ? `<div class="ac-grid">${data.items.map(renderCard).join('')}</div>` : renderEmpty()}</div></div>`;
  }
  async function open() {
    if (loading) return;
    loading = true; root.innerHTML = `<div class="ac"><div class="ac-shell ac-loading"><span class="ac-spinner" aria-hidden="true"></span><span>Carregando conexões…</span></div></div>`;
    try { data = await api(); render(); } catch(e) { root.innerHTML = `<div class="ac"><div class="ac-shell"><header class="ac-head"><div><p class="ac-kicker">Atendimento</p><h1 class="ac-title">Conexões</h1><p class="ac-sub">Gerencie os canais de atendimento da Space.</p></div></header><div class="ac-empty"><div class="ac-empty-card"><div class="ac-empty-icon">${icon}</div><p class="ac-error" role="alert">${esc(e.message)}</p><button class="ac-primary" data-ac-refresh>Tentar novamente</button></div></div></div></div>`; }
    finally { loading = false; }
  }
  function dialog(title, content, onSubmit, opts = {}) {
    const previous = document.activeElement;
    const el = document.createElement('dialog'); el.className = 'ac-dialog';
    el.innerHTML = `<form><div class="ac-dialog-head"><div><h2 class="ac-dialog-title">${esc(title)}</h2>${opts.description?`<p class="ac-dialog-sub">${esc(opts.description)}</p>`:''}</div><button class="ac-dialog-close" type="button" data-close aria-label="Fechar">×</button></div><div class="ac-dialog-body">${content}<p class="ac-error" role="alert"></p></div><div class="ac-dialog-foot"><button class="ac-secondary" type="button" data-close>${opts.cancel || 'Cancelar'}</button>${onSubmit?`<button class="ac-primary" type="submit" ${opts.submitDisabled?'disabled':''}>${esc(opts.submit || 'Salvar')}</button>`:''}</div></form>`;
    document.body.append(el); el.querySelectorAll('[data-close]').forEach(x => x.onclick = () => el.close());
    if (opts.validate) { const sync = () => { const submit = el.querySelector('button[type=submit]'); if (submit) submit.disabled = !opts.validate(el); }; el.addEventListener('input', sync); el.addEventListener('change', sync); setTimeout(sync, 0); }
    el.addEventListener('close', () => { el.remove(); previous?.focus(); });
    el.querySelector('form').onsubmit = async event => {
      event.preventDefault(); if (!onSubmit) return;
      const buttons = el.querySelectorAll('button'); buttons.forEach(b => b.disabled = true);
      try { const result = await onSubmit(new FormData(event.target)); el.close(); await open(); opts.afterSubmit?.(result); }
      catch(e) { el.querySelector('[role=alert]').textContent = e.message; buttons.forEach(b => b.disabled = false); }
    };
    el.showModal();
    return el;
  }
  const evolutionRequest = async (id, operation = '', method = 'GET', body, signal) => {
    const response = await fetchWithAuth(`/api/attendance-connections/${id}${operation?'/'+operation:''}`, {
      method, signal, ...(body ? {headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)} : {}),
    });
    const payload = await response.json();
    if (!response.ok) {
      const errors = {
        evolution_not_configured:'A integração Evolution ainda não está configurada no servidor.',
        evolution_configuration_error:'A Evolution recusou a autenticação do servidor. Avise o administrador.',
        evolution_protected_instance:'Esta instância operacional está protegida contra desconexão.',
        evolution_instance_missing:'A instância não foi encontrada. Contate o administrador.',
        evolution_disabled:'Esta conexão está desativada. Use Reconectar para continuar.',
      };
      throw new Error(errors[payload.error] || (response.status===403?'Você não tem permissão para esta conexão.':response.status===401?'Sua sessão expirou. Entre novamente.':response.status===409?'Há uma operação em andamento. Aguarde e tente novamente.':'Não foi possível consultar o WhatsApp agora. Tente novamente.'));
    }
    return payload;
  };
  const updateEvolutionCard = item => {
    const old = data.items.find(c=>c.connection_id===item.connection_id);
    if (old) Object.assign(old,item, {channels:item.channels.length?item.channels:old.channels, can_edit:item.channels.length?item.can_edit:old.can_edit}); else data.items.unshift(item);
    render();
  };
  function connectWhatsApp(connection, initial) {
    let closed=false, busy=false, timer, countdown, remaining=0, abort;
    let current=connection;
    const el = dialog('Conectar WhatsApp', `<ol class="ac-steps"><li class="is-done">1 · Dados</li><li class="is-current" data-scan-step>2 · Escanear QR</li><li data-connected-step>3 · Conectado</li></ol><div class="ac-qr-state" role="status" aria-live="polite">Preparando conexão…</div><div class="ac-qr-box"><span class="ac-spinner"></span></div><p class="ac-qr-timer"></p><ol class="ac-qr-instructions"><li>Abra o WhatsApp no celular.</li><li>Toque em <strong>Dispositivos conectados</strong>.</li><li>Escolha <strong>Conectar aparelho</strong> e escaneie o QR.</li></ol><button type="button" class="ac-secondary" data-qr-refresh>Gerar novo QR</button><p class="ac-sub">Acompanhamento automático enquanto esta janela estiver aberta. A conexão usa Evolution API, sem vinculação oficial via Meta.</p>`,null,{cancel:'Fechar',description:connection.name});
    el.classList.add('ac-qr-dialog');
    const label=el.querySelector('.ac-qr-state'), box=el.querySelector('.ac-qr-box'), refresh=el.querySelector('[data-qr-refresh]'), error=el.querySelector('[role=alert]');
    function clearQR() { box.replaceChildren(); clearInterval(countdown); remaining=0; el.querySelector('.ac-qr-timer').textContent=''; }
    function stop() { closed=true;clearTimeout(timer);clearInterval(countdown);abort?.abort();document.removeEventListener('visibilitychange',visibility); }
    function apply(payload) {
      if(closed)return;
      current=payload.item;updateEvolutionCard(current);
      if(current.connection_state==='open') {
        clearQR(); box.innerHTML='<div class="ac-connected-mark" aria-hidden="true">✓</div>';
        label.textContent='WhatsApp conectado';
        el.querySelector('[data-scan-step]').className='is-done';el.querySelector('[data-connected-step]').className='is-current';
        el.querySelector('.ac-qr-instructions').hidden=true;refresh.hidden=true;
        stop();return;
      }
      label.textContent=current.connection_state==='failed'?'Falha na conexão':payload.qr?'QR disponível · aguardando leitura':current.connection_state==='disconnected'?'Desconectado · gere um QR para conectar':'Conectando · verificando status…';
      if(payload.qr) {
        clearQR();const img=document.createElement('img');img.alt='QR para conectar WhatsApp';img.src=payload.qr;box.append(img);
        remaining=payload.refresh_after_seconds||40;
        const tick=()=>{el.querySelector('.ac-qr-timer').textContent=remaining>0?`Atualize o QR em ${remaining}s`:'QR pode ter expirado. Gere um novo para continuar.';if(remaining--<=0)clearInterval(countdown);};tick();countdown=setInterval(tick,1000);
      } else if(!box.querySelector('img')) box.innerHTML='<span class="ac-spinner" aria-label="Preparando QR"></span>';
    }
    async function requestQR(operation) {
      if(busy||closed)return;
      busy=true;refresh.disabled=true;error.textContent='';clearTimeout(timer);abort=new AbortController();
      try {apply(await evolutionRequest(current.connection_id,operation,'POST',{},abort.signal));}
      catch(e){if(!closed && e.name!=='AbortError'){error.textContent=e.message;label.textContent='Não foi possível conectar';}}
      finally{busy=false;refresh.disabled=false;schedule();}
    }
    function schedule(){clearTimeout(timer);if(!closed&&!document.hidden)timer=setTimeout(poll,4000);}
    async function poll(){
      if(closed||busy||document.hidden)return;
      busy=true;abort=new AbortController();
      try {apply(await evolutionRequest(current.connection_id,'','GET',null,abort.signal));error.textContent='';}
      catch(e){if(!closed&&e.name!=='AbortError')error.textContent=e.message;}
      finally {busy=false;schedule();}
    }
    function visibility(){if(document.hidden){clearTimeout(timer);abort?.abort();}else schedule();}
    document.addEventListener('visibilitychange',visibility);
    el.addEventListener('close',()=>{stop();box.replaceChildren();});
    refresh.onclick=()=>requestQR('refresh-qr');
    if(initial){apply(initial);schedule();}else requestQR('reconnect');
  }
  function chooseProvider() {
    const el=dialog('Nova conexão',`<button type="button" class="ac-provider-card ac-provider-choice" data-provider-qr ${data.permissions.evolution_ready?'':'disabled'}><div class="ac-provider-icon">${icon}</div><div><strong>WhatsApp via QR</strong><span>Evolution API · conectar pelo celular</span><span>${data.permissions.evolution_ready?'Escaneie o QR diretamente na Space.':'Disponível após concluir a configuração do servidor.'}</span></div></button><button type="button" class="ac-provider-card ac-provider-choice" data-provider-meta><div class="ac-provider-icon">${icon}</div><div><strong>WhatsApp Oficial</strong><span>Meta WhatsApp Business Platform</span><span>Fluxo oficial existente da Meta.</span></div></button>`,null,{cancel:'Cancelar',description:'Escolha como deseja conectar o WhatsApp.'});
    el.querySelector('[data-provider-qr]').onclick=()=>{el.close();newConnection();};
    el.querySelector('[data-provider-meta]').onclick=()=>{el.close();dialog('Nova conexão oficial',`<div class="ac-provider-card"><div class="ac-provider-icon">${icon}</div><div><strong>WhatsApp Oficial</strong><span>Meta WhatsApp Business Platform</span></div></div><label class="ac-field"><span>Nome da conexão</span><input class="ac-input" name="name" required maxlength="100"></label><label class="ac-field"><span>Time padrão</span><select class="ac-select" name="team" required><option value="">Selecione um time</option>${options(data.create_teams)}</select></label><div class="ac-callout">Após criar a conexão, conclua a vinculação pela Meta.</div>`,f=>api({action:'create',name:f.get('name'),team_id:f.get('team')}),{submit:'Criar conexão',submitDisabled:true,validate:el=>!!el.querySelector('[name=name]')?.value.trim()&&!!el.querySelector('[name=team]')?.value});};
  }
  function newConnection() {
    const key=crypto.randomUUID();
    return dialog('Nova conexão',`<ol class="ac-steps"><li class="is-current">1 · Dados</li><li>2 · Escanear QR</li><li>3 · Conectado</li></ol><label class="ac-provider-card ac-provider-choice"><input type="radio" name="provider" value="evolution_whatsapp" checked><div class="ac-provider-icon">${icon}</div><div><strong>WhatsApp via QR</strong><span>Evolution API</span><span>Conecte pelo celular, sem sair da Space.</span></div></label><label class="ac-field"><span>Nome da conexão</span><input class="ac-input" name="name" required maxlength="100" autocomplete="off" placeholder="Ex.: Space | Comercial"></label><label class="ac-field"><span>Time padrão</span><select class="ac-select" name="team" required><option value="">Selecione um time</option>${options(data.create_teams)}</select></label><div class="ac-callout"><span>Na próxima etapa, escaneie o QR com o WhatsApp do número que deseja conectar. As conexões existentes serão preservadas.</span></div>`, async f=>api({action:'create',provider:'evolution_whatsapp',name:f.get('name'),team_id:f.get('team'),idempotency_key:key}),{
      description:'Escolha o canal e o time que vai atender por ele.',submit:'Criar e conectar',submitDisabled:true,
      validate:el=>!!el.querySelector('[name=name]')?.value.trim()&&!!el.querySelector('[name=team]')?.value,
      afterSubmit:result=>connectWhatsApp(data.items.find(c=>c.connection_id===result.item.connection_id)||result.item,result),
    });
  }
  function evolutionDetails(c) {
    const info=(title,value)=>`<div class="ac-info"><p class="ac-info-label">${esc(title)}</p><p class="ac-info-value">${esc(value||'—')}</p></div>`;
    const el=dialog('Detalhes da conexão',`<h3>${esc(c.name)}</h3><div class="ac-info-grid">${info('Provider',provider(c))}${info('Status',status(c)[0])}${info('Número',c.phone)}${info('Instância',c.instance_name)}${info('Time padrão',team(defaultTeam(c)))}${info('Última verificação',date(c.last_seen))}</div><div class="ac-callout"><span>${esc(c.operational_note||'O histórico de conversas é preservado. Desconectar encerra a sessão do WhatsApp; desativar apenas suspende o canal na Space.')}</span></div>${c.can_edit?`<div class="ac-detail-actions"><button type="button" class="ac-primary" data-evo-connect>${c.connection_state==='open'?'Verificar conexão':'Reconectar'}</button><button type="button" class="ac-secondary" data-evo-disconnect>Desconectar</button><button type="button" class="ac-secondary" data-evo-edit>Editar</button></div>`:''}`,null,{cancel:'Fechar',description:'Operação do canal WhatsApp via QR.'});
    el.querySelector('[data-evo-connect]')?.addEventListener('click',()=>{el.close();connectWhatsApp(c);});
    el.querySelector('[data-evo-disconnect]')?.addEventListener('click',()=>{el.close();disconnectEvolution(c);});
    el.querySelector('[data-evo-edit]')?.addEventListener('click',()=>{el.close();editEvolution(c);});
  }
  function editEvolution(c) {
    const allowed=data.create_teams.filter(t=>c.channels.length&&c.channels.every(ch=>ch.allowed_teams.includes(t.team_id)));
    return dialog('Editar conexão',`<label class="ac-field"><span>Nome</span><input class="ac-input" name="name" required maxlength="100" value="${esc(c.name)}"></label>${allowed.length?`<label class="ac-field"><span>Time padrão</span><select class="ac-select" name="team">${options(allowed,defaultTeam(c))}</select></label>`:''}<label class="ac-field"><span>Observação operacional</span><textarea class="ac-input" name="note" maxlength="500" rows="3">${esc(c.operational_note||'')}</textarea></label>`,f=>evolutionRequest(c.connection_id,'','PATCH',{name:f.get('name'),operational_note:f.get('note'),...(f.get('team')?{team_id:f.get('team')}:{})}),{submit:'Salvar alterações'});
  }
  function disconnectEvolution(c) {
    return dialog('Desconectar WhatsApp',`<p>${esc(c.name)}</p><div class="ac-callout">A sessão deste número será encerrada. Para usar novamente, será necessário reconectar. O histórico permanece na Space.</div>`,()=>evolutionRequest(c.connection_id,'disconnect','POST',{}),{submit:'Desconectar'});
  }
  const options = (teams, selected) => teams.map(t => `<option value="${esc(t.team_id)}" ${t.team_id === selected?'selected':''}>${esc(t.name)}</option>`).join('');
  document.addEventListener('click', event => {
    const b = event.target.closest?.('button[data-ac-meta]');
    if (!b || root.contains(b) || b.disabled) return;
    const c = data?.items?.find(c => c.connection_id === b.dataset.acMeta);
    startMetaSignup(c, b);
  });
  root.addEventListener('click', async event => {
    const b = event.target.closest('button'); if (!b || b.disabled) return;
    if (b.hasAttribute('data-ac-refresh')) return open();
    if (b.hasAttribute('data-ac-meta')) { const c = data.items.find(c => c.connection_id === b.dataset.acMeta); return startMetaSignup(c, b); }
    if (b.hasAttribute('data-ac-new')) return chooseProvider();
    if (b.hasAttribute('data-ac-adopt')) return dialog('Vincular instância existente',`<div class="ac-callout">A instância configurada no servidor será apenas consultada e associada a este time. Nenhum QR, logout ou reinício será executado.</div><label class="ac-field"><span>Nome</span><input class="ac-input" name="name" required maxlength="100" value="Space | Suporte (QR)"></label><label class="ac-field"><span>Time padrão</span><select class="ac-select" name="team" required>${options(data.create_teams)}</select></label>`,f=>api({action:'adopt',provider:'evolution_whatsapp',name:f.get('name'),team_id:f.get('team')}),{submit:'Vincular instância'});
    const c = data.items.find(c => c.connection_id === (b.dataset.acDetails || b.dataset.acEdit || b.dataset.acToggle || b.dataset.acQr || b.dataset.acDisconnect)); if (!c) return;
    if (isEvolution(c)) {
      if(b.hasAttribute('data-ac-qr')) return connectWhatsApp(c);
      if(b.hasAttribute('data-ac-details')) return evolutionDetails(c);
      if(b.hasAttribute('data-ac-edit')) return editEvolution(c);
      if(b.hasAttribute('data-ac-disconnect')) return disconnectEvolution(c);
      if(b.hasAttribute('data-ac-toggle')) return c.status==='disabled'?connectWhatsApp(c):dialog('Desativar conexão', '<div class="ac-callout">O canal será suspenso na Space. A sessão WhatsApp e o histórico serão preservados.</div>',()=>evolutionRequest(c.connection_id,'','DELETE'),{submit:'Desativar'});
    }
    if (b.hasAttribute('data-ac-details')) return dialog('Detalhes da conexão', `<h3>${esc(c.name)}</h3><div class="ac-info-grid"><div class="ac-info"><p class="ac-info-label">Provider</p><p class="ac-info-value">${esc(provider(c))}</p></div><div class="ac-info"><p class="ac-info-label">Status</p><p class="ac-info-value">${esc(status(c)[0])}</p></div><div class="ac-info"><p class="ac-info-label">WABA ID</p><p class="ac-info-value">${esc(c.waba_id || 'Não configurado')}</p></div><div class="ac-info"><p class="ac-info-label">Atualizada</p><p class="ac-info-value">${esc(date(c.updated_at))}</p></div></div>${c.setup_pending?`<div class="ac-meta-row"><div class="ac-callout"><strong>${esc(metaPendingMessage)}.</strong><span>${esc(metaPendingDescription)}</span></div><button class="ac-primary" data-ac-meta="${esc(c.connection_id)}">Concluir configuração Meta</button></div>`:''}${data.permissions.technical?`<div class="ac-callout"><span>ID interno: ${esc(c.connection_id)}</span></div>${c.channels.map(ch => `<div class="ac-info"><p class="ac-info-label">Canal técnico</p><p class="ac-info-value">${esc(ch.channel_id)} · ${esc(ch.external_channel_id)} · ${esc(ch.status)}</p></div>`).join('')}`:''}<p class="ac-sub">Credenciais não são exibidas. O histórico é preservado ao desativar.</p>`, null, {description:'Informações técnicas e operacionais da conexão.'});
    if (b.hasAttribute('data-ac-edit')) {
      const channel = c.channels.length === 1 ? c.channels[0] : null;
      const choices = channel ? data.create_teams.filter(t => channel.allowed_teams.includes(t.team_id)) : !c.channels.length ? data.create_teams : [];
      return dialog('Editar conexão', `<label class="ac-field"><span>Nome</span><input class="ac-input" name="name" required maxlength="100" value="${esc(c.name)}"></label>${choices.length?`<label class="ac-field"><span>Time padrão</span><select class="ac-select" name="team">${options(choices, channel?.default_team_id || c.draft_team_id)}</select></label>`:''}${c.channels.length>1?'<p class="ac-sub">Para trocar o time, selecione um canal abaixo.</p>'+c.channels.map(ch=>`<label class="ac-field"><span>${esc(ch.display_name)}</span><select class="ac-select" name="channel:${esc(ch.channel_id)}">${options(data.create_teams.filter(t=>ch.allowed_teams.includes(t.team_id)),ch.default_team_id)}</select></label>`).join(''):''}<p class="ac-sub">O novo time padrão vale para novas conversas. Times disponíveis são os já autorizados no canal.</p>`, async f => {
        if (f.get('name') !== c.name) await api({action:'rename', connection_id:c.connection_id,name:f.get('name')});
        if (f.get('team') && f.get('team') !== (channel?.default_team_id || c.draft_team_id)) await api({action:'team', connection_id:c.connection_id,team_id:f.get('team'), ...(channel?{channel_id:channel.channel_id}:{})});
        for (const ch of c.channels) { const id=f.get('channel:'+ch.channel_id); if(id && id!==ch.default_team_id) await api({action:'team',connection_id:c.connection_id,channel_id:ch.channel_id,team_id:id}); }
      }, {description:'Ajuste nome e time operacional sem expor credenciais.', submit:'Salvar alterações'});
    }
    if (b.hasAttribute('data-ac-toggle')) return dialog(c.status === 'disabled'?'Ativar conexão':'Desativar conexão', `<p class="ac-sub">${esc(c.name)}</p><div class="ac-callout"><span>As conversas e o histórico serão preservados.</span></div>`, () => api({action:'status',connection_id:c.connection_id,status:c.status === 'disabled'?'active':'disabled'}), {submit:c.status === 'disabled'?'Ativar':'Desativar'});
  });
  window.SpaceAttendanceConnections = {open};
  if (document.body.dataset.initialPanel === 'attendance-connections') open();
})();
