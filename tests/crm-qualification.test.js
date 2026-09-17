const test = require("node:test");
const assert = require("node:assert/strict");

const qualification = require("../api/_lib/crm-qualification");

const seed = qualification.buildSdrSeedRows({
  scopeId: "space-main",
  stamp: "2026-09-17T12:00:00.000Z",
  actorId: "admin-1",
});

const answersForOptionIndexes = (indexesByQuestion) =>
  seed.questions.map((question, questionIndex) => {
    const optionIndex = indexesByQuestion[questionIndex] ?? 0;
    const option = seed.options.find((row) => row.questionId === question.id && row.position === optionIndex + 1);
    return { questionId: question.id, optionId: option.id };
  });

test("buildSdrSeedRows creates deterministic published SDR V1 config", () => {
  assert.equal(seed.template.id, "qual_tpl_sdr");
  assert.equal(seed.template.type, qualification.QUALIFICATION_TYPE_SDR);
  assert.equal(seed.version.status, "published");
  assert.equal(seed.version.totalThreshold, 65);
  assert.equal(seed.version.minimumFitScore, 30);
  assert.equal(seed.version.minimumIntentScore, 30);
  assert.equal(seed.questions.length, 7);
  assert.equal(seed.options.length, 29);
  assert.equal(seed.questions[0].isHardGate, true);
  assert.equal(seed.options.find((row) => row.questionId === seed.questions[0].id && row.hardFail)?.points, 0);
});

test("selectPublishedSdrConfig is idempotent when a published SDR template exists", () => {
  const selected = qualification.selectPublishedSdrConfig({
    templates: [seed.template],
    versions: [seed.version],
    questions: seed.questions,
    options: seed.options,
  });
  assert.equal(selected.template.id, seed.template.id);
  assert.equal(selected.version.id, seed.version.id);
  assert.equal(selected.questions.length, seed.questions.length);
});

test("scoreQualification approves a complete passing run", () => {
  const result = qualification.scoreQualification({
    version: seed.version,
    questions: seed.questions,
    options: seed.options,
    answers: answersForOptionIndexes({}),
  });
  assert.equal(result.questionnaireComplete, true);
  assert.equal(result.hardGatesPassed, true);
  assert.equal(result.fitScore, 50);
  assert.equal(result.intentScore, 50);
  assert.equal(result.totalScore, 100);
  assert.equal(result.passed, true);
  assert.equal(result.status, "passed");
});

test("scoreQualification fails hard gate even when later answers are strong", () => {
  const result = qualification.scoreQualification({
    version: seed.version,
    questions: seed.questions,
    options: seed.options,
    answers: answersForOptionIndexes({ 0: 3 }),
  });
  assert.equal(result.questionnaireComplete, true);
  assert.equal(result.hardGatesPassed, false);
  assert.equal(result.passed, false);
  assert.equal(result.status, "failed");
});

test("scoreQualification fails when thresholds are not met", () => {
  const result = qualification.scoreQualification({
    version: seed.version,
    questions: seed.questions,
    options: seed.options,
    answers: answersForOptionIndexes({ 0: 2, 1: 2, 2: 2, 3: 4, 4: 2, 5: 2, 6: 2 }),
  });
  assert.equal(result.questionnaireComplete, true);
  assert.equal(result.hardGatesPassed, true);
  assert.equal(result.totalScore < seed.version.totalThreshold, true);
  assert.equal(result.passed, false);
});

test("published qualification versions are immutable", () => {
  assert.throws(
    () => qualification.assertCanMutatePublishedConfig(seed.version),
    /published_qualification_version_is_immutable/,
  );
  assert.equal(qualification.assertCanMutatePublishedConfig({ status: "draft" }), true);
});

test("qualificationMoveGate blocks forward movement before a passed run and allows after pass", () => {
  const stages = [
    { id: "stage_1", pipelineId: "commercial", position: 1, requiresQualification: true, qualificationGate: "sdr_qualification" },
    { id: "stage_2", pipelineId: "commercial", position: 2 },
  ];
  const opportunity = { id: "opp_1", stageId: "stage_1" };
  assert.deepEqual(
    qualification.qualificationMoveGate({ opportunity, toStageId: "stage_2", stages, runs: [] }),
    { ok: false, error: "qualification_required", run: null },
  );
  const failed = { id: "run_1", status: "failed", passed: false, totalScore: 45, completedAt: "2026-09-17T12:00:00.000Z" };
  assert.equal(
    qualification.qualificationMoveGate({ opportunity, toStageId: "stage_2", stages, runs: [failed] }).error,
    "qualification_failed",
  );
  const passed = { id: "run_2", status: "passed", passed: true, totalScore: 77, completedAt: "2026-09-17T13:00:00.000Z" };
  assert.equal(
    qualification.qualificationMoveGate({ opportunity, toStageId: "stage_2", stages, runs: [failed, passed] }).ok,
    true,
  );
});
