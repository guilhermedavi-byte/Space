const test = require("node:test");
const assert = require("node:assert/strict");

const { canonicalToFlow, flowToCanonical } = require("../src/automation-editor/graph-adapter.cjs");

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
