const test = require("node:test");
const assert = require("node:assert/strict");

const handler = require("../api/integrations/n8n/class-completed");
const { getMeetCode, deriveStudentName, scoreCandidate, namesMatch, normalizeUserType } = handler._test;

test("extrai código do Google Meet de URL ou código puro", () => {
  assert.equal(getMeetCode("https://meet.google.com/abc-defg-hij"), "abc-defg-hij");
  assert.equal(getMeetCode("abc-defg-hij"), "abc-defg-hij");
  assert.equal(getMeetCode(""), "");
});

test("deriva nome do aluno do título da aula", () => {
  assert.equal(deriveStudentName({ title: "Aula Pedro Alcântara - Teacher Amanda" }), "Pedro Alcântara");
  assert.equal(deriveStudentName({ student_name_guess: "Edelei" }), "Edelei");
});

test("normalização de nome tolera acentos e pequenos formatos", () => {
  assert.equal(namesMatch("Pedro Alcântara", "Pedro Alcantara"), true);
  assert.equal(namesMatch("Lívia Moreira", "Livia Moreira"), true);
  assert.equal(namesMatch("Pedro", "Maria"), false);
});

test("match direto por Meet domina professor e horário", () => {
  const row = {
    id: "lesson-1",
    aluno_nome: "Pedro Alcantara",
    professor_email: "amandafrossard94@gmail.com",
    inicio: "2026-09-24T18:30:00.000Z",
    meeting_url: "https://meet.google.com/oxd-hwtt-kfq",
    status_aula: "agendada",
  };

  const result = scoreCandidate({
    row,
    body: {
      native_meeting_id: "oxd-hwtt-kfq",
      teacher_email: "amandafrossard94@gmail.com",
      student_name_guess: "Pedro Alcântara",
      scheduled_at: "2026-09-24T18:30:00.000Z",
    },
    referenceMs: Date.parse("2026-09-24T18:30:00.000Z"),
  });

  assert.equal(result.direct, true);
  assert.ok(result.score >= 180);
  assert.ok(result.reasons.includes("meet_code"));
});

test("professor + aluno + horário encontra aula sem Meet salvo", () => {
  const row = {
    id: "lesson-2",
    aluno_nome: "Liliam",
    professor_email: "dstuckert23@gmail.com",
    inicio: "2026-09-23T09:30:00.000Z",
    status_aula: "agendada",
  };

  const result = scoreCandidate({
    row,
    body: {
      teacher_email: "dstuckert23@gmail.com",
      title: "Aula Liliam",
      scheduled_at: "2026-09-23T09:30:00.000Z",
    },
    referenceMs: Date.parse("2026-09-23T09:30:00.000Z"),
  });

  assert.equal(result.direct, false);
  assert.ok(result.score >= 80);
  assert.ok(result.reasons.includes("teacher_email"));
  assert.ok(result.reasons.includes("student_name"));
  assert.ok(result.reasons.includes("time_10m"));
});


test("normaliza tipos de usuário do Firestore", () => {
  assert.equal(normalizeUserType("Professor"), "professor");
  assert.equal(normalizeUserType("student"), "student");
  assert.equal(normalizeUserType("Aluno"), "aluno");
});
