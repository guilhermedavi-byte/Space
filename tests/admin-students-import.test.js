const test = require("node:test");
const assert = require("node:assert/strict");

process.env.APP_ENV = "local";

const { _private } = require("../api/admin-students-import");

test("parseStudentImportText aceita CSV com nome e email", () => {
  const rows = _private.parseStudentImportText('nome,email\n"Ana Teste",ana@example.test\nBruno Teste;bruno@example.test'.replace(";", ","));
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], { lineNumber: 2, name: "Ana Teste", email: "ana@example.test" });
  assert.deepEqual(rows[1], { lineNumber: 3, name: "Bruno Teste", email: "bruno@example.test" });
});

test("parseStudentImportText aceita lista sem cabeçalho", () => {
  const rows = _private.parseStudentImportText("Carla Teste,carla@example.test\nDaniel Teste,daniel@example.test");
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], { lineNumber: 1, name: "Carla Teste", email: "carla@example.test" });
});

test("parseStudentImportText aceita variações comuns de cabeçalho", () => {
  const rows = _private.parseStudentImportText(" Nome do aluno ; E-MAIL \n Elisa Teste ; ELISA@EXAMPLE.TEST ");
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0], { lineNumber: 2, name: "Elisa Teste", email: "elisa@example.test" });
});

test("parseStudentImportText cai para posição quando cabeçalho não é reconhecido", () => {
  const rows = _private.parseStudentImportText("Pessoa,Contato\nFabio Teste,fabio@example.test");
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0], { lineNumber: 2, name: "Fabio Teste", email: "fabio@example.test" });
});

test("documento padrão marca troca obrigatória e ownership Firestore", () => {
  const row = _private.buildDefaultStudentDocument({ uid: "uid123", name: "Aluno Falso", email: "aluno@example.test", adminId: "admin1" });
  assert.equal(row.id, "uid123");
  assert.equal(row.tipo, "student");
  assert.equal(row.role, "student");
  assert.equal(row.nome, "Aluno Falso");
  assert.equal(row.email, "aluno@example.test");
  assert.equal(row.forcePasswordChange, true);
  assert.equal(row.defaultPasswordIssued, true);
  assert.equal(row.source, "admin_student_import");
});

test("path de criação do aluno usa formato aceito pelo Firestore commit", () => {
  const path = _private.buildStudentCommitDocumentName("uid 123");
  assert.equal(path, "projects/plataforma-space/databases/(default)/documents/users/uid%20123");
  assert.equal(path.startsWith("https://"), false);
});
