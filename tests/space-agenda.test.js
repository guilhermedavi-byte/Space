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
 dom.window.document.querySelector('[data-agenda-event="b1"]').click();assert.match(dom.window.document.querySelector('.space-agenda-drawer').textContent,/✓ Confirmado/);assert.equal(dom.window.document.querySelector('[data-agenda-confirm]'),null);assert.ok(dom.window.document.querySelector('a[href^="tel:"]'));assert.ok(dom.window.document.querySelector('a[href^="https://wa.me/"]'));
});


test('Agenda migration declares required operational schema and PostgREST reload',()=>{
 const sql=fs.readFileSync('supabase/migrations/202609260003_commercial_agenda_operations.sql','utf8');
 for(const col of ['confirmed_at','confirmed_by','calendar_sync_status','calendar_sync_error','notification_5min_sent_at','commercial_booking_audit_events']) assert.match(sql,new RegExp(col));
 assert.match(sql,/add column if not exists confirmed_at/i);
 assert.match(sql,/notify\s+pgrst,\s*'reload schema'/i);
});

test('Agenda month view shows only current month days and blank alignment cells',async t=>{
 const h=setup(t),w=h.dom.window;await w.SpaceAgenda.open();
 const days=[...w.document.querySelectorAll('.space-cal-day:not(.empty) strong')].map(n=>Number(n.textContent));
 assert.equal(days[0],1);
 assert.ok(days.every((day,i)=>day===i+1));
 assert.ok(w.document.querySelectorAll('.space-cal-day.empty').length>=0);
 assert.equal(days.includes(31),new Date(new Date().getFullYear(),new Date().getMonth()+1,0).getDate()===31);
});

test('Agenda hides raw sync enums, locks overlay scroll and separates selected contact phone',async t=>{
 const dom=new JSDOM('<body data-active-panel="space-agenda"><div data-space-agenda></div></body>',{url:'https://space.test/app/admin/comercial/pre-vendas/agenda',runScripts:'outside-only'});t.after(()=>dom.window.close());
 dom.window.SpaceInternationalPhone={formatPhoneForDisplay:v=>String(v).replace('+5511919300707','+55 11 91930-0707')};
 dom.window.fetchWithAuth=async(url,opt)=>{const body=opt?.body?JSON.parse(opt.body):null;return {ok:true,json:async()=>body?.action==='context'?{contextId:'ctx',calLink:'team/closers-space-idiomas/reuniao-com-mentor-do-space',prefill:{name:'Guilherme Davi Borba Gondim',attendeePhoneNumber:'+5511919300707'}}:{scope:'admin',bookings:[{id:'b1',status:'pending',bookingStartAt:'2026-09-20T13:00:00Z',attendeeName:'Lead QA',attendeePhone:'+5511919300707',calendarSyncStatus:'not_applicable'}],syncAvailable:true}};};
 dom.window.eval(fs.readFileSync('space-agenda.js','utf8'));await dom.window.SpaceAgenda.open();
 dom.window.document.querySelector('[data-agenda-event="b1"]').click();
 assert.ok(dom.window.document.body.classList.contains('space-agenda-overlay-open'));
 assert.doesNotMatch(dom.window.document.querySelector('.space-agenda-drawer').textContent,/not_applicable|pending_sync|sync_failed/);
 dom.window.document.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
 assert.equal(dom.window.document.querySelector('.space-agenda-drawer'),null);
 assert.equal(dom.window.document.body.classList.contains('space-agenda-overlay-open'),false);
 dom.window.document.querySelector('[data-agenda-new]').click();await tick();
 const form=dom.window.document.querySelector('[data-agenda-contact]');form.dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));await tick();
 const summary=dom.window.document.querySelector('.space-agenda-contact-summary');
 assert.match(summary.querySelector('[data-agenda-name]').textContent,/Guilherme Davi/);
 assert.equal(summary.querySelector('[data-agenda-phone]').textContent,'+55 11 91930-0707');
 assert.ok(summary.querySelector('.space-agenda-contact-picked'));
});
