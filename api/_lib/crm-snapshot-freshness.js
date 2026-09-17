// Self-contained so the same function is tested in Node and embedded in the TV page.
function describeSnapshot(data, fallbackMode = false, nowMs = Date.now()) {
  const snapshot = data?.snapshot || {};
  const at = snapshot.lastSuccessfulRefreshAt || snapshot.lastCompleteAt || snapshot.fetchCompletedAt || data?.snapshotGeneratedAt || data?.generatedAt;
  const ms = Date.parse(at || '');
  const valid = snapshot.status === 'VALID' && snapshot.calculationVersion === 4;
  const ageMs = Number.isFinite(ms) ? Math.max(0, nowMs - ms) : null;
  const state = fallbackMode ? 'REFRESHING' : snapshot.refreshStatus || snapshot.healthStatus || (ageMs === null ? 'UNAVAILABLE' : ageMs > 1800000 ? 'CRITICAL' : ageMs > 180000 ? 'DEGRADED' : 'HEALTHY');
  const pending = fallbackMode || data?.stale || snapshot.stale || !valid || state !== 'HEALTHY';
  const label = Number.isFinite(ms) ? new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(ms)) : 'indisponível';
  const prefix = state === 'HEALTHY' ? '' : state === 'REFRESHING' ? 'Atualizando · ' : state === 'DEGRADED' ? 'Dados atrasados · ' : state === 'CRITICAL' ? 'Atualização crítica · ' : 'Dados indisponíveis · ';
  return { text: prefix + (valid ? 'Última atualização completa: ' : 'Snapshot anterior à versão atual: ') + label,
    tone: state === 'CRITICAL' || state === 'UNAVAILABLE' ? 'danger' : pending ? 'warning' : 'default', pending, state };
}
module.exports = { describeSnapshot };
