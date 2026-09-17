const test = require("node:test");
const assert = require("node:assert/strict");

const handoff = require("../api/_lib/crm-handoff");
const qualification = require("../api/_lib/crm-qualification");

const seed = qualification.buildSdrSeedRows({
  scopeId: "space-main",
  stamp: "2026-09-17T12:00:00.000Z",
  actorId: "admin-1",
});

test("handoffIdForTransition is deterministic for retry/idempotency", () => {
  const input = {
    opportunityId: "opp_1",
    qualificationRunId: "run_1",
    toPipelineId: "closer",
    toStageId: "closer_stage_1",
  };
  assert.equal(handoff.handoffIdForTransition(input), handoff.handoffIdForTransition(input));
});

test("dimensionMaxWeights uses SDR question option max weights", () => {
  const weights = handoff.dimensionMaxWeights({ questions: seed.questions, options: seed.options });
  assert.equal(weights.need_fit, 15);
  assert.equal(weights.economic_readiness, 20);
  assert.equal(weights.decision_readiness, 15);
  assert.equal(weights.pain, 15);
  assert.equal(weights.impact, 10);
  assert.equal(weights.urgency, 15);
  assert.equal(weights.commitment, 10);
});

test("calculateAccuracy is weighted and excludes not_discussed", () => {
  const weights = handoff.dimensionMaxWeights({ questions: seed.questions, options: seed.options });
  const result = handoff.calculateAccuracy({
    weights,
    dimensionValidation: {
      need_fit: "confirmed",
      economic_readiness: "partial",
      decision_readiness: "contradicted",
      pain: "not_discussed",
      impact: "not_discussed",
      urgency: "not_discussed",
      commitment: "not_discussed",
    },
  });
  assert.equal(result.accuracyDenominator, 50);
  assert.equal(result.accuracyScore, 50);
});

test("assertReviewCanComplete blocks no-show and requires reject reason", () => {
  assert.throws(
    () => handoff.assertReviewCanComplete({ meetingOutcome: "no_show", salesAccepted: false }),
    /meeting_outcome_does_not_allow_review/,
  );
  assert.throws(
    () => handoff.assertReviewCanComplete({ meetingOutcome: "held", salesAccepted: false }),
    /reject_reason_required/,
  );
  assert.doesNotThrow(() => handoff.assertReviewCanComplete({
    meetingOutcome: "held",
    salesAccepted: true,
    dimensionValidation: {},
  }));
});

test("recommendedAction mapping separates SAL from accuracy", () => {
  assert.equal(handoff.recommendedActionForReview({ salesAccepted: true }), "continue_sales");
  assert.equal(handoff.recommendedActionForReview({ salesAccepted: false, rejectReason: "low_urgency" }), "nurture_recommended");
  assert.equal(handoff.recommendedActionForReview({ salesAccepted: false, rejectReason: "financial" }), "lower_plan_or_nurture_recommended");
  assert.equal(handoff.recommendedActionForReview({ salesAccepted: false, rejectReason: "no_fit" }), "discard_recommended");
  assert.equal(handoff.recommendedActionForReview({ salesAccepted: false, rejectReason: "expectation_mismatch" }), "alignment_review_required");
  assert.equal(handoff.recommendedActionForReview({ salesAccepted: false, rejectReason: "incorrect_sdr_information" }), "sdr_coaching_flag");
});

test("completed closer review is read-only", () => {
  assert.throws(
    () => handoff.assertReviewMutable({ status: "completed" }),
    /closer_review_completed_is_readonly/,
  );
  assert.equal(handoff.assertReviewMutable({ status: "pending" }), true);
});
