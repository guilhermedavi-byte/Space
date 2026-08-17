const test = require('node:test');
const assert = require('node:assert/strict');

const { buildScreenKeys, createCrmLiveLoopController } = require('../api/_lib/crm-live-rotation');

const createFakeScheduler = () => {
  let nextId = 1;
  const intervals = new Map();
  const timeouts = new Map();
  return {
    setInterval(fn, delay) {
      const id = nextId++;
      intervals.set(id, { fn, delay });
      return id;
    },
    clearInterval(id) {
      intervals.delete(id);
    },
    setTimeout(fn, delay) {
      const id = nextId++;
      timeouts.set(id, { fn, delay });
      return id;
    },
    clearTimeout(id) {
      timeouts.delete(id);
    },
    intervals,
    timeouts,
  };
};

const makePayload = (overrides = {}) => ({
  weekly: {
    closers: [{ personId: 'matheus-afonso' }, { personId: 'luis-eduardo' }],
    sdrs: [{ personId: 'luana-mendonca' }],
    team: {
      closers: { targetValue: 20000 },
      sdrs: { targetValue: 100 },
    },
    commercialWeek: { startDateKey: '2026-08-11', endDateKey: '2026-08-18' },
  },
  pipeline: { rows: [] },
  highlights: { closer: null, sdr: null },
  news: [],
  ...overrides,
});

test('pausa da rotação não interrompe timers separados de dados', () => {
  const scheduler = createFakeScheduler();
  const dataPollId = scheduler.setInterval(() => {}, 120000);
  const eventPollId = scheduler.setInterval(() => {}, 25000);
  const controller = createCrmLiveLoopController({
    rotateMs: 10000,
    eventScreenMs: 20000,
    setIntervalFn: scheduler.setInterval,
    clearIntervalFn: scheduler.clearInterval,
    setTimeoutFn: scheduler.setTimeout,
    clearTimeoutFn: scheduler.clearTimeout,
  });

  controller.setPayload(makePayload());
  assert.equal(scheduler.intervals.size, 3);

  controller.setPaused(true);

  assert.equal(scheduler.intervals.size, 2);
  assert.ok(scheduler.intervals.has(dataPollId));
  assert.ok(scheduler.intervals.has(eventPollId));
});

test('seta manual reinicia o cronômetro cheio da tela sem pausar a rotação', () => {
  const scheduler = createFakeScheduler();
  const controller = createCrmLiveLoopController({
    rotateMs: 10000,
    eventScreenMs: 20000,
    setIntervalFn: scheduler.setInterval,
    clearIntervalFn: scheduler.clearInterval,
    setTimeoutFn: scheduler.setTimeout,
    clearTimeoutFn: scheduler.clearTimeout,
  });

  controller.setPayload(makePayload());
  const firstRotationTimerId = [...scheduler.intervals.keys()][0];
  assert.equal(controller.getState().activeKey, 'closers');

  controller.step(1);

  const secondRotationTimerId = [...scheduler.intervals.keys()][0];
  assert.notEqual(secondRotationTimerId, firstRotationTimerId);
  assert.equal(controller.getState().activeKey, 'sdrs');
  assert.equal(controller.getState().paused, false);
});

test('navegação pula telas condicionais vazias nos dois sentidos', () => {
  const payload = makePayload({
    weekly: {
      closers: [{ personId: 'matheus-afonso' }],
      sdrs: [{ personId: 'luana-mendonca' }],
      team: {
        closers: { targetValue: 20000 },
        sdrs: { targetValue: 0 },
      },
      commercialWeek: { startDateKey: '2026-08-11', endDateKey: '2026-08-18' },
    },
    pipeline: { rows: [] },
    highlights: { closer: null, sdr: null },
    news: [],
  });
  const keys = buildScreenKeys(payload);
  assert.deepEqual(keys, ['closers', 'sdrs', 'goal', 'week', 'duel']);

  const scheduler = createFakeScheduler();
  const controller = createCrmLiveLoopController({
    setIntervalFn: scheduler.setInterval,
    clearIntervalFn: scheduler.clearInterval,
    setTimeoutFn: scheduler.setTimeout,
    clearTimeoutFn: scheduler.clearTimeout,
  });

  controller.setPayload(payload);
  controller.step(-1);
  assert.equal(controller.getState().activeKey, 'duel');
  controller.step(1);
  assert.equal(controller.getState().activeKey, 'closers');
  controller.step(1);
  controller.step(1);
  controller.step(1);
  assert.equal(controller.getState().activeKey, 'week');
  controller.step(1);
  assert.equal(controller.getState().activeKey, 'duel');
});

test('interrupção aparece mesmo pausado, preserva fila e volta para a tela pausada', () => {
  const scheduler = createFakeScheduler();
  const started = [];
  const ended = [];
  const controller = createCrmLiveLoopController({
    setIntervalFn: scheduler.setInterval,
    clearIntervalFn: scheduler.clearInterval,
    setTimeoutFn: scheduler.setTimeout,
    clearTimeoutFn: scheduler.clearTimeout,
    onInterruptionStart: (event) => started.push(event.id),
    onInterruptionEnd: (state) => ended.push(state.activeKey),
  });

  controller.setPayload(makePayload());
  controller.step(1);
  controller.step(1);
  assert.equal(controller.getState().activeKey, 'goal');
  controller.setPaused(true);

  controller.enqueueEvents([{ id: 'evt-1', type: 'sale_closed' }, { id: 'evt-2', type: 'leader_changed' }]);
  assert.equal(controller.getState().paused, true);
  assert.equal(controller.getState().interrupting, true);
  assert.deepEqual(started, ['evt-1']);

  controller.finishActiveInterruption();
  assert.equal(controller.getState().interrupting, true);
  assert.deepEqual(started, ['evt-1', 'evt-2']);

  controller.finishActiveInterruption();
  assert.equal(controller.getState().interrupting, false);
  assert.equal(controller.getState().activeKey, 'goal');
  assert.equal(controller.getState().paused, true);
  assert.equal(controller.getState().hasRotationTimer, false);
  assert.deepEqual(ended.slice(-1), ['goal']);
});
