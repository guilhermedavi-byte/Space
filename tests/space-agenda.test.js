const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');const {JSDOM}=require('jsdom');
const tick=()=>new Promise(r=>setTimeout(r,20));
function setup(t){
 const dom=new JSDOM('<body data-active-panel="space-agenda"><div data-space-agenda></div></body>',{url:'https://space.test/app/admin/comercial/pre-vendas/agenda',runScripts:'outside-only'});t.after(()=>dom.window.close());
 const calls=[];let confirmation=false;
 dom.window.fetchWithAuth=async(url,opt)=>{const body=opt?.body?JSON.parse(opt.body):null;calls.push({url,body});return {ok:true,json:async()=>body?.action==='context'?{contextId:'server-context',calLink:'team/closers-space-idiomas/reuniao-com-mentor-do-space',prefill:{}}:body?.action==='sync'?{booking:{id:'b1',bookingConfirmed:confirmation,status:confirmation?'confirmed':'pending',bookingStartAt:'2026-10-01T13:00:00Z'}}:body?.action==='premeeting_notifications'?{notifications:[]}:{scope:'self',bookings:[],syncAvailable:true}};};
 dom.window.eval(fs.readFileSync('space-agenda.js','utf8'));return {dom,calls,confirm:()=>confirmation=true};
}
test('Agenda uses official embed and opaque server context; browser accepted status cannot confirm',async t=>{
 const h=setup(t),w=h.dom.window;w.SpaceAgenda.forCall('call-1');await w.SpaceAgenda.open();
 w.document.querySelector('[data-agenda-new]').click();await tick();
 const form=w.document.querySelector('[data-agenda-contact]');form.elements.name.value='Test Contact';form.elements.attendeePhoneNumber.value='+5534999569129';form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
 assert.equal(form.querySelector('[name=email]'),null);
 const ns=Object.values(w.Cal.ns)[0],config=ns.q.find(a=>a[0]==='inline')[1];assert.equal(config.calLink,'team/closers-space-idiomas/reuniao-com-mentor-do-space');assert.equal(config.config['metadata[spaceBookingContext]'],'server-context');assert.equal(config.config.metadata,undefined);assert.equal(config.config.email,undefined);assert.equal(config.config.attendeePhoneNumber,'+5534999569129');
 const cb=ns.q.find(a=>a[0]==='on')[1].callback;
 await cb({detail:{data:{uid:'real-booking',status:'ACCEPTED'}}});assert.doesNotMatch(w.document.body.textContent,/Reunião agendada ✓/);
 h.confirm();await cb({detail:{data:{uid:'real-booking',status:'ACCEPTED'}}});assert.match(w.document.body.textContent,/Reunião agendada ✓|Alteração salva|Confirmando/);
 assert.equal(h.calls.find(x=>x.body?.action==='sync').body.uid,'real-booking');
});
test('returning to Agenda keeps calendar shell and creates context only when booking modal opens',async t=>{
 const h=setup(t),w=h.dom.window;await w.SpaceAgenda.open();assert.ok(w.document.querySelector('[data-agenda-month]'));
 await w.SpaceAgenda.open();assert.equal(h.calls.filter(x=>x.body?.action==='context').length,0);
 w.document.querySelector('[data-agenda-new]').click();await tick();assert.equal(h.calls.filter(x=>x.body?.action==='context').length,1);
});
test('Agenda renders day week month, summary, drawer actions and premeeting alert',async t=>{
 const dom=new JSDOM('<body data-active-panel="space-agenda"><div data-space-agenda></div></body>',{url:'https://space.test/app/admin/comercial/pre-vendas/agenda',runScripts:'outside-only'});t.after(()=>dom.window.close());
 const start=new Date(Date.now()+4*60000).toISOString();
 dom.window.fetchWithAuth=async(url,opt)=>{const body=opt?.body?JSON.parse(opt.body):null;return {ok:true,json:async()=>body?.action==='premeeting_notifications'?{notifications:[{id:'b1',status:'confirmed',bookingStartAt:start,attendeeName:'Lead QA',attendeePhone:'+15551234567'}]}:{scope:'admin',bookings:[{id:'b1',status:'confirmed',bookingStartAt:start,attendeeName:'Lead QA',attendeePhone:'+15551234567',sdrUid:'sdr-1',hostName:'Luana',calendarSyncStatus:'pending'}],syncAvailable:true}};};
 dom.window.eval(fs.readFileSync('space-agenda.js','utf8'));await dom.window.SpaceAgenda.open();
 assert.match(dom.window.document.querySelector('.space-agenda-summary').textContent,/1 agendamentos/);
 dom.window.document.querySelector('[data-agenda-view="week"]').click();await tick();assert.ok(dom.window.document.querySelector('[data-agenda-week]'));
 dom.window.document.querySelector('[data-agenda-view="day"]').click();await tick();assert.ok(dom.window.document.querySelector('.space-cal-day-view'));
 await tick(40);assert.match(dom.window.document.body.textContent,/Reunião em 5 minutos/);
 dom.window.document.querySelector('[data-agenda-event="b1"]').click();assert.match(dom.window.document.querySelector('.space-agenda-drawer').textContent,/Confirmar/);assert.ok(dom.window.document.querySelector('a[href^="tel:"]'));assert.ok(dom.window.document.querySelector('a[href^="https://wa.me/"]'));
});
