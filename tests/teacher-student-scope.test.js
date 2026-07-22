const test = require("node:test");
const assert = require("node:assert/strict");

const handlerPath = require.resolve("../api/pedagogico/student");
const httpPath = require.resolve("../api/_lib/http");
const sessionPath = require.resolve("../api/_lib/session");
const liveLessonsPath = require.resolve("../api/_lib/live-lessons");
const pedagogicoServicePath = require.resolve("../api/_lib/pedagogico-service");

const loadHandler = ({ session, ownedRows = [], ficha = { aluno_id: "aluno-1" }, teacherSheet = null } = {}) => {
  delete require.cache[handlerPath];
  require.cache[httpPath] = {
    id: httpPath,
    filename: httpPath,
    loaded: true,
    exports: {
      sendJson(res, status, body) {
        res.statusCode = status;
        res.body = body;
      },
    },
  };
  require.cache[sessionPath] = {
    id: sessionPath,
    filename: sessionPath,
    loaded: true,
    exports: {
      getSessionFromRequest() {
        return session;
      },
    },
  };
  require.cache[liveLessonsPath] = {
    id: liveLessonsPath,
    filename: liveLessonsPath,
    loaded: true,
    exports: {
      normalizeRole(value) {
        const raw = String(value || "").trim().toLowerCase();
        if (raw === "teacher" || raw === "professor") return "teacher";
        if (raw === "admin") return "admin";
        return raw;
      },
    },
  };
  require.cache[pedagogicoServicePath] = {
    id: pedagogicoServicePath,
    filename: pedagogicoServicePath,
    loaded: true,
    exports: {
      async loadTeacherStudents() {
        return { students: ownedRows, summaries: ownedRows };
      },
      async loadStudentCard() {
        return ficha;
      },
      async loadTeacherStudentSheet() {
        return teacherSheet;
      },
    },
  };
  return require("../api/pedagogico/student");
};

test("professor não acessa ficha de aluno fora do escopo", async () => {
  const handler = loadHandler({
    session: { role: "teacher", sub: "teacher-1", name: "Prof Demo" },
    ownedRows: [{ alunoId: "aluno-1", nome: "Angela Demo" }],
  });
  const res = {};
  await handler({ method: "GET", query: { aluno_id: "aluno-2" } }, res);
  assert.equal(res.statusCode, 403);
  assert.equal(res.body?.error, "student_out_of_scope");
});

test("professor acessa ficha de aluno vinculado", async () => {
  const handler = loadHandler({
    session: { role: "teacher", sub: "teacher-1", name: "Prof Demo" },
    ownedRows: [{ alunoId: "aluno-1", nome: "Angela Demo" }],
    ficha: { aluno_id: "aluno-1", aluno_nome: "Angela Demo" },
    teacherSheet: { alunoMeta: { id: "aluno-1", nome: "Angela Demo" }, comments: [] },
  });
  const res = {};
  await handler({ method: "GET", query: { aluno_id: "aluno-1" } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body?.ok, true);
  assert.equal(res.body?.ficha?.aluno_id, "aluno-1");
  assert.equal(res.body?.teacherSheet?.alunoMeta?.id, "aluno-1");
});
