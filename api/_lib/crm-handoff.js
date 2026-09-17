const MEETING_OUTCOMES = new Set(["held", "no_show", "cancelled", "rescheduled"]);
const REVIEW_STATUSES = new Set(["pending", "completed"]);
const HANDOFF_STATUSES = new Set(["pending", "accepted", "rejected"]);
const VALIDATION_VALUES = new Set(["confirmed", "partial", "contradicted", "not_discussed"]);
const REJECT_REASONS = new Set([
  "no_fit",
  "low_pain",
  "low_urgency",
  "financial",
  "decision_authority",
  "expectation_mismatch",
  "incorrect_sdr_information",
  "other",
]);

const DIMENSIONS = [
  "need_fit",
  "economic_readiness",
  "decision_readiness",
  "pain",
  "impact",
  "urgency",
  "commitment",
];

const RECOMMENDED_ACTION_BY_REJECT_REASON = {
  no_fit: "discard_recommended",
  low_pain: "alignment_review_required",
  low_urgency: "nurture_recommended",
  financial: "lower_plan_or_nurture_recommended",
  decision_authority: "alignment_review_required",
  expectation_mismatch: "alignment_review_required",
  incorrect_sdr_information: "sdr_coaching_flag",
  other: "alignment_review_required",
};

const clean = (value) => String(value || "").trim();
const bool = (value) => value === true;
const toIso = (value) => {
  if (value instanceof Date) return value.toISOString();
  const raw = clean(value);
  return raw || null;
};
const numberOrNull = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};
const numberOrZero = (value) => numberOrNull(value) ?? 0;

const normalizeHandoff = (row = {}, scopeId = "") => ({
  id: clean(row.id || row.firestoreDocId),
  scopeId: clean(row.scopeId) || clean(scopeId),
  opportunityId: clean(row.opportunityId),
  contactId: clean(row.contactId) || null,
  qualificationRunId: clean(row.qualificationRunId),
  qualificationVersionId: clean(row.qualificationVersionId),
  qualificationVersionNumber: Number(row.qualificationVersionNumber) || null,
  sdrUserId: clean(row.sdrUserId) || null,
  closerUserId: clean(row.closerUserId) || null,
  fromPipelineId: clean(row.fromPipelineId),
  fromStageId: clean(row.fromStageId),
  toPipelineId: clean(row.toPipelineId),
  toStageId: clean(row.toStageId),
  fitScore: numberOrZero(row.fitScore),
  intentScore: numberOrZero(row.intentScore),
  totalScore: numberOrZero(row.totalScore),
  dimensionScores: row.dimensionScores && typeof row.dimensionScores === "object" ? row.dimensionScores : {},
  thresholdSnapshot: row.thresholdSnapshot && typeof row.thresholdSnapshot === "object" ? row.thresholdSnapshot : {},
  qualifiedAt: toIso(row.qualifiedAt),
  handoffAt: toIso(row.handoffAt),
  status: HANDOFF_STATUSES.has(clean(row.status)) ? clean(row.status) : "pending",
  createdAt: toIso(row.createdAt),
  updatedAt: toIso(row.updatedAt),
});

const normalizeReview = (row = {}, scopeId = "") => ({
  id: clean(row.id || row.firestoreDocId),
  scopeId: clean(row.scopeId) || clean(scopeId),
  handoffId: clean(row.handoffId),
  opportunityId: clean(row.opportunityId),
  contactId: clean(row.contactId) || null,
  closerUserId: clean(row.closerUserId) || null,
  meetingOutcome: MEETING_OUTCOMES.has(clean(row.meetingOutcome)) ? clean(row.meetingOutcome) : "",
  salesAccepted: row.salesAccepted === null || row.salesAccepted === undefined ? null : bool(row.salesAccepted),
  rejectReason: clean(row.rejectReason) || null,
  rejectNote: clean(row.rejectNote) || null,
  dimensionValidation: row.dimensionValidation && typeof row.dimensionValidation === "object" ? row.dimensionValidation : {},
  accuracyScore: numberOrNull(row.accuracyScore),
  accuracyDenominator: numberOrZero(row.accuracyDenominator),
  primaryRecommendedAction: clean(row.primaryRecommendedAction) || null,
  status: REVIEW_STATUSES.has(clean(row.status)) ? clean(row.status) : "pending",
  createdAt: toIso(row.createdAt),
  completedAt: toIso(row.completedAt),
  updatedAt: toIso(row.updatedAt),
});

const dimensionMaxWeights = ({ questions = [], options = [] }) => {
  const optionsByQuestionId = new Map();
  options.forEach((option) => {
    const questionId = clean(option.questionId);
    if (!optionsByQuestionId.has(questionId)) optionsByQuestionId.set(questionId, []);
    optionsByQuestionId.get(questionId).push(option);
  });
  const weights = DIMENSIONS.reduce((acc, dimension) => ({ ...acc, [dimension]: 0 }), {});
  return questions.reduce((acc, question) => {
    const dimension = clean(question.dimension);
    if (!DIMENSIONS.includes(dimension)) return acc;
    const max = (optionsByQuestionId.get(question.id) || []).reduce((current, option) => Math.max(current, Number(option.points) || 0), 0);
    acc[dimension] = (acc[dimension] || 0) + max;
    return acc;
  }, weights);
};

const normalizeDimensionValidation = (input = {}) => {
  const source = input && typeof input === "object" ? input : {};
  return DIMENSIONS.reduce((acc, dimension) => {
    const value = clean(source[dimension]);
    acc[dimension] = VALIDATION_VALUES.has(value) ? value : "not_discussed";
    return acc;
  }, {});
};

const calculateAccuracy = ({ dimensionValidation = {}, weights = {} }) => {
  const normalized = normalizeDimensionValidation(dimensionValidation);
  const scoreByValue = {
    confirmed: 1,
    partial: 0.5,
    contradicted: 0,
  };
  let numerator = 0;
  let denominator = 0;
  DIMENSIONS.forEach((dimension) => {
    const value = normalized[dimension];
    if (value === "not_discussed") return;
    const weight = Number(weights[dimension]) || 0;
    if (weight <= 0) return;
    numerator += weight * scoreByValue[value];
    denominator += weight;
  });
  return {
    dimensionValidation: normalized,
    accuracyScore: denominator > 0 ? Math.round((numerator / denominator) * 100) : null,
    accuracyDenominator: denominator,
  };
};

const recommendedActionForReview = ({ salesAccepted, rejectReason }) => {
  if (salesAccepted === true) return "continue_sales";
  return RECOMMENDED_ACTION_BY_REJECT_REASON[clean(rejectReason)] || "alignment_review_required";
};

const assertReviewCanComplete = ({ meetingOutcome, salesAccepted, rejectReason, rejectNote, dimensionValidation }) => {
  const outcome = clean(meetingOutcome);
  if (!MEETING_OUTCOMES.has(outcome)) throw Object.assign(new Error("invalid_meeting_outcome"), { status: 400 });
  if (outcome !== "held") throw Object.assign(new Error("meeting_outcome_does_not_allow_review"), { status: 409 });
  if (salesAccepted !== true && salesAccepted !== false) throw Object.assign(new Error("sales_accepted_required"), { status: 400 });
  if (salesAccepted === false) {
    if (!REJECT_REASONS.has(clean(rejectReason))) throw Object.assign(new Error("reject_reason_required"), { status: 400 });
    if (clean(rejectReason) === "other" && !clean(rejectNote)) throw Object.assign(new Error("reject_note_required"), { status: 400 });
  }
  const normalized = normalizeDimensionValidation(dimensionValidation);
  return { meetingOutcome: outcome, dimensionValidation: normalized };
};

const assertReviewMutable = (review = {}) => {
  if (clean(review.status) === "completed") {
    throw Object.assign(new Error("closer_review_completed_is_readonly"), { status: 409 });
  }
  return true;
};

const handoffIdForTransition = ({ opportunityId, qualificationRunId, toPipelineId, toStageId }) =>
  ["handoff", opportunityId, qualificationRunId, toPipelineId, toStageId].map(clean).filter(Boolean).join("_").replace(/[^a-zA-Z0-9_-]/g, "_");

module.exports = {
  DIMENSIONS,
  HANDOFF_STATUSES,
  MEETING_OUTCOMES,
  RECOMMENDED_ACTION_BY_REJECT_REASON,
  REJECT_REASONS,
  REVIEW_STATUSES,
  VALIDATION_VALUES,
  assertReviewCanComplete,
  assertReviewMutable,
  calculateAccuracy,
  dimensionMaxWeights,
  handoffIdForTransition,
  normalizeDimensionValidation,
  normalizeHandoff,
  normalizeReview,
  recommendedActionForReview,
};
