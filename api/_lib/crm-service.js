const crypto = require("crypto");

const {
  commitWritesAsAdmin,
  getDocumentAsAdmin,
  listCollectionAsAdmin,
} = require("./firestore-admin");
const { PROJECT_ID, encodeFields } = require("./firestore-rest");
const { identitiesMatch, normalizeCrmContactIdentity, stableIdFromKey } = require("./crm-identity");
const qualification = require("./crm-qualification");
const commercialPermissions = require("./commercial-permissions");

const COLLECTIONS = {
  pipelines: "crmPipelines",
  stages: "crmStages",
  contacts: "crmContacts",
  opportunities: "crmOpportunities",
  stageHistory: "crmOpportunityStageHistory",
  events: "crmEvents",
  users: "users",
  qualificationTemplates: "crmQualificationTemplates",
  qualificationVersions: "crmQualificationVersions",
  qualificationQuestions: "crmQualificationQuestions",
  qualificationOptions: "crmQualificationOptions",
  qualificationRuns: "crmQualificationRuns",
  qualificationAnswers: "crmQualificationAnswers",
};

const DEFAULT_PIPELINE_ID = "commercial";
const DEFAULT_STAGES = ["Novo lead", "Em contato", "Reunião", "Negociação"];
const VALID_STATUS = new Set(["open", "won", "lost"]);
const CRM_SCOPE_ID = String(process.env.SPACE_CRM_SCOPE_ID || process.env.CRM_SCOPE_ID || "space-main").trim() || "space-main";

const clean = (value) => String(value || "").trim();
const lower = (value) => clean(value).toLowerCase();
const nowIso = () => new Date().toISOString();
const newId = (prefix) => `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`;
const matchesCrmScope = (row) => clean(row?.scopeId) === CRM_SCOPE_ID || !clean(row?.scopeId);
const LIST_PAGE_SIZE = 50;
const MAX_LIST_PAGE_SIZE = 100;

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

const normalizeCurrency = (value) => clean(value).toUpperCase() || "BRL";
const normalizeDateOnly = (value) => (/^\d{4}-\d{2}-\d{2}$/.test(clean(value)) ? clean(value) : null);
const normalizeCountryCode = (value) => {
  const raw = clean(value).toUpperCase();
  return /^[A-Z]{2}$/.test(raw) ? raw : "";
};

const normalizeRole = (value) => {
  const raw = lower(value);
  if (raw === "admin" || raw === "administrador") return "admin";
  if (raw === "growth") return "growth";
  return "";
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
  reactivatedAt: toIso(row.reactivatedAt),
  reactivatedBy: clean(row.reactivatedBy) || null,
  automationIdempotencyKey: clean(row.automationIdempotencyKey) || null,
  searchTitle: normalizeSearchText(row.searchTitle || row.title),
  createdAt: toIso(row.createdAt),
  updatedAt: toIso(row.updatedAt),
});

const todayKeyInSaoPaulo = (date = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(date);

const activityStateForOpportunity = (opportunity, now = new Date()) => {
  if (!opportunity?.nextActivityId || !opportunity?.nextActivityAt) return "none";
  const date = new Date(opportunity.nextActivityAt);
  if (Number.isNaN(date.getTime())) return "none";
  if (date.getTime() < now.getTime()) return "overdue";
  return todayKeyInSaoPaulo(date) === todayKeyInSaoPaulo(now) ? "today" : "future";
};

const startOfSaoPauloDay = (date = new Date()) => new Date(`${todayKeyInSaoPaulo(date)}T00:00:00-03:00`);

const createdRangeStart = (range) => {
  const key = clean(range);
  if (!key) return null;
  const now = new Date();
  const today = startOfSaoPauloDay(now);
  if (key === "today") return today;
  if (key === "7d") return new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000);
  if (key === "30d") return new Date(today.getTime() - 29 * 24 * 60 * 60 * 1000);
  if (key === "month") {
    const [year, month] = todayKeyInSaoPaulo(now).split("-").map(Number);
    return new Date(`${year}-${String(month).padStart(2, "0")}-01T00:00:00-03:00`);
  }
  return null;
};

const getCursorPayload = (cursor) => {
  const raw = clean(cursor);
  if (!raw) return null;
  try {
    return JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
  } catch {
    return null;
  }
};

const makeCursor = (payload) => Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");

const parseListQuery = (query = {}) => {
  const sort = clean(query.sort);
  const direction = clean(query.direction) === "asc" ? "asc" : "desc";
  const limit = Math.min(Math.max(Number(query.limit) || LIST_PAGE_SIZE, 1), MAX_LIST_PAGE_SIZE);
  return {
    pipelineId: clean(query.pipelineId),
    stageId: clean(query.stageId),
    status: clean(query.status),
    ownerId: clean(query.ownerId),
    source: clean(query.source),
    activityState: clean(query.activityState),
    createdRange: clean(query.createdRange),
    search: clean(query.search),
    sort: ["createdAt", "updatedAt", "value", "nextActivity", "name"].includes(sort) ? sort : "updatedAt",
    direction,
    cursor: clean(query.cursor),
    limit,
  };
};

const listSignature = (params) => JSON.stringify({
  pipelineId: params.pipelineId,
  stageId: params.stageId,
  status: params.status,
  ownerId: params.ownerId,
  source: params.source,
  activityState: params.activityState,
  createdRange: params.createdRange,
  search: normalizeSearchText(params.search),
  sort: params.sort,
  direction: params.direction,
});

const opportunityMatchesListParams = (opportunity, params, now = new Date()) => {
  if (opportunity.discardedAt) return false;
  if (params.pipelineId && opportunity.pipelineId !== params.pipelineId) return false;
  if (params.stageId && opportunity.stageId !== params.stageId) return false;
  if (params.status && opportunity.status !== params.status) return false;
  if (params.ownerId && (opportunity.ownerId || "") !== params.ownerId) return false;
  if (params.source && normalizeSearchText(opportunity.source) !== normalizeSearchText(params.source)) return false;
  if (params.activityState && params.activityState !== "all" && activityStateForOpportunity(opportunity, now) !== params.activityState) return false;
  const createdStart = createdRangeStart(params.createdRange);
  if (createdStart) {
    const createdAtMs = Date.parse(opportunity.createdAt || "");
    if (!Number.isFinite(createdAtMs) || createdAtMs < createdStart.getTime()) return false;
  }
  const query = normalizeSearchText(params.search);
  if (query) {
    const phoneQuery = normalizeSearchPhone(params.search);
    const contact = opportunity.contact || {};
    const textMatches = [
      opportunity.searchTitle || opportunity.title,
      opportunity.id,
      contact.searchName || contact.name,
      contact.searchEmail || contact.email,
    ].some((value) => normalizeSearchText(value).includes(query));
    const phoneMatches = phoneQuery && normalizeSearchPhone(contact.searchPhone || contact.phone).includes(phoneQuery);
    if (!textMatches && !phoneMatches) return false;
  }
  return true;
};

const compareListRows = (params) => (left, right) => {
  const dir = params.direction === "asc" ? 1 : -1;
  const valueFor = (row) => {
    if (params.sort === "value") return Number(row.value) || 0;
    if (params.sort === "nextActivity") return row.nextActivityAt ? Date.parse(row.nextActivityAt) || Number.MAX_SAFE_INTEGER : Number.MAX_SAFE_INTEGER;
    if (params.sort === "name") return normalizeSearchText(row.contact?.name || row.title);
    if (params.sort === "createdAt") return Date.parse(row.createdAt || "") || 0;
    return Date.parse(row.updatedAt || row.createdAt || "") || 0;
  };
  const a = valueFor(left);
  const b = valueFor(right);
  if (typeof a === "string" || typeof b === "string") {
    const result = String(a).localeCompare(String(b), "pt-BR");
    if (result !== 0) return result * dir;
  } else if (a !== b) {
    return (a > b ? 1 : -1) * dir;
  }
  return String(right.updatedAt || right.createdAt || "").localeCompare(String(left.updatedAt || left.createdAt || ""));
};

const docName = (collection, id) => {
  if (!PROJECT_ID || !clean(collection) || !clean(id)) throw Object.assign(new Error("invalid_firestore_document_name"), { status: 500 });
  return `projects/${PROJECT_ID}/databases/(default)/documents/${clean(collection)}/${encodeURIComponent(clean(id))}`;
};

const buildWrite = (collection, id, data, options = {}) => ({
  update: { name: docName(collection, id), fields: encodeFields(data).fields },
  ...(options.createOnly ? { currentDocument: { exists: false } } : {}),
});

const isAlreadyExistsResponse = (response) => {
  const raw = `${response?.status || ""} ${JSON.stringify(response?.data || {})} ${String(response?.text || "")}`.toLowerCase();
  return raw.includes("already_exists") || raw.includes("already exists") || raw.includes("exists");
};

const eventWrite = ({ type, opportunityId, contactId, actorId, payload, stamp }) => {
  const id = newId("event");
  return buildWrite(COLLECTIONS.events, id, {
    id,
    scopeId: CRM_SCOPE_ID,
    type,
    opportunityId: opportunityId || null,
    contactId: contactId || null,
    actorId: clean(actorId) || null,
    payload: payload || {},
    createdAt: stamp,
  });
};

const ensureDefaultPipeline = async () => {
  const [pipelinesRaw, stagesRaw] = await Promise.all([
    listCollectionAsAdmin(COLLECTIONS.pipelines, { maxPages: 5 }),
    listCollectionAsAdmin(COLLECTIONS.stages, { maxPages: 5 }),
  ]);
  const pipelines = pipelinesRaw.map(normalizePipeline).filter((row) => row.id);
  const stages = stagesRaw.map(normalizeStage).filter((row) => row.id);
  const scopedPipelines = pipelines.filter((row) => row.scopeId === CRM_SCOPE_ID || (!clean(row.scopeId) && row.id === DEFAULT_PIPELINE_ID));
  const activePipelines = scopedPipelines.filter((row) => row.isActive);
  const active = activePipelines.find((row) => row.isDefault) || activePipelines.find((row) => row.id === DEFAULT_PIPELINE_ID) || activePipelines[0] || null;
  if (active) {
    const scopedStages = stages.filter((stage) => stage.pipelineId === active.id && (stage.scopeId === CRM_SCOPE_ID || !clean(stage.scopeId)));
    const existingStageIds = new Set(scopedStages.map((stage) => stage.id));
    const stamp = nowIso();
    const closerPipeline = scopedPipelines.find((pipeline) => pipeline.pipelineType === "closer") || {
      id: "closer",
      scopeId: CRM_SCOPE_ID,
      name: "Closer",
      pipelineType: "closer",
      isActive: true,
      isDefault: false,
      createdAt: stamp,
      updatedAt: stamp,
    };
    const closerStage = stages.find((stage) => stage.pipelineId === closerPipeline.id && (stage.scopeId === CRM_SCOPE_ID || !clean(stage.scopeId))) || {
      id: `${closerPipeline.id}_stage_1`,
      scopeId: CRM_SCOPE_ID,
      pipelineId: closerPipeline.id,
      name: "Recebido",
      position: 1,
      requiresQualification: false,
      requiresQualificationToExit: false,
      qualificationGate: null,
      handoffTargetPipelineId: null,
      handoffTargetStageId: null,
      createdAt: stamp,
      updatedAt: stamp,
    };
    const missingStages = DEFAULT_STAGES.map((name, index) => ({
      id: `${active.id}_stage_${index + 1}`,
      scopeId: CRM_SCOPE_ID,
      pipelineId: active.id,
      name,
      position: index + 1,
      requiresQualification: index === 0,
      requiresQualificationToExit: index === 0,
      qualificationGate: index === 0 ? qualification.QUALIFICATION_TYPE_SDR : null,
      handoffTargetPipelineId: index === 0 ? closerPipeline.id : null,
      handoffTargetStageId: index === 0 ? closerStage.id : null,
      createdAt: stamp,
      updatedAt: stamp,
    })).filter((stage) => !existingStageIds.has(stage.id));
    const hasQualificationGate = scopedStages.concat(missingStages).some(qualification.stageRequiresQualification);
    const gateStage = scopedStages
      .slice()
      .sort((left, right) => Number(left.position || 0) - Number(right.position || 0))[0] || null;
    const gateWrites = !hasQualificationGate && gateStage
      ? [buildWrite(COLLECTIONS.stages, gateStage.id, {
          ...gateStage,
          requiresQualification: true,
          requiresQualificationToExit: true,
          qualificationGate: qualification.QUALIFICATION_TYPE_SDR,
          handoffTargetPipelineId: gateStage.handoffTargetPipelineId || closerPipeline.id,
          handoffTargetStageId: gateStage.handoffTargetStageId || closerStage.id,
          updatedAt: stamp,
        })]
      : [];
    const pipelineTypeWrites = [
      active.pipelineType === "general" ? buildWrite(COLLECTIONS.pipelines, active.id, { ...active, pipelineType: "sdr", updatedAt: stamp }) : null,
      scopedPipelines.some((pipeline) => pipeline.id === closerPipeline.id) ? null : buildWrite(COLLECTIONS.pipelines, closerPipeline.id, closerPipeline, { createOnly: true }),
      stages.some((stage) => stage.id === closerStage.id) ? null : buildWrite(COLLECTIONS.stages, closerStage.id, closerStage, { createOnly: true }),
    ].filter(Boolean);
    const defaultWrites = activePipelines.some((row) => row.isDefault)
      ? []
      : scopedPipelines.map((pipeline) => buildWrite(COLLECTIONS.pipelines, pipeline.id, { ...pipeline, isDefault: pipeline.id === active.id, updatedAt: stamp }));
    if (!missingStages.length && !defaultWrites.length && !gateWrites.length && !pipelineTypeWrites.length) return { pipelines: scopedPipelines, stages: scopedStages };
    const committed = await commitWritesAsAdmin({
      writes: [...missingStages.map((stage) => buildWrite(COLLECTIONS.stages, stage.id, stage, { createOnly: true })), ...defaultWrites, ...gateWrites, ...pipelineTypeWrites],
    });
    if (!committed.ok && !isAlreadyExistsResponse(committed)) throw Object.assign(new Error("crm_bootstrap_failed"), { status: committed.status || 500 });
    return ensureDefaultPipeline();
  }

  const stamp = nowIso();
  const pipeline = { id: DEFAULT_PIPELINE_ID, scopeId: CRM_SCOPE_ID, name: "Comercial", pipelineType: "sdr", isActive: true, isDefault: true, createdAt: stamp, updatedAt: stamp };
  const closerPipeline = { id: "closer", scopeId: CRM_SCOPE_ID, name: "Closer", pipelineType: "closer", isActive: true, isDefault: false, createdAt: stamp, updatedAt: stamp };
  const closerStage = {
    id: "closer_stage_1",
    scopeId: CRM_SCOPE_ID,
    pipelineId: closerPipeline.id,
    name: "Recebido",
    position: 1,
    requiresQualification: false,
    requiresQualificationToExit: false,
    qualificationGate: null,
    handoffTargetPipelineId: null,
    handoffTargetStageId: null,
    createdAt: stamp,
    updatedAt: stamp,
  };
  const seededStages = DEFAULT_STAGES.map((name, index) => ({
    id: `${DEFAULT_PIPELINE_ID}_stage_${index + 1}`,
    scopeId: CRM_SCOPE_ID,
    pipelineId: pipeline.id,
    name,
    position: index + 1,
    requiresQualification: index === 0,
    requiresQualificationToExit: index === 0,
    qualificationGate: index === 0 ? qualification.QUALIFICATION_TYPE_SDR : null,
    handoffTargetPipelineId: index === 0 ? closerPipeline.id : null,
    handoffTargetStageId: index === 0 ? closerStage.id : null,
    createdAt: stamp,
    updatedAt: stamp,
  }));
  const committed = await commitWritesAsAdmin({
    writes: [
      buildWrite(COLLECTIONS.pipelines, pipeline.id, pipeline, { createOnly: true }),
      buildWrite(COLLECTIONS.pipelines, closerPipeline.id, closerPipeline, { createOnly: true }),
      ...seededStages.map((stage) => buildWrite(COLLECTIONS.stages, stage.id, stage, { createOnly: true })),
      buildWrite(COLLECTIONS.stages, closerStage.id, closerStage, { createOnly: true }),
    ],
  });
  if (!committed.ok) {
    if (isAlreadyExistsResponse(committed)) return ensureDefaultPipeline();
    throw Object.assign(new Error("crm_bootstrap_failed"), { status: committed.status || 500 });
  }
  return { pipelines: [pipeline, closerPipeline], stages: seededStages.concat(closerStage) };
};

const loadCrmReadModel = async (options = {}) => {
  const startedAt = Date.now();
  const marks = {};
  const mark = (key) => {
    marks[key] = Date.now() - startedAt;
  };
  const user = options.user && (options.user.role || options.user.tipo || options.user.type) ? options.user : { role: "admin", commercialRoles: [] };
  const perf = options.perf || null;
  const workspace = commercialPermissions.normalizeWorkspace(options.workspace);
  const visibleTypes = commercialPermissions.visiblePipelineTypesForUser(user, workspace);
  if (!visibleTypes.length) throw Object.assign(new Error("commercial_workspace_forbidden"), { status: 403 });
  const seeded = await (perf ? perf.measure("pipelineResolution", ensureDefaultPipeline, { firestore: true }) : ensureDefaultPipeline());
  mark("pipeline_ms");
  const [contactsRaw, opportunitiesRaw, usersRaw] = await Promise.all([
    (perf ? perf.measure("contacts_readModel", () => listCollectionAsAdmin(COLLECTIONS.contacts, { maxPages: 50 }), { firestore: true }) : listCollectionAsAdmin(COLLECTIONS.contacts, { maxPages: 50 })).catch(() => []),
    (perf ? perf.measure("opportunities", () => listCollectionAsAdmin(COLLECTIONS.opportunities, { maxPages: 50 }), { firestore: true }) : listCollectionAsAdmin(COLLECTIONS.opportunities, { maxPages: 50 })).catch(() => []),
    (perf ? perf.measure("commercialPermissions", () => listCollectionAsAdmin(COLLECTIONS.users, { maxPages: 20, decorate: false }), { firestore: true }) : listCollectionAsAdmin(COLLECTIONS.users, { maxPages: 20, decorate: false })).catch(() => []),
  ]);
  mark("collections_ms");
  if (perf) {
    perf.set("contactsCount", contactsRaw.length);
    perf.set("opportunitiesCount", opportunitiesRaw.length);
    perf.set("usersCount", usersRaw.length);
  }
  const contacts = contactsRaw.map(normalizeContact).filter((row) => row.id);
  const scopedContacts = contacts.filter(matchesCrmScope);
  const contactsById = new Map(scopedContacts.map((row) => [row.id, row]));
  const owners = usersRaw
    .filter((row) => normalizeRole(row.role || row.tipo || row.type) === "growth" || clean(row.tipo) === "growth")
    .map((row) => ({ id: clean(row.uid || row.id || row.firestoreDocId), name: clean(row.nome || row.name || row.email || row.uid || row.id), email: clean(row.email) }))
    .filter((row) => row.id);
  const ownersById = new Map(owners.map((row) => [row.id, row]));
  const usersById = new Map(usersRaw.map((row) => {
    const id = clean(row.uid || row.id || row.firestoreDocId);
    return [id, { id, name: clean(row.nome || row.name || row.displayName || row.email || id), email: clean(row.email) }];
  }).filter(([id]) => id));
  const visiblePipelineIds = new Set(seeded.pipelines.filter((pipeline) => visibleTypes.includes(pipeline.pipelineType)).map((pipeline) => pipeline.id));
  const opportunities = opportunitiesRaw
    .map(normalizeOpportunity)
    .filter((row) => row.id && matchesCrmScope(row) && !row.deletedAt && visiblePipelineIds.has(row.pipelineId))
    .map((row) => ({
      ...row,
      contact: contactsById.get(row.contactId) || null,
      owner: row.ownerId ? ownersById.get(row.ownerId) || null : null,
      closedByUser: row.closedBy ? usersById.get(row.closedBy) || null : null,
    }))
    .sort((left, right) => String(right.updatedAt || right.createdAt || "").localeCompare(String(left.updatedAt || left.createdAt || "")));
  const model = {
    pipelines: seeded.pipelines.filter((pipeline) => visibleTypes.includes(pipeline.pipelineType)),
    stages: seeded.stages.filter((stage) => visiblePipelineIds.has(stage.pipelineId)).sort((a, b) => a.position - b.position),
    contacts: scopedContacts,
    opportunities,
    owners,
    permissions: {
      commercialRoles: commercialPermissions.normalizeCommercialRoles(user.commercialRoles),
      visibleWorkspaces: visibleTypes,
      workspace: workspace || visibleTypes[0] || "",
    },
    generatedAt: nowIso(),
  };
  mark("response_build_ms");
  const totalMs = Date.now() - startedAt;
  if (totalMs > 2000) {
    console.warn("[crm] slow read model", {
      totalMs,
      ...marks,
      workspace: workspace || visibleTypes[0] || "",
      visibleTypes,
      pipelines: model.pipelines.length,
      stages: model.stages.length,
      opportunities: model.opportunities.length,
      contacts: model.contacts.length,
      owners: model.owners.length,
    });
  }
  return model;
};

const findOrBuildContact = ({ contacts, body, stamp }) => {
  const name = clean(body.name || body.contactName);
  const phone = clean(body.phone);
  const email = clean(body.email);
  const countryCode = normalizeCountryCode(body.countryCode || body.country);
  if (!name) throw Object.assign(new Error("contact_name_required"), { status: 400 });
  const targetIdentity = normalizeCrmContactIdentity({ phone, email });
  const existing = contacts.find((contact) => {
    if (identitiesMatch(contact, targetIdentity)) return true;
    const sameEmail = email && lower(contact.email) === lower(email);
    const samePhone = phone && clean(contact.phone).replace(/\D/g, "") === phone.replace(/\D/g, "");
    return sameEmail || samePhone;
  });
  if (existing) {
    const contact = {
      ...existing,
      name: existing.name || name,
      phone: existing.phone || phone,
      email: existing.email || email,
      countryCode: countryCode || existing.countryCode || "",
      updatedAt: stamp,
    };
    return { contact: { ...contact, ...contactSearchFields(contact) }, isNew: false };
  }
  const id = newId("contact");
  const contact = { id, scopeId: CRM_SCOPE_ID, name, phone, email, countryCode, createdAt: stamp, updatedAt: stamp };
  return { contact: { ...contact, ...contactSearchFields(contact) }, isNew: true };
};

const validatePipelineStage = (readModel, pipelineId, stageId) => {
  if (!readModel.pipelines.some((row) => row.id === pipelineId && row.isActive)) throw Object.assign(new Error("invalid_pipeline"), { status: 400 });
  if (!readModel.stages.some((row) => row.id === stageId && row.pipelineId === pipelineId)) throw Object.assign(new Error("invalid_stage"), { status: 400 });
};

const getOpportunityById = async (id) => {
  try {
    const row = normalizeOpportunity(await getDocumentAsAdmin(`${COLLECTIONS.opportunities}/${encodeURIComponent(clean(id))}`));
    return row.id && matchesCrmScope(row) ? row : null;
  } catch {
    return null;
  }
};

const createOpportunity = async ({ actorUid = "", input = {}, idempotencyKey = "", user = {} } = {}) => {
  const readModel = await loadCrmReadModel({ user, workspace: "sdr" });
  const activePipelines = readModel.pipelines.filter((p) => p.isActive);
  const pipelineId = clean(input.pipelineId) || activePipelines.find((p) => p.isDefault)?.id || activePipelines[0]?.id || DEFAULT_PIPELINE_ID;
  const stageId = clean(input.stageId) || readModel.stages.find((s) => s.pipelineId === pipelineId)?.id;
  validatePipelineStage(readModel, pipelineId, stageId);
  const pipeline = readModel.pipelines.find((row) => row.id === pipelineId);
  if (!pipeline || pipeline.pipelineType !== "sdr") throw Object.assign(new Error("invalid_pipeline"), { status: 400 });
  if (!commercialPermissions.canPerformCrmAction({ user, action: "create_opportunity", pipelineType: pipeline.pipelineType })) {
    throw Object.assign(new Error("commercial_workspace_forbidden"), { status: 403 });
  }

  const stamp = nowIso();
  const { contact } = findOrBuildContact({ contacts: readModel.contacts, body: input, stamp });
  const title = clean(input.title) || contact.name;
  const opportunityId = idempotencyKey ? stableIdFromKey("opp_auto", idempotencyKey, 28) : newId("opp");
  const existing = idempotencyKey ? await getOpportunityById(opportunityId) : null;
  if (existing?.automationIdempotencyKey === idempotencyKey) return { ok: true, opportunityId: existing.id, idempotent: true };

  const opportunity = {
    id: opportunityId,
    scopeId: CRM_SCOPE_ID,
    contactId: contact.id,
    pipelineId,
    stageId,
    title,
    value: numberOrNull(input.value),
    currency: normalizeCurrency(input.currency),
    ownerId: clean(input.ownerId) || null,
    source: clean(input.source) || null,
    status: "open",
    lostReason: null,
    lostReasonNote: null,
    closedAt: null,
    closedBy: null,
    closedValue: null,
    expectedCloseDate: normalizeDateOnly(input.expectedCloseDate),
    automationIdempotencyKey: idempotencyKey || null,
    createdAt: stamp,
    updatedAt: stamp,
  };
  Object.assign(opportunity, opportunitySearchFields(opportunity));
  const committed = await commitWritesAsAdmin({
    writes: [
      buildWrite(COLLECTIONS.contacts, contact.id, contact),
      buildWrite(COLLECTIONS.opportunities, opportunity.id, opportunity, idempotencyKey ? { createOnly: true } : {}),
      eventWrite({ type: "crm.opportunity.created", opportunityId: opportunity.id, contactId: contact.id, actorId: actorUid, payload: { pipelineId, stageId, title }, stamp }),
    ],
  });
  if (committed.ok) return { ok: true, opportunityId: opportunity.id, idempotent: false };
  if (idempotencyKey && isAlreadyExistsResponse(committed)) {
    const retryExisting = await getOpportunityById(opportunityId);
    if (retryExisting?.automationIdempotencyKey === idempotencyKey) return { ok: true, opportunityId: retryExisting.id, idempotent: true };
  }
  throw Object.assign(new Error("crm_create_failed"), { status: committed.status || 500 });
};

const loadCrmListModel = async (query = {}, options = {}) => {
  const model = await loadCrmReadModel({ user: options.user, workspace: query.workspace || options.workspace, perf: options.perf });
  const params = parseListQuery(query);
  if (!params.pipelineId) params.pipelineId = model.pipelines.find((pipeline) => pipeline.isActive)?.id || model.pipelines[0]?.id || "";
  const signature = listSignature(params);
  const cursorPayload = getCursorPayload(params.cursor);
  const offset = cursorPayload?.signature === signature ? Math.max(Number(cursorPayload.offset) || 0, 0) : 0;
  const now = new Date();
  const filtered = model.opportunities
    .filter((opportunity) => opportunityMatchesListParams(opportunity, params, now))
    .sort(compareListRows(params));
  const rows = filtered.slice(offset, offset + params.limit).map((opportunity) => ({
    ...opportunity,
    activityState: activityStateForOpportunity(opportunity, now),
  }));
  const nextOffset = offset + rows.length;
  return {
    rows,
    nextCursor: nextOffset < filtered.length ? makeCursor({ offset: nextOffset, signature }) : "",
    totalVisible: filtered.length,
    pageSize: params.limit,
    filters: {
      pipelineId: params.pipelineId,
      stageId: params.stageId,
      status: params.status,
      ownerId: params.ownerId,
      source: params.source,
      activityState: params.activityState || "all",
      createdRange: params.createdRange,
      search: params.search,
    },
    sort: { field: params.sort, direction: params.direction },
    generatedAt: nowIso(),
  };
};

const hasOpenOpportunityForContact = async ({ phone = "", email = "", contactId = "" } = {}) => {
  const model = await loadCrmReadModel();
  const target = { phone, email };
  const matchingContactIds = new Set(
    model.contacts
      .filter((contact) => (contactId && contact.id === contactId) || identitiesMatch(contact, target))
      .map((contact) => contact.id)
  );
  const opportunities = model.opportunities.filter((opportunity) => {
    if (opportunity.status !== "open") return false;
    if (contactId && opportunity.contactId === contactId) return true;
    if (matchingContactIds.has(opportunity.contactId)) return true;
    return identitiesMatch(opportunity.contact || {}, target);
  });
  return { matched: opportunities.length > 0, opportunities };
};

module.exports = {
  COLLECTIONS,
  CRM_SCOPE_ID,
  createOpportunity,
  hasOpenOpportunityForContact,
  loadCrmListModel,
  loadCrmReadModel,
  normalizeContact,
  normalizeOpportunity,
  normalizePipeline,
  normalizeStage,
};
