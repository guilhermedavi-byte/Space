const test = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const { createSpacePhone, normalizePhone, normalizeSdkStatus, formatDuration } = require('../src/space-phone/core');

function createDom(html = '<body></body>') {
  const dom = new JSDOM(html, { url: 'https://space.test/app/admin/comercial/crm', pretendToBeVisual: true });
  dom.window.navigator.mediaDevices = { getUserMedia: async () => ({ getTracks: () => [{ stop() {} }] }) };
  return dom;
}

async function waitForRequest(requests, type, timeout = 100) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const item = requests.find(r => r.type === type);
    if (item) return item;
    await new Promise(resolve => setTimeout(resolve, 5));
  }
  return requests.find(r => r.type === type);
}

function createFetch(requests = []) {
  return async (url, init = {}) => {
    requests.push({ type: 'fetch', url, method: init.method, body: init.body ? JSON.parse(init.body) : null });
    if (url === '/token') return { ok: true, json: async () => ({ login_token: 'jwt' }) };
    if (init.method === 'PATCH') return { ok: true, json: async () => ({ call: { id: 'call-1' } }) };
    return { ok: true, json: async () => ({ call: { id: 'call-1', from_number: '+14155552671' } }) };
  };
}

function fakeTelnyxFactory(requests = [], { autoReady = true, errorBeforeReady = false } = {}) {
  const instances = [];
  class FakeTelnyxRTC {
    constructor(params) { this.params = params; this.handlers = {}; this.connected = false; this.disconnected = false; instances.push(this); }
    on(name, cb) { (this.handlers[name] ||= []).push(cb); }
    off(name, cb) { this.handlers[name] = (this.handlers[name] || []).filter(item => item !== cb); }
    emit(name, payload) { (this.handlers[name] || []).forEach(cb => cb(payload)); }
    async connect() {
      this.connected = true;
      if (errorBeforeReady) this.emit('telnyx.error', { message: 'auth failed' });
      if (autoReady) setTimeout(() => this.emit('telnyx.ready'), 0);
    }
    disconnect() { this.disconnected = true; }
    newCall(params) {
      requests.push({ type: 'newCall', params });
      const call = {
        handlers: {},
        on(name, cb) { (this.handlers[name] ||= []).push(cb); },
        hangup: async () => requests.push({ type: 'hangup' }),
        muteAudio: () => requests.push({ type: 'muteAudio' }),
        unmuteAudio: () => requests.push({ type: 'unmuteAudio' }),
        hold: async () => requests.push({ type: 'hold' }),
        unhold: async () => requests.push({ type: 'unhold' }),
        dtmf: digit => requests.push({ type: 'dtmf', digit }),
        setAudioInDevice: async id => requests.push({ type: 'setAudioInDevice', id }),
        setAudioOutDevice: async id => requests.push({ type: 'setAudioOutDevice', id }),
      };
      return call;
    }
    disableMicrophone() {}
    enableMicrophone() {}
  }
  FakeTelnyxRTC.instances = instances;
  return FakeTelnyxRTC;
}

test('core helpers normalize phones, SDK status and duration', () => {
  assert.equal(normalizePhone('(617) 555-1212', 'US'), '+16175551212');
  assert.equal(normalizePhone('6175551212', 'US'), '+16175551212');
  assert.equal(normalizePhone('+1 617 555 1212', 'US'), '+16175551212');
  assert.equal(normalizePhone('+55 34 99999-9999', 'US'), '+5534999999999');
  assert.equal(normalizePhone('abc', 'US'), '');
  assert.equal(normalizeSdkStatus('call.answered'), 'active');
  assert.equal(normalizeSdkStatus('ringing'), 'ringing');
  assert.equal(normalizeSdkStatus('hangup'), 'ended');
  assert.equal(formatDuration(65), '01:05');
});

test('feature flag off does not mount floating phone', () => {
  const dom = createDom();
  const phone = createSpacePhone({ window: dom.window, document: dom.window.document, bootstrap: { enabled: false } });
  phone.mount();
  assert.equal(dom.window.document.querySelector('[data-space-phone]'), null);
});

test('click-to-call waits for telnyx.ready, passes remote audio element and blocks second active call', async () => {
  const dom = createDom('<body><button data-space-phone-call="(617) 555-1212" data-space-phone-lead-name="Matheus">Ligar</button></body>');
  const requests = [];
  const FakeTelnyxRTC = fakeTelnyxFactory(requests);
  const phone = createSpacePhone({
    window: dom.window,
    document: dom.window.document,
    TelnyxRTC: FakeTelnyxRTC,
    bootstrap: { enabled: true, tokenEndpoint: '/token', callEndpoint: '/calls', defaultCountry: 'US' },
    fetchWithAuth: createFetch(requests),
  }).mount();
  dom.window.document.querySelector('[data-space-phone-call]').click();
  const newCall = await waitForRequest(requests, 'newCall', 120);
  assert.equal(phone.getState().status, 'connecting');
  assert.equal(newCall.params.destinationNumber, '+16175551212');
  assert.equal(newCall.params.callerNumber, '+14155552671');
  assert.equal(newCall.params.remoteElement, dom.window.document.getElementById('space-phone-remote-media'));
  await assert.rejects(() => phone.call({ phoneNumber: '+12125550123' }), /Já existe/);
});

test('connect without telnyx.ready times out and never calls newCall', async () => {
  const dom = createDom();
  const requests = [];
  const FakeTelnyxRTC = fakeTelnyxFactory(requests, { autoReady: false });
  const phone = createSpacePhone({
    window: dom.window,
    document: dom.window.document,
    TelnyxRTC: FakeTelnyxRTC,
    bootstrap: { enabled: true, tokenEndpoint: '/token', callEndpoint: '/calls', defaultCountry: 'US', readyTimeoutMs: 1 },
    fetchWithAuth: createFetch(requests),
  }).mount();
  await assert.rejects(() => phone.call({ phoneNumber: '+16175551212' }), /Telnyx/);
  assert.equal(phone.getState().status, 'failed');
  assert.equal(requests.some(r => r.type === 'newCall'), false);
  assert.equal(requests.some(r => r.type === 'fetch' && r.method === 'PATCH' && r.body?.status === 'failed'), true);
});

test('telnyx error before ready fails the call and does not dial', async () => {
  const dom = createDom();
  const requests = [];
  const FakeTelnyxRTC = fakeTelnyxFactory(requests, { autoReady: false, errorBeforeReady: true });
  const phone = createSpacePhone({
    window: dom.window,
    document: dom.window.document,
    TelnyxRTC: FakeTelnyxRTC,
    bootstrap: { enabled: true, tokenEndpoint: '/token', callEndpoint: '/calls', defaultCountry: 'US' },
    fetchWithAuth: createFetch(requests),
  }).mount();
  await assert.rejects(() => phone.call({ phoneNumber: '+16175551212' }), /auth failed/);
  assert.equal(phone.getState().status, 'failed');
  assert.equal(requests.some(r => r.type === 'newCall'), false);
});

test('ready client is reused without reconnecting for a later call', async () => {
  const dom = createDom();
  const requests = [];
  const FakeTelnyxRTC = fakeTelnyxFactory(requests);
  const phone = createSpacePhone({
    window: dom.window,
    document: dom.window.document,
    TelnyxRTC: FakeTelnyxRTC,
    bootstrap: { enabled: true, tokenEndpoint: '/token', callEndpoint: '/calls', defaultCountry: 'US' },
    fetchWithAuth: createFetch(requests),
    timers: { setInterval() {}, clearInterval() {}, setTimeout(fn, ms) { return setTimeout(fn, ms); }, clearTimeout(id) { clearTimeout(id); } },
  }).mount();
  await phone.call({ phoneNumber: '+16175551212' });
  FakeTelnyxRTC.instances[0].emit('telnyx.notification', { call: { state: 'active' } });
  await phone.hangup();
  await phone.call({ phoneNumber: '+12125550123' });
  assert.equal(FakeTelnyxRTC.instances.length, 1);
});

test('timer starts only when SDK reports active and hangup records talk time', async () => {
  let clock = 1000;
  const dom = createDom();
  const requests = [];
  const FakeTelnyxRTC = fakeTelnyxFactory(requests);
  const intervals = [];
  const phone = createSpacePhone({
    window: dom.window,
    document: dom.window.document,
    TelnyxRTC: FakeTelnyxRTC,
    bootstrap: { enabled: true, tokenEndpoint: '/token', callEndpoint: '/calls', defaultCountry: 'US' },
    fetchWithAuth: createFetch(requests),
    now: () => clock,
    timers: { setInterval(fn) { intervals.push(fn); return { unref() {} }; }, clearInterval() {}, setTimeout(fn, ms) { return setTimeout(fn, ms); }, clearTimeout(id) { clearTimeout(id); } },
  }).mount();
  const seen = [];
  phone.subscribe(s => seen.push(s.status));
  await phone.call({ phoneNumber: '+16175551212' });
  clock = 6000;
  intervals.forEach(fn => fn());
  assert.equal(phone.getState().elapsedSeconds, 0);
  FakeTelnyxRTC.instances[0].emit('telnyx.notification', { call: { state: 'active', call_leg_id: 'leg-1' } });
  const eventsBeforeClock = seen.length;
  clock = 16000;
  intervals.forEach(fn => fn());
  assert.equal(phone.getState().elapsedSeconds, 10);
  assert.equal(seen.length, eventsBeforeClock);
  assert.equal(dom.window.document.querySelector('[data-phone-timer]').textContent, '00:10');
  await phone.hangup();
  assert.equal(requests.some(r => r.type === 'fetch' && r.method === 'PATCH' && r.body?.duration_seconds === 10 && r.body?.status === 'ended'), true);
});



test('call feedback is immediate and microphone permission is reused for same device', async () => {
  const dom = createDom();
  let micRequests = 0;
  dom.window.navigator.mediaDevices.getUserMedia = async () => { micRequests += 1; return { getTracks: () => [{ stop() {} }] }; };
  const requests = [];
  const FakeTelnyxRTC = fakeTelnyxFactory(requests);
  const phone = createSpacePhone({
    window: dom.window,
    document: dom.window.document,
    TelnyxRTC: FakeTelnyxRTC,
    bootstrap: { enabled: true, tokenEndpoint: '/token', callEndpoint: '/calls', defaultCountry: 'US' },
    fetchWithAuth: createFetch(requests),
    timers: { setInterval() {}, clearInterval() {}, setTimeout(fn, ms) { return setTimeout(fn, ms); }, clearTimeout(id) { clearTimeout(id); } },
  }).mount();
  const first = phone.call({ phoneNumber: '+16175551212' });
  assert.equal(phone.getState().status, 'connecting');
  await first;
  FakeTelnyxRTC.instances[0].emit('telnyx.notification', { call: { state: 'active' } });
  await phone.hangup();
  await phone.call({ phoneNumber: '+12125550123' });
  assert.equal(micRequests, 1);
});

test('cleanup disconnects the Telnyx client on page unload', async () => {
  const dom = createDom();
  const requests = [];
  const FakeTelnyxRTC = fakeTelnyxFactory(requests);
  const phone = createSpacePhone({
    window: dom.window,
    document: dom.window.document,
    TelnyxRTC: FakeTelnyxRTC,
    bootstrap: { enabled: true, tokenEndpoint: '/token', callEndpoint: '/calls', defaultCountry: 'US' },
    fetchWithAuth: createFetch(requests),
  }).mount();
  await phone.call({ phoneNumber: '+16175551212' });
  phone.cleanup();
  assert.equal(FakeTelnyxRTC.instances[0].disconnected, true);
});

test('public controls operate on the real Telnyx call and not the call record', async () => {
  const dom = createDom();
  const requests = [];
  const FakeTelnyxRTC = fakeTelnyxFactory(requests);
  const phone = createSpacePhone({
    window: dom.window,
    document: dom.window.document,
    TelnyxRTC: FakeTelnyxRTC,
    bootstrap: { enabled: true, tokenEndpoint: '/token', callEndpoint: '/calls', defaultCountry: 'US' },
    fetchWithAuth: createFetch(requests),
  }).mount();
  await phone.call({ phoneNumber: '+16175551212', micId: 'mic-1', speakerId: 'spk-1' });
  await phone.mute();
  await phone.unmute();
  await phone.hold();
  await phone.unhold();
  await phone.dtmf('5');
  await phone.setAudioInputDevice('mic-2');
  await phone.setAudioOutputDevice('spk-2');
  await phone.hangup();
  assert.ok(requests.some(r => r.type === 'muteAudio'));
  assert.ok(requests.some(r => r.type === 'unmuteAudio'));
  assert.ok(requests.some(r => r.type === 'hold'));
  assert.ok(requests.some(r => r.type === 'unhold'));
  assert.ok(requests.some(r => r.type === 'dtmf' && r.digit === '5'));
  assert.ok(requests.some(r => r.type === 'setAudioInDevice' && r.id === 'mic-2'));
  assert.ok(requests.some(r => r.type === 'setAudioOutDevice' && r.id === 'spk-2'));
  assert.ok(requests.some(r => r.type === 'hangup'));
});

test('subscribe publishes state machine changes from the core', async () => {
  const dom = createDom();
  const requests = [];
  const FakeTelnyxRTC = fakeTelnyxFactory(requests);
  const seen = [];
  const phone = createSpacePhone({
    window: dom.window,
    document: dom.window.document,
    TelnyxRTC: FakeTelnyxRTC,
    bootstrap: { enabled: true, tokenEndpoint: '/token', callEndpoint: '/calls', defaultCountry: 'US' },
    fetchWithAuth: createFetch(requests),
  }).mount();
  phone.subscribe(s => seen.push(s.status));
  await phone.call({ phoneNumber: '+16175551212' });
  FakeTelnyxRTC.instances[0].emit('telnyx.notification', { call: { state: 'ringing' } });
  FakeTelnyxRTC.instances[0].emit('telnyx.notification', { call: { state: 'active' } });
  await phone.hangup();
  assert.ok(seen.includes('connecting'));
  assert.ok(seen.includes('ringing'));
  assert.ok(seen.includes('active'));
  assert.ok(seen.includes('ended'));
});
