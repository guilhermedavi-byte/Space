const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

function jsonResponse(body, ok = true, status = 200) {
  return { ok, status, json: async () => body };
}

function createModuleDom() {
  const dom = new JSDOM('<body data-active-panel="space-phone"><section data-panel="space-phone"><div data-space-phone></div></section></body>', {
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
  let snapshot = { status: 'idle', clientReady: true, muted: false, held: false, elapsedSeconds: 0, callRecord: null, context: null, devices: { permission: 'granted' } };
  const listeners = [];
  const emit = next => { snapshot = { ...snapshot, ...next }; listeners.forEach(fn => fn(snapshot)); };
  dom.window.SpacePhone = {
    calls,
    getState: () => snapshot,
    subscribe(fn) { listeners.push(fn); fn(snapshot); return () => {}; },
    refreshDevices: async () => ({ permission: 'granted', inputs: [{ deviceId: 'mic-1', label: 'Mic' }], outputs: [{ deviceId: 'spk-1', label: 'Speaker' }] }),
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
    if (String(url).includes('normalize=')) return jsonResponse({ ok: true, raw: '+16177942141', normalized: '+16177942141' });
    return jsonResponse({ ok: true, analytics: {}, calls: [], callbacks: [] });
  };
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
  dom.window.document.querySelector('[data-sp-dtmf-toggle]').click();
  dom.window.document.querySelector('[data-sp-dtmf="5"]').click();
  await tick(10);
  dom.window.document.querySelector('[data-sp-hangup]').click();
  await tick(10);
  const methods = dom.window.SpacePhone.calls.map(item => item.method);
  assert.ok(methods.includes('mute'));
  assert.ok(methods.includes('unmute'));
  assert.ok(methods.includes('hold'));
  assert.ok(methods.includes('unhold'));
  assert.ok(dom.window.SpacePhone.calls.some(item => item.method === 'dtmf' && item.digit === '5'));
  assert.ok(methods.includes('hangup'));
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
  assert.ok(dom.window.document.body.textContent.includes('Processando'));
  dom.window.document.querySelector('[data-sp-detail="call-ready"]').click();
  await tick(20);
  assert.ok(dom.window.document.body.textContent.includes('Boa descoberta.'));
  dom.window.document.querySelector('[data-sp-tab="transcript"]').click();
  assert.ok(dom.window.document.body.textContent.includes('SDR: Olá'));
});
