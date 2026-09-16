const crypto = require("crypto");

const { sendJson } = require("../_lib/http");
const { getSessionFromRequest } = require("../_lib/session");
const {
  commitWritesAsAdmin,
  getDocumentAsAdmin,
  listCollectionAsAdmin,
} = require("./_lib/firestore-admin");
const { PROJECT_ID, encodeFields } = require("./_lib/firestore-rest");

const COLLECTIONS = {
  pipelines: "crmPipelines",
  stages: "crmStages",
  contacts: "crmContacts",
  opportunities: "crmOpportunities",
  stageHistory: "crmOpportunityStageHistory",
  events: "crmEvents",
  users: "users",
};

const DEFAULT_PIPELINE_ID = "commercial";
const DEFAULT_STAGES = ["Novo lead", "Em contato", "Reunião", "Negociação"];
const VALID_STATUS = new Set(["open", "won", "lost"]);
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
const lower = (value) => clean(value).toLowerCase();
const matchesCrmScope = (row) => clean(row?.scopeId) === CRM_SCOPE_ID || !clean(row?.scopeId);

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
  createdAt: toIso(row.createdAt),
  updatedAt: toIso(row.updatedAt),
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

const sanitizeFirestoreDiagnostic = (value) => {
  if (!value) return null;
  if (typeof value === "string") return value.slice(0, 700);
  if (typeof value === "object") {
    const error = value.error && typeof value.error === "object" ? value.error : value;
    return {
      code: clean(error.status || error.code),
      message: clean(error.message).slice(0, 700),
    };
  }
  return String(value).slice(0, 700);
};

const logCrmFirestoreFailure = ({ operation, scopeId = CRM_SCOPE_ID, response, error } = {}) => {
  const detail = response
    ? sanitizeFirestoreDiagnostic(response.data || response.text)
    : sanitizeFirestoreDiagnostic(error?.details || error?.message || error);
  console.error("[crm] firestore operation failed", {
    operation: clean(operation),
    scopeId,
    status: response?.status || error?.status || null,
    code: clean(error?.code || detail?.code || ""),
    message: detail?.message || (typeof detail === "string" ? detail : ""),
  });
};

const isAlreadyExistsResponse = (response) => {
  const raw = `${response?.status || ""} ${JSON.stringify(response?.data || {})} ${String(response?.text || "")}`.toLowerCase();
  return raw.includes("already_exists") || raw.includes("already exists") || raw.includes("exists");
};

const buildWrite = (collection, id, data, options = {}) => ({
  update: {
    name: docName(collection, id),
    fields: encodeFields(data).fields,
  },
  ...(options.createOnly ? { currentDocument: { exists: false } } : {}),
});

const ensureDefaultPipeline = async () => {
  let pipelinesRaw = [];
  let stagesRaw = [];
  try {
    [pipelinesRaw, stagesRaw] = await Promise.all([
      listCollectionAsAdmin(COLLECTIONS.pipelines, { maxPages: 5 }),
      listCollectionAsAdmin(COLLECTIONS.stages, { maxPages: 5 }),
    ]);
  } catch (error) {
    logCrmFirestoreFailure({ operation: "crm.bootstrap.read_existing", error });
    throw error;
  }
  const pipelines = pipelinesRaw.map(normalizePipeline).filter((row) => row.id);
  const stages = stagesRaw.map(normalizeStage).filter((row) => row.id);
  const inScopePipeline = (row) => row.scopeId === CRM_SCOPE_ID || (!clean(row.scopeId) && row.id === DEFAULT_PIPELINE_ID);
  const scopedPipelines = pipelines.filter(inScopePipeline);
  const active = scopedPipelines.find((row) => row.isActive) || scopedPipelines[0] || null;
  if (active) {
    const scopedStages = stages.filter((stage) => stage.pipelineId === active.id && (stage.scopeId === CRM_SCOPE_ID || !clean(stage.scopeId)));
    const existingStageIds = new Set(scopedStages.map((stage) => stage.id));
    const stamp = nowIso();
    const missingStages = DEFAULT_STAGES
      .map((name, index) => ({
        id: `${active.id}_stage_${index + 1}`,
        scopeId: CRM_SCOPE_ID,
        pipelineId: active.id,
        name,
        position: index + 1,
        createdAt: stamp,
        updatedAt: stamp,
      }))
      .filter((stage) => !existingStageIds.has(stage.id));
    if (missingStages.length) {
      const committed = await commitWritesAsAdmin({
        writes: missingStages.map((stage) => buildWrite(COLLECTIONS.stages, stage.id, stage, { createOnly: true })),
      });
      if (!committed.ok && !isAlreadyExistsResponse(committed)) {
        logCrmFirestoreFailure({ operation: "crm.bootstrap.create_missing_stages", response: committed });
        const error = new Error("crm_bootstrap_failed");
        error.status = committed.status || 500;
        throw error;
      }
      return ensureDefaultPipeline();
    }
    return { pipelines: scopedPipelines, stages: scopedStages };
  }

  const stamp = nowIso();
  const pipeline = {
    id: DEFAULT_PIPELINE_ID,
    scopeId: CRM_SCOPE_ID,
    name: "Comercial",
    isActive: true,
    createdAt: stamp,
    updatedAt: stamp,
  };
  const seededStages = DEFAULT_STAGES.map((name, index) => ({
    id: `${DEFAULT_PIPELINE_ID}_stage_${index + 1}`,
    scopeId: CRM_SCOPE_ID,
    pipelineId: pipeline.id,
    name,
    position: index + 1,
    createdAt: stamp,
    updatedAt: stamp,
  }));
  const writes = [
    buildWrite(COLLECTIONS.pipelines, pipeline.id, pipeline, { createOnly: true }),
    ...seededStages.map((stage) => buildWrite(COLLECTIONS.stages, stage.id, stage, { createOnly: true })),
  ];
  const committed = await commitWritesAsAdmin({ writes });
  if (!committed.ok) {
    if (isAlreadyExistsResponse(committed)) return ensureDefaultPipeline();
    logCrmFirestoreFailure({ operation: "crm.bootstrap.create_default_pipeline", response: committed });
    const error = new Error("crm_bootstrap_failed");
    error.status = committed.status || 500;
    throw error;
  }
  return { pipelines: [pipeline], stages: seededStages };
};

const loadCrmReadModel = async () => {
  const seeded = await ensureDefaultPipeline();
  const [contactsRaw, opportunitiesRaw, usersRaw] = await Promise.all([
    listCollectionAsAdmin(COLLECTIONS.contacts, { maxPages: 50 }).catch(() => []),
    listCollectionAsAdmin(COLLECTIONS.opportunities, { maxPages: 50 }).catch(() => []),
    listCollectionAsAdmin(COLLECTIONS.users, { maxPages: 20 }).catch(() => []),
  ]);

  const contacts = contactsRaw.map(normalizeContact).filter((row) => row.id);
  const scopedContacts = contacts.filter(matchesCrmScope);
  const contactsById = new Map(scopedContacts.map((row) => [row.id, row]));
  const owners = usersRaw
    .filter((row) => normalizeRole(row.role || row.tipo || row.type) === "growth" || clean(row.tipo) === "growth")
    .map((row) => ({
      id: clean(row.uid || row.id || row.firestoreDocId),
      name: clean(row.nome || row.name || row.email || row.uid || row.id),
      email: clean(row.email),
    }))
    .filter((row) => row.id);
  const ownersById = new Map(owners.map((row) => [row.id, row]));
  const opportunities = opportunitiesRaw
    .map(normalizeOpportunity)
    .filter((row) => row.id && matchesCrmScope(row) && !row.deletedAt)
    .map((row) => ({
      ...row,
      contact: contactsById.get(row.contactId) || null,
      owner: row.ownerId ? ownersById.get(row.ownerId) || null : null,
    }))
    .sort((left, right) => String(right.updatedAt || right.createdAt || "").localeCompare(String(left.updatedAt || left.createdAt || "")));

  return {
    pipelines: seeded.pipelines,
    stages: seeded.stages.sort((left, right) => left.position - right.position),
    contacts: scopedContacts,
    opportunities,
    owners,
    generatedAt: nowIso(),
  };
};

const findOrBuildContact = ({ contacts, body, stamp }) => {
  const name = clean(body.name || body.contactName);
  const phone = clean(body.phone);
  const email = clean(body.email);
  if (!name) {
    const error = new Error("contact_name_required");
    error.status = 400;
    throw error;
  }
  const existing = contacts.find((contact) => {
    const sameEmail = email && lower(contact.email) === lower(email);
    const samePhone = phone && clean(contact.phone).replace(/\D/g, "") === phone.replace(/\D/g, "");
    return sameEmail || samePhone;
  });
  if (existing) {
    return {
      contact: {
        ...existing,
        name: existing.name || name,
        phone: existing.phone || phone,
        email: existing.email || email,
        updatedAt: stamp,
      },
      isNew: false,
    };
  }
  const id = newId("contact");
  return {
    contact: { id, scopeId: CRM_SCOPE_ID, name, phone, email, createdAt: stamp, updatedAt: stamp },
    isNew: true,
  };
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

const handleCreateOpportunity = async ({ session, body }) => {
  const readModel = await loadCrmReadModel();
  const pipelineId = clean(body.pipelineId) || readModel.pipelines.find((p) => p.isActive)?.id || DEFAULT_PIPELINE_ID;
  const stageId = clean(body.stageId) || readModel.stages.find((s) => s.pipelineId === pipelineId)?.id;
  if (!readModel.pipelines.some((row) => row.id === pipelineId)) return { status: 400, body: { error: "invalid_pipeline" } };
  if (!readModel.stages.some((row) => row.id === stageId && row.pipelineId === pipelineId)) return { status: 400, body: { error: "invalid_stage" } };

  const stamp = nowIso();
  const { contact } = findOrBuildContact({ contacts: readModel.contacts, body, stamp });
  const title = clean(body.title) || contact.name;
  const opportunityId = newId("opp");
  const opportunity = {
    id: opportunityId,
    scopeId: CRM_SCOPE_ID,
    contactId: contact.id,
    pipelineId,
    stageId,
    title,
    value: numberOrNull(body.value),
    currency: normalizeCurrency(body.currency),
    ownerId: clean(body.ownerId) || null,
    source: clean(body.source) || null,
    status: "open",
    lostReason: null,
    expectedCloseDate: normalizeDateOnly(body.expectedCloseDate),
    createdAt: stamp,
    updatedAt: stamp,
  };
  const writes = [
    buildWrite(COLLECTIONS.contacts, contact.id, contact),
    buildWrite(COLLECTIONS.opportunities, opportunity.id, opportunity),
    eventWrite({
      type: "crm.opportunity.created",
      opportunityId: opportunity.id,
      contactId: contact.id,
      actorId: clean(session.sub),
      payload: { pipelineId, stageId, title },
      stamp,
    }),
  ];
  const committed = await commitWritesAsAdmin({ writes });
  if (!committed.ok) return { status: committed.status || 500, body: { error: "crm_create_failed" } };
  return { status: 201, body: { ok: true, opportunityId: opportunity.id } };
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

module.exports = async (req, res) => {
  const auth = canAccessCrm(req);
  if (!auth.ok) return sendJson(res, auth.status, { error: auth.error });
  if (req.method === "GET" || req.method === "HEAD") {
    try {
      const model = await loadCrmReadModel();
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
        ? await handleCreateOpportunity({ session: auth.session, body })
        : action === "move_opportunity"
          ? await handleMoveOpportunity({ session: auth.session, body })
          : action === "update_opportunity"
            ? await handleUpdateOpportunity({ session: auth.session, body })
            : { status: 400, body: { error: "invalid_action" } };
    return sendJson(res, result.status, result.body);
  } catch (error) {
    console.error("[crm] write failed", error);
    return sendJson(res, error.status || 500, { error: error.message || "crm_write_failed" });
  }
};
