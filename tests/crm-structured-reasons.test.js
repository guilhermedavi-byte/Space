const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildStructuredReasonRankingsFromEvents,
  closerLostReasonLabel,
} = require("../api/_lib/crm-reasons");

const period = { startDateKey: "2026-09-01", endDateKey: "2026-09-30" };

test("structured reason rankings aggregate SDR discard events with period filtering and percentages", () => {
  const result = buildStructuredReasonRankingsFromEvents([
    { type: "crm.opportunity.discarded", createdAt: "2026-09-02T12:00:00.000Z", payload: { discardReason: "financial", discardedAt: "2026-09-02T12:00:00.000Z" } },
    { type: "crm.opportunity.discarded", createdAt: "2026-09-03T12:00:00.000Z", payload: { discardReason: "financial", discardedAt: "2026-09-03T12:00:00.000Z" } },
    { type: "crm.opportunity.discarded", createdAt: "2026-09-04T12:00:00.000Z", payload: { discardReason: "no_fit", discardedAt: "2026-09-04T12:00:00.000Z" } },
    { type: "crm.opportunity.discarded", createdAt: "2026-10-04T12:00:00.000Z", payload: { discardReason: "timing", discardedAt: "2026-10-04T12:00:00.000Z" } },
    { type: "crm.qualification.completed", createdAt: "2026-09-05T12:00:00.000Z", payload: { discardReason: "low_pain" } },
  ], { period });

  assert.equal(result.sdr.total, 3);
  assert.deepEqual(result.sdr.items.map((item) => item.reason), ["financial", "no_fit"]);
  assert.equal(result.sdr.items[0].label, "Sem condição financeira");
  assert.equal(result.sdr.items[0].count, 2);
  assert.equal(result.sdr.items[0].percentage, 66.7);
  assert.equal(result.sdr.items[1].percentage, 33.3);
});

test("structured reason rankings aggregate closer lost events historically and keep top five", () => {
  const reasons = ["price", "price", "financial", "timing", "competitor", "no_response", "other", "payment"];
  const result = buildStructuredReasonRankingsFromEvents(
    reasons.map((lostReason, index) => ({
      type: "crm.opportunity.lost",
      createdAt: `2026-09-${String(index + 1).padStart(2, "0")}T12:00:00.000Z`,
      payload: { lostReason, closedAt: `2026-09-${String(index + 1).padStart(2, "0")}T12:00:00.000Z` },
    })),
    { period }
  );

  assert.equal(result.closer.total, 8);
  assert.equal(result.closer.items.length, 5);
  assert.equal(result.closer.items[0].reason, "price");
  assert.equal(result.closer.items[0].count, 2);
  assert.equal(closerLostReasonLabel("payment"), "Pagamento");
  assert.ok(result.closer.items.every((item) => item.percentage > 0));
});

test("structured reason rankings return empty models for periods without losses", () => {
  const result = buildStructuredReasonRankingsFromEvents([
    { type: "crm.opportunity.lost", createdAt: "2026-08-15T12:00:00.000Z", payload: { lostReason: "price", closedAt: "2026-08-15T12:00:00.000Z" } },
  ], { period });

  assert.deepEqual(result.sdr, { total: 0, items: [] });
  assert.deepEqual(result.closer, { total: 0, items: [] });
});
