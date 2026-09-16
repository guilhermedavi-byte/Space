const NODE_LABELS = {
  "attendance.message.created": "Nova mensagem recebida",
  "crm.contactHasOpenOpportunity": "Possui oportunidade aberta?",
  "crm.createOpportunity": "Criar oportunidade",
};

const NODE_CATALOG = [
  {
    category: "Gatilhos",
    kind: "trigger",
    type: "attendance.message.created",
    label: "Nova mensagem recebida",
    description: "attendance.message.created",
  },
  {
    category: "Condições",
    kind: "condition",
    type: "crm.contactHasOpenOpportunity",
    label: "Contato possui oportunidade aberta?",
    description: "crm.contactHasOpenOpportunity",
  },
  {
    category: "Ações",
    kind: "action",
    type: "crm.createOpportunity",
    label: "Criar oportunidade",
    description: "CRM",
  },
  {
    category: "Fluxo",
    kind: "end",
    type: "end",
    label: "Fim",
    description: "Encerrar fluxo",
  },
];

const TYPE_LABELS = {
  trigger: "Trigger",
  condition: "Condition",
  action: "Action",
  end: "End",
};

const DEFAULT_POSITIONS = {
  trigger_1: { x: 140, y: 120 },
  condition_1: { x: 420, y: 120 },
  action_1: { x: 720, y: 260 },
  end_1: { x: 720, y: 30 },
};

const clean = (value) => String(value || "").trim();

const nodeKind = (node = {}) => clean(node.type) || "action";

const nodeKey = (node = {}) => clean(node.triggerType || node.trigger_type || node.conditionType || node.condition_type || node.actionType || node.action_type || node.type);

const nodeLabel = (node = {}) => {
  if (node.label) return clean(node.label);
  const key = nodeKey(node);
  if (NODE_LABELS[key]) return NODE_LABELS[key];
  if (nodeKind(node) === "end") return "Fim";
  return key || "Etapa";
};

const nodeSubtitle = (node = {}) => {
  if (nodeKind(node) === "end") return "Encerrar fluxo";
  return nodeKey(node) || TYPE_LABELS[nodeKind(node)] || "Node";
};

const fallbackPosition = (node = {}, index = 0) => {
  if (node.position && Number.isFinite(Number(node.position.x)) && Number.isFinite(Number(node.position.y))) {
    return { x: Number(node.position.x), y: Number(node.position.y) };
  }
  if (DEFAULT_POSITIONS[node.id]) return { ...DEFAULT_POSITIONS[node.id] };
  return { x: 180 + (index % 4) * 280, y: 120 + Math.floor(index / 4) * 170 };
};

const edgeId = (edge = {}, index = 0) => clean(edge.id) || `${clean(edge.from || edge.source)}__${clean(edge.branch || edge.sourceHandle || "default")}__${clean(edge.to || edge.target)}__${index}`;

const makeStableId = (kind = "node", existingIds = new Set(), forced = "") => {
  if (forced && !existingIds.has(forced)) return forced;
  const prefix = clean(kind).replace(/[^a-z0-9_]+/gi, "_").toLowerCase() || "node";
  for (let i = 0; i < 16; i += 1) {
    const random = globalThis.crypto?.randomUUID?.().slice(0, 8) || Math.random().toString(36).slice(2, 10);
    const id = `${prefix}_${random}`;
    if (!existingIds.has(id)) return id;
  }
  return `${prefix}_${Date.now().toString(36)}`;
};

const branchToHandle = (branch = "") => {
  const value = clean(branch).toLowerCase();
  if (value === "true" || value === "sim") return "true";
  if (value === "false" || value === "nao" || value === "não") return "false";
  return "default";
};

const handleToBranch = (handle = "") => {
  const value = clean(handle).toLowerCase();
  if (value === "true") return "true";
  if (value === "false") return "false";
  return "";
};

const canonicalToFlow = (graph = {}, options = {}) => {
  const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
  const edges = Array.isArray(graph.edges) ? graph.edges : [];
  const executionSteps = new Map((Array.isArray(options.executionSteps) ? options.executionSteps : []).map((step) => [clean(step.node_id), step]));
  return {
    nodes: nodes.map((node, index) => {
      const kind = nodeKind(node);
      const step = executionSteps.get(clean(node.id));
      return {
        id: clean(node.id) || `node_${index + 1}`,
        type: "spaceNode",
        position: fallbackPosition(node, index),
        data: {
          canonical: { ...node },
          kind,
          label: nodeLabel(node),
          subtitle: nodeSubtitle(node),
          typeLabel: TYPE_LABELS[kind] || kind,
          status: step?.status || "",
          branch: step?.output?.matched === true ? "SIM" : step?.output?.matched === false ? "NAO" : "",
          error: options.errors?.[node.id] || "",
        },
      };
    }),
    edges: edges.map((edge, index) => {
      const sourceHandle = branchToHandle(edge.branch || edge.sourceHandle);
      return {
        id: edgeId(edge, index),
        source: clean(edge.from || edge.source),
        target: clean(edge.to || edge.target),
        sourceHandle,
        targetHandle: clean(edge.targetHandle) || "in",
        label: sourceHandle === "true" ? "SIM" : sourceHandle === "false" ? "NAO" : "",
        animated: false,
        data: { canonical: { ...edge }, branch: handleToBranch(sourceHandle) },
        type: "smoothstep",
      };
    }),
    viewport: graph.viewport || graph.ui?.viewport || { x: 0, y: 0, zoom: 1 },
  };
};

const flowToCanonical = ({ nodes = [], edges = [] } = {}, baseGraph = {}) => {
  const baseNodes = new Map((Array.isArray(baseGraph.nodes) ? baseGraph.nodes : []).map((node) => [clean(node.id), node]));
  return {
    ...baseGraph,
    schemaVersion: Number(baseGraph.schemaVersion || baseGraph.schema_version || 1) || 1,
    nodes: nodes.map((node) => {
      const original = node.data?.canonical || baseNodes.get(clean(node.id)) || {};
      return {
        ...original,
        id: clean(node.id),
        position: {
          x: Math.round(Number(node.position?.x || 0)),
          y: Math.round(Number(node.position?.y || 0)),
        },
      };
    }),
    edges: edges.map((edge, index) => {
      const branch = handleToBranch(edge.sourceHandle || edge.data?.branch);
      const canonical = {
        ...(edge.data?.canonical || {}),
        id: clean(edge.id) || edgeId(edge, index),
        from: clean(edge.source),
        to: clean(edge.target),
      };
      if (branch) canonical.branch = branch;
      else delete canonical.branch;
      return canonical;
    }),
  };
};

const catalogItemToNode = (item = {}, { id = "", position = { x: 0, y: 0 }, existingIds = new Set() } = {}) => {
  const kind = clean(item.kind);
  const node = {
    id: makeStableId(kind, existingIds, id),
    type: kind,
    position: {
      x: Math.round(Number(position.x || 0)),
      y: Math.round(Number(position.y || 0)),
    },
  };
  if (kind === "trigger") node.triggerType = clean(item.type);
  if (kind === "condition") node.conditionType = clean(item.type);
  if (kind === "action") {
    node.actionType = clean(item.type);
    node.config = {};
  }
  return node;
};

const addCatalogNode = (graph = {}, item = {}, options = {}) => {
  const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
  const nextNode = catalogItemToNode(item, {
    ...options,
    existingIds: new Set(nodes.map((node) => clean(node.id)).filter(Boolean)),
  });
  return { schemaVersion: Number(graph.schemaVersion || 1) || 1, ...graph, nodes: [...nodes, nextNode] };
};

const removeNodeAndEdges = (graph = {}, nodeId = "") => {
  const id = clean(nodeId);
  const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
  const target = nodes.find((node) => clean(node.id) === id);
  const triggerCount = nodes.filter((node) => nodeKind(node) === "trigger").length;
  if (target && nodeKind(target) === "trigger" && triggerCount <= 1) {
    return { graph, removedEdges: 0, blocked: "single_trigger_required" };
  }
  const edges = Array.isArray(graph.edges) ? graph.edges : [];
  const nextEdges = edges.filter((edge) => clean(edge.from || edge.source) !== id && clean(edge.to || edge.target) !== id);
  return {
    graph: {
      ...graph,
      nodes: nodes.filter((node) => clean(node.id) !== id),
      edges: nextEdges,
    },
    removedEdges: edges.length - nextEdges.length,
    blocked: "",
  };
};

const updateActionConfig = (graph = {}, nodeId = "", patch = {}, crm = {}) => {
  const stages = Array.isArray(crm.stages) ? crm.stages : [];
  const pipelineId = patch.pipelineId !== undefined ? clean(patch.pipelineId) : undefined;
  return {
    ...graph,
    nodes: (Array.isArray(graph.nodes) ? graph.nodes : []).map((node) => {
      if (clean(node.id) !== clean(nodeId) || nodeKind(node) !== "action") return node;
      const current = node.config || {};
      const next = { ...current, ...patch };
      if (pipelineId !== undefined && current.pipelineId !== pipelineId) {
        const validStage = stages.some((stage) => clean(stage.id) === clean(next.stageId) && clean(stage.pipelineId) === pipelineId);
        if (!validStage) next.stageId = "";
      }
      return { ...node, config: next };
    }),
  };
};

const nodeById = (nodes = [], id = "") => nodes.find((node) => clean(node.id) === clean(id)) || null;

const normalizeConnection = (connection = {}) => ({
  source: clean(connection.source || connection.from),
  target: clean(connection.target || connection.to),
  sourceHandle: branchToHandle(connection.sourceHandle || connection.branch),
  targetHandle: clean(connection.targetHandle) || "in",
});

const isValidConnection = (graph = {}, connection = {}) => {
  const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
  const edges = Array.isArray(graph.edges) ? graph.edges : [];
  const next = normalizeConnection(connection);
  if (!next.source || !next.target) return { ok: false, reason: "missing_endpoint" };
  if (next.source === next.target) return { ok: false, reason: "self_connection" };
  const source = nodeById(nodes, next.source);
  const target = nodeById(nodes, next.target);
  if (!source || !target) return { ok: false, reason: "missing_node" };
  if (nodeKind(source) === "end") return { ok: false, reason: "end_has_no_output" };
  if (nodeKind(target) === "trigger") return { ok: false, reason: "trigger_has_no_input" };
  if (nodeKind(source) === "condition" && !["true", "false"].includes(next.sourceHandle)) return { ok: false, reason: "condition_branch_required" };
  if (nodeKind(source) !== "condition" && !["default", ""].includes(next.sourceHandle)) return { ok: false, reason: "invalid_source_handle" };
  const same = edges.some((edge) => {
    const current = normalizeConnection({ source: edge.from || edge.source, target: edge.to || edge.target, sourceHandle: edge.branch || edge.sourceHandle });
    return current.source === next.source && current.target === next.target && current.sourceHandle === next.sourceHandle;
  });
  if (same) return { ok: false, reason: "duplicate_edge" };
  if (nodeKind(source) === "condition") {
    const branchTaken = edges.some((edge) => clean(edge.from || edge.source) === next.source && branchToHandle(edge.branch || edge.sourceHandle) === next.sourceHandle);
    if (branchTaken) return { ok: false, reason: "condition_branch_taken" };
  }
  return { ok: true, connection: next };
};

const connectNodes = (graph = {}, connection = {}, id = "") => {
  const validation = isValidConnection(graph, connection);
  if (!validation.ok) return { graph, ok: false, reason: validation.reason };
  const next = validation.connection;
  const branch = handleToBranch(next.sourceHandle);
  const edge = {
    id: makeStableId("edge", new Set((Array.isArray(graph.edges) ? graph.edges : []).map((row) => clean(row.id)).filter(Boolean)), id),
    from: next.source,
    to: next.target,
  };
  if (branch) edge.branch = branch;
  return { graph: { ...graph, edges: [...(Array.isArray(graph.edges) ? graph.edges : []), edge] }, ok: true, edge };
};

const removeEdge = (graph = {}, edgeIdToRemove = "") => {
  const id = clean(edgeIdToRemove);
  return { ...graph, edges: (Array.isArray(graph.edges) ? graph.edges : []).filter((edge, index) => edgeId(edge, index) !== id && clean(edge.id) !== id) };
};

const createDebouncedAutosave = (save, delay = 700) => {
  let timer = null;
  let lastValue;
  const run = () => {
    timer = null;
    return save(lastValue);
  };
  return {
    schedule(value) {
      lastValue = value;
      if (timer) clearTimeout(timer);
      timer = setTimeout(run, delay);
    },
    flush() {
      if (!timer) return Promise.resolve(undefined);
      clearTimeout(timer);
      return Promise.resolve(run());
    },
    pending() {
      return Boolean(timer);
    },
  };
};

module.exports = {
  NODE_CATALOG,
  NODE_LABELS,
  TYPE_LABELS,
  addCatalogNode,
  branchToHandle,
  canonicalToFlow,
  catalogItemToNode,
  connectNodes,
  createDebouncedAutosave,
  flowToCanonical,
  handleToBranch,
  isValidConnection,
  nodeKey,
  nodeLabel,
  removeEdge,
  removeNodeAndEdges,
  updateActionConfig,
};
