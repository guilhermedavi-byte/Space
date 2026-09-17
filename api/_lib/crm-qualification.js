const QUALIFICATION_TYPE_SDR = "sdr_qualification";

const DEFAULT_THRESHOLDS = {
  totalThreshold: 65,
  minimumFitScore: 30,
  minimumIntentScore: 30,
};

const FIT_DIMENSIONS = new Set(["need_fit", "economic_readiness", "decision_readiness"]);
const INTENT_DIMENSIONS = new Set(["pain", "impact", "urgency", "commitment"]);
const PUBLISHED_STATUSES = new Set(["published"]);

const COLLECTION_KEYS = {
  templates: "qualificationTemplates",
  versions: "qualificationVersions",
  questions: "qualificationQuestions",
  options: "qualificationOptions",
  runs: "qualificationRuns",
  answers: "qualificationAnswers",
};

const clean = (value) => String(value || "").trim();
const toIso = (value) => {
  if (value instanceof Date) return value.toISOString();
  const raw = clean(value);
  return raw || null;
};
const numberOrZero = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};
const bool = (value) => value === true;

const normalizeTemplate = (row = {}, scopeId = "") => ({
  id: clean(row.id || row.firestoreDocId),
  scopeId: clean(row.scopeId) || clean(scopeId),
  name: clean(row.name),
  type: clean(row.type),
  isActive: row.isActive !== false,
  createdAt: toIso(row.createdAt),
  updatedAt: toIso(row.updatedAt),
});

const normalizeVersion = (row = {}, scopeId = "") => ({
  id: clean(row.id || row.firestoreDocId),
  scopeId: clean(row.scopeId) || clean(scopeId),
  templateId: clean(row.templateId),
  versionNumber: Number(row.versionNumber) || 1,
  status: clean(row.status) || "draft",
  totalThreshold: Number(row.totalThreshold) || DEFAULT_THRESHOLDS.totalThreshold,
  minimumFitScore: Number(row.minimumFitScore) || DEFAULT_THRESHOLDS.minimumFitScore,
  minimumIntentScore: Number(row.minimumIntentScore) || DEFAULT_THRESHOLDS.minimumIntentScore,
  createdAt: toIso(row.createdAt),
  publishedAt: toIso(row.publishedAt),
  createdBy: clean(row.createdBy) || null,
});

const normalizeQuestion = (row = {}, scopeId = "") => ({
  id: clean(row.id || row.firestoreDocId),
  scopeId: clean(row.scopeId) || clean(scopeId),
  versionId: clean(row.versionId),
  title: clean(row.title),
  dimension: clean(row.dimension),
  position: Number(row.position) || 0,
  required: row.required !== false,
  isHardGate: bool(row.isHardGate),
  createdAt: toIso(row.createdAt),
});

const normalizeOption = (row = {}, scopeId = "") => ({
  id: clean(row.id || row.firestoreDocId),
  scopeId: clean(row.scopeId) || clean(scopeId),
  questionId: clean(row.questionId),
  label: clean(row.label),
  points: numberOrZero(row.points),
  position: Number(row.position) || 0,
  hardFail: bool(row.hardFail),
});

const normalizeRun = (row = {}, scopeId = "") => ({
  id: clean(row.id || row.firestoreDocId),
  scopeId: clean(row.scopeId) || clean(scopeId),
  opportunityId: clean(row.opportunityId),
  contactId: clean(row.contactId) || null,
  templateId: clean(row.templateId),
  versionId: clean(row.versionId),
  status: clean(row.status) || "in_progress",
  fitScore: numberOrZero(row.fitScore),
  intentScore: numberOrZero(row.intentScore),
  totalScore: numberOrZero(row.totalScore),
  hardGatesPassed: row.hardGatesPassed !== false,
  passed: bool(row.passed),
  startedBy: clean(row.startedBy) || null,
  completedBy: clean(row.completedBy) || null,
  startedAt: toIso(row.startedAt),
  completedAt: toIso(row.completedAt),
  thresholdSnapshot: row.thresholdSnapshot && typeof row.thresholdSnapshot === "object" ? row.thresholdSnapshot : {},
  versionNumber: Number(row.versionNumber) || null,
  createdAt: toIso(row.createdAt),
  updatedAt: toIso(row.updatedAt),
});

const normalizeAnswer = (row = {}, scopeId = "") => ({
  id: clean(row.id || row.firestoreDocId),
  scopeId: clean(row.scopeId) || clean(scopeId),
  runId: clean(row.runId),
  opportunityId: clean(row.opportunityId),
  questionId: clean(row.questionId),
  optionId: clean(row.optionId),
  questionTitle: clean(row.questionTitle),
  optionLabel: clean(row.optionLabel),
  dimension: clean(row.dimension),
  points: numberOrZero(row.points),
  hardFail: bool(row.hardFail),
  position: Number(row.position) || 0,
  createdAt: toIso(row.createdAt),
});

const buildSdrSeedRows = ({ scopeId, stamp, actorId } = {}) => {
  const safeScope = clean(scopeId);
  const now = clean(stamp) || new Date().toISOString();
  const template = {
    id: "qual_tpl_sdr",
    scopeId: safeScope,
    name: "SDR Qualification",
    type: QUALIFICATION_TYPE_SDR,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };
  const version = {
    id: "qual_tpl_sdr_v1",
    scopeId: safeScope,
    templateId: template.id,
    versionNumber: 1,
    status: "published",
    ...DEFAULT_THRESHOLDS,
    createdAt: now,
    publishedAt: now,
    createdBy: clean(actorId) || null,
  };
  const definitions = [
    {
      title: "Qual é o principal objetivo do lead com o inglês?",
      dimension: "need_fit",
      isHardGate: true,
      options: [
        ["Objetivo claro e plenamente atendido pela Space", 15],
        ["Objetivo atendido, mas ainda genérico", 10],
        ["Objetivo pouco definido", 5],
        ["Necessidade fora do escopo da Space", 0, true],
      ],
    },
    {
      title: "Quanto a falta de inglês prejudica a vida do lead hoje?",
      dimension: "pain",
      options: [
        ["Impede oportunidades importantes ou gera problemas concretos", 15],
        ["Prejudica bastante trabalho ou rotina", 11],
        ["Incomoda, mas sem consequência relevante", 6],
        ["Quase não gera impacto atual", 0],
      ],
    },
    {
      title: "Qual resultado o lead espera conquistar com inglês?",
      dimension: "impact",
      options: [
        ["Resultado específico de alto impacto", 10],
        ["Resultado claro", 7],
        ["Benefício genérico", 3],
        ["Não consegue identificar impacto", 0],
      ],
    },
    {
      title: "Qual é a urgência para começar?",
      dimension: "urgency",
      options: [
        ["Agora ou nos próximos dias", 15],
        ["Dentro de 30 dias", 12],
        ["Entre 1 e 3 meses", 7],
        ["Mais de 3 meses", 3],
        ["Sem prazo", 0],
      ],
    },
    {
      title: "Qual é a prontidão econômica do lead?",
      dimension: "economic_readiness",
      options: [
        ["Possui condição compatível com o produto", 20],
        ["Possui condição para um plano inferior", 13],
        ["Precisaria se organizar financeiramente antes", 6],
        ["Atualmente não possui condição mínima", 0],
      ],
    },
    {
      title: "Como está a prontidão de decisão?",
      dimension: "decision_readiness",
      options: [
        ["Decide sozinho e está pronto para decidir", 15],
        ["Decide com parceiro(a), mas consegue envolver essa pessoa", 11],
        ["Precisa consultar outra pessoa depois", 6],
        ["Não possui autonomia nem clareza de decisão", 0],
      ],
    },
    {
      title: "Como está o compromisso para encaixar o estudo na rotina?",
      dimension: "commitment",
      options: [
        ["Está preparado para encaixar o estudo na rotina", 10],
        ["Está disposto, mas ainda precisa se organizar", 7],
        ["Tem interesse, mas pouca disponibilidade real", 3],
        ["Não pretende alterar a rotina", 0],
      ],
    },
  ];
  const questions = definitions.map((definition, index) => ({
    id: `qual_q_sdr_v1_${index + 1}`,
    scopeId: safeScope,
    versionId: version.id,
    title: definition.title,
    dimension: definition.dimension,
    position: index + 1,
    required: true,
    isHardGate: bool(definition.isHardGate),
    createdAt: now,
  }));
  const options = definitions.flatMap((definition, questionIndex) =>
    definition.options.map(([label, points, hardFail], optionIndex) => ({
      id: `qual_opt_sdr_v1_${questionIndex + 1}_${optionIndex + 1}`,
      scopeId: safeScope,
      questionId: `qual_q_sdr_v1_${questionIndex + 1}`,
      label,
      points,
      position: optionIndex + 1,
      hardFail: bool(hardFail),
    })),
  );
  return { template, version, questions, options };
};

const selectPublishedSdrConfig = ({ templates = [], versions = [], questions = [], options = [] }) => {
  const template = templates.find((row) => row.type === QUALIFICATION_TYPE_SDR && row.isActive !== false);
  if (!template) return null;
  const version = versions
    .filter((row) => row.templateId === template.id && row.status === "published")
    .sort((left, right) => Number(right.versionNumber || 0) - Number(left.versionNumber || 0))[0] || null;
  if (!version) return null;
  const versionQuestions = questions
    .filter((row) => row.versionId === version.id)
    .sort((left, right) => Number(left.position || 0) - Number(right.position || 0));
  const questionIds = new Set(versionQuestions.map((row) => row.id));
  const versionOptions = options
    .filter((row) => questionIds.has(row.questionId))
    .sort((left, right) => Number(left.position || 0) - Number(right.position || 0));
  return { template, version, questions: versionQuestions, options: versionOptions };
};

const thresholdSnapshot = (version = {}) => ({
  totalThreshold: Number(version.totalThreshold) || DEFAULT_THRESHOLDS.totalThreshold,
  minimumFitScore: Number(version.minimumFitScore) || DEFAULT_THRESHOLDS.minimumFitScore,
  minimumIntentScore: Number(version.minimumIntentScore) || DEFAULT_THRESHOLDS.minimumIntentScore,
});

const scoreQualification = ({ version, questions = [], options = [], answers = [] }) => {
  const answerByQuestion = new Map((Array.isArray(answers) ? answers : []).map((answer) => [clean(answer.questionId), clean(answer.optionId)]));
  const optionsById = new Map((Array.isArray(options) ? options : []).map((option) => [clean(option.id), option]));
  let fitScore = 0;
  let intentScore = 0;
  let hardGatesPassed = true;
  const answerRows = [];
  const missingQuestionIds = [];
  for (const question of Array.isArray(questions) ? questions : []) {
    const optionId = answerByQuestion.get(question.id);
    if (question.required && !optionId) {
      missingQuestionIds.push(question.id);
      continue;
    }
    if (!optionId) continue;
    const option = optionsById.get(optionId);
    if (!option || option.questionId !== question.id) {
      missingQuestionIds.push(question.id);
      continue;
    }
    const points = Number(option.points) || 0;
    if (FIT_DIMENSIONS.has(question.dimension)) fitScore += points;
    if (INTENT_DIMENSIONS.has(question.dimension)) intentScore += points;
    if ((question.isHardGate || option.hardFail) && option.hardFail) hardGatesPassed = false;
    answerRows.push({
      questionId: question.id,
      optionId: option.id,
      questionTitle: question.title,
      optionLabel: option.label,
      dimension: question.dimension,
      points,
      hardFail: option.hardFail === true,
      position: question.position,
    });
  }
  const totalScore = fitScore + intentScore;
  const thresholds = thresholdSnapshot(version);
  const questionnaireComplete = missingQuestionIds.length === 0 && answerRows.length >= questions.filter((row) => row.required !== false).length;
  const passed = questionnaireComplete
    && hardGatesPassed
    && totalScore >= thresholds.totalThreshold
    && fitScore >= thresholds.minimumFitScore
    && intentScore >= thresholds.minimumIntentScore;
  return {
    questionnaireComplete,
    missingQuestionIds,
    fitScore,
    intentScore,
    totalScore,
    hardGatesPassed,
    passed,
    status: passed ? "passed" : "failed",
    thresholdSnapshot: thresholds,
    answerRows,
  };
};

const latestRun = (runs = []) =>
  (Array.isArray(runs) ? runs : [])
    .slice()
    .sort((left, right) => String(right.completedAt || right.startedAt || right.updatedAt || "").localeCompare(String(left.completedAt || left.startedAt || left.updatedAt || "")))[0] || null;

const latestPassedRun = (runs = []) => latestRun((Array.isArray(runs) ? runs : []).filter((run) => run.status === "passed" && run.passed === true));

const stageRequiresQualification = (stage = {}) => bool(stage.requiresQualification) || clean(stage.qualificationGate) === QUALIFICATION_TYPE_SDR;

const isForwardMovePastGate = ({ fromStageId, toStageId, stages = [] }) => {
  if (!clean(fromStageId) || !clean(toStageId) || clean(fromStageId) === clean(toStageId)) return false;
  const fromStage = stages.find((stage) => clean(stage.id) === clean(fromStageId));
  const toStage = stages.find((stage) => clean(stage.id) === clean(toStageId));
  if (!fromStage || !toStage || fromStage.pipelineId !== toStage.pipelineId) return false;
  return stageRequiresQualification(fromStage) && Number(toStage.position || 0) > Number(fromStage.position || 0);
};

const qualificationMoveGate = ({ opportunity = {}, toStageId, stages = [], runs = [] }) => {
  if (!isForwardMovePastGate({ fromStageId: opportunity.stageId, toStageId, stages })) return { ok: true };
  const latest = latestRun(runs);
  const passed = latestPassedRun(runs);
  if (passed) return { ok: true, run: passed };
  return {
    ok: false,
    error: latest ? "qualification_failed" : "qualification_required",
    run: latest,
  };
};

const qualificationSummaryFromRun = (run = {}) => ({
  runId: run.id || null,
  status: run.status || null,
  totalScore: numberOrZero(run.totalScore),
  fitScore: numberOrZero(run.fitScore),
  intentScore: numberOrZero(run.intentScore),
  passed: bool(run.passed),
});

const assertCanMutatePublishedConfig = (row = {}) => {
  if (PUBLISHED_STATUSES.has(clean(row.status))) {
    const error = new Error("published_qualification_version_is_immutable");
    error.status = 409;
    throw error;
  }
  return true;
};

module.exports = {
  COLLECTION_KEYS,
  DEFAULT_THRESHOLDS,
  QUALIFICATION_TYPE_SDR,
  assertCanMutatePublishedConfig,
  buildSdrSeedRows,
  isForwardMovePastGate,
  latestRun,
  normalizeAnswer,
  normalizeOption,
  normalizeQuestion,
  normalizeRun,
  normalizeTemplate,
  normalizeVersion,
  qualificationMoveGate,
  qualificationSummaryFromRun,
  scoreQualification,
  selectPublishedSdrConfig,
  stageRequiresQualification,
  thresholdSnapshot,
};
