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
  assert.ok(doc.querySelector('[data-asdr-audio]').src.endsWith('/api/admin/sdr/calls/rec1/audio'));
  assert.ok(doc.querySelector('audio').src.endsWith('/api/admin/sdr/calls/rec1/audio'));
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

const transcriptView = async (transcript, sdrName = 'Luana') => {
  const dom = new JSDOM('<div data-admin-sdr></div>', { runScripts: 'outside-only', url: 'https://space.example' });
  dom.window.HTMLMediaElement.prototype.pause = () => {};
  dom.window.fetchWithAuth = async () => ({ ok: true, json: async () => ({ selectedCall: { recordingId: 'transcript-test', sdrName, transcript } }) });
  dom.window.eval(fs.readFileSync('admin-sdr.js', 'utf8'));
  await dom.window.SpaceAdminSdr.open();
  dom.window.document.querySelector('[data-asdr-detail-tab="transcript"]').click();
  return dom;
};

test('transcript displays only explicit seller/lead attribution and escapes content', async () => {
  const dom = await transcriptView('[00:01] Luana: Olá!\n[00:02] Lead: <img src=x onerror=alert(1)> Tudo bem.\nSpeaker 2: Sim.');
  const doc = dom.window.document;
  assert.equal(doc.querySelector('.seller .asdr-speaker').textContent, 'Vendedor');
  assert.equal(doc.querySelector('.lead .asdr-speaker').textContent, 'Lead');
  assert.equal(doc.querySelector('.unknown .asdr-speaker').textContent, 'Speaker 2');
  assert.equal(doc.querySelector('.asdr-utterance time').textContent, '00:01');
  assert.equal(doc.querySelector('.asdr-conversation img'), null);
  assert.ok(doc.querySelector('.lead p').textContent.includes('<img'));
  dom.window.close();
});

test('unlabelled transcript remains unattributed and complete in short blocks', async () => {
  const source = 'Olá, tudo bem? Quero aprender inglês para trabalhar. '.repeat(40).trim();
  const dom = await transcriptView(source);
  const doc = dom.window.document;
  const blocks = [...doc.querySelectorAll('.asdr-utterance p')];
  assert.ok(blocks.length > 4);
  assert.ok(blocks.every(block => block.textContent.length <= 650));
  assert.equal(blocks.map(block => block.textContent).join(' '), source);
  assert.equal(doc.querySelector('.asdr-utterance.seller, .asdr-utterance.lead'), null);
  dom.window.close();
});

test('structured transcript handles explicit roles and exact SDR names with punctuation', async () => {
  const dom = await transcriptView(JSON.stringify({ segments: [{ role: 'seller', text: 'Olá.' }, { role: 'lead', text: 'Bom dia.' }] }));
  assert.equal(dom.window.document.querySelectorAll('.asdr-utterance').length, 2);
  dom.window.close();
  const named = await transcriptView('Ana (SDR): Oi.\nCliente: Olá.', 'Ana (SDR)');
  assert.equal(named.window.document.querySelectorAll('.asdr-utterance.seller').length, 1);
  named.window.close();
});
