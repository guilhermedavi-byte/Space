const test = require("node:test");
const assert = require("node:assert/strict");

const analytics = require("../api/_lib/crm-qualification-analytics");

const baseRows = () => ({
  pipelines: [
    { id: "sdr", name: "SDR", pipelineType: "sdr" },
    { id: "closer", name: "Closer", pipelineType: "closer" },
  ],
  contacts: [
    { id: "c1", name: "Lead 1", countryCode: "BR" },
    { id: "c2", name: "Lead 2", countryCode: "MX" },
    { id: "c3", name: "Lead 3", countryCode: "" },
  ],
  opportunities: [
    { id: "o1", contactId: "c1", pipelineId: "closer", ownerId: "closer1", source: "Meta", status: "won", closedAt: "2026-09-10T15:00:00.000Z", closedValue: 1000, createdAt: "2026-09-01T12:00:00.000Z" },
    { id: "o2", contactId: "c2", pipelineId: "closer", ownerId: "closer1", source: "Google", status: "lost", closedAt: "2026-09-11T15:00:00.000Z", closedValue: 5000, createdAt: "2026-09-02T12:00:00.000Z" },
    { id: "o3", contactId: "c3", pipelineId: "closer", ownerId: "", source: "", status: "open", createdAt: "2026-09-03T12:00:00.000Z" },
  ],
  runs: [
    { id: "r1", opportunityId: "o1", contactId: "c1", versionId: "v1", versionNumber: 1, status: "passed", passed: true, totalScore: 86, completedBy: "sdr1", completedAt: "2026-09-05T12:00:00.000Z" },
    { id: "r2", opportunityId: "o2", contactId: "c2", versionId: "v1", versionNumber: 1, status: "passed", passed: true, totalScore: 62, completedBy: "sdr1", completedAt: "2026-09-06T12:00:00.000Z" },
    { id: "r3", opportunityId: "o3", contactId: "c3", versionId: "v2", versionNumber: 2, status: "failed", passed: false, totalScore: 45, completedBy: "sdr2", completedAt: "2026-09-07T12:00:00.000Z" },
    { id: "old", opportunityId: "o3", contactId: "c3", versionId: "v1", status: "passed", passed: true, totalScore: 90, completedBy: "sdr2", completedAt: "2026-07-01T12:00:00.000Z" },
  ],
  answers: [
    { id: "a1", runId: "r1", questionId: "q1", optionId: "opt_good", questionTitle: "Objetivo", optionLabel: "Claro", dimension: "need_fit", points: 15 },
    { id: "a2", runId: "r2", questionId: "q1", optionId: "opt_mid", questionTitle: "Objetivo", optionLabel: "Genérico", dimension: "need_fit", points: 10 },
    { id: "a3", runId: "r3", questionId: "q1", optionId: "opt_bad", questionTitle: "Objetivo", optionLabel: "Fora", dimension: "need_fit", points: 0 },
  ],
  handoffs: [
    { id: "h1", opportunityId: "o1", contactId: "c1", qualificationRunId: "r1", qualificationVersionId: "v1", qualificationVersionNumber: 1, sdrUserId: "sdr1", closerUserId: "closer1", fromPipelineId: "sdr", toPipelineId: "closer", totalScore: 86, handoffAt: "2026-09-06T12:00:00.000Z" },
    { id: "h2", opportunityId: "o2", contactId: "c2", qualificationRunId: "r2", qualificationVersionId: "v1", qualificationVersionNumber: 1, sdrUserId: "sdr1", closerUserId: "closer1", fromPipelineId: "sdr", toPipelineId: "closer", totalScore: 62, handoffAt: "2026-09-07T12:00:00.000Z" },
  ],
  reviews: [
    { id: "cr1", handoffId: "h1", opportunityId: "o1", contactId: "c1", closerUserId: "closer1", meetingOutcome: "held", salesAccepted: true, status: "completed", accuracyScore: 100, primaryRecommendedAction: "continue_sales", dimensionValidation: { need_fit: "confirmed", pain: "partial", urgency: "not_discussed" }, completedAt: "2026-09-08T12:00:00.000Z" },
    { id: "cr2", handoffId: "h2", opportunityId: "o2", contactId: "c2", closerUserId: "closer1", meetingOutcome: "held", salesAccepted: false, rejectReason: "low_urgency", status: "completed", accuracyScore: 50, primaryRecommendedAction: "nurture_recommended", dimensionValidation: { need_fit: "contradicted", pain: "not_discussed", urgency: "partial" }, completedAt: "2026-09-09T12:00:00.000Z" },
    { id: "cr3", handoffId: "h2", opportunityId: "o2", contactId: "c2", closerUserId: "closer1", meetingOutcome: "no_show", status: "pending", updatedAt: "2026-09-09T10:00:00.000Z" },
  ],
  users: [
    { uid: "sdr1", nome: "SDR One" },
    { uid: "sdr2", nome: "SDR Two" },
    { uid: "closer1", nome: "Closer One" },
  ],
});

const build = (query = {}) => analytics.buildCrmQualificationAnalytics({
  rows: baseRows(),
  query: { range: "30d", ...query },
  now: new Date("2026-09-17T15:00:00.000Z"),
});

test("analytics computes pass, acceptance, false positive and no-show exclusion", () => {
  const result = build();
  assert.equal(result.summary.qualificationPassRate.numerator, 2);
  assert.equal(result.summary.qualificationPassRate.denominator, 3);
  assert.equal(result.summary.closerAcceptanceRate.numerator, 1);
  assert.equal(result.summary.closerAcceptanceRate.denominator, 2);
  assert.equal(result.summary.falsePositiveRate.numerator, 1);
  assert.equal(result.summary.falsePositiveRate.denominator, 2);
  assert.equal(result.summary.meetingHeldRate.numerator, 2);
  assert.equal(result.summary.meetingHeldRate.denominator, 3);
});

test("analytics uses Won+Lost denominator and closedValue revenue", () => {
  const result = build();
  assert.equal(result.summary.winRate.numerator, 1);
  assert.equal(result.summary.winRate.denominator, 2);
  assert.equal(result.summary.closedRevenue, 1000);
});

test("analytics aggregates accuracy and dimension accuracy", () => {
  const result = build();
  assert.equal(result.summary.qualificationAccuracy.value, 75);
  const needFit = result.dimensionAccuracy.find((row) => row.dimension === "need_fit");
  assert.equal(needFit.confirmed, 1);
  assert.equal(needFit.contradicted, 1);
  assert.equal(needFit.effectiveAccuracy, 0.5);
});

test("analytics builds score bands and question option analysis", () => {
  const result = build();
  const highBand = result.scoreBands.find((row) => row.id === "85_100");
  assert.equal(highBand.handoffs, 1);
  assert.equal(highBand.acceptanceRate.value, 1);
  const option = result.questionAnswers.find((row) => row.optionId === "opt_good");
  assert.equal(option.n, 1);
  assert.equal(option.closerAcceptance.value, 1);
  assert.equal(option.winRate.value, 1);
});

test("analytics filters by date range and qualification version", () => {
  const previous = analytics.buildCrmQualificationAnalytics({
    rows: baseRows(),
    query: { range: "previous_month" },
    now: new Date("2026-09-17T15:00:00.000Z"),
  });
  assert.equal(previous.summary.qualificationCompleted, 0);
  const versionTwo = build({ version: "v2" });
  assert.equal(versionTwo.summary.qualificationCompleted, 1);
  assert.equal(versionTwo.summary.qualificationPassRate.numerator, 0);
});

test("analytics returns null for zero denominators", () => {
  const empty = analytics.buildCrmQualificationAnalytics({
    rows: {},
    query: { range: "30d" },
    now: new Date("2026-09-17T15:00:00.000Z"),
  });
  assert.equal(empty.summary.qualificationPassRate.value, null);
  assert.equal(empty.summary.winRate.value, null);
  assert.equal(empty.scoreBands[0].acceptanceRate.value, null);
});
