// Self-contained helpers are also embedded in the TV page.
function personalBestCopy(item = {}) {
  const name = String(item.personName || '').trim() || 'Esta pessoa';
  const actual = Math.max(0, Number(item.actualValue) || 0);
  const best = Math.max(0, Number(item.historicalBest) || 0);
  const meetings = (n) => item.role === 'closer' || item.role === 'closers'
    ? (n === 1 ? 'venda' : 'vendas') : (n === 1 ? 'agendamento' : 'agendamentos');
  if (!best) return { headline: `${name} está construindo seu primeiro recorde semanal.`, context: 'Ainda não há uma marca anterior para comparar.' };
  const context = `Melhor marca anterior: ${best} ${meetings(best)}.`;
  if (actual === best) return { headline: `${name} igualou seu recorde pessoal da semana.`, context };
  if (actual > best) {
    const extra = actual - best;
    return { headline: `${name} superou seu recorde pessoal da semana em ${extra} ${meetings(extra)}.`, context: `Recorde anterior: ${best} ${meetings(best)}.` };
  }
  // Reaching the previous mark is a tie; beating it requires one more meeting.
  const remaining = Math.floor(best - actual) + 1;
  return { headline: `${remaining === 1 ? 'Falta' : 'Faltam'} ${remaining} ${meetings(remaining)} para ${name} bater seu recorde pessoal da semana.`, context };
}

function sdrRankingPages(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const pages = [];
  for (let offset = 0; offset < list.length; offset += 4) {
    pages.push({ key: offset ? `sdrs_${offset / 4}` : 'sdrs', offset, rows: list.slice(offset, offset + 4) });
  }
  return pages.length ? pages : [{ key: 'sdrs', offset: 0, rows: [] }];
}

module.exports = { personalBestCopy, sdrRankingPages };

// One candidate remains selected throughout a complete carousel cycle.
function createRecordRoundRobin() {
  let candidates = [], selectedPerson = '';
  const roleTurns = new Map();
  const identity = item => item.personId || item.id;
  const people = () => [...new Set(candidates.map(identity))];
  return {
    setCandidates(next) {
      const seen = new Set();
      candidates = (Array.isArray(next) ? next : []).filter(item => {
        if (!item?.id || seen.has(item.id)) return false;
        seen.add(item.id); return true;
      }).slice().sort((a, b) => identity(a).localeCompare(identity(b)) || a.id.localeCompare(b.id));
      if (!people().includes(selectedPerson)) selectedPerson = people()[0] || '';
    },
    advance() {
      const ids = people();
      if (!ids.length) return;
      roleTurns.set(selectedPerson, (roleTurns.get(selectedPerson) || 0) + 1);
      selectedPerson = ids[(ids.indexOf(selectedPerson) + 1) % ids.length];
    },
    current() {
      const roles = candidates.filter(item => identity(item) === selectedPerson);
      return roles.length ? roles[(roleTurns.get(selectedPerson) || 0) % roles.length] : null;
    },
  };
}
module.exports.createRecordRoundRobin = createRecordRoundRobin;
