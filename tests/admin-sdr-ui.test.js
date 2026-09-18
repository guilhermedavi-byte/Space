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
  dom.window.close();
});
