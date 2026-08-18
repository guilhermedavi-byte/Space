function createCrmLiveBuildReloadCoordinator({
  buildId = '',
  reload = () => {},
  nowFn = () => Date.now(),
  setTimeoutFn = setTimeout,
  clearTimeoutFn = clearTimeout,
  transitionMs = 450,
} = {}) {
  let currentBuildId = String(buildId || '').trim();
  let pendingBuildId = '';
  let paused = false;
  let interrupting = false;
  let transitionUntil = 0;
  let timerId = null;

  const clearScheduled = () => {
    if (!timerId) return;
    clearTimeoutFn(timerId);
    timerId = null;
  };

  const canReloadNow = () => {
    if (!pendingBuildId) return false;
    if (paused || interrupting) return false;
    return nowFn() >= transitionUntil;
  };

  const scheduleCheck = () => {
    clearScheduled();
    if (!pendingBuildId || paused || interrupting) return false;
    const delay = Math.max(0, transitionUntil - nowFn());
    timerId = setTimeoutFn(() => {
      timerId = null;
      flush();
    }, delay);
    return true;
  };

  function flush() {
    if (!canReloadNow()) {
      scheduleCheck();
      return false;
    }
    const nextBuildId = pendingBuildId;
    pendingBuildId = '';
    currentBuildId = nextBuildId;
    clearScheduled();
    reload(nextBuildId);
    return true;
  }

  const queueReloadIfNeeded = (nextBuildId) => {
    const normalized = String(nextBuildId || '').trim();
    if (!normalized || normalized === currentBuildId) return false;
    pendingBuildId = normalized;
    flush();
    return true;
  };

  const setPaused = (nextPaused) => {
    paused = !!nextPaused;
    if (!paused) flush();
    else clearScheduled();
    return paused;
  };

  const setInterrupting = (nextInterrupting) => {
    interrupting = !!nextInterrupting;
    if (!interrupting) flush();
    else clearScheduled();
    return interrupting;
  };

  const noteTransition = () => {
    transitionUntil = nowFn() + transitionMs;
    scheduleCheck();
    return transitionUntil;
  };

  const getState = () => ({
    currentBuildId,
    pendingBuildId,
    paused,
    interrupting,
    transitionUntil,
    scheduled: !!timerId,
  });

  return {
    queueReloadIfNeeded,
    setPaused,
    setInterrupting,
    noteTransition,
    flush,
    getState,
  };
}

module.exports = {
  createCrmLiveBuildReloadCoordinator,
};
