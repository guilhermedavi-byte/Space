const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {JSDOM}=require('jsdom');
const flush=()=>new Promise(r=>setTimeout(r,20));
async function setup(t,scope='growth'){
 const dom=new JSDOM('<body data-active-panel="space-phone"><section data-panel="space-phone"><div data-space-phone></div></section></body>',{url:`https://space.test/app/${scope}/comercial/pre-vendas/ligacoes`,runScripts:'outside-only',pretendToBeVisual:true});
 t.after(()=>dom.window.close());const w=dom.window,reads=[],intervals=[],timeouts=[],writes=[];
 w.__SPACE_SESSION__={role:scope};w.setInterval=(fn,ms)=>{intervals.push({fn,ms});return 1;};w.setTimeout=(fn,ms)=>{timeouts.push({fn,ms});return 1;};
 const own={id:'own-call',sdrUid:'self',name:'Own lead',number:'+14075550100',callbackAt:new Date(Date.now()-600000).toISOString()};
 w.fetchWithAuth=async(url,options={})=>{
  const q=new URL(url,'https://space.test').searchParams;reads.push(q);if(options.method)writes.push(options);
  const rate={percent:0,numerator:0,denominator:0};
  const data=q.get('view')==='conversion'?{conversion:{attendance:rate,callToBooking:rate,answeredToBooking:rate,bookingToDone:rate,ranking:scope==='admin'?[]:undefined}}:q.get('view')==='callback-notifications'?{callbacks:scope==='admin'?[]:[own]}:q.get('view')==='callbacks'?{callbacks:[own,{...own,id:'other-call',name:'Other SDR lead'}]}:{scope,selectedSdr:q.get('sdr')||'all',sdrs:[{uid:'luana',displayName:'Luana Mendonça'}],analytics:{},calls:[],callbacks:[own]};
  return {ok:true,json:async()=>data};
 };
 w.eval(fs.readFileSync('space-phone.js','utf8'));await w.SpacePhoneModule.open();await flush();return {w,reads,intervals,timeouts,writes,own};
}
test('Admin manager has no dialer/operator UI; ranking follows history; filter applies Admin SDR and period',async t=>{
 const {w,reads}=await setup(t,'admin'),d=w.document;
 assert.equal(d.querySelector('[data-sp-call]'),null);assert.equal(d.querySelector('.sphone-online'),null);assert.equal(d.querySelector('.sphone-grid'),null);
 assert.ok(d.querySelector('.sphone-history').compareDocumentPosition(d.querySelector('[data-sp-ranking]'))&w.Node.DOCUMENT_POSITION_FOLLOWING);
 assert.equal(d.querySelector('[data-sp-conversion-ranking]').open,false);
 assert.equal(d.querySelector('#sphone-filter-panel').hidden,true);d.querySelector('[data-sp-filter-toggle]').click();assert.equal(d.querySelector('#sphone-filter-panel').hidden,false);
 const sdr=d.querySelector('[data-sp-sdr]');sdr.value='luana';sdr.dispatchEvent(new w.Event('change',{bubbles:true}));await flush();
 const period=d.querySelector('[data-sp-period]');period.value='today';period.dispatchEvent(new w.Event('change',{bubbles:true}));await flush();
 assert.ok(reads.some(q=>q.get('sdr')==='luana'&&q.get('period')==='today'));
 d.querySelector('[data-sp-period]').dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert.equal(d.querySelector('#sphone-filter-panel').hidden,true);
 assert.equal(d.activeElement,d.querySelector('[data-sp-filter-toggle]'));
});
test('Growth operator remains available, no SDR selector; notifications use separate self API; dismiss never writes/cancels',async t=>{
 const {w,reads,timeouts,intervals,writes}=await setup(t),d=w.document;
 assert.ok(d.querySelector('[data-sp-call]'));assert.equal(d.querySelector('[data-sp-sdr]'),null);
 d.body.dataset.activePanel='space-agenda';await timeouts.find(x=>x.ms===1500).fn();
 assert.ok(reads.some(q=>q.get('view')==='callback-notifications'&&!q.has('sdr')));
 assert.match(d.querySelector('#space-callback-alert').textContent,/Own lead/);assert.doesNotMatch(d.querySelector('#space-callback-alert').textContent,/Other SDR/);
 d.querySelector('[data-callback-dismiss]').click();assert.equal(d.querySelector('#space-callback-alert'),null);intervals.find(x=>x.ms===1000).fn();assert.equal(d.querySelector('#space-callback-alert'),null);assert.equal(writes.length,0);assert.ok(w.sessionStorage.getItem('spaceCallbackDismissed'));
});
test('Admin management callbacks do not become operational alerts',async t=>{
 const {w,timeouts}=await setup(t,'admin');w.document.body.dataset.activePanel='space-agenda';await timeouts.find(x=>x.ms===1500).fn();assert.equal(w.document.querySelector('#space-callback-alert'),null);
});
