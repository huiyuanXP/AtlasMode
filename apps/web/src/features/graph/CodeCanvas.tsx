import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow,
  Handle,
  Position,
  Background,
  Controls,
  useNodesState,
} from '@xyflow/react';
import type {
  NodeProps,
  Connection,
  Edge,
  Viewport,
  ReactFlowInstance,
} from '@xyflow/react';
import type { PlanRevision, ViewState } from '@codemap/core';
import type {
  GraphData,
  AnnotationRecord,
  GroupRecord,
} from '../../api/client.js';
import { projectGraph } from './project.js';
import type { CanvasNode } from './project.js';
const labels = {
  fact: '真实代码',
  added: '规划新增',
  modified: '规划修改',
  deleted: '规划删除',
  knowledge: '知识记录',
};
function FunctionCard({ data }: NodeProps<CanvasNode>) {
  return (
    <div className={`code-card state-${data.state}`}>
      <Handle type="target" position={Position.Left} />
      <small>{labels[data.state]}</small>
      <strong>{data.label}()</strong>
      <code>{data.detail}</code>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
function Frame({ data }: NodeProps<CanvasNode>) {
  return (
    <div
      className={`frame-title ${data.state === 'added' ? 'planned-frame' : ''}`}
    >
      <Handle type="target" position={Position.Left} />
      <span>
        {data.detail} · {data.state === 'added' ? '规划新增' : '真实'}
      </span>
      <strong>{data.label}</strong>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
function KnowledgeCard({ data }: NodeProps<CanvasNode>) {
  return (
    <div className={`knowledge-card kind-${data.kind}`}>
      <Handle type="target" position={Position.Left} />
      <small>{data.kind === 'external' ? '外部依赖' : '知识记录'}</small>
      <strong>{data.label}</strong>
      <p>{data.detail}</p>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
const nodeTypes = {
  function: FunctionCard,
  frame: Frame,
  knowledge: KnowledgeCard,
};
interface Props {
  graph: GraphData;
  plan: PlanRevision | null;
  view: ViewState | null;
  groups: GroupRecord[];
  annotations: AnnotationRecord[];
  editConnections: boolean;
  showImports: boolean;
  busy: boolean;
  onSelect: (id: string, kind: string) => void;
  onSelection: (ids: string[]) => void;
  onLayout: (positions: ViewState['positions'], viewport?: Viewport) => void;
  onConnect: (connection: Connection, oldEdge?: Edge) => void;
}
export function CodeCanvas(props: Props) {
  const container = useRef<HTMLDivElement>(null),
    lastFitted = useRef<{ key: string; width: number; height: number } | null>(
      null,
    );
  const [size, setSize] = useState({ width: 0, height: 0 }),
    [instance, setInstance] = useState<ReactFlowInstance<
      CanvasNode,
      Edge
    > | null>(null);
  const projection = useMemo(
    () =>
      projectGraph(
        props.graph,
        props.plan,
        props.view,
        props.groups,
        props.annotations,
        props.showImports,
      ),
    [
      props.graph,
      props.plan,
      props.view,
      props.groups,
      props.annotations,
      props.showImports,
    ],
  );
  const [nodes, setNodes, onNodesChange] = useNodesState<CanvasNode>(
    projection.nodes,
  );
  const nodeKey = projection.nodes.map((node) => node.id).join('|');
  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const width = Math.floor(entry.contentRect.width),
        height = Math.floor(entry.contentRect.height);
      setSize((previous) =>
        previous.width === width && previous.height === height
          ? previous
          : { width, height },
      );
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    setNodes((previous) =>
      projection.nodes.map((node) => ({
        ...node,
        selected:
          previous.find((item) => item.id === node.id)?.selected ?? false,
      })),
    );
  }, [projection, setNodes]);
  useEffect(() => {
    if (!instance || !size.width || !size.height) return;
    const previous = lastFitted.current;
    const shouldFit =
      previous === null
        ? props.view === null || size.width < 500
        : previous.key !== nodeKey ||
          previous.width !== size.width ||
          previous.height !== size.height;
    if (!shouldFit) return;
    const timer = window.setTimeout(() => {
      void instance.fitView({ padding: 0.15, duration: 120 });
      lastFitted.current = { key: nodeKey, ...size };
    }, 80);
    return () => window.clearTimeout(timer);
  }, [instance, nodeKey, size.width, size.height, props.view === null]);
  const editable = !!props.plan && props.editConnections && !props.busy;
  return (
    <div
      ref={container}
      className="code-canvas"
      aria-label="真实代码与规划关系图"
    >
      {size.width > 0 && size.height > 0 && (
        <ReactFlow
          width={size.width}
          height={size.height}
          nodes={nodes}
          edges={projection.edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onInit={setInstance}
          onNodeClick={(_event, node) =>
            props.onSelect(node.id, node.data.kind)
          }
          onSelectionChange={({ nodes: selected }) =>
            props.onSelection(
              selected
                .filter(
                  (node) =>
                    node.data.kind === 'function' &&
                    !node.id.startsWith('plan:'),
                )
                .map((node) => node.id),
            )
          }
          onNodeDragStop={(_event, node) =>
            props.onLayout(
              { ...props.view?.positions, [node.id]: node.position },
              instance?.getViewport(),
            )
          }
          onMoveEnd={(event, viewport) => {
            if (event) props.onLayout(props.view?.positions ?? {}, viewport);
          }}
          onConnect={(connection) => props.onConnect(connection)}
          onReconnect={(edge, connection) => props.onConnect(connection, edge)}
          nodesConnectable={editable}
          edgesReconnectable={editable}
          deleteKeyCode={null}
          selectionOnDrag
          panOnDrag={[1, 2]}
          defaultViewport={props.view?.viewport ?? { x: 0, y: 0, zoom: 1 }}
          minZoom={0.15}
          maxZoom={2}
        >
          <Background gap={24} />
          <Controls showInteractive={false} />
        </ReactFlow>
      )}
    </div>
  );
}
