const crypto = require("crypto");

const { getSessionFromRequest } = require("../_lib/session");
const {
  commitWritesAsAdmin,
  getDocumentAsAdmin,
  listCollectionAsAdmin,
  queryCollectionByFieldAsAdmin,
} = require("./_lib/firestore-admin");
const { PROJECT_ID, encodeFields } = require("./_lib/firestore-rest");
const crmService = require("./_lib/crm-service");
const qualification = require("./_lib/crm-qualification");
const handoff = require("./_lib/crm-handoff");
const qualificationAnalytics = require("./_lib/crm-qualification-analytics");
const qualificationActions = require("./_lib/crm-qualification-actions");
const crmReasons = require("./_lib/crm-reasons");
const crmWorkflows = require("./_lib/crm-workflows");
const commercialPermissions = require("./_lib/commercial-permissions");
const { requireAdminPermission } = require("./_lib/admin-permissions");
const { createPerformanceTimer, sendJsonWithPerformance } = require("./_lib/performance-observer");

const COLLECTIONS = {
  pipelines: "crmPipelines",
  stages: "crmStages",
  contacts: "crmContacts",
  opportunities: "crmOpportunities",
  activities: "crmActivities",
  stageHistory: "crmOpportunityStageHistory",
  events: "crmEvents",
  users: "users",
  qualificationTemplates: "crmQualificationTemplates",
  qualificationVersions: "crmQualificationVersions",
  qualificationQuestions: "crmQualificationQuestions",
  qualificationOptions: "crmQualificationOptions",
  qualificationRuns: "crmQualificationRuns",
  qualificationAnswers: "crmQualificationAnswers",
  workflows: "crmWorkflows",
  workflowVersions: "crmWorkflowVersions",
  workflowSteps: "crmWorkflowSteps",
  workflowRuns: "crmWorkflowRuns",
  salesHandoffs: "crmSalesHandoffs",
  closerReviews: "crmCloserReviews",
  qualificationActions: "crmQualificationActions",
  growthMetricsCache: "growthMetricsCache",
};

const VALID_STATUS = new Set(["open", "won", "lost"]);
const VALID_ACTIVITY_TYPES = new Set(["task", "call", "meeting", "follow_up"]);
const VALID_ACTIVITY_STATUS = new Set(["open", "completed", "cancelled"]);
const VALID_LOST_REASONS = new Set(crmReasons.CLOSER_LOST_REASONS.map(([value]) => value).concat(Object.keys(crmReasons.CLOSER_LOST_LEGACY_LABELS)));
const CRM_SCOPE_ID = String(process.env.SPACE_CRM_SCOPE_ID || process.env.CRM_SCOPE_ID || "space-main").trim() || "space-main";

const normalizeRole = (value) => {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "admin" || raw === "administrador") return "admin";
  if (raw === "growth") return "growth";
  return "";
};

const canAccessCrm = (req) => {
  const session = getSessionFromRequest(req);
  const role = normalizeRole(session?.role);
  if (role === "admin" || role === "growth") return { ok: true, session, role };
  return { ok: false, status: session ? 403 : 401, error: session ? "forbidden" : "unauthorized" };
};

const resolveCrmAuthContext = async (auth) => {
  if (!auth?.ok) return auth;
  const session = auth.session || {};
  let commercialRoles = commercialPermissions.normalizeCommercialRoles(session.commercialRoles);
  if (auth.role === "growth") {
    try {
      const row = await getDocumentAsAdmin(`${COLLECTIONS.users}/${encodeURIComponent(clean(session.sub))}`);
      commercialRoles = commercialPermissions.normalizeCommercialRoles(row?.commercialRoles);
    } catch {
      // Fall back to session roles if the user document is unavailable.
    }
  }
  return {
    ...auth,
    session: { ...session, commercialRoles },
    user: { id: clean(session.sub), role: auth.role, commercialRoles },
  };
};

const nowIso = () => new Date().toISOString();
const newId = (prefix) => `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`;

const docName = (collection, id) => {
  const safeCollection = clean(collection);
  const safeId = clean(id);
  if (!PROJECT_ID || !safeCollection || !safeId) {
    const error = new Error("invalid_firestore_document_name");
    error.code = "invalid_firestore_document_name";
    throw error;
  }
  return `projects/${PROJECT_ID}/databases/(default)/documents/${safeCollection}/${encodeURIComponent(safeId)}`;
};

const toIso = (value) => {
  if (value instanceof Date) return value.toISOString();
  const raw = String(value || "").trim();
  return raw || null;
};

const clean = (value) => String(value || "").trim();
const matchesCrmScope = (row) => clean(row?.scopeId) === CRM_SCOPE_ID || !clean(row?.scopeId);

const normalizeSearchText = (value) =>
  clean(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ");

const normalizeSearchPhone = (value) => clean(value).replace(/\D/g, "");

const contactSearchFields = (contact = {}) => ({
  searchName: normalizeSearchText(contact.name || contact.contactName),
  searchEmail: normalizeSearchText(contact.email),
  searchPhone: normalizeSearchPhone(contact.phone),
});

const opportunitySearchFields = (opportunity = {}) => ({
  searchTitle: normalizeSearchText(opportunity.title),
});

const numberOrNull = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const normalizedNameKey = (value) => normalizeSearchText(value);

const normalizeCurrency = (value) => {
  const raw = clean(value).toUpperCase();
  return raw || "BRL";
};

const normalizeCountryCode = (value) => {
  const raw = clean(value).toUpperCase();
  return /^[A-Z]{2}$/.test(raw) ? raw : "";
};

const normalizeDateOnly = (value) => {
  const raw = clean(value);
  if (!raw) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
};

const normalizeTimestamp = (value) => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  const raw = clean(value);
  if (!raw) return "";
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
};

const activityDueAtFromBody = (body) => {
  const direct = normalizeTimestamp(body?.dueAt);
  if (direct) return direct;
  const date = normalizeDateOnly(body?.date);
  const time = clean(body?.time);
  if (!date || !/^\d{2}:\d{2}$/.test(time)) return "";
  return normalizeTimestamp(`${date}T${time}:00-03:00`);
};

const compareActivityDueAt = (left, right) => {
  const leftMs = Date.parse(left?.dueAt || "");
  const rightMs = Date.parse(right?.dueAt || "");
  const safeLeft = Number.isFinite(leftMs) ? leftMs : Number.MAX_SAFE_INTEGER;
  const safeRight = Number.isFinite(rightMs) ? rightMs : Number.MAX_SAFE_INTEGER;
  if (safeLeft !== safeRight) return safeLeft - safeRight;
  return String(left?.createdAt || "").localeCompare(String(right?.createdAt || ""));
};

const nextActivityFields = (activities) => {
  const next = (Array.isArray(activities) ? activities : [])
    .filter((activity) => activity.status === "open" && activity.dueAt)
    .sort(compareActivityDueAt)[0] || null;
  return {
    nextActivityId: next?.id || null,
    nextActivityAt: next?.dueAt || null,
    nextActivityType: next?.type || null,
    nextActivityTitle: next?.title || null,
  };
};

const normalizePipeline = (row) => ({
  id: clean(row.id || row.firestoreDocId),
  scopeId: clean(row.scopeId) || CRM_SCOPE_ID,
  name: clean(row.name),
  pipelineType: ["general", "sdr", "closer"].includes(clean(row.pipelineType)) ? clean(row.pipelineType) : "general",
  isActive: row.isActive !== false,
  isDefault: row.isDefault === true,
  createdAt: toIso(row.createdAt),
  updatedAt: toIso(row.updatedAt),
});

const normalizeStage = (row) => ({
  id: clean(row.id || row.firestoreDocId),
  scopeId: clean(row.scopeId) || CRM_SCOPE_ID,
  pipelineId: clean(row.pipelineId),
  name: clean(row.name),
  position: Number(row.position) || 0,
  requiresQualification: row.requiresQualification === true,
  requiresQualificationToExit: row.requiresQualificationToExit === true,
  qualificationGate: clean(row.qualificationGate) || null,
  handoffTargetPipelineId: clean(row.handoffTargetPipelineId) || null,
  handoffTargetStageId: clean(row.handoffTargetStageId) || null,
  createdAt: toIso(row.createdAt),
  updatedAt: toIso(row.updatedAt),
});

const normalizeContact = (row) => ({
  id: clean(row.id || row.firestoreDocId),
  scopeId: clean(row.scopeId) || CRM_SCOPE_ID,
  name: clean(row.name),
  phone: clean(row.phone),
  email: clean(row.email),
  countryCode: normalizeCountryCode(row.countryCode || row.country || row.country_code || row.location?.country),
  searchName: normalizeSearchText(row.searchName || row.name),
  searchEmail: normalizeSearchText(row.searchEmail || row.email),
  searchPhone: normalizeSearchPhone(row.searchPhone || row.phone),
  createdAt: toIso(row.createdAt),
  updatedAt: toIso(row.updatedAt),
});

const normalizeOpportunity = (row) => ({
  id: clean(row.id || row.firestoreDocId),
  scopeId: clean(row.scopeId) || CRM_SCOPE_ID,
  contactId: clean(row.contactId),
  pipelineId: clean(row.pipelineId),
  stageId: clean(row.stageId),
  title: clean(row.title),
  value: numberOrNull(row.value),
  currency: normalizeCurrency(row.currency),
  ownerId: clean(row.ownerId) || null,
  source: clean(row.source) || null,
  status: VALID_STATUS.has(clean(row.status)) ? clean(row.status) : "open",
  lostReason: clean(row.lostReason) || null,
  lostReasonNote: clean(row.lostReasonNote) || null,
  closedAt: toIso(row.closedAt),
  closedBy: clean(row.closedBy) || null,
  closedValue: numberOrNull(row.closedValue),
  expectedCloseDate: normalizeDateOnly(row.expectedCloseDate),
  nextActivityId: clean(row.nextActivityId) || null,
  nextActivityAt: toIso(row.nextActivityAt),
  nextActivityType: clean(row.nextActivityType) || null,
  nextActivityTitle: clean(row.nextActivityTitle) || null,
  latestQualificationRunId: clean(row.latestQualificationRunId) || null,
  qualificationStatus: clean(row.qualificationStatus) || null,
  qualificationScore: numberOrNull(row.qualificationScore),
  qualificationFitScore: numberOrNull(row.qualificationFitScore),
  qualificationIntentScore: numberOrNull(row.qualificationIntentScore),
  qualificationPassed: row.qualificationPassed === true,
  latestHandoffId: clean(row.latestHandoffId) || null,
  closerReviewStatus: clean(row.closerReviewStatus) || null,
  salesAccepted: row.salesAccepted === null || row.salesAccepted === undefined ? null : row.salesAccepted === true,
  qualificationAccuracy: numberOrNull(row.qualificationAccuracy),
  closerRejectReason: clean(row.closerRejectReason) || null,
  recommendedAction: clean(row.recommendedAction) || null,
  discardedAt: toIso(row.discardedAt),
  discardedBy: clean(row.discardedBy) || null,
  discardedReason: clean(row.discardedReason) || null,
  discardedReasonNote: clean(row.discardedReasonNote) || null,
  reactivatedAt: toIso(row.reactivatedAt),
  reactivatedBy: clean(row.reactivatedBy) || null,
  searchTitle: normalizeSearchText(row.searchTitle || row.title),
  createdAt: toIso(row.createdAt),
  updatedAt: toIso(row.updatedAt),
});

const normalizeActivityType = (value) => {
  const raw = clean(value);
  return VALID_ACTIVITY_TYPES.has(raw) ? raw : "";
};

const normalizeActivityStatus = (value) => {
  const raw = clean(value);
  return VALID_ACTIVITY_STATUS.has(raw) ? raw : "open";
};

const normalizeActivity = (row) => ({
  id: clean(row.id || row.firestoreDocId),
  scopeId: clean(row.scopeId) || CRM_SCOPE_ID,
  opportunityId: clean(row.opportunityId),
  contactId: clean(row.contactId),
  type: normalizeActivityType(row.type) || "task",
  title: clean(row.title),
  description: clean(row.description) || null,
  dueAt: toIso(row.dueAt),
  completedAt: toIso(row.completedAt),
  completedBy: clean(row.completedBy) || null,
  status: normalizeActivityStatus(row.status),
  ownerId: clean(row.ownerId) || null,
  createdBy: clean(row.createdBy) || null,
  createdAt: toIso(row.createdAt),
  updatedAt: toIso(row.updatedAt),
  workflowRunId: clean(row.workflowRunId) || null,
  workflowId: clean(row.workflowId) || null,
  workflowStepId: clean(row.workflowStepId) || null,
});

const normalizeEvent = (row) => ({
  id: clean(row.id || row.firestoreDocId),
  scopeId: clean(row.scopeId) || CRM_SCOPE_ID,
  type: clean(row.type),
  opportunityId: clean(row.opportunityId),
  contactId: clean(row.contactId),
  actorId: clean(row.actorId) || null,
  payload: row.payload && typeof row.payload === "object" ? row.payload : {},
  createdAt: toIso(row.createdAt),
});

const normalizeStageHistory = (row) => ({
  id: clean(row.id || row.firestoreDocId),
  scopeId: clean(row.scopeId) || CRM_SCOPE_ID,
  opportunityId: clean(row.opportunityId),
  fromStageId: clean(row.fromStageId) || null,
  toStageId: clean(row.toStageId) || null,
  changedBy: clean(row.changedBy) || null,
  createdAt: toIso(row.createdAt),
});

const readBody = async (req) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    const error = new Error("invalid_json");
    error.status = 400;
    throw error;
  }
};

const buildWrite = (collection, id, data, options = {}) => ({
  update: {
    name: docName(collection, id),
    fields: encodeFields(data).fields,
  },
  ...(options.createOnly ? { currentDocument: { exists: false } } : {}),
});

const deleteWrite = (collection, id) => ({ delete: docName(collection, id) });

const growthOverviewCacheInvalidationWrites = async () => {
  const rows = await listCollectionAsAdmin(COLLECTIONS.growthMetricsCache, { maxPages: 10 }).catch(() => []);
  return rows
    .map((row) => clean(row.id || row.firestoreDocId))
    .filter((id) => id && id.startsWith("overview"))
    .map((id) => deleteWrite(COLLECTIONS.growthMetricsCache, id));
};

const eventWrite = ({ type, opportunityId, contactId, actorId, payload, stamp }) => {
  const id = newId("event");
  return buildWrite(COLLECTIONS.events, id, {
    id,
    scopeId: CRM_SCOPE_ID,
    type,
    opportunityId: opportunityId || null,
    contactId: contactId || null,
    actorId: actorId || null,
    payload: payload || {},
    createdAt: stamp,
  });
};

const loadOpportunityForWrite = async (id) => {
  const safeId = clean(id);
  if (!safeId) return null;
  try {
    const opportunity = normalizeOpportunity(await getDocumentAsAdmin(`${COLLECTIONS.opportunities}/${encodeURIComponent(safeId)}`));
    return matchesCrmScope(opportunity) ? opportunity : null;
  } catch {
    return null;
  }
};

const loadActivitiesForOpportunity = async (opportunityId, perf = null) => {
  const safeOpportunityId = clean(opportunityId);
  if (!safeOpportunityId) return [];
  const rows = await (perf
    ? perf.measure("activities", () => queryCollectionByFieldAsAdmin(COLLECTIONS.activities, { field: "opportunityId", value: safeOpportunityId }), { firestore: true })
    : queryCollectionByFieldAsAdmin(COLLECTIONS.activities, { field: "opportunityId", value: safeOpportunityId })).catch(() => []);
  const activities = rows
    .map(normalizeActivity)
    .filter((activity) => activity.id && matchesCrmScope(activity) && activity.opportunityId === safeOpportunityId)
    .sort(compareActivityDueAt);
  if (perf) perf.set("numberOfActivities", activities.length);
  return activities;
};

const requireAdmin = (auth) => {
  if (auth.role !== "admin") return { status: 403, body: { error: "admin_required" } };
  return null;
};

const loadCrmStructure = async () => {
  const [pipelinesRaw, stagesRaw, opportunitiesRaw] = await Promise.all([
    listCollectionAsAdmin(COLLECTIONS.pipelines, { maxPages: 10 }).catch(() => []),
    listCollectionAsAdmin(COLLECTIONS.stages, { maxPages: 20 }).catch(() => []),
    listCollectionAsAdmin(COLLECTIONS.opportunities, { maxPages: 50 }).catch(() => []),
  ]);
  return {
    pipelines: pipelinesRaw.map(normalizePipeline).filter((row) => row.id && matchesCrmScope(row)),
    stages: stagesRaw.map(normalizeStage).filter((row) => row.id && matchesCrmScope(row)),
    opportunities: opportunitiesRaw.map(normalizeOpportunity).filter((row) => row.id && matchesCrmScope(row)),
  };
};

const normalizeQualificationRows = (rows, normalize) => rows.map((row) => normalize(row, CRM_SCOPE_ID)).filter((row) => row.id && matchesCrmScope(row));

const loadPublishedSdrQualification = async () => {
  const [templatesRaw, versionsRaw, questionsRaw, optionsRaw] = await Promise.all([
    listCollectionAsAdmin(COLLECTIONS.qualificationTemplates, { maxPages: 5 }).catch(() => []),
    listCollectionAsAdmin(COLLECTIONS.qualificationVersions, { maxPages: 5 }).catch(() => []),
    listCollectionAsAdmin(COLLECTIONS.qualificationQuestions, { maxPages: 10 }).catch(() => []),
    listCollectionAsAdmin(COLLECTIONS.qualificationOptions, { maxPages: 20 }).catch(() => []),
  ]);
  return qualification.selectPublishedSdrConfig({
    templates: normalizeQualificationRows(templatesRaw, qualification.normalizeTemplate),
    versions: normalizeQualificationRows(versionsRaw, qualification.normalizeVersion),
    questions: normalizeQualificationRows(questionsRaw, qualification.normalizeQuestion),
    options: normalizeQualificationRows(optionsRaw, qualification.normalizeOption),
  });
};

const loadQualificationConfigRows = async () => {
  const [templatesRaw, versionsRaw, questionsRaw, optionsRaw] = await Promise.all([
    listCollectionAsAdmin(COLLECTIONS.qualificationTemplates, { maxPages: 10 }).catch(() => []),
    listCollectionAsAdmin(COLLECTIONS.qualificationVersions, { maxPages: 20 }).catch(() => []),
    listCollectionAsAdmin(COLLECTIONS.qualificationQuestions, { maxPages: 50 }).catch(() => []),
    listCollectionAsAdmin(COLLECTIONS.qualificationOptions, { maxPages: 100 }).catch(() => []),
  ]);
  return {
    templates: normalizeQualificationRows(templatesRaw, qualification.normalizeTemplate),
    versions: normalizeQualificationRows(versionsRaw, qualification.normalizeVersion),
    questions: normalizeQualificationRows(questionsRaw, qualification.normalizeQuestion),
    options: normalizeQualificationRows(optionsRaw, qualification.normalizeOption),
  };
};

const loadWorkflowConfigRows = async () => {
  const [workflowsRaw, versionsRaw, stepsRaw, runsRaw] = await Promise.all([
    listCollectionAsAdmin(COLLECTIONS.workflows, { maxPages: 20 }).catch(() => []),
    listCollectionAsAdmin(COLLECTIONS.workflowVersions, { maxPages: 50 }).catch(() => []),
    listCollectionAsAdmin(COLLECTIONS.workflowSteps, { maxPages: 100 }).catch(() => []),
    listCollectionAsAdmin(COLLECTIONS.workflowRuns, { maxPages: 50 }).catch(() => []),
  ]);
  return {
    workflows: workflowsRaw.map((row) => crmWorkflows.normalizeWorkflow(row, CRM_SCOPE_ID)).filter((row) => row.id && matchesCrmScope(row)),
    versions: versionsRaw.map((row) => crmWorkflows.normalizeWorkflowVersion(row, CRM_SCOPE_ID)).filter((row) => row.id && matchesCrmScope(row)),
    steps: stepsRaw.map((row) => crmWorkflows.normalizeWorkflowStep(row, CRM_SCOPE_ID)).filter((row) => row.id && matchesCrmScope(row)),
    runs: runsRaw.map((row) => crmWorkflows.normalizeWorkflowRun(row, CRM_SCOPE_ID)).filter((row) => row.id && matchesCrmScope(row)),
  };
};

const buildWorkflowAdminModel = ({ workflows = [], versions = [], steps = [], runs = [] } = {}, structure = {}) => {
  const stepsByVersionId = new Map();
  steps.forEach((step) => {
    if (!stepsByVersionId.has(step.versionId)) stepsByVersionId.set(step.versionId, []);
    stepsByVersionId.get(step.versionId).push(step);
  });
  const versionsByWorkflowId = new Map();
  versions.forEach((version) => {
    if (!versionsByWorkflowId.has(version.workflowId)) versionsByWorkflowId.set(version.workflowId, []);
    versionsByWorkflowId.get(version.workflowId).push({
      ...version,
      steps: (stepsByVersionId.get(version.id) || []).slice().sort((left, right) => Number(left.position || 0) - Number(right.position || 0)),
    });
  });
  const runsByWorkflowId = new Map();
  runs.forEach((run) => runsByWorkflowId.set(run.workflowId, (runsByWorkflowId.get(run.workflowId) || 0) + 1));
  const pipelinesById = new Map((structure.pipelines || []).map((pipeline) => [pipeline.id, pipeline]));
  const stagesById = new Map((structure.stages || []).map((stage) => [stage.id, stage]));
  return {
    workflows: workflows
      .map((workflow) => ({
        ...workflow,
        pipelineName: pipelinesById.get(workflow.pipelineId)?.name || "",
        triggerStageName: stagesById.get(workflow.triggerStageId)?.name || "",
        runCount: runsByWorkflowId.get(workflow.id) || 0,
        versions: (versionsByWorkflowId.get(workflow.id) || []).slice().sort((left, right) => Number(right.versionNumber || 0) - Number(left.versionNumber || 0)),
      }))
      .sort((left, right) => String(right.updatedAt || "").localeCompare(String(left.updatedAt || ""))),
  };
};

const buildQualificationAdminModel = ({ templates = [], versions = [], questions = [], options = [] } = {}) => {
  const optionsByQuestionId = new Map();
  options.forEach((option) => {
    if (!optionsByQuestionId.has(option.questionId)) optionsByQuestionId.set(option.questionId, []);
    optionsByQuestionId.get(option.questionId).push(option);
  });
  const questionsByVersionId = new Map();
  questions.forEach((question) => {
    if (!questionsByVersionId.has(question.versionId)) questionsByVersionId.set(question.versionId, []);
    questionsByVersionId.get(question.versionId).push({
      ...question,
      options: (optionsByQuestionId.get(question.id) || []).slice().sort((left, right) => Number(left.position || 0) - Number(right.position || 0)),
    });
  });
  const versionsByTemplateId = new Map();
  versions.forEach((version) => {
    const versionQuestions = (questionsByVersionId.get(version.id) || []).slice().sort((left, right) => Number(left.position || 0) - Number(right.position || 0));
    if (!versionsByTemplateId.has(version.templateId)) versionsByTemplateId.set(version.templateId, []);
    versionsByTemplateId.get(version.templateId).push({
      ...version,
      questions: versionQuestions,
      scoreMax: qualificationScoreMaximums({ questions: versionQuestions, options: versionQuestions.flatMap((question) => question.options || []) }),
    });
  });
  const rows = templates
    .filter((template) => template.type === qualification.QUALIFICATION_TYPE_SDR)
    .map((template) => ({
      ...template,
      versions: (versionsByTemplateId.get(template.id) || []).slice().sort((left, right) => Number(right.versionNumber || 0) - Number(left.versionNumber || 0)),
    }))
    .sort((left, right) => String(right.updatedAt || "").localeCompare(String(left.updatedAt || "")));
  return {
    templates: rows,
    activeTemplateId: rows.find((template) => template.isActive !== false)?.id || rows[0]?.id || "",
  };
};

const qualificationScoreMaximums = ({ questions = [], options = [] } = {}) => {
  const optionsByQuestionId = new Map();
  options.forEach((option) => {
    if (!optionsByQuestionId.has(option.questionId)) optionsByQuestionId.set(option.questionId, []);
    optionsByQuestionId.get(option.questionId).push(option);
  });
  return questions.reduce((totals, question) => {
    const max = (optionsByQuestionId.get(question.id) || []).reduce((best, option) => Math.max(best, Number(option.points || 0)), 0);
    const dimension = clean(question.dimension);
    const next = { ...totals, total: totals.total + max };
    if (["need_fit", "economic_readiness", "decision_readiness"].includes(dimension)) next.fit += max;
    if (["pain", "impact", "urgency", "commitment"].includes(dimension)) next.intent += max;
    return next;
  }, { total: 0, fit: 0, intent: 0 });
};

const validateQualificationVersionForPublish = ({ version = {}, questions = [], options = [] } = {}) => {
  const errors = [];
  const byQuestion = new Map();
  options.forEach((option) => {
    if (!byQuestion.has(option.questionId)) byQuestion.set(option.questionId, []);
    byQuestion.get(option.questionId).push(option);
  });
  const numberFields = [
    ["totalThreshold", version.totalThreshold, "Pontuação mínima total inválida."],
    ["minimumFitScore", version.minimumFitScore, "Pontuação mínima Fit inválida."],
    ["minimumIntentScore", version.minimumIntentScore, "Pontuação mínima Intent inválida."],
  ];
  numberFields.forEach(([, value, message]) => {
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0) errors.push(message);
  });
  if (!questions.length) errors.push("Adicione pelo menos uma pergunta.");
  questions.forEach((question, index) => {
    if (!clean(question.title)) errors.push(`Pergunta ${index + 1}: informe o texto.`);
    if (!CRM_QUALIFICATION_DIMENSIONS.has(clean(question.dimension))) errors.push(`Pergunta ${index + 1}: dimensão inválida.`);
    const questionOptions = byQuestion.get(question.id) || [];
    if (!questionOptions.length) errors.push(`Pergunta ${index + 1}: adicione pelo menos uma resposta.`);
    questionOptions.forEach((option, optionIndex) => {
      if (!clean(option.label)) errors.push(`Pergunta ${index + 1}, resposta ${optionIndex + 1}: informe o texto.`);
      const points = Number(option.points);
      if (!Number.isFinite(points) || points < 0) errors.push(`Pergunta ${index + 1}, resposta ${optionIndex + 1}: pontos inválidos.`);
    });
  });
  const scoreMax = qualificationScoreMaximums({ questions, options });
  if (Number(version.totalThreshold) > scoreMax.total) errors.push("Pontuação mínima total maior que o score máximo.");
  if (Number(version.minimumFitScore) > scoreMax.fit) errors.push("Pontuação mínima Fit maior que o score Fit máximo.");
  if (Number(version.minimumIntentScore) > scoreMax.intent) errors.push("Pontuação mínima Intent maior que o score Intent máximo.");
  return { ok: errors.length === 0, errors, scoreMax };
};

const loadQualificationAdminModel = async (actorId = "") => {
  await ensurePublishedSdrQualification(actorId);
  const [qualificationRows, workflowRows, structure] = await Promise.all([
    loadQualificationConfigRows(),
    loadWorkflowConfigRows(),
    loadCrmStructure(),
  ]);
  return {
    ...buildQualificationAdminModel(qualificationRows),
    workflows: buildWorkflowAdminModel(workflowRows, structure).workflows,
    pipelines: structure.pipelines,
    stages: structure.stages,
  };
};

const loadQualificationConfigByVersion = async (versionId) => {
  const id = clean(versionId);
  if (!id) return null;
  const rows = await loadQualificationConfigRows();
  const version = rows.versions.find((row) => row.id === id);
  if (!version) return null;
  const template = rows.templates.find((row) => row.id === version.templateId && row.type === qualification.QUALIFICATION_TYPE_SDR);
  if (!template) return null;
  const questions = rows.questions
    .filter((question) => question.versionId === version.id)
    .sort((left, right) => Number(left.position || 0) - Number(right.position || 0));
  const questionIds = new Set(questions.map((question) => question.id));
  const options = rows.options
    .filter((option) => questionIds.has(option.questionId))
    .sort((left, right) => Number(left.position || 0) - Number(right.position || 0));
  return { template, version, questions, options };
};

const ensurePublishedSdrQualification = async (actorId = "") => {
  const existing = await loadPublishedSdrQualification();
  if (existing) return existing;
  const stamp = nowIso();
  const seed = qualification.buildSdrSeedRows({ scopeId: CRM_SCOPE_ID, stamp, actorId });
  const writes = [
    buildWrite(COLLECTIONS.qualificationTemplates, seed.template.id, seed.template, { createOnly: true }),
    buildWrite(COLLECTIONS.qualificationVersions, seed.version.id, seed.version, { createOnly: true }),
    ...seed.questions.map((row) => buildWrite(COLLECTIONS.qualificationQuestions, row.id, row, { createOnly: true })),
    ...seed.options.map((row) => buildWrite(COLLECTIONS.qualificationOptions, row.id, row, { createOnly: true })),
  ];
  const committed = await commitWritesAsAdmin({ writes });
  const seeded = await loadPublishedSdrQualification();
  if (seeded) return seeded;
  if (!committed.ok) return null;
  return seeded;
};

const loadQualificationRunsForOpportunity = async (opportunityId) => {
  const rows = await listCollectionAsAdmin(COLLECTIONS.qualificationRuns, { maxPages: 20 }).catch(() => []);
  return normalizeQualificationRows(rows, qualification.normalizeRun)
    .filter((run) => run.opportunityId === opportunityId);
};

const loadQualificationAnswersForRun = async (runId) => {
  const rows = await listCollectionAsAdmin(COLLECTIONS.qualificationAnswers, { maxPages: 20 }).catch(() => []);
  return normalizeQualificationRows(rows, qualification.normalizeAnswer)
    .filter((answer) => answer.runId === runId)
    .sort((left, right) => Number(left.position || 0) - Number(right.position || 0));
};

const dimensionScoresFromAnswers = (answers = []) => {
  return (Array.isArray(answers) ? answers : []).reduce((acc, answer) => {
    const dimension = clean(answer.dimension);
    if (!dimension) return acc;
    acc[dimension] = (Number(acc[dimension]) || 0) + (Number(answer.points) || 0);
    return acc;
  }, {});
};

const loadSalesHandoffsForOpportunity = async (opportunityId) => {
  const rows = await listCollectionAsAdmin(COLLECTIONS.salesHandoffs, { maxPages: 20 }).catch(() => []);
  return normalizeQualificationRows(rows, handoff.normalizeHandoff)
    .filter((row) => row.opportunityId === opportunityId)
    .sort((left, right) => String(right.handoffAt || right.createdAt || "").localeCompare(String(left.handoffAt || left.createdAt || "")));
};

const loadCloserReviewsForOpportunity = async (opportunityId) => {
  const rows = await listCollectionAsAdmin(COLLECTIONS.closerReviews, { maxPages: 20 }).catch(() => []);
  return normalizeQualificationRows(rows, handoff.normalizeReview)
    .filter((row) => row.opportunityId === opportunityId)
    .sort((left, right) => String(right.completedAt || right.createdAt || "").localeCompare(String(left.completedAt || left.createdAt || "")));
};

const normalizeActionRows = (rows) => normalizeQualificationRows(rows, qualificationActions.normalizeAction);

const loadQualificationActionsForOpportunity = async (opportunityId) => {
  const safeOpportunityId = clean(opportunityId);
  if (!safeOpportunityId) return [];
  const rows = await listCollectionAsAdmin(COLLECTIONS.qualificationActions, { maxPages: 50 }).catch(() => []);
  return normalizeActionRows(rows)
    .filter((row) => row.opportunityId === safeOpportunityId)
    .sort((left, right) => String(right.createdAt || "").localeCompare(String(left.createdAt || "")));
};

const loadQualificationActionForWrite = async (actionId) => {
  const safeId = clean(actionId);
  if (!safeId) return null;
  try {
    const action = qualificationActions.normalizeAction(await getDocumentAsAdmin(`${COLLECTIONS.qualificationActions}/${encodeURIComponent(safeId)}`), CRM_SCOPE_ID);
    return matchesCrmScope(action) ? action : null;
  } catch {
    return null;
  }
};

const loadLatestHandoffBundle = async (opportunityId) => {
  const [handoffs, reviews] = await Promise.all([
    loadSalesHandoffsForOpportunity(opportunityId),
    loadCloserReviewsForOpportunity(opportunityId),
  ]);
  const latestHandoff = handoffs[0] || null;
  const latestReview = latestHandoff ? reviews.find((review) => review.handoffId === latestHandoff.id) || null : null;
  return { latestHandoff, latestReview };
};

const loadOpportunityQualificationDetail = async (opportunity) => {
  const config = await ensurePublishedSdrQualification();
  if (!config) return { template: null, version: null, questions: [], latestRun: null, answers: [] };
  const runs = await loadQualificationRunsForOpportunity(opportunity.id);
  const latestRun = qualification.latestRun(runs);
  const answers = latestRun ? await loadQualificationAnswersForRun(latestRun.id) : [];
  const optionsByQuestionId = new Map();
  config.options.forEach((option) => {
    if (!optionsByQuestionId.has(option.questionId)) optionsByQuestionId.set(option.questionId, []);
    optionsByQuestionId.get(option.questionId).push(option);
  });
  return {
    template: config.template,
    version: config.version,
    questions: config.questions.map((question) => ({
      ...question,
      options: (optionsByQuestionId.get(question.id) || []).slice().sort((left, right) => Number(left.position || 0) - Number(right.position || 0)),
    })),
    latestRun,
    answers,
  };
};

const stageGateFailure = async ({ opportunity, toStageId, stages }) => {
  const runs = await loadQualificationRunsForOpportunity(opportunity.id);
  const gate = qualification.qualificationMoveGate({ opportunity, toStageId, stages, runs });
  if (gate.ok) return null;
  return {
    status: 409,
    body: {
      error: gate.error,
      qualification: gate.run ? qualification.qualificationSummaryFromRun(gate.run) : null,
    },
  };
};

const loadQualificationAnalytics = async (query = {}) => {
  const [
    pipelines,
    contacts,
    opportunities,
    runs,
    answers,
    handoffs,
    reviews,
    users,
  ] = await Promise.all([
    listCollectionAsAdmin(COLLECTIONS.pipelines, { maxPages: 10 }).catch(() => []),
    listCollectionAsAdmin(COLLECTIONS.contacts, { maxPages: 50 }).catch(() => []),
    listCollectionAsAdmin(COLLECTIONS.opportunities, { maxPages: 50 }).catch(() => []),
    listCollectionAsAdmin(COLLECTIONS.qualificationRuns, { maxPages: 50 }).catch(() => []),
    listCollectionAsAdmin(COLLECTIONS.qualificationAnswers, { maxPages: 50 }).catch(() => []),
    listCollectionAsAdmin(COLLECTIONS.salesHandoffs, { maxPages: 50 }).catch(() => []),
    listCollectionAsAdmin(COLLECTIONS.closerReviews, { maxPages: 50 }).catch(() => []),
    listCollectionAsAdmin(COLLECTIONS.users, { maxPages: 20 }).catch(() => []),
  ]);
  const scopeFilter = (row) => matchesCrmScope(row);
  return qualificationAnalytics.buildCrmQualificationAnalytics({
    query,
    rows: {
      pipelines: pipelines.filter(scopeFilter),
      contacts: contacts.filter(scopeFilter),
      opportunities: opportunities.filter(scopeFilter),
      runs: runs.filter(scopeFilter),
      answers: answers.filter(scopeFilter),
      handoffs: handoffs.filter(scopeFilter),
      reviews: reviews.filter(scopeFilter),
      users,
    },
  });
};

const periodStartForActions = (period) => {
  const key = clean(period || "30d");
  if (!key || key === "all") return null;
  const now = new Date();
  const todayKey = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(now);
  const today = new Date(`${todayKey}T00:00:00-03:00`);
  if (key === "today") return today;
  if (key === "7d") return new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000);
  if (key === "30d") return new Date(today.getTime() - 29 * 24 * 60 * 60 * 1000);
  if (key === "90d") return new Date(today.getTime() - 89 * 24 * 60 * 60 * 1000);
  return null;
};

const loadQualificationActionsQueue = async ({ query = {}, auth }) => {
  const [
    actionsRaw,
    contactsRaw,
    opportunitiesRaw,
    pipelinesRaw,
    handoffsRaw,
    reviewsRaw,
    usersRaw,
  ] = await Promise.all([
    listCollectionAsAdmin(COLLECTIONS.qualificationActions, { maxPages: 50 }).catch(() => []),
    listCollectionAsAdmin(COLLECTIONS.contacts, { maxPages: 50 }).catch(() => []),
    listCollectionAsAdmin(COLLECTIONS.opportunities, { maxPages: 50 }).catch(() => []),
    listCollectionAsAdmin(COLLECTIONS.pipelines, { maxPages: 10 }).catch(() => []),
    listCollectionAsAdmin(COLLECTIONS.salesHandoffs, { maxPages: 50 }).catch(() => []),
    listCollectionAsAdmin(COLLECTIONS.closerReviews, { maxPages: 50 }).catch(() => []),
    listCollectionAsAdmin(COLLECTIONS.users, { maxPages: 20 }).catch(() => []),
  ]);
  const actions = normalizeActionRows(actionsRaw);
  const contactsById = new Map(contactsRaw.map(normalizeContact).filter(matchesCrmScope).map((row) => [row.id, row]));
  const opportunitiesById = new Map(opportunitiesRaw.map(normalizeOpportunity).filter(matchesCrmScope).map((row) => [row.id, row]));
  const pipelinesById = new Map(pipelinesRaw.map(normalizePipeline).filter((row) => row.id).map((row) => [row.id, row]));
  const handoffsById = new Map(normalizeQualificationRows(handoffsRaw, handoff.normalizeHandoff).map((row) => [row.id, row]));
  const reviewsById = new Map(normalizeQualificationRows(reviewsRaw, handoff.normalizeReview).map((row) => [row.id, row]));
  const usersById = new Map(usersRaw.map((row) => [clean(row.uid || row.id || row.firestoreDocId), row]).filter(([id]) => id));
  const status = clean(query.status || "pending");
  const type = clean(query.type);
  const sdr = clean(query.sdr);
  const closer = clean(query.closer);
  const priority = clean(query.priority);
  const search = normalizeSearchText(query.search);
  const start = periodStartForActions(query.period || query.range || "30d");
  const userName = (id) => actorName(usersById, id);
  const nowMs = Date.now();
  const rows = actions
    .filter((action) => {
      if (!action.id || !action.type) return false;
      if (auth.role !== "admin" && !qualificationActions.canManageAction({ role: auth.role, uid: auth.session?.sub, action })) return false;
      if (status && status !== "all" && action.status !== status) return false;
      if (type && action.type !== type) return false;
      if (priority && action.priority !== priority) return false;
      const handoffRow = handoffsById.get(action.handoffId) || {};
      const reviewRow = reviewsById.get(action.closerReviewId) || {};
      if (sdr && clean(handoffRow.sdrUserId || action.metadata?.sdrUserId) !== sdr) return false;
      if (closer && clean(reviewRow.closerUserId || action.metadata?.closerUserId) !== closer) return false;
      if (start) {
        const createdMs = Date.parse(action.createdAt || "");
        if (!Number.isFinite(createdMs) || createdMs < start.getTime()) return false;
      }
      const opportunity = opportunitiesById.get(action.opportunityId) || {};
      const pipeline = pipelinesById.get(opportunity.pipelineId) || {};
      const pipelineType = commercialPermissions.workspaceForPipelineType(pipeline.pipelineType);
      const requestedWorkspace = commercialPermissions.normalizeWorkspace(query.workspace);
      if (requestedWorkspace && pipelineType !== requestedWorkspace) return false;
      if (pipelineType && !commercialPermissions.canAccessPipelineType(auth.user || auth.session, pipelineType)) return false;
      const contact = contactsById.get(action.contactId || opportunity.contactId) || {};
      if (search && ![contact.name, opportunity.title, action.reason].some((value) => normalizeSearchText(value).includes(search))) return false;
      return true;
    })
    .map((action) => {
      const opportunity = opportunitiesById.get(action.opportunityId) || {};
      const contact = contactsById.get(action.contactId || opportunity.contactId) || {};
      const handoffRow = handoffsById.get(action.handoffId) || {};
      const reviewRow = reviewsById.get(action.closerReviewId) || {};
      const dueMs = Date.parse(action.dueAt || "");
      return {
        ...action,
        leadName: contact.name || opportunity.title || "Lead sem nome",
        opportunityTitle: opportunity.title || "",
        source: opportunity.source || "",
        countryCode: contact.countryCode || "",
        sdrUserId: clean(handoffRow.sdrUserId || action.metadata?.sdrUserId) || null,
        sdrName: userName(handoffRow.sdrUserId || action.metadata?.sdrUserId),
        closerUserId: clean(reviewRow.closerUserId || action.metadata?.closerUserId) || null,
        closerName: userName(reviewRow.closerUserId || action.metadata?.closerUserId),
        assignedName: userName(action.assignedTo),
        reviewAt: reviewRow.completedAt || reviewRow.updatedAt || null,
        overdue: action.status === "pending" && Number.isFinite(dueMs) && dueMs < nowMs,
      };
    })
    .sort((left, right) => {
      const statusRank = { pending: 0, completed: 1, dismissed: 2 };
      const priorityRank = { high: 0, normal: 1, low: 2 };
      return (statusRank[left.status] ?? 9) - (statusRank[right.status] ?? 9)
        || (priorityRank[left.priority] ?? 9) - (priorityRank[right.priority] ?? 9)
        || String(right.createdAt || "").localeCompare(String(left.createdAt || ""));
    });
  const pendingCount = actions.filter((action) => action.status === "pending" && (auth.role === "admin" || qualificationActions.canManageAction({ role: auth.role, uid: auth.session?.sub, action }))).length;
  const uniqueOption = (items, valueKey, labelKey) => Array.from(new Map(items.map((row) => [clean(row[valueKey]), clean(row[labelKey] || row[valueKey])]).filter(([id]) => id)).entries()).map(([id, label]) => ({ id, label }));
  return {
    rows,
    counts: { pending: pendingCount },
    filterOptions: {
      sdrs: uniqueOption(rows, "sdrUserId", "sdrName"),
      closers: uniqueOption(rows, "closerUserId", "closerName"),
    },
    generatedAt: nowIso(),
  };
};

const assertUniqueStageNames = (stages, pipelineId, { ignoreStageId = "", candidateName = "" } = {}) => {
  const seen = new Set();
  const rows = stages
    .filter((stage) => stage.pipelineId === pipelineId && stage.id !== ignoreStageId)
    .map((stage) => stage.name)
    .concat(candidateName ? [candidateName] : []);
  for (const name of rows) {
    const key = normalizedNameKey(name);
    if (!key) return { status: 400, body: { error: "stage_name_required" } };
    if (seen.has(key)) return { status: 409, body: { error: "duplicate_stage_name" } };
    seen.add(key);
  }
  return null;
};

const pipelineOpenOpportunityCount = (opportunities, pipelineId) =>
  opportunities.filter((opportunity) => opportunity.pipelineId === pipelineId && opportunity.status === "open").length;

const stageOpportunityCount = (opportunities, stageId) => opportunities.filter((opportunity) => opportunity.stageId === stageId).length;

const opportunityWithNextActivity = (opportunity, activities, stamp = nowIso()) => ({
  ...opportunity,
  ...nextActivityFields(activities),
  updatedAt: stamp,
});

const loadPipelineForOpportunity = async (opportunity) => {
  const rows = await listCollectionAsAdmin(COLLECTIONS.pipelines, { maxPages: 10 }).catch(() => []);
  return rows.map(normalizePipeline).filter(matchesCrmScope).find((pipeline) => pipeline.id === opportunity?.pipelineId) || null;
};

const workflowActivityWrites = ({ workflow, version, steps, opportunity, stamp, actor }) => {
  const baseDate = new Date(stamp);
  return steps.map((step) => {
    const activityId = newId("act");
    return {
      id: activityId,
      scopeId: CRM_SCOPE_ID,
      opportunityId: opportunity.id,
      contactId: opportunity.contactId || null,
      type: step.activityType,
      title: step.title,
      description: step.description || null,
      dueAt: crmWorkflows.dueAtForStep(baseDate, step),
      completedAt: null,
      completedBy: null,
      status: "open",
      ownerId: opportunity.ownerId || null,
      createdBy: actor,
      createdAt: stamp,
      updatedAt: stamp,
      workflowRunId: "",
      workflowId: workflow.id,
      workflowStepId: step.id,
      workflowVersionId: version.id,
    };
  });
};

const loadWorkflowDoc = async (workflowId) => {
  try {
    const row = await getDocumentAsAdmin(`${COLLECTIONS.workflows}/${encodeURIComponent(workflowId)}`);
    const workflow = crmWorkflows.normalizeWorkflow(row, CRM_SCOPE_ID);
    return workflow.id && matchesCrmScope(workflow) ? workflow : null;
  } catch {
    return null;
  }
};

const loadWorkflowVersionDoc = async (versionId) => {
  try {
    const row = await getDocumentAsAdmin(`${COLLECTIONS.workflowVersions}/${encodeURIComponent(versionId)}`);
    const version = crmWorkflows.normalizeWorkflowVersion(row, CRM_SCOPE_ID);
    return version.id && matchesCrmScope(version) ? version : null;
  } catch {
    return null;
  }
};

const loadWorkflowRunDoc = async (runId) => {
  try {
    const row = await getDocumentAsAdmin(`${COLLECTIONS.workflowRuns}/${encodeURIComponent(runId)}`);
    const run = crmWorkflows.normalizeWorkflowRun(row, CRM_SCOPE_ID);
    return run.id && matchesCrmScope(run) ? run : null;
  } catch {
    return null;
  }
};

const queryWorkflowStepsByVersion = async (versionId) =>
  (await queryCollectionByFieldAsAdmin(COLLECTIONS.workflowSteps, { field: "versionId", value: versionId }).catch(() => []))
    .map((row) => crmWorkflows.normalizeWorkflowStep(row, CRM_SCOPE_ID))
    .filter((row) => row.id && matchesCrmScope(row))
    .sort((left, right) => left.position - right.position);

const queryWorkflowRunsByOpportunity = async (opportunityId) =>
  (await queryCollectionByFieldAsAdmin(COLLECTIONS.workflowRuns, { field: "opportunityId", value: opportunityId }).catch(() => []))
    .map((row) => crmWorkflows.normalizeWorkflowRun(row, CRM_SCOPE_ID))
    .filter((row) => row.id && matchesCrmScope(row));

const queryActivitiesByWorkflowRun = async (workflowRunId) =>
  (await queryCollectionByFieldAsAdmin(COLLECTIONS.activities, { field: "workflowRunId", value: workflowRunId }).catch(() => []))
    .map(normalizeActivity)
    .filter((row) => row.id && matchesCrmScope(row));

const startWorkflowsForStageEnter = async ({ opportunity, toStageId, actor, stamp }) => {
  const [workflowsRaw, existingRuns, opportunityActivities] = await Promise.all([
    queryCollectionByFieldAsAdmin(COLLECTIONS.workflows, { field: "triggerStageId", value: toStageId }).catch(() => []),
    queryWorkflowRunsByOpportunity(opportunity.id),
    loadActivitiesForOpportunity(opportunity.id),
  ]);
  const workflows = workflowsRaw.map((row) => crmWorkflows.normalizeWorkflow(row, CRM_SCOPE_ID)).filter((row) => row.id && matchesCrmScope(row) && row.pipelineId === opportunity.pipelineId && row.isActive && row.activeVersionId);
  const active = [];
  for (const workflow of workflows) {
    const version = await loadWorkflowVersionDoc(workflow.activeVersionId);
    if (version?.status === "published") active.push({ workflow, version });
  }
  if (!active.length) return { started: 0 };
  const existingKeys = new Set(existingRuns.map((run) => run.idempotencyKey).filter(Boolean));
  const writes = [];
  let started = 0;
  let nextActivities = opportunityActivities;
  for (const { workflow, version } of active) {
    const idempotencyKey = `${opportunity.id}:${workflow.id}:${version.versionNumber}:${toStageId}`;
    if (existingKeys.has(idempotencyKey)) continue;
    const steps = await queryWorkflowStepsByVersion(version.id);
    if (!steps.length) continue;
    const runId = newId("wfrun");
    const activities = workflowActivityWrites({ workflow, version, steps, opportunity, stamp, actor }).map((activity) => ({ ...activity, workflowRunId: runId }));
    const run = {
      id: runId,
      scopeId: CRM_SCOPE_ID,
      workflowId: workflow.id,
      workflowVersionId: version.id,
      workflowVersion: version.versionNumber,
      opportunityId: opportunity.id,
      triggerStageId: toStageId,
      status: "active",
      idempotencyKey,
      startedAt: stamp,
      completedAt: null,
      cancelledAt: null,
      createdAt: stamp,
      updatedAt: stamp,
    };
    writes.push(
      buildWrite(COLLECTIONS.workflowRuns, run.id, run, { createOnly: true }),
      ...activities.map((activity) => buildWrite(COLLECTIONS.activities, activity.id, activity, { createOnly: true })),
      eventWrite({
        type: "crm.workflow.started",
        opportunityId: opportunity.id,
        contactId: opportunity.contactId,
        actorId: actor,
        payload: { workflowRunId: run.id, workflowId: workflow.id, workflowVersion: version.versionNumber, workflowName: workflow.name, activityCount: activities.length },
        stamp,
      }),
    );
    nextActivities = nextActivities.concat(activities);
    started += 1;
  }
  if (!writes.length) return { started: 0 };
  writes.push(buildWrite(COLLECTIONS.opportunities, opportunity.id, opportunityWithNextActivity(opportunity, nextActivities, stamp)));
  const committed = await commitWritesAsAdmin({ writes });
  if (!committed.ok) throw new Error("crm_workflow_start_failed");
  return { started };
};

const cancelRunsForStageExit = async ({ opportunity, fromStageId, actor, stamp }) => {
  if (!fromStageId) return { cancelled: 0 };
  const [runs, activities] = await Promise.all([
    queryWorkflowRunsByOpportunity(opportunity.id),
    loadActivitiesForOpportunity(opportunity.id),
  ]);
  const activeRuns = runs.filter((run) => run.triggerStageId === fromStageId && run.status === "active");
  if (!activeRuns.length) return { cancelled: 0 };
  const workflowPairs = await Promise.all(activeRuns.map((run) => loadWorkflowDoc(run.workflowId).then((workflow) => [run.workflowId, workflow])));
  const workflowsById = new Map(workflowPairs);
  const runIds = new Set(activeRuns.map((run) => run.id));
  const stampMs = Date.parse(stamp);
  const cancellable = activities.filter((activity) =>
    runIds.has(activity.workflowRunId)
    && activity.status === "open"
    && Number.isFinite(Date.parse(activity.dueAt || ""))
    && Date.parse(activity.dueAt) > stampMs
  );
  const updatedActivities = activities.map((activity) =>
    cancellable.some((row) => row.id === activity.id)
      ? { ...activity, status: "cancelled", updatedAt: stamp }
      : activity
  );
  const writes = [
    ...cancellable.map((activity) => buildWrite(COLLECTIONS.activities, activity.id, { ...activity, status: "cancelled", updatedAt: stamp })),
    ...activeRuns.map((run) => buildWrite(COLLECTIONS.workflowRuns, run.id, { ...run, status: "cancelled", cancelledAt: stamp, updatedAt: stamp })),
    ...activeRuns.map((run) => eventWrite({
      type: "crm.workflow.cancelled",
      opportunityId: opportunity.id,
      contactId: opportunity.contactId,
      actorId: actor,
      payload: { workflowRunId: run.id, workflowId: run.workflowId, workflowName: workflowsById.get(run.workflowId)?.name || "", cancelledActivities: cancellable.filter((activity) => activity.workflowRunId === run.id).length },
      stamp,
    })),
    buildWrite(COLLECTIONS.opportunities, opportunity.id, opportunityWithNextActivity(opportunity, updatedActivities, stamp)),
  ];
  const committed = await commitWritesAsAdmin({ writes });
  if (!committed.ok) throw new Error("crm_workflow_cancel_failed");
  return { cancelled: activeRuns.length };
};

const runWorkflowStageSideEffects = async ({ opportunity, fromStageId, toStageId, actor, stamp }) => {
  try {
    await cancelRunsForStageExit({ opportunity, fromStageId, actor, stamp });
    await startWorkflowsForStageEnter({ opportunity: { ...opportunity, stageId: toStageId }, toStageId, actor, stamp });
  } catch (error) {
    await commitWritesAsAdmin({ writes: [eventWrite({
      type: "crm.workflow.failed",
      opportunityId: opportunity.id,
      contactId: opportunity.contactId,
      actorId: actor,
      payload: { opportunityId: opportunity.id, fromStageId, toStageId, error: clean(error.message) || "crm_workflow_execution_failed" },
      stamp: nowIso(),
    })] }).catch(() => null);
  }
};

const completeWorkflowRunIfSettled = async ({ activity, opportunity, actor, stamp }) => {
  const workflowRunId = clean(activity.workflowRunId);
  if (!workflowRunId) return;
  const run = await loadWorkflowRunDoc(workflowRunId);
  if (!run || run.status !== "active") return;
  const runActivities = (await queryActivitiesByWorkflowRun(workflowRunId)).map((row) => row.id === activity.id ? activity : row);
  if (!runActivities.length || !runActivities.every((row) => row.status === "completed" || row.status === "cancelled")) return;
  const workflow = await loadWorkflowDoc(run.workflowId);
  const committed = await commitWritesAsAdmin({ writes: [
    buildWrite(COLLECTIONS.workflowRuns, run.id, { ...run, status: "completed", completedAt: stamp, updatedAt: stamp }),
    eventWrite({
      type: "crm.workflow.completed",
      opportunityId: opportunity.id,
      contactId: opportunity.contactId,
      actorId: actor,
      payload: { workflowRunId: run.id, workflowId: run.workflowId, workflowName: workflow?.name || "", activityCount: runActivities.length },
      stamp,
    }),
  ] });
  if (!committed.ok) throw new Error("crm_workflow_complete_failed");
};

const crmActionGuard = async ({ auth, action, opportunity, pipelineType }) => {
  const type = pipelineType || (await loadPipelineForOpportunity(opportunity))?.pipelineType || "";
  if (commercialPermissions.canPerformCrmAction({ user: auth.user || auth.session, action, pipelineType: type })) return null;
  return { status: 403, body: { error: "commercial_workspace_forbidden" } };
};

const actorName = (usersById, id) => {
  const row = usersById.get(clean(id));
  return clean(row?.nome || row?.name || row?.displayName || row?.email || id);
};

const stageName = (stagesById, id) => clean(stagesById.get(clean(id))?.name || id);

const activityTypeLabel = (type) => ({
  task: "Tarefa",
  call: "Ligação",
  meeting: "Reunião",
  follow_up: "Follow-up",
}[clean(type)] || "Atividade");

const lostReasonLabel = crmReasons.closerLostReasonLabel;

const eventTitle = (event) => {
  if (event.type === "crm.opportunity.created") return "Oportunidade criada";
  if (event.type === "crm.opportunity.owner_changed") return "Responsável alterado";
  if (event.type === "crm.opportunity.value_changed") return "Valor da oportunidade alterado";
  if (event.type === "crm.opportunity.updated") return "";
  if (event.type === "crm.opportunity.won") return "Oportunidade ganha";
  if (event.type === "crm.opportunity.lost") return "Oportunidade perdida";
  if (event.type === "crm.opportunity.reopened") return "Oportunidade reaberta";
  if (event.type === "crm.activity.created") return `${activityTypeLabel(event.payload?.activityType)} criada`;
  if (event.type === "crm.activity.updated") return `${activityTypeLabel(event.payload?.activityType)} atualizada`;
  if (event.type === "crm.activity.completed") return `${activityTypeLabel(event.payload?.activityType)} concluída`;
  if (event.type === "crm.activity.cancelled") return `${activityTypeLabel(event.payload?.activityType)} cancelada`;
  if (event.type === "crm.qualification.started") return "Qualificação iniciada";
  if (event.type === "crm.qualification.completed") return "Qualificação concluída";
  if (event.type === "crm.handoff.created") return "Enviado para Closer";
  if (event.type === "crm.handoff.accepted") return "Handoff aceito";
  if (event.type === "crm.handoff.rejected") return "Handoff rejeitado";
  if (event.type === "crm.closer_review.completed") return "Closer avaliou o lead";
  if (event.type === "crm.meeting.no_show") return "Reunião marcada como no-show";
  if (event.type === "crm.qualification_action.created") return "Ação recomendada criada";
  if (event.type === "crm.qualification_action.completed") return "Ação resolvida";
  if (event.type === "crm.qualification_action.dismissed") return "Ação dispensada";
  if (event.type === "crm.opportunity.discarded") return "Lead desqualificado";
  if (event.type === "crm.opportunity.reactivated") return "Lead reativado";
  if (event.type === "crm.workflow.started") return "Cadência iniciada";
  if (event.type === "crm.workflow.completed") return "Cadência concluída";
  if (event.type === "crm.workflow.cancelled") return "Cadência cancelada";
  if (event.type === "crm.workflow.failed") return "Cadência não iniciada";
  return clean(event.type).replace(/^crm\./, "");
};

const eventDescription = (event) => {
  if (event.type === "crm.opportunity.owner_changed") {
    return [clean(event.payload?.fromOwnerName) || "Sem responsável", clean(event.payload?.toOwnerName) || "Sem responsável"].join(" → ");
  }
  if (event.type === "crm.opportunity.value_changed") {
    const format = (value) => {
      const number = numberOrNull(value);
      return number == null ? "—" : new Intl.NumberFormat("pt-BR", { style: "currency", currency: clean(event.payload?.currency) || "BRL" }).format(number);
    };
    return `${format(event.payload?.fromValue)} → ${format(event.payload?.toValue)}`;
  }
  if (event.type === "crm.opportunity.won") {
    const value = numberOrNull(event.payload?.closedValue);
    const formatted = value == null ? "" : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
    return formatted;
  }
  if (event.type === "crm.opportunity.lost") {
    const reason = lostReasonLabel(event.payload?.lostReason);
    return reason ? `Motivo: ${reason}` : "";
  }
  if (event.type === "crm.opportunity.reopened") return "";
  if (event.type === "crm.qualification.completed") {
    const score = Number(event.payload?.totalScore);
    const scoreLabel = Number.isFinite(score) ? `${score}/100` : "";
    const status = event.payload?.passed === true ? "Aprovado" : "Reprovado";
    return [scoreLabel, status].filter(Boolean).join(" · ");
  }
  if (event.type === "crm.handoff.created") {
    const closer = clean(event.payload?.closerName || event.payload?.closerUserId);
    return closer ? `Closer: ${closer}` : "";
  }
  if (event.type === "crm.closer_review.completed") {
    const accepted = event.payload?.salesAccepted === true ? "Lead aceito" : "Lead rejeitado";
    const accuracy = Number(event.payload?.accuracyScore);
    const accuracyLabel = Number.isFinite(accuracy) ? `Accuracy: ${accuracy}%` : "";
    const action = clean(event.payload?.recommendedAction);
    return [accepted, accuracyLabel, action ? `Ação: ${action}` : ""].filter(Boolean).join(" · ");
  }
  if (event.type === "crm.qualification_action.created") return event.payload?.reason || "";
  if (event.type === "crm.qualification_action.completed") return event.payload?.resolutionNote || event.payload?.resolutionCategory || event.payload?.activityTitle || "";
  if (event.type === "crm.qualification_action.dismissed") return event.payload?.dismissedReason || "";
  if (event.type === "crm.opportunity.discarded") {
    const reason = crmReasons.sdrDiscardReasonLabel(event.payload?.discardReason || event.payload?.discardedReason);
    const note = clean(event.payload?.discardReasonNote || event.payload?.discardedNote);
    return [reason ? `Motivo: ${reason}` : "", note].filter(Boolean).join(" · ");
  }
  if (event.type === "crm.opportunity.reactivated") return "";
  if (event.type === "crm.workflow.started") {
    const name = clean(event.payload?.workflowName) || "Cadência";
    const count = Number(event.payload?.activityCount) || 0;
    return `${name} · ${count} atividade${count === 1 ? "" : "s"} programada${count === 1 ? "" : "s"}`;
  }
  if (event.type === "crm.workflow.cancelled") {
    const name = clean(event.payload?.workflowName) || "Cadência";
    const count = Number(event.payload?.cancelledActivities) || 0;
    return `${name} · ${count} atividade${count === 1 ? "" : "s"} futura${count === 1 ? "" : "s"} cancelada${count === 1 ? "" : "s"}`;
  }
  if (event.type === "crm.workflow.completed") return clean(event.payload?.workflowName) || "Cadência";
  if (event.type === "crm.workflow.failed") return clean(event.payload?.error) || "Falha ao iniciar cadência";
  return event.payload?.title || event.payload?.activityTitle || "";
};

const buildOpportunityTimeline = async (opportunityId, perf = null) => {
  const [eventsRaw, historyRaw, stagesRaw, usersRaw] = await Promise.all([
    (perf ? perf.measure("timeline_events", () => queryCollectionByFieldAsAdmin(COLLECTIONS.events, { field: "opportunityId", value: opportunityId }), { firestore: true }) : queryCollectionByFieldAsAdmin(COLLECTIONS.events, { field: "opportunityId", value: opportunityId })).catch(() => []),
    (perf ? perf.measure("timeline_stageHistory", () => queryCollectionByFieldAsAdmin(COLLECTIONS.stageHistory, { field: "opportunityId", value: opportunityId }), { firestore: true }) : queryCollectionByFieldAsAdmin(COLLECTIONS.stageHistory, { field: "opportunityId", value: opportunityId })).catch(() => []),
    (perf ? perf.measure("timeline_stages", () => listCollectionAsAdmin(COLLECTIONS.stages, { maxPages: 10 }), { firestore: true }) : listCollectionAsAdmin(COLLECTIONS.stages, { maxPages: 10 })).catch(() => []),
    (perf ? perf.measure("timeline_users", () => listCollectionAsAdmin(COLLECTIONS.users, { maxPages: 20 }), { firestore: true }) : listCollectionAsAdmin(COLLECTIONS.users, { maxPages: 20 })).catch(() => []),
  ]);
  const stagesById = new Map(stagesRaw.map(normalizeStage).filter(matchesCrmScope).map((stage) => [stage.id, stage]));
  const usersById = new Map(usersRaw.map((row) => [clean(row.uid || row.id || row.firestoreDocId), row]).filter(([id]) => id));
  const events = eventsRaw
    .map(normalizeEvent)
    .filter((event) => event.id && matchesCrmScope(event) && event.opportunityId === opportunityId && event.type !== "crm.opportunity.stage_changed")
    .map((event) => {
      const title = eventTitle(event);
      if (!title) return null;
      return {
        id: `event_${event.id}`,
        kind: "event",
        type: event.type,
        title,
        description: eventDescription(event),
        actorName: actorName(usersById, event.actorId),
        occurredAt: event.createdAt,
        payload: event.payload,
      };
    })
    .filter(Boolean);
  const stageItems = historyRaw
    .map(normalizeStageHistory)
    .filter((row) => row.id && matchesCrmScope(row) && row.opportunityId === opportunityId)
    .map((row) => ({
      id: `stage_${row.id}`,
      kind: "stage_history",
      type: "crm.opportunity.stage_changed",
      title: `Movido de ${stageName(stagesById, row.fromStageId) || "sem etapa"} para ${stageName(stagesById, row.toStageId) || "sem etapa"}`,
      description: "",
      actorName: actorName(usersById, row.changedBy),
      occurredAt: row.createdAt,
      payload: { fromStageId: row.fromStageId, toStageId: row.toStageId },
    }));
  const timeline = events.concat(stageItems).sort((left, right) => String(right.occurredAt || "").localeCompare(String(left.occurredAt || "")));
  if (perf) perf.set("numberOfEvents", timeline.length);
  return timeline;
};

const loadOpportunityDetail = async (opportunityId, auth = null, perf = null) => {
  const opportunity = await (perf
    ? perf.measure("opportunityCore", () => loadOpportunityForWrite(opportunityId), { firestore: true })
    : loadOpportunityForWrite(opportunityId));
  if (!opportunity) return { status: 404, body: { error: "opportunity_not_found" } };
  if (auth) {
    const pipeline = await (perf ? perf.measure("pipelineResolution", () => loadPipelineForOpportunity(opportunity), { firestore: true }) : loadPipelineForOpportunity(opportunity));
    if (!commercialPermissions.canAccessPipelineType(auth.user || auth.session, pipeline?.pipelineType)) return { status: 403, body: { error: "commercial_workspace_forbidden" } };
  }
  const [activities, timeline, qualificationDetail, handoffBundle, actions] = await Promise.all([
    loadActivitiesForOpportunity(opportunity.id, perf),
    buildOpportunityTimeline(opportunity.id, perf),
    loadOpportunityQualificationDetail(opportunity),
    loadLatestHandoffBundle(opportunity.id),
    loadQualificationActionsForOpportunity(opportunity.id),
  ]);
  return { status: 200, body: { opportunityId: opportunity.id, activities, timeline, qualification: qualificationDetail, handoff: handoffBundle.latestHandoff, closerReview: handoffBundle.latestReview, actions, generatedAt: nowIso() } };
};

const handleCreateOpportunityViaService = async ({ auth, body }) => {
  try {
    const result = await crmService.createOpportunity({ actorUid: clean(auth.session.sub), input: body, user: auth.user || auth.session });
    return { status: 201, body: { ok: true, opportunityId: result.opportunityId } };
  } catch (error) {
    return { status: error.status || 500, body: { error: error.message || "crm_create_failed" } };
  }
};

const handleMoveOpportunity = async ({ auth, body }) => {
  const id = clean(body.id || body.opportunityId);
  const toStageId = clean(body.stageId || body.toStageId);
  if (!id || !toStageId) return { status: 400, body: { error: "missing_params" } };
  let opportunity;
  try {
    opportunity = normalizeOpportunity(await getDocumentAsAdmin(`${COLLECTIONS.opportunities}/${encodeURIComponent(id)}`));
  } catch (error) {
    return { status: error.status === 404 ? 404 : 500, body: { error: "opportunity_not_found" } };
  }
  if (!matchesCrmScope(opportunity)) return { status: 404, body: { error: "opportunity_not_found" } };
  const currentPipelineForGuard = await loadPipelineForOpportunity(opportunity);
  const initialGuard = await crmActionGuard({ auth, action: "move_opportunity", opportunity, pipelineType: currentPipelineForGuard?.pipelineType });
  if (initialGuard) return initialGuard;
  const stages = (await listCollectionAsAdmin(COLLECTIONS.stages, { maxPages: 10 }).catch(() => [])).map(normalizeStage).filter(matchesCrmScope);
  const pipelines = (await listCollectionAsAdmin(COLLECTIONS.pipelines, { maxPages: 10 }).catch(() => [])).map(normalizePipeline).filter(matchesCrmScope);
  const targetStage = stages.find((stage) => stage.id === toStageId);
  const targetPipeline = pipelines.find((pipeline) => pipeline.id === opportunity.pipelineId);
  if (!targetPipeline?.isActive) return { status: 400, body: { error: "invalid_pipeline" } };
  if (!targetStage || targetStage.pipelineId !== opportunity.pipelineId) return { status: 400, body: { error: "invalid_stage" } };
  if (opportunity.stageId === toStageId) return { status: 200, body: { ok: true, unchanged: true } };
  const blocked = await stageGateFailure({ opportunity, toStageId, stages });
  if (blocked) return blocked;

  const stamp = nowIso();
  const historyId = newId("stagehist");
  const updated = { ...opportunity, stageId: toStageId, updatedAt: stamp };
  const writes = [
    buildWrite(COLLECTIONS.opportunities, opportunity.id, updated),
    buildWrite(COLLECTIONS.stageHistory, historyId, {
      id: historyId,
      scopeId: CRM_SCOPE_ID,
      opportunityId: opportunity.id,
      fromStageId: opportunity.stageId || null,
      toStageId,
      changedBy: clean(auth.session.sub) || null,
      createdAt: stamp,
    }),
    eventWrite({
      type: "crm.opportunity.stage_changed",
      opportunityId: opportunity.id,
      contactId: opportunity.contactId,
      actorId: clean(auth.session.sub),
      payload: { fromStageId: opportunity.stageId || null, toStageId, fromPipelineId: opportunity.pipelineId || null, toPipelineId: opportunity.pipelineId || null },
      stamp,
    }),
  ];
  const committed = await commitWritesAsAdmin({ writes });
  if (!committed.ok) return { status: committed.status || 500, body: { error: "crm_stage_change_failed" } };
  await runWorkflowStageSideEffects({ opportunity: updated, fromStageId: opportunity.stageId || null, toStageId, actor: clean(auth.session.sub) || null, stamp });
  return { status: 200, body: { ok: true } };
};

const handleUpdateOpportunity = async ({ auth, body }) => {
  const id = clean(body.id || body.opportunityId);
  if (!id) return { status: 400, body: { error: "missing_opportunity_id" } };
  let opportunity;
  try {
    opportunity = normalizeOpportunity(await getDocumentAsAdmin(`${COLLECTIONS.opportunities}/${encodeURIComponent(id)}`));
  } catch (error) {
    return { status: error.status === 404 ? 404 : 500, body: { error: "opportunity_not_found" } };
  }
  if (!matchesCrmScope(opportunity)) return { status: 404, body: { error: "opportunity_not_found" } };
  const updateGuard = await crmActionGuard({ auth, action: "update_opportunity", opportunity });
  if (updateGuard) return updateGuard;

  const stamp = nowIso();
  const requestedPipelineId = clean(body.pipelineId) || opportunity.pipelineId;
  const requestedStageId = clean(body.stageId) || opportunity.stageId;
  const stageChanged = requestedStageId && requestedStageId !== opportunity.stageId;
  if (requestedPipelineId !== opportunity.pipelineId || stageChanged) {
    const [stagesRaw, pipelinesRaw] = await Promise.all([
      listCollectionAsAdmin(COLLECTIONS.stages, { maxPages: 10 }).catch(() => []),
      listCollectionAsAdmin(COLLECTIONS.pipelines, { maxPages: 10 }).catch(() => []),
    ]);
    const stages = stagesRaw.map(normalizeStage).filter(matchesCrmScope);
    const pipelines = pipelinesRaw.map(normalizePipeline).filter(matchesCrmScope);
    const targetPipeline = pipelines.find((pipeline) => pipeline.id === requestedPipelineId);
    if (!targetPipeline?.isActive) return { status: 400, body: { error: "invalid_pipeline" } };
    if (!commercialPermissions.canAccessPipelineType(auth.user || auth.session, targetPipeline.pipelineType)) return { status: 403, body: { error: "commercial_workspace_forbidden" } };
    const targetStage = stages.find((stage) => stage.id === requestedStageId);
    if (!targetStage || targetStage.pipelineId !== requestedPipelineId) return { status: 400, body: { error: "invalid_stage" } };
    if (stageChanged && requestedPipelineId === opportunity.pipelineId) {
      const blocked = await stageGateFailure({ opportunity, toStageId: requestedStageId, stages });
      if (blocked) return blocked;
    }
  }
  let contact = null;
  if (opportunity.contactId) {
    try {
      contact = normalizeContact(await getDocumentAsAdmin(`${COLLECTIONS.contacts}/${encodeURIComponent(opportunity.contactId)}`));
    } catch {
      contact = null;
    }
  }
  const nextContact = contact
    ? {
        ...contact,
        name: clean(body.name || body.contactName) || contact.name,
        phone: clean(body.phone),
        email: clean(body.email),
        countryCode: normalizeCountryCode(body.countryCode || body.country),
        updatedAt: stamp,
      }
    : null;
  if (nextContact) Object.assign(nextContact, contactSearchFields(nextContact));
  const usersRawForTimeline = (clean(body.ownerId) !== clean(opportunity.ownerId)) ? await listCollectionAsAdmin(COLLECTIONS.users, { maxPages: 20, decorate: false }).catch(() => []) : [];
  const usersByIdForTimeline = new Map(usersRawForTimeline.map((row) => [clean(row.uid || row.id || row.firestoreDocId), row]).filter(([id]) => id));
  const timelineUserName = (id) => actorName(usersByIdForTimeline, id);
  const next = {
    ...opportunity,
    title: clean(body.title) || clean(body.name || body.contactName) || opportunity.title,
    value: numberOrNull(body.value),
    currency: normalizeCurrency(body.currency),
    ownerId: clean(body.ownerId) || null,
    source: clean(body.source) || null,
    expectedCloseDate: normalizeDateOnly(body.expectedCloseDate),
    pipelineId: requestedPipelineId,
    stageId: requestedStageId,
    updatedAt: stamp,
  };
  Object.assign(next, opportunitySearchFields(next));
  const writes = [buildWrite(COLLECTIONS.opportunities, next.id, next)];
  if (nextContact) writes.push(buildWrite(COLLECTIONS.contacts, nextContact.id, nextContact));
  if (stageChanged) {
    const historyId = newId("stagehist");
    writes.push(buildWrite(COLLECTIONS.stageHistory, historyId, {
      id: historyId,
      scopeId: CRM_SCOPE_ID,
      opportunityId: next.id,
      fromStageId: opportunity.stageId || null,
      toStageId: requestedStageId,
      changedBy: clean(auth.session.sub) || null,
      createdAt: stamp,
    }));
    writes.push(eventWrite({
      type: "crm.opportunity.stage_changed",
      opportunityId: next.id,
      contactId: next.contactId,
      actorId: clean(auth.session.sub),
      payload: { fromStageId: opportunity.stageId || null, toStageId: requestedStageId, fromPipelineId: opportunity.pipelineId || null, toPipelineId: requestedPipelineId },
      stamp,
    }));
  }
  if (clean(next.ownerId) !== clean(opportunity.ownerId)) {
    writes.push(eventWrite({
      type: "crm.opportunity.owner_changed",
      opportunityId: next.id,
      contactId: next.contactId,
      actorId: clean(auth.session.sub),
      payload: {
        fromOwnerId: opportunity.ownerId || null,
        toOwnerId: next.ownerId || null,
        fromOwnerName: timelineUserName(opportunity.ownerId),
        toOwnerName: timelineUserName(next.ownerId),
      },
      stamp,
    }));
  }
  if (Number(next.value || 0) !== Number(opportunity.value || 0)) {
    writes.push(eventWrite({
      type: "crm.opportunity.value_changed",
      opportunityId: next.id,
      contactId: next.contactId,
      actorId: clean(auth.session.sub),
      payload: { fromValue: opportunity.value, toValue: next.value, currency: next.currency },
      stamp,
    }));
  }
  const committed = await commitWritesAsAdmin({ writes });
  if (!committed.ok) return { status: committed.status || 500, body: { error: "crm_update_failed" } };
  return { status: 200, body: { ok: true } };
};

const handleStartQualification = async ({ auth, body }) => {
  const opportunity = await loadOpportunityForWrite(body.id || body.opportunityId);
  if (!opportunity) return { status: 404, body: { error: "opportunity_not_found" } };
  const guard = await crmActionGuard({ auth, action: "start_qualification", opportunity });
  if (guard) return guard;
  const config = await ensurePublishedSdrQualification(clean(auth.session.sub));
  if (!config) return { status: 500, body: { error: "qualification_config_unavailable" } };
  const existing = qualification.latestRun((await loadQualificationRunsForOpportunity(opportunity.id)).filter((run) => run.status === "in_progress"));
  if (existing) return { status: 200, body: { ok: true, runId: existing.id, unchanged: true } };
  const stamp = nowIso();
  const runId = newId("qualrun");
  const actor = clean(auth.session.sub) || null;
  const run = {
    id: runId,
    scopeId: CRM_SCOPE_ID,
    opportunityId: opportunity.id,
    contactId: opportunity.contactId || null,
    templateId: config.template.id,
    versionId: config.version.id,
    status: "in_progress",
    fitScore: 0,
    intentScore: 0,
    totalScore: 0,
    hardGatesPassed: true,
    passed: false,
    startedBy: actor,
    completedBy: null,
    startedAt: stamp,
    completedAt: null,
    thresholdSnapshot: qualification.thresholdSnapshot(config.version),
    versionNumber: config.version.versionNumber,
    createdAt: stamp,
    updatedAt: stamp,
  };
  const updatedOpportunity = {
    ...opportunity,
    latestQualificationRunId: run.id,
    qualificationStatus: "in_progress",
    qualificationScore: 0,
    qualificationFitScore: 0,
    qualificationIntentScore: 0,
    qualificationPassed: false,
    updatedAt: stamp,
  };
  const committed = await commitWritesAsAdmin({ writes: [
    buildWrite(COLLECTIONS.qualificationRuns, run.id, run, { createOnly: true }),
    buildWrite(COLLECTIONS.opportunities, opportunity.id, updatedOpportunity),
    eventWrite({
      type: "crm.qualification.started",
      opportunityId: opportunity.id,
      contactId: opportunity.contactId,
      actorId: actor,
      payload: { runId: run.id, templateId: config.template.id, versionId: config.version.id, versionNumber: config.version.versionNumber },
      stamp,
    }),
  ] });
  if (!committed.ok) return { status: committed.status || 500, body: { error: "qualification_start_failed" } };
  return { status: 201, body: { ok: true, runId: run.id } };
};

const handleCompleteQualification = async ({ auth, body }) => {
  const opportunity = await loadOpportunityForWrite(body.id || body.opportunityId);
  if (!opportunity) return { status: 404, body: { error: "opportunity_not_found" } };
  const guard = await crmActionGuard({ auth, action: "complete_qualification", opportunity });
  if (guard) return guard;
  const runs = await loadQualificationRunsForOpportunity(opportunity.id);
  const requestedRunId = clean(body.runId);
  const currentRun = (requestedRunId ? runs.find((run) => run.id === requestedRunId && run.status === "in_progress") : null)
    || qualification.latestRun(runs.filter((run) => run.status === "in_progress"));
  const config = (currentRun?.versionId ? await loadQualificationConfigByVersion(currentRun.versionId) : null)
    || await ensurePublishedSdrQualification(clean(auth.session.sub));
  if (!config) return { status: 500, body: { error: "qualification_config_unavailable" } };
  const submittedAnswers = Array.isArray(body.answers) ? body.answers : [];
  const score = qualification.scoreQualification({
    version: config.version,
    questions: config.questions,
    options: config.options,
    answers: submittedAnswers,
  });
  if (!score.questionnaireComplete) {
    return { status: 400, body: { error: "qualification_incomplete", missingQuestionIds: score.missingQuestionIds } };
  }
  const stamp = nowIso();
  const actor = clean(auth.session.sub) || null;
  const runId = currentRun?.id || newId("qualrun");
  const baseRun = currentRun || {
    id: runId,
    scopeId: CRM_SCOPE_ID,
    opportunityId: opportunity.id,
    contactId: opportunity.contactId || null,
    templateId: config.template.id,
    versionId: config.version.id,
    startedBy: actor,
    startedAt: stamp,
    createdAt: stamp,
  };
  const completedRun = {
    ...baseRun,
    scopeId: CRM_SCOPE_ID,
    opportunityId: opportunity.id,
    contactId: opportunity.contactId || null,
    templateId: config.template.id,
    versionId: config.version.id,
    status: score.status,
    fitScore: score.fitScore,
    intentScore: score.intentScore,
    totalScore: score.totalScore,
    hardGatesPassed: score.hardGatesPassed,
    passed: score.passed,
    completedBy: actor,
    completedAt: stamp,
    thresholdSnapshot: score.thresholdSnapshot,
    versionNumber: config.version.versionNumber,
    updatedAt: stamp,
  };
  const answerWrites = score.answerRows.map((answer) => {
    const id = `${runId}_${answer.questionId}`;
    return buildWrite(COLLECTIONS.qualificationAnswers, id, {
      id,
      scopeId: CRM_SCOPE_ID,
      runId,
      opportunityId: opportunity.id,
      ...answer,
      createdAt: stamp,
    });
  });
  const updatedOpportunity = {
    ...opportunity,
    latestQualificationRunId: runId,
    qualificationStatus: completedRun.status,
    qualificationScore: completedRun.totalScore,
    qualificationFitScore: completedRun.fitScore,
    qualificationIntentScore: completedRun.intentScore,
    qualificationPassed: completedRun.passed,
    updatedAt: stamp,
  };
  const committed = await commitWritesAsAdmin({ writes: [
    buildWrite(COLLECTIONS.qualificationRuns, runId, completedRun, currentRun ? {} : { createOnly: true }),
    ...answerWrites,
    buildWrite(COLLECTIONS.opportunities, opportunity.id, updatedOpportunity),
    eventWrite({
      type: "crm.qualification.completed",
      opportunityId: opportunity.id,
      contactId: opportunity.contactId,
      actorId: actor,
      payload: {
        runId,
        templateId: config.template.id,
        versionId: config.version.id,
        versionNumber: config.version.versionNumber,
        fitScore: score.fitScore,
        intentScore: score.intentScore,
        totalScore: score.totalScore,
        passed: score.passed,
        hardGatesPassed: score.hardGatesPassed,
      },
      stamp,
    }),
  ] });
  if (!committed.ok) return { status: committed.status || 500, body: { error: "qualification_complete_failed" } };
  return { status: 200, body: { ok: true, runId, qualification: qualification.qualificationSummaryFromRun(completedRun) } };
};

const handleHandoffOpportunity = async ({ auth, body }) => {
  const opportunity = await loadOpportunityForWrite(body.id || body.opportunityId);
  if (!opportunity) return { status: 404, body: { error: "opportunity_not_found" } };
  const guard = await crmActionGuard({ auth, action: "handoff_opportunity", opportunity });
  if (guard) return guard;
  const runs = await loadQualificationRunsForOpportunity(opportunity.id);
  const passedRun = qualification.latestRun(runs.filter((run) => run.status === "passed" && run.passed === true));
  if (!passedRun) return { status: 409, body: { error: "qualification_required" } };
  const existingForRun = (await loadSalesHandoffsForOpportunity(opportunity.id)).find((row) => row.qualificationRunId === passedRun.id);
  if (existingForRun) return { status: 200, body: { ok: true, handoffId: existingForRun.id, unchanged: true } };
  const [stagesRaw, pipelinesRaw] = await Promise.all([
    listCollectionAsAdmin(COLLECTIONS.stages, { maxPages: 20 }).catch(() => []),
    listCollectionAsAdmin(COLLECTIONS.pipelines, { maxPages: 10 }).catch(() => []),
  ]);
  const stages = stagesRaw.map(normalizeStage).filter(matchesCrmScope);
  const pipelines = pipelinesRaw.map(normalizePipeline).filter(matchesCrmScope);
  const fromStage = stages.find((stage) => stage.id === opportunity.stageId);
  if (!fromStage || !qualification.stageRequiresQualification(fromStage)) return { status: 400, body: { error: "handoff_not_configured_for_stage" } };
  const toPipelineId = clean(body.targetPipelineId) || fromStage.handoffTargetPipelineId;
  const toStageId = clean(body.targetStageId) || fromStage.handoffTargetStageId;
  const toPipeline = pipelines.find((pipeline) => pipeline.id === toPipelineId);
  const toStage = stages.find((stage) => stage.id === toStageId);
  if (!toPipeline?.isActive || toPipeline.pipelineType !== "closer") return { status: 400, body: { error: "invalid_handoff_target_pipeline" } };
  if (!toStage || toStage.pipelineId !== toPipeline.id) return { status: 400, body: { error: "invalid_handoff_target_stage" } };

  const answers = await loadQualificationAnswersForRun(passedRun.id);
  const handoffId = handoff.handoffIdForTransition({
    opportunityId: opportunity.id,
    qualificationRunId: passedRun.id,
    toPipelineId: toPipeline.id,
    toStageId: toStage.id,
  });
  const stamp = nowIso();
  const actor = clean(auth.session.sub) || null;
  const closerUserId = clean(body.closerUserId) || clean(opportunity.ownerId) || null;
  const salesHandoff = {
    id: handoffId,
    scopeId: CRM_SCOPE_ID,
    opportunityId: opportunity.id,
    contactId: opportunity.contactId || null,
    qualificationRunId: passedRun.id,
    qualificationVersionId: passedRun.versionId,
    qualificationVersionNumber: passedRun.versionNumber,
    sdrUserId: passedRun.completedBy || passedRun.startedBy || actor,
    closerUserId,
    fromPipelineId: opportunity.pipelineId,
    fromStageId: opportunity.stageId,
    toPipelineId: toPipeline.id,
    toStageId: toStage.id,
    fitScore: passedRun.fitScore,
    intentScore: passedRun.intentScore,
    totalScore: passedRun.totalScore,
    dimensionScores: dimensionScoresFromAnswers(answers),
    thresholdSnapshot: passedRun.thresholdSnapshot,
    qualifiedAt: passedRun.completedAt,
    handoffAt: stamp,
    status: "pending",
    createdAt: stamp,
    updatedAt: stamp,
  };
  const historyId = newId("stagehist");
  const updatedOpportunity = {
    ...opportunity,
    pipelineId: toPipeline.id,
    stageId: toStage.id,
    ownerId: closerUserId || opportunity.ownerId || null,
    latestHandoffId: salesHandoff.id,
    closerReviewStatus: "pending",
    updatedAt: stamp,
  };
  const writes = [
    buildWrite(COLLECTIONS.salesHandoffs, salesHandoff.id, salesHandoff, { createOnly: true }),
    buildWrite(COLLECTIONS.opportunities, opportunity.id, updatedOpportunity),
    buildWrite(COLLECTIONS.stageHistory, historyId, {
      id: historyId,
      scopeId: CRM_SCOPE_ID,
      opportunityId: opportunity.id,
      fromStageId: opportunity.stageId || null,
      toStageId: toStage.id,
      changedBy: actor,
      createdAt: stamp,
    }),
    eventWrite({
      type: "crm.handoff.created",
      opportunityId: opportunity.id,
      contactId: opportunity.contactId,
      actorId: actor,
      payload: {
        opportunityId: opportunity.id,
        handoffId: salesHandoff.id,
        qualificationRunId: passedRun.id,
        sdrUserId: salesHandoff.sdrUserId,
        closerUserId,
        fromPipelineId: opportunity.pipelineId,
        fromStageId: opportunity.stageId,
        toPipelineId: toPipeline.id,
        toStageId: toStage.id,
        fitScore: passedRun.fitScore,
        intentScore: passedRun.intentScore,
        totalScore: passedRun.totalScore,
      },
      stamp,
    }),
    eventWrite({
      type: "crm.opportunity.stage_changed",
      opportunityId: opportunity.id,
      contactId: opportunity.contactId,
      actorId: actor,
      payload: { fromStageId: opportunity.stageId || null, toStageId: toStage.id, fromPipelineId: opportunity.pipelineId || null, toPipelineId: toPipeline.id || null },
      stamp,
    }),
  ];
  const committed = await commitWritesAsAdmin({ writes });
  if (!committed.ok) return { status: committed.status || 500, body: { error: "handoff_failed" } };
  return { status: 201, body: { ok: true, handoffId: salesHandoff.id } };
};

const handleSetMeetingOutcome = async ({ auth, body }) => {
  const opportunity = await loadOpportunityForWrite(body.id || body.opportunityId);
  if (!opportunity) return { status: 404, body: { error: "opportunity_not_found" } };
  const guard = await crmActionGuard({ auth, action: "set_meeting_outcome", opportunity });
  if (guard) return guard;
  const outcome = clean(body.meetingOutcome);
  if (!handoff.MEETING_OUTCOMES.has(outcome)) return { status: 400, body: { error: "invalid_meeting_outcome" } };
  const { latestHandoff, latestReview } = await loadLatestHandoffBundle(opportunity.id);
  if (!latestHandoff) return { status: 409, body: { error: "handoff_required" } };
  if (latestReview?.status === "completed") return { status: 409, body: { error: "closer_review_completed_is_readonly" } };
  const stamp = nowIso();
  const actor = clean(auth.session.sub) || null;
  const reviewId = latestReview?.id || newId("closerrev");
  const review = {
    ...(latestReview || {}),
    id: reviewId,
    scopeId: CRM_SCOPE_ID,
    handoffId: latestHandoff.id,
    opportunityId: opportunity.id,
    contactId: opportunity.contactId || null,
    closerUserId: clean(body.closerUserId) || latestHandoff.closerUserId || opportunity.ownerId || actor,
    meetingOutcome: outcome,
    salesAccepted: null,
    rejectReason: null,
    rejectNote: null,
    dimensionValidation: latestReview?.dimensionValidation || {},
    accuracyScore: null,
    accuracyDenominator: 0,
    primaryRecommendedAction: null,
    status: "pending",
    createdAt: latestReview?.createdAt || stamp,
    completedAt: null,
    updatedAt: stamp,
  };
  const writes = [
    buildWrite(COLLECTIONS.closerReviews, review.id, review, latestReview ? {} : { createOnly: true }),
    buildWrite(COLLECTIONS.opportunities, opportunity.id, { ...opportunity, latestHandoffId: latestHandoff.id, closerReviewStatus: outcome === "held" ? "pending" : outcome, updatedAt: stamp }),
  ];
  if (outcome === "no_show") {
    writes.push(eventWrite({
      type: "crm.meeting.no_show",
      opportunityId: opportunity.id,
      contactId: opportunity.contactId,
      actorId: actor,
      payload: { opportunityId: opportunity.id, handoffId: latestHandoff.id, reviewId: review.id, closerUserId: review.closerUserId },
      stamp,
    }));
  }
  const committed = await commitWritesAsAdmin({ writes });
  if (!committed.ok) return { status: committed.status || 500, body: { error: "meeting_outcome_failed" } };
  return { status: 200, body: { ok: true, reviewId: review.id, meetingOutcome: outcome } };
};

const handleCompleteCloserReview = async ({ auth, body }) => {
  const opportunity = await loadOpportunityForWrite(body.id || body.opportunityId);
  if (!opportunity) return { status: 404, body: { error: "opportunity_not_found" } };
  const guard = await crmActionGuard({ auth, action: "complete_closer_review", opportunity });
  if (guard) return guard;
  const { latestHandoff, latestReview } = await loadLatestHandoffBundle(opportunity.id);
  if (!latestHandoff) return { status: 409, body: { error: "handoff_required" } };
  if (!latestReview) return { status: 409, body: { error: "meeting_outcome_required" } };
  try {
    handoff.assertReviewMutable(latestReview);
    handoff.assertReviewCanComplete({
      meetingOutcome: latestReview.meetingOutcome,
      salesAccepted: body.salesAccepted,
      rejectReason: body.rejectReason,
      rejectNote: body.rejectNote,
      dimensionValidation: body.dimensionValidation,
    });
  } catch (error) {
    return { status: error.status || 400, body: { error: error.message } };
  }
  const config = await ensurePublishedSdrQualification(clean(auth.session.sub));
  const weights = handoff.dimensionMaxWeights({ questions: config?.questions || [], options: config?.options || [] });
  const accuracy = handoff.calculateAccuracy({ dimensionValidation: body.dimensionValidation, weights });
  const salesAccepted = body.salesAccepted === true;
  const rejectReason = salesAccepted ? null : clean(body.rejectReason);
  const recommendedAction = handoff.recommendedActionForReview({ salesAccepted, rejectReason });
  const stamp = nowIso();
  const actor = clean(auth.session.sub) || null;
  const completedReview = {
    ...latestReview,
    closerUserId: latestReview.closerUserId || opportunity.ownerId || actor,
    meetingOutcome: "held",
    salesAccepted,
    rejectReason,
    rejectNote: clean(body.rejectNote) || null,
    dimensionValidation: accuracy.dimensionValidation,
    accuracyScore: accuracy.accuracyScore,
    accuracyDenominator: accuracy.accuracyDenominator,
    primaryRecommendedAction: recommendedAction,
    status: "completed",
    completedAt: stamp,
    updatedAt: stamp,
  };
  const nextHandoffStatus = salesAccepted ? "accepted" : "rejected";
  const updatedHandoff = { ...latestHandoff, status: nextHandoffStatus, closerUserId: completedReview.closerUserId, updatedAt: stamp };
  const updatedOpportunity = {
    ...opportunity,
    latestHandoffId: latestHandoff.id,
    closerReviewStatus: "completed",
    salesAccepted,
    qualificationAccuracy: completedReview.accuracyScore,
    closerRejectReason: rejectReason,
    recommendedAction,
    updatedAt: stamp,
  };
  const writes = [
    buildWrite(COLLECTIONS.closerReviews, completedReview.id, completedReview),
    buildWrite(COLLECTIONS.salesHandoffs, latestHandoff.id, updatedHandoff),
    buildWrite(COLLECTIONS.opportunities, opportunity.id, updatedOpportunity),
    eventWrite({
      type: "crm.closer_review.completed",
      opportunityId: opportunity.id,
      contactId: opportunity.contactId,
      actorId: actor,
      payload: {
        opportunityId: opportunity.id,
        handoffId: latestHandoff.id,
        reviewId: completedReview.id,
        salesAccepted,
        rejectReason,
        accuracyScore: completedReview.accuracyScore,
        recommendedAction,
        closerUserId: completedReview.closerUserId,
      },
      stamp,
    }),
    eventWrite({
      type: salesAccepted ? "crm.handoff.accepted" : "crm.handoff.rejected",
      opportunityId: opportunity.id,
      contactId: opportunity.contactId,
      actorId: actor,
      payload: {
        opportunityId: opportunity.id,
        handoffId: latestHandoff.id,
        qualificationRunId: latestHandoff.qualificationRunId,
        sdrUserId: latestHandoff.sdrUserId,
        closerUserId: completedReview.closerUserId,
        fromPipelineId: latestHandoff.fromPipelineId,
        fromStageId: latestHandoff.fromStageId,
        toPipelineId: latestHandoff.toPipelineId,
        toStageId: latestHandoff.toStageId,
        fitScore: latestHandoff.fitScore,
        intentScore: latestHandoff.intentScore,
        totalScore: latestHandoff.totalScore,
      },
      stamp,
    }),
  ];
  const generatedAction = qualificationActions.buildQualificationActionFromReview({
    scopeId: CRM_SCOPE_ID,
    review: completedReview,
    handoff: updatedHandoff,
    opportunity: updatedOpportunity,
    recommendedAction,
    createdBy: actor,
    stamp,
  });
  if (generatedAction) {
    writes.push(
      buildWrite(COLLECTIONS.qualificationActions, generatedAction.id, generatedAction, { createOnly: true }),
      eventWrite({
        type: "crm.qualification_action.created",
        opportunityId: opportunity.id,
        contactId: opportunity.contactId,
        actorId: actor,
        payload: {
          actionId: generatedAction.id,
          actionType: generatedAction.type,
          priority: generatedAction.priority,
          recommendedAction,
          reason: generatedAction.reason,
          assignedTo: generatedAction.assignedTo,
        },
        stamp,
      }),
    );
  }
  const committed = await commitWritesAsAdmin({ writes });
  if (!committed.ok) return { status: committed.status || 500, body: { error: "closer_review_failed" } };
  return { status: 200, body: { ok: true, reviewId: completedReview.id, accuracyScore: completedReview.accuracyScore, recommendedAction, actionId: generatedAction?.id || null } };
};

const handleMarkOpportunityWon = async ({ auth, body }) => {
  const opportunity = await loadOpportunityForWrite(body.id || body.opportunityId);
  if (!opportunity) return { status: 404, body: { error: "opportunity_not_found" } };
  const guard = await crmActionGuard({ auth, action: "mark_opportunity_won", opportunity });
  if (guard) return guard;
  if (opportunity.status === "won") return { status: 409, body: { error: "opportunity_already_won" } };
  if (opportunity.status === "lost") return { status: 409, body: { error: "reopen_before_mark_won" } };
  const closedValue = numberOrNull(body.closedValue ?? body.value ?? opportunity.value);
  if (closedValue == null || closedValue < 0) return { status: 400, body: { error: "invalid_closed_value" } };
  const stamp = nowIso();
  const closedAt = normalizeTimestamp(body.closedAt) || stamp;
  const financeNatureRaw = clean(body.financeReceivableNature || body.financialNature || body.receivableNature);
  const financeNature = ['ACQUISITION_ONE_OFF','RECURRING_FIRST_PAYMENT','RECURRING','NON_RECURRING_OTHER'].includes(financeNatureRaw) ? financeNatureRaw : null;
  const financeContext = { crm_opportunity_id: opportunity.id, customer_id: clean(body.asaasCustomerId || body.customerId) || null, contract_id: clean(body.contractId || body.contratoId) || null, subscription_id: clean(body.subscriptionId || body.asaasSubscriptionId) || null, receivable_nature: financeNature };
  const actor = clean(auth.session.sub) || null;
  const updated = {
    ...opportunity,
    status: "won",
    closedAt,
    closedBy: actor,
    closedValue,
    lostReason: null,
    lostReasonNote: null,
    updatedAt: stamp,
  };
  const writes = [
    buildWrite(COLLECTIONS.opportunities, opportunity.id, updated),
    eventWrite({
      type: "crm.opportunity.won",
      opportunityId: opportunity.id,
      contactId: opportunity.contactId,
      actorId: actor,
      payload: { opportunityId: opportunity.id, previousStatus: opportunity.status, closedValue, closedAt, actor, finance: financeContext },
      stamp,
    }),
  ];
  const committed = await commitWritesAsAdmin({ writes });
  if (!committed.ok) return { status: committed.status || 500, body: { error: "crm_mark_won_failed" } };
  return { status: 200, body: { ok: true, status: "won", closedAt, closedValue, finance: financeContext } };
};

const handleMarkOpportunityLost = async ({ auth, body }) => {
  const opportunity = await loadOpportunityForWrite(body.id || body.opportunityId);
  if (!opportunity) return { status: 404, body: { error: "opportunity_not_found" } };
  const guard = await crmActionGuard({ auth, action: "mark_opportunity_lost", opportunity });
  if (guard) return guard;
  if (opportunity.status === "lost") return { status: 409, body: { error: "opportunity_already_lost" } };
  if (opportunity.status === "won") return { status: 409, body: { error: "reopen_before_mark_lost" } };
  const lostReason = clean(body.lostReason);
  if (!VALID_LOST_REASONS.has(lostReason)) return { status: 400, body: { error: "invalid_lost_reason" } };
  const lostReasonNote = clean(body.lostReasonNote);
  if (lostReason === "other" && !lostReasonNote) return { status: 400, body: { error: "lost_reason_note_required" } };
  const stamp = nowIso();
  const closedAt = normalizeTimestamp(body.closedAt) || stamp;
  const financeNatureRaw = clean(body.financeReceivableNature || body.financialNature || body.receivableNature);
  const financeNature = ['ACQUISITION_ONE_OFF','RECURRING_FIRST_PAYMENT','RECURRING','NON_RECURRING_OTHER'].includes(financeNatureRaw) ? financeNatureRaw : null;
  const financeContext = { crm_opportunity_id: opportunity.id, customer_id: clean(body.asaasCustomerId || body.customerId) || null, contract_id: clean(body.contractId || body.contratoId) || null, subscription_id: clean(body.subscriptionId || body.asaasSubscriptionId) || null, receivable_nature: financeNature };
  const actor = clean(auth.session.sub) || null;
  const updated = {
    ...opportunity,
    status: "lost",
    closedAt,
    closedBy: actor,
    closedValue: null,
    lostReason,
    lostReasonNote: lostReasonNote || null,
    updatedAt: stamp,
  };
  const writes = [
    buildWrite(COLLECTIONS.opportunities, opportunity.id, updated),
    eventWrite({
      type: "crm.opportunity.lost",
      opportunityId: opportunity.id,
      contactId: opportunity.contactId,
      actorId: actor,
      payload: { opportunityId: opportunity.id, previousStatus: opportunity.status, lostReason, lostReasonNote: lostReasonNote || null, closedAt, closedBy: actor, actor },
      stamp,
    }),
    ...(await growthOverviewCacheInvalidationWrites()),
  ];
  const committed = await commitWritesAsAdmin({ writes });
  if (!committed.ok) return { status: committed.status || 500, body: { error: "crm_mark_lost_failed" } };
  return { status: 200, body: { ok: true, status: "lost", closedAt, lostReason } };
};

const handleDiscardOpportunity = async ({ auth, body }) => {
  const opportunity = await loadOpportunityForWrite(body.id || body.opportunityId);
  if (!opportunity) return { status: 404, body: { error: "opportunity_not_found" } };
  const guard = await crmActionGuard({ auth, action: "update_opportunity", opportunity });
  if (guard) return guard;
  if (auth.role !== "admin" && clean(opportunity.ownerId) !== clean(auth.session?.sub)) return { status: 403, body: { error: "opportunity_discard_forbidden" } };
  const discardReason = clean(body.discardReason || body.reason);
  const discardReasonNote = clean(body.discardReasonNote || body.note);
  if (!crmReasons.isValidSdrDiscardReason(discardReason)) return { status: 400, body: { error: "discard_reason_required" } };
  if (discardReason === "other" && !discardReasonNote) return { status: 400, body: { error: "discard_reason_note_required" } };
  const stamp = nowIso();
  const actor = clean(auth.session?.sub) || null;
  const updated = {
    ...opportunity,
    discardedAt: stamp,
    discardedBy: actor,
    discardedReason: discardReason,
    discardedReasonNote: discardReasonNote || null,
    updatedAt: stamp,
  };
  const writes = [
    buildWrite(COLLECTIONS.opportunities, opportunity.id, updated),
    eventWrite({
      type: "crm.opportunity.discarded",
      opportunityId: opportunity.id,
      contactId: opportunity.contactId,
      actorId: actor,
      payload: { opportunityId: opportunity.id, discardReason, discardReasonNote: discardReasonNote || null, discardedBy: actor, discardedAt: stamp },
      stamp,
    }),
    ...(await growthOverviewCacheInvalidationWrites()),
  ];
  const committed = await commitWritesAsAdmin({ writes });
  if (!committed.ok) return { status: committed.status || 500, body: { error: "crm_discard_failed" } };
  return { status: 200, body: { ok: true, opportunityId: opportunity.id, discardedAt: stamp, discardReason } };
};

const handleReopenOpportunity = async ({ auth, body }) => {
  const opportunity = await loadOpportunityForWrite(body.id || body.opportunityId);
  if (!opportunity) return { status: 404, body: { error: "opportunity_not_found" } };
  const guard = await crmActionGuard({ auth, action: "reopen_opportunity", opportunity });
  if (guard) return guard;
  if (opportunity.status === "open") return { status: 409, body: { error: "opportunity_already_open" } };
  const stamp = nowIso();
  const actor = clean(auth.session.sub) || null;
  const previousStatus = opportunity.status;
  const updated = {
    ...opportunity,
    status: "open",
    closedAt: null,
    closedBy: null,
    closedValue: null,
    lostReason: null,
    lostReasonNote: null,
    updatedAt: stamp,
  };
  const writes = [
    buildWrite(COLLECTIONS.opportunities, opportunity.id, updated),
    eventWrite({
      type: "crm.opportunity.reopened",
      opportunityId: opportunity.id,
      contactId: opportunity.contactId,
      actorId: actor,
      payload: { opportunityId: opportunity.id, previousStatus, actor },
      stamp,
    }),
    ...(await growthOverviewCacheInvalidationWrites()),
  ];
  const committed = await commitWritesAsAdmin({ writes });
  if (!committed.ok) return { status: committed.status || 500, body: { error: "crm_reopen_failed" } };
  return { status: 200, body: { ok: true, status: "open" } };
};

const adminConfigEvent = ({ type, actorId, payload, stamp }) => eventWrite({ type, opportunityId: null, contactId: null, actorId, payload, stamp });

const handleCreatePipeline = async ({ session, body }) => {
  const name = clean(body.name);
  if (!name) return { status: 400, body: { error: "pipeline_name_required" } };
  const pipelineType = ["general", "sdr", "closer"].includes(clean(body.pipelineType)) ? clean(body.pipelineType) : "general";
  const rawStages = Array.isArray(body.stages) ? body.stages : [];
  const stageNames = rawStages.map((stage) => clean(typeof stage === "string" ? stage : stage?.name)).filter(Boolean);
  if (!stageNames.length) stageNames.push("Novo lead");
  const duplicateGuard = assertUniqueStageNames(stageNames.map((stageName, index) => ({ id: `draft_${index}`, pipelineId: "draft", name: stageName })), "draft");
  if (duplicateGuard) return duplicateGuard;
  const { pipelines } = await loadCrmStructure();
  const stamp = nowIso();
  const id = newId("pipeline");
  const makeDefault = body.isDefault === true || !pipelines.some((pipeline) => pipeline.isActive && pipeline.isDefault);
  const pipeline = { id, scopeId: CRM_SCOPE_ID, name, pipelineType, isActive: true, isDefault: makeDefault, createdAt: stamp, updatedAt: stamp };
  const stages = stageNames.map((stageName, index) => ({
    id: newId("stage"),
    scopeId: CRM_SCOPE_ID,
    pipelineId: id,
    name: stageName,
    position: index + 1,
    requiresQualification: pipelineType === "sdr" && index === 0,
    requiresQualificationToExit: pipelineType === "sdr" && index === 0,
    qualificationGate: pipelineType === "sdr" && index === 0 ? qualification.QUALIFICATION_TYPE_SDR : null,
    handoffTargetPipelineId: null,
    handoffTargetStageId: null,
    createdAt: stamp,
    updatedAt: stamp,
  }));
  const writes = [
    ...pipelines.map((row) => (makeDefault ? buildWrite(COLLECTIONS.pipelines, row.id, { ...row, isDefault: false, updatedAt: stamp }) : null)).filter(Boolean),
    buildWrite(COLLECTIONS.pipelines, id, pipeline, { createOnly: true }),
    ...stages.map((stage) => buildWrite(COLLECTIONS.stages, stage.id, stage, { createOnly: true })),
    adminConfigEvent({ type: "crm.pipeline.created", actorId: clean(session.sub), payload: { pipelineId: id, stageCount: stages.length, isDefault: makeDefault, pipelineType }, stamp }),
  ];
  const committed = await commitWritesAsAdmin({ writes });
  if (!committed.ok) return { status: committed.status || 500, body: { error: "crm_pipeline_create_failed" } };
  return { status: 201, body: { ok: true, pipelineId: id } };
};

const handleUpdatePipeline = async ({ session, body }) => {
  const id = clean(body.id || body.pipelineId);
  const name = clean(body.name);
  if (!id || !name) return { status: 400, body: { error: "missing_params" } };
  const { pipelines } = await loadCrmStructure();
  const pipeline = pipelines.find((row) => row.id === id);
  if (!pipeline) return { status: 404, body: { error: "pipeline_not_found" } };
  const stamp = nowIso();
  const makeDefault = body.isDefault === true;
  const pipelineType = ["general", "sdr", "closer"].includes(clean(body.pipelineType)) ? clean(body.pipelineType) : pipeline.pipelineType;
  if (makeDefault && pipeline.isActive === false) return { status: 400, body: { error: "inactive_default_pipeline" } };
  const writes = [
    ...pipelines.map((row) => (makeDefault && row.id !== id ? buildWrite(COLLECTIONS.pipelines, row.id, { ...row, isDefault: false, updatedAt: stamp }) : null)).filter(Boolean),
    buildWrite(COLLECTIONS.pipelines, id, { ...pipeline, name, pipelineType, isDefault: makeDefault ? true : pipeline.isDefault, updatedAt: stamp }),
    adminConfigEvent({ type: "crm.pipeline.updated", actorId: clean(session.sub), payload: { pipelineId: id, isDefault: makeDefault ? true : pipeline.isDefault, pipelineType }, stamp }),
  ];
  const committed = await commitWritesAsAdmin({ writes });
  if (!committed.ok) return { status: committed.status || 500, body: { error: "crm_pipeline_update_failed" } };
  return { status: 200, body: { ok: true } };
};

const handleSetDefaultPipeline = async ({ session, body }) => {
  const id = clean(body.id || body.pipelineId);
  const { pipelines } = await loadCrmStructure();
  const pipeline = pipelines.find((row) => row.id === id);
  if (!pipeline) return { status: 404, body: { error: "pipeline_not_found" } };
  if (!pipeline.isActive) return { status: 400, body: { error: "inactive_default_pipeline" } };
  const stamp = nowIso();
  const writes = pipelines.map((row) => buildWrite(COLLECTIONS.pipelines, row.id, { ...row, isDefault: row.id === id, updatedAt: stamp }));
  writes.push(adminConfigEvent({ type: "crm.pipeline.updated", actorId: clean(session.sub), payload: { pipelineId: id, isDefault: true }, stamp }));
  const committed = await commitWritesAsAdmin({ writes });
  if (!committed.ok) return { status: committed.status || 500, body: { error: "crm_pipeline_default_failed" } };
  return { status: 200, body: { ok: true } };
};

const handleDeactivatePipeline = async ({ session, body }) => {
  const id = clean(body.id || body.pipelineId);
  const { pipelines, opportunities } = await loadCrmStructure();
  const pipeline = pipelines.find((row) => row.id === id);
  if (!pipeline) return { status: 404, body: { error: "pipeline_not_found" } };
  const activePipelines = pipelines.filter((row) => row.isActive);
  if (pipeline.isDefault) return { status: 409, body: { error: "default_pipeline_cannot_deactivate" } };
  if (activePipelines.length <= 1) return { status: 409, body: { error: "last_active_pipeline" } };
  const openCount = pipelineOpenOpportunityCount(opportunities, id);
  if (openCount) return { status: 409, body: { error: "pipeline_has_open_opportunities", openCount } };
  const stamp = nowIso();
  const committed = await commitWritesAsAdmin({ writes: [
    buildWrite(COLLECTIONS.pipelines, id, { ...pipeline, isActive: false, isDefault: false, updatedAt: stamp }),
    adminConfigEvent({ type: "crm.pipeline.deactivated", actorId: clean(session.sub), payload: { pipelineId: id }, stamp }),
  ] });
  if (!committed.ok) return { status: committed.status || 500, body: { error: "crm_pipeline_deactivate_failed" } };
  return { status: 200, body: { ok: true } };
};

const handleReactivatePipeline = async ({ session, body }) => {
  const id = clean(body.id || body.pipelineId);
  const { pipelines } = await loadCrmStructure();
  const pipeline = pipelines.find((row) => row.id === id);
  if (!pipeline) return { status: 404, body: { error: "pipeline_not_found" } };
  const stamp = nowIso();
  const makeDefault = !pipelines.some((row) => row.isActive && row.isDefault);
  const writes = [
    buildWrite(COLLECTIONS.pipelines, id, { ...pipeline, isActive: true, isDefault: makeDefault ? true : pipeline.isDefault, updatedAt: stamp }),
    adminConfigEvent({ type: "crm.pipeline.reactivated", actorId: clean(session.sub), payload: { pipelineId: id, isDefault: makeDefault }, stamp }),
  ];
  const committed = await commitWritesAsAdmin({ writes });
  if (!committed.ok) return { status: committed.status || 500, body: { error: "crm_pipeline_reactivate_failed" } };
  return { status: 200, body: { ok: true } };
};

const CRM_QUALIFICATION_DIMENSIONS = new Set(["need_fit", "economic_readiness", "decision_readiness", "pain", "impact", "urgency", "commitment"]);

const cleanQualificationQuestionsPayload = (questions = []) => {
  const rows = Array.isArray(questions) ? questions : [];
  return rows.map((question, questionIndex) => {
    const title = clean(question.title);
    const dimension = CRM_QUALIFICATION_DIMENSIONS.has(clean(question.dimension)) ? clean(question.dimension) : "need_fit";
    const options = (Array.isArray(question.options) ? question.options : []).map((option, optionIndex) => ({
      label: clean(option.label),
      points: Number.isFinite(Number(option.points)) ? Number(option.points) : 0,
      hardFail: option.hardFail === true,
      position: optionIndex + 1,
    }));
    return {
      title,
      dimension,
      isHardGate: question.isHardGate === true,
      required: question.required !== false,
      position: questionIndex + 1,
      options,
    };
  });
};

const qualificationDraftSourceVersion = (rows, templateId, sourceVersionId = "") => {
  const templateVersions = rows.versions.filter((version) => version.templateId === templateId);
  return templateVersions.find((version) => version.id === clean(sourceVersionId))
    || templateVersions.find((version) => version.status === "published")
    || templateVersions.sort((left, right) => Number(right.versionNumber || 0) - Number(left.versionNumber || 0))[0]
    || null;
};

const cloneQualificationVersionWrites = ({ rows, sourceVersion, draftVersion, stamp }) => {
  const sourceQuestions = rows.questions
    .filter((question) => question.versionId === sourceVersion.id)
    .sort((left, right) => Number(left.position || 0) - Number(right.position || 0));
  const sourceQuestionIds = new Set(sourceQuestions.map((question) => question.id));
  const sourceOptions = rows.options
    .filter((option) => sourceQuestionIds.has(option.questionId))
    .sort((left, right) => Number(left.position || 0) - Number(right.position || 0));
  const nextQuestions = sourceQuestions.map((question) => ({
    ...question,
    id: newId("qualq"),
    versionId: draftVersion.id,
    createdAt: stamp,
  }));
  const nextQuestionBySourceId = new Map(sourceQuestions.map((question, index) => [question.id, nextQuestions[index]]));
  const nextOptions = sourceOptions.map((option) => ({
    ...option,
    id: newId("qualopt"),
    questionId: nextQuestionBySourceId.get(option.questionId)?.id || "",
  })).filter((option) => option.questionId);
  return [
    ...nextQuestions.map((question) => buildWrite(COLLECTIONS.qualificationQuestions, question.id, question, { createOnly: true })),
    ...nextOptions.map((option) => buildWrite(COLLECTIONS.qualificationOptions, option.id, option, { createOnly: true })),
  ];
};

const handleSaveQualificationFilter = async ({ session, body }) => {
  const stamp = nowIso();
  const actor = clean(session.sub) || null;
  const rows = await loadQualificationConfigRows();
  const templateId = clean(body.templateId) || clean(body.id) || "qual_tpl_sdr";
  const existingTemplate = rows.templates.find((template) => template.id === templateId) || null;
  const template = {
    ...(existingTemplate || {}),
    id: existingTemplate?.id || templateId,
    scopeId: CRM_SCOPE_ID,
    name: clean(body.name) || existingTemplate?.name || "Filtro SDR",
    type: qualification.QUALIFICATION_TYPE_SDR,
    isActive: true,
    createdAt: existingTemplate?.createdAt || stamp,
    updatedAt: stamp,
  };
  const sourceVersionId = clean(body.versionId);
  const sourceVersion = rows.versions.find((version) => version.id === sourceVersionId && version.templateId === template.id) || null;
  const existingDraft = sourceVersion?.status === "draft"
    ? sourceVersion
    : rows.versions
      .filter((version) => version.templateId === template.id && version.status === "draft")
      .sort((left, right) => Number(right.versionNumber || 0) - Number(left.versionNumber || 0))[0] || null;
  const maxVersionNumber = rows.versions
    .filter((version) => version.templateId === template.id)
    .reduce((max, version) => Math.max(max, Number(version.versionNumber || 0)), 0);
  const version = {
    ...(existingDraft || {}),
    id: existingDraft?.id || newId("qualver"),
    scopeId: CRM_SCOPE_ID,
    templateId: template.id,
    versionNumber: existingDraft?.versionNumber || maxVersionNumber + 1 || 1,
    status: "draft",
    totalThreshold: Number(body.totalThreshold) || qualification.DEFAULT_THRESHOLDS.totalThreshold,
    minimumFitScore: Number(body.minimumFitScore) || qualification.DEFAULT_THRESHOLDS.minimumFitScore,
    minimumIntentScore: Number(body.minimumIntentScore) || qualification.DEFAULT_THRESHOLDS.minimumIntentScore,
    createdAt: existingDraft?.createdAt || stamp,
    publishedAt: null,
    createdBy: existingDraft?.createdBy || actor,
  };
  const questions = cleanQualificationQuestionsPayload(body.questions);
  const existingQuestions = rows.questions.filter((question) => question.versionId === version.id);
  const existingQuestionIds = new Set(existingQuestions.map((question) => question.id));
  const existingOptions = rows.options.filter((option) => existingQuestionIds.has(option.questionId));
  const nextQuestions = questions.map((questionRow) => ({
    id: newId("qualq"),
    scopeId: CRM_SCOPE_ID,
    versionId: version.id,
    title: questionRow.title,
    dimension: questionRow.dimension,
    position: questionRow.position,
    required: questionRow.required,
    isHardGate: questionRow.isHardGate,
    createdAt: stamp,
  }));
  const nextOptions = questions.flatMap((questionRow, questionIndex) =>
    questionRow.options.map((optionRow) => ({
      id: newId("qualopt"),
      scopeId: CRM_SCOPE_ID,
      questionId: nextQuestions[questionIndex].id,
      label: optionRow.label,
      points: optionRow.points,
      position: optionRow.position,
      hardFail: optionRow.hardFail,
    })),
  );
  const writes = [
    buildWrite(COLLECTIONS.qualificationTemplates, template.id, template),
    buildWrite(COLLECTIONS.qualificationVersions, version.id, version),
    ...existingOptions.map((option) => deleteWrite(COLLECTIONS.qualificationOptions, option.id)),
    ...existingQuestions.map((question) => deleteWrite(COLLECTIONS.qualificationQuestions, question.id)),
    ...nextQuestions.map((questionRow) => buildWrite(COLLECTIONS.qualificationQuestions, questionRow.id, questionRow, { createOnly: true })),
    ...nextOptions.map((optionRow) => buildWrite(COLLECTIONS.qualificationOptions, optionRow.id, optionRow, { createOnly: true })),
    ...(existingDraft ? [] : [adminConfigEvent({ type: "qualification_version_created", actorId: actor, payload: { templateId: template.id, versionId: version.id, versionNumber: version.versionNumber }, stamp })]),
  ];
  const committed = await commitWritesAsAdmin({ writes });
  if (!committed.ok) return { status: committed.status || 500, body: { error: "qualification_filter_save_failed" } };
  return { status: 200, body: { ok: true, templateId: template.id, versionId: version.id, model: await loadQualificationAdminModel(actor) } };
};

const handleCreateQualificationTemplate = async ({ session, body }) => {
  const name = clean(body.name);
  if (!name) return { status: 400, body: { error: "qualification_template_name_required" } };
  const type = clean(body.type) || qualification.QUALIFICATION_TYPE_SDR;
  if (type !== qualification.QUALIFICATION_TYPE_SDR) return { status: 400, body: { error: "unsupported_qualification_type" } };
  const stamp = nowIso();
  const actor = clean(session.sub) || null;
  const template = {
    id: newId("qualtpl"),
    scopeId: CRM_SCOPE_ID,
    name,
    type,
    isActive: true,
    createdAt: stamp,
    updatedAt: stamp,
  };
  const version = {
    id: newId("qualver"),
    scopeId: CRM_SCOPE_ID,
    templateId: template.id,
    versionNumber: 1,
    status: "draft",
    ...qualification.DEFAULT_THRESHOLDS,
    createdAt: stamp,
    publishedAt: null,
    createdBy: actor,
  };
  const writes = [
    buildWrite(COLLECTIONS.qualificationTemplates, template.id, template, { createOnly: true }),
    buildWrite(COLLECTIONS.qualificationVersions, version.id, version, { createOnly: true }),
    adminConfigEvent({ type: "qualification_version_created", actorId: actor, payload: { templateId: template.id, versionId: version.id, versionNumber: 1 }, stamp }),
  ];
  const committed = await commitWritesAsAdmin({ writes });
  if (!committed.ok) return { status: committed.status || 500, body: { error: "qualification_template_create_failed" } };
  return { status: 201, body: { ok: true, templateId: template.id, versionId: version.id, model: await loadQualificationAdminModel(actor) } };
};

const handleCreateQualificationDraft = async ({ session, body }) => {
  const stamp = nowIso();
  const actor = clean(session.sub) || null;
  const rows = await loadQualificationConfigRows();
  const templateId = clean(body.templateId);
  const template = rows.templates.find((row) => row.id === templateId && row.type === qualification.QUALIFICATION_TYPE_SDR);
  if (!template) return { status: 404, body: { error: "qualification_template_not_found" } };
  const existingDraft = rows.versions.find((version) => version.templateId === template.id && version.status === "draft");
  if (existingDraft) return { status: 200, body: { ok: true, templateId: template.id, versionId: existingDraft.id, model: await loadQualificationAdminModel(actor) } };
  const sourceVersion = qualificationDraftSourceVersion(rows, template.id, body.versionId);
  if (!sourceVersion) return { status: 409, body: { error: "qualification_source_version_required" } };
  const maxVersionNumber = rows.versions
    .filter((version) => version.templateId === template.id)
    .reduce((max, version) => Math.max(max, Number(version.versionNumber || 0)), 0);
  const draftVersion = {
    ...sourceVersion,
    id: newId("qualver"),
    status: "draft",
    versionNumber: maxVersionNumber + 1,
    createdAt: stamp,
    publishedAt: null,
    createdBy: actor,
  };
  const writes = [
    buildWrite(COLLECTIONS.qualificationVersions, draftVersion.id, draftVersion, { createOnly: true }),
    ...cloneQualificationVersionWrites({ rows, sourceVersion, draftVersion, stamp }),
    buildWrite(COLLECTIONS.qualificationTemplates, template.id, { ...template, updatedAt: stamp }),
    adminConfigEvent({ type: "qualification_version_created", actorId: actor, payload: { templateId: template.id, sourceVersionId: sourceVersion.id, versionId: draftVersion.id, versionNumber: draftVersion.versionNumber }, stamp }),
  ];
  const committed = await commitWritesAsAdmin({ writes });
  if (!committed.ok) return { status: committed.status || 500, body: { error: "qualification_draft_create_failed" } };
  return { status: 201, body: { ok: true, templateId: template.id, versionId: draftVersion.id, model: await loadQualificationAdminModel(actor) } };
};

const handleDeleteQualificationDraft = async ({ session, body }) => {
  const stamp = nowIso();
  const actor = clean(session.sub) || null;
  const rows = await loadQualificationConfigRows();
  const versionId = clean(body.versionId);
  const version = rows.versions.find((row) => row.id === versionId);
  if (!version) return { status: 404, body: { error: "qualification_version_not_found" } };
  if (version.status !== "draft") return { status: 409, body: { error: "only_draft_can_be_deleted" } };
  const runsRaw = await listCollectionAsAdmin(COLLECTIONS.qualificationRuns, { maxPages: 50 }).catch(() => []);
  const hasRuns = normalizeQualificationRows(runsRaw, qualification.normalizeRun).some((run) => run.versionId === version.id);
  if (hasRuns) return { status: 409, body: { error: "qualification_version_has_runs" } };
  const questions = rows.questions.filter((question) => question.versionId === version.id);
  const questionIds = new Set(questions.map((question) => question.id));
  const options = rows.options.filter((option) => questionIds.has(option.questionId));
  const writes = [
    ...options.map((option) => deleteWrite(COLLECTIONS.qualificationOptions, option.id)),
    ...questions.map((question) => deleteWrite(COLLECTIONS.qualificationQuestions, question.id)),
    deleteWrite(COLLECTIONS.qualificationVersions, version.id),
    adminConfigEvent({ type: "qualification_draft_deleted", actorId: actor, payload: { templateId: version.templateId, versionId: version.id, versionNumber: version.versionNumber }, stamp }),
  ];
  const committed = await commitWritesAsAdmin({ writes });
  if (!committed.ok) return { status: committed.status || 500, body: { error: "qualification_draft_delete_failed" } };
  return { status: 200, body: { ok: true, model: await loadQualificationAdminModel(actor) } };
};

const handlePublishQualificationFilter = async ({ session, body }) => {
  const stamp = nowIso();
  const actor = clean(session.sub) || null;
  const rows = await loadQualificationConfigRows();
  const versionId = clean(body.versionId);
  const version = rows.versions.find((row) => row.id === versionId);
  if (!version) return { status: 404, body: { error: "qualification_version_not_found" } };
  if (version.status === "published") return { status: 200, body: { ok: true, versionId, unchanged: true, model: await loadQualificationAdminModel(actor) } };
  const questions = rows.questions.filter((question) => question.versionId === version.id);
  const questionIds = new Set(questions.map((question) => question.id));
  const options = rows.options.filter((option) => questionIds.has(option.questionId));
  const validation = validateQualificationVersionForPublish({ version, questions, options });
  if (!validation.ok) return { status: 400, body: { error: "qualification_version_invalid", validationErrors: validation.errors, scoreMax: validation.scoreMax } };
  const previousPublished = rows.versions.filter((row) => row.templateId === version.templateId && row.status === "published" && row.id !== version.id);
  const writes = [
    ...previousPublished.map((row) => buildWrite(COLLECTIONS.qualificationVersions, row.id, { ...row, status: "archived" })),
    buildWrite(COLLECTIONS.qualificationVersions, version.id, { ...version, status: "published", publishedAt: stamp }),
    adminConfigEvent({ type: "qualification_version_published", actorId: actor, payload: { templateId: version.templateId, versionId: version.id, versionNumber: version.versionNumber, scoreMax: validation.scoreMax }, stamp }),
  ];
  const committed = await commitWritesAsAdmin({ writes });
  if (!committed.ok) return { status: committed.status || 500, body: { error: "qualification_filter_publish_failed" } };
  return { status: 200, body: { ok: true, versionId: version.id, model: await loadQualificationAdminModel(actor) } };
};

const latestWorkflowVersionNumber = (versions, workflowId) =>
  versions.filter((row) => row.workflowId === workflowId).reduce((max, row) => Math.max(max, Number(row.versionNumber || 0)), 0);

const handleSaveCrmWorkflow = async ({ session, body }) => {
  const stamp = nowIso();
  const actor = clean(session.sub) || null;
  const workflowId = clean(body.id || body.workflowId) || newId("workflow");
  const [workflowRows, structure] = await Promise.all([loadWorkflowConfigRows(), loadCrmStructure()]);
  const existing = workflowRows.workflows.find((row) => row.id === workflowId) || null;
  const workflowDraft = crmWorkflows.workflowDraftFromPayload({ body, existingWorkflow: existing || {}, stamp, actor });
  const draftVersion = workflowRows.versions.find((row) => row.workflowId === workflowId && row.status === "draft") || {
    id: newId("wfver"),
    scopeId: CRM_SCOPE_ID,
    workflowId,
    versionNumber: latestWorkflowVersionNumber(workflowRows.versions, workflowId) + 1,
    status: "draft",
    publishedAt: null,
    createdBy: actor,
    createdAt: stamp,
    updatedAt: stamp,
  };
  const workflow = {
    id: workflowId,
    scopeId: CRM_SCOPE_ID,
    name: workflowDraft.name,
    pipelineId: workflowDraft.pipelineId,
    triggerStageId: workflowDraft.triggerStageId,
    workspaceType: workflowDraft.workspaceType,
    isActive: existing ? existing.isActive : false,
    activeVersionId: existing?.activeVersionId || null,
    version: existing?.version || 0,
    createdBy: existing?.createdBy || actor,
    createdAt: existing?.createdAt || stamp,
    updatedAt: stamp,
  };
  const steps = crmWorkflows.stepsFromPayload({ body, workflowId, versionId: draftVersion.id, stamp, newId, scopeId: CRM_SCOPE_ID });
  const validation = crmWorkflows.validateWorkflowDraft({ workflow, steps, stages: structure.stages, pipelines: structure.pipelines });
  if (!validation.ok) return { status: 400, body: { error: "workflow_invalid", validationErrors: validation.errors } };
  const existingDraftSteps = workflowRows.steps.filter((step) => step.versionId === draftVersion.id);
  const committed = await commitWritesAsAdmin({ writes: [
    buildWrite(COLLECTIONS.workflows, workflow.id, workflow, { createOnly: !existing }),
    buildWrite(COLLECTIONS.workflowVersions, draftVersion.id, { ...draftVersion, updatedAt: stamp }, { createOnly: !workflowRows.versions.some((row) => row.id === draftVersion.id) }),
    ...existingDraftSteps.map((step) => deleteWrite(COLLECTIONS.workflowSteps, step.id)),
    ...steps.map((step) => buildWrite(COLLECTIONS.workflowSteps, step.id, step, { createOnly: true })),
    adminConfigEvent({ type: "crm.workflow.draft_saved", actorId: actor, payload: { workflowId: workflow.id, versionId: draftVersion.id, versionNumber: draftVersion.versionNumber }, stamp }),
  ] });
  if (!committed.ok) return { status: committed.status || 500, body: { error: "crm_workflow_save_failed" } };
  return { status: 200, body: { ok: true, workflowId: workflow.id, versionId: draftVersion.id, model: await loadQualificationAdminModel(actor) } };
};

const handlePublishCrmWorkflow = async ({ session, body }) => {
  const stamp = nowIso();
  const actor = clean(session.sub) || null;
  const versionId = clean(body.versionId);
  const [workflowRows, structure] = await Promise.all([loadWorkflowConfigRows(), loadCrmStructure()]);
  const version = workflowRows.versions.find((row) => row.id === versionId);
  if (!version) return { status: 404, body: { error: "workflow_version_not_found" } };
  const workflow = workflowRows.workflows.find((row) => row.id === version.workflowId);
  if (!workflow) return { status: 404, body: { error: "workflow_not_found" } };
  const steps = workflowRows.steps.filter((step) => step.versionId === version.id).sort((left, right) => left.position - right.position);
  const validation = crmWorkflows.validateWorkflowDraft({ workflow, steps, stages: structure.stages, pipelines: structure.pipelines });
  if (!validation.ok) return { status: 400, body: { error: "workflow_invalid", validationErrors: validation.errors } };
  const previousPublished = workflowRows.versions.filter((row) => row.workflowId === workflow.id && row.status === "published" && row.id !== version.id);
  const committed = await commitWritesAsAdmin({ writes: [
    ...previousPublished.map((row) => buildWrite(COLLECTIONS.workflowVersions, row.id, { ...row, status: "archived", updatedAt: stamp })),
    buildWrite(COLLECTIONS.workflowVersions, version.id, { ...version, status: "published", publishedAt: stamp, updatedAt: stamp }),
    buildWrite(COLLECTIONS.workflows, workflow.id, { ...workflow, isActive: body.isActive === false ? false : true, activeVersionId: version.id, version: version.versionNumber, updatedAt: stamp }),
    adminConfigEvent({ type: "crm.workflow.published", actorId: actor, payload: { workflowId: workflow.id, versionId: version.id, versionNumber: version.versionNumber }, stamp }),
  ] });
  if (!committed.ok) return { status: committed.status || 500, body: { error: "crm_workflow_publish_failed" } };
  return { status: 200, body: { ok: true, workflowId: workflow.id, versionId: version.id, model: await loadQualificationAdminModel(actor) } };
};

const handleToggleCrmWorkflow = async ({ session, body }) => {
  const stamp = nowIso();
  const actor = clean(session.sub) || null;
  const workflowRows = await loadWorkflowConfigRows();
  const workflow = workflowRows.workflows.find((row) => row.id === clean(body.id || body.workflowId));
  if (!workflow) return { status: 404, body: { error: "workflow_not_found" } };
  const isActive = body.isActive === true;
  const committed = await commitWritesAsAdmin({ writes: [
    buildWrite(COLLECTIONS.workflows, workflow.id, { ...workflow, isActive, updatedAt: stamp }),
    adminConfigEvent({ type: isActive ? "crm.workflow.activated" : "crm.workflow.deactivated", actorId: actor, payload: { workflowId: workflow.id }, stamp }),
  ] });
  if (!committed.ok) return { status: committed.status || 500, body: { error: "crm_workflow_toggle_failed" } };
  return { status: 200, body: { ok: true, workflowId: workflow.id, model: await loadQualificationAdminModel(actor) } };
};

const handleCreateStage = async ({ session, body }) => {
  const pipelineId = clean(body.pipelineId);
  const name = clean(body.name);
  if (!pipelineId || !name) return { status: 400, body: { error: "missing_params" } };
  const { pipelines, stages } = await loadCrmStructure();
  const pipeline = pipelines.find((row) => row.id === pipelineId);
  if (!pipeline || !pipeline.isActive) return { status: 404, body: { error: "pipeline_not_found" } };
  const guard = assertUniqueStageNames(stages, pipelineId, { candidateName: name });
  if (guard) return guard;
  const stamp = nowIso();
  const requiresQualification = body.requiresQualification === true || body.requiresQualificationToExit === true;
  const stage = {
    id: newId("stage"),
    scopeId: CRM_SCOPE_ID,
    pipelineId,
    name,
    position: stages.filter((row) => row.pipelineId === pipelineId).length + 1,
    requiresQualification,
    requiresQualificationToExit: requiresQualification,
    qualificationGate: requiresQualification ? qualification.QUALIFICATION_TYPE_SDR : null,
    handoffTargetPipelineId: clean(body.handoffTargetPipelineId) || null,
    handoffTargetStageId: clean(body.handoffTargetStageId) || null,
    createdAt: stamp,
    updatedAt: stamp,
  };
  const committed = await commitWritesAsAdmin({ writes: [
    buildWrite(COLLECTIONS.stages, stage.id, stage, { createOnly: true }),
    adminConfigEvent({ type: "crm.stage.created", actorId: clean(session.sub), payload: { pipelineId, stageId: stage.id }, stamp }),
  ] });
  if (!committed.ok) return { status: committed.status || 500, body: { error: "crm_stage_create_failed" } };
  return { status: 201, body: { ok: true, stageId: stage.id } };
};

const handleUpdateStage = async ({ session, body }) => {
  const id = clean(body.id || body.stageId);
  const name = clean(body.name);
  if (!id || !name) return { status: 400, body: { error: "missing_params" } };
  const { stages } = await loadCrmStructure();
  const stage = stages.find((row) => row.id === id);
  if (!stage) return { status: 404, body: { error: "stage_not_found" } };
  const guard = assertUniqueStageNames(stages, stage.pipelineId, { ignoreStageId: id, candidateName: name });
  if (guard) return guard;
  const stamp = nowIso();
  const requiresQualification = body.requiresQualification === undefined && body.requiresQualificationToExit === undefined
    ? qualification.stageRequiresQualification(stage)
    : body.requiresQualification === true || body.requiresQualificationToExit === true;
  const committed = await commitWritesAsAdmin({ writes: [
    buildWrite(COLLECTIONS.stages, id, {
      ...stage,
      name,
      requiresQualification,
      requiresQualificationToExit: requiresQualification,
      qualificationGate: requiresQualification ? qualification.QUALIFICATION_TYPE_SDR : null,
      handoffTargetPipelineId: body.handoffTargetPipelineId === undefined ? stage.handoffTargetPipelineId : clean(body.handoffTargetPipelineId) || null,
      handoffTargetStageId: body.handoffTargetStageId === undefined ? stage.handoffTargetStageId : clean(body.handoffTargetStageId) || null,
      updatedAt: stamp,
    }),
    adminConfigEvent({ type: "crm.stage.updated", actorId: clean(session.sub), payload: { pipelineId: stage.pipelineId, stageId: id }, stamp }),
  ] });
  if (!committed.ok) return { status: committed.status || 500, body: { error: "crm_stage_update_failed" } };
  return { status: 200, body: { ok: true } };
};

const handleReorderStages = async ({ session, body }) => {
  const pipelineId = clean(body.pipelineId);
  const stageIds = Array.isArray(body.stageIds) ? body.stageIds.map(clean).filter(Boolean) : [];
  if (!pipelineId || !stageIds.length) return { status: 400, body: { error: "missing_params" } };
  const { stages } = await loadCrmStructure();
  const current = stages.filter((row) => row.pipelineId === pipelineId).sort((a, b) => a.position - b.position);
  const currentIds = current.map((stage) => stage.id).sort();
  if (stageIds.length !== current.length || stageIds.slice().sort().join("|") !== currentIds.join("|")) return { status: 400, body: { error: "invalid_stage_order" } };
  const byId = new Map(current.map((stage) => [stage.id, stage]));
  const stamp = nowIso();
  const writes = stageIds.map((stageId, index) => buildWrite(COLLECTIONS.stages, stageId, { ...byId.get(stageId), position: index + 1, updatedAt: stamp }));
  writes.push(adminConfigEvent({ type: "crm.stage.reordered", actorId: clean(session.sub), payload: { pipelineId, stageIds }, stamp }));
  const committed = await commitWritesAsAdmin({ writes });
  if (!committed.ok) return { status: committed.status || 500, body: { error: "crm_stage_reorder_failed" } };
  return { status: 200, body: { ok: true } };
};

const handleDeleteStage = async ({ session, body }) => {
  const id = clean(body.id || body.stageId);
  const { stages, opportunities } = await loadCrmStructure();
  const stage = stages.find((row) => row.id === id);
  if (!stage) return { status: 404, body: { error: "stage_not_found" } };
  if (stages.filter((row) => row.pipelineId === stage.pipelineId).length <= 1) return { status: 409, body: { error: "last_stage" } };
  const count = stageOpportunityCount(opportunities, id);
  if (count) return { status: 409, body: { error: "stage_has_opportunities", opportunityCount: count } };
  const stamp = nowIso();
  const committed = await commitWritesAsAdmin({ writes: [
    deleteWrite(COLLECTIONS.stages, id),
    adminConfigEvent({ type: "crm.stage.deleted", actorId: clean(session.sub), payload: { pipelineId: stage.pipelineId, stageId: id }, stamp }),
  ] });
  if (!committed.ok) return { status: committed.status || 500, body: { error: "crm_stage_delete_failed" } };
  return { status: 200, body: { ok: true } };
};

const handleCreateActivity = async ({ auth, body }) => {
  const opportunity = await loadOpportunityForWrite(body.opportunityId);
  if (!opportunity) return { status: 404, body: { error: "opportunity_not_found" } };
  const guard = await crmActionGuard({ auth, action: "create_activity", opportunity });
  if (guard) return guard;
  const type = normalizeActivityType(body.type);
  const title = clean(body.title);
  const dueAt = activityDueAtFromBody(body);
  if (!type) return { status: 400, body: { error: "invalid_activity_type" } };
  if (!title) return { status: 400, body: { error: "activity_title_required" } };
  if (!dueAt) return { status: 400, body: { error: "invalid_activity_due_at" } };

  const stamp = nowIso();
  const activityId = newId("act");
  const activity = {
    id: activityId,
    scopeId: CRM_SCOPE_ID,
    opportunityId: opportunity.id,
    contactId: opportunity.contactId || null,
    type,
    title,
    description: clean(body.description) || null,
    dueAt,
    completedAt: null,
    completedBy: null,
    status: "open",
    ownerId: clean(body.ownerId) || null,
    createdBy: clean(auth.session.sub) || null,
    createdAt: stamp,
    updatedAt: stamp,
  };
  const activities = (await loadActivitiesForOpportunity(opportunity.id)).concat(activity);
  const nextOpportunity = opportunityWithNextActivity(opportunity, activities, stamp);
  const writes = [
    buildWrite(COLLECTIONS.activities, activity.id, activity),
    buildWrite(COLLECTIONS.opportunities, opportunity.id, nextOpportunity),
    eventWrite({
      type: "crm.activity.created",
      opportunityId: opportunity.id,
      contactId: opportunity.contactId,
      actorId: clean(auth.session.sub),
      payload: { activityId: activity.id, activityType: activity.type, activityTitle: activity.title, dueAt: activity.dueAt },
      stamp,
    }),
  ];
  const committed = await commitWritesAsAdmin({ writes });
  if (!committed.ok) return { status: committed.status || 500, body: { error: "crm_activity_create_failed" } };
  return { status: 201, body: { ok: true, activityId: activity.id } };
};

const loadActivityForWrite = async (activityId) => {
  const safeId = clean(activityId);
  if (!safeId) return null;
  try {
    const activity = normalizeActivity(await getDocumentAsAdmin(`${COLLECTIONS.activities}/${encodeURIComponent(safeId)}`));
    return matchesCrmScope(activity) ? activity : null;
  } catch {
    return null;
  }
};

const handleUpdateActivity = async ({ auth, body }) => {
  const activity = await loadActivityForWrite(body.id || body.activityId);
  if (!activity) return { status: 404, body: { error: "activity_not_found" } };
  const opportunity = await loadOpportunityForWrite(activity.opportunityId);
  if (!opportunity) return { status: 404, body: { error: "opportunity_not_found" } };
  const guard = await crmActionGuard({ auth, action: "update_activity", opportunity });
  if (guard) return guard;

  const type = body.type === undefined ? activity.type : normalizeActivityType(body.type);
  const title = body.title === undefined ? activity.title : clean(body.title);
  const dueAt = body.dueAt === undefined && body.date === undefined && body.time === undefined ? activity.dueAt : activityDueAtFromBody(body);
  const status = body.status === undefined ? activity.status : normalizeActivityStatus(body.status);
  if (!type) return { status: 400, body: { error: "invalid_activity_type" } };
  if (!title) return { status: 400, body: { error: "activity_title_required" } };
  if (!dueAt) return { status: 400, body: { error: "invalid_activity_due_at" } };

  const stamp = nowIso();
  const updated = {
    ...activity,
    type,
    title,
    description: body.description === undefined ? activity.description : clean(body.description) || null,
    dueAt,
    ownerId: body.ownerId === undefined ? activity.ownerId : clean(body.ownerId) || null,
    status,
    updatedAt: stamp,
  };
  const activities = (await loadActivitiesForOpportunity(opportunity.id)).map((row) => row.id === updated.id ? updated : row);
  const nextOpportunity = opportunityWithNextActivity(opportunity, activities, stamp);
  const writes = [
    buildWrite(COLLECTIONS.activities, updated.id, updated),
    buildWrite(COLLECTIONS.opportunities, opportunity.id, nextOpportunity),
    eventWrite({
      type: "crm.activity.updated",
      opportunityId: opportunity.id,
      contactId: opportunity.contactId,
      actorId: clean(auth.session.sub),
      payload: { activityId: updated.id, activityType: updated.type, activityTitle: updated.title, dueAt: updated.dueAt },
      stamp,
    }),
  ];
  const committed = await commitWritesAsAdmin({ writes });
  if (!committed.ok) return { status: committed.status || 500, body: { error: "crm_activity_update_failed" } };
  return { status: 200, body: { ok: true, activityId: updated.id } };
};

const handleActivityStatusChange = async ({ auth, body, status }) => {
  const activity = await loadActivityForWrite(body.id || body.activityId);
  if (!activity) return { status: 404, body: { error: "activity_not_found" } };
  const opportunity = await loadOpportunityForWrite(activity.opportunityId);
  if (!opportunity) return { status: 404, body: { error: "opportunity_not_found" } };
  const guard = await crmActionGuard({ auth, action: status === "completed" ? "complete_activity" : "cancel_activity", opportunity });
  if (guard) return guard;
  if (activity.status === status) return { status: 200, body: { ok: true, unchanged: true } };

  const stamp = nowIso();
  const updated = {
    ...activity,
    status,
    completedAt: status === "completed" ? stamp : activity.completedAt,
    completedBy: status === "completed" ? clean(auth.session.sub) || null : activity.completedBy,
    updatedAt: stamp,
  };
  const activities = (await loadActivitiesForOpportunity(opportunity.id)).map((row) => row.id === updated.id ? updated : row);
  const nextOpportunity = opportunityWithNextActivity(opportunity, activities, stamp);
  const eventType = status === "completed" ? "crm.activity.completed" : "crm.activity.cancelled";
  const writes = [
    buildWrite(COLLECTIONS.activities, updated.id, updated),
    buildWrite(COLLECTIONS.opportunities, opportunity.id, nextOpportunity),
    eventWrite({
      type: eventType,
      opportunityId: opportunity.id,
      contactId: opportunity.contactId,
      actorId: clean(auth.session.sub),
      payload: { activityId: updated.id, activityType: updated.type, activityTitle: updated.title, dueAt: updated.dueAt, completedAt: updated.completedAt },
      stamp,
    }),
  ];
  const committed = await commitWritesAsAdmin({ writes });
  if (!committed.ok) return { status: committed.status || 500, body: { error: "crm_activity_status_failed" } };
  await completeWorkflowRunIfSettled({ activity: updated, opportunity, actor: clean(auth.session.sub) || null, stamp }).catch((error) => console.warn("[crm] workflow run completion failed", error?.message || error));
  return { status: 200, body: { ok: true, activityId: updated.id, completedAt: updated.completedAt || null } };
};

const actionPermissionGuard = ({ auth, action }) => {
  if (qualificationActions.canManageAction({ role: auth.role, uid: auth.session?.sub, action })) return null;
  return { status: 403, body: { error: "qualification_action_forbidden" } };
};

const buildFollowUpFromAction = ({ action, opportunity, body, session, stamp }) => {
  const dueAt = activityDueAtFromBody(body);
  if (!dueAt) return { error: { status: 400, body: { error: "invalid_activity_due_at" } } };
  const activityId = newId("act");
  const activity = {
    id: activityId,
    scopeId: CRM_SCOPE_ID,
    opportunityId: opportunity.id,
    contactId: opportunity.contactId || null,
    type: "follow_up",
    title: clean(body.title) || "Retomar lead",
    description: clean(body.resolutionNote || body.description) || null,
    dueAt,
    completedAt: null,
    completedBy: null,
    status: "open",
    ownerId: clean(body.ownerId || body.assignedTo || action.assignedTo || opportunity.ownerId) || null,
    createdBy: clean(session.sub) || null,
    createdAt: stamp,
    updatedAt: stamp,
  };
  return { activity };
};

const handleCompleteQualificationAction = async ({ auth, body }) => {
  const action = await loadQualificationActionForWrite(body.id || body.actionId);
  if (!action) return { status: 404, body: { error: "qualification_action_not_found" } };
  const permission = actionPermissionGuard({ auth, action });
  if (permission) return permission;
  if (action.status === "completed") return { status: 200, body: { ok: true, unchanged: true, actionId: action.id } };
  if (action.status === "dismissed") return { status: 409, body: { error: "qualification_action_dismissed" } };
  const opportunity = await loadOpportunityForWrite(action.opportunityId);
  if (!opportunity) return { status: 404, body: { error: "opportunity_not_found" } };

  const stamp = nowIso();
  const actor = clean(auth.session?.sub) || null;
  const writes = [];
  let nextOpportunity = { ...opportunity, updatedAt: stamp };
  let createdActivity = null;
  const wantsFollowUp = action.type === "nurture" || body.createFollowUp === true || clean(body.resolution) === "follow_up";
  if (wantsFollowUp) {
    const result = buildFollowUpFromAction({ action, opportunity, body, session: auth.session, stamp });
    if (result.error) return result.error;
    createdActivity = result.activity;
    const activities = (await loadActivitiesForOpportunity(opportunity.id)).concat(createdActivity);
    nextOpportunity = opportunityWithNextActivity(nextOpportunity, activities, stamp);
    writes.push(
      buildWrite(COLLECTIONS.activities, createdActivity.id, createdActivity),
      eventWrite({
        type: "crm.activity.created",
        opportunityId: opportunity.id,
        contactId: opportunity.contactId,
        actorId: actor,
        payload: { activityId: createdActivity.id, activityType: createdActivity.type, activityTitle: createdActivity.title, dueAt: createdActivity.dueAt },
        stamp,
      }),
    );
  }
  if (action.type === "discard_review" && clean(body.resolution) === "discard") {
    const discardReason = clean(body.discardReason || action.metadata?.rejectReason || action.metadata?.reject_reason || action.rejectReason);
    const discardReasonNote = clean(body.discardReasonNote || body.resolutionNote || action.reason);
    if (!crmReasons.isValidSdrDiscardReason(discardReason)) return { status: 400, body: { error: "discard_reason_required" } };
    if (discardReason === "other" && !discardReasonNote) return { status: 400, body: { error: "discard_reason_note_required" } };
    nextOpportunity = {
      ...nextOpportunity,
      discardedAt: stamp,
      discardedBy: actor,
      discardedReason: discardReason,
      discardedReasonNote: discardReasonNote || null,
      updatedAt: stamp,
    };
    writes.push(eventWrite({
      type: "crm.opportunity.discarded",
      opportunityId: opportunity.id,
      contactId: opportunity.contactId,
      actorId: actor,
      payload: { actionId: action.id, opportunityId: opportunity.id, discardReason, discardReasonNote: discardReasonNote || null, discardedBy: actor, discardedAt: stamp },
      stamp,
    }));
  }
  if (action.type === "alignment_review" && !clean(body.resolutionCategory)) {
    return { status: 400, body: { error: "resolution_category_required" } };
  }
  const updatedAction = {
    ...action,
    status: "completed",
    assignedTo: body.assignedTo === undefined ? action.assignedTo : clean(body.assignedTo) || null,
    dueAt: createdActivity?.dueAt || action.dueAt,
    completedAt: stamp,
    completedBy: actor,
    resolutionNote: clean(body.resolutionNote) || null,
    resolutionCategory: clean(body.resolutionCategory) || clean(body.resolution) || null,
    createdActivityId: createdActivity?.id || action.createdActivityId || null,
    metadata: {
      ...(action.metadata || {}),
      resolution: clean(body.resolution) || null,
      resolutionCategory: clean(body.resolutionCategory) || null,
    },
    updatedAt: stamp,
  };
  writes.unshift(
    buildWrite(COLLECTIONS.qualificationActions, action.id, updatedAction),
    buildWrite(COLLECTIONS.opportunities, opportunity.id, nextOpportunity),
    eventWrite({
      type: "crm.qualification_action.completed",
      opportunityId: opportunity.id,
      contactId: opportunity.contactId,
      actorId: actor,
      payload: {
        actionId: action.id,
        actionType: action.type,
        resolution: clean(body.resolution) || null,
        resolutionCategory: updatedAction.resolutionCategory,
        resolutionNote: updatedAction.resolutionNote,
        activityId: createdActivity?.id || null,
        activityTitle: createdActivity?.title || null,
      },
      stamp,
    }),
  );
  if (action.type === "discard_review" && clean(body.resolution) === "discard") {
    writes.push(...(await growthOverviewCacheInvalidationWrites()));
  }
  const committed = await commitWritesAsAdmin({ writes });
  if (!committed.ok) return { status: committed.status || 500, body: { error: "qualification_action_complete_failed" } };
  return { status: 200, body: { ok: true, actionId: action.id, activityId: createdActivity?.id || null } };
};

const handleDismissQualificationAction = async ({ auth, body }) => {
  const action = await loadQualificationActionForWrite(body.id || body.actionId);
  if (!action) return { status: 404, body: { error: "qualification_action_not_found" } };
  const permission = actionPermissionGuard({ auth, action });
  if (permission) return permission;
  if (action.status === "dismissed") return { status: 200, body: { ok: true, unchanged: true, actionId: action.id } };
  if (action.status === "completed") return { status: 409, body: { error: "qualification_action_completed" } };
  const stamp = nowIso();
  const actor = clean(auth.session?.sub) || null;
  const updated = {
    ...action,
    status: "dismissed",
    dismissedAt: stamp,
    dismissedBy: actor,
    dismissedReason: clean(body.dismissedReason || body.reason) || null,
    updatedAt: stamp,
  };
  const writes = [
    buildWrite(COLLECTIONS.qualificationActions, action.id, updated),
    eventWrite({
      type: "crm.qualification_action.dismissed",
      opportunityId: action.opportunityId,
      contactId: action.contactId,
      actorId: actor,
      payload: { actionId: action.id, actionType: action.type, dismissedReason: updated.dismissedReason },
      stamp,
    }),
  ];
  const committed = await commitWritesAsAdmin({ writes });
  if (!committed.ok) return { status: committed.status || 500, body: { error: "qualification_action_dismiss_failed" } };
  return { status: 200, body: { ok: true, actionId: action.id } };
};

const handleAssignQualificationAction = async ({ auth, body }) => {
  if (auth.role !== "admin") return { status: 403, body: { error: "admin_required" } };
  const action = await loadQualificationActionForWrite(body.id || body.actionId);
  if (!action) return { status: 404, body: { error: "qualification_action_not_found" } };
  if (action.status !== "pending") return { status: 409, body: { error: "qualification_action_not_pending" } };
  const stamp = nowIso();
  const assignedTo = clean(body.assignedTo || body.ownerId) || null;
  const dueAt = body.dueAt === undefined && body.date === undefined && body.time === undefined ? action.dueAt : activityDueAtFromBody(body) || null;
  const updated = {
    ...action,
    assignedTo,
    dueAt,
    updatedAt: stamp,
  };
  const writes = [
    buildWrite(COLLECTIONS.qualificationActions, action.id, updated),
  ];
  const committed = await commitWritesAsAdmin({ writes });
  if (!committed.ok) return { status: committed.status || 500, body: { error: "qualification_action_assign_failed" } };
  return { status: 200, body: { ok: true, actionId: action.id, assignedTo } };
};

const handleReactivateOpportunity = async ({ auth, body }) => {
  const opportunity = await loadOpportunityForWrite(body.id || body.opportunityId);
  if (!opportunity) return { status: 404, body: { error: "opportunity_not_found" } };
  const guard = await crmActionGuard({ auth, action: "update_opportunity", opportunity });
  if (guard) return guard;
  if (auth.role !== "admin" && clean(opportunity.ownerId) !== clean(auth.session?.sub)) return { status: 403, body: { error: "opportunity_reactivate_forbidden" } };
  if (!opportunity.discardedAt) return { status: 200, body: { ok: true, unchanged: true, opportunityId: opportunity.id } };
  const stamp = nowIso();
  const actor = clean(auth.session?.sub) || null;
  const updated = {
    ...opportunity,
    discardedAt: null,
    discardedBy: null,
    discardedReason: null,
    discardedReasonNote: null,
    reactivatedAt: stamp,
    reactivatedBy: actor,
    updatedAt: stamp,
  };
  const writes = [
    buildWrite(COLLECTIONS.opportunities, opportunity.id, updated),
    eventWrite({
      type: "crm.opportunity.reactivated",
      opportunityId: opportunity.id,
      contactId: opportunity.contactId,
      actorId: actor,
      payload: { opportunityId: opportunity.id },
      stamp,
    }),
    ...(await growthOverviewCacheInvalidationWrites()),
  ];
  const committed = await commitWritesAsAdmin({ writes });
  if (!committed.ok) return { status: committed.status || 500, body: { error: "opportunity_reactivate_failed" } };
  return { status: 200, body: { ok: true, opportunityId: opportunity.id } };
};

module.exports = async (req, res) => {
  const perf = createPerformanceTimer({ req, route: "/api/crm", operation: "crm" });
  const send = (status, body) => {
    return sendJsonWithPerformance(req, res, status, body, perf, { etag: req.method === "GET" || req.method === "HEAD" });
  };
  let auth = perf.measure ? await perf.measure("auth", () => Promise.resolve(canAccessCrm(req))) : canAccessCrm(req);
  if (!auth.ok) return send(auth.status, { error: auth.error });
  if (auth.role === "admin") {
    const guard = await requireAdminPermission(req, "comercial.crm.view");
    if (!guard.ok) return send(guard.status, guard.body);
  }
  auth = await perf.measure("commercialPermissions", () => resolveCrmAuthContext(auth), { firestore: auth.role === "growth" });
  if (req.method === "GET" || req.method === "HEAD") {
    try {
      const host = String(req.headers.host || "localhost");
      const url = new URL(req.url || "/api/crm", `https://${host}`);
      const opportunityId = clean(url.searchParams.get("opportunityId"));
      if (opportunityId) {
        perf.set("operation", "opportunity_detail");
        const detail = await loadOpportunityDetail(opportunityId, auth, perf);
        return send(detail.status, detail.body);
      }
      if (clean(url.searchParams.get("view")) === "analytics") {
        perf.set("operation", "analytics");
        if (auth.role !== "admin") return send(403, { error: "admin_required" });
        const analytics = await loadQualificationAnalytics(Object.fromEntries(url.searchParams.entries()));
        return send(200, analytics);
      }
      if (clean(url.searchParams.get("view")) === "qualification_config") {
        perf.set("operation", "qualification_config");
        if (auth.role !== "admin") return send(403, { error: "admin_required" });
        const model = await loadQualificationAdminModel(clean(auth.session?.sub));
        return send(200, model);
      }
      if (clean(url.searchParams.get("view")) === "actions") {
        perf.set("operation", "actions");
        const actions = await loadQualificationActionsQueue({ query: Object.fromEntries(url.searchParams.entries()), auth });
        return send(200, actions);
      }
      if (clean(url.searchParams.get("view")) === "list") {
        perf.set("operation", "list");
        const list = await perf.measure("responseBuild", () => crmService.loadCrmListModel(Object.fromEntries(url.searchParams.entries()), { user: auth.user || auth.session, perf }));
        return send(200, list);
      }
      perf.set("operation", "board");
      const model = await perf.measure("responseBuild", () => crmService.loadCrmReadModel({ user: auth.user || auth.session, workspace: clean(url.searchParams.get("workspace")), perf }));
      return send(200, model);
    } catch (error) {
      console.error("[crm] read failed", error);
      return send(error.status || 500, { error: error.message || "crm_read_failed" });
    }
  }
  if (req.method !== "POST" && req.method !== "PATCH") {
    res.setHeader("Allow", "GET, HEAD, POST, PATCH");
    return send(405, { error: "method_not_allowed" });
  }

  try {
    const body = await readBody(req);
    const action = clean(body.action);
    if (auth.role === "admin") {
      const deleteActions = new Set(["delete_stage", "delete_qualification_draft", "discard_opportunity", "cancel_activity"]);
      const createActions = new Set(["create_opportunity", "create_pipeline", "create_stage", "create_qualification_template", "create_qualification_draft", "create_activity"]);
      const adminAction = deleteActions.has(action) ? "delete" : createActions.has(action) ? "create" : "update";
      const guard = await requireAdminPermission(req, `comercial.crm.${adminAction}`);
      if (!guard.ok) return send(guard.status, guard.body);
    }
    const adminActions = new Set([
      "create_pipeline",
      "update_pipeline",
      "set_default_pipeline",
      "deactivate_pipeline",
      "reactivate_pipeline",
      "create_stage",
      "update_stage",
      "reorder_stages",
      "delete_stage",
      "create_qualification_template",
      "create_qualification_draft",
      "save_qualification_filter",
      "publish_qualification_filter",
      "delete_qualification_draft",
      "save_crm_workflow",
      "publish_crm_workflow",
      "toggle_crm_workflow",
    ]);
    if (adminActions.has(action)) {
      const adminGuard = requireAdmin(auth);
      if (adminGuard) return send(adminGuard.status, adminGuard.body);
    }
    const result =
      action === "create_opportunity"
        ? await handleCreateOpportunityViaService({ auth, body })
        : action === "move_opportunity"
          ? await handleMoveOpportunity({ auth, body })
          : action === "update_opportunity"
            ? await handleUpdateOpportunity({ auth, body })
            : action === "start_qualification"
              ? await handleStartQualification({ auth, body })
              : action === "complete_qualification"
                ? await handleCompleteQualification({ auth, body })
                : action === "handoff_opportunity"
                  ? await handleHandoffOpportunity({ auth, body })
                  : action === "set_meeting_outcome"
                    ? await handleSetMeetingOutcome({ auth, body })
                    : action === "complete_closer_review"
                      ? await handleCompleteCloserReview({ auth, body })
                      : action === "complete_qualification_action"
                        ? await handleCompleteQualificationAction({ auth, body })
                        : action === "dismiss_qualification_action"
                          ? await handleDismissQualificationAction({ auth, body })
                          : action === "assign_qualification_action"
                            ? await handleAssignQualificationAction({ auth, body })
                            : action === "reactivate_opportunity"
                              ? await handleReactivateOpportunity({ auth, body })
                              : action === "discard_opportunity"
                                ? await handleDiscardOpportunity({ auth, body })
                                : action === "mark_opportunity_won"
                                  ? await handleMarkOpportunityWon({ auth, body })
                                  : action === "mark_opportunity_lost"
                                    ? await handleMarkOpportunityLost({ auth, body })
                                    : action === "reopen_opportunity"
                                      ? await handleReopenOpportunity({ auth, body })
                                    : action === "create_pipeline"
                                      ? await handleCreatePipeline({ session: auth.session, body })
                                      : action === "update_pipeline"
                                        ? await handleUpdatePipeline({ session: auth.session, body })
                                        : action === "set_default_pipeline"
                                          ? await handleSetDefaultPipeline({ session: auth.session, body })
                                          : action === "deactivate_pipeline"
                                            ? await handleDeactivatePipeline({ session: auth.session, body })
                                            : action === "reactivate_pipeline"
                                              ? await handleReactivatePipeline({ session: auth.session, body })
                                              : action === "create_stage"
                                                ? await handleCreateStage({ session: auth.session, body })
                                                : action === "update_stage"
                                                  ? await handleUpdateStage({ session: auth.session, body })
                                                  : action === "reorder_stages"
                                                    ? await handleReorderStages({ session: auth.session, body })
                                                    : action === "delete_stage"
                                                      ? await handleDeleteStage({ session: auth.session, body })
                                                      : action === "create_qualification_template"
                                                        ? await handleCreateQualificationTemplate({ session: auth.session, body })
                                                        : action === "create_qualification_draft"
                                                          ? await handleCreateQualificationDraft({ session: auth.session, body })
                                                          : action === "save_qualification_filter"
                                                            ? await handleSaveQualificationFilter({ session: auth.session, body })
                                                            : action === "publish_qualification_filter"
                                                              ? await handlePublishQualificationFilter({ session: auth.session, body })
                                                              : action === "delete_qualification_draft"
                                                                ? await handleDeleteQualificationDraft({ session: auth.session, body })
                                                                : action === "save_crm_workflow"
                                                                  ? await handleSaveCrmWorkflow({ session: auth.session, body })
                                                                  : action === "publish_crm_workflow"
                                                                    ? await handlePublishCrmWorkflow({ session: auth.session, body })
                                                                    : action === "toggle_crm_workflow"
                                                                      ? await handleToggleCrmWorkflow({ session: auth.session, body })
                                                      : action === "create_activity"
                                                        ? await handleCreateActivity({ auth, body })
                                                        : action === "update_activity"
                                                          ? await handleUpdateActivity({ auth, body })
                                                          : action === "complete_activity"
                                                            ? await handleActivityStatusChange({ auth, body, status: "completed" })
                                                            : action === "cancel_activity"
                                                              ? await handleActivityStatusChange({ auth, body, status: "cancelled" })
                                                              : { status: 400, body: { error: "invalid_action" } };
    return send(result.status, result.body);
  } catch (error) {
    console.error("[crm] write failed", error);
    return send(error.status || 500, { error: error.message || "crm_write_failed" });
  }
};
