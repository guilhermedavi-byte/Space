const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

function jsonResponse(body, ok = true, status = 200) {
  return { ok, status, json: async () => ({scope:"self",...body}) };
}

function createModuleDom({ period } = {}) {
  const dom = new JSDOM('<body data-active-panel="space-phone" data-app-role="growth"><section data-panel="space-phone"><div data-space-phone></div></section></body>', {
    url: 'https://space.test/app/admin/comercial/pre-vendas/ligacoes',
    runScripts: 'outside-only',
    pretendToBeVisual: true,
  });
  const intervalIds = [];
  dom.window.setInterval = (fn, ms) => { const id = setInterval(fn, ms); id.unref?.(); intervalIds.push(id); return id; };
  dom.window.clearInterval = id => clearInterval(id);
  dom.window.navigator.mediaDevices = {
    getUserMedia: async () => ({ getTracks: () => [{ stop() {} }] }),
    enumerateDevices: async () => [
      { kind: 'audioinput', deviceId: 'mic-1', label: 'Mic' },
      { kind: 'audiooutput', deviceId: 'spk-1', label: 'Speaker' },
    ],
    addEventListener() {},
  };
  const calls = [];
  const fetches = [];
  let snapshot = { status: 'idle', clientReady: true, muted: false, held: false, elapsedSeconds: 0, callRecord: null, context: null, devices: { permission: 'granted' } };
  const listeners = [];
  const emit = next => { snapshot = { ...snapshot, ...next }; listeners.forEach(fn => fn(snapshot)); };
  dom.window.SpacePhone = {
    calls,
    getState: () => snapshot,
    subscribe(fn) { listeners.push(fn); fn(snapshot); return () => {}; },
    refreshDevices: async () => ({ permission: 'granted', inputs: [{ deviceId: 'mic-1', label: 'Mic' }], outputs: [{ deviceId: 'spk-1', label: 'Speaker' }] }),
    normalizePhone: raw => String(raw || '').replace(/\D+/g, '').length === 10 ? `+1${String(raw || '').replace(/\D+/g, '')}` : String(raw || '').replace(/[\s().-]+/g, ''),
    call: async payload => { calls.push({ method: 'call', payload }); emit({ status: 'connecting', context: { phoneNumber: payload.phoneNumber, source: payload.source }, callRecord: { id: 'call-1', from_number: '+16892232696', to_number: payload.phoneNumber } }); return { id: 'call-1', from_number: '+16892232696' }; },
    hangup: async () => { calls.push({ method: 'hangup' }); emit({ status: 'ended' }); },
    mute: async () => { calls.push({ method: 'mute' }); emit({ muted: true }); },
    unmute: async () => { calls.push({ method: 'unmute' }); emit({ muted: false }); },
    hold: async () => { calls.push({ method: 'hold' }); emit({ held: true }); },
    unhold: async () => { calls.push({ method: 'unhold' }); emit({ held: false }); },
    dtmf: async digit => calls.push({ method: 'dtmf', digit }),
    setAudioInputDevice: async id => calls.push({ method: 'setAudioInputDevice', id }),
    setAudioOutputDevice: async id => calls.push({ method: 'setAudioOutputDevice', id }),
  };
  dom.window.fetchWithAuth = async url => {
    fetches.push(String(url));
    if (String(url).includes('normalize=')) return jsonResponse({ ok: true, raw: '+16177942141', normalized: '+16177942141' });
    return jsonResponse({ ok: true, scope:'self', analytics: { talkTimeSeconds: 60 }, calls: [], callbacks: [] });
  };
  dom.window.__SPACE_SESSION__ = { role: 'growth', commercialRoles: ['sdr'], sub: 'sdr-1' };
  dom.window.__spacePhoneTest = { calls, fetches, emit };
  if (period !== undefined) dom.window.localStorage.setItem('spacePhonePeriod', period);
  dom.window.eval(fs.readFileSync(path.join(__dirname, '..', 'space-phone.js'), 'utf8'));
  return dom;
}

const tick = ms => new Promise(resolve => setTimeout(resolve, ms));

test('SDR module calls SpacePhone.call with phoneNumber contract', async (t) => {
  const dom = createModuleDom();
  t.after(() => dom.window.close());
  await dom.window.SpacePhoneModule.open();
  const input = dom.window.document.querySelector('[data-sp-dial]');
  input.value = '+16177942141';
  input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  await tick(300);
  dom.window.document.querySelector('[data-sp-call]').click();
  await tick(20);
  const call = dom.window.SpacePhone.calls.find(item => item.method === 'call');
  assert.deepEqual(JSON.parse(JSON.stringify(call.payload)), { phoneNumber: '+16177942141', source: 'sdr_phone', micId: '', speakerId: '' });
});



test('SDR module normalizes paste locally without network and keeps dial focus stable', async (t) => {
  const dom = createModuleDom();
  t.after(() => dom.window.close());
  await dom.window.SpacePhoneModule.open();
  const input = dom.window.document.querySelector('[data-sp-dial]');
  input.focus();
  input.value = '(617) 794-2141';
  input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  assert.equal(dom.window.SpacePhoneModule.state.normalized, '+16177942141');
  assert.equal(dom.window.document.activeElement, input);
  assert.equal(dom.window.document.querySelector('[data-sp-normalized]').textContent, 'E.164 +16177942141');
  assert.equal(dom.window.__spacePhoneTest.fetches.some(url => url.includes('normalize=')), false);
  dom.window.__spacePhoneTest.emit({ elapsedSeconds: 8 });
  assert.equal(dom.window.document.querySelector('[data-sp-dial]'), input);
});

test('SDR module gives immediate call feedback before adapter promise resolves', async (t) => {
  const dom = createModuleDom();
  t.after(() => dom.window.close());
  let resolveCall;
  dom.window.SpacePhone.call = payload => new Promise(resolve => { dom.window.SpacePhone.calls.push({ method: 'call', payload }); resolveCall = resolve; });
  await dom.window.SpacePhoneModule.open();
  const input = dom.window.document.querySelector('[data-sp-dial]');
  input.value = '+16177942141';
  input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  dom.window.document.querySelector('[data-sp-call]').click();
  await tick(0);
  assert.equal(dom.window.SpacePhoneModule.state.call.status, 'connecting');
  assert.equal(dom.window.document.querySelector('[data-sp-call]').textContent, 'Conectando...');
  resolveCall({ id: 'call-1' });
});

test('SDR module updates live talk time KPI without rebuilding the dial input', async (t) => {
  const dom = createModuleDom();
  t.after(() => dom.window.close());
  await dom.window.SpacePhoneModule.open();
  dom.window.__spacePhoneTest.emit({ status: 'active', elapsedSeconds: 1, context: { phoneNumber: '+16177942141' }, callRecord: { id: 'call-1', from_number: '+16892232696', to_number: '+16177942141' } });
  await tick(20);
  const input = dom.window.document.querySelector('[data-sp-dial]');
  dom.window.__spacePhoneTest.emit({ elapsedSeconds: 5 });
  await tick(300);
  assert.equal(dom.window.document.querySelector('[data-sp-talk-time]').textContent, '01:05');
  assert.equal(dom.window.document.querySelector('[data-sp-dial]'), input);
});

test('SDR module controls call the public SpacePhone adapter methods', async (t) => {
  const dom = createModuleDom();
  t.after(() => dom.window.close());
  await dom.window.SpacePhoneModule.open();
  dom.window.SpacePhoneModule.state.call = { ...dom.window.SpacePhoneModule.state.call, status: 'active', number: '+16177942141', id: 'call-1' };
  dom.window.SpacePhoneModule.state.normalized = '+16177942141';
  dom.window.SpacePhoneModule.state.dial = '+16177942141';
  dom.window.SpacePhoneModule.open();
  await tick(20);
  dom.window.document.querySelector('[data-sp-mute]').click();
  await tick(10);
  dom.window.document.querySelector('[data-sp-mute]').click();
  await tick(10);
  dom.window.document.querySelector('[data-sp-hold]').click();
  await tick(10);
  dom.window.document.querySelector('[data-sp-hold]').click();
  await tick(10);
  assert.equal(dom.window.document.querySelector('[data-sp-dtmf-toggle]'), null);
  assert.ok(dom.window.document.querySelector('a[title="Teclado"]'));
  dom.window.document.querySelector('[data-sp-hangup]').click();
  await tick(10);
  const methods = dom.window.SpacePhone.calls.map(item => item.method);
  assert.ok(methods.includes('mute'));
  assert.ok(methods.includes('unmute'));
  assert.ok(methods.includes('hold'));
  assert.ok(methods.includes('unhold'));
  assert.ok(methods.includes('hangup'));
});



test('Teclado route sends DTMF when a call is active', async (t) => {
  const dom = createModuleDom();
  t.after(() => dom.window.close());
  dom.reconfigure({ url: 'https://space.test/app/growth/comercial/pre-vendas/ligacoes/teclado' });
  await dom.window.SpacePhoneModule.open();
  dom.window.SpacePhoneModule.state.call = { ...dom.window.SpacePhoneModule.state.call, status: 'active', number: '+16177942141', id: 'call-1' };
  await dom.window.SpacePhoneModule.open();
  await tick(20);
  assert.ok(dom.window.document.querySelector('.sphone-keypad-page'));
  dom.window.document.querySelector('[data-sp-dtmf="5"]').click();
  await tick(10);
  assert.ok(dom.window.SpacePhone.calls.some(item => item.method === 'dtmf' && item.digit === '5'));
});

test('Space Phone V2 hides outcome during active call and shows it after hangup', async (t) => {
  const dom = createModuleDom();
  t.after(() => dom.window.close());
  await dom.window.SpacePhoneModule.open();
  dom.window.SpacePhoneModule.state.call = { ...dom.window.SpacePhoneModule.state.call, status: 'active', number: '+16177942141', id: 'call-1' };
  dom.window.SpacePhoneModule.state.normalized = '+16177942141';
  dom.window.SpacePhoneModule.state.dial = '+16177942141';
  await dom.window.SpacePhoneModule.open();
  await tick(20);
  assert.equal(dom.window.document.querySelector('[data-sp-outcome]'), null);
  dom.window.document.querySelector('[data-sp-hangup]').click();
  await tick(20);
  assert.ok(dom.window.document.querySelector('[data-sp-outcome="agendado"]'));
});

test('Space Phone V2 renders AI processing and ready states without live transcript simulation', async (t) => {
  const dom = createModuleDom();
  t.after(() => dom.window.close());
  dom.window.fetchWithAuth = async url => {
    const raw = String(url);
    if (raw.includes('id=call-ready')) return jsonResponse({ ok: true, call: { id: 'call-ready', number: '+1617', score: 82, transcript: 'SDR: Olá', analysis: { summary: 'Boa descoberta.', strengths: ['Contexto'], recommendations: ['Confirmar agenda'] }, analysisStatus: 'completed', durationSeconds: 61 } });
    if (raw.includes('id=call-processing')) return jsonResponse({ ok: true, call: { id: 'call-processing', number: '+1617', analysisStatus: 'processing', durationSeconds: 12 } });
    return jsonResponse({ ok: true, analytics: {}, calls: [{ id: 'call-ready', number: '+1617', score: 82, analysisStatus: 'completed', durationSeconds: 61 }, { id: 'call-processing', number: '+1618', analysisStatus: 'processing', durationSeconds: 12 }], callbacks: [] });
  };
  await dom.window.SpacePhoneModule.open();
  assert.ok(dom.window.document.body.textContent.includes('Pronta'));
  assert.ok(dom.window.document.body.textContent.includes('Aguardando gravação'));
  dom.window.document.querySelector('[data-sp-detail="call-ready"]').click();
  await tick(20);
  assert.ok(dom.window.document.body.textContent.includes('Boa descoberta.'));
  dom.window.document.querySelector('[data-sp-tab="transcript"]').click();
  assert.ok(dom.window.document.body.textContent.includes('SDR: Olá'));
});

test('Space Phone V2 keeps audio popover anchored and exposes Teclado as a new-tab route', async (t) => {
  const dom = createModuleDom();
  t.after(() => dom.window.close());
  await dom.window.SpacePhoneModule.open();
  dom.window.document.querySelector('[data-sp-popover="audio"]').click();
  assert.ok(dom.window.document.querySelector('.sphone-control-wrap .sphone-audio-pop'));
  dom.window.document.body.click();
  assert.equal(dom.window.document.querySelector('.sphone-audio-pop'), null);
  const keypad = dom.window.document.querySelector('a[title="Abrir Teclado em nova guia"]');
  assert.ok(keypad);
  assert.equal(keypad.getAttribute('target'), '_blank');
  assert.match(keypad.getAttribute('href'), /\/pre-vendas\/ligacoes\/teclado$/);
  assert.equal(dom.window.document.querySelector('.sphone-keypad-pop'), null);
});

test('Space Phone V2 does not show fake live AI during active call', async (t) => {
  const dom = createModuleDom();
  t.after(() => dom.window.close());
  await dom.window.SpacePhoneModule.open();
  dom.window.SpacePhoneModule.state.call = { ...dom.window.SpacePhoneModule.state.call, status: 'active', number: '+16177942141', id: 'call-1' };
  await dom.window.SpacePhoneModule.open();
  await tick(20);
  const text = dom.window.document.body.textContent;
  assert.equal(text.includes('AI Coach'), false);
  assert.equal(text.includes('● Ouvindo'), false);
  assert.equal(text.includes('Próxima pergunta'), false);
  assert.equal(text.includes('Talk ratio'), false);
  assert.ok(text.includes('Análise disponível após a ligação'));
});

test('post-call wrap-up persists through core idle and skip releases new call', async (t) => {
  const dom = createModuleDom();
  t.after(() => dom.window.close());
  await dom.window.SpacePhoneModule.open();
  dom.window.__spacePhoneTest.emit({ status: 'ended', context: { phoneNumber: '+16177942141' }, callRecord: { id: 'call-wrap', to_number: '+16177942141' } });
  await tick(20);
  assert.ok(dom.window.document.querySelector('[data-sp-outcome="agendado"]'));
  dom.window.__spacePhoneTest.emit({ status: 'idle', context: null, callRecord: null });
  await tick(20);
  assert.ok(dom.window.document.querySelector('[data-sp-outcome="agendado"]'));
  dom.window.document.querySelector('[data-sp-skip-outcome]').click();
  await tick(20);
  assert.ok(dom.window.document.body.textContent.includes('Pendente'));
  assert.ok(dom.window.document.querySelector('[data-sp-reset-call]'));
});

test('live qualification form autosaves without replacing focused field', async (t) => {
  const dom = createModuleDom();
  t.after(() => dom.window.close());
  const saved = [];
  dom.window.fetchWithAuth = async (url, options = {}) => {
    if (options.method === 'PATCH') { saved.push(JSON.parse(options.body)); return jsonResponse({ ok: true, qualification: { voiceCallId: 'call-1', context: 'Contexto real', status: 'draft' } }); }
    return jsonResponse({ ok: true, analytics: {}, calls: [], callbacks: [] });
  };
  await dom.window.SpacePhoneModule.open();
  dom.window.__spacePhoneTest.emit({ status: 'active', elapsedSeconds: 1, context: { phoneNumber: '+1617' }, callRecord: { id: 'call-1', to_number: '+1617' } });
  await tick(20);
  const field = dom.window.document.querySelector('[data-sp-qual="context"]');
  field.focus();
  field.value = 'Contexto real';
  field.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  dom.window.__spacePhoneTest.emit({ elapsedSeconds: 4 });
  await tick(800);
  assert.equal(dom.window.document.querySelector('[data-sp-qual="context"]'), field);
  assert.equal(dom.window.document.activeElement, field);
  assert.equal(saved[0].action, 'save_qualification');
  assert.equal(saved[0].qualification.context, 'Contexto real');
});

test('qualification review applies suggestions and completes independently of blocked handoff', async (t) => {
  const dom = createModuleDom();
  t.after(() => dom.window.close());
  let q = { voiceCallId: 'call-review', status: 'review_required', context: 'Humano', ai: { context: 'Não sobrescrever', painGoal: 'Inglês', urgency: 'Agora', decisionInvestment: 'Decisor', keyPoint: 'Trabalho' }, datacrazy: {} };
  const writes = [];
  dom.window.fetchWithAuth = async (_url, opts = {}) => {
    if (opts.method === 'PATCH') {
      const body = JSON.parse(opts.body); writes.push(body);
      if (body.action === 'save_qualification') q = { ...q, ...body.qualification };
      if (body.action === 'complete_qualification') q = { ...q, status: 'complete', datacrazy: { syncStatus: 'blocked' } };
      return jsonResponse({ ok: true, qualification: q });
    }
    return jsonResponse({ ok: true, calls: [], analytics: {} });
  };
  const state = dom.window.SpacePhoneModule.state;
  state.call = { ...state.call, id: 'call-review', status: 'ended' };
  state.postCall = { ...state.postCall, id: 'call-review', savedOutcome: 'agendado' };
  state.qualification = { voiceCallId: q.voiceCallId, values: { context: q.context }, ai: q.ai, status: q.status, datacrazy: {}, finalSummary: '' };
  await dom.window.SpacePhoneModule.open();
  dom.window.document.querySelector('[data-sp-apply-ai]').click();
  await tick(100);
  assert.ok(writes.length >= 4, 'apply button must reach its handler');
  assert.equal(q.context, 'Humano');
  const button = dom.window.document.querySelector('[data-sp-complete-qualification]');
  assert.equal(button.disabled, false);
  button.click();
  await tick(150);
  assert.equal(writes.at(-1).action, 'complete_qualification');
  assert.equal(q.status, 'complete');
  assert.match(dom.window.document.body.textContent, /Qualificação concluída ✓/);
  assert.match(dom.window.document.body.textContent, /Handoff Datacrazy pendente/);
});

test('history defaults to last7, restores valid preference and ignores invalid storage', async t => {
  for (const [saved, expected] of [[undefined, 'last7'], ['today', 'today'], ['last7', 'last7'], ['last30', 'last30'], ['invalid', 'last7']]) {
    const dom = createModuleDom({ period: saved }); t.after(() => dom.window.close());
    await dom.window.SpacePhoneModule.open();
    assert.equal(dom.window.SpacePhoneModule.state.period, expected);
    assert.ok(dom.window.__spacePhoneTest.fetches.some(url => new URL(url, 'https://space.test').searchParams.get('period') === expected));
  }
});

test('period selection persists and clear filters resets contextual empty history', async t => {
  const dom = createModuleDom(); t.after(() => dom.window.close());
  await dom.window.SpacePhoneModule.open();
  assert.match(dom.window.document.querySelector('.sphone-history').textContent, /Nenhuma ligação encontrada no histórico/);
  let select = dom.window.document.querySelector('[data-sp-period]');
  select.value = 'last30'; select.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  await tick(20);
  assert.equal(dom.window.localStorage.getItem('spacePhonePeriod'), 'last30');
  await dom.window.SpacePhoneModule.open();
  assert.equal(dom.window.SpacePhoneModule.state.period, 'last30');
  const state = dom.window.SpacePhoneModule.state; state.q = '123'; state.status = 'failed';
  await dom.window.SpacePhoneModule.open();
  assert.match(dom.window.document.querySelector('.sphone-history').textContent, /Há filtros ativos/);
  dom.window.document.querySelector('[data-sp-clear-filters]').click(); await tick(20);
  assert.equal(state.period, 'last7'); assert.equal(state.q, ''); assert.equal(state.status, '');
});

test('history refreshes on call end without clicking Atualizar and separates lead from SDR', async t => {
  const dom = createModuleDom(); t.after(() => dom.window.close());
  await dom.window.SpacePhoneModule.open();
  let requests = 0;
  dom.window.fetchWithAuth = async () => { requests++; return jsonResponse({ calls: [{ id: 'real-id', leadName: 'Lead A', sdrName: 'Luana Mendonça', number: '+16175551212', outcome: 'agendado', score: 80 }], analytics: {} }); };
  dom.window.__spacePhoneTest.emit({ status: 'ended', callRecord: { id: 'real-id' } }); await tick(20);
  assert.ok(requests > 0);
  const cells = dom.window.document.querySelectorAll('.sphone-history tbody tr td');
  assert.match(cells[0].textContent, /Lead A/); assert.equal(cells[1].textContent, 'Luana Mendonça');
  assert.match(dom.window.document.querySelector('.sphone-history').textContent, /agendado/);
});

test('qualification completion keeps drawer, focused field and scroll nodes intact', async t => {
  const dom = createModuleDom(); t.after(() => dom.window.close());
  let q = { status: 'review_required', context: 'Contexto', painGoal: 'Dor', experience: 'Sim', urgency: 'Alta', decisionInvestment: 'Sim', keyPoint: 'Objetivo' };
  dom.window.fetchWithAuth = async (_url, opts = {}) => {
    if (opts.method === 'PATCH') {
      const body = JSON.parse(opts.body);
      q = { ...q, ...body.qualification, ...(body.action === 'complete_qualification' ? { status: 'complete', datacrazy: { syncStatus: 'pending' } } : {}) };
      return jsonResponse({ qualification: q });
    }
    return jsonResponse({ calls: [], analytics: {} });
  };
  const state = dom.window.SpacePhoneModule.state;
  state.detail = { call: { id: 'call-scroll', outcome: 'agendado' } };
  state.qualification = { values: { ...q }, status: 'review_required', ai: {}, finalSummary: '', datacrazy: {} };
  await dom.window.SpacePhoneModule.open();
  const drawer = dom.window.document.querySelector('.sphone-drawer-body'); drawer.scrollTop = 280;
  const field = drawer.querySelector('[data-sp-qual=context]'); field.focus();
  Object.defineProperty(dom.window, 'scrollY', { value: 700, configurable: true });
  const shell = dom.window.document.querySelector('.sphone-shell');
  drawer.querySelector('[data-sp-complete-qualification]').click(); await tick(50);
  assert.equal(dom.window.document.querySelector('.sphone-shell'), shell);
  assert.equal(dom.window.document.querySelector('.sphone-drawer-body'), drawer);
  assert.equal(drawer.scrollTop, 280); assert.equal(dom.window.scrollY, 700);
  assert.equal(dom.window.document.activeElement, field);
  assert.match(drawer.textContent, /Qualificação concluída ✓/);
});

test('changing period refreshes history and resets pagination', async t => {
  const dom=createModuleDom();t.after(()=>dom.window.close());const seen=[];
  dom.window.fetchWithAuth=async url=>{
    const q=new URL(url,'https://space.test').searchParams; seen.push(q);
    if(q.get('period')==='today')return jsonResponse({analytics:{totalCalls:0},calls:[],history:{hasMore:false},range:{period:'today'}});
    if(q.get('view')==='history')return jsonResponse({calls:[{id:'older',number:'+14075917081',sdrName:'Luana'}],history:{hasMore:false,nextOffset:100}});
    return jsonResponse({analytics:{totalCalls:1},calls:[{id:'yesterday',number:'+14075917081',sdrName:'Luana'}],history:{hasMore:true,nextOffset:50}});
  };
  await dom.window.SpacePhoneModule.open();
  dom.window.document.querySelector('[data-sp-load-more]').click();await tick(30);
  assert.deepEqual(Array.from(dom.window.SpacePhoneModule.state.data.calls,c=>c.id),['yesterday','older']);
  const select=dom.window.document.querySelector('[data-sp-period]');select.value='today';select.dispatchEvent(new dom.window.Event('change',{bubbles:true}));await tick(30);
  assert.equal(seen.filter(q=>!['conversion','callbacks','callback-notifications'].includes(q.get('view'))).at(-1).get('view'),null);assert.equal(dom.window.SpacePhoneModule.state.data.analytics.totalCalls,0);
  assert.deepEqual(Array.from(dom.window.SpacePhoneModule.state.data.calls,c=>c.id),[]);
  assert.equal(dom.window.document.querySelectorAll('[data-sp-detail]').length,0);
});

for (const scenario of ['manual-summary', 'ai-empty-fields', 'human-filled']) test(`AI suggestions UX: ${scenario}`, async t => {
  const dom=createModuleDom();t.after(()=>dom.window.close());
  const keys=['context','painGoal','experience','urgency','decisionInvestment','keyPoint'];
  let q={voiceCallId:'ai-review-call',status:'review_required',finalSummary:'Resumo manual',ai:scenario==='manual-summary'?{context:'   ',unexpected:'not a qualification field'}:{context:'Contexto IA',painGoal:'Objetivo IA'}};
  if(scenario==='human-filled')for(const key of keys)q[key]='Texto humano';
  const writes=[];
  dom.window.fetchWithAuth=async(url,opts={})=>{
    if(opts.method==='PATCH'){const body=JSON.parse(opts.body);writes.push(body);q={...q,...body.qualification};return jsonResponse({qualification:q});}
    return jsonResponse({calls:[],analytics:{}});
  };
  const state=dom.window.SpacePhoneModule.state;
  state.call={...state.call,id:q.voiceCallId,status:'ended'};
  state.postCall={...state.postCall,id:q.voiceCallId,savedOutcome:'agendado'};
  state.qualification={voiceCallId:q.voiceCallId,values:Object.fromEntries(keys.map(k=>[k,q[k]||''])),ai:q.ai,finalSummary:q.finalSummary,status:q.status,datacrazy:{}};
  await dom.window.SpacePhoneModule.open();
  const button=dom.window.document.querySelector('[data-sp-apply-ai]');
  if(scenario==='manual-summary'){
    assert.equal(button,null);assert.equal(dom.window.document.querySelector('.sphone-ai-suggestion'),null);
    assert.match(dom.window.document.body.textContent,/Nenhuma sugestão confiável encontrada/);
    assert.ok(dom.window.document.querySelector('[data-sp-retry-ai]'));return;
  }
  assert.ok(button);button.click();await tick(100);
  const feedback=dom.window.document.querySelector('[data-sp-ai-feedback]').textContent;
  if(scenario==='human-filled'){
    assert.equal(feedback,'Todos os campos já estão preenchidos');assert.equal(writes.length,0);
    for(const key of keys)assert.equal(state.qualification.values[key],'Texto humano');
  }else{
    assert.equal(feedback,'2 sugestões aplicadas ✓');assert.equal(writes.length,2);
    assert.equal(q.context,'Contexto IA');assert.equal(q.painGoal,'Objetivo IA');assert.equal(q.finalSummary,'Resumo manual');
    button.click();await tick(20);
    assert.equal(dom.window.document.querySelector('[data-sp-ai-feedback]').textContent,'Nenhuma sugestão disponível para os campos vazios');
    assert.equal(writes.length,2);
  }
});

test('qualification shows waiting, delayed transcript retry, generating and available states', async t => {
  const dom=createModuleDom();t.after(()=>dom.window.close());
  const mod=dom.window.SpacePhoneModule;await mod.open();
  mod.state.detail={call:{id:'late-call',endedAt:new Date(Date.now()-11*60000).toISOString()}};
  mod.state.qualification={values:{},ai:{},status:'draft'};
  await mod.open();
  assert.match(dom.window.document.body.textContent,/Transcrição ainda não disponível/);
  assert.equal(dom.window.document.querySelector('[data-sp-retry-ai]').textContent,'Buscar novamente');
  mod.state.detail.call.endedAt=new Date().toISOString();await mod.open();
  assert.match(dom.window.document.body.textContent,/Aguardando transcrição/);
  mod.state.qualification.status='ai_processing';await mod.open();
  assert.match(dom.window.document.body.textContent,/Gerando sugestões IA/);
  mod.state.qualification.ai={context:'suggestion'};await mod.open();
  assert.match(dom.window.document.body.textContent,/Sugestões IA disponíveis/);
});

test('SDR selector is Admin-only, persists selection and reloads both history and KPIs', async () => {
  const dom = createModuleDom();
  dom.window.__SPACE_SESSION__ = { role: 'admin', commercialRoles: [], sub: 'admin-1' };
  dom.window.document.body.dataset.appRole = 'admin';
  const urls = [];
  let scope = 'admin';
  dom.window.fetchWithAuth = async url => {
    urls.push(String(url));
    const p = new URL(url, 'https://space.test').searchParams;
    return jsonResponse({ scope, selectedSdr: p.get('sdr') === 'luana' ? 'luana' : 'all', sdrs: [{ uid:'luana', displayName:'Luana Mendonça' }], calls:[], analytics:{} });
  };
  await dom.window.SpacePhoneModule.open();
  const select = dom.window.document.querySelector('[data-sp-sdr]');
  assert.ok(select); assert.match(select.textContent,/Luana Mendonça/);
  select.value = 'luana'; select.dispatchEvent(new dom.window.Event('change',{bubbles:true})); await tick(20);
  assert.equal(dom.window.localStorage.getItem('spacePhoneSdr'),'luana');
  assert.ok(urls.at(-1).includes('sdr=luana')); assert.ok(!urls.at(-1).includes('view=analytics'));
  scope = 'self'; dom.window.__SPACE_SESSION__ = { role: 'growth', commercialRoles: ['sdr'], sub: 'sdr-1' }; dom.window.document.body.dataset.appRole = 'growth'; await dom.window.SpacePhoneModule.open();
  assert.equal(dom.window.document.querySelector('[data-sp-sdr]'),null);
  dom.window.close();
});

test('booking opens Agenda through SPA and preserves human qualification', async t => {
  const dom=createModuleDom();t.after(()=>dom.window.close());
  const state=dom.window.SpacePhoneModule.state;
  state.call={...state.call,id:'booking-call',status:'ended'};
  state.postCall={...state.postCall,id:'booking-call',savedOutcome:'agendado'};
  state.qualification={...state.qualification,voiceCallId:'booking-call',values:{context:'Preservar humano'}};
  let selected,navigations=0;
  dom.window.SpaceAgenda={forCall:id=>selected=id,refresh:async()=>{},get:()=>null};
  const button=dom.window.document.createElement('button');button.dataset.panelTarget='space-agenda';button.onclick=()=>navigations++;dom.window.document.body.appendChild(button);
  await dom.window.SpacePhoneModule.open();
  dom.window.document.querySelector('[data-sp-booking]').click();await tick(20);
  assert.equal(selected,'booking-call');assert.equal(navigations,1);
  assert.equal(state.qualification.values.context,'Preservar humano');
  assert.equal(dom.window.document.getElementById('sphone-booking'),null);
});

test('placeholder AI values are never offered as applicable suggestions', async t => {
  const dom = createModuleDom(); t.after(() => dom.window.close());
  const state = dom.window.SpacePhoneModule.state;
  state.call = { ...state.call, id: 'empty-ai', status: 'ended' };
  state.postCall = { ...state.postCall, id: 'empty-ai', savedOutcome: 'agendado' };
  state.qualification = { ...state.qualification, voiceCallId: 'empty-ai', values: { context: 'Humano real' }, ai: { context: 'Não validado', painGoal: 'Não informado', urgency: 'Precisa ser validado', keyPoint: 'Não identificado' } };
  await dom.window.SpacePhoneModule.open();
  assert.equal(dom.window.document.querySelector('[data-sp-apply-ai]'), null);
  assert.equal(state.qualification.values.context, 'Humano real');
});

test('callback quick schedule, countdown, navigation alert, snooze and one-click call preserve context', async t=>{
 const dom=createModuleDom();t.after(()=>dom.window.close());
 let items=[{id:'00000000-0000-4000-8000-000000000001',name:'Lead teste',number:'+14075550123',leadId:'lead-1',callbackAt:new Date(Date.now()+1800000).toISOString()}];
 const writes=[];
 dom.window.fetchWithAuth=async(url,opts={})=>{if(opts.method==='PATCH'){writes.push(JSON.parse(opts.body));return jsonResponse({ok:true});}return jsonResponse({ok:true,calls:[],callbacks:items,analytics:{},scope:'self'});};
 await dom.window.SpacePhoneModule.open();
 assert.match(dom.window.document.querySelector('[data-callback-clock]').textContent,/Retornar em 30:/);
 const state=dom.window.SpacePhoneModule.state;state.postCall.id=items[0].id;state.postCall.savedOutcome='retornar_depois';state.call.status='ended';state.call.id=items[0].id;
 dom.window.__spacePhoneTest.emit({status:'ended',callRecord:{id:items[0].id}});
 dom.window.document.querySelector('[data-callback-schedule="30"]').click();await tick(30);
 assert.equal(writes[0].action,'callback_schedule');assert.ok(Math.abs(Date.parse(writes[0].callbackAt)-Date.now()-1800000)<2000);
 dom.window.document.querySelector('[data-callback-action="10"]').click();await tick(30);assert.equal(writes.at(-1).action,'callback_snooze');
 dom.window.document.querySelector('[data-callback-action="call"]').click();await tick(30);
 const call=dom.window.SpacePhone.calls.find(c=>c.method==='call');assert.equal(call.payload.callbackSourceCallId,items[0].id);assert.equal(call.payload.leadId,'lead-1');
 assert.ok(dom.window.document.querySelector('[data-callback-action="call"]').disabled);
 items=[{...items[0],callbackAt:new Date(Date.now()-720000).toISOString()}];
 dom.window.document.body.dataset.activePanel='crm';dom.window.dispatchEvent(new dom.window.Event('online'));await tick(40);
 assert.match(dom.window.document.querySelector('#space-callback-alert').textContent,/Callback atrasado há 12 min/);
 dom.window.dispatchEvent(new dom.window.Event('online'));await tick(30);assert.equal(dom.window.document.querySelectorAll('#space-callback-alert').length,1);
});



test('post-call callback schedule uses ended call id even when stale detail is open', async t => {
  const dom = createModuleDom(); t.after(() => dom.window.close());
  const writes = [];
  dom.window.fetchWithAuth = async (url, opts = {}) => {
    if (opts.method === 'PATCH') { writes.push(JSON.parse(opts.body)); return jsonResponse({ ok: true }); }
    return jsonResponse({ ok: true, scope: 'self', analytics: {}, calls: [], callbacks: [] });
  };
  await dom.window.SpacePhoneModule.open();
  const state = dom.window.SpacePhoneModule.state;
  state.detail = { call: { id: 'stale-detail-call', outcome: 'retornar_depois' } };
  state.call = { ...state.call, id: 'fresh-ended-call', status: 'ended' };
  state.postCall = { ...state.postCall, id: 'fresh-ended-call', savedOutcome: 'retornar_depois', call: { id: 'fresh-ended-call' } };
  dom.window.__spacePhoneTest.emit({ status: 'ended', callRecord: { id: 'fresh-ended-call' } });
  await tick(20);
  dom.window.document.querySelector('.sphone-pane [data-callback-schedule="15"]').click();
  await tick(30);
  assert.equal(writes[0].id, 'fresh-ended-call');
  assert.equal(writes[0].action, 'callback_schedule');
  assert.notEqual(writes[0].id, 'stale-detail-call');
});
test('conversion updates partially on outcome and booking events without stealing focus',async t=>{
 const dom=createModuleDom();t.after(()=>dom.window.close());let scheduled=0,reads=0;
 const rate=(n,d)=>({numerator:n,denominator:d,percent:d?n/d*100:null});
 dom.window.fetchWithAuth=async url=>{
  if(new URL(url,'https://space.test').searchParams.get('view')==='conversion'){reads++;return jsonResponse({conversion:{attendance:rate(2,4),callToBooking:rate(scheduled,4),answeredToBooking:rate(scheduled,2),bookingToDone:rate(0,0)}});}
  return jsonResponse({calls:[],callbacks:[],analytics:{},scope:'self'});
 };
 await dom.window.SpacePhoneModule.open();await tick(20);
 const input=dom.window.document.querySelector('[data-sp-dial]');input.focus();
 assert.match(dom.window.document.querySelector('[data-sp-kpis]').textContent,/50,0% taxa atendimento/);
 scheduled=1;dom.window.dispatchEvent(new dom.window.CustomEvent('space-phone:call-updated'));await tick(20);
 assert.match(dom.window.document.querySelector('[data-sp-kpis]').textContent,/25,0% lig → agenda/);assert.equal(dom.window.document.activeElement,input);
 const before=reads;dom.window.dispatchEvent(new dom.window.CustomEvent('space-bookings:updated'));await tick(20);assert.ok(reads>before);
 assert.equal(dom.window.document.querySelector('[data-sp-dial]'),input);
});

test('conversion rates are embedded in KPIs before the operational grid/history',async t=>{
 const dom=createModuleDom();t.after(()=>dom.window.close());
 const rate=(n,d)=>({numerator:n,denominator:d,percent:d?n/d*100:null});
 dom.window.fetchWithAuth=async()=>jsonResponse({ok:true,scope:'self',analytics:{totalCalls:4,connectedCalls:2,connectRate:.5,talkTimeSeconds:90,scheduledCalls:1},conversion:{attendance:rate(2,4),callToBooking:rate(1,4),answeredToBooking:rate(1,2),bookingToDone:rate(1,1)},calls:[],callbacks:[]});
 await dom.window.SpacePhoneModule.open();
 const d=dom.window.document,kpis=d.querySelector('.sphone-kpis'),conversion=d.querySelector('[data-sp-conversion]');
 assert.equal(kpis.nextElementSibling,conversion);
 assert.equal(kpis.querySelectorAll('.sphone-kpi').length,5);
 assert.match(kpis.textContent,/lig → agenda|taxa atendimento|Agendado → Feito/);
 assert.equal(conversion.querySelectorAll('.sphone-conversion-grid article').length,0);
 assert.ok(conversion.compareDocumentPosition(d.querySelector('.sphone-grid'))&dom.window.Node.DOCUMENT_POSITION_FOLLOWING);
});


test('resilience: scope self from session keeps dialer on first API failure without false-zero KPIs', async t => {
  const dom = createModuleDom(); t.after(() => dom.window.close());
  dom.window.fetchWithAuth = async () => ({ ok: false, status: 500, json: async () => ({ error: 'space_phone_unavailable' }) });
  await dom.window.SpacePhoneModule.open(); await tick(20);
  assert.ok(dom.window.document.querySelector('[data-sp-call]'));
  assert.match(dom.window.document.querySelector('[data-sp-kpis]').textContent, /Ligações\s*—/);
  assert.match(dom.window.document.body.textContent, /Não foi possível carregar o histórico\./);
  assert.equal(dom.window.document.querySelectorAll('[data-sp-global-status]').length, 1);
  assert.equal(dom.window.document.querySelector('[data-sp-talk-time]').textContent, '—');
  assert.doesNotMatch(dom.window.document.body.textContent, /space_phone_unavailable/);
});

test('resilience: last-known-good KPIs, history, conversion and callbacks survive refresh failure and recover', async t => {
  const dom = createModuleDom(); t.after(() => dom.window.close());
  let fail = false;
  const rate = { percent: 50, numerator: 1, denominator: 2 };
  dom.window.fetchWithAuth = async url => {
    const q = new URL(url, 'https://space.test').searchParams;
    if (fail) return { ok: false, status: 500, json: async () => ({ error: 'space_phone_unavailable' }) };
    if (q.get('view') === 'conversion') return jsonResponse({ conversion: { attendance: rate, callToBooking: rate, answeredToBooking: rate, bookingToDone: rate } });
    if (q.get('view') === 'callbacks' || q.get('view') === 'callback-notifications') return jsonResponse({ callbacks: [{ id: 'cb-1', name: 'Lead callback', number: '+14075550123', callbackAt: new Date(Date.now()+600000).toISOString() }] });
    return jsonResponse({ scope: 'self', analytics: { totalCalls: 2, connectedCalls: 1, connectRate: .5, talkTimeSeconds: 90, scheduledCalls: 1 }, calls: [{ id: 'call-lkg', number: '+14075550123', sdrName: 'Luana', startedAt: new Date().toISOString(), status: 'connected', durationSeconds: 90, outcome: 'agendado' }], callbacks: [{ id: 'cb-1', name: 'Lead callback', number: '+14075550123', callbackAt: new Date(Date.now()+600000).toISOString() }] });
  };
  await dom.window.SpacePhoneModule.open(); await tick(30);
  assert.match(dom.window.document.body.textContent, /call-lkg|\+14075550123/);
  assert.match(dom.window.document.querySelector('[data-sp-kpis]').textContent, /Ligações\s*2/);
  assert.match(dom.window.document.querySelector('[data-sp-kpis]').textContent, /50,0%/);
  assert.match(dom.window.document.querySelector('[data-callback-queue]').textContent, /Lead callback/);
  fail = true;
  dom.window.document.querySelector('[data-sp-refresh]').click(); await tick(30);
  assert.ok(dom.window.document.querySelector('[data-sp-call]'));
  assert.match(dom.window.document.querySelector('[data-sp-kpis]').textContent, /Ligações\s*2/);
  assert.match(dom.window.document.querySelector('.sphone-history').textContent, /\+14075550123/);
  assert.match(dom.window.document.querySelector('[data-sp-kpis]').textContent, /50,0%/);
  assert.match(dom.window.document.querySelector('[data-callback-queue]').textContent, /Lead callback/);
  fail = false;
  dom.window.document.querySelector('[data-sp-refresh]').click(); await tick(30);
  assert.doesNotMatch(dom.window.document.body.textContent, /Não foi possível carregar ligações agora/);
});

test('resilience: conversion endpoint failure does not drop working history', async t => {
  const dom = createModuleDom(); t.after(() => dom.window.close());
  dom.window.fetchWithAuth = async url => {
    const q = new URL(url, 'https://space.test').searchParams;
    if (q.get('view') === 'conversion') return { ok: false, status: 500, json: async () => ({ error: 'space_phone_unavailable' }) };
    return jsonResponse({ scope: 'self', analytics: { totalCalls: 1 }, calls: [{ id: 'history-ok', number: '+14075550123', startedAt: new Date().toISOString(), status: 'connected', durationSeconds: 30 }], callbacks: [] });
  };
  await dom.window.SpacePhoneModule.open(); await tick(30);
  assert.match(dom.window.document.querySelector('.sphone-history').textContent, /history-ok|\+14075550123/);
  assert.match(dom.window.document.querySelector('[data-sp-conversion]').textContent, /↻ atualização pendente/);
  assert.doesNotMatch(dom.window.document.querySelector('[data-sp-conversion]').textContent, /Carregando/);
});

test('SDR module shows only the 3 most recent redial numbers', async (t) => {
  const dom = createModuleDom();
  t.after(() => dom.window.close());
  dom.window.SpacePhoneModule.state.recents = ['+10000000001','+10000000002','+10000000003','+10000000004'];
  await dom.window.SpacePhoneModule.open();
  const recentButtons = [...dom.window.document.querySelectorAll('[data-sp-fill]')].map(button => button.dataset.spFill);
  assert.deepEqual(recentButtons, ['+10000000001', '+10000000002', '+10000000003']);
});

test('Admin custom period propagates to consolidated Space Phone reads', async t => {
  const dom = createModuleDom(); t.after(() => dom.window.close());
  dom.window.document.body.dataset.appRole = 'admin';
  dom.window.__SPACE_SESSION__ = { role: 'admin', sub: 'admin-1' };
  const urls = [];
  dom.window.fetchWithAuth = async url => {
    urls.push(String(url));
    return jsonResponse({ ok: true, scope: 'admin', sdrs: [{ uid: 'sdr-1', displayName: 'Luana Mendonça' }], selectedSdr: 'all', analytics: { totalCalls: 1 }, conversion: {}, calls: [], callbacks: [], teamPace: { rows: [] }, evolution: [] });
  };
  await dom.window.SpacePhoneModule.open(); await tick(30);
  dom.window.document.querySelector('[data-sp-filter-toggle]').click(); await tick(10);
  const select = dom.window.document.querySelector('[data-sp-period]');
  select.value = 'custom'; select.dispatchEvent(new dom.window.Event('change', { bubbles: true })); await tick(10);
  dom.window.document.querySelector('[data-sp-custom-from]').value = '2026-09-01';
  dom.window.document.querySelector('[data-sp-custom-to]').value = '2026-09-14';
  dom.window.document.querySelector('[data-sp-custom-apply]').click(); await tick(40);
  const last = urls.map(url => new URL(url, 'https://space.test')).filter(url => url.searchParams.get('period') === 'custom').at(-1);
  assert.ok(last, `expected custom period request, saw: ${urls.join(' | ')}`);
  assert.equal(last.searchParams.get('period'), 'custom');
  assert.equal(last.searchParams.get('customFrom'), '2026-09-01');
  assert.equal(last.searchParams.get('customTo'), '2026-09-14');
});

test('Growth agendado exposes WhatsApp booking modal and saves external booking through canonical endpoint', async t => {
  const dom = createModuleDom(); t.after(() => dom.window.close());
  const writes = [];
  dom.window.fetchWithAuth = async (url, opts = {}) => {
    if (String(url).includes('/api/commercial-bookings')) { writes.push(JSON.parse(opts.body)); return jsonResponse({ ok: true, booking: { id: 'booking-ext' } }); }
    if (opts.method === 'PATCH') return jsonResponse({ ok: true, call: { id: 'call-book', outcome: 'agendado', number: '+14075550123', qualification: {} } });
    if (String(url).includes('id=call-book')) return jsonResponse({ ok: true, call: { id: 'call-book', outcome: 'agendado', number: '+14075550123', qualification: {} } });
    return jsonResponse({ ok: true, scope: 'self', analytics: {}, calls: [], callbacks: [] });
  };
  await dom.window.SpacePhoneModule.open();
  dom.window.__spacePhoneTest.emit({ status: 'ended', callRecord: { id: 'call-book', to_number: '+14075550123' } });
  await tick(20);
  dom.window.document.querySelector('[data-sp-outcome="agendado"]').click(); await tick(40);
  assert.match(dom.window.document.body.textContent, /Agendou pelo WhatsApp/);
  dom.window.document.querySelector('[data-sp-external-booking]').click(); await tick(10);
  const dateInput = dom.window.document.querySelector('[data-sp-booking-date]'); dateInput.value = '2026-09-28'; dateInput.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  const timeInput = dom.window.document.querySelector('[data-sp-booking-time]'); timeInput.value = '15:30'; timeInput.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  const consultantInput = dom.window.document.querySelector('[data-sp-booking-consultant]'); consultantInput.value = 'Closer QA'; consultantInput.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  const notesInput = dom.window.document.querySelector('[data-sp-booking-notes]'); notesInput.value = 'Confirmado pelo WhatsApp'; notesInput.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  dom.window.document.querySelector('[data-sp-booking-save]').click(); await tick(40);
  assert.equal(writes[0].action, 'manual');
  assert.equal(writes[0].sourceType, 'external_booking');
  assert.equal(writes[0].callId, 'call-book');
  assert.match(writes[0].sourceId, /^whatsapp_call-book_2026-09-28_15:30$/);
});
