// Self-contained so the same function is tested in Node and embedded in the TV page.
function describeSnapshot(data, fallbackMode = false, nowMs = Date.now()) {
  const snapshot = data?.snapshot || {};
  const at = snapshot.lastCompleteAt || snapshot.fetchCompletedAt || data?.snapshotGeneratedAt || data?.generatedAt;
  const ms = Date.parse(at || '');
  const valid = snapshot.status === 'VALID' && snapshot.calculationVersion === 4;
  const pending = fallbackMode || data?.stale || snapshot.stale || !valid || !Number.isFinite(ms) || nowMs - ms >= 300000;
  const label = Number.isFinite(ms) ? new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(ms)) : 'indisponível';
  return { text: (pending ? 'Atualização pendente · ' : '') + (valid ? 'Última atualização completa: ' : 'Snapshot anterior à versão atual: ') + label,
    tone: pending ? 'warning' : 'default', pending };
}
module.exports = { describeSnapshot };
