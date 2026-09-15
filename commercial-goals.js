/* Commercial goals UI. All periods, identities, totals and existence come from the API. */
(() => {
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = value => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const pct = value => `${Number(value || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1, minimumFractionDigits: 1 })}%`;
  const monthLabel = key => new Date(`${key}-15T12:00:00-03:00`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'America/Sao_Paulo' });
  const weekLabel = week => [week.startDateKey, week.endDateKey].map(key => new Date(`${key}T12:00:00-03:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', timeZone: 'America/Sao_Paulo' })).join(' – ');
  const sourceLabel = source => ({ global: 'padrão global', competencia: 'padrão da competência', week: 'configuração semanal', mixed: 'configuração semanal e padrões herdados' }[source] || 'sem configuração');
  const shiftMonth = (key, offset) => { const [year, month] = key.split('-').map(Number); return new Date(Date.UTC(year, month - 1 + offset, 15)).toISOString().slice(0, 7); };
  const button = (action, label, primary = false) => `<button type="button" class="button button-${primary ? 'solid' : 'outline'} button-small" data-goals-action="${escape(action)}">${escape(label)}</button>`;
  const api = '/api/growth-dashboard?api=growth-goals';

  function create({ root, fetchWithAuth, currentCompetencia }) {
    const state = { competencia: currentCompetencia, data: null, request: 0, drawer: null, saving: false };
    let returnFocus;
    let toastTimer;
    const header = () => `<header class="admin-manage-head"><div><h2 class="admin-manage-title">Metas</h2><p class="admin-manage-subtitle">Planeje, distribua e acompanhe as metas do time comercial.</p></div><div class="space-goals-period">${button('previous', '←')}<label><span class="space-goals-period-title" aria-hidden="true">${escape(monthLabel(state.competencia))}</span><span class="space-goals-sr">Competência</span><input class="auth-input" type="month" aria-label="Competência" value="${escape(state.competencia)}" data-goals-month></label>${button('next', '→')}</div></header>`;
    const notify = message => {
      let toast = document.querySelector('[data-goals-toast]');
      if (!toast) { toast = document.createElement('div'); toast.dataset.goalsToast = ''; toast.className = 'space-goals-toast'; toast.setAttribute('role', 'status'); document.body.append(toast); }
      toast.textContent = message; toast.hidden = false;
      clearTimeout(toastTimer); toastTimer = setTimeout(() => { toast.hidden = true; }, 5000);
    };
    const render = () => {
      const data = state.data;
      if (!data) return;
      const summary = data.month.summary;
      const cards = [['Meta mensal', data.monthlyExists ? money(summary.meta) : '—'], ['Realizado no mês', money(summary.realizado)], ['Atingimento', data.monthlyExists ? pct(summary.percentAtingimento) : '—'], ['Falta para a meta', data.monthlyExists ? money(summary.gap) : '—']];
      root.innerHTML = `${header()}<div class="space-goals-kpis">${cards.map(([label, value]) => `<article class="space-goals-card"><span>${label}</span><strong>${value}</strong></article>`).join('')}</div>
        <section class="space-goals-card"><h3>Origem SDR das vendas</h3><p>Sem SDR/Não atribuído: ${Number(data.sdrOriginSummary?.noAttribution || 0)} negócios sem evidência histórica de origem.</p>${data.sdrOriginSummary?.sourceError || data.sdrOriginSummary?.notLoaded ? '<p role="status">Há origens SDR pendentes de validação.</p>' : ''}</section><section class="space-goals-card space-goals-month"><div><h3>Meta do mês</h3>${data.monthlyExists ? `<p>Meta comercial · ${escape(monthLabel(data.competencia))}</p><strong>${money(summary.meta)}</strong> <span class="space-goals-badge">Definida</span>${data.goal.updatedAt ? `<p>Competência atualizada em ${escape(new Date(data.goal.updatedAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }))}${data.goal.updatedByName ? ` por ${escape(data.goal.updatedByName)}` : ''}</p>` : ''}` : `<p>Nenhuma meta mensal definida para ${escape(monthLabel(data.competencia))}.</p>`}</div>${data.editable ? button('monthly', data.monthlyExists ? 'Editar meta mensal' : 'Definir meta mensal', true) : '<span class="space-goals-badge">Histórico · somente leitura</span>'}</section>
        <section class="space-goals-card"><h3>Semanas do mês</h3><p>Semanas vinculadas ao mês em que começam. Os intervalos completos são preservados.</p><div class="space-goals-table-wrap"><table class="space-goals-table"><thead><tr><th>Semana</th><th>Meta</th><th>Realizado</th><th>Atingimento</th><th>Status</th><th>Ação</th></tr></thead><tbody>${data.weeks.map((week, index) => `<tr class="${week.isCurrent ? 'is-current' : ''}"><td>${escape(weekLabel(week))}${week.isCurrent ? '<small>Semana atual</small>' : ''}${!week.exists && week.effectiveConfig ? `<small>Base: ${escape(sourceLabel(week.configSource))}</small>` : ''}</td><td>${week.exists || week.effectiveConfig ? money(week.summary.targetValue) : '—'}</td><td>${money(week.summary.actualValue)}</td><td>${week.exists || week.effectiveConfig ? pct(week.summary.progressPct) : '—'}</td><td><span class="space-goals-badge">${escape(week.status)}</span></td><td>${button(`week:${index}`, !data.editable || week.status === 'Concluída' ? 'Ver' : week.exists ? 'Editar' : 'Definir')}</td></tr>`).join('')}</tbody></table></div></section>
        <section class="space-goals-card"><h3>Planejamento do mês</h3><div class="space-goals-planning"><span>Meta mensal<strong>${data.monthlyExists ? money(summary.meta) : '—'}</strong></span><span>Distribuído nas semanas definidas<strong>${money(data.planning.distributed)}</strong></span><span>${data.planning.difference < 0 ? 'Acima da meta mensal' : 'Ainda não distribuído'}<strong>${data.monthlyExists ? money(Math.abs(data.planning.difference)) : '—'}</strong></span></div><p>O total de cada semana usa a meta da equipe configurada; sem ela, soma Closers e Outros. Semanas que atravessam meses mantêm seu valor integral. Nenhum valor é ajustado automaticamente.</p></section>`;
      root.querySelector('[data-goals-action="previous"]').setAttribute('aria-label', 'Competência anterior');
      root.querySelector('[data-goals-action="next"]').setAttribute('aria-label', 'Próxima competência');
    };
    async function load(competencia = state.competencia) {
      closeDrawer();
      state.competencia = competencia;
      const request = ++state.request;
      state.data = null;
      root.innerHTML = `${header()}<div class="space-goals-kpis" aria-busy="true" aria-label="Carregando metas">${Array.from({ length: 4 }, () => '<div class="space-goals-card space-goals-skeleton"></div>').join('')}</div><div class="space-goals-card space-goals-skeleton space-goals-skeleton-large"></div>`;
      try {
        const response = await fetchWithAuth(`${api}&mode=management&competencia=${encodeURIComponent(competencia)}`, { method: 'GET' });
        const payload = await response.json();
        if (!response.ok || !payload.management) throw new Error('read_failed');
        if (request !== state.request) return;
        state.data = payload.management;
        render();
      } catch (error) {
        if (request !== state.request) return;
        root.innerHTML = `${header()}<div class="space-goals-card" role="alert"><h3>Não foi possível carregar as metas.</h3><p>Tente novamente para consultar os valores salvos.</p>${button('retry', 'Tentar novamente')}</div>`;
      }
    }
    function closeDrawer() {
      if (state.saving) return;
      if (state.drawer) { state.drawer.element.remove(); state.drawer = null; document.body.classList.remove('admin-student-drawer-open'); returnFocus?.focus(); }
    }
    function renderRows() {
      const drawer = state.drawer;
      const groups = [['SDRs', row => !row.isAggregate && row.role === 'sdr'], ['Closers', row => !row.isAggregate && row.role !== 'sdr'], ['Outros', row => row.isAggregate]];
      drawer.element.querySelector('[data-goals-rows]').innerHTML = groups.map(([title, filter]) => `<section><h3>${title}</h3>${drawer.rows.map((row, index) => ({ row, index })).filter(({ row }) => filter(row)).map(({ row, index }) => `<div class="space-goals-person"><strong>${escape(row.displayName)}</strong><label>Papel<select class="auth-input" data-goals-role="${index}" ${drawer.readOnly || row.isAggregate ? 'disabled' : ''}>${['sdr', 'closer', 'both'].map(role => `<option value="${role}" ${row.role === role ? 'selected' : ''}>${{ sdr: 'SDR', closer: 'Closer', both: 'SDR e Closer' }[role]}</option>`).join('')}</select></label><label>${row.role === 'sdr' ? 'Reuniões' : 'R$'}<input class="auth-input" aria-label="Meta de ${escape(row.displayName)}" type="number" min="0" step="${row.role === 'sdr' ? '1' : '0.01'}" value="${row.targetValue}" data-goals-target="${index}" ${drawer.readOnly ? 'disabled' : ''} required></label></div>`).join('') || '<p>Nenhum participante nesta categoria.</p>'}</section>`).join('');
    }
    function openDrawer(index = null, editing = false) {
      if (!state.data) return;
      closeDrawer();
      returnFocus = document.activeElement;
      const week = index == null ? null : state.data.weeks[index];
      const readOnly = !state.data.editable || (week?.status === 'Concluída' && !editing);
      const exists = week ? week.exists : state.data.monthlyExists;
      const title = `${readOnly ? 'Consultar' : exists ? 'Editar' : 'Definir'} ${week ? 'metas' : 'meta mensal'}`;
      const element = document.createElement('div');
      element.className = 'admin-students-drawer is-open space-goals-drawer';
      element.innerHTML = `<div class="admin-students-drawer-backdrop" data-goals-close></div><section class="admin-students-drawer-inner" role="dialog" aria-modal="true" aria-labelledby="space-goals-drawer-title"><form class="space-goals-drawer-form"><header><div><h2 id="space-goals-drawer-title">${title}</h2><p>${escape(week ? weekLabel(week) : monthLabel(state.competencia))}</p></div><button type="button" class="button button-outline button-small" aria-label="Fechar painel" data-goals-close>×</button></header><div class="space-goals-drawer-body">${week ? `${!exists ? '<p>Nenhuma meta definida para esta semana. Revise as metas do time e salve para começar a acompanhar o progresso.</p>' : ''}<p>Base: ${escape(sourceLabel(week.configSource))}.</p>${week.copyFromPrevious && !readOnly ? button('copy', 'Copiar semana anterior') : ''}<p data-goals-copy-status role="status"></p><div data-goals-rows></div><label>Meta explícita da equipe (R$)<input class="auth-input" type="number" min="0" step="0.01" data-goals-team value="${week.teamTarget}" ${readOnly ? 'disabled' : ''} required></label><p>Zero usa o padrão herdado, se houver; sem padrão, usa a soma dos Closers e Outros.</p>` : `<label>Meta mensal (R$)<input class="auth-input" autofocus type="number" min="0.01" step="0.01" data-goals-value value="${exists ? state.data.goal.valorMeta : ''}" required></label>`}<p class="auth-form-error" role="alert" data-goals-error hidden></p></div><footer>${readOnly ? (state.data.editable ? button('edit-week', 'Editar metas da semana') : '') : `<button type="submit" class="button button-solid">${week ? 'Salvar metas da semana' : 'Salvar meta mensal'}</button>`}<button type="button" class="button button-outline" data-goals-close>${readOnly ? 'Fechar' : 'Cancelar'}</button></footer></form></section>`;
      state.drawer = { element, week, rows: week ? week.rows.map(row => ({ ...row })) : [], readOnly, competencia: state.competencia };
      document.body.append(element); document.body.classList.add('admin-student-drawer-open');
      if (week) renderRows();
      element.querySelector('input:not(:disabled), button').focus();
      element.addEventListener('click', event => {
        if (event.target.closest('[data-goals-close]')) closeDrawer();
        if (event.target.closest('[data-goals-action="edit-week"]')) openDrawer(index, true);
        if (event.target.closest('[data-goals-action="copy"]') && !state.saving) {
          const copy = week.copyFromPrevious;
          state.drawer.copied = true;
          const byId = new Map(copy.rows.map(row => [row.personId, row]));
          state.drawer.rows = state.drawer.rows.map(row => byId.has(row.personId) ? { ...row, role: byId.get(row.personId).role, targetValue: byId.get(row.personId).targetValue } : row);
          element.querySelector('[data-goals-team]').value = copy.teamTarget;
          renderRows();
          element.querySelector('[data-goals-copy-status]').textContent = 'Configuração copiada para revisão. As alterações ainda não foram salvas.';
        }
      });
      element.addEventListener('input', event => {
        if (event.target.matches('[data-goals-target]')) state.drawer.rows[Number(event.target.dataset.goalsTarget)].targetValue = Number(event.target.value);
      });
      element.addEventListener('change', event => {
        if (event.target.matches('[data-goals-role]')) { state.drawer.rows[Number(event.target.dataset.goalsRole)].role = event.target.value; renderRows(); }
      });
      element.addEventListener('keydown', event => {
        if (event.key === 'Escape') { event.preventDefault(); closeDrawer(); }
        if (event.key === 'Tab') {
          const focusable = [...element.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled)')];
          const first = focusable[0], last = focusable.at(-1);
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        }
      });
      element.querySelector('form').addEventListener('submit', save);
    }
    async function save(event) {
      event.preventDefault();
      const drawer = state.drawer;
      if (!drawer || drawer.readOnly || state.saving || !event.target.reportValidity()) return;
      const { element, week } = drawer;
      const payload = { competencia: drawer.competencia };
      if (week) payload.weeklyGoal = { weekKey: week.weekKey, startDateKey: week.startDateKey, endDateKey: week.endDateKey,
        ...(drawer.copied || Number(element.querySelector('[data-goals-team]').value) !== week.teamTarget ? { teamTarget: Number(element.querySelector('[data-goals-team]').value) } : {}),
        people: Object.fromEntries(drawer.rows.map(row => [row.personId, { role: row.role, targetValue: row.targetValue }])) };
      else payload.valorMeta = Number(element.querySelector('[data-goals-value]').value);
      const controls = [...element.querySelectorAll('button, input, select')].filter(control => !control.disabled);
      controls.forEach(control => { control.disabled = true; });
      state.saving = true;
      const error = element.querySelector('[data-goals-error]'); error.hidden = true;
      try {
        const response = await fetchWithAuth(api, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'save_failed');
        state.saving = false; closeDrawer();
        notify(week ? 'Metas da semana salvas com sucesso.' : 'Meta mensal salva com sucesso.');
        await load(drawer.competencia);
      } catch (failure) {
        error.textContent = failure.message === 'past_competencia_not_allowed' ? 'Competências anteriores são somente leitura.' : 'Não foi possível salvar as metas. Seus valores foram mantidos para tentar novamente.';
        error.hidden = false;
      } finally { state.saving = false; controls.forEach(control => { control.disabled = false; }); }
    }
    root.addEventListener('click', event => {
      const action = event.target.closest('[data-goals-action]')?.dataset.goalsAction;
      if (!action) return;
      if (action === 'previous' || action === 'next') load(shiftMonth(state.competencia, action === 'previous' ? -1 : 1));
      if (action === 'retry') load();
      if (action === 'monthly') openDrawer();
      if (action.startsWith('week:')) openDrawer(Number(action.split(':')[1]));
    });
    root.addEventListener('change', event => { if (event.target.matches('[data-goals-month]') && /^\d{4}-\d{2}$/.test(event.target.value)) load(event.target.value); });
    return { load, closeDrawer, state };
  }
  window.SpaceCommercialGoals = { create };
})();
