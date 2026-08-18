const test = require('node:test');
const assert = require('node:assert/strict');

const {
  computeDeadlineModeState,
  FINAL_WINDOW_MS,
  SECOND_HAND_DIRECTION,
  resolveSecondHandAngleDeg,
} = require('../api/_lib/crm-live-deadline');

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

test('ponteiro countdown mapeia 0, 15, 30 e 45 segundos nos pontos cardeais', () => {
  assert.equal(SECOND_HAND_DIRECTION, 'countdown');
  assert.equal(resolveSecondHandAngleDeg(0, 'countdown'), -90);
  assert.equal(resolveSecondHandAngleDeg(15, 'countdown'), 0);
  assert.equal(resolveSecondHandAngleDeg(30, 'countdown'), 90);
  assert.equal(resolveSecondHandAngleDeg(45, 'countdown'), 180);
});

test('ângulo não muda dentro do mesmo segundo inteiro', () => {
  const first = computeDeadlineModeState({
    endDateKey: '2026-08-18',
    now: new Date('2026-08-18T23:59:37.100-03:00'),
  });
  const second = computeDeadlineModeState({
    endDateKey: '2026-08-18',
    now: new Date('2026-08-18T23:59:37.900-03:00'),
  });

  assert.equal(first.seconds, second.seconds);
  assert.equal(first.secondHandAngleDeg, second.secondHandAngleDeg);
});

test('display e ponteiro derivam da mesma leitura de tempo restante', () => {
  const state = computeDeadlineModeState({
    endDateKey: '2026-08-18',
    now: new Date('2026-08-18T23:59:37.900-03:00'),
  });

  const expectedSeconds = Math.floor(state.remainingClampedMs / 1000) % 60;
  assert.equal(state.seconds, String(expectedSeconds).padStart(2, '0'));
  assert.equal(state.secondHandAngleDeg, resolveSecondHandAngleDeg(expectedSeconds, state.secondHandDirection));
  assert.doesNotMatch(computeDeadlineModeState.toString(), /getSeconds\(/);
});

test('trocar a direção inverte o ângulo sem quebrar o mapeamento', () => {
  assert.equal(resolveSecondHandAngleDeg(15, 'clockwise'), 180);
  assert.equal(resolveSecondHandAngleDeg(30, 'clockwise'), 90);
  assert.equal(resolveSecondHandAngleDeg(45, 'clockwise'), 0);
});
