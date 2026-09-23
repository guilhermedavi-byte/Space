(() => {
  const root = document.querySelector('[data-attendance-inbox]');
  if (!root) return;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt = value => value ? new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '';
  const dateOf = value => { const d = value ? new Date(value) : null; return d && Number.isFinite(d.getTime()) ? d : null; };
  const sameDay = (a, b) => a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const dayLabel = value => {
    const d = dateOf(value); if (!d) return '';
    const today = new Date(), yesterday = new Date(); yesterday.setDate(today.getDate() - 1);
    if (sameDay(d, today)) return 'Hoje';
    if (sameDay(d, yesterday)) return 'Ontem';
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  };
  const relative = value => {
    const d = dateOf(value); if (!d) return '';
    const minutes = Math.max(0, Math.floor((Date.now() - d.getTime()) / 60000));
    if (minutes < 1) return 'agora';
    if (minutes < 60) return `${minutes} min`;
    if (minutes < 1440 && sameDay(d, new Date())) return `${Math.floor(minutes / 60)} h`;
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  };
  const money = (value, currency = 'BRL') => value == null ? '' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(Number(value) || 0);
  const labels = { open: 'Em atendimento', pending: 'Aguardando', resolved: 'Resolvida', received: 'Recebida', pending_send: 'Na fila', sending: 'Enviando', accepted: 'Aceita', sent: 'Enviada', delivered: 'Entregue', read: 'Lida', failed: 'Falha' };
  const label = value => labels[value] || value || '';
  const state = { rows: [], teams: [], selectedConversationId: '', loading: false, hasLoaded: false, isFetching: false, detailLoading: false, sending: false, actioning: '', error: '', composerError: '', q: '', filter: 'all', team_id: '', menuOpen: false, viewer: null, media: new Map() };
  let poll, pollRunning = false, started = false, listRequest = null, detailRequest = null;
  let listVersion = 0, detailVersion = 0;
  const detailsById = new Map(), rowsById = new Map(), readSequences = new Map();
  const wiredMedia = new WeakSet(), pendingReads = new Map();
  Object.defineProperty(state, 'detail', { get: () => detailsById.get(state.selectedConversationId) || null });
  // Opt-in diagnostic events contain identifiers and event codes only, never message/contact data.
  const diagnosticErrors = [];
  const trace = (event, conversationId = state.selectedConversationId, code = '') => {
    if (event === 'inbox_error') { diagnosticErrors.push({ conversationId, code, at: Date.now() }); if (diagnosticErrors.length > 30) diagnosticErrors.shift(); }
    if (window.SpaceAttendanceInboxDebug === true) root.dispatchEvent(new CustomEvent('attendance-inbox-debug', { detail: { event, conversationId, code } }));
  };
  function selectConversation(id) {
    if (state.selectedConversationId === id) return;
    detailRequest?.controller.abort(); detailVersion += 1; detailRequest = null;
    state.selectedConversationId = id;
    state.detailLoading = Boolean(id && !detailsById.has(id));
    state.composerError = ''; state.viewer = null;
    trace('selectedConversationId_changed', id);
  }
  const drafts = new Map();
  const ui = { tab: 'person', contactHidden: false, listHidden: false, accordions: {} };
  const icons = { inbox: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M3 13h5l2 3h4l2-3h5"/>', search:'<circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/>', filter:'<path d="M4 7h16M7 12h10M10 17h4"/>', panel:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M15 4v16"/>', refresh:'<path d="M20 7v5h-5M4 17v-5h5M6 7a7 7 0 0 1 12-1l2 3M4 15l2 3a7 7 0 0 0 12-1"/>', chat:'<path d="M21 11a9 9 0 0 1-13 8l-5 2 2-5A9 9 0 1 1 21 11Z"/>', attach:'<path d="m8 12 6-6a3 3 0 0 1 4 4l-8 8a5 5 0 0 1-7-7l8-8"/>', quick:'<path d="m13 2-8 12h6l-1 8 9-13h-7Z"/>', emoji:'<circle cx="12" cy="12" r="9"/><path d="M8 14q4 5 8 0M8 9h.01M16 9h.01"/>', ai:'<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z"/>', send:'<path d="m4 4 17 8-17 8 3-8-3-8Zm3 8h14"/>', back:'<path d="m14 5-7 7 7 7"/>' };
  const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name] || icons.chat}</svg>`;
  const style = document.createElement('style');
  style.textContent = `
  body[data-active-panel="attendance-inbox"] .platform-main{padding:0!important;min-height:0}
  body[data-active-panel="attendance-inbox"] .platform-panel{margin:0;padding:0}
  .ai{--ai-line:rgba(255,255,255,.07);--ai-muted:#969aa7;--ai-accent:var(--accent,#ff564f);height:100dvh;width:100%;min-width:0;color:#eeeff3;font-size:13px;line-height:1.5}
  .ai *{box-sizing:border-box}.ai [hidden]{display:none!important}.ai button,.ai input,.ai select,.ai textarea{font:inherit}.ai button,.ai a,.ai summary,.ai input,.ai select,.ai textarea{transition:background 150ms,border-color 150ms,color 150ms}.ai button{cursor:pointer}.ai button:disabled{cursor:not-allowed;opacity:.4}.ai :focus-visible{outline:2px solid var(--ai-accent);outline-offset:3px}.ai p{margin:0}.ai svg{width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round;flex-shrink:0}
  .ai-shell{height:100%;display:flex;flex-direction:column;background:#15171d}.ai-head{height:56px;flex-shrink:0;display:flex;align-items:center;justify-content:space-between;padding:0 24px;border-bottom:1px solid var(--ai-line);gap:16px}.ai-title{font-size:15px;font-weight:600;letter-spacing:-.025em;margin:0}.ai-toolbar-title,.ai-row,.ai-person,.ai-actions,.ai-tools{display:flex;align-items:center;gap:8px}.ai-row{justify-content:space-between}.ai-count{color:var(--ai-muted);background:#23252d;border-radius:6px;padding:1px 7px;font-size:11px}.ai-indicator{font-size:11px;color:var(--ai-muted);display:flex;align-items:center;gap:6px}.ai-indicator:before{content:'';height:5px;width:5px;background:#90bba1;border-radius:50%}
  .ai-grid{display:grid;grid-template-columns:310px minmax(0,1fr) 320px;flex:1;min-height:0;min-width:0}.ai-grid.is-no-contact{grid-template-columns:310px minmax(0,1fr)}.ai-grid.is-list-collapsed{grid-template-columns:minmax(0,1fr) 320px}.ai-grid.is-no-contact.is-list-collapsed{grid-template-columns:minmax(0,1fr)}.ai-grid.is-list-collapsed>.ai-conversations{display:none}.ai-pane{min-height:0;min-width:0;overflow:hidden;border:0;border-radius:0}.ai-conversations{display:flex;flex-direction:column;background:#191b22;border-right:1px solid var(--ai-line)}.ai-list-head{padding:16px 16px 0;display:grid;gap:12px}.ai-search-wrap{display:flex;align-items:center;gap:8px;background:#22242c;border:1px solid var(--ai-line);border-radius:8px;padding:0 10px;color:var(--ai-muted)}.ai-input{width:100%;min-width:0;border:0;background:transparent;color:#eee;padding:8px 0;outline-offset:0!important}.ai-input::placeholder,.ai-composer textarea::placeholder{color:#838794}.ai-select{min-width:0;max-width:205px;border:0;background:#191b22;color:#c4c7d1;padding:4px 0;font-size:12px!important}.ai-filters{display:flex;gap:16px;border-bottom:1px solid var(--ai-line)}.ai-chip{border:0;border-bottom:2px solid transparent;background:transparent;color:var(--ai-muted);padding:8px 0 10px;font-size:12px!important}.ai-chip.is-active{color:#f2f3f6;border-bottom-color:var(--ai-accent)}.ai-filter-pop{position:relative}.ai-filter-pop>summary{list-style:none;cursor:pointer}.ai-filter-pop>summary::-webkit-details-marker{display:none}.ai-popover{position:absolute;top:36px;right:0;width:195px;padding:8px;background:#252730;border:1px solid var(--ai-line);border-radius:10px;z-index:5;box-shadow:0 8px 24px #0003}.ai-popover .ai-chip{width:100%;text-align:left;padding:8px;border:0;border-radius:6px}.ai-popover .is-active{background:var(--accent-soft)}
  .ai-list{flex:1;overflow-y:auto;padding:8px}.ai-item{position:relative;display:grid;grid-template-columns:40px minmax(0,1fr) auto;align-items:center;column-gap:10px;width:100%;height:74px;border:0;border-radius:8px;background:transparent;color:inherit;text-align:left;padding:10px}.ai-item:hover{background:#22252e}.ai-item.is-active{background:#2a272e}.ai-item.is-active:before{content:'';position:absolute;left:0;top:24px;bottom:24px;width:2px;border-radius:2px;background:var(--ai-accent)}.ai-item-copy{min-width:0}.ai-name{display:block;font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ai-snippet{font-size:11px;color:var(--ai-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:4px!important}.ai-item-end{display:grid;justify-items:end;gap:9px}.ai-time{color:#838794;font-size:10px;white-space:nowrap}.ai-badge{font-size:10px;font-weight:600;border-radius:6px;background:var(--accent-soft);color:#ff9e95;min-width:18px;text-align:center;padding:1px 4px}.ai-channel-dot{display:inline-flex;color:#94bba2;vertical-align:middle;margin-right:3px}.ai-channel-dot svg{width:11px;height:11px}.ai-avatar{position:relative;display:inline-grid;place-items:center;flex:0 0 36px;width:36px;height:36px;border-radius:12px;background:#343540;color:#d9d5de;overflow:hidden;font-weight:600;font-size:12px}.ai-avatar img{position:absolute;width:100%;height:100%;object-fit:cover}.ai-person{min-width:0}.ai-person>span:last-child{min-width:0}.ai-person strong{display:block;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;font-size:13px;font-weight:600}
  .ai-chat{display:flex;flex-direction:column;background:#13151b}.ai-chat-head{position:sticky;top:0;display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:72px;padding:12px 24px;border-bottom:1px solid var(--ai-line);background:#17191f;z-index:1}.ai-chat-head>.ai-row{min-width:0;gap:12px}.ai-mini,.ai-meta{font-size:11px;color:var(--ai-muted)}.ai-mini{margin-top:3px!important}.ai-status{color:#b7baC5;font-size:10px;white-space:nowrap}.ai-actions{flex-wrap:wrap;gap:6px}.ai-action,.ai-refresh,.ai-icon,.ai-send{display:inline-flex;align-items:center;justify-content:center;gap:6px;border:1px solid var(--ai-line);border-radius:8px;background:transparent;color:#cdd0da;min-height:30px;padding:5px 9px;text-decoration:none;font-size:11px!important;white-space:nowrap}.ai-icon{width:30px;padding:5px;border-color:transparent}.ai-action:hover,.ai-refresh:hover,.ai-icon:hover,.ai-chip:hover{background:#2b2d36;color:#fff}.ai-chat-head .ai-actions{flex-wrap:nowrap}.ai-chat-head .ai-action{border:0}.ai-chat-head .ai-action[data-ai-op="resolve"]{background:#292d33}.ai-messages{flex:1;min-height:0;overflow-y:auto;display:flex;flex-direction:column;gap:12px;padding:24px 32px;scroll-behavior:smooth}.ai-day{display:flex;align-items:center;gap:16px;align-self:stretch;color:#8e929e;font-size:10px;margin:12px 0 20px}.ai-day:before,.ai-day:after{content:'';height:1px;background:var(--ai-line);flex:1}.ai-msg{max-width:85%;border:0;border-radius:10px;padding:12px 14px;font-size:13px;line-height:1.6;overflow-wrap:anywhere}.ai-msg>div:first-child{white-space:pre-wrap}.ai-msg.inbound{align-self:flex-start;background:#252831;border-bottom-left-radius:3px}.ai-msg.outbound{align-self:flex-end;background:#353039;border-bottom-right-radius:3px}.ai-msg.internal{align-self:center;background:#302c24}.ai-msg-time{font-size:9px;color:#a1a0ab;margin-top:6px;text-align:right}.ai-quote{border-left:2px solid #92909e;padding:6px 10px;margin-bottom:8px;background:#ffffff06;color:#b5b4bf;font-size:11px}.ai-media{display:grid;gap:8px;min-width:0}.ai-media audio,.ai-media video{width:100%;max-width:360px}.ai-media img{display:block;max-width:100%;max-height:360px;border-radius:8px}.ai-doc{display:flex;align-items:center;gap:10px;color:inherit;text-decoration:none;padding:8px;background:#ffffff06;border-radius:8px}.ai-doc-icon{padding:8px}.ai-location,.ai-unavailable{color:#c5c6cf}.ai-caption{margin-top:8px!important}
  .ai-composer{margin:8px 24px 20px;border:1px solid #ffffff12;border-radius:12px;background:#22252d;box-shadow:0 4px 14px #0001;overflow:hidden;flex-shrink:0}.ai-composer:focus-within{border-color:#ffffff28}.ai-compose-label{display:flex;align-items:center;gap:6px;padding:12px 14px 0;color:#b7bac4;font-size:11px}.ai-compose-label svg{width:13px;height:13px}.ai-composer textarea{display:block;width:100%;border:0;outline:none;background:transparent;color:#eee;padding:12px 14px;min-height:88px;max-height:200px;resize:vertical;font-size:13px;line-height:1.6}.ai-composer-footer{padding:8px 10px;display:flex;align-items:center;justify-content:space-between;border-top:1px solid var(--ai-line);gap:8px}.ai-send{background:var(--ai-accent);color:#fff;border:0;padding:7px 13px;font-weight:600}.ai-send:hover{background:#ed4943}.ai-composer-hint{padding:0 14px 8px;color:var(--ai-muted);font-size:10px}.ai-form-error{color:#ffa89d;padding:8px 14px;font-size:12px}.ai-tools{gap:2px}.ai-shortcut{font-size:10px;color:#8e929d;margin-right:8px}
  .ai-pane--contact{background:#191b22;border-left:1px solid var(--ai-line);overflow-y:auto}.ai-contact{padding:20px;display:flex;flex-direction:column;gap:16px}.ai-profile{display:flex;flex-direction:column;align-items:center;gap:8px;text-align:center;padding:8px 0}.ai-profile .ai-avatar{width:64px;height:64px;flex-basis:64px;border-radius:20px;font-size:20px}.ai-contact-name{font-size:15px;font-weight:600;margin:4px 0 0;letter-spacing:-.02em}.ai-inspector-heading{display:flex;justify-content:space-between;align-items:center;color:var(--ai-muted);font-size:11px}.ai-context-tabs{display:flex;border-bottom:1px solid var(--ai-line);gap:20px}.ai-section{border-bottom:1px solid var(--ai-line);padding:0 0 16px}.ai-section summary{cursor:pointer;list-style:none;display:flex;justify-content:space-between;align-items:center;padding:4px 0 12px}.ai-section summary:after{content:'⌄';color:var(--ai-muted)}.ai-section:not([open]) summary:after{content:'›'}.ai-card-title{font-size:11px;font-weight:600;color:#d9dbe2}.ai-info{display:grid;grid-template-columns:104px minmax(0,1fr);gap:8px;padding:6px 0}.ai-info-label{font-size:11px;color:var(--ai-muted)}.ai-info-value{font-size:11px;color:#d2d4de;overflow-wrap:anywhere}.ai-context-content{display:grid;gap:16px}.ai-candidate{width:100%;border:1px solid var(--ai-line);border-radius:8px;background:#ffffff03;padding:10px;text-align:left;color:#ddd;margin:4px 0}.ai-candidate small{display:block;color:var(--ai-muted);margin-top:4px}.ai-empty,.ai-error{flex:1;min-height:180px;display:grid;place-items:center;text-align:center;color:var(--ai-muted);padding:24px}.ai-empty h2{font-size:16px;color:#d7dae2;font-weight:500;letter-spacing:-.02em}.ai-empty p{font-size:12px;max-width:280px;line-height:1.8}.ai-empty-symbol{display:inline-grid;place-items:center;width:56px;height:56px;background:#22252c;border:1px solid var(--ai-line);border-radius:16px;color:#999da9;margin-bottom:8px}.ai-empty-symbol svg{width:24px;height:24px}.ai-skel{height:64px;margin:8px;border-radius:8px;background:#ffffff06;animation:ai-pulse 1.3s ease-in-out infinite alternate}@keyframes ai-pulse{to{opacity:.4}}.ai-mobile-back{display:none}
  @media(min-width:1500px){.ai-grid{grid-template-columns:320px minmax(0,1fr) 340px}}
  @media(max-width:1250px){.ai-grid{grid-template-columns:300px minmax(0,1fr) 300px}.ai-chat-head{padding:12px 16px;flex-wrap:wrap}.ai-chat-head .ai-actions{margin-left:auto}.ai-messages{padding:20px}.ai-contact{padding:16px}.ai-info{grid-template-columns:90px minmax(0,1fr)}}
  @media(max-width:1050px){.ai-grid{grid-template-columns:300px minmax(0,1fr);position:relative}.ai-pane--contact{position:absolute;right:0;top:0;bottom:0;width:320px;max-width:100%;z-index:4;box-shadow:-10px 0 30px #0003}.ai-grid.is-list-collapsed{grid-template-columns:minmax(0,1fr)}.ai-shortcut{display:none}}
  @media(max-width:700px){.ai-head{padding:0 16px}.ai-indicator{display:none}.ai-grid,.ai-grid.is-no-contact{grid-template-columns:minmax(0,1fr)}.ai-grid:not(.has-selection) .ai-chat{display:none}.ai-grid.has-selection .ai-conversations{display:none}.ai-grid.has-selection .ai-chat{display:flex}.ai-mobile-back{display:inline-flex}.ai-composer{margin:8px 12px 12px}.ai-messages{padding:16px}.ai-msg{max-width:92%}.ai-chat-head .ai-status{display:none}.ai-title{font-size:14px}.ai-chat-head .ai-mini{max-width:210px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}}
  @media(prefers-reduced-motion:reduce){.ai *{transition:none!important;animation:none!important;scroll-behavior:auto}}
`;
  style.textContent += `.ai-audio{display:grid;grid-template-columns:32px minmax(60px,1fr) auto;align-items:center;gap:8px;min-width:200px}.ai-audio-btn{border:0;border-radius:50%;width:32px;height:32px;background:#ffffff12;color:#eee}.ai-audio-track{height:5px;background:#ffffff20;border-radius:4px;cursor:pointer;overflow:hidden}.ai-audio-fill{height:100%;background:#b6a4af}.ai-audio-time,.ai-audio-label{font-size:10px;color:var(--ai-muted)}.ai-audio-label{grid-column:2/4}.ai-image-wrap{border:0;background:transparent;padding:0;max-width:320px}.ai-video{max-width:100%;border-radius:8px}.ai-viewer{position:fixed;inset:0;z-index:1000;background:#08090dee;display:grid;place-items:center;padding:32px}.ai-viewer img{max-width:94vw;max-height:88vh;border-radius:8px}.ai-viewer button{position:absolute;right:20px;top:20px;width:36px;height:36px;border:1px solid var(--ai-line);background:#272a32;color:#fff;border-radius:8px;font-size:24px}.ai-chat-head .ai-actions{gap:2px}.ai-chat-head .ai-action{font-size:10px!important;padding:5px 7px}`;
  document.head.append(style);
  const api = async (params = {}, signal) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v != null && String(v).trim()) query.set(k, String(v).trim()); });
    const response = await fetchWithAuth(`/api/attendance-inbox${query.size ? `?${query}` : ''}`, { signal });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(response.status === 403 ? 'Você não tem permissão para acessar estas conversas.' : 'Caixa de entrada indisponível.');
    return payload;
  };
  const mediaText = kind => ({ audio:'🎤 Áudio', image:'📷 Imagem', video:'🎥 Vídeo', document:'📎 Documento', sticker:'Sticker', location:'Localização', contact:'Contato' })[kind] || 'Mensagem';
  const titleFor = row => row?.contact?.name || row?.contact?.phone || 'Contato sem nome';
  const msgText = msg => msg?.text || msg?.content?.text || msg?.content?.body || mediaText(msg?.kind);
  const initials = value => String(value || '?').trim().split(/\s+/).slice(0,2).map(part => Array.from(part)[0] || '').join('').toUpperCase() || '?';
  const photoUrl = value => { try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password ? u.href : ''; } catch { return ''; } };
  const avatar = contact => {
    const name = contact?.name || contact?.phone || 'Contato';
    const url = photoUrl(contact?.photo_url || contact?.avatar_url || contact?.avatar?.url || contact?.whatsapp_avatar_url);
    return `<span class="ai-avatar" aria-label="${esc(name)}"><span>${esc(initials(name))}</span>${url ? `<img src="${esc(url)}" alt="" referrerpolicy="no-referrer" data-ai-avatar>` : ''}</span>`;
  };
  const mediaUrl = msg => `/api/attendance-inbox/media?message_id=${encodeURIComponent(msg.message_id)}`;
  const mediaMeta = msg => msg?.media || msg?.content?.media || {};
  const sizeText = value => {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return '';
    if (n >= 1048576) return `${(n / 1048576).toFixed(1)} MB`;
    if (n >= 1024) return `${Math.round(n / 1024)} KB`;
    return `${n} B`;
  };
  function renderQuoted(msg) {
    return msg?.quoted ? `<div class="ai-quote">${esc(msg.quoted.direction === 'outbound' ? 'Você' : 'Contato')} · ${esc(mediaText(msg.quoted.kind))}<br>${esc(msg.quoted.text || mediaText(msg.quoted.kind))}</div>` : '';
  }
  function audioState(id) {
    if (!state.media.has(id)) state.media.set(id, { playing: false, current: 0, duration: 0, error: false, loading: false });
    return state.media.get(id);
  }
  function fmtDuration(seconds) {
    const n = Math.max(0, Math.floor(Number(seconds) || 0));
    return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`;
  }
  function renderAudio(msg) {
    const item = audioState(msg.message_id);
    if (item.error || mediaMeta(msg).fetch_status === 'failed') return '<div class="ai-unavailable">Audio indisponível</div>';
    const pct = item.duration ? Math.min(100, Math.max(0, item.current / item.duration * 100)) : 0;
    return `<div class="ai-audio" data-ai-audio="${esc(msg.message_id)}">
      <audio preload="metadata" src="${esc(mediaUrl(msg))}"></audio>
      <button class="ai-audio-btn" type="button" aria-label="${item.playing ? 'Pausar áudio' : 'Reproduzir áudio'}" data-ai-audio-toggle="${esc(msg.message_id)}">${item.loading ? '...' : item.playing ? 'II' : '▶'}</button>
      <div class="ai-audio-track" data-ai-audio-seek="${esc(msg.message_id)}"><div class="ai-audio-fill" style="width:${pct}%"></div></div>
      <span class="ai-audio-time">${esc(fmtDuration(item.duration || item.current || 0))}</span>
      <span class="ai-audio-label">audio</span>
    </div>`;
  }
  function renderMedia(msg) {
    const meta = mediaMeta(msg);
    const caption = msg.content?.text || meta.caption || '';
    if (meta.fetch_status === 'failed') return `<div class="ai-unavailable">Mídia indisponível</div>${caption ? `<p class="ai-caption">${esc(caption)}</p>` : ''}`;
    if (msg.kind === 'audio') return renderAudio(msg);
    if (msg.kind === 'image' || msg.kind === 'sticker') {
      const src = mediaUrl(msg);
      return `<div class="ai-media"><button class="ai-image-wrap" type="button" data-ai-viewer="${esc(src)}"><img src="${esc(src)}" alt="${esc(caption || mediaText(msg.kind))}" loading="lazy" decoding="async" data-ai-media-img></button>${caption ? `<p class="ai-caption">${esc(caption)}</p>` : ''}</div>`;
    }
    if (msg.kind === 'video') return `<video class="ai-video" controls preload="metadata" src="${esc(mediaUrl(msg))}"></video>${caption ? `<p class="ai-caption">${esc(caption)}</p>` : ''}`;
    if (msg.kind === 'document') {
      const name = meta.filename || caption || 'Documento';
      const details = [meta.mime_type, sizeText(meta.size_bytes || meta.size)].filter(Boolean).join(' · ');
      return `<a class="ai-doc" href="${esc(mediaUrl(msg))}" target="_blank" rel="noopener"><span class="ai-doc-icon">DOC</span><span><strong>${esc(name)}</strong>${details ? `<br><small>${esc(details)}</small>` : ''}</span></a>`;
    }
    if (msg.kind === 'location') return `<div class="ai-location">${esc(msg.content?.address || 'Localização compartilhada')}</div>`;
    if (msg.kind === 'contact') return `<div class="ai-location">${esc(msg.content?.name || 'Contato compartilhado')}<br>${esc(msg.content?.phone || '')}</div>`;
    return `<div>${esc(msgText(msg))}</div>`;
  }
  function renderMessageBody(msg) {
    const mediaKinds = ['audio', 'image', 'video', 'document', 'sticker', 'location', 'contact'];
    return `${renderQuoted(msg)}${mediaKinds.includes(msg.kind) ? renderMedia(msg) : `<div>${esc(msgText(msg))}</div>`}`;
  }
  const field = ([name, value]) => value ? `<div class="ai-info"><p class="ai-info-label">${esc(name)}</p><p class="ai-info-value">${esc(value)}</p></div>` : '';
  const section = (title, rows) => {
    const body = rows.map(field).join('');
    return body ? `<details class="ai-section" data-ai-accordion="${esc(title)}" ${ui.accordions[title] === false ? '' : 'open'}><summary class="ai-card-title">${esc(title)}</summary>${body}</details>` : '';
  };
  function renderList() {
    if (state.loading) return `<div class="ai-list">${Array.from({ length: 6 }).map(() => '<div class="ai-skel"></div>').join('')}</div>`;
    if (!state.rows.length) return '<div class="ai-empty"><div><h2>Nenhuma conversa encontrada</h2><p>A Caixa de entrada mostrará conversas reais assim que houver mensagens recebidas.</p></div></div>';
    return `<div class="ai-list" aria-label="Conversas">${state.rows.map(row => `<button class="ai-item ${row.conversation_id === state.selectedConversationId ? 'is-active' : ''}" aria-pressed="${row.conversation_id === state.selectedConversationId}" data-ai-select="${esc(row.conversation_id)}">${avatar(row.contact)}<span class="ai-item-copy"><strong class="ai-name">${esc(titleFor(row))}</strong><span class="ai-snippet" style="display:block"><span class="ai-channel-dot" title="WhatsApp">${icon('chat')}</span>${esc(msgText(row.last_message))}</span></span><span class="ai-item-end"><span class="ai-time" title="${esc(fmt(row.last_message_at || row.updated_at))}">${esc(relative(row.last_message_at || row.updated_at))}</span>${row.unread_count ? `<span class="ai-badge" aria-label="${esc(row.unread_count)} não lidas">${esc(row.unread_count)}</span>` : '<span class="ai-time">·</span>'}</span></button>`).join('')}</div>`;
  }
  function renderMessages() {
    if (state.detailLoading && !state.detail) return '<div class="ai-messages"><div class="ai-skel"></div><div class="ai-skel"></div><div class="ai-skel"></div></div>';
    if (!state.selectedConversationId) return `<div class="ai-empty"><div><span class="ai-empty-symbol">${icon('inbox')}</span><h2>Um espaço para cada conversa</h2><p>Selecione uma conversa ao lado para continuar o atendimento com todo o contexto.</p></div></div>`;
    const messages = state.detail?.messages || [];
    if (!messages.length) return '<div class="ai-empty"><div><h2>Sem mensagens</h2><p>As mensagens aparecerão aqui em ordem cronológica.</p></div></div>';
    let last = '';
    return `<div class="ai-messages" data-ai-messages>${messages.map(msg => { const when = msg.received_at || msg.provider_timestamp; const day = dayLabel(when); const sep = day && day !== last ? (last = day, `<div class="ai-day">${esc(day)}</div>`) : ''; return `${sep}<article data-ai-message-id="${esc(msg.message_id)}" class="ai-msg ${esc(msg.direction || 'inbound')}">${renderMessageBody(msg)}<div class="ai-msg-time">${esc(fmt(when))} · ${esc(msg.direction === 'outbound' ? label(msg.transport_status) : msg.direction === 'internal' ? 'Interna' : 'Recebida')}</div></article>`; }).join('')}</div>`;
  }
  function canSend() { return Boolean(state.detail?.composer?.enabled && (drafts.get(state.selectedConversationId) || '').trim() && !state.sending); }
  function renderConversationActions(conv) {
    if (!state.selectedConversationId) return '';
    const busy = state.actioning ? 'disabled' : '';
    return `<div class="ai-actions"><button class="ai-action" data-ai-op="assign" ${busy}>Assumir</button><details class="ai-filter-pop"><summary class="ai-icon" aria-label="Mais ações" title="Mais ações">···</summary><div class="ai-popover"><button class="ai-action" data-ai-op="transfer" ${busy}>Transferir</button><button class="ai-action" data-ai-op="unassign" ${!conv.assigned_user_uid || state.actioning ? 'disabled' : ''}>Sem responsável</button></div></details>${conv.status === 'resolved' ? `<button class="ai-action" data-ai-op="reopen" ${busy}>Reabrir</button>` : `<button class="ai-action" data-ai-op="resolve" ${busy}>Resolver</button>`}</div>`;
  }
  function renderChat() {
    const conv = state.detail?.conversation || rowsById.get(state.selectedConversationId) || {};
    const composer = state.detail?.composer || { enabled: false, reason: 'Selecione uma conversa para responder.' };
    return `<section class="ai-pane ai-chat" aria-label="Conversa">${state.selectedConversationId ? `<header class="ai-chat-head"><div class="ai-row"><button class="ai-icon ai-mobile-back" data-ai-back aria-label="Voltar às conversas">${icon('back')}</button><span class="ai-person">${avatar(state.detail?.contact || conv.contact)}<span><strong>${esc(titleFor(state.detail || conv))}</strong><p class="ai-mini">WhatsApp · ${esc(conv.team?.name || 'Time')} · ${esc(conv.assigned_user_name || (conv.assigned_user_uid ? 'Atribuída' : 'Sem responsável'))}</p></span></span><span class="ai-status">${esc(label(conv.status))}</span></div><div class="ai-actions">${renderConversationActions(conv)}<button class="ai-icon" data-ai-toggle-contact aria-label="${ui.contactHidden ? 'Mostrar' : 'Recolher'} perfil" title="Perfil da pessoa" aria-expanded="${!ui.contactHidden}">${icon('panel')}</button></div></header>` : ''}${renderMessages()}${state.selectedConversationId && composer.enabled ? `<div class="ai-composer"><div class="ai-compose-label">${icon('chat')} Responder por WhatsApp</div><textarea aria-label="Mensagem" data-ai-compose ${composer.enabled ? '' : 'disabled'} placeholder="${composer.enabled ? 'Escreva uma resposta…' : 'Envio indisponível'}">${esc(drafts.get(state.selectedConversationId) || '')}</textarea>${state.composerError ? `<p class="ai-form-error" role="alert">${esc(state.composerError)}</p>` : ''}<div class="ai-composer-hint">${esc(composer.reason || '')}</div><div class="ai-composer-footer"><div class="ai-tools">${[['attach','Anexos'],['quick','Respostas rápidas'],['emoji','Emoji'],['ai','Assistente IA']].map(([key,name]) => `<span title="${name} — ainda indisponível"><button class="ai-icon" disabled aria-label="${name} — ainda indisponível">${icon(key)}</button></span>`).join('')}</div><div class="ai-row"><span class="ai-shortcut">⇧ Enter para nova linha</span><button class="ai-send" data-ai-send ${canSend() ? '' : 'disabled'}>${state.sending ? 'Enviando' : 'Enviar'}${icon('send')}</button></div></div></div>` : state.selectedConversationId ? `<div class="ai-composer"><p class="ai-composer-hint">${esc(state.composerError || composer.reason || 'Envio indisponível.')}</p></div>` : ''}</section>`;
  }
  function renderContact() {
    const detail = state.detail || { conversation: rowsById.get(state.selectedConversationId), contact: rowsById.get(state.selectedConversationId)?.contact };
    const contact = detail.contact || {};
    const conv = detail.conversation || {};
    const ctx = detail.context || {};
    const person = ctx.person;
    const opp = ctx.crm?.opportunity;
    const student = ctx.student;
    const actions = ctx.actions || {};
    const candidates = ctx.identity?.candidates || [];
    if (!state.selectedConversationId) return '<aside class="ai-pane ai-pane--contact ai-empty"><div><h2>Dados da pessoa</h2><p>Selecione uma conversa.</p></div></aside>';
    const actionHtml = `<div class="ai-actions">${actions.open_person_url ? `<a class="ai-action" href="${esc(actions.open_person_url)}">Abrir pessoa</a>` : ''}${actions.open_crm_url ? `<a class="ai-action" href="${esc(actions.open_crm_url)}">Abrir oportunidade</a>` : ''}${actions.open_student_url ? `<a class="ai-action" href="${esc(actions.open_student_url)}">Abrir aluno</a>` : ''}${actions.can_create_opportunity ? '<button class="ai-action" data-ai-create-opportunity>Criar oportunidade</button>' : ''}${actions.can_unlink_person ? '<button class="ai-action" data-ai-unlink>Remover vínculo</button>' : ''}</div>`;
    const candidatesHtml = candidates.length && !ctx.identity?.linked ? `<section class="ai-section"><p class="ai-card-title">Possíveis correspondências</p>${candidates.map(c => `<button class="ai-candidate" data-ai-link-person="${esc(c.id)}"><strong>${esc(c.name || c.id)}</strong><small>${esc([c.relation, c.phone, c.email].filter(Boolean).join(' · '))}</small></button>`).join('')}</section>` : '';
    const personContent = `${section('Contato', [['Nome', contact.name], ['Telefone', person?.phone || contact.phone], ['Email', person?.email || contact.email], ['Relação com a Space', contact.relationship || (student ? 'Aluno' : opp ? 'Lead' : 'Não vinculada')]])}${section('Atendimento', [['Canal', conv.channel?.name || 'WhatsApp'], ['Time', conv.team?.name], ['Responsável', conv.assigned_user_name || (conv.assigned_user_uid ? 'Atribuído' : 'Não atribuído')], ['Status', label(conv.status)], ['Criado em', fmt(conv.created_at || contact.created_at)], ['Última atividade', fmt(conv.last_message_at || conv.updated_at)], ['Total de mensagens', String(detail.stats?.message_count ?? (detail.messages || []).length)], ['Não lidas', String(detail.stats?.unread_count ?? 0)]])}${section('Vínculos', [['Pessoa vinculada', person?.name || contact.relationship || 'Não vinculada'], ['Aluno vinculado', student?.name || student?.id], ['Oportunidade', opp?.title || opp?.id]])}${candidatesHtml}${actionHtml}`;
    const journeyContent = `${section('CRM', opp ? [['Oportunidade', opp.title || opp.id], ['Pipeline', opp.pipeline], ['Etapa', opp.stage], ['Responsável', opp.owner], ['Valor', money(opp.value, opp.currency)], ['Próxima atividade', opp.next_activity ? `${opp.next_activity.title} · ${fmt(opp.next_activity.due_at)}` : ''], ['Última atividade', fmt(opp.last_activity_at)]] : [['Oportunidade', 'Nenhuma oportunidade vinculada']])}${section('Aluno', student ? [['Status', student.status], ['Professor', student.teacher], ['Plano/produto', student.product], ['Ciclo de vida', student.lifecycle], ['Início', fmt(student.started_at)], ['Último dia ativo', student.last_active_date]] : [['Cadastro', 'Nenhum aluno vinculado']])}${section('Acompanhamento', [['Saúde e risco de churn', 'Não disponível nesta conversa'], ['Aulas e atividades', 'Consulte o cadastro do aluno']])}`;
    const financeContent = `${section('Plano', [['Plano/produto', student?.product || 'Não informado']])}${section('Financeiro', [['Situação financeira', 'Não disponível nesta conversa']])}<p class="ai-mini">Consulte o cadastro para visualizar as informações financeiras disponíveis.</p>${actions.open_student_url ? `<a class="ai-action" href="${esc(actions.open_student_url)}">Abrir aluno</a>` : ''}`;
    return `<aside class="ai-pane ai-pane--contact" aria-label="Perfil da pessoa"><div class="ai-contact"><div class="ai-inspector-heading">Contexto da pessoa<button class="ai-icon" data-ai-toggle-contact aria-label="Recolher perfil" title="Recolher perfil">${icon('panel')}</button></div><div class="ai-profile">${avatar({ ...contact, name: person?.name || contact.name, avatar_url: person?.avatar_url || contact.avatar_url })}<h2 class="ai-contact-name">${esc(person?.name || contact.name || contact.phone || 'Contato')}</h2><p class="ai-mini">${esc(contact.relationship || (student ? 'Aluno' : opp ? 'Lead' : 'Contato Space'))}</p></div><div class="ai-context-tabs" role="tablist" aria-label="Contexto">${[['person','Pessoa'],['journey','Jornada'],['finance','Financeiro']].map(([key,title]) => `<button id="ai-tab-${key}" class="ai-chip ${ui.tab === key ? 'is-active' : ''}" data-ai-tab="${key}" role="tab" aria-selected="${ui.tab === key}" aria-controls="ai-context">${title}</button>`).join('')}</div><div class="ai-context-content" id="ai-context" role="tabpanel" aria-labelledby="ai-tab-${ui.tab}">${ui.tab === 'person' ? personContent : ui.tab === 'journey' ? journeyContent : financeContent}</div></div></aside>`;
  }
  function renderViewer() {
    return state.viewer ? `<div class="ai-viewer" data-ai-viewer-close><img src="${esc(state.viewer)}" alt=""><button type="button" data-ai-viewer-close>×</button></div>` : '';
  }
  function nodeKey(node) {
    if (node.nodeType !== 1) return '';
    for (const attr of ['data-ai-select', 'data-ai-message-id', 'data-ai-accordion', 'data-ai-tab', 'data-ai-op']) {
      if (node.getAttribute(attr)) return `${attr}:${node.getAttribute(attr)}`;
    }
    if (node.matches('.ai-day')) return `day:${node.textContent}`;
    return node.id || '';
  }
  function reconcile(parent, desired) {
    const old = [...parent.childNodes];
    const keyed = new Map(old.filter(n => nodeKey(n)).map(n => [nodeKey(n), n]));
    const used = new Set();
    let cursor = parent.firstChild;
    for (const next of [...desired.childNodes]) {
      const key = nodeKey(next);
      let current = key ? keyed.get(key) : old.find(n => !used.has(n) && !nodeKey(n) && n.nodeType === next.nodeType && n.nodeName === next.nodeName);
      if (!current || current.nodeName !== next.nodeName) current = next.cloneNode(true);
      else if (current.nodeType === 3) {
        if (current.nodeValue !== next.nodeValue) current.nodeValue = next.nodeValue;
      } else if (current.nodeType === 1) {
        const disclosure = current.tagName === 'DETAILS';
        const keepComposerHeight = current.tagName === 'TEXTAREA' && current.value === next.value;
        for (const attr of [...current.attributes]) if (!next.hasAttribute(attr.name) && !(disclosure && attr.name === 'open') && !(keepComposerHeight && attr.name === 'style')) current.removeAttribute(attr.name);
        for (const attr of [...next.attributes]) if (!(disclosure && attr.name === 'open') && current.getAttribute(attr.name) !== attr.value) current.setAttribute(attr.name, attr.value);
        if (current.tagName === 'TEXTAREA') {
          if (current.value !== next.value) current.value = next.value;
        } else if (current.tagName === 'INPUT') {
          if (current !== document.activeElement && current.value !== next.value) current.value = next.value;
        } else if (!['AUDIO', 'VIDEO', 'IMG'].includes(current.tagName)) reconcile(current, next);
      }
      used.add(current);
      if (current !== cursor) parent.insertBefore(current, cursor);
      cursor = current.nextSibling;
    }
    for (const node of old) if (!used.has(node)) node.remove();
  }
  function render() {
    const scroll = root.querySelector('[data-ai-messages]');
    const scrollTop = scroll?.scrollTop;
    const keepScroll = scroll && scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight > 80;
    const template = document.createElement('template');
    template.innerHTML = `<div class="ai"><div class="ai-shell"><header class="ai-head"><div class="ai-toolbar-title"><button class="ai-icon" data-ai-toggle-list title="${ui.listHidden ? 'Mostrar' : 'Recolher'} conversas" aria-label="${ui.listHidden ? 'Mostrar' : 'Recolher'} conversas" aria-expanded="${!ui.listHidden}">${icon('panel')}</button><h1 class="ai-title">Caixa de entrada</h1><span class="ai-count" title="Conversas nesta lista">${state.rows.length}</span></div><div class="ai-actions"><span class="ai-indicator">${state.rows.reduce((n,row) => n + (Number(row.unread_count) || 0),0)} não lidas</span><button class="ai-refresh" data-ai-refresh title="Atualizar conversas">${icon('refresh')} Atualizar</button></div></header>${state.error && !state.hasLoaded ? `<div class="ai-error" role="alert"><p>${esc(state.error)}</p><button class="ai-refresh" data-ai-refresh>Tentar novamente</button></div>` : `<div class="ai-grid ${!state.selectedConversationId || ui.contactHidden ? 'is-no-contact' : ''} ${ui.listHidden ? 'is-list-collapsed' : ''} ${state.selectedConversationId ? 'has-selection' : ''}"><section class="ai-pane ai-conversations" aria-label="Lista de conversas"><div class="ai-list-head"><label class="ai-search-wrap">${icon('search')}<input class="ai-input" data-ai-search aria-label="Buscar pessoa ou telefone" placeholder="Buscar conversas" value="${esc(state.q)}"></label><div class="ai-row"><select class="ai-select" data-ai-team aria-label="Time"><option value="">Todos os times</option>${state.teams.map(t => `<option value="${esc(t.team_id)}" ${state.team_id === t.team_id ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select><details class="ai-filter-pop"><summary class="ai-icon" title="Mais filtros" aria-label="Mais filtros">${icon('filter')}${state.filter === 'unassigned' ? '<span class="ai-badge">1</span>' : ''}</summary><div class="ai-popover"><button class="ai-chip ${state.filter === 'unassigned' ? 'is-active' : ''}" data-ai-filter="unassigned">Sem responsável</button><button class="ai-chip" data-ai-filter="all">Limpar filtro</button></div></details></div><nav class="ai-filters" aria-label="Filtrar conversas">${['all','mine','unread'].map(f => `<button class="ai-chip ${state.filter === f ? 'is-active' : ''}" aria-pressed="${state.filter === f}" data-ai-filter="${f}">${esc({all:'Todas',mine:'Minhas',unread:'Não lidas'}[f])}</button>`).join('')}</nav></div>${renderList()}</section>${renderChat()}${state.selectedConversationId && !ui.contactHidden ? renderContact() : ''}</div>`}</div>${renderViewer()}</div>`;
    for (const selector of ['.ai-chat', '.ai-chat-head', '.ai-messages', '.ai-pane--contact']) {
      const node = template.content.querySelector(selector);
      if (node) node.dataset.conversationId = state.selectedConversationId;
    }
    reconcile(root, template.content);
    wireMedia();
    const messages = root.querySelector('[data-ai-messages]');
    if (messages) messages.scrollTop = keepScroll ? scrollTop : messages.scrollHeight;
  }
  async function postAction(action, extra = {}, options = {}) {
    const id = options.conversationId || state.selectedConversationId;
    if (!id) return null;
    const operational = ['assign', 'unassign', 'resolve', 'reopen', 'transfer'].includes(action);
    const body = operational ? { action: 'update', update: action, conversation_id: id, ...extra } : { action, conversation_id: id, ...extra };
    const response = await fetchWithAuth('/api/attendance-inbox', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (!options.quiet && state.selectedConversationId === id) { state.composerError = 'Não foi possível concluir a ação.'; render(); }
      trace('inbox_error', id, `action_http_${response.status}`);
      throw new Error('Não foi possível concluir a ação.');
    }
    if (options.refresh !== false) {
      // Invalidate only the acted-on conversation; never follow a changed selection.
      if (state.selectedConversationId === id) await loadDetail(id, { silent: true, force: true });
      else detailsById.delete(id);
      await load({ silent: true });
    }
    return payload;
  }
  function requestWithTimeout(params, controller) {
    const timer = setTimeout(() => controller.abort(), 20000);
    // Race abort explicitly: auth wrappers may not forward AbortSignal until auth resolves.
    return new Promise((resolve, reject) => {
      const abort = () => reject(new DOMException('Request cancelled', 'AbortError'));
      controller.signal.addEventListener('abort', abort, { once: true });
      api(params, controller.signal).then(resolve, reject).finally(() => controller.signal.removeEventListener('abort', abort));
    }).finally(() => clearTimeout(timer));
  }
  function load({ silent = false } = {}) {
    const params = { q: state.q, filter: state.filter, team_id: state.team_id, limit: 50 };
    const key = JSON.stringify(params);
    if (listRequest?.key === key) return listRequest.promise;
    listRequest?.controller.abort();
    const version = ++listVersion, controller = new AbortController();
    const request = { key, controller };
    listRequest = request;
    state.isFetching = true;
    state.loading = !state.hasLoaded;
    if (state.loading) { state.error = ''; render(); }
    trace('conversation_list_refetch_started');
    request.promise = (async () => {
      try {
        const payload = await requestWithTimeout(params, controller);
        if (version !== listVersion) return;
        if (!Array.isArray(payload.rows)) throw new Error('invalid_list');
        const seen = new Set();
        state.rows = payload.rows.filter(row => typeof row.conversation_id === 'string' && row.conversation_id && !seen.has(row.conversation_id) && seen.add(row.conversation_id));
        state.rows.forEach(row => rowsById.set(row.conversation_id, row));
        // A refresh/filter/ordering change cannot evict the selected identity.
        const selected = rowsById.get(state.selectedConversationId);
        if (selected && !seen.has(state.selectedConversationId)) state.rows.unshift(selected);
        state.teams = Array.isArray(payload.teams) ? payload.teams : state.teams;
        state.hasLoaded = true; state.error = '';
        trace('conversation_list_refetch_finished');
      } catch (error) {
        if (version !== listVersion) return;
        trace('inbox_error', state.selectedConversationId, error.name === 'AbortError' ? 'list_timeout' : 'list_failed');
        if (!state.hasLoaded) state.error = 'Caixa de entrada indisponível.';
      } finally {
        if (version === listVersion) { listRequest = null; state.isFetching = false; state.loading = false; render(); }
      }
    })();
    return request.promise;
  }
  function loadDetail(id, { silent = false, force = false } = {}) {
    if (!silent) { trace('conversation_clicked', id); selectConversation(id); state.menuOpen = false; render(); }
    if (id !== state.selectedConversationId) return Promise.resolve();
    if (detailRequest?.id === id && !force) return detailRequest.promise;
    detailRequest?.controller.abort();
    const version = ++detailVersion, controller = new AbortController();
    const request = { id, controller }; detailRequest = request;
    const current = () => version === detailVersion && id === state.selectedConversationId;
    trace('messages_request_started', id); trace('contact_request_started', id);
    request.promise = (async () => {
      try {
        const payload = await requestWithTimeout({ conversation_id: id, limit: 100 }, controller);
        if (!current()) { trace('response_discarded', id); return; }
        if (payload.conversation?.conversation_id !== id) throw new Error('identity_mismatch');
        // Contact, context and messages arrive in the same response and commit atomically.
        detailsById.set(id, payload);
        state.detailLoading = false; state.composerError = '';
        trace('messages_request_finished', id); trace('contact_request_finished', id);
        render();
        const sequence = Math.max(0, ...(payload.messages || []).map(msg => Number(msg.sequence) || 0));
        if (sequence > (readSequences.get(id) || 0) && !pendingReads.has(id)) {
          // A slow read acknowledgement must not stall GET refreshes or follow a new selection.
          const acknowledgement = postAction('read', { sequence }, { conversationId: id, refresh: false, quiet: true })
            .then(() => {
              readSequences.set(id, sequence);
              const latest = Math.max(0, ...(detailsById.get(id)?.messages || []).map(msg => Number(msg.sequence) || 0));
              if (id === state.selectedConversationId && latest <= sequence) {
                state.rows = state.rows.map(row => row.conversation_id === id ? { ...row, unread_count: 0 } : row); render();
              }
            })
            .catch(() => trace('inbox_error', id, 'read_failed'))
            .finally(() => pendingReads.delete(id));
          pendingReads.set(id, acknowledgement);
        }
      } catch (error) {
        if (!current()) return;
        trace('inbox_error', id, error.message === 'identity_mismatch' ? 'identity_mismatch' : error.name === 'AbortError' ? 'detail_timeout' : 'detail_failed');
        if (!detailsById.has(id)) state.composerError = 'Não foi possível carregar esta conversa. Tente atualizar.';
      } finally {
        if (current()) { detailRequest = null; state.detailLoading = false; render(); }
      }
    })();
    return request.promise;
  }
  async function sendMessage() {
    const id = state.selectedConversationId;
    const text = String(drafts.get(id) || '').trim();
    if (!text || !id || !canSend()) return;
    state.sending = true; state.composerError = ''; render();
    try {
      await postAction('message', { text, client_request_id: crypto.randomUUID() }, { conversationId: id });
      if ((drafts.get(id) || '').trim() === text) drafts.delete(id);
    } catch (error) {
      if (state.selectedConversationId === id) state.composerError = error.message;
    } finally { state.sending = false; render(); }
  }
  async function runOperationalAction(action) {
    const id = state.selectedConversationId;
    if (!id || state.actioning) return;
    state.actioning = action; state.menuOpen = false; state.composerError = ''; render();
    try { await postAction(action, {}, { conversationId: id }); }
    catch (error) { if (state.selectedConversationId === id) state.composerError = error.message; }
    finally { state.actioning = ''; render(); }
  }
  async function refresh() {
    const id = state.selectedConversationId;
    await Promise.all([load({ silent: true }), id ? loadDetail(id, { silent: true }) : Promise.resolve()]);
  }
  function startPoll() {
    clearTimeout(poll);
    poll = setTimeout(async () => {
      if (!root.isConnected) { started = false; return; }
      const panel = root.closest('[data-panel]');
      if (!document.hidden && !panel?.hidden && !pollRunning) {
        pollRunning = true;
        try { await refresh(); } finally { pollRunning = false; }
      }
      startPoll();
    }, 7000);
  }
  async function open() {
    if (started) return listRequest?.promise;
    started = true;
    await load(); startPoll();
  }

  function wireMedia() {
    root.querySelectorAll('[data-ai-audio]').forEach(wrapper => {
      const id = wrapper.getAttribute('data-ai-audio');
      const audio = wrapper.querySelector('audio');
      if (wiredMedia.has(audio)) return;
      wiredMedia.add(audio);
      const item = audioState(id);
      audio.currentTime = item.current || 0;
      audio.onloadedmetadata = () => { item.duration = audio.duration || 0; const time = wrapper.querySelector('.ai-audio-time'); if (time) time.textContent = fmtDuration(item.duration); };
      audio.ontimeupdate = () => { item.current = audio.currentTime || 0; const fill = wrapper.querySelector('.ai-audio-fill'); if (fill && item.duration) fill.style.width = `${Math.min(100, item.current / item.duration * 100)}%`; const time = wrapper.querySelector('.ai-audio-time'); if (time) time.textContent = fmtDuration(item.duration || item.current); };
      audio.onplay = () => { item.playing = true; };
      audio.onpause = () => { item.playing = false; };
      audio.onerror = () => { item.error = true; render(); };
    });
  }
  async function toggleAudio(id) {
    const wrapper = root.querySelector(`[data-ai-audio="${CSS.escape(id)}"]`);
    const audio = wrapper?.querySelector('audio');
    if (!audio) return;
    const item = audioState(id);
    try {
      if (audio.paused) {
        root.querySelectorAll('[data-ai-audio] audio').forEach(other => { if (other !== audio) other.pause(); });
        item.loading = true;
        await audio.play();
        item.loading = false; item.playing = true;
      } else {
        audio.pause(); item.playing = false;
      }
    } catch {
      item.error = true;
    }
    const button = wrapper.querySelector('[data-ai-audio-toggle]');
    if (button) { button.textContent = item.playing ? 'II' : '▶'; button.setAttribute('aria-label', item.playing ? 'Pausar áudio' : 'Reproduzir áudio'); }
  }
  function seekAudio(id, event) {
    const wrapper = root.querySelector(`[data-ai-audio="${CSS.escape(id)}"]`);
    const audio = wrapper?.querySelector('audio');
    const track = event.target.closest('[data-ai-audio-seek]');
    if (!audio || !track || !audio.duration) return;
    const box = track.getBoundingClientRect();
    audio.currentTime = Math.max(0, Math.min(1, (event.clientX - box.left) / box.width)) * audio.duration;
  }

  root.addEventListener('click', event => {
    const viewerClose = event.target.closest('[data-ai-viewer-close]');
    if (viewerClose) { state.viewer = null; return render(); }
    const audioToggle = event.target.closest('[data-ai-audio-toggle]');
    if (audioToggle) return toggleAudio(audioToggle.getAttribute('data-ai-audio-toggle'));
    const audioSeek = event.target.closest('[data-ai-audio-seek]');
    if (audioSeek) return seekAudio(audioSeek.getAttribute('data-ai-audio-seek'), event);
    const mediaViewer = event.target.closest('[data-ai-viewer]');
    if (mediaViewer) { state.viewer = mediaViewer.getAttribute('data-ai-viewer'); return render(); }
    const button = event.target.closest('button');
    if (!button) return;
    if (button.hasAttribute('data-ai-send')) return sendMessage();
    if (button.hasAttribute('data-ai-toggle-contact')) { ui.contactHidden = !ui.contactHidden; return render(); }
    if (button.hasAttribute('data-ai-toggle-list')) { ui.listHidden = !ui.listHidden; return render(); }
    if (button.hasAttribute('data-ai-back')) { selectConversation(''); return render(); }
    const tab = button.getAttribute('data-ai-tab'); if (tab) { ui.tab = tab; render(); root.querySelector(`[data-ai-tab="${tab}"]`)?.focus(); return; }
    if (button.hasAttribute('data-ai-refresh')) return refresh();
    if (button.hasAttribute('data-ai-menu-toggle')) { state.menuOpen = !state.menuOpen; return render(); }
    const op = button.getAttribute('data-ai-op'); if (op) return runOperationalAction(op);
    if (button.hasAttribute('data-ai-create-opportunity')) return postAction('create_opportunity').catch(() => {});
    if (button.hasAttribute('data-ai-unlink') && confirm('Remover o vínculo desta pessoa com a conversa?')) return postAction('unlink_person').catch(() => {});
    const personId = button.getAttribute('data-ai-link-person'); if (personId) return postAction('link_person', { person_id: personId }).catch(() => {});
    const filter = button.getAttribute('data-ai-filter');
    if (filter) { state.filter = filter; return load(); }
    const id = button.getAttribute('data-ai-select');
    if (id) return loadDetail(id);
  });
  root.addEventListener('submit', event => {
    if (event.target.matches('[data-ai-composer]')) { event.preventDefault(); sendMessage(); }
  });
  root.addEventListener('toggle', event => { if (event.target.matches('[data-ai-accordion]')) ui.accordions[event.target.dataset.aiAccordion] = event.target.open; }, true);
  root.addEventListener('change', event => {
    if (event.target.matches('[data-ai-team]')) { state.team_id = event.target.value; load(); }
  });
  root.addEventListener('error', event => {
    if (event.target.matches?.('[data-ai-avatar]')) event.target.remove();
    if (event.target.matches?.('[data-ai-media-img]')) {
      const wrap = event.target.closest('.ai-image-wrap');
      if (wrap) wrap.outerHTML = '<div class="ai-unavailable">Imagem indisponível</div>';
    }
  }, true);
  root.addEventListener('input', event => {
    if (event.target.matches('[data-ai-compose]') && state.selectedConversationId) {
      drafts.set(state.selectedConversationId, event.target.value);
      event.target.style.height = '38px';
      event.target.style.height = `${Math.min(event.target.scrollHeight, 116)}px`;
      state.composerError = '';
      const send = root.querySelector('[data-ai-send]');
      if (send) { send.disabled = !canSend(); send.classList.toggle('is-active', canSend()); }
      const error = root.querySelector('.ai-form-error');
      if (error) error.remove();
    }
    if (event.target.matches('[data-ai-search]')) { state.q = event.target.value; clearTimeout(root._aiSearch); root._aiSearch = setTimeout(() => load(), 260); }
  });
  root.addEventListener('keydown', event => {
    if (event.target.matches('[data-ai-compose]') && event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendMessage(); }
    if (event.key === 'Escape' && (state.menuOpen || state.viewer)) { state.menuOpen = false; state.viewer = null; render(); }
  });
  root.addEventListener('scroll', event => {
    if (event.target.matches?.('[data-ai-messages]')) {
      const el = event.target;
      el.dataset.userScrolled = el.scrollHeight - el.scrollTop - el.clientHeight > 80 ? '1' : '';
    }
  }, true);

  window.SpaceAttendanceInbox = { open, getDiagnostics: () => diagnosticErrors.map(item => ({ ...item })) };
  if (document.body.dataset.initialPanel === 'attendance-inbox') open();
})();
