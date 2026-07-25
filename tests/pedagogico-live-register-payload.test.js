const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const script = fs.readFileSync(path.join(__dirname, "..", "script.js"), "utf8");
const pedagogicoHandler = fs.readFileSync(
  path.join(__dirname, "..", "api", "_lib", "pedagogico-action-handler.js"),
  "utf8",
);
const { normalizePayload } = require("../api/_lib/pedagogico-action-handler");

test("payload live do professor envia engajamento e confiança", () => {
  assert.match(script, /engajamento:\s*draft\.engajamentoNota \? String\(draft\.engajamentoNota\) : ""/);
  assert.match(script, /confianca:\s*draft\.confiancaNota \? String\(draft\.confiancaNota\) : ""/);
});

test("normalizePayload preserva engajamento e confiança em registro_aula", () => {
  const payload = normalizePayload(
    "registro_aula",
    {
      aula_id: "lesson-1",
      onboarding_id: "onb-1",
      conteudo_aula: "Will x Going to Conversation",
      observacoes: "ok",
      engajamento: "5",
      desempenho_aluno: "5/5",
      confianca: "5",
      humor_aluno: "Animado",
      estrelas: 5,
      homework: "",
      proxima_aula_recomendada: "Future plans",
    },
    { onboarding_id: "onb-1" }
  );

  assert.equal(payload.engajamento, "5");
  assert.equal(payload.confianca, "5");
  assert.equal(payload.conteudo_aula, "Will x Going to Conversation");
  assert.equal(payload.desempenho_aluno, "5/5");
  assert.equal(payload.humor_aluno, "Animado");
});

test("backend de remarcação não exige mais motivo_remarcacao", () => {
  assert.match(
    pedagogicoHandler,
    /remarcacao_aula:\s*\{[\s\S]*?required:\s*\[\s*"aula_id"\s*\]/,
  );
});
