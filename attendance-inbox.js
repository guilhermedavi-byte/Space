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
  const state = { rows: [], teams: [], selected: '', detail: null, loading: false, detailLoading: false, sending: false, actioning: '', error: '', composerError: '', q: '', filter: 'all', team_id: '' };
  const drafts = new Map();
  const style = document.createElement('style');
  style.textContent = `
  .ai{max-width:1440px;margin:0 auto;padding:24px;color:#fff}.ai *{box-sizing:border-box}.ai-shell{min-height:calc(100vh - 90px);border:1px solid rgba(89,144,189,.14);border-radius:16px;background:linear-gradient(160deg,#0b1620,#132436 48%,#0b1620);padding:24px}.ai-head{display:flex;justify-content:space-between;gap:16px;align-items:end;margin-bottom:18px}.ai-kicker{color:#78a8ca;font-size:11px;font-weight:850;letter-spacing:.16em;text-transform:uppercase}.ai-title{margin:4px 0 0;font-size:clamp(1.7rem,3vw,2.25rem);letter-spacing:-.03em}.ai-sub{margin:6px 0 0;color:rgba(255,255,255,.56);font-size:.9rem}.ai-grid{display:grid;grid-template-columns:330px minmax(420px,1fr) 320px;gap:14px;min-height:680px}.ai-pane{overflow:hidden;border:1px solid rgba(255,255,255,.08);border-radius:18px;background:rgba(255,255,255,.045)}.ai-list-head,.ai-chat-head,.ai-composer,.ai-contact{padding:14px}.ai-input,.ai-select,.ai-composer textarea{width:100%;border:1px solid rgba(255,255,255,.11);border-radius:12px;background:rgba(255,255,255,.06);color:#fff;padding:10px;font:inherit}.ai-list-head{display:grid;gap:10px}.ai-filters,.ai-actions{display:flex;gap:8px;flex-wrap:wrap}.ai-chip,.ai-refresh,.ai-send,.ai-action{border:1px solid rgba(255,255,255,.12);border-radius:999px;background:rgba(255,255,255,.06);color:#fff;min-height:32px;padding:7px 11px;font:inherit;font-size:.76rem;font-weight:800;cursor:pointer;text-decoration:none}.ai-chip.is-active,.ai-action:hover,.ai-refresh:hover{background:rgba(255,255,255,.13)}.ai-list{height:590px;overflow:auto;padding:8px}.ai-item{width:100%;border:1px solid transparent;border-radius:14px;background:transparent;color:#fff;text-align:left;padding:12px;display:grid;gap:7px;cursor:pointer}.ai-item:hover,.ai-item.is-active{border-color:rgba(120,168,202,.18);background:rgba(255,255,255,.07)}.ai-row,.ai-item-top,.ai-chat-head,.ai-person{display:flex;justify-content:space-between;align-items:center;gap:10px}.ai-person{justify-content:flex-start;min-width:0}.ai-avatar{position:relative;display:inline-grid;place-items:center;flex:0 0 38px;width:38px;height:38px;border-radius:50%;background:#30485e;color:#fff;overflow:hidden;font-weight:850;font-size:.78rem}.ai-avatar img{position:absolute;width:100%;height:100%;object-fit:cover}.ai-contact>.ai-avatar{width:66px;height:66px;font-size:1.2rem}.ai-name{font-weight:850;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ai-time,.ai-meta,.ai-mini{color:rgba(255,255,255,.54);font-size:.72rem}.ai-snippet{color:rgba(255,255,255,.62);font-size:.82rem;line-height:1.35}.ai-badge{background:rgba(255,106,96,.18);color:#ffaaa5;border-radius:999px;padding:3px 7px;font-size:.68rem;font-weight:850}.ai-chat{display:grid;grid-template-rows:auto 1fr auto}.ai-status{border:1px solid rgba(251,191,36,.22);background:rgba(251,191,36,.1);color:#fbbf24;border-radius:999px;padding:5px 9px;font-size:.72rem;font-weight:850}.ai-messages{padding:18px;overflow:auto;display:flex;flex-direction:column;gap:10px;background:rgba(3,7,13,.18)}.ai-msg{max-width:min(560px,78%);border:1px solid rgba(255,255,255,.08);border-radius:15px;padding:10px 12px;font-size:.88rem;line-height:1.45;background:rgba(255,255,255,.07)}.ai-msg.outbound{align-self:flex-end;background:rgba(89,144,189,.16)}.ai-msg.inbound{align-self:flex-start}.ai-msg.internal{align-self:center;background:rgba(251,191,36,.08)}.ai-msg-time{margin-top:6px;color:rgba(255,255,255,.45);font-size:.68rem;text-align:right}.ai-quote{border-left:3px solid rgba(89,144,189,.55);padding:7px 9px;margin-bottom:8px;border-radius:8px;background:rgba(0,0,0,.13);color:rgba(255,255,255,.62);font-size:.75rem}.ai-media{display:grid;gap:8px;min-width:min(320px,100%)}.ai-media audio,.ai-media video{width:100%;max-width:360px}.ai-media img{display:block;max-width:min(360px,100%);max-height:360px;border-radius:12px;object-fit:contain;background:rgba(0,0,0,.22)}.ai-doc{display:flex;align-items:center;gap:10px;color:#fff;text-decoration:none;padding:12px;border-radius:12px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.09)}.ai-doc-icon{width:34px;height:34px;border-radius:10px;display:grid;place-items:center;background:rgba(89,144,189,.18)}.ai-location,.ai-unavailable{padding:10px 11px;border-radius:12px;background:rgba(255,255,255,.055);border:1px solid rgba(255,255,255,.08);color:rgba(255,255,255,.78)}.ai-caption{color:rgba(255,255,255,.84)}.ai-composer{display:grid;gap:8px;border-top:1px solid rgba(255,255,255,.08)}.ai-composer textarea{min-height:64px;resize:none}.ai-contact{display:grid;gap:12px}.ai-section{display:grid;gap:9px}.ai-section+.ai-section{border-top:1px solid rgba(255,255,255,.08);padding-top:12px}.ai-card-title{margin:0;color:#78a8ca;font-size:.72rem;font-weight:850;letter-spacing:.12em;text-transform:uppercase}.ai-contact-name{margin:0;font-size:1.08rem}.ai-info{border:1px solid rgba(255,255,255,.08);border-radius:12px;background:rgba(255,255,255,.04);padding:10px}.ai-info-label{margin:0;color:#78a8ca;font-size:.64rem;font-weight:850;text-transform:uppercase;letter-spacing:.1em}.ai-info-value{margin:4px 0 0;font-size:.84rem;word-break:break-word}.ai-candidate{width:100%;border:1px solid rgba(255,255,255,.1);border-radius:12px;background:rgba(255,255,255,.04);color:#fff;text-align:left;padding:10px;cursor:pointer}.ai-candidate small{display:block;color:rgba(255,255,255,.58);margin-top:3px}.ai-empty,.ai-error{min-height:340px;display:grid;place-items:center;text-align:center;color:rgba(255,255,255,.62);padding:24px}.ai-skel{height:56px;border-radius:14px;background:rgba(255,255,255,.08)}@media(max-width:1100px){.ai-grid{grid-template-columns:310px 1fr}.ai-pane--contact{grid-column:1/-1}}@media(max-width:760px){.ai{padding:14px}.ai-head{display:grid}.ai-grid{grid-template-columns:1fr}.ai-list{height:auto;max-height:460px}.ai-msg{max-width:92%}}`;
  style.textContent += `.ai-day{align-self:center;color:rgba(255,255,255,.58);font-size:.68rem;font-weight:850;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.055);border-radius:999px;padding:5px 10px;margin:4px 0}.ai-pill{display:inline-flex;max-width:128px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;border-radius:999px;background:rgba(255,255,255,.07);padding:3px 7px}.ai-wa{color:#9df5bd;background:rgba(37,211,102,.1)}.ai-form-error{color:#ffaaa5;font-size:.75rem;margin:0}.ai-send:disabled,.ai-action:disabled{opacity:.45;cursor:not-allowed}.ai-composer textarea{opacity:1}.ai-composer textarea:disabled{opacity:.58}`;
  document.head.append(style);
  const api = async (params = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v != null && String(v).trim()) query.set(k, String(v).trim()); });
    const response = await fetchWithAuth(`/api/attendance-inbox${query.size ? `?${query}` : ''}`);
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
    const url = photoUrl(contact?.avatar_url || contact?.avatar?.url);
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
  const renderQuoted = msg => msg?.quoted ? `<div class="ai-quote">${esc(msg.quoted.direction === 'outbound' ? 'Você' : 'Contato')} · ${esc(mediaText(msg.quoted.kind))}<br>${esc(msg.quoted.text || mediaText(msg.quoted.kind))}</div>` : '';
  const renderMedia = msg => {
    const meta = mediaMeta(msg);
    const caption = msg.content?.text || meta.caption || '';
    if (meta.fetch_status === 'failed') return `<div class="ai-unavailable">Mídia indisponível</div>${caption ? `<p class="ai-caption">${esc(caption)}</p>` : ''}`;
    if (msg.kind === 'audio') return `<div class="ai-media"><audio controls preload="none" src="${esc(mediaUrl(msg))}"></audio>${caption ? `<p class="ai-caption">${esc(caption)}</p>` : ''}</div>`;
    if (msg.kind === 'image' || msg.kind === 'sticker') return `<div class="ai-media"><a href="${esc(mediaUrl(msg))}" target="_blank" rel="noopener"><img loading="lazy" src="${esc(mediaUrl(msg))}" alt="${esc(caption || mediaText(msg.kind))}"></a>${caption ? `<p class="ai-caption">${esc(caption)}</p>` : ''}</div>`;
    if (msg.kind === 'video') return `<div class="ai-media"><video controls preload="metadata" src="${esc(mediaUrl(msg))}"></video>${caption ? `<p class="ai-caption">${esc(caption)}</p>` : ''}</div>`;
    if (msg.kind === 'document') {
      const name = meta.filename || caption || 'Documento';
      const details = [meta.mime_type, sizeText(meta.size_bytes || meta.size)].filter(Boolean).join(' · ');
      return `<a class="ai-doc" href="${esc(mediaUrl(msg))}" target="_blank" rel="noopener"><span class="ai-doc-icon">📎</span><span><strong>${esc(name)}</strong>${details ? `<br><small>${esc(details)}</small>` : ''}</span></a>`;
    }
    if (msg.kind === 'location') return `<div class="ai-location">${esc(msg.content?.address || 'Localização compartilhada')}</div>`;
    if (msg.kind === 'contact') return `<div class="ai-location">${esc(msg.content?.name || 'Contato compartilhado')}<br>${esc(msg.content?.phone || '')}</div>`;
    return esc(msgText(msg));
  };
  const renderMessageBody = msg => ['audio','image','video','document','sticker','location','contact'].includes(msg.kind)
    ? `${renderQuoted(msg)}${renderMedia(msg)}`
    : `${renderQuoted(msg)}<div>${esc(msgText(msg))}</div>`;
  const field = ([name, value]) => value ? `<div class="ai-info"><p class="ai-info-label">${esc(name)}</p><p class="ai-info-value">${esc(value)}</p></div>` : '';
  const section = (title, rows) => {
    const body = rows.map(field).join('');
    return body ? `<section class="ai-section"><p class="ai-card-title">${esc(title)}</p>${body}</section>` : '';
  };
  function renderList() {
    if (state.loading) return `<div class="ai-list">${Array.from({ length: 6 }).map(() => '<div class="ai-skel"></div>').join('')}</div>`;
    if (!state.rows.length) return '<div class="ai-empty"><div><h2>Nenhuma conversa encontrada</h2><p>A Caixa de entrada mostrará conversas reais assim que houver mensagens recebidas.</p></div></div>';
    return `<div class="ai-list">${state.rows.map(row => `<button class="ai-item ${row.conversation_id === state.selected ? 'is-active' : ''}" data-ai-select="${esc(row.conversation_id)}"><div class="ai-item-top"><span class="ai-person">${avatar(row.contact)}<strong class="ai-name">${esc(titleFor(row))}</strong></span><span class="ai-time">${esc(relative(row.last_message_at || row.updated_at))}</span></div><p class="ai-snippet">${esc(msgText(row.last_message))}</p><div class="ai-row"><span class="ai-meta"><span class="ai-pill ai-wa">WhatsApp</span><span class="ai-pill">${esc(label(row.status))}</span><span class="ai-pill">${esc(row.assigned_user_uid || 'Sem responsável')}</span></span>${row.unread_count ? `<span class="ai-badge">${esc(row.unread_count)}</span>` : ''}</div></button>`).join('')}</div>`;
  }
  function renderMessages() {
    if (state.detailLoading) return '<div class="ai-messages"><div class="ai-skel"></div><div class="ai-skel"></div><div class="ai-skel"></div></div>';
    if (!state.selected) return '<div class="ai-empty"><div><h2>Selecione uma conversa</h2><p>Abra uma conversa para ver mensagens e contexto.</p></div></div>';
    const messages = state.detail?.messages || [];
    if (!messages.length) return '<div class="ai-empty"><div><h2>Sem mensagens</h2><p>As mensagens aparecerão aqui em ordem cronológica.</p></div></div>';
    let last = '';
    return `<div class="ai-messages">${messages.map(msg => { const when = msg.received_at || msg.provider_timestamp; const day = dayLabel(when); const sep = day && day !== last ? (last = day, `<div class="ai-day">${esc(day)}</div>`) : ''; return `${sep}<article class="ai-msg ${esc(msg.direction || 'inbound')}">${renderMessageBody(msg)}<div class="ai-msg-time">${esc(fmt(when))} · ${esc(msg.direction === 'outbound' ? label(msg.transport_status) : msg.direction === 'internal' ? 'Interna' : 'Recebida')}</div></article>`; }).join('')}</div>`;
  }
  function renderConversationActions(conv) {
    if (!state.selected) return '';
    return `<div class="ai-actions"><button class="ai-action" data-ai-op="assign" ${state.actioning ? 'disabled' : ''}>Assumir</button><button class="ai-action" data-ai-op="unassign" ${!conv.assigned_user_uid || state.actioning ? 'disabled' : ''}>Sem responsável</button>${conv.status === 'resolved' ? `<button class="ai-action" data-ai-op="reopen" ${state.actioning ? 'disabled' : ''}>Reabrir</button>` : `<button class="ai-action" data-ai-op="resolve" ${state.actioning ? 'disabled' : ''}>Resolver</button>`}</div>`;
  }
  function renderChat() {
    const conv = state.detail?.conversation || state.rows.find(row => row.conversation_id === state.selected) || {};
    const composer = state.detail?.composer || { enabled: false, reason: 'Selecione uma conversa para responder.' };
    return `<section class="ai-pane ai-chat"><header class="ai-chat-head"><div class="ai-row"><span class="ai-person">${avatar(state.detail?.contact || conv.contact)}<span><strong>${esc(titleFor(state.detail || conv))}</strong><p class="ai-mini">WhatsApp · ${esc(conv.team?.name || 'Time')} · ${esc(conv.assigned_user_uid || 'Sem responsável')}</p></span></span><span class="ai-status">${esc(label(conv.status))}</span></div>${renderConversationActions(conv)}</header>${renderMessages()}<div class="ai-composer"><textarea data-ai-compose ${composer.enabled ? '' : 'disabled'} placeholder="${composer.enabled ? 'Responder mensagem' : 'Envio indisponível'}">${esc(drafts.get(state.selected) || '')}</textarea>${state.composerError ? `<p class="ai-form-error">${esc(state.composerError)}</p>` : ''}<div class="ai-row"><p class="ai-mini">${esc(composer.reason || '')}</p><button class="ai-send" data-ai-send ${composer.enabled && drafts.get(state.selected)?.trim() ? '' : 'disabled'}>${state.sending ? 'Enviando' : 'Enviar'}</button></div></div></section>`;
  }
  function renderContact() {
    const detail = state.detail || {};
    const contact = detail.contact || {};
    const conv = detail.conversation || {};
    const ctx = detail.context || {};
    const person = ctx.person;
    const opp = ctx.crm?.opportunity;
    const student = ctx.student;
    const actions = ctx.actions || {};
    const candidates = ctx.identity?.candidates || [];
    if (!state.selected) return '<aside class="ai-pane ai-pane--contact ai-empty"><div><h2>Dados da pessoa</h2><p>Selecione uma conversa.</p></div></aside>';
    const actionHtml = `<div class="ai-actions">${actions.open_person_url ? `<a class="ai-action" href="${esc(actions.open_person_url)}">Abrir pessoa</a>` : ''}${actions.open_crm_url ? `<a class="ai-action" href="${esc(actions.open_crm_url)}">Abrir oportunidade</a>` : ''}${actions.open_student_url ? `<a class="ai-action" href="${esc(actions.open_student_url)}">Abrir aluno</a>` : ''}${actions.can_create_opportunity ? '<button class="ai-action" data-ai-create-opportunity>Criar oportunidade</button>' : ''}${actions.can_unlink_person ? '<button class="ai-action" data-ai-unlink>Remover vínculo</button>' : ''}</div>`;
    const candidatesHtml = candidates.length && !ctx.identity?.linked ? `<section class="ai-section"><p class="ai-card-title">Possíveis correspondências</p>${candidates.map(c => `<button class="ai-candidate" data-ai-link-person="${esc(c.id)}"><strong>${esc(c.name || c.id)}</strong><small>${esc([c.relation, c.phone, c.email].filter(Boolean).join(' · '))}</small></button>`).join('')}</section>` : '';
    return `<aside class="ai-pane ai-pane--contact"><div class="ai-contact">${avatar({ ...contact, name: person?.name || contact.name, avatar_url: person?.avatar_url || contact.avatar_url })}<h2 class="ai-contact-name">${esc(person?.name || contact.name || contact.phone || 'Contato')}</h2>${actionHtml}${section('Contato', [['Nome', contact.name], ['Telefone', person?.phone || contact.phone], ['Email', person?.email || contact.email], ['Canal', conv.channel?.name || 'WhatsApp'], ['Conexão', conv.connection?.name], ['Time', conv.team?.name], ['Responsável', conv.assigned_user_uid || 'Não atribuído']])}${section('Atendimento', [['Criado em', fmt(conv.created_at || contact.created_at)], ['Última atividade', fmt(conv.last_message_at || conv.updated_at)], ['Status', label(conv.status)], ['Total de mensagens', detail.stats?.message_count ?? (detail.messages || []).length], ['Não lidas', detail.stats?.unread_count ?? 0]])}${section('Vínculos', [['Pessoa vinculada', person?.name || contact.relationship || 'Não vinculada'], ['Aluno vinculado', student?.name || student?.id], ['Responsável/lead/oportunidade', opp?.title || opp?.id]])}${section('CRM', opp ? [['Oportunidade', opp.title || opp.id], ['Pipeline', opp.pipeline], ['Etapa', opp.stage], ['Responsável', opp.owner], ['Valor', money(opp.value, opp.currency)], ['Próxima atividade', opp.next_activity ? `${opp.next_activity.title} · ${fmt(opp.next_activity.due_at)}` : ''], ['Última atividade', fmt(opp.last_activity_at)]] : [])}${section('Aluno', student ? [['Status', student.status], ['Professor', student.teacher], ['Plano/produto', student.product], ['Lifecycle', student.lifecycle], ['Início', fmt(student.started_at)], ['Último dia ativo', student.last_active_date]] : [])}${candidatesHtml}${ctx.identity?.state === 'unidentified' ? '<p class="ai-mini">Contato ainda sem pessoa vinculada.</p>' : ''}</div></aside>`;
  }
  function render() {
    root.innerHTML = `<div class="ai"><div class="ai-shell"><header class="ai-head"><div><p class="ai-kicker">Atendimento</p><h1 class="ai-title">Caixa de entrada</h1><p class="ai-sub">Conversas reais com contexto comercial e educacional da Space.</p></div><button class="ai-refresh" data-ai-refresh>Atualizar</button></header>${state.error && !state.selected ? `<div class="ai-error"><p>${esc(state.error)}</p></div>` : `<div class="ai-grid"><section class="ai-pane"><div class="ai-list-head"><input class="ai-input" data-ai-search placeholder="Buscar pessoa ou telefone" value="${esc(state.q)}"><div class="ai-filters">${['all','unread','mine','unassigned'].map(f => `<button class="ai-chip ${state.filter === f ? 'is-active' : ''}" data-ai-filter="${f}">${esc({all:'Todas',unread:'Não lidas',mine:'Minhas',unassigned:'Sem responsável'}[f])}</button>`).join('')}</div><select class="ai-select" data-ai-team><option value="">Todos os times</option>${state.teams.map(t => `<option value="${esc(t.team_id)}" ${state.team_id === t.team_id ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select></div>${renderList()}</section>${renderChat()}${renderContact()}</div>`}</div></div>`;
  }
  async function load({ silent = false } = {}) {
    if (!silent) { state.loading = true; state.error = ''; render(); }
    try {
      const payload = await api({ q: state.q, filter: state.filter, team_id: state.team_id, limit: 50 });
      state.rows = Array.isArray(payload.rows) ? payload.rows : [];
      state.teams = Array.isArray(payload.teams) ? payload.teams : [];
      if (state.selected && !state.rows.some(row => row.conversation_id === state.selected)) { state.selected = ''; state.detail = null; }
    } catch (error) { state.error = error.message; }
    finally { state.loading = false; render(); }
  }
  async function loadDetail(id, { silent = false } = {}) {
    state.selected = id;
    if (!silent) { state.detailLoading = true; state.error = ''; state.composerError = ''; render(); }
    try {
      state.detail = await api({ conversation_id: id, limit: 80 });
      const sequence = Math.max(0, ...(state.detail.messages || []).map(msg => Number(msg.sequence) || 0));
      if (sequence) {
        await postAction('read', { sequence }, { refresh: false, quiet: true }).catch(() => {});
        state.rows = state.rows.map(row => row.conversation_id === id ? { ...row, unread_count: 0 } : row);
      }
    }
    catch (error) { state.error = error.message; }
    finally { state.detailLoading = false; render(); }
  }
  async function postAction(action, extra = {}, options = {}) {
    if (!state.selected) return;
    const operational = ['assign', 'unassign', 'resolve', 'reopen', 'transfer'].includes(action);
    const body = operational ? { action: 'update', update: action, conversation_id: state.selected, ...extra } : { action, conversation_id: state.selected, ...extra };
    const response = await fetchWithAuth('/api/attendance-inbox', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (!options.quiet) state.composerError = payload.error || 'Não foi possível concluir a ação.';
      if (!options.quiet) render();
      throw new Error(payload.error || 'Não foi possível concluir a ação.');
    }
    if (options.refresh !== false) { await loadDetail(state.selected, { silent: true }); await load({ silent: true }); }
    return payload;
  }
  async function sendMessage() {
    const input = root.querySelector('[data-ai-compose]');
    const text = String(input?.value || '').trim();
    if (!text || !state.selected || state.sending) return;
    state.sending = true; state.composerError = ''; render();
    try {
      await postAction('message', { text, client_request_id: crypto.randomUUID() });
      drafts.delete(state.selected);
      if (input) input.value = '';
    } catch (error) {
      state.composerError = error.message || 'Não foi possível enviar a mensagem.';
    } finally {
      state.sending = false; render();
    }
  }
  async function runOperationalAction(action) {
    if (!state.selected || state.actioning) return;
    state.actioning = action; state.composerError = ''; render();
    try { await postAction(action); }
    catch (error) { state.composerError = error.message || 'Não foi possível concluir a ação.'; }
    finally { state.actioning = ''; render(); }
  }
  root.addEventListener('click', event => {
    const button = event.target.closest('button'); if (!button) return;
    if (button.hasAttribute('data-ai-refresh')) return load();
    if (button.hasAttribute('data-ai-send')) return sendMessage();
    const op = button.getAttribute('data-ai-op'); if (op) return runOperationalAction(op);
    if (button.hasAttribute('data-ai-create-opportunity')) return postAction('create_opportunity');
    if (button.hasAttribute('data-ai-unlink') && confirm('Remover o vínculo desta pessoa com a conversa?')) return postAction('unlink_person');
    const personId = button.getAttribute('data-ai-link-person'); if (personId) return postAction('link_person', { person_id: personId });
    const filter = button.getAttribute('data-ai-filter'); if (filter) { state.filter = filter; state.selected = ''; state.detail = null; return load(); }
    const id = button.getAttribute('data-ai-select'); if (id) return loadDetail(id);
  });
  root.addEventListener('change', event => { if (event.target.matches('[data-ai-team]')) { state.team_id = event.target.value; state.selected = ''; state.detail = null; load(); } });
  root.addEventListener('error', event => { if (event.target.matches?.('[data-ai-avatar]')) event.target.remove(); }, true);
  root.addEventListener('input', event => {
    if (event.target.matches('[data-ai-compose]') && state.selected) {
      drafts.set(state.selected, event.target.value);
      state.composerError = '';
      const send = root.querySelector('[data-ai-send]');
      if (send) send.disabled = !event.target.value.trim();
      const error = root.querySelector('.ai-form-error');
      if (error) error.remove();
    }
    if (event.target.matches('[data-ai-search]')) { state.q = event.target.value; clearTimeout(root._aiSearch); root._aiSearch = setTimeout(() => load(), 260); }
  });
  root.addEventListener('keydown', event => { if (event.target.matches('[data-ai-compose]') && event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendMessage(); } });
  window.SpaceAttendanceInbox = { open: () => load() };
  if (document.body.dataset.initialPanel === 'attendance-inbox') load();
})();
