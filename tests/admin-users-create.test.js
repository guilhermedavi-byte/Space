const test = require("node:test");
const assert = require("node:assert/strict");

process.env.APP_ENV = "local";

const { _private } = require("../api/admin-users");

test("buildCreateUserDocument cria professor com identidade canônica", () => {
  const row = _private.buildCreateUserDocument({
    uid: "teacherUid123",
    role: "teacher",
    name: "Professora Teste",
    email: "professora@example.test",
    adminId: "adminUid",
  });

  assert.equal(row.id, "teacherUid123");
  assert.equal(row.uid, "teacherUid123");
  assert.equal(row.authUserId, "teacherUid123");
  assert.equal(row.firestoreDocId, "teacherUid123");
  assert.equal(row.tipo, "teacher");
  assert.equal(row.role, "teacher");
  assert.equal(row.nome, "Professora Teste");
  assert.equal(row.email, "professora@example.test");
  assert.equal(row.ativo, true);
  assert.equal(row.status, "ativo");
  assert.equal(row.source, "admin_create_user");
});

test("extractBackendErrorDetail preserva mensagem real do Firestore/Auth", () => {
  const detail = _private.extractBackendErrorDetail({
    details: {
      error: {
        status: "PERMISSION_DENIED",
        message: "Missing or insufficient permissions.",
      },
    },
  });

  assert.equal(detail, "PERMISSION_DENIED: Missing or insufficient permissions.");
});
