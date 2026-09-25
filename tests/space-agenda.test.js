const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');const {JSDOM}=require('jsdom');
const tick=()=>new Promise(r=>setTimeout(r,20));
function setup(t){
 const dom=new JSDOM('<body data-active-panel="space-agenda"><div data-space-agenda></div></body>',{url:'https://space.test/app/admin/comercial/pre-vendas/agenda',runScripts:'outside-only'});t.after(()=>dom.window.close());
 const calls=[];let confirmation=false;
 dom.window.fetchWithAuth=async(url,opt)=>{const body=opt?.body?JSON.parse(opt.body):null;calls.push({url,body});return {ok:true,json:async()=>body?.action==='context'?{contextId:'server-context',calLink:'team/closers-space-idiomas/reuniao-com-mentor-do-space',prefill:{}}:body?.action==='sync'?{booking:{bookingConfirmed:confirmation,status:confirmation?'confirmed':'pending',bookingStartAt:'2026-10-01T13:00:00Z'}}:{bookings:[],syncAvailable:true}};};
 dom.window.eval(fs.readFileSync('space-agenda.js','utf8'));return {dom,calls,confirm:()=>confirmation=true};
}
test('Agenda uses official embed and opaque server context; browser accepted status cannot confirm',async t=>{
 const h=setup(t),w=h.dom.window;w.SpaceAgenda.forCall('call-1');await w.SpaceAgenda.open();
 const form=w.document.querySelector('[data-agenda-contact]');form.elements.name.value='Test Contact';form.elements.email.value='contact@example.test';form.dispatchEvent(new w.Event('submit',{cancelable:true}));
 const ns=Object.values(w.Cal.ns)[0],config=ns.q.find(a=>a[0]==='inline')[1];assert.equal(config.calLink,'team/closers-space-idiomas/reuniao-com-mentor-do-space');assert.equal(config.config['metadata[spaceBookingContext]'],'server-context');assert.equal(config.config.metadata,undefined);
 const cb=ns.q.find(a=>a[0]==='on')[1].callback;
 await cb({detail:{data:{uid:'real-booking',status:'ACCEPTED'}}});assert.doesNotMatch(w.document.querySelector('[data-agenda-status]').textContent,/Reunião agendada ✓/);
 h.confirm();await cb({detail:{data:{uid:'real-booking',status:'ACCEPTED'}}});assert.match(w.document.querySelector('[data-agenda-status]').textContent,/Reunião agendada ✓/);
 assert.equal(h.calls.find(x=>x.body?.action==='sync').body.uid,'real-booking');
});
test('returning to Agenda retains embed and call context without remount',async t=>{
 const h=setup(t),w=h.dom.window;await w.SpaceAgenda.open();const embed=w.document.querySelector('[data-agenda-embed]');await w.SpaceAgenda.open();assert.equal(w.document.querySelector('[data-agenda-embed]'),embed);assert.equal(h.calls.filter(x=>x.body?.action==='context').length,1);
});
