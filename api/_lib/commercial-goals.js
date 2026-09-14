// Read-only management model. Financial and role rules remain owned by CRM Live.
const { resolveCommercialWeek, addDaysToDateKey, formatDateKey } = require('./commercial-week');
const { buildWeeklyGoalsReadModel } = require('./growth-people');
const { buildMonthSummary, buildWeeklyTeamSummary } = require('./crm-live');

const listCompetenciaWeeks = (competencia) => {
  const weeks = new Map();
  for (let day = `${competencia}-01`; day.slice(0, 7) === competencia; day = addDaysToDateKey(day, 1)) {
    const week = resolveCommercialWeek({ now: new Date(`${day}T12:00:00-03:00`) });
    // A week belongs to its start month, including cross-month weeks.
    if (week.startDateKey.slice(0, 7) === competencia) weeks.set(week.weekKey, week);
  }
  return [...weeks.values()];
};

const buildCommercialGoalsModel = ({ competencia, goal, previousGoal = null, globalConfig, people = [], businesses = [], sdrEvents = [], now = new Date() }) => {
  const today = formatDateKey(now);
  const editable = competencia >= today.slice(0, 7);
  const input = { globalConfig, people, businesses, sdrEvents };
  const describe = (week, sourceGoal) => {
    const read = buildWeeklyGoalsReadModel({ ...input, goal: sourceGoal, now: new Date(`${week.startDateKey}T12:00:00-03:00`) });
    const config = new Map((read.weeklyGoal?.people || []).map(row => [row.personId, row]));
    // Preserve explicit exclusions from every layer, including legacy identity aliases.
    const excluded = new Set();
    for (const layer of [globalConfig?.defaultWeeklyConfig, sourceGoal?.defaultWeeklyConfig, sourceGoal?.weeklyGoals?.[week.weekKey]]) {
      for (const row of layer?.people || []) {
        const person = people.find(person => person.personId === row.personId || person.identityKeys?.includes(row.personId));
        const id = person?.personId || row.personId;
        if (row.excluded) excluded.add(id); else excluded.delete(id);
      }
    }
    const rows = people.filter(person => person.active !== false && person.hasValidDisplayName !== false && !excluded.has(person.personId)).map(person => {
      const entry = config.get(person.personId);
      const role = person.isAggregate ? 'closer' : entry?.role || (person.roles.includes('closer') ? 'closer' : person.roles.includes('both') ? 'both' : 'sdr');
      return { personId: person.personId, displayName: person.displayName, isAggregate: person.isAggregate === true, role, targetValue: entry?.targetValue || 0 };
    });
    const exists = Object.prototype.hasOwnProperty.call(sourceGoal?.weeklyGoals || {}, week.weekKey);
    return { ...week, exists, rows, effectiveConfig: Boolean(read.weeklyGoal), configSource: read.weeklyGoalConfigSource,
      teamTarget: read.weeklyGoal?.teamTarget || 0,
      summary: buildWeeklyTeamSummary({ weeklyReadModel: read }).closers,
      progress: read.progress };
  };
  const weeks = listCompetenciaWeeks(competencia).map(week => {
    const previous = resolveCommercialWeek({ now: new Date(`${addDaysToDateKey(week.startDateKey, -1)}T12:00:00-03:00`) });
    const previousModel = describe(previous, previous.startDateKey.slice(0, 7) === competencia ? goal : previousGoal);
    const model = describe(week, goal);
    return { ...model, isCurrent: today >= week.startDateKey && today <= week.endDateKey,
      status: !model.exists ? 'Não definida' : today < week.startDateKey ? 'Programada' : today > week.endDateKey ? 'Concluída' : 'Em andamento',
      copyFromPrevious: !model.exists && previousModel.exists ? { rows: previousModel.rows, teamTarget: previousModel.teamTarget } : null };
  });
  const month = buildMonthSummary({ businesses, goal, now: new Date(`${competencia}-15T12:00:00-03:00`) });
  const monthlyExists = goal?.valorMeta != null;
  const distributed = weeks.filter(week => week.exists).reduce((sum, week) => sum + week.summary.targetValue, 0);
  return { competencia, currentCompetencia: today.slice(0, 7), editable, monthlyExists, goal, month, weeks,
    planning: { distributed, difference: month.summary.meta - distributed } };
};

module.exports = { listCompetenciaWeeks, buildCommercialGoalsModel };
