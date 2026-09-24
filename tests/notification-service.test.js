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
    ["admin-1", "activity_comment"],
  ]);
  assert.equal(new Set(notifications.map((item) => item.recipientUserId)).size, notifications.length);
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
