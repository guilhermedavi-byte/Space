const NODE_LABELS = {
  "attendance.message.created": "Nova mensagem recebida",
  "crm.contactHasOpenOpportunity": "Possui oportunidade aberta?",
  "crm.createOpportunity": "Criar oportunidade",
};

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

module.exports = {
  NODE_LABELS,
  TYPE_LABELS,
  branchToHandle,
  canonicalToFlow,
  flowToCanonical,
  handleToBranch,
  nodeKey,
  nodeLabel,
};
