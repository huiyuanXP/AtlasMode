import { useEffect, useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  applyNodeChanges,
  MarkerType,
  type NodeProps,
  type ReactFlowInstance,
} from "@xyflow/react";
import type {
  CodeNode,
  Operation,
  SubgraphResult,
  ViewState,
} from "@codemap/core";
import { zh } from "../../app/strings.js";
import {
  projectGraph,
  type GraphNode,
  type GraphEdge,
  type LayerFilter,
} from "./projection.js";
import type { EdgeReference, PlannedRelation } from "../planning/operations.js";
import "@xyflow/react/dist/style.css";
function CodeCard({ data }: NodeProps<GraphNode>) {
  const n = data.node,
    callable = n.kind === "function";
  return (
    <div className={`code-card ${data.layer} kind-${n.kind}`}>
      {callable && <Handle type="target" position={Position.Left} />}
      <div className="card-meta">
        <span>
          {data.layer === "plan"
            ? zh.planned
            : data.layer === "anchor"
              ? zh.anchor
              : zh.code}
        </span>
        <span>{zh[n.kind]}</span>
      </div>
      <strong title={n.qualifiedName ?? n.name}>{n.name}</strong>
      <code title={n.filePath}>{n.filePath ?? n.qualifiedName ?? n.id}</code>
      {n.signature && <small title={n.signature}>{n.signature}</small>}
      {data.changes.map((change, i) => (
        <div className="card-change" key={i}>
          {change}
        </div>
      ))}
      {callable && <Handle type="source" position={Position.Right} />}
    </div>
  );
}
const nodeTypes = { code: CodeCard };
export function Canvas(props: {
  graph?: SubgraphResult;
  operations: Operation[];
  view: ViewState;
  filter: LayerFilter;
  selectedId?: string;
  canEdit: boolean;
  relationType: PlannedRelation["type"];
  onSelect: (node: CodeNode) => void;
  onExpand: (id: string) => void;
  onLayout: (positions: ViewState["positions"]) => void;
  onEdge: (edge: EdgeReference) => void;
  onConnect: (
    source: string,
    target: string,
    type: PlannedRelation["type"],
    edge?: EdgeReference,
  ) => void;
}) {
  const projection = useMemo(
    () =>
      projectGraph(
        props.graph,
        props.operations,
        props.filter,
        props.view.positions,
      ),
    [props.graph, props.operations, props.filter, props.view.positions],
  );
  const [nodes, setNodes] = useState(projection.nodes);
  const [instance, setInstance] =
    useState<ReactFlowInstance<GraphNode, GraphEdge>>();
  useEffect(() => setNodes(projection.nodes), [projection.nodes]);
  useEffect(() => {
    if (instance && props.selectedId) {
      const node = instance
        .getNodes()
        .find((n) => n.data.node.id === props.selectedId);
      if (node)
        void instance.fitView({
          nodes: [node],
          duration: 250,
          maxZoom: 1.1,
          padding: 0.5,
        });
    }
  }, [instance, props.selectedId]);
  const domain = (id: string) =>
    projection.nodes.find((n) => n.id === id)?.data.node.id;
  const edges = projection.edges.map((e) => ({
    ...e,
    markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
    reconnectable: props.canEdit && e.reconnectable,
  }));
  return (
    <div className="canvas-shell" aria-label={zh.graph}>
      <ReactFlow<GraphNode, GraphEdge>
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onInit={setInstance}
        onNodesChange={(changes) =>
          setNodes((current) => applyNodeChanges(changes, current))
        }
        onNodeClick={(_, node) => props.onSelect(node.data.node)}
        onNodeDoubleClick={(_, node) => {
          if (node.data.layer !== "plan") props.onExpand(node.data.node.id);
        }}
        onNodeDragStop={(_, node) =>
          props.onLayout({ ...props.view.positions, [node.id]: node.position })
        }
        onEdgeClick={(_, edge) => {
          if (edge.data) props.onEdge({ id: edge.id, ...edge.data });
        }}
        onConnect={(connection) => {
          const a = domain(connection.source),
            b = domain(connection.target);
          if (props.canEdit && a && b)
            props.onConnect(a, b, props.relationType);
        }}
        onReconnect={(edge, connection) => {
          const a = domain(connection.source),
            b = domain(connection.target);
          if (props.canEdit && a && b && edge.data)
            props.onConnect(a, b, props.relationType, {
              id: edge.id,
              ...edge.data,
            });
        }}
        nodesConnectable={props.canEdit}
        deleteKeyCode={null}
        fitView
        fitViewOptions={{ padding: 0.25, maxZoom: 1 }}
        minZoom={0.1}
        maxZoom={2}
        colorMode={props.view.theme}
      >
        <Background gap={22} size={1} />
        <Controls position="bottom-left" orientation="horizontal" />
        <MiniMap
          position="bottom-right"
          pannable
          zoomable
          nodeColor={(n) => (n.data.layer === "plan" ? "#a687d4" : "#8195aa")}
        />
      </ReactFlow>
      {!nodes.length && <div className="canvas-empty">{zh.graphEmpty}</div>}
      {projection.notices.length > 0 && (
        <details className="canvas-notices">
          <summary>
            ⚠ {zh.notices} ({projection.notices.length})
          </summary>
          <ul>
            {projection.notices.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
