const test = require("node:test");
const assert = require("node:assert/strict");

const { buildMirrorRow, computeOverlapCursor, computeSourceHash, __private } = require("../api/_lib/datacrazy-mirror");

test("buildMirrorRow normaliza os campos principais do negócio", () => {
  const row = buildMirrorRow(
    {
      id: "deal_1",
      status: "won",
      total: 3200,
      createdAt: "2026-08-10T12:00:00.000Z",
      lastMovedAt: "2026-08-12T15:30:00.000Z",
      stageChangedAt: "2026-08-12T15:31:00.000Z",
      attendant: { id: "closer_1", name: "Matheus" },
      stage: { name: "Fechado", pipeline: { name: "Conversão" } },
      lead: { name: "Ana Paula" },
      products: [{ product: { name: "Gold" } }],
    },
    { runId: 99, reconciledRunId: 100 }
  );

  assert.equal(row.external_id, "deal_1");
  assert.equal(row.status, "won");
  assert.equal(row.pipeline_key, "conversao");
  assert.equal(row.stage_key, "fechado");
  assert.equal(row.attendant_id, "closer_1");
  assert.equal(row.lead_name, "Ana Paula");
  assert.equal(row.plan_name, "Gold");
  assert.equal(row.last_sync_run_id, 99);
  assert.equal(row.last_reconciled_run_id, 100);
});

test("computeSourceHash é estável para o mesmo payload", () => {
  const business = { id: "deal_1", total: 1000, stage: { name: "Fechado" } };
  assert.equal(computeSourceHash(business), computeSourceHash({ id: "deal_1", total: 1000, stage: { name: "Fechado" } }));
});

test("computeOverlapCursor recua a janela para evitar perder timestamps iguais", () => {
  assert.equal(computeOverlapCursor("2026-08-14T12:00:00.000Z", 90_000), "2026-08-14T11:58:30.000Z");
});

test("normalizeKey remove acento e caixa", () => {
  assert.equal(__private.normalizeKey("Conversão"), "conversao");
});
