const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");

const originalLoad = Module._load;
Module._load = function patchedLoad(request, parent, isMain) {
  if (request === "../../_lib/google-service-account") {
    return { getGoogleAccessToken: async () => ({ accessToken: "fake" }) };
  }
  if (request === "./firestore-admin") {
    return { commitWritesAsAdmin: async () => ({ ok: true }), queryCollectionByFieldAsAdmin: async () => [] };
  }
  if (request === "./firestore-rest") {
    return {
      FIRESTORE_BASE: "https://firestore.googleapis.com/v1/projects/p/databases/(default)/documents",
      encodeFields: (data) => ({ fields: data }),
      requestJson: async () => ({ ok: true, data: [] }),
      decodeFields: (doc) => doc.fields || {},
      getDocIdFromName: (name) => String(name || "").split("/").pop(),
    };
  }
  return originalLoad.call(this, request, parent, isMain);
};

const service = require("../api/_lib/notification-service");
Module._load = originalLoad;

test("filtra alunos e usuários inativos das menções", () => {
  const mentions = service.resolveCommentMentions({
    actorUserId: "admin-1",
    mentions: [
      { userId: "teacher-1", displayName: "Teacher" },
      { userId: "student-1", displayName: "Aluno" },
      { userId: "inactive-1", displayName: "Inativo" },
    ],
    users: [
      { id: "teacher-1", nome: "Teacher", tipo: "teacher" },
      { id: "student-1", nome: "Aluno", tipo: "student" },
      { id: "inactive-1", nome: "Inativo", tipo: "admin", ativo: false },
    ],
  });
  assert.deepEqual(mentions, [{ userId: "teacher-1", displayName: "Teacher" }]);
});

test("deduplica menções e remove automenção", () => {
  const mentions = service.resolveCommentMentions({
    actorUserId: "admin-1",
    mentions: [
      { userId: "admin-1", displayName: "Admin" },
      { userId: "growth-1", displayName: "Growth" },
      { userId: "growth-1", displayName: "Growth Duplicado" },
    ],
    users: [
      { id: "admin-1", nome: "Admin", tipo: "admin" },
      { id: "growth-1", nome: "Growth", tipo: "growth" },
    ],
  });
  assert.deepEqual(mentions, [{ userId: "growth-1", displayName: "Growth" }]);
});

test("menção tem precedência sobre notificação normal de comentário", () => {
  const notifications = service.buildActivityCommentNotifications({
    actor: { id: "author-1", name: "Autor" },
    activity: { id: "act-1", titulo: "Atividade", responsavelId: "teacher-1", criadoPor: "admin-1", studentId: "student-1" },
    comment: { id: "comment-1", body: "Oi @Teacher", authorId: "author-1" },
    mentions: [{ userId: "teacher-1", displayName: "Teacher" }],
  });
  assert.deepEqual(notifications.map((item) => [item.recipientUserId, item.type]), [
    ["teacher-1", "activity_mention"],
  ]);
  assert.equal(new Set(notifications.map((item) => item.recipientUserId)).size, notifications.length);
});

test("comentário notifica responsáveis, exceto o próprio autor", () => {
  const notifications = service.buildActivityCommentNotifications({
    actor: { id: "author-1", name: "Autor" },
    activity: { id: "act-1", titulo: "Atividade", responsavelIds: ["author-1", "teacher-1"] },
    comment: { id: "comment-1", body: "Cliente respondeu", authorId: "author-1" },
    mentions: [],
  });
  assert.deepEqual(notifications.map((item) => [item.recipientUserId, item.type]), [["teacher-1", "activity_comment"]]);
});

test("assignment gera somente delta e não gera self assignment", () => {
  const assigned = service.buildActivityAssignmentNotifications({
    actor: { id: "admin-1", name: "Admin" },
    before: { id: "act-1", responsavelId: "" },
    after: { id: "act-1", titulo: "Follow-up", responsavelId: "teacher-1" },
    eventId: "event-1",
  });
  assert.deepEqual(assigned.map((item) => [item.recipientUserId, item.type]), [["teacher-1", "activity_assigned"]]);

  const resave = service.buildActivityAssignmentNotifications({
    actor: { id: "admin-1", name: "Admin" },
    before: { id: "act-1", responsavelId: "teacher-1" },
    after: { id: "act-1", titulo: "Follow-up", responsavelId: "teacher-1" },
    eventId: "event-2",
  });
  assert.equal(resave.length, 0);

  const self = service.buildActivityAssignmentNotifications({
    actor: { id: "teacher-1", name: "Teacher" },
    before: { id: "act-1", responsavelId: "" },
    after: { id: "act-1", titulo: "Follow-up", responsavelId: "teacher-1" },
    eventId: "event-3",
  });
  const writes = self.map(service.buildNotificationWrite);
  assert.equal(self.length, 1);
  assert.equal(writes.length, 1, "builder keeps event shape; commit layer owns global self filter");
});

test("unassigned notifica somente removidos por outra pessoa", () => {
  const notifications = service.buildActivityAssignmentNotifications({
    actor: { id: "admin-1", name: "Admin" },
    before: { id: "act-1", titulo: "Follow-up", responsavelIds: ["teacher-1", "growth-1"] },
    after: { id: "act-1", titulo: "Follow-up", responsavelIds: ["growth-1"] },
    eventId: "event-unassign",
  });
  assert.deepEqual(notifications.map((item) => [item.recipientUserId, item.type]), [["teacher-1", "activity_unassigned"]]);
});

test("due date notifica responsáveis somente quando muda semanticamente", () => {
  assert.equal(service.buildActivityDueDateNotifications({
    actor: { id: "admin-1" },
    before: { id: "act-1", responsavelId: "teacher-1", prazo: "2026-09-24" },
    after: { id: "act-1", responsavelId: "teacher-1", prazo: "2026-09-24" },
  }).length, 0);
  const changed = service.buildActivityDueDateNotifications({
    actor: { id: "admin-1" },
    before: { id: "act-1", responsavelIds: ["admin-1", "teacher-1"], prazo: "2026-09-24" },
    after: { id: "act-1", responsavelIds: ["admin-1", "teacher-1"], prazo: "2026-09-26" },
  });
  assert.deepEqual(changed.map((item) => [item.recipientUserId, item.type]), [["admin-1", "activity_due_date_changed"], ["teacher-1", "activity_due_date_changed"]]);
});

test("activity completed notifica responsáveis apenas na transição real para Feito", () => {
  assert.equal(service.buildActivityCompletedNotifications({
    actor: { id: "admin-1" },
    before: { id: "act-1", responsavelId: "teacher-1", status: "Feito" },
    after: { id: "act-1", responsavelId: "teacher-1", status: "Feito" },
  }).length, 0);
  const completed = service.buildActivityCompletedNotifications({
    actor: { id: "admin-1" },
    before: { id: "act-1", responsavelId: "teacher-1", status: "Pendente" },
    after: { id: "act-1", responsavelId: "teacher-1", status: "Feito" },
  });
  assert.deepEqual(completed.map((item) => [item.recipientUserId, item.type]), [["teacher-1", "activity_completed"]]);
});

test("checklist assignment e unassignment usam delta do item", () => {
  const assigned = service.buildChecklistAssignmentNotifications({
    activity: { id: "act-1", titulo: "Onboarding" },
    actor: { id: "admin-1" },
    before: { id: "item-1", title: "Enviar contrato", assigneeId: "" },
    after: { id: "item-1", title: "Enviar contrato", assigneeId: "teacher-1" },
  });
  assert.deepEqual(assigned.map((item) => [item.recipientUserId, item.type, item.checklistItemId]), [["teacher-1", "activity_checklist_assigned", "item-1"]]);

  const unassigned = service.buildChecklistAssignmentNotifications({
    activity: { id: "act-1", titulo: "Onboarding" },
    actor: { id: "admin-1" },
    before: { id: "item-1", title: "Enviar contrato", assigneeId: "teacher-1" },
    after: { id: "item-1", title: "Enviar contrato", assigneeId: "" },
  });
  assert.deepEqual(unassigned.map((item) => [item.recipientUserId, item.type]), [["teacher-1", "activity_checklist_unassigned"]]);
});

test("checklist completed notifica responsáveis só na transição incomplete -> completed", () => {
  assert.equal(service.buildChecklistCompletedNotifications({
    activity: { id: "act-1", responsavelId: "teacher-1" },
    actor: { id: "admin-1" },
    before: { id: "item-1", title: "Enviar contrato", completed: true },
    after: { id: "item-1", title: "Enviar contrato", completed: true },
  }).length, 0);
  const completed = service.buildChecklistCompletedNotifications({
    activity: { id: "act-1", responsavelIds: ["admin-1", "teacher-1"] },
    actor: { id: "admin-1" },
    before: { id: "item-1", title: "Enviar contrato", completed: false },
    after: { id: "item-1", title: "Enviar contrato", completed: true },
  });
  assert.deepEqual(completed.map((item) => [item.recipientUserId, item.type]), [["admin-1", "activity_checklist_completed"], ["teacher-1", "activity_checklist_completed"]]);
});

test("commitNotifications aplica regra global de self-event e dedupe", async () => {
  const writes = [
    { recipientUserId: "u1", actorUserId: "u1", type: "activity_assigned", activityId: "a1", resourceType: "activity", resourceId: "a1" },
    { recipientUserId: "u2", actorUserId: "u1", type: "activity_assigned", activityId: "a1", resourceType: "activity", resourceId: "a1" },
    { recipientUserId: "u2", actorUserId: "u1", type: "activity_assigned", activityId: "a1", resourceType: "activity", resourceId: "a1" },
  ];
  const original = service.buildNotificationWrite;
  assert.equal(typeof original, "function");
  const result = await service.commitNotifications(writes);
  assert.equal(result.count, 1);
});

test("idempotency key gera mesmo documento para mesmo recipient/type/comment", () => {
  const key = service.buildIdempotencyKey({
    recipientUserId: "teacher-1",
    type: "activity_mention",
    resourceType: "activity",
    resourceId: "act-1",
    activityId: "act-1",
    commentId: "comment-1",
  });
  assert.equal(service.notificationIdFromKey(key), service.notificationIdFromKey(key));
  assert.match(service.notificationIdFromKey(key), /^ntf_[a-f0-9]{32}$/);
});
