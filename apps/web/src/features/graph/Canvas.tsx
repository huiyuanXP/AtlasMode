import { useEffect, useMemo, useRef, useState } from "react";
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
  useNodes,
  useNodesInitialized,
  useReactFlow,
} from "@xyflow/react";
import type {
  CodeNode,
  Operation,
  SubgraphResult,
  ViewState,
} from "@codemap/core";
import { useStrings } from "../../i18n/index.js";
import {
  projectGraph,
  focusTargets,
  type GraphNode,
  type GraphEdge,
  type LayerFilter,
} from "./projection.js";
import type { EdgeReference, PlannedRelation } from "../planning/operations.js";
import type { FocusRequest } from "./focus.js";
export type { FocusRequest } from "./focus.js";
import "@xyflow/react/dist/style.css";
function CodeCard({ data }: NodeProps<GraphNode>) {
  const zh = useStrings();
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
/** Consume explicit navigation only once, after the current projection has been
 * adopted and measured by React Flow. Layout/selection updates are not focus. */
function FocusViewport({
  request,
  targets,
}: {
  request?: FocusRequest;
  targets: GraphNode[];
}) {
  const { fitView, viewportInitialized } = useReactFlow<GraphNode, GraphEdge>();
  const initialized = useNodesInitialized();
  const rendered = useNodes<GraphNode>();
  const consumed = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (
      !request ||
      !targets.length ||
      !initialized ||
      !viewportInitialized ||
      consumed.current === request.sequence
    )
      return;
    // The old graph can contain the same ID. Wait until the newly supplied
    // projection reaches the canvas store, not just until any old node exists.
    const ready = targets.map((target) =>
      rendered.find((n) => n.id === target.id),
    );
    if (
      ready.some(
        (node, i) =>
          !node ||
          node.data !== targets[i]!.data ||
          !node.measured?.width ||
          !node.measured.height,
      )
    )
      return;
    consumed.current = request.sequence;
    void fitView({
      nodes: ready as GraphNode[],
      duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? 0
        : 250,
      // Explicit focus must fit even a widely spread saved layout. The manual
      // zoom controls retain their normal minimum; do not reposition targets.
      minZoom: 0,
      maxZoom: 1.1,
      padding: 0.5,
    });
  }, [request, targets, rendered, initialized, viewportInitialized, fitView]);
  return null;
}
const nodeTypes = { code: CodeCard };
export function Canvas(props: {
  graph?: SubgraphResult;
  referenceNodes?: CodeNode[];
  operations: Operation[];
  view: ViewState;
  filter: LayerFilter;
  focusRequest?: FocusRequest;
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
  const zh = useStrings();
  const projection = useMemo(
    () =>
      projectGraph(
        props.graph,
        props.operations,
        props.filter,
        props.view.positions,
        props.view.locale,
        props.referenceNodes,
      ),
    [
      props.graph,
      props.operations,
      props.filter,
      props.view.positions,
      props.view.locale,
      props.referenceNodes,
    ],
  );
  const [nodes, setNodes] = useState(projection.nodes);
  useEffect(() => setNodes(projection.nodes), [projection.nodes]);
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
        ariaLabelConfig={{
          "controls.zoomIn.ariaLabel": zh.zoomIn,
          "controls.zoomOut.ariaLabel": zh.zoomOut,
          "controls.fitView.ariaLabel": zh.fitView,
          "controls.interactive.ariaLabel": zh.toggleInteraction,
          "minimap.ariaLabel": zh.minimap,
        }}
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
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
        <FocusViewport
          request={props.focusRequest}
          targets={focusTargets(projection.nodes, props.focusRequest)}
        />
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
