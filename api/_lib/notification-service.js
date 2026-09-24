const { createHash } = require("node:crypto");
const { getGoogleAccessToken } = require("../../_lib/google-service-account");
const { commitWritesAsAdmin, queryCollectionByFieldAsAdmin } = require("./firestore-admin");
const { FIRESTORE_BASE, encodeFields, requestJson, decodeFields, getDocIdFromName } = require("./firestore-rest");

const NOTIFICATIONS_COLLECTION = "notifications";
const DATASTORE_SCOPE = "https://www.googleapis.com/auth/datastore";

const safeText = (value) => String(value || "").trim();
const normalizeRole = (value) => {
  const raw = safeText(value).toLowerCase();
  if (["admin", "administrador"].includes(raw)) return "admin";
  if (["teacher", "professor"].includes(raw)) return "teacher";
  if (raw === "growth") return "growth";
  if (["finance", "financeiro"].includes(raw)) return "FINANCE";
  if (["student", "aluno"].includes(raw)) return "student";
  return raw;
};

const normalizeUser = (row = {}) => ({
  id: safeText(row.firestoreDocId || row.id || row.uid),
  displayName: safeText(row.nome || row.nomeCompleto || row.name || row.displayName || row.email),
  email: safeText(row.email).toLowerCase(),
  role: normalizeRole(row.tipo || row.role || row.type),
  active: row.ativo !== false && row.active !== false,
  photoURL: safeText(row.photoURL || row.avatarUrl || row.picture),
});

const isMentionableUser = (row = {}) => {
  const user = normalizeUser(row);
  return Boolean(user.id && user.displayName && user.active && ["admin", "teacher", "growth", "FINANCE"].includes(user.role));
};

const normalizeMentionInput = (mention = {}) => ({
  userId: safeText(mention.userId || mention.id || mention.uid),
  displayName: safeText(mention.displayName || mention.nome || mention.name),
});

const resolveCommentMentions = ({ mentions = [], users = [], actorUserId = "" } = {}) => {
  const usersById = new Map((Array.isArray(users) ? users : []).filter(isMentionableUser).map((row) => {
    const user = normalizeUser(row);
    return [user.id, user];
  }));
  const seen = new Set();
  return (Array.isArray(mentions) ? mentions : [])
    .map(normalizeMentionInput)
    .filter((mention) => mention.userId && usersById.has(mention.userId))
    .map((mention) => {
      const user = usersById.get(mention.userId);
      return { userId: user.id, displayName: user.displayName };
    })
    .filter((mention) => {
      if (seen.has(mention.userId)) return false;
      seen.add(mention.userId);
      return true;
    })
    .filter((mention) => mention.userId !== safeText(actorUserId));
};

const buildIdempotencyKey = ({
  recipientUserId,
  type,
  resourceType,
  resourceId,
  activityId,
  commentId,
  checklistItemId,
  eventId,
  deltaKey,
} = {}) =>
  [recipientUserId, type, resourceType, resourceId, activityId, commentId, checklistItemId, eventId, deltaKey].map(safeText).join(":");

const notificationIdFromKey = (key) => `ntf_${createHash("sha256").update(String(key || "")).digest("hex").slice(0, 32)}`;

const normalizeNotification = (row = {}) => ({
  id: safeText(row.id || row.firestoreDocId),
  recipientUserId: safeText(row.recipientUserId),
  actorUserId: safeText(row.actorUserId),
  actorNameSnapshot: safeText(row.actorNameSnapshot || row.actorName),
  actorPhotoSnapshot: safeText(row.actorPhotoSnapshot || row.actorPhoto),
  type: safeText(row.type),
  resourceType: safeText(row.resourceType),
  resourceId: safeText(row.resourceId),
  activityId: safeText(row.activityId),
  commentId: safeText(row.commentId),
  checklistItemId: safeText(row.checklistItemId),
  preview: safeText(row.preview),
  metadata: row.metadata && typeof row.metadata === "object" ? row.metadata : {},
  readAt: row.readAt || null,
  createdAt: row.createdAt || null,
  idempotencyKey: safeText(row.idempotencyKey),
});

const buildNotificationWrite = (notification = {}) => {
  const idempotencyKey = safeText(notification.idempotencyKey) || buildIdempotencyKey(notification);
  const id = safeText(notification.id) || notificationIdFromKey(idempotencyKey);
  const now = notification.createdAt || new Date().toISOString();
  const row = normalizeNotification({
    id,
    ...notification,
    createdAt: now,
    idempotencyKey,
  });
  const writable = { ...row };
  delete writable.readAt;
  const prefix = FIRESTORE_BASE.split("/v1/")[1];
  return {
    update: {
      name: `${prefix}/${NOTIFICATIONS_COLLECTION}/${id}`,
      ...encodeFields(writable),
    },
    updateMask: { fieldPaths: Object.keys(writable) },
  };
};

const getAccessToken = async () => {
  const result = await getGoogleAccessToken({ scope: DATASTORE_SCOPE });
  return safeText(result?.accessToken);
};

const queryNotificationsByRecipientAndUnread = async (recipientUserId) => {
  const safeRecipient = safeText(recipientUserId);
  if (!safeRecipient) return [];
  const response = await requestJson(`${FIRESTORE_BASE}:runQuery`, {
    method: "POST",
    headers: { Authorization: `Bearer ${await getAccessToken()}` },
    body: {
      structuredQuery: {
        from: [{ collectionId: NOTIFICATIONS_COLLECTION }],
        where: {
          compositeFilter: {
            op: "AND",
            filters: [
              { fieldFilter: { field: { fieldPath: "recipientUserId" }, op: "EQUAL", value: { stringValue: safeRecipient } } },
              { unaryFilter: { field: { fieldPath: "readAt" }, op: "IS_NULL" } },
            ],
          },
        },
        limit: 1000,
      },
    },
  });
  if (!response.ok) throw Object.assign(new Error("notifications_unread_query_failed"), { status: response.status });
  return (response.data || [])
    .map((row) => row?.document)
    .filter(Boolean)
    .map((doc) => normalizeNotification({ ...decodeFields(doc), id: getDocIdFromName(doc.name), firestoreDocId: getDocIdFromName(doc.name) }));
};

const listNotificationsForUser = async ({ recipientUserId, filter = "all", limit = 60 } = {}) => {
  const rows = await queryCollectionByFieldAsAdmin(NOTIFICATIONS_COLLECTION, {
    field: "recipientUserId",
    value: safeText(recipientUserId),
    maxResults: 1000,
  }).catch((error) => {
    if (error?.status === 404) return [];
    throw error;
  });
  return rows
    .map(normalizeNotification)
    .filter((row) => row.id && (filter === "unread" ? !row.readAt : true))
    .sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0))
    .slice(0, Math.max(1, Math.min(Number(limit) || 60, 200)));
};

const getUnreadCountForUser = async (recipientUserId) => {
  const rows = await queryNotificationsByRecipientAndUnread(recipientUserId).catch(async () => {
    const fallback = await listNotificationsForUser({ recipientUserId, limit: 200 });
    return fallback.filter((row) => !row.readAt);
  });
  return rows.length;
};

const commitNotifications = async (notifications = []) => {
  const seen = new Set();
  const safeNotifications = (Array.isArray(notifications) ? notifications : [])
    .filter(Boolean)
    .map((notification) => normalizeNotification(notification))
    .filter((notification) => notification.recipientUserId && notification.recipientUserId !== notification.actorUserId)
    .filter((notification) => {
      const key = notification.idempotencyKey || buildIdempotencyKey(notification);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  const writes = safeNotifications.map(buildNotificationWrite);
  if (!writes.length) return { ok: true, count: 0 };
  const response = await commitWritesAsAdmin({ writes });
  if (!response.ok) throw Object.assign(new Error("notifications_commit_failed"), { status: response.status });
  return { ok: true, count: writes.length };
};

const getActivityAssigneeIds = (activity = {}) => {
  const raw = [
    activity.responsavelId,
    activity.assigneeId,
    ...(Array.isArray(activity.responsavelIds) ? activity.responsavelIds : []),
    ...(Array.isArray(activity.assigneeIds) ? activity.assigneeIds : []),
    ...(Array.isArray(activity.assignees) ? activity.assignees.map((item) => item?.id || item?.userId || item) : []),
  ];
  return Array.from(new Set(raw.map(safeText).filter(Boolean)));
};

const getDelta = (before = [], after = []) => {
  const beforeSet = new Set((Array.isArray(before) ? before : []).map(safeText).filter(Boolean));
  return (Array.isArray(after) ? after : []).map(safeText).filter(Boolean).filter((id) => !beforeSet.has(id));
};

const baseActivityNotification = ({ activity = {}, actor = {}, type, recipientUserId, preview = "", metadata = {}, eventId = "", deltaKey = "" } = {}) => ({
  recipientUserId,
  actorUserId: safeText(actor.id),
  actorNameSnapshot: safeText(actor.name),
  actorPhotoSnapshot: safeText(actor.photo),
  type,
  resourceType: "activity",
  resourceId: safeText(activity.id),
  activityId: safeText(activity.id),
  preview,
  metadata: {
    activityTitle: safeText(activity.titulo),
    studentId: safeText(activity.studentId),
    ...metadata,
  },
  idempotencyKey: buildIdempotencyKey({
    recipientUserId,
    type,
    resourceType: "activity",
    resourceId: safeText(activity.id),
    activityId: safeText(activity.id),
    eventId,
    deltaKey,
  }),
});

const buildActivityAssignmentNotifications = ({ before = {}, after = {}, actor = {}, eventId = "" } = {}) => {
  const beforeAssignees = getActivityAssigneeIds(before);
  const afterAssignees = getActivityAssigneeIds(after);
  const assigned = getDelta(beforeAssignees, afterAssignees);
  const unassigned = getDelta(afterAssignees, beforeAssignees);
  return [
    ...assigned.map((recipientUserId) => baseActivityNotification({
      activity: after,
      actor,
      recipientUserId,
      type: "activity_assigned",
      preview: "Você foi atribuído como responsável.",
      eventId,
      deltaKey: `assigned:${recipientUserId}`,
    })),
    ...unassigned.map((recipientUserId) => baseActivityNotification({
      activity: before,
      actor,
      recipientUserId,
      type: "activity_unassigned",
      preview: "Você foi removido da responsabilidade.",
      eventId,
      deltaKey: `unassigned:${recipientUserId}`,
    })),
  ];
};

const buildActivityDueDateNotifications = ({ before = {}, after = {}, actor = {}, eventId = "" } = {}) => {
  const beforeDate = safeText(before.prazo || before.dueDate);
  const afterDate = safeText(after.prazo || after.dueDate);
  if (beforeDate === afterDate) return [];
  return getActivityAssigneeIds(after).map((recipientUserId) => baseActivityNotification({
    activity: after,
    actor,
    recipientUserId,
    type: "activity_due_date_changed",
    preview: "Prazo da atividade alterado.",
    metadata: { beforeDueDate: beforeDate, afterDueDate: afterDate },
    eventId,
    deltaKey: `due:${beforeDate || "none"}:${afterDate || "none"}`,
  }));
};

const buildActivityCompletedNotifications = ({ before = {}, after = {}, actor = {}, eventId = "" } = {}) => {
  if (safeText(before.status) === "Feito" || safeText(after.status) !== "Feito") return [];
  return getActivityAssigneeIds(after).map((recipientUserId) => baseActivityNotification({
    activity: after,
    actor,
    recipientUserId,
    type: "activity_completed",
    preview: "Atividade finalizada.",
    eventId,
    deltaKey: "completed",
  }));
};

const buildActivityMutationNotifications = ({ before = {}, after = {}, actor = {}, eventId = "" } = {}) => [
  ...buildActivityAssignmentNotifications({ before, after, actor, eventId }),
  ...buildActivityDueDateNotifications({ before, after, actor, eventId }),
  ...buildActivityCompletedNotifications({ before, after, actor, eventId }),
];

const baseChecklistNotification = ({ activity = {}, item = {}, actor = {}, recipientUserId, type, preview = "", metadata = {}, eventId = "", deltaKey = "" } = {}) => ({
  ...baseActivityNotification({
    activity,
    actor,
    recipientUserId,
    type,
    preview,
    metadata: {
      checklistItemId: safeText(item.id),
      checklistTitle: safeText(item.title || item.titulo),
      ...metadata,
    },
    eventId,
    deltaKey,
  }),
  checklistItemId: safeText(item.id),
});

const buildChecklistAssignmentNotifications = ({ activity = {}, before = {}, after = {}, actor = {}, eventId = "" } = {}) => {
  const beforeId = safeText(before.assigneeId || before.responsavelId);
  const afterId = safeText(after.assigneeId || after.responsavelId);
  if (beforeId === afterId) return [];
  const out = [];
  if (afterId) {
    out.push(baseChecklistNotification({
      activity,
      item: after,
      actor,
      recipientUserId: afterId,
      type: "activity_checklist_assigned",
      preview: safeText(after.title || after.titulo),
      eventId,
      deltaKey: `checklist-assigned:${safeText(after.id)}:${afterId}`,
    }));
  }
  if (beforeId) {
    out.push(baseChecklistNotification({
      activity,
      item: before,
      actor,
      recipientUserId: beforeId,
      type: "activity_checklist_unassigned",
      preview: safeText(before.title || before.titulo),
      eventId,
      deltaKey: `checklist-unassigned:${safeText(before.id)}:${beforeId}`,
    }));
  }
  return out;
};

const buildChecklistCompletedNotifications = ({ activity = {}, before = {}, after = {}, actor = {}, eventId = "" } = {}) => {
  if (before.completed === true || after.completed !== true) return [];
  return getActivityAssigneeIds(activity).map((recipientUserId) => baseChecklistNotification({
    activity,
    item: after,
    actor,
    recipientUserId,
    type: "activity_checklist_completed",
    preview: safeText(after.title || after.titulo),
    eventId,
    deltaKey: `checklist-completed:${safeText(after.id)}`,
  }));
};

const buildActivityCommentNotifications = ({ activity = {}, comment = {}, actor = {}, mentions = [] } = {}) => {
  const actorId = safeText(actor.id || comment.authorId);
  const mentioned = resolveCommentMentions({ mentions, users: mentions.map((mention) => ({ id: mention.userId, nome: mention.displayName, tipo: "admin" })), actorUserId: actorId });
  const mentionedIds = new Set(mentioned.map((mention) => mention.userId));
  const recipients = [];
  mentioned.forEach((mention) => {
    recipients.push({
      recipientUserId: mention.userId,
      type: "activity_mention",
      metadata: { mentionedDisplayName: mention.displayName },
    });
  });
  getActivityAssigneeIds(activity).forEach((recipientUserId) => {
    if (!recipientUserId || recipientUserId === actorId || mentionedIds.has(recipientUserId)) return;
    if (recipients.some((item) => item.recipientUserId === recipientUserId)) return;
    recipients.push({ recipientUserId, type: "activity_comment", metadata: {} });
  });
  return recipients.map((item) => ({
    ...item,
    actorUserId: actorId,
    actorNameSnapshot: safeText(actor.name || comment.authorNameSnapshot),
    actorPhotoSnapshot: safeText(actor.photo || comment.authorPhotoSnapshot),
    resourceType: "activity",
    resourceId: safeText(activity.id),
    activityId: safeText(activity.id),
    commentId: safeText(comment.id),
    preview: safeText(comment.body).slice(0, 180),
    idempotencyKey: buildIdempotencyKey({
      recipientUserId: item.recipientUserId,
      type: item.type,
      resourceType: "activity",
      resourceId: safeText(activity.id),
      activityId: safeText(activity.id),
      commentId: safeText(comment.id),
    }),
    metadata: {
      activityTitle: safeText(activity.titulo),
      studentId: safeText(activity.studentId),
      ...item.metadata,
    },
  }));
};

module.exports = {
  NOTIFICATIONS_COLLECTION,
  buildActivityCommentNotifications,
  buildActivityMutationNotifications,
  buildActivityAssignmentNotifications,
  buildActivityCompletedNotifications,
  buildActivityDueDateNotifications,
  buildIdempotencyKey,
  buildChecklistAssignmentNotifications,
  buildChecklistCompletedNotifications,
  buildNotificationWrite,
  commitNotifications,
  getActivityAssigneeIds,
  getUnreadCountForUser,
  isMentionableUser,
  listNotificationsForUser,
  normalizeNotification,
  normalizeRole,
  normalizeUser,
  notificationIdFromKey,
  resolveCommentMentions,
};
