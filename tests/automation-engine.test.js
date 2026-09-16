const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { executeVersionForEvent, processOneAutomationEvent, validateGraph } = require("../api/_lib/automation-engine");
const { AutomationStore } = require("../api/_lib/automation-store");
const { fingerprint, registerAction, registerCondition } = require("../api/_lib/automation-registries");

registerCondition({
  type: "test.condition",
  async execute({ config }) {
    return { matched: Boolean(config.matched), marker: config.marker || "condition-ran" };
  },
});

registerAction({
  type: "test.action",
  validateInput(config = {}) {
    if (!config.pipelineId || !config.stageId) throw Object.assign(new Error("missing_test_config"), { retryable: false });
    return true;
  },
  async execute({ context, config, idempotencyKey }) {
    context.__store.actionCalls += 1;
    context.__store.actionCallsByNode[config.name] = (context.__store.actionCallsByNode[config.name] || 0) + 1;
    if (context.__store.failOnceFor === config.name) {
      context.__store.failOnceFor = "";
      throw Object.assign(new Error(`fail_${config.name}`), { retryable: true });
    }
    return { ok: true, action: config.name, opportunityId: `opp-${config.name}-${context.event.id}`, idempotencyKey };
  },
});

const actionNode = (id, name = id) => ({
  id,
  type: "action",
  actionType: "test.action",
  config: { pipelineId: "pipe_1", stageId: "stage_1", name },
});

const triggerNode = { id: "trigger_1", type: "trigger", triggerType: "attendance.message.created" };
const endNode = { id: "end_1", type: "end" };

const version = (graph) => ({
  id: "version_1",
  automation_id: "automation_1",
  trigger: { type: "attendance.message.created", eventType: "attendance.message.created" },
  graph,
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

const graphLinear = () => ({
  schemaVersion: 1,
  nodes: [triggerNode, actionNode("action_1", "A"), endNode],
  edges: [
    { id: "e1", from: "trigger_1", to: "action_1" },
    { id: "e2", from: "action_1", to: "end_1" },
  ],
});

const graphCondition = ({ matched = false } = {}) => ({
  schemaVersion: 1,
  nodes: [
    triggerNode,
    { id: "condition_1", type: "condition", conditionType: "test.condition", config: { matched } },
    actionNode("action_1", "A"),
    endNode,
  ],
  edges: [
    { id: "e1", from: "trigger_1", to: "condition_1" },
    { id: "e2", from: "condition_1", to: "end_1", branch: "true" },
    { id: "e3", from: "condition_1", to: "action_1", branch: "false" },
    { id: "e4", from: "action_1", to: "end_1" },
  ],
});

class MemoryAutomationStore {
  constructor({ existingIdempotency = null, versions = [], failOnceFor = "" } = {}) {
    this.actionCalls = 0;
    this.actionCallsByNode = {};
    this.failOnceFor = failOnceFor;
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

  async restartRun(runId) {
    const run = [...this.runs.values()].find((row) => row.id === runId);
    Object.assign(run, { status: "RUNNING", error: null, current_node_id: null });
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

const pathFromStore = (store) => [...store.steps.values()].sort((a, b) => a.input.sequence - b.input.sequence).map((step) => step.nodeId);

test("automation graph validates the supported canonical contract", async () => {
  const result = await validateGraph(graphCondition());
  assert.equal(result.ok, true);
  assert.equal(result.graph.schemaVersion, 1);
  assert.deepEqual((await validateGraph({ nodes: [], edges: [] })).ok, false);
});

test("linear graph executes Trigger -> Action -> End", async () => {
  const store = new MemoryAutomationStore();
  const result = await executeVersionForEvent({ store, version: version(graphLinear()), event });
  assert.deepEqual(result.path, ["trigger_1", "action_1", "end_1"]);
  assert.deepEqual(pathFromStore(store), ["trigger_1", "action_1", "end_1"]);
  assert.equal(store.actionCalls, 1);
});

test("condition false follows FALSE branch and creates one action", async () => {
  const store = new MemoryAutomationStore();
  const result = await executeVersionForEvent({ store, version: version(graphCondition({ matched: false })), event });
  assert.deepEqual(result.path, ["trigger_1", "condition_1", "action_1", "end_1"]);
  assert.equal(store.actionCalls, 1);
  assert.equal(store.steps.has("run_1:action_1"), true);
});

test("condition true follows TRUE branch without skipped step materialization", async () => {
  const store = new MemoryAutomationStore();
  const result = await executeVersionForEvent({ store, version: version(graphCondition({ matched: true })), event });
  assert.deepEqual(result.path, ["trigger_1", "condition_1", "end_1"]);
  assert.equal(store.actionCalls, 0);
  assert.equal(store.steps.has("run_1:action_1"), false);
});

test("two sequential actions execute with independent idempotency keys", async () => {
  const graph = {
    schemaVersion: 1,
    nodes: [triggerNode, actionNode("action_a", "A"), actionNode("action_b", "B"), endNode],
    edges: [
      { from: "trigger_1", to: "action_a" },
      { from: "action_a", to: "action_b" },
      { from: "action_b", to: "end_1" },
    ],
  };
  const store = new MemoryAutomationStore();
  await executeVersionForEvent({ store, version: version(graph), event });
  assert.deepEqual(pathFromStore(store), ["trigger_1", "action_a", "action_b", "end_1"]);
  assert.equal(store.idempotency.get("version_1:event_1:action_a").status, "SUCCEEDED");
  assert.equal(store.idempotency.get("version_1:event_1:action_b").status, "SUCCEEDED");
  assert.deepEqual(store.actionCallsByNode, { A: 1, B: 1 });
});

test("two conditions and nested branch execute the drawn path", async () => {
  const graph = {
    schemaVersion: 1,
    nodes: [
      triggerNode,
      { id: "condition_a", type: "condition", conditionType: "test.condition", config: { matched: true, marker: "A" } },
      { id: "condition_b", type: "condition", conditionType: "test.condition", config: { matched: false, marker: "B" } },
      actionNode("action_false", "false"),
      actionNode("action_nested", "nested"),
      endNode,
    ],
    edges: [
      { from: "trigger_1", to: "condition_a" },
      { from: "condition_a", to: "action_false", branch: "false" },
      { from: "condition_a", to: "condition_b", branch: "true" },
      { from: "condition_b", to: "end_1", branch: "true" },
      { from: "condition_b", to: "action_nested", branch: "false" },
      { from: "action_false", to: "end_1" },
      { from: "action_nested", to: "end_1" },
    ],
  };
  const store = new MemoryAutomationStore();
  const result = await executeVersionForEvent({ store, version: version(graph), event });
  assert.deepEqual(result.path, ["trigger_1", "condition_a", "condition_b", "action_nested", "end_1"]);
  assert.deepEqual(store.actionCallsByNode, { nested: 1 });
});

test("invalid cycle, orphan node, and missing branch are rejected", async () => {
  const cycle = graphLinear();
  cycle.edges.push({ from: "action_1", to: "trigger_1" });
  assert.equal((await validateGraph(cycle)).issues.some((row) => row.code === "graph_cycle_detected"), true);

  const orphan = graphLinear();
  orphan.nodes.push(actionNode("orphan", "orphan"));
  assert.equal((await validateGraph(orphan)).issues.some((row) => row.code === "orphan_node" && row.nodeId === "orphan"), true);

  const missingBranch = graphCondition();
  missingBranch.edges = missingBranch.edges.filter((edge) => edge.branch !== "false");
  assert.equal((await validateGraph(missingBranch)).issues.some((row) => row.code === "missing_condition_false_edge"), true);
});

test("succeeded idempotency row prevents duplicate action execution on retry", async () => {
  const key = "version_1:event_1:action_1";
  const requestFingerprint = fingerprint({ actionType: "test.action", config: { pipelineId: "pipe_1", stageId: "stage_1", name: "A" }, eventId: "event_1" });
  const store = new MemoryAutomationStore({
    existingIdempotency: {
      key,
      request_fingerprint: requestFingerprint,
      status: "SUCCEEDED",
      result: { ok: true, opportunityId: "opp-existing" },
    },
  });
  const result = await executeVersionForEvent({ store, version: version(graphLinear()), event });
  assert.equal(result.action.idempotent, true);
  assert.equal(store.actionCalls, 0);
  assert.equal(store.steps.get("run_1:action_1").output.result.opportunityId, "opp-existing");
});

test("Action A success and Action B failure retries without repeating Action A side effect", async () => {
  const graph = {
    schemaVersion: 1,
    nodes: [triggerNode, actionNode("action_a", "A"), actionNode("action_b", "B"), endNode],
    edges: [
      { from: "trigger_1", to: "action_a" },
      { from: "action_a", to: "action_b" },
      { from: "action_b", to: "end_1" },
    ],
  };
  const store = new MemoryAutomationStore({ failOnceFor: "B" });
  await assert.rejects(() => executeVersionForEvent({ store, version: version(graph), event }), /fail_B/);
  assert.deepEqual(store.actionCallsByNode, { A: 1, B: 1 });
  assert.equal([...store.runs.values()][0].status, "FAILED");

  const result = await executeVersionForEvent({ store, version: version(graph), event });
  assert.deepEqual(result.path, ["trigger_1", "action_a", "action_b", "end_1"]);
  assert.deepEqual(store.actionCallsByNode, { A: 1, B: 2 });
  assert.equal(store.idempotency.get("version_1:event_1:action_a").status, "SUCCEEDED");
  assert.equal(store.idempotency.get("version_1:event_1:action_b").status, "SUCCEEDED");
});

test("processOneAutomationEvent claims, executes active versions and completes the event", async () => {
  const store = new MemoryAutomationStore({ versions: [version(graphLinear())] });
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
    "automation_prevent_published_version_mutation",
    "revoke execute on function public.automation_import_attendance_outbox(integer)",
    "grant execute on function public.automation_import_attendance_outbox(integer)",
  ]) {
    assert.match(sql, new RegExp(fragment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
  }
});

test("attendance context is loaded through the hardened automation RPC", async () => {
  const calls = [];
  const store = new AutomationStore({
    request: async (path, options = {}) => {
      calls.push({ path, options });
      return { data: { attendance: { identity: { normalized_phone: "+5511999990000" } } } };
    },
  });
  const result = await store.getAttendanceMessageContext(event);
  assert.equal(result.attendance.identity.normalized_phone, "+5511999990000");
  assert.deepEqual(calls, [{
    path: "/rpc/automation_get_attendance_message_context",
    options: {
      method: "POST",
      body: {
        p_message_id: "message_1",
        p_conversation_id: "conversation_1",
      },
    },
  }]);
});

test("automation attendance context migration keeps table reads behind service_role RPC", () => {
  const sql = fs.readFileSync(path.join(__dirname, "../supabase/migrations/202609160002_automation_attendance_context.sql"), "utf8");
  for (const fragment of [
    "automation_get_attendance_message_context",
    "security definer set search_path=pg_catalog,public",
    "from public.messages",
    "from public.conversations",
    "from public.contacts",
    "from public.contact_identities",
    "revoke execute on function public.automation_get_attendance_message_context(uuid, uuid) from public, anon, authenticated",
    "grant execute on function public.automation_get_attendance_message_context(uuid, uuid) to service_role",
  ]) {
    assert.match(sql, new RegExp(fragment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
  }
});
