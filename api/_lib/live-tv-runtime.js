function createLiveTvBuildReloadCoordinator({
  buildId = '',
  reload = () => {},
  nowFn = () => Date.now(),
  setTimeoutFn = setTimeout,
  clearTimeoutFn = clearTimeout,
  transitionMs = 450,
  minReloadIntervalMs = 5 * 60 * 1000,
  storage = null,
  storageTargetKey = 'liveTv:lastReloadTargetBuildId',
  storageTimeKey = 'liveTv:lastReloadAtMs',
} = {}) {
  let currentBuildId = String(buildId || '').trim();
  let pendingBuildId = '';
  let paused = false;
  let interrupting = false;
  let transitionUntil = 0;
  let timerId = null;

  const readStoredTarget = () => {
    if (!storage || typeof storage.getItem !== 'function') return '';
    try {
      return String(storage.getItem(storageTargetKey) || '').trim();
    } catch {
      return '';
    }
  };

  const readStoredTime = () => {
    if (!storage || typeof storage.getItem !== 'function') return null;
    try {
      const raw = storage.getItem(storageTimeKey);
      if (raw == null || raw === '') return null;
      const value = Number(raw);
      return Number.isFinite(value) ? value : null;
    } catch {
      return null;
    }
  };

  const writeStoredAttempt = (targetBuildId) => {
    if (!storage || typeof storage.setItem !== 'function') return;
    try {
      storage.setItem(storageTargetKey, String(targetBuildId || '').trim());
      storage.setItem(storageTimeKey, String(nowFn()));
    } catch {}
  };

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
    writeStoredAttempt(nextBuildId);
    reload(nextBuildId);
    return true;
  }

  const queueReloadIfNeeded = (nextBuildId) => {
    const normalized = String(nextBuildId || '').trim();
    if (!normalized || normalized === currentBuildId) return false;
    const storedTarget = readStoredTarget();
    const storedTime = readStoredTime();
    if (storedTarget && storedTarget === normalized) return false;
    if (storedTime != null && (nowFn() - storedTime) < minReloadIntervalMs) return false;
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
    storedTarget: readStoredTarget(),
    storedTime: readStoredTime(),
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
  createLiveTvBuildReloadCoordinator,
};
