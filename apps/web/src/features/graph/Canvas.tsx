import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ReactFlow,
  Background,
  Controls,
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
  Relation,
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
import { NodeIdentity, nodeIdentity } from "./nodeIdentity.js";
import {
  inspectionHighlight,
  FunnelOffsets,
  inspectionPlacement,
} from "./inspection.js";
import { MapPanel } from "./MapPanel.js";
import "./graph-inspection.css";
function CodeCard({ data }: NodeProps<GraphNode>) {
  const zh = useStrings();
  const n = data.node,
    callable = n.kind === "function" || n.kind === "file",
    lane = data.funnelLane as FunnelLane | undefined;
  return (
    <div
      className={`code-card ${data.layer} kind-${n.kind} ${lane ? `funnel-${lane}` : ""} inspection-${data.highlight ?? "idle"}`}
      data-funnel-lane={lane}
      data-highlight={String(data.highlight ?? "idle")}
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
        <span>{nodeIdentity(n, data.locale as "zh" | "en").typeLabel}</span>
      </div>
      <strong title={n.qualifiedName ?? n.name}>
        <NodeIdentity node={n} locale={data.locale as "zh" | "en"} />
      </strong>
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
  padding = 0.5,
  focusKey = "",
  blocked = false,
}: {
  request?: FocusRequest;
  targets: GraphNode[];
  padding?: number;
  focusKey?: string;
  blocked?: boolean;
}) {
  const { fitView, viewportInitialized } = useReactFlow<GraphNode, GraphEdge>();
  const initialized = useNodesInitialized();
  const rendered = useNodes<GraphNode>();
  const consumed = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (
      blocked ||
      !request ||
      !targets.length ||
      !initialized ||
      !viewportInitialized ||
      consumed.current === `${request.sequence}:${focusKey}`
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
          node.data.projectionData !== targets[i]!.data ||
          node.position.x !== targets[i]!.position.x ||
          node.position.y !== targets[i]!.position.y ||
          !node.measured?.width ||
          !node.measured.height,
      )
    )
      return;
    consumed.current = `${request.sequence}:${focusKey}`;
    void fitView({
      nodes: ready as GraphNode[],
      duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? 0
        : 250,
      // Explicit focus must fit even a widely spread saved layout. The manual
      // zoom controls retain their normal minimum; do not reposition targets.
      minZoom: 0,
      maxZoom: 1.1,
      padding,
    });
  }, [
    request,
    targets,
    rendered,
    initialized,
    viewportInitialized,
    fitView,
    padding,
    focusKey,
    blocked,
  ]);
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
  projectId?: string;
  selectedNodeId?: string;
  relationPreviewId?: string;
  fixedOperationRelationId?: string;
  previewRelation?: Relation;
  previewNodes?: CodeNode[];
  inspection?: ReactNode;
  onCloseInspection?: () => void;
  onPreviewRelation?: (id?: string) => void;
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
  const canvas = useRef<HTMLDivElement>(null);
  const [pageSize, setPageSize] = useState(3);
  const [size, setSize] = useState({ width: 800, height: 600 });
  const [mapExpanded, setMapExpanded] = useState(false);
  const [mapSelection, setMapSelection] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  }>();
  const [hovered, setHovered] = useState<string>();
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const layoutFrame = useRef(0);
  const dragging = useRef(false);
  const offsets = useRef(new FunnelOffsets());
  const [offsetVersion, setOffsetVersion] = useState(0);
  const [cameraBlocked, setCameraBlocked] = useState(false);
  const [cameraVersion, setCameraVersion] = useState(0);
  const stopHover = () => {
    clearTimeout(hoverTimer.current);
    setHovered(undefined);
  };
  const previewNode = (id: string) => {
    clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => {
      if (!dragging.current) setHovered(id);
    }, 90);
  };
  useEffect(() => () => clearTimeout(hoverTimer.current), []);
  useEffect(() => {
    setCameraBlocked(false);
    setMapExpanded(false);
  }, [props.projectId, props.graph?.snapshotId]);
  useEffect(() => {
    setCameraBlocked(false);
  }, [props.focusRequest?.sequence, props.funnel?.sequence]);
  const [pages, setPages] = useState({
    sequence: -1,
    dependents: 0,
    dependencies: 0,
    focusSequence: 0,
  });
  const activePages =
    pages.sequence === props.funnel?.sequence
      ? pages
      : { dependents: 0, dependencies: 0, focusSequence: 0 };
  useEffect(() => {
    if (!canvas.current) return;
    const update = () => {
      const { width, height } = canvas.current!.getBoundingClientRect();
      setSize({ width, height });
      setPageSize(width < 500 ? 1 : width < 800 ? 2 : 3);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(canvas.current);
    return () => observer.disconnect();
  }, []);
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
  const funnelBase = useMemo(
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
            {
              dependentsPage: activePages.dependents,
              dependenciesPage: activePages.dependencies,
              pageSize,
            },
          )
        : undefined,
    [
      projection,
      props.funnel,
      measurements,
      activePages.dependents,
      activePages.dependencies,
      pageSize,
    ],
  );
  const funnelProjection = useMemo(
    () =>
      funnelBase && props.funnel
        ? {
            ...funnelBase,
            nodes: offsets.current.apply(
              props.projectId ?? "",
              props.funnel.root.id,
              funnelBase.nodes,
            ),
          }
        : funnelBase,
    [funnelBase, props.projectId, props.funnel, offsetVersion],
  );
  useEffect(() => {
    if (dragging.current) return;
    const target = funnelProjection?.nodes ?? projection.nodes;
    cancelAnimationFrame(layoutFrame.current);
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
      layoutFrame.current = requestAnimationFrame(animate);
    };
    layoutFrame.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(layoutFrame.current);
  }, [projection.nodes, funnelProjection, props.funnel]);
  useEffect(() => {
    const exit = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      clearTimeout(clickTimer.current);
      if (mapExpanded) {
        setMapExpanded(false);
        event.preventDefault();
      } else if (props.inspection) {
        props.onCloseInspection?.();
        event.preventDefault();
      } else if (props.funnel || props.funnelPending) {
        props.onExitFunnel();
        event.preventDefault();
      }
      stopHover();
    };
    window.addEventListener("keydown", exit);
    return () => window.removeEventListener("keydown", exit);
  }, [
    mapExpanded,
    props.inspection,
    props.funnel,
    props.funnelPending,
    props.onCloseInspection,
    props.onExitFunnel,
  ]);
  const domain = (id: string) =>
    projection.nodes.find((n) => n.id === id)?.data.node.id;
  const selectedFocus =
    props.funnel &&
    props.focusRequest &&
    props.focusRequest.sequence > props.funnel.sequence &&
    props.focusRequest.sequence > activePages.focusSequence
      ? props.focusRequest
      : undefined;
  const editable = props.canEdit && props.funnel?.root.kind !== "file";
  const rawEdges = [...(funnelProjection?.edges ?? projection.edges)];
  if (
    props.previewRelation &&
    !rawEdges.some((e) => e.data?.domainId === props.previewRelation!.id)
  ) {
    const relation = props.previewRelation;
    const related = new Map((props.previewNodes ?? []).map((n) => [n.id, n]));
    const endpoint = (id: string | null) =>
      id &&
      (nodes.find((n) => n.data.node.id === id) ??
        nodes.find(
          (n) =>
            n.data.node.kind === "file" &&
            n.data.node.filePath === related.get(id)?.filePath,
        ));
    const source = endpoint(relation.sourceId),
      target = endpoint(relation.targetId);
    if (source && target)
      rawEdges.push({
        id: `evidence:${relation.id}`,
        source: source.id,
        target: target.id,
        data: {
          layer: "fact",
          domainId: relation.id,
          relationType: relation.type,
        },
        label: `${props.view.locale === "en" ? "Evidence preview" : "证据预览"} · ${relation.evidence.filePath}:${relation.evidence.line}`,
        selectable: false,
        reconnectable: false,
      });
  }
  const highlighted = inspectionHighlight(
    nodes,
    rawEdges,
    props.selectedNodeId,
    props.relationPreviewId ?? props.fixedOperationRelationId,
    hovered,
  );
  const edges = highlighted.edges.map((e) => ({
    ...e,
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 16,
      height: 16,
      color: e.style?.stroke as string,
    },
    reconnectable: editable && e.reconnectable,
  }));
  const selectedCard = nodes.find(
    (n) => n.data.node.id === props.selectedNodeId,
  );
  const viewport = instance.current?.getViewport() ?? { x: 0, y: 0, zoom: 1 };
  const selectionRect = selectedCard
    ? {
        x: selectedCard.position.x * viewport.zoom + viewport.x,
        y: selectedCard.position.y * viewport.zoom + viewport.y,
        width: (selectedCard.measured?.width ?? 270) * viewport.zoom,
        height: (selectedCard.measured?.height ?? 150) * viewport.zoom,
      }
    : undefined;
  const detailPlacement = inspectionPlacement(
    size.width,
    size.height,
    selectionRect,
  );
  const mapSelectionRect = mapExpanded ? mapSelection : selectionRect;
  const mapDetailPlacement = inspectionPlacement(
    size.width,
    size.height,
    mapSelectionRect,
  );
  const mapAbove = mapSelectionRect ? mapSelectionRect.y - 58 - 16 : 0;
  const mapBelow = mapSelectionRect
    ? size.height - mapSelectionRect.y - mapSelectionRect.height - 28
    : size.height - 70;
  const mapAtTop = mapExpanded && mapAbove > mapBelow;
  const mapHeight = mapExpanded
    ? Math.max(70, Math.min(168, (mapAtTop ? mapAbove : mapBelow) - 112))
    : undefined;
  const mapSide =
    props.inspection &&
    mapDetailPlacement.dock === "side" &&
    mapDetailPlacement.left > 12
      ? ("left" as const)
      : ("right" as const);
  const stopMotion = () => {
    cancelAnimationFrame(layoutFrame.current);
    clearTimeout(clickTimer.current);
    stopHover();
    setCameraBlocked(true);
    const flow = instance.current;
    if (flow) void flow.setViewport(flow.getViewport(), { duration: 0 });
  };
  const pageControls = (lane: "dependents" | "dependencies") => {
    const range = funnelProjection?.windows[lane];
    if (!range || range.total <= pageSize) return null;
    const label =
      lane === "dependents" ? zh.funnelDependents : zh.funnelDependencies;
    const choose = (page: number) => {
      stopHover();
      setCameraBlocked(false);
      setPages({
        ...activePages,
        sequence: props.funnel!.sequence,
        [lane]: page,
        focusSequence: props.focusRequest?.sequence ?? 0,
      });
    };
    return (
      <span className="funnel-pages">
        <button
          aria-label={`${label} · ${zh.funnelPrevious}`}
          disabled={range.page === 0}
          onClick={() => choose(range.page - 1)}
        >
          ←
        </button>
        {zh.funnelShowing} {range.start}–{range.end}/{range.total}
        <button
          aria-label={`${label} · ${zh.funnelNext}`}
          disabled={range.page + 1 >= range.pages}
          onClick={() => choose(range.page + 1)}
        >
          →
        </button>
      </span>
    );
  };
  return (
    <div
      className="canvas-shell"
      aria-label={zh.graph}
      ref={canvas}
      data-camera-version={cameraVersion}
      onFocusCapture={(event) => {
        const id = (event.target as HTMLElement)
          .closest(".react-flow__node")
          ?.getAttribute("data-id");
        const node = nodes.find((n) => n.id === id);
        if (node) previewNode(node.data.node.id);
      }}
      onBlurCapture={stopHover}
    >
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
        nodes={highlighted.nodes.map((n) => ({
          ...n,
          data: { ...n.data, locale: props.view.locale },
        }))}
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
        onPaneClick={() => {
          clearTimeout(clickTimer.current);
          stopHover();
          props.onCloseInspection?.();
          props.onPreviewRelation?.();
        }}
        onNodeMouseEnter={(_, node) => previewNode(node.data.node.id)}
        onNodeMouseLeave={stopHover}
        onEdgeMouseEnter={(_, edge) =>
          props.onPreviewRelation?.(edge.data?.domainId)
        }
        onEdgeMouseLeave={() => props.onPreviewRelation?.()}
        onMove={() => setCameraVersion((v) => v + 1)}
        onMoveStart={(event) => {
          if (event) {
            stopHover();
            clearTimeout(clickTimer.current);
          }
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
        onNodeDragStart={() => {
          dragging.current = true;
          stopMotion();
        }}
        onNodeDragStop={(_, node) => {
          dragging.current = false;
          if (props.funnel) {
            const base = funnelBase?.nodes.find(
              (n) => n.id === node.id,
            )?.position;
            if (base)
              offsets.current.move(
                props.projectId ?? "",
                props.funnel.root.id,
                node.id,
                node.position,
                base,
              );
            setOffsetVersion((v) => v + 1);
          } else
            props.onLayout({
              ...props.view.positions,
              [node.id]: node.position,
            });
        }}
        nodesDraggable
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
          blocked={cameraBlocked}
          padding={props.funnel && !selectedFocus ? 0.08 : 0.5}
          focusKey={
            props.funnel && !selectedFocus
              ? `${pageSize}:${funnelProjection?.windows.dependents.page}:${funnelProjection?.windows.dependencies.page}:${offsetVersion}`
              : ""
          }
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
        <MapPanel
          expanded={mapExpanded}
          onExpanded={(expanded) => {
            if (expanded) setMapSelection(selectionRect);
            setMapExpanded(expanded);
          }}
          selectedNodeId={props.selectedNodeId}
          locale={props.view.locale}
          loaded={nodes.length}
          side={mapSide}
          top={mapAtTop ? 58 : undefined}
          mapHeight={mapHeight}
          mapWidth={Math.max(80, Math.min(420, size.width - 24))}
          hiddenDetails={
            !!props.inspection &&
            mapExpanded &&
            (size.width < 850 || mapDetailPlacement.dock !== "side")
          }
          bottom={
            props.inspection &&
            !mapExpanded &&
            detailPlacement.dock === "bottom"
              ? Math.min(
                  size.height * 0.4 + 12,
                  size.height - (mapExpanded ? 280 : 120) - 60,
                )
              : 12
          }
        />
      </ReactFlow>
      {(props.selectedNodeId || hovered) && (
        <div className="inspection-legend">
          <span>
            ↑ {props.view.locale === "en" ? "Into selection" : "指向当前对象"}
          </span>
          <span>
            ↓ {props.view.locale === "en" ? "From selection" : "当前对象指向"}
          </span>
        </div>
      )}
      {props.inspection &&
        !(
          mapExpanded &&
          (size.width < 850 || mapDetailPlacement.dock !== "side")
        ) && (
          <div
            className={`inspection-overlay dock-${detailPlacement.dock}`}
            style={{
              left: detailPlacement.left,
              top: detailPlacement.top,
              width: detailPlacement.width,
              maxHeight: detailPlacement.maxHeight,
            }}
          >
            {props.inspection}
          </div>
        )}
      {props.funnel && funnelProjection && (
        <div className="funnel-summary" role="status">
          <strong>{props.funnel.root.name}</strong>
          <span>
            ↑ {zh.funnelDependents} {funnelProjection.counts.dependents}
          </span>
          {pageControls("dependents")}
          <span>◇ {zh.funnelCurrent} 1</span>
          <span>
            ↓ {zh.funnelDependencies} {funnelProjection.counts.dependencies}
          </span>
          {pageControls("dependencies")}
          {funnelProjection.reciprocalCount > 0 && (
            <span>
              {zh.funnelReciprocal} {funnelProjection.reciprocalCount}
            </span>
          )}
          <span>
            {zh.funnelSide} {funnelProjection.counts.side} · {zh.funnelUnknown}{" "}
            {props.funnel.unknownCount}
          </span>
          <button
            onClick={() => {
              offsets.current.clear(
                props.projectId ?? "",
                props.funnel!.root.id,
              );
              setOffsetVersion((v) => v + 1);
              setCameraBlocked(false);
            }}
          >
            {props.view.locale === "en" ? "Rearrange" : "重新排列"}
          </button>
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
