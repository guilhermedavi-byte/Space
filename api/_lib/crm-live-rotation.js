function buildScreenKeys(currentPayload, { getNested, safeArray } = {}) {
  const read = typeof getNested === 'function'
    ? getNested
    : (rootValue, keys, fallback) => {
        let current = rootValue;
        const list = Array.isArray(keys) ? keys : [];
        for (const key of list) {
          if (!current || typeof current !== 'object' || !(key in current)) return fallback;
          current = current[key];
        }
        return current == null ? fallback : current;
      };
  const toArray = typeof safeArray === 'function' ? safeArray : (value) => (Array.isArray(value) ? value : []);
  const keys = ['closers', 'sdrs', 'goal', 'week'];
  if (Number(read(currentPayload, ['weekly', 'team', 'sdrs', 'targetValue'], 0)) > 0) keys.push('team_sdr');
  if (toArray(read(currentPayload, ['pipeline', 'rows'], [])).length) keys.push('pipeline');
  toArray(read(currentPayload, ['news'], [])).forEach((item, index) => {
    if (item && item.type) keys.push('news_' + index);
  });
  const closerHighlight = read(currentPayload, ['highlights', 'closer'], null);
  const sdrHighlight = read(currentPayload, ['highlights', 'sdr'], null);
  if (closerHighlight && Number(closerHighlight.dailyValue || 0) > 0) keys.push('highlight_closer');
  if (sdrHighlight && Number(sdrHighlight.dailyValue || 0) > 0) keys.push('highlight_sdr');
  keys.push('duel');
  return keys;
}

function createCrmLiveLoopController({
  rotateMs = 10000,
  eventScreenMs = 20000,
  setIntervalFn = setInterval,
  clearIntervalFn = clearInterval,
  setTimeoutFn = setTimeout,
  clearTimeoutFn = clearTimeout,
  buildKeys = buildScreenKeys,
  onScreenChange = () => {},
  onInterruptionStart = () => {},
  onInterruptionEnd = () => {},
} = {}) {
  let payload = null;
  let screenKeys = [];
  let activeIndex = 0;
  let paused = false;
  let rotationTimer = null;
  let interruptionTimer = null;
  let eventQueue = [];
  let activeInterruption = null;

  const getActiveKey = () => (screenKeys[activeIndex] || '');

  const emitScreenChange = () => {
    onScreenChange({
      activeIndex,
      activeKey: getActiveKey(),
      screenKeys: [...screenKeys],
      paused,
      interrupting: !!activeInterruption,
    });
  };

  const stopRotation = () => {
    if (rotationTimer) {
      clearIntervalFn(rotationTimer);
      rotationTimer = null;
    }
  };

  const startRotation = () => {
    stopRotation();
    if (paused || activeInterruption || screenKeys.length <= 1) return;
    rotationTimer = setIntervalFn(() => {
      if (!screenKeys.length) return;
      activeIndex = (activeIndex + 1) % screenKeys.length;
      emitScreenChange();
    }, rotateMs);
  };

  const normalizeActiveIndex = (preferredKey = '') => {
    if (!screenKeys.length) {
      activeIndex = 0;
      return;
    }
    const preferredIndex = preferredKey ? screenKeys.indexOf(preferredKey) : -1;
    if (preferredIndex >= 0) {
      activeIndex = preferredIndex;
      return;
    }
    if (activeIndex >= screenKeys.length) activeIndex = 0;
    if (activeIndex < 0) activeIndex = 0;
  };

  const setPayload = (nextPayload) => {
    const previousKey = getActiveKey();
    payload = nextPayload || null;
    screenKeys = buildKeys(payload);
    if (!screenKeys.length) screenKeys = ['goal'];
    normalizeActiveIndex(previousKey);
    emitScreenChange();
    startRotation();
  };

  const step = (direction = 1) => {
    if (!screenKeys.length) return false;
    const size = screenKeys.length;
    const delta = direction < 0 ? -1 : 1;
    activeIndex = (activeIndex + delta + size) % size;
    emitScreenChange();
    startRotation();
    return true;
  };

  const setPaused = (nextPaused) => {
    paused = !!nextPaused;
    if (paused) {
      stopRotation();
    } else {
      startRotation();
    }
    emitScreenChange();
    return paused;
  };

  const togglePaused = () => setPaused(!paused);

  const finishActiveInterruption = () => {
    if (interruptionTimer) {
      clearTimeoutFn(interruptionTimer);
      interruptionTimer = null;
    }
    if (!activeInterruption) return;
    activeInterruption = null;
    onInterruptionEnd({
      activeIndex,
      activeKey: getActiveKey(),
      screenKeys: [...screenKeys],
      paused,
      pendingCount: eventQueue.length,
    });
    if (eventQueue.length) {
      playNextInterruption();
      return;
    }
    emitScreenChange();
    startRotation();
  };

  function playNextInterruption() {
    if (activeInterruption || !eventQueue.length) return false;
    activeInterruption = eventQueue.shift();
    stopRotation();
    onInterruptionStart(activeInterruption);
    interruptionTimer = setTimeoutFn(() => {
      finishActiveInterruption();
    }, eventScreenMs);
    return true;
  }

  const enqueueEvents = (events = []) => {
    const seen = new Set([activeInterruption?.id, ...eventQueue.map((event) => event?.id)].filter(Boolean));
    (Array.isArray(events) ? events : []).forEach((event) => {
      if (!event || !event.id || seen.has(event.id)) return;
      seen.add(event.id);
      eventQueue.push(event);
    });
    if (!activeInterruption) playNextInterruption();
    return eventQueue.length;
  };

  const getState = () => ({
    payload,
    screenKeys: [...screenKeys],
    activeIndex,
    activeKey: getActiveKey(),
    paused,
    interrupting: !!activeInterruption,
    activeInterruption,
    queueIds: eventQueue.map((event) => event?.id).filter(Boolean),
    hasRotationTimer: !!rotationTimer,
    hasInterruptionTimer: !!interruptionTimer,
  });

  return {
    setPayload,
    step,
    setPaused,
    togglePaused,
    enqueueEvents,
    finishActiveInterruption,
    getState,
    startRotation,
    stopRotation,
  };
}

module.exports = {
  buildScreenKeys,
  createCrmLiveLoopController,
};
