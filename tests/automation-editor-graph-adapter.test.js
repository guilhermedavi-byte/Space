const test = require("node:test");
const assert = require("node:assert/strict");

const {
  NODE_CATALOG,
  canonicalToFlow,
  catalogItemToNode,
  connectNodes,
  createDebouncedAutosave,
  flowToCanonical,
  isValidConnection,
  removeEdge,
  removeNodeAndEdges,
  updateActionConfig,
} = require("../src/automation-editor/graph-adapter.cjs");

const graph = {
  nodes: [
    { id: "trigger_1", type: "trigger", triggerType: "attendance.message.created" },
    { id: "condition_1", type: "condition", conditionType: "crm.contactHasOpenOpportunity", position: { x: 320, y: 120 } },
    { id: "action_1", type: "action", actionType: "crm.createOpportunity", config: { pipelineId: "commercial", stageId: "new" } },
    { id: "end_1", type: "end" },
  ],
  edges: [
    { id: "edge_trigger_condition", from: "trigger_1", to: "condition_1" },
    { id: "edge_condition_true_end", from: "condition_1", to: "end_1", branch: "true" },
    { id: "edge_condition_false_action", from: "condition_1", to: "action_1", branch: "false" },
  ],
};

test("canonical graph maps to XYFlow nodes and SIM/NAO handles", () => {
  const flow = canonicalToFlow(graph);
  assert.equal(flow.nodes.length, 4);
  assert.equal(flow.nodes.find((node) => node.id === "condition_1").position.x, 320);
  assert.equal(flow.edges.find((edge) => edge.id === "edge_condition_true_end").sourceHandle, "true");
  assert.equal(flow.edges.find((edge) => edge.id === "edge_condition_true_end").label, "SIM");
  assert.equal(flow.edges.find((edge) => edge.id === "edge_condition_false_action").sourceHandle, "false");
  assert.equal(flow.edges.find((edge) => edge.id === "edge_condition_false_action").label, "NAO");
});

test("XYFlow graph maps back to canonical graph with persisted positions", () => {
  const flow = canonicalToFlow(graph);
  flow.nodes = flow.nodes.map((node) => node.id === "action_1" ? { ...node, position: { x: 640.4, y: 360.5 } } : node);
  const canonical = flowToCanonical(flow, graph);
  assert.deepEqual(canonical.nodes.find((node) => node.id === "action_1").position, { x: 640, y: 361 });
  assert.equal(canonical.edges.find((edge) => edge.id === "edge_condition_false_action").branch, "false");
  assert.equal(canonical.edges.find((edge) => edge.id === "edge_condition_true_end").branch, "true");
});

test("catalog creates stable canonical nodes", () => {
  const action = NODE_CATALOG.find((item) => item.kind === "action");
  const node = catalogItemToNode(action, { id: "action_custom", position: { x: 122.2, y: 84.8 } });
  assert.deepEqual(node, {
    id: "action_custom",
    type: "action",
    position: { x: 122, y: 85 },
    actionType: "crm.createOpportunity",
    config: {},
  });
});

test("node deletion removes connected edges and keeps one trigger", () => {
  const result = removeNodeAndEdges(graph, "condition_1");
  assert.equal(result.blocked, "");
  assert.equal(result.removedEdges, 3);
  assert.equal(result.graph.nodes.some((node) => node.id === "condition_1"), false);
  assert.equal(result.graph.edges.length, 0);

  const blocked = removeNodeAndEdges(graph, "trigger_1");
  assert.equal(blocked.blocked, "single_trigger_required");
  assert.equal(blocked.graph, graph);
});

test("connections validate direction, branches, duplicates, and canonical edge output", () => {
  assert.equal(isValidConnection(graph, { source: "action_1", target: "trigger_1" }).reason, "trigger_has_no_input");
  assert.equal(isValidConnection(graph, { source: "end_1", target: "action_1" }).reason, "end_has_no_output");
  assert.equal(isValidConnection(graph, { source: "action_1", target: "action_1" }).reason, "self_connection");
  assert.equal(isValidConnection(graph, { source: "condition_1", target: "action_1" }).reason, "condition_branch_required");
  assert.equal(isValidConnection(graph, { source: "condition_1", target: "end_1", sourceHandle: "true" }).reason, "duplicate_edge");
  assert.equal(isValidConnection(graph, { source: "condition_1", target: "trigger_1", sourceHandle: "false" }).reason, "trigger_has_no_input");

  const withoutFalseBranch = {
    ...graph,
    nodes: [...graph.nodes, { id: "end_2", type: "end" }],
    edges: graph.edges.filter((edge) => edge.branch !== "false"),
  };
  const connected = connectNodes(withoutFalseBranch, { source: "condition_1", target: "end_2", sourceHandle: "false" }, "edge_false_end_2");
  assert.equal(connected.ok, true);
  assert.deepEqual(connected.edge, { id: "edge_false_end_2", from: "condition_1", to: "end_2", branch: "false" });
});

test("edge deletion removes the selected canonical edge", () => {
  const next = removeEdge(graph, "edge_condition_true_end");
  assert.equal(next.edges.some((edge) => edge.id === "edge_condition_true_end"), false);
  assert.equal(next.edges.length, graph.edges.length - 1);
});

test("action config update clears incompatible stage when pipeline changes", () => {
  const updated = updateActionConfig(graph, "action_1", { pipelineId: "enterprise" }, {
    stages: [{ id: "won", pipelineId: "enterprise" }],
  });
  const action = updated.nodes.find((node) => node.id === "action_1");
  assert.equal(action.config.pipelineId, "enterprise");
  assert.equal(action.config.stageId, "");
});

test("viewport survives reload round trip", () => {
  const withViewport = { ...graph, viewport: { x: -140, y: 88, zoom: 0.82 } };
  const flow = canonicalToFlow(withViewport);
  assert.deepEqual(flow.viewport, withViewport.viewport);
  flow.nodes = flow.nodes.map((node) => node.id === "action_1" ? { ...node, position: { x: 712, y: 260 } } : node);
  const canonical = { ...flowToCanonical(flow, withViewport), viewport: { x: -90, y: 44, zoom: 1.1 } };
  const reloaded = canonicalToFlow(canonical);
  assert.deepEqual(reloaded.viewport, { x: -90, y: 44, zoom: 1.1 });
  assert.deepEqual(reloaded.nodes.find((node) => node.id === "action_1").position, { x: 712, y: 260 });
});

test("autosave debounces edits and flushes pending draft", async () => {
  const saved = [];
  const autosave = createDebouncedAutosave(async (value) => {
    saved.push(value);
    return { ok: true };
  }, 25);
  autosave.schedule({ version: 1 });
  autosave.schedule({ version: 2 });
  assert.equal(autosave.pending(), true);
  await autosave.flush();
  assert.deepEqual(saved, [{ version: 2 }]);
  assert.equal(autosave.pending(), false);
});
