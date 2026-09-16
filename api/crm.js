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

const COLLECTIONS = {
  pipelines: "crmPipelines",
  stages: "crmStages",
  contacts: "crmContacts",
  opportunities: "crmOpportunities",
  activities: "crmActivities",
  stageHistory: "crmOpportunityStageHistory",
  events: "crmEvents",
  users: "users",
};

const VALID_STATUS = new Set(["open", "won", "lost"]);
const VALID_ACTIVITY_TYPES = new Set(["task", "call", "meeting", "follow_up"]);
const VALID_ACTIVITY_STATUS = new Set(["open", "completed", "cancelled"]);
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

const normalizeCurrency = (value) => {
  const raw = clean(value).toUpperCase();
  return raw || "BRL";
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
  isActive: row.isActive !== false,
  createdAt: toIso(row.createdAt),
  updatedAt: toIso(row.updatedAt),
});

const normalizeStage = (row) => ({
  id: clean(row.id || row.firestoreDocId),
  scopeId: clean(row.scopeId) || CRM_SCOPE_ID,
  pipelineId: clean(row.pipelineId),
  name: clean(row.name),
  position: Number(row.position) || 0,
  createdAt: toIso(row.createdAt),
  updatedAt: toIso(row.updatedAt),
});

const normalizeContact = (row) => ({
  id: clean(row.id || row.firestoreDocId),
  scopeId: clean(row.scopeId) || CRM_SCOPE_ID,
  name: clean(row.name),
  phone: clean(row.phone),
  email: clean(row.email),
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
  expectedCloseDate: normalizeDateOnly(row.expectedCloseDate),
  nextActivityId: clean(row.nextActivityId) || null,
  nextActivityAt: toIso(row.nextActivityAt),
  nextActivityType: clean(row.nextActivityType) || null,
  nextActivityTitle: clean(row.nextActivityTitle) || null,
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

const eventTitle = (event) => {
  if (event.type === "crm.opportunity.created") return "Oportunidade criada";
  if (event.type === "crm.opportunity.updated") return "Oportunidade editada";
  if (event.type === "crm.activity.created") return `${activityTypeLabel(event.payload?.activityType)} criada`;
  if (event.type === "crm.activity.updated") return `${activityTypeLabel(event.payload?.activityType)} atualizada`;
  if (event.type === "crm.activity.completed") return `${activityTypeLabel(event.payload?.activityType)} concluída`;
  if (event.type === "crm.activity.cancelled") return `${activityTypeLabel(event.payload?.activityType)} cancelada`;
  return clean(event.type).replace(/^crm\./, "");
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
      description: event.payload?.title || event.payload?.activityTitle || "",
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
  const [activities, timeline] = await Promise.all([
    loadActivitiesForOpportunity(opportunity.id),
    buildOpportunityTimeline(opportunity.id),
  ]);
  return { status: 200, body: { opportunityId: opportunity.id, activities, timeline, generatedAt: nowIso() } };
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
  const targetStage = stages.find((stage) => stage.id === toStageId);
  if (!targetStage || targetStage.pipelineId !== opportunity.pipelineId) return { status: 400, body: { error: "invalid_stage" } };
  if (opportunity.stageId === toStageId) return { status: 200, body: { ok: true, unchanged: true } };

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
      payload: { fromStageId: opportunity.stageId || null, toStageId },
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
    const stages = (await listCollectionAsAdmin(COLLECTIONS.stages, { maxPages: 10 }).catch(() => [])).map(normalizeStage).filter(matchesCrmScope);
    const targetStage = stages.find((stage) => stage.id === requestedStageId);
    if (!targetStage || targetStage.pipelineId !== requestedPipelineId) return { status: 400, body: { error: "invalid_stage" } };
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
    status: VALID_STATUS.has(clean(body.status)) ? clean(body.status) : opportunity.status,
    lostReason: clean(body.lostReason) || null,
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
      payload: { fromStageId: opportunity.stageId || null, toStageId: requestedStageId },
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
    const result =
      action === "create_opportunity"
        ? await handleCreateOpportunityViaService({ session: auth.session, body })
        : action === "move_opportunity"
          ? await handleMoveOpportunity({ session: auth.session, body })
          : action === "update_opportunity"
            ? await handleUpdateOpportunity({ session: auth.session, body })
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
