const test = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const { createSpacePhone, normalizePhone, normalizeSdkStatus, formatDuration } = require('../src/space-phone/core');

test('core helpers normalize phone, SDK status and duration', () => {
  assert.equal(normalizePhone('(617) 555-1212'), '+6175551212');
  assert.equal(normalizePhone('nope'), '');
  assert.equal(normalizeSdkStatus('call.answered'), 'active');
  assert.equal(normalizeSdkStatus('hangup'), 'ended');
  assert.equal(formatDuration(65), '01:05');
});

test('feature flag off does not mount floating phone', () => {
  const dom = new JSDOM('<body></body>', { url: 'https://space.test/app/admin/comercial/crm' });
  const phone = createSpacePhone({ window: dom.window, document: dom.window.document, bootstrap: { enabled: false } });
  phone.mount();
  assert.equal(dom.window.document.querySelector('[data-space-phone]'), null);
});

test('click-to-call creates one Telnyx call and blocks a second active call', async () => {
  const dom = new JSDOM('<body><button data-space-phone-call="+15551234567" data-space-phone-lead-name="Matheus">Ligar</button></body>', { url: 'https://space.test/app/admin/comercial/crm', pretendToBeVisual: true });
  dom.window.navigator.mediaDevices = { getUserMedia: async () => ({ getTracks: () => [{ stop() {} }] }) };
  const requests = [];
  class FakeTelnyxRTC {
    constructor(params) { this.params = params; this.handlers = {}; }
    on(name, cb) { this.handlers[name] = cb; }
    async connect() { this.connected = true; }
    newCall(params) { requests.push({ type: 'newCall', params }); return { state: 'ringing', hangup: async () => {} }; }
    disableMicrophone() {}
    enableMicrophone() {}
  }
  const phone = createSpacePhone({
    window: dom.window,
    document: dom.window.document,
    TelnyxRTC: FakeTelnyxRTC,
    bootstrap: { enabled: true, tokenEndpoint: '/token', callEndpoint: '/calls' },
    fetchWithAuth: async (url, init = {}) => {
      requests.push({ type: 'fetch', url, body: init.body ? JSON.parse(init.body) : null });
      if (url === '/token') return { ok: true, json: async () => ({ login_token: 'jwt' }) };
      if (init.method === 'PATCH') return { ok: true, json: async () => ({ call: { id: 'call-1' } }) };
      return { ok: true, json: async () => ({ call: { id: 'call-1', from_number: '+15550000000' } }) };
    },
  }).mount();
  dom.window.document.querySelector('[data-space-phone-call]').click();
  await new Promise(resolve => setTimeout(resolve, 0));
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(phone.getState().status, 'ringing');
  assert.equal(requests.find(r => r.type === 'newCall').params.destinationNumber, '+15551234567');
  await assert.rejects(() => phone.call({ phoneNumber: '+15557654321' }), /Já existe/);
});

test('hangup updates the server call record and resets state', async () => {
  const dom = new JSDOM('<body></body>', { url: 'https://space.test', pretendToBeVisual: true });
  dom.window.navigator.mediaDevices = { getUserMedia: async () => ({ getTracks: () => [{ stop() {} }] }) };
  const updates = [];
  class FakeTelnyxRTC {
    on() {}
    async connect() {}
    newCall() { return { hangup: async () => updates.push({ type: 'hangup' }) }; }
  }
  const phone = createSpacePhone({
    window: dom.window,
    document: dom.window.document,
    TelnyxRTC: FakeTelnyxRTC,
    bootstrap: { enabled: true, tokenEndpoint: '/token', callEndpoint: '/calls' },
    fetchWithAuth: async (url, init = {}) => {
      if (url === '/token') return { ok: true, json: async () => ({ login_token: 'jwt' }) };
      if (init.method === 'PATCH') { updates.push(JSON.parse(init.body)); return { ok: true, json: async () => ({ call: { id: 'call-1' } }) }; }
      return { ok: true, json: async () => ({ call: { id: 'call-1', from_number: '+15550000000' } }) };
    },
    timers: { setInterval() {}, clearInterval() {}, setTimeout(fn) { fn(); } },
  }).mount();
  await phone.call({ phoneNumber: '+15551234567' });
  await phone.hangup();
  assert.equal(updates.some(item => item.type === 'hangup'), true);
  assert.equal(updates.some(item => item.status === 'ended'), true);
  assert.equal(phone.getState().status, 'idle');
});
