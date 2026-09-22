(() => {
  const root = document.querySelector('[data-attendance-inbox]');
  if (!root) return;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmtDate = value => value ? new Date(value).toLocaleString('pt-BR', { dateStyle:'short', timeStyle:'short' }) : '—';
  const shortDate = value => value ? new Date(value).toLocaleDateString('pt-BR', { day:'2-digit', month:'short' }) : '';
  const providerName = value => value === 'meta_whatsapp' ? 'WhatsApp Oficial' : (value || 'Canal');
  let state = { rows: [], teams: [], selected: '', detail: null, loading: false, detailLoading: false, error: '', q: '', filter: 'all', team_id: '' };
  let poll = null;
  const style = document.createElement('style');
  style.textContent = `
.ai{width:100%;max-width:1440px;margin:0 auto;padding:28px;color:#fff}.ai *{box-sizing:border-box}.ai p,.ai h1,.ai h2,.ai h3{margin:0}.ai-shell{border-radius:16px;padding:30px;background:radial-gradient(circle at 18% 8%,rgba(89,144,189,.16),transparent 42%),radial-gradient(circle at 86% 0%,rgba(255,78,70,.1),transparent 40%),linear-gradient(160deg,#0b1620 0%,#132436 44%,#102033 72%,#0b1620 100%);border:1px solid rgba(89,144,189,.13);box-shadow:0 18px 50px rgba(0,0,0,.34);min-height:calc(100vh - 90px)}.ai-head{display:flex;align-items:flex-end;justify-content:space-between;gap:18px;margin-bottom:22px}.ai-kicker{color:rgba(89,144,189,.72);font-size:11px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;margin-bottom:7px}.ai-title{font-size:clamp(1.8rem,3vw,2.35rem);font-weight:850;letter-spacing:-.04em;line-height:1.05}.ai-sub{margin-top:8px;color:rgba(255,255,255,.52);font-size:.92rem;line-height:1.5}.ai-refresh,.ai-chip,.ai-retry{appearance:none;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.05);color:rgba(255,255,255,.82);border-radius:999px;min-height:38px;padding:0 14px;font:inherit;font-size:.8rem;font-weight:750;cursor:pointer;transition:.16s}.ai-refresh:hover,.ai-chip:hover,.ai-chip.is-active,.ai-retry:hover{background:rgba(255,255,255,.1);border-color:rgba(255,255,255,.2);color:#fff}.ai-grid{display:grid;grid-template-columns:340px minmax(420px,1fr) 300px;gap:16px;min-height:680px}.ai-pane{border:1px solid rgba(89,144,189,.12);border-radius:20px;background:rgba(255,255,255,.04);box-shadow:0 12px 30px rgba(0,0,0,.22);overflow:hidden;min-height:0}.ai-list-head{padding:16px;border-bottom:1px solid rgba(255,255,255,.08);display:grid;gap:12px}.ai-input,.ai-select,.ai-composer textarea{width:100%;appearance:none;border:1px solid rgba(255,255,255,.1);border-radius:14px;background:rgba(255,255,255,.05);color:#fff;padding:11px 12px;font:inherit;font-size:.84rem;outline:0}.ai-select{background-image:linear-gradient(45deg,transparent 50%,rgba(255,255,255,.65) 50%),linear-gradient(135deg,rgba(255,255,255,.65) 50%,transparent 50%);background-position:calc(100% - 18px) 50%,calc(100% - 13px) 50%;background-size:5px 5px;background-repeat:no-repeat;padding-right:36px}.ai-input:focus,.ai-select:focus,.ai-composer textarea:focus{border-color:rgba(255,106,96,.52);box-shadow:0 0 0 3px rgba(255,106,96,.12)}.ai-filters{display:flex;gap:8px;flex-wrap:wrap}.ai-chip{min-height:31px;padding:0 10px;font-size:.72rem}.ai-list{height:590px;overflow:auto;padding:8px}.ai-item{width:100%;appearance:none;border:1px solid transparent;background:transparent;color:#fff;text-align:left;padding:13px;border-radius:16px;cursor:pointer;display:grid;gap:8px;transition:.16s}.ai-item:hover,.ai-item.is-active{background:rgba(255,255,255,.065);border-color:rgba(89,144,189,.16)}.ai-item-top,.ai-row{display:flex;align-items:center;justify-content:space-between;gap:10px}.ai-name{font-size:.95rem;font-weight:850;letter-spacing:-.02em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ai-time{font-size:.7rem;color:rgba(255,255,255,.42);white-space:nowrap}.ai-snippet{color:rgba(255,255,255,.54);font-size:.78rem;line-height:1.35;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.ai-meta{color:rgba(89,144,189,.78);font-size:.7rem;font-weight:800;text-transform:uppercase;letter-spacing:.09em}.ai-badge{display:inline-flex;align-items:center;justify-content:center;min-width:20px;height:20px;padding:0 7px;border-radius:999px;background:rgba(255,106,96,.16);color:#ffaaa5;font-size:.68rem;font-weight:850}.ai-chat{display:grid;grid-template-rows:auto 1fr auto;height:100%}.ai-chat-head{padding:18px 20px;border-bottom:1px solid rgba(255,255,255,.08);display:flex;justify-content:space-between;gap:14px}.ai-chat-title{font-size:1rem;font-weight:850}.ai-chat-sub{margin-top:4px;color:rgba(255,255,255,.48);font-size:.78rem}.ai-status{border:1px solid rgba(251,191,36,.2);background:rgba(251,191,36,.1);color:#fbbf24;border-radius:999px;padding:6px 10px;font-size:.7rem;font-weight:850;white-space:nowrap}.ai-messages{padding:20px;overflow:auto;display:flex;flex-direction:column;gap:12px;background:rgba(3,7,13,.16)}.ai-day{align-self:center;color:rgba(255,255,255,.5);font-size:.7rem;font-weight:800;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.05);border-radius:999px;padding:5px 10px}.ai-msg{max-width:min(560px,78%);padding:11px 13px;border-radius:16px;border:1px solid rgba(255,255,255,.08);font-size:.88rem;line-height:1.45}.ai-msg.inbound{align-self:flex-start;background:rgba(255,255,255,.07);border-top-left-radius:6px}.ai-msg.outbound{align-self:flex-end;background:rgba(89,144,189,.16);border-color:rgba(89,144,189,.22);border-top-right-radius:6px}.ai-msg.internal{align-self:center;background:rgba(251,191,36,.08);border-color:rgba(251,191,36,.18);color:#ffe6a3}.ai-msg-time{margin-top:7px;color:rgba(255,255,255,.42);font-size:.68rem;text-align:right}.ai-composer{padding:14px 16px;border-top:1px solid rgba(255,255,255,.08);display:grid;gap:9px}.ai-composer textarea{resize:none;min-height:62px;opacity:.55}.ai-composer-note{font-size:.76rem;color:rgba(255,255,255,.48)}.ai-send{justify-self:end;appearance:none;border:0;border-radius:999px;background:linear-gradient(180deg,#ff6a60,#f04a44);color:#fff;font:inherit;font-size:.8rem;font-weight:850;padding:10px 16px;opacity:.45;cursor:not-allowed}.ai-contact{padding:18px;display:grid;gap:14px}.ai-card-title{font-size:.78rem;text-transform:uppercase;letter-spacing:.13em;color:rgba(89,144,189,.72);font-weight:850}.ai-contact-name{font-size:1.08rem;font-weight:850}.ai-info{padding:12px;border-radius:14px;background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.07);min-width:0}.ai-info-label{font-size:.66rem;font-weight:850;letter-spacing:.12em;text-transform:uppercase;color:rgba(89,144,189,.72)}.ai-info-value{margin-top:5px;color:rgba(255,255,255,.88);font-size:.83rem;font-weight:720;word-break:break-word}.ai-empty,.ai-error,.ai-loading{height:100%;min-height:360px;display:grid;place-items:center;text-align:center;padding:24px;color:rgba(255,255,255,.55)}.ai-empty-card{max-width:390px;display:grid;gap:12px;place-items:center}.ai-empty-icon{width:58px;height:58px;border-radius:22px;display:grid;place-items:center;background:rgba(37,211,102,.1);border:1px solid rgba(37,211,102,.22);color:#25d366}.ai-empty-icon svg{width:25px;height:25px;stroke:currentColor;stroke-width:2;fill:none}.ai-empty-title{color:#fff;font-size:1.12rem;font-weight:850}.ai-skel{height:58px;border-radius:16px;background:linear-gradient(90deg,rgba(255,255,255,.04),rgba(255,255,255,.09),rgba(255,255,255,.04));background-size:220% 100%;animation:ai-shimmer 1.2s infinite}@keyframes ai-shimmer{to{background-position:-220% 0}}@media(max-width:1100px){.ai-grid{grid-template-columns:310px 1fr}.ai-pane--contact{grid-column:1/-1}.ai-list{height:520px}}@media(max-width:780px){.ai{padding:18px}.ai-shell{padding:20px}.ai-head{align-items:stretch;flex-direction:column}.ai-grid{grid-template-columns:1fr}.ai-list{height:auto;max-height:480px}.ai-pane{min-height:360px}}`;
  document.head.append(style);
  const icon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 8h10M7 12h7M5 20l3-3h9a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3H7a3 3 0 0 0-3 3v10"></path></svg>';
  const api = async (params = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => { if (value != null && String(value).trim()) query.set(key, String(value).trim()); });
    const res = await fetchWithAuth(`/api/attendance-inbox${query.toString() ? `?${query}` : ''}`);
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(res.status === 403 ? 'Você não tem permissão para acessar estas conversas.' : 'Caixa de entrada indisponível no momento. Tente novamente.');
    return payload;
  };
  const textFromMessage = msg => msg?.text || msg?.content?.text || msg?.content?.body || (msg?.kind ? `[${msg.kind}]` : 'Mensagem');
  const titleFor = row => row?.contact?.name || row?.contact?.phone || 'Contato sem nome';
  const activeRow = () => state.rows.find(row => row.conversation_id === state.selected) || state.detail?.conversation;
  function renderList() {
    if (state.loading) return `<div class="ai-list">${Array.from({length:6}).map(()=>'<div class="ai-skel"></div>').join('')}</div>`;
    if (!state.rows.length) return `<div class="ai-empty"><div class="ai-empty-card"><div class="ai-empty-icon">${icon}</div><h2 class="ai-empty-title">Nenhuma conversa encontrada</h2><p>A Caixa de Entrada mostrará conversas reais assim que houver mensagens recebidas.</p></div></div>`;
    return `<div class="ai-list">${state.rows.map(row => `<button class="ai-item ${row.conversation_id===state.selected?'is-active':''}" type="button" data-ai-select="${esc(row.conversation_id)}"><div class="ai-item-top"><strong class="ai-name">${esc(titleFor(row))}</strong><span class="ai-time">${esc(fmtDate(row.last_message_at || row.updated_at))}</span></div><p class="ai-snippet">${esc(textFromMessage(row.last_message))}</p><div class="ai-row"><span class="ai-meta">${esc(row.team?.name || 'Sem time')} · ${esc(providerName(row.connection?.provider))}</span>${row.unread_count?`<span class="ai-badge">${esc(row.unread_count)}</span>`:''}</div></button>`).join('')}</div>`;
  }
  function renderMessages() {
    if (state.detailLoading) return `<div class="ai-messages">${Array.from({length:5}).map(()=>'<div class="ai-skel"></div>').join('')}</div>`;
    if (state.error && state.selected) return `<div class="ai-error"><div><p>${esc(state.error)}</p><button class="ai-retry" data-ai-retry>Retentar</button></div></div>`;
    if (!state.selected) return `<div class="ai-empty"><div class="ai-empty-card"><div class="ai-empty-icon">${icon}</div><h2 class="ai-empty-title">Selecione uma conversa</h2><p>Abra uma conversa da lista para visualizar mensagens e dados do contato.</p></div></div>`;
    const messages = state.detail?.messages || [];
    if (!messages.length) return `<div class="ai-empty"><div class="ai-empty-card"><h2 class="ai-empty-title">Sem mensagens nesta conversa</h2><p>As mensagens aparecerão aqui em ordem cronológica.</p></div></div>`;
    let lastDay = '';
    return `<div class="ai-messages">${messages.map(msg => { const day = shortDate(msg.received_at || msg.provider_timestamp); const sep = day && day !== lastDay ? (lastDay = day, `<div class="ai-day">${esc(day)}</div>`) : ''; return `${sep}<article class="ai-msg ${esc(msg.direction || 'inbound')}"><div>${esc(textFromMessage(msg))}</div><div class="ai-msg-time">${esc(fmtDate(msg.received_at || msg.provider_timestamp))} · ${esc(msg.transport_status || '')}</div></article>`; }).join('')}</div>`;
  }
  function renderChat() {
    const row = activeRow();
    const detailConv = state.detail?.conversation;
    const composer = state.detail?.composer || { enabled:false, reason:'Envio será habilitado após concluir a conexão com a Meta.' };
    return `<section class="ai-pane ai-chat"><header class="ai-chat-head"><div><h2 class="ai-chat-title">${esc(row ? titleFor(row) : 'Conversa')}</h2><p class="ai-chat-sub">${esc((detailConv?.connection?.name || row?.connection?.name || 'Atendimento'))} · ${esc(detailConv?.team?.name || row?.team?.name || 'Time')}</p></div><span class="ai-status">${esc(detailConv?.status || row?.status || '—')}</span></header>${renderMessages()}<div class="ai-composer"><textarea data-ai-compose ${composer.enabled?'':'disabled'} placeholder="${composer.enabled?'Responder mensagem':'Envio indisponível'}"></textarea><div class="ai-row"><p class="ai-composer-note">${esc(composer.reason || (composer.enabled?'Envio pelo WhatsApp conectado.':'Envio indisponível no momento.'))}</p><button class="ai-send" data-ai-send ${composer.enabled?'':'disabled'}>Enviar</button></div></div></section>`;
  }
  function renderContact() {
    const contact = state.detail?.contact || activeRow()?.contact;
    const conv = state.detail?.conversation || activeRow();
    const linked = (state.detail?.participants || []).find(p => p.internal_person_id);
    if (!contact && !conv) return `<aside class="ai-pane ai-pane--contact ai-empty"><div class="ai-empty-card"><h2 class="ai-empty-title">Dados do contato</h2><p>Selecione uma conversa para ver o perfil.</p></div></aside>`;
    const items = [
      ['Telefone', contact?.phone || '—'], ['Canal', conv?.channel?.name || '—'], ['Conexão', conv?.connection?.name || '—'], ['Time', conv?.team?.name || '—'], ['Responsável', conv?.assigned_user_uid || 'Não atribuído'], ['Criado em', fmtDate(contact?.created_at || conv?.created_at)], ['Última atividade', fmtDate(conv?.last_message_at || conv?.updated_at)], ['Pessoa vinculada', linked ? `${linked.internal_person_type || 'registro'} · ${linked.internal_person_id}` : 'Não vinculada']
    ];
    return `<aside class="ai-pane ai-pane--contact"><div class="ai-contact"><p class="ai-card-title">Contato</p><h2 class="ai-contact-name">${esc(contact?.name || titleFor(conv))}</h2>${items.map(([label,value])=>`<div class="ai-info"><p class="ai-info-label">${esc(label)}</p><p class="ai-info-value">${esc(value)}</p></div>`).join('')}</div></aside>`;
  }
  function render() {
    root.innerHTML = `<div class="ai"><div class="ai-shell"><header class="ai-head"><div><p class="ai-kicker">Atendimento</p><h1 class="ai-title">Caixa de entrada</h1><p class="ai-sub">Acompanhe conversas reais dos canais de atendimento da Space.</p></div><button class="ai-refresh" data-ai-refresh>Atualizar</button></header>${state.error && !state.selected?`<div class="ai-pane ai-error"><div><p>${esc(state.error)}</p><button class="ai-retry" data-ai-refresh>Retentar</button></div></div>`:`<div class="ai-grid"><section class="ai-pane"><div class="ai-list-head"><input class="ai-input" data-ai-search placeholder="Buscar contato ou telefone" value="${esc(state.q)}"><div class="ai-filters">${['all','unread','mine','unassigned'].map(f=>`<button class="ai-chip ${state.filter===f?'is-active':''}" data-ai-filter="${f}" type="button">${esc({all:'Todas',unread:'Não lidas',mine:'Minhas',unassigned:'Sem responsável'}[f])}</button>`).join('')}</div><select class="ai-select" data-ai-team><option value="">Todos os times</option>${state.teams.map(t=>`<option value="${esc(t.team_id)}" ${state.team_id===t.team_id?'selected':''}>${esc(t.name)}</option>`).join('')}</select></div>${renderList()}</section>${renderChat()}${renderContact()}</div>`}</div></div>`;
  }
  async function load({ silent = false } = {}) {
    if (!silent) { state.loading = true; state.error = ''; render(); }
    try {
      const payload = await api({ q: state.q, filter: state.filter, team_id: state.team_id, limit: 50 });
      state.rows = Array.isArray(payload.rows) ? payload.rows : [];
      state.teams = Array.isArray(payload.teams) ? payload.teams : [];
      if (state.selected && !state.rows.some(row => row.conversation_id === state.selected)) { state.selected = ''; state.detail = null; }
      state.error = '';
    } catch (error) { state.error = error.message; }
    finally { state.loading = false; render(); }
  }
  async function sendMessage() {
    if (!state.selected || !state.detail?.composer?.enabled) return;
    const input = root.querySelector('[data-ai-compose]');
    const button = root.querySelector('[data-ai-send]');
    const text = String(input?.value || '').trim();
    if (!text) return;
    if (text.length > 4000) { state.error = 'Mensagem muito longa.'; return render(); }
    if (button) button.disabled = true;
    if (input) input.disabled = true;
    try {
      const response = await fetchWithAuth('/api/attendance-inbox', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({conversation_id:state.selected,text,client_request_id:crypto.randomUUID()})
      });
      const payload = await response.json().catch(()=>({}));
      if (!response.ok) {
        const reasons = {
          evolution_not_configured:'A integração do WhatsApp ainda não está configurada.',
          evolution_configuration_error:'A Evolution recusou a autenticação do servidor.',
          evolution_unavailable:'O WhatsApp está indisponível no momento.',
          attendance_channel_disabled:'Reconecte o WhatsApp para enviar mensagens.',
          attendance_invalid_recipient:'O telefone deste contato não é válido para envio.'
        };
        throw new Error(reasons[payload.error] || 'Não foi possível enviar a mensagem.');
      }
      if (input) input.value='';
      await loadDetail(state.selected,{silent:true});
      await load({silent:true});
    } catch (error) {
      state.error = error.message || 'Não foi possível enviar a mensagem.';
      render();
    }
  }
  async function loadDetail(id, { silent = false } = {}) {
    state.selected = id;
    if (!silent) { state.detailLoading = true; state.error = ''; render(); }
    try { state.detail = await api({ conversation_id: id, limit: 80 }); state.error = ''; }
    catch (error) { state.error = error.message; }
    finally { state.detailLoading = false; render(); }
  }
  function startPoll() {
    if (poll) clearInterval(poll);
    poll = setInterval(() => { if (!root.isConnected) return clearInterval(poll); load({ silent:true }).then(() => state.selected ? loadDetail(state.selected, { silent:true }) : null); }, 8000);
  }
  async function open() { await load(); startPoll(); }
  root.addEventListener('click', event => {
    const button = event.target.closest('button'); if (!button) return;
    if (button.hasAttribute('data-ai-refresh')) return load();
    if (button.hasAttribute('data-ai-retry') && state.selected) return loadDetail(state.selected);
    if (button.hasAttribute('data-ai-send')) return sendMessage();
    const filter = button.getAttribute('data-ai-filter');
    if (filter) { state.filter = filter; state.selected = ''; state.detail = null; return load(); }
    const id = button.getAttribute('data-ai-select');
    if (id) return loadDetail(id);
  });
  root.addEventListener('change', event => { if (event.target.matches('[data-ai-team]')) { state.team_id = event.target.value; state.selected = ''; state.detail = null; load(); } });
  root.addEventListener('input', event => { if (event.target.matches('[data-ai-search]')) { state.q = event.target.value; clearTimeout(root._aiSearch); root._aiSearch = setTimeout(() => load(), 260); } });
  root.addEventListener('keydown', event => {
    if (!event.target.matches('[data-ai-compose]') || event.key !== 'Enter' || event.shiftKey) return;
    event.preventDefault();
    sendMessage();
  });
  window.SpaceAttendanceInbox = { open };
  if (document.body.dataset.initialPanel === 'attendance-inbox') open();
})();
