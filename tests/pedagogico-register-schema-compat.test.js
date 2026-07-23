const test = require("node:test");
const assert = require("node:assert/strict");

const { buildLessonRegisterRecord } = require("../api/_lib/live-lessons");

test("buildLessonRegisterRecord mantém colunas novas e legadas em paralelo", () => {
  const row = buildLessonRegisterRecord({
    lesson: {
      id: 6393,
      firestore_doc_id: "fs-1",
      onboarding_id: "onb-1",
      aluno_id: "student-1",
      aluno_nome: "João Luiz",
      aluno_email: "joao@example.com",
      aluno_telefone: "5511999999999",
      professor_id: "teacher-1",
      professor_nome: "Matheus Davidson",
      professor_email: "matheus@example.com",
    },
    session: {
      sub: "teacher-1",
      name: "Matheus Davidson",
      email: "matheus@example.com",
    },
    payload: {
      status: "realizada",
      conteudo_aula: "Will x Going to",
      observacoes: "Tudo certo",
      engajamento: "5",
      desempenho_aluno: "4/5",
      confianca: "4",
      humor_aluno: "animado",
      proxima_aula_recomendada: "Future plans",
    },
    now: "2026-07-23T20:00:00.000Z",
  });

  assert.equal(row.status, "realizada");
  assert.equal(row.status_registro, "realizada");
  assert.equal(row.conteudo_aula, "Will x Going to");
  assert.equal(row.conteudo_trabalhado, null);
  assert.equal(row.observacoes, "Tudo certo");
  assert.equal(row.observacao_professor, "Tudo certo");
  assert.equal(row.proxima_aula_recomendada, "Future plans");
  assert.equal(row.proxima_recomendacao, null);
  assert.equal(row.telefone, "5511999999999");
  assert.equal(row.email, "joao@example.com");
});
