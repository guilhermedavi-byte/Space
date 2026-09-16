const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { executeVersionForEvent, processOneAutomationEvent, validateGraph } = require("../api/_lib/automation-engine");
const { fingerprint, registerAction, registerCondition } = require("../api/_lib/automation-registries");

registerCondition({
  type: "test.condition.has-open-opportunity",
  async execute({ config }) {
    return { matched: Boolean(config.matched), marker: "condition-ran" };
  },
});

registerAction({
  type: "test.action.create-opportunity",
  validateInput(config = {}) {
    if (!config.pipelineId || !config.stageId) throw Object.assign(new Error("missing_test_config"), { retryable: false });
    return true;
  },
  async execute({ context, config, idempotencyKey }) {
    context.__store.actionCalls += 1;
    return { ok: true, opportunityId: `opp-${context.event.id}`, config, idempotencyKey };
  },
});

const graph = ({ matched = false } = {}) => ({
  nodes: [
    { id: "trigger_1", type: "trigger" },
    { id: "condition_1", type: "condition", conditionType: "test.condition.has-open-opportunity", config: { matched } },
    { id: "action_1", type: "action", actionType: "test.action.create-opportunity", config: { pipelineId: "pipe_1", stageId: "stage_1" } },
    { id: "end_1", type: "end" },
  ],
  edges: [
    { from: "trigger_1", to: "condition_1" },
    { from: "condition_1", to: "end_1", branch: "true" },
    { from: "condition_1", to: "action_1", branch: "false" },
    { from: "action_1", to: "end_1" },
  ],
});

const version = ({ matched = false } = {}) => ({
  id: "version_1",
  automation_id: "automation_1",
  trigger: { type: "attendance.message.created", eventType: "attendance.message.created" },
  graph: graph({ matched }),
  automation: {
    id: "automation_1",
    status: "ACTIVE",
    trigger_type: "attendance.message.created",
    active_version_id: "version_1",
  },
});

const event = {
  id: "event_1",
  event_type: "attendance.message.created",
  aggregate_id: "message_1",
  payload: { message_id: "message_1", conversation_id: "conversation_1" },
  depth: 0,
};

class MemoryAutomationStore {
  constructor({ existingIdempotency = null, versions = [] } = {}) {
    this.actionCalls = 0;
    this.runs = new Map();
    this.steps = new Map();
    this.idempotency = new Map();
    this.versions = versions;
    this.claimed = false;
    this.completed = [];
    this.failed = [];
    if (existingIdempotency) this.idempotency.set(existingIdempotency.key, structuredClone(existingIdempotency));
  }

  async getAttendanceMessageContext(evt) {
    return {
      attendance: {
        message: { message_id: evt.payload.message_id, text: "oi" },
        identity: { normalized_phone: "+5511999990000" },
      },
      __store: this,
    };
  }

  async createRun({ automationId, automationVersionId, eventId, eventType }) {
    const key = `${automationId}:${automationVersionId}:${eventId}`;
    const existing = this.runs.get(key);
    if (existing) return existing;
    const run = { id: `run_${this.runs.size + 1}`, automation_id: automationId, automation_version_id: automationVersionId, event_id: eventId, event_type: eventType, status: "RUNNING" };
    this.runs.set(key, run);
    return run;
  }

  async finishRun(runId, patch = {}) {
    const run = [...this.runs.values()].find((row) => row.id === runId);
    Object.assign(run, patch, { finished_at: patch.finished_at || "2026-09-16T12:00:00.000Z" });
    return run;
  }

  async upsertStep(step) {
    this.steps.set(`${step.runId}:${step.nodeId}`, structuredClone(step));
    return step;
  }

  async beginIdempotency({ key, requestFingerprint, ...row }) {
    const existing = this.idempotency.get(key);
    if (existing) {
      if (existing.request_fingerprint !== requestFingerprint) throw Object.assign(new Error("automation_idempotency_conflict"), { status: 409 });
      return { inserted: false, row: existing };
    }
    const next = { key, request_fingerprint: requestFingerprint, status: "STARTED", result: {}, ...row };
    this.idempotency.set(key, next);
    return { inserted: true, row: next };
  }

  async finishIdempotency(key, status, result = {}) {
    const row = this.idempotency.get(key);
    Object.assign(row, { status, result });
    return row;
  }

  async importAttendanceOutbox() {
    return { inserted: 0 };
  }

  async claimDomainEvent() {
    if (this.claimed) return { state: "empty" };
    this.claimed = true;
    return { state: "claimed", event, lease_id: "lease_1" };
  }

  async listActiveVersionsForEvent(eventType) {
    return this.versions.filter((row) => row.trigger.eventType === eventType);
  }

  async completeDomainEvent(eventId, leaseId) {
    this.completed.push({ eventId, leaseId });
    return { ok: true };
  }

  async failDomainEvent(eventId, leaseId, error, retryable) {
    this.failed.push({ eventId, leaseId, error, retryable });
    return { ok: true };
  }
}

test("automation graph validates the supported vertical slice", () => {
  const result = validateGraph(graph());
  assert.equal(result.ok, true);
  assert.deepEqual(validateGraph({ nodes: [], edges: [] }).ok, false);
});

test("condition false creates one CRM opportunity action with idempotency key", async () => {
  const store = new MemoryAutomationStore();
  const result = await executeVersionForEvent({ store, version: version({ matched: false }), event });
  assert.equal(result.action.ok, true);
  assert.equal(store.actionCalls, 1);
  const actionStep = store.steps.get("run_1:action_1");
  assert.equal(actionStep.status, "SUCCESS");
  assert.equal(actionStep.input.idempotencyKey, "version_1:event_1:action_1");
});

test("condition true skips CRM creation and finishes successfully", async () => {
  const store = new MemoryAutomationStore();
  const result = await executeVersionForEvent({ store, version: version({ matched: true }), event });
  assert.equal(result.action, "skipped");
  assert.equal(store.actionCalls, 0);
  assert.equal(store.steps.get("run_1:action_1").status, "SKIPPED");
  assert.equal([...store.runs.values()][0].status, "SUCCESS");
});

test("succeeded idempotency row prevents duplicate action execution on retry", async () => {
  const key = "version_1:event_1:action_1";
  const requestFingerprint = fingerprint({ actionType: "test.action.create-opportunity", config: { pipelineId: "pipe_1", stageId: "stage_1" }, eventId: "event_1" });
  const store = new MemoryAutomationStore({
    existingIdempotency: {
      key,
      request_fingerprint: requestFingerprint,
      status: "SUCCEEDED",
      result: { ok: true, opportunityId: "opp-existing" },
    },
  });
  const result = await executeVersionForEvent({ store, version: version({ matched: false }), event });
  assert.equal(result.action, "idempotent");
  assert.equal(store.actionCalls, 0);
  assert.equal(store.steps.get("run_1:action_1").output.result.opportunityId, "opp-existing");
});

test("processOneAutomationEvent claims, executes active versions and completes the event", async () => {
  const store = new MemoryAutomationStore({ versions: [version({ matched: false })] });
  const result = await processOneAutomationEvent({ store, workerId: "worker_1" });
  assert.equal(result.state, "processed");
  assert.equal(result.workflows, 1);
  assert.deepEqual(store.completed, [{ eventId: "event_1", leaseId: "lease_1" }]);
  assert.equal(store.failed.length, 0);
});

test("automation migration defines durable event, run and idempotency primitives", () => {
  const sql = fs.readFileSync(path.join(__dirname, "../supabase/migrations/202609160001_automation_engine.sql"), "utf8");
  for (const fragment of [
    "create table if not exists public.automations",
    "create table if not exists public.automation_versions",
    "create table if not exists public.automation_runs",
    "create table if not exists public.automation_run_steps",
    "create table if not exists public.automation_idempotency",
    "create table if not exists public.domain_events",
    "automation_import_attendance_outbox",
    "automation_claim_domain_event",
    "automation_complete_domain_event",
    "automation_fail_domain_event",
    "FOR UPDATE SKIP LOCKED",
  ]) {
    assert.match(sql, new RegExp(fragment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
  }
});
