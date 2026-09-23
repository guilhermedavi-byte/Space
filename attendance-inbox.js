(() => {
  const root = document.querySelector('[data-attendance-inbox]');
  if (!root) return;

  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const dateOf = value => { const d = value ? new Date(value) : null; return d && Number.isFinite(d.getTime()) ? d : null; };
  const sameDay = (a, b) => a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const fmtTime = value => {
    const d = dateOf(value);
    return d ? d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
  };
  const fmtShort = value => {
    const d = dateOf(value);
    return d ? d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
  };
  const relative = value => {
    const d = dateOf(value);
    if (!d) return '';
    const minutes = Math.max(0, Math.floor((Date.now() - d.getTime()) / 60000));
    if (minutes < 1) return 'agora';
    if (minutes < 60) return `${minutes} min`;
    if (minutes < 1440 && sameDay(d, new Date())) return `${Math.floor(minutes / 60)} h`;
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  };
  const dayLabel = value => {
    const d = dateOf(value);
    if (!d) return '';
    const today = new Date();
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
    if (sameDay(d, today)) return 'Hoje';
    if (sameDay(d, yesterday)) return 'Ontem';
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' });
  };
  const money = (value, currency = 'BRL') => value == null ? '' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(Number(value) || 0);
  const statusLabel = value => ({ open: 'Em atendimento', pending: 'Aguardando', resolved: 'Resolvida', closed: 'Resolvida' }[value] || value || '');
  const transportLabel = value => ({ pending: 'Aguardando', sending: 'Enviando', accepted: 'Enviada', sent: 'Enviada', delivered: 'Entregue', read: 'Lida', failed: 'Falhou', received: 'Recebida', internal: 'Interna' }[value] || '');
  const transportMark = value => ({ pending: '...', sending: '...', accepted: '✓', sent: '✓', delivered: '✓✓', read: '✓✓', failed: '!' }[value] || '');
  const mediaText = kind => ({ audio: 'Audio', image: 'Foto', video: 'Video', document: 'Documento', sticker: 'Sticker', location: 'Localização', contact: 'Contato' }[kind] || 'Mensagem');
  const previewText = msg => msg?.text || msg?.content?.text || msg?.content?.body || mediaText(msg?.kind);
  const titleFor = row => row?.contact?.name || row?.contact?.phone || 'Contato sem nome';
  const initials = value => String(value || '?').trim().split(/\s+/).slice(0, 2).map(part => Array.from(part)[0] || '').join('').toUpperCase() || '?';
  const safeUrl = value => {
    try { const url = new URL(String(value || '')); return url.protocol === 'https:' && !url.username && !url.password ? url.href : ''; }
    catch { return ''; }
  };
  const avatar = (contact, size = 'sm') => {
    const name = contact?.name || contact?.phone || 'Contato';
    const url = safeUrl(contact?.photo_url || contact?.avatar_url || contact?.avatar?.url || contact?.whatsapp_avatar_url);
    return `<span class="ai-avatar ai-avatar--${esc(size)}" aria-label="${esc(name)}"><span>${esc(initials(name))}</span>${url ? `<img src="${esc(url)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" data-ai-avatar>` : ''}</span>`;
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
  const state = {
    rows: [], teams: [], selected: '', detail: null, loading: false, detailLoading: false,
    sending: false, actioning: '', error: '', composerError: '', q: '', filter: 'all',
    team_id: '', menuOpen: false, viewer: null, media: new Map(),
  };
  const drafts = new Map();
  let poll = null;

  const style = document.createElement('style');
  style.textContent = `
.ai{height:calc(100vh - 28px);min-height:680px;padding:14px;color:#eef5fb;background:#0a141e}.ai *{box-sizing:border-box}.ai button,.ai input,.ai textarea,.ai select{font:inherit}.ai-shell{height:100%;display:grid;grid-template-rows:auto 1fr;overflow:hidden;border:1px solid rgba(255,255,255,.075);border-radius:14px;background:#0e1b27}.ai-head{min-height:58px;padding:10px 14px;display:flex;align-items:center;justify-content:space-between;gap:16px;border-bottom:1px solid rgba(255,255,255,.07);background:#101f2c}.ai-kicker{margin:0 0 2px;color:rgba(157,187,209,.72);font-size:10px;font-weight:800;letter-spacing:.14em;text-transform:uppercase}.ai-title{margin:0;font-size:1.12rem;line-height:1.15;font-weight:760}.ai-sub{margin:3px 0 0;color:rgba(238,245,251,.5);font-size:.76rem}.ai-grid{min-height:0;display:grid;grid-template-columns:348px minmax(420px,1fr) 326px}.ai-pane{min-width:0;min-height:0;overflow:hidden;background:#0e1b27}.ai-list-pane{border-right:1px solid rgba(255,255,255,.07)}.ai-context-pane{border-left:1px solid rgba(255,255,255,.07)}.ai-refresh,.ai-chip,.ai-send,.ai-icon-btn,.ai-primary,.ai-menu-item,.ai-link-btn,.ai-candidate{appearance:none;border:0;color:inherit;background:transparent;cursor:pointer}.ai-refresh{height:30px;padding:0 10px;border:1px solid rgba(255,255,255,.08);border-radius:8px;color:rgba(238,245,251,.68);font-size:.74rem;font-weight:650}.ai-refresh:hover{background:rgba(255,255,255,.055);color:#fff}.ai-scroll{scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.14) transparent}.ai-scroll::-webkit-scrollbar{width:7px;height:7px}.ai-scroll::-webkit-scrollbar-track{background:transparent}.ai-scroll::-webkit-scrollbar-thumb{background:rgba(255,255,255,.12);border-radius:999px}.ai-scroll::-webkit-scrollbar-thumb:hover{background:rgba(255,255,255,.22)}.ai-list-head{padding:10px 10px 8px;border-bottom:1px solid rgba(255,255,255,.065);display:grid;gap:8px}.ai-input,.ai-select{width:100%;height:34px;border:1px solid rgba(255,255,255,.08);border-radius:8px;background:#0b1722;color:#eef5fb;padding:0 10px;outline:0;font-size:.8rem}.ai-input:focus,.ai-select:focus{border-color:rgba(255,106,96,.44);box-shadow:0 0 0 2px rgba(255,106,96,.08)}.ai-list-tools{display:grid;grid-template-columns:1fr 126px;gap:7px}.ai-filters{display:flex;gap:5px;overflow:auto;padding-bottom:1px}.ai-chip{height:26px;flex:0 0 auto;padding:0 8px;border-radius:999px;color:rgba(238,245,251,.56);font-size:.68rem;font-weight:700}.ai-chip:hover{background:rgba(255,255,255,.045);color:#fff}.ai-chip.is-active{background:rgba(255,106,96,.13);color:#ffd6d2}.ai-list{height:100%;overflow:auto;padding:5px}.ai-item{position:relative;width:100%;height:76px;border:0;border-radius:9px;background:transparent;color:#eef5fb;text-align:left;padding:8px 8px 8px 10px;display:grid;grid-template-columns:40px 1fr;gap:9px;align-items:center;cursor:pointer}.ai-item:before{content:"";position:absolute;left:0;top:10px;bottom:10px;width:2px;border-radius:999px;background:transparent}.ai-item:hover{background:rgba(255,255,255,.035)}.ai-item.is-active{background:rgba(255,255,255,.065)}.ai-item.is-active:before{background:#ff6a60}.ai-item-body{min-width:0;display:grid;gap:4px}.ai-item-top,.ai-item-meta,.ai-row{display:flex;align-items:center;justify-content:space-between;gap:8px;min-width:0}.ai-name{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:.88rem;font-weight:760}.ai-time{flex:0 0 auto;color:rgba(238,245,251,.42);font-size:.68rem}.ai-snippet{margin:0;color:rgba(238,245,251,.58);font-size:.76rem;line-height:1.22;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ai-meta{min-width:0;color:rgba(238,245,251,.42);font-size:.68rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ai-dot{display:inline-block;width:5px;height:5px;margin:0 5px 1px;border-radius:50%;background:#25d366}.ai-badge{flex:0 0 auto;min-width:17px;height:17px;padding:0 5px;border-radius:999px;background:#ff6a60;color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:.64rem;font-weight:800}.ai-avatar{position:relative;display:inline-grid;place-items:center;flex:0 0 auto;border-radius:50%;overflow:hidden;background:#27394a;color:#eaf2f8;font-weight:760}.ai-avatar span{position:relative;z-index:1}.ai-avatar img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:2}.ai-avatar--sm{width:38px;height:38px;font-size:.72rem}.ai-avatar--xs{width:36px;height:36px;font-size:.7rem}.ai-avatar--lg{width:54px;height:54px;font-size:.98rem}.ai-chat{height:100%;display:grid;grid-template-rows:auto 1fr auto;background:#0b1722}.ai-chat-empty{height:100%;display:grid;place-items:center;padding:28px;text-align:center;color:rgba(238,245,251,.56)}.ai-chat-empty strong{display:block;margin-bottom:6px;color:#eef5fb;font-size:1rem}.ai-chat-head{min-height:58px;padding:10px 14px;border-bottom:1px solid rgba(255,255,255,.07);display:flex;align-items:center;justify-content:space-between;gap:12px;background:#0f1d29}.ai-chat-person{display:flex;align-items:center;gap:10px;min-width:0}.ai-chat-name{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:.94rem;font-weight:760}.ai-chat-sub{margin:2px 0 0;color:rgba(238,245,251,.47);font-size:.72rem}.ai-status{display:inline-flex;height:25px;align-items:center;border-radius:999px;padding:0 9px;background:rgba(255,255,255,.055);color:rgba(238,245,251,.66);font-size:.68rem;font-weight:700}.ai-head-actions{position:relative;display:flex;align-items:center;gap:7px}.ai-primary{height:30px;padding:0 11px;border-radius:8px;background:#ff6a60;color:#fff;font-size:.74rem;font-weight:760}.ai-primary:hover{background:#ff7a71}.ai-icon-btn{width:30px;height:30px;border-radius:8px;color:rgba(238,245,251,.7);font-size:1rem;line-height:1}.ai-icon-btn:hover{background:rgba(255,255,255,.065);color:#fff}.ai-menu{position:absolute;right:0;top:36px;z-index:20;width:190px;padding:6px;border:1px solid rgba(255,255,255,.09);border-radius:10px;background:#132433;box-shadow:0 18px 40px rgba(0,0,0,.35)}.ai-menu-item{width:100%;height:32px;border-radius:7px;padding:0 9px;text-align:left;color:rgba(238,245,251,.8);font-size:.75rem}.ai-menu-item:hover{background:rgba(255,255,255,.065);color:#fff}.ai-menu-item.is-danger{color:#ffaaa5}.ai-messages{height:100%;overflow:auto;padding:14px 18px 18px;display:flex;flex-direction:column;gap:7px;background:#0b1722}.ai-day{align-self:center;margin:7px 0 5px;padding:3px 8px;border-radius:999px;background:rgba(255,255,255,.055);color:rgba(238,245,251,.5);font-size:.66rem;font-weight:700}.ai-msg{max-width:68%;border-radius:13px;padding:8px 10px 6px;font-size:.84rem;line-height:1.42;white-space:pre-wrap;word-break:break-word}.ai-msg.inbound{align-self:flex-start;border-top-left-radius:5px;background:#132331;color:#eef5fb}.ai-msg.outbound{align-self:flex-end;border-top-right-radius:5px;background:#183149;color:#eef5fb}.ai-msg.internal{align-self:center;background:rgba(251,191,36,.08);color:#ffe7a6}.ai-msg-time{margin-top:5px;display:flex;justify-content:flex-end;gap:5px;color:rgba(238,245,251,.42);font-size:.64rem;line-height:1}.ai-msg-status.is-read{color:#7fb8ff}.ai-msg-status.is-failed{color:#ffaaa5}.ai-quote{margin-bottom:7px;padding:6px 8px;border-left:2px solid rgba(157,187,209,.45);border-radius:7px;background:rgba(0,0,0,.13);color:rgba(238,245,251,.56);font-size:.72rem}.ai-composer{border-top:1px solid rgba(255,255,255,.07);background:#0f1d29;padding:9px 11px}.ai-composer-inner{display:grid;grid-template-columns:32px 1fr auto;align-items:end;gap:8px}.ai-plus{width:32px;height:32px;border-radius:8px;border:1px solid rgba(255,255,255,.08);display:grid;place-items:center;color:rgba(238,245,251,.58)}.ai-compose{min-height:38px;max-height:116px;width:100%;resize:none;overflow:auto;border:1px solid rgba(255,255,255,.08);border-radius:10px;background:#0b1722;color:#eef5fb;padding:9px 11px;line-height:1.32;outline:0}.ai-compose:focus{border-color:rgba(255,106,96,.42)}.ai-send{height:36px;border-radius:9px;padding:0 13px;background:rgba(255,255,255,.06);color:rgba(238,245,251,.46);font-size:.76rem;font-weight:760}.ai-send.is-active{background:#ff6a60;color:#fff}.ai-send:disabled{cursor:not-allowed}.ai-form-error{margin:6px 40px 0;color:#ffaaa5;font-size:.72rem}.ai-context{height:100%;overflow:auto;padding:14px;background:#0e1b27}.ai-context-empty{height:100%;display:grid;place-items:center;text-align:center;color:rgba(238,245,251,.56);padding:24px}.ai-profile{display:grid;grid-template-columns:54px 1fr;gap:11px;align-items:center;margin-bottom:13px}.ai-profile-name{margin:0;color:#fff;font-size:.96rem;font-weight:760}.ai-profile-phone{margin:3px 0 0;color:rgba(238,245,251,.5);font-size:.74rem}.ai-actions{display:flex;flex-wrap:wrap;gap:7px;margin-bottom:14px}.ai-link-btn,.ai-candidate{min-height:28px;border-radius:8px;background:rgba(255,255,255,.055);color:rgba(238,245,251,.72);padding:0 9px;text-decoration:none;font-size:.72rem;font-weight:700}.ai-link-btn:hover,.ai-candidate:hover{background:rgba(255,255,255,.085);color:#fff}.ai-section{padding:12px 0;border-top:1px solid rgba(255,255,255,.07)}.ai-section-title{margin:0 0 10px;color:rgba(157,187,209,.72);font-size:.66rem;font-weight:800;letter-spacing:.11em;text-transform:uppercase}.ai-field{display:grid;gap:3px;margin:0 0 10px}.ai-field:last-child{margin-bottom:0}.ai-label{color:rgba(238,245,251,.42);font-size:.66rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em}.ai-value{color:rgba(238,245,251,.86);font-size:.79rem;line-height:1.35;word-break:break-word}.ai-muted{color:rgba(238,245,251,.48);font-size:.76rem}.ai-crm-empty{display:grid;gap:9px}.ai-create{justify-self:start;height:28px;border-radius:8px;background:rgba(255,106,96,.12);color:#ffd6d2;padding:0 10px;font-size:.72rem;font-weight:760}.ai-candidate{height:auto;width:100%;text-align:left;padding:8px 9px}.ai-candidate small{display:block;margin-top:3px;color:rgba(238,245,251,.48)}.ai-media{display:grid;gap:7px}.ai-image-wrap{display:block;position:relative;max-width:min(320px,100%);min-height:92px;border-radius:11px;overflow:hidden;background:rgba(255,255,255,.05)}.ai-image-wrap:before{content:"";position:absolute;inset:0;background:linear-gradient(90deg,rgba(255,255,255,.03),rgba(255,255,255,.09),rgba(255,255,255,.03));background-size:220% 100%;animation:ai-shimmer 1.2s infinite}.ai-image-wrap img{position:relative;z-index:1;display:block;width:100%;max-height:330px;object-fit:cover;border-radius:11px}.ai-unavailable{padding:10px 11px;border-radius:10px;background:rgba(255,255,255,.055);color:rgba(238,245,251,.58);font-size:.78rem}.ai-caption{margin:0;color:rgba(238,245,251,.76);font-size:.78rem}.ai-audio{display:grid;grid-template-columns:34px 1fr auto;gap:9px;align-items:center;min-width:min(300px,64vw)}.ai-audio-btn{width:34px;height:34px;border:0;border-radius:50%;background:rgba(255,255,255,.11);color:#fff;cursor:pointer}.ai-audio-track{height:4px;border-radius:999px;background:rgba(255,255,255,.15);overflow:hidden;cursor:pointer}.ai-audio-fill{width:0;height:100%;background:#9dbbd1}.ai-audio-time{color:rgba(238,245,251,.58);font-size:.68rem;font-variant-numeric:tabular-nums}.ai-audio-label{grid-column:2 / 4;color:rgba(238,245,251,.42);font-size:.68rem}.ai-doc{display:flex;align-items:center;gap:9px;min-width:min(300px,64vw);padding:10px;border-radius:10px;background:rgba(255,255,255,.055);color:#fff;text-decoration:none}.ai-doc-icon{width:32px;height:32px;border-radius:8px;display:grid;place-items:center;background:rgba(157,187,209,.14)}.ai-doc small{color:rgba(238,245,251,.48)}.ai-video{width:min(340px,100%);border-radius:11px;background:#07111a}.ai-location{padding:10px;border-radius:10px;background:rgba(255,255,255,.055);color:rgba(238,245,251,.78)}.ai-viewer{position:fixed;inset:0;z-index:1000;background:rgba(3,8,13,.82);display:grid;place-items:center;padding:28px}.ai-viewer img{max-width:min(94vw,1100px);max-height:88vh;border-radius:12px;box-shadow:0 24px 80px rgba(0,0,0,.45)}.ai-viewer button{position:fixed;top:18px;right:18px;width:34px;height:34px;border:0;border-radius:10px;background:rgba(255,255,255,.1);color:#fff;cursor:pointer}.ai-skel{height:66px;border-radius:9px;background:linear-gradient(90deg,rgba(255,255,255,.035),rgba(255,255,255,.08),rgba(255,255,255,.035));background-size:220% 100%;animation:ai-shimmer 1.2s infinite}@keyframes ai-shimmer{to{background-position:-220% 0}}@media(max-width:1180px){.ai-grid{grid-template-columns:328px minmax(400px,1fr)}.ai-context-pane{display:none}}@media(max-width:780px){.ai{height:auto;min-height:100vh;padding:8px}.ai-grid{grid-template-columns:1fr;height:auto}.ai-list-pane{border-right:0;border-bottom:1px solid rgba(255,255,255,.07)}.ai-list{max-height:430px}.ai-chat{min-height:560px}.ai-msg{max-width:86%}.ai-head{align-items:flex-start}.ai-sub{display:none}}`;
  document.head.append(style);

  const api = async (params = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => { if (value != null && String(value).trim()) query.set(key, String(value).trim()); });
    const response = await fetchWithAuth(`/api/attendance-inbox${query.size ? `?${query}` : ''}`);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(response.status === 403 ? 'Você não tem permissão para acessar estas conversas.' : 'Caixa de entrada indisponível.');
    return payload;
  };

  function field(name, value) {
    if (value == null || value === '') return '';
    return `<div class="ai-field"><span class="ai-label">${esc(name)}</span><span class="ai-value">${esc(value)}</span></div>`;
  }
  function section(title, rows, extra = '') {
    const body = rows.map(([name, value]) => field(name, value)).join('') + extra;
    return body ? `<section class="ai-section"><h3 class="ai-section-title">${esc(title)}</h3>${body}</section>` : '';
  }
  function activeRow() {
    return state.rows.find(row => row.conversation_id === state.selected) || state.detail?.conversation || null;
  }
  function canSend() {
    return Boolean(state.detail?.composer?.enabled && (drafts.get(state.selected) || '').trim() && !state.sending);
  }
  function primaryAction(conv) {
    if (!conv || conv.status === 'resolved') return { key: 'reopen', label: 'Reabrir' };
    if (!conv.assigned_user_uid) return { key: 'assign', label: 'Assumir' };
    return { key: 'resolve', label: 'Resolver' };
  }

  function renderList() {
    if (state.loading) return `<div class="ai-list ai-scroll">${Array.from({ length: 8 }).map(() => '<div class="ai-skel"></div>').join('')}</div>`;
    if (!state.rows.length) return '<div class="ai-chat-empty"><div><strong>Nenhuma conversa encontrada</strong><span>As conversas reais aparecerão aqui.</span></div></div>';
    return `<div class="ai-list ai-scroll">${state.rows.map(row => {
      const meta = ['WhatsApp', row.assigned_user_uid || 'Sem responsável'].filter(Boolean).join(' · ');
      return `<button class="ai-item ${row.conversation_id === state.selected ? 'is-active' : ''}" type="button" data-ai-select="${esc(row.conversation_id)}">
        ${avatar(row.contact, 'sm')}
        <span class="ai-item-body">
          <span class="ai-item-top"><strong class="ai-name">${esc(titleFor(row))}</strong><span class="ai-time">${esc(relative(row.last_message_at || row.updated_at))}</span></span>
          <span class="ai-snippet">${esc(previewText(row.last_message))}</span>
          <span class="ai-item-meta"><span class="ai-meta"><span class="ai-dot"></span>${esc(meta)}</span>${row.unread_count ? `<span class="ai-badge">${esc(row.unread_count)}</span>` : ''}</span>
        </span>
      </button>`;
    }).join('')}</div>`;
  }

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
      <button class="ai-audio-btn" type="button" data-ai-audio-toggle="${esc(msg.message_id)}">${item.loading ? '...' : item.playing ? 'II' : '▶'}</button>
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
    return `<div>${esc(previewText(msg))}</div>`;
  }
  function renderMessageBody(msg) {
    const mediaKinds = ['audio', 'image', 'video', 'document', 'sticker', 'location', 'contact'];
    return `${renderQuoted(msg)}${mediaKinds.includes(msg.kind) ? renderMedia(msg) : `<div>${esc(previewText(msg))}</div>`}`;
  }
  function renderMessages() {
    if (state.detailLoading) return '<div class="ai-messages ai-scroll"><div class="ai-skel"></div><div class="ai-skel"></div><div class="ai-skel"></div></div>';
    const messages = state.detail?.messages || [];
    if (!messages.length) return '<div class="ai-chat-empty"><div><strong>Sem mensagens</strong><span>As mensagens aparecerão aqui em ordem cronológica.</span></div></div>';
    let last = '';
    return `<div class="ai-messages ai-scroll" data-ai-messages>${messages.map(msg => {
      const when = msg.received_at || msg.provider_timestamp;
      const day = dayLabel(when);
      const sep = day && day !== last ? (last = day, `<div class="ai-day">${esc(day)}</div>`) : '';
      const mark = msg.direction === 'outbound' ? transportMark(msg.transport_status) : '';
      const statusClass = msg.transport_status === 'read' ? 'is-read' : msg.transport_status === 'failed' ? 'is-failed' : '';
      return `${sep}<article class="ai-msg ${esc(msg.direction || 'inbound')}">${renderMessageBody(msg)}<div class="ai-msg-time"><span>${esc(fmtTime(when))}</span>${mark ? `<span class="ai-msg-status ${statusClass}" title="${esc(transportLabel(msg.transport_status))}">${esc(mark)}</span>` : ''}</div></article>`;
    }).join('')}</div>`;
  }

  function renderConversationMenu(conv) {
    if (!state.menuOpen || !conv) return '';
    const resolved = conv.status === 'resolved';
    return `<div class="ai-menu" data-ai-menu>
      ${!resolved ? `<button class="ai-menu-item" data-ai-op="assign">Assumir</button>` : ''}
      ${conv.assigned_user_uid && !resolved ? `<button class="ai-menu-item" data-ai-op="unassign">Remover responsável</button>` : ''}
      ${!resolved ? `<button class="ai-menu-item" data-ai-op="transfer">Transferir</button>` : ''}
      ${!resolved ? `<button class="ai-menu-item is-danger" data-ai-op="resolve">Resolver</button>` : `<button class="ai-menu-item" data-ai-op="reopen">Reabrir</button>`}
    </div>`;
  }
  function renderChat() {
    if (!state.selected) {
      return `<section class="ai-pane ai-chat"><div class="ai-chat-empty"><div><strong>Selecione uma conversa</strong><span>Escolha uma conversa na lista para começar.</span></div></div></section>`;
    }
    const conv = state.detail?.conversation || activeRow() || {};
    const contact = state.detail?.contact || conv.contact || {};
    const composer = state.detail?.composer || { enabled: false, reason: 'Envio indisponível.' };
    const primary = primaryAction(conv);
    return `<section class="ai-pane ai-chat">
      <header class="ai-chat-head">
        <div class="ai-chat-person">${avatar(contact, 'xs')}<span><span class="ai-chat-name">${esc(contact.name || titleFor(conv))}</span><p class="ai-chat-sub">WhatsApp · ${esc(conv.team?.name || 'Atendimento')}</p></span></div>
        <div class="ai-head-actions"><span class="ai-status">${esc(statusLabel(conv.status))}</span><button class="ai-primary" type="button" data-ai-op="${esc(primary.key)}">${esc(primary.label)}</button><button class="ai-icon-btn" type="button" data-ai-menu-toggle aria-label="Mais ações">...</button>${renderConversationMenu(conv)}</div>
      </header>
      ${renderMessages()}
      ${composer.enabled ? `<form class="ai-composer" data-ai-composer><div class="ai-composer-inner"><button class="ai-plus" type="button" aria-label="Anexar" disabled>+</button><textarea class="ai-compose ai-scroll" data-ai-compose rows="1" placeholder="Digite uma mensagem...">${esc(drafts.get(state.selected) || '')}</textarea><button class="ai-send ${canSend() ? 'is-active' : ''}" data-ai-send type="submit" ${canSend() ? '' : 'disabled'}>Enviar</button></div>${state.composerError ? `<p class="ai-form-error">${esc(state.composerError)}</p>` : ''}</form>` : `<div class="ai-composer"><p class="ai-muted">${esc(composer.reason || 'Envio indisponível.')}</p></div>`}
    </section>`;
  }

  function renderContext() {
    if (!state.selected) return '<aside class="ai-pane ai-context-pane"><div class="ai-context-empty"><div><strong>Dados da pessoa</strong><br><span>Selecione uma conversa.</span></div></div></aside>';
    const detail = state.detail || {};
    const contact = detail.contact || {};
    const conv = detail.conversation || {};
    const ctx = detail.context || {};
    const person = ctx.person || {};
    const opp = ctx.crm?.opportunity;
    const student = ctx.student;
    const actions = ctx.actions || {};
    const candidates = ctx.identity?.candidates || [];
    const name = person.name || contact.name || contact.phone || 'Contato';
    const actionHtml = [actions.open_person_url ? `<a class="ai-link-btn" href="${esc(actions.open_person_url)}">Ver pessoa</a>` : '', actions.open_crm_url ? `<a class="ai-link-btn" href="${esc(actions.open_crm_url)}">Abrir CRM</a>` : '', actions.open_student_url ? `<a class="ai-link-btn" href="${esc(actions.open_student_url)}">Abrir aluno</a>` : '', actions.can_unlink_person ? '<button class="ai-link-btn" data-ai-unlink>Remover vínculo</button>' : ''].join('');
    const crmExtra = opp ? '' : `<div class="ai-crm-empty"><p class="ai-muted">Nenhuma oportunidade ativa</p>${actions.can_create_opportunity ? '<button class="ai-create" data-ai-create-opportunity>+ Criar oportunidade</button>' : ''}</div>`;
    const candidatesHtml = candidates.length && !ctx.identity?.linked ? `<section class="ai-section"><h3 class="ai-section-title">Possíveis vínculos</h3>${candidates.map(c => `<button class="ai-candidate" type="button" data-ai-link-person="${esc(c.id)}"><strong>${esc(c.name || c.id)}</strong><small>${esc([c.relation, c.phone, c.email].filter(Boolean).join(' · '))}</small></button>`).join('')}</section>` : '';
    return `<aside class="ai-pane ai-context-pane"><div class="ai-context ai-scroll">
      <div class="ai-profile">${avatar({ ...contact, name, avatar_url: person.avatar_url || contact.avatar_url }, 'lg')}<div><h2 class="ai-profile-name">${esc(name)}</h2><p class="ai-profile-phone">${esc(person.phone || contact.phone || '')}</p></div></div>
      ${actionHtml ? `<div class="ai-actions">${actionHtml}</div>` : ''}
      ${section('Contato', [['Telefone', person.phone || contact.phone], ['Email', person.email || contact.email]])}
      ${section('Atendimento', [['Responsável', conv.assigned_user_uid || 'Não atribuído'], ['Time', conv.team?.name], ['Status', statusLabel(conv.status)]])}
      ${section('CRM', opp ? [['Oportunidade', opp.title || opp.id], ['Etapa', opp.stage], ['Próxima atividade', opp.next_activity ? `${opp.next_activity.title} · ${fmtShort(opp.next_activity.due_at)}` : ''], ['Valor', money(opp.value, opp.currency)]] : [], crmExtra)}
      ${section('Aluno', student ? [['Status', student.status], ['Professor', student.teacher], ['Plano', student.product]] : [])}
      ${candidatesHtml}
    </div></aside>`;
  }

  function renderViewer() {
    return state.viewer ? `<div class="ai-viewer" data-ai-viewer-close><img src="${esc(state.viewer)}" alt=""><button type="button" data-ai-viewer-close>×</button></div>` : '';
  }
  function render() {
    root.innerHTML = `<div class="ai"><div class="ai-shell"><header class="ai-head"><div><p class="ai-kicker">Atendimento</p><h1 class="ai-title">Caixa de entrada</h1><p class="ai-sub">Conversas reais do WhatsApp, com contexto da pessoa.</p></div><button class="ai-refresh" type="button" data-ai-refresh>Atualizar</button></header>${state.error && !state.selected ? `<div class="ai-chat-empty"><div><strong>${esc(state.error)}</strong><span>Tente atualizar em alguns segundos.</span></div></div>` : `<main class="ai-grid"><section class="ai-pane ai-list-pane"><div class="ai-list-head"><input class="ai-input" data-ai-search placeholder="Buscar nome ou telefone" value="${esc(state.q)}"><div class="ai-list-tools"><div class="ai-filters ai-scroll">${['all', 'unread', 'mine', 'unassigned'].map(f => `<button class="ai-chip ${state.filter === f ? 'is-active' : ''}" data-ai-filter="${f}" type="button">${esc({ all: 'Todas', unread: 'Não lidas', mine: 'Minhas', unassigned: 'Sem responsável' }[f])}</button>`).join('')}</div><select class="ai-select" data-ai-team><option value="">Time</option>${state.teams.map(t => `<option value="${esc(t.team_id)}" ${state.team_id === t.team_id ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select></div></div>${renderList()}</section>${renderChat()}${renderContext()}</main>`}</div>${renderViewer()}</div>`;
    wireMedia();
    const messages = root.querySelector('[data-ai-messages]');
    if (messages && !messages.dataset.userScrolled) messages.scrollTop = messages.scrollHeight;
  }

  async function postAction(action, extra = {}, options = {}) {
    if (!state.selected) return null;
    const operational = ['assign', 'unassign', 'resolve', 'reopen', 'transfer'].includes(action);
    const body = operational ? { action: 'update', update: action, conversation_id: state.selected, ...extra } : { action, conversation_id: state.selected, ...extra };
    const response = await fetchWithAuth('/api/attendance-inbox', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = payload.error || 'Não foi possível concluir a ação.';
      if (!options.quiet) { state.composerError = message; render(); }
      throw new Error(message);
    }
    if (options.refresh !== false) { await loadDetail(state.selected, { silent: true }); await load({ silent: true }); }
    return payload;
  }
  async function load({ silent = false } = {}) {
    if (!silent) { state.loading = true; state.error = ''; render(); }
    try {
      const payload = await api({ q: state.q, filter: state.filter, team_id: state.team_id, limit: 50 });
      state.rows = Array.isArray(payload.rows) ? payload.rows : [];
      state.teams = Array.isArray(payload.teams) ? payload.teams : [];
      state.error = '';
      if (state.selected && !state.rows.some(row => row.conversation_id === state.selected)) state.selected = '';
    } catch (error) { state.error = error.message; }
    finally { state.loading = false; render(); }
  }
  async function loadDetail(id, { silent = false } = {}) {
    state.selected = id;
    state.menuOpen = false;
    if (!silent) { state.detailLoading = true; state.error = ''; state.composerError = ''; render(); }
    try {
      state.detail = await api({ conversation_id: id, limit: 100 });
      const sequence = Math.max(0, ...(state.detail.messages || []).map(msg => Number(msg.sequence) || 0));
      if (sequence) {
        await postAction('read', { sequence }, { refresh: false, quiet: true }).catch(() => {});
        state.rows = state.rows.map(row => row.conversation_id === id ? { ...row, unread_count: 0 } : row);
      }
      state.error = '';
    } catch (error) { state.error = error.message; }
    finally { state.detailLoading = false; render(); }
  }
  async function sendMessage() {
    const text = String(drafts.get(state.selected) || '').trim();
    if (!text || !state.selected || state.sending) return;
    state.sending = true; state.composerError = ''; render();
    try {
      await postAction('message', { text, client_request_id: crypto.randomUUID() });
      drafts.delete(state.selected);
    } catch (error) {
      state.composerError = error.message || 'Não foi possível enviar a mensagem.';
    } finally {
      state.sending = false; render();
    }
  }
  async function runOperationalAction(action) {
    if (!state.selected || state.actioning) return;
    state.actioning = action; state.menuOpen = false; state.composerError = ''; render();
    try { await postAction(action); }
    catch (error) { state.composerError = error.message || 'Não foi possível concluir a ação.'; }
    finally { state.actioning = ''; render(); }
  }
  function startPoll() {
    if (poll) clearInterval(poll);
    poll = setInterval(() => {
      if (!root.isConnected) return clearInterval(poll);
      load({ silent: true }).then(() => state.selected ? loadDetail(state.selected, { silent: true }) : null);
    }, 7000);
  }
  async function open() { await load(); startPoll(); }

  function wireMedia() {
    root.querySelectorAll('[data-ai-audio]').forEach(wrapper => {
      const id = wrapper.getAttribute('data-ai-audio');
      const audio = wrapper.querySelector('audio');
      const item = audioState(id);
      audio.currentTime = item.current || 0;
      audio.onloadedmetadata = () => { item.duration = audio.duration || 0; render(); };
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
        item.loading = true; render();
        await audio.play();
        item.loading = false; item.playing = true;
      } else {
        audio.pause(); item.playing = false;
      }
    } catch {
      item.error = true;
    }
    render();
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
    if (button.hasAttribute('data-ai-refresh')) return load();
    if (button.hasAttribute('data-ai-menu-toggle')) { state.menuOpen = !state.menuOpen; return render(); }
    const op = button.getAttribute('data-ai-op'); if (op) return runOperationalAction(op);
    if (button.hasAttribute('data-ai-create-opportunity')) return postAction('create_opportunity');
    if (button.hasAttribute('data-ai-unlink') && confirm('Remover o vínculo desta pessoa com a conversa?')) return postAction('unlink_person');
    const personId = button.getAttribute('data-ai-link-person'); if (personId) return postAction('link_person', { person_id: personId });
    const filter = button.getAttribute('data-ai-filter');
    if (filter) { state.filter = filter; state.selected = ''; state.detail = null; return load(); }
    const id = button.getAttribute('data-ai-select');
    if (id) return loadDetail(id);
  });
  root.addEventListener('submit', event => {
    if (event.target.matches('[data-ai-composer]')) { event.preventDefault(); sendMessage(); }
  });
  root.addEventListener('change', event => {
    if (event.target.matches('[data-ai-team]')) { state.team_id = event.target.value; state.selected = ''; state.detail = null; load(); }
  });
  root.addEventListener('error', event => {
    if (event.target.matches?.('[data-ai-avatar]')) event.target.remove();
    if (event.target.matches?.('[data-ai-media-img]')) {
      const wrap = event.target.closest('.ai-image-wrap');
      if (wrap) wrap.outerHTML = '<div class="ai-unavailable">Imagem indisponível</div>';
    }
  }, true);
  root.addEventListener('input', event => {
    if (event.target.matches('[data-ai-compose]') && state.selected) {
      drafts.set(state.selected, event.target.value);
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

  window.SpaceAttendanceInbox = { open };
  if (document.body.dataset.initialPanel === 'attendance-inbox') open();
})();
