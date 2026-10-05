import {
  Background,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  useNodesState,
} from '@xyflow/react';
import type { Edge, Node, NodeProps } from '@xyflow/react';
import { demoGraph } from './demo.js';
import { useSelection } from './selection.js';

type FunctionNode = Node<{ label: string; signature: string }, 'function'>;

function FunctionCard({ data }: NodeProps<FunctionNode>) {
  return (
    <div className="function-card">
      <Handle type="target" position={Position.Left} />
      <span className="node-kind">DEMO FUNCTION</span>
      <strong>{data.label}()</strong>
      <code>{data.signature}</code>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

function FileFrame({ data }: NodeProps<Node<{ label: string }, 'file'>>) {
  return <span className="file-label">{data.label}</span>;
}

const nodeTypes = { function: FunctionCard, file: FileFrame };
const initialNodes: Node[] = demoGraph.nodes.map((node) => {
  if (node.kind === 'file')
    return {
      id: node.id,
      type: 'file',
      data: { label: node.path },
      position: { x: node.id === 'demo:notes-file' ? 0 : 440, y: 0 },
      style: { width: 390, height: 230 },
      ariaLabel: `Demo file ${node.path}`,
    };
  return {
    id: node.id,
    type: 'function',
    parentId: node.fileId,
    extent: 'parent',
    data: { label: node.name, signature: node.signature },
    position: { x: 28, y: 80 },
    ariaLabel: `Demo function ${node.name}`,
  };
});
const edges: Edge[] = demoGraph.relations.map((relation) => ({
  id: relation.id,
  source: relation.source,
  target: relation.target,
  label: 'demo calls',
  markerEnd: { type: MarkerType.ArrowClosed },
  style: { strokeWidth: 2 },
}));

export function DemoCanvas() {
  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const select = useSelection((state) => state.select);
  const selectedId = useSelection((state) => state.selectedId);
  const selected = demoGraph.nodes.find((node) => node.id === selectedId);
  return (
    <>
      <div className="canvas" aria-label="Demo function graph">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onNodeClick={(_event, node) => select(node.id)}
          onPaneClick={() => select(null)}
          nodesConnectable={false}
          edgesReconnectable={false}
          deleteKeyCode={null}
          fitView
          fitViewOptions={{ padding: 0.15 }}
          minZoom={0.3}
          maxZoom={2}
        >
          <Background gap={24} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
      <div className="selection" aria-live="polite">
        {selected?.kind === 'function'
          ? `${selected.name} · ${selected.signature}`
          : selected?.kind === 'file'
            ? selected.path
            : 'Select a function or file to inspect the demo.'}
      </div>
    </>
  );
}
