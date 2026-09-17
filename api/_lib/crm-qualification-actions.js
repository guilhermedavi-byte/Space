const ACTION_STATUSES = new Set(["pending", "completed", "dismissed"]);
const ACTION_TYPES = new Set(["nurture", "commercial_alternative", "discard_review", "alignment_review", "sdr_coaching"]);
const ACTION_PRIORITIES = new Set(["low", "normal", "high"]);

const ACTION_BY_RECOMMENDATION = {
  continue_sales: null,
  nurture_recommended: { type: "nurture", priority: "normal" },
  lower_plan_or_nurture_recommended: { type: "commercial_alternative", priority: "normal" },
  discard_recommended: { type: "discard_review", priority: "normal" },
  alignment_review_required: { type: "alignment_review", priority: "high" },
  sdr_coaching_flag: { type: "sdr_coaching", priority: "high" },
};

const RECOMMENDED_ACTION_LABELS = {
  continue_sales: "Continuar negociação",
  nurture_recommended: "Nurture recomendado",
  lower_plan_or_nurture_recommended: "Alternativa comercial recomendada",
  discard_recommended: "Revisar descarte",
  alignment_review_required: "Revisar alinhamento",
  sdr_coaching_flag: "Revisar coaching SDR",
};

const REJECT_REASON_LABELS = {
  no_fit: "Sem fit",
  low_pain: "Dor insuficiente",
  low_urgency: "Baixa urgência",
  financial: "Sem capacidade financeira",
  decision_authority: "Sem autonomia para decisão",
  expectation_mismatch: "Expectativa desalinhada",
  incorrect_sdr_information: "Informação incorreta do SDR",
  other: "Outro",
};

const clean = (value) => String(value || "").trim();
const toIso = (value) => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  const raw = clean(value);
  return raw || null;
};
const numberOrNull = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const actionTypeForRecommendedAction = (recommendedAction) => ACTION_BY_RECOMMENDATION[clean(recommendedAction)] || null;

const actionIdForReview = ({ reviewId, type }) =>
  ["qaction", reviewId, type].map(clean).filter(Boolean).join("_").replace(/[^a-zA-Z0-9_-]/g, "_");

const normalizeAction = (row = {}, scopeId = "") => {
  const type = clean(row.type);
  const status = clean(row.status);
  const priority = clean(row.priority);
  return {
    id: clean(row.id || row.firestoreDocId),
    scopeId: clean(row.scopeId) || clean(scopeId),
    opportunityId: clean(row.opportunityId),
    contactId: clean(row.contactId) || null,
    handoffId: clean(row.handoffId) || null,
    closerReviewId: clean(row.closerReviewId) || null,
    type: ACTION_TYPES.has(type) ? type : "",
    status: ACTION_STATUSES.has(status) ? status : "pending",
    priority: ACTION_PRIORITIES.has(priority) ? priority : "normal",
    assignedTo: clean(row.assignedTo) || null,
    dueAt: toIso(row.dueAt),
    reason: clean(row.reason) || null,
    metadata: row.metadata && typeof row.metadata === "object" ? row.metadata : {},
    createdAt: toIso(row.createdAt),
    createdBy: clean(row.createdBy) || null,
    completedAt: toIso(row.completedAt),
    completedBy: clean(row.completedBy) || null,
    dismissedAt: toIso(row.dismissedAt),
    dismissedBy: clean(row.dismissedBy) || null,
    dismissedReason: clean(row.dismissedReason) || null,
    resolutionNote: clean(row.resolutionNote) || null,
    resolutionCategory: clean(row.resolutionCategory) || null,
    createdActivityId: clean(row.createdActivityId) || null,
    updatedAt: toIso(row.updatedAt),
  };
};

const contradictedDimensionsFromReview = (review = {}) =>
  Object.entries(review.dimensionValidation || {})
    .filter(([, value]) => clean(value) === "contradicted")
    .map(([dimension]) => dimension);

const reasonForRecommendedAction = ({ recommendedAction, rejectReason, rejectNote } = {}) => {
  const label = RECOMMENDED_ACTION_LABELS[clean(recommendedAction)] || clean(recommendedAction);
  const reason = REJECT_REASON_LABELS[clean(rejectReason)] || clean(rejectReason);
  return [label, reason ? `Motivo: ${reason}` : "", clean(rejectNote)].filter(Boolean).join(" · ");
};

const assignedToForAction = ({ type, handoff = {}, opportunity = {} }) => {
  if (type === "nurture" || type === "commercial_alternative") return clean(handoff.closerUserId || opportunity.ownerId) || null;
  return null;
};

const buildQualificationActionFromReview = ({ scopeId, review, handoff, opportunity, recommendedAction, createdBy, stamp }) => {
  const spec = actionTypeForRecommendedAction(recommendedAction);
  if (!spec || !review?.id || !opportunity?.id) return null;
  const type = spec.type;
  const id = actionIdForReview({ reviewId: review.id, type });
  const metadata = {
    recommendedAction: clean(recommendedAction),
    salesAccepted: review.salesAccepted === true,
    rejectReason: clean(review.rejectReason) || null,
    rejectNote: clean(review.rejectNote) || null,
    closerReviewId: review.id,
    sdrUserId: clean(handoff?.sdrUserId) || null,
    closerUserId: clean(review.closerUserId || handoff?.closerUserId) || null,
    qualificationRunId: clean(handoff?.qualificationRunId) || null,
    qualificationVersionId: clean(handoff?.qualificationVersionId) || null,
    qualificationVersionNumber: numberOrNull(handoff?.qualificationVersionNumber),
    accuracyScore: numberOrNull(review.accuracyScore),
    contradictedDimensions: contradictedDimensionsFromReview(review),
  };
  return {
    id,
    scopeId,
    opportunityId: opportunity.id,
    contactId: opportunity.contactId || null,
    handoffId: clean(handoff?.id) || null,
    closerReviewId: review.id,
    type,
    status: "pending",
    priority: spec.priority,
    assignedTo: assignedToForAction({ type, handoff, opportunity }),
    dueAt: null,
    reason: reasonForRecommendedAction({ recommendedAction, rejectReason: review.rejectReason, rejectNote: review.rejectNote }),
    metadata,
    createdAt: stamp,
    createdBy: clean(createdBy) || null,
    completedAt: null,
    completedBy: null,
    dismissedAt: null,
    dismissedBy: null,
    dismissedReason: null,
    updatedAt: stamp,
  };
};

const canManageAction = ({ role, uid, action }) => {
  if (clean(role) === "admin") return true;
  if (clean(role) !== "growth") return false;
  return Boolean(clean(action?.assignedTo) && clean(action.assignedTo) === clean(uid));
};

module.exports = {
  ACTION_PRIORITIES,
  ACTION_STATUSES,
  ACTION_TYPES,
  RECOMMENDED_ACTION_LABELS,
  actionIdForReview,
  actionTypeForRecommendedAction,
  buildQualificationActionFromReview,
  canManageAction,
  contradictedDimensionsFromReview,
  normalizeAction,
  reasonForRecommendedAction,
};
