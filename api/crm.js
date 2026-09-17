const crypto = require("crypto");

const { sendJson } = require("../_lib/http");
const { getSessionFromRequest } = require("../_lib/session");
const {
  commitWritesAsAdmin,
  getDocumentAsAdmin,
  listCollectionAsAdmin,
} = require("./_lib/firestore-admin");
const { PROJECT_ID, encodeFields } = require("./_lib/firestore-rest");
const crmService = require("./_lib/crm-service");
const qualification = require("./_lib/crm-qualification");
const handoff = require("./_lib/crm-handoff");
const qualificationAnalytics = require("./_lib/crm-qualification-analytics");

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
  salesHandoffs: "crmSalesHandoffs",
  closerReviews: "crmCloserReviews",
};

const VALID_STATUS = new Set(["open", "won", "lost"]);
const VALID_ACTIVITY_TYPES = new Set(["task", "call", "meeting", "follow_up"]);
const VALID_ACTIVITY_STATUS = new Set(["open", "completed", "cancelled"]);
const VALID_LOST_REASONS = new Set(["price", "no_response", "timing", "competitor", "not_qualified", "no_need", "payment", "other"]);
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

const loadActivitiesForOpportunity = async (opportunityId) => {
  const safeOpportunityId = clean(opportunityId);
  if (!safeOpportunityId) return [];
  const rows = await listCollectionAsAdmin(COLLECTIONS.activities, { maxPages: 50 }).catch(() => []);
  return rows
    .map(normalizeActivity)
    .filter((activity) => activity.id && matchesCrmScope(activity) && activity.opportunityId === safeOpportunityId)
    .sort(compareActivityDueAt);
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

const lostReasonLabel = (reason) => ({
  price: "Preço",
  no_response: "Sem resposta",
  timing: "Momento inadequado",
  competitor: "Concorrente",
  not_qualified: "Não qualificado",
  no_need: "Sem necessidade percebida",
  payment: "Pagamento",
  other: "Outro",
}[clean(reason)] || clean(reason));

const eventTitle = (event) => {
  if (event.type === "crm.opportunity.created") return "Oportunidade criada";
  if (event.type === "crm.opportunity.updated") return "Oportunidade editada";
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
  return clean(event.type).replace(/^crm\./, "");
};

const eventDescription = (event) => {
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
  return event.payload?.title || event.payload?.activityTitle || "";
};

const buildOpportunityTimeline = async (opportunityId) => {
  const [eventsRaw, historyRaw, stagesRaw, usersRaw] = await Promise.all([
    listCollectionAsAdmin(COLLECTIONS.events, { maxPages: 50 }).catch(() => []),
    listCollectionAsAdmin(COLLECTIONS.stageHistory, { maxPages: 50 }).catch(() => []),
    listCollectionAsAdmin(COLLECTIONS.stages, { maxPages: 10 }).catch(() => []),
    listCollectionAsAdmin(COLLECTIONS.users, { maxPages: 20 }).catch(() => []),
  ]);
  const stagesById = new Map(stagesRaw.map(normalizeStage).filter(matchesCrmScope).map((stage) => [stage.id, stage]));
  const usersById = new Map(usersRaw.map((row) => [clean(row.uid || row.id || row.firestoreDocId), row]).filter(([id]) => id));
  const events = eventsRaw
    .map(normalizeEvent)
    .filter((event) => event.id && matchesCrmScope(event) && event.opportunityId === opportunityId && event.type !== "crm.opportunity.stage_changed")
    .map((event) => ({
      id: `event_${event.id}`,
      kind: "event",
      type: event.type,
      title: eventTitle(event),
      description: eventDescription(event),
      actorName: actorName(usersById, event.actorId),
      occurredAt: event.createdAt,
      payload: event.payload,
    }));
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
  return events.concat(stageItems).sort((left, right) => String(right.occurredAt || "").localeCompare(String(left.occurredAt || "")));
};

const loadOpportunityDetail = async (opportunityId) => {
  const opportunity = await loadOpportunityForWrite(opportunityId);
  if (!opportunity) return { status: 404, body: { error: "opportunity_not_found" } };
  const [activities, timeline, qualificationDetail, handoffBundle] = await Promise.all([
    loadActivitiesForOpportunity(opportunity.id),
    buildOpportunityTimeline(opportunity.id),
    loadOpportunityQualificationDetail(opportunity),
    loadLatestHandoffBundle(opportunity.id),
  ]);
  return { status: 200, body: { opportunityId: opportunity.id, activities, timeline, qualification: qualificationDetail, handoff: handoffBundle.latestHandoff, closerReview: handoffBundle.latestReview, generatedAt: nowIso() } };
};

const handleCreateOpportunityViaService = async ({ session, body }) => {
  try {
    const result = await crmService.createOpportunity({ actorUid: clean(session.sub), input: body });
    return { status: 201, body: { ok: true, opportunityId: result.opportunityId } };
  } catch (error) {
    return { status: error.status || 500, body: { error: error.message || "crm_create_failed" } };
  }
};

const handleMoveOpportunity = async ({ session, body }) => {
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
      changedBy: clean(session.sub) || null,
      createdAt: stamp,
    }),
    eventWrite({
      type: "crm.opportunity.stage_changed",
      opportunityId: opportunity.id,
      contactId: opportunity.contactId,
      actorId: clean(session.sub),
      payload: { fromStageId: opportunity.stageId || null, toStageId, fromPipelineId: opportunity.pipelineId || null, toPipelineId: opportunity.pipelineId || null },
      stamp,
    }),
  ];
  const committed = await commitWritesAsAdmin({ writes });
  if (!committed.ok) return { status: committed.status || 500, body: { error: "crm_stage_change_failed" } };
  return { status: 200, body: { ok: true } };
};

const handleUpdateOpportunity = async ({ session, body }) => {
  const id = clean(body.id || body.opportunityId);
  if (!id) return { status: 400, body: { error: "missing_opportunity_id" } };
  let opportunity;
  try {
    opportunity = normalizeOpportunity(await getDocumentAsAdmin(`${COLLECTIONS.opportunities}/${encodeURIComponent(id)}`));
  } catch (error) {
    return { status: error.status === 404 ? 404 : 500, body: { error: "opportunity_not_found" } };
  }
  if (!matchesCrmScope(opportunity)) return { status: 404, body: { error: "opportunity_not_found" } };

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
      changedBy: clean(session.sub) || null,
      createdAt: stamp,
    }));
    writes.push(eventWrite({
      type: "crm.opportunity.stage_changed",
      opportunityId: next.id,
      contactId: next.contactId,
      actorId: clean(session.sub),
      payload: { fromStageId: opportunity.stageId || null, toStageId: requestedStageId, fromPipelineId: opportunity.pipelineId || null, toPipelineId: requestedPipelineId },
      stamp,
    }));
  }
  writes.push(eventWrite({
    type: "crm.opportunity.updated",
    opportunityId: next.id,
    contactId: next.contactId,
    actorId: clean(session.sub),
    payload: { status: next.status },
    stamp,
  }));
  const committed = await commitWritesAsAdmin({ writes });
  if (!committed.ok) return { status: committed.status || 500, body: { error: "crm_update_failed" } };
  return { status: 200, body: { ok: true } };
};

const handleStartQualification = async ({ session, body }) => {
  const opportunity = await loadOpportunityForWrite(body.id || body.opportunityId);
  if (!opportunity) return { status: 404, body: { error: "opportunity_not_found" } };
  const config = await ensurePublishedSdrQualification(clean(session.sub));
  if (!config) return { status: 500, body: { error: "qualification_config_unavailable" } };
  const existing = qualification.latestRun((await loadQualificationRunsForOpportunity(opportunity.id)).filter((run) => run.status === "in_progress"));
  if (existing) return { status: 200, body: { ok: true, runId: existing.id, unchanged: true } };
  const stamp = nowIso();
  const runId = newId("qualrun");
  const actor = clean(session.sub) || null;
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

const handleCompleteQualification = async ({ session, body }) => {
  const opportunity = await loadOpportunityForWrite(body.id || body.opportunityId);
  if (!opportunity) return { status: 404, body: { error: "opportunity_not_found" } };
  const config = await ensurePublishedSdrQualification(clean(session.sub));
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
  const runs = await loadQualificationRunsForOpportunity(opportunity.id);
  const requestedRunId = clean(body.runId);
  const currentRun = (requestedRunId ? runs.find((run) => run.id === requestedRunId && run.status === "in_progress") : null)
    || qualification.latestRun(runs.filter((run) => run.status === "in_progress"));
  const stamp = nowIso();
  const actor = clean(session.sub) || null;
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

const handleHandoffOpportunity = async ({ session, body }) => {
  const opportunity = await loadOpportunityForWrite(body.id || body.opportunityId);
  if (!opportunity) return { status: 404, body: { error: "opportunity_not_found" } };
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
  const actor = clean(session.sub) || null;
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

const handleSetMeetingOutcome = async ({ session, body }) => {
  const opportunity = await loadOpportunityForWrite(body.id || body.opportunityId);
  if (!opportunity) return { status: 404, body: { error: "opportunity_not_found" } };
  const outcome = clean(body.meetingOutcome);
  if (!handoff.MEETING_OUTCOMES.has(outcome)) return { status: 400, body: { error: "invalid_meeting_outcome" } };
  const { latestHandoff, latestReview } = await loadLatestHandoffBundle(opportunity.id);
  if (!latestHandoff) return { status: 409, body: { error: "handoff_required" } };
  if (latestReview?.status === "completed") return { status: 409, body: { error: "closer_review_completed_is_readonly" } };
  const stamp = nowIso();
  const actor = clean(session.sub) || null;
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

const handleCompleteCloserReview = async ({ session, body }) => {
  const opportunity = await loadOpportunityForWrite(body.id || body.opportunityId);
  if (!opportunity) return { status: 404, body: { error: "opportunity_not_found" } };
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
  const config = await ensurePublishedSdrQualification(clean(session.sub));
  const weights = handoff.dimensionMaxWeights({ questions: config?.questions || [], options: config?.options || [] });
  const accuracy = handoff.calculateAccuracy({ dimensionValidation: body.dimensionValidation, weights });
  const salesAccepted = body.salesAccepted === true;
  const rejectReason = salesAccepted ? null : clean(body.rejectReason);
  const recommendedAction = handoff.recommendedActionForReview({ salesAccepted, rejectReason });
  const stamp = nowIso();
  const actor = clean(session.sub) || null;
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
  const committed = await commitWritesAsAdmin({ writes });
  if (!committed.ok) return { status: committed.status || 500, body: { error: "closer_review_failed" } };
  return { status: 200, body: { ok: true, reviewId: completedReview.id, accuracyScore: completedReview.accuracyScore, recommendedAction } };
};

const handleMarkOpportunityWon = async ({ session, body }) => {
  const opportunity = await loadOpportunityForWrite(body.id || body.opportunityId);
  if (!opportunity) return { status: 404, body: { error: "opportunity_not_found" } };
  if (opportunity.status === "won") return { status: 409, body: { error: "opportunity_already_won" } };
  if (opportunity.status === "lost") return { status: 409, body: { error: "reopen_before_mark_won" } };
  const closedValue = numberOrNull(body.closedValue ?? body.value ?? opportunity.value);
  if (closedValue == null || closedValue < 0) return { status: 400, body: { error: "invalid_closed_value" } };
  const stamp = nowIso();
  const closedAt = normalizeTimestamp(body.closedAt) || stamp;
  const actor = clean(session.sub) || null;
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
      payload: { opportunityId: opportunity.id, previousStatus: opportunity.status, closedValue, closedAt, actor },
      stamp,
    }),
  ];
  const committed = await commitWritesAsAdmin({ writes });
  if (!committed.ok) return { status: committed.status || 500, body: { error: "crm_mark_won_failed" } };
  return { status: 200, body: { ok: true, status: "won", closedAt, closedValue } };
};

const handleMarkOpportunityLost = async ({ session, body }) => {
  const opportunity = await loadOpportunityForWrite(body.id || body.opportunityId);
  if (!opportunity) return { status: 404, body: { error: "opportunity_not_found" } };
  if (opportunity.status === "lost") return { status: 409, body: { error: "opportunity_already_lost" } };
  if (opportunity.status === "won") return { status: 409, body: { error: "reopen_before_mark_lost" } };
  const lostReason = clean(body.lostReason);
  if (!VALID_LOST_REASONS.has(lostReason)) return { status: 400, body: { error: "invalid_lost_reason" } };
  const stamp = nowIso();
  const closedAt = normalizeTimestamp(body.closedAt) || stamp;
  const actor = clean(session.sub) || null;
  const lostReasonNote = clean(body.lostReasonNote);
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
      payload: { opportunityId: opportunity.id, previousStatus: opportunity.status, lostReason, closedAt, actor },
      stamp,
    }),
  ];
  const committed = await commitWritesAsAdmin({ writes });
  if (!committed.ok) return { status: committed.status || 500, body: { error: "crm_mark_lost_failed" } };
  return { status: 200, body: { ok: true, status: "lost", closedAt, lostReason } };
};

const handleReopenOpportunity = async ({ session, body }) => {
  const opportunity = await loadOpportunityForWrite(body.id || body.opportunityId);
  if (!opportunity) return { status: 404, body: { error: "opportunity_not_found" } };
  if (opportunity.status === "open") return { status: 409, body: { error: "opportunity_already_open" } };
  const stamp = nowIso();
  const actor = clean(session.sub) || null;
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

const handleCreateActivity = async ({ session, body }) => {
  const opportunity = await loadOpportunityForWrite(body.opportunityId);
  if (!opportunity) return { status: 404, body: { error: "opportunity_not_found" } };
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
    createdBy: clean(session.sub) || null,
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
      actorId: clean(session.sub),
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

const handleUpdateActivity = async ({ session, body }) => {
  const activity = await loadActivityForWrite(body.id || body.activityId);
  if (!activity) return { status: 404, body: { error: "activity_not_found" } };
  const opportunity = await loadOpportunityForWrite(activity.opportunityId);
  if (!opportunity) return { status: 404, body: { error: "opportunity_not_found" } };

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
      actorId: clean(session.sub),
      payload: { activityId: updated.id, activityType: updated.type, activityTitle: updated.title, dueAt: updated.dueAt },
      stamp,
    }),
  ];
  const committed = await commitWritesAsAdmin({ writes });
  if (!committed.ok) return { status: committed.status || 500, body: { error: "crm_activity_update_failed" } };
  return { status: 200, body: { ok: true, activityId: updated.id } };
};

const handleActivityStatusChange = async ({ session, body, status }) => {
  const activity = await loadActivityForWrite(body.id || body.activityId);
  if (!activity) return { status: 404, body: { error: "activity_not_found" } };
  const opportunity = await loadOpportunityForWrite(activity.opportunityId);
  if (!opportunity) return { status: 404, body: { error: "opportunity_not_found" } };
  if (activity.status === status) return { status: 200, body: { ok: true, unchanged: true } };

  const stamp = nowIso();
  const updated = {
    ...activity,
    status,
    completedAt: status === "completed" ? stamp : activity.completedAt,
    completedBy: status === "completed" ? clean(session.sub) || null : activity.completedBy,
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
      actorId: clean(session.sub),
      payload: { activityId: updated.id, activityType: updated.type, activityTitle: updated.title, dueAt: updated.dueAt, completedAt: updated.completedAt },
      stamp,
    }),
  ];
  const committed = await commitWritesAsAdmin({ writes });
  if (!committed.ok) return { status: committed.status || 500, body: { error: "crm_activity_status_failed" } };
  return { status: 200, body: { ok: true, activityId: updated.id, completedAt: updated.completedAt || null } };
};

module.exports = async (req, res) => {
  const auth = canAccessCrm(req);
  if (!auth.ok) return sendJson(res, auth.status, { error: auth.error });
  if (req.method === "GET" || req.method === "HEAD") {
    try {
      const host = String(req.headers.host || "localhost");
      const url = new URL(req.url || "/api/crm", `https://${host}`);
      const opportunityId = clean(url.searchParams.get("opportunityId"));
      if (opportunityId) {
        const detail = await loadOpportunityDetail(opportunityId);
        return sendJson(res, detail.status, detail.body);
      }
      if (clean(url.searchParams.get("view")) === "analytics") {
        if (auth.role !== "admin") return sendJson(res, 403, { error: "admin_required" });
        const analytics = await loadQualificationAnalytics(Object.fromEntries(url.searchParams.entries()));
        return sendJson(res, 200, analytics);
      }
      if (clean(url.searchParams.get("view")) === "list") {
        const list = await crmService.loadCrmListModel(Object.fromEntries(url.searchParams.entries()));
        return sendJson(res, 200, list);
      }
      const model = await crmService.loadCrmReadModel();
      return sendJson(res, 200, model);
    } catch (error) {
      console.error("[crm] read failed", error);
      return sendJson(res, error.status || 500, { error: error.message || "crm_read_failed" });
    }
  }
  if (req.method !== "POST" && req.method !== "PATCH") {
    res.setHeader("Allow", "GET, HEAD, POST, PATCH");
    return sendJson(res, 405, { error: "method_not_allowed" });
  }

  try {
    const body = await readBody(req);
    const action = clean(body.action);
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
    ]);
    if (adminActions.has(action)) {
      const adminGuard = requireAdmin(auth);
      if (adminGuard) return sendJson(res, adminGuard.status, adminGuard.body);
    }
    const result =
      action === "create_opportunity"
        ? await handleCreateOpportunityViaService({ session: auth.session, body })
        : action === "move_opportunity"
          ? await handleMoveOpportunity({ session: auth.session, body })
          : action === "update_opportunity"
            ? await handleUpdateOpportunity({ session: auth.session, body })
            : action === "start_qualification"
              ? await handleStartQualification({ session: auth.session, body })
              : action === "complete_qualification"
                ? await handleCompleteQualification({ session: auth.session, body })
                : action === "handoff_opportunity"
                  ? await handleHandoffOpportunity({ session: auth.session, body })
                  : action === "set_meeting_outcome"
                    ? await handleSetMeetingOutcome({ session: auth.session, body })
                    : action === "complete_closer_review"
                      ? await handleCompleteCloserReview({ session: auth.session, body })
                      : action === "mark_opportunity_won"
                        ? await handleMarkOpportunityWon({ session: auth.session, body })
                        : action === "mark_opportunity_lost"
                          ? await handleMarkOpportunityLost({ session: auth.session, body })
                          : action === "reopen_opportunity"
                            ? await handleReopenOpportunity({ session: auth.session, body })
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
                                              : action === "create_activity"
                                                ? await handleCreateActivity({ session: auth.session, body })
                                                : action === "update_activity"
                                                  ? await handleUpdateActivity({ session: auth.session, body })
                                                  : action === "complete_activity"
                                                    ? await handleActivityStatusChange({ session: auth.session, body, status: "completed" })
                                                    : action === "cancel_activity"
                                                      ? await handleActivityStatusChange({ session: auth.session, body, status: "cancelled" })
                                                      : { status: 400, body: { error: "invalid_action" } };
    return sendJson(res, result.status, result.body);
  } catch (error) {
    console.error("[crm] write failed", error);
    return sendJson(res, error.status || 500, { error: error.message || "crm_write_failed" });
  }
};
