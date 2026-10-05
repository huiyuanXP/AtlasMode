import type { Node, Edge } from '@xyflow/react';
import { MarkerType } from '@xyflow/react';
import type { PlanRevision, ViewState } from '@codemap/core';
import type {
  GraphData,
  AnnotationRecord,
  GroupRecord,
} from '../../api/client.js';
export interface CanvasData extends Record<string, unknown> {
  label: string;
  detail: string;
  kind: 'function' | 'file' | 'folder' | 'external' | 'group' | 'annotation';
  state: 'fact' | 'added' | 'modified' | 'deleted' | 'knowledge';
}
export type CanvasNode = Node<CanvasData>;
export function projectGraph(
  graph: GraphData,
  plan: PlanRevision | null,
  view: ViewState | null,
  groups: GroupRecord[],
  annotations: AnnotationRecord[],
  showImports: boolean,
) {
  const files = graph.nodes
    .filter((node) => node.kind === 'file')
    .map((node) => ({ ...node, state: 'fact' as CanvasData['state'] }));
  const functions = graph.nodes
    .filter((node) => node.kind === 'function')
    .map((node) => ({ ...node, state: 'fact' as CanvasData['state'] }));
  const fileId = (filePath: string) => {
    let file = files.find((item) => item.path === filePath);
    if (!file) {
      file = {
        id: `plan:file:${files.length}`,
        kind: 'file',
        path: filePath,
        parentId: `plan:folder:${filePath.split('/').slice(0, -1).join('/') || '.'}`,
        contentHash: '',
        state: 'added',
      };
      files.push(file);
    }
    return file.id;
  };
  for (const change of plan?.changes ?? []) {
    if (change.op === 'add_function')
      functions.push({
        id: change.id,
        kind: 'function',
        name: change.name,
        qualifiedName: change.name,
        fileId: fileId(change.filePath),
        signature: change.signature,
        range: { start: 0, end: 0, startLine: 1, endLine: 1 },
        exported: false,
        symbolKind: 'declaration',
        state: 'added',
      });
    if (change.op === 'update_function') {
      const node = functions.find((item) => item.id === change.functionId);
      if (node) {
        node.name = change.name ?? node.name;
        node.signature = change.signature ?? node.signature;
        node.fileId = change.filePath ? fileId(change.filePath) : node.fileId;
        node.state = 'modified';
      }
    }
    if (change.op === 'delete_function') {
      const node = functions.find((item) => item.id === change.functionId);
      if (node) node.state = 'deleted';
    }
  }
  const folders = new Map<
    string,
    { id: string; path: string; files: typeof files }
  >();
  for (const file of files) {
    let folder = folders.get(file.parentId);
    if (!folder) {
      const node = graph.nodes.find((item) => item.id === file.parentId);
      folder = {
        id: file.parentId,
        path:
          node?.kind === 'folder'
            ? node.path
            : file.path.split('/').slice(0, -1).join('/') || '.',
        files: [],
      };
      folders.set(file.parentId, folder);
    }
    folder.files.push(file);
  }
  const nodes: CanvasNode[] = [];
  let rowY = 0;
  for (const folder of folders.values()) {
    let fileY = 58;
    const folderHeight = folder.files.reduce(
      (height, file) =>
        height +
        Math.max(
          155,
          functions.filter((fn) => fn.fileId === file.id).length * 108 + 78,
        ) +
        22,
      76,
    );
    nodes.push({
      id: folder.id,
      type: 'frame',
      className: 'folder-frame',
      position: { x: 0, y: rowY },
      data: {
        label: folder.path === '.' ? '仓库根目录' : folder.path,
        detail: '目录',
        kind: 'folder',
        state: folder.id.startsWith('plan:') ? 'added' : 'fact',
      },
      style: { width: 430, height: folderHeight },
      selectable: true,
    });
    for (const file of folder.files) {
      const children = functions.filter((fn) => fn.fileId === file.id),
        height = Math.max(155, children.length * 108 + 78);
      nodes.push({
        id: file.id,
        type: 'frame',
        className: 'file-frame',
        parentId: folder.id,
        extent: 'parent',
        position: { x: 20, y: fileY },
        data: {
          label: file.path,
          detail: '文件',
          kind: 'file',
          state: file.state,
        },
        style: { width: 390, height },
      });
      children.forEach((fn, index) =>
        nodes.push({
          id: fn.id,
          type: 'function',
          parentId: file.id,
          extent: 'parent',
          position: { x: 18, y: 52 + index * 108 },
          data: {
            label: fn.name,
            detail: fn.signature,
            kind: 'function',
            state: fn.state,
          },
          ariaLabel: `${fn.state === 'fact' ? '真实' : '规划'}函数 ${fn.name}`,
        }),
      );
      fileY += height + 22;
    }
    rowY += folderHeight + 35;
  }
  graph.nodes
    .filter((node) => node.kind === 'external')
    .forEach((node, index) =>
      nodes.push({
        id: node.id,
        type: 'knowledge',
        position: { x: 490, y: index * 120 },
        data: {
          label: node.packageName,
          detail: node.version ?? '版本未知',
          kind: 'external',
          state: 'fact',
        },
      }),
    );
  const externalHeight =
    graph.nodes.filter((node) => node.kind === 'external').length * 120;
  groups.slice(0, 15).forEach((group, index) =>
    nodes.push({
      id: group.id,
      type: 'knowledge',
      position: { x: 490, y: externalHeight + index * 120 },
      data: {
        label: group.name,
        detail: `功能集 · ${group.members.length} 个成员 · ${group.source}`,
        kind: 'group',
        state: 'knowledge',
      },
    }),
  );
  annotations.slice(0, 15).forEach((annotation, index) =>
    nodes.push({
      id: annotation.id,
      type: 'knowledge',
      position: { x: 780, y: index * 130 },
      data: {
        label: annotation.constraint ? '约束说明' : '注释',
        detail: annotation.text,
        kind: 'annotation',
        state: 'knowledge',
      },
    }),
  );
  for (const node of nodes)
    node.position = view?.positions[node.id] ?? node.position;
  const rendered = new Set(nodes.map((node) => node.id));
  const deletedRelations = new Set(
    plan?.changes
      .filter((change) => change.op === 'delete_relation')
      .map((change) => change.relationId) ?? [],
  );
  const edges: Edge[] = graph.relations
    .filter(
      (relation) =>
        relation.target !== null &&
        rendered.has(relation.source) &&
        rendered.has(relation.target) &&
        (relation.type === 'calls' ||
          (showImports && relation.type === 'imports')),
    )
    .map((relation) => ({
      id: relation.id,
      source: relation.source,
      target: relation.target!,
      label: deletedRelations.has(relation.id) ? '规划删除' : relation.type,
      markerEnd: { type: MarkerType.ArrowClosed },
      reconnectable:
        relation.type === 'calls' && !deletedRelations.has(relation.id),
      style: {
        stroke: deletedRelations.has(relation.id) ? '#a63d40' : '#66839f',
        strokeWidth: 2,
        ...(deletedRelations.has(relation.id)
          ? { strokeDasharray: '6 4' }
          : {}),
      },
    }));
  for (const change of plan?.changes ?? [])
    if (
      change.op === 'add_call' &&
      rendered.has(change.source) &&
      rendered.has(change.target)
    )
      edges.push({
        id: change.id,
        source: change.source,
        target: change.target,
        label: '规划调用',
        reconnectable: true,
        markerEnd: { type: MarkerType.ArrowClosed },
        style: { stroke: '#b36a08', strokeWidth: 3, strokeDasharray: '6 4' },
      });
  for (const group of groups.slice(0, 15))
    for (const member of group.members)
      if (rendered.has(member))
        edges.push({
          id: `member:${group.id}:${member}`,
          source: member,
          target: group.id,
          label: '成员',
          reconnectable: false,
          style: { stroke: '#8d79aa', strokeDasharray: '3 5' },
        });
  for (const annotation of annotations.slice(0, 15))
    if (rendered.has(annotation.targetId))
      edges.push({
        id: `documents:${annotation.id}`,
        source: annotation.id,
        target: annotation.targetId,
        label: '说明',
        reconnectable: false,
        style: { stroke: '#8d79aa', strokeDasharray: '3 5' },
      });
  return { nodes, edges };
}
