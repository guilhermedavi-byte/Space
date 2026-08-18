const test = require('node:test');
const assert = require('node:assert/strict');

const { computeDeadlineModeState, FINAL_WINDOW_MS } = require('../api/_lib/crm-live-deadline');

test('24h01 restantes mantém modo normal', () => {
  const state = computeDeadlineModeState({
    endDateKey: '2026-08-18',
    now: new Date('2026-08-17T23:58:58-03:00'),
  });

  assert.equal(state.splitActive, false);
  assert.ok(state.remainingMs > FINAL_WINDOW_MS);
});

test('23h59 restantes ativa modo dividido', () => {
  const state = computeDeadlineModeState({
    endDateKey: '2026-08-18',
    now: new Date('2026-08-18T00:00:58-03:00'),
  });

  assert.equal(state.splitActive, true);
  assert.ok(state.remainingMs < FINAL_WINDOW_MS);
});

test('5 segundos restantes continua no modo dividido sem tempo negativo', () => {
  const state = computeDeadlineModeState({
    endDateKey: '2026-08-18',
    now: new Date('2026-08-18T23:59:54-03:00'),
  });

  assert.equal(state.splitActive, true);
  assert.equal(state.deadlineReached, false);
  assert.equal(state.hours, '00');
  assert.equal(state.minutes, '00');
  assert.equal(state.seconds, '05');
});

test('ao chegar em zero o modo segue dividido, zera o relógio e entra em estado final', () => {
  const state = computeDeadlineModeState({
    endDateKey: '2026-08-18',
    now: new Date('2026-08-18T23:59:59-03:00'),
  });

  assert.equal(state.splitActive, true);
  assert.equal(state.deadlineReached, true);
  assert.equal(state.hours, '00');
  assert.equal(state.minutes, '00');
  assert.equal(state.seconds, '00');
  assert.equal(state.label, 'aguardando a virada da semana');
});


test('reavalia a janela final mesmo com a página aberta horas antes', () => {
  const beforeWindow = computeDeadlineModeState({
    endDateKey: '2026-08-18',
    now: new Date('2026-08-17T23:58:58-03:00'),
  });
  const duringWindow = computeDeadlineModeState({
    endDateKey: '2026-08-18',
    now: new Date('2026-08-18T10:21:00-03:00'),
  });

  assert.equal(beforeWindow.splitActive, false);
  assert.equal(duringWindow.splitActive, true);
  assert.equal(duringWindow.hours, '13');
  assert.equal(duringWindow.minutes, '38');
});
