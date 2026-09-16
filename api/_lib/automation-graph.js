const crmService = require("./crm-service");
const {
  actions,
  conditions,
  getAction,
  getCondition,
  getTrigger,
  triggers,
} = require("./automation-registries");

const CANONICAL_GRAPH_SCHEMA_VERSION = 1;
const MAX_GRAPH_NODES = 100;
const MAX_GRAPH_EDGES = 200;
const MAX_EXECUTION_STEPS = 200;

// Canonical workflow contract persisted by the backend:
// {
//   schemaVersion: 1,
//   nodes: [{ id, type: "trigger|condition|action|end", triggerType, conditionType, actionType, config, position }],
//   edges: [{ id, from, to, branch: "true|false"|undefined }],
//   ui: { viewport: {} }
// }
// XYFlow-specific fields stay at the adapter boundary and are never required by runtime execution.

const clean = (value) => String(value || "").trim();
const lower = (value) => clean(value).toLowerCase();
const isObject = (value) => value && typeof value === "object" && !Array.isArray(value);
const numberOrZero = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const nodeKind = (node = {}) => clean(node.type);
const nodeTypeKey = (node = {}) => clean(node.triggerType || node.trigger_type || node.conditionType || node.condition_type || node.actionType || node.action_type);
const edgeBranch = (edge = {}) => {
  const branch = lower(edge.branch || edge.sourceHandle);
  if (branch === "true" || branch === "sim") return "true";
  if (branch === "false" || branch === "nao" || branch === "não") return "false";
  return "";
};

const issue = (code, { nodeId = "", edgeId = "", field = "", message = "" } = {}) => ({
  code,
  ...(nodeId ? { nodeId } : {}),
  ...(edgeId ? { edgeId } : {}),
  ...(field ? { field } : {}),
  ...(message ? { message } : {}),
});

const edgeId = (edge = {}, index = 0) => clean(edge.id) || `${clean(edge.from || edge.source)}__${edgeBranch(edge) || "default"}__${clean(edge.to || edge.target)}__${index}`;

const normalizeAutomationGraph = (graph = {}) => {
  const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
  const edges = Array.isArray(graph.edges) ? graph.edges : [];
  return {
    schemaVersion: Number(graph.schemaVersion || graph.schema_version || CANONICAL_GRAPH_SCHEMA_VERSION) || CANONICAL_GRAPH_SCHEMA_VERSION,
    nodes: nodes.map((node, index) => {
      const type = nodeKind(node);
      const normalized = {
        id: clean(node.id) || `node_${index + 1}`,
        type,
        config: isObject(node.config) ? { ...node.config } : {},
        position: {
          x: Math.round(numberOrZero(node.position?.x)),
          y: Math.round(numberOrZero(node.position?.y)),
        },
      };
      if (type === "trigger") normalized.triggerType = clean(node.triggerType || node.trigger_type);
      if (type === "condition") normalized.conditionType = clean(node.conditionType || node.condition_type);
      if (type === "action") normalized.actionType = clean(node.actionType || node.action_type);
      return normalized;
    }),
    edges: edges.map((edge, index) => {
      const normalized = {
        id: edgeId(edge, index),
        from: clean(edge.from || edge.source),
        to: clean(edge.to || edge.target),
      };
      const branch = edgeBranch(edge);
      if (branch) normalized.branch = branch;
      return normalized;
    }),
    ui: {
      ...(isObject(graph.ui) ? graph.ui : {}),
      viewport: isObject(graph.ui?.viewport)
        ? { ...graph.ui.viewport }
        : isObject(graph.viewport)
          ? { ...graph.viewport }
          : {},
    },
  };
};

const adjacencyFor = (graph) => {
  const out = new Map();
  const incoming = new Map();
  for (const node of graph.nodes) {
    out.set(node.id, []);
    incoming.set(node.id, []);
  }
  for (const edge of graph.edges) {
    out.get(edge.from)?.push(edge);
    incoming.get(edge.to)?.push(edge);
  }
  return { out, incoming };
};

const findReachable = (graph, startId) => {
  const { out } = adjacencyFor(graph);
  const seen = new Set();
  const stack = [startId].filter(Boolean);
  while (stack.length) {
    const id = stack.pop();
    if (seen.has(id)) continue;
    seen.add(id);
    for (const edge of out.get(id) || []) stack.push(edge.to);
  }
  return seen;
};

const hasCycleFrom = (graph, startId) => {
  const { out } = adjacencyFor(graph);
  const visiting = new Set();
  const visited = new Set();
  const visit = (id) => {
    if (visiting.has(id)) return true;
    if (visited.has(id)) return false;
    visiting.add(id);
    for (const edge of out.get(id) || []) {
      if (visit(edge.to)) return true;
    }
    visiting.delete(id);
    visited.add(id);
    return false;
  };
  return visit(startId);
};

const loadCrmModelForValidation = async (options = {}) => {
  if (options.crm) return options.crm;
  if (options.validateCrm === false) return null;
  return crmService.loadCrmReadModel();
};

const validateCrmCreateOpportunityConfig = async (node, issues, options = {}) => {
  const crm = await loadCrmModelForValidation(options);
  if (!crm) return;
  const config = node.config || {};
  const pipelineId = clean(config.pipelineId);
  const stageId = clean(config.stageId);
  if (!pipelineId) {
    issues.push(issue("missing_pipeline_id", { nodeId: node.id, field: "config.pipelineId" }));
    return;
  }
  if (!stageId) {
    issues.push(issue("missing_stage_id", { nodeId: node.id, field: "config.stageId" }));
    return;
  }
  const pipeline = (Array.isArray(crm.pipelines) ? crm.pipelines : []).find((row) => clean(row.id) === pipelineId && row.isActive !== false);
  if (!pipeline) issues.push(issue("pipeline_not_found", { nodeId: node.id, field: "config.pipelineId" }));
  const stage = (Array.isArray(crm.stages) ? crm.stages : []).find((row) => clean(row.id) === stageId);
  if (!stage) issues.push(issue("stage_not_found", { nodeId: node.id, field: "config.stageId" }));
  else if (clean(stage.pipelineId) !== pipelineId) issues.push(issue("stage_not_in_pipeline", { nodeId: node.id, field: "config.stageId" }));
};

const validateAutomationGraph = async (graph = {}, options = {}) => {
  const normalized = normalizeAutomationGraph(graph);
  const triggerRegistry = options.triggerRegistry || triggers;
  const conditionRegistry = options.conditionRegistry || conditions;
  const actionRegistry = options.actionRegistry || actions;
  const issues = [];

  if (normalized.schemaVersion !== CANONICAL_GRAPH_SCHEMA_VERSION) {
    issues.push(issue("unsupported_schema_version", { field: "schemaVersion" }));
  }
  if (normalized.nodes.length > MAX_GRAPH_NODES) issues.push(issue("too_many_nodes", { field: "nodes" }));
  if (normalized.edges.length > MAX_GRAPH_EDGES) issues.push(issue("too_many_edges", { field: "edges" }));

  const ids = new Set();
  for (const node of normalized.nodes) {
    if (!node.id) issues.push(issue("missing_node_id", { field: "nodes.id" }));
    if (ids.has(node.id)) issues.push(issue("duplicate_node_id", { nodeId: node.id, field: "nodes.id" }));
    ids.add(node.id);
    if (!["trigger", "condition", "action", "end"].includes(node.type)) {
      issues.push(issue("unsupported_node_type", { nodeId: node.id, field: "type" }));
    }
  }

  const triggersInGraph = normalized.nodes.filter((node) => node.type === "trigger");
  if (triggersInGraph.length !== 1) issues.push(issue("single_trigger_required", { field: "nodes" }));
  const triggerNode = triggersInGraph[0] || null;

  const edgeKeys = new Set();
  for (const edge of normalized.edges) {
    if (!ids.has(edge.from)) issues.push(issue("edge_missing_source", { edgeId: edge.id, field: "edges.from" }));
    if (!ids.has(edge.to)) issues.push(issue("edge_missing_target", { edgeId: edge.id, field: "edges.to" }));
    if (edge.from && edge.from === edge.to) issues.push(issue("self_loop", { edgeId: edge.id, nodeId: edge.from, field: "edges" }));
    const key = `${edge.from}:${edge.branch || ""}:${edge.to}`;
    if (edgeKeys.has(key)) issues.push(issue("duplicate_edge", { edgeId: edge.id, field: "edges" }));
    edgeKeys.add(key);
  }

  const { out, incoming } = adjacencyFor(normalized);
  for (const node of normalized.nodes) {
    const incomingEdges = incoming.get(node.id) || [];
    const outgoingEdges = out.get(node.id) || [];
    if (node.type === "trigger") {
      if (!node.triggerType) issues.push(issue("trigger_not_configured", { nodeId: node.id, field: "triggerType" }));
      else if (!triggerRegistry.has(node.triggerType)) issues.push(issue("unknown_trigger", { nodeId: node.id, field: "triggerType" }));
      if (incomingEdges.length) issues.push(issue("trigger_has_input", { nodeId: node.id, field: "edges" }));
      if (outgoingEdges.length !== 1) issues.push(issue("trigger_requires_one_output", { nodeId: node.id, field: "edges" }));
    }
    if (node.type === "condition") {
      if (!conditionRegistry.has(node.conditionType)) issues.push(issue("unknown_condition", { nodeId: node.id, field: "conditionType" }));
      const trueEdges = outgoingEdges.filter((edge) => edge.branch === "true");
      const falseEdges = outgoingEdges.filter((edge) => edge.branch === "false");
      if (trueEdges.length !== 1) issues.push(issue("missing_condition_true_edge", { nodeId: node.id, field: "edges" }));
      if (falseEdges.length !== 1) issues.push(issue("missing_condition_false_edge", { nodeId: node.id, field: "edges" }));
      if (outgoingEdges.some((edge) => !edge.branch)) issues.push(issue("condition_edge_requires_branch", { nodeId: node.id, field: "edges.branch" }));
    }
    if (node.type === "action") {
      if (!actionRegistry.has(node.actionType)) issues.push(issue("unknown_action", { nodeId: node.id, field: "actionType" }));
      if (outgoingEdges.length !== 1) issues.push(issue("action_requires_one_output", { nodeId: node.id, field: "edges" }));
      if (outgoingEdges.some((edge) => edge.branch)) issues.push(issue("action_edge_must_not_branch", { nodeId: node.id, field: "edges.branch" }));
    }
    if (node.type === "end" && outgoingEdges.length) issues.push(issue("end_has_output", { nodeId: node.id, field: "edges" }));
    if (node.type !== "trigger" && incomingEdges.length === 0) issues.push(issue("orphan_node", { nodeId: node.id, field: "edges" }));
  }

  if (triggerNode) {
    const reachable = findReachable(normalized, triggerNode.id);
    for (const node of normalized.nodes) {
      if (!reachable.has(node.id)) issues.push(issue("node_not_reachable", { nodeId: node.id, field: "edges" }));
    }
    if (!normalized.nodes.some((node) => node.type === "end" && reachable.has(node.id))) issues.push(issue("missing_path_to_end", { nodeId: triggerNode.id, field: "edges" }));
    if (hasCycleFrom(normalized, triggerNode.id)) issues.push(issue("graph_cycle_detected", { nodeId: triggerNode.id, field: "edges" }));
  }

  for (const node of normalized.nodes) {
    try {
      if (node.type === "trigger") getTrigger(node.triggerType)?.validateConfig?.(node.config || {});
      if (node.type === "condition") getCondition(node.conditionType)?.validateConfig?.(node.config || {});
      if (node.type === "action") getAction(node.actionType)?.validateInput?.(node.config || {});
    } catch (error) {
      issues.push(issue(clean(error.message || error.code || "invalid_node_config"), { nodeId: node.id, field: "config" }));
    }
    if (node.type === "action" && node.actionType === "crm.createOpportunity") {
      await validateCrmCreateOpportunityConfig(node, issues, options);
    }
  }

  return { ok: issues.length === 0, issues, errors: issues.map((row) => row.code), graph: normalized };
};

const firstNode = (graph, type) => graph.nodes.find((node) => node.type === type) || null;
const nodeById = (graph, id) => graph.nodes.find((node) => node.id === clean(id)) || null;
const outgoingEdges = (graph, nodeId) => graph.edges.filter((edge) => edge.from === clean(nodeId));

module.exports = {
  CANONICAL_GRAPH_SCHEMA_VERSION,
  MAX_EXECUTION_STEPS,
  MAX_GRAPH_EDGES,
  MAX_GRAPH_NODES,
  edgeBranch,
  firstNode,
  nodeById,
  nodeTypeKey,
  normalizeAutomationGraph,
  outgoingEdges,
  validateAutomationGraph,
};
