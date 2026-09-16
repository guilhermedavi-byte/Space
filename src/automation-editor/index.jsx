import React, { memo, useEffect, useMemo, useState } from "react";
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

const { canonicalToFlow, flowToCanonical, nodeKey } = require("./graph-adapter.cjs");

const statusMark = (status) => {
  if (status === "SUCCESS") return "✓";
  if (status === "FAILED") return "!";
  if (status === "RUNNING") return "…";
  if (status === "SKIPPED") return "↷";
  return "";
};

const SpaceNode = memo(({ data, selected }) => {
  const kind = data.kind || "action";
  const isCondition = kind === "condition";
  const isEnd = kind === "end";
  return (
    <div className={`automation-canvas-node is-${kind} ${selected ? "is-selected" : ""} ${data.error ? "has-error" : ""}`}>
      <Handle type="target" id="in" position={Position.Left} className="automation-canvas-handle in" isConnectable={!["trigger"].includes(kind)} />
      <div className="automation-canvas-node-top">
        <span>{data.typeLabel}</span>
        {data.status ? <em className={`automation-node-status is-${String(data.status).toLowerCase()}`}>{statusMark(data.status)} {data.status}</em> : null}
      </div>
      <strong>{data.label}</strong>
      {!isEnd ? <small>{data.subtitle}</small> : null}
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

function PropertiesPanel({ node, crm }) {
  const canonical = node?.data?.canonical || null;
  const pipelines = Array.isArray(crm?.pipelines) ? crm.pipelines : [];
  const stages = Array.isArray(crm?.stages) ? crm.stages : [];
  const config = canonical?.config || {};
  const pipelineId = config.pipelineId || pipelines[0]?.id || "";
  const stageOptions = stages.filter((stage) => stage.pipelineId === pipelineId);
  return (
    <aside className={`automation-properties ${node ? "is-open" : ""}`}>
      {node ? (
        <>
          <header>
            <span>{node.data?.typeLabel}</span>
            <h3>{node.data?.label}</h3>
            <p>{nodeKey(canonical)}</p>
          </header>
          {canonical?.type === "action" ? (
            <div className="automation-properties-form">
              <label><span>Pipeline</span><select value={pipelineId} disabled>{pipelines.map((pipeline) => <option key={pipeline.id} value={pipeline.id}>{pipeline.name}</option>)}</select></label>
              <label><span>Stage</span><select value={config.stageId || stageOptions[0]?.id || ""} disabled>{stageOptions.map((stage) => <option key={stage.id} value={stage.id}>{stage.name}</option>)}</select></label>
              <small>Configuração editável entra na Fase B. Nesta fundação o node já fica isolado do formulário.</small>
            </div>
          ) : (
            <div className="automation-properties-form"><small>Selecione nodes de ação para configurar campos operacionais.</small></div>
          )}
        </>
      ) : (
        <div className="automation-properties-empty">Selecione um node no canvas.</div>
      )}
    </aside>
  );
}

function AutomationEditor({ automation, rows, runs, runDetail, crm, onGraphPreview }) {
  const graph = automation?.draft_version?.graph || automation?.active_version?.graph || { nodes: [], edges: [] };
  const flow = useMemo(() => canonicalToFlow(graph, { executionSteps: runDetail?.steps || [] }), [graph, runDetail]);
  const [nodes, setNodes, onNodesChange] = useNodesState(flow.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(flow.edges);
  const [selectedNodeId, setSelectedNodeId] = useState("");

  useEffect(() => {
    setNodes(flow.nodes);
    setEdges(flow.edges);
    setSelectedNodeId("");
  }, [automation?.id, automation?.draft_version?.id, automation?.active_version?.id, runDetail?.run?.id, setNodes, setEdges, flow.nodes, flow.edges]);

  useEffect(() => {
    onGraphPreview?.(flowToCanonical({ nodes, edges }, graph));
  }, [nodes, edges]);

  const selectedNode = nodes.find((node) => node.id === selectedNodeId) || null;
  const metrics = automation?.metrics || {};
  const version = automation?.draft_version?.version_number || automation?.active_version?.version_number || "-";
  const workflows = Array.isArray(rows) ? rows : [];

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
              <button type="button" className="button button-outline button-small" disabled>Salvo</button>
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
              onNodeClick={(_, node) => setSelectedNodeId(node.id)}
              onPaneClick={() => setSelectedNodeId("")}
              fitView
              snapToGrid
              snapGrid={[16, 16]}
              minZoom={0.35}
              maxZoom={1.7}
              nodesDraggable
              nodesConnectable={false}
              elementsSelectable
              proOptions={{ hideAttribution: true }}
            >
              <Background gap={24} size={1} color="rgba(255,255,255,.11)" />
              <Controls showInteractive={false} />
              <MiniMap pannable zoomable nodeStrokeWidth={3} />
            </ReactFlow>
            <button type="button" className="automation-add-node" disabled title="Fase B">+</button>
            <div className="automation-canvas-metrics">
              <span>{metrics.totalRuns || 0} execuções</span>
              <span>{metrics.successRate || 0}% success</span>
            </div>
          </section>
        </main>
        <PropertiesPanel node={selectedNode} crm={crm} />
      </div>
    </ReactFlowProvider>
  );
}

function mountAutomationEditor(root, props) {
  if (!root.__spaceAutomationEditorRoot) root.__spaceAutomationEditorRoot = createRoot(root);
  root.__spaceAutomationEditorRoot.render(<AutomationEditor {...props} />);
}

window.SpaceAutomationEditor = { mount: mountAutomationEditor, canonicalToFlow, flowToCanonical };
