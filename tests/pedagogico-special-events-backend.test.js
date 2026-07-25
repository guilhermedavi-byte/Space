const test = require("node:test");
const assert = require("node:assert/strict");

const { normalizePayload } = require("../api/_lib/pedagogico-action-handler");

test("registro_aula especial preenche placeholder quando conteudo_aula vem vazio", () => {
  const payload = normalizePayload(
    "registro_aula",
    {
      aula_id: "6720",
      conteudo_aula: "",
      observacoes: "ok",
    },
    {
      onboarding_id: "",
      tipo_evento: "experimental",
    }
  );

  assert.equal(payload.conteudo_aula, "Evento especial realizado");
  assert.equal(payload.conteudo_trabalhado, "Evento especial realizado");
});

test("registro_aula regular preserva exigência de conteúdo real", () => {
  const payload = normalizePayload(
    "registro_aula",
    {
      aula_id: "6720",
      conteudo_aula: "",
      observacoes: "ok",
    },
    {
      onboarding_id: "",
      tipo_evento: "",
    }
  );

  assert.equal(payload.conteudo_aula, "");
  assert.equal(payload.conteudo_trabalhado, "");
});
