(() => {
  const root = document.querySelector('[data-attendance-connections]');
  if (!root) return;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let data, loading = false;
  const style = document.createElement('style');
  style.textContent = '.ac{padding:28px;max-width:1280px;margin:auto}.ac-head{display:flex;justify-content:space-between;gap:16px;align-items:center}.ac-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px;margin-top:24px}.ac-card{padding:22px;border:1px solid #dde3ee;border-radius:16px;background:#fff;color:#172033}.ac-card p{overflow-wrap:anywhere}.ac-muted{color:#69758b;font-size:14px}.ac-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:16px}.ac button{cursor:pointer}.ac button:disabled{cursor:not-allowed;opacity:.5}.ac-dialog{border:0;border-radius:18px;padding:26px;width:min(520px,90vw);color:#172033}.ac-dialog::backdrop{background:#10203388}.ac-dialog label{display:block;margin:16px 0}.ac-dialog input,.ac-dialog select{display:block;width:100%;padding:10px;margin-top:6px;border:1px solid #ccd4df;border-radius:8px}.ac-dialog button{padding:10px 16px}.ac-error{color:#a42030}.ac-status{display:inline-block;background:#eef2f8;padding:5px 10px;border-radius:20px;font-size:13px}';
  document.head.append(style);
  const team = id => data.teams.find(t => t.team_id === id)?.name || 'Sem time disponível';
  const label = c => c.status === 'disabled' ? 'Desativada' : c.setup_pending ? 'Aguardando configuração Meta' : 'Ativa';
  const api = async body => {
    const res = await fetchWithAuth('/api/attendance-connections', body ? { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) } : {});
    const result = await res.json();
    if (!res.ok) throw new Error(res.status === 401 ? 'Sua sessão expirou. Entre novamente.' : res.status === 403 ? 'Você não tem permissão para esta ação.' : res.status === 409 ? 'Conclua a configuração Meta antes de ativar.' : res.status === 422 ? 'Revise os campos informados.' : 'Conexões indisponíveis no momento. Tente novamente.');
    return result;
  };
  const date = v => v ? new Date(v).toLocaleString('pt-BR') : '—';
  function render() {
    root.innerHTML = `<div class="ac"><div class="ac-head"><div><p class="ac-muted">Atendimento</p><h1>Conexões</h1><p>Gerencie os canais de atendimento da Space.</p></div><button class="primary-button" data-ac-new ${data.permissions.create?'':'disabled'}>Nova conexão</button></div><p class="ac-muted">Desativar preserva as conversas e o histórico. Ativação operacional não registra o número na Meta.</p>${!data.permissions.create?'<p class="ac-muted">Para criar, é necessário um time ativo e permissão de gestão.</p>':''}<div class="ac-grid">${data.items.map(c => `<article class="ac-card"><span class="ac-status">${esc(label(c))}</span><h2>${esc(c.name)}</h2><p>${esc(c.provider === 'meta_whatsapp' ? 'WhatsApp Oficial' : c.provider)}</p><p>WABA ID: ${esc(c.waba_id || 'Aguardando configuração')}</p>${c.channels.map(ch => `<p><strong>${esc(ch.display_name)}</strong><br>Phone Number ID / canal: ${esc(ch.external_channel_id)}<br>Time padrão: ${esc(team(ch.default_team_id))}</p>`).join('') || `<p>Time padrão: ${esc(team(c.draft_team_id))}</p>`}<div class="ac-actions"><button data-ac-details="${esc(c.connection_id)}">Detalhes</button><button data-ac-edit="${esc(c.connection_id)}" ${c.can_edit?'':'disabled'}>Editar</button><button data-ac-toggle="${esc(c.connection_id)}" ${c.can_edit && (c.status !== 'disabled' || c.can_activate)?'':'disabled'}>${c.status === 'disabled'?'Ativar':'Desativar'}</button></div></article>`).join('') || '<p>Nenhuma conexão disponível no seu escopo.</p>'}</div><p role="status" data-ac-message></p><button data-ac-refresh>Atualizar</button></div>`;
  }
  async function open() {
    if (loading) return;
    loading = true; root.innerHTML = '<div class="ac" role="status">Carregando conexões…</div>';
    try { data = await api(); render(); } catch(e) { root.innerHTML = `<div class="ac"><h1>Conexões</h1><p class="ac-error" role="alert">${esc(e.message)}</p><button data-ac-refresh>Tentar novamente</button></div>`; }
    finally { loading = false; }
  }
  function dialog(title, content, onSubmit) {
    const previous = document.activeElement;
    const el = document.createElement('dialog'); el.className = 'ac-dialog';
    el.innerHTML = `<form><h2>${esc(title)}</h2>${content}<p class="ac-error" role="alert"></p><div class="ac-actions"><button type="button" data-close>Fechar</button>${onSubmit?'<button type="submit">Salvar</button>':''}</div></form>`;
    document.body.append(el); el.querySelector('[data-close]').onclick = () => el.close();
    el.addEventListener('close', () => { el.remove(); previous?.focus(); });
    el.querySelector('form').onsubmit = async event => {
      event.preventDefault(); if (!onSubmit) return;
      const buttons = el.querySelectorAll('button'); buttons.forEach(b => b.disabled = true);
      try { await onSubmit(new FormData(event.target)); el.close(); await open(); }
      catch(e) { el.querySelector('[role=alert]').textContent = e.message; }
      finally { buttons.forEach(b => b.disabled = false); }
    };
    el.showModal();
  }
  const options = (teams, selected) => teams.map(t => `<option value="${esc(t.team_id)}" ${t.team_id === selected?'selected':''}>${esc(t.name)}</option>`).join('');
  root.addEventListener('click', async event => {
    const b = event.target.closest('button'); if (!b || b.disabled) return;
    if (b.hasAttribute('data-ac-refresh')) return open();
    if (b.hasAttribute('data-ac-new')) return dialog('Nova conexão', `<label>Provider<select name="provider"><option>WhatsApp Oficial</option><option disabled>Outros providers — Em breve</option></select></label><p>Aguardando configuração Meta</p><p class="ac-muted">Crie a conexão e escolha o time. A vinculação do WABA e do número será concluída posteriormente. Nenhuma credencial é solicitada aqui.</p><label>Nome<input name="name" required maxlength="100" autocomplete="off"></label><label>Time padrão<select name="team" required>${options(data.create_teams)}</select></label>`, f => api({action:'create', name:f.get('name'), team_id:f.get('team')}));
    const c = data.items.find(c => c.connection_id === (b.dataset.acDetails || b.dataset.acEdit || b.dataset.acToggle)); if (!c) return;
    if (b.hasAttribute('data-ac-details')) return dialog('Detalhes da conexão', `<h3>${esc(c.name)}</h3><p>${esc(label(c))}</p><p>Provider: ${esc(c.provider)}</p><p>WABA ID: ${esc(c.waba_id || 'Não configurado')}</p><p>Criada: ${esc(date(c.created_at))}<br>Atualizada: ${esc(date(c.updated_at))}</p>${data.permissions.technical?`<p>ID interno: ${esc(c.connection_id)}</p>${c.channels.map(ch => `<p>Canal: ${esc(ch.channel_id)}<br>Identificador externo: ${esc(ch.external_channel_id)}<br>Status operacional: ${esc(ch.status)}</p>`).join('')}`:''}<p class="ac-muted">Credenciais não são exibidas. O histórico é preservado ao desativar.</p>`);
    if (b.hasAttribute('data-ac-edit')) {
      const channel = c.channels.length === 1 ? c.channels[0] : null;
      const choices = channel ? data.create_teams.filter(t => channel.allowed_teams.includes(t.team_id)) : !c.channels.length ? data.create_teams : [];
      return dialog('Editar conexão', `<label>Nome<input name="name" required maxlength="100" value="${esc(c.name)}"></label>${choices.length?`<label>Time padrão<select name="team">${options(choices, channel?.default_team_id || c.draft_team_id)}</select></label>`:''}${c.channels.length>1?'<p>Para trocar o time, selecione um canal abaixo.</p>'+c.channels.map(ch=>`<label>${esc(ch.display_name)}<select name="channel:${esc(ch.channel_id)}">${options(data.create_teams.filter(t=>ch.allowed_teams.includes(t.team_id)),ch.default_team_id)}</select></label>`).join(''):''}<p class="ac-muted">O novo time padrão vale para novas conversas. Times disponíveis são os já autorizados no canal.</p>`, async f => {
        if (f.get('name') !== c.name) await api({action:'rename', connection_id:c.connection_id,name:f.get('name')});
        if (f.get('team') && f.get('team') !== (channel?.default_team_id || c.draft_team_id)) await api({action:'team', connection_id:c.connection_id,team_id:f.get('team'), ...(channel?{channel_id:channel.channel_id}:{})});
        for (const ch of c.channels) { const id=f.get('channel:'+ch.channel_id); if(id && id!==ch.default_team_id) await api({action:'team',connection_id:c.connection_id,channel_id:ch.channel_id,team_id:id}); }
      });
    }
    if (b.hasAttribute('data-ac-toggle')) return dialog(c.status === 'disabled'?'Ativar conexão':'Desativar conexão', `<p>${esc(c.name)}</p><p>As conversas e o histórico serão preservados.</p>`, () => api({action:'status',connection_id:c.connection_id,status:c.status === 'disabled'?'active':'disabled'}));
  });
  window.SpaceAttendanceConnections = {open};
  if (document.body.dataset.initialPanel === 'attendance-connections') open();
})();
