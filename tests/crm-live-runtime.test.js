const test = require('node:test');
const assert = require('node:assert/strict');

const { createCrmLiveBuildReloadCoordinator } = require('../api/_lib/crm-live-runtime');
const { renderToggleIcon } = require('../api/_lib/crm-live-toggle');
const crmLiveRoute = require('../api/crm-live');

const createFakeClock = () => {
  let now = 0;
  let nextId = 1;
  const timers = new Map();
  return {
    now: () => now,
    advance(ms) {
      now += ms;
      const ready = [...timers.entries()]
        .filter(([, timer]) => timer.at <= now)
        .sort((left, right) => left[1].at - right[1].at);
      ready.forEach(([id, timer]) => {
        timers.delete(id);
        timer.fn();
      });
    },
    setTimeout(fn, delay) {
      const id = nextId++;
      timers.set(id, { fn, at: now + Math.max(0, Number(delay) || 0) });
      return id;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
    timers,
  };
};

test('auto-reload espera fim seguro quando build muda durante interrupção e pausa manual', () => {
  const clock = createFakeClock();
  const reloads = [];
  const coordinator = createCrmLiveBuildReloadCoordinator({
    buildId: 'build-a',
    reload: (buildId) => reloads.push(buildId),
    nowFn: clock.now,
    setTimeoutFn: clock.setTimeout,
    clearTimeoutFn: clock.clearTimeout,
    transitionMs: 400,
  });

  coordinator.noteTransition();
  coordinator.setInterrupting(true);
  coordinator.queueReloadIfNeeded('build-b');
  clock.advance(1000);
  assert.deepEqual(reloads, []);

  coordinator.setPaused(true);
  coordinator.setInterrupting(false);
  clock.advance(1000);
  assert.deepEqual(reloads, []);

  coordinator.setPaused(false);
  assert.deepEqual(reloads, ['build-b']);
});

test('auto-reload não dispara no meio da transição de tela', () => {
  const clock = createFakeClock();
  const reloads = [];
  const coordinator = createCrmLiveBuildReloadCoordinator({
    buildId: 'build-a',
    reload: (buildId) => reloads.push(buildId),
    nowFn: clock.now,
    setTimeoutFn: clock.setTimeout,
    clearTimeoutFn: clock.clearTimeout,
    transitionMs: 400,
  });

  coordinator.noteTransition();
  coordinator.queueReloadIfNeeded('build-b');
  assert.deepEqual(reloads, []);
  clock.advance(399);
  assert.deepEqual(reloads, []);
  clock.advance(1);
  assert.deepEqual(reloads, ['build-b']);
});

test('toggle da rotação renderiza um único alvo clicável com ícone correto por estado', () => {
  const html = crmLiveRoute.buildHtml({ buildId: 'test-build' });
  assert.equal((html.match(/<button class="crm-live-control is-toggle"/g) || []).length, 1);
  assert.equal(html.includes('crm-live-pause-indicator'), false);
  assert.equal(html.includes(renderToggleIcon(false)), true);
  assert.equal(renderToggleIcon(true).includes('m8 5 11 7-11 7z'), true);
  assert.equal(renderToggleIcon(false).includes('M8 5h3v14H8zm5 0h3v14h-3z'), true);
});
