(() => {
  const root = () => document.querySelector('[data-admin-sdr]');
  if (!root()) return;

  const state = {
    data: null,
    loading: false,
    error: '',
    tab: 'overview',
    detailTab: 'summary',
    showMore: false,
    filtersOpen: false,
    page: 1,
    filters: { period: 'last7', sdr: 'all', status: 'all', score: 'all', result: 'all' },
    callId: '',
    sdrId: '',
  };

  const esc = v => String(v == null ? '' : v).replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
  const n = v => v == null || Number.isNaN(Number(v)) ? '—' : new Intl.NumberFormat('pt-BR').format(Number(v));
  const pct = v => v == null || Number.isNaN(Number(v)) ? '—' : `${Number(v).toFixed(1).replace('.', ',')}%`;
  const score = v => v == null || Number.isNaN(Number(v)) ? '—' : `${Math.round(Number(v))}/100`;
  const date = v => /^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? String(v).slice(5).split('-').reverse().join('/') : '—';
  const duration = s => s == null || Number.isNaN(Number(s)) ? '—' : `${Math.floor(Number(s) / 60)}m${Math.round(Number(s) % 60).toString().padStart(2, '0')}s`;
  const shortDuration = s => s == null || Number.isNaN(Number(s)) ? '—' : `${Math.floor(Number(s) / 60)}:${Math.round(Number(s) % 60).toString().padStart(2, '0')}`;
  const maskPhone = phone => String(phone || '').replace(/(\+?\d{1,3})(\d{3,})(\d{4})$/, (_, a, mid, z) => `${a} ${mid.slice(0, 3)} *** ${z}`) || 'Telefone não informado';
  const compactDate = c => `${date(c.dateKey)}${c.time ? ` • ${esc(c.time)}` : ''}`;
  const audioSrc = c => c?.recordingId ? `/api/admin/sdr/calls/${encodeURIComponent(c.recordingId)}/audio` : '';
  const asArray = v => Array.isArray(v) ? v : v ? [v] : [];
  const get = (obj, names, fallback = '') => {
    for (const name of names) if (obj && obj[name] != null && String(obj[name]).trim() !== '') return obj[name];
    return fallback;
  };

  const api = async () => {
    const p = new URLSearchParams({ ...state.filters, tab: state.tab, page: String(state.page), pageSize: state.tab === 'calls' ? '25' : '10' });
    if (state.callId) p.set('callId', state.callId);
    const res = await fetchWithAuth(`/api/admin-sdr?${p}`, { method: 'GET' });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.message || json.error || 'admin_sdr_failed');
    return json;
  };

  const injectStyle = () => {
    if (document.getElementById('admin-sdr-style')) return;
    const s = document.createElement('style');
    s.id = 'admin-sdr-style';
    s.textContent = `
.asdr{width:100%;max-width:1440px;margin:0 auto;padding:28px;color:#fff}.asdr *{box-sizing:border-box}.asdr p,.asdr h1,.asdr h2,.asdr h3{margin:0}.asdr-shell{border-radius:16px;padding:32px;background:radial-gradient(circle at 18% 8%,rgba(89,144,189,.14),transparent 42%),radial-gradient(circle at 86% 0%,rgba(255,78,70,.1),transparent 40%),linear-gradient(160deg,#0b1620 0%,#132436 45%,#0b1620 100%);border:1px solid rgba(89,144,189,.13);box-shadow:0 18px 50px rgba(0,0,0,.34)}.asdr-head{display:flex;align-items:flex-end;justify-content:space-between;gap:18px;margin-bottom:20px}.asdr-kicker{color:rgba(89,144,189,.72);font-size:11px;font-weight:850;letter-spacing:.18em;text-transform:uppercase;margin-bottom:7px}.asdr-title{font-size:clamp(1.9rem,3vw,2.55rem);font-weight:900;letter-spacing:-.05em}.asdr-sub{margin-top:8px;color:rgba(255,255,255,.56);font-size:.94rem}.asdr-actions,.asdr-tabs{display:flex;gap:10px;flex-wrap:wrap}.asdr-btn,.asdr-tab{appearance:none;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.05);color:#fff;border-radius:999px;min-height:38px;padding:0 14px;font:inherit;font-weight:800;font-size:.8rem;cursor:pointer}.asdr-btn:hover,.asdr-tab:hover{background:rgba(255,255,255,.12)}.asdr-btn:focus-visible,.asdr-tab:focus-visible,.asdr-input:focus-visible{outline:2px solid #7ab7ff;outline-offset:3px}.asdr-btn:disabled{opacity:.45;cursor:not-allowed}.asdr-btn.primary{border:0;background:linear-gradient(180deg,#ff6a60,#f04a44);box-shadow:0 12px 28px rgba(255,86,79,.24)}.asdr-tab{color:rgba(255,255,255,.68)}.asdr-tab.is-active{background:rgba(255,106,96,.16);border-color:rgba(255,106,96,.34);color:#fff}.asdr-topline{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:16px;align-items:end;margin-bottom:22px}.asdr-filters[hidden]{display:none}.asdr-filters{margin-bottom:18px;display:grid;grid-template-columns:repeat(5,minmax(130px,1fr));gap:10px}.asdr-field{display:grid;gap:6px}.asdr-field span{font-size:10px;text-transform:uppercase;letter-spacing:.12em;color:rgba(89,144,189,.75);font-weight:850}.asdr-input{width:100%;min-height:40px;border:1px solid rgba(255,255,255,.1);border-radius:13px;background:rgba(255,255,255,.055);color:#fff;padding:0 12px;font:inherit;font-size:.82rem}.asdr-section{margin-top:22px}.asdr-section-head{display:flex;align-items:end;justify-content:space-between;gap:14px;margin-bottom:12px}.asdr-section h2{font-size:1.05rem;font-weight:900;letter-spacing:-.02em}.asdr-section p{color:rgba(255,255,255,.52);font-size:.82rem}.asdr-grid{display:grid;gap:14px}.asdr-kpis{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:12px}.asdr-card{border:1px solid rgba(89,144,189,.12);border-radius:18px;background:rgba(255,255,255,.045);box-shadow:0 12px 30px rgba(0,0,0,.22);padding:18px;overflow:hidden}.asdr-kpi span{display:block;color:rgba(255,255,255,.52);font-size:.7rem;font-weight:850;letter-spacing:.08em;text-transform:uppercase}.asdr-kpi strong{display:block;margin-top:8px;font-size:clamp(1.35rem,2vw,1.9rem);font-weight:900;letter-spacing:-.04em}.asdr-kpi small{display:block;margin-top:5px;color:rgba(255,255,255,.45)}.asdr-two{display:grid;grid-template-columns:.85fr 1.15fr;gap:14px}.asdr-bars{display:grid;gap:10px}.asdr-bar-row{display:grid;grid-template-columns:140px 1fr 86px;gap:10px;align-items:center;color:rgba(255,255,255,.78);font-size:.82rem}.asdr-track{height:12px;border-radius:99px;background:rgba(255,255,255,.06);overflow:hidden}.asdr-track i{display:block;height:100%;background:linear-gradient(90deg,#ff6a60,#7ab7ff);border-radius:inherit}.asdr-table-wrap{overflow:auto}.asdr-table{width:100%;border-collapse:collapse;min-width:760px}.asdr-table th,.asdr-table td{padding:12px 10px;border-bottom:1px solid rgba(255,255,255,.06);text-align:left;font-size:.82rem}.asdr-table th{color:rgba(255,255,255,.5);font-size:.68rem;text-transform:uppercase;letter-spacing:.1em}.asdr-badge{display:inline-flex;border-radius:999px;padding:4px 9px;background:rgba(255,255,255,.07);font-weight:850;font-size:.72rem}.asdr-badge.ok{color:#8ef0c3;background:rgba(93,202,165,.12)}.asdr-badge.warn{color:#ffd182;background:rgba(251,191,36,.12)}.asdr-badge.bad{color:#ffaaa5;background:rgba(255,106,96,.13)}.asdr-empty{display:grid;place-items:center;min-height:150px;text-align:center;color:rgba(255,255,255,.58);gap:8px}.asdr-muted{color:rgba(255,255,255,.5)}.asdr-footer{margin-top:18px;color:rgba(255,255,255,.44);font-size:.76rem}.asdr-drawer{position:fixed;inset:0;height:100dvh;max-height:100dvh;z-index:10000;overflow:hidden;color:#fff;isolation:isolate}.asdr-drawer *{box-sizing:border-box}.asdr-drawer p,.asdr-drawer h2,.asdr-drawer h3{margin:0}.asdr-backdrop{position:absolute;inset:0;z-index:0;background:rgba(0,0,0,.6)}.asdr-drawer-panel{position:fixed;top:0;right:0;width:clamp(720px,52vw,900px);max-width:100vw;height:100dvh;max-height:100dvh;min-height:0;z-index:1;display:flex;flex-direction:column;background:#0c1520;border-left:1px solid rgba(255,255,255,.12);padding:24px;overflow:hidden;pointer-events:auto;box-shadow:-20px 0 50px rgba(0,0,0,.4)}.asdr-drawer-panel>header,.asdr-drawer-panel>.asdr-audio-row,.asdr-drawer-panel>nav{flex-shrink:0}.asdr-drawer-panel>.asdr-detail-body{flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain}.asdr-drawer .asdr-audio{position:relative;z-index:1;pointer-events:auto}.asdr-drawer .asdr-transcript{max-height:none;overflow:visible}.asdr-call-head{display:grid;grid-template-columns:1fr auto;gap:16px;align-items:start;margin-bottom:14px}.asdr-call-title{font-size:1.15rem;font-weight:900}.asdr-call-meta{display:flex;gap:10px;flex-wrap:wrap;color:rgba(255,255,255,.62);font-size:.82rem;margin-top:6px}.asdr-audio-row{display:grid;grid-template-columns:1fr auto;gap:12px;align-items:center;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.035);border-radius:16px;padding:10px 12px;margin:14px 0}.asdr-audio{width:100%;height:34px}.asdr-audio-state{color:rgba(255,255,255,.58);font-size:.78rem;margin-top:6px}.asdr-detail-tabs{display:flex;gap:8px;margin:16px 0}.asdr-detail-tab{border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.04);color:#fff;border-radius:999px;padding:9px 13px;font-weight:850;cursor:pointer}.asdr-detail-tab.is-active{background:rgba(255,106,96,.16);border-color:rgba(255,106,96,.34)}.asdr-detail-body{border:1px solid rgba(89,144,189,.12);border-radius:18px;background:rgba(255,255,255,.04);padding:18px}.asdr-summary-grid{display:grid;grid-template-columns:120px 1fr;gap:16px}.asdr-score-big{font-size:2rem;font-weight:950;letter-spacing:-.04em}.asdr-label{display:block;color:rgba(89,144,189,.78);font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:.12em;margin-bottom:7px}.asdr-pre{white-space:pre-wrap;color:rgba(255,255,255,.74);line-height:1.6}.asdr-transcript{max-height:58vh;overflow:auto}.asdr-list{display:grid;gap:8px;padding-left:0;list-style:none}.asdr-list li{color:rgba(255,255,255,.76)}.asdr-score-row{display:grid;grid-template-columns:180px 1fr 44px;gap:12px;align-items:center;margin:8px 0}.asdr-score-group{margin-bottom:20px}.asdr-score-group h3{font-size:.9rem;margin-bottom:8px}.asdr-more{margin-top:12px}.asdr-transcript-toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:20px}.asdr-transcript-toolbar h3{font-size:1rem;margin-bottom:5px}.asdr-transcript-toolbar .asdr-muted{font-size:.76rem}.asdr-conversation{display:grid;gap:14px}.asdr-utterance{border:1px solid rgba(255,255,255,.07);border-radius:14px;padding:16px 18px;background:rgba(255,255,255,.025);overflow-wrap:anywhere}.asdr-utterance.seller{border-left:3px solid #7ab7ff;background:rgba(122,183,255,.055);margin-right:clamp(0px,3vw,28px)}.asdr-utterance.lead{border-left:3px solid #69d8b0;background:rgba(105,216,176,.05);margin-left:clamp(0px,3vw,28px)}.asdr-utterance header{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:9px;font-size:.72rem}.asdr-speaker{font-weight:800;color:rgba(255,255,255,.55)}.seller .asdr-speaker{color:#9ccaff}.lead .asdr-speaker{color:#8de5c5}.asdr-speaker-name,.asdr-utterance time{color:rgba(255,255,255,.42)}.asdr-utterance time{margin-left:auto}.asdr-utterance p{white-space:pre-wrap;line-height:1.8;font-size:.92rem;color:rgba(255,255,255,.84)}.asdr-light-list{display:grid;gap:6px;margin-top:8px;color:rgba(255,255,255,.68)}@media(max-width:1180px){.asdr-kpis{grid-template-columns:repeat(3,1fr)}.asdr-topline,.asdr-two{grid-template-columns:1fr}.asdr-filters{grid-template-columns:repeat(2,1fr)}.asdr-summary-grid{grid-template-columns:1fr}}@media(max-width:720px){.asdr{padding:16px}.asdr-shell{padding:20px}.asdr-head{display:grid}.asdr-kpis,.asdr-filters{grid-template-columns:1fr}.asdr-audio-row{grid-template-columns:1fr}.asdr-drawer-panel{padding:16px}}`;
    document.head.append(s);
  };

  const kpi = (label, value, sub = '') => `<article class="asdr-card asdr-kpi"><span>${esc(label)}</span><strong>${esc(value)}</strong>${sub ? `<small>${esc(sub)}</small>` : ''}</article>`;
  const section = (title, sub, html, extra = '') => `<section class="asdr-section ${extra}"><div class="asdr-section-head"><div><h2>${esc(title)}</h2>${sub ? `<p>${esc(sub)}</p>` : ''}</div></div>${html}</section>`;

  const renderFilters = data => `<div class="asdr-filters" id="asdr-filters" ${state.filtersOpen ? '' : 'hidden'}>
    <label class="asdr-field"><span>Data</span><select class="asdr-input" data-asdr-filter="period">${[['today','Hoje'],['yesterday','Ontem'],['last7','Últimos 7 dias'],['this_week','Esta semana'],['last_week','Semana passada'],['last30','Últimos 30 dias'],['this_month','Este mês'],['last_month','Mês passado']].map(([v,l])=>`<option value="${v}" ${state.filters.period===v?'selected':''}>${l}</option>`).join('')}</select></label>
    <label class="asdr-field"><span>SDR</span><select class="asdr-input" data-asdr-filter="sdr"><option value="all">Todos</option>${(data.sdrOptions||[]).map(s=>`<option value="${esc(s.uid)}" ${state.filters.sdr===s.uid?'selected':''}>${esc(s.name)}</option>`).join('')}</select></label>
    <label class="asdr-field"><span>Status</span><select class="asdr-input" data-asdr-filter="status">${[['all','Todas'],['connected','Conectadas'],['over1m','> 1 minuto'],['over5m','> 5 minutos']].map(([v,l])=>`<option value="${v}" ${state.filters.status===v?'selected':''}>${l}</option>`).join('')}</select></label>
    <label class="asdr-field"><span>Nota IA</span><select class="asdr-input" data-asdr-filter="score">${[['all','Todas'],['90','90–100'],['80','80–89'],['70','70–79'],['60','60–69'],['lt60','Abaixo de 60']].map(([v,l])=>`<option value="${v}" ${state.filters.score===v?'selected':''}>${l}</option>`).join('')}</select></label>
    <label class="asdr-field"><span>Resultado</span><select class="asdr-input" data-asdr-filter="result">${[['all','Todos'],['scheduled','Agendamento'],['show','Show'],['noshow','No-show'],['none','Sem resultado']].map(([v,l])=>`<option value="${v}" ${state.filters.result===v?'selected':''}>${l}</option>`).join('')}</select></label>
  </div>`;

  const renderMainKpis = d => {
    const k = d.kpis || {};
    return section('KPIs principais', '', `<div class="asdr-kpis">${[
      kpi('Ligações', n(k.totalCalls)),
      kpi('>1 minuto', n(k.over1m), k.analyzedCalls ? pct((k.over1m / k.analyzedCalls) * 100) : ''),
      kpi('Agendamentos', n(k.scheduled)),
      kpi('Conversão', pct(k.callToScheduleRate)),
      kpi('Calls IA', n(k.analyzedCalls)),
      kpi('Nota IA', score(k.avgScore)),
    ].join('')}</div>`);
  };

  const renderFunnel = d => section('Funil de pré-vendas', '', `<div class="asdr-card"><div class="asdr-bars">${(d.funnel||[]).filter(x=>x.key!=='sales').map((x,i,a)=>{const max=Math.max(1,Number(a[0]?.value||0));const v=x.value==null?0:Number(x.value||0);return `<div class="asdr-bar-row"><span>${esc(x.label)}</span><div class="asdr-track"><i style="width:${Math.round((v/max)*100)}%"></i></div><strong>${x.value==null?'—':n(x.value)} ${x.rateFromPrevious==null?'':`· ${pct(x.rateFromPrevious)}`}</strong></div>`}).join('')}</div></div>`);
  const renderTimeline = d => section('Evolução', 'Volume e agendamentos por dia.', `<div class="asdr-card"><div class="asdr-bars">${(d.timeline||[]).slice(-14).map(x=>{const max=Math.max(1,...(d.timeline||[]).map(r=>Number(r.calls||0)));return `<div class="asdr-bar-row"><span>${esc(date(x.dateKey))}</span><div class="asdr-track"><i style="width:${Math.round((Number(x.calls||0)/max)*100)}%"></i></div><strong>${n(x.calls)} calls · ${n(x.scheduled)} ag.</strong></div>`}).join('') || '<div class="asdr-empty">Dados insuficientes para calcular evolução.</div>'}</div></div>`);

  const renderSdrs = d => section('Performance SDR', '', `<div class="asdr-card"><div class="asdr-table-wrap"><table class="asdr-table"><thead><tr><th>SDR</th><th>Ligações</th><th>>1min</th><th>Agendamentos</th><th>Conversão</th><th>Shows</th><th>Show Rate</th><th>Calls IA</th><th>Nota média</th><th>Ver</th></tr></thead><tbody>${(d.sdrs||[]).map(r=>`<tr><td><strong>${esc(r.name)}</strong><br><span class="asdr-muted">${esc(r.email)}</span></td><td>${n(r.calls)}</td><td>${n(r.over1m)}</td><td>${n(r.scheduled)}</td><td>${pct(r.callToScheduleRate)}</td><td>${n(r.shows)}</td><td>${pct(r.showRate)}</td><td>${n(r.analyzedCalls)}</td><td>${score(r.avgScore)}</td><td><button class="asdr-btn" data-asdr-sdr="${esc(r.uid)}">Ver SDR</button></td></tr>`).join('') || '<tr><td colspan="10">Nenhum SDR encontrado.</td></tr>'}</tbody></table></div></div>`);

  const renderCalls = (d, home = false) => {
    const pag = d.pagination || {};
    return section(home ? 'Últimas calls analisadas' : 'Ligações', '', `<div class="asdr-card"><div class="asdr-table-wrap"><table class="asdr-table"><thead><tr><th>Data</th><th>SDR</th><th>Telefone</th><th>Duração</th><th>Nota IA</th><th>Status IA</th><th>Análise</th></tr></thead><tbody>${(d.calls||[]).slice(0, home ? 10 : 100).map(c=>`<tr><td>${date(c.dateKey)} ${esc(c.time)}</td><td>${esc(c.sdrName)}</td><td>${esc(c.toNumber||c.phone||'—')}</td><td>${duration(c.durationSeconds)}</td><td>${score(c.score)}</td><td><span class="asdr-badge ${c.analysisStatus==='completed'?'ok':c.analysisStatus==='error'?'bad':'warn'}">${esc(c.analysisStatus==='completed'?'Concluída':c.analysisStatus==='transcribing'?'Transcrevendo':c.analysisStatus==='analyzing'?'Analisando':c.analysisStatus||'Pendente')}</span></td><td><button class="asdr-btn" data-asdr-call="${esc(c.recordingId||c.id)}">Ver análise</button></td></tr>`).join('') || '<tr><td colspan="7">Nenhuma ligação analisada encontrada.</td></tr>'}</tbody></table></div>${home?'<div style="margin-top:14px"><button class="asdr-btn primary" data-asdr-tab="calls">Ver todas as ligações</button></div>':`<div class="asdr-actions" style="margin-top:14px;justify-content:space-between"><span class="asdr-muted">Página ${n(pag.page||state.page)} · ${n(d.callsTotal||0)} registros no período</span><span><button class="asdr-btn" data-asdr-page="prev" ${pag.hasPrevious?'':'disabled'}>Anterior</button> <button class="asdr-btn" data-asdr-page="next" ${pag.hasNext?'':'disabled'}>Próxima</button></span></div>`}</div>`);
  };

  const renderCoaching = d => section('Coaching', 'Insights ficam abaixo para não poluir a visão principal.', `<div class="asdr-grid">${(d.coaching||[]).map(c=>`<article class="asdr-card"><h3>${esc(c.sdrName)}</h3><p><span class="asdr-label">Foco</span>${esc(c.skill)}</p><p class="asdr-muted">${esc(c.recommendation)}</p></article>`).join('') || '<div class="asdr-empty">Aguardando análises IA suficientes.</div>'}</div>`);

  const renderSdrPage = d => {
    const r = (d.sdrs || []).find(x => x.uid === state.sdrId || x.name === state.sdrId);
    if (!r) return renderSdrs(d);
    const calls = (d.calls || []).filter(c => c.sdrUid === r.uid || c.sdrName === r.name);
    return `<section class="asdr-section"><button class="asdr-btn" data-asdr-tab="sdrs">← Voltar</button><div class="asdr-section-head"><div><h2>${esc(r.name)}</h2><p>${esc(r.email||'')}</p></div></div><div class="asdr-kpis">${[
      kpi('Ligações', n(r.calls)), kpi('>1min', n(r.over1m)), kpi('Agendamentos', n(r.scheduled)), kpi('Conversão', pct(r.callToScheduleRate)), kpi('Nota IA', score(r.avgScore)), kpi('Show Rate', pct(r.showRate))
    ].join('')}</div></section>${renderTimeline({ ...d, timeline: r.trend || [] })}${section('Scorecard SPACE', '', '<div class="asdr-card"><div class="asdr-empty">Aguardando scorecard estruturado SPACE.</div></div>')}${renderCalls({ ...d, calls }, true)}${renderCoaching({ ...d, coaching: (d.coaching || []).filter(c => c.sdrUid === r.uid || c.sdrName === r.name) })}`;
  };

  const topItem = value => asArray(value).filter(Boolean)[0] || '—';
  const renderSummaryTab = c => {
    const a = c.analysis && typeof c.analysis === 'object' ? c.analysis : {};
    const summary = c.summary || get(a, ['summary', 'resumo', 'overall_summary'], '') || (typeof c.analysis === 'string' ? c.analysis : 'Resumo indisponível.');
    const strengths = c.strengths?.length ? c.strengths : asArray(get(a, ['strengths','pontos_fortes','positive_points'], []));
    const weaknesses = c.weaknesses?.length ? c.weaknesses : asArray(get(a, ['weaknesses','pontos_melhoria','improvements'], []));
    const next = c.nextImprovement || get(a, ['next_action','next_improvement','proxima_acao','action'], '—');
    const result = c.outcomeLabel && c.outcomeLabel !== '—' ? c.outcomeLabel : get(a, ['result','resultado','outcome'], '—');
    return `<div class="asdr-summary-grid"><div><span class="asdr-label">Nota</span><div class="asdr-score-big">${score(c.score)}</div></div><div><span class="asdr-label">Resumo</span><p class="asdr-pre">${esc(summary)}</p></div></div><div class="asdr-grid" style="margin-top:18px"><div><span class="asdr-label">Ponto forte principal</span><p>${esc(topItem(strengths))}</p></div><div><span class="asdr-label">Principal melhoria</span><p>${esc(topItem(weaknesses))}</p></div><div><span class="asdr-label">Próxima ação</span><p>${esc(next)}</p></div><div><span class="asdr-label">Resultado</span><p>${esc(result)}</p></div></div>${(strengths.length+weaknesses.length)>2?`<div class="asdr-more"><button class="asdr-btn" data-asdr-more>${state.showMore?'Ocultar':'Ver mais'}</button>${state.showMore?`<div class="asdr-light-list">${strengths.slice(1).map(x=>`<span>✓ ${esc(x)}</span>`).join('')}${weaknesses.slice(1).map(x=>`<span>⚠ ${esc(x)}</span>`).join('')}</div>`:''}</div>`:''}`;
  };

  const scoreValue = item => Number(get(item, ['score','value','nota','rating'], item));
  const renderScoreLine = (label, value) => { const v = Number.isFinite(Number(value)) ? Math.max(0, Math.min(100, Number(value))) : null; return `<div class="asdr-score-row"><span>${esc(label)}</span><div class="asdr-track"><i style="width:${v == null ? 0 : v}%"></i></div><strong>${v == null ? '—' : Math.round(v)}</strong></div>`; };
  const valueFrom = (source, keys) => { for (const key of keys) { const v = get(source, [key], null); if (v != null) return typeof v === 'object' ? scoreValue(v) : v; } return null; };
  const renderScorecardTab = c => {
    const a = c.analysis && typeof c.analysis === 'object' ? c.analysis : {};
    if (a.version === 'space_v1') {
      const groups = {
        SPACE: ['Start','Probe','Amplify','Connect','Engage'],
        SPIN: ['Situação','Problema','Implicação','Necessidade'],
        SPICED: ['Situation','Pain','Impact','Critical Event','Decision'],
      };
      const rootScores = a.scorecard || a.scores || a.criteria || a;
      const extra = ['Combinado de Sinceridade','Controle da conversa','Naturalidade','Geração de valor','Objeções','CTA'];
      const groupHtml = Object.entries(groups).map(([group, labels]) => {
        const source = rootScores[group] || rootScores[group.toLowerCase()] || rootScores;
        return `<div class="asdr-score-group"><h3>${group}</h3>${labels.map(label => renderScoreLine(label, valueFrom(source, [label, label.toLowerCase(), label.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,'_')]))).join('')}</div>`;
      }).join('');
      return `${groupHtml}<div class="asdr-score-group"><h3>Critérios comerciais</h3>${extra.map(label => renderScoreLine(label, valueFrom(rootScores, [label, label.toLowerCase(), label.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,'_')]))).join('')}</div>`;
    }
    return (c.scorecard || []).length ? `<div class="asdr-score-group">${(c.scorecard || []).map(x => renderScoreLine(x.name, x.score)).join('')}</div>` : '<div class="asdr-empty">Scorecard não disponível nesta análise.</div>';
  };

  const transcriptBlocks = c => {
    const source = String(c.transcript || '').trim();
    if (!source) return [];
    const seller = String(c.sdrName || '').trim();
    const classify = label => {
      const value = String(label || '').trim();
      if (/^(vendedor(?:a)?|sdr|atendente|consultor(?:a)?|agent|seller)$/i.test(value) || (seller && value.toLocaleLowerCase() === seller.toLocaleLowerCase())) return { role: 'seller', label: 'Vendedor' };
      if (/^(lead|cliente|customer|prospect)$/i.test(value)) return { role: 'lead', label: 'Lead' };
      return { role: 'unknown', label: value || '' };
    };
    const splitText = text => {
      const blocks = [];
      for (const paragraph of String(text || '').split(/\n+/).filter(part => part.trim())) {
        const sentences = paragraph.split(/(?<=[.!?])\s+/);
        let block = '';
        for (const sentence of sentences) {
          if (block.length + sentence.length > 400 && block) { blocks.push(block.trim()); block = ''; }
          block += (block ? ' ' : '') + sentence;
        }
        if (block.trim()) blocks.push(block.trim());
      }
      // Handle unpunctuated passages without dropping words.
      return blocks.flatMap(block => {
        if (block.length <= 650) return [block];
        const pieces = []; let current = '';
        for (const word of block.split(/\s+/)) {
          if (current.length + word.length > 400 && current) { pieces.push(current); current = ''; }
          current += (current ? ' ' : '') + word;
        }
        if (current) pieces.push(current);
        return pieces;
      });
    };
    const expand = (text, speaker = '', timestamp = '') => splitText(text).map((text, index) => ({ ...classify(speaker), text, timestamp: index ? '' : timestamp }));
    try {
      const parsed = JSON.parse(source);
      const turns = Array.isArray(parsed) ? parsed : parsed?.utterances || parsed?.segments;
      if (Array.isArray(turns) && turns.length && turns.every(turn => turn && typeof turn.text === 'string')) {
        return turns.flatMap(turn => expand(turn.text, turn.role || turn.speaker || '', typeof turn.timestamp === 'string' && /^\d{1,2}:\d{2}(?::\d{2})?$/.test(turn.timestamp) ? turn.timestamp : ''));
      }
    } catch {}
    const escapedSeller = Array.from(seller, char => '^$.*+?()[]{}|\\'.includes(char) ? '\\' + char : char).join('');
    const labels = ['Vendedor(?:a)?','SDR','Atendente','Consultor(?:a)?','Lead','Cliente','Customer','Prospect','Agent','Seller','(?:Speaker|Falante)\\s*\\d+', ...(escapedSeller ? [escapedSeller] : [])].join('|');
    const marker = new RegExp(`(^|\\n|\\s)(?:\\[?(\\d{1,2}:\\d{2}(?::\\d{2})?)\\]?\\s+)?(${labels})\\s*:\\s*`, 'gi');
    const matches = [...source.matchAll(marker)];
    if (!matches.length) return expand(source);
    const blocks = expand(source.slice(0, matches[0].index));
    matches.forEach((match, index) => {
      const end = matches[index + 1]?.index ?? source.length;
      blocks.push(...expand(source.slice(match.index + match[0].length, end), match[3], match[2] || ''));
    });
    return blocks;
  };
  const renderTranscriptTab = c => {
    const blocks = transcriptBlocks(c);
    if (!blocks.length) return '<div class="asdr-empty">Transcrição ainda não disponível.</div>';
    const identified = blocks.some(block => block.role !== 'unknown');
    return `<div class="asdr-transcript-toolbar"><div><h3>Conversa</h3><span class="asdr-muted">${blocks.length} trechos${identified ? '' : ' · Falantes não identificados na origem'}</span></div><button class="asdr-btn" data-asdr-copy>Copiar transcrição</button></div><div class="asdr-conversation" aria-label="Transcrição da ligação">${blocks.map((block, index) => `<article class="asdr-utterance ${block.role}"><header><span class="asdr-speaker">${esc(block.label || `Trecho ${String(index + 1).padStart(2, '0')}`)}</span>${block.role === 'seller' && c.sdrName ? `<span class="asdr-speaker-name">${esc(c.sdrName)}</span>` : ''}${block.timestamp ? `<time>${esc(block.timestamp)}</time>` : ''}</header><p>${esc(block.text)}</p></article>`).join('')}</div>`;
  };
  const renderDetailBody = c => state.detailTab === 'scorecard' ? renderScorecardTab(c) : state.detailTab === 'transcript' ? renderTranscriptTab(c) : renderSummaryTab(c);

  const renderDrawer = d => {
    const c = d.selectedCall;
    if (!c) return '';
    const src = audioSrc(c);
    return `<div class="asdr-drawer" id="asdr-drawer"><div class="asdr-backdrop" data-asdr-backdrop></div><section class="asdr-drawer-panel" role="dialog" aria-modal="true" aria-label="Análise da ligação" data-asdr-panel><header class="asdr-call-head"><div><h2 class="asdr-call-title">${esc(c.sdrName)}</h2><div class="asdr-call-meta"><span>${compactDate(c)}</span><span>${duration(c.durationSeconds)}</span><span>Nota ${score(c.score)}</span><span>${esc(maskPhone(c.toNumber || c.phone))}</span></div></div><button class="asdr-btn" data-asdr-close>Fechar</button></header><div class="asdr-audio-row">${src ? `<div><audio class="asdr-audio" data-asdr-audio controls preload="metadata" data-audio-endpoint="${esc(src)}"></audio><div class="asdr-audio-state" data-asdr-audio-state>Carregando gravação...</div></div><div class="asdr-actions"><button class="asdr-btn" data-asdr-speed="1">1x</button><button class="asdr-btn" data-asdr-speed="1.5">1.5x</button><button class="asdr-btn" data-asdr-speed="2">2x</button></div>` : '<div class="asdr-audio-state">Gravação indisponível</div>'}</div><nav class="asdr-detail-tabs">${[['summary','Resumo'],['scorecard','Scorecard'],['transcript','Transcrição']].map(([id,label])=>`<button class="asdr-detail-tab ${state.detailTab===id?'is-active':''}" data-asdr-detail-tab="${id}">${label}</button>`).join('')}</nav><article class="asdr-detail-body">${renderDetailBody(c)}</article></section></div>`;
  };

  const tabMarkup = () => [['overview','Visão geral'],['sdrs','SDRs'],['calls','Ligações'],['coaching','Coaching']].map(([id,l])=>`<button class="asdr-tab ${state.tab===id?'is-active':''}" data-asdr-tab="${id}">${l}</button>`).join('');
  const body = d => state.sdrId ? renderSdrPage(d) : state.tab === 'sdrs' ? renderSdrs(d) : state.tab === 'calls' ? renderCalls(d) : state.tab === 'coaching' ? renderCoaching(d) : `${renderMainKpis(d)}${renderSdrs(d)}${renderCalls(d, true)}${renderTimeline(d)}${renderFunnel(d)}`;
  const render = () => { injectStyle(); const el = root(); if (!el) return; const d = state.data || {}; el.innerHTML = `<div class="asdr"><div class="asdr-shell"><header class="asdr-head"><div><h1 class="asdr-title">Painel SDR</h1><p class="asdr-sub">Performance e qualidade das ligações.</p></div><div class="asdr-actions"><button class="asdr-btn" data-asdr-toggle-filters aria-controls="asdr-filters" aria-expanded="${state.filtersOpen}">Filtrar</button><button class="asdr-btn" data-asdr-refresh>Atualizar</button><button class="asdr-btn primary" data-asdr-export>Exportar CSV</button></div></header>${renderFilters(d)}<div class="asdr-topline"><nav class="asdr-tabs">${tabMarkup()}</nav></div>${state.loading?'<div class="asdr-empty">Carregando painel SDR…</div>':state.error?`<div class="asdr-empty"><strong>Não foi possível carregar SDR agora.</strong><p>${esc(state.error)}</p><button class="asdr-btn" data-asdr-refresh>Tentar novamente</button></div>`:body(d)}<p class="asdr-footer">Atualizado em ${d.generatedAt?new Date(d.generatedAt).toLocaleString('pt-BR', {dateStyle:'short',timeStyle:'short'}):'—'}</p></div></div>`; syncDrawer(d); };


  let drawerRestore = null;
  const removeDrawer = () => {
    const drawer = document.getElementById('asdr-drawer');
    if (!drawer) return;
    const audio = drawer.querySelector('audio');
    audio?.pause();
    if (audio?.dataset.objectUrl) URL.revokeObjectURL(audio.dataset.objectUrl);
    drawer.remove();
    if (drawerRestore) {
      document.body.style.overflow = drawerRestore.body;
      document.documentElement.style.overflow = drawerRestore.html;
      drawerRestore.focus?.focus({ preventScroll: true });
      drawerRestore = null;
    }
  };
  const syncDrawer = d => {
    if (!d.selectedCall) return removeDrawer();
    const existing = document.getElementById('asdr-drawer');
    if (existing?.dataset.recordingId === d.selectedCall.recordingId) return;
    removeDrawer();
    drawerRestore = { body: document.body.style.overflow, html: document.documentElement.style.overflow, focus: document.activeElement };
    document.body.insertAdjacentHTML('beforeend', renderDrawer(d));
    const drawer = document.getElementById('asdr-drawer');
    drawer.dataset.recordingId = d.selectedCall.recordingId;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    drawer.querySelector('button[data-asdr-close]')?.focus({ preventScroll: true });
    wireAudio();
  };
  const closeDrawer = () => {
    state.callId = '';
    state.detailTab = 'summary';
    if (state.data) state.data.selectedCall = null;
    removeDrawer();
  };
  const updateDetailBody = () => {
    const drawer = document.getElementById('asdr-drawer');
    if (!drawer || !state.data?.selectedCall) return;
    drawer.querySelector('.asdr-detail-body').innerHTML = renderDetailBody(state.data.selectedCall);
    drawer.querySelector('.asdr-detail-body').scrollTop = 0;
    drawer.querySelectorAll('[data-asdr-detail-tab]').forEach(button => button.classList.toggle('is-active', button.dataset.asdrDetailTab === state.detailTab));
  };
  document.addEventListener('keydown', event => {
    const drawer = document.getElementById('asdr-drawer');
    if (!drawer) return;
    if (event.key === 'Escape') { event.preventDefault(); closeDrawer(); }
    if (event.key === 'Tab') {
      const items = [...drawer.querySelectorAll('button:not(:disabled),audio[controls],[tabindex="0"]')];
      if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items.at(-1)?.focus(); }
      else if (!event.shiftKey && document.activeElement === items.at(-1)) { event.preventDefault(); items[0]?.focus(); }
    }
  });

  const wireAudio = () => {
    document.querySelectorAll('[data-asdr-audio]').forEach(async audio => {
      const status = audio.closest('.asdr-audio-row')?.querySelector('[data-asdr-audio-state]');
      if (audio.dataset.wired === '1') return;
      audio.dataset.wired = '1';
      audio.addEventListener('loadedmetadata', () => { if (status) status.textContent = `Duração ${shortDuration(audio.duration)}`; }, { once: true });
      audio.addEventListener('error', () => { if (status) status.textContent = 'Gravação indisponível'; });
      try {
        if (status) status.textContent = 'Carregando gravação...';
        const res = await fetchWithAuth(audio.dataset.audioEndpoint, { headers: { Accept: 'audio/mpeg' }, cache: 'no-store' });
        const contentType = String(res.headers?.get?.('content-type') || '');
        if (!res.ok) throw new Error(`HTTP ${res.status || 0}`);
        const blob = await res.blob();
        if (!blob.size || !audio.isConnected) throw new Error('resposta sem áudio');
        if (contentType && !/^audio\//i.test(contentType)) throw new Error(`tipo inválido ${contentType.split(';')[0]}`);
        if (audio.dataset.objectUrl) URL.revokeObjectURL(audio.dataset.objectUrl);
        const objectUrl = URL.createObjectURL(blob);
        audio.dataset.objectUrl = objectUrl;
        audio.src = objectUrl;
      } catch (error) {
        console.warn('[admin-sdr-audio-ui] failed', { message: error?.message || 'audio_unavailable', endpoint: audio.dataset.audioEndpoint });
        if (status && audio.isConnected) status.textContent = `Gravação indisponível (${error?.message || 'falha no áudio'})`;
      }
    });
  };

  const load = async () => { state.loading = true; state.error = ''; render(); try { state.data = await api(); } catch (e) { state.error = e.message || 'Erro'; } finally { state.loading = false; render(); } };
  const exportCsv = () => { const rows = state.data?.calls || []; const csv = [['data','sdr','telefone','duracao','nota_ia','status_ia'].join(','), ...rows.map(c=>[c.dateKey,c.sdrName,c.toNumber||c.phone||'',c.durationSeconds??'',c.score??'',c.analysisStatus??''].map(v=>`"${String(v).replace(/"/g,'""')}"`).join(','))].join('\n'); const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'})); a.download='sdr-calls-analisadas.csv'; a.click(); URL.revokeObjectURL(a.href); };

  document.addEventListener('click', e => {
    if (e.target.hasAttribute?.('data-asdr-backdrop')) return closeDrawer();
    const t = e.target.closest('[data-asdr-toggle-filters],[data-asdr-tab],[data-asdr-refresh],[data-asdr-call],[data-asdr-sdr],[data-asdr-export],[data-asdr-page],[data-asdr-detail-tab],[data-asdr-more],button[data-asdr-close],[data-asdr-speed],[data-asdr-copy]');
    if (!t) return;
    if (t.hasAttribute('data-asdr-toggle-filters')) { state.filtersOpen = !state.filtersOpen; document.getElementById('asdr-filters').hidden = !state.filtersOpen; t.setAttribute('aria-expanded', String(state.filtersOpen)); return; }
    if (t.hasAttribute('data-asdr-close')) return closeDrawer();
    if (t.hasAttribute('data-asdr-refresh')) return load();
    if (t.hasAttribute('data-asdr-export')) return exportCsv();
    if (t.hasAttribute('data-asdr-tab')) { state.tab = t.getAttribute('data-asdr-tab'); state.page = 1; state.sdrId = ''; state.callId = ''; return load(); }
    if (t.hasAttribute('data-asdr-page')) { const dir = t.getAttribute('data-asdr-page'); state.page = Math.max(1, state.page + (dir === 'next' ? 1 : -1)); return load(); }
    if (t.hasAttribute('data-asdr-call')) { state.callId = t.getAttribute('data-asdr-call'); state.detailTab = 'summary'; state.showMore = false; return load(); }
    if (t.hasAttribute('data-asdr-sdr')) { state.sdrId = t.getAttribute('data-asdr-sdr'); state.tab = 'sdrs'; return render(); }
    if (t.hasAttribute('data-asdr-detail-tab')) { state.detailTab = t.getAttribute('data-asdr-detail-tab'); return updateDetailBody(); }
    if (t.hasAttribute('data-asdr-more')) { state.showMore = !state.showMore; return updateDetailBody(); }
    if (t.hasAttribute('data-asdr-speed')) document.querySelectorAll('.asdr-audio').forEach(a => { a.playbackRate = Number(t.getAttribute('data-asdr-speed')) || 1; });
    if (t.hasAttribute('data-asdr-copy')) navigator.clipboard?.writeText(state.data?.selectedCall?.transcript || '').catch(() => {});
  });
  document.addEventListener('change', e => { const t = e.target.closest('[data-asdr-filter]'); if (!t) return; state.filters[t.getAttribute('data-asdr-filter')] = t.value; state.page = 1; state.callId = ''; state.sdrId = ''; load(); });

  window.SpaceAdminSdr = { open: load, render };
  if (document.body.dataset.initialPanel === 'admin-sdr') load();
})();
