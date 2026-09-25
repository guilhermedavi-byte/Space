(function () {
  if (window.SpaceAgenda) return;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const date = value => value ? new Date(value).toLocaleString('pt-BR') : '';
  const message = b => !b ? 'Reunião ainda não confirmada na agenda' : b.bookingConfirmed ? `Reunião agendada ✓ · ${date(b.bookingStartAt)}` : ({cancelled:'Reunião cancelada',rescheduled:'Reunião reagendada',pending:'Agendamento aguardando confirmação'}[b.status] || 'Aguardando confirmação');
  const request = async (params = {}, body) => {
    const url = '/api/commercial-bookings?' + new URLSearchParams(params);
    const res = await window.fetchWithAuth(url, body ? {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)} : {});
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error('Não foi possível sincronizar a agenda agora. Tente novamente.');
    return data;
  };
  const cache = new Map();
  let selectedCallId = null, mountedCallId, generation = 0, loading = false;
  const root = () => document.querySelector('[data-space-agenda]');
  async function refresh(callId) {
    const data = await request(callId ? {callId} : {});
    if(callId) {
      const current = data.bookings.find(b=>b.status !== 'rescheduled') || data.bookings[0] || null;
      cache.set(callId,current);
      window.dispatchEvent(new CustomEvent('space-bookings:updated',{detail:{callId,booking:current}}));
    }
    const list=root()?.querySelector('[data-agenda-list]');
    if(list)list.innerHTML=data.bookings.length?data.bookings.map(b=>`<article class="space-agenda-booking"><strong>${esc(b.attendeeName || 'Reunião')}</strong><span>${esc(message(b))}</span></article>`).join(''):'<p>Nenhum agendamento neste contexto.</p>';
    return data;
  }
  function sdk() {
    if(window.Cal)return;
    const cal=function(){const args=arguments;if(args[0]==='init'&&typeof args[1]==='string'){const ns=args[1];if(!cal.ns[ns]){const api=function(){api.q.push(arguments);};api.q=[];cal.ns[ns]=api;}cal.ns[ns].q.push(args);cal.q.push(['initNamespace',ns]);}else cal.q.push(args);};
    cal.q=[];cal.ns={};window.Cal=cal;
    const script=document.createElement('script');script.src='https://app.cal.com/embed/embed.js';script.async=true;
    script.onerror=()=>{const el=root()?.querySelector('[data-agenda-status]');if(el)el.textContent='Não foi possível carregar o calendário. Tente novamente.';delete window.Cal;mountedCallId=undefined;};
    document.head.appendChild(script);cal('init',{origin:'https://cal.com'});
  }
  async function open() {
    const el=root();if(!el||loading)return;
    const active=window.SpacePhone?.getState?.();
    const callId=selectedCallId || (['connecting','ringing','active','hold'].includes(active?.status)?active.callRecord?.id:null) || mountedCallId || '';
    if(mountedCallId===callId&&el.querySelector('[data-agenda-embed]')){refresh(callId).catch(()=>{});return;}
    loading=true;const turn=++generation;
    el.innerHTML='<header class="space-agenda-header"><div><small>COMERCIAL / PRÉ-VENDAS</small><h1>Agenda</h1><p>Escolha o melhor horário para a reunião. Sua ligação continua ativa.</p></div><button type="button" data-panel-target="space-phone">Voltar para Ligações</button></header><p role="status" data-agenda-status>Preparando agenda…</p><form data-agenda-contact class="space-agenda-contact"><strong>Contato que receberá o convite</strong><label>Nome<input name="name" required maxlength="160" autocomplete="off"></label><label>E-mail<input name="email" type="email" required maxlength="254" autocomplete="off"></label><label>Telefone<input name="attendeePhoneNumber" type="tel" autocomplete="off"></label><button type="submit">Abrir calendário para este contato</button></form><div id="space-cal-calendar" data-agenda-embed hidden></div><section><h2>Agendamentos</h2><div data-agenda-list></div></section>';
    try {
      const ctx=await request({}, {action:'context',callId:callId||undefined});
      if(turn!==generation)return;
      const form=el.querySelector('[data-agenda-contact]');
      for(const field of ['name','email','attendeePhoneNumber']) form.elements[field].value=ctx.prefill[field] || '';
      const mountCalendar=event=>{
      event.preventDefault();
      if(!form.reportValidity())return;
      const contact={name:form.elements.name.value.trim(),email:form.elements.email.value.trim(),attendeePhoneNumber:form.elements.attendeePhoneNumber.value.trim()};
      if(!contact.name || !contact.email)return;
      form.hidden=true;el.querySelector('[data-agenda-embed]').hidden=false;
      sdk();const ns=`space-agenda-${turn}`;window.Cal('init',ns,{origin:'https://cal.com'});const cal=window.Cal.ns[ns];
      cal('on',{action:'bookingSuccessfulV2',callback:async event=>{
        const uid=event.detail?.data?.uid;if(!uid||turn!==generation)return;
        const status=el.querySelector('[data-agenda-status]');status.textContent='Confirmando agendamento com o calendário…';
        try {
          const result=await request({}, {action:'sync',uid});
          if(turn!==generation)return;
          status.textContent=message(result.booking);
          await refresh(callId);
        }catch{status.textContent='Agendamento recebido pelo calendário. Confirmação na Space pendente de sincronização.';}
      }});
      cal('inline',{elementOrSelector:'#space-cal-calendar',calLink:ctx.calLink,config:{theme:'dark',layout:'month_view',...contact,'metadata[spaceBookingContext]':ctx.contextId}});
      cal('ui',{hideEventTypeDetails:false,layout:'month_view'});
      };
      form.addEventListener('submit',mountCalendar);
      mountedCallId=callId;el.querySelector('[data-agenda-status]').textContent=callId?'Agenda vinculada à ligação selecionada.':'';
      await refresh(callId);
    }catch(e){el.querySelector('[data-agenda-status]').textContent=e.message;mountedCallId=undefined;}
    finally{loading=false;}
  }
  const style=document.createElement('style');style.textContent=`
    [data-space-agenda]{width:100%;min-width:0;color:var(--text-primary,#f4f6fa)}
    .space-agenda-header{display:flex;justify-content:space-between;align-items:center;gap:20px;margin-bottom:20px}
    .space-agenda-header small{font-size:11px;letter-spacing:.1em;color:#93a4b9}.space-agenda-header h1{margin:8px 0;font-size:30px}
    .space-agenda-header p,[data-agenda-status]{color:#a7b3c5;font-size:14px}
    .space-agenda-header button{border:1px solid #ffffff20;background:#1b2635;color:#fff;border-radius:10px;padding:11px 16px;cursor:pointer}
    [data-agenda-embed]{width:100%;min-height:760px;overflow:auto;background:#101821;border:1px solid #ffffff14;border-radius:18px}
    .space-agenda-contact{display:flex;flex-wrap:wrap;align-items:end;gap:16px;padding:22px;background:#101821;border:1px solid #ffffff14;border-radius:16px;margin-bottom:20px}.space-agenda-contact[hidden]{display:none}.space-agenda-contact strong{flex-basis:100%}.space-agenda-contact label{display:grid;gap:6px;font-size:13px;flex:1;min-width:180px}.space-agenda-contact input{background:#1b2635;color:#fff;border:1px solid #ffffff26;border-radius:9px;padding:11px;min-width:0}.space-agenda-contact button{background:#ff5d55;color:#190807;border:0;border-radius:9px;padding:12px;cursor:pointer;font-weight:700}[data-agenda-embed][hidden]{display:none}
    .space-agenda-booking{display:flex;justify-content:space-between;gap:16px;padding:16px;border-bottom:1px solid #ffffff14}.space-agenda-booking span{color:#aab9c9}
    @media(max-width:700px){.space-agenda-header{align-items:flex-start;flex-direction:column}[data-agenda-embed]{min-height:850px}.space-agenda-booking{flex-direction:column}}
  `;document.head.appendChild(style);
  window.SpaceAgenda={open,forCall(id){selectedCallId=id||null;},refresh,message,get: id=>cache.get(id)};
  // Refresh durable confirmation while the module is visible; never rebuild the embed.
  setInterval(()=>{if(document.body.dataset.activePanel==='space-agenda')refresh(mountedCallId).catch(()=>{});},15000);
  if(document.body?.dataset.initialPanel==='space-agenda')open();
})();
