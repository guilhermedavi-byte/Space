const { randomUUID } = require("crypto");
const { createAutomationStore, sanitizeJson } = require("./automation-store");
const {
  MAX_AUTOMATION_DEPTH,
  fingerprint,
  getAction,
  getCondition,
  getTrigger,
} = require("./automation-registries");

const clean = (value) => String(value || "").trim();
const nowIso = () => new Date().toISOString();

const publicError = (error) => ({
  code: clean(error?.message || error?.code || "automation_error").slice(0, 128),
  retryable: error?.retryable !== false,
});

const eventTypeOf = (event = {}) => clean(event.event_type || event.eventType);

const normalizeGraph = (graph = {}) => ({
  nodes: Array.isArray(graph.nodes) ? graph.nodes : [],
  edges: Array.isArray(graph.edges) ? graph.edges : [],
});

const validateGraph = (graph = {}) => {
  const normalized = normalizeGraph(graph);
  const errors = [];
  const ids = new Set();
  for (const node of normalized.nodes) {
    const id = clean(node.id);
    if (!id || ids.has(id)) errors.push("invalid_node_id");
    ids.add(id);
    if (!["trigger", "condition", "action", "end"].includes(clean(node.type))) errors.push(`unsupported_node_type:${clean(node.type)}`);
    if (node.type === "condition" && !getCondition(node.conditionType || node.condition_type)) errors.push(`unknown_condition:${clean(node.conditionType || node.condition_type)}`);
    if (node.type === "action" && !getAction(node.actionType || node.action_type)) errors.push(`unknown_action:${clean(node.actionType || node.action_type)}`);
  }
  if (normalized.nodes.filter((node) => node.type === "trigger").length !== 1) errors.push("single_trigger_required");
  if (!normalized.nodes.some((node) => node.type === "condition")) errors.push("condition_required");
  for (const edge of normalized.edges) {
    if (!ids.has(clean(edge.from)) || !ids.has(clean(edge.to))) errors.push("edge_points_to_missing_node");
  }
  return { ok: errors.length === 0, errors, graph: normalized };
};

const nodeByType = (graph, type) => graph.nodes.find((node) => node.type === type) || null;
const nodeById = (graph, id) => graph.nodes.find((node) => clean(node.id) === clean(id)) || null;

const nextNodeForBranch = (graph, fromId, branch) => {
  const edges = graph.edges.filter((edge) => clean(edge.from) === clean(fromId));
  const selected = edges.find((edge) => clean(edge.branch).toLowerCase() === clean(branch).toLowerCase()) || edges[0] || null;
  return selected ? nodeById(graph, selected.to) : null;
};

const defaultGraphForVersion = (version = {}) => validateGraph(version.graph || {}).graph;

const buildContext = async (store, event) => {
  const context = { event };
  if (eventTypeOf(event) === "attendance.message.created") {
    Object.assign(context, await store.getAttendanceMessageContext(event));
  }
  return context;
};

const executeVersionForEvent = async ({ store, version, event }) => {
  const automation = version.automation || {};
  const validation = validateGraph(version.graph);
  if (!validation.ok) throw Object.assign(new Error("automation_invalid_graph"), { retryable: false, validation });
  if (Number(event.depth || 0) > MAX_AUTOMATION_DEPTH) throw Object.assign(new Error("automation_depth_exceeded"), { retryable: false });
  const trigger = getTrigger(version.trigger?.type || automation.trigger_type);
  if (!trigger || !trigger.matches({ event, config: version.trigger })) return { skipped: true, reason: "trigger_not_matched" };

  const run = await store.createRun({
    automationId: automation.id || version.automation_id,
    automationVersionId: version.id,
    eventId: event.id,
    eventType: eventTypeOf(event),
  });
  if (!run) throw new Error("automation_run_create_failed");
  if (["SUCCESS", "FAILED", "CANCELLED"].includes(run.status)) return { skipped: true, run };

  const graph = defaultGraphForVersion(version);
  const context = await buildContext(store, event);
  const triggerNode = nodeByType(graph, "trigger");
  const conditionNode = nodeByType(graph, "condition");
  const actionNode = nodeByType(graph, "action");

  await store.upsertStep({
    runId: run.id,
    nodeId: triggerNode.id,
    nodeType: "trigger",
    status: "SUCCESS",
    input: { eventId: event.id, eventType: eventTypeOf(event) },
    output: { matched: true },
  });

  const condition = getCondition(conditionNode.conditionType || conditionNode.condition_type);
  const conditionOutput = await condition.execute({ context, config: conditionNode.config || {} });
  await store.upsertStep({
    runId: run.id,
    nodeId: conditionNode.id,
    nodeType: "condition",
    actionType: condition.type,
    status: "SUCCESS",
    input: { eventId: event.id },
    output: conditionOutput,
  });

  const conditionMatched = Boolean(conditionOutput.matched);
  const next = nextNodeForBranch(graph, conditionNode.id, conditionMatched ? "true" : "false");
  if (!next || next.type === "end" || conditionMatched) {
    if (actionNode) {
      await store.upsertStep({
        runId: run.id,
        nodeId: actionNode.id,
        nodeType: "action",
        actionType: actionNode.actionType || actionNode.action_type,
        status: "SKIPPED",
        input: { reason: "condition_true" },
        output: { skipped: true },
      });
    }
    const finished = await store.finishRun(run.id, { status: "SUCCESS", current_node_id: next?.id || conditionNode.id });
    return { run: finished || run, condition: conditionOutput, action: "skipped" };
  }

  if (next.type !== "action") throw Object.assign(new Error("automation_unsupported_branch_target"), { retryable: false });
  const action = getAction(next.actionType || next.action_type);
  const config = next.config || {};
  action.validateInput?.(config);
  const idempotencyKey = `${version.id}:${event.id}:${next.id}`;
  const requestFingerprint = fingerprint({ actionType: action.type, config, eventId: event.id });
  const idem = await store.beginIdempotency({
    key: idempotencyKey,
    automationId: automation.id || version.automation_id,
    automationVersionId: version.id,
    runId: run.id,
    nodeId: next.id,
    actionType: action.type,
    requestFingerprint,
  });
  if (idem.row?.status === "SUCCEEDED") {
    await store.upsertStep({
      runId: run.id,
      nodeId: next.id,
      nodeType: "action",
      actionType: action.type,
      status: "SUCCESS",
      input: { idempotencyKey },
      output: { idempotent: true, result: idem.row.result || {} },
    });
    const finished = await store.finishRun(run.id, { status: "SUCCESS", current_node_id: next.id });
    return { run: finished || run, condition: conditionOutput, action: "idempotent" };
  }

  try {
    const actionResult = await action.execute({ context, config, idempotencyKey });
    await store.finishIdempotency(idempotencyKey, "SUCCEEDED", actionResult);
    await store.upsertStep({
      runId: run.id,
      nodeId: next.id,
      nodeType: "action",
      actionType: action.type,
      status: "SUCCESS",
      input: { idempotencyKey, config },
      output: sanitizeJson(actionResult),
    });
    const finished = await store.finishRun(run.id, { status: "SUCCESS", current_node_id: next.id });
    return { run: finished || run, condition: conditionOutput, action: actionResult };
  } catch (error) {
    const safe = publicError(error);
    await store.finishIdempotency(idempotencyKey, "FAILED", safe).catch(() => null);
    await store.upsertStep({
      runId: run.id,
      nodeId: next.id,
      nodeType: "action",
      actionType: action.type,
      status: "FAILED",
      input: { idempotencyKey, config },
      error: safe,
    });
    await store.finishRun(run.id, { status: "FAILED", current_node_id: next.id, error: safe });
    throw Object.assign(error, { retryable: safe.retryable });
  }
};

const processOneAutomationEvent = async ({ store = createAutomationStore(), workerId = randomUUID() } = {}) => {
  await store.importAttendanceOutbox(100);
  const claimed = await store.claimDomainEvent({ workerId });
  if (claimed?.state !== "claimed") return { state: claimed?.state || "not_claimed" };
  const event = claimed.event || {};
  const leaseId = claimed.lease_id;
  try {
    const versions = await store.listActiveVersionsForEvent(eventTypeOf(event));
    for (const version of versions) {
      await executeVersionForEvent({ store, version, event });
    }
    await store.completeDomainEvent(event.id, leaseId);
    return { state: "processed", event_id: event.id, workflows: versions.length };
  } catch (error) {
    const safe = publicError(error);
    await store.failDomainEvent(event.id, leaseId, safe.code, safe.retryable);
    return { state: safe.retryable ? "retryable_failed" : "failed", event_id: event.id, error: safe.code };
  }
};

module.exports = {
  buildContext,
  executeVersionForEvent,
  processOneAutomationEvent,
  validateGraph,
};
