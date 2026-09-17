const test = require("node:test");
const assert = require("node:assert/strict");

const actions = require("../api/_lib/crm-qualification-actions");

const baseOpportunity = {
  id: "opp_1",
  contactId: "contact_1",
  ownerId: "closer_1",
};

const baseHandoff = {
  id: "handoff_1",
  qualificationRunId: "run_1",
  qualificationVersionId: "version_1",
  qualificationVersionNumber: 1,
  sdrUserId: "sdr_1",
  closerUserId: "closer_1",
};

const baseReview = {
  id: "review_1",
  closerUserId: "closer_1",
  salesAccepted: false,
  rejectReason: "low_urgency",
  rejectNote: "Lead pediu para voltar depois.",
  accuracyScore: 72,
  dimensionValidation: {
    need_fit: "confirmed",
    urgency: "contradicted",
    commitment: "not_discussed",
  },
};

test("recommended action matrix creates operational action types", () => {
  assert.equal(actions.actionTypeForRecommendedAction("continue_sales"), null);
  assert.deepEqual(actions.actionTypeForRecommendedAction("nurture_recommended"), { type: "nurture", priority: "normal" });
  assert.deepEqual(actions.actionTypeForRecommendedAction("lower_plan_or_nurture_recommended"), { type: "commercial_alternative", priority: "normal" });
  assert.deepEqual(actions.actionTypeForRecommendedAction("discard_recommended"), { type: "discard_review", priority: "normal" });
  assert.deepEqual(actions.actionTypeForRecommendedAction("alignment_review_required"), { type: "alignment_review", priority: "high" });
  assert.deepEqual(actions.actionTypeForRecommendedAction("sdr_coaching_flag"), { type: "sdr_coaching", priority: "high" });
});

test("buildQualificationActionFromReview is deterministic and idempotent by review and type", () => {
  const first = actions.buildQualificationActionFromReview({
    scopeId: "space-main",
    review: baseReview,
    handoff: baseHandoff,
    opportunity: baseOpportunity,
    recommendedAction: "nurture_recommended",
    createdBy: "admin_1",
    stamp: "2026-09-17T12:00:00.000Z",
  });
  const retry = actions.buildQualificationActionFromReview({
    scopeId: "space-main",
    review: baseReview,
    handoff: baseHandoff,
    opportunity: baseOpportunity,
    recommendedAction: "nurture_recommended",
    createdBy: "admin_1",
    stamp: "2026-09-17T12:00:00.000Z",
  });
  assert.equal(first.id, "qaction_review_1_nurture");
  assert.equal(retry.id, first.id);
  assert.equal(first.status, "pending");
  assert.equal(first.assignedTo, "closer_1");
});

test("coaching action stores SDR, review, run and contradicted dimensions", () => {
  const action = actions.buildQualificationActionFromReview({
    scopeId: "space-main",
    review: { ...baseReview, rejectReason: "incorrect_sdr_information" },
    handoff: baseHandoff,
    opportunity: baseOpportunity,
    recommendedAction: "sdr_coaching_flag",
    createdBy: "admin_1",
    stamp: "2026-09-17T12:00:00.000Z",
  });
  assert.equal(action.type, "sdr_coaching");
  assert.equal(action.priority, "high");
  assert.equal(action.assignedTo, null);
  assert.equal(action.metadata.sdrUserId, "sdr_1");
  assert.equal(action.metadata.closerReviewId, "review_1");
  assert.equal(action.metadata.qualificationRunId, "run_1");
  assert.deepEqual(action.metadata.contradictedDimensions, ["urgency"]);
});

test("permissions allow admin and assigned growth, but block unrelated SDR coaching clearance", () => {
  const assigned = { status: "pending", assignedTo: "growth_1", type: "nurture" };
  const coaching = { status: "pending", assignedTo: null, type: "sdr_coaching" };
  assert.equal(actions.canManageAction({ role: "admin", uid: "anyone", action: coaching }), true);
  assert.equal(actions.canManageAction({ role: "growth", uid: "growth_1", action: assigned }), true);
  assert.equal(actions.canManageAction({ role: "growth", uid: "sdr_1", action: coaching }), false);
});

test("normalizeAction protects status, type and priority defaults", () => {
  const normalized = actions.normalizeAction({
    id: "action_1",
    status: "weird",
    type: "unknown",
    priority: "panic",
  }, "space-main");
  assert.equal(normalized.status, "pending");
  assert.equal(normalized.type, "");
  assert.equal(normalized.priority, "normal");
});
