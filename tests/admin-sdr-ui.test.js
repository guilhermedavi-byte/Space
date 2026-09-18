const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM } = require('jsdom');

test('SDR filters collapse and audio resolves through authenticated request', async () => {
  const dom = new JSDOM('<div data-admin-sdr></div>', { runScripts: 'outside-only', url: 'https://space.example' });
  const requests = [];
  dom.window.fetchWithAuth = async url => {
    requests.push(url);
    return { ok: true, json: async () => url.includes('/audio?') ? { url: 'https://audio.example/fresh.mp3' } : { selectedCall: { recordingId: 'rec1', sdrName: 'SDR', transcript: '' } } };
  };
  dom.window.HTMLMediaElement.prototype.pause = function () {};
  dom.window.eval(fs.readFileSync('admin-sdr.js', 'utf8'));
  await dom.window.SpaceAdminSdr.open();
  const doc = dom.window.document;
  assert.equal(doc.getElementById('asdr-filters').hidden, true);
  doc.querySelector('[data-asdr-toggle-filters]').click();
  assert.equal(doc.getElementById('asdr-filters').hidden, false);
  doc.querySelector('[data-asdr-toggle-filters]').click();
  assert.equal(doc.getElementById('asdr-filters').hidden, true);
  await new Promise(resolve => setImmediate(resolve));
  assert.ok(requests.includes('/api/admin/sdr/calls/rec1/audio?format=json'));
  assert.equal(doc.querySelector('audio').src, 'https://audio.example/fresh.mp3');
  assert.ok(!doc.body.textContent.includes('Firestore'));
  assert.ok(!doc.body.textContent.includes('ADMIN / COMERCIAL'));
  const audio = doc.querySelector('audio');
  const drawer = doc.getElementById('asdr-drawer');
  assert.equal(drawer.parentElement, doc.body);
  assert.equal(doc.body.style.overflow, 'hidden');
  doc.querySelector('[data-asdr-detail-tab="transcript"]').click();
  assert.equal(doc.querySelector('audio'), audio);
  doc.querySelector('[data-asdr-speed="1.5"]').click();
  assert.equal(audio.playbackRate, 1.5);
  doc.querySelector('[data-asdr-close]').click();
  assert.equal(doc.getElementById('asdr-drawer'), null);
  assert.equal(doc.body.style.overflow, '');
  dom.window.close();
});
