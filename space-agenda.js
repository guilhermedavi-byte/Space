(function () {
  if (window.SpaceAgenda) return;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const statusMap = { confirmed: 'Confirmado', cancelled: 'Cancelado', rescheduled: 'Reagendado', pending: 'Pendente', completed: 'Realizado', show: 'Realizado', no_show: 'No-show' };
  const sourceMap = { calcom: 'Cal.com', cal_com: 'Cal.com', external_booking: 'WhatsApp', manual_booking: 'Manual', space: 'Space' };
  const date = value => value ? new Date(value).toLocaleString('pt-BR') : '';
  const time = value => value ? new Date(value).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—';
  const dayKey = value => value ? new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value)) : '';
  const monthLabel = value => new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', month: 'long', year: 'numeric' }).format(value).replace(/^./, c => c.toUpperCase());
  const message = b => !b ? 'Reunião ainda não confirmada na agenda' : b.bookingConfirmed ? `Reunião agendada ✓ · ${date(b.bookingStartAt)}` : ({cancelled:'Reunião cancelada',rescheduled:'Reunião reagendada',pending:'Agendamento aguardando confirmação'}[b.status] || 'Aguardando confirmação');
  const request = async (params = {}, body) => {
    const url = '/api/commercial-bookings?' + new URLSearchParams(params);
    const res = await window.fetchWithAuth(url, body ? {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)} : {});
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error('Não foi possível sincronizar a agenda agora. Tente novamente.');
    return data;
  };
  const cache = new Map();
  let selectedCallId = null, mountedCallId = '', generation = 0, loading = false;
  const state = { view: 'month', cursor: new Date(), bookings: [], status: '', detailId: '', modal: false, context: null, contactReady: false, mountCount: 0 };
  const root = () => document.querySelector('[data-space-agenda]');
  const normalizeBooking = b => ({ ...b, id: b.id || b.bookingId || b.uid || b.sourceId || `${b.bookingStartAt || ''}-${b.attendeePhoneNumber || ''}`, start: b.bookingStartAt || b.startAt || b.scheduledAt || b.startsAt, end: b.bookingEndAt || b.endAt || b.endsAt, name: b.attendeeName || b.leadName || b.name || 'Reunião', phone: b.attendeePhoneNumber || b.phone || b.leadPhone || '', source: sourceMap[b.sourceType] || sourceMap[b.source] || b.sourceType || b.source || 'Space', statusLabel: statusMap[b.status] || statusMap[b.meetingStatus] || 'Pendente' });
  const bookings = () => (state.bookings || []).map(normalizeBooking).filter(b => b.start).sort((a,b)=>Date.parse(a.start)-Date.parse(b.start));
  async function refresh(callId) {
    const data = await request(callId ? {callId} : {});
    state.bookings = Array.isArray(data.bookings) ? data.bookings : [];
    if(callId) {
      const current = state.bookings.find(b=>b.status !== 'rescheduled') || state.bookings[0] || null;
      cache.set(callId,current);
      window.dispatchEvent(new CustomEvent('space-bookings:updated',{detail:{callId,booking:current}}));
    }
    render();
    return data;
  }
  function sdk() {
    if(window.Cal)return;
    const cal=function(){const args=arguments;if(args[0]==='init'&&typeof args[1]==='string'){const ns=args[1];if(!cal.ns[ns]){const api=function(){api.q.push(arguments);};api.q=[];cal.ns[ns]=api;}cal.ns[ns].q.push(args);cal.q.push(['initNamespace',ns]);}else cal.q.push(args);};
    cal.q=[];cal.ns={};window.Cal=cal;
    const script=document.createElement('script');script.src='https://app.cal.com/embed/embed.js';script.async=true;
    script.onerror=()=>{state.status='Não foi possível carregar o calendário. Tente novamente.';delete window.Cal;render();};
    document.head.appendChild(script);cal('init',{origin:'https://cal.com'});
  }
  const startOfMonth = d => new Date(d.getFullYear(), d.getMonth(), 1);
  const addMonths = (d, n) => new Date(d.getFullYear(), d.getMonth() + n, 1);
  const startOfWeek = d => { const x=new Date(d); const day=x.getDay(); x.setDate(x.getDate()-day); x.setHours(0,0,0,0); return x; };
  const visibleMonthDays = () => { const first=startOfMonth(state.cursor); const start=startOfWeek(first); return Array.from({length:42},(_,i)=>{const d=new Date(start);d.setDate(start.getDate()+i);return d;}); };
  const visibleWeekDays = () => Array.from({length:7},(_,i)=>{const d=startOfWeek(state.cursor);d.setDate(d.getDate()+i);return d;});
  const eventsFor = d => bookings().filter(b => dayKey(b.start) === dayKey(d));
  const eventChip = b => `<button class="space-agenda-event" data-agenda-event="${esc(b.id)}" data-status="${esc(b.status || '')}"><time>${esc(time(b.start))}</time><span>${esc(b.name)}</span></button>`;
  const renderMonth = () => `<div class="space-cal-month" data-agenda-month><div class="space-cal-weekdays">${['DOM','SEG','TER','QUA','QUI','SEX','SAB'].map(d=>`<span>${d}</span>`).join('')}</div><div class="space-cal-grid">${visibleMonthDays().map(d=>{const other=d.getMonth()!==state.cursor.getMonth(); const ev=eventsFor(d); return `<article class="space-cal-day ${other?'muted':''}"><strong>${d.getDate()}</strong><div>${ev.slice(0,3).map(eventChip).join('')}${ev.length>3?`<small>+${ev.length-3} eventos</small>`:''}</div></article>`;}).join('')}</div></div>`;
  const renderWeek = () => { const days=visibleWeekDays(); const hours=Array.from({length:14},(_,i)=>8+i); return `<div class="space-cal-week" data-agenda-week><div class="space-cal-time-head"></div>${days.map(d=>`<div class="space-cal-week-head"><strong>${d.toLocaleDateString('pt-BR',{weekday:'short'})}</strong><span>${d.getDate()}</span></div>`).join('')}${hours.map(h=>`<div class="space-cal-hour">${String(h).padStart(2,'0')}:00</div>${days.map(d=>{const ev=eventsFor(d).filter(b=>new Date(b.start).getHours()===h); return `<div class="space-cal-slot">${ev.map(eventChip).join('')}</div>`;}).join('')}`).join('')}</div>`; };
  const renderUpcoming = () => { const now=Date.now(); const next=bookings().filter(b=>Date.parse(b.start)>=now).slice(0,6); return `<aside class="space-agenda-side"><h2>Próximos</h2>${next.map(b=>`<button class="space-agenda-next" data-agenda-event="${esc(b.id)}"><time>${esc(date(b.start))}</time><strong>${esc(b.name)}</strong><span>${esc(b.statusLabel)} · ${esc(b.source)}</span></button>`).join('') || '<p>Nenhum próximo agendamento.</p>'}</aside>`; };
  const renderDetail = () => { const b=bookings().find(x=>x.id===state.detailId); if(!b)return ''; return `<div class="space-agenda-drawer"><div class="space-agenda-backdrop" data-agenda-close></div><aside><header><div><h2>${esc(b.name)}</h2><p>${esc(date(b.start))}</p></div><button data-agenda-close>×</button></header><dl><dt>Telefone</dt><dd>${esc(b.phone || '—')}</dd><dt>Closer/consultor</dt><dd>${esc(b.hostName || b.consultant || b.sdrName || '—')}</dd><dt>Origem</dt><dd>${esc(b.source)}</dd><dt>Status</dt><dd>${esc(b.statusLabel)}</dd><dt>Observações</dt><dd>${esc(b.notes || b.context || '—')}</dd></dl><div class="space-agenda-actions"><button data-agenda-close>Fechar</button>${b.voiceCallId?`<button data-panel-target="space-phone">Voltar para ligação</button>`:''}</div></aside></div>`; };
  const renderModal = () => state.modal ? `<div class="space-agenda-modal"><div class="space-agenda-backdrop" data-agenda-modal-close></div><section><header><div><h2>Novo agendamento</h2><p>Use o booking atual do Cal.com sem sair da Space.</p></div><button data-agenda-modal-close>×</button></header><p role="status" data-agenda-status>${esc(state.status)}</p><div class="space-agenda-contact-summary" data-agenda-summary ${state.contactReady?'':'hidden'}><div><strong data-agenda-name></strong><span data-agenda-phone></span></div><button type="button" data-agenda-edit>Alterar contato</button></div><form data-agenda-contact class="space-agenda-contact" ${state.contactReady?'hidden':''}><label>Nome<input name="name" required maxlength="160" autocomplete="off" value="${esc(state.context?.prefill?.name || '')}"></label><label>Telefone internacional<input name="attendeePhoneNumber" type="tel" required pattern="[+]?[0-9 () .-]{8,24}" placeholder="+55 34 99999-9999" autocomplete="tel" value="${esc(state.context?.prefill?.attendeePhoneNumber || '')}"></label><button type="submit">Ver horários disponíveis</button></form><div id="space-cal-calendar" data-agenda-embed ${state.contactReady?'':'hidden'}></div></section></div>` : '';
  function render() {
    const el=root(); if(!el)return;
    el.innerHTML=`<div class="space-agenda"><header class="space-agenda-header"><div><h1>Agenda</h1><p>Calendário operacional de reuniões comerciais.</p></div><nav><button data-agenda-today>Hoje</button><button data-agenda-prev>‹</button><strong>${esc(monthLabel(state.cursor))}</strong><button data-agenda-next>›</button><span><button class="${state.view==='month'?'active':''}" data-agenda-view="month">Mês</button><button class="${state.view==='week'?'active':''}" data-agenda-view="week">Semana</button></span><button class="primary" data-agenda-new>+ Novo agendamento</button><button type="button" data-panel-target="space-phone">← Ligações</button></nav></header><main class="space-agenda-layout"><section class="space-agenda-calendar">${state.view==='week'?renderWeek():renderMonth()}</section>${renderUpcoming()}</main>${renderDetail()}${renderModal()}</div>`;
  }
  async function open() {
    const el=root();if(!el||loading)return;
    const active=window.SpacePhone?.getState?.();
    const callId=selectedCallId || (['connecting','ringing','active','hold'].includes(active?.status)?active.callRecord?.id:null) || mountedCallId || '';
    mountedCallId=callId; loading=true; ++generation; render();
    try { await refresh(callId); } catch(e) { state.status=e.message; render(); } finally { loading=false; }
  }
  async function openNewModal() {
    const callId=mountedCallId || selectedCallId || '';
    state.modal=true; state.contactReady=false; state.status=''; render();
    try { state.context=await request({}, {action:'context',callId:callId||undefined}); render(); } catch(e) { state.status=e.message; render(); }
  }
  function mountCalendar(event){
    event?.preventDefault(); const el=root(); const form=el?.querySelector('[data-agenda-contact]'); if(!form||!form.reportValidity())return;
    const contact={name:form.elements.name.value.trim(),attendeePhoneNumber:form.elements.attendeePhoneNumber.value.trim()}; if(!contact.name||!contact.attendeePhoneNumber)return;
    state.contactReady=true; render(); root().querySelector('[data-agenda-name]').textContent=contact.name; root().querySelector('[data-agenda-phone]').textContent=contact.attendeePhoneNumber;
    sdk(); const ns=`space-agenda-${++state.mountCount}`; window.Cal('init',ns,{origin:'https://cal.com'}); const cal=window.Cal.ns[ns];
    cal('on',{action:'bookingSuccessfulV2',callback:async event=>{const uid=event.detail?.data?.uid;if(!uid)return; state.status='Confirmando agendamento com o calendário…'; render(); try{const result=await request({}, {action:'sync',uid}); state.status=message(result.booking); state.modal=false; await refresh(mountedCallId);}catch{state.status='Agendamento recebido pelo calendário. Confirmação na Space pendente de sincronização.'; render();}}});
    cal('inline',{elementOrSelector:'#space-cal-calendar',calLink:state.context?.calLink,config:{theme:'dark',layout:'month_view',...contact,'metadata[spaceBookingContext]':state.context?.contextId}});
    cal('ui',{hideEventTypeDetails:false,layout:'month_view'});
  }
  document.addEventListener('click', async e => {
    const t=e.target.closest('[data-agenda-view],[data-agenda-prev],[data-agenda-next],[data-agenda-today],[data-agenda-new],[data-agenda-event],[data-agenda-close],[data-agenda-modal-close],[data-agenda-edit]'); if(!t||!root()?.contains(t))return;
    if(t.matches('[data-agenda-view]')){state.view=t.dataset.agendaView;render();}
    if(t.matches('[data-agenda-prev]')){state.cursor=state.view==='week'?new Date(state.cursor.getFullYear(),state.cursor.getMonth(),state.cursor.getDate()-7):addMonths(state.cursor,-1);render();}
    if(t.matches('[data-agenda-next]')){state.cursor=state.view==='week'?new Date(state.cursor.getFullYear(),state.cursor.getMonth(),state.cursor.getDate()+7):addMonths(state.cursor,1);render();}
    if(t.matches('[data-agenda-today]')){state.cursor=new Date();render();}
    if(t.matches('[data-agenda-new]')) await openNewModal();
    if(t.matches('[data-agenda-event]')){state.detailId=t.dataset.agendaEvent;render();}
    if(t.matches('[data-agenda-close]')){state.detailId='';render();}
    if(t.matches('[data-agenda-modal-close]')){state.modal=false;state.contactReady=false;render();}
    if(t.matches('[data-agenda-edit]')){state.contactReady=false;render();}
  });
  document.addEventListener('submit', e => { if(e.target.matches('[data-agenda-contact]'))mountCalendar(e); });
  const style=document.createElement('style');style.textContent=`
    [data-space-agenda]{width:100%;min-width:0;color:var(--text-primary,#f4f6fa)}.space-agenda{display:grid;gap:16px}.space-agenda-header{display:flex;align-items:center;justify-content:space-between;gap:16px}.space-agenda-header h1{margin:0;font-size:28px}.space-agenda-header p,[data-agenda-status]{color:#a7b3c5;font-size:13px}.space-agenda-header nav{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.space-agenda button{border:1px solid #ffffff20;background:#151f2b;color:#fff;border-radius:10px;padding:9px 12px;cursor:pointer}.space-agenda button.primary,.space-agenda button.active{background:#f4f6fa;color:#0d1520}.space-agenda-layout{display:grid;grid-template-columns:minmax(0,1fr) 280px;gap:14px}.space-agenda-calendar,.space-agenda-side,.space-agenda-modal section,.space-agenda-drawer aside{background:#101821;border:1px solid #ffffff14;border-radius:18px}.space-agenda-calendar{padding:12px;overflow:auto}.space-cal-weekdays,.space-cal-grid{display:grid;grid-template-columns:repeat(7,minmax(120px,1fr));gap:6px}.space-cal-weekdays span{color:#7f8da0;font-size:12px;font-weight:800;padding:0 6px 6px}.space-cal-day{min-height:122px;background:#0d141d;border:1px solid #ffffff10;border-radius:14px;padding:8px;display:grid;align-content:start;gap:6px}.space-cal-day.muted{opacity:.42}.space-cal-day strong{font-size:13px}.space-agenda-event{width:100%;display:flex;align-items:center;gap:6px;padding:5px 7px;border-radius:8px;background:#172332;font-size:12px;text-align:left}.space-agenda-event time{color:#a7b3c5}.space-agenda-event[data-status="cancelled"]{opacity:.55}.space-agenda-event[data-status="confirmed"]{border-color:#7dd3a844}.space-cal-week{display:grid;grid-template-columns:58px repeat(7,minmax(130px,1fr));gap:4px;min-width:980px}.space-cal-week-head,.space-cal-time-head{position:sticky;top:0;background:#101821;z-index:1}.space-cal-week-head{padding:8px;text-align:center;border-bottom:1px solid #ffffff14}.space-cal-week-head span{display:block;color:#a7b3c5}.space-cal-hour{color:#7f8da0;font-size:12px;text-align:right;padding:8px 6px}.space-cal-slot{min-height:58px;border-top:1px solid #ffffff0f;background:#0d141d;padding:4px}.space-agenda-side{padding:14px;display:grid;align-content:start;gap:8px}.space-agenda-side h2{font-size:14px;margin:0}.space-agenda-next{display:grid;text-align:left;gap:3px}.space-agenda-next time,.space-agenda-next span{font-size:12px;color:#a7b3c5}.space-agenda-drawer,.space-agenda-modal{position:fixed;inset:0;z-index:10030}.space-agenda-backdrop{position:absolute;inset:0;background:rgba(0,0,0,.62)}.space-agenda-drawer aside{position:absolute;right:0;top:0;height:100dvh;width:min(440px,100vw);padding:18px;display:grid;align-content:start;gap:14px}.space-agenda-drawer header,.space-agenda-modal header{display:flex;justify-content:space-between;gap:12px}.space-agenda-drawer dl{display:grid;grid-template-columns:120px 1fr;gap:10px}.space-agenda-drawer dt{color:#7f8da0}.space-agenda-actions{display:flex;gap:8px}.space-agenda-modal{display:grid;place-items:center;padding:18px}.space-agenda-modal section{position:relative;width:min(900px,100%);max-height:90dvh;overflow:auto;padding:18px}.space-agenda-contact{display:grid;grid-template-columns:1fr 1fr auto;gap:10px;align-items:end;margin:12px 0}.space-agenda-contact label{display:grid;gap:6px;color:#a7b3c5;font-size:12px}.space-agenda-contact input{background:#1b2635;color:#fff;border:1px solid #ffffff26;border-radius:9px;padding:11px}.space-agenda-contact[hidden],[data-agenda-embed][hidden],.space-agenda-contact-summary[hidden]{display:none}[data-agenda-embed]{min-height:620px;border:1px solid #ffffff14;border-radius:16px;overflow:auto}.space-agenda-contact-summary{display:flex;justify-content:space-between;align-items:center;margin:12px 0;padding:12px;background:#0d141d;border-radius:14px}@media(max-width:900px){.space-agenda-layout{grid-template-columns:1fr}.space-agenda-side{order:-1}.space-cal-weekdays,.space-cal-grid{grid-template-columns:1fr}.space-cal-day{min-height:auto}.space-cal-day.muted{display:none}.space-agenda-contact{grid-template-columns:1fr}.space-agenda-header{align-items:flex-start;flex-direction:column}}
  `;document.head.appendChild(style);
  window.SpaceAgenda={open,forCall(id){selectedCallId=id||null;},refresh,message,get: id=>cache.get(id)};
  setInterval(()=>{if(document.body.dataset.activePanel==='space-agenda')refresh(mountedCallId).catch(()=>{});},15000);
  if(document.body?.dataset.initialPanel==='space-agenda')open();
})();
