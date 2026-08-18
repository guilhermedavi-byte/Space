const FINAL_WINDOW_MS = 24 * 60 * 60 * 1000;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const lerp = (start, end, t) => start + ((end - start) * t);

function resolvePulseVisuals(remainingClampedMs) {
  const hour = 60 * 60 * 1000;
  if (remainingClampedMs <= 0) {
    return {
      accentAlpha: 1,
      pulseDurationMs: 520,
      pulseMinOpacity: 0.22,
      pulseMaxOpacity: 1,
      pulseBrightnessMin: 0.92,
      pulseBrightnessMax: 1.36,
      textAlpha: 1,
    };
  }
  if (remainingClampedMs <= hour) {
    const t = 1 - clamp(remainingClampedMs / hour, 0, 1);
    return {
      accentAlpha: lerp(0.92, 1, t),
      pulseDurationMs: lerp(1150, 520, t),
      pulseMinOpacity: lerp(0.34, 0.22, t),
      pulseMaxOpacity: 1,
      pulseBrightnessMin: lerp(1.02, 0.92, t),
      pulseBrightnessMax: lerp(1.18, 1.36, t),
      textAlpha: 1,
    };
  }
  if (remainingClampedMs <= 3 * hour) {
    const t = 1 - clamp((remainingClampedMs - hour) / (2 * hour), 0, 1);
    return {
      accentAlpha: lerp(0.82, 0.92, t),
      pulseDurationMs: lerp(2400, 1150, t),
      pulseMinOpacity: lerp(0.5, 0.34, t),
      pulseMaxOpacity: lerp(0.98, 1, t),
      pulseBrightnessMin: lerp(0.94, 1.02, t),
      pulseBrightnessMax: lerp(1.08, 1.18, t),
      textAlpha: lerp(0.92, 1, t),
    };
  }
  if (remainingClampedMs <= 12 * hour) {
    const t = 1 - clamp((remainingClampedMs - 3 * hour) / (9 * hour), 0, 1);
    return {
      accentAlpha: lerp(0.72, 0.82, t),
      pulseDurationMs: lerp(4300, 2400, t),
      pulseMinOpacity: lerp(0.66, 0.5, t),
      pulseMaxOpacity: lerp(0.9, 0.98, t),
      pulseBrightnessMin: lerp(0.88, 0.94, t),
      pulseBrightnessMax: lerp(0.98, 1.08, t),
      textAlpha: lerp(0.84, 0.92, t),
    };
  }
  const t = 1 - clamp((remainingClampedMs - 12 * hour) / (12 * hour), 0, 1);
  return {
    accentAlpha: lerp(0.58, 0.72, t),
    pulseDurationMs: lerp(5600, 4300, t),
    pulseMinOpacity: lerp(0.78, 0.66, t),
    pulseMaxOpacity: lerp(0.88, 0.9, t),
    pulseBrightnessMin: lerp(0.84, 0.88, t),
    pulseBrightnessMax: lerp(0.94, 0.98, t),
    textAlpha: lerp(0.78, 0.84, t),
  };
}

function parseDateKeyAtEnd(dateKey) {
  const raw = String(dateKey || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const date = new Date(`${raw}T23:59:59-03:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function computeDeadlineModeState({ endDateKey = '', now = new Date() } = {}) {
  const endDate = parseDateKeyAtEnd(endDateKey);
  if (!(endDate instanceof Date)) {
    return {
      splitActive: false,
      deadlineReached: false,
      remainingMs: 0,
      remainingClampedMs: 0,
      progressPct: 0,
      urgencyLevel: 'normal',
      hours: '00',
      minutes: '00',
      seconds: '00',
      totalSecondsRemaining: 0,
      label: 'para fechar a semana',
      statusText: 'semana indisponível',
      driftX: 0,
      driftY: 0,
    };
  }
  const current = now instanceof Date ? now : new Date(now);
  const safeNow = Number.isNaN(current.getTime()) ? new Date() : current;
  const remainingMs = endDate.getTime() - safeNow.getTime();
  const remainingClampedMs = Math.max(0, remainingMs);
  const splitActive = remainingMs <= FINAL_WINDOW_MS;
  const deadlineReached = remainingMs <= 0;
  const totalSeconds = Math.floor(remainingClampedMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const progressPct = clamp((remainingClampedMs / FINAL_WINDOW_MS) * 100, 0, 100);
  const urgencyLevel = deadlineReached ? 'expired' : remainingClampedMs <= 60 * 60 * 1000 ? 'critical' : remainingClampedMs <= 6 * 60 * 60 * 1000 ? 'warning' : 'normal';
  const pulseVisuals = resolvePulseVisuals(remainingClampedMs);
  const driftBucket = Math.floor(safeNow.getTime() / (5 * 60 * 1000));
  const driftOffsets = [
    { x: 0, y: 0 },
    { x: 1, y: -1 },
    { x: -1, y: 1 },
    { x: 1, y: 1 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
  ];
  const drift = driftOffsets[driftBucket % driftOffsets.length] || driftOffsets[0];
  return {
    splitActive,
    deadlineReached,
    remainingMs,
    remainingClampedMs,
    progressPct,
    urgencyLevel,
    hours: String(hours).padStart(2, '0'),
    minutes: String(minutes).padStart(2, '0'),
    seconds: String(seconds).padStart(2, '0'),
    totalSecondsRemaining: totalSeconds,
    label: deadlineReached ? 'aguardando a virada da semana' : 'para fechar a semana',
    statusText: deadlineReached ? 'semana encerrando' : 'contagem final da semana',
    driftX: drift.x,
    driftY: drift.y,
    accentAlpha: pulseVisuals.accentAlpha,
    pulseDurationMs: pulseVisuals.pulseDurationMs,
    pulseMinOpacity: pulseVisuals.pulseMinOpacity,
    pulseMaxOpacity: pulseVisuals.pulseMaxOpacity,
    pulseBrightnessMin: pulseVisuals.pulseBrightnessMin,
    pulseBrightnessMax: pulseVisuals.pulseBrightnessMax,
    textAlpha: pulseVisuals.textAlpha,
  };
}

module.exports = {
  FINAL_WINDOW_MS,
  parseDateKeyAtEnd,
  computeDeadlineModeState,
};
