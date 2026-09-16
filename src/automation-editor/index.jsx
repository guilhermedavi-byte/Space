import React, { memo, useEffect, useMemo, useRef, useState } from "react";
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
  canonicalToFlow,
  catalogItemToNode,
  connectNodes,
  createDebouncedAutosave,
  flowToCanonical,
  isValidConnection,
  nodeKey,
  removeNodeAndEdges,
  updateActionConfig,
} = require("./graph-adapter.cjs");

const statusMark = (status) => {
  if (status === "SUCCESS") return "✓";
  if (status === "FAILED") return "!";
  if (status === "RUNNING") return "…";
  if (status === "SKIPPED") return "↷";
  return "";
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
  const incomplete = kind === "action" && data.incomplete;
  return (
    <div className={`automation-canvas-node is-${kind} ${selected ? "is-selected" : ""} ${data.error || incomplete ? "has-error" : ""}`}>
      <Handle type="target" id="in" position={Position.Left} className="automation-canvas-handle in" isConnectable={!["trigger"].includes(kind)} />
      <div className="automation-canvas-node-top">
        <span>{data.typeLabel}</span>
        {data.status ? <em className={`automation-node-status is-${String(data.status).toLowerCase()}`}>{statusMark(data.status)} {data.status}</em> : null}
      </div>
      <strong>{data.label}</strong>
      {!isEnd ? <small>{data.summary || data.subtitle}</small> : null}
      {incomplete ? <small className="automation-node-error">⚠ Configuração incompleta</small> : null}
      {data.branch ? <small className="automation-node-branch">Branch {data.branch}</small> : null}
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
    trigger_requires_one_output: "Gatilho precisa de uma saída.",
    unknown_action: "Ação não registrada.",
    unknown_condition: "Condição não registrada.",
    unknown_trigger: "Gatilho não registrado.",
    unsupported_node_type: "Tipo de node não suportado.",
  };
  return labels[issue.code] || issue.message || issue.code || "Problema de validação.";
};

function PropertiesPanel({ node, crm, onConfigChange, onDeleteNode }) {
  const canonical = node?.data?.canonical || null;
  const pipelines = Array.isArray(crm?.pipelines) ? crm.pipelines : [];
  const stages = Array.isArray(crm?.stages) ? crm.stages : [];
  const config = canonical?.config || {};
  const pipelineId = config.pipelineId || "";
  const stageOptions = stages.filter((stage) => stage.pipelineId === pipelineId);
  const isAction = canonical?.type === "action";
  return (
    <aside className={`automation-properties ${node ? "is-open" : ""}`}>
      {node ? (
        <>
          <header>
            <span>{node.data?.typeLabel}</span>
            <h3>{node.data?.label}</h3>
            <p>{nodeKey(canonical)}</p>
          </header>
          {isAction ? (
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

function AutomationEditor({ automation, rows, runDetail, crm, catalog, validationIssues, onGraphPreview, onSaveDraft }) {
  const graph = automation?.draft_version?.graph || automation?.active_version?.graph || { nodes: [], edges: [] };
  const issues = Array.isArray(validationIssues) ? validationIssues : [];
  const issuesByNode = useMemo(() => issues.reduce((map, issue) => {
    if (!issue?.nodeId) return map;
    map[issue.nodeId] = [...(map[issue.nodeId] || []), issue];
    return map;
  }, {}), [issues]);
  const enrichedGraph = useMemo(() => canonicalToFlow(graph, {
    executionSteps: runDetail?.steps || [],
    errors: Object.fromEntries(Object.entries(issuesByNode).map(([nodeId, rows]) => [nodeId, issueLabel(rows[0])])),
  }), [graph, runDetail, issuesByNode]);
  const decorateNode = (node) => {
    const canonical = node.data?.canonical || {};
    const summary = actionSummary(canonical, crm);
    return {
      ...node,
      data: {
        ...node.data,
        summary,
        incomplete: canonical.type === "action" && (!canonical.config?.pipelineId || !canonical.config?.stageId),
      },
    };
  };
  const [nodes, setNodes, onNodesChange] = useNodesState(enrichedGraph.nodes.map(decorateNode));
  const [edges, setEdges, onEdgesChange] = useEdgesState(enrichedGraph.edges);
  const [selectedNodeId, setSelectedNodeId] = useState("");
  const [selectedEdgeId, setSelectedEdgeId] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saveState, setSaveState] = useState("saved");
  const [viewport, setViewport] = useState(enrichedGraph.viewport || { x: 0, y: 0, zoom: 1 });
  const [connectionError, setConnectionError] = useState("");
  const autosave = useRef(null);
  const latestGraph = useRef(graph);
  const automationUpdatedAt = useRef(automation?.updated_at || "");
  const saveDraftRef = useRef(onSaveDraft);

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

  const canonicalFromFlow = (nextNodes = nodes, nextEdges = edges, nextViewport = viewport) => ({
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
    scheduleSave(canonicalFromFlow(nextNodes, nextEdges, nextViewport));
  };

  const flushSave = () => {
    if (!autosave.current?.pending()) return Promise.resolve();
    return autosave.current.flush();
  };

  useEffect(() => {
    setNodes(enrichedGraph.nodes.map(decorateNode));
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
        setPickerOpen(false);
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
  const catalogGroups = groupCatalog(Array.isArray(catalog) && catalog.length ? catalog : NODE_CATALOG);

  const addNode = (item) => {
    const position = {
      x: Math.round((window.innerWidth * 0.5 - viewport.x) / (viewport.zoom || 1)),
      y: Math.round((window.innerHeight * 0.45 - viewport.y) / (viewport.zoom || 1)),
    };
    const canonical = catalogItemToNode(item, { position, existingIds: new Set(nodes.map((node) => node.id)) });
    const flowNode = decorateNode(canonicalToFlow({ nodes: [canonical], edges: [] }, {}).nodes[0]);
    const nextNodes = [...nodes, flowNode];
    setNodes(nextNodes);
    setSelectedNodeId(flowNode.id);
    setSelectedEdgeId("");
    setPickerOpen(false);
    markDirty(nextNodes, edges);
  };

  const deleteNode = (nodeId) => {
    const canonical = canonicalFromFlow();
    const relatedEdges = (canonical.edges || []).filter((edge) => edge.from === nodeId || edge.to === nodeId).length;
    if (relatedEdges && !window.confirm(`Excluir esta etapa também removerá ${relatedEdges} conexões.`)) return;
    const result = removeNodeAndEdges(canonical, nodeId);
    if (result.blocked) {
      setConnectionError("Mantenha pelo menos um gatilho no workflow.");
      return;
    }
    const nextFlow = canonicalToFlow(result.graph);
    const nextNodes = nextFlow.nodes.map(decorateNode);
    setNodes(nextNodes);
    setEdges(nextFlow.edges);
    setSelectedNodeId("");
    setSelectedEdgeId("");
    markDirty(nextNodes, nextFlow.edges);
  };

  const updateConfig = (nodeId, patch) => {
    const canonical = updateActionConfig(canonicalFromFlow(), nodeId, patch, crm);
    const nextFlow = canonicalToFlow(canonical);
    const nextNodes = nextFlow.nodes.map(decorateNode);
    setNodes(nextNodes);
    setSelectedNodeId(nodeId);
    markDirty(nextNodes, edges);
  };

  const validateConnection = (connection) => {
    const result = isValidConnection(canonicalFromFlow(), connection);
    if (!result.ok) setConnectionError(result.reason);
    else setConnectionError("");
    return result.ok;
  };

  const connect = (connection) => {
    const result = connectNodes(canonicalFromFlow(), connection);
    if (!result.ok) {
      setConnectionError(result.reason);
      return;
    }
    setConnectionError("");
    const nextFlow = canonicalToFlow(result.graph);
    setEdges(nextFlow.edges);
    markDirty(nodes, nextFlow.edges);
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
        </aside>
        <main className="automation-builder">
          <header className="automation-builder-head">
            <div>
              <span>← Automações</span>
              <h2>{automation?.name || "Workflow"}</h2>
            </div>
            <div className="automation-builder-actions">
              <span className={`automation-status-pill is-${String(automation?.status || "draft").toLowerCase()}`}>{automation?.status || "DRAFT"}</span>
              <button type="button" className="button button-outline button-small" disabled>Executar teste</button>
              <button type="button" className={`button button-outline button-small automation-save-state is-${saveState}`} onClick={flushSave}>
                {saveState === "saving" ? "Salvando..." : saveState === "dirty" ? "Alterações não salvas" : saveState === "error" ? "Erro ao salvar" : "Salvo"}
              </button>
              <button type="button" className="button button-solid button-small" data-automation-publish={automation?.id || ""}>Publicar</button>
            </div>
          </header>
          <section className="automation-canvas-shell">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeDragStop={onNodeDragStop}
              onConnect={connect}
              isValidConnection={validateConnection}
              onMoveEnd={onMoveEnd}
              onNodeClick={(_, node) => { setSelectedNodeId(node.id); setSelectedEdgeId(""); }}
              onEdgeClick={(_, edge) => { setSelectedEdgeId(edge.id); setSelectedNodeId(""); }}
              onPaneClick={() => { setSelectedNodeId(""); setSelectedEdgeId(""); }}
              defaultViewport={graph.viewport || undefined}
              fitView={!graph.viewport}
              snapToGrid
              snapGrid={[16, 16]}
              minZoom={0.35}
              maxZoom={1.7}
              nodesDraggable
              nodesConnectable
              elementsSelectable
              proOptions={{ hideAttribution: true }}
            >
              <Background gap={24} size={1} color="rgba(255,255,255,.11)" />
              <Controls showInteractive={false} />
              <MiniMap pannable zoomable nodeStrokeWidth={3} />
            </ReactFlow>
            <button type="button" className="automation-add-node" onClick={() => setPickerOpen((open) => !open)}>+ Adicionar etapa</button>
            {pickerOpen ? (
              <div className="automation-node-picker">
                {Object.entries(catalogGroups).map(([category, items]) => (
                  <section key={category}>
                    <h4>{category}</h4>
                    {items.map((item) => <button key={`${item.kind}:${item.type}`} type="button" onClick={() => addNode(item)}><span>{item.label}</span><small>{item.description}</small></button>)}
                  </section>
                ))}
              </div>
            ) : null}
            {connectionError ? <div className="automation-inline-error">{connectionError}</div> : null}
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
        <PropertiesPanel node={selectedNode} crm={crm} onConfigChange={updateConfig} onDeleteNode={deleteNode} />
      </div>
    </ReactFlowProvider>
  );
}

function mountAutomationEditor(root, props) {
  if (!root.__spaceAutomationEditorRoot) root.__spaceAutomationEditorRoot = createRoot(root);
  root.__spaceAutomationEditorRoot.render(<AutomationEditor {...props} />);
}

window.SpaceAutomationEditor = { mount: mountAutomationEditor, canonicalToFlow, flowToCanonical };
