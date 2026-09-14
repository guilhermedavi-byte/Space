#!/usr/bin/env node
// Read-only audit of an exported snapshot. No credentials, network or writes.
// node scripts/audit-commercial-closings.js /path/snapshot.json
// Input: { now, users, growthPeople, goal, globalConfig, businesses }
const fs = require('node:fs');
const { summarizeClosedSales } = require('../api/_lib/commercial-sales');
const { formatSaoPauloDateKey } = require('../api/_lib/commercial-period');
const { normalizeKey } = require('../_lib/forecast-service');
const {
  resolveCommercialWeek, resolveWeeklyGoalConfig, buildGrowthPeopleIndexes,
  resolveCloserBucketForBusiness, buildActiveCommercialPeople, decodeGrowthPeopleDoc,
} = require('../api/_lib/growth-people');
const { encodeFields } = require('../_lib/firestore-rest');

const auditCommercialClosings = (snapshot) => {
  const now = new Date(snapshot.now);
  if (Number.isNaN(now.getTime())) throw new Error('snapshot.now must contain the date of the reported screen');
  const week = resolveCommercialWeek({ now });
  const configurations = (snapshot.growthPeople || []).map((person) => decodeGrowthPeopleDoc({
    name: `growthPeople/${person.personId || person.firestoreDocId || person.id}`, ...encodeFields(person),
  })).filter(Boolean);
  const realPeople = buildActiveCommercialPeople(snapshot.users || [], configurations);
  const oldIndexes = buildGrowthPeopleIndexes(configurations.filter((person) => person.active));
  const oldGoal = resolveWeeklyGoalConfig({ goal: snapshot.goal, globalConfig: snapshot.globalConfig, week }).weeklyGoal;
  const oldCloserIds = new Set((oldGoal?.people || []).filter((person) => ['closer', 'both'].includes(person.role)).map((person) => person.personId));
  const totals = summarizeClosedSales({ businesses: snapshot.businesses || [], period: week });
  const sales = totals.sales.map(({ business, ...sale }) => {
    const movedKey = business.lastMovedAt ? formatSaoPauloDateKey(business.lastMovedAt) : '';
    const bucket = resolveCloserBucketForBusiness(business, oldIndexes);
    const previousExclusions = [];
    if (!movedKey || movedKey < week.startDateKey || movedKey > week.endDateKey) previousExclusions.push('movement_date_outside_week_or_missing');
    if (normalizeKey(business?.stage?.pipeline?.name) !== normalizeKey('Conversão')) previousExclusions.push('old_weekly_pipeline_filter');
    if (!oldCloserIds.has(bucket.bucketPersonId)) previousExclusions.push('no_goal_row_for_closer_or_others');
    return { ...sale, previousBucket: bucket.bucketPersonId, previousExclusions };
  });
  const linkedIds = new Set(realPeople.flatMap((person) => person.identityKeys));
  return {
    week, actualValue: totals.actualValue, count: totals.count,
    previouslyCountedFromTheseSales: sales.filter((sale) => !sale.previousExclusions.length).reduce((sum, sale) => sum + sale.value, 0),
    sales, excluded: totals.excluded,
    unresolvedConfigurationIds: configurations.filter((person) => !person.isAggregate && !linkedIds.has(person.personId)).map((person) => person.personId),
    usersWithoutValidNames: realPeople.filter((person) => !person.hasValidDisplayName).map((person) => person.userUid),
    note: 'Unresolved configurations include inactive users and require review, not automatic deletion. Historical documents were not modified.',
  };
};

if (require.main === module) {
  try {
    if (!process.argv[2]) throw new Error('Usage: node scripts/audit-commercial-closings.js /path/snapshot.json');
    console.log(JSON.stringify(auditCommercialClosings(JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))), null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { auditCommercialClosings };
