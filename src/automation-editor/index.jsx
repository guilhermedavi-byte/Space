import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Background,
  Controls,
  Handle,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  Position,
  useEdgesState,
  useNodesState,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

const {
  NODE_CATALOG,
  addConnectedCatalogNode,
  buildExecutionOverlay,
  canonicalToFlow,
  catalogItemToNode,
  connectNodes,
  createDebouncedAutosave,
  flowToCanonical,
  isValidConnection,
  nodeKey,
  reconnectNodes,
  removeEdge,
  removeNodeAndEdges,
  updateActionConfig,
  updateTriggerType,
} = require("./graph-adapter.cjs");

const statusMark = (status) => {
  if (status === "SUCCESS") return "✓";
  if (status === "FAILED") return "✕";
  if (status === "RUNNING") return "…";
  if (status === "SKIPPED") return "↷";
  return "";
};

const statusText = (status = "") => String(status || "").toUpperCase() || "PENDING";

const formatDuration = (ms) => {
  const n = Number(ms);
  if (!Number.isFinite(n) || n < 0) return "-";
  if (n < 1000) return `${Math.round(n)} ms`;
  return `${Math.round(n / 100) / 10} s`;
};

const formatTime = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(date);
};

const compactId = (value = "") => {
  const id = String(value || "");
  return id.length > 14 ? `${id.slice(0, 8)}...${id.slice(-4)}` : id || "-";
};

const triggerTypeOf = (node = {}) => String(node?.triggerType || node?.trigger_type || "").trim();

const JsonBlock = ({ value }) => {
  const text = JSON.stringify(value || {}, null, 2);
  const large = text.length > 900;
  return <pre className={`automation-json ${large ? "is-large" : ""}`}>{large ? `${text.slice(0, 900)}\n...` : text}</pre>;
};

const actionSummary = (node, crm) => {
  if (node?.type !== "action") return "";
  const pipelines = Array.isArray(crm?.pipelines) ? crm.pipelines : [];
  const stages = Array.isArray(crm?.stages) ? crm.stages : [];
  const config = node.config || {};
  const pipeline = pipelines.find((row) => row.id === config.pipelineId)?.name || "";
  const stage = stages.find((row) => row.id === config.stageId)?.name || "";
  if (!config.pipelineId || !config.stageId) return "Configuração incompleta";
  return [pipeline, stage].filter(Boolean).join(" · ");
};

const SpaceNode = memo(({ data, selected }) => {
  const kind = data.kind || "action";
  const isCondition = kind === "condition";
  const isEnd = kind === "end";
  const isNeutralTrigger = kind === "trigger" && !triggerTypeOf(data.canonical || {});
  const incomplete = kind === "action" && data.incomplete;
  return (
    <div className={`automation-canvas-node is-${kind} ${selected ? "is-selected" : ""} ${isNeutralTrigger ? "is-neutral-trigger" : ""} ${data.orphan ? "is-orphan" : ""} ${data.error || incomplete ? "has-error" : ""} ${data.executionMode && !data.visited ? "is-unvisited" : ""}`}>
      <Handle type="target" id="in" position={Position.Left} className="automation-canvas-handle in" isConnectable={!["trigger"].includes(kind)} />
      <div className="automation-canvas-node-top">
        <span>{data.typeLabel}</span>
        {data.status ? <em className={`automation-node-status is-${String(data.status).toLowerCase()}`}>{statusMark(data.status)} {data.status}</em> : data.executionMode ? <em className="automation-node-status is-pending">PENDING</em> : null}
      </div>
      <strong>{data.label}</strong>
      {!isEnd ? <small>{data.summary || data.subtitle}</small> : null}
      {data.orphan ? <small className="automation-node-warning">⚠ Não conectado</small> : null}
      {incomplete ? <small className="automation-node-error">⚠ Configuração incompleta</small> : null}
      {data.branch ? <small className="automation-node-branch">Resultado {data.branch === "NAO" ? "NÃO" : data.branch}</small> : null}
      {data.error ? <small className="automation-node-error">⚠ {data.error}</small> : null}
      {isCondition ? (
        <>
          <div className="automation-condition-handles" aria-hidden="true"><span>NÃO</span><span>SIM</span></div>
          <Handle type="source" id="false" position={Position.Bottom} className="automation-canvas-handle out false" />
          <Handle type="source" id="true" position={Position.Top} className="automation-canvas-handle out true" />
        </>
      ) : !isEnd ? (
        <Handle type="source" id="default" position={Position.Right} className="automation-canvas-handle out" />
      ) : null}
    </div>
  );
});

const nodeTypes = { spaceNode: SpaceNode };

const groupCatalog = (catalog = NODE_CATALOG) => catalog.reduce((groups, item) => {
  const key = item.category || "Outros";
  groups[key] = groups[key] || [];
  groups[key].push(item);
  return groups;
}, {});

const issueLabel = (issue = {}) => {
  const labels = {
    action_requires_one_output: "A ação precisa de uma saída.",
    action_edge_must_not_branch: "A ação possui uma conexão com branch inválida.",
    condition_edge_requires_branch: "A condição possui conexão sem SIM/NÃO.",
    duplicate_edge: "Existe uma conexão duplicada.",
    duplicate_node_id: "Existe um node com ID duplicado.",
    edge_missing_source: "Existe uma conexão sem origem válida.",
    edge_missing_target: "Existe uma conexão sem destino válido.",
    end_has_output: "Fim não pode ter saída.",
    graph_cycle_detected: "O workflow possui ciclo.",
    missing_condition_false_edge: "A condição não possui saída NÃO.",
    missing_condition_true_edge: "A condição não possui saída SIM.",
    missing_path_to_end: "Não existe caminho até Fim.",
    missing_pipeline_id: "Pipeline obrigatório não foi preenchido.",
    missing_stage_id: "Stage obrigatório não foi preenchido.",
    node_not_reachable: "Este node não é alcançável a partir do gatilho.",
    orphan_node: "Este node está órfão.",
    pipeline_not_found: "Pipeline não existe ou está inativo.",
    self_loop: "Conexão circular no mesmo node.",
    single_trigger_required: "O workflow precisa ter exatamente um gatilho.",
    stage_not_found: "Stage não existe.",
    stage_not_in_pipeline: "Stage não pertence ao pipeline.",
    trigger_has_input: "Gatilho não pode ter entrada.",
    trigger_not_configured: "Escolha um gatilho antes de publicar.",
    trigger_requires_one_output: "Gatilho precisa de uma saída.",
    unknown_action: "Ação não registrada.",
    unknown_condition: "Condição não registrada.",
    unknown_trigger: "Gatilho não registrado.",
    unsupported_node_type: "Tipo de node não suportado.",
  };
  return labels[issue.code] || issue.message || issue.code || "Problema de validação.";
};

function PropertiesPanel({ node, crm, onConfigChange, onDeleteNode, onOpenTriggerPicker }) {
  const canonical = node?.data?.canonical || null;
  const pipelines = Array.isArray(crm?.pipelines) ? crm.pipelines : [];
  const stages = Array.isArray(crm?.stages) ? crm.stages : [];
  const config = canonical?.config || {};
  const pipelineId = config.pipelineId || "";
  const stageOptions = stages.filter((stage) => stage.pipelineId === pipelineId);
  const isAction = canonical?.type === "action";
  const isNeutralTrigger = canonical?.type === "trigger" && !triggerTypeOf(canonical);
  return (
    <aside className={`automation-properties ${node ? "is-open" : ""}`}>
      {node ? (
        <>
          <header>
            <span>{node.data?.typeLabel}</span>
            <h3>{node.data?.label}</h3>
            <p>{nodeKey(canonical)}</p>
          </header>
          {isNeutralTrigger ? (
            <div className="automation-properties-form">
              <p>Escolha o evento que inicia esta automação.</p>
              <button type="button" className="button button-outline button-small" onClick={() => onOpenTriggerPicker(node.id)}>Selecionar gatilho</button>
            </div>
          ) : isAction ? (
            <div className="automation-properties-form">
              <label>
                <span>Pipeline</span>
                <select value={pipelineId} onChange={(event) => onConfigChange(node.id, { pipelineId: event.target.value })}>
                  <option value="">Selecione</option>
                  {pipelines.map((pipeline) => <option key={pipeline.id} value={pipeline.id}>{pipeline.name}</option>)}
                </select>
              </label>
              <label>
                <span>Stage</span>
                <select value={config.stageId || ""} onChange={(event) => onConfigChange(node.id, { stageId: event.target.value })} disabled={!pipelineId}>
                  <option value="">Selecione</option>
                  {stageOptions.map((stage) => <option key={stage.id} value={stage.id}>{stage.name}</option>)}
                </select>
              </label>
            </div>
          ) : (
            <div className="automation-properties-form"><small>Este tipo não possui configuração editável nesta fase.</small></div>
          )}
          <button type="button" className="automation-danger-button" onClick={() => onDeleteNode(node.id)}>Excluir etapa</button>
        </>
      ) : (
        <div className="automation-properties-empty">Selecione um node no canvas.</div>
      )}
    </aside>
  );
}

function ExecutionInspector({ node, runDetail, onBackToEditor }) {
  const canonical = node?.data?.canonical || null;
  const step = node?.data?.executionStep || null;
  const run = runDetail?.run || null;
  const version = runDetail?.version || null;
  const event = runDetail?.event || null;
  return (
    <aside className="automation-properties automation-execution-inspector">
      <button type="button" className="automation-back-button" onClick={onBackToEditor}>Voltar ao editor</button>
      <section className="automation-run-summary">
        <span>{statusText(run?.status)}</span>
        <strong>Version V{version?.versionNumber || "-"}</strong>
        <small>{formatDuration(run?.duration_ms)} · {run?.event_type || event?.eventType || "-"}</small>
        <small>Event {compactId(run?.event_id || event?.eventId)}</small>
      </section>
      {node ? (
        <>
          <header>
            <span>{node.data?.typeLabel}</span>
            <h3>{node.data?.label}</h3>
            <p>{nodeKey(canonical)}</p>
          </header>
          <div className="automation-execution-grid">
            <span>Status</span><strong>{statusText(step?.status)}</strong>
            <span>Started</span><strong>{formatTime(step?.started_at)}</strong>
            <span>Finished</span><strong>{formatTime(step?.finished_at)}</strong>
            <span>Tentativas</span><strong>{step?.attempt_count ?? "-"}</strong>
            {canonical?.type === "condition" ? <><span>Matched</span><strong>{step?.output?.matched === true ? "SIM" : step?.output?.matched === false ? "NÃO" : "-"}</strong></> : null}
            {canonical?.type === "action" ? <><span>Action type</span><strong>{canonical.actionType || canonical.action_type || "-"}</strong></> : null}
            {canonical?.type === "action" ? <><span>Idempotency</span><strong>{step?.input?.idempotencyKey ? `Protected ${compactId(step.input.idempotencyKey)}` : "-"}</strong></> : null}
          </div>
          <details>
            <summary>Input</summary>
            <JsonBlock value={step?.input || {}} />
          </details>
          <details>
            <summary>Output</summary>
            <JsonBlock value={step?.output || {}} />
          </details>
          {step?.error ? <details open><summary>Erro</summary><JsonBlock value={step.error} /></details> : null}
        </>
      ) : (
        <div className="automation-properties-empty">Selecione um node para ver os dados da execução.</div>
      )}
      {event ? (
        <details>
          <summary>Evento</summary>
          <div className="automation-execution-grid">
            <span>Tipo</span><strong>{event.eventType || "-"}</strong>
            <span>Origem</span><strong>{event.source || "-"}</strong>
            <span>Aggregate</span><strong>{event.aggregateType || "-"} · {compactId(event.aggregateId)}</strong>
            <span>Horário</span><strong>{formatTime(event.occurredAt)}</strong>
          </div>
          <JsonBlock value={event.payload || {}} />
        </details>
      ) : null}
    </aside>
  );
}

function AutomationEditor({ automation, rows, runs, runDetail, crm, catalog, validationIssues, onGraphPreview, onSaveDraft, onBackToEditor }) {
  const shellRef = useRef(null);
  const editorGraph = automation?.draft_version?.graph || automation?.active_version?.graph || { nodes: [], edges: [] };
  const executionMode = Boolean(runDetail?.run && runDetail?.version?.graph);
  const graph = executionMode ? runDetail.version.graph : editorGraph;
  const issues = Array.isArray(validationIssues) ? validationIssues : [];
  const issuesByNode = useMemo(() => issues.reduce((map, issue) => {
    if (!issue?.nodeId) return map;
    map[issue.nodeId] = [...(map[issue.nodeId] || []), issue];
    return map;
  }, {}), [issues]);
  const executionOverlay = useMemo(() => executionMode ? buildExecutionOverlay({ graph, run: runDetail?.run, steps: runDetail?.steps || [] }) : null, [executionMode, graph, runDetail]);
  const enrichedGraph = useMemo(() => canonicalToFlow(graph, {
    executionOverlay,
    errors: Object.fromEntries(Object.entries(issuesByNode).map(([nodeId, rows]) => [nodeId, issueLabel(rows[0])])),
  }), [graph, executionOverlay, issuesByNode]);
  const decorateNode = (node, edgeRows = []) => {
    const canonical = node.data?.canonical || {};
    const summary = actionSummary(canonical, crm);
    const orphan = canonical.type !== "trigger" && !edgeRows.some((edge) => edge.target === node.id);
    return {
      ...node,
      data: {
        ...node.data,
        summary,
        orphan,
        incomplete: canonical.type === "action" && (!canonical.config?.pipelineId || !canonical.config?.stageId),
      },
    };
  };
  const decorateNodes = useCallback((nodeRows, edgeRows) => nodeRows.map((node) => decorateNode(node, edgeRows)), [crm]);
  const [nodes, setNodes, onNodesChange] = useNodesState(decorateNodes(enrichedGraph.nodes, enrichedGraph.edges));
  const [edges, setEdges, onEdgesChange] = useEdgesState(enrichedGraph.edges);
  const [selectedNodeId, setSelectedNodeId] = useState("");
  const [selectedEdgeId, setSelectedEdgeId] = useState("");
  const [picker, setPicker] = useState({ open: false, mode: "add", x: 18, y: 66, flowPosition: null, connection: null, nodeId: "" });
  const [saveState, setSaveState] = useState("saved");
  const [viewport, setViewport] = useState(enrichedGraph.viewport || { x: 0, y: 0, zoom: 1 });
  const [connectionError, setConnectionError] = useState("");
  const autosave = useRef(null);
  const latestGraph = useRef(graph);
  const automationUpdatedAt = useRef(automation?.updated_at || "");
  const saveDraftRef = useRef(onSaveDraft);
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  const viewportRef = useRef(viewport);
  const reconnectingEdgeRef = useRef(null);

  useEffect(() => { nodesRef.current = nodes; }, [nodes]);
  useEffect(() => { edgesRef.current = edges; }, [edges]);
  useEffect(() => { viewportRef.current = viewport; }, [viewport]);

  useEffect(() => {
    saveDraftRef.current = onSaveDraft;
  }, [onSaveDraft]);

  useEffect(() => {
    automationUpdatedAt.current = automation?.updated_at || "";
  }, [automation?.updated_at]);

  if (!autosave.current) {
    autosave.current = createDebouncedAutosave((nextGraph) => {
      setSaveState("saving");
      return Promise.resolve(saveDraftRef.current?.(nextGraph, { baseUpdatedAt: automationUpdatedAt.current }))
        .then((data) => {
          if (data?.updatedAt) automationUpdatedAt.current = data.updatedAt;
          setSaveState("saved");
        })
        .catch((error) => {
          setSaveState("error");
          setConnectionError(error?.message || "Erro ao salvar");
        });
    }, 700);
  }

  const canonicalFromFlow = (nextNodes = nodesRef.current, nextEdges = edgesRef.current, nextViewport = viewportRef.current) => ({
    ...flowToCanonical({ nodes: nextNodes, edges: nextEdges }, graph),
    schemaVersion: graph.schemaVersion || 1,
    ui: { ...(graph.ui || {}), viewport: nextViewport },
  });

  const scheduleSave = (nextGraph) => {
    latestGraph.current = nextGraph;
    onGraphPreview?.(nextGraph);
    setSaveState("dirty");
    autosave.current.schedule(nextGraph);
  };

  const markDirty = (nextNodes = nodes, nextEdges = edges, nextViewport = viewport) => {
    if (executionMode) return;
    scheduleSave(canonicalFromFlow(nextNodes, nextEdges, nextViewport));
  };

  const flushSave = () => {
    if (!autosave.current?.pending()) return Promise.resolve();
    return autosave.current.flush();
  };

  useEffect(() => {
    setNodes(decorateNodes(enrichedGraph.nodes, enrichedGraph.edges));
    setEdges(enrichedGraph.edges);
    setSelectedNodeId("");
    setSelectedEdgeId("");
    setSaveState("saved");
    setViewport(enrichedGraph.viewport || { x: 0, y: 0, zoom: 1 });
  }, [automation?.id, automation?.draft_version?.id, automation?.active_version?.id, runDetail?.run?.id, setNodes, setEdges, enrichedGraph.nodes, enrichedGraph.edges]);

  useEffect(() => {
    const handleKey = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        flushSave();
        return;
      }
      if (event.key === "Escape") {
        setSelectedNodeId("");
        setSelectedEdgeId("");
        setPicker((current) => ({ ...current, open: false }));
        return;
      }
      if (!["Backspace", "Delete"].includes(event.key)) return;
      if (document.activeElement && ["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement.tagName)) return;
      if (selectedEdgeId) {
        event.preventDefault();
        const nextEdges = edges.filter((edge) => edge.id !== selectedEdgeId);
        setEdges(nextEdges);
        setSelectedEdgeId("");
        markDirty(nodes, nextEdges);
      } else if (selectedNodeId) {
        event.preventDefault();
        deleteNode(selectedNodeId);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [selectedNodeId, selectedEdgeId, nodes, edges, viewport]);

  useEffect(() => () => {
    autosave.current?.flush();
  }, []);

  const selectedNode = nodes.find((node) => node.id === selectedNodeId) || null;
  const metrics = automation?.metrics || {};
  const version = automation?.draft_version?.version_number || automation?.active_version?.version_number || "-";
  const workflows = Array.isArray(rows) ? rows : [];
  const runRows = Array.isArray(runs) ? runs : [];
  const catalogRows = Array.isArray(catalog) && catalog.length ? catalog : NODE_CATALOG;
  const hasTrigger = nodes.some((node) => node.data?.canonical?.type === "trigger");
  const pickerItems = catalogRows.filter((item) => {
    if (picker.mode === "trigger") return item.kind === "trigger";
    if (picker.mode === "connect") return ["condition", "action", "end"].includes(item.kind);
    if (item.kind === "trigger" && hasTrigger) return false;
    return true;
  });
  const catalogGroups = groupCatalog(pickerItems);

  const pickerStyle = picker.mode === "add"
    ? {}
    : {
      left: `${Math.max(12, Math.round(picker.x || 18))}px`,
      top: `${Math.max(12, Math.round(picker.y || 66))}px`,
      right: "auto",
      bottom: "auto",
    };

  const closePicker = () => setPicker((current) => ({ ...current, open: false }));

  const openAddPicker = () => {
    setPicker((current) => ({
      ...current,
      open: !current.open || current.mode !== "add",
      mode: "add",
      x: 18,
      y: 66,
      connection: null,
      flowPosition: null,
      nodeId: "",
    }));
  };

  const openTriggerPicker = (nodeId) => {
    const node = nodesRef.current.find((row) => row.id === nodeId);
    const rect = shellRef.current?.getBoundingClientRect();
    const x = node ? Math.round((node.position.x * (viewportRef.current.zoom || 1)) + viewportRef.current.x + 18) : 18;
    const y = node ? Math.round((node.position.y * (viewportRef.current.zoom || 1)) + viewportRef.current.y + 92) : 66;
    setPicker({ open: true, mode: "trigger", x: rect ? Math.min(Math.max(12, x), rect.width - 350) : x, y: rect ? Math.min(Math.max(12, y), rect.height - 220) : y, flowPosition: null, connection: null, nodeId });
  };

  const addNode = (item) => {
    if (executionMode) return;
    if (picker.mode === "trigger") {
      const canonical = updateTriggerType(canonicalFromFlow(), picker.nodeId || selectedNodeId, item.type);
      const nextFlow = canonicalToFlow(canonical);
      const nextNodes = decorateNodes(nextFlow.nodes, nextFlow.edges);
      setNodes(nextNodes);
      setEdges(nextFlow.edges);
      setSelectedNodeId(picker.nodeId || selectedNodeId);
      setSelectedEdgeId("");
      closePicker();
      markDirty(nextNodes, nextFlow.edges);
      return;
    }
    if (picker.mode === "connect" && picker.connection && picker.flowPosition) {
      const result = addConnectedCatalogNode(canonicalFromFlow(), item, picker.connection, { position: picker.flowPosition });
      if (!result.ok) {
        setConnectionError(result.reason);
        closePicker();
        return;
      }
      const nextFlow = canonicalToFlow(result.graph);
      const nextNodes = decorateNodes(nextFlow.nodes, nextFlow.edges);
      setNodes(nextNodes);
      setEdges(nextFlow.edges);
      setSelectedNodeId(result.node.id);
      setSelectedEdgeId("");
      closePicker();
      markDirty(nextNodes, nextFlow.edges);
      return;
    }
    const position = {
      x: Math.round((window.innerWidth * 0.5 - viewport.x) / (viewport.zoom || 1)),
      y: Math.round((window.innerHeight * 0.45 - viewport.y) / (viewport.zoom || 1)),
    };
    const canonical = catalogItemToNode(item, { position, existingIds: new Set(nodes.map((node) => node.id)) });
    const flowNode = decorateNodes(canonicalToFlow({ nodes: [canonical], edges: [] }, {}).nodes, edges)[0];
    const nextNodes = [...nodes, flowNode];
    setNodes(nextNodes);
    setSelectedNodeId(flowNode.id);
    setSelectedEdgeId("");
    closePicker();
    markDirty(nextNodes, edges);
  };

  const deleteNode = (nodeId) => {
    if (executionMode) return;
    const canonical = canonicalFromFlow();
    const relatedEdges = (canonical.edges || []).filter((edge) => edge.from === nodeId || edge.to === nodeId).length;
    if (relatedEdges && !window.confirm(`Excluir esta etapa também removerá ${relatedEdges} conexões.`)) return;
    const result = removeNodeAndEdges(canonical, nodeId);
    if (result.blocked) {
      setConnectionError("Mantenha pelo menos um gatilho no workflow.");
      return;
    }
    const nextFlow = canonicalToFlow(result.graph);
    const nextNodes = decorateNodes(nextFlow.nodes, nextFlow.edges);
    setNodes(nextNodes);
    setEdges(nextFlow.edges);
    setSelectedNodeId("");
    setSelectedEdgeId("");
    markDirty(nextNodes, nextFlow.edges);
  };

  const updateConfig = (nodeId, patch) => {
    if (executionMode) return;
    const canonical = updateActionConfig(canonicalFromFlow(), nodeId, patch, crm);
    const nextFlow = canonicalToFlow(canonical);
    const nextNodes = decorateNodes(nextFlow.nodes, nextFlow.edges);
    setNodes(nextNodes);
    setSelectedNodeId(nodeId);
    markDirty(nextNodes, edges);
  };

  const validateConnection = (connection) => {
    if (executionMode) return false;
    const result = isValidConnection(canonicalFromFlow(), connection);
    if (!result.ok) setConnectionError(result.reason);
    else setConnectionError("");
    return result.ok;
  };

  const connect = (connection) => {
    if (executionMode) return;
    const result = connectNodes(canonicalFromFlow(), connection);
    if (!result.ok) {
      setConnectionError(result.reason);
      return;
    }
    setConnectionError("");
    const nextFlow = canonicalToFlow(result.graph);
    setEdges(nextFlow.edges);
    setPicker((current) => ({ ...current, open: false }));
    markDirty(nodes, nextFlow.edges);
  };

  const eventPoint = (event) => {
    const source = event.changedTouches?.[0] || event;
    return { x: Number(source.clientX || 0), y: Number(source.clientY || 0) };
  };

  const openConnectionPicker = (event, connection) => {
    if (!connection?.source) return;
    const point = eventPoint(event);
    const rect = shellRef.current?.getBoundingClientRect();
    const x = rect ? point.x - rect.left : point.x;
    const y = rect ? point.y - rect.top : point.y;
    const currentViewport = viewportRef.current || { x: 0, y: 0, zoom: 1 };
    const zoom = currentViewport.zoom || 1;
    const flowPosition = {
      x: Math.round((x - currentViewport.x) / zoom),
      y: Math.round((y - currentViewport.y) / zoom),
    };
    setConnectionError("");
    setPicker({
      open: true,
      mode: "connect",
      x: rect ? Math.min(Math.max(12, x), rect.width - 350) : x,
      y: rect ? Math.min(Math.max(12, y), rect.height - 260) : y,
      flowPosition,
      connection: {
        source: connection.source,
        sourceHandle: connection.sourceHandle || "default",
        targetHandle: "in",
      },
      nodeId: "",
    });
  };

  const onConnectEnd = (event, connectionState) => {
    if (executionMode || reconnectingEdgeRef.current || connectionState?.isValid) return;
    const from = connectionState?.fromNode?.id || connectionState?.from?.nodeId || connectionState?.fromHandle?.nodeId || "";
    const sourceHandle = connectionState?.fromHandle?.id || connectionState?.fromHandle?.handleId || connectionState?.from?.handleId || "default";
    if (from) openConnectionPicker(event, { source: from, sourceHandle });
  };

  const onReconnect = (oldEdge, connection) => {
    if (executionMode) return;
    const result = reconnectNodes(canonicalFromFlow(), oldEdge.id, connection);
    if (!result.ok) {
      setConnectionError(result.reason);
      return;
    }
    const nextFlow = canonicalToFlow(result.graph);
    const nextNodes = decorateNodes(nextFlow.nodes, nextFlow.edges);
    setNodes(nextNodes);
    setEdges(nextFlow.edges);
    setSelectedEdgeId("");
    setConnectionError("");
    reconnectingEdgeRef.current = { id: oldEdge.id, reconnected: true };
    markDirty(nextNodes, nextFlow.edges);
  };

  const onReconnectStart = (_, edge) => {
    reconnectingEdgeRef.current = { id: edge.id, reconnected: false };
  };

  const onReconnectEnd = () => {
    const current = reconnectingEdgeRef.current;
    reconnectingEdgeRef.current = null;
    if (executionMode || !current || current.reconnected) return;
    const nextGraph = removeEdge(canonicalFromFlow(), current.id);
    const nextFlow = canonicalToFlow(nextGraph);
    const nextNodes = decorateNodes(nextFlow.nodes, nextFlow.edges);
    setNodes(nextNodes);
    setEdges(nextFlow.edges);
    setSelectedEdgeId("");
    markDirty(nextNodes, nextFlow.edges);
  };

  const onNodeDragStop = (_, node) => {
    const nextNodes = nodes.map((row) => row.id === node.id ? { ...row, position: node.position } : row);
    setNodes(nextNodes);
    markDirty(nextNodes, edges);
  };

  const onMoveEnd = (_, nextViewport) => {
    setViewport(nextViewport);
    markDirty(nodes, edges, nextViewport);
  };

  const selectIssueNode = (nodeId) => {
    if (!nodeId) return;
    setSelectedNodeId(nodeId);
    setSelectedEdgeId("");
  };

  return (
    <ReactFlowProvider>
      <div className="automation-workbench">
        <aside className="automation-workflows">
          <header>
            <span>Automações</span>
            <button type="button" data-automation-create>+</button>
          </header>
          <div className="automation-workflow-list">
            {workflows.map((row) => {
              const rowVersion = row.draft_version?.version_number || row.active_version?.version_number || "-";
              return (
                <button type="button" key={row.id} className={row.id === automation?.id ? "is-active" : ""} data-automation-open={row.id}>
                  <strong>{row.name}</strong>
                  <span>{row.status} · V{rowVersion}</span>
                </button>
              );
            })}
          </div>
          <div className="automation-run-list">
            <header><span>Execuções</span></header>
            {runRows.length ? runRows.slice(0, 50).map((run) => (
              <button type="button" key={run.id} className={runDetail?.run?.id === run.id ? "is-active" : ""} data-automation-run={run.id}>
                <strong>{statusMark(run.status)} {statusText(run.status)}</strong>
                <span>{formatTime(run.created_at || run.started_at)} · V{run.version_number || run.automation_version_number || "-"} · {formatDuration(run.duration_ms)}</span>
                <small>{compactId(run.event_id)}</small>
              </button>
            )) : (
              <div className="automation-run-empty">
                <strong>Nenhuma execução ainda.</strong>
                <span>Quando esta automação for disparada, as execuções aparecerão aqui.</span>
              </div>
            )}
          </div>
        </aside>
        <main className="automation-builder">
          <header className="automation-builder-head">
            <div>
              <span>← Automações</span>
              <h2>{automation?.name || "Workflow"}</h2>
            </div>
            <div className="automation-builder-actions">
              <span className={`automation-status-pill is-${String(executionMode ? runDetail?.run?.status : automation?.status || "draft").toLowerCase()}`}>{executionMode ? `RUN ${statusText(runDetail?.run?.status)}` : automation?.status || "DRAFT"}</span>
              {executionMode ? <button type="button" className="button button-outline button-small" onClick={onBackToEditor}>Voltar ao editor</button> : <button type="button" className="button button-outline button-small" disabled>Executar teste</button>}
              {!executionMode ? (
                <button type="button" className={`button button-outline button-small automation-save-state is-${saveState}`} onClick={flushSave}>
                  {saveState === "saving" ? "Salvando..." : saveState === "dirty" ? "Alterações não salvas" : saveState === "error" ? "Erro ao salvar" : "Salvo"}
                </button>
              ) : null}
              {!executionMode ? <button type="button" className="button button-solid button-small" data-automation-publish={automation?.id || ""}>Publicar</button> : null}
            </div>
          </header>
          <section className="automation-canvas-shell" ref={shellRef}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeDragStop={executionMode ? undefined : onNodeDragStop}
              onConnect={executionMode ? undefined : connect}
              onConnectEnd={executionMode ? undefined : onConnectEnd}
              onReconnect={executionMode ? undefined : onReconnect}
              onReconnectStart={executionMode ? undefined : onReconnectStart}
              onReconnectEnd={executionMode ? undefined : onReconnectEnd}
              isValidConnection={executionMode ? undefined : validateConnection}
              onMoveEnd={executionMode ? undefined : onMoveEnd}
              onNodeClick={(_, node) => {
                setSelectedNodeId(node.id);
                setSelectedEdgeId("");
                if (!executionMode && node.data?.canonical?.type === "trigger" && !triggerTypeOf(node.data.canonical)) openTriggerPicker(node.id);
              }}
              onEdgeClick={(_, edge) => { setSelectedEdgeId(edge.id); setSelectedNodeId(""); }}
              onPaneClick={() => { setSelectedNodeId(""); setSelectedEdgeId(""); closePicker(); }}
              defaultViewport={graph.viewport || graph.ui?.viewport || undefined}
              fitView={!(graph.viewport || graph.ui?.viewport)}
              snapToGrid
              snapGrid={[16, 16]}
              minZoom={0.35}
              maxZoom={1.7}
              nodesDraggable={!executionMode}
              nodesConnectable={!executionMode}
              edgesReconnectable={!executionMode}
              reconnectRadius={14}
              elementsSelectable
              proOptions={{ hideAttribution: true }}
            >
              <Background gap={24} size={1} color="rgba(255,255,255,.11)" />
              <Controls showInteractive={false} />
              <MiniMap pannable zoomable nodeStrokeWidth={3} />
            </ReactFlow>
            {!executionMode ? <button type="button" className="automation-add-node" onClick={openAddPicker}>+ Adicionar etapa</button> : null}
            {!executionMode && picker.open ? (
              <div className={`automation-node-picker is-${picker.mode}`} style={pickerStyle}>
                {Object.entries(catalogGroups).map(([category, items]) => (
                  <section key={category}>
                    <h4>{category}</h4>
                    {items.map((item) => <button key={`${item.kind}:${item.type}`} type="button" onClick={() => addNode(item)}><span>{item.label}</span><small>{item.description}</small></button>)}
                  </section>
                ))}
                {!Object.keys(catalogGroups).length ? <small>Nenhuma etapa disponível.</small> : null}
              </div>
            ) : null}
            {connectionError ? <div className="automation-inline-error">{connectionError}</div> : null}
            {executionMode ? (
              <div className="automation-execution-banner">
                <strong>{statusText(runDetail?.run?.status)}</strong>
                <span>Version V{runDetail?.version?.versionNumber || "-"} · {formatDuration(runDetail?.run?.duration_ms)} · {executionOverlay?.path?.length || 0} steps</span>
              </div>
            ) : null}
            {issues.length ? (
              <div className="automation-publish-issues">
                <strong>Não foi possível publicar</strong>
                <span>{issues.length} {issues.length === 1 ? "problema" : "problemas"}</span>
                {issues.slice(0, 6).map((issue, index) => (
                  <button key={`${issue.code}:${issue.nodeId || issue.edgeId || index}`} type="button" onClick={() => selectIssueNode(issue.nodeId)}>
                    {issueLabel(issue)}
                  </button>
                ))}
              </div>
            ) : null}
            <div className="automation-canvas-metrics">
              <span>{metrics.totalRuns || 0} execuções</span>
              <span>{metrics.successRate || 0}% success</span>
            </div>
          </section>
        </main>
        {executionMode
          ? <ExecutionInspector node={selectedNode} runDetail={runDetail} onBackToEditor={onBackToEditor} />
          : <PropertiesPanel node={selectedNode} crm={crm} onConfigChange={updateConfig} onDeleteNode={deleteNode} onOpenTriggerPicker={openTriggerPicker} />}
      </div>
    </ReactFlowProvider>
  );
}

function mountAutomationEditor(root, props) {
  if (!root.__spaceAutomationEditorRoot) root.__spaceAutomationEditorRoot = createRoot(root);
  root.__spaceAutomationEditorRoot.render(<AutomationEditor {...props} />);
}

window.SpaceAutomationEditor = { mount: mountAutomationEditor, canonicalToFlow, flowToCanonical };
