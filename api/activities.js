const { randomUUID } = require("node:crypto");
const { buildActivityEvent, planActivityChange, studentOf, EVENTS_COLLECTION } = require("./_lib/activity-events");
const { getGoogleAccessToken } = require("../_lib/google-service-account");
const { sendJson, readJsonBody } = require("./_lib/http");
const { getSessionFromRequest } = require("./_lib/session");
const { listCollectionAsAdmin } = require("./_lib/firestore-admin");
const { requireAdminPermission } = require("./_lib/admin-permissions");
const {
  buildActivityCommentNotifications,
  buildActivityMutationNotifications,
  buildChecklistAssignmentNotifications,
  buildChecklistCompletedNotifications,
  commitNotifications,
  resolveCommentMentions,
} = require("./_lib/notification-service");
const {
  FIRESTORE_BASE,
  decodeFields,
  encodeFields,
  getDocIdFromName,
  requestJson,
} = require("./_lib/firestore-rest");

const DATASTORE_SCOPE = "https://www.googleapis.com/auth/datastore";
const ACTIVITIES_COLLECTION = "activities";
const COMMENTS_COLLECTION = "activity_comments";
const CHECKLIST_COLLECTION = "activity_checklist";
const USERS_COLLECTION = "users";
const ALLOWED_STATUSES = new Set(["Pendente", "Em andamento", "Feito"]);
const ALLOWED_PRIORITIES = new Set(["Alta", "Média", "Baixa"]);

const normalizeRole = (value) => {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "admin" || raw === "administrador" || raw === "coord" || raw === "coordenacao") return "admin";
  if (raw === "teacher" || raw === "professor") return "teacher";
  if (raw === "growth") return "growth";
  return raw;
};

const normalizeUserRole = (value) => {
  const raw = String(value || "").trim().toLowerCase();
  if (["admin", "administrador"].includes(raw)) return "admin";
  if (["teacher", "professor"].includes(raw)) return "teacher";
  if (raw === "growth") return "growth";
  if (["student", "aluno"].includes(raw)) return "student";
  if (["finance", "financeiro"].includes(raw)) return "FINANCE";
  return raw;
};

const isAccessRole = (role) => ["admin", "teacher", "growth"].includes(normalizeRole(role));
const safeText = (value) => String(value || "").trim();
const userDocId = (row = {}) => safeText(row.firestoreDocId || row.id || row.uid || row.userId);
const normalizeOptionalDate = (value) => {
  const raw = safeText(value);
  if (!raw) return "";
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : "";
};

const normalizeUserIdentity = (row = {}) => {
  const id = userDocId(row);
  const name = safeText(row.nome || row.nomeCompleto || row.name || row.displayName || row.email || id);
  return {
    id,
    name,
    nome: name,
    email: safeText(row.email).toLowerCase(),
    role: normalizeUserRole(row.tipo || row.role),
    status: row.ativo === false ? "inactive" : "active",
    active: row.ativo !== false,
    ativo: row.ativo !== false,
    photoURL: safeText(row.photoURL || row.photoUrl || row.avatarURL || row.avatarUrl || row.picture || row.profileImage),
    photoStoragePath: safeText(row.photoStoragePath || row.avatarPath),
    avatarUpdatedAt: row.avatarUpdatedAt || row.updatedAt || row.atualizadoEm || null,
  };
};

const buildUserIdentityMap = (rows = []) => {
  const identities = {};
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const identity = normalizeUserIdentity(row);
    if (identity.id) identities[identity.id] = identity;
  });
  return identities;
};

const fallbackUserIdentity = ({ id = "", name = "", photoURL = "" } = {}) => {
  const safeId = safeText(id);
  const safeName = safeText(name || safeId || "Usuário");
  return {
    id: safeId,
    name: safeName,
    nome: safeName,
    email: "",
    role: "",
    status: "unknown",
    active: false,
    photoURL: safeText(photoURL),
    photoStoragePath: "",
    avatarUpdatedAt: null,
  };
};

const resolveUserIdentity = (identities = {}, id = "", fallback = {}) => {
  const safeId = safeText(id);
  const canonical = safeId ? identities[safeId] : null;
  if (canonical) return canonical;
  if (safeId || fallback.name || fallback.photoURL) return fallbackUserIdentity({ id: safeId, ...fallback });
  return null;
};

const decorateActivityIdentity = (activity = {}, identities = {}) => {
  const identity = resolveUserIdentity(identities, activity.responsavelId, { name: activity.responsavelNome });
  return {
    ...activity,
    responsavelNome: identity?.name || activity.responsavelNome || "",
    responsavelIdentity: identity,
  };
};

const decorateCommentIdentity = (comment = {}, identities = {}) => {
  const identity = resolveUserIdentity(identities, comment.authorId, {
    name: comment.authorNameSnapshot,
    photoURL: comment.authorPhotoSnapshot,
  });
  return {
    ...comment,
    authorNameSnapshot: identity?.name || comment.authorNameSnapshot || "Usuário",
    authorPhotoSnapshot: identity?.photoURL || comment.authorPhotoSnapshot || "",
    authorIdentity: identity,
  };
};

const decorateChecklistIdentity = (item = {}, identities = {}) => {
  const identity = resolveUserIdentity(identities, item.assigneeId, { name: item.assigneeNameSnapshot });
  return {
    ...item,
    assigneeNameSnapshot: identity?.name || item.assigneeNameSnapshot || "",
    assigneeIdentity: identity,
  };
};

const decorateWorkspaceIdentities = (workspace = {}, identities = {}) => ({
  ...workspace,
  activity: decorateActivityIdentity(workspace.activity || {}, identities),
  comments: (Array.isArray(workspace.comments) ? workspace.comments : []).map((comment) => decorateCommentIdentity(comment, identities)),
  checklist: (Array.isArray(workspace.checklist) ? workspace.checklist : []).map((item) => decorateChecklistIdentity(item, identities)),
});

const normalizeActivity = (row = {}) => {
  const status = ALLOWED_STATUSES.has(String(row.status || "").trim()) ? String(row.status).trim() : "Pendente";
  const prioridade = ALLOWED_PRIORITIES.has(String(row.prioridade || "").trim()) ? String(row.prioridade).trim() : "Média";
  const responsavelId = safeText(row.responsavelId);
  const tipo = safeText(row.tipo);
  return {
    completedAt: row.completedAt || null,
    completedBy: safeText(row.completedBy),
    responsavelNome: safeText(row.responsavelNome),
    isArchived: row.isArchived === true,
    archivedAt: row.archivedAt || null,
    archivedBy: safeText(row.archivedBy),
    hasStudentHistory: row.hasStudentHistory === true,
    revision: Number(row.revision) || 0,
    id: safeText(row.id),
    titulo: safeText(row.titulo),
    studentId: studentOf(row),
    descricao: safeText(row.descricao),
    status,
    responsavelId,
    prazo: normalizeOptionalDate(row.prazo),
    prioridade,
    tipo,
    criadoPor: safeText(row.criadoPor),
    criadoEm: row.criadoEm || null,
    atualizadoEm: row.atualizadoEm || null,
    observacoes: safeText(row.observacoes),
    comentarios: Array.isArray(row.comentarios) ? row.comentarios : [],
    commentsCount: Number(row.commentsCount) || 0,
    checklistTotal: Number(row.checklistTotal) || 0,
    checklistDone: Number(row.checklistDone) || 0,
  };
};

const normalizeComment = (row = {}) => ({
  id: safeText(row.id),
  activityId: safeText(row.activityId),
  studentId: studentOf(row),
  authorId: safeText(row.authorId),
  authorNameSnapshot: safeText(row.authorNameSnapshot || row.authorName || row.autorNome),
  authorPhotoSnapshot: safeText(row.authorPhotoSnapshot || row.authorPhoto || row.photoURL),
  body: safeText(row.body || row.text || row.texto || row.comentario),
  mentions: Array.isArray(row.mentions)
    ? row.mentions.map(mention => ({ userId: safeText(mention?.userId), displayName: safeText(mention?.displayName) })).filter(mention => mention.userId && mention.displayName)
    : [],
  createdAt: row.createdAt || row.criadoEm || null,
  editedAt: row.editedAt || null,
  deletedAt: row.deletedAt || null,
  deletedBy: safeText(row.deletedBy),
  legacy: row.legacy === true,
});

const normalizeChecklistItem = (row = {}) => ({
  id: safeText(row.id),
  activityId: safeText(row.activityId),
  title: safeText(row.title || row.titulo),
  completed: row.completed === true,
  completedAt: row.completedAt || null,
  completedBy: safeText(row.completedBy),
  assigneeId: safeText(row.assigneeId || row.responsavelId),
  assigneeNameSnapshot: safeText(row.assigneeNameSnapshot || row.responsavelNome),
  dueDate: normalizeOptionalDate(row.dueDate || row.prazo),
  createdAt: row.createdAt || row.criadoEm || null,
  createdBy: safeText(row.createdBy || row.criadoPor),
  updatedAt: row.updatedAt || row.atualizadoEm || null,
  deletedAt: row.deletedAt || null,
  deletedBy: safeText(row.deletedBy),
});

const canAccessActivity = (session, activity) => {
  const role = normalizeRole(session?.role);
  if (role === "admin") return true;
  const uid = safeText(session?.sub);
  return Boolean(uid && (activity.responsavelId === uid || activity.criadoPor === uid));
};

const canAssignResponsavel = (session, responsavelId) => {
  const role = normalizeRole(session?.role);
  const safeResponsavelId = safeText(responsavelId);
  if (role === "admin" || role === "growth") return true;
  if (!safeResponsavelId) return true;
  return safeResponsavelId === safeText(session?.sub);
};

const sortActivities = (rows) =>
  rows.slice().sort((a, b) => {
    const leftUpdated = a.atualizadoEm ? new Date(a.atualizadoEm).getTime() : 0;
    const rightUpdated = b.atualizadoEm ? new Date(b.atualizadoEm).getTime() : 0;
    if (leftUpdated !== rightUpdated) return rightUpdated - leftUpdated;
    return String(a.titulo || "").localeCompare(String(b.titulo || ""), "pt-BR");
  });

const listVisibleUsers = (session, rows) => {
  const role = normalizeRole(session?.role);
  const uid = safeText(session?.sub);
  const visibleRoles = role === "teacher" ? new Set(["teacher"]) : new Set(["admin", "growth", "FINANCE"]);
  return (Array.isArray(rows) ? rows : [])
    .map((row) => ({
      ...normalizeUserIdentity(row),
      id: userDocId(row),
      telefone: safeText(row.telefone),
    }))
    .filter((row) => row.id && row.nome && row.active && visibleRoles.has(row.role))
    .filter((row) => (role === "admin" || role === "growth" ? true : row.id === uid))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
};

const listActivityDirectoryUsers = (session, rows) => {
  const role = normalizeRole(session?.role);
  const uid = safeText(session?.sub);
  const visibleRoles = role === "teacher" ? new Set(["teacher"]) : new Set(["admin", "growth", "FINANCE"]);
  return (Array.isArray(rows) ? rows : [])
    .map((row) => ({
      ...normalizeUserIdentity(row),
      id: userDocId(row),
      telefone: safeText(row.telefone),
    }))
    .filter((row) => row.id && row.nome && row.active)
    .filter((row) => visibleRoles.has(row.role))
    .filter((row) => (role === "teacher" ? row.id === uid : true))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
};

const getAccessToken = async () => {
  const result = await getGoogleAccessToken({ scope: DATASTORE_SCOPE });
  return safeText(result?.accessToken);
};

const validId = id => /^[A-Za-z0-9_-]{1,128}$/.test(id);
const readDocument = async (collection, id) => {
  if (!validId(id)) throw Object.assign(new Error('invalid_id'), { status: 400 });
  const response = await requestJson(`${FIRESTORE_BASE}/${collection}/${id}`, { headers: { Authorization: `Bearer ${await getAccessToken()}` } });
  if (response.status === 404) return null;
  if (!response.ok) throw Object.assign(new Error('read_failed'), { status: response.status });
  return { row: { ...decodeFields(response.data), id }, updateTime: response.data.updateTime };
};
const readChildDocument = async (collection, id) => readDocument(collection, id);

const actorFromSession = (session = {}) => ({
  id: safeText(session.sub),
  name: safeText(session.nome || session.name || session.email || session.sub),
  photo: safeText(session.photoURL || session.picture || session.avatarUrl),
});

const resolveActivityCommentMentions = async ({ mentions = [], actorUserId = "" } = {}) => {
  if (!Array.isArray(mentions) || !mentions.length) return [];
  const userRows = await listCollectionAsAdmin(USERS_COLLECTION, { pageSize: 1500, decorate: false });
  return resolveCommentMentions({ mentions, users: userRows, actorUserId });
};

const notifyActivityComment = async ({ activity, comment, actor }) => {
  try {
    const notifications = buildActivityCommentNotifications({
      activity,
      comment,
      actor,
      mentions: Array.isArray(comment.mentions) ? comment.mentions : [],
    });
    await commitNotifications(notifications);
  } catch (error) {
    console.error("[api] activity comment notifications failed", error);
  }
};

const notifyActivityMutation = async ({ before, after, actor, eventId }) => {
  try {
    await commitNotifications(buildActivityMutationNotifications({ before, after, actor, eventId }));
  } catch (error) {
    console.error("[api] activity mutation notifications failed", error);
  }
};

const notifyChecklistMutation = async ({ activity, before = {}, after = {}, actor, eventId }) => {
  try {
    await commitNotifications([
      ...buildChecklistAssignmentNotifications({ activity, before, after, actor, eventId }),
      ...buildChecklistCompletedNotifications({ activity, before, after, actor, eventId }),
    ]);
  } catch (error) {
    console.error("[api] checklist notifications failed", error);
  }
};

const queryByField = async (collection, fieldPath, value) => {
  const safeValue = safeText(value);
  if (!safeValue) return [];
  const response = await requestJson(`${FIRESTORE_BASE}:runQuery`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${await getAccessToken()}` },
    body: { structuredQuery: { from: [{ collectionId: collection }], where: { fieldFilter: { field: { fieldPath }, op: 'EQUAL', value: { stringValue: safeValue } } } } },
  });
  if (!response.ok) throw new Error('activity_child_read_failed');
  return (response.data || []).filter(row => row.document).map(row => ({ ...decodeFields(row.document), id: getDocIdFromName(row.document.name) }));
};

const sortByTimeAsc = (rows, field = 'createdAt') =>
  rows.slice().sort((a, b) => (Date.parse(a?.[field] || a?.occurredAt || a?.criadoEm) || 0) - (Date.parse(b?.[field] || b?.occurredAt || b?.criadoEm) || 0));

const decorateActivityCollections = (activity, { comments = [], checklist = [] } = {}) => ({
  ...activity,
  commentsCount: comments.filter(comment => !comment.deletedAt).length || Number(activity.commentsCount) || 0,
  checklistTotal: checklist.length || Number(activity.checklistTotal) || 0,
  checklistDone: checklist.filter(item => item.completed).length || Number(activity.checklistDone) || 0,
});

const readActivityWorkspace = async (activity) => {
  const [commentRows, checklistRows, eventRows] = await Promise.all([
    queryByField(COMMENTS_COLLECTION, 'activityId', activity.id),
    queryByField(CHECKLIST_COLLECTION, 'activityId', activity.id),
    queryByField(EVENTS_COLLECTION, 'activityId', activity.id),
  ]);
  const legacyComments = (Array.isArray(activity.comentarios) ? activity.comentarios : []).map((comment, index) =>
    normalizeComment({
      ...(comment && typeof comment === 'object' ? comment : { body: comment }),
      id: safeText(comment?.id) || `legacy-${index}`,
      activityId: activity.id,
      studentId: activity.studentId,
      legacy: true,
    })
  ).filter(comment => comment.body);
  const comments = sortByTimeAsc([...legacyComments, ...commentRows.map(normalizeComment)], 'createdAt');
  const checklist = sortByTimeAsc(checklistRows.map(normalizeChecklistItem).filter(item => !item.deletedAt), 'createdAt');
  const events = sortByTimeAsc(eventRows, 'occurredAt');
  return { activity: decorateActivityCollections(activity, { comments, checklist }), comments, checklist, events };
};
const validateStudent = async id => {
  if (!id) return;
  const doc = await readDocument(USERS_COLLECTION, id);
  if (!doc || normalizeUserRole(doc.row.tipo || doc.row.role) !== 'student') throw Object.assign(new Error('invalid_student'), { status: 400 });
};
const commitActivity = async ({ id, document, patch, session, archive = false }) => {
  if (Object.hasOwn(patch, 'studentId')) await validateStudent(patch.studentId);
  const responsibleId = patch.responsavelId ?? document?.row?.responsavelId;
  if (responsibleId) {
    const responsible = await readDocument(USERS_COLLECTION, responsibleId);
    patch.responsavelNome = safeText(responsible?.row?.nome || responsible?.row?.name);
  }
  const { next, events } = planActivityChange({ id, before: document?.row, patch, actor: actorFromSession(session), now: new Date().toISOString(), archive });
  const prefix = FIRESTORE_BASE.split('/v1/')[1];
  const stored = { ...next };
  for (const key of ['criadoEm', 'atualizadoEm', 'completedAt', 'archivedAt']) {
    if (stored[key] && Number.isFinite(new Date(stored[key]).getTime())) stored[key] = new Date(stored[key]);
  }
  const fieldPaths = Object.keys(next).filter(key => JSON.stringify(next[key]) !== JSON.stringify(document?.row?.[key]));
  const writes = [{ update: { name: `${prefix}/activities/${id}`, ...encodeFields(stored) }, ...(document ? { updateMask: { fieldPaths } } : {}), currentDocument: document ? { updateTime: document.updateTime } : { exists: false } },
    ...events.map(event => ({ update: { name: `${prefix}/${EVENTS_COLLECTION}/${event.id}`, ...encodeFields(event) }, currentDocument: { exists: false } }))];
  const response = await requestJson(`${FIRESTORE_BASE}:commit`, { method: 'POST', headers: { Authorization: `Bearer ${await getAccessToken()}` }, body: { writes } });
  if (!response.ok) throw Object.assign(new Error('activity_commit_failed'), { status: [409, 412].includes(response.status) || response.data?.error?.status === 'FAILED_PRECONDITION' ? 409 : response.status });
  const normalized = normalizeActivity(next);
  if (document) {
    const eventId = events.map(event => event.id).filter(Boolean).join(':');
    await notifyActivityMutation({ before: normalizeActivity({ ...document.row, id }), after: normalized, actor: actorFromSession(session), eventId });
  }
  return normalized;
};

const commitActivityAppend = async ({ activity, document, writes, eventType, actor, before = null, after = null, metadata = {}, seed = randomUUID() }) => {
  const now = new Date().toISOString();
  const revision = (Number(activity.revision) || 0) + 1;
  const next = { ...activity, revision, atualizadoEm: now };
  const event = buildActivityEvent({
    activityId: activity.id,
    revision,
    eventType,
    studentId: activity.studentId,
    actor,
    now,
    before,
    after,
    metadata,
    snapshot: { ...next },
    seed,
  });
  const prefix = FIRESTORE_BASE.split('/v1/')[1];
  const stored = { revision, atualizadoEm: new Date(now) };
  const commitWrites = [
    { update: { name: `${prefix}/activities/${activity.id}`, ...encodeFields(stored) }, updateMask: { fieldPaths: ['revision', 'atualizadoEm'] }, currentDocument: { updateTime: document.updateTime } },
    ...writes,
    { update: { name: `${prefix}/${EVENTS_COLLECTION}/${event.id}`, ...encodeFields(event) }, currentDocument: { exists: false } },
  ];
  const response = await requestJson(`${FIRESTORE_BASE}:commit`, { method: 'POST', headers: { Authorization: `Bearer ${await getAccessToken()}` }, body: { writes: commitWrites } });
  if (!response.ok) throw Object.assign(new Error('activity_append_failed'), { status: [409, 412].includes(response.status) || response.data?.error?.status === 'FAILED_PRECONDITION' ? 409 : response.status });
  return event;
};

const addActivityComment = async ({ activity, document, body, session, mentions = [] }) => {
  const text = safeText(body);
  if (!text) throw Object.assign(new Error('missing_comment'), { status: 400 });
  const now = new Date().toISOString();
  const actor = actorFromSession(session);
  const id = randomUUID();
  const prefix = FIRESTORE_BASE.split('/v1/')[1];
  const resolvedMentions = await resolveActivityCommentMentions({ mentions, actorUserId: "" });
  const comment = {
    id,
    activityId: activity.id,
    studentId: activity.studentId,
    authorId: actor.id,
    authorNameSnapshot: actor.name || 'Usuário',
    authorPhotoSnapshot: actor.photo || '',
    body: text,
    mentions: resolvedMentions,
    createdAt: new Date(now),
    editedAt: null,
  };
  await commitActivityAppend({
    activity,
    document,
    writes: [{ update: { name: `${prefix}/${COMMENTS_COLLECTION}/${id}`, ...encodeFields(comment) }, currentDocument: { exists: false } }],
    eventType: 'comment_added',
    actor,
    after: { commentId: id, body: text },
    metadata: { commentId: id },
    seed: id,
  });
  const normalized = normalizeComment({ ...comment, createdAt: now });
  await notifyActivityComment({ activity, comment: normalized, actor });
  return normalized;
};

const commitCommentAction = async ({ activity, document, body, session }) => {
  const action = safeText(body?.commentAction);
  const commentId = safeText(body?.commentId);
  if (!commentId) throw Object.assign(new Error('missing_comment_id'), { status: 400 });
  const commentDoc = await readChildDocument(COMMENTS_COLLECTION, commentId);
  const existing = commentDoc ? normalizeComment(commentDoc.row) : null;
  if (!existing || existing.activityId !== activity.id || existing.legacy) throw Object.assign(new Error('comment_not_found'), { status: 404 });
  const actor = actorFromSession(session);
  const role = normalizeRole(session?.role);
  if (role !== 'admin' && existing.authorId !== actor.id) throw Object.assign(new Error('comment_forbidden'), { status: 403 });
  const now = new Date().toISOString();
  const prefix = FIRESTORE_BASE.split('/v1/')[1];
  const patch = { ...commentDoc.row, id: commentId };
  let eventType = 'comment_updated';
  if (action === 'edit') {
    const text = safeText(body?.body);
    if (!text) throw Object.assign(new Error('missing_comment_body'), { status: 400 });
    patch.body = text;
    if (Array.isArray(body?.mentions)) patch.mentions = await resolveActivityCommentMentions({ mentions: body.mentions, actorUserId: "" });
    patch.editedAt = new Date(now);
  } else if (action === 'delete') {
    patch.body = '';
    patch.deletedAt = new Date(now);
    patch.deletedBy = actor.id;
    patch.editedAt = new Date(now);
    eventType = 'comment_deleted';
  } else {
    throw Object.assign(new Error('invalid_comment_action'), { status: 400 });
  }
  await commitActivityAppend({
    activity,
    document,
    writes: [{ update: { name: `${prefix}/${COMMENTS_COLLECTION}/${commentId}`, ...encodeFields(patch) }, updateMask: { fieldPaths: Object.keys(patch) }, currentDocument: { updateTime: commentDoc.updateTime } }],
    eventType,
    actor,
    before: existing.deletedAt ? { ...existing, body: '' } : existing,
    after: normalizeComment({ ...patch, editedAt: now, deletedAt: action === 'delete' ? now : patch.deletedAt }),
    metadata: { commentId },
    seed: `${commentId}:${eventType}:${now}`,
  });
  const normalized = normalizeComment({ ...patch, editedAt: now, deletedAt: action === 'delete' ? now : patch.deletedAt });
  if (action === 'edit') await notifyActivityComment({ activity, comment: normalized, actor });
  return normalized;
};

const commitChecklistAction = async ({ activity, document, body, session }) => {
  const action = safeText(body?.checklistAction || body?.action);
  const actor = actorFromSession(session);
  const now = new Date().toISOString();
  const prefix = FIRESTORE_BASE.split('/v1/')[1];
  if (action === 'add') {
    const title = safeText(body?.title);
    if (!title) throw Object.assign(new Error('missing_checklist_title'), { status: 400 });
    const assigneeId = safeText(body?.assigneeId);
    const assignee = assigneeId ? await readDocument(USERS_COLLECTION, assigneeId) : null;
    const id = randomUUID();
    const item = {
      id,
      activityId: activity.id,
      title,
      completed: false,
      completedAt: null,
      completedBy: '',
      assigneeId,
      assigneeNameSnapshot: safeText(assignee?.row?.nome || assignee?.row?.name),
      dueDate: normalizeOptionalDate(body?.dueDate),
      createdAt: new Date(now),
      createdBy: actor.id,
      updatedAt: new Date(now),
    };
    await commitActivityAppend({
      activity,
      document,
      writes: [{ update: { name: `${prefix}/${CHECKLIST_COLLECTION}/${id}`, ...encodeFields(item) }, currentDocument: { exists: false } }],
      eventType: 'checklist_item_added',
      actor,
      after: { itemId: id, title },
      metadata: { checklistItemId: id },
      seed: id,
    });
    const normalized = normalizeChecklistItem({ ...item, createdAt: now, updatedAt: now });
    await notifyChecklistMutation({ activity, before: {}, after: normalized, actor, eventId: id });
    return normalized;
  }
  const itemId = safeText(body?.itemId);
  if (!itemId) throw Object.assign(new Error('missing_checklist_item'), { status: 400 });
  const itemDoc = await readChildDocument(CHECKLIST_COLLECTION, itemId);
  const existing = itemDoc ? normalizeChecklistItem(itemDoc.row) : null;
  if (!existing || existing.activityId !== activity.id) throw Object.assign(new Error('checklist_not_found'), { status: 404 });
  const patch = { ...existing, updatedAt: new Date(now) };
  let eventType = 'activity_updated';
  if (action === 'toggle') {
    const completed = body.completed === undefined ? !existing.completed : body.completed === true;
    patch.completed = completed;
    patch.completedAt = completed ? new Date(now) : null;
    patch.completedBy = completed ? actor.id : '';
    eventType = completed ? 'checklist_item_completed' : 'checklist_item_reopened';
  } else if (action === 'delete') {
    patch.deletedAt = new Date(now);
    patch.deletedBy = actor.id;
    eventType = 'checklist_item_deleted';
  } else if (action === 'update') {
    if (Object.hasOwn(body || {}, 'title')) patch.title = safeText(body.title) || existing.title;
    if (Object.hasOwn(body || {}, 'assigneeId')) {
      patch.assigneeId = safeText(body.assigneeId);
      const assignee = patch.assigneeId ? await readDocument(USERS_COLLECTION, patch.assigneeId) : null;
      patch.assigneeNameSnapshot = safeText(assignee?.row?.nome || assignee?.row?.name);
    }
    if (Object.hasOwn(body || {}, 'dueDate')) patch.dueDate = normalizeOptionalDate(body.dueDate);
    eventType = 'checklist_item_updated';
  } else {
    throw Object.assign(new Error('invalid_checklist_action'), { status: 400 });
  }
  await commitActivityAppend({
    activity,
    document,
    writes: [{ update: { name: `${prefix}/${CHECKLIST_COLLECTION}/${itemId}`, ...encodeFields(patch) }, updateMask: { fieldPaths: Object.keys(patch) }, currentDocument: { updateTime: itemDoc.updateTime } }],
    eventType,
    actor,
    before: existing,
    after: patch,
    metadata: { checklistItemId: itemId },
    seed: `${itemId}:${eventType}:${patch.updatedAt.toISOString ? patch.updatedAt.toISOString() : now}`,
  });
  const normalized = normalizeChecklistItem({ ...patch, updatedAt: now, completedAt: patch.completedAt ? now : null });
  await notifyChecklistMutation({ activity, before: existing, after: normalized, actor, eventId: `${itemId}:${eventType}` });
  return normalized;
};
const queryByStudent = async (collection, studentId) => {
  const fields = collection === EVENTS_COLLECTION ? ['studentId'] : ['studentId', 'alunoId', 'firestore_student_id'];
  const filters = fields.map(fieldPath => ({ fieldFilter: { field: { fieldPath }, op: 'EQUAL', value: { stringValue: studentId } } }));
  const response = await requestJson(`${FIRESTORE_BASE}:runQuery`, { method: 'POST', headers: { Authorization: `Bearer ${await getAccessToken()}` }, body: { structuredQuery: { from: [{ collectionId: collection }], where: filters.length === 1 ? filters[0] : { compositeFilter: { op: 'OR', filters } } } } });
  if (!response.ok) throw new Error('activity_read_failed');
  return (response.data || []).filter(row => row.document).map(row => ({ ...decodeFields(row.document), id: getDocIdFromName(row.document.name) }));
};

const parseRequest = async (req) => {
  const session = getSessionFromRequest(req);
  if (!session) return { ok: false, status: 401, body: { error: "unauthorized" } };
  const role = normalizeRole(session.role);
  if (!isAccessRole(role)) return { ok: false, status: 403, body: { error: "forbidden" } };
  return { ok: true, session, role };
};

module.exports = async (req, res) => {
  const auth = await parseRequest(req);
  if (!auth.ok) return sendJson(res, auth.status, auth.body);
  const { session, role } = auth;

  const host = String(req.headers.host || "localhost");
  const url = new URL(req.url || "/api/activities", `https://${host}`);
  const id = safeText(url.searchParams.get("id"));
  const studentId = safeText(url.searchParams.get("studentId"));
  if ((id && !validId(id)) || (studentId && !validId(studentId))) return sendJson(res, 400, { error: "invalid_id" });
  if (role === "admin") {
    const action = req.method === "POST" ? "create" : req.method === "DELETE" ? "delete" : req.method === "PATCH" ? "update" : "view";
    const guard = await requireAdminPermission(req, `activities.activity.${action}`);
    if (!guard.ok) return sendJson(res, guard.status, guard.body);
  }

  if (req.method === "GET") {
    try {
      if (id) {
        const document = await readDocument(ACTIVITIES_COLLECTION, id);
        const existing = document ? normalizeActivity(document.row) : null;
        if (!existing) return sendJson(res, 404, { error: "not_found" });
        if (!canAccessActivity(session, existing)) return sendJson(res, 403, { error: "forbidden" });
        const userRows = await listCollectionAsAdmin(USERS_COLLECTION, { pageSize: 1500, decorate: false });
        const userIdentities = buildUserIdentityMap(userRows);
        const workspace = decorateWorkspaceIdentities(await readActivityWorkspace(existing), userIdentities);
        return sendJson(res, 200, {
          ...workspace,
          userIdentities,
          students: userRows.filter(row => normalizeUserRole(row.tipo || row.role) === 'student').map(row => ({ id: row.firestoreDocId || row.id, nome: row.nome || row.nomeCompleto || row.name || '', email: row.email || '' })),
          users: listVisibleUsers(session, userRows),
          directoryUsers: listActivityDirectoryUsers(session, userRows),
          permissions: { role, canViewAll: role === "admin", canAssignOthers: role === "admin" || role === "growth" },
        });
      }
      const [activityRows, userRows, eventRows] = await Promise.all([
        studentId ? queryByStudent(ACTIVITIES_COLLECTION, studentId) : listCollectionAsAdmin(ACTIVITIES_COLLECTION, { pageSize: 2000 }),
        listCollectionAsAdmin(USERS_COLLECTION, { pageSize: 1500, decorate: false }),
        studentId ? queryByStudent(EVENTS_COLLECTION, studentId) : Promise.resolve([]),
      ]);
      const activities = sortActivities(
        activityRows
          .map(row => normalizeActivity({ ...row, id: row.firestoreDocId || row.id }))
          .filter((row) => row.id && row.titulo)
          .filter(row => studentId ? row.studentId === studentId : !row.isArchived)
          .filter((row) => canAccessActivity(session, row))
      );
      const [commentRows, checklistRows] = await Promise.all([
        listCollectionAsAdmin(COMMENTS_COLLECTION, { pageSize: 3000 }).catch(() => []),
        listCollectionAsAdmin(CHECKLIST_COLLECTION, { pageSize: 3000 }).catch(() => []),
      ]);
      const userIdentities = buildUserIdentityMap(userRows);
      const commentsByActivity = new Map();
      commentRows.forEach(row => {
        const activityId = safeText(row.activityId);
        if (row.deletedAt) return;
        if (activityId) commentsByActivity.set(activityId, (commentsByActivity.get(activityId) || 0) + 1);
      });
      const checklistByActivity = new Map();
      checklistRows.forEach(row => {
        const activityId = safeText(row.activityId);
        if (!activityId) return;
        if (row.deletedAt) return;
        const current = checklistByActivity.get(activityId) || { total: 0, done: 0 };
        current.total += 1;
        if (row.completed === true) current.done += 1;
        checklistByActivity.set(activityId, current);
      });
      return sendJson(res, 200, {
        userIdentities,
        activities: activities.map(row => {
          const checklist = checklistByActivity.get(row.id) || {};
          return decorateActivityIdentity({
            ...row,
            responsavelNome: userRows.find(user => (user.firestoreDocId || user.id) === row.responsavelId)?.nome || row.responsavelNome || '',
            commentsCount: (commentsByActivity.get(row.id) || 0) + (Array.isArray(row.comentarios) ? row.comentarios.length : 0),
            checklistTotal: checklist.total || 0,
            checklistDone: checklist.done || 0,
          }, userIdentities);
        }),
        events: eventRows.filter(event => canAccessActivity(session, event.snapshot || {})),
        students: userRows.filter(row => normalizeUserRole(row.tipo || row.role) === 'student').map(row => ({ id: row.firestoreDocId || row.id, nome: row.nome || row.nomeCompleto || row.name || '', email: row.email || '' })),
        users: listVisibleUsers(session, userRows),
        directoryUsers: listActivityDirectoryUsers(session, userRows),
        permissions: {
          role,
          canViewAll: role === "admin",
          canAssignOthers: role === "admin" || role === "growth",
        },
      });
    } catch (error) {
      console.error("[api] activities list failed", error);
      return sendJson(res, 500, { error: "activities_list_failed" });
    }
  }

  if (req.method === "POST") {
    let body;
    try {
      body = await readJsonBody(req);
    } catch {
      return sendJson(res, 400, { error: "invalid_json" });
    }
    const titulo = safeText(body?.titulo);
    if (!titulo) return sendJson(res, 400, { error: "missing_title" });
    const responsavelId = safeText(body?.responsavelId);
    if (!canAssignResponsavel(session, responsavelId)) return sendJson(res, 403, { error: "forbidden_responsavel" });
    const now = new Date();
    const payload = {
      titulo,
      studentId: safeText(body?.studentId),
      descricao: safeText(body?.descricao),
      status: ALLOWED_STATUSES.has(String(body?.status || "").trim()) ? String(body.status).trim() : "Pendente",
      responsavelId: responsavelId || null,
      prazo: normalizeOptionalDate(body?.prazo) || null,
      prioridade: ALLOWED_PRIORITIES.has(String(body?.prioridade || "").trim()) ? String(body.prioridade).trim() : "Média",
      tipo: safeText(body?.tipo),
      criadoPor: safeText(session.sub),
      criadoEm: now,
      atualizadoEm: now,
      observacoes: safeText(body?.observacoes),
      comentarios: safeText(body?.comment) ? [{ id: randomUUID(), text: safeText(body.comment), authorId: session.sub, authorName: session.nome || session.name || "", createdAt: now.toISOString() }] : [],
    };
    try {
      const created = await commitActivity({ id: randomUUID(), patch: payload, session });
      return sendJson(res, 201, { activity: created });
    } catch (error) {
      console.error("[api] activities create failed", error);
      return sendJson(res, [400, 409].includes(error.status) ? error.status : 500, { error: error.status === 400 ? "invalid_student" : "activities_create_failed" });
    }
  }

  if (req.method === "PATCH") {
    if (!id) return sendJson(res, 400, { error: "missing_id" });
    let body;
    try {
      body = await readJsonBody(req);
    } catch {
      return sendJson(res, 400, { error: "invalid_json" });
    }
    try {
      const document = await readDocument(ACTIVITIES_COLLECTION, id);
      const existing = document ? normalizeActivity(document.row) : null;
      if (!existing) return sendJson(res, 404, { error: "not_found" });
      if (!canAccessActivity(session, existing)) return sendJson(res, 403, { error: "forbidden" });

      const nextResponsavelId = Object.prototype.hasOwnProperty.call(body || {}, "responsavelId")
        ? safeText(body?.responsavelId)
        : existing.responsavelId;
      if (!canAssignResponsavel(session, nextResponsavelId)) return sendJson(res, 403, { error: "forbidden_responsavel" });

      if (existing.isArchived) return sendJson(res, 409, { error: "activity_archived" });
      const patch = {
        atualizadoEm: new Date(),
      };
      if (Object.prototype.hasOwnProperty.call(body || {}, "titulo")) patch.titulo = safeText(body?.titulo) || existing.titulo;
      if (Object.prototype.hasOwnProperty.call(body || {}, "descricao")) patch.descricao = safeText(body?.descricao);
      if (Object.prototype.hasOwnProperty.call(body || {}, "status")) {
        patch.status = ALLOWED_STATUSES.has(String(body?.status || "").trim()) ? String(body.status).trim() : existing.status;
      }
      if (Object.prototype.hasOwnProperty.call(body || {}, "responsavelId")) patch.responsavelId = nextResponsavelId || null;
      if (Object.prototype.hasOwnProperty.call(body || {}, "prazo")) patch.prazo = normalizeOptionalDate(body?.prazo) || null;
      if (Object.prototype.hasOwnProperty.call(body || {}, "prioridade")) {
        patch.prioridade = ALLOWED_PRIORITIES.has(String(body?.prioridade || "").trim()) ? String(body.prioridade).trim() : existing.prioridade;
      }
      if (Object.prototype.hasOwnProperty.call(body || {}, "tipo")) patch.tipo = safeText(body?.tipo);
      if (Object.prototype.hasOwnProperty.call(body || {}, "observacoes")) patch.observacoes = safeText(body?.observacoes);
      if (Object.hasOwn(body || {}, "studentId")) patch.studentId = safeText(body.studentId);
      if (safeText(body?.commentAction)) {
        const comment = await commitCommentAction({ activity: existing, document, body, session });
        const workspace = await readActivityWorkspace({ ...existing, atualizadoEm: new Date().toISOString() });
        return sendJson(res, 200, { ...workspace, comment });
      }
      if (safeText(body?.comment) && body?.workspace === true) {
        const comment = await addActivityComment({ activity: existing, document, body: body.comment, session, mentions: body?.mentions });
        const workspace = await readActivityWorkspace({ ...existing, atualizadoEm: new Date().toISOString() });
        return sendJson(res, 200, { ...workspace, comment });
      }
      if (safeText(body?.checklistAction || body?.action)) {
        const item = await commitChecklistAction({ activity: existing, document, body, session });
        const workspace = await readActivityWorkspace({ ...existing, atualizadoEm: new Date().toISOString() });
        return sendJson(res, 200, { ...workspace, checklistItem: item });
      }
      if (safeText(body?.comment)) patch.comentarios = [...existing.comentarios, { id: randomUUID(), text: safeText(body.comment), authorId: session.sub, authorName: session.nome || session.name || "", createdAt: new Date().toISOString() }];
      const updated = await commitActivity({ id, document, patch, session });
      if (body?.workspace === true) {
        const workspace = await readActivityWorkspace(updated);
        return sendJson(res, 200, workspace);
      }
      return sendJson(res, 200, { activity: updated });
    } catch (error) {
      console.error("[api] activities patch failed", error);
      return sendJson(res, [400, 404, 409].includes(error?.status) ? error.status : 500, { error: "activities_patch_failed" });
    }
  }

  if (req.method === "DELETE") {
    if (!id) return sendJson(res, 400, { error: "missing_id" });
    try {
      const document = await readDocument(ACTIVITIES_COLLECTION, id);
      const existing = document ? normalizeActivity(document.row) : null;
      if (!existing) return sendJson(res, 404, { error: "not_found" });
      if (!canAccessActivity(session, existing)) return sendJson(res, 403, { error: "forbidden" });
      if (existing.isArchived) return sendJson(res, 200, { ok: true });
      await commitActivity({ id, document, patch: {}, session, archive: true });
      return sendJson(res, 200, { ok: true });
    } catch (error) {
      console.error("[api] activities delete failed", error);
      return sendJson(res, 500, { error: "activities_delete_failed" });
    }
  }

  res.setHeader("Allow", "GET, POST, PATCH, DELETE");
  return sendJson(res, 405, { error: "method_not_allowed" });
};

module.exports._test = {
  buildUserIdentityMap,
  decorateActivityIdentity,
  decorateChecklistIdentity,
  decorateCommentIdentity,
  decorateWorkspaceIdentities,
  normalizeUserIdentity,
  resolveUserIdentity,
};
