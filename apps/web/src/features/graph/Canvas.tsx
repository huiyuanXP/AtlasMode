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
  type ReactFlowInstance,
  type Viewport,
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
import { layoutFunnel, type FunnelState, type FunnelLane } from "./funnel.js";
import type { FocusRequest } from "./focus.js";
export type { FocusRequest } from "./focus.js";
import "@xyflow/react/dist/style.css";
function CodeCard({ data }: NodeProps<GraphNode>) {
  const zh = useStrings();
  const n = data.node,
    callable = n.kind === "function" || n.kind === "file",
    lane = data.funnelLane as FunnelLane | undefined;
  return (
    <div
      className={`code-card ${data.layer} kind-${n.kind} ${lane ? `funnel-${lane}` : ""}`}
      data-funnel-lane={lane}
    >
      {callable && (
        <Handle type="target" position={lane ? Position.Top : Position.Left} />
      )}
      {lane && (
        <div className="funnel-card-lane">
          {
            zh[
              lane === "dependent"
                ? "funnelDependents"
                : lane === "dependency"
                  ? "funnelDependencies"
                  : lane === "selected"
                    ? "funnelCurrent"
                    : "funnelSide"
            ]
          }
          {data.reciprocal ? ` · ${zh.funnelReciprocal}` : ""}
        </div>
      )}
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
      {callable && (
        <Handle
          type="source"
          position={lane ? Position.Bottom : Position.Right}
        />
      )}
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
          node.position.x !== targets[i]!.position.x ||
          node.position.y !== targets[i]!.position.y ||
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
function OverviewViewport({
  active,
  saved,
}: {
  active: boolean;
  saved: { current: Viewport | undefined };
}) {
  const { getViewport, setViewport } = useReactFlow();
  const wasActive = useRef(false);
  useEffect(() => {
    if (active && !wasActive.current) saved.current ??= getViewport();
    if (!active && wasActive.current && saved.current) {
      void setViewport(saved.current, { duration: 0 });
      saved.current = undefined;
    }
    wasActive.current = active;
  }, [active, saved, getViewport, setViewport]);
  return null;
}
const nodeTypes = { code: CodeCard };
// React Flow queues explicit fit options. Stable overview options avoid a
// parent render overwriting that queued request with a fit of every node.
const overviewFitOptions = { padding: 0.25, maxZoom: 1 };
export function Canvas(props: {
  graph?: SubgraphResult;
  referenceNodes?: CodeNode[];
  operations: Operation[];
  view: ViewState;
  filter: LayerFilter;
  focusRequest?: FocusRequest;
  funnel?: FunnelState;
  funnelPending?: boolean;
  onFunnel: (node: CodeNode) => void;
  onExitFunnel: () => void;
  canEdit: boolean;
  relationType: PlannedRelation["type"];
  onSelect: (node: CodeNode) => void;
  onExpand?: (id: string) => void;
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
  const currentNodes = useRef(nodes);
  const instance = useRef<ReactFlowInstance<GraphNode, GraphEdge> | undefined>(
    undefined,
  );
  const savedViewport = useRef<Viewport | undefined>(undefined);
  const clickViewport = useRef<Viewport | undefined>(undefined);
  const clickTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  useEffect(
    () => () => clearTimeout(clickTimer.current),
    [props.graph?.snapshotId, props.focusRequest?.sequence],
  );
  const [settled, setSettled] = useState<number | undefined>();
  const [measurements, setMeasurements] = useState<
    Record<string, { width?: number; height?: number }>
  >({});
  const funnelProjection = useMemo(
    () =>
      props.funnel
        ? layoutFunnel(
            {
              ...projection,
              nodes: projection.nodes.map((n) => ({
                ...n,
                measured: measurements[n.id],
              })),
            },
            props.funnel.root.id,
          )
        : undefined,
    [projection, props.funnel, measurements],
  );
  useEffect(() => {
    const target = funnelProjection?.nodes ?? projection.nodes;
    let frame = 0;
    setSettled(undefined);
    const update = (next: GraphNode[]) => {
      currentNodes.current = next;
      setNodes(next);
    };
    if (
      !props.funnel ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      update(target);
      setSettled(props.funnel?.sequence);
      return;
    }
    const previous = new Map(
      currentNodes.current.map((n) => [n.id, n.position]),
    );
    const start = performance.now();
    const animate = (now: number) => {
      const progress = Math.min(1, (now - start) / 300);
      const eased = progress * progress * (3 - 2 * progress);
      if (progress === 1) {
        // Adopt exact destinations. Interpolation arithmetic can retain a tiny
        // rounding delta and prevent the viewport's adoption check from firing.
        update(target);
        setSettled(props.funnel?.sequence);
        return;
      }
      update(
        target.map((n) => {
          // New cards start at their normal overview position, not at the destination.
          const from =
            previous.get(n.id) ??
            projection.nodes.find((p) => p.id === n.id)!.position;
          return {
            ...n,
            position: {
              x: from.x + (n.position.x - from.x) * eased,
              y: from.y + (n.position.y - from.y) * eased,
            },
          };
        }),
      );
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [projection.nodes, funnelProjection, props.funnel]);
  useEffect(() => {
    if (!props.funnel && !props.funnelPending) return;
    const exit = (event: KeyboardEvent) => {
      if (event.key === "Escape") props.onExitFunnel();
    };
    window.addEventListener("keydown", exit);
    return () => window.removeEventListener("keydown", exit);
  }, [props.funnel, props.funnelPending, props.onExitFunnel]);
  const domain = (id: string) =>
    projection.nodes.find((n) => n.id === id)?.data.node.id;
  const selectedFocus =
    props.funnel &&
    props.focusRequest &&
    props.focusRequest.sequence > props.funnel.sequence
      ? props.focusRequest
      : undefined;
  const editable = props.canEdit && props.funnel?.root.kind !== "file";
  const edges = (funnelProjection?.edges ?? projection.edges).map((e) => ({
    ...e,
    markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
    reconnectable: editable && e.reconnectable,
  }));
  return (
    <div className="canvas-shell" aria-label={zh.graph}>
      <ReactFlow<GraphNode, GraphEdge>
        onInit={(flow) => {
          instance.current = flow;
        }}
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
        onNodesChange={(changes) => {
          setNodes((current) => {
            const next = applyNodeChanges(changes, current);
            currentNodes.current = next;
            return next;
          });
          const dimensions = changes.filter(
            (c) => c.type === "dimensions" && c.dimensions,
          );
          if (dimensions.length)
            setMeasurements((previous) => {
              const next = { ...previous };
              let changed = false;
              for (const change of dimensions)
                if (
                  change.type === "dimensions" &&
                  change.dimensions &&
                  (next[change.id]?.width !== change.dimensions.width ||
                    next[change.id]?.height !== change.dimensions.height)
                ) {
                  next[change.id] = change.dimensions;
                  changed = true;
                }
              return changed ? next : previous;
            });
        }}
        onNodeClick={(event, node) => {
          if (!props.funnel && event.detail < 2)
            clickViewport.current = instance.current?.getViewport();
          clearTimeout(clickTimer.current);
          // Wait for the double-click gesture before moving its target card.
          // Immediate single-click focus can move the card between click events.
          clickTimer.current = setTimeout(
            () => props.onSelect(node.data.node),
            200,
          );
        }}
        onNodeDoubleClick={(_, node) => {
          clearTimeout(clickTimer.current);
          if (
            node.data.node.kind === "file" ||
            node.data.node.kind === "function"
          ) {
            if (!props.funnel)
              savedViewport.current =
                clickViewport.current ?? instance.current?.getViewport();
            props.onFunnel(node.data.node);
          }
        }}
        onNodeDragStop={(_, node) => {
          if (!props.funnel)
            props.onLayout({
              ...props.view.positions,
              [node.id]: node.position,
            });
        }}
        nodesDraggable={!props.funnel}
        zoomOnDoubleClick={false}
        onEdgeClick={(_, edge) => {
          if (props.funnel?.root.kind !== "file" && edge.data)
            props.onEdge({ id: edge.id, ...edge.data });
        }}
        onConnect={(connection) => {
          const a = domain(connection.source),
            b = domain(connection.target);
          if (editable && a && b) props.onConnect(a, b, props.relationType);
        }}
        onReconnect={(edge, connection) => {
          const a = domain(connection.source),
            b = domain(connection.target);
          if (editable && a && b && edge.data)
            props.onConnect(a, b, props.relationType, {
              id: edge.id,
              ...edge.data,
            });
        }}
        nodesConnectable={editable}
        deleteKeyCode={null}
        fitView
        fitViewOptions={overviewFitOptions}
        minZoom={0.1}
        maxZoom={2}
        colorMode={props.view.theme}
      >
        <OverviewViewport active={!!props.funnel} saved={savedViewport} />
        <FocusViewport
          request={
            selectedFocus ??
            (props.funnel
              ? settled === props.funnel.sequence
                ? {
                    sequence: props.funnel.sequence,
                    nodeIds: funnelProjection?.nodes
                      .filter((n) => n.data.funnelLane !== "side")
                      .map((n) => n.data.node.id),
                  }
                : undefined
              : props.focusRequest)
          }
          targets={
            selectedFocus
              ? focusTargets(
                  funnelProjection?.nodes ?? projection.nodes,
                  selectedFocus,
                )
              : props.funnel
                ? (funnelProjection?.nodes.filter(
                    (n) => n.data.funnelLane !== "side",
                  ) ?? [])
                : focusTargets(projection.nodes, props.focusRequest)
          }
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
      {props.funnel && funnelProjection && (
        <div className="funnel-summary" role="status">
          <strong>{props.funnel.root.name}</strong>
          <span>
            ↑ {zh.funnelDependents} {funnelProjection.counts.dependents}
          </span>
          <span>◇ {zh.funnelCurrent} 1</span>
          <span>
            ↓ {zh.funnelDependencies} {funnelProjection.counts.dependencies}
          </span>
          <span>
            {zh.funnelSide} {funnelProjection.counts.side} · {zh.funnelUnknown}{" "}
            {props.funnel.unknownCount}
          </span>
          <button onClick={props.onExitFunnel}>{zh.exitFunnel}</button>
        </div>
      )}
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
