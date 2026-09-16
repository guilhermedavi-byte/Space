const { randomUUID } = require("crypto");
const { createAutomationStore, sanitizeJson } = require("./automation-store");
const {
  MAX_AUTOMATION_DEPTH,
  fingerprint,
  getAction,
  getCondition,
  getTrigger,
} = require("./automation-registries");
const {
  MAX_EXECUTION_STEPS,
  firstNode,
  nodeById,
  nodeTypeKey,
  normalizeAutomationGraph,
  outgoingEdges,
  validateAutomationGraph,
} = require("./automation-graph");

const clean = (value) => String(value || "").trim();

const publicError = (error) => ({
  code: clean(error?.message || error?.code || "automation_error").slice(0, 128),
  retryable: error?.retryable !== false,
});

const eventTypeOf = (event = {}) => clean(event.event_type || event.eventType);

const validateGraph = validateAutomationGraph;

const buildContext = async (store, event) => {
  const context = { event };
  if (eventTypeOf(event) === "attendance.message.created") {
    Object.assign(context, await store.getAttendanceMessageContext(event));
  }
  return context;
};

const writeStep = (store, sequence, step) => store.upsertStep({
  ...step,
  input: { sequence, ...(step.input || {}) },
  output: sanitizeJson(step.output || {}),
});

const singleNext = (graph, nodeId) => outgoingEdges(graph, nodeId)[0] || null;
const branchNext = (graph, nodeId, branch) => outgoingEdges(graph, nodeId).find((edge) => clean(edge.branch) === branch) || null;

const executeActionNode = async ({ store, version, automation, event, context, run, node, sequence }) => {
  const action = getAction(node.actionType || node.action_type);
  if (!action) throw Object.assign(new Error("automation_unknown_action"), { retryable: false });
  const config = node.config || {};
  action.validateInput?.(config);
  const idempotencyKey = `${version.id}:${event.id}:${node.id}`;
  const requestFingerprint = fingerprint({ actionType: action.type, config, eventId: event.id });
  const idem = await store.beginIdempotency({
    key: idempotencyKey,
    automationId: automation.id || version.automation_id,
    automationVersionId: version.id,
    runId: run.id,
    nodeId: node.id,
    actionType: action.type,
    requestFingerprint,
  });

  if (idem.row?.status === "SUCCEEDED") {
    await writeStep(store, sequence, {
      runId: run.id,
      nodeId: node.id,
      nodeType: "action",
      actionType: action.type,
      status: "SUCCESS",
      input: { idempotencyKey, idempotent: true },
      output: { idempotent: true, result: idem.row.result || {} },
    });
    return { idempotent: true, result: idem.row.result || {} };
  }

  try {
    const actionResult = await action.execute({ context, config, idempotencyKey });
    await store.finishIdempotency(idempotencyKey, "SUCCEEDED", actionResult);
    await writeStep(store, sequence, {
      runId: run.id,
      nodeId: node.id,
      nodeType: "action",
      actionType: action.type,
      status: "SUCCESS",
      input: { idempotencyKey, config },
      output: sanitizeJson(actionResult),
    });
    return actionResult;
  } catch (error) {
    const safe = publicError(error);
    await store.finishIdempotency(idempotencyKey, "FAILED", safe).catch(() => null);
    await writeStep(store, sequence, {
      runId: run.id,
      nodeId: node.id,
      nodeType: "action",
      actionType: action.type,
      status: "FAILED",
      input: { idempotencyKey, config },
      error: safe,
    });
    await store.finishRun(run.id, { status: "FAILED", current_node_id: node.id, error: safe });
    throw Object.assign(error, { retryable: safe.retryable });
  }
};

const executeVersionForEvent = async ({ store, version, event }) => {
  const automation = version.automation || {};
  const validation = await validateAutomationGraph(version.graph);
  if (!validation.ok) throw Object.assign(new Error("automation_invalid_graph"), { retryable: false, validation });
  if (Number(event.depth || 0) > MAX_AUTOMATION_DEPTH) throw Object.assign(new Error("automation_depth_exceeded"), { retryable: false });

  const graph = validation.graph || normalizeAutomationGraph(version.graph);
  const triggerNode = firstNode(graph, "trigger");
  const trigger = getTrigger(nodeTypeKey(triggerNode) || version.trigger?.type || automation.trigger_type);
  if (!trigger || !trigger.matches({ event, config: triggerNode?.config || version.trigger })) return { skipped: true, reason: "trigger_not_matched" };

  let run = await store.createRun({
    automationId: automation.id || version.automation_id,
    automationVersionId: version.id,
    eventId: event.id,
    eventType: eventTypeOf(event),
  });
  if (!run) throw new Error("automation_run_create_failed");
  if (["SUCCESS", "CANCELLED"].includes(run.status)) return { skipped: true, run };
  if (run.status === "FAILED" && typeof store.restartRun === "function") {
    run = await store.restartRun(run.id) || run;
  }

  const context = await buildContext(store, event);
  const path = [];
  let current = triggerNode;
  let sequence = 0;
  let lastAction = null;
  let lastCondition = null;

  while (current) {
    sequence += 1;
    if (sequence > MAX_EXECUTION_STEPS) throw Object.assign(new Error("automation_execution_step_limit_exceeded"), { retryable: false });
    path.push(current.id);

    if (current.type === "trigger") {
      await writeStep(store, sequence, {
        runId: run.id,
        nodeId: current.id,
        nodeType: "trigger",
        actionType: nodeTypeKey(current),
        status: "SUCCESS",
        input: { eventId: event.id, eventType: eventTypeOf(event) },
        output: { matched: true },
      });
      current = nodeById(graph, singleNext(graph, current.id)?.to);
      continue;
    }

    if (current.type === "condition") {
      const condition = getCondition(current.conditionType || current.condition_type);
      if (!condition) throw Object.assign(new Error("automation_unknown_condition"), { retryable: false });
      const output = await condition.execute({ context, config: current.config || {} });
      lastCondition = output;
      const matched = Boolean(output.matched);
      await writeStep(store, sequence, {
        runId: run.id,
        nodeId: current.id,
        nodeType: "condition",
        actionType: condition.type,
        status: "SUCCESS",
        input: { eventId: event.id },
        output,
      });
      current = nodeById(graph, branchNext(graph, current.id, matched ? "true" : "false")?.to);
      continue;
    }

    if (current.type === "action") {
      lastAction = await executeActionNode({ store, version, automation, event, context, run, node: current, sequence });
      current = nodeById(graph, singleNext(graph, current.id)?.to);
      continue;
    }

    if (current.type === "end") {
      await writeStep(store, sequence, {
        runId: run.id,
        nodeId: current.id,
        nodeType: "end",
        status: "SUCCESS",
        input: {},
        output: { path },
      });
      const finished = await store.finishRun(run.id, { status: "SUCCESS", current_node_id: current.id, error: null });
      return { run: finished || run, condition: lastCondition, action: lastAction || "none", path };
    }

    throw Object.assign(new Error("automation_unsupported_node_type"), { retryable: false });
  }

  throw Object.assign(new Error("automation_path_did_not_reach_end"), { retryable: false });
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
