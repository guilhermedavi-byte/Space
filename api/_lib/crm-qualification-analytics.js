const CRM_TIME_ZONE = "America/Sao_Paulo";

const SCORE_BANDS = [
  { id: "0_54", label: "0-54", min: 0, max: 54 },
  { id: "55_64", label: "55-64", min: 55, max: 64 },
  { id: "65_74", label: "65-74", min: 65, max: 74 },
  { id: "75_84", label: "75-84", min: 75, max: 84 },
  { id: "85_100", label: "85-100", min: 85, max: 100 },
];

const THRESHOLDS = [55, 60, 65, 70, 75, 80, 85];

const DIMENSIONS = [
  "need_fit",
  "economic_readiness",
  "decision_readiness",
  "pain",
  "impact",
  "urgency",
  "commitment",
];

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

const RECOMMENDED_ACTION_LABELS = {
  continue_sales: "Continuar negociação",
  nurture_recommended: "Nurture recomendado",
  lower_plan_or_nurture_recommended: "Plano inferior ou nurture",
  discard_recommended: "Descartar recomendado",
  alignment_review_required: "Revisar alinhamento",
  sdr_coaching_flag: "Coaching SDR",
};

const clean = (value) => String(value || "").trim();
const lower = (value) => clean(value).toLowerCase();
const numberOrNull = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};
const numberOrZero = (value) => numberOrNull(value) ?? 0;
const toIso = (value) => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  const raw = clean(value);
  return raw || null;
};

const dateKey = (date = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: CRM_TIME_ZONE }).format(date);
const localStart = (key) => new Date(`${key}T00:00:00-03:00`);
const addDays = (date, days) => new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
const addMonthsKey = (year, month, delta) => {
  const d = new Date(Date.UTC(year, month - 1 + delta, 1, 12, 0, 0));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
};
const monthKey = ({ year, month }) => `${year}-${String(month).padStart(2, "0")}-01`;

const resolvePeriod = (range = "30d", now = new Date()) => {
  const key = clean(range) || "30d";
  const today = localStart(dateKey(now));
  if (key === "7d") return { key, label: "Últimos 7 dias", start: addDays(today, -6), end: addDays(today, 1) };
  if (key === "90d") return { key, label: "Últimos 90 dias", start: addDays(today, -89), end: addDays(today, 1) };
  if (key === "month" || key === "this_month") {
    const [year, month] = dateKey(now).split("-").map(Number);
    const next = addMonthsKey(year, month, 1);
    return { key: "month", label: "Este mês", start: localStart(monthKey({ year, month })), end: localStart(monthKey(next)) };
  }
  if (key === "previous_month") {
    const [year, month] = dateKey(now).split("-").map(Number);
    const previous = addMonthsKey(year, month, -1);
    return { key, label: "Mês anterior", start: localStart(monthKey(previous)), end: localStart(monthKey({ year, month })) };
  }
  return { key: "30d", label: "Últimos 30 dias", start: addDays(today, -29), end: addDays(today, 1) };
};

const inPeriod = (value, period) => {
  const iso = toIso(value);
  if (!iso) return false;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) && ms >= period.start.getTime() && ms < period.end.getTime();
};

const pct = (num, den) => (den > 0 ? num / den : null);
const rate = (num, den) => ({ numerator: num, denominator: den, value: pct(num, den) });
const avg = (values) => {
  const nums = values.map(Number).filter(Number.isFinite);
  return nums.length ? nums.reduce((sum, value) => sum + value, 0) / nums.length : null;
};
const median = (values) => {
  const nums = values.map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  if (!nums.length) return null;
  const mid = Math.floor(nums.length / 2);
  return nums.length % 2 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
};

const normalizePipeline = (row = {}) => ({
  id: clean(row.id || row.firestoreDocId),
  name: clean(row.name),
  pipelineType: ["general", "sdr", "closer"].includes(clean(row.pipelineType)) ? clean(row.pipelineType) : "general",
});
const normalizeContact = (row = {}) => ({
  id: clean(row.id || row.firestoreDocId),
  name: clean(row.name),
  countryCode: clean(row.countryCode || row.country || row.location?.country).toUpperCase(),
});
const normalizeOpportunity = (row = {}) => ({
  id: clean(row.id || row.firestoreDocId),
  contactId: clean(row.contactId),
  pipelineId: clean(row.pipelineId),
  ownerId: clean(row.ownerId) || null,
  source: clean(row.source) || null,
  status: clean(row.status) || "open",
  closedAt: toIso(row.closedAt),
  closedValue: numberOrNull(row.closedValue),
  createdAt: toIso(row.createdAt),
});
const normalizeRun = (row = {}) => ({
  id: clean(row.id || row.firestoreDocId),
  opportunityId: clean(row.opportunityId),
  contactId: clean(row.contactId),
  versionId: clean(row.versionId),
  versionNumber: Number(row.versionNumber) || null,
  status: clean(row.status),
  passed: row.passed === true,
  fitScore: numberOrZero(row.fitScore),
  intentScore: numberOrZero(row.intentScore),
  totalScore: numberOrZero(row.totalScore),
  startedBy: clean(row.startedBy) || null,
  completedBy: clean(row.completedBy) || null,
  completedAt: toIso(row.completedAt),
});
const normalizeAnswer = (row = {}) => ({
  id: clean(row.id || row.firestoreDocId),
  runId: clean(row.runId),
  questionId: clean(row.questionId),
  optionId: clean(row.optionId),
  questionTitle: clean(row.questionTitle),
  optionLabel: clean(row.optionLabel),
  dimension: clean(row.dimension),
  points: numberOrZero(row.points),
});
const normalizeHandoff = (row = {}) => ({
  id: clean(row.id || row.firestoreDocId),
  opportunityId: clean(row.opportunityId),
  contactId: clean(row.contactId),
  qualificationRunId: clean(row.qualificationRunId),
  qualificationVersionId: clean(row.qualificationVersionId),
  qualificationVersionNumber: Number(row.qualificationVersionNumber) || null,
  sdrUserId: clean(row.sdrUserId) || null,
  closerUserId: clean(row.closerUserId) || null,
  fromPipelineId: clean(row.fromPipelineId),
  toPipelineId: clean(row.toPipelineId),
  fitScore: numberOrZero(row.fitScore),
  intentScore: numberOrZero(row.intentScore),
  totalScore: numberOrZero(row.totalScore),
  handoffAt: toIso(row.handoffAt),
});
const normalizeReview = (row = {}) => ({
  id: clean(row.id || row.firestoreDocId),
  handoffId: clean(row.handoffId),
  opportunityId: clean(row.opportunityId),
  contactId: clean(row.contactId),
  closerUserId: clean(row.closerUserId) || null,
  meetingOutcome: clean(row.meetingOutcome),
  salesAccepted: row.salesAccepted === null || row.salesAccepted === undefined ? null : row.salesAccepted === true,
  rejectReason: clean(row.rejectReason) || null,
  dimensionValidation: row.dimensionValidation && typeof row.dimensionValidation === "object" ? row.dimensionValidation : {},
  accuracyScore: numberOrNull(row.accuracyScore),
  primaryRecommendedAction: clean(row.primaryRecommendedAction) || null,
  status: clean(row.status),
  createdAt: toIso(row.createdAt),
  updatedAt: toIso(row.updatedAt),
  completedAt: toIso(row.completedAt),
});
const normalizeUser = (row = {}) => {
  const id = clean(row.uid || row.id || row.firestoreDocId);
  return { id, name: clean(row.nome || row.name || row.displayName || row.email || id), email: clean(row.email) };
};

const scoreBandFor = (score) => SCORE_BANDS.find((band) => score >= band.min && score <= band.max) || SCORE_BANDS[0];
const sample = (n) => ({ n, small: n > 0 && n < 20 });

const buildCrmQualificationAnalytics = ({ rows = {}, query = {}, now = new Date() } = {}) => {
  const period = resolvePeriod(query.range, now);
  const filters = {
    pipelineSdr: clean(query.pipelineSdr || query.sdrPipelineId),
    pipelineCloser: clean(query.pipelineCloser || query.closerPipelineId),
    sdr: clean(query.sdr || query.sdrUserId),
    closer: clean(query.closer || query.closerUserId),
    source: clean(query.source),
    country: clean(query.country).toUpperCase(),
    version: clean(query.version || query.versionId),
  };

  const pipelines = (rows.pipelines || []).map(normalizePipeline).filter((row) => row.id);
  const contacts = (rows.contacts || []).map(normalizeContact).filter((row) => row.id);
  const opportunities = (rows.opportunities || []).map(normalizeOpportunity).filter((row) => row.id);
  const runs = (rows.runs || []).map(normalizeRun).filter((row) => row.id);
  const answers = (rows.answers || []).map(normalizeAnswer).filter((row) => row.runId);
  const handoffs = (rows.handoffs || []).map(normalizeHandoff).filter((row) => row.id);
  const reviews = (rows.reviews || []).map(normalizeReview).filter((row) => row.id);
  const users = (rows.users || []).map(normalizeUser).filter((row) => row.id);

  const contactsById = new Map(contacts.map((row) => [row.id, row]));
  const opportunitiesById = new Map(opportunities.map((row) => [row.id, row]));
  const runsById = new Map(runs.map((row) => [row.id, row]));
  const handoffsById = new Map(handoffs.map((row) => [row.id, row]));
  const handoffsByRunId = new Map(handoffs.map((row) => [row.qualificationRunId, row]));
  const handoffsByOpportunityId = new Map();
  handoffs.forEach((row) => {
    if (!handoffsByOpportunityId.has(row.opportunityId)) handoffsByOpportunityId.set(row.opportunityId, row);
  });
  const reviewsByHandoffId = new Map(reviews.map((row) => [row.handoffId, row]));
  const usersById = new Map(users.map((row) => [row.id, row]));

  const contextForRun = (run) => {
    const opportunity = opportunitiesById.get(run.opportunityId) || {};
    const contact = contactsById.get(run.contactId || opportunity.contactId) || {};
    const handoff = handoffsByRunId.get(run.id) || {};
    return { opportunity, contact, handoff, sdrUserId: run.completedBy || run.startedBy || handoff.sdrUserId || "", closerUserId: handoff.closerUserId || opportunity.ownerId || "" };
  };
  const contextForHandoff = (handoff) => {
    const run = runsById.get(handoff.qualificationRunId) || {};
    const opportunity = opportunitiesById.get(handoff.opportunityId) || {};
    const contact = contactsById.get(handoff.contactId || opportunity.contactId) || {};
    return { run, opportunity, contact, sdrUserId: handoff.sdrUserId || run.completedBy || run.startedBy || "", closerUserId: handoff.closerUserId || opportunity.ownerId || "" };
  };
  const contextForReview = (review) => {
    const handoff = handoffsById.get(review.handoffId) || {};
    const run = runsById.get(handoff.qualificationRunId) || {};
    const opportunity = opportunitiesById.get(review.opportunityId || handoff.opportunityId) || {};
    const contact = contactsById.get(review.contactId || handoff.contactId || opportunity.contactId) || {};
    return { handoff, run, opportunity, contact, sdrUserId: handoff.sdrUserId || run.completedBy || run.startedBy || "", closerUserId: review.closerUserId || handoff.closerUserId || opportunity.ownerId || "" };
  };
  const contextForOpportunity = (opportunity) => {
    const handoff = handoffsByOpportunityId.get(opportunity.id) || {};
    const run = runsById.get(handoff.qualificationRunId) || {};
    const review = reviewsByHandoffId.get(handoff.id) || {};
    const contact = contactsById.get(opportunity.contactId) || {};
    return { handoff, run, review, opportunity, contact, sdrUserId: handoff.sdrUserId || run.completedBy || run.startedBy || "", closerUserId: review.closerUserId || handoff.closerUserId || opportunity.ownerId || "" };
  };

  const matchesContext = ({ run = {}, handoff = {}, opportunity = {}, contact = {}, sdrUserId = "", closerUserId = "" }) => {
    if (filters.pipelineSdr && handoff.fromPipelineId !== filters.pipelineSdr && opportunity.pipelineId !== filters.pipelineSdr) return false;
    if (filters.pipelineCloser && handoff.toPipelineId !== filters.pipelineCloser && opportunity.pipelineId !== filters.pipelineCloser) return false;
    if (filters.sdr && sdrUserId !== filters.sdr) return false;
    if (filters.closer && closerUserId !== filters.closer) return false;
    if (filters.source && lower(opportunity.source) !== lower(filters.source)) return false;
    if (filters.country && clean(contact.countryCode).toUpperCase() !== filters.country) return false;
    if (filters.version && run.versionId !== filters.version && clean(run.versionNumber) !== filters.version && handoff.qualificationVersionId !== filters.version && clean(handoff.qualificationVersionNumber) !== filters.version) return false;
    return true;
  };

  const completedRuns = runs.filter((run) => ["passed", "failed"].includes(run.status) && inPeriod(run.completedAt, period) && matchesContext({ run, ...contextForRun(run) }));
  const passedRuns = completedRuns.filter((run) => run.passed || run.status === "passed");
  const failedRuns = completedRuns.filter((run) => !run.passed && run.status === "failed");
  const periodHandoffs = handoffs.filter((handoff) => inPeriod(handoff.handoffAt, period) && matchesContext({ handoff, ...contextForHandoff(handoff) }));
  const uniqueHandoffs = Array.from(new Map(periodHandoffs.map((row) => [row.opportunityId, row])).values());
  const periodReviewsByOutcome = reviews.filter((review) => inPeriod(review.completedAt || review.updatedAt || review.createdAt, period) && matchesContext({ ...contextForReview(review), handoff: contextForReview(review).handoff, run: contextForReview(review).run }));
  const heldReviews = periodReviewsByOutcome.filter((review) => review.meetingOutcome === "held");
  const finalMeetingReviews = periodReviewsByOutcome.filter((review) => ["held", "no_show", "cancelled"].includes(review.meetingOutcome));
  const completedReviews = reviews.filter((review) => review.status === "completed" && review.meetingOutcome === "held" && inPeriod(review.completedAt, period) && matchesContext(contextForReview(review)));
  const acceptedReviews = completedReviews.filter((review) => review.salesAccepted === true);
  const rejectedReviews = completedReviews.filter((review) => review.salesAccepted === false);
  const closedOpportunities = opportunities.filter((opportunity) => ["won", "lost"].includes(opportunity.status) && inPeriod(opportunity.closedAt, period) && matchesContext(contextForOpportunity(opportunity)));
  const wonOpportunities = closedOpportunities.filter((opportunity) => opportunity.status === "won");
  const closedRevenue = wonOpportunities.reduce((sum, opportunity) => sum + numberOrZero(opportunity.closedValue), 0);

  const totalWinRate = rate(wonOpportunities.length, closedOpportunities.length);
  const topKpis = [
    { id: "qualification_pass", label: "Qualification Pass", ...rate(passedRuns.length, completedRuns.length) },
    { id: "closer_acceptance", label: "Closer Acceptance", ...rate(acceptedReviews.length, completedReviews.length) },
    { id: "qualification_accuracy", label: "Qualification Accuracy", value: avg(completedReviews.map((review) => review.accuracyScore)), numerator: completedReviews.filter((review) => review.accuracyScore != null).length, denominator: completedReviews.length },
    { id: "win_rate", label: "Win Rate", ...totalWinRate },
    { id: "closed_revenue", label: "Closed Revenue", value: closedRevenue, numerator: wonOpportunities.length, denominator: closedOpportunities.length, kind: "money" },
  ];

  const funnelSteps = [
    { id: "completed", label: "Qualified", count: completedRuns.length, conversion: null },
    { id: "passed", label: "Passed", count: passedRuns.length },
    { id: "handoff", label: "Handoff", count: uniqueHandoffs.length },
    { id: "held", label: "Held", count: heldReviews.length },
    { id: "accepted", label: "Accepted", count: acceptedReviews.length },
    { id: "won", label: "Won", count: wonOpportunities.length },
  ].map((row, index, arr) => ({ ...row, conversion: index === 0 ? null : pct(row.count, arr[index - 1].count), ...sample(row.count) }));

  const outcomeCounts = {
    held: periodReviewsByOutcome.filter((review) => review.meetingOutcome === "held").length,
    no_show: periodReviewsByOutcome.filter((review) => review.meetingOutcome === "no_show").length,
    cancelled: periodReviewsByOutcome.filter((review) => review.meetingOutcome === "cancelled").length,
    rescheduled: periodReviewsByOutcome.filter((review) => review.meetingOutcome === "rescheduled").length,
  };

  const bandRows = SCORE_BANDS.map((band) => {
    const bandHandoffs = handoffs.filter((handoff) => handoff.totalScore >= band.min && handoff.totalScore <= band.max && inPeriod(handoff.handoffAt, period) && matchesContext({ handoff, ...contextForHandoff(handoff) }));
    const bandRuns = completedRuns.filter((run) => run.totalScore >= band.min && run.totalScore <= band.max);
    const bandReviews = bandHandoffs.map((handoff) => reviewsByHandoffId.get(handoff.id)).filter((review) => review?.status === "completed" && review.meetingOutcome === "held");
    const bandAccepted = bandReviews.filter((review) => review.salesAccepted === true);
    const bandOppIds = new Set(bandHandoffs.map((handoff) => handoff.opportunityId));
    const bandClosed = closedOpportunities.filter((opportunity) => bandOppIds.has(opportunity.id));
    const bandWon = bandClosed.filter((opportunity) => opportunity.status === "won");
    return {
      ...band,
      qualificationRuns: bandRuns.length,
      handoffs: bandHandoffs.length,
      closerAccepted: bandAccepted.length,
      acceptanceRate: rate(bandAccepted.length, bandReviews.length),
      won: bandWon.length,
      winRate: rate(bandWon.length, bandClosed.length),
      closedRevenue: bandWon.reduce((sum, opportunity) => sum + numberOrZero(opportunity.closedValue), 0),
      ...sample(bandHandoffs.length),
    };
  });

  const dimensionAccuracy = DIMENSIONS.map((dimension) => {
    const values = completedReviews.map((review) => clean(review.dimensionValidation?.[dimension]) || "not_discussed");
    const confirmed = values.filter((value) => value === "confirmed").length;
    const partial = values.filter((value) => value === "partial").length;
    const contradicted = values.filter((value) => value === "contradicted").length;
    const notDiscussed = values.filter((value) => value === "not_discussed" || !value).length;
    const effectiveDen = confirmed + partial + contradicted;
    return {
      dimension,
      n: values.length,
      confirmed,
      partial,
      contradicted,
      notDiscussed,
      confirmedRate: pct(confirmed, values.length),
      partialRate: pct(partial, values.length),
      contradictedRate: pct(contradicted, values.length),
      notDiscussedRate: pct(notDiscussed, values.length),
      effectiveAccuracy: effectiveDen > 0 ? (confirmed + partial * 0.5) / effectiveDen : null,
      ...sample(values.length),
    };
  });

  const groupBy = (items, keyFn, emptyLabel = "—") => {
    const map = new Map();
    items.forEach((item) => {
      const key = clean(keyFn(item)) || "__empty";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(item);
    });
    return Array.from(map.entries()).map(([key, group]) => ({ key, label: key === "__empty" ? emptyLabel : key, group }));
  };

  const sdrPerformance = groupBy(completedRuns, (run) => contextForRun(run).sdrUserId, "Sem SDR").map(({ key, label, group }) => {
    const sdrHandoffs = uniqueHandoffs.filter((h) => (contextForHandoff(h).sdrUserId || "__empty") === key);
    const sdrReviews = completedReviews.filter((review) => (contextForReview(review).sdrUserId || "__empty") === key);
    const sdrOppIds = new Set(sdrHandoffs.map((row) => row.opportunityId));
    const sdrClosed = closedOpportunities.filter((opportunity) => sdrOppIds.has(opportunity.id));
    const sdrWon = sdrClosed.filter((opportunity) => opportunity.status === "won");
    return {
      id: key,
      name: usersById.get(key)?.name || label,
      qualifications: group.length,
      passRate: rate(group.filter((run) => run.passed).length, group.length),
      handoffs: sdrHandoffs.length,
      held: sdrReviews.filter((review) => review.meetingOutcome === "held").length,
      acceptanceRate: rate(sdrReviews.filter((review) => review.salesAccepted === true).length, sdrReviews.length),
      qualificationAccuracy: avg(sdrReviews.map((review) => review.accuracyScore)),
      won: sdrWon.length,
      closedRevenue: sdrWon.reduce((sum, opportunity) => sum + numberOrZero(opportunity.closedValue), 0),
      ...sample(group.length),
    };
  }).sort((a, b) => b.qualifications - a.qualifications);

  const closerPerformance = groupBy(uniqueHandoffs, (handoff) => contextForHandoff(handoff).closerUserId, "Sem closer").map(({ key, label, group }) => {
    const closerReviews = periodReviewsByOutcome.filter((review) => (contextForReview(review).closerUserId || "__empty") === key);
    const closerCompleted = closerReviews.filter((review) => review.status === "completed" && review.meetingOutcome === "held");
    const oppIds = new Set(group.map((row) => row.opportunityId));
    const closerClosed = closedOpportunities.filter((opportunity) => oppIds.has(opportunity.id));
    const closerWon = closerClosed.filter((opportunity) => opportunity.status === "won");
    const cycles = closerClosed.map((opportunity) => {
      const created = Date.parse(opportunity.createdAt || "");
      const closed = Date.parse(opportunity.closedAt || "");
      return Number.isFinite(created) && Number.isFinite(closed) ? Math.round((closed - created) / 86400000) : null;
    }).filter((value) => value != null);
    return {
      id: key,
      name: usersById.get(key)?.name || label,
      handoffs: group.length,
      held: closerReviews.filter((review) => review.meetingOutcome === "held").length,
      feedbackCompletion: rate(closerCompleted.length, closerReviews.filter((review) => review.meetingOutcome === "held").length),
      acceptanceRate: rate(closerCompleted.filter((review) => review.salesAccepted === true).length, closerCompleted.length),
      winRate: rate(closerWon.length, closerClosed.length),
      closedRevenue: closerWon.reduce((sum, opportunity) => sum + numberOrZero(opportunity.closedValue), 0),
      salesCycleAvgDays: avg(cycles),
      salesCycleMedianDays: median(cycles),
      ...sample(group.length),
    };
  }).sort((a, b) => b.handoffs - a.handoffs);

  const distribution = (items, keyFn, labels = {}) => groupBy(items, keyFn, "Não informado")
    .map(({ key, label, group }) => ({ key, label: labels[key] || label, count: group.length, share: pct(group.length, items.length), ...sample(group.length) }))
    .sort((a, b) => b.count - a.count);

  const rejectReasons = distribution(rejectedReviews, (review) => review.rejectReason, REJECT_REASON_LABELS);
  const recommendedActions = distribution(completedReviews, (review) => review.primaryRecommendedAction, RECOMMENDED_ACTION_LABELS);

  const sourceQuality = groupBy(completedRuns, (run) => contextForRun(run).opportunity.source, "Sem origem").map(({ key, label, group }) => {
    const sourceHandoffs = uniqueHandoffs.filter((h) => lower(contextForHandoff(h).opportunity.source || "__empty") === lower(key));
    const sourceReviews = completedReviews.filter((review) => lower(contextForReview(review).opportunity.source || "__empty") === lower(key));
    const sourceClosed = closedOpportunities.filter((opportunity) => lower(opportunity.source || "__empty") === lower(key));
    const sourceWon = sourceClosed.filter((opportunity) => opportunity.status === "won");
    return {
      key,
      label,
      leadsQualified: group.length,
      passRate: rate(group.filter((run) => run.passed).length, group.length),
      handoffs: sourceHandoffs.length,
      acceptanceRate: rate(sourceReviews.filter((review) => review.salesAccepted === true).length, sourceReviews.length),
      winRate: rate(sourceWon.length, sourceClosed.length),
      closedRevenue: sourceWon.reduce((sum, opportunity) => sum + numberOrZero(opportunity.closedValue), 0),
      revenuePerHandoff: sourceHandoffs.length ? sourceWon.reduce((sum, opportunity) => sum + numberOrZero(opportunity.closedValue), 0) / sourceHandoffs.length : null,
      ...sample(group.length),
    };
  }).sort((a, b) => b.leadsQualified - a.leadsQualified);

  const countryQuality = groupBy(completedRuns, (run) => contextForRun(run).contact.countryCode, "Sem país").map(({ key, label, group }) => {
    const countryReviews = completedReviews.filter((review) => (contextForReview(review).contact.countryCode || "__empty") === key);
    const countryClosed = closedOpportunities.filter((opportunity) => (contactsById.get(opportunity.contactId)?.countryCode || "__empty") === key);
    const countryWon = countryClosed.filter((opportunity) => opportunity.status === "won");
    return {
      key,
      label,
      qualifications: group.length,
      passRate: rate(group.filter((run) => run.passed).length, group.length),
      acceptanceRate: rate(countryReviews.filter((review) => review.salesAccepted === true).length, countryReviews.length),
      winRate: rate(countryWon.length, countryClosed.length),
      closedRevenue: countryWon.reduce((sum, opportunity) => sum + numberOrZero(opportunity.closedValue), 0),
      ...sample(group.length),
    };
  }).sort((a, b) => b.qualifications - a.qualifications);

  const completedRunIds = new Set(completedRuns.map((run) => run.id));
  const overallAcceptanceRate = pct(acceptedReviews.length, completedReviews.length);
  const overallWinRate = pct(wonOpportunities.length, closedOpportunities.length);
  const questionAnswers = groupBy(answers.filter((answer) => completedRunIds.has(answer.runId)), (answer) => `${answer.questionId}|${answer.optionId}`, "Resposta")
    .map(({ key, group }) => {
      const first = group[0] || {};
      const answerRuns = group.map((answer) => runsById.get(answer.runId)).filter(Boolean);
      const answerRunIds = new Set(answerRuns.map((run) => run.id));
      const answerHandoffs = handoffs.filter((handoff) => answerRunIds.has(handoff.qualificationRunId));
      const answerReviews = answerHandoffs.map((handoff) => reviewsByHandoffId.get(handoff.id)).filter((review) => review?.status === "completed" && review.meetingOutcome === "held");
      const answerAccepted = answerReviews.filter((review) => review.salesAccepted === true);
      const oppIds = new Set(answerHandoffs.map((handoff) => handoff.opportunityId));
      const answerClosed = closedOpportunities.filter((opportunity) => oppIds.has(opportunity.id));
      const answerWon = answerClosed.filter((opportunity) => opportunity.status === "won");
      const acceptanceRate = pct(answerAccepted.length, answerReviews.length);
      const winRate = pct(answerWon.length, answerClosed.length);
      return {
        key,
        questionId: first.questionId,
        optionId: first.optionId,
        question: first.questionTitle,
        answer: first.optionLabel,
        n: group.length,
        avgTotalScore: avg(answerRuns.map((run) => run.totalScore)),
        closerAcceptance: rate(answerAccepted.length, answerReviews.length),
        winRate: rate(answerWon.length, answerClosed.length),
        acceptanceLift: acceptanceRate != null && overallAcceptanceRate ? acceptanceRate / overallAcceptanceRate : null,
        winLift: winRate != null && overallWinRate ? winRate / overallWinRate : null,
        ...sample(group.length),
      };
    })
    .sort((a, b) => b.n - a.n);

  const versions = groupBy(completedRuns, (run) => run.versionId || run.versionNumber, "Sem versão").map(({ key, label, group }) => {
    const versionHandoffs = uniqueHandoffs.filter((handoff) => handoff.qualificationVersionId === key || clean(handoff.qualificationVersionNumber) === key);
    const versionReviews = completedReviews.filter((review) => {
      const ctx = contextForReview(review);
      return ctx.run.versionId === key || clean(ctx.run.versionNumber) === key || ctx.handoff.qualificationVersionId === key || clean(ctx.handoff.qualificationVersionNumber) === key;
    });
    const oppIds = new Set(versionHandoffs.map((handoff) => handoff.opportunityId));
    const versionClosed = closedOpportunities.filter((opportunity) => oppIds.has(opportunity.id));
    const versionWon = versionClosed.filter((opportunity) => opportunity.status === "won");
    return {
      key,
      label,
      completed: group.length,
      passRate: rate(group.filter((run) => run.passed).length, group.length),
      acceptanceRate: rate(versionReviews.filter((review) => review.salesAccepted === true).length, versionReviews.length),
      accuracy: avg(versionReviews.map((review) => review.accuracyScore)),
      winRate: rate(versionWon.length, versionClosed.length),
      revenuePerHandoff: versionHandoffs.length ? versionWon.reduce((sum, opportunity) => sum + numberOrZero(opportunity.closedValue), 0) / versionHandoffs.length : null,
      ...sample(group.length),
    };
  }).sort((a, b) => b.completed - a.completed);

  const thresholdAnalysis = THRESHOLDS.map((threshold) => {
    const eligible = uniqueHandoffs.filter((handoff) => handoff.totalScore >= threshold);
    const thresholdReviews = eligible.map((handoff) => reviewsByHandoffId.get(handoff.id)).filter((review) => review?.status === "completed" && review.meetingOutcome === "held");
    const thresholdAccepted = thresholdReviews.filter((review) => review.salesAccepted === true);
    const oppIds = new Set(eligible.map((handoff) => handoff.opportunityId));
    const thresholdWon = wonOpportunities.filter((opportunity) => oppIds.has(opportunity.id));
    return {
      threshold,
      eligibleHandoffs: eligible.length,
      shareOfTotal: pct(eligible.length, uniqueHandoffs.length),
      observedAcceptance: rate(thresholdAccepted.length, thresholdReviews.length),
      observedWins: thresholdWon.length,
      observedClosedRevenue: thresholdWon.reduce((sum, opportunity) => sum + numberOrZero(opportunity.closedValue), 0),
      ...sample(eligible.length),
    };
  });

  const missingOwner = opportunities.filter((opportunity) => !opportunity.ownerId).length;
  const missingSource = opportunities.filter((opportunity) => !opportunity.source).length;
  const missingCountry = opportunities.filter((opportunity) => !contactsById.get(opportunity.contactId)?.countryCode).length;
  const dataQuality = {
    completedRuns: completedRuns.length,
    handoffs: uniqueHandoffs.length,
    heldMeetings: heldReviews.length,
    reviewsCompleted: completedReviews.length,
    closedOpportunities: closedOpportunities.length,
    reviewCompletionRate: rate(completedReviews.length, heldReviews.length),
    missingOwner,
    missingSource,
    missingCountry,
  };

  const filterOptions = {
    pipelinesSdr: pipelines.filter((pipeline) => pipeline.pipelineType === "sdr" || pipeline.pipelineType === "general"),
    pipelinesCloser: pipelines.filter((pipeline) => pipeline.pipelineType === "closer"),
    sdrs: sdrPerformance.map((row) => ({ id: row.id === "__empty" ? "" : row.id, name: row.name })),
    closers: closerPerformance.map((row) => ({ id: row.id === "__empty" ? "" : row.id, name: row.name })),
    sources: sourceQuality.map((row) => row.label).filter((value) => value !== "Sem origem"),
    countries: countryQuality.map((row) => row.label).filter((value) => value !== "Sem país"),
    versions: versions.map((row) => ({ id: row.key === "__empty" ? "" : row.key, label: row.label })),
  };

  return {
    generatedAt: new Date().toISOString(),
    period: { key: period.key, label: period.label, start: period.start.toISOString(), end: period.end.toISOString(), timeZone: CRM_TIME_ZONE },
    filters,
    filterOptions,
    summary: {
      topKpis,
      qualificationCompleted: completedRuns.length,
      qualificationPassRate: topKpis[0],
      handoffRate: rate(uniqueHandoffs.length, passedRuns.length),
      meetingOutcomes: outcomeCounts,
      meetingHeldRate: rate(outcomeCounts.held, outcomeCounts.held + outcomeCounts.no_show + outcomeCounts.cancelled),
      reviewCompletionRate: dataQuality.reviewCompletionRate,
      closerAcceptanceRate: topKpis[1],
      falsePositiveRate: rate(rejectedReviews.length, completedReviews.length),
      qualificationAccuracy: topKpis[2],
      winRate: topKpis[3],
      closedRevenue,
      revenuePerHandoff: uniqueHandoffs.length ? closedRevenue / uniqueHandoffs.length : null,
      revenuePerHeldMeeting: heldReviews.length ? closedRevenue / heldReviews.length : null,
      failedQualificationCount: failedRuns.length,
    },
    funnel: funnelSteps,
    scoreBands: bandRows,
    thresholdAnalysis,
    dimensionAccuracy,
    sdrPerformance,
    closerPerformance,
    rejectReasons,
    recommendedActions,
    sources: sourceQuality,
    countries: countryQuality,
    questionAnswers,
    versions,
    dataQuality,
  };
};

module.exports = {
  DIMENSIONS,
  SCORE_BANDS,
  THRESHOLDS,
  buildCrmQualificationAnalytics,
  inPeriod,
  pct,
  resolvePeriod,
};
