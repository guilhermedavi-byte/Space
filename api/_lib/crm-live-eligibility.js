// Presentation only: never use this predicate to discard financial ledger entries.
function isLivePerformanceEligible(row) {
  const target = row?.targetValue;
  return Boolean(row && row.active !== false && row.isAggregate !== true && row.personId !== 'outros'
    && target !== null && target !== undefined && target !== ''
    && Number.isFinite(Number(target)) && Number(target) > 0);
}
module.exports = { isLivePerformanceEligible };
